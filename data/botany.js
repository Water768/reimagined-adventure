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
    inputs:[{ key:'bandage', qty:1 }, { key:'aloe_gel', qty:1 }],
    requiredBotanyLevel:3,
    xp:18,
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

function getBotanyItemDef(key){
  if(BOTANY_ITEMS[key]) return BOTANY_ITEMS[key];
  if(typeof getFabricItemDef==='function') return getFabricItemDef(key);
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
