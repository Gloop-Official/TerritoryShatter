// game/sim.js — TerritoryShatter simulation: players, grid, claiming, combat
import{W,H,CELL,DIRS,BOT_NAMES,PALETTE,idx,inB}from'./config.js';
import{rnd,rint,clamp,shuffle,hexShade}from'../engine/math.js';
import{G}from'./ctx.js';
import{SaveData}from'./save.js';
import{S,sfxTick}from'./sfx.js';
import{ABILITIES,botAbilityThink}from'./abilities.js';

export const mode={state:'menu',paused:false,elapsed:0,botSpeedMul:1,intrT:0,leaderT:0};
export const world={grid:new Int16Array(W*H),players:[],player:null,shards:[]};
let menuT=0;

function makePlayer(name,color,isPlayer,palIdx){
  const p={id:world.players.length,name,color,isPlayer,palIdx:palIdx||0,colDark:hexShade(color,.5),colLight:hexShade(color,1.3),
    alive:false,x:0,y:0,dx:1,dy:0,pendx:0,pendy:0,trail:[],trailSet:new Set(),owned:0,shardBonus:0,shardsGot:0,kills:0,
    lastCX:-1,lastCY:-1,speed:isPlayer?7.4:rnd(6.0,7.3),deathTimer:0,spawnX:0,spawnY:0,ai:{insideSteps:rint(3,8),outSteps:0},
    pulse:rnd(0,6),peakOwned:0,tactical:'stim',ult:'nova',tacCD:0,ultCharge:30,ultPinged:false,
    stimT:0,phaseT:0,scanT:0,veilT:0,surgeT:0,inEnemy:false,_hr:1,_tg:0,blinkT:rnd(2,5)};
  world.players.push(p);return p;
}
function findSpawn(){
  for(let t=0;t<200;t++){const cx=rint(3,W-4),cy=rint(3,H-4);let ok=true;
    for(let y=cy-2;y<=cy+2&&ok;y++)for(let x=cx-2;x<=cx+2;x++)if(world.grid[idx(x,y)]!==0){ok=false;break;}
    if(ok)return[cx,cy];}
  return[rint(3,W-4),rint(3,H-4)];
}
function spawnEntity(p){
  const[cx,cy]=findSpawn();p.x=cx+0.5;p.y=cy+0.5;p.spawnX=cx;p.spawnY=cy;
  const d=DIRS[rint(0,3)];p.dx=d[0];p.dy=d[1];p.pendx=0;p.pendy=0;p.trail=[];p.trailSet.clear();p.lastCX=-1;p.lastCY=-1;p.alive=true;p.ai.insideSteps=rint(3,8);p.ai.outSteps=0;
  p.tacCD=0;p.stimT=0;p.phaseT=0;p.scanT=0;p.veilT=0;p.surgeT=0;p.inEnemy=false;
  for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)if(inB(x,y))world.grid[idx(x,y)]=p.id+1;
  p.owned=9;
  G.fx.burst(p.x*CELL,p.y*CELL,p.color,28,120);
}

// ===== CLAIM (flood fill) =====
function claim(p){
  if(p.trail.length===0)return;
  const trailCopy=[...p.trail];
  const solid=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++)if(world.grid[i]===p.id+1)solid[i]=1;
  for(const c of p.trail)solid[c]=1;
  const vis=new Uint8Array(W*H),stack=[];
  const push=(x,y)=>{if(inB(x,y)){const i=idx(x,y);if(!solid[i]&&!vis[i]){vis[i]=1;stack.push(i);}}};
  for(let x=0;x<W;x++){push(x,0);push(x,H-1);} for(let y=0;y<H;y++){push(0,y);push(W-1,y);}
  while(stack.length){const i=stack.pop(),x=i%W,y=(i/W)|0;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}
  for(let i=0;i<W*H;i++)if(!vis[i]&&world.grid[i]!==p.id+1)world.grid[i]=p.id+1;
  p.trail=[];p.trailSet.clear();p.owned=0;for(let i=0;i<W*H;i++)if(world.grid[i]===p.id+1)p.owned++;
  p.ultCharge=Math.min(100,p.ultCharge+6+trailCopy.length*1.5);
  const wx=p.x*CELL,wy=p.y*CELL;G.fx.ripple(wx,wy,p.color,trailCopy.length*4+80);G.fx.ripple(wx,wy,'#ffffff',60);
  for(const c of trailCopy)if(Math.random()<.4)G.fx.burst((c%W+.5)*CELL,(((c/W)|0)+.5)*CELL,p.color,2,100);
  if(p.isPlayer){S.claim();if(trailCopy.length>8)G.ui.showBanner('+'+trailCopy.length+' CLAIMED!','#00f5ff');}
}

