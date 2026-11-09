// game/abilities.js — Apex-inspired kit: tacticals + ultimates
import{G}from'./ctx.js';
import{rnd,clamp}from'../engine/math.js';
import{W,H,CELL,idx}from'./config.js';
import{S}from'./sfx.js';

export const ABILITIES={
  tac:{
    stim:{name:'STIM DASH',icon:'⚡',cd:14,desc:'+70% speed for 3.5s. Outrun anything.'},
    phase:{name:'PHASE DRIFT',icon:'👻',cd:18,desc:'4s in the void: untouchable, trail unsliceable — but you cannot slice either.'},
    scan:{name:'SCAN PULSE',icon:'📡',cd:16,desc:'Reveal every rival for 6s: edge arrows + minimap pings.'},
    veil:{name:'SHADOW VEIL',icon:'🌫',cd:20,desc:'6s cloak: hidden from the minimap; bots stop hunting your trail.'}
  },
  ult:{
    nova:{name:'SHATTER NOVA',icon:'💥',desc:'Blast nearby enemy turf into shards; trailing rivals in the radius die.'},
    surge:{name:'MAGNET SURGE',icon:'🧲',desc:'10s global vacuum — every shard on the map flies to you.'}
  }
};

export function useTactical(p){
  if(!p.alive||p.tacCD>0)return;
  const a=p.tactical||'stim',def=ABILITIES.tac[a];if(!def)return;
  if(a==='stim'){p.stimT=3.5;S.stim();}
  else if(a==='phase'){p.phaseT=4;S.phase();}
  else if(a==='scan'){p.scanT=6;S.scan();}
  else if(a==='veil'){p.veilT=6;S.veil();}
  p.tacCD=def.cd;
  G.fx.burst(p.x*CELL,p.y*CELL,p.color,12,170);G.fx.ripple(p.x*CELL,p.y*CELL,p.color,90);
  if(p.isPlayer)G.ui.showBanner(def.icon+' '+def.name+'!',p.color);
}

export function useUlt(p){
  if(!p.alive||p.ultCharge<100)return;
  const a=p.ult||'nova';p.ultCharge=0;p.ultPinged=false;
  if(a==='nova')shatterNova(p);
  else if(a==='surge'){p.surgeT=10;S.surge();G.fx.ripple(p.x*CELL,p.y*CELL,'#ffd600',300);G.cam.addShake(8);
    if(p.isPlayer)G.ui.showBanner('🧲 MAGNET SURGE!','#ffd600');}
}

export function shatterNova(p){
  const grid=G.world.grid,players=G.world.players,shards=G.world.shards;
  const R=7.5;let flipped=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const o=grid[idx(x,y)];if(!o||o===p.id+1)continue;
    const dx=x+.5-p.x,dy=y+.5-p.y;if(dx*dx+dy*dy>R*R)continue;
    if(flipped++%2===0){grid[idx(x,y)]=0;if(Math.random()<.55)shards.push({cx:x,cy:y,x:x+.5,y:y+.5,value:.5,big:false,born:G.mode.elapsed,rot:rnd(0,6)});}}
  for(const q of players)q.owned=0;
  for(let i=0;i<W*H;i++){const o=grid[i];if(o&&players[o-1])players[o-1].owned++;}
  for(const q of players){if(q!==p&&q.alive&&q.trail.length>2&&Math.hypot(q.x-p.x,q.y-p.y)<=R)G.kill(q,p,'Caught in '+p.name+"'s SHATTER NOVA!");}
  G.fx.ripple(p.x*CELL,p.y*CELL,'#ff9d00',380);G.fx.burst(p.x*CELL,p.y*CELL,'#ff9d00',30,340);G.fx.burst(p.x*CELL,p.y*CELL,'#ffffff',12,240);
  G.cam.addShake(20);S.nova();
  if(p.isPlayer)G.ui.showBanner('💥 SHATTER NOVA!','#ff9d00');
}

export function botAbilityThink(p){
  if(p.tacCD>0)return;
  const a=p.tactical;
  if(a==='stim'&&p.trail.length>2&&Math.random()<.02)useTactical(p);
  else if(a==='phase'&&p.trail.length>5&&Math.random()<.03)useTactical(p);
  else if(a==='veil'&&p.owned>=24&&Math.random()<.008)useTactical(p);
  else if(a==='scan'&&Math.random()<.004)useTactical(p);
}
