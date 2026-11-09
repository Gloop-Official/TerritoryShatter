// engine/rig3d.js — software 3D character rig: "helmet kid" hoverboard rider.
// Real geometry (spheroids, boxes, cylinders) rebuilt per frame — no textures, no PNGs.
//
// Local space: +x = actor forward, +y = actor's left, +z = up. Origin = ground under board.
// Two sinks:
//   buildChibi3D(o)  → oblique-projected faces for the classic 2.5D canvas pass
//   buildChibiGeo3D(o) → world-space 3D faces/overlays for a perspective Camera3D pass
//   drawChibi3D(ctx,o) → full oblique render incl. shadow + thruster flame
//
// o: {x,y,pulse,dx,dy,blink,stim,id,color,dk,lt,ring,time,ref?}
import{rnd,clamp}from'./math.js';

const norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l];};
const VIEW=norm([0.3,0.72,0.9]); // oblique camera sits south-east & above (matches block sides)
const LIGHT=norm([0.3,0.42,0.86]);

const parse=c=>{if(c[0]==='#'){const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
  const m=c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:[255,0,255];};
export const cssLit=(c,f)=>`rgb(${clamp(c[0]*f,0,255)|0},${clamp(c[1]*f,0,255)|0},${clamp(c[2]*f,0,255)|0})`;
export const litFactor=n=>.62+.38*Math.max(0,n[0]*LIGHT[0]+n[1]*LIGHT[1]+n[2]*LIGHT[2]);

// ===== mesh templates =====
function mkBox(sx,sy,sz,colors){
  const x=sx/2,y=sy/2,z=sz/2;
  const v=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];
  return{v,f:[[4,5,6,7,colors.top],[1,0,3,2,colors.bottom||colors.side],
    [0,1,5,4,colors.side],[2,3,7,6,colors.side],[1,2,6,5,colors.front||colors.side],[3,0,4,7,colors.side]]};
}
function mkSpheroid(rx,ry,rz,color,rings=4,around=8){
  const v=[],f=[];
  for(let j=0;j<=rings;j++){const th=j*Math.PI/rings,st=Math.sin(th),ct=Math.cos(th);
    for(let i=0;i<around;i++){const ph=i*2*Math.PI/around;v.push([rx*st*Math.cos(ph),ry*st*Math.sin(ph),rz*ct]);}}
  for(let j=0;j<rings;j++)for(let i=0;i<around;i++){
    const a=j*around+i,b=j*around+(i+1)%around,c=(j+1)*around+(i+1)%around,d=(j+1)*around+i;
    f.push([a,b,c,d,color]);}
  return{v,f};
}
function mkCylinder(r,len,color,sides=5){
  const v=[],f=[];
  for(const z of[0,len])for(let i=0;i<sides;i++){const ph=i*2*Math.PI/sides;v.push([r*Math.cos(ph),r*Math.sin(ph),z]);}
  for(let i=0;i<sides;i++){const j=(i+1)%sides;f.push([i,j,sides+j,sides+i,color]);}
  return{v,f};
}

// ===== transforms =====
const rotX=a=>{const c=Math.cos(a),s=Math.sin(a);return[1,0,0, 0,c,-s, 0,s,c];};
const rotY=a=>{const c=Math.cos(a),s=Math.sin(a);return[c,0,s, 0,1,0, -s,0,c];};
const rotZ=a=>{const c=Math.cos(a),s=Math.sin(a);return[c,-s,0, s,c,0, 0,0,1];};
const mulM=(a,b)=>{const o=new Array(9);for(let r=0;r<3;r++)for(let c=0;c<3;c++)o[r*3+c]=a[r*3]*b[c]+a[r*3+1]*b[3+c]+a[r*3+2]*b[6+c];return o;};
const appM=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
const newell=p=>{const n=[0,0,0];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];
  n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}return norm(n);};