// ===== SHATTER / KILL =====
function shatterTerritory(victim,big){
  const cells=[];for(let i=0;i<W*H;i++)if(world.grid[i]===victim.id+1)cells.push(i);
  shuffle(cells);
  const n=big?Math.min(90,Math.floor(cells.length*.65)):Math.min(20,Math.floor(cells.length*.22));
  for(let k=0;k<n;k++){const c=cells[k],cx=c%W,cy=(c/W)|0;
    if(world.shards.some(s=>s.cx===cx&&s.cy===cy))continue;
    world.shards.push({cx,cy,x:cx+.5,y:cy+.5,value:big?1.2:0.5,big,born:mode.elapsed,rot:rnd(0,6)});
    G.fx.burst((cx+.5)*CELL,(cy+.5)*CELL,big?'#ffd600':victim.color,3,big?260:150);}
  for(const c of cells)world.grid[c]=0;
  victim.owned=0;
  G.fx.ripple(victim.x*CELL,victim.y*CELL,big?'#ffd600':victim.color,big?420:180);
  G.cam.addShake(big?22:10);
  if(big){G.ui.showBanner('💥 #1 SHATTERED! SHARDS RELEASED 💎','#ffd600');S.shatter();}
}
function kill(victim,killer,reason){
  if(!victim.alive)return;
  let maxOwned=0;for(const q of world.players)if(q.alive&&q.owned>maxOwned)maxOwned=q.owned;
  const isRank1=victim.owned>=maxOwned&&victim.owned>=24;
  victim.alive=false;victim.deathTimer=victim.isPlayer?0:rnd(2,3.5);
  victim.trail=[];victim.trailSet.clear();
  G.fx.burst(victim.x*CELL,victim.y*CELL,victim.color,36,320);G.fx.burst(victim.x*CELL,victim.y*CELL,'#ffffff',14,200);
  G.cam.addShake(12);
  if(killer&&killer!==victim){killer.kills++;killer.ultCharge=Math.min(100,killer.ultCharge+30);if(killer.isPlayer&&mode.state==='play'){SaveData.data.stats.kills++;if(isRank1)SaveData.data.stats.shatters++;}}
  shatterTerritory(victim,isRank1);
  if(victim.isPlayer&&mode.state==='play'){S.death();G.ae.loopStop('hover');G.ae.loopGain('tension',0.0001,.05);setTimeout(()=>G.ui.showGameOver(reason||'Your trail was sliced!'),700);}
  else{
    G.ui.addFeed(`<b style="color:${killer?killer.color:'#fff'}">${killer?killer.name:'?'}</b> ⚔️ shattered <b style="color:${victim.color}">${victim.name}</b>${isRank1?' <span style="color:#ffd600">👑#1!</span>':''}`);
    if(killer&&killer.isPlayer&&mode.state==='play'){S.kill();G.ui.showBanner('⚔️ ELIMINATED '+victim.name.toUpperCase()+'!','#ff2ea6');}
    else if(isRank1)S.shatter();
  }
}

