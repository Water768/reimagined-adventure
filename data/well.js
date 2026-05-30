/* Hearthstead — well (static data) */
'use strict';

const WELL_BRICKS_REQUIRED = 50;
const WELL_DISPLAY_NAME = 'Well (bucketless)';
const WELL_DISPLAY_LABEL = 'well (bucketless)';
const WELL_DRY_NAME = 'Well (dry)';
const WELL_DRY_LABEL = 'well (dry)';
const WELL_HYDRATED_NAME = 'Well';
const WELL_HYDRATED_LABEL = 'well';
const WELL_HYDRATE_WATER_LEVEL = 10;
const WELL_COIN_WATER_XP = 5;
const WELL_FILL_VESSEL_MS = 250;
const WELL_FILL_VESSEL_WATER_XP = 4;

const WATER_VESSELS = [
  {
    emptyKey:'bucket',
    filledKey:'bucket_of_water',
    emptyIcon:'🪣',
    emptyName:'Bucket',
    filledIcon:'🪣',
    filledName:'Bucket of Water',
  },
  {
    emptyKey:'empty_vial',
    filledKey:'vial_of_water',
    emptyIcon:'🧪',
    emptyName:'Empty Vial',
    filledIcon:'🧪',
    filledName:'Vial of Water',
  },
  {
    emptyKey:'glass_bottle',
    filledKey:'glass_bottle_of_water',
    emptyIcon:'🍾',
    emptyName:'Glass Bottle',
    filledIcon:'🍾',
    filledName:'Glass Bottle of Water',
  },
  {
    emptyKey:'glass_bowl',
    filledKey:'glass_bowl_of_water',
    emptyIcon:'🥣',
    emptyName:'Glass Bowl',
    filledIcon:'🥣',
    filledName:'Glass Bowl of Water',
  },
  {
    emptyKey:'empty_fish_tank',
    filledKey:'fish_tank_of_water',
    emptyIcon:'🐠',
    emptyName:'Empty Fish Tank',
    filledIcon:'🐠',
    filledName:'Fish Tank of Water',
  },
];

const WELL_ROPE_SLOT = 24;
const WELL_BUCKET_SLOT = 25;
const WELL_WATER_BORDER_SLOTS = [14, 15, 23, 26, 34, 35];

const WELL_ITEM_DEFS = {
  rope:   { key:'rope',   icon:'⛓️', name:'Rope',   vibe:'Strong cord for drawing water from a well.' },
  bucket: { key:'bucket', icon:'🪣', name:'Bucket', vibe:'A bucket to haul water up from the depths.' },
};

const OLD_COIN_DEF = {
  key:'old_coin',
  icon:'🪙',
  name:'Old Coin',
  vibe:'A worn coin from who-knows-when. Might still buy a wish.',
};

const WELL_COIN_TOSS_MSGS = [
  'It lands on heads. You think. You can\'t see it though.',
  'Plink. Somewhere down there, a very old frog is richer.',
  'The coin vanishes. You hear a distant "thank you".',
  'You toss it in. The well accepts your offering in silence.',
  'It hits the side twice, then goes quiet. Auspicious, probably.',
  'Splash. You wait for luck. The well waits with you.',
  'Heads or tails? The well is not telling.',
  'You drop the coin and immediately forget which way it landed.',
  'A tiny ripple. Somewhere, a wish files for later.',
  'The coin is gone now. That feels like the whole point.',
];

const WELL_FILL_VESSEL_MSGS = [
  'Filled a {name}. +{xp} Water',
  '{name} topped up from the well. +{xp} Water',
  'Cold well water — now a {name}. +{xp} Water',
  'Up comes a {name}, sloshing nicely. +{xp} Water',
];

function getWaterVesselByEmptyKey(emptyKey){
  return WATER_VESSELS.find(v=>v.emptyKey===emptyKey)||null;
}

