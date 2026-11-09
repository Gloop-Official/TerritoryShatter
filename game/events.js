// game/events.js — in-match hazard events (Apex-style map pressure).
// v1: SHATTER STORM — a warned zone strikes, scorching turf into loose shards.
import{G}from'./ctx.js';
import{W,H,CELL,idx}from'./config.js';
import{rnd,rint}from'../engine/math.js';
import{S}from'./sfx.js';

function hz(){return G.mode.hazard||(G.mode.hazard={t:0,next:rnd(16,22),phase:'idle',cx:0,cy:0,r:0,warnT:0});}
export function resetEvents(){G.mode.hazard={t:0,next:rnd(16,22),phase:'idle',cx:0,cy:0,r:0,warnT:0};}

export function updateEvents(dt){
  const z=hz();
  if(z.phase==='idle'){
    z.t+=dt;
    if(z.t>=z.next){
      z.phase='warn';z.warnT=2.6;
      z.r=rint(8,13);z.cx=rint(z.r,W-1-z.r);z.cy=rint(z.r,H-1-z.r);
      G.ui.showBanner('⚠ SHATTER STORM INCOMING!','#ff9d00');
      G.ui.addFeed('<b style="color:#ff9d00">⚠ storm cell forming — evacuate the marked zone</b>');
      S.warn();
    }
  }else if(z.phase==='warn'){
    z.warnT-=dt;
    if(z.warnT<=0)strikeStorm(z);
  }
}

function strikeStorm(z){
  const world=G.world,r2=z.r*z.r,r=z.r;
  let cleared=0,dropped=0;
  for(let y=z.cy-r;y<=z.cy+r;y++)for(let x=z.cx-r;x<=z.cx+r;x++){
    const dx=x-z.cx,dy=y-z.cy;
    if(dx*dx+dy*dy>r2||x<0||y<0||x>=W||y>=H)continue;
    const i=idx(x,y);
    if(world.grid[i]!==0){
      world.grid[i]=0;cleared++;
      if(Math.random()<.3&&dropped<40){world.shards.push({cx:x,cy:y,x:x+.5,y:y+.5,value:.5,big:false,born:G.mode.elapsed,rot:rnd(0,6)});dropped++;}
      if(Math.random()<.5)G.fx.burst((x+.5)*CELL,(y+.5)*CELL,Math.random()<.5?'#ffd600':'#ff9d00',2,180);
    }
  }
  // trails inside the zone burn off
  for(const p of world.players){
    if(p.trail.length){const kept=p.trail.filter(c=>{const cx=c%W,cy=(c/W)|0;const dx=cx-z.cx,dy=cy-z.cy;return dx*dx+dy*dy>r2;});
      if(kept.length!==p.trail.length){p.trail=kept;p.trailSet=new Set(kept);}}
    p.owned=0;
  }
  for(let i=0;i<W*H;i++){const o=world.grid[i];if(o&&world.players[o-1])world.players[o-1].owned++;}
  // riders caught inside get shocked — and storm-charged
  for(const p of world.players){
    if(!p.alive)continue;
    const dx=p.x-(z.cx+.5),dy=p.y-(z.cy+.5);
    if(dx*dx+dy*dy<r2){p.ultCharge=Math.min(100,p.ultCharge+15);
      if(p.isPlayer){G.ui.showBanner('⚡ ZAPPED BY THE STORM — ULT +15!','#ff9d00');S.stim();}}
  }
  G.fx.ripple((z.cx+.5)*CELL,(z.cy+.5)*CELL,'#ff9d00',z.r*CELL*1.2);
  G.fx.burst((z.cx+.5)*CELL,(z.cy+.5)*CELL,'#ffffff',26,380);
  G.cam.addShake(18);
  S.storm();
  G.ui.addFeed(`<b style="color:#ff9d00">⚡ storm</b> scorched <b>${cleared}</b> cells — <b style="color:#ffd600">${dropped}</b> shards loose`);
  z.phase='idle';z.t=0;z.next=rnd(24,34);
}
