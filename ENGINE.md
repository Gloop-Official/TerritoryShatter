# Terrascape Engine — Module Guide

The `engine/` directory is a standalone game+presentation runtime.
It never imports from `game/` — the game depends on the engine, not the reverse.

## Core loop — `engine.js`
- `new Engine({hz})` — fixed-timestep sim; `onUpdate(dt)` runs 0..N times per frame, `onRender()` every frame.
- Frame-time EMA meter built in; `engine.fps` is always live.
- F3 toggles the debug overlay (fps, painter poly count, live FX count, audio state).

## Cameras
### `camera.js` (2D)
`cam.focus(x,y,k)`, `cam.addShake(n)`, `cam.shakeOffset()`, `cam.update(dt)`.

### `m3d.js` (Camera3D — z-up perspective)
Modes: `'follow'` (orbitable chase), `'fps'` (eye-level), `'fixed'`.
- `.orbit(Δyaw,Δpitch)`, `.zoom(Δd)`, `.update(dt,{x,y,z,yaw,speed},w,h)`
- `.project([wx,wy,wz])` → `{x,y,d,s}` screen px or `null` when behind camera — the HUD anchor API.
- **Autotilt**: follow pitch eases back as `focus.speed` climbs (speed-response camera).

## Rig & rendering — `rig3d.js`, `m3d.js`
- Painter-sorted polygon compositor; `RIG.buildMeshes('pod',seed,params)` → procedural rider pods (seeded per rider).
- Self-test in `rig3d.js` — synthetic orbit asserts.

## Textures — `tex.js`
- `arenaFloor(W)` — seeded pastel blotches + per-cell comb grid + vignette, cached canvas.
- `grainTile()` / `grainPattern(ctx)` — cached overlay noise for postFX.
- Boot-lazy: no `document` touched at module load.

## Particles — `fx.js`
Pooled (450 cap): `burst`, `shock`, `splash`, `streak`, `ripple`, `shard`, `spark`; `update(dt)`, `draw(ctx)`.

## Audio — `audio.js` (total DSP, zero audio files)
- Offline pre-render: every sound is a Float32Array computed once and loaded into AudioBuffers.
- `AE.play(name,{vol,rate,pan,rateVar,human,delay})` — humanizer adds ±0.4% pitch + ≤6ms timing life.
- Loops: `AE.loopStart('hover')`, `loopGain(x,ramp)`, `loopStop(x)`.
- Music: adaptive stems `music:pad|bass|kick|arp` in lockstep; `AE.musicMix({pad..},rampSec)` rides game state; realtime LFO chorus on the music bus.
- DSP toolbox: `wav, white, brown, norm, drive, tilt, lpass, hpass, mixd, decay, adsr, echo, haas, bell, mixd, lcg, ks` (Karplus-Strong), `biquad(lp/hp/bp)`, `body()` formant resonance.

## Input — `input.js`
Semantic events only: `'dir'(dx,dy)`, `'tac'`, `'ult'`, `'pause'`, `'view'`.
- Keyboard: WASD/arrows/Q/E/Z/V/Esc/Space; `confirmGuard` swallows events while typing; `e.repeat` blocked (no double-fire on held keys).
- Touch: virtual joystick + global swipe → `dir` events (`attachTouch(joy,knob)`).

## Math — `math.js`
`clamp, lerp, rnd, rint, dist, angLerp, hexToRgb` and friends.

## Wasm — `tex.js`-side helper caches; engine falls back to JS silently where wasm is absent.
