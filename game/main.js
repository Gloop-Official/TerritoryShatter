// game/main.js — TerritoryShatter bootstrap: engine wiring, input, watchdog, boot
import{G}from'./ctx.js';
import{VERSION,W,H,CELL,DIRS,PALETTE,BOT_NAMES}from'./config.js';
import{SaveData}from'./save.js';
import{freezeConfig}from'./security.js';
import{Renderer2D,Engine}from'../engine/engine.js';
import{Camera2D}from'../engine/camera.js';
import{Camera3D}from'../engine/m3d.js';
import{FXPool}from'../engine/fx.js';
import{AudioEngine}from'../engine/audio.js';
import{ImageAssets}from'../engine/assets.js';
import{Input}from'../engine/input.js';
import{bindSfx,S}from'./sfx.js';
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
G.cam3=new Camera3D();
G.fx=new FXPool();
G.fx.quality=SaveData.data.settings.quality;

let soundOn=true;
G.isMuted=()=>!soundOn;
G.setMuted=v=>{soundOn=!v;G.ae.applyVolumes();};
G.ae=new AudioEngine(VERSION,()=>({sfx:SaveData.data.settings.sfx,music:SaveData.data.settings.music,muted:!soundOn}));
G.ae.register(['click','claim','shard','kill','death','shatter','nova','stim','phase','scan','veil','surge','ultready','hover','tension','alert','cross','turn','music']);

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
input.on('dir',(dx,dy)=>{const p=world.player;if(!p||!p.alive)return;
  // 3D cameras: steering is camera-relative (up = away from camera = forward)
  if(SaveData.data.settings.cam!=='iso'){
    let q=Math.round(G.cam3.yaw/(Math.PI/2));q=((q%4)+4)%4;
    for(let i=0;i<(q+1)%4;i++){const t=dx;dx=-dy;dy=t;} // yaw≈0 (facing east) → rotate intents +90°
  }
  setDir(p,dx,dy);});
input.on('tac',()=>{const p=world.player;if(p&&mode.state==='play'&&!mode.paused){G.ae.init();useTactical(p);}});
input.on('ult',()=>{const p=world.player;if(p&&mode.state==='play'&&!mode.paused){G.ae.init();useUlt(p);}});
input.on('pause',()=>{if(mode.state==='play')togglePause();});
input.on('confirm',()=>{if(mode.state==='menu')startGame();});
input.attachTouch(document.getElementById('joystick'),document.getElementById('joyKnob'));

// camera modes: iso -> follow (orbitable) -> fps
const CAM_MODES=['follow','fps','iso'];
G.syncCamMode=()=>{const c=SaveData.data.settings.cam;G.camMode=c;if(c!=='iso')G.cam3.mode=(mode.state==='menu')?'follow':c;
  const b=document.getElementById('camBtn');if(b)b.textContent='🎥 '+c.toUpperCase();};
G.setCamMode=m=>{SaveData.data.settings.cam=m;SaveData.save();G.syncCamMode();};
input.on('view',()=>{const i=CAM_MODES.indexOf(SaveData.data.settings.cam);G.setCamMode(CAM_MODES[(i+1)%CAM_MODES.length]);G.ae.init();S.click();});
// orbit: mouse-drag + wheel zoom + two-finger drag (follow mode only)
// hard-snap the 3D camera behind the player (called on match start / respawn)
G.snapCam3=()=>{const p=world.player;if(!p||SaveData.data.settings.cam==='iso')return;
  const yaw=Math.atan2(p.dy,p.dx),pitch=-1.12,dist=380,cp=Math.cos(pitch),sp=Math.sin(pitch);
  const c=G.cam3;c.yaw=c.tYaw=yaw;c.pitch=c.tPitch=pitch;c.tDist=dist;
  c.pos=[p.x*CELL-cp*Math.cos(yaw)*dist,p.y*CELL-cp*Math.sin(yaw)*dist,8-sp*dist];c.basis();};
G.syncCamMode();G.snapCam3();
canvas.addEventListener('mousedown',e=>{if(G.camMode==='follow'){G.cam3._drag=[e.clientX,e.clientY];}});
addEventListener('mousemove',e=>{const d=G.cam3._drag;if(d){G.cam3.orbit((e.clientX-d[0])*.006,(e.clientY-d[1])*.005);G.cam3._drag=[e.clientX,e.clientY];}});
addEventListener('mouseup',()=>{G.cam3._drag=null;});
canvas.addEventListener('wheel',e=>{if(G.camMode==='follow'){e.preventDefault();G.cam3.zoom(e.deltaY*.15);}},{passive:false});
canvas.addEventListener('touchstart',e=>{if(G.camMode==='follow'&&e.touches.length===2){G.cam3._td=[(e.touches[0].clientX+e.touches[1].clientX)/2,(e.touches[0].clientY+e.touches[1].clientY)/2];}},{passive:true});
canvas.addEventListener('touchmove',e=>{const t=G.cam3._td;if(t&&e.touches.length===2){const nx=(e.touches[0].clientX+e.touches[1].clientX)/2,ny=(e.touches[0].clientY+e.touches[1].clientY)/2;G.cam3.orbit((nx-t[0])*.008,(ny-t[1])*.007);G.cam3._td=[nx,ny];}},{passive:true});
canvas.addEventListener('touchend',e=>{if(e.touches.length<2)G.cam3._td=null;},{passive:true});

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
  // perspective camera drive (3D modes only)
  if(SaveData.data.settings.cam!=='iso'){
    G.syncCamMode();
    let focus;
    if(mode.state==='menu'){
      G.cam3.tYaw+=dt*.06;G.cam3.tDist=950;G.cam3.tPitch=-.85;
      focus={x:W*CELL/2,y:H*CELL/2,z:0,yaw:G.cam3.tYaw};
    }else{
      const p=world.player;
      focus=p?{x:p.x*CELL,y:p.y*CELL,z:8,yaw:Math.atan2(p.dy,p.dx)}:{x:W*CELL/2,y:H*CELL/2,z:0,yaw:0};
    }
    G.cam3.update(dt,focus,G.renderer.cw,G.renderer.ch);
  }
};
engine.onRender=()=>renderGame();
engine.start();
