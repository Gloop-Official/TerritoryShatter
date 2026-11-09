// engine/camera.js — 2D camera with smooth follow + trauma-based screen shake
import{rnd}from'./math.js';

export class Camera2D{
  constructor(){this.x=0;this.y=0;this.trauma=0;}
  addShake(v){this.trauma=Math.max(this.trauma,v);}
  update(dt){this.trauma=Math.max(0,this.trauma-dt*34);}
  snap(tx,ty){this.x=tx;this.y=ty;}
  follow(tx,ty,dt,rate=6){this.x+=(tx-this.x)*Math.min(1,dt*rate);this.y+=(ty-this.y)*Math.min(1,dt*rate);}
  drift(tx,ty,k){this.x+=(tx-this.x)*k;this.y+=(ty-this.y)*k;}
  shakeOffset(){
    const s=this.trauma;
    return s?[rnd(-s,s),rnd(-s,s)]:[0,0];
  }
}
