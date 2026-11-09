// engine/assets.js — versioned image loading with failure reporting
export class ImageAssets{
  constructor(version){this.version=version;this.images={};this.failed=0;this.onError=null;}
  /** map: {key: 'path/to.png'} -> loads path?v=version */
  load(map){
    for(const k of Object.keys(map)){
      const im=new Image();
      im.onload=()=>{this.images[k]=im;if(this.onLoadOne)this.onLoadOne(k);};
      im.onerror=()=>{this.failed++;if(this.onError)this.onError(k,map[k]);};
      im.src=map[k]+'?v='+this.version;
    }
  }
  get(k){return this.images[k];}
  ready(k){return !!this.images[k];}
}
