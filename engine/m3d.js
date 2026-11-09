// engine/m3d.js — minimal 3D math + perspective Camera3D for painter-rendered scenes.
// World is z-up (matches top-down games: x/y = ground plane, z = height).
// Camera exposes smooth follow with three flavors: orbitable 'follow', eye-level 'fps',
// and you can park it anywhere by setting pos/yaw/pitch directly (cutscenes etc).
import{clamp}from'./math.js';

const wrapPi=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};

export class Camera3D{
  constructor(){
    this.pos=[0,0,180];this.yaw=0;this.pitch=-.7;
    this.near=5;this.focalPx=0;      // 0 → auto from screen height (~55° fov)
    // follow/orbit targets (lerped toward)
    this.tYaw=0;this.tPitch=-1.12;this.tDist=380;this.tFocus=[0,0,0];
    this.mode='follow';              // 'follow' | 'fps' | 'fixed'
    this._fwd=[1,0,0];this._right=[0,1,0];this._up=[0,0,1];
    this.w=1280;this.h=800;
  }
  /** orbit controls (drag): dyaw/dpitch; zoom(d) changes follow distance */
  orbit(dyaw,dpitch){this.tYaw=wrapPi(this.tYaw+dyaw);this.tPitch=clamp(this.tPitch+dpitch,-1.32,-.12);}
  zoom(d){this.tDist=clamp(this.tDist+d,160,900);}
  basis(){
    const cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch);
    this._fwd=[cp*cy,cp*sy,sp];                    // forward (pitch<0 looks down)
    this._right=[-sy,cy,0];                        // screen right
    this._up=[                                  // screen up = fwd × right
      this._fwd[1]*0-this._fwd[2]*cy,
      this._fwd[2]*(-sy)-this._fwd[0]*0,
      this._fwd[0]*cy-this._fwd[1]*(-sy)];
    // normalize _up defensively (should already be unit)
    const l=Math.hypot(...this._up)||1;this._up=this._up.map(v=>v/l);
  }
  /** focus: {x,y,z,yaw} — called each frame by the game's update loop */
  update(dt,focus,w,h){
    this.w=w;this.h=h;
    const k=1-Math.exp(-dt*7);
    if(this.mode==='fps'){
      this.tYaw=focus.yaw;
      const fk=Math.min(1,dt*30),lk=1-Math.exp(-dt*14);
      this.pos[0]+=(focus.x-this.pos[0])*lk;this.pos[1]+=(focus.y-this.pos[1])*lk;this.pos[2]+=((focus.z+34)-this.pos[2])*lk;
      this.yaw+=wrapPi(this.tYaw-this.yaw)*fk;
      this.pitch+=(-.10-this.pitch)*fk;
    }else if(this.mode==='follow'){
      this.yaw+=wrapPi(this.tYaw-this.yaw)*k;this.pitch+=(this.tPitch-this.pitch)*k;
      const d=this.tDist,cp=Math.cos(this.pitch),sp=Math.sin(this.pitch);
      const tx=focus.x-cp*Math.cos(this.yaw)*d,ty=focus.y-cp*Math.sin(this.yaw)*d,tz=focus.z-sp*d;
      this.pos[0]+=(tx-this.pos[0])*k;this.pos[1]+=(ty-this.pos[1])*k;this.pos[2]+=(tz-this.pos[2])*k;
    }
    this.basis();
  }
  toCam(v){
    const rx=v[0]-this.pos[0],ry=v[1]-this.pos[1],rz=v[2]-this.pos[2];
    return[rx*this._right[0]+ry*this._right[1]+rz*this._right[2],
           rx*this._up[0]+ry*this._up[1]+rz*this._up[2],
           rx*this._fwd[0]+ry*this._fwd[1]+rz*this._fwd[2]];
  }
  projectCam(c){
    if(c[2]<this.near)return null;
    const f=this.focalPx||this.h*.9;
    return{x:this.w/2+c[0]*f/c[2], y:this.h/2-c[1]*f/c[2], d:c[2], s:f/c[2]};
  }
  project(v){const c=this.toCam(v);return this.projectCam(c);}
  /** clip a cam-space polygon against the near plane; returns [] if fully behind */
  clipNear(poly){
    const n=this.near,out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      const ain=a[2]>=n,bin=b[2]>=n;
      if(ain)out.push(a);
      if(ain!==bin){
        const t=(n-a[2])/(b[2]-a[2]);
        out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,n]);
      }
    }
    return out;
  }
  /** project a world-space polygon → {pts:[[x,y]..], depth} or null if culled.
   *  depth is measured over the NEAR-CLIPPED polygon (average cam-space z),
   *  so geometry crossing the camera plane sorts sanely in a painter bucket. */
  projectPoly(poly,maxDist=1e9){
    let depth=0;
    const cam=new Array(poly.length);
    for(let i=0;i<poly.length;i++){const c=this.toCam(poly[i]);depth+=c[2];cam[i]=c;}
    depth/=poly.length;
    if(depth<-this.near*8||depth>maxDist)return null;
    const clipped=this.clipNear(cam);
    if(clipped.length<3)return null;
    const pts=[];let cd=0;
    for(const c of clipped){const p=this.projectCam(c);if(!p)return null;pts.push([p.x,p.y]);cd+=c[2];}
    return{pts,depth:cd/clipped.length};
  }
}
