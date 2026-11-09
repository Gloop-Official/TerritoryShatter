// game/ui.js — HUD, banners, feed, pause & game-over flow
import{G}from'./ctx.js';
import{W,H}from'./config.js';
import{SaveData}from'./save.js';
import{S}from'./sfx.js';
import{useTactical,useUlt,ABILITIES}from'./abilities.js';
import{clamp}from'../engine/math.js';

const $=id=>document.getElementById(id);

export function showBanner(txt,color){
  const b=$('banner');b.textContent=txt;b.style.color=color;
  b.classList.remove('hidden','banner-anim');void b.offsetWidth;b.classList.add('banner-anim');
}
export function addFeed(txt){
  const f=$('killfeed');const d=document.createElement('div');d.innerHTML=txt;
  f.prepend(d);while(f.children.length>4)f.lastChild.remove();
  setTimeout(()=>{if(d.parentNode)d.remove();},4200);
}

export function updateHUD(){
  const player=G.world.player;if(!player)return;
  const total=W*H,pct=player.owned/total*100,score=pct+player.shardBonus;
  if(player.owned>(player.peakOwned||0))player.peakOwned=player.owned;
  $('terrPct').textContent=pct.toFixed(1)+'%';
  $('scoreTxt').textContent=score.toFixed(1)+'%';
  $('terrBar').style.width=clamp(pct,0,100)+'%';
  $('shardCnt').textContent=player.shardsGot;
  $('killCnt').textContent=player.kills;
  const m=Math.floor(G.mode.elapsed/60),s=Math.floor(G.mode.elapsed%60);
  $('timeTxt').textContent=m+':'+String(s).padStart(2,'0');
  const sorted=[...G.world.players].filter(p=>p.alive).sort((a,b)=>(b.owned/total*100+b.shardBonus)-(a.owned/total*100+a.shardBonus));
  const rank=sorted.indexOf(player)+1;
  $('rankTxt').textContent=player.alive?('RANK #'+rank):'ELIMINATED';
  $('mapInfo').textContent='💎 '+G.world.shards.length+' on map';
  $('leaderboard').innerHTML=sorted.slice(0,8).map((p,i)=>`<div class="leader-row ${p.isPlayer?'leader-me':''}"><span>${i+1}. <span style="color:${p.color}">●</span> ${p.name}</span><b>${(p.owned/total*100+p.shardBonus).toFixed(1)}%</b></div>`).join('');
}

export function updAbilityUI(){
  const player=G.world.player;if(!player)return;
  const tf=$('tacFill');if(!tf)return;
  const t=ABILITIES.tac[player.tactical]||ABILITIES.tac.stim,u=ABILITIES.ult[player.ult]||ABILITIES.ult.nova;
  $('tacIcon').textContent=t.icon;$('tacName').textContent=t.name.split(' ')[0];
  $('ultIcon').textContent=u.icon;$('ultName').textContent=u.name.split(' ')[0];
  tf.style.height=clamp(player.tacCD/(t.cd||14),0,1)*100+'%';
  $('ultFill').style.height=(100-clamp(player.ultCharge,0,100))+'%';
  $('tacBtn').classList.toggle('ready',player.tacCD<=0&&player.alive);
  $('ultBtn').classList.toggle('ready',player.ultCharge>=100&&player.alive);
}

export function showGameOver(reason){
  const player=G.world.player,mode=G.mode;
  if(mode.state!=='play')return;mode.state='over';G.ae.setDuck(.35);
  const terr=(player.peakOwned||player.owned)/(W*H)*100,score=terr+player.shardBonus;
  SaveData.data.stats.bestTerr=Math.max(SaveData.data.stats.bestTerr,terr);
  SaveData.data.stats.bestScore=Math.max(SaveData.data.stats.bestScore,score);
  SaveData.save();if(G.fillStats)G.fillStats();
  $('deathReason').textContent=reason;
  $('finalTerr').textContent=terr.toFixed(1)+'%';
  $('finalShards').textContent=player.shardsGot;
  $('finalKills').textContent=player.kills;
  const sorted=[...G.world.players].filter(p=>p.alive).sort((a,b)=>b.owned-a.owned);
  $('finalRank').textContent=player.alive?('Rank #'+(sorted.indexOf(player)+1)):'Eliminated — your shards live on!';
  $('overScreen').classList.remove('hidden');
}

export function togglePause(){
  const mode=G.mode;if(mode.state!=='play')return;
  mode.paused=!mode.paused;G.ae.setDuck(mode.paused?.18:1);
  const o=$('pauseOverlay');o.classList.toggle('hidden',!mode.paused);o.classList.toggle('flex',mode.paused);
}

export function startGame(){
  G.ae.init();S.click();G.sim.resetMatch();
  SaveData.data.stats.games++;SaveData.save();
  G.mode.state='play';G.mode.paused=false;G.ae.setDuck(1);
  G.ae.loopStart('hover',0);G.ae.loopGain('hover',.1,.05);G.ae.loopStart('tension',0);
  $('startScreen').style.display='none';
  $('overScreen').classList.add('hidden');
  $('hud').style.display='block';
  showBanner('GO EAST! LOOP TO CLAIM!','#00f5ff');
}

export function bindFlow(){
  $('playBtn').onclick=startGame;
  $('respawnBtn').onclick=()=>{G.ae.init();S.click();G.ae.setDuck(1);G.ae.loopStart('hover',0);G.ae.loopGain('hover',.1,.05);G.ae.loopStart('tension',0);
    $('overScreen').classList.add('hidden');G.mode.state='play';G.sim.spawnEntity(G.world.player);
    G.cam.snap(G.world.player.x*24,G.world.player.y*24);showBanner('NEW BASE! GO!','#00f5ff');};
  $('restartBtn').onclick=()=>{S.click();startGame();};
  $('menuBtn').onclick=()=>{S.click();G.ae.setDuck(.55);G.ae.loopStop('hover');G.ae.loopStop('tension');
    $('overScreen').classList.add('hidden');$('hud').style.display='none';$('startScreen').style.display='';
    if(G.fillStats)G.fillStats();if(G.selTab)G.selTab('play');G.mode.state='menu';G.sim.resetMatch();};
  $('pauseBtn').onclick=togglePause;
  $('resumeBtn').onclick=togglePause;
  $('soundBtn').onclick=e=>{G.setMuted(!G.isMuted());e.target.textContent=G.isMuted()?'🔇':'🔊';};
  $('resetBtn').onclick=()=>{if(G.mode.state==='play'||G.mode.state==='over'){S.click();startGame();}};
  const cb=$('camBtn');if(cb)cb.onclick=()=>{const m=['follow','fps','iso'];const i=m.indexOf(SaveData.data.settings.cam);G.ae.init();S.click();G.setCamMode(m[(i+1)%m.length]);};
  const bindAb=(id,fn)=>{const el=$(id);if(!el)return;
    el.addEventListener('click',e=>{e.preventDefault();G.ae.init();fn();});
    el.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();G.ae.init();fn();},{passive:false});};
  bindAb('tacBtn',()=>{if(G.world.player&&G.mode.state==='play'&&!G.mode.paused)useTactical(G.world.player);});
  bindAb('ultBtn',()=>{if(G.world.player&&G.mode.state==='play'&&!G.mode.paused)useUlt(G.world.player);});
}

export function bindUI(){
  G.ui={showBanner,addFeed,updateHUD,updAbilityUI,showGameOver,togglePause,startGame};
}
