/* Hearthstead — Whispering Woods dynamic expedition requirements */
'use strict';

const EXPEDITION_POTION_KEY='travel_potion';
const INFUSED_CHARM_KEY='infused_charm';
const WHISPER_WOODS_INFUSED_CHARM_NEED=20;

const WHISPER_WOODS_EXPEDITION_ITEMS={
  [EXPEDITION_POTION_KEY]:{ key:EXPEDITION_POTION_KEY, icon:'🧪', name:'Travel Potion' },
  [INFUSED_CHARM_KEY]:{ key:INFUSED_CHARM_KEY, icon:'✨', name:'Infused Charm' },
};

const WHISPER_WOODS_SHUFFLE_POOL=['potions','torches','armour'];
const WHISPER_WOODS_CONSUMABLE_QTY={ medium:2, long:4 };

function rollWhisperWoodsTierDynamic(tierKey){
  const shuffleType=WHISPER_WOODS_SHUFFLE_POOL[Math.floor(Math.random()*WHISPER_WOODS_SHUFFLE_POOL.length)];
  const isLong=tierKey==='long';
  const earthMin=isLong?15:5;
  const earthMax=isLong?25:15;
  const earthLevel=earthMin+Math.floor(Math.random()*(earthMax-earthMin+1));
  const consumableQty=WHISPER_WOODS_CONSUMABLE_QTY[tierKey]||WHISPER_WOODS_CONSUMABLE_QTY.medium;
  return { shuffleType, earthLevel, consumableQty };
}

function ensureWhisperWoodsDynamicRolls(tierKey){
  if(!state.exploreWhisperWoodsRolls) state.exploreWhisperWoodsRolls={};
  const key=tierKey||'medium';
  if(!state.exploreWhisperWoodsRolls[key]){
    state.exploreWhisperWoodsRolls[key]=rollWhisperWoodsTierDynamic(key);
    scheduleSaveGame();
  }
  return state.exploreWhisperWoodsRolls[key];
}

function clearWhisperWoodsDynamicRolls(){
  state.exploreWhisperWoodsRolls={};
  scheduleSaveGame();
}

function buildWhisperWoodsShuffleRequirement(rolls){
  if(!rolls) return { type:EXPEDITION_REQ_TYPE.RESERVED, value:0 };
  switch(rolls.shuffleType){
    case 'potions':
      return { type:EXPEDITION_REQ_TYPE.POTION, value:rolls.consumableQty };
    case 'torches':
      return { type:EXPEDITION_REQ_TYPE.TORCH, value:rolls.consumableQty };
    case 'armour':
      return { type:EXPEDITION_REQ_TYPE.ARMOUR, value:1 };
    default:
      return { type:EXPEDITION_REQ_TYPE.RESERVED, value:0 };
  }
}

function getWhisperWoodsRequirementColumns(tierKey){
  const tier=tierKey||'short';
  const needsMedium=tier==='medium'||tier==='long';
  const needsLong=tier==='long';
  const rolls=needsLong?ensureWhisperWoodsDynamicRolls('long')
    :needsMedium?ensureWhisperWoodsDynamicRolls('medium'):null;
  return [
    [
      { type:EXPEDITION_REQ_TYPE.STAMINA, value:1 },
      { type:EXPEDITION_REQ_TYPE.MEDICINE, value:1 },
    ],
    [
      needsMedium?buildWhisperWoodsShuffleRequirement(rolls):{ type:EXPEDITION_REQ_TYPE.RESERVED, value:0 },
      needsMedium?{ type:EXPEDITION_REQ_TYPE.EARTH_AFFINITY, value:rolls.earthLevel }:{ type:EXPEDITION_REQ_TYPE.RESERVED, value:0 },
    ],
    [
      needsLong?{ type:EXPEDITION_REQ_TYPE.INFUSED_CHARM, value:WHISPER_WOODS_INFUSED_CHARM_NEED }:{ type:EXPEDITION_REQ_TYPE.RESERVED, value:0 },
      needsLong?{ type:EXPEDITION_REQ_TYPE.EQUIPPED_TOOL, value:1, toolKey:INCINERATING_AXE_KEY }:{ type:EXPEDITION_REQ_TYPE.RESERVED, value:0 },
    ],
  ];
}

function buildWhisperWoodsExpeditionRequirements(tierKey){
  return getWhisperWoodsRequirementColumns(tierKey).flat();
}

function getWhisperWoodsExpeditionItemDef(key){
  return WHISPER_WOODS_EXPEDITION_ITEMS[key]||null;
}

function countExpeditionPotionsAvailable(){
  return typeof itemCountBagAndStore==='function'?itemCountBagAndStore(EXPEDITION_POTION_KEY):0;
}

function countInfusedCharmsInStorage(){
  return typeof storageCount==='function'?storageCount(INFUSED_CHARM_KEY):0;
}

function getEarthAffinityLevel(){
  return state.skills?.earth?.level|0;
}

function isExpeditionArmourRequirementMet(){
  const key=state.equipped?.key;
  if(!key||typeof EQUIPPABLE==='undefined') return false;
  const def=EQUIPPABLE[key];
  return !!def&&def.slot==='body';
}

function getWhisperWoodsReqDisplayMeta(req){
  switch(req?.type){
    case EXPEDITION_REQ_TYPE.POTION:{
      const def=getWhisperWoodsExpeditionItemDef(EXPEDITION_POTION_KEY);
      return { icon:def?.icon||'🧪', label:'Potions', sub:'Consumable supply' };
    }
    case EXPEDITION_REQ_TYPE.ARMOUR:
      return { icon:'🛡️', label:'Armour', sub:'Body armour equipped' };
    case EXPEDITION_REQ_TYPE.EARTH_AFFINITY:
      return { icon:'🌿', label:'Earth', sub:'Earth skill level' };
    case EXPEDITION_REQ_TYPE.INFUSED_CHARM:{
      const def=getWhisperWoodsExpeditionItemDef(INFUSED_CHARM_KEY);
      return { icon:def?.icon||'✨', label:def?.name||'Infused Charm', sub:'From storage on launch' };
    }
    case EXPEDITION_REQ_TYPE.EQUIPPED_TOOL:{
      const toolKey=req.toolKey||INCINERATING_AXE_KEY;
      const axe=typeof AXE_BY_KEY!=='undefined'?AXE_BY_KEY[toolKey]:null;
      return { icon:axe?.icon||'🪓', label:axe?.name||'Incinerating Axe', sub:'Equipped in tool store' };
    }
    default:
      return { icon:'▫️', label:'Requirement', sub:'' };
  }
}

function consumeInfusedCharmsFromStorage(amount){
  const need=Math.max(0, amount|0);
  if(need<=0) return 0;
  const resolved=typeof resolveItemKey==='function'?resolveItemKey(INFUSED_CHARM_KEY):INFUSED_CHARM_KEY;
  return typeof stackTake==='function'?stackTake(state.storage, resolved, need):0;
}
