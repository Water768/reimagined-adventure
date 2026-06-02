/* Hearthstead — cave exploration (static data) */
'use strict';

const EXPLORATION_LAYER_FIRST_LEVEL=5;
const EXPLORATION_LAYER_STEP=10;

const EXPEDITION_REQ_SLOTS={
  rations:{key:'rations',label:'Rations',icon:'🐟',desc:'Uses available cooked fish'},
  medicine:{key:'medicine',label:'Medicine',icon:'💊',desc:'Healing supplies',submenuTitle:'Healing potential'},
  torch:{key:'torch',label:'Torch',icon:'🔥',desc:'Flaming torch',submenuTitle:'Flame quality'},
  reserved:{key:'reserved',label:'Reserved',icon:'▫️',desc:'Future supply slot'},
};

/** Requirement type ids — extend for future expedition destinations (castle, dungeons, etc.). */
const EXPEDITION_REQ_TYPE={
  STAMINA:'stamina',
  MEDICINE:'medicine',
  TORCH:'torch',
  POTION:'potion',
  ARMOUR:'armour',
  EARTH_AFFINITY:'earth_affinity',
  WATER_AFFINITY:'water_affinity',
  FIRE_AFFINITY:'fire_affinity',
  EMPTY_BUCKET:'empty_bucket',
  DEFENSE_RATING:'defense_rating',
  INFUSED_CHARM:'infused_charm',
  EQUIPPED_TOOL:'equipped_tool',
  RESERVED:'reserved',
};

const EXPEDITION_SLOT_TO_REQ_TYPE={
  rations:EXPEDITION_REQ_TYPE.STAMINA,
  medicine:EXPEDITION_REQ_TYPE.MEDICINE,
  torch:EXPEDITION_REQ_TYPE.TORCH,
};

const EXPEDITION_REQ_TYPE_TO_SLOT={
  [EXPEDITION_REQ_TYPE.STAMINA]:'rations',
  [EXPEDITION_REQ_TYPE.MEDICINE]:'medicine',
  [EXPEDITION_REQ_TYPE.TORCH]:'torch',
};

const EXPEDITION_STAMINA_RANGES={
  short:{min:100,max:200},
  medium:{min:450,max:650},
  long:{min:1200,max:1500},
};

const EXPEDITION_MEDICINE_ITEMS=[
  { key:'clean_bandage', recovery:1 },
  { key:'soothing_bandage', recovery:2 },
  { key:'improved_soothing_bandage', recovery:3 },
];

const EXPEDITION_TORCH_COUNT_RANGE={ min:1, max:3 };

/** Every expedition tier uses the same 6-slot grid; active slot count grows with difficulty. */
const EXPEDITION_STANDARD_SLOT_COUNT=6;

function getExpeditionDestinationKeyForRequirements(destKey){
  if(destKey) return destKey;
  if(typeof explore!=='undefined'&&explore.destinationKey) return explore.destinationKey;
  return 'cave';
}

/** Column 1: rations + medicine. Column 2: medium extras. Column 3: long extras. */
function getExpeditionRequirementColumns(tierKey, destKey){
  destKey=getExpeditionDestinationKeyForRequirements(destKey);
  if(destKey==='whispering_woods'&&typeof getWhisperWoodsRequirementColumns==='function'){
    return getWhisperWoodsRequirementColumns(tierKey);
  }
  if(destKey==='sunken_shallows'&&typeof getSunkenShallowsRequirementColumns==='function'){
    return getSunkenShallowsRequirementColumns(tierKey);
  }
  const tier=tierKey||'short';
  const needsMedium=tier==='medium'||tier==='long';
  const needsLong=tier==='long';
  return [
    [
      { type:EXPEDITION_REQ_TYPE.STAMINA, value:1 },
      { type:EXPEDITION_REQ_TYPE.MEDICINE, value:1 },
    ],
    [
      { type:EXPEDITION_REQ_TYPE.RESERVED, value:needsMedium?1:0 },
      { type:EXPEDITION_REQ_TYPE.RESERVED, value:needsMedium?1:0 },
    ],
    [
      { type:EXPEDITION_REQ_TYPE.RESERVED, value:needsLong?1:0 },
      { type:EXPEDITION_REQ_TYPE.RESERVED, value:needsLong?1:0 },
    ],
  ];
}

