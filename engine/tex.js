// engine/tex.js — procedural texture atelier. Every surface pattern is PAINTED
// at boot on offscreen canvases: the arena floor, film grain, glass streaks.
// No image files anywhere; the pipeline holds only live canvases.
let C={};
function mkCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}

/** Arena floor art, 1024², one full-map tile: pastel deck, soft machine-noise
 *  blotch clouds, per-cell comb lines, speckle grain, edge vignette. */
export function arenaFloor(W){
  if(C.floor)return C.floor;
  const cv=mkCanvas(1024,1024),g=cv.getContext('2d');
  g.fillStyle='#dde4fb';g.fillRect(0,0,1024,1024);
  // soft color-cloud blotches (very subtle, candy shop feel)
  const BLOBS=['#dfe8ff','#f3e4f7','#e4f6f2','#fdf2e1','#e9e2fb'];
  for(let i=0;i<26;i++){
    const x=Math.random()*1024,y=Math.random()*1024,r=90+Math.random()*220;
    const gr=g.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,BLOBS[i%BLOBS.length]+'55');gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();
  }
  // speckle grain
  g.fillStyle='#ffffff';
  for(let i=0;i<2600;i++){g.globalAlpha=.16*Math.random();g.fillRect(Math.random()*1024,Math.random()*1024,1.4,1.4);}
  g.globalAlpha=1;
  // per-cell comb lines
  const step=1024/W;
  g.strokeStyle='rgba(120,140,200,.30)';g.lineWidth=1.1;
  g.beginPath();
  for(let i=1;i<W;i++){const p=Math.round(i*step)+.5;g.moveTo(p,0);g.lineTo(p,1024);g.moveTo(0,p);g.lineTo(1024,p);}
  g.stroke();
  // every 10th cell: stronger seam
  g.strokeStyle='rgba(100,120,190,.42)';g.lineWidth=2;
  g.beginPath();
  for(let i=10;i<W;i+=10){const p=Math.round(i*step);g.moveTo(p,0);g.lineTo(p,1024);g.moveTo(0,p);g.lineTo(1024,p);}
  g.stroke();
  // soft vignette into the walls so the rim feels grounded
  const vg=g.createRadialGradient(512,512,340,512,512,760);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(70,80,140,.20)');
  g.fillStyle=vg;g.fillRect(0,0,1024,1024);
  C.floor=cv;return cv;
}

/** film grain tile for the post pass */
export function grainTile(){
  if(C.grain)return C.grain;
  const cv=mkCanvas(192,192),g=cv.getContext('2d');
  const im=g.createImageData(192,192);
  for(let i=0;i<im.data.length;i+=4){const v=118+Math.random()*20|0;im.data[i]=v;im.data[i+1]=v;im.data[i+2]=v+8;im.data[i+3]=255;}
  g.putImageData(im,0,0);
  C.grain=cv;return cv;
}
/** cached canvas pattern helpers (patterns are per-ctx; cache them on the ctx) */
export function grainPattern(ctx){return ctx._grainPat||(ctx._grainPat=ctx.createPattern(grainTile(),'repeat'));}
