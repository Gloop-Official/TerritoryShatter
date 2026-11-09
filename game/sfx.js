// game/sfx.js — semantic game-sound events layered on the engine AudioEngine.
// Each event falls back to a quiet synth tone if its sample isn't decoded yet.
let AE=null;
let combo=0,comboT=0;
const TURN_SCALE=[1,1.125,1.25,1.5,1.667,2,2.25,2.5,3];
let turnN=4;
const clampi=(v,a,b)=>Math.max(a,Math.min(b,v));
// every rider hums in their own key — the pentatonic ladder centered on their root
const RIDER_KEY=[1,.891,1.189,1.059,.944,1.335,1.122,1.26];
export function bindSfx(ae){AE=ae;}
export function sfxTick(dt){comboT-=dt;if(comboT<=0)combo=0;}

export const S={
 claim(combo){AE.play('claim',{rate:1+((combo||1)-1)*.07,rateVar:.01});},
 shard(pan){combo=Math.min(combo+1,8);comboT=1.2;AE.play('shard',{rate:1+combo*.045,rateVar:.02,pan:pan||0});},
 death(){AE.play('death');},
 shatter(){AE.play('shatter');},
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
  AE.dsp('turn',{rate:r,rateVar:.015,vol:.45});},
 click(){AE.play('click',{vol:.7,rateVar:.06});}
};