function buildEmptyVesselQueue(){
  const byKey={};
  WATER_VESSELS.forEach(v=>{ byKey[v.emptyKey]=v; });
  const queue=[];
  Object.entries(state.inventory).forEach(([itemKey,item])=>{
    const vessel=byKey[itemKey];
    if(!vessel||!item?.count) return;
    for(let i=0;i<item.count;i++) queue.push(vessel);
  });
  return queue;
}

function countEmptyVesselsInBag(){
  return buildEmptyVesselQueue().length;
}

function getWellArchXpPerBrick(){
  return structureArchXpForMaterial('brick');
}

function getWellStage(cfg){
  if(!cfg) return 'building';
  if(cfg.hydrated) return 'hydrated';
  if(cfg.equipped) return 'equipped';
  if(cfg.bucketless||cfg.bricks>=WELL_BRICKS_REQUIRED) return 'bucketless';
  return 'building';
}

function getWellDisplayName(stage){
  if(stage==='hydrated') return WELL_HYDRATED_NAME;
  if(stage==='equipped') return WELL_DRY_NAME;
  return WELL_DISPLAY_NAME;
}

function getWellWallGridCells(cfg){
  const stage=getWellStage(cfg);
  if(stage!=='equipped'&&stage!=='hydrated') return null;
  const hydrated=stage==='hydrated';
  const cells=[];
  for(let i=0;i<WELL_BRICKS_REQUIRED;i++){
    let content='🧱';
    let cls='filled';
    if(i===WELL_ROPE_SLOT){ content='⛓️'; cls='well-rope-cell'; }
    else if(i===WELL_BUCKET_SLOT){ content='🪣'; cls='well-bucket-cell'; }
    else if(hydrated&&WELL_WATER_BORDER_SLOTS.includes(i)){
      content='💧';
      cls='well-water-border-cell';
    }
    cells.push({ content, cls });
  }
  return cells;
}

function buildWellWallGridHtml(cfg, opts){
  const cells=getWellWallGridCells(cfg);
  if(!cells) return '';
  const mini=!!opts?.mini;
  const cls='well-wall-grid'+(mini?' well-wall-grid-mini':'');
  return '<div class="'+cls+'">'
    +cells.map(c=>'<div class="well-brick-slot '+c.cls+'">'+c.content+'</div>').join('')
    +'</div>';
}

function getWellVisualState(cfg){
  const stage=getWellStage(cfg);
  const n=Math.min(WELL_BRICKS_REQUIRED, Math.max(0, cfg?.bricks|0));
  if(stage==='hydrated'){
    return { icon:'🪣', label:WELL_HYDRATED_LABEL, stage:'hydrated' };
  }
  if(stage==='equipped'){
    return { icon:'🪣', label:WELL_DRY_LABEL, stage:'equipped' };
  }
  if(stage==='bucketless'){
    return { icon:'🪣', label:WELL_DISPLAY_LABEL, stage:'bucketless' };
  }
  if(n>=30) return { icon:'🧱', label:n+'/'+WELL_BRICKS_REQUIRED, stage:'stage-3' };
  if(n>=10) return { icon:'🧱', label:n+'/'+WELL_BRICKS_REQUIRED, stage:'stage-2' };
  return { icon:'▫️', label:n+'/'+WELL_BRICKS_REQUIRED, stage:'stage-1' };
}

function isPlotTileWaterSource(slot){
  if(!slot) return false;
  const def=typeof getPlotTileDef==='function'?getPlotTileDef(slot.typeId):null;
  if(def?.waterSource) return true;
  if(def?.behavior==='well'&&typeof getWellConfig==='function'){
    return getWellStage(getWellConfig(slot.instanceId))==='hydrated';
  }
  return false;
}

function isWaterSourceInstanceId(instanceId){
  if(!instanceId||typeof findPlotSlotByInstanceId!=='function') return false;
  const found=findPlotSlotByInstanceId(instanceId);
  return isPlotTileWaterSource(found?.slot);
}

function forEachWaterSource(fn){
  if(typeof forEachPlotOccupied!=='function') return;
  forEachPlotOccupied((x,y,slot)=>{
    if(isPlotTileWaterSource(slot)) fn(x,y,slot);
  });
}
