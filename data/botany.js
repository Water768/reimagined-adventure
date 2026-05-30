/* Hearthstead — botany (static data) */
'use strict';

const APOTHECARY_FURNITURE_KEY='apothecary_table';

const BOTANY_ITEMS={
  basic_herbs:{ key:'basic_herbs', icon:'🌿', name:'Basic Herbs', unidentified:true },
  aloe:{ key:'aloe', icon:'🌵', name:'Aloe' },
  mint:{ key:'mint', icon:'🍃', name:'Mint' },
  sage:{ key:'sage', icon:'🌾', name:'Sage' },
  aloe_gel:{ key:'aloe_gel', icon:'🧴', name:'Aloe Gel' },
};

const BOTANY_CROP_DEFS={
  mushrooms:{ key:'mushrooms', icon:'🍄', name:'Mushrooms' },
  reeds:{ key:'reeds', icon:'🌾', name:'Reeds' },
  sunflower:{ key:'sunflower', icon:'🌻', name:'Sunflower' },
  berries:{ key:'berries', icon:'🫐', name:'Berries' },
  woad:{ key:'woad', icon:'💙', name:'Woad' },
  ginger:{ key:'ginger', icon:'🫚', name:'Ginger' },
  lavender:{ key:'lavender', icon:'💜', name:'Lavender' },
  wheat:{ key:'wheat', icon:'🌾', name:'Wheat' },
  hemp:{ key:'hemp', icon:'🌿', name:'Hemp' },
  cotton:{ key:'cotton', icon:'☁️', name:'Cotton' },
};

const BOTANY_SEED_LIST=[
  { key:'flax_seeds', icon:'🌱', name:'Flax Seeds', cropKey:'flax', requiredBotanyLevel:1 },
  { key:'mushroom_spores', icon:'🍄', name:'Mushroom Spores', cropKey:'mushrooms', requiredBotanyLevel:1 },
  { key:'aloe_seeds', icon:'🌱', name:'Aloe Seeds', cropKey:'aloe', requiredBotanyLevel:3 },
  { key:'sage_seeds', icon:'🌱', name:'Sage Seeds', cropKey:'sage', requiredBotanyLevel:3 },
  { key:'mint_seeds', icon:'🌱', name:'Mint Seeds', cropKey:'mint', requiredBotanyLevel:3 },
  { key:'sunflower_seeds', icon:'🌻', name:'Sunflower Seeds', cropKey:'sunflower', requiredBotanyLevel:4 },
  { key:'nettle_seeds', icon:'🌱', name:'Nettle Seeds', cropKey:'nettles', requiredBotanyLevel:5 },
  { key:'reed_seeds', icon:'🌱', name:'Reed Seeds', cropKey:'reeds', requiredBotanyLevel:5 },
  { key:'berry_seeds', icon:'🫐', name:'Berry Seeds', cropKey:'berries', requiredBotanyLevel:10 },
  { key:'woad_seeds', icon:'🌱', name:'Woad Seeds', cropKey:'woad', requiredBotanyLevel:12 },
  { key:'ginger_seeds', icon:'🫚', name:'Ginger Seeds', cropKey:'ginger', requiredBotanyLevel:15 },
  { key:'lavender_seeds', icon:'💜', name:'Lavender Seeds', cropKey:'lavender', requiredBotanyLevel:20 },
  { key:'wheat_seeds', icon:'🌾', name:'Wheat Seeds', cropKey:'wheat', requiredBotanyLevel:28 },
  { key:'hemp_seeds', icon:'🌱', name:'Hemp Seeds', cropKey:'hemp', requiredBotanyLevel:40 },
  { key:'cotton_seeds', icon:'☁️', name:'Cotton Seeds', cropKey:'cotton', requiredBotanyLevel:60 },
];

const BOTANY_SEED_DEFS={};
BOTANY_SEED_LIST.forEach(seed=>{
  BOTANY_SEED_DEFS[seed.key]={ ...seed, isSeed:true };
});

const IDENTIFIED_HERB_KEYS=['aloe','mint','sage'];

const BOTANY_IDENTIFY_XP=8;

const BOTANY_CRUSH_EARTH_SHARD_CHANCE=0.05;

const BOTANY_APOTHECARY_SECTIONS=[
  { label:'PROCESS', keys:['aloe_gel','soothing_bandage','improved_soothing_bandage'] },
  { label:'CRUSH HERB', keys:['crush_herb'] },
];

