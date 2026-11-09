// engine/fx.js — pooled particle bursts (voronoi shards) + elastic ripples
import{rnd}from'./math.js';

export class FXPool{
  constructor(){this.particles=[];this.ripples=[];this.quality=1;}
  burst(wx,wy,color,n,pow=180){
    n=Math.max(1,Math.ceil(n*this.quality));
    for(let i=0;i<n;i++){
      const a=rnd(0,Math.PI*2),s=rnd(pow*.3,pow);
      this.particles.push({x:wx,y:wy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,life:rnd(.5,1.3),t:0,color,size:rnd(3,9),rot:rnd(0,6),vr:rnd(-6,6)});
    }
  }
  ripple(wx,wy,color,max=140){this.ripples.push({x:wx,y:wy,t:0,color,max});}
  update(dt,gravity=620){
    for(let i=this.particles.length-1;i>=0;i--){const q=this.particles[i];q.t+=dt;
      if(q.t>q.life){this.particles.splice(i,1);continue;}
      q.vy+=gravity*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.rot+=q.vr*dt;}
    for(let i=this.ripples.length-1;i>=0;i--){this.ripples[i].t+=dt;if(this.ripples[i].t>1)this.ripples.splice(i,1);}
  }
  draw(ctx){
    for(const r of this.ripples){
      const e=1-Math.pow(1-r.t,3);const rad=r.max*(e+Math.sin(r.t*Math.PI*3)*.06*(1-r.t));
      ctx.globalAlpha=(1-r.t)*.8;ctx.strokeStyle=r.color;ctx.lineWidth=3*(1-r.t)+1;ctx.shadowColor=r.color;ctx.shadowBlur=10;
      ctx.beginPath();ctx.arc(r.x,r.y,Math.max(1,rad),0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;
    }
    for(const q of this.particles){
      ctx.save();ctx.globalAlpha=1-q.t/q.life;ctx.translate(q.x,q.y);ctx.rotate(q.rot);
      ctx.fillStyle=q.color;ctx.shadowColor=q.color;ctx.shadowBlur=6;
      ctx.beginPath();ctx.moveTo(0,-q.size);ctx.lineTo(q.size,q.size*.7);ctx.lineTo(-q.size,q.size*.7);ctx.closePath();ctx.fill();
      ctx.restore();
    }
  }
  clear(){this.particles.length=0;this.ripples.length=0;}
}
