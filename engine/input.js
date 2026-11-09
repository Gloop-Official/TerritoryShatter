// engine/input.js — unified keyboard + touch input with semantic events
// Events: 'dir'(dx,dy), 'tac', 'ult', 'pause', 'confirm'
import{clamp}from'./math.js';

export class Input{
  constructor(canvas){
    this.canvas=canvas;this._h={dir:[],tac:[],ult:[],pause:[],confirm:[],view:[]};
    this.confirmGuard=null; // return true to swallow 'confirm' (e.g. typing in a field)
    this.KEY={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
    this.onFirstGesture=null;this._gestured=false;
    addEventListener('keydown',e=>{
      const ae=document.activeElement;
      if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'))return; // typing in a field: no game keys
      if(this.KEY[e.code]){e.preventDefault();this._gesture();this._emit('dir',this.KEY[e.code][0],this.KEY[e.code][1]);}
      if(e.code==='KeyQ'){this._gesture();this._emit('tac');}
      if(e.code==='KeyZ'||e.code==='KeyE'){this._gesture();this._emit('ult');}
      if(e.code==='KeyV')this._emit('view');
      if(e.code==='Escape')this._emit('pause');
      if(e.code==='Space'){if(!(this.confirmGuard&&this.confirmGuard()))this._emit('confirm');this._gesture();}
    });
  }
  on(evt,fn){this._h[evt].push(fn);return this;}
  _emit(evt,...a){for(const f of this._h[evt])f(...a);}
  _gesture(){if(!this._gestured){this._gestured=true;if(this.onFirstGesture)this.onFirstGesture();}}
  /** virtual joystick + global swipe -> 'dir' events */
  attachTouch(joyEl,knobEl){
    let joyId=null,joyOX=0,joyOY=0;
    const joy=this.canvas;
    joy.addEventListener('touchstart',e=>{e.preventDefault();this._gesture();
      const t=e.changedTouches[0];joyId=t.identifier;joyOX=t.clientX;joyOY=t.clientY;
      joyEl.style.display='block';joyEl.style.left=(joyOX-55)+'px';joyEl.style.top=(joyOY-55)+'px';
      knobEl.style.left='31px';knobEl.style.top='31px';},{passive:false});
    joy.addEventListener('touchmove',e=>{e.preventDefault();
      for(const t of e.changedTouches)if(t.identifier===joyId){
        let dx=t.clientX-joyOX,dy=t.clientY-joyOY;const m=Math.hypot(dx,dy);
        if(m>8){knobEl.style.left=(31+clamp(dx,-32,32))+'px';knobEl.style.top=(31+clamp(dy,-32,32))+'px';
          if(Math.abs(dx)>Math.abs(dy))this._emit('dir',dx>0?1:-1,0);else this._emit('dir',0,dy>0?1:-1);}
      }},{passive:false});
    const endTouch=e=>{for(const t of e.changedTouches)if(t.identifier===joyId){joyId=null;joyEl.style.display='none';}};
    joy.addEventListener('touchend',endTouch);joy.addEventListener('touchcancel',endTouch);
    // quick swipe anywhere
    let sx=0,sy=0;
    addEventListener('touchstart',e=>{const t=e.changedTouches[0];sx=t.clientX;sy=t.clientY;},{passive:true});
    addEventListener('touchmove',e=>{if(joyId!==null)return;const t=e.changedTouches[0];
      const dx=t.clientX-sx,dy=t.clientY-sy;
      if(Math.hypot(dx,dy)>36){if(Math.abs(dx)>Math.abs(dy))this._emit('dir',dx>0?1:-1,0);else this._emit('dir',0,dy>0?1:-1);sx=t.clientX;sy=t.clientY;}
    },{passive:true});
  }
}
