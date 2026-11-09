#!/usr/bin/env python3
"""TerritoryShatter audio pipeline — renders the SFX bank + music loop to audio/.
Deterministic (seeded) so builds are reproducible. Requires numpy.
Usage: python tools/make_audio.py
"""
import os, wave
import numpy as np

SR = 44100
np.random.seed(20261109)
OUT = os.path.join(os.path.dirname(__file__), '..', 'audio')
os.makedirs(OUT, exist_ok=True)

# ---------- DSP helpers ----------
def tt(dur):
    n = max(8, int(SR * dur))
    return np.arange(n) / SR

def soft(x, drive=1.6):
    return np.tanh(x * drive) / np.tanh(drive)

def white(n):
    return np.random.rand(n) - .5

def bell(f, dur, partials=((1, 1, .28), (2.76, .45, .10), (5.4, .2, .05), (8.9, .08, .02))):
    """Additive bell: partial = (ratio, amp, tau) -> amp*sin(2π f ratio t)*exp(-t/tau)."""
    t = tt(dur)
    x = np.zeros(len(t))
    for ratio, amp, tau in partials:
        x += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
    return x

def sweep(f0, f1, dur, kind='sine', partials=6):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / (dur / 2.2)) if f0 > f1 else f0 + (f1 - f0) * (1 - np.exp(-t / (dur / 1.6)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == 'sine':
        return np.sin(ph)
    x = np.zeros(len(t))
    for k in range(1, partials + 1):
        x += (1 / k) * np.sin(k * ph) if kind == 'saw' else (np.sin(k * ph) if k % 2 == 1 else 0)
    return x / (0.6 * partials)

def tilt(x, curve):
    """Log-frequency piecewise gain curve: [(freq, linearGain), ...] sorted by freq."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    fc = np.array([p[0] for p in curve]); gc = np.array([p[1] for p in curve])
    H = np.interp(np.log10(np.maximum(f, fc[0])), np.log10(fc), gc)
    return np.fft.irfft(X * H, len(x))

def hpass(x, fc):  return tilt(x, [(fc * 0.5, 0.001), (fc, 0.25), (fc * 2, 1.0), (SR // 2, 1.0)])
def lpass(x, fc):  return tilt(x, [(20, 1.0), (fc * 0.7, 1.0), (fc, 0.2), (fc * 1.6, 0.0005), (SR // 2, 0.0005)])

def taps(x, delay_s, gains):
    d = int(SR * delay_s)
    y = x.copy()
    for i, g in enumerate(gains):
        y[(i + 1) * d:] += x[:-(i + 1) * d] * g
    return y

def norm(x, peak=0.89):
    m = np.max(np.abs(x)) or 1
    return x * (peak / m)

def pan(x, p=0.0):
    """constant-power pan, p in [-1,1] -> (L,R)"""
    ang = (p + 1) * np.pi / 4
    return x * np.cos(ang), x * np.sin(ang)

def save(name, mono=None, stereo=None):
    path = os.path.join(OUT, name + '.wav')
    if stereo is not None:
        l, r = stereo
        inter = np.stack([norm(l), norm(r)], axis=1).reshape(-1)
        ch = 2
    else:
        inter = norm(mono); ch = 1
    data = (np.clip(inter, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f'  {name}.wav  {len(data)*2/1024:7.1f} KB')

# ---------- drums ----------
def kick():
    t = tt(.38)
    f = 48 + 115 * np.exp(-t / .028)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .13)
    click = white(len(t)) * np.exp(-t / .0018) * .5
    return soft(y + click, 1.4)

def snare():
    t = tt(.22)
    body = np.sin(2 * np.pi * 192 * t) * np.exp(-t / .04) * .8
    noise = hpass(white(len(t)), 1500) * np.exp(-t / .028) * .7
    return soft(body + noise, 1.5)

def hat(dur=.045, open_=False):
    n = int(SR * (.2 if open_ else dur))
    x = hpass(white(n), 6800) * np.exp(-tt(n / SR) / (.09 if open_ else .012))
    return x * .8

# ---------- SFX ----------
def sfx_click():
    t = tt(.12)
    save('click', np.sin(2 * np.pi * 1350 * t) * np.exp(-t / .018) + white(len(t)) * np.exp(-t / .0012) * .4)

def sfx_claim():
    x = np.zeros(int(SR * .9))
    for i, f in enumerate([659.3, 880.0, 1318.5]):  # E5 A5 E6
        b = bell(f, .55) * .55
        o = int(SR * .075 * i)
        x[o:o + len(b)] += b[:len(x) - o or None]
    x += hpass(white(len(x)), 8000) * np.exp(-tt(.9) / .2) * .012
    save('claim', taps(soft(x, 1.3), .09, [.18]))

def sfx_shard():
    b = bell(1568, .42, ((1, 1, .16), (2.76, .5, .07), (5.4, .3, .04), (11.2, .12, .02))).copy()
    b += hpass(white(len(b)), 9000) * np.exp(-tt(len(b) / SR) / .05) * .05
    save('shard', soft(b, 1.4))

def sfx_kill():
    t = tt(.5)
    thump = np.sin(2 * np.pi * np.cumsum(55 + 140 * np.exp(-t / .02)) / SR) * np.exp(-t / .14) * 1.1
    snap = hpass(white(len(t)), 1000) * np.exp(-t / .012) * .8
    ping = bell(2400, .2, ((1, .5, .05),)).astype(float)
    x = thump + snap
    x[:len(ping)] += ping
    save('kill', soft(x, 1.5))

def sfx_death():
    x = sweep(320, 65, 1.0, 'saw') * np.exp(-tt(1.0) / .28) * 1.1
    x += sweep(330, 72, 1.0, 'saw') * np.exp(-tt(1.0) / .32) * .5  # detuned
    wash = lpass(white(len(x)), 900) * np.exp(-tt(1.0) / .2) * .35
    x += wash
    save('death', soft(x, 1.45))

def sfx_shatter():
    dur = 1.0; x = np.zeros(int(SR * dur))
    for _ in range(7):
        f = np.random.uniform(900, 3400)
        b = bell(f, .5, ((1, .8, np.random.uniform(.05, .16)), (2.4, .3, .04), (5.9, .15, .025)))
        o = np.random.randint(0, int(SR * .12))
        x[o:o + len(b)] += b[:len(x) - o or None]
    crash = hpass(white(len(x)), 2400) * np.exp(-tt(dur) / .05) * .5
    boom = np.sin(2 * np.pi * 52 * tt(dur)) * np.exp(-tt(dur) / .3) * .9
    x = x * .8 + crash + boom
    bl, br = pan(soft(x, 1.35), 0)
    save('shatter', stereo=(bl, np.roll(br, int(SR * .006))))  # haas width

def sfx_nova():
    dur = 1.4; t = tt(dur)
    boom = np.sin(2 * np.pi * 45 * t) * np.exp(-t / .5) * 1.4
    body = lpass(white(len(t)), 2400) * np.exp(-t / .18) * 1.1
    crackle = (np.random.rand(len(t)) > .985).astype(float) * hpass(white(len(t)), 3000) * np.exp(-t / .4) * 2
    rumble = np.sin(2 * np.pi * 36 * t) * (0.5 + .5 * np.sin(2 * np.pi * 7 * t)) * np.exp(-t / .6) * .7
    save('nova', soft(boom + body + crackle + rumble, 1.25))

def sfx_stim():
    dur = .6; t = tt(dur)
    riser = sweep(240, 960, dur, 'saw', 5) * np.minimum(1, t / .08) * np.exp(-np.maximum(0, t - dur * .55) / .1)
    whoosh = hpass(white(len(t)), 900) * np.sin(np.pi * np.minimum(t / dur, 1)) ** 2 * .8
    save('stim', soft(riser * .9 + whoosh, 1.5))

def sfx_phase():
    x = sweep(520, 120, .95, 'sine') * np.sin(np.pi * np.minimum(tt(.95) / .95, 1)) ** 1.5
    x += sweep(300, 85, .95, 'sine') * np.exp(-tt(.95) / .5) * .6
    save('phase', taps(x, .16, [.3, .12]))

def sfx_scan():
    t = tt(.4); ping = np.sin(2 * np.pi * 988 * t) * np.exp(-t / .1)
    x = taps(ping, .26, [.5, .22])
    x += np.sin(2 * np.pi * 2964 * tt(.4)) * np.exp(-tt(.4) / .07) * .12
    save('scan', x)

def sfx_veil():
    dur = .85; t = tt(dur)
    hiss = lpass(white(len(t)), 650) * np.sin(np.pi * t / dur) ** 1.3 * 1.1
    drone = np.sin(2 * np.pi * 120 * t) * np.exp(-t / .5) * .5
    save('veil', soft(hiss + drone, 1.3))

def sfx_surge():
    dur = 1.0; t = tt(dur)
    hum = np.sin(2 * np.pi * 90 * t) * (.6 + .4 * np.sin(2 * np.pi * 9 * t))
    shimmer = sweep(400, 1700, dur, 'sine') * np.sin(np.pi * t / dur) * .5
    save('surge', soft(hum * np.sin(np.pi * t / dur) + shimmer, 1.4))

def sfx_ultready():
    dur = .9; x = np.zeros(int(SR * dur))
    for i, f in enumerate([659.3, 987.8]):
        stab = hpass(sweep(f, f, .22, 'saw', 6), 500) * np.exp(-tt(.22) / .09)
        o = int(SR * .03 + SR * .13 * i)
        x[o:o + len(stab)] += stab
    shimmer = hpass(white(len(x)), 8000) * np.exp(-tt(dur) / .3) * .04
    save('ultready', taps(soft(x + shimmer, 1.5), .12, [.25]))

# ---------- music: 16 bars of synthwave @ 124 BPM, A minor ----------
def midi(m): return 440 * 2 ** ((m - 69) / 12)

def music():
    bpm = 124
    beat = 60 / bpm
    step = beat / 4                      # 16th
    bars, steps = 16, 16                 # bars, steps/bar
    total = bars * steps * step
    n = int(SR * total)
    mixL = np.zeros(n); mixR = np.zeros(n)

    def place(sig, at_s, vol, p=0.0, ch_echo=0):
        l, r = pan(sig * vol, p)
        o = int(SR * at_s)
        m = min(len(sig), n - o)
        if m <= 0: return
        mixL[o:o + m] += l[:m]; mixR[o:o + m] += r[:m]
        if ch_echo:
            d = int(SR * ch_echo)
            o2 = o + d
            m2 = min(len(sig), n - o2)
            if m2 > 0:
                mixL[o2:o2 + m2] += l[:m2] * .32; mixR[o2:o2 + m2] += r[:m2] * .32

    K, SN, HC, HO = kick(), snare(), hat(), hat(open_=True)

    chords = [45, 45, 41, 41, 48, 48, 43, 43] * 2        # A2 A2 F2 F2 C3 C3 G2 G2
    arp_notes = [69, 72, 76, 79, 81, 79, 76, 72]          # A C E G A' G E C

    for bar in range(bars):
        root = chords[bar]
        bar_t = bar * steps * step
        for st in range(steps):
            t0 = bar_t + st * step
            if st % 4 == 0: place(K, t0, 1.0)
            if bar % 4 == 3 and st == 14: place(K, t0, .8)
            if st in (4, 12): place(SN, t0, .9)
            if st % 2 == 1: place(HC, t0, .32 if st % 4 == 1 else .22)
            if st == 15: place(HO, t0, .3)
            # bass: octave-bounce 8ths on even steps
            if st % 2 == 0:
                m = root + (12 if st % 8 == 6 else 0)
                f = midi(m)
                d = tt(step * 1.8)
                b = (np.sin(2 * np.pi * f * d) + .5 * np.sin(4 * np.pi * f * d) + .2 * np.sin(6 * np.pi * f * d))
                b = lpass(b, 1400) * np.minimum(1, d / .008) * np.exp(-np.maximum(0, d - step * 1.1) / .05)
                place(b, t0, .5)
            # arp 16ths
            f = midi(arp_notes[(bar * 3 + st) % len(arp_notes)])
            d = tt(step * .95)
            a = (np.sin(2 * np.pi * f * d) + .28 * np.sin(4 * np.pi * f * d) + .12 * np.sin(6 * np.pi * f * d)) * np.exp(-d / .09)
            place(a, t0, .3, p=.35, ch_echo=beat * .75)
        # pad for the bar: chord root/3rd/5th/oct, slow attack
        third = 3 if bar % 2 == 0 or chords[bar] in (45,) else 4
        third = 3 if chords[bar] in (45, 48) else 4 if chords[bar] == 41 else 4
        tones = [chords[bar] + 12, chords[bar] + 12 + third, chords[bar] + 19]
        barlen = steps * step
        d = tt(barlen * 1.02)
        pad = np.zeros(len(d))
        for m in tones:
            f = midi(m)
            pad += np.sin(2 * np.pi * f * d) * .5 + np.sin(2 * np.pi * (f * 1.004) * d) * .3
        env = np.minimum(1, d / (barlen * .35)) * np.minimum(1, (barlen * 1.02 - d) / (barlen * .3) + .2)
        pad = lpass(pad * env, 1100)
        place(pad, bar_t, .14, p=-.32)

    # riser on last bar
    rl = int(SR * steps * step)
    riser = hpass(white(rl), 2000) * np.linspace(0, 1, rl) ** 2
    place(riser, (bars - 1) * steps * step, .12)

    mix = np.stack([mixL, mixR])
    mix = soft(mix * 1.05, 1.35)
    save('music', stereo=(norm(mix[0], .8), norm(mix[1], .8)))

if __name__ == '__main__':
    print('Rendering TerritoryShatter audio bank ->', os.path.abspath(OUT))
    for fn in [sfx_click, sfx_claim, sfx_shard, sfx_kill, sfx_death, sfx_shatter, sfx_nova,
               sfx_stim, sfx_phase, sfx_scan, sfx_veil, sfx_surge, sfx_ultready]:
        fn()
    music()
    print('Done.')
