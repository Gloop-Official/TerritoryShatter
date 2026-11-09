// game/render.js — frame composition: floor, turf blocks, trails, actors, minimap
import{G}from'./ctx.js';
import{W,H,CELL,idx,inB}from'./config.js';
import{clamp}from'../engine/math.js';
import{SaveData}from'./save.js';
import{drawChibi3D as drawChibi}from'../engine/rig3d.js';
import{renderGame3D,renderScan3D}from'./render3d.js';

let floorPat=null;

export function renderGame(){
  const cm=SaveData.data.settings.cam;
  if(cm&&cm!=='iso'&&G.cam3){renderGame3D();renderScan3D();renderOverlay2D();return;}
  renderGameIso();
}

function renderGameIso(){
  const R=G.renderer,ctx=R.ctx,cam=G.cam,world=G.world,mode=G.mode;
  const CW=R.cw,CH=R.ch,scale=R.scale,elapsed=mode.elapsed;
  R.begin();
  R.world(cam,SaveData.data.settings.shake);
  const grid=world.grid;
  const x0=Math.max(0,Math.floor((cam.x-CW/2/scale)/CELL)-1),x1=Math.min(W-1,Math.ceil((cam.x+CW/2/scale)/CELL)+1);
  const y0=Math.max(0,Math.floor((cam.y-CH/2/scale)/CELL)-1),y1=Math.min(H-1,Math.ceil((cam.y+CH/2/scale)/CELL)+1);
  // arena floor texture + outer shading
  const floorImg=G.assets.get('floor');
  if(floorImg){if(!floorPat)floorPat=ctx.createPattern(floorImg,'repeat');
    if(floorPat){ctx.fillStyle=floorPat;ctx.fillRect(0,0,W*CELL,H*CELL);}}
  ctx.strokeStyle='rgba(70,55,130,.5)';ctx.lineWidth=20;ctx.strokeRect(-10,-10,W*CELL+20,H*CELL+20);
  ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=2;ctx.strokeRect(1,1,W*CELL-2,H*CELL-2);
  // empty dots
  ctx.fillStyle='rgba(255,255,255,.3)';
  const tileImg=G.assets.get('tile');
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(grid[idx(x,y)]===0)ctx.fillRect(x*CELL+CELL/2-1,y*CELL+CELL/2-1,2,2);
  // owned cells — bright rounded candy tops
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const o=grid[idx(x,y)];if(!o)continue;const p=world.players[o-1];if(!p)continue;
    ctx.globalAlpha=.8;ctx.fillStyle=p.color;ctx.fillRect(x*CELL,y*CELL,CELL,CELL);ctx.globalAlpha=1;
    if(tileImg)ctx.drawImage(tileImg,x*CELL,y*CELL,CELL,CELL);}
  // extruded side faces — fake-isometric height on exposed edges
  const SIDE=7;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const o=grid[idx(x,y)];if(!o)continue;const p=world.players[o-1];if(!p)continue;
    const xx=x*CELL,yy=y*CELL;
    const sExp=!inB(x,y+1)||grid[idx(x,y+1)]!==o,eExp=!inB(x+1,y)||grid[idx(x+1,y)]!==o;
    if(sExp){ctx.fillStyle=p.colDark;ctx.fillRect(xx,yy+CELL,CELL,SIDE);
      ctx.globalAlpha=.5;ctx.fillStyle=p.colLight;ctx.fillRect(xx,yy+CELL,CELL,2);ctx.globalAlpha=1;}
    if(eExp){ctx.fillStyle=p.colDark;ctx.fillRect(xx+CELL,yy,SIDE,CELL+(sExp?SIDE:0));}
  }
  // border walls — dark bevel base + crisp team-color edge
  const pulse=.7+.3*Math.sin(elapsed*Math.PI*2.2);
  ctx.lineCap='round';
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const o=grid[idx(x,y)];if(!o)continue;const p=world.players[o-1];if(!p)continue;
    ctx.beginPath();let any=false;
    if(!inB(x,y-1)||grid[idx(x,y-1)]!==o){ctx.moveTo(x*CELL,y*CELL);ctx.lineTo(x*CELL+CELL,y*CELL);any=true;}
    if(!inB(x,y+1)||grid[idx(x,y+1)]!==o){ctx.moveTo(x*CELL,y*CELL+CELL);ctx.lineTo(x*CELL+CELL,y*CELL+CELL);any=true;}
    if(!inB(x-1,y)||grid[idx(x-1,y)]!==o){ctx.moveTo(x*CELL,y*CELL);ctx.lineTo(x*CELL,y*CELL+CELL);any=true;}
    if(!inB(x+1,y)||grid[idx(x+1,y)]!==o){ctx.moveTo(x*CELL+CELL,y*CELL);ctx.lineTo(x*CELL+CELL,y*CELL+CELL);any=true;}
    if(any){
      ctx.strokeStyle='rgba(0,0,0,.75)';ctx.lineWidth=(p.isPlayer?3.2:2.2)+3;ctx.globalAlpha=.8;ctx.stroke();
      ctx.strokeStyle=p.color;ctx.lineWidth=p.isPlayer?2.6:1.6;
      ctx.globalAlpha=p.isPlayer?.7+.3*pulse:.85;ctx.stroke();
      ctx.globalAlpha=1;}}
  // trails (glow pass + hot white core)
  for(const p of world.players){if(!p.alive||p.trail.length===0)continue;
    ctx.strokeStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=14;ctx.lineWidth=5+2*Math.sin(p.pulse);
    ctx.globalAlpha=p.veilT>0?.28:(p.phaseT>0?.55:.95);
    if(p.phaseT>0)ctx.setLineDash([8,6]);
    ctx.beginPath();const f=p.trail[0];ctx.moveTo((f%W+.5)*CELL,(((f/W)|0)+.5)*CELL);
    for(const c of p.trail)ctx.lineTo((c%W+.5)*CELL,(((c/W)|0)+.5)*CELL);
    ctx.lineTo(p.x*CELL,p.y*CELL);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.8)';ctx.shadowBlur=0;ctx.lineWidth=1.8;ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;}
  // shards — crystal sprites with shadow & bob
  const shardGold=G.assets.get('shardGold'),shardCyan=G.assets.get('shardCyan');
  for(const s of world.shards){const wx=s.x*CELL,wy=s.y*CELL+Math.sin(elapsed*4+s.rot)*3;const col=s.big?'#ffd600':'#00f5ff';
    const sImg=s.big?shardGold:shardCyan;
    ctx.globalAlpha=.3;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(wx+2,s.y*CELL+7,7,4,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    if(sImg){ctx.save();ctx.translate(wx,wy);ctx.rotate(Math.sin(s.rot+elapsed*2)*.18);ctx.shadowColor=col;ctx.shadowBlur=14;
      const r=s.big?30:22;ctx.drawImage(sImg,-r/2,-r/2,r,r);ctx.restore();}
    else{ctx.save();ctx.translate(wx,wy);ctx.rotate(s.rot);ctx.shadowColor=col;ctx.shadowBlur=16;ctx.fillStyle=col;
      const r=s.big?11:8;ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.7,0);ctx.lineTo(0,r);ctx.lineTo(-r*.7,0);ctx.closePath();ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle='#fff';const r2=r*.38;ctx.beginPath();ctx.moveTo(0,-r2);ctx.lineTo(r2*.7,0);ctx.lineTo(0,r2);ctx.lineTo(-r2*.7,0);ctx.closePath();ctx.fill();ctx.restore();}}
  // fx (ripples + particles)
  G.fx.draw(ctx);
  // actors — procedural animated chibi hoverboarders
  for(const p of world.players){if(!p.alive)continue;const wx=p.x*CELL,wy=p.y*CELL;
    ctx.globalAlpha=p.phaseT>0?.45:1;
    drawChibi(ctx,{x:wx,y:wy,pulse:p.pulse,dx:p.dx,dy:p.dy,blink:p.blinkT<0.13,stim:p.stimT>0,id:p.id,
      color:p.color,dk:p.colDark,lt:p.colLight,ring:p.isPlayer,time:elapsed,ref:p});
    ctx.globalAlpha=1;
    if(p.surgeT>0){ctx.globalAlpha=.3+.15*Math.sin(elapsed*6);ctx.strokeStyle='#ffd600';ctx.lineWidth=2;ctx.beginPath();ctx.arc(wx,wy,22+4*Math.sin(elapsed*6),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    // name
    ctx.font='bold 11px sans-serif';ctx.textAlign='center';const tw=ctx.measureText(p.name).width;
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(wx-tw/2-5,wy-64,tw+10,15);
    ctx.fillStyle=p.isPlayer?'#fff':'rgba(255,255,255,.9)';ctx.fillText(p.name,wx,wy-52);}
  R.screen();
  const player=world.player;
  // scan pulse: edge arrows + rings on rivals (screen space)
  if(player&&player.alive&&player.scanT>0){
    for(const q of world.players){if(q===player||!q.alive)continue;
      const sx=CW/2+(q.x*CELL-cam.x)*scale,sy=CH/2+(q.y*CELL-cam.y)*scale;
      ctx.globalAlpha=.85+.15*Math.sin(elapsed*8);
      if(sx>50&&sx<CW-50&&sy>50&&sy<CH-50){ctx.strokeStyle=q.color;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(sx,sy,18*scale+3*Math.sin(elapsed*8),0,Math.PI*2);ctx.stroke();}
      else{const m=42;const px=clamp(sx,m,CW-m),py=clamp(sy,m,CH-m),ang=Math.atan2(sy-CH/2,sx-CW/2);
        ctx.save();ctx.translate(px,py);ctx.rotate(ang);ctx.fillStyle=q.color;ctx.shadowColor=q.color;ctx.shadowBlur=10;
        ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-7,7);ctx.lineTo(-7,-7);ctx.closePath();ctx.fill();ctx.restore();}
      ctx.globalAlpha=1;}
  }
  renderOverlay2D();
}