/** Core builder: world-space 3D faces + overlay anchors. World z is up; anchor at (o.x, o.y+10, 0). */
export function buildChibiGeo3D(o){
  const st=o.ref?(o.ref._rig=o.ref._rig||{yaw:Math.atan2(o.dy,o.dx),bank:0}):{yaw:Math.atan2(o.dy,o.dx),bank:0};
  const yaw=Math.atan2(o.dy,o.dx);
  let dYaw=yaw-st.yaw;while(dYaw>Math.PI)dYaw-=2*Math.PI;while(dYaw<-Math.PI)dYaw+=2*Math.PI;
  st.yaw=yaw;st.bank=clamp(st.bank*.88+dYaw*6,-1,1);

  const bob=Math.sin(o.pulse*1.4);
  const sq=1+bob*.05,g=o.stim?1.07:1;
  const pitch=.15+Math.sin(o.pulse*.7)*.05;
  const roll=st.bank*.3;
  const M=mulM(rotZ(yaw),mulM(rotY(-pitch),rotX(roll)));
  const A=[o.x,o.y+10+bob*.5,0];                   // world anchor (ground, under board)

  const col=parse(o.color),dk=parse(o.dk),lt=parse(o.lt);
  const SKIN=[255,236,220],SOLE=[226,230,242],DARK=[34,38,48],WHITE=[255,255,255];
  const faces3=[],over3=[];

  const emit=(mesh,t)=>{
    const R=t.rx||t.ry||t.rz?mulM(rotZ(t.rz||0),mulM(rotY(t.ry||0),rotX(t.rx||0))):null;
    for(const f of mesh.f){
      const pts=[];
      for(let i=0;i<f.length-1;i++){
        let v=mesh.v[f[i]];
        v=[v[0]*(t.s?t.s[0]:1),v[1]*(t.s?t.s[1]:1),v[2]*(t.s?t.s[2]:1)];
        if(R)v=appM(R,v);
        v=[v[0]+t.p[0],v[1]+t.p[1],v[2]+t.p[2]];
        v=[v[0]*g*sq,v[1]*g*sq,v[2]*g/sq];
        v=appM(M,v);
        pts.push([v[0]+A[0],v[1]+A[1],v[2]+A[2]]);
      }
      faces3.push({pts,n:newell(pts),col:f[4],alpha:t.alpha||1});
    }
  };
  const proj3=v=>{let p=[v[0]*g*sq,v[1]*g*sq,v[2]*g/sq];p=appM(M,p);return[p[0]+A[0],p[1]+A[1],p[2]+A[2]];};

  const kick=Math.sin(o.pulse*2.6)*1.8, sway=Math.sin(o.pulse*1.4+1.2)*1.6;
  const hb=bob*1.2; // body group bob

  // --- hoverboard ---
  emit(mkBox(31,11,3.6,{top:[74,82,100],bottom:[30,33,42],side:[44,49,60]}),{p:[0,0,9]});
  emit(mkBox(24,11.9,1.4,{top:lt,bottom:lt,side:lt}),{p:[0,0,7.2]});
  // --- sneakers + sock legs (paddle kick) ---
  for(const s of[-1,1]){
    const k=s*kick*.3;
    emit(mkBox(7.5,5.5,3.6,{top:WHITE,bottom:SOLE,side:SOLE}),{p:[k,s*4.9,12.6+bob*.2]});
    emit(mkCylinder(2.1,7,dk,5),{p:[k*.4,s*4.6,13.2+bob*.25],rx:s*.06});
  }
  // --- arms: swung out for balance, mittened ---
  for(const s of[-1,1]){
    const sw=s*sway;
    emit(mkSpheroid(3,2.8,5,dk,3,6),{p:[-1,s*10.8,26+sw],rx:s*.5,ry:-.15});
    emit(mkSpheroid(3.2,3.2,3.2,lt,3,6),{p:[-2.2,s*13.2,23.2+sw*1.2]});
  }
  // --- hoodie body (shell outline + core + belly) ---
  emit(mkSpheroid(10,9.2,11.2,DARK,4,8),{p:[0,0,26+hb]});
  emit(mkSpheroid(9.4,8.6,10.5,lt,5,10),{p:[0,0,26+hb]});
  emit(mkSpheroid(4.2,5.9,6.6,WHITE,4,8),{p:[6.9,0,22.8+hb]});
  // --- big helmet head ---
  const hbb=Math.sin(o.pulse*2+.9)*.6+hb;         // head bob lags body slightly
  const HC=[1.9,0,36.4+hbb];
  emit(mkSpheroid(8.8,8.3,8.8,col,5,10),{p:[0,0,36.6+hbb]});        // helmet shell (team color)
  emit(mkSpheroid(7.2,6.9,7.1,SKIN,5,10),{p:HC});                   // face pokes out front
  emit(mkBox(9,2.3,1.5,{top:WHITE,bottom:WHITE,side:WHITE}),{p:[.4,0,44.4+hbb],ry:-.12}); // helmet stripe
  // --- eyes on the face ---
  for(const s of[-1,1])emit(mkSpheroid(3.1,3,3.7,WHITE,4,8),{p:[6.5+1.9,s*3.1,36.6+hbb]});

  // ===== overlay anchors (billboarded 2D details, projected by the sink) =====
  const bodyC=proj3([0,0,26+hb]);
  for(const s of[-1,1]){
    const e=proj3([8.4,s*3.1,36.6+hbb]);
    over3.push({kind:'eye',wp:e,side:s,blink:o.blink,dx:o.dx,dy:o.dy});
    const c=proj3([7.1,s*5.9,34.1+hbb]);
    over3.push({kind:'dot3',wp:c,r:1.8,color:'rgba(255,110,150,.45)',minD:0.6,ref:bodyC});
  }
  over3.push({kind:'dot3',wp:proj3([3.4,-2.6,43.6+hbb]),r:1.3,color:'rgba(255,255,255,.55)',minD:.5,ref:bodyC}); // helmet shine
  if(o.ring)over3.push({kind:'ring3',wp:proj3([0,0,27+hb]),r:15,color:'rgba(255,255,255,.75)'});
  return{faces3,over3,g,bob,anchor:A,bodyC,flame:o,board:[A[0],A[1],9]};
}

