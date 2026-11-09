// engine/audio.js — AudioEngine: DSP-rendered sounds (nothing is a static file;
// every buffer is computed here at init) + mixer with buses, ducking, pitch
// variation, stereo panning and persistent loops. Optional fetch() names still
// resolve to audio/*.wav only when such a file exists.
// settingsFn(): () => ({sfx: 0..1, music: 0..1, muted: bool})
import{rnd,clamp}from'./math.js';

// ---- in-repo DSP render layer (OfflineAudioContext -> AudioBuffer) ----

const wav=(f,n,type)=>{ // band-limited-ish virtual analog osc
  const a=new Float32Array(n),p=2*Math.PI*f;
  for(let i=0;i<n;i++){const t=i/44100;if(type==='saw')a[i]=2*((f*t)%1)-1;else if(type==='square')a[i]=((f*t)%1)<.5?.7:-.7;else a[i]=Math.sin(p*t);}
  return a;
};
const white=n=>{const a=new Float32Array(n);for(let i=0;i<n;i++)a[i]=Math.random()*2-1;return a;};
const drive=(x,g)=>{g=g||1.3;const o=new Float32Array(x.length);for(let i=0;i<x.length;i++)o[i]=Math.tanh(x[i]*g);return o;};
const tilt=(x,curve)=>{const n=x.length,N=Math.pow(2,Math.ceil(Math.log2(n))),SR=44100,h=N%2?((N+1)>>1):(N>>1);
  const fv=(freq)=>{let lv=curve[curve.length-1][1];for(let i=0;i<curve.length;i++){if(freq<=curve[i][0]){const f0=i?curve[i-1][0]:20,v0=i?curve[i-1][1]:0.0001,f1=curve[i][0],v1=curve[i][1];lv=v0+(v1-v0)*Math.max(0,Math.min(1,(freq-f0)/Math.max(1,f1-f0)));break;}}return lv;};
  const re=Array.from(x).concat(new Array(N-n).fill(0)),im=new Array(N).fill(0);
  let bs=1;while(bs<N){for(let i=0;i<N;i+=bs*2)for(let j=0;j<bs;j++){const t=i+j,u=i+j+bs,wr=Math.cos(-2*Math.PI*j/(bs*2))/(1),wi=Math.sin(-2*Math.PI*j/(bs*2))/1,ar=re[u]*wr-im[u]*wi,ai=re[u]*wi+im[u]*wr;re[u]=re[t]-ar;im[u]=im[t]-ai;re[t]+=ar;im[t]+=ai;}bs*=2;}
  for(let i=0;i<N;i++){const fq=Math.min(SR/2,Math.abs(i<=h?i*SR/N:(N-i)*SR/N)),v=fv(fq);re[i]*=v;im[i]*=v;}
  bs=1;while(bs<N){for(let i=0;i<N;i+=bs*2)for(let j=0;j<bs;j++){const t=i+j,u=i+j+bs,wr=Math.cos(2*Math.PI*j/(bs*2)),wi=Math.sin(2*Math.PI*j/(bs*2)),ar=re[u]*wr-im[u]*wi,ai=re[u]*wi+im[u]*wr;re[u]=re[t]-ar;im[u]=im[t]-ai;re[t]+=ar;im[t]+=ai;}bs*=2;}
  const o=new Float32Array(n);for(let i=0;i<n;i++)o[i]=re[i]/N;return o;};
const lpass=(x,fc)=>tilt(x,[[20,1],[fc*.7,1],[fc,.22],[fc*1.6,.0008],[fc*3,.0001]]);
const hpass=(x,fc)=>tilt(x,[[fc*.5,.0008],[fc,.25],[fc*2,1],[22050,1]]);
const norm=(x,peak)=>{let m=0;for(let i=0;i<x.length;i++)m=Math.max(m,Math.abs(x[i]));const s=(peak||.85)/Math.max(m,1e-6),o=new Float32Array(x.length);for(let i=0;i<x.length;i++)o[i]=x[i]*s;return o;};
const bell=(f,partials,n)=>{const o=new Float32Array(n);for(const pr of partials){const mul=pr[0],a=pr[1],dk=pr[2],b=wav(f*mul,n,'sine');for(let i=0;i<n;i++)o[i]+=b[i]*a*Math.exp(-i/44100/dk);}return o;};
const mixd=(a,b,off)=>{for(let i=0;i<b.length&&off+i<a.length;i++)a[off+i]+=b[i];return a;};

const adsr=(n,atk,rel)=>{const o=new Float32Array(n);for(let i=0;i<n;i++){const t=i/44100;o[i]=t<atk?t/atk:Math.exp(-(t-atk)/rel);}return o;};

export class AudioEngine{
  constructor(version,settingsFn){
    this.version=version;this.settings=settingsFn||(()=>({sfx:.7,music:.5,muted:false}));
    this.buffers={};this.raw={};this.ctx=null;
    this.master=null;this.sfxBus=null;this.musicBus=null;this.musicSrc=null;
    this.duckLvl=1;this.loops={};this.want={};this.files=[];
  }
  /** files: [optional fallback fetches], synth: {name: (dsp)=>AudioBuffer|{l,r}} */
  register(files,synth){this.synthNames=synth||{};if(files&&files.length)this.files=this.files.concat(files);}
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
    this._compileSynthBuffers();
  }
  _compileSynthBuffers(){ // engine-rendered sounds (offline render -> AudioBuffer)
    const C=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!C)return;
    const SR=this.ctx.sampleRate;
    for(const n of Object.keys(this.synthNames||{})){
      if(this.buffers[n])continue;const fn=this.synthNames[n];let spec=null;
      try{spec=fn(SR);}catch(e){spec=null;}
      if(!spec)continue;
      const mono=spec.l?spec.l:(spec.buffer||spec);
      const stereo=!!(spec.l||spec.r)||!!spec.stereo;
      const frames=Math.max(1,Math.ceil(mono.length||1));
      try{const oc=new C(stereo?2:1,frames,SR);const b=oc.createBuffer(stereo?2:1,frames,SR);
        const put=(ch,src)=>{const d=new Float32Array(frames);const n=Math.min(frames,src.length);for(let i=0;i<n;i++)d[i]=src[i];b.copyToChannel(d,ch,0);};
        if(stereo){put(0,spec.l||mono);put(1,spec.r||spec.l||mono);}else put(0,mono);
        this.buffers[n]=b;}catch(e){}
    }
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
  dsp(name,opt){ // synth event: 'turn' | 'alarm' | 'storm'
    opt=opt||{};
    if(name==='turn')this.play('turn',opt);
    else if(name==='alarm'){this.play('alarm',opt);this.play('alarm',{vol:(opt.vol!=null?opt.vol:.8)*.85,delay:.32});}
    else if(name==='storm')this.play('storm',opt);
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