function getExpeditionActiveSlotCount(tierKey){
  const key=tierKey||'short';
  if(key==='medium') return 4;
  if(key==='long') return 6;
  return 2;
}

/** Flat requirement list for launch checks (column order: supplies → medium → long). */
function buildStandardExpeditionRequirements(tierKey, destKey){
  return getExpeditionRequirementColumns(tierKey, destKey).flat();
}

const EXPEDITION_TIERS={
  short:{
    key:'short',
    label:'Short',
    superRarePct:5,
    explorationXp:50,
    lootRolls:5,
  },
  medium:{
    key:'medium',
    label:'Medium',
    superRarePct:25,
    explorationXp:250,
    lootRolls:25,
  },
  long:{
    key:'long',
    label:'Long',
    superRarePct:55,
    explorationXp:550,
    lootRolls:55,
  },
};

const EXPEDITION_TIER_ORDER=['short','medium','long'];

const EXPEDITION_DURATION_MS={
  short:10000,
  medium:25000,
  long:45000,
};

const EXPEDITION_STAR_EXPLORATION_XP=5;
const EXPEDITION_STAR_AIR_XP=5;
const EXPEDITION_STAR_LIFETIME_MS=4000;

const EXPLORATION_LOOT_POOL=[
  {key:'brick',icon:'🧱',name:'Brick'},
  {key:'stone',icon:'🪨',name:'Stone'},
  {key:'clay',icon:'🟤',name:'Clay'},
  {key:'mushrooms',icon:'🍄',name:'Mushrooms'},
  {key:'basic_herbs',icon:'🌿',name:'Basic Herbs'},
  {key:'twisted_grass',icon:'🌾',name:'Twisted Grass'},
  {key:'copper_ore',icon:'🟤',name:'Copper Ore'},
  {key:'coal',icon:'⚫',name:'Coal'},
  {key:'reeds',icon:'🌾',name:'Reeds'},
  {key:'feathers',icon:'🪶',name:'Feathers'},
  {key:'artefact_basic',icon:'🏺',name:'Basic Artefact'},
  {key:'limestone',icon:'⬜',name:'Limestone'},
];

const EXPLORATION_SUPER_RARE_POOL=[
  {key:'quartz',icon:'💎',name:'Quartz'},
  {key:'artefact_rare',icon:'🗿',name:'Rare Artefact'},
  {key:'pickaxe',icon:'⛏️',name:'Pickaxe'},
  {key:'artefact_extreme',icon:'👑',name:'Extreme Artefact'},
  {key:'gold_ore',icon:'🟡',name:'Gold Ore'},
];

const WHISPERING_WOODS_LOOT_POOL=[
  {key:'basic_herbs',icon:'🌿',name:'Basic Herbs',weight:20},
  {key:'mushrooms',icon:'🍄',name:'Mushrooms',weight:20},
  {key:'wild_berries',icon:'🫐',name:'Wild Berries',weight:20},
  {key:'herbal_roots',icon:'🫚',name:'Herbal Roots',weight:20},
  {key:'artefact_basic',icon:'🏺',name:'Basic Artefact',weight:12},
  {key:'feathers',icon:'🪶',name:'Feathers',weight:3},
  {key:'twisted_grass',icon:'🌾',name:'Twisted Grass',weight:3},
  {key:'reeds',icon:'🌾',name:'Reeds',weight:3},
];

const WHISPERING_WOODS_MAP_FRAGMENT_ITEMS={
  forest_map_fragment_1:{
    key:'forest_map_fragment_1',
    icon:'🗺️',
    name:'Forest Map Fragment (Piece 1)',
    pieceNum:1,
  },
  forest_map_fragment_2:{
    key:'forest_map_fragment_2',
    icon:'🗺️',
    name:'Forest Map Fragment (Piece 2)',
    pieceNum:2,
  },
};

