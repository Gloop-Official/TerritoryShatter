// game/sfx.js — semantic game-sound events layered on the engine AudioEngine.
// Each event falls back to a quiet synth tone if its sample isn't decoded yet.
let AE=null;
let combo=0,comboT=0;
const TURN_SCALE=[1,1.125,1.25,1.5,1.667,2,2.25,2.5,3];
let turnN=4;
const clampi=(v,a,b)=>Math.max(a,Math.min(b,v));
export function bindSfx(ae){AE=ae;}
export function sfxTick(dt){comboT-=dt;if(comboT<=0)combo=0;}
const has=n=>AE&&AE.buffers[n];

export const S={
 claim(){if(has('claim')){AE.play('claim');return;}AE.tone(440,.12,'sine',.18);AE.tone(660,.12,'sine',.18,0,.07);AE.tone(880,.2,'sine',.2,0,.14);},
 shard(pan){combo=Math.min(combo+1,8);comboT=1.2;if(has('shard')){AE.play('shard',{rate:1+combo*.045,rateVar:.02,pan:pan||0});return;}AE.tone(700+combo*60,.12,'sine',.16,200);},
 death(){if(has('death')){AE.play('death');return;}AE.tone(320,.5,'sawtooth',.2,-260);AE.tone(180,.6,'square',.12,-120,.05);},
 shatter(){if(has('shatter')){AE.play('shatter');return;}AE.tone(120,.7,'sawtooth',.3,-80);AE.tone(60,.8,'square',.25,-20,.02);for(let i=0;i<5;i++)AE.tone(600+Math.random()*1200,.15,'sine',.12,-400+Math.random()*800,i*.05);},
 nova(){if(has('nova')){AE.play('nova');AE.play('shatter',{vol:.4,delay:.05});return;}S.shatter();},
 kill(){if(has('kill')){AE.play('kill');return;}AE.tone(900,.15,'square',.15,-600);AE.tone(1200,.2,'sine',.12,0,.08);},
 stim(){if(has('stim')){AE.play('stim');return;}AE.tone(280,.3,'sawtooth',.16,520);AE.tone(140,.35,'square',.1,300,.02);},
 phase(){if(has('phase')){AE.play('phase');return;}AE.tone(520,.5,'sine',.16,-380);AE.tone(780,.5,'sine',.08,-250,.06);},
 scan(){if(has('scan')){AE.play('scan');return;}AE.tone(980,.14,'sine',.18);AE.tone(980,.14,'sine',.14,0,.28);AE.tone(1470,.2,'sine',.1,0,.56);},
 veil(){if(has('veil')){AE.play('veil');return;}AE.tone(240,.4,'triangle',.16,-90);AE.tone(120,.5,'sine',.1,-60,.05);},
 surge(){if(has('surge')){AE.play('surge');return;}AE.tone(150,.5,'sine',.2,320);AE.tone(150,.5,'sine',.16,320,.18);},
 ultReady(){if(has('ultready')){AE.play('ultready');return;}AE.tone(880,.12,'sine',.18);AE.tone(1320,.2,'sine',.16,0,.1);},
 intruder(pan,vol){if(has('alert')){AE.play('alert',{pan:pan||0,vol:vol||.5});return;}AE.tone(1046,.08,'triangle',.1);},
 warn(){AE.dsp('alarm',{rate:.8,vol:.8});},
 storm(){AE.dsp('storm');},
 cross(){if(has('cross')){AE.play('cross',{vol:.55});return;}AE.tone(520,.16,'sine',.14,-180);},
 turn(side){ // pentatonic step: right turns climb, left turns descend — every steer makes music
  if(side)turnN=clampi(turnN+side,0,TURN_SCALE.length-1);const r=TURN_SCALE[turnN];
  AE.dsp('turn',{rate:r,rateVar:.015,vol:.45});},
 click(){if(has('click')){AE.play('click',{vol:.7,rateVar:.06});return;}AE.tone(600,.08,'sine',.12);}
};
