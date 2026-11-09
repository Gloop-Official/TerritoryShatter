// engine/rig3d.js — software 3D character rig: "RAY-POD" hover-pod rider.
// Curved-surface geometry (lathe-turned hulls, ellipsoids, swept wedge fins)
// rebuilt per frame — no textures, no PNGs.
//
// Local space: +x = actor forward, +y = actor's left, +z = up. Origin = ground under pod.
// Two sinks:
//   buildRider3D(o)   → oblique-projected faces for the classic 2.5D canvas pass
//   buildRiderGeo3D(o) → world-space 3D faces/overlays for a perspective Camera3D pass
//   drawRider3D(ctx,o) → full oblique render incl. shadow + thruster flame
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

// ===== engine mesh library =====
/** Lathe (surface of revolution) from a [[radius, along], ...] profile.
 *  axis 'x': revolves the hull along +x (nose→tail). axis 'z': ring lying in xy. */
export function mkLathe(profile,sides,axis,color){
  const v=[],f=[];
  for(const[ra,al]of profile)for(let i=0;i<sides;i++){const ph=i*2*Math.PI/sides;
    if(axis==='x')v.push([al,ra*Math.cos(ph),ra*Math.sin(ph)]);
    else v.push([ra*Math.cos(ph),ra*Math.sin(ph),al]);}
  const rings=profile.length;
  for(let j=0;j<rings-1;j++)for(let i=0;i<sides;i++){
    const a=j*sides+i,b=j*sides+(i+1)%sides,c=(j+1)*sides+(i+1)%sides,d=(j+1)*sides+i;
    f.push([a,b,c,d,color]);}
  return{v,f};
}
export function mkSpheroid(rx,ry,rz,color,rings=4,around=8){
  const v=[],f=[];
  for(let j=0;j<=rings;j++){const th=j*Math.PI/rings,st=Math.sin(th),ct=Math.cos(th);
    for(let i=0;i<around;i++){const ph=i*2*Math.PI/around;v.push([rx*st*Math.cos(ph),ry*st*Math.sin(ph),rz*ct]);}}
  for(let j=0;j<rings;j++)for(let i=0;i<around;i++){
    const a=j*around+i,b=j*around+(i+1)%around,c=(j+1)*around+(i+1)%around,d=(j+1)*around+i;
    f.push([a,b,c,d,color]);}
  return{v,f};
}
export function mkCylinder(r,len,color,sides=6){
  const v=[],f=[];
  for(const z of[0,len])for(let i=0;i<sides;i++){const ph=i*2*Math.PI/sides;v.push([r*Math.cos(ph),r*Math.sin(ph),z]);}
  for(let i=0;i<sides;i++){const j=(i+1)%sides;f.push([i,j,sides+j,sides+i,color]);}
  return{v,f};
}
/** Swept wedge prism: full height hFw at +x edge, tapering to hTl at -x edge. */
export function mkWedge(w,d,hFw,hTl,colors){
  const x=w/2,y=d/2;
  const v=[[-x,-y,0],[x,-y,0],[x,y,0],[-x,y,0],
           [-x,-y,hTl],[x,-y,hFw],[x,y,hFw],[-x,y,hTl]];
  return{v,f:[[4,5,6,7,colors.top],[1,0,3,2,colors.bottom||colors.top],
    [0,1,5,4,colors.side],[2,3,7,6,colors.side],[1,2,6,5,colors.front||colors.side],[3,0,4,7,colors.side]]};
}
export function mkBox(sx,sy,sz,colors){
  const x=sx/2,y=sy/2,z=sz/2;
  const v=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];
  return{v,f:[[4,5,6,7,colors.top],[1,0,3,2,colors.bottom||colors.side],
    [0,1,5,4,colors.side],[2,3,7,6,colors.side],[1,2,6,5,colors.front||colors.side],[3,0,4,7,colors.side]]};
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
export function buildRiderGeo3D(o){
  const st=o.ref?(o.ref._rig=o.ref._rig||{yaw:Math.atan2(o.dy,o.dx),bank:0}):{yaw:Math.atan2(o.dy,o.dx),bank:0};
  const yaw=Math.atan2(o.dy,o.dx);
  let dYaw=yaw-st.yaw;while(dYaw>Math.PI)dYaw-=2*Math.PI;while(dYaw<-Math.PI)dYaw+=2*Math.PI;
  st.yaw=yaw;st.bank=clamp(st.bank*.88+dYaw*6,-1,1);

  const bob=Math.sin(o.pulse*1.4);
  const sq=1+bob*.04,g=o.stim?1.07:1;
  const pitch=(o.stim?.30:.14)+Math.sin(o.pulse*.7)*.04; // nose dips when boosting
  const roll=st.bank*.42;                                // bank into turns (pod style)
  const M=mulM(rotZ(yaw),mulM(rotY(-pitch),rotX(roll)));
  const A=[o.x,o.y+11+bob*.6,0];                         // world anchor (ground under pod)

  const col=parse(o.color),dk=parse(o.dk),lt=parse(o.lt);
  const GLASS=[38,42,58],DARK=[30,34,44],WHITE=[255,255,255],SOLE=[226,230,242];
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

  const HUB=17+bob*.9; // hover height

  // --- teardrop hull: lathe around +x, squashed vertically (fat belly, pointed nose) ---
  const HULL=[[.2,-17],[3.4,-14.6],[7,-9.6],[9.2,-4.4],[9.9,.6],[8.9,6],[6.6,10.8],[3.8,14.6],[.2,17.6]];
  emit(mkLathe(HULL,10,'x',col),{p:[0,0,HUB],s:[1,1,.78]});
  // --- glass canopy: dark ellipsoid set into the top-front ---
  emit(mkSpheroid(6.4,4.6,3.6,GLASS,4,9),{p:[5.4,0,HUB+5.2],rx:.1});
  emit(mkSpheroid(4.9,3.7,2.9,[56,62,82],3,8),{p:[6.2,0,HUB+5.6],rx:.1}); // inner tint layer
  // --- dorsal stripe: long+wide so heading reads from above ---
  emit(mkBox(22,3.4,1.5,{top:WHITE,side:WHITE}),{p:[-1.5,0,HUB+9.0],ry:-.08});
  // --- swept twin fins: span-wide arrow planform (the top-down silhouette cue) ---
  for(const s of[-1,1]){
    emit(mkWedge(14,3.2,1.0,5.2,{top:lt,side:lt,bottom:dk}),{p:[-8.8,s*9.8,HUB+1.6],rz:s*.22,ry:.04});
    over3.push({kind:'dot3',wp:proj3([-9.2,s*13.8,HUB+2.2]),r:1.7,
      color:s<0?'rgba(255,90,90,.95)':'rgba(90,255,200,.95)',alpha:(s<0?o.blink:!o.blink)?0.12:.95,minD:-9});
  }
  // --- under-hover emitter ring (team-colored donut slice lying in xy) ---
  const RINGP=[[7.4,-.9],[9.8,0],[7.4,.9],[5.6,0]];
  emit(mkLathe(RINGP,14,'z',lt),{p:[0,0,HUB-9.2]});
  emit(mkLathe([[5.8,-.5],[7.4,0],[5.8,.5]],14,'z',DARK),{p:[0,0,HUB-9.2]}); // inner plate
  // --- rear thruster: nozzle cone + glowing throat ---
  emit(mkLathe([[2,0],[4.4,1.2],[5.2,3.6]],8,'x',DARK),{p:[-19.4,0,HUB]});
  emit(mkSpheroid(1.6,3.4,3.4,lt,3,7),{p:[-19.7,0,HUB]}); // glow throat
  // --- nose light: bright + oversized so "forward" reads from any angle ---
  emit(mkSpheroid(3.3,2.6,2.4,WHITE,3,7),{p:[16.2,0,HUB-.6]});
  // --- belly keel ---
  emit(mkWedge(13,1.9,3.2,1.2,{top:dk,side:dk,bottom:DARK}),{p:[-2,0,HUB-10.4]});

  // ===== overlay anchors (billboarded 2D details, projected by the sink) =====
  const bodyC=proj3([0,0,HUB]);
  over3.push({kind:'dot3',wp:proj3([9.2,-1.6,HUB+8]),r:1.5,color:'rgba(255,255,255,.6)',minD:.3,ref:bodyC}); // canopy glint
  if(o.ring)over3.push({kind:'ring3',wp:proj3([0,0,HUB-1]),r:19,color:'rgba(255,255,255,.75)'});
  return{faces3,over3,g,bob,anchor:A,bodyC,flame:o,thruster:proj3([-21,0,HUB]),hub:HUB};
}

