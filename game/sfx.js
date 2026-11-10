// game/sfx.js — semantic game-sound events layered on the engine AudioEngine.
// Each event falls back to a quiet synth tone if its sample isn't decoded yet.
let AE=null;
let combo=0,comboT=0;
const comboWindow=3.2;
const TURN_SCALE=[1,1.125,1.25,1.5,1.667,2,2.25,2.5,3];
let turnN=4;
// combo ladder: every stack tightens the tick pitch for instant-chain feedback
const COMBO_R=[1,1.12,1.29,1.5,1.78,2.11,2.5,3,3.5,4,4.7,5.6,6.6,7.8,9.4];
const clampi=(v,a,b)=>Math.max(a,Math.min(b,v));
// every rider hums in their own key — the pentatonic ladder centered on their root
const RIDER_KEY=[1,.891,1.189,1.059,.944,1.335,1.122,1.26];
// per-rider timbre: dark wood → bright glass filter cutoffs (Hz)
const RIDER_TIMBRE=[1400,2400,1100,1900,2800,1600,3400,2200];
export function bindSfx(ae){AE=ae;}
export function sfxTick(dt){comboT-=dt;if(comboT<=0)combo=0;}
export function sfxDive(){S.dive&&S.dive();}

export const S={
 claim(stacks){ // each stack plays one ladder-rung tick; deep chains add the pluck
  const c=Math.max(1,Math.min(14,stacks||++combo));comboT=comboWindow;
  AE.play('combo',{rate:COMBO_R[clampi(c-1,0,COMBO_R.length-1)],vol:.35+c*.035});
  if(c>=3)AE.play('claim',{rate:1+(c-3)*.07,vol:.3});},
 dive(){AE.play('dive',{vol:.5});},
 shard(pan){combo=Math.min(combo+1,8);comboT=1.2;AE.play('shard',{rate:1+combo*.045,rateVar:.02,pan:pan||0});},
 death(){AE.play('death');},
 nova(){AE.play('nova');AE.play('shatter',{vol:.4,delay:.05});},
 kill(){AE.play('kill');},
 stim(){AE.play('stim');},
 phase(){AE.play('phase');},
 scan(){AE.play('scan');},
 veil(){AE.play('veil');},
 surge(){AE.play('surge');},
 ultReady(){AE.play('ultready');},
 intruder(pan,vol){AE.play('alarm',{pan:pan||0,vol:vol||.5});},
 warn(){AE.dsp('alarm',{rate:.8,vol:.8});},
 storm(pan){AE.play('storm',{pan:pan||0});},
 cross(){AE.play('cross',{vol:.55});},
 turn(side,ri){ // pentatonic step: right climbs, left descends — every steer makes music
  if(side)turnN=clampi(turnN+side,0,TURN_SCALE.length-1);
  const key=RIDER_KEY[ri==null?0:ri]||1;const r=TURN_SCALE[turnN]*key;
  AE.dsp('turn',{rate:r,rateVar:.015,vol:.45,filter:RIDER_TIMBRE[ri==null?0:ri]||1800});},
 shatter(streak){const s=Math.max(0,Math.min(6,streak||0));
  AE.play('shatter',{rate:1+s*.09,vol:.7+s*.05});}, // kill streaks ring brighter
 click(){AE.play('click',{vol:.7,rateVar:.06});}
};
