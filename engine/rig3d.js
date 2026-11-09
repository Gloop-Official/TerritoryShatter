// engine/rig3d.js — software 3D character rig for the canvas 2D pipeline.
// Real geometry (spheroids, boxes, cylinders), lambert shading, backface culling,
// painter's-algorithm depth sort — rebuilt from scratch every frame. No textures, no PNGs.
//
// drawChibi3D(ctx, o) — same options object as rig.js plus:
//   ref  persistent per-actor object (e.g. the player record) for smoothed yaw/bank
// buildChibi3D(o) returns {faces:[{pts,color,depth}], over:[...2D overlays...]} for
// tooling/testing without a canvas.
//
// Local space: +x = actor forward, +y = actor's left, +z = up.
// Projection matches the world's fake-iso blocks: screen = worldXY, z lifts straight up.
import{rnd,clamp}from'./math.js';

const norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l];};
const VIEW=norm([0.3,0.72,0.9]); // camera sits south-east and above (matches block side faces)
const LIGHT=norm([0.3,0.42,0.86]); // mostly overhead, slightly south-east — matches bright tops / dark sides

const parse=c=>{if(c[0]==='#'){const n=parseInt(c.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
  const m=c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?[+m[1],+m[2],+m[3]]:[255,0,255];};
const css=(c,f)=>`rgb(${clamp(c[0]*f,0,255)|0},${clamp(c[1]*f,0,255)|0},${clamp(c[2]*f,0,255)|0})`;

// ===== mesh templates (unit-space, built once) =====
function mkBox(sx,sy,sz,colors){ // colors: {top,bottom,side,front}
  const x=sx/2,y=sy/2,z=sz/2;
  const v=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];
  return{v,f:[[4,5,6,7,colors.top],[1,0,3,2, colors.bottom||colors.side],
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
function mkCylinder(r,len,color,sides=5){ // axis +z, base at 0
  const v=[],f=[];
  for(const z of[0,len])for(let i=0;i<sides;i++){const ph=i*2*Math.PI/sides;v.push([r*Math.cos(ph),r*Math.sin(ph),z]);}
  for(let i=0;i<sides;i++){const j=(i+1)%sides;f.push([i,j,sides+j,sides+i,color]);}
  return{v,f};
}

// ===== 3x3 transforms =====
const rotX=a=>{const c=Math.cos(a),s=Math.sin(a);return[1,0,0, 0,c,-s, 0,s,c];};
const rotY=a=>{const c=Math.cos(a),s=Math.sin(a);return[c,0,s, 0,1,0, -s,0,c];};
const rotZ=a=>{const c=Math.cos(a),s=Math.sin(a);return[c,-s,0, s,c,0, 0,0,1];};
const mulM=(a,b)=>{const o=new Array(9);for(let r=0;r<3;r++)for(let c=0;c<3;c++)o[r*3+c]=a[r*3]*b[c]+a[r*3+1]*b[3+c]+a[r*3+2]*b[6+c];return o;};
const appM=(m,v)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
const newell=p=>{const n=[0,0,0];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];
  n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}return norm(n);};

/**
 * Build the chibi hoverboarder as shaded 3D faces + 2D overlays.
 * o: {x,y,pulse,dx,dy,blink,stim,id,color,dk,lt,ring,time,ref?}
 */
export function buildChibi3D(o){
  // smoothed facing + turn banking (per-actor state lives on ref, like _hr/_tg precedent)
  const st=o.ref?(o.ref._rig=o.ref._rig||{yaw:Math.atan2(o.dy,o.dx),bank:0}):{yaw:Math.atan2(o.dy,o.dx),bank:0};
  const yaw=Math.atan2(o.dy,o.dx);
  let dYaw=yaw-st.yaw;while(dYaw>Math.PI)dYaw-=2*Math.PI;while(dYaw<-Math.PI)dYaw+=2*Math.PI;
  st.yaw=yaw;st.bank=clamp(st.bank*.88+dYaw*6,-1,1);

  const bob=Math.sin(o.pulse*1.4);
  const sq=1+bob*.06,g=o.stim?1.08:1;
  const pitch=.16+Math.sin(o.pulse*.7)*.05;   // gentle nose-down lean while riding
  const roll=st.bank*.32;                      // bank into turns
  const M=mulM(rotZ(yaw),mulM(rotY(-pitch),rotX(roll))); // char local->world

  const col=parse(o.color),dk=parse(o.dk),lt=parse(o.lt);
  const faces=[],over=[];
  const gy=o.y+10+bob*.5;                       // ground anchor (matches legacy 2D rig)
  const emit=(mesh,t)=>{ // t: {p:[x,y,z], rx,ry,rz, s:[sx,sy,sz]}
    const R=t.rx||t.ry||t.rz?mulM(rotZ(t.rz||0),mulM(rotY(t.ry||0),rotX(t.rx||0))):null;
    for(const f of mesh.f){
      const pts=[];
      for(let i=0;i<f.length-1;i++){
        let v=mesh.v[f[i]];
        v=[v[0]*(t.s?t.s[0]:1),v[1]*(t.s?t.s[1]:1),v[2]*(t.s?t.s[2]:1)];
        if(R)v=appM(R,v);
        v=[v[0]+t.p[0],v[1]+t.p[1],v[2]+t.p[2]];
        v=[v[0]*g*sq,v[1]*g*sq,v[2]*g/sq];      // squash & stretch in local space
        v=appM(M,v);                             // yaw/pitch/roll into world
        pts.push(v);
      }
      const n=newell(pts),facing=n[0]*VIEW[0]+n[1]*VIEW[1]+n[2]*VIEW[2];
      if(facing<=0.02)continue;                  // backface
      let depth=0;const scr=[];
      for(const v of pts){depth+=v[0]*VIEW[0]+v[1]*VIEW[1]+v[2]*VIEW[2];scr.push([o.x+v[0],gy+v[1]-v[2]]);}
      const lite=.62+.38*Math.max(0,n[0]*LIGHT[0]+n[1]*LIGHT[1]+n[2]*LIGHT[2]);
      faces.push({pts:scr,color:css(f[4],lite),depth:depth/pts.length});
    }
  };

  const kick=Math.sin(o.pulse*2.6)*1.8, sway=Math.sin(o.pulse*1.4+1.2)*1.6;
  // hoverboard (dark hull, lit top, team-color glow trim)
  emit(mkBox(34,11,4.2,{top:[58,64,80],bottom:[26,29,38],side:[35,38,47]}),{p:[0,0,9]});
  emit(mkBox(26,11.9,1.4,{top:lt,bottom:lt,side:lt}),{p:[0,0,7.2]});
  // feet (paddling)
  emit(mkBox(7,5.5,3.4,{top:[70,76,92],side:[38,42,53],bottom:[38,42,53]}),{p:[kick*.3,4.9,12.4+bob*.2]});
  emit(mkBox(7,5.5,3.4,{top:[70,76,92],side:[38,42,53],bottom:[38,42,53]}),{p:[-kick*.3,-4.9,12.4-bob*.2]});
  // arms (sway opposite the bob, tilted out)
  emit(mkSpheroid(3.2,3,5.2,dk,3,6),{p:[-.5,10.4,25+sway],rx:.16});
  emit(mkSpheroid(3.2,3,5.2,dk,3,6),{p:[-.5,-10.4,25-sway],rx:-.16});
  // bean body: dark outline shell + colored core + belly patch
  emit(mkSpheroid(10.4,9.4,12.9,[22,24,31],5,10),{p:[0,0,27]});
  emit(mkSpheroid(9.6,8.6,12,lt,5,10),{p:[0,0,27]});
  emit(mkSpheroid(4.1,5.8,6.8,[255,255,255],4,8),{p:[7.3,0,23.4]});
  // eye whites (pupils are 2D overlays so they stay crisp)
  emit(mkSpheroid(3.5,3.3,4.1,[255,255,255],4,8),{p:[8.3,4.4,30.2]});
  emit(mkSpheroid(3.5,3.3,4.1,[255,255,255],4,8),{p:[8.3,-4.4,30.2]});
  // antenna with laggy wobble
  const wob=(.16)*1.6+Math.sin(o.pulse*1.1)*.12;
  const aBase=[1.2,0,38.2],aR=[0,-wob,0];
  emit(mkCylinder(.95,7.5,[22,24,31]),{p:aBase,ry:aR[1]});
  const tipOff=[Math.sin(wob)*7.5,0,Math.cos(wob)*7.5];
  emit(mkSpheroid(3,3,3,dk,3,6),{p:[aBase[0]+tipOff[0],aBase[1]+tipOff[1],aBase[2]+tipOff[2]]});

  faces.sort((a,b)=>a.depth-b.depth);

  // project anchor points for 2D detail overlays
  const proj=v=>{let p=[v[0]*g*sq,v[1]*g*sq,v[2]*g/sq];p=appM(M,p);return{x:o.x+p[0],y:gy+p[1]-p[2],depth:p[0]*VIEW[0]+p[1]*VIEW[1]+p[2]*VIEW[2]};};
  const bodyC=proj([0,0,27]);
  for(const s of[-1,1]){
    const e=proj([8.3,s*4.4,30.2]);
    if(e.depth>bodyC.depth+1.6){ // eye hemisphere turned toward camera
      if(o.blink){const side=[-Math.sin(yaw),Math.cos(yaw)];
        over.push({kind:'line',x1:e.x-side[0]*2.6,y1:e.y-side[1]*2.6,x2:e.x+side[0]*2.6,y2:e.y+side[1]*2.6,color:'#16181f',w:1.5});
      }else{
        over.push({kind:'dot',x:e.x+o.dx*1.3,y:e.y+o.dy*1.3,r:1.7,color:'#16181f'});
        over.push({kind:'dot',x:e.x+o.dx*1.3+.6,y:e.y+o.dy*1.3-1,r:.55,color:'#fff'});
      }
    }
    const c=proj([4.6,s*7.4,25.8]);
    if(c.depth>bodyC.depth+0.8)over.push({kind:'dot',x:c.x,y:c.y,r:1.9,color:'rgba(255,110,150,.45)'});
  }
  const at=proj([aBase[0]+tipOff[0],tipOff[1]+aBase[1],aBase[2]+tipOff[2]]);
  over.push({kind:'dot',x:at.x-.7,y:at.y-.9,r:.8,color:'rgba(255,255,255,.8)'});
  if(o.ring)over.push({kind:'ring',x:bodyC.x,y:bodyC.y,rx:12.4,ry:14.8,color:'rgba(255,255,255,.75)'});
  return{faces,over,g,bob,gy};
}

/** Render the chibi (blob shadow + thruster flame + shaded 3D geometry + details). */
export function drawChibi3D(ctx,o){
  const{faces,over,g,bob,gy}=buildChibi3D(o);
  const a0=ctx.globalAlpha;
  // blob shadow (grounded)
  ctx.fillStyle='rgba(20,20,40,.3)';ctx.beginPath();ctx.ellipse(o.x,gy+2.5-bob*.5,13*g,5,0,0,Math.PI*2);ctx.fill();
  // thruster flame (flickers every frame)
  const fl=5+Math.sin(o.time*30+o.id)*1.6+rnd(0,1.6);
  ctx.globalAlpha=a0*.55;ctx.fillStyle=o.color;ctx.beginPath();ctx.ellipse(o.x,gy+3,fl+2,fl*.6,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=a0*.5;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(o.x,gy+3,fl*.45,fl*.28,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=a0;
  // shaded 3D faces
  for(const f of faces){ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(f.pts[0][0],f.pts[0][1]);
    for(let i=1;i<f.pts.length;i++)ctx.lineTo(f.pts[i][0],f.pts[i][1]);ctx.closePath();ctx.fill();}
  // 2D overlays (pupils, cheeks, blink lids, antenna glint, player ring)
  for(const q of over){
    if(q.kind==='dot'){ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();}
    else if(q.kind==='line'){ctx.strokeStyle=q.color;ctx.lineWidth=q.w;ctx.beginPath();ctx.moveTo(q.x1,q.y1);ctx.lineTo(q.x2,q.y2);ctx.stroke();}
    else if(q.kind==='ring'){ctx.strokeStyle=q.color;ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(q.x,q.y,q.rx,q.ry,0,0,Math.PI*2);ctx.stroke();}
  }
}
