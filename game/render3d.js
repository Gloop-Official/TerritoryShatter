// game/render3d.js — perspective world renderer (orbit & fps cameras).
// Shares one painter bucket for terrain, trails, shards and characters so depth is global.
import{G}from'./ctx.js';
import{W,H,CELL,idx,inB}from'./config.js';
import{clamp}from'../engine/math.js';
import{buildRiderGeo3D,cssLit,litFactor}from'../engine/rig3d.js';
import{arenaFloor,grainPattern}from'../engine/tex.js';

const BLK=8;                       // turf block height (units)
const MAXD=1500;                   // far cull (units)
const SIDE_SHADE={s:.78,e:.66,n:.5,w:.58};
const SKY=[['#8fd3ff',0],['#ffd9ec',.55],['#fff3d6',1]];

const mixStr=(c,f)=>{const m=c.match(/\d+/g);return `rgb(${(+m[0]*f)|0},${(+m[1]*f)|0},${(+m[2]*f)|0})`;};
/** affine texture-map one triangle of a quad (classic clip+transform trick) */
function texTri(ctx,img,sx,sy,sw,sh,x0,y0,x1,y1,x2,y2){
  ctx.save();ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.lineTo(x2,y2);ctx.closePath();ctx.clip();
  ctx.setTransform((x1-x0)/sw,(y1-y0)/sw,(x2-x0)/sh,(y2-y0)/sh,x0,y0);
  ctx.drawImage(img,sx,sy,sw,sh,0,0,sw,sh);ctx.restore();
}
// --- atmospheric fog: distant geometry tints toward the horizon haze ---
const FOG=[199,210,240],FOG_START=210,FOG_FULL=880;
const fogged=(c,d)=>{
  if(d<FOG_START)return c;const f=Math.min(1,(d-FOG_START)/(FOG_FULL-FOG_START))*.72;
  const m=c.match(/rgba?\(([^)]+)\)/);
  if(m&&m[1].includes(',')){const p=m[1].split(','),r=(+p[0]*(1-f)+FOG[0]*f)|0,g=(+p[1]*(1-f)+FOG[1]*f)|0,b=(+p[2]*(1-f)+FOG[2]*f)|0;
    return p.length>3?`rgba(${r},${g},${b},${p[3].trim()})`:`rgb(${r},${g},${b})`;}
  const h=c[0]==='#'?parseInt(c.slice(1),16):null;
  if(h==null)return c;
  return `rgb(${(((h>>16)&255)*(1-f)+FOG[0]*f)|0},${(((h>>8)&255)*(1-f)+FOG[1]*f)|0},${((h&255)*(1-f)+FOG[2]*f)|0})`;
};
function newell(p){const n=[0,0,0];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];
  n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}
  const l=Math.hypot(...n)||1;return[n[0]/l,n[1]/l,n[2]/l];}

