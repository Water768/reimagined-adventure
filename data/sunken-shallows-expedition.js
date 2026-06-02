/* Hearthstead — Sunken Shallows expedition requirements & loot */
'use strict';

/** Bronze pickaxe bound to the tool store for long-trek salvage checks. */
const SUNKEN_SHALLOWS_TOOL_KEY='pickaxe_2';

const SHALLOWS_SHORT_PICK_POOL=['stamina','medicine','empty_bucket'];
const SHALLOWS_MEDIUM_SHUFFLE_POOL=['potions','torches','defense'];
const SHALLOWS_MEDIUM_CONSUMABLE_QTY={ medium:2, long:4 };
const SHALLOWS_INFUSED_CHARM_NEED=20;

/** Target empty-bucket counts per tier — rolled with spread when buckets are picked. */
const SHALLOWS_BUCKET_AVG={ short:10, medium:50, long:120 };

const SHALLOWS_SAND_BULK_AVG=SHALLOWS_BUCKET_AVG;

/** Weighted standard loot — targets approximate tier averages over many runs. */
const SUNKEN_SHALLOWS_LOOT_POOL=[
  { key:'barnacles', icon:'🦀', name:'Barnacles', weight:33 },
  { key:'artefact_basic', icon:'🏺', name:'Basic Artefact', weight:27 },
  { key:'wet_artefact', icon:'🏺', name:'Wet Artefact', weight:11 },
  { key:'sunken_timber', icon:'🪵', name:'Sunken Timber', weight:10 },
  { key:'sunken_lockbox', icon:'📦', name:'Sunken Lockbox', weight:10 },
];

const SUNKEN_SHALLOWS_SUPER_RARE_POOL=[
  { key:'pristine_pearl', icon:'🐚', name:'Pristine Pearl' },
  { key:'shallows_map_fragment_1', icon:'🗺️', name:'Shallows Map Fragment (Piece 1)' },
  { key:'shallows_map_fragment_2', icon:'🗺️', name:'Shallows Map Fragment (Piece 2)' },
];

const EMPTY_BUCKET_ITEM_KEY='bucket';

