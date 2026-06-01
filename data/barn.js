/* Hearthstead — small barn (static data) */
'use strict';

const BARN_ARCH_UNLOCK = 5;
const BARN_FRAME_LOGS = 200;
const BARN_FRAME_NAILS = 200;
const BARN_ROOF_SLATE = 50;
const BARN_ROOF_NAILS = 50;
const BARN_DOOR_ASHWOOD = 50;
const BARN_DOOR_NAILS = 50;

/** Weakest craftable nail tier first when consuming for barn builds (no rusty nails). */
const STRUCTURE_NAIL_ORDER = ['copper','bronze','iron','steel','titanium','gilded'];
const BARN_NAIL_ORDER = STRUCTURE_NAIL_ORDER;

const BARN_NAIL_ARCH_UNLOCK = {
  rusty: 1,
  copper: 3,
  bronze: 6,
  iron: 12,
  steel: 25,
  titanium: 35,
  gilded: 40,
};

const BARN_FRAME_MATERIALS = [
  { key:'logs', countKey:'frameLogs', icon:'🪵', name:'Log', required:BARN_FRAME_LOGS },
  { key:'nails', countKey:'frameNails', icon:'🔩', name:'Nails', required:BARN_FRAME_NAILS, aggregate:true },
];

const BARN_ROOF_MATERIALS = [
  { key:'slate', countKey:'roofSlate', icon:'🩶', name:'Slate', required:BARN_ROOF_SLATE },
  { key:'nails', countKey:'roofNails', icon:'🔩', name:'Nails', required:BARN_ROOF_NAILS, aggregate:true },
];

const BARN_DOOR_MATERIALS = [
  { key:'ashwood', countKey:'doorAshwood', icon:'🪵', name:'Ashwood', required:BARN_DOOR_ASHWOOD },
  { key:'nails', countKey:'doorNails', icon:'🔩', name:'Nails', required:BARN_DOOR_NAILS, aggregate:true },
];

const BARN_SITE_LABEL = 'small barn';
const BARN_WALLS_LABEL = 'small barn (walls)';
const BARN_DOORLESS_LABEL = 'small barn (doorless)';
const BARN_COMPLETE_LABEL = 'small barn';
const BARN_MEDIUM_LABEL = 'medium barn';
const BARN_LARGE_LABEL = 'large barn';

const BARN_MEDIUM_ARCH_UNLOCK = 15;
const BARN_LARGE_UPGRADE_ARCH_UNLOCK = 35;

const BARN_LARGE_UPGRADE_MATERIALS = [
  { key:'copper_ore', icon:'🟤', name:'Copper ore', required:1 },
  { key:'stone', icon:'🪨', name:'Stone', required:1 },
  { key:'coal', icon:'⚫', name:'Coal', required:1 },
  { key:'quartz', icon:'💎', name:'Quartz', required:1 },
];
const BARN_UPGRADE_LOGS = 300;
const BARN_UPGRADE_STONE = 200;
const BARN_UPGRADE_SLATE = 100;
const BARN_UPGRADE_NAILS = 800;

const BARN_UPGRADE_MATERIALS = [
  { key:'logs', icon:'🪵', name:'Logs', required:BARN_UPGRADE_LOGS },
  { key:'stone', icon:'🪨', name:'Stone', required:BARN_UPGRADE_STONE },
  { key:'slate', icon:'🩶', name:'Slate', required:BARN_UPGRADE_SLATE },
  { key:'nails', icon:'🔩', name:'Nails', required:BARN_UPGRADE_NAILS, aggregate:true },
];

function isMediumBarn(cfg){
  return cfg?.size==='medium';
}

function isLargeBarn(cfg){
  return cfg?.size==='large';
}

function isMultiTileBarn(cfg){
  return isMediumBarn(cfg)||isLargeBarn(cfg);
}

function getBarnAnimalSlotCount(cfg){
  if(isLargeBarn(cfg)) return typeof BARN_LARGE_ANIMAL_SLOTS==='number'?BARN_LARGE_ANIMAL_SLOTS:4;
  if(isMediumBarn(cfg)) return typeof BARN_MEDIUM_ANIMAL_SLOTS==='number'?BARN_MEDIUM_ANIMAL_SLOTS:2;
  return typeof BARN_SMALL_ANIMAL_SLOTS==='number'?BARN_SMALL_ANIMAL_SLOTS:1;
}

function getMediumBarnTypeId(){
  return 'medium_barn_complete';
}

function getLargeBarnTypeId(){
  return 'large_barn_complete';
}

function getBarnPlotTypeId(cfg){
  if(isLargeBarn(cfg)) return getLargeBarnTypeId();
  if(isMediumBarn(cfg)) return getMediumBarnTypeId();
  return 'small_barn_complete';
}

function getBarnFootprintOffsets(orientation, size){
  if(size!=='medium'&&size!=='large') return [{ dx:0, dy:0 }];
  if(orientation==='v') return [{ dx:0, dy:0 }, { dx:0, dy:1 }];
  return [{ dx:0, dy:0 }, { dx:1, dy:0 }];
}

function getWoodUnlockLevelForLog(logKey){
  for(const w of WOODLANDS||[]){
    if(w.drops?.some(d=>d.log===logKey)) return w.unlockLevel|0;
  }
  return 1;
}

function getBarnArchXpForNail(nailKey){
  const lvl=BARN_NAIL_ARCH_UNLOCK[nailKey]|0||1;
  return Math.max(0, lvl)*2;
}

function getBarnArchXpForMaterial(materialKey){
  if(materialKey==='nails') return getBarnArchXpForNail('iron');
  if(MINE_RESOURCE_DEFS?.[materialKey]) return structureArchXpForMaterial(materialKey);
  if(LOG_DEFS?.[materialKey]) return Math.max(0, getWoodUnlockLevelForLog(materialKey))*2;
  return structureArchXpForMaterial(materialKey);
}

