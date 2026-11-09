#!/usr/bin/env python3
"""TerritoryShatter audio pipeline v2 — warm arcade sound bank + music loop.
Design goals: round transients, musical pitches (pentatonic), rolled-off
digital harshness (>13kHz shelf), gentle soft-clip glue. Deterministic.
Usage: python tools/make_audio.py
"""
import os
import numpy as np

SR = 44100
np.random.seed(20261109)
OUT = os.path.join(os.path.dirname(__file__), '..', 'audio')
os.makedirs(OUT, exist_ok=True)

# ---------- DSP helpers ----------
def tt(dur):
    n = max(8, int(SR * dur))
    return np.arange(n) / SR

def soft(x, drive=1.4):
    return np.tanh(x * drive) / np.tanh(drive)

def white(n):
    return np.random.rand(n) - .5

def bell(f, dur, partials=((1, 1, .28), (2.01, .35, .12), (3.94, .12, .05))):
    t = tt(dur)
    x = np.zeros(len(t))
    for ratio, amp, tau in partials:
        x += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
    return x

def sweep(f0, f1, dur, kind='sine', partials=5):
    t = tt(dur)
    if f0 > f1:
        f = f1 + (f0 - f1) * np.exp(-t / (dur / 2.2))
    else:
        f = f0 + (f1 - f0) * (1 - np.exp(-t / (dur / 1.6)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == 'sine':
        return np.sin(ph)
    x = np.zeros(len(t))
    for k in range(1, partials + 1):
        x += (1 / k) * np.sin(k * ph)
    return x / (0.65 * partials)

def tilt(x, curve):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    fc = np.array([p[0] for p in curve], float); gc = np.array([p[1] for p in curve], float)
    H = np.interp(np.log10(np.maximum(f, fc[0])), np.log10(fc), gc)
    return np.fft.irfft(X * H, len(x))

def hpass(x, fc):  return tilt(x, [(fc * 0.5, 0.001), (fc, 0.25), (fc * 2, 1.0), (SR // 2, 1.0)])
def lpass(x, fc):  return tilt(x, [(20, 1.0), (fc * 0.7, 1.0), (fc, 0.2), (fc * 1.6, 0.0005), (SR // 2, 0.0005)])

def polish(x, top=0.3):
    """Mastering for SFX: roll off harsh top, glue with soft clip."""
    return soft(tilt(x, [(20, 1), (6000, 1), (13000, top), (22050, top * 0.35)]), 1.3)

def taps(x, delay_s, gains):
    d = int(SR * delay_s)
    y = x.copy()
    for i, g in enumerate(gains):
        y[(i + 1) * d:] += x[:-(i + 1) * d] * g
    return y

def norm(x, peak=0.85):
    m = np.max(np.abs(x)) or 1
    return x * (peak / m)

def pan(x, p=0.0):
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

import wave

def loop_seam(x, fade_s=.05):
    d = int(SR * fade_s)
    x[:d] = x[:d] * np.linspace(.5, 1, d) + x[-d:] * np.linspace(.5, 0, d)
    return x[:-d] if d else x

# ---------- drums (for music) ----------
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
    return hpass(white(n), 6800) * np.exp(-tt(n / SR) / (.09 if open_ else .012)) * .8

# ---------- SFX ----------
def sfx_click():
    t = tt(.09)
    x = (np.sin(2 * np.pi * 950 * t) + .15 * np.sin(2 * np.pi * 2850 * t)) * np.exp(-t / .012)
    x += white(len(t)) * np.exp(-t / .0012) * .12
    save('click', polish(x, .2))

def sfx_claim():
    """Happy mallet arp C5-E5-G5 with a warm sub hug."""
    x = np.zeros(int(SR * .95))
    for i, f in enumerate([523.25, 659.25, 783.99]):
        b = bell(f, .6) * .5
        o = int(SR * .085 * i)
        x[o:o + len(b)] += b[:len(x) - o or None]
    sub = np.sin(2 * np.pi * 130.8 * tt(.95)) * np.exp(-tt(.95) / .4) * .2
    x += sub + hpass(white(len(x)), 9000) * np.exp(-tt(.95) / .25) * .006
    save('claim', taps(polish(x, .18), .09, [.14]))

def sfx_shard():
    b = bell(1174.7, .4, ((1, 1, .15), (2.4, .3, .06), (4.16, .12, .025))).copy()
    b += hpass(white(len(b)), 9800) * np.exp(-tt(len(b) / SR) / .05) * .025
    save('shard', polish(b, .2))

def sfx_kill():
    """Pop-chirp + body thump + tiny coin ring."""
    t = tt(.5)
    chirp = sweep(700, 210, .16, 'saw', 4) * np.exp(-tt(.16) / .05) * .5
    body = np.sin(2 * np.pi * 62 * t) * np.exp(-t / .16) * .9
    x = body.copy(); x[:len(chirp)] += chirp
    coin = bell(2093, .18, ((1, .55, .07), (2.76, .18, .03)))
    o = int(SR * .02); x[o:o + len(coin)] += coin[:len(x) - o or None]
    x += hpass(white(len(t)), 1400) * np.exp(-t / .01) * .35
    save('kill', polish(x, .25))

def sfx_death():
    """Wobbly downer with vibrato, soft wash, warm sub — comedic, not harsh."""
    dur = 1.1; t = tt(dur)
    vib = 1 + .06 * np.sin(2 * np.pi * 9 * t)
    fall = (380 + (85 - 380) * (1 - np.exp(-t / .3)))
    ph = 2 * np.pi * np.cumsum(fall * vib) / SR
    x = (sum((1 / k) * np.sin(k * ph) for k in range(1, 5)) / 2.6) * np.exp(-t / .34)
    x += lpass(white(len(t)), 700) * np.exp(-t / .3) * .16
    x += np.sin(2 * np.pi * 45 * t) * np.exp(-np.maximum(0, t - dur * .55) / .18) * .7
    save('death', polish(x, .18))

def sfx_shatter():
    """Glass chimes in A-major pentatonic + soft crash + sub bloom."""
    dur = 1.1; x = np.zeros(int(SR * dur))
    for f in [880, 1046.5, 1174.7, 1318.5, 1568, 1760, 2093]:
        b = bell(f, .6, ((1, .8, np.random.uniform(.14, .26)), (2.4, .25, .06), (5.9, .1, .03)))
        o = np.random.randint(0, int(SR * .14))
        x[o:o + len(b)] += b[:len(x) - o or None]
    crash = hpass(white(len(x)), 2600) * np.exp(-tt(dur) / .07) * .22
    sub = np.sin(2 * np.pi * 47 * tt(dur)) * np.exp(-tt(dur) / .35) * .7
    x = x * .7 + crash + sub
    bl, br = pan(polish(x, .2), 0)
    save('shatter', stereo=(bl, np.roll(br, int(SR * .006))))

def sfx_nova():
    dur = 1.4; t = tt(dur)
    boom = np.sin(2 * np.pi * 42 * t) * np.exp(-t / .55) * 1.3
    body = lpass(white(len(t)), 1800) * np.exp(-t / .22) * .8
    crackle = (np.random.rand(len(t)) > .988).astype(float) * hpass(white(len(t)), 3200) * np.exp(-t / .5) * .9
    rumble = np.sin(2 * np.pi * 34 * t) * (0.5 + .5 * np.sin(2 * np.pi * 6 * t)) * np.exp(-t / .65) * .6
    save('nova', polish(boom + body + crackle + rumble, .3))

def sfx_stim():
    dur = .55; t = tt(dur)
    riser = sweep(300, 1150, dur, 'sine') * np.minimum(1, t / .07) * np.sin(np.pi * np.minimum(t / dur, 1)) ** .7
    whoosh = lpass(white(len(t)), 2600) * np.sin(np.pi * np.minimum(t / dur, 1)) ** 2 * .5
    save('stim', polish(riser * .8 + whoosh, .28))

def sfx_phase():
    x = sweep(500, 120, .95, 'sine') * np.sin(np.pi * np.minimum(tt(.95) / .95, 1)) ** 1.5
    x += sweep(504, 122, .95, 'sine') * np.exp(-tt(.95) / .5) * .5  # chorus detune
    x += sweep(300, 85, .95, 'sine') * np.exp(-tt(.95) / .5) * .5
    save('phase', polish(taps(x, .16, [.28, .1]), .25))

def sfx_scan():
    t = tt(.4)
    ping = np.sin(2 * np.pi * 880 * t) * np.exp(-t / .12)
    x = taps(ping, .24, [.45, .18])
    x += np.sin(2 * np.pi * 2640 * tt(.4)) * np.exp(-tt(.4) / .08) * .07
    save('scan', polish(x, .22))

def sfx_veil():
    dur = .85; t = tt(dur)
    hiss = lpass(white(len(t)), 560) * np.sin(np.pi * t / dur) ** 1.3
    drone = np.sin(2 * np.pi * 96 * t) * np.exp(-t / .55) * .4
    save('veil', polish(hiss + drone, .2))

def sfx_surge():
    dur = 1.0; t = tt(dur)
    hum = np.sin(2 * np.pi * 82 * t) * (.6 + .4 * np.sin(2 * np.pi * 6 * t)) * np.sin(np.pi * t / dur)
    shimmer = sweep(500, 1500, dur, 'sine') * np.sin(np.pi * t / dur) * .3
    save('surge', polish(hum + shimmer, .28))

def sfx_ultready():
    dur = .9; x = np.zeros(int(SR * dur))
    for i, f in enumerate([523.25, 784.0]):
        stab = hpass(sweep(f, f, .22, 'saw', 6), 420) * np.exp(-tt(.22) / .11) * .8
        o = int(SR * .04 + SR * .13 * i)
        x[o:o + len(stab)] += stab
    tail = bell(1568, .5, ((1, .3, .2),))
    x[-len(tail):] += tail
    x += hpass(white(len(x)), 8500) * np.exp(-tt(dur) / .3) * .015
    save('ultready', polish(x, .25))

def sfx_hover():
    dur = 2.2; t = tt(dur)
    body = lpass(white(len(t)), 260) * 1.1
    hum = np.sin(2 * np.pi * 64 * t) * .5 + np.sin(2 * np.pi * 128.5 * t) * .14
    trem = .8 + .2 * np.sin(2 * np.pi * 7.4 * t)
    save('hover', loop_seam(soft((body + hum) * trem, 1.15)))

def sfx_tension():
    dur = 3.0; t = tt(dur)
    drone = np.sin(2 * np.pi * 55 * t) * .8 + np.sin(2 * np.pi * 58.27 * t) * .5 + np.sin(2 * np.pi * 110.5 * t) * .12
    pulse = .6 + .4 * np.sin(2 * np.pi * 2 * t)
    air = lpass(white(len(t)), 420) * .2
    save('tension', loop_seam(polish(drone * pulse + air, .18), .08))

def sfx_alert():
    t = tt(.32)
    x = np.sin(2 * np.pi * 660 * t) * np.exp(-t / .06) * .8
    seg2 = np.sin(2 * np.pi * 880 * tt(.2)) * np.exp(-tt(.2) / .05) * .8
    o = int(SR * .11); x[o:o + len(seg2)] += seg2[:len(x) - o or None]
    save('alert', polish(x, .22))

def sfx_cross():
    dur = .34; t = tt(dur)
    whoosh = lpass(white(len(t)), 1800) * np.sin(np.pi * t / dur) ** 1.6 * .7
    drop = sweep(523.3, 440, dur, 'sine') * np.exp(-t / .2) * .4
    save('cross', polish(whoosh + drop, .25))

# ---------- music: 16 bars of synthwave @ 124 BPM, A minor ----------
def midi(m): return 440 * 2 ** ((m - 69) / 12)

def music():
    bpm = 124
    beat = 60 / bpm
    step = beat / 4
    bars, steps = 16, 16
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
            d = int(SR * ch_echo); o2 = o + d
            m2 = min(len(sig), n - o2)
            if m2 > 0:
                mixL[o2:o2 + m2] += l[:m2] * .32; mixR[o2:o2 + m2] += r[:m2] * .32

    K, SN, HC, HO = kick(), snare(), hat(), hat(open_=True)
    chords = [45, 45, 41, 41, 48, 48, 43, 43] * 2
    arp_notes = [69, 72, 76, 79, 81, 79, 76, 72]

    for bar in range(bars):
        root = chords[bar]
        bar_t = bar * steps * step
        for st in range(steps):
            t0 = bar_t + st * step
            if st % 4 == 0: place(K, t0, 1.0)
            if bar % 4 == 3 and st == 14: place(K, t0, .8)
            if st in (4, 12): place(SN, t0, .9)
            if st % 2 == 1: place(HC, t0, .22 if st % 4 == 1 else .16)
            if st == 15: place(HO, t0, .26)
            if st % 2 == 0:
                m = root + (12 if st % 8 == 6 else 0)
                f = midi(m)
                d = tt(step * 1.8)
                b = (np.sin(2 * np.pi * f * d) + .5 * np.sin(4 * np.pi * f * d) + .2 * np.sin(6 * np.pi * f * d))
                b = lpass(b, 1250) * np.minimum(1, d / .008) * np.exp(-np.maximum(0, d - step * 1.1) / .05)
                place(b, t0, .55)
            f = midi(arp_notes[(bar * 3 + st) % len(arp_notes)])
            d = tt(step * .95)
            a = (np.sin(2 * np.pi * f * d) + .28 * np.sin(4 * np.pi * f * d) + .12 * np.sin(6 * np.pi * f * d)) * np.exp(-d / .09)
            place(a, t0, .26, p=.35, ch_echo=beat * .75)
        third = 3 if chords[bar] in (45, 48) else 4
        tones = [chords[bar] + 12, chords[bar] + 12 + third, chords[bar] + 19]
        barlen = steps * step
        d = tt(barlen * 1.02)
        pad = np.zeros(len(d))
        for m in tones:
            f = midi(m)
            pad += np.sin(2 * np.pi * f * d) * .5 + np.sin(2 * np.pi * (f * 1.004) * d) * .3
        env = np.minimum(1, d / (barlen * .35)) * np.minimum(1, (barlen * 1.02 - d) / (barlen * .3) + .2)
        place(lpass(pad * env, 1000), bar_t, .13, p=-.32)

    rl = int(SR * steps * step)
    place(hpass(white(rl), 2000) * np.linspace(0, 1, rl) ** 2, (bars - 1) * steps * step, .1)

    mix = np.stack([mixL, mixR])
    mix = soft(mix, 1.3)
    save('music', stereo=(norm(mix[0], .78), norm(mix[1], .78)))

if __name__ == '__main__':
    print('Rendering TerritoryShatter audio bank v2 ->', os.path.abspath(OUT))
    for fn in [sfx_click, sfx_claim, sfx_shard, sfx_kill, sfx_death, sfx_shatter, sfx_nova,
               sfx_stim, sfx_phase, sfx_scan, sfx_veil, sfx_surge, sfx_ultready,
               sfx_hover, sfx_tension, sfx_alert, sfx_cross]:
        fn()
    music()
    print('Done.')
