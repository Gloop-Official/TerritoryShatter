// game/audioLib.js — the game's sound bank as pure DSP specs for the engine.
// Every entry is a function of sample-rate that RETURNS samples; the engine
// renders each once at init into real AudioBuffers. No audio files exist.
import{DSP}from'../engine/audio.js';
const{wav,white,drive,lpass,hpass,norm,bell,mixd,decay,adsr,echo,haas,lcg}=DSP;
const N=(sr,s)=>(sr*s)|0;
const _padCache={}; // pad FFT results shared across bar renders

export function buildBank(){
 return {
  // ---------- UI / one-shots ----------
  click:sr=>norm(decay(lpass(wav(620,N(sr,.06),'sine'),2600),.018),.5),
  claim:sr=>{const n=N(sr,.34);let o=bell(659.3,[[1,.6,.09],[2.01,.16,.04],[3.94,.06,.02]],n);
    mixd(o,bell(880,[[1,.5,.09],[2.01,.14,.04]],n),N(sr,.07));mixd(o,bell(1174.7,[[1,.45,.11],[2.76,.1,.03]],n),N(sr,.14));
    mixd(o,o.slice(),N(sr,.09));return norm(o,.55);},
  shard:sr=>{const n=N(sr,.4);let o=bell(1174.7,[[1,1,.15],[2.4,.3,.06],[4.16,.12,.025]],n);
    const nz=hpass(white(n),9800);for(let i=0;i<n;i++)o[i]+=nz[i]*.025*Math.exp(-i/sr/.05);return norm(o,.55);},
  kill:sr=>{const n=N(sr,.5);let o=decay(norm(wav(62,n,'sine'),1),.16);
    const ch=norm(wav(1,N(sr,.16),'saw'),1);for(let i=0;i<N(sr,.16);i++)o[i]+=ch[i]*.5*Math.exp(-i/sr/.05)*Math.sin(Math.PI*i/(N(sr,.16))); // rough chirp body
    mixd(o,bell(2093,[[1,.5,.07],[2.76,.16,.03]],n),N(sr,.02));
    const nz=hpass(white(n),1400);for(let i=0;i<n;i++)o[i]+=nz[i]*.35*Math.exp(-i/sr/.01);return norm(o,.62);},
  death:sr=>{const n=N(sr,.8);const o=new Float32Array(n);
    for(let i=0;i<n;i++){const t=i/sr,f=320-(140*(t/.8)),vib=1+.06*Math.sin(2*Math.PI*7*t);
      o[i]=Math.sin(2*Math.PI*f*vib*t)*.5*Math.exp(-t/.28)+Math.sin(2*Math.PI*90*t)*.3*Math.exp(-t/.3);}
    const nz=hpass(white(n),3000);for(let i=0;i<n;i++)o[i]+=nz[i]*.12*Math.exp(-i/sr/.04);return norm(o,.55);},
  shatter:sr=>{const rn=lcg(1337),n=N(sr,.8);let o=decay(norm(wav(120,n,'saw'),1),.12);mixd(o,decay(norm(wav(60,n,'square'),1),.3),N(sr,.02));
    for(let k=0;k<5;k++){const f=600+rn()*1200,dk=.09+rn()*.06;mixd(o,bell(f,[[1,.24,dk],[2.01,.07,dk*.5]],n),(k*N(sr,.05))|0);}
    return norm(o,.6);},
  nova:sr=>{const n=N(sr,.9);let o=decay(norm(drive(wav(70,n,'sine'),1.2),1),.34);
    const cr=hpass(white(n),2000);for(let i=0;i<n;i++)o[i]+=cr[i]*.22*Math.exp(-i/sr/.08);
    mixd(o,decay(norm(wav(46,n,'sine'),1),.4),N(sr,.05));return norm(o,.72);},
  stim:sr=>{const n=N(sr,.35);const o=new Float32Array(n);
    for(let i=0;i<n;i++){const t=i/sr,fr=280+240*(t/.35);o[i]=Math.sin(2*Math.PI*fr*t)*.4*Math.sin(Math.PI*Math.min(1,t/.3));}
    const wh=lpass(white(n),1800);for(let i=0;i<n;i++)o[i]+=wh[i]*.14*(i/n);return norm(o,.5);},
  phase:sr=>{const n=N(sr,.6);const o=new Float32Array(n);
    for(let i=0;i<n;i++){const t=i/sr,f=520-(380*(t/.6));o[i]=Math.sin(2*Math.PI*f*t)*.4*Math.exp(-t/.22)+Math.sin(2*Math.PI*(f*1.5)*t)*.12*Math.exp(-t/.3);}
    return norm(echo(o,sr,[.16,.34],[.4,.2]),.5);},
  scan:sr=>{const n=N(sr,.7);let o=bell(980,[[1,.5,.05],[2.01,.12,.03]],n);mixd(o,bell(980,[[1,.4,.05]],n),N(sr,.28));
    mixd(o,bell(1470,[[1,.3,.08],[3.01,.08,.02]],n),N(sr,.56));return norm(o,.5);},
  veil:sr=>{const n=N(sr,.5);let o=new Float32Array(n);
    for(let i=0;i<n;i++){const t=i/sr,f=240-(90*(t/.5));o[i]=Math.sin(2*Math.PI*f*t)*.4*Math.exp(-t/.2);}
    const nz=lpass(white(n),420);for(let i=0;i<n;i++)o[i]+=nz[i]*.2*Math.sin(Math.PI*i/n);return norm(o,.5);},
  surge:sr=>{const n=N(sr,.6);const o=new Float32Array(n);
    for(let i=0;i<n;i++){const t=i/sr,f=150+320*(t/.6);o[i]=Math.sin(2*Math.PI*f*t)*.42*Math.sin(Math.PI*Math.min(1,t/.55));}
    mixd(o,o.slice(),N(sr,.18));return norm(o,.55);},
  ultready:sr=>{const n=N(sr,.5);let o=bell(880,[[1,.5,.08],[2.01,.14,.03]],n);
    mixd(o,bell(1318.5,[[1,.4,.1],[2.98,.1,.02]],n),N(sr,.1));return norm(o,.55);},
  cross:sr=>{const n=N(sr,.22);const o=new Float32Array(n);
    for(let i=0;i<n;i++){const t=i/sr,f=520-(180*(t/.22));o[i]=Math.sin(2*Math.PI*f*t)*.5*Math.exp(-t/.09);}return norm(o,.5);},
  turn:sr=>{const n=N(sr,.22);let o=bell(659.3,[[1,1,.18],[2.76,.32,.06],[4.41,.1,.025]],n);
    const nz=hpass(white(n),6000);for(let i=0;i<n;i++)o[i]+=nz[i]*.05*Math.exp(-i/sr/.016);return norm(o,.5);},
  alarm:sr=>{const n=N(sr,.12);let o=bell(1046,[[1,.5,.06],[2.01,.14,.03],[3.94,.08,.015]],n);
    const nz=hpass(white(n),4000);for(let i=0;i<n;i++)o[i]+=nz[i]*.03*Math.exp(-i/sr/.03);return norm(lpass(o,6000),.5);},
  storm:sr=>{const n=N(sr,.9);let o=decay(norm(drive(lpass(wav(55,n,'sine'),170),.9),1),.4);
    mixd(o,decay(norm(drive(lpass(wav(82.4,n,'sine'),220),.5),1),.34),N(sr,.02));
    const cr=norm(drive(hpass(white(n),1400),.5),1);for(let i=0;i<n;i++)o[i]+=cr[i]*.55*Math.exp(-i/sr/.06);
    const sk=bell(1200,[[1,.5,.12],[1.35,.22,.08]],n);for(let i=0;i<n;i++)o[i]+=sk[i]*.4*Math.exp(-i/sr/.12);
    const mn=norm(o,.72);return haas(mn,sr,7);},
  // ---------- movement loops ----------
  hover:sr=>{const n=N(sr,1.2);
    let m=norm(drive(lpass(wav(96,n,'sine'),300),.45),1);
    mixd(m,norm(drive(lpass(wav(144,n,'saw'),1200),.25),1),0);
    mixd(m,norm(drive(lpass(wav(198.3,n,'sine'),400),.3),1),0);
    for(let i=0;i<n;i++)m[i]*=(.6+.4*Math.sin(2*Math.PI*5*i/sr))*.62;
    return haas(m,sr,8);},
  trace:sr=>{const n=N(sr,1.2);
    let m=norm(drive(hpass(white(n),2500),.6),.42);
    mixd(m,norm(drive(lpass(wav(523.3,n,'sine'),900),.5),.18),0);
    mixd(m,norm(drive(lpass(wav(784,n,'sine'),1200),.35),.1),0);
    for(let i=0;i<n;i++)m[i]*=(.7+.3*Math.sin(2*Math.PI*5*i/sr));
    return haas(m,sr,6);},
  tension:sr=>{const n=N(sr,2.4);let m=new Float32Array(n);
    for(let i=0;i<n;i++){const t=i/sr;
      const b=(Math.sin(2*Math.PI*55*t)+Math.sin(2*Math.PI*58.3*t))*.3;
      const pulse=.3+.7*Math.pow(Math.max(0,Math.sin(2*Math.PI*t/1.2)),2);
      m[i]=b*pulse;}
    const nz=lpass(white(n),300);for(let i=0;i<n;i++)m[i]+=nz[i]*.1*(.4+.6*Math.sin(2*Math.PI*i/n));
    return norm(m,.5);},
  // ---------- procedural soundtrack (16-bar pastel electropop loop @ 96bpm) ----------
  music:sr=>{const bpm=96,beat=60/bpm,bar=beat*4,bars=16,n=N(sr,bar*bars);
    const L=new Float32Array(n),R=new Float32Array(n),rn=lcg(20260609);
    const CH=[ // Am F C G — pastel set
      [220,261.6,329.6],[174.6,220,261.6],[130.8,164.8,196],[196,246.9,293.7]];
    const PENTA=[220,261.6,293.7,329.6,392,440];
    for(let b=0;b<bars;b++){const off=N(sr,b*bar),ch=CH[b%4],root=ch[0]/2;
      // pad: detuned saw pair per chord tone, slow swell (cached per freq — FFT cost)
      for(let k=0;k<3;k++)for(const det of[0,2.2]){const key=ch[k]+'+'+det;
        const s0=_padCache[key]||(_padCache[key]=lpass(wav(ch[k]+det,N(sr,bar),'saw'),900));
        for(let i=0;i<s0.length&&off+i<n;i++){const sw=Math.sin(Math.PI*Math.min(1,(i/sr)/bar));L[off+i]+=s0[i]*sw*.05;R[off+i]+=s0[i]*sw*.045;}}
      // bass: root sine on beats
      for(let q=0;q<4;q++){const bo=off+N(sr,q*beat);
        for(let i=0;i<N(sr,beat*.5)&&bo+i<n;i++){L[bo+i]+=Math.sin(2*Math.PI*root*i/sr)*.24*Math.exp(-i/sr/.16);R[bo+i]+=Math.sin(2*Math.PI*root*i/sr)*.24*Math.exp(-i/sr/.16);}}
      // kick: pitch-drop sine, beats 1&3 (+ ghost on 4 of every 4th bar)
      for(const qb of(b%4===3?[0,2,3.5]:[0,2])){const ko=off+N(sr,qb*beat);
        for(let i=0;i<N(sr,.18)&&ko+i<n;i++){const t=i/sr,f=120-70*Math.min(1,t/.09);
          L[ko+i]+=Math.sin(2*Math.PI*f*t)*.7*Math.exp(-t/.07);R[ko+i]+=Math.sin(2*Math.PI*f*t)*.7*Math.exp(-t/.07);}}
      // hats: eighths, hp noise, accent pattern
      const hh=hpass(white(N(sr,.05)),7000);
      for(let q=0;q<8;q++){const acc=q%2?0.05:.11;if(rn()<.92){const ho=off+N(sr,q*beat/2);
        for(let i=0;i<hh.length&&ho+i<n;i++){L[ho+i]+=hh[i]*acc*Math.exp(-i/sr/.018);R[ho+i]+=hh[i]*acc*.9*Math.exp(-i/sr/.018);}}}
      // arp: pentatonic bell, 8ths with echo, HAAS-widened
      for(let q=0;q<8;q++){const f=PENTA[(b*3+q*2)%PENTA.length]*2;
        const pl=bell(f,[[1,.3,.07],[3,.08,.03]],N(sr,.3));const ao=off+N(sr,q*beat/2);
        mixd(L,pl,ao);mixd(R,pl,ao+N(sr,.01));
        mixd(L,pl.map(v=>v*.3),ao+N(sr,.21));mixd(R,pl.map(v=>v*.3),ao+N(sr,.22));}
    }
    return{l:norm(L,.62),r:norm(R,.62)};},
  // ---------- convolution reverb impulse (engine-generated, used by sfx bus send) ----------
  _ir:sr=>{const n=N(sr,1.1);const nz=lpass(white(n),2400);
    for(let i=0;i<n;i++)nz[i]*=Math.exp(-i/sr/.22);
    nz[0]=1; // direct-ish early coherence
    for(const t of[.011,.023,.037]){const o=N(sr,t);if(o<n)nz[o]+=.6*Math.exp(-t*8);}
    return norm(nz,.55);},
 };
}