function getBarnMaterialsForStage(stage){
  if(stage==='frame') return BARN_FRAME_MATERIALS;
  if(stage==='roof') return BARN_ROOF_MATERIALS;
  if(stage==='door') return BARN_DOOR_MATERIALS;
  return [];
}

function isBarnFrameComplete(cfg){
  if(!cfg) return false;
  if(cfg.framed) return true;
  return (cfg.frameLogs|0)>=BARN_FRAME_LOGS&&(cfg.frameNails|0)>=BARN_FRAME_NAILS;
}

function isBarnRoofComplete(cfg){
  if(!cfg) return false;
  if(cfg.roofed) return true;
  return (cfg.roofSlate|0)>=BARN_ROOF_SLATE&&(cfg.roofNails|0)>=BARN_ROOF_NAILS;
}

function isBarnComplete(cfg){
  if(!cfg) return false;
  if(cfg.complete) return true;
  return (cfg.doorAshwood|0)>=BARN_DOOR_ASHWOOD&&(cfg.doorNails|0)>=BARN_DOOR_NAILS;
}

function getBarnStage(cfg){
  if(!isBarnFrameComplete(cfg)) return 'frame';
  if(!isBarnRoofComplete(cfg)) return 'roof';
  if(!isBarnComplete(cfg)) return 'door';
  return 'complete';
}

function getBarnTypeIdForStage(stage){
  if(stage==='frame') return 'small_barn';
  if(stage==='roof') return 'small_barn_walls';
  if(stage==='door') return 'small_barn_doorless';
  return 'small_barn_complete';
}

function getBarnPlotLabel(cfg, typeId){
  const stage=getBarnStage(cfg);
  if(stage==='complete') return BARN_COMPLETE_LABEL;
  if(typeId==='small_barn_walls'||stage==='roof') return BARN_WALLS_LABEL;
  if(typeId==='small_barn_doorless'||stage==='door') return BARN_DOORLESS_LABEL;
  return BARN_SITE_LABEL;
}

function getBarnDisplayName(typeId, cfg){
  const stage=cfg?getBarnStage(cfg):'frame';
  if(stage==='complete'){
    if(isLargeBarn(cfg)||typeId==='large_barn_complete') return 'Large Barn';
    if(isMediumBarn(cfg)||typeId==='medium_barn_complete') return 'Medium Barn';
    return 'Small Barn';
  }
  const def=PLOT_TILE_DEFS?.[typeId]||PLOT_TILE_DEFS?.small_barn;
  return def?.name||'Small Barn';
}

function getBarnStageLabel(stage, cfg){
  if(stage==='frame') return 'Raise the frame — 200 logs and 200 nails';
  if(stage==='roof') return 'Lay the roof — 50 slate and 50 nails';
  if(stage==='door') return 'Hang the barn door — 50 ashwood and 50 nails';
  if(isLargeBarn(cfg)) return 'Four animal slots — enter the barn to see your livestock';
  if(isMediumBarn(cfg)) return 'Two animal slots — adopt, feed, and collect produce';
  return 'One animal slot — adopt, feed, and collect produce';
}

function getBarnProgress(cfg){
  if(!cfg) return 0;
  const stage=getBarnStage(cfg);
  const mats=getBarnMaterialsForStage(stage);
  if(stage==='complete'){
    return BARN_FRAME_LOGS+BARN_FRAME_NAILS+BARN_ROOF_SLATE+BARN_ROOF_NAILS+BARN_DOOR_ASHWOOD+BARN_DOOR_NAILS;
  }
  let prior=0;
  if(stage==='roof'||stage==='door'){
    prior+=BARN_FRAME_LOGS+BARN_FRAME_NAILS;
  }
  if(stage==='door'){
    prior+=BARN_ROOF_SLATE+BARN_ROOF_NAILS;
  }
  const current=mats.reduce((sum,m)=>sum+Math.min(cfg[m.countKey]|0, m.required), 0);
  return prior+current;
}

function getBarnTotalRequired(){
  return BARN_FRAME_LOGS+BARN_FRAME_NAILS+BARN_ROOF_SLATE+BARN_ROOF_NAILS+BARN_DOOR_ASHWOOD+BARN_DOOR_NAILS;
}

function getBarnVisualState(cfg, typeId){
  const stage=getBarnStage(cfg);
  const isLarge=typeId==='large_barn_complete'||(typeof isLargeBarn==='function'&&isLargeBarn(cfg));
  const isMedium=!isLarge&&(typeId==='medium_barn_complete'||(typeof isMediumBarn==='function'&&isMediumBarn(cfg)));
  const multi=isMedium||isLarge||typeId==='medium_barn_complete'||typeId==='large_barn_complete'
    ||(typeof isMultiTileBarn==='function'&&isMultiTileBarn(cfg));
  const label=isLarge?BARN_LARGE_LABEL:(isMedium?BARN_MEDIUM_LABEL:getBarnPlotLabel(cfg, typeId));
  if(stage==='complete'){
    return {
      icon:multi?'🏛️':'🏚️',
      label,
      stage:'complete',
      medium:multi&&!isLarge,
      large:isLarge,
    };
  }
  if(stage==='door'){
    return { icon:'🚪', label, stage:'doorless' };
  }
  if(stage==='roof'){
    return { icon:'🏗️', label, stage:'walls' };
  }
  return { icon:'▫️', label, stage:'building' };
}

function getBarnMaterialDef(materialKey, stage){
  return getBarnMaterialsForStage(stage||'frame').find(m=>m.key===materialKey)||null;
}