const BOTANY_APOTHECARY_RECIPES={
  aloe_gel:{
    id:'aloe_gel', kind:'process',
    label:'Aloe Gel',
    icon:'🧴',
    outputKey:'aloe_gel',
    inputs:[{ key:'aloe', qty:1 }],
    requiredBotanyLevel:2,
    xp:12,
  },
  soothing_bandage:{
    id:'soothing_bandage', kind:'process',
    label:'Soothing Bandage',
    icon:'🩹',
    outputKey:'soothing_bandage',
    inputs:[{ key:'clean_bandage', qty:1 }, { key:'aloe_gel', qty:1 }],
    requiredBotanyLevel:3,
    xp:18,
    tailoringXp:18,
  },
  improved_soothing_bandage:{
    id:'improved_soothing_bandage', kind:'process',
    label:'Improved Soothing Bandage',
    icon:'🩹',
    outputKey:'improved_soothing_bandage',
    inputs:[{ key:'linen', qty:1 }, { key:'aloe_gel', qty:1 }],
    requiredBotanyLevel:4,
    xp:24,
  },
  crush_herb:{
    id:'crush_herb', kind:'crush',
    label:'Crush Herb',
    icon:'🌿',
    inputs:[{ anyOf:['mint','sage'], qty:1 }],
    affinitySkill:'earth',
    affinityXp:2,
    earthShardChance:BOTANY_CRUSH_EARTH_SHARD_CHANCE,
  },
};

function getBotanyApothecaryRecipe(key){
  return BOTANY_APOTHECARY_RECIPES[key]||null;
}

function getHerbDef(key){
  return getBotanyItemDef(key);
}

function getBotanyCropDef(key){
  if(BOTANY_ITEMS[key]&&!BOTANY_ITEMS[key].unidentified) return BOTANY_ITEMS[key];
  if(BOTANY_CROP_DEFS[key]) return BOTANY_CROP_DEFS[key];
  if(typeof FIBER_DEFS!=='undefined'&&FIBER_DEFS[key]) return FIBER_DEFS[key];
  return null;
}

function getBotanySeedDef(key){
  return BOTANY_SEED_DEFS[key]||null;
}

function isBotanySeedUnlocked(seedKey, botanyLevel){
  const seed=getBotanySeedDef(seedKey);
  if(!seed) return false;
  const level=typeof botanyLevel==='number'?botanyLevel:1;
  return level>=seed.requiredBotanyLevel;
}

function getBotanySeedsSorted(){
  return BOTANY_SEED_LIST.slice().sort((a,b)=>
    (a.requiredBotanyLevel-b.requiredBotanyLevel)||a.name.localeCompare(b.name)
  );
}

function getBotanyItemDef(key){
  if(BOTANY_ITEMS[key]) return BOTANY_ITEMS[key];
  if(BOTANY_SEED_DEFS[key]) return BOTANY_SEED_DEFS[key];
  const crop=getBotanyCropDef(key);
  if(crop) return crop;
  if(typeof getFabricItemDef==='function'){
    const fabric=getFabricItemDef(key);
    if(fabric) return fabric;
  }
  if(typeof getBagItemDef==='function') return getBagItemDef(key);
  return null;
}

function isCrushApothecaryRecipe(recipe){
  return recipe?.kind==='crush';
}

function isAnyOfBotanyInput(inp){
  return Array.isArray(inp?.anyOf)&&inp.anyOf.length>0;
}

function botanyInputKeys(inp){
  if(isAnyOfBotanyInput(inp)) return inp.anyOf;
  return inp?.key?[inp.key]:[];
}

function rollIdentifiedHerbKey(){
  return IDENTIFIED_HERB_KEYS[Math.floor(Math.random()*IDENTIFIED_HERB_KEYS.length)];
}

function botanyRecipeInputsSummary(recipe){
  return recipe.inputs.map(inp=>{
    if(isAnyOfBotanyInput(inp)){
      const names=inp.anyOf.map(key=>{
        const def=getBotanyItemDef(key);
        return (def?.icon||'?')+' '+(def?.name||key);
      }).join(' or ');
      const qty=inp.qty>1?' ×'+inp.qty:'';
      return names+qty;
    }
    const def=getBotanyItemDef(inp.key);
    const icon=def?.icon||'?';
    const name=def?.name||inp.key;
    const qty=inp.qty>1?' ×'+inp.qty:'';
    return icon+' '+name+qty;
  }).join(' + ');
}