const depthOf=(pts,vw)=>{let d=0;for(const p of pts)d+=p[0]*vw[0]+p[1]*vw[1]+p[2]*vw[2];return d/pts.length;};

/** Oblique (classic 2.5D) build: faces in screen coords + flat overlays. */
export function buildChibi3D(o){
  const geo=buildChibiGeo3D(o);
  const faces=[];
  for(const f of geo.faces3){
    const facing=f.n[0]*VIEW[0]+f.n[1]*VIEW[1]+f.n[2]*VIEW[2];
    if(facing<=.02)continue;
    faces.push({pts:f.pts.map(p=>[p[0],p[1]-p[2]]),color:cssLit(f.col,litFactor(f.n)),
      alpha:f.alpha,depth:depthOf(f.pts,VIEW)});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  const over=[];
  const to2=p=>[p[0],p[1]-p[2]];
  const yaw=Math.atan2(o.dy,o.dx),side=[-Math.sin(yaw),Math.cos(yaw)];
  for(const q of geo.over3){
    if(q.kind==='eye'){
      const d=(q.wp[0]-geo.bodyC[0])*VIEW[0]+(q.wp[1]-geo.bodyC[1])*VIEW[1]+(q.wp[2]-geo.bodyC[2])*VIEW[2];
      if(d<1.2)continue;
      const[x,y]=to2(q.wp);
      if(q.blink)over.push({kind:'line',x1:x-side[0]*2.6,y1:y-side[1]*2.6,x2:x+side[0]*2.6,y2:y+side[1]*2.6,color:'#16181f',w:1.6});
      else{over.push({kind:'dot',x:x+q.dx*1.4,y:y+q.dy*1.4,r:1.8,color:'#16181f'});
        over.push({kind:'dot',x:x+q.dx*1.4+.7,y:y+q.dy*1.4-1,r:.6,color:'#fff'});}
    }else if(q.kind==='dot3'){
      const d=(q.wp[0]-q.ref[0])*VIEW[0]+(q.wp[1]-q.ref[1])*VIEW[1]+(q.wp[2]-q.ref[2])*VIEW[2];
      if(d<q.minD)continue;
      const[x,y]=to2(q.wp);over.push({kind:'dot',x,y,r:q.r,color:q.color});
    }else if(q.kind==='ring3'){
      const[x,y]=to2(q.wp);over.push({kind:'ring',x,y,rx:q.r*.85,ry:q.r,color:q.color});
    }
  }
  return{faces,over,g:geo.g,bob:geo.bob,gy:o.y+10+geo.bob*.5,geo};
}

/** Full oblique render: blob shadow, thruster flame, shaded faces, details. */
export function drawChibi3D(ctx,o){
  const{faces,over,g,bob,gy}=buildChibi3D(o);
  const a0=ctx.globalAlpha;
  ctx.fillStyle='rgba(20,20,40,.3)';ctx.beginPath();ctx.ellipse(o.x,gy+2.5-bob*.5,14*g,5,0,0,Math.PI*2);ctx.fill();
  const fl=5+Math.sin(o.time*30+o.id)*1.6+rnd(0,1.6);
  ctx.globalAlpha=a0*.55;ctx.fillStyle=o.color;ctx.beginPath();ctx.ellipse(o.x,gy+1,fl+2,fl*.6,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=a0*.5;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(o.x,gy+1,fl*.45,fl*.28,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=a0;
  for(const f of faces){if(f.alpha!==1)ctx.globalAlpha=a0*f.alpha;ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(f.pts[0][0],f.pts[0][1]);
    for(let i=1;i<f.pts.length;i++)ctx.lineTo(f.pts[i][0],f.pts[i][1]);ctx.closePath();ctx.fill();if(f.alpha!==1)ctx.globalAlpha=a0;}
  for(const q of over){
    if(q.kind==='dot'){ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();}
    else if(q.kind==='line'){ctx.strokeStyle=q.color;ctx.lineWidth=q.w;ctx.beginPath();ctx.moveTo(q.x1,q.y1);ctx.lineTo(q.x2,q.y2);ctx.stroke();}
    else if(q.kind==='ring'){ctx.strokeStyle=q.color;ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(q.x,q.y,q.rx,q.ry,0,0,Math.PI*2);ctx.stroke();}
  }
}