export function renderGame3D(){
  const R=G.renderer,ctx=R.ctx,cam=G.cam3,world=G.world,mode=G.mode;
  const CW=R.cw,CH=R.ch,elapsed=mode.elapsed;
  ctx.setTransform(1,0,0,1,0,0);
  // sky + floor wash
  const sky=ctx.createLinearGradient(0,0,0,CH);
  for(const[c,t]of SKY)sky.addColorStop(t,c);
  ctx.fillStyle=sky;ctx.fillRect(0,0,CW,CH);

  const bucket=[];
  const push=(wpts,color,alpha=1,lit=null)=>{ // wpts: world-space polygon
    const pf=cam.projectPoly(wpts,MAXD);if(!pf)return;
    // reject if fully off-screen
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    for(const[px,py]of pf.pts){if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;}
    if(x1<-80||y1<-80||x0>CW+80||y0>CH+80)return;
    bucket.push({pts:pf.pts,color:pf.depth>FOG_START?fogged(color,pf.depth):color,alpha,depth:pf.depth});
  };
  const hz=mode.hazard;
  if(hz&&hz.phase==='warn'){ // pulsing hazard ring, painter-sorted with the world (world-space)
    const p=.5+.5*Math.sin(elapsed*9),rr=hz.r*CELL,cx=(hz.cx+.5)*CELL,cy=(hz.cy+.5)*CELL,N=40,w=false;
    const col=p>.5?'rgba(255,120,20,.5)':'rgba(255,190,60,.35)';
    for(let k=0;k<N;k++){const a=k/N*Math.PI*2,b=(k+1)/N*Math.PI*2,ro=rr+6,ri=rr-10;
      push([[cx+Math.cos(a)*ri,cy+Math.sin(a)*ri,.4],[cx+Math.cos(a)*ro,cy+Math.sin(a)*ro,.4],
            [cx+Math.cos(b)*ro,cy+Math.sin(b)*ro,.4],[cx+Math.cos(b)*ri,cy+Math.sin(b)*ri,.4]],col);}
  }
  if(mode.state!=='menu'){ // ===== HOT ZONE: faint gold core ring on the arena =====
    const cx=W*CELL/2,cy=H*CELL/2,rr=18*CELL,N3=44,pu=6+Math.sin(elapsed*1.4)*1.5;
    for(let k=0;k<N3;k+=2){const a=k/N3*Math.PI*2,b=(k+2)/N3*Math.PI*2,dash=(k%4===0);
      if(!dash)continue;
      push([[cx+Math.cos(a)*(rr-pu),cy+Math.sin(a)*(rr-pu),.5],[cx+Math.cos(a)*(rr+pu),cy+Math.sin(a)*(rr+pu),.5],
            [cx+Math.cos(b)*(rr+pu),cy+Math.sin(b)*(rr+pu),.5],[cx+Math.cos(b)*(rr-pu),cy+Math.sin(b)*(rr-pu),.5]],
            'rgba(255,214,0,.18)');}
  }
  const pushMesh=(wpts,rgb)=>{ // lambert-lit mesh polygon
    const n=newell(wpts);
    let cx=0,cy=0,cz=0;for(const p of wpts){cx+=p[0];cy+=p[1];cz+=p[2];}
    cx/=wpts.length;cy/=wpts.length;cz/=wpts.length;
    if(n[0]*(cam.pos[0]-cx)+n[1]*(cam.pos[1]-cy)+n[2]*(cam.pos[2]-cz)<=.01)return; // backface
    push(wpts,cssLit(rgb,litFactor(n)));
  };

  // ===== terrain ===== (full-grid; culling is per-face against near/far/screen.
  // NB: no giant ground quad! Its far corners poison the painter depth. Per-cell quads instead.)
  const grid=world.grid;
  // ===== ground: ONE procedurally textured floor, affine-mapped in macro tiles =====
  // (drawn under the bucket via direct drawImage — the floor is always back-most;
  //  everything else sits above z=0.4 so painter order is never contested here)
  {
    const tex=arenaFloor(W),MX=Math.max(1,W/10|0),M=10;
    for(let my=0;my<M;my++)for(let mx=0;mx<M;mx++){
      const x0=mx*MX*CELL,y0=my*MX*CELL,x1=Math.min(W,mx*MX+MX)*CELL,y1=Math.min(H,my*MX+MX)*CELL;
      const c0=cam.project([x0,y0,0]),c1=cam.project([x1,y0,0]),c2=cam.project([x0,y1,0]),c3=cam.project([x1,y1,0]);
      if(!c0||!c1||!c2||!c3)continue;
      const sx=mx*1024/M,sy=my*1024/M,sw=1024/M,sh=1024/M;
      // two triangles per macro tile → near-perspective mapping, no painter slot needed
      texTri(ctx,tex,sx,sy,sw,sh, c0.x,c0.y, c1.x,c1.y, c2.x,c2.y);
      texTri(ctx,tex,sx,sy,sw,sh, c3.x,c3.y, c2.x,c2.y, c1.x,c1.y);
    }
  }
  // perimeter skirts so the arena doesn't float on sky
  push([[0,H*CELL,0],[W*CELL,H*CELL,0],[W*CELL,H*CELL+260,0],[0,H*CELL+260,0]],'#cfd7f0');
  push([[W*CELL,0,0],[W*CELL+260,0,0],[W*CELL+260,H*CELL+260,0],[W*CELL,H*CELL+260,0]],'#cfd7f0');
  push([[-260,-260,0],[0,-260,0],[0,0,0],[-260,0,0]],'#cfd7f0');
  push([[0,-260,0],[W*CELL+260,-260,0],[W*CELL+260,0,0],[0,0,0]],'#cfd7f0');
  push([[-260,0,0],[0,0,0],[0,H*CELL+260,0],[-260,H*CELL+260,0]],'#cfd7f0');
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const o=grid[idx(x,y)];
    const X=x*CELL,Y=y*CELL;
    if(!o)continue; // ground now comes from the textured macro pass above
    const p=world.players[o-1];if(!p)continue;
    // candy top
    push([[X,Y,BLK],[X+CELL,Y,BLK],[X+CELL,Y+CELL,BLK],[X,Y+CELL,BLK]],p.color);
    // exposed side walls (same rule as iso pass)
    if(!inB(x,y+1)||grid[idx(x,y+1)]!==o)push([[X,Y+CELL,BLK],[X+CELL,Y+CELL,BLK],[X+CELL,Y+CELL,0],[X,Y+CELL,0]],mixStr(p.colDark,SIDE_SHADE.s));
    if(!inB(x,y-1)||grid[idx(x,y-1)]!==o)push([[X+CELL,Y,BLK],[X,Y,BLK],[X,Y,0],[X+CELL,Y,0]],mixStr(p.colDark,SIDE_SHADE.n));
    if(!inB(x+1,y)||grid[idx(x+1,y)]!==o)push([[X+CELL,Y+CELL,BLK],[X+CELL,Y,BLK],[X+CELL,Y,0],[X+CELL,Y+CELL,0]],mixStr(p.colDark,SIDE_SHADE.e));
    if(!inB(x-1,y)||grid[idx(x-1,y)]!==o)push([[X,Y,BLK],[X,Y+CELL,BLK],[X,Y+CELL,0],[X,Y,0]],mixStr(p.colDark,SIDE_SHADE.w));
  }