const WHISPERING_WOODS_SUPER_RARE_POOL=[
  {key:'yew',icon:'🪵',name:'Yew'},
  {key:'silverbirch',icon:'🪵',name:'Silverbirch'},
  {key:'artefact_rare',icon:'🗿',name:'Rare Artefact'},
  {key:'forest_map_fragment_1',icon:'🗺️',name:'Forest Map Fragment (Piece 1)'},
  {key:'forest_map_fragment_2',icon:'🗺️',name:'Forest Map Fragment (Piece 2)'},
];

const EXPEDITION_DESTINATIONS={
  cave:{
    key:'cave',
    label:'Cave',
    icon:'🕳️',
    tierOrder:EXPEDITION_TIER_ORDER,
    lootPool:EXPLORATION_LOOT_POOL,
    superRarePool:EXPLORATION_SUPER_RARE_POOL,
    staminaRanges:EXPEDITION_STAMINA_RANGES,
    durationMs:EXPEDITION_DURATION_MS,
    resolveTier:(tierKey)=>getExpeditionTier(tierKey),
  },
  whispering_woods:{
    key:'whispering_woods',
    label:'Whispering Woods',
    icon:'🌲',
    requiresAdjacentCamp:true,
    adjacentCampBehavior:'whisper_camp',
    tierOrder:['short','medium','long'],
    lootPool:WHISPERING_WOODS_LOOT_POOL,
    superRarePool:WHISPERING_WOODS_SUPER_RARE_POOL,
    staminaRanges:{
      short:{min:80,max:160},
      medium:{min:400,max:600},
      long:{min:1100,max:1400},
    },
    durationMs:EXPEDITION_DURATION_MS,
    tiers:{
      short:{
        key:'short',
        label:'Short Trek',
        campTierRequired:1,
        superRarePct:4,
        explorationXp:45,
        lootRolls:4,
      },
      medium:{
        key:'medium',
        label:'Medium Trek',
        campTierRequired:2,
        superRarePct:18,
        explorationXp:220,
        lootRolls:20,
      },
      long:{
        key:'long',
        label:'Long Trek',
        campTierRequired:3,
        superRarePct:40,
        explorationXp:500,
        lootRolls:45,
      },
    },
  },
  sunken_shallows:{
    key:'sunken_shallows',
    label:'Sunken Shallows',
    icon:'🌊',
    requiresAdjacentCamp:true,
    adjacentCampBehavior:'coastal_docks',
    tierOrder:['short','medium','long'],
    lootPool:typeof SUNKEN_SHALLOWS_LOOT_POOL!=='undefined'?SUNKEN_SHALLOWS_LOOT_POOL:[],
    superRarePool:typeof SUNKEN_SHALLOWS_SUPER_RARE_POOL!=='undefined'?SUNKEN_SHALLOWS_SUPER_RARE_POOL:[],
    staminaRanges:EXPEDITION_STAMINA_RANGES,
    durationMs:EXPEDITION_DURATION_MS,
    tiers:{
      short:{
        key:'short',
        label:'Short Trek',
        campTierRequired:1,
        superRarePct:4,
        explorationXp:45,
        lootRolls:4,
      },
      medium:{
        key:'medium',
        label:'Medium Trek',
        campTierRequired:2,
        superRarePct:18,
        explorationXp:220,
        lootRolls:20,
      },
      long:{
        key:'long',
        label:'Long Trek',
        campTierRequired:3,
        superRarePct:40,
        explorationXp:500,
        lootRolls:45,
      },
    },
  },
};

function getExpeditionDestination(destKey){
  return EXPEDITION_DESTINATIONS[destKey]||EXPEDITION_DESTINATIONS.cave;
}

