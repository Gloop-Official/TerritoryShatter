// engine/audio.js — AudioEngine: sample-based mixer with buses, ducking,
// pitch variation, stereo panning and persistent loops (queued pre-decode).
// settingsFn(): () => ({sfx: 0..1, music: 0..1, muted: bool})
import{rnd,clamp}from'./math.js';

export class AudioEngine{
  constructor(version,settingsFn){
    this.version=version;this.settings=settingsFn||(()=>({sfx:.7,music:.5,muted:false}));
    this.buffers={};this.raw={};this.ctx=null;
    this.master=null;this.sfxBus=null;this.musicBus=null;this.musicSrc=null;
    this.duckLvl=1;this.loops={};this.want={};this.files=[];
  }
  /** names: ['click', ...] — resolved as base+'name.wav'?v=version */
  register(names){this.files=this.files.concat(names);}
  init(){
    if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return;}
    try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
    const AC=this.ctx;
    const comp=AC.createDynamicsCompressor();
    comp.threshold.value=-14;comp.knee.value=20;comp.ratio.value=5;comp.attack.value=.003;comp.release.value=.2;
    comp.connect(AC.destination);
    this.master=AC.createGain();this.master.connect(comp);
    this.sfxBus=AC.createGain();this.sfxBus.connect(this.master);
    this.musicBus=AC.createGain();this.musicBus.connect(this.master);
    this.applyVolumes();this.decodePending();
  }
  preload(){
    for(const n of this.files){
      fetch('audio/'+n+'.wav?v='+this.version)
        .then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer();})
        .then(ab=>{this.raw[n]=ab;this.decodePending();})
        .catch(()=>{});
    }
  }
  async decodePending(){
    if(!this.ctx)return;
    for(const n of Object.keys(this.raw)){
      const ab=this.raw[n];delete this.raw[n];
      try{this.buffers[n]=await this.ctx.decodeAudioData(ab);}catch(e){}
    }
    this.startMusic();
    for(const n of Object.keys(this.want))if(this.buffers[n]&&!this.loops[n])this.loopStart(n,this.want[n]);
  }
  startMusic(){
    if(!this.ctx||this.musicSrc||!this.buffers.music)return;
    const src=this.ctx.createBufferSource();src.buffer=this.buffers.music;src.loop=true;src.connect(this.musicBus);
    try{src.start();}catch(e){}this.musicSrc=src;
  }
  applyVolumes(){
    if(!this.ctx)return;const s=this.settings();
    this.sfxBus.gain.value=s.muted?0:s.sfx;
    this.musicBus.gain.setTargetAtTime(s.muted?0:s.music*this.duckLvl,this.ctx.currentTime,.25);
  }
  setDuck(v){this.duckLvl=v;this.applyVolumes();}
  /** play(name, {vol, rate, rateVar, pan, delay}) */
  play(name,opt){
    opt=opt||{};if(!this.ctx||this.settings().muted)return;
    const b=this.buffers[name];if(!b){if(opt.fb)opt.fb();return;}
    const AC=this.ctx;
    const src=AC.createBufferSource();src.buffer=b;
    src.playbackRate.value=(opt.rate||1)*(opt.rateVar?1+rnd(-opt.rateVar,opt.rateVar):1);
    let node=src;
    if(opt.pan){try{const pn=AC.createStereoPanner();pn.pan.value=clamp(opt.pan,-.9,.9);node.connect(pn);node=pn;}catch(e){}}
    const g=AC.createGain();g.gain.value=opt.vol!=null?opt.vol:1;
    node.connect(g);g.connect(this.sfxBus);
    src.start(AC.currentTime+(opt.delay||0));
  }
  // --- persistent loops ---
  loopStart(name,gain){
    this.want[name]=gain||0;if(!this.ctx||this.loops[name]||!this.buffers[name])return;
    const src=this.ctx.createBufferSource();src.buffer=this.buffers[name];src.loop=true;
    const g=this.ctx.createGain();g.gain.value=gain||0;src.connect(g);g.connect(this.sfxBus);
    try{src.start();}catch(e){}this.loops[name]={src,g};
  }
  loopGain(name,v,ramp){const l=this.loops[name];if(l&&this.ctx)l.g.gain.setTargetAtTime(v,this.ctx.currentTime,ramp||.12);else if(!l)this.want[name]=v;}
  loopRate(name,v){const l=this.loops[name];if(l&&this.ctx)l.src.playbackRate.setTargetAtTime(v,this.ctx.currentTime,.15);}
  loopStop(name){delete this.want[name];const l=this.loops[name];if(!l)return;try{l.src.stop();}catch(e){}delete this.loops[name];}
  /** legacy oscillator fallback: only used when a sample hasn't decoded */
  tone(f,d,type,v,slide,delay){
    if(!this.ctx||this.settings().muted)return;
    const AC=this.ctx,t=AC.currentTime+(delay||0);
    const o=AC.createOscillator(),g=AC.createGain();
    o.type=type||'sine';o.frequency.setValueAtTime(f,t);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d);
    g.gain.setValueAtTime((v||.15)*this.settings().sfx,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+d);
    o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d+0.02);
  }
}
