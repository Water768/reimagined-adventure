/* Hearthstead — fire pit (static data) */
'use strict';

const FIRE_PIT_ARCH_UNLOCK = 4;
const FIRE_PIT_MATERIALS = [
  { key:'stone', countKey:'stone', icon:'🪨', name:'Stone', required:50 },
  { key:'clay', countKey:'clay', icon:'🟤', name:'Clay', required:50 },
  { key:'brick', countKey:'bricks', icon:'🧱', name:'Brick', required:50 },
];
const FIRE_PIT_DISPLAY_NAME = 'Fire Pit';
const FIRE_PIT_BUILDING_LABEL = 'fire pit (building)';
const FIRE_PIT_COMPLETE_LABEL = 'fire pit';

function getFirePitArchXpForMaterial(materialKey){
  return structureArchXpForMaterial(materialKey);
}

function getFirePitMaterialDef(materialKey){
  return FIRE_PIT_MATERIALS.find(m=>m.key===materialKey)||null;
}

function getFirePitTotalRequired(){
  return FIRE_PIT_MATERIALS.reduce((sum,m)=>sum+m.required, 0);
}

function isFirePitComplete(cfg){
  if(!cfg) return false;
  if(cfg.complete) return true;
  return FIRE_PIT_MATERIALS.every(m=>(cfg[m.countKey]|0)>=m.required);
}

function getFirePitStage(cfg){
  return isFirePitComplete(cfg)?'complete':'building';
}

function getFirePitProgress(cfg){
  if(!cfg) return 0;
  return FIRE_PIT_MATERIALS.reduce((sum,m)=>sum+Math.min(cfg[m.countKey]|0, m.required), 0);
}

function getFirePitVisualState(cfg){
  const stage=getFirePitStage(cfg);
  if(stage==='complete'){
    return { icon:'🔥', label:FIRE_PIT_COMPLETE_LABEL, stage:'complete' };
  }
  const total=getFirePitProgress(cfg);
  const max=getFirePitTotalRequired();
  if(total>=100) return { icon:'🔥', label:total+'/'+max, stage:'stage-3' };
  if(total>=50) return { icon:'🪨', label:total+'/'+max, stage:'stage-2' };
  return { icon:'▫️', label:total+'/'+max, stage:'stage-1' };
}

const FIRE_PIT_FURNITURE_SHARDS={
  simple:1, hardwood:2, artisan:3, mythical:5,
};

function firePitBaseFurnitureSuccessRate(recipe){
  if(!recipe) return 0.1;
  return Math.min(100, Math.max(1, recipe.baseFurnitureChance??10))/100;
}

function firePitReferenceLogForRecipe(recipe){
  if(!recipe) return 'logs';
  if(recipe.referenceLog&&LOG_DEFS[recipe.referenceLog]) return recipe.referenceLog;
  const allowed=typeof resolveAllowedWoods==='function'?resolveAllowedWoods(recipe.allowedWoods):['logs'];
  if(allowed.length===1) return allowed[0];
  return 'logs';
}

function firePitExpectedLogsForFurniture(recipe){
  if(!recipe) return 1;
  const p=firePitBaseFurnitureSuccessRate(recipe);
  return Math.max(1, Math.floor(recipe.stages/p));
}

function firePitExpectedWoodcutXpForFurniture(recipe){
  if(!recipe) return woodcutXpForLog('logs');
  const logKey=firePitReferenceLogForRecipe(recipe);
  return firePitExpectedLogsForFurniture(recipe)*woodcutXpForLog(logKey);
}

function firePitFireXpForLog(logKey){
  const key=logKey||'logs';
  return Math.max(1, Math.floor(woodcutXpForLog(key)*FIRE_PIT_LOG_BURN_XP_RATE));
}

function getCraftRecipeForFurnitureKey(furnitureKey){
  for(const id of Object.keys(FURNITURE_CRAFTS||{})){
    const r=FURNITURE_CRAFTS[id];
    if(r.furnitureKey===furnitureKey||r.id===furnitureKey) return r;
  }
  return null;
}

function firePitFireXpForFurniture(furnitureKey){
  const recipe=getCraftRecipeForFurnitureKey(furnitureKey);
  return firePitExpectedWoodcutXpForFurniture(recipe);
}

function firePitShardsForFurniture(furnitureKey){
  const recipe=getCraftRecipeForFurnitureKey(furnitureKey);
  const tier=recipe?.tier||'simple';
  return FIRE_PIT_FURNITURE_SHARDS[tier]||1;
}