// === trails: ground ribbons through unowned/neutral cells ===
  for(const p of world.players){if(!p.alive||p.trail.length===0)continue;
    for(const c of p.trail){const x=c%W,y=(c/W)|0,X=x*CELL,Y=y*CELL;
      push([[X+2,Y+2,1.4],[X+CELL-2,Y+2,1.4],[X+CELL-2,Y+CELL-2,1.4],[X+2,Y+CELL-2,1.4]],
        p.color,p.phaseT>0?.4:(p.veilT>0?.25:.85));}
  }

  // ===== shards: spinning octahedra =====
  for(const s of world.shards){
    const r=s.big?8:5.5,wz=11+Math.sin(elapsed*4+s.rot)*3;
    const colTop=s.big?[255,214,0]:[0,200,245],colBot=s.big?[184,148,0]:[0,140,180];
    const cx=s.x*CELL,cy=s.y*CELL,rot=s.rot+elapsed*2;
    const co=Math.cos(rot),si=Math.sin(rot);
    const rv=[[r*co,r*si,0],[-r*si,r*co,0],[-r*co,-r*si,0],[r*si,-r*co,0]];
    const top=[cx,cy,wz+r],bot=[cx,cy,wz-r];
    for(let i=0;i<4;i++){const a=rv[i],b=rv[(i+1)%4];
      pushMesh([[cx+a[0],cy+a[1],wz],[cx+b[0],cy+b[1],wz],top],colTop);
      pushMesh([[cx+b[0],cy+b[1],wz],[cx+a[0],cy+a[1],wz],bot],colBot);}
  }

  // ===== charge crystals: bigger golden prisms, slower spin, higher hover =====
  for(const c of world.crystals){
    const r=9,wz=16+Math.sin(elapsed*2.6+c.spin)*3.5;
    const cx=c.x*CELL,cy=c.y*CELL,rot=c.spin+elapsed*1.4;
    const co=Math.cos(rot),si=Math.sin(rot);
    const rv=[[r*co,r*si,0],[-r*si,r*co,0],[-r*co,-r*si,0],[r*si,-r*co,0]];
    const top=[cx,cy,wz+r*1.3],bot=[cx,cy,wz-r];
    for(let i=0;i<4;i++){const a=rv[i],b=rv[(i+1)%4];
      pushMesh([[cx+a[0],cy+a[1],wz],[cx+b[0],cy+b[1],wz],top],[255,178,44]);
      pushMesh([[cx+b[0],cy+b[1],wz],[cx+a[0],cy+a[1],wz],bot],[200,128,10]);}
  }

  // ===== characters =====
  const details=[]; // billboard overlays drawn after the bucket
  for(const p of world.players){
    if(!p.alive)continue;
    if(cam.mode==='fps'&&p.isPlayer)continue;
    const wx=p.x*CELL,wy=p.y*CELL;
    const geo=buildRiderGeo3D({x:wx,y:wy,pulse:p.pulse,dx:p.dx,dy:p.dy,blink:p.blinkT<0.13,stim:p.stimT>0,id:p.id,seed:p.id*7+(p.palIdx||0)*13+3,
      color:p.color,dk:p.colDark,lt:p.colLight,ring:p.isPlayer,time:elapsed,ref:p});
    const alpha=p.phaseT>0?.45:(p.veilT>0?.75:1); // keep ghost readable in 3D
    // blob shadow: flat ground disc (perspective-correct), sized to the pod
    const sh=[];for(let i=0;i<10;i++){const a=i/10*Math.PI*2;sh.push([wx+16*geo.g*Math.cos(a),geo.anchor[1]+5*geo.g*Math.sin(a),.5]);}
    push(sh,'rgba(20,20,40,.3)',1);
    // thruster flame: camera-facing billboard at the rear nozzle
    const b=geo.thruster,fl=5+Math.sin(elapsed*30+p.id)*1.6+Math.random()*1.3;
    const right=cam._right,up=cam._up;
    const bb=(rx,ry)=>{
      const pts=[[ -1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>[
        b[0]+right[0]*sx*rx,b[1]+right[1]*sx*rx, b[2]+sy*ry*.6]);
      return pts;
    };
    push(bb(fl+3,fl+2),p.color,.5);
    push(bb(fl*.5,fl*.45),'#ffffff',.5);
    // faces
    for(const f of geo.faces3){
      let cx=0,cy=0,cz=0;for(const q of f.pts){cx+=q[0];cy+=q[1];cz+=q[2];}
      cx/=f.pts.length;cy/=f.pts.length;cz/=f.pts.length;
      if(f.n[0]*(cam.pos[0]-cx)+f.n[1]*(cam.pos[1]-cy)+f.n[2]*(cam.pos[2]-cz)<=.01)continue;
      push(f.pts,cssLit(f.col,litFactor(f.n)),alpha);
    }
    // billboard details (pupils/cheeks/shine/ring/name)
    const fwd=cam._fwd;
    for(const q of geo.over3){ // Ray-pod has no face — overlays are lights/glints/rings only
      if(q.kind==='dot3'){
        if(q.alpha!=null&&q.alpha<.5)continue; // unlit nav-light phase
        const d=q.ref?((q.wp[0]-q.ref[0])*fwd[0]+(q.wp[1]-q.ref[1])*fwd[1]+(q.wp[2]-q.ref[2])*fwd[2]):9;
        if(d<q.minD)continue;
        const pp=cam.project(q.wp);if(!pp)continue;
        details.push({t:'dot',x:pp.x,y:pp.y,r:q.r*pp.s,color:q.color,alpha:alpha*(q.alpha!=null?q.alpha:1)});
      }else if(q.kind==='ring3'){
        const pp=cam.project(q.wp);if(!pp)continue;
        details.push({t:'ring',x:pp.x,y:pp.y,r:q.r*pp.s,color:q.color,alpha});
      }
    }
    // name pill + surge ring
    const hp=cam.project([wx,wy,48]);if(hp)details.push({t:'name',x:hp.x,y:hp.y,name:p.name,me:p.isPlayer,color:p.color,alpha});
    if(p.surgeT>0){const sp=cam.project([wx,wy,26]);if(sp)details.push({t:'ring',x:sp.x,y:sp.y,r:(22+4*Math.sin(elapsed*6))*sp.s,color:'#ffd600',alpha:.4+.15*Math.sin(elapsed*6)});}
  }

  // ===== engine FX in world space: particles as billboards, ripples as rings =====
  {
    const fx=G.fx,right=cam._right||[0,1,0],up=cam._up||[0,0,1];
    for(const q of fx.particles){
      const a=Math.max(0,1-q.t/q.life),s=q.size*.9,z=q.z||8;
      const quad=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>[
        q.x+(right[0]*sx+up[0]*sy)*s, q.y+(right[1]*sx+up[1]*sy)*s, z+(up[2]*sy)*s]);
      push(quad,q.color,a);
    }
    for(const r of fx.ripples){
      const e=1-Math.pow(1-r.t,3),rad=r.max*(e+Math.sin(r.t*Math.PI*3)*.06*(1-r.t)),a=(1-r.t)*.8;
      const N2=14,w2=Math.max(2,rad*.06);
      for(let k=0;k<N2;k++){const a0=k/N2*Math.PI*2,a1=(k+1)/N2*Math.PI*2;
        push([[r.x+Math.cos(a0)*(rad-w2),r.y+Math.sin(a0)*(rad-w2),.8],
              [r.x+Math.cos(a0)*(rad+w2),r.y+Math.sin(a0)*(rad+w2),.8],
              [r.x+Math.cos(a1)*(rad+w2),r.y+Math.sin(a1)*(rad+w2),.8],
              [r.x+Math.cos(a1)*(rad-w2),r.y+Math.sin(a1)*(rad-w2),.8]],r.color,a);}
    }
  }

  // ===== draw bucket back→front =====
  bucket.sort((a,b)=>b.depth-a.depth);
  for(const f of bucket){
    ctx.globalAlpha=f.alpha;
    ctx.fillStyle=f.color;
    ctx.beginPath();ctx.moveTo(f.pts[0][0],f.pts[0][1]);
    for(let i=1;i<f.pts.length;i++)ctx.lineTo(f.pts[i][0],f.pts[i][1]);
    ctx.closePath();ctx.fill();
  }
  ctx.globalAlpha=1;
  // billboard details
  ctx.textAlign='center';
  for(const q of details){
    ctx.globalAlpha=q.alpha==null?1:clamp(q.alpha,0,1);
    if(q.t==='dot'){ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(.5,q.r),0,Math.PI*2);ctx.fill();}
    else if(q.t==='line'){ctx.strokeStyle=q.color;ctx.lineWidth=Math.max(1,q.w);ctx.beginPath();ctx.moveTo(q.a.x,q.a.y);ctx.lineTo(q.b.x,q.b.y);ctx.stroke();}
    else if(q.t==='ring'){ctx.strokeStyle=q.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(2,q.r),0,Math.PI*2);ctx.stroke();}
    else if(q.t==='name'){
      ctx.font='bold 12px sans-serif';
      const tw=ctx.measureText(q.name).width;
      ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(q.x-tw/2-5,q.y-11,tw+10,15);
      ctx.fillStyle=q.me?'#fff':'rgba(255,255,255,.92)';ctx.fillText(q.name,q.x,q.y+1);
    }
  }
  ctx.globalAlpha=1;
  // fps vignette for style
  if(cam.mode==='fps'){
    const vg=ctx.createRadialGradient(CW/2,CH/2,CH*.35,CW/2,CH/2,CH*.75);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(20,10,40,.35)');
    ctx.fillStyle=vg;ctx.fillRect(0,0,CW,CH);
  }
  G.stats3={polys:bucket.length,fx:G.fx.particles.length};
  postFX(ctx,CW,CH);
}

