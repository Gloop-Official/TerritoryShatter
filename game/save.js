// game/save.js — local profile, signature-checked against casual tampering
export const SaveData={
  key:'ts.save.v1',
  h(s){let x=2166136261>>>0;for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619)>>>0;}return (x^0xA53A9);},
  def(){return{name:'YOU',colorIdx:0,rider:0,diff:1,loadout:{tac:'stim',ult:'nova'},settings:{sfx:.7,music:.55,shake:true,quality:1,cam:'follow'},stats:{games:0,kills:0,shards:0,shatters:0,bestTerr:0,bestScore:0}};},
  data:null,
  load(){const d=this.def();try{
      const raw=localStorage.getItem(this.key),sig=localStorage.getItem(this.key+'.sig');
      if(raw&&sig&&+sig===this.h(raw)){
        const o=JSON.parse(raw);Object.assign(d,o||{});
        const f=this.def();d.settings=Object.assign(f.settings,o&&o.settings||{});d.stats=Object.assign(f.stats,o&&o.stats||{});d.loadout=Object.assign(f.loadout,o&&o.loadout||{});
      }else if(raw){console.warn('[SaveData] signature mismatch — save reset (tampered?)');}
    }catch(e){}this.data=d;},
  save(){try{const s=JSON.stringify(this.data);localStorage.setItem(this.key,s);localStorage.setItem(this.key+'.sig',String(this.h(s)));}catch(e){}},
  reset(){this.data=this.def();this.save();}
};
SaveData.load();
addEventListener('beforeunload',()=>SaveData.save());
