// game/main.js — TerritoryShatter bootstrap: engine wiring, input, watchdog, boot
import{G}from'./ctx.js';
import{VERSION,DIRS,PALETTE,BOT_NAMES}from'./config.js';
import{SaveData}from'./save.js';
import{freezeConfig}from'./security.js';
import{Renderer2D,Engine}from'../engine/engine.js';
import{Camera2D}from'../engine/camera.js';
import{FXPool}from'../engine/fx.js';
import{AudioEngine}from'../engine/audio.js';
import{ImageAssets}from'../engine/assets.js';
import{Input}from'../engine/input.js';
import{bindSfx}from'./sfx.js';
import{bindSim,mode,world,setDir,resetMatch,updateSim,menuDrift}from'./sim.js';
import{bindUI,bindFlow,startGame,togglePause}from'./ui.js';
import{useTactical,useUlt}from'./abilities.js';
import{bindMenu}from'./menu.js';
import{renderGame}from'./render.js';

freezeConfig(DIRS,PALETTE,BOT_NAMES);
document.title='TerritoryShatter v'+VERSION;

const canvas=document.getElementById('game');
G.renderer=new Renderer2D(canvas);
G.cam=new Camera2D();
G.fx=new FXPool();
G.fx.quality=SaveData.data.settings.quality;

let soundOn=true;
G.isMuted=()=>!soundOn;
G.setMuted=v=>{soundOn=!v;G.ae.applyVolumes();};
G.ae=new AudioEngine(VERSION,()=>({sfx:SaveData.data.settings.sfx,music:SaveData.data.settings.music,muted:!soundOn}));
G.ae.register(['click','claim','shard','kill','death','shatter','nova','stim','phase','scan','veil','surge','ultready','hover','tension','alert','cross','music']);

G.assets=new ImageAssets(VERSION);
G.assets.onError=f=>{const w=document.getElementById('assetWarn');if(w){w.style.display='block';w.textContent='⚠ '+G.assets.failed+' asset(s) failed to load — hard refresh this page';}};
G.assets.load({floor:'art/floor.png',tile:'art/tile.png',shardGold:'art/shard_gold.png',shardCyan:'art/shard_cyan.png'});

// capability registration (order matters: render/sim read G.* at runtime)
bindSfx(G.ae);bindSim();bindUI();
resetMatch();      // before menu init, exactly like the legacy boot (nameInput still default)
bindMenu();        // fills nameInput from save, hooks tabs/skins/abilities/settings/integrity
bindFlow();        // HUD buttons, pause, restart, ability pads

// input: semantic events -> game actions
const input=new Input(canvas);
input.onFirstGesture=()=>G.ae.init();
input.confirmGuard=()=>document.activeElement===document.getElementById('nameInput');
input.on('dir',(dx,dy)=>{const p=world.player;if(p&&p.alive)setDir(p,dx,dy);});
input.on('tac',()=>{const p=world.player;if(p&&mode.state==='play'&&!mode.paused){G.ae.init();useTactical(p);}});
input.on('ult',()=>{const p=world.player;if(p&&mode.state==='play'&&!mode.paused){G.ae.init();useUlt(p);}});
input.on('pause',()=>{if(mode.state==='play')togglePause();});
input.on('confirm',()=>{if(mode.state==='menu')startGame();});
input.attachTouch(document.getElementById('joystick'),document.getElementById('joyKnob'));

G.ae.preload();

// live-update watchdog: poll build version, reload when a new one ships
async function pollVersion(){
  try{const r=await fetch('version.json?_='+Math.random(),{cache:'no-store'});if(!r.ok)return;const j=await r.json();
    if(j.v&&j.v!==VERSION){
      const b=document.getElementById('updateBanner');b.style.display='block';
      b.onclick=()=>location.reload();
      if(mode.state==='menu'){b.textContent='🔥 New build '+j.v+' — reloading…';setTimeout(()=>location.reload(),2500);}
      else b.textContent='🔥 New build '+j.v+' available — tap here to update';
    }
  }catch(e){}
}
setInterval(pollVersion,15000);pollVersion();

const engine=new Engine();
engine.onUpdate=dt=>{
  if(mode.state==='play'&&!mode.paused)updateSim(dt);
  else if(mode.state==='menu')menuDrift(dt);
};
engine.onRender=()=>renderGame();
engine.start();
