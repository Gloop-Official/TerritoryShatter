// game/config.js — TerritoryShatter static data & tuning
export const VERSION='0.18.0-beta';
export const W=54,H=54,CELL=24;
export const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
export const BOT_NAMES=["VoidFox","NeonNinja","PixelPanda","GlitchQueen","TurboTurtle","CosmicCat","ShadowByte","MangoMantis","CyberWolf","LunaLynx"];
export const PALETTE=["#00c8f5","#ff2ea6","#ffc800","#2fe86a","#ff7b00","#a35bff","#00d98a","#ff4d4d","#3f9dff","#ffd80f"];
// Legend-style roster: the lobby lobby lets you pick your rider; bots take the rest
export const ROSTER=[
 {name:'BOLT', colorIdx:0,tac:'stim', ult:'surge',blurb:'Pure speed. Loops before you blink.'},
 {name:'NEON', colorIdx:1,tac:'phase',ult:'nova', blurb:'Phases through trouble, detonates on exit.'},
 {name:'SOL',  colorIdx:2,tac:'scan', ult:'nova', blurb:'Sees everything. Owns the map.'},
 {name:'MISO', colorIdx:3,tac:'veil', ult:'surge',blurb:'Gone in a blink — back with half your turf.'},
 {name:'EMBER',colorIdx:4,tac:'stim', ult:'nova', blurb:'Too hot to trail behind.'},
 {name:'HEXA', colorIdx:5,tac:'phase',ult:'surge',blurb:'Ghost rider, magnet heart.'},
 {name:'MINT', colorIdx:6,tac:'scan', ult:'nova', blurb:'Calm. Cold. Surgical loops.'},
 {name:'RUBY', colorIdx:7,tac:'veil', ult:'nova', blurb:'Soft steps, loud shatters.'},
];
export const idx=(x,y)=>y*W+x;
export const inB=(x,y)=>x>=0&&x<W&&y>=0&&y<H;