// ===== CELL ENTRY =====
function enterCell(p,cx,cy){
  const i=idx(cx,cy);
  const phased=p.phaseT>0;
  // slice check: stepped on someone else's trail (phased = ghost, untouchable, harmless)
  if(!phased)for(const q of world.players){if(q!==p&&q.alive&&q.phaseT<=0&&q.trailSet.has(i)){kill(q,p);if(!p.alive)return;}}
  // head-on
  if(!phased)for(const q of world.players){if(q!==p&&q.alive&&q.phaseT<=0&&Math.floor(q.x)===cx&&Math.floor(q.y)===cy){
    if(p.owned<q.owned){kill(p,q,'Head-on collision — you were smaller!');return;}
    else if(p.owned>q.owned){kill(q,p);if(!p.alive)return;}
  }}
  const owner=world.grid[i];
  // turf-crossing audio: threat cue when YOU enter enemy turf, alert blip when a bot enters YOURS
  if(p.isPlayer){const enemyOwned=owner!==0&&owner!==p.id+1;
    if(enemyOwned&&!p.inEnemy&&mode.state==='play')S.cross();
    p.inEnemy=enemyOwned;}
  else if(mode.state==='play'&&world.player&&world.player.alive&&owner===world.player.id+1&&mode.elapsed-mode.intrT>.5){mode.intrT=mode.elapsed;
    const pan=clamp((cx*CELL-G.cam.x)/(G.renderer.cw/2/(G.renderer.scale||1)),-.8,.8);
    const dist=Math.hypot(cx+.5-world.player.x,cy+.5-world.player.y);
    S.intruder(pan,clamp(1.1-dist/26,.15,.65));}
  if(owner===p.id+1){if(p.trail.length>0)claim(p);}
  else if(!p.trailSet.has(i)){p.trail.push(i);p.trailSet.add(i);}
  if(!p.isPlayer)botDecide(p,cx,cy);
}

// ===== BOT AI =====
function setDir(p,dx,dy){if(dx===-p.dx&&dy===-p.dy)return;if(dx===p.dx&&dy===p.dy)return;p.pendx=dx;p.pendy=dy;}
function botDecide(p,cx,cy){
  const ai=p.ai;
  // opportunistic slice: neighbor is enemy trail (respect veil/phase)
  for(const d of DIRS){const nx=cx+d[0],ny=cy+d[1];if(!inB(nx,ny))continue;const ni=idx(nx,ny);
    for(const q of world.players)if(q!==p&&q.alive&&q.veilT<=0&&q.phaseT<=0&&q.trailSet.has(ni)&&Math.random()<.75){setDir(p,d[0],d[1]);return;}}
  // avoid wall / own trail ahead
  const ax=cx+p.dx,ay=cy+p.dy;
  const aheadBad=!inB(ax,ay)||p.trailSet.has(idx(ax,ay));
  if(aheadBad){const opts=DIRS.filter(d=>!(d[0]===-p.dx&&d[1]===-p.dy)&&inB(cx+d[0],cy+d[1])&&!p.trailSet.has(idx(cx+d[0],cy+d[1])));if(opts.length){const d=opts[rint(0,opts.length-1)];setDir(p,d[0],d[1]);}return;}
  if(p.trail.length===0){ // inside own turf
    ai.insideSteps--;
    if(ai.insideSteps<=0){const d=DIRS[rint(0,3)];if(!(d[0]===-p.dx&&d[1]===-p.dy))setDir(p,d[0],d[1]);ai.outSteps=rint(4,9);ai.insideSteps=rint(4,10);}
    else if(Math.random()<.18){const d=DIRS[rint(0,3)];setDir(p,d[0],d[1]);}
  }else{ // outside drawing a loop
    if(ai.outSteps>0){ai.outSteps--;if(Math.random()<.14){const turn=Math.random()<.5?[-p.dy,p.dx]:[p.dy,-p.dx];setDir(p,turn[0],turn[1]);}}
    else{ // steer home to nearest owned cell
      let best=null,bd=1e9;for(let i=0;i<W*H;i++)if(world.grid[i]===p.id+1){const x=i%W,y=(i/W)|0,d=Math.abs(x-cx)+Math.abs(y-cy);if(d<bd){bd=d;best=[x,y];}}
      if(best){let bd2=1e9,bdir=null;for(const d of DIRS){const nx=cx+d[0],ny=cy+d[1];if(!inB(nx,ny)||p.trailSet.has(idx(nx,ny)))continue;const dd=Math.abs(best[0]-nx)+Math.abs(best[1]-ny);if(dd<bd2){bd2=dd;bdir=d;}}if(bdir)setDir(p,bdir[0],bdir[1]);}
    }
  }
}
export {setDir};
// exposed for runtime-integrity hashing only (menu.js) — call sites go through G
export {claim,shatterTerritory,kill,enterCell,applyPending};

