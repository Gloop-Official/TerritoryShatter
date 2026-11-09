// engine/math.js — deterministic helpers shared by every game on this engine
export const rnd=(a,b)=>a+Math.random()*(b-a);
export const rint=(a,b)=>Math.floor(rnd(a,b+1));
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function hexShade(hex,f){const n=parseInt(hex.slice(1),16);
  return `rgb(${clamp(((n>>16)&255)*f,0,255)|0},${clamp(((n>>8)&255)*f,0,255)|0},${clamp((n&255)*f,0,255)|0})`;}
