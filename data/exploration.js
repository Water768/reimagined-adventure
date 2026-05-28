/* Hearthstead — cave exploration (static data) */
'use strict';

const EXPLORATION_LAYER_FIRST_LEVEL=5;
const EXPLORATION_LAYER_STEP=10;

const EXPEDITION_REQ_SLOTS={
  rations:{key:'rations',label:'Rations',icon:'🐟',desc:'Uses available cooked fish'},
  medicine:{key:'medicine',label:'Medicine',icon:'💊',desc:'Healing supplies',submenuTitle:'Healing potential'},
  torch:{key:'torch',label:'Torch',icon:'🔥',desc:'Flaming torch',submenuTitle:'Flame quality'},
};

const EXPEDITION_STAMINA_RANGES={
  short:{min:100,max:200},
  medium:{min:450,max:650},
  long:{min:1200,max:1500},
};

const EXPEDITION_TIERS={
  short:{
    key:'short',
    label:'Short',
    superRarePct:5,
    explorationXp:50,
    lootRolls:5,
    requirements:{medicine:0,torch:0},
  },
  medium:{
    key:'medium',
    label:'Medium',
    superRarePct:25,
    explorationXp:250,
    lootRolls:25,
    requirements:{medicine:0,torch:0,either:['medicine','torch']},
  },
  long:{
    key:'long',
    label:'Long',
    superRarePct:55,
    explorationXp:550,
    lootRolls:55,
    requirements:{medicine:1,torch:1},
  },
};

const EXPEDITION_TIER_ORDER=['short','medium','long'];

const EXPEDITION_DURATION_MS={
  short:10000,
  medium:25000,
  long:45000,
};

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

function getExpeditionTier(key){
  return EXPEDITION_TIERS[key]||EXPEDITION_TIERS.short;
}

function expeditionRequiresEither(tier){
  const either=tier?.requirements?.either;
  return Array.isArray(either)&&either.length>0;
}

function expeditionSlotNeeded(tier, slotKey){
  if(slotKey==='rations') return true;
  const req=tier?.requirements;
  if(!req) return false;
  if((req[slotKey]||0)>0) return true;
  return expeditionRequiresEither(tier)&&req.either.includes(slotKey);
}

function expeditionSlotQtyLabel(tier, slotKey){
  if(!expeditionSlotNeeded(tier, slotKey)) return null;
  const req=tier.requirements;
  if(expeditionRequiresEither(tier)&&req.either.includes(slotKey)) return { qty:1, either:true };
  return { qty:req[slotKey]||0, either:false };
}

function getExpeditionDurationMs(tierKey){
  return EXPEDITION_DURATION_MS[tierKey]||EXPEDITION_DURATION_MS.short;
}

function pickExpeditionLootEntry(pool){
  if(!pool?.length) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}

function rollExpeditionRewards(tier){
  const loot={};
  for(let i=0;i<(tier.lootRolls||0);i++){
    const item=pickExpeditionLootEntry(EXPLORATION_LOOT_POOL);
    if(!item) continue;
    loot[item.key]=(loot[item.key]||0)+1;
  }
  let superRare=null;
  if(Math.random()*100<(tier.superRarePct||0)){
    superRare=pickExpeditionLootEntry(EXPLORATION_SUPER_RARE_POOL);
    if(superRare) loot[superRare.key]=(loot[superRare.key]||0)+1;
  }
  return { loot, superRare };
}

function getExpeditionLootDef(key){
  return EXPLORATION_LOOT_POOL.find(i=>i.key===key)
    ||EXPLORATION_SUPER_RARE_POOL.find(i=>i.key===key)
    ||null;
}

function rollExpeditionStaminaRequired(tierKey){
  const range=EXPEDITION_STAMINA_RANGES[tierKey]||EXPEDITION_STAMINA_RANGES.short;
  const min=Math.ceil(range.min/10)*10;
  const max=Math.floor(range.max/10)*10;
  const steps=Math.max(0, Math.round((max-min)/10));
  return min + Math.floor(Math.random()*(steps+1))*10;
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