// ===== UPDATE =====
function applyPending(p){
  if(!p.pendx&&!p.pendy)return;
  if(p.pendx===-p.dx&&p.pendy===-p.dy){p.pendx=0;p.pendy=0;return;}
  if(p.dx!==0){if(Math.abs((p.x%1)-.5)<.24){const ox=p.dx,oy=p.dy;p.x=Math.floor(p.x)+.5;p.dx=p.pendx;p.dy=p.pendy;p.pendx=0;p.pendy=0;turnSfx(p,ox,oy);}}
  else{if(Math.abs((p.y%1)-.5)<.24){const ox=p.dx,oy=p.dy;p.y=Math.floor(p.y)+.5;p.dx=p.pendx;p.dy=p.pendy;p.pendx=0;p.pendy=0;turnSfx(p,ox,oy);}}
}
// movement audio: played when YOUR steering actually commits (menu drift stays silent)
function turnSfx(p,ox,oy){
  if(!p.isPlayer||mode.state!=='play')return;
  const cross=ox*p.dy-oy*p.dx; // y-down: >0 = turned right on screen
  S.turn(cross>0?1:cross<0?-1:0);
}
export function updateSim(dt){
  mode.elapsed+=dt;sfxTick(dt);
  for(const p of world.players){
    if(!p.alive){if(!p.isPlayer){p.deathTimer-=dt;if(p.deathTimer<=0)spawnEntity(p);}continue;}
    p.pulse+=dt*4;
    p.blinkT-=dt;if(p.blinkT<0)p.blinkT=rnd(2.4,4.6);
    p.stimT-=dt;p.phaseT-=dt;p.scanT-=dt;p.veilT-=dt;p.surgeT-=dt;p.tacCD-=dt;
    p.ultCharge=Math.min(100,p.ultCharge+dt*1.1);
    if(!p.isPlayer)botAbilityThink(p);
    else if(p.ultCharge>=100&&!p.ultPinged){p.ultPinged=true;S.ultReady();G.ui.showBanner('⚡ ULT READY — [Z]!','#ffd600');}
    if(p.stimT>0&&Math.random()<.6)G.fx.burst(p.x*CELL,p.y*CELL,p.color,1,90);
    if(p.isPlayer){ // movement hum: breathing wobble, kicks up 1.5x on stim
      const hr=(p.stimT>0?1.5:1)*(1+.035*Math.sin(mode.elapsed*6.5));
      if(Math.abs(hr-p._hr)>.012){p._hr=hr;G.ae.loopRate('hover',hr);}
      const tg=p.inEnemy?.22:0.0001;if(tg!==p._tg){p._tg=tg;G.ae.loopGain('tension',tg,.45);}
    }
    applyPending(p);
    const bsm=(p.isPlayer?1:mode.botSpeedMul)*(p.stimT>0?1.7:1);p.x+=p.dx*p.speed*bsm*dt;p.y+=p.dy*p.speed*bsm*dt;
    p.x=clamp(p.x,.5,W-.5);p.y=clamp(p.y,.5,H-.5);
    const cx=Math.floor(p.x),cy=Math.floor(p.y);
    if(cx!==p.lastCX||cy!==p.lastCY){p.lastCX=cx;p.lastCY=cy;enterCell(p,cx,cy);}
  }
  // shards vacuum
  const shards=world.shards;
  for(let i=shards.length-1;i>=0;i--){const s=shards[i];
    if(mode.elapsed-s.born>45){shards.splice(i,1);continue;}
    let best=null,bd=2.4;
    const surger=world.players.find(p=>p.alive&&p.surgeT>0);
    if(surger){best=surger;bd=Math.hypot(surger.x-s.x,surger.y-s.y);}
    else for(const p of world.players)if(p.alive){const d=Math.hypot(p.x-s.x,p.y-s.y);if(d<bd){bd=d;best=p;}}
    if(best){const d=Math.max(.001,bd),sp=(best.surgeT>0?16:(9*(1-d/2.4)+3))*dt;s.x+=(best.x-s.x)/d*sp;s.y+=(best.y-s.y)/d*sp;
      if(d<.6){best.shardBonus+=s.value;best.shardsGot++;G.fx.burst(s.x*CELL,s.y*CELL,s.big?'#ffd600':'#00f5ff',6,140);G.fx.ripple(s.x*CELL,s.y*CELL,s.big?'#ffd600':'#00f5ff',40);
        if(best.isPlayer){S.shard(clamp((s.x*CELL-G.cam.x)/(G.renderer.cw/2/(G.renderer.scale||1)),-.8,.8));SaveData.data.stats.shards++;}best.ultCharge=Math.min(100,best.ultCharge+2); shards.splice(i,1);continue;}}
    else{s.x+=(s.cx+.5-s.x)*dt*3;s.y+=(s.cy+.5-s.y)*dt*3;}
    s.rot+=dt*2;
  }
  G.fx.update(dt);
  G.cam.update(dt);
  // camera
  if(world.player&&world.player.alive)G.cam.follow(world.player.x*CELL,world.player.y*CELL,dt,6);
  // HUD
  mode.leaderT-=dt;if(mode.leaderT<=0){mode.leaderT=.25;G.ui.updateHUD();}
}