function getExpeditionCampDisplayName(destKey){
  if(destKey==='sunken_shallows'){
    return typeof COASTAL_DOCKS_DISPLAY_NAME!=='undefined'?COASTAL_DOCKS_DISPLAY_NAME:'Coastal Docks';
  }
  if(destKey==='whispering_woods'){
    return typeof WHISPER_CAMP_DISPLAY_NAME!=='undefined'?WHISPER_CAMP_DISPLAY_NAME:'Whispering Woods Camp';
  }
  return 'Camp';
}

function getExpeditionAdjacentCampBehavior(destKey){
  const dest=getExpeditionDestination(destKey);
  return dest.adjacentCampBehavior||null;
}

function getExpeditionTierDef(destKey, tierKey){
  const dest=getExpeditionDestination(destKey);
  if(dest.tiers) return dest.tiers[tierKey]||dest.tiers[dest.tierOrder[0]];
  return dest.resolveTier(tierKey);
}

function getExpeditionTierOrder(destKey){
  const dest=getExpeditionDestination(destKey);
  return dest.tierOrder||EXPEDITION_TIER_ORDER;
}

function getExpeditionLootPools(destKey){
  const dest=getExpeditionDestination(destKey);
  return { loot:dest.lootPool||EXPLORATION_LOOT_POOL, superRare:dest.superRarePool||EXPLORATION_SUPER_RARE_POOL };
}

function getExpeditionStaminaRange(destKey, tierKey){
  const dest=getExpeditionDestination(destKey);
  return dest.staminaRanges?.[tierKey]||EXPEDITION_STAMINA_RANGES[tierKey]||EXPEDITION_STAMINA_RANGES.short;
}

function getExpeditionDurationMsFor(destKey, tierKey){
  const dest=getExpeditionDestination(destKey);
  return dest.durationMs?.[tierKey]||EXPEDITION_DURATION_MS[tierKey]||EXPEDITION_DURATION_MS.short;
}

function expeditionTierCampRequired(destKey, tierKey){
  return getExpeditionTierDef(destKey, tierKey)?.campTierRequired||0;
}

function getExpeditionTier(key){
  return EXPEDITION_TIERS[key]||EXPEDITION_TIERS.short;
}

/** Normalize legacy `{ medicine, torch, either }` objects into requirement arrays. */
function normalizeExpeditionRequirements(raw){
  if(Array.isArray(raw)) return raw.slice();
  if(!raw||typeof raw!=='object') return [];
  const list=[
    { type:EXPEDITION_REQ_TYPE.STAMINA, value:1 },
    { type:EXPEDITION_REQ_TYPE.MEDICINE, value:Number(raw.medicine)||0 },
    { type:EXPEDITION_REQ_TYPE.TORCH, value:Number(raw.torch)||0 },
  ];
  if(Array.isArray(raw.either)&&raw.either.length){
    const groupId=raw.either.join('_');
    raw.either.forEach((slotKey)=>{
      const type=EXPEDITION_SLOT_TO_REQ_TYPE[slotKey];
      const entry=list.find(r=>r.type===type);
      if(entry){
        entry.value=Math.max(entry.value, 1);
        entry.either=groupId;
      }
    });
  }
  return list;
}

function getExpeditionRequirements(tier, destKey){
  const tierKey=tier?.key||tier||'short';
  destKey=getExpeditionDestinationKeyForRequirements(destKey);
  if(destKey==='whispering_woods'&&typeof buildWhisperWoodsExpeditionRequirements==='function'){
    return buildWhisperWoodsExpeditionRequirements(tierKey);
  }
  if(destKey==='sunken_shallows'&&typeof buildSunkenShallowsExpeditionRequirements==='function'){
    return buildSunkenShallowsExpeditionRequirements(tierKey);
  }
  return buildStandardExpeditionRequirements(tierKey, destKey);
}

function getExpeditionReqByType(tier, type, destKey){
  return getExpeditionRequirements(tier, destKey).find(r=>r.type===type)||null;
}

