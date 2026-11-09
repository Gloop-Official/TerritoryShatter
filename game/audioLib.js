// game/audioLib.js — the game's sound bank as pure DSP specs for the engine.
// Every entry returns SAMPLES; the engine renders each once at init into real
// AudioBuffers. No audio files exist. The organic character comes from
// Karplus-Strong physical strings + brown-noise bodies + humanized echoes.
import{DSP}from'../engine/audio.js';
const{wav,white,drive,lpass,hpass,norm,bell,mixd,decay,adsr,echo,haas,lcg,ks,brown,biquad,body}=DSP;
const N=(sr,s)=>(sr*s)|0;
const _padCache={};

export function buildBank(){
 return {
  // ---------- organic one-shots (physical models, not beeps) ----------
  click:sr=>{const n=N(sr,.09);const o=norm(body(ks(880,n,.965,2400),[520,7,.5],[1560,9,.3]),.5);
    const t=hpass(white(n),5000);for(let i=0;i<n;i++)o[i]+=t[i]*.18*Math.exp(-i/sr/.006);return norm(o,.5);},
  claim:sr=>{const n=N(sr,.5); // wooden pluck arpeggio over a soundboard
    const wob=x=>norm(body(x,[520,6,.55],[1290,8,.4],[2640,10,.22]),.8);
    let o=wob(ks(659.3,n,.992,2600));
    mixd(o,wob(ks(880,n,.991,2600)).map(v=>v*.88),N(sr,.075));
    mixd(o,wob(ks(1318.5,n,.99,3000)).map(v=>v*.62),N(sr,.15));return norm(o,.8);},
  shard:sr=>{const n=N(sr,.45);let o=norm(ks(1567.9,n,.986,5000),.85); // glassy pluck
    const t=hpass(white(n),8800);for(let i=0;i<n;i++)o[i]+=t[i]*.05*Math.exp(-i/sr/.03);
    mixd(o,norm(ks(2093,n,.983,6000),.5),N(sr,.03));return norm(o,.55);},
  kill:sr=>{const n=N(sr,.5);let o=norm(ks(220,n,.963,900),1);        // wooden knock
    const t=hpass(white(n),2000);for(let i=0;i<n;i++)o[i]+=t[i]*.3*Math.exp(-i/sr/.008);
    mixd(o,norm(decay(wav(70,n,'sine'),.22),.6),0);
    mixd(o,norm(ks(1567.9,n,.988,5200),.4),N(sr,.02));return norm(o,.6);},
  death:sr=>{const n=N(sr,.85);let o=norm(ks(98,n,.994,500),.55);      // sad low string sag
    const nz=lpass(white(n),380);for(let i=0;i<n;i++){const t=i/sr;o[i]+=nz[i]*.3*Math.sin(Math.PI*Math.min(1,t/.62))*Math.exp(-t/.5);}
    mixd(o,norm(decay(wav(52,n,'sine'),.5),.5),N(sr,.12));return norm(o,.55);},
  shatter:sr=>{const rn=lcg(1337),n=N(sr,.85);                          // glass cascade + bone thud
    let o=norm(decay(wav(85,n,'sine'),.3),.7);                           // thud body
    const cr=hpass(white(n),2600);for(let i=0;i<n;i++)o[i]+=cr[i]*.32*Math.exp(-i/sr/.012);
    const P=[1318,1568,1976,2349,2794,1319.5];
    for(let k=0;k<6;k++)mixd(o,norm(ks(P[k]+rn()*14,n,.981+rn()*.012,4200+rn()*1800),.34),N(sr,.028+k*.048+rn()*.02));
    return norm(o,.62);},
  nova:sr=>{const n=N(sr,1.1);let o=norm(decay(brown(n),.42),1);        // thunderous boom
    mixd(o,norm(decay(wav(46,n,'sine'),.65),.75),0);
    const cr=hpass(white(n),1600);for(let i=0;i<n;i++)o[i]+=cr[i]*.3*Math.exp(-i/sr/.02);
    echo(o,sr,[.19,.43],[.4,.22]);return norm(o,.74);},
  stim:sr=>{const n=N(sr,.4);const o=lpass(white(n),900);               // breathy inhale riser
    for(let i=0;i<n;i++)o[i]*=.2+.8*(i/n);
    mixd(o,norm(ks(392,n,.992,1500),.5),N(sr,.18));return norm(o,.5);},
  phase:sr=>{const n=N(sr,.7);const o=new Float32Array(n);              // wind-through-the-body
    const nz=lpass(white(n),620);
    for(let i=0;i<n;i++){const t=i/sr;o[i]=nz[i]*.55*Math.pow(Math.sin(Math.PI*Math.min(1,t/.62)),1.5);}
    mixd(o,norm(ks(523.3,n,.993,1800),.5),N(sr,.06));return norm(echo(o,sr,[.17],[.35]),.5);},
  scan:sr=>{const n=N(sr,.8);let o=norm(ks(1174.7,n,.989,3800),.75);    // wooden radar mallets
    mixd(o,norm(ks(1174.7,n,.989,3800),.6),N(sr,.29));
    mixd(o,norm(ks(1760,n,.987,4400),.5),N(sr,.56));return echo(o,sr,[.3],[.25]);},
  veil:sr=>{const n=N(sr,.55);const o=lpass(white(n),260);              // cloth whisk
    for(let i=0;i<n;i++)o[i]*=Math.sin(Math.PI*Math.min(1,i/n/.9));
    mixd(o,norm(ks(196,n,.99,700),.4),N(sr,.05));return norm(o,.5);},
  surge:sr=>{const n=N(sr,.65);const o=lpass(white(n),380);             // magnetic swell + confirm
    for(let i=0;i<n;i++)o[i]*=.15+.85*Math.sin(Math.PI*Math.min(1,i/n))**2;
    mixd(o,norm(ks(329.6,n,.992,1600),.55),N(sr,.3));return norm(o,.55);},
  ultready:sr=>{const n=N(sr,.6);let o=norm(ks(659.3,n,.992,2400),.8);
    mixd(o,norm(ks(987.8,n,.991,3000),.65),N(sr,.12));return norm(o,.55);},
  cross:sr=>{const n=N(sr,.3);let o=norm(ks(440,n,.97,1800),.6);        // quick rubber flick
    const nz=lpass(white(n),800);for(let i=0;i<n;i++)o[i]+=nz[i]*.12*Math.exp(-i/sr/.05);return norm(o,.5);},
  turn:sr=>{const n=N(sr,.32);                                          // pentatonic woodblock on a soundboard
    let o=norm(body(ks(659.3,n,.988,2400),[440,7,.7],[1320,9,.5],[2400,11,.25]),.92);
    const t=hpass(white(n),5200);for(let i=0;i<n;i++)o[i]+=t[i]*.1*Math.exp(-i/sr/.012);return norm(o,.6);},
  alarm:sr=>{const n=N(sr,.3);let o=norm(ks(587.3,n,.99,1500),.8);      // soft warning mallet (not a siren)
    mixd(o,norm(ks(880,n,.989,2200),.55),N(sr,.14));return norm(o,.5);},
  storm:sr=>{const n=N(sr,1.4);const o=norm(decay(brown(n),1.1),1);     // distant thunder roll
    mixd(o,norm(decay(wav(58,n,'sine'),.8),.5),0);
    const cr=hpass(white(n),1400);for(let i=0;i<n;i++)o[i]+=cr[i]*.4*Math.exp(-i/sr/.015);
    echo(o,sr,[.15,.31,.52],[.5,.28,.15]);
    const st=norm(o,.74);return haas(st,sr,9);},
  // ---------- movement / ambient loops (1.2s, seamless) ----------
  hover:sr=>{const n=N(sr,1.2);const m=norm(drive(lpass(brown(n),340),1.1),1); // turbofan-like whoosh bed
    mixd(m,norm(drive(lpass(wav(92,n,'sine'),260),.4),.5),0);
    mixd(m,norm(drive(lpass(wav(138,n,'saw'),800),.2),.14),0);
    for(let i=0;i<n;i++)m[i]*=(.62+.38*Math.sin(2*Math.PI*5*i/sr))*.68;
    return haas(m,sr,8);},
  trace:sr=>{const n=N(sr,1.2);const m=norm(drive(hpass(white(n),2800),.55),.4); // chalk-drag air
    mixd(m,norm(ks(1046.5,n,.996,3400),.22),0);
    for(let i=0;i<n;i++)m[i]*=(.72+.28*Math.sin(2*Math.PI*5*i/sr));
    return haas(norm(m,.5),sr,6);},
  tension:sr=>{const n=N(sr,2.4);const m=norm(lpass(brown(n),160),.62);   // pressure drone
    const be=new Float32Array(n);
    for(let i=0;i<n;i++){const t=i/sr;be[i]=Math.sin(2*Math.PI*55*t)*.2;}
    mixd(m,be,0);
    for(let i=0;i<n;i++){const p=.45+.55*Math.pow(Math.max(0,Math.sin(2*Math.PI*i/n)),2);m[i]*=p;}
    return norm(m,.48);},
  // ---------- organic lo-fi soundtrack as SEPARATE STEMS (pad/bass/kick/arp) ----------
  //  the engine loops them in lockstep and live-mixes per game state.
  music:sr=>{const bpm=96,beat=60/bpm,bar=beat*4,bars=16,n=N(sr,bar*bars);
    const mk=()=>({l:new Float32Array(n),r:new Float32Array(n)});
    const STE={pad:mk(),bass:mk(),kick:mk(),arp:mk()};
    const L=new Float32Array(n),R=new Float32Array(n),rn=lcg(20260609);
    const CH=[[220,261.6,329.6],[174.6,220,261.6],[130.8,164.8,196],[196,246.9,293.7]];
    const PENTA=[220,261.6,293.7,329.6,392,440];
    const pluck=(f,damp)=>norm(body(ks(f,N(sr,.5),damp,2400),[500,6,.5],[1300,8,.3]),.3);
    for(let b=0;b<bars;b++){const off=N(sr,b*bar),ch=CH[b%4],root=ch[0]/2;
      // PAD stem: three soft KS plucks strummed over 60ms + airy bed
      for(let k=0;k<3;k++){const p0=pluck(ch[k],.994);const at=off+N(sr,k*.02);
        mixd(STE.pad.l,p0,at);mixd(STE.pad.r,p0,at+N(sr,.012));}
      // BASS stem: warm plucked root on beats 1 & 3
      for(const q of[0,2]){const bp=pluck(root,.985);const at=off+N(sr,q*beat);
        for(let i=0;i<bp.length&&at+i<n;i++){STE.bass.l[at+i]+=bp[i]*.9;STE.bass.r[at+i]+=bp[i]*.9;}}
      // KICK stem: soft felt thump, beats 1 & 3 (+ ghost on each 4th bar) + brushes
      for(const qb of(b%4===3?[0,2,3.5]:[0,2])){const ko=off+N(sr,qb*beat);
        for(let i=0;i<N(sr,.16)&&ko+i<n;i++){const t=i/sr,f=95-50*Math.min(1,t/.07);
          const v=Math.sin(2*Math.PI*f*t)*.55*Math.exp(-t/.05);STE.kick.l[ko+i]+=v;STE.kick.r[ko+i]+=v;}}
      const br=lpass(white(N(sr,.09)),2400);
      for(let q=0;q<8;q++){const acc=q%2?.05:.1;if(rn()<.9){const bo=off+N(sr,q*beat/2);
        for(let i=0;i<br.length&&bo+i<n;i++){const v=br[i]*acc*Math.exp(-i/sr/.035);STE.kick.l[bo+i]+=v;STE.kick.r[bo+i]+=v*.94;}}}
      // ARP stem: KS pentatonic 8ths with echo + HAAS width
      for(let q=0;q<8;q++){const f=PENTA[(b*3+q*2)%PENTA.length]*2;
        const p0=pluck(f,.99),ao=off+N(sr,q*beat/2);
        for(let i=0;i<p0.length&&ao+i<n;i++){STE.arp.l[ao+i]+=p0[i];STE.arp.r[ao+i]+=p0[Math.max(0,i-N(sr,.008))];}
        const e0=off+N(sr,q*beat/2+beat*.5);
        for(let i=0;i<p0.length&&e0+i<n;i++){STE.arp.l[e0+i]+=p0[i]*.24;STE.arp.r[e0+i]+=p0[i]*.22;}}
    }
    const stems={};
    for(const[k,v]of Object.entries(STE))stems[k]={l:norm(v.l,.6),r:norm(v.r,.6)};
    return{stems};},
  // ---------- stereo-decorrelated room impulse (convolution reverb) ----------
  _ir:sr=>{const n=N(sr,1.6);const mk=()=>{const nz=lpass(white(n),2100);
      for(let i=0;i<n;i++)nz[i]*=Math.exp(-i/sr/.3);
      nz[0]=1;for(const t of[.011,.019,.029,.041]){const o=N(sr,t);if(o<n)nz[o]+=.55*Math.exp(-t*7);}
      return norm(nz,.5);};
    return{l:mk(),r:mk()};},
 };
}
