// game/render3d.js — perspective world renderer (orbit & fps cameras).
// Shares one painter bucket for terrain, trails, shards and characters so depth is global.
import{G}from'./ctx.js';
import{W,H,CELL,idx,inB}from'./config.js';
import{clamp}from'../engine/math.js';
import{buildChibiGeo3D,cssLit,litFactor}from'../engine/rig3d.js';

const BLK=8;                       // turf block height (units)
const MAXD=1500;                   // far cull (units)
const SIDE_SHADE={s:.78,e:.66,n:.5,w:.58};
const SKY=[['#8fd3ff',0],['#ffd9ec',.55],['#fff3d6',1]];

const mixStr=(c,f)=>{const m=c.match(/\d+/g);return `rgb(${(+m[0]*f)|0},${(+m[1]*f)|0},${(+m[2]*f)|0})`;};
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
    bucket.push({pts:pf.pts,color,alpha,depth:pf.depth});
  };
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
  const checkEmpty=G.fx.quality>=1&&cam.tDist<260; // checker tiles only when close enough to matter
  // perimeter skirts so the arena doesn't float on sky
  push([[0,H*CELL,0],[W*CELL,H*CELL,0],[W*CELL,H*CELL+260,0],[0,H*CELL+260,0]],'#cfd7f0');
  push([[W*CELL,0,0],[W*CELL+260,0,0],[W*CELL+260,H*CELL+260,0],[W*CELL,H*CELL+260,0]],'#cfd7f0');
  push([[-260,-260,0],[0,-260,0],[0,0,0],[-260,0,0]],'#cfd7f0');
  push([[0,-260,0],[W*CELL+260,-260,0],[W*CELL+260,0,0],[0,0,0]],'#cfd7f0');
  push([[-260,0,0],[0,0,0],[0,H*CELL+260,0],[-260,H*CELL+260,0]],'#cfd7f0');
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const o=grid[idx(x,y)];
    const X=x*CELL,Y=y*CELL;
    if(!o){ // ground tile (+ subtle checker nearby so empty floor reads speed)
      push([[X,Y,.4],[X+CELL,Y,.4],[X+CELL,Y+CELL,.4],[X,Y+CELL,.4]],
        checkEmpty?(((x+y)&1)===0?'#e8eeff':'#ccd5ef'):'#d7defb');
      continue;
    }
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

  // ===== characters =====
  const details=[]; // billboard overlays drawn after the bucket
  for(const p of world.players){
    if(!p.alive)continue;
    if(cam.mode==='fps'&&p.isPlayer)continue;
    const wx=p.x*CELL,wy=p.y*CELL;
    const geo=buildChibiGeo3D({x:wx,y:wy,pulse:p.pulse,dx:p.dx,dy:p.dy,blink:p.blinkT<0.13,stim:p.stimT>0,id:p.id,
      color:p.color,dk:p.colDark,lt:p.colLight,ring:p.isPlayer,time:elapsed,ref:p});
    const alpha=p.phaseT>0?.45:(p.veilT>0?.75:1); // keep ghost readable in 3D
    // blob shadow: flat ground disc (perspective-correct)
    const sh=[];for(let i=0;i<10;i++){const a=i/10*Math.PI*2;sh.push([wx+13*geo.g*Math.cos(a),geo.anchor[1]+4*geo.g*Math.sin(a),.5]);}
    push(sh,'rgba(20,20,40,.3)',1);
    // thruster flame: camera-facing billboard
    const b=geo.board,fl=5+Math.sin(elapsed*30+p.id)*1.6+Math.random()*1.3;
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
    const yaw=Math.atan2(p.dy,p.dx),side=[-Math.sin(yaw),Math.cos(yaw),0];
    for(const q of geo.over3){
      if(q.kind==='eye'){
        const d=(q.wp[0]-geo.bodyC[0])*fwd[0]+(q.wp[1]-geo.bodyC[1])*fwd[1]+(q.wp[2]-geo.bodyC[2])*fwd[2];
        if(d<1.0)continue;
        const pp=cam.project(q.wp);if(!pp)continue;
        if(q.blink){
          const a=cam.project([q.wp[0]-side[0]*2.6,q.wp[1]-side[1]*2.6,q.wp[2]]);
          const b2=cam.project([q.wp[0]+side[0]*2.6,q.wp[1]+side[1]*2.6,q.wp[2]]);
          if(a&&b2)details.push({t:'line',a,b:b2,color:'#16181f',w:1.6*pp.s});
        }else{
          details.push({t:'dot',x:pp.x+p.dx*1.4*pp.s,y:pp.y+p.dy*1.4*pp.s,r:1.8*pp.s,color:'#16181f',alpha});
          details.push({t:'dot',x:pp.x+p.dx*1.4*pp.s+.7*pp.s,y:pp.y+p.dy*1.4*pp.s-1*pp.s,r:.6*pp.s,color:'#fff',alpha});
        }
      }else if(q.kind==='dot3'){
        const d=(q.wp[0]-q.ref[0])*fwd[0]+(q.wp[1]-q.ref[1])*fwd[1]+(q.wp[2]-q.ref[2])*fwd[2];
        if(d<q.minD)continue;
        const pp=cam.project(q.wp);if(!pp)continue;
        details.push({t:'dot',x:pp.x,y:pp.y,r:q.r*pp.s,color:q.color,alpha});
      }else if(q.kind==='ring3'){
        const pp=cam.project(q.wp);if(!pp)continue;
        details.push({t:'ring',x:pp.x,y:pp.y,r:q.r*pp.s,color:q.color,alpha});
      }
    }
    // name pill + surge ring
    const hp=cam.project([wx,wy,54]);if(hp)details.push({t:'name',x:hp.x,y:hp.y,name:p.name,me:p.isPlayer,color:p.color,alpha});
    if(p.surgeT>0){const sp=cam.project([wx,wy,26]);if(sp)details.push({t:'ring',x:sp.x,y:sp.y,r:(22+4*Math.sin(elapsed*6))*sp.s,color:'#ffd600',alpha:.4+.15*Math.sin(elapsed*6)});}
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
