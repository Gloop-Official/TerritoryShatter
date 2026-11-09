// game/menu.js — menu screens: tabs, skin swatches, ability loadout, settings, stats, integrity
import{G}from'./ctx.js';
import{W,H,CELL,VERSION,PALETTE}from'./config.js';
import{hexShade}from'../engine/math.js';
import{SaveData}from'./save.js';
import{S}from'./sfx.js';
import{ABILITIES,useTactical,useUlt,shatterNova}from'./abilities.js';
import{claim,shatterTerritory,kill,enterCell,applyPending,updateSim}from'./sim.js';
import{INTEGRITY}from'./security.js';

const $=id=>document.getElementById(id);

export function fillStats(){const s=SaveData.data.stats,set=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  set('stBestTerr',s.bestTerr.toFixed(1)+'%');set('stBestScore',s.bestScore.toFixed(1)+'%');set('stGames',s.games);set('stKills',s.kills);set('stShards',s.shards);set('stShatters',s.shatters);}

export function selTab(t){document.querySelectorAll('.menu-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));document.querySelectorAll('.tab-page').forEach(p=>p.classList.toggle('hidden',p.id!=='tab-'+t));if(t==='stats')fillStats();}

export function buildSkins(){const g=$('skinGrid');if(!g)return;g.innerHTML='';PALETTE.forEach((c,i)=>{const b=document.createElement('button');b.className='swatch'+(SaveData.data.colorIdx===i?' sel':'');b.style.background=c;b.style.color=c;b.title=c;b.onclick=()=>{G.ae.init();S.click();SaveData.data.colorIdx=i;SaveData.save();const player=G.world.player;if(player&&G.mode.state==='menu'){player.color=c;player.palIdx=i;player.colDark=hexShade(c,.5);player.colLight=hexShade(c,1.3);}buildSkins();};g.appendChild(b);});}

export function buildAbilities(){
  const T=$('tacGrid'),U=$('ultGrid');if(!T||!U)return;
  const mk=(map,cur)=>Object.keys(map).map(k=>{const d=map[k];
    return `<button class="ab-card ${cur===k?'active':''}" data-k="${k}"><span class="ab-ic">${d.icon}</span><span><div class="ab-nm">${d.name}${d.cd?` <span style="opacity:.5">· ${d.cd}s</span>`:''}</div><div class="ab-ds">${d.desc}</div></span></button>`;}).join('');
  T.innerHTML=mk(ABILITIES.tac,SaveData.data.loadout.tac);
  U.innerHTML=mk(ABILITIES.ult,SaveData.data.loadout.ult);
  T.querySelectorAll('.ab-card').forEach(b=>b.onclick=()=>{G.ae.init();S.click();SaveData.data.loadout.tac=b.dataset.k;SaveData.save();if(G.world.player)G.world.player.tactical=b.dataset.k;buildAbilities();});
  U.querySelectorAll('.ab-card').forEach(b=>b.onclick=()=>{G.ae.init();S.click();SaveData.data.loadout.ult=b.dataset.k;SaveData.save();if(G.world.player)G.world.player.ult=b.dataset.k;buildAbilities();});
}

function setDiff(m,el){G.ae.init();G.mode.botSpeedMul=m;SaveData.data.diff=m;SaveData.save();if(el)S.click();
  document.querySelectorAll('.diff-btn').forEach(b=>b.classList.toggle('active',el?b===el:+b.dataset.diff===m));}

export function updIntegrity(){const el=$('intgTxt');if(!el)return;const ok=INTEGRITY.ok;el.textContent=ok?'integrity ✓ '+INTEGRITY.hash:'integrity FAIL ⚠';el.style.color=ok?'#39ff6a':'#ff4d4d';el.style.textShadow=ok?'0 0 8px rgba(57,255,106,.5)':'0 0 8px rgba(255,77,77,.6)';}

export function initMenu(){
  $('nameInput').value=SaveData.data.name;
  document.querySelectorAll('.menu-tab').forEach(b=>b.onclick=()=>{G.ae.init();S.click();selTab(b.dataset.tab);});
  document.querySelectorAll('.diff-btn').forEach(b=>b.onclick=()=>setDiff(parseFloat(b.dataset.diff),b));
  setDiff(SaveData.data.diff,null);
  const sfx=$('optSfx');sfx.value=Math.round(SaveData.data.settings.sfx*100);
  sfx.oninput=()=>{SaveData.data.settings.sfx=sfx.value/100;SaveData.save();G.ae.applyVolumes();};
  sfx.onchange=()=>{G.ae.init();S.click();};
  const mus=$('optMus');mus.value=Math.round(SaveData.data.settings.music*100);
  mus.oninput=()=>{SaveData.data.settings.music=mus.value/100;SaveData.save();G.ae.applyVolumes();};
  mus.onchange=()=>{G.ae.init();G.ae.setDuck(G.ae.duckLvl);};
  const sh=$('optShake');sh.checked=SaveData.data.settings.shake;
  sh.onchange=()=>{G.ae.init();S.click();SaveData.data.settings.shake=sh.checked;SaveData.save();};
  document.querySelectorAll('.q-btn').forEach(b=>{b.classList.toggle('active',SaveData.data.settings.quality===+b.dataset.q);
    b.onclick=()=>{G.ae.init();S.click();SaveData.data.settings.quality=+b.dataset.q;SaveData.save();G.fx.quality=SaveData.data.settings.quality;document.querySelectorAll('.q-btn').forEach(x=>x.classList.toggle('active',x===b));};});
  buildAbilities();buildSkins();fillStats();
  $('resetSaveBtn').onclick=()=>{G.ae.init();if(confirm('Erase all local stats & settings?')){SaveData.reset();location.reload();}};
  INTEGRITY.init([claim,shatterTerritory,kill,enterCell,applyPending,updateSim,useTactical,useUlt,shatterNova],[W,H,CELL]);
  updIntegrity();setInterval(updIntegrity,15000);
  $('verTxt').textContent='v'+VERSION+' • dev build';
  const chip=$('buildChip');if(chip)chip.textContent='v'+VERSION;
}

export function bindMenu(){G.fillStats=fillStats;G.selTab=selTab;initMenu();}