/** post-process: procedural film grain + soft candy vignette (engine tex pass) */
let _pfxHalfRate=false;
function postFX(ctx,CW,CH){
  // governor cadence: under auto-quality pressure the grain layer runs at half rate,
  // the vignette (cheap, one rect) always runs
  _pfxHalfRate=!_pfxHalfRate;
  ctx.save();
  if((G._autoQuality??1)>=1||_pfxHalfRate){
    ctx.globalAlpha=.055;ctx.globalCompositeOperation='overlay';
    ctx.fillStyle=grainPattern(ctx);ctx.fillRect(0,0,CW,CH);
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  }
  const v=ctx.createRadialGradient(CW/2,CH/2,Math.min(CW,CH)*.42,CW/2,CH/2,Math.hypot(CW,CH)*.62);
  v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(26,18,54,.16)');
  ctx.fillStyle=v;ctx.fillRect(0,0,CW,CH);
  ctx.restore();
}

/** projector for the scan-pulse overlay (screen coords of rivals) */
export function projectPlayer(p){
  const cam=G.cam3;const pr=cam.project([p.x*CELL,p.y*CELL,20]);
  return pr?{x:pr.x,y:pr.y,on:true}:{x:0,y:0,on:false};
}

/** scan pulse overlay for camera-3D modes: rings + edge arrows on rivals */
export function renderScan3D(){
  const R=G.renderer,ctx=R.ctx,cam=G.cam3,world=G.world,mode=G.mode,player=world.player;
  const CW=R.cw,CH=R.ch,elapsed=mode.elapsed;
  if(!(player&&player.alive&&player.scanT>0))return;
  for(const q of world.players){if(q===player||!q.alive)continue;
    const pr=cam.project([q.x*CELL,q.y*CELL,22]);
    const sx=pr?pr.x:-1e6,sy=pr?pr.y:-1e6;
    ctx.globalAlpha=.85+.15*Math.sin(elapsed*8);
    if(pr&&sx>50&&sx<CW-50&&sy>50&&sy<CH-50){
      ctx.strokeStyle=q.color;ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(sx,sy,18+3*Math.sin(elapsed*8),0,Math.PI*2);ctx.stroke();
    }else{const m=42;const px=clamp(sx,m,CW-m),py=clamp(sy,m,CH-m),ang=Math.atan2(sy-CH/2,sx-CW/2);
      ctx.save();ctx.translate(px,py);ctx.rotate(ang);ctx.fillStyle=q.color;ctx.shadowColor=q.color;ctx.shadowBlur=10;
      ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-7,7);ctx.lineTo(-7,-7);ctx.closePath();ctx.fill();ctx.restore();}
    ctx.globalAlpha=1;}
}
