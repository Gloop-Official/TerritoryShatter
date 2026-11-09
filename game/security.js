// game/security.js — runtime integrity hashing over core sim functions.
// First line of defense client-side; v1.0 moves authority server-side.
export const INTEGRITY=(()=>{
  function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,'0');}
  let sig='',partsFn=null;
  return{
    init(coreFns,constParts){partsFn=()=>constParts.join(',')+'␟'+coreFns.map(f=>f.toString()).join('␟');sig=hash(partsFn());},
    get ok(){return !!sig&&!!partsFn&&hash(partsFn())===sig;},
    get hash(){return sig||'--------';}
  };
})();
export function freezeConfig(...objs){try{for(const o of objs)Object.freeze(o);}catch(e){}}