// ambient drift behind the menu
export function menuDrift(dt){
  menuT+=dt;
  for(const p of world.players)if(p.alive){p.pulse+=dt*4;p.blinkT-=dt;if(p.blinkT<0)p.blinkT=rnd(2.4,4.6);applyPending(p);p.x+=p.dx*p.speed*dt;p.y+=p.dy*p.speed*dt;const cx=Math.floor(p.x),cy=Math.floor(p.y);if(cx!==p.lastCX||cy!==p.lastCY){p.lastCX=cx;p.lastCY=cy;enterCell(p,cx,cy);}}
  G.fx.update(dt,500);
  G.cam.drift(W*CELL/2+Math.sin(menuT/4)*120,H*CELL/2+Math.cos(menuT/5)*120,.02);
}

export function resetMatch(){
  world.grid.fill(0);world.shards.length=0;world.players.length=0;G.fx.clear();
  mode.elapsed=0;G.cam.trauma=0;
  const nm=(document.getElementById('nameInput').value||'YOU').toUpperCase().slice(0,12);
  SaveData.data.name=nm;SaveData.save();mode.botSpeedMul=SaveData.data.diff;
  const myCol=PALETTE[SaveData.data.colorIdx]||PALETTE[0];
  world.player=makePlayer(nm,myCol,true,SaveData.data.colorIdx);
  world.player.tactical=SaveData.data.loadout.tac;world.player.ult=SaveData.data.loadout.ult;
  const names=shuffle([...BOT_NAMES]);
  const pool=shuffle(PALETTE.map((c,i)=>({c,i})).filter(o=>o.i!==SaveData.data.colorIdx));
  const tacKeys=Object.keys(ABILITIES.tac);
  for(let i=0;i<7;i++){const b=makePlayer(names[i],pool[i%pool.length].c,false,pool[i%pool.length].i);b.tactical=tacKeys[rint(0,tacKeys.length-1)];}
  for(const p of world.players)spawnEntity(p);
  G.cam.snap(world.player.x*CELL,world.player.y*CELL);
  G.ui.updateHUD();
}

// register capabilities on the shared context (called once at boot)
export function bindSim(){
  G.mode=mode;G.world=world;G.kill=kill;
  G.sim={spawnEntity,resetMatch,setDir,updateSim,menuDrift};
}