/** `value` > 0 means this requirement is active for the tier (amount may still be rolled at runtime). */
function isExpeditionRequirementEnabled(req){
  if(!req?.type) return false;
  return Number(req.value)>0;
}

function expeditionRequiresEitherChoice(tier){
  const groups=Object.create(null);
  getExpeditionRequirements(tier).forEach((req)=>{
    if(!isExpeditionRequirementEnabled(req)||!req.either) return;
    (groups[req.either]=groups[req.either]||[]).push(req);
  });
  return Object.values(groups).some(g=>g.length>=2);
}

/** @deprecated use expeditionRequiresEitherChoice */
function expeditionRequiresEither(tier){
  return expeditionRequiresEitherChoice(tier);
}

function expeditionRequirementApplies(tier, type){
  const req=getExpeditionReqByType(tier, type);
  if(!isExpeditionRequirementEnabled(req)) return false;
  if(req.either){
    if(!expeditionRequiresEitherChoice(tier)) return false;
    return explore?.eitherChoice===type;
  }
  return true;
}

function expeditionSlotNeeded(tier, slotKey){
  const type=EXPEDITION_SLOT_TO_REQ_TYPE[slotKey];
  if(!type) return false;
  const req=getExpeditionReqByType(tier, type);
  if(!req) return slotKey==='rations';
  if(isExpeditionRequirementEnabled(req)) return true;
  return !!(req.either&&expeditionRequiresEitherChoice(tier));
}

function expeditionSlotQtyLabel(tier, slotKey){
  if(!expeditionSlotNeeded(tier, slotKey)) return null;
  const type=EXPEDITION_SLOT_TO_REQ_TYPE[slotKey];
  const req=getExpeditionReqByType(tier, type);
  if(req?.either&&expeditionRequiresEitherChoice(tier)) return { qty:1, either:true };
  return { qty:Number(req?.value)||0, either:false };
}

function groupExpeditionEitherRequirements(tier){
  const groups=Object.create(null);
  getExpeditionRequirements(tier).forEach((req)=>{
    if(!isExpeditionRequirementEnabled(req)||!req.either) return;
    (groups[req.either]=groups[req.either]||[]).push(req);
  });
  return groups;
}

function getExpeditionDurationMs(tierKey){
  return EXPEDITION_DURATION_MS[tierKey]||EXPEDITION_DURATION_MS.short;
}

function pickExpeditionLootEntry(pool){
  if(!pool?.length) return null;
  const weighted=pool.some(entry=>(entry.weight|0)>0);
  if(!weighted) return pool[Math.floor(Math.random()*pool.length)];
  let total=0;
  pool.forEach(entry=>{ total+=(entry.weight|0)||1; });
  let roll=Math.random()*total;
  for(const entry of pool){
    roll-=(entry.weight|0)||1;
    if(roll<=0) return entry;
  }
  return pool[pool.length-1];
}

function rollExpeditionRewards(tier, destKey){
  const key=destKey||'cave';
  const pools=getExpeditionLootPools(key);
  const loot={};
  for(let i=0;i<(tier.lootRolls||0);i++){
    const item=pickExpeditionLootEntry(pools.loot);
    if(!item) continue;
    loot[item.key]=(loot[item.key]||0)+1;
  }
  let superRare=null;
  if(Math.random()*100<(tier.superRarePct||0)){
    superRare=pickExpeditionLootEntry(pools.superRare);
    if(superRare) loot[superRare.key]=(loot[superRare.key]||0)+1;
  }
  if(key==='sunken_shallows'&&typeof applySunkenShallowsSandBulkLoot==='function'){
    applySunkenShallowsSandBulkLoot(loot, tier.key||'short');
  }
  return { loot, superRare };
}