const depthOf=(pts,vw)=>{let d=0;for(const p of pts)d+=p[0]*vw[0]+p[1]*vw[1]+p[2]*vw[2];return d/pts.length;};

/** Oblique (classic 2.5D) build: faces in screen coords + flat overlays. */
export function buildRider3D(o){
  const geo=buildRiderGeo3D(o);
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
  for(const q of geo.over3){
    if(q.kind==='dot3'){
      if(q.alpha!=null&&q.alpha<.5)continue;
      const d=q.ref?((q.wp[0]-q.ref[0])*VIEW[0]+(q.wp[1]-q.ref[1])*VIEW[1]+(q.wp[2]-q.ref[2])*VIEW[2]):9;
      if(d<q.minD)continue;
      const[x,y]=to2(q.wp);over.push({kind:'dot',x,y,r:q.r,color:q.color});
    }else if(q.kind==='ring3'){
      const[x,y]=to2(q.wp);over.push({kind:'ring',x,y,rx:q.r*.85,ry:q.r,color:q.color});
    }
  }
  return{faces,over,g:geo.g,bob:geo.bob,gy:o.y+10+geo.bob*.5,geo};
}

/** Full oblique render: blob shadow, thruster flame, shaded faces, details. */
export function drawRider3D(ctx,o){
  const{faces,over,g,bob,gy,geo}=buildRider3D(o);
  const a0=ctx.globalAlpha;
  // blob shadow under the pod
  ctx.fillStyle='rgba(20,20,40,.3)';ctx.beginPath();ctx.ellipse(o.x,gy+3-bob*.5,17*g,5.6,0,0,Math.PI*2);ctx.fill();
  // thruster flame at the rear nozzle
  const thr=[geo.thruster[0],geo.thruster[1]-geo.thruster[2]];
  const fl=5+Math.sin(o.time*30+o.id)*1.6+rnd(0,1.6);
  ctx.globalAlpha=a0*.55;ctx.fillStyle=o.color;ctx.beginPath();ctx.ellipse(thr[0],thr[1],fl+2,fl*.6,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=a0*.5;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(thr[0],thr[1],fl*.45,fl*.28,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=a0;
  for(const f of faces){if(f.alpha!==1)ctx.globalAlpha=a0*f.alpha;ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(f.pts[0][0],f.pts[0][1]);
    for(let i=1;i<f.pts.length;i++)ctx.lineTo(f.pts[i][0],f.pts[i][1]);ctx.closePath();ctx.fill();if(f.alpha!==1)ctx.globalAlpha=a0;}
  for(const q of over){
    if(q.kind==='dot'){ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();}
    else if(q.kind==='ring'){ctx.strokeStyle=q.color;ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(q.x,q.y,q.rx,q.ry,0,0,Math.PI*2);ctx.stroke();}
  }
}
