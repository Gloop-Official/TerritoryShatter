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
  constructor(){this._last=performance.now();this.onUpdate=null;this.onRender=null;}
  start(){
    const loop=now=>{requestAnimationFrame(loop);
      const dt=Math.min(.033,(now-this._last)/1000);this._last=now;
      if(this.onUpdate)this.onUpdate(dt);
      if(this.onRender)this.onRender();};
    requestAnimationFrame(loop);
  }
}
