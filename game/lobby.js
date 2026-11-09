// game/lobby.js — Apex-style character lobby: pick your rider, orbiting 3D
// portrait rendered by the actual game engine (no static images), kit linked.
import{G}from'./ctx.js';
import{ROSTER,PALETTE}from'./config.js';
const newell=p=>{const n=[0,0,0];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}const L=Math.hypot(...n)||1;return[n[0]/L,n[1]/L,n[2]/L];};
import{buildChibiGeo3D}from'../engine/rig3d.js';
import{SaveData}from'./save.js';
import{S}from'./sfx.js';
import{cssLit}from'../engine/rig3d.js';
import{ABILITIES}from'./abilities.js';

let run=false,raf=0,sel=-1;

function abilName(id,kind){
  const a=(ABILITIES[kind]||{})[id];
  return a?a.name.toUpperCase():String(id||'?').toUpperCase();
}

function drawPortrait(){ // engine-rendered orbit of the real rider mesh (no images)
  const cv=document.getElementById('rideCanvas');if(!cv)return;
  const w=cv.width,h=cv.height,ctx=cv.getContext('2d');
  ctx.clearRect(0,0,w,h);
  if(sel<0)return;
  const r=ROSTER[sel],col=PALETTE[r.colorIdx]||PALETTE[0];
  const t=performance.now()/1000;
  const geo=buildChibiGeo3D({x:0,y:0,pulse:t*2.2,dx:Math.sin(t*.4),dy:Math.cos(t*.4),blink:false,stim:false,id:0,color:col,dk:col,lt:col});
  // camera: target the rider's midsection, orbit height fixed
  const tx=0,ty=26,tz=0,ke=16,yaw=t*.7;
  const cpx=tx+ke*Math.cos(yaw),cpz=tz+ke*Math.sin(yaw),cpy=ty+ke*.5;
  let fd=[tx-cpx,ty-cpy,tz-cpz];const fl=Math.hypot(...fd);fd=fd.map(v=>v/fl);
  let rt=[fd[2],0,-fd[0]];const rl=Math.hypot(rt[0],rt[2]);rt=rt.map(v=>v/rl);
  const up=[rt[1]*fd[2]-rt[2]*fd[1],rt[2]*fd[0]-rt[0]*fd[2],rt[0]*fd[1]-rt[1]*fd[0]];
  const F=Math.min(w,h);// focal scale (pixels per world unit at z=1)
  const faces=[];
  for(const f of geo.faces3){
    const pts=[];let zsum=0;
    for(const q of f.pts){
      const vx=q[0]-cpx,vy=q[1]-cpy,vz=q[2]-cpz;
      const x=vx*rt[0]+vy*rt[1]+vz*rt[2];
      const y=vx*up[0]+vy*up[1]+vz*up[2];
      const z=-(vx*fd[0]+vy*fd[1]+vz*fd[2]);
      pts.push([w/2+x*F/z,h*.62-y*F/z]);
      zsum+=z;
    }
    const n=newell(f.pts);
    const L=[.38,.72,-.58];const nl=Math.hypot(...n);
    const dot=(n[0]*L[0]+n[1]*L[1]+n[2]*L[2])/nl;
    const lit=Math.max(.42,.62+.38*dot);
    const m=f.col.match(/\d+/g),c3=[+m[0],+m[1],+m[2]];
    faces.push({pts,z:zsum/f.pts.length,col:cssLit(c3,lit)});
  }
  faces.sort((a,b)=>a.z-b.z); // painter: far (smaller depth z) first
  for(const f of faces){ctx.fillStyle=f.col;ctx.strokeStyle='rgba(10,10,20,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(f.pts[0][0],f.pts[0][1]);for(let i=1;i<f.pts.length;i++)ctx.lineTo(f.pts[i][0],f.pts[i][1]);ctx.closePath();ctx.fill();ctx.stroke();}
}

function loop(){
  const cv=document.getElementById('rideCanvas');
  if(!run||!cv||!cv.offsetParent){run=false;return;}
  drawPortrait();raf=requestAnimationFrame(loop);
}

function renderGrid(){
  const g=document.getElementById('rideGrid');if(!g)return;
  g.innerHTML=ROSTER.map((r,i)=>
    `<button class="ride-card${i===SaveData.data.rider?' sel':''}" data-i="${i}">
       <div class="flex items-center gap-2"><span class="w-3.5 h-3.5 rounded-sm inline-block" style="background:${PALETTE[r.colorIdx]};box-shadow:0 0 8px ${PALETTE[r.colorIdx]}"></span>
       <span class="font-black tracking-widest text-sm">${r.name}</span></div>
       <div class="text-[10px] opacity-70 mt-1">${abilName(r.tac,'tacs')} · ${abilName(r.ult,'ults')}</div>
     </button>`).join('');
  g.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{selectRider(+b.dataset.i);});
}

function selectRider(i){
  sel=i;const r=ROSTER[i];
  document.getElementById('rideDetail').style.display='';
  document.getElementById('rideName').textContent=r.name;
  document.getElementById('rideKit').innerHTML=`kit: <b>${abilName(r.tac,'tacs')}</b> · <b>${abilName(r.ult,'ults')}</b>`;
  document.getElementById('rideWhy').textContent=r.blurb;
  const pick=document.getElementById('ridePickBtn');
  pick.textContent=SaveData.data.rider===i?`✓ ${r.name} IS YOUR RIDER`:`PICK ${r.name}`;
  renderGrid();S.click();
}

function bindLobby(){
  if(G._lobbyBound)return;G._lobbyBound=true;
  sel=Math.max(0,Math.min(ROSTER.length-1,SaveData.data.rider|0));
  renderGrid();selectRider(sel);
  document.getElementById('ridePickBtn').onclick=()=>{
    if(sel<0)return;const r=ROSTER[sel];
    SaveData.data.rider=sel;SaveData.data.colorIdx=r.colorIdx;
    SaveData.data.loadout={tac:r.tac,ult:r.ult};
    SaveData.save();
    renderGrid();selectRider(sel);S.ultReady();
    document.getElementById('ridePickBtn').textContent=`✓ ${r.name} IS YOUR RIDER`;
    if(G.buildSkins)G.buildSkins();if(G.buildAbil)G.buildAbil();
  };
  if(typeof MutationObserver!=='undefined'){
    const obs=new MutationObserver(()=>{
      const t=document.getElementById('tab-riders'),on=t&&!t.classList.contains('hidden');
      if(on&&!run){run=true;raf=requestAnimationFrame(loop);}else if(!on&&run){run=false;cancelAnimationFrame(raf);}
    });
    obs.observe(document.getElementById('tab-riders'),{attributes:true,attributeFilter:['class']});
  }
}

export{bindLobby,renderGrid,drawPortrait};
