// engine/engine.js — Engine (fixed-ish timestep loop) + Renderer2D (camera/world passes)
export class Renderer2D{
  constructor(canvas,bg='#05050f'){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.bg=bg;
    this.cw=0;this.ch=0;this.scale=1;
    addEventListener('resize',()=>this.resize());this.resize();
  }
  resize(){this.cw=this.canvas.width=innerWidth;this.ch=this.canvas.height=innerHeight;
    this.scale=this.cw<620?0.82:(this.cw<1000?0.95:1.08);}
  begin(){const ctx=this.ctx;ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=this.bg;ctx.fillRect(0,0,this.cw,this.ch);}
  /** enter world space (camera + shake) */
  world(cam,shakeOn=true){
    const ctx=this.ctx;const [sx,sy]=shakeOn?cam.shakeOffset():[0,0];
    ctx.save();ctx.translate(this.cw/2+sx,this.ch/2+sy);ctx.scale(this.scale,this.scale);ctx.translate(-cam.x,-cam.y);
  }
  screen(){this.ctx.restore();}
}
export class Engine{
  /** True fixed-timestep sim at `stepHz` (frame-rate independent physics).
   *  onUpdate(STEP) runs 0..N times per frame; onRender() runs every frame. */
  constructor(stepHz=60){this._last=performance.now();this._acc=0;this.step=1/stepHz;this.onUpdate=null;this.onRender=null;}
  start(){
    const loop=now=>{requestAnimationFrame(loop);
      const dt=Math.min(.25,(now-this._last)/1000);this._last=now;
      this._acc+=dt;let steps=0;
      while(this._acc>=this.step&&steps<5){if(this.onUpdate)this.onUpdate(this.step);this._acc-=this.step;steps++;}
      if(this._acc>=this.step)this._acc=0; // shed backlog after a hitch (no spiral of death)
      if(this.onRender)this.onRender();};
    requestAnimationFrame(loop);
  }
}
