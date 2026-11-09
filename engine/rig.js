// engine/rig.js — fully procedural animated chibi hoverboard actor (no sprites)
// drawChibi(ctx, o):
//   x,y            world anchor (board center)
//   pulse          animation phase clock (seconds*4)
//   dx,dy          facing/intent (pupils, lean, antenna lag)
//   blink          0|1 — eyes closed this frame
//   stim           0|1 — slightly bigger + more flame
//   id             per-actor flicker offset
//   color,dk,lt    base/dark/light costume colors
//   ring           0|1 — white outline ring (highlight the local player)
//   time           global elapsed seconds (flame flicker)
import{rnd}from'./math.js';

function rr(ctx,x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);}

export function drawChibi(ctx,o){
  const bob=Math.sin(o.pulse*1.4),lean=o.dx*.2+Math.sin(o.pulse*.7)*.05;
  const sq=1+bob*.06,g=o.stim?1.08:1,a0=ctx.globalAlpha;
  ctx.save();ctx.translate(o.x,o.y+10+bob*.5);
  // blob shadow (grounded)
  ctx.fillStyle='rgba(20,20,40,.3)';ctx.beginPath();ctx.ellipse(0,2.5-bob*.5,13*g,5,0,0,Math.PI*2);ctx.fill();
  ctx.rotate(lean);ctx.scale(g*sq,g/sq);
  // thruster flame (flickers every frame)
  const fl=5+Math.sin(o.time*30+o.id)*1.6+rnd(0,1.6);
  ctx.globalAlpha=a0*.55;ctx.fillStyle=o.color;ctx.beginPath();ctx.ellipse(0,4.5,fl+2,fl*.6,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=a0*.5;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(0,4.5,fl*.45,fl*.28,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=a0;
  // hoverboard
  ctx.fillStyle='#23262f';rr(ctx,-17,-3,34,10,5);ctx.fill();
  ctx.fillStyle='#3a4050';rr(ctx,-17,-3,34,5,4);ctx.fill();
  ctx.fillStyle=o.lt;rr(ctx,-13,.5,26,2,1);ctx.fill();
  // paddling feet
  const kick=Math.sin(o.pulse*2.6)*1.8;
  ctx.fillStyle='#262a35';rr(ctx,-10+kick*.25,-8,7,8,2.5);ctx.fill();rr(ctx,3-kick*.25,-8,7,8,2.5);ctx.fill();
  // rear arm
  const sway=Math.sin(o.pulse*1.4+1.2)*1.6;
  ctx.fillStyle=o.dk;ctx.beginPath();ctx.ellipse(-11,-16+sway,3.4,5,-.15,0,Math.PI*2);ctx.fill();
  // bean body (squash-stretch) with dark outline
  ctx.fillStyle='#16181f';ctx.beginPath();ctx.ellipse(0,-21,11,13.4,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=o.lt;ctx.beginPath();ctx.ellipse(0,-21,9.6,12,0,0,Math.PI*2);ctx.fill();
  // belly patch
  ctx.fillStyle='rgba(255,255,255,.92)';ctx.beginPath();ctx.ellipse(0,-16.5,5.6,6.6,0,0,Math.PI*2);ctx.fill();
  // front arm
  ctx.fillStyle=o.dk;ctx.beginPath();ctx.ellipse(10.4,-15-sway,3.4,5,.15,0,Math.PI*2);ctx.fill();
  // eyes: pupils track intent, blink supported
  for(const s of[-1,1]){const ex=s*4.4;
    if(o.blink){ctx.strokeStyle='#16181f';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(ex-2.6,-24.5);ctx.lineTo(ex+2.6,-24.5);ctx.stroke();}
    else{ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(ex,-25,3.1,3.9,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#16181f';ctx.beginPath();ctx.arc(ex+o.dx*1.3,-25+o.dy*1.3,1.7,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+o.dx*1.3+.6,-26+o.dy*1.3,.55,0,Math.PI*2);ctx.fill();}}
  // cheeks
  ctx.fillStyle='rgba(255,110,150,.45)';
  ctx.beginPath();ctx.ellipse(-7.6,-20.4,2.1,1.4,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(7.6,-20.4,2.1,1.4,0,0,Math.PI*2);ctx.fill();
  // antenna with laggy spring wobble
  const wob=lean*1.6+Math.sin(o.pulse*1.1)*.12,ax=Math.sin(wob)*4;
  ctx.strokeStyle='#16181f';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(0,-32.5);ctx.quadraticCurveTo(ax*.4,-36.5,ax,-39.5);ctx.stroke();
  ctx.fillStyle=o.dk;ctx.beginPath();ctx.arc(ax,-41,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.arc(ax-.9,-42,.9,0,Math.PI*2);ctx.fill();
  // highlight ring
  if(o.ring){ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(0,-21,12.4,14.8,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