// minimap + ability bar + pause dim — identical for iso & 3D cameras
export function renderOverlay2D(){
  const R=G.renderer,ctx=R.ctx,world=G.world,mode=G.mode,elapsed=mode.elapsed;
  const CW=R.cw,CH=R.ch,grid=world.grid,player=world.player;
  const ms=2.2,mw=W*ms,mh=H*ms,mx=CW-mw-10,my=CH-mh-64;
  if(my>80){ctx.fillStyle='rgba(5,5,20,.75)';ctx.fillRect(mx-4,my-4,mw+8,mh+8);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const o=grid[idx(x,y)];if(o&&world.players[o-1]){ctx.fillStyle=world.players[o-1].color;ctx.fillRect(mx+x*ms,my+y*ms,ms,ms);}}
    for(const s of world.shards){ctx.fillStyle=s.big?'#ffd600':'#00f5ff';ctx.fillRect(mx+s.x*ms-1,my+s.y*ms-1,2.5,2.5);}
    if(player&&player.scanT>0)for(const q of world.players){if(q!==player&&q.alive&&q.veilT<=0){ctx.globalAlpha=.6+.4*Math.sin(elapsed*8);ctx.fillStyle=q.color;ctx.fillRect(mx+q.x*ms-1.75,my+q.y*ms-1.75,3.5,3.5);ctx.globalAlpha=1;}}
    if(player&&player.alive){ctx.fillStyle='#fff';ctx.shadowColor='#00f5ff';ctx.shadowBlur=6;ctx.beginPath();ctx.arc(mx+player.x*ms,my+player.y*ms,3.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}}
  G.ui.updAbilityUI();
  if(mode.paused){ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(0,0,CW,CH);}
}
