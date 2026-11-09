// game/config.js — TerritoryShatter static data & tuning
export const VERSION='0.10.3-beta';
export const W=54,H=54,CELL=24;
export const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
export const BOT_NAMES=["VoidFox","NeonNinja","PixelPanda","GlitchQueen","TurboTurtle","CosmicCat","ShadowByte","MangoMantis","CyberWolf","LunaLynx"];
export const PALETTE=["#00c8f5","#ff2ea6","#ffc800","#2fe86a","#ff7b00","#a35bff","#00d98a","#ff4d4d","#3f9dff","#ffd80f"];
export const idx=(x,y)=>y*W+x;
export const inB=(x,y)=>x>=0&&x<W&&y>=0&&y<H;