function getExpeditionLootDef(key, destKey){
  const pools=getExpeditionLootPools(destKey||'cave');
  return pools.loot.find(i=>i.key===key)
    ||pools.superRare.find(i=>i.key===key)
    ||EXPLORATION_LOOT_POOL.find(i=>i.key===key)
    ||EXPLORATION_SUPER_RARE_POOL.find(i=>i.key===key)
    ||(typeof WHISPERING_WOODS_MAP_FRAGMENT_ITEMS!=='undefined'?WHISPERING_WOODS_MAP_FRAGMENT_ITEMS[key]:null)
    ||(typeof SHALLOWS_MAP_FRAGMENT_ITEMS!=='undefined'?SHALLOWS_MAP_FRAGMENT_ITEMS[key]:null)
    ||(typeof SUNKEN_SHALLOWS_MATERIAL_ITEMS!=='undefined'?SUNKEN_SHALLOWS_MATERIAL_ITEMS[key]:null)
    ||(typeof getBotanyItemDef==='function'?getBotanyItemDef(key):null)
    ||(typeof getItemDef==='function'?getItemDef(key):null)
    ||null;
}

function rollExpeditionStaminaRequired(tierKey, destKey){
  const range=getExpeditionStaminaRange(destKey||'cave', tierKey);
  const min=Math.ceil(range.min/10)*10;
  const max=Math.floor(range.max/10)*10;
  const steps=Math.max(0, Math.round((max-min)/10));
  return min + Math.floor(Math.random()*(steps+1))*10;
}

function rollExpeditionHealingRequired(tierKey, destKey){
  const range=getExpeditionStaminaRange(destKey||'cave', tierKey);
  const min=Math.max(10, Math.floor(range.min/20/10)*10);
  const max=Math.max(min, Math.ceil(range.max/20/10)*10);
  const steps=Math.max(0, Math.round((max-min)/10));
  return min + Math.floor(Math.random()*(steps+1))*10;
}

function getExpeditionMedicineDef(key){
  return EXPEDITION_MEDICINE_ITEMS.find(i=>i.key===key)||null;
}

function getMedicineRecoveryForItemKey(itemKey){
  return getExpeditionMedicineDef(itemKey)?.recovery||0;
}

function clearExpeditionHealingRolls(){
  state.exploreHealingRolls={};
  scheduleSaveGame();
}

function clearExpeditionTorchRolls(){
  state.exploreTorchRolls={};
  scheduleSaveGame();
}

function clearExpeditionSupplyRolls(){
  clearExpeditionStaminaRolls();
  clearExpeditionHealingRolls();
  clearExpeditionTorchRolls();
}

function clearExpeditionSupplyRollsForDestination(destKey){
  clearExpeditionSupplyRolls();
  if(destKey==='whispering_woods'&&typeof clearWhisperWoodsDynamicRolls==='function'){
    clearWhisperWoodsDynamicRolls();
  }
  if(destKey==='sunken_shallows'&&typeof clearSunkenShallowsRolls==='function'){
    clearSunkenShallowsRolls();
  }
}

function rollExpeditionTorchesRequired(tierKey, destKey){
  const tier=getExpeditionTierDef(destKey||'cave', tierKey);
  if(!expeditionSlotNeeded(tier, 'torch')) return 0;
  const min=EXPEDITION_TORCH_COUNT_RANGE.min;
  const max=EXPEDITION_TORCH_COUNT_RANGE.max;
  return min + Math.floor(Math.random()*(max-min+1));
}

function getFishIdForItemKey(itemKey){
  if(!itemKey) return null;
  for(const [fishId,fish] of Object.entries(FISH_DEFS)){
    if(fish.key===itemKey) return fishId;
    const recipe=COOKING_RECIPES[fishId];
    if(recipe?.cookedKey===itemKey) return fishId;
  }
  return null;
}

function getFishStaminaForItemKey(itemKey){
  const fishId=getFishIdForItemKey(itemKey);
  if(!fishId) return 0;
  const recipe=COOKING_RECIPES[fishId];
  if(recipe?.rawKey===itemKey) return 0;
  return FISH_DEFS[fishId]?.stamina||0;
}

function clearExpeditionStaminaRolls(){
  state.exploreStaminaRolls={};
  scheduleSaveGame();
}