function rollShallowsShortPicks(){
  const pool=SHALLOWS_SHORT_PICK_POOL.slice();
  const picks=[];
  while(picks.length<2&&pool.length){
    const i=Math.floor(Math.random()*pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
}

function rollShallowsBucketNeed(tierKey){
  const avg=SHALLOWS_BUCKET_AVG[tierKey]||SHALLOWS_BUCKET_AVG.short;
  const spread=Math.max(2, Math.floor(avg*0.35));
  const min=Math.max(1, avg-spread);
  const max=avg+spread;
  return min+Math.floor(Math.random()*(max-min+1));
}

function ensureShallowsBucketRequired(tierKey){
  if(!state.exploreSunkenShallowsBucketRolls) state.exploreSunkenShallowsBucketRolls={};
  const key=tierKey||'short';
  if(state.exploreSunkenShallowsBucketRolls[key]==null){
    state.exploreSunkenShallowsBucketRolls[key]=rollShallowsBucketNeed(key);
    scheduleSaveGame();
  }
  return state.exploreSunkenShallowsBucketRolls[key];
}

function rollShallowsMediumDynamic(tierKey){
  const shuffleType=SHALLOWS_MEDIUM_SHUFFLE_POOL[Math.floor(Math.random()*SHALLOWS_MEDIUM_SHUFFLE_POOL.length)];
  const isLong=tierKey==='long';
  const affMin=isLong?15:5;
  const affMax=isLong?25:15;
  const affinityLevel=affMin+Math.floor(Math.random()*(affMax-affMin+1));
  const affinitySkill=Math.random()<0.5?'water':'fire';
  const consumableQty=SHALLOWS_MEDIUM_CONSUMABLE_QTY[tierKey]||SHALLOWS_MEDIUM_CONSUMABLE_QTY.medium;
  return { shuffleType, affinityLevel, affinitySkill, consumableQty };
}

function ensureSunkenShallowsRolls(tierKey){
  if(!state.exploreSunkenShallowsRolls) state.exploreSunkenShallowsRolls={};
  if(!state.exploreSunkenShallowsRolls.shortPicks){
    state.exploreSunkenShallowsRolls.shortPicks=rollShallowsShortPicks();
    scheduleSaveGame();
  }
  if((tierKey==='medium'||tierKey==='long')&&!state.exploreSunkenShallowsRolls.medium){
    state.exploreSunkenShallowsRolls.medium=rollShallowsMediumDynamic('medium');
    scheduleSaveGame();
  }
  if(tierKey==='long'&&!state.exploreSunkenShallowsRolls.long){
    state.exploreSunkenShallowsRolls.long=rollShallowsMediumDynamic('long');
    scheduleSaveGame();
  }
  return state.exploreSunkenShallowsRolls;
}

function clearSunkenShallowsRolls(){
  state.exploreSunkenShallowsRolls={};
  state.exploreSunkenShallowsBucketRolls={};
  scheduleSaveGame();
}

function buildShallowsPickRequirement(pick, tierKey){
  switch(pick){
    case 'stamina':
      return { type:EXPEDITION_REQ_TYPE.STAMINA, value:1 };
    case 'medicine':
      return { type:EXPEDITION_REQ_TYPE.MEDICINE, value:1 };
    case 'empty_bucket':
      return { type:EXPEDITION_REQ_TYPE.EMPTY_BUCKET, value:ensureShallowsBucketRequired(tierKey) };
    default:
      return { type:EXPEDITION_REQ_TYPE.RESERVED, value:0 };
  }
}

function getShallowsColumnOneRequirements(tierKey){
  ensureSunkenShallowsRolls('short');
  const picks=state.exploreSunkenShallowsRolls.shortPicks||[];
  const reqs=picks.map(pick=>buildShallowsPickRequirement(pick, tierKey));
  while(reqs.length<2) reqs.push({ type:EXPEDITION_REQ_TYPE.RESERVED, value:0 });
  return reqs.slice(0, 2);
}

function buildShallowsMediumShuffleRequirement(rolls){
  if(!rolls) return { type:EXPEDITION_REQ_TYPE.RESERVED, value:0 };
  switch(rolls.shuffleType){
    case 'potions':
      return { type:EXPEDITION_REQ_TYPE.POTION, value:rolls.consumableQty };
    case 'torches':
      return { type:EXPEDITION_REQ_TYPE.TORCH, value:rolls.consumableQty };
    case 'defense':
      return { type:EXPEDITION_REQ_TYPE.DEFENSE_RATING, value:1 };
    default:
      return { type:EXPEDITION_REQ_TYPE.RESERVED, value:0 };
  }
}

function buildShallowsAffinityRequirement(rolls){
  if(!rolls) return { type:EXPEDITION_REQ_TYPE.RESERVED, value:0 };
  if(rolls.affinitySkill==='fire'){
    return { type:EXPEDITION_REQ_TYPE.FIRE_AFFINITY, value:rolls.affinityLevel };
  }
  return { type:EXPEDITION_REQ_TYPE.WATER_AFFINITY, value:rolls.affinityLevel };
}

function getSunkenShallowsRequirementColumns(tierKey){
  const tier=tierKey||'short';
  const needsMedium=tier==='medium'||tier==='long';
  const needsLong=tier==='long';
  const col1=getShallowsColumnOneRequirements(tier);
  const rolls=needsLong?ensureSunkenShallowsRolls('long').long
    :needsMedium?ensureSunkenShallowsRolls('medium').medium:null;
  return [
    col1,
    [
      needsMedium?buildShallowsMediumShuffleRequirement(rolls):{ type:EXPEDITION_REQ_TYPE.RESERVED, value:0 },
      needsMedium?buildShallowsAffinityRequirement(rolls):{ type:EXPEDITION_REQ_TYPE.RESERVED, value:0 },
    ],
    [
      needsLong?{ type:EXPEDITION_REQ_TYPE.INFUSED_CHARM, value:SHALLOWS_INFUSED_CHARM_NEED }:{ type:EXPEDITION_REQ_TYPE.RESERVED, value:0 },
      needsLong?{ type:EXPEDITION_REQ_TYPE.EQUIPPED_TOOL, value:1, toolKey:SUNKEN_SHALLOWS_TOOL_KEY }:{ type:EXPEDITION_REQ_TYPE.RESERVED, value:0 },
    ],
  ];
}

function buildSunkenShallowsExpeditionRequirements(tierKey){
  return getSunkenShallowsRequirementColumns(tierKey).flat();
}

function rollShallowsSandBulk(tierKey){
  return rollShallowsBucketNeed(tierKey);
}

function applySunkenShallowsSandBulkLoot(loot, tierKey){
  const sand=rollShallowsSandBulk(tierKey);
  if(sand>0) loot.bucket_of_sand=(loot.bucket_of_sand||0)+sand;
  return sand;
}

function countEmptyBucketsAvailable(){
  return typeof itemCountBagAndStore==='function'?itemCountBagAndStore(EMPTY_BUCKET_ITEM_KEY):0;
}

function getWaterAffinityLevel(){
  return state.skills?.water?.level|0;
}

function getFireAffinityLevel(){
  return state.skills?.fire?.level|0;
}

function isExpeditionDefenseRatingMet(){
  return typeof isExpeditionArmourRequirementMet==='function'&&isExpeditionArmourRequirementMet();
}

function isSunkenShallowsToolEquipped(){
  if(typeof ensureToolStoreTools==='function') ensureToolStoreTools();
  return typeof getOwnedToolStorePickaxeKeys==='function'
    &&getOwnedToolStorePickaxeKeys().includes(SUNKEN_SHALLOWS_TOOL_KEY);
}

function getSunkenShallowsReqDisplayMeta(req){
  switch(req?.type){
    case EXPEDITION_REQ_TYPE.EMPTY_BUCKET:{
      const need=Number(req?.value)||SHALLOWS_BUCKET_AVG.short;
      return {
        icon:'🪣',
        label:need===1?'Empty Bucket':'Empty Buckets',
        sub:need+' empty wooden bucket'+(need===1?'':'s'),
      };
    }
    case EXPEDITION_REQ_TYPE.POTION:{
      const def=typeof getWhisperWoodsExpeditionItemDef==='function'?getWhisperWoodsExpeditionItemDef(EXPEDITION_POTION_KEY):null;
      return { icon:def?.icon||'🧪', label:'Potions', sub:'Travel potions' };
    }
    case EXPEDITION_REQ_TYPE.DEFENSE_RATING:
      return { icon:'🛡️', label:'Defense', sub:'Body armour equipped' };
    case EXPEDITION_REQ_TYPE.WATER_AFFINITY:
      return { icon:'💧', label:'Water', sub:'Water skill level' };
    case EXPEDITION_REQ_TYPE.FIRE_AFFINITY:
      return { icon:'🔥', label:'Fire', sub:'Fire skill level' };
    case EXPEDITION_REQ_TYPE.INFUSED_CHARM:{
      const def=typeof getWhisperWoodsExpeditionItemDef==='function'?getWhisperWoodsExpeditionItemDef(INFUSED_CHARM_KEY):null;
      return { icon:def?.icon||'✨', label:def?.name||'Infused Charm', sub:'From storage on launch' };
    }
    case EXPEDITION_REQ_TYPE.EQUIPPED_TOOL:{
      const toolKey=req.toolKey||SUNKEN_SHALLOWS_TOOL_KEY;
      const pick=typeof PICKAXE_BY_KEY!=='undefined'?PICKAXE_BY_KEY[toolKey]:null;
      return { icon:pick?.icon||'⛏️', label:pick?.name||'Bronze Pickaxe', sub:'Bound to tool store' };
    }
    default:
      return { icon:'▫️', label:'Requirement', sub:'' };
  }
}
