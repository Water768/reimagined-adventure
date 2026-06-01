/* Hearthstead — crafting (static data) */
'use strict';

const COOK_BASE_SUCCESS=0.20;
const COOK_SUCCESS_PER_LEVEL=0.10;
const COOK_XP_SUCCESS=12;
const COOK_XP_BURN=4;

function buildCookingRecipes(){
  const recipes={};
  Object.entries(FISH_DEFS).forEach(([id,fish])=>{
    recipes[id]={
      rawKey:fish.key,
      rawIcon:fish.icon,
      rawName:'Raw '+fish.name,
      cookedKey:'cooked_'+id,
      cookedIcon:'🍣',
      cookedName:'Cooked '+fish.name,
      unlockLevel:fish.level,
      baseSuccess:COOK_BASE_SUCCESS,
      successPerLevel:COOK_SUCCESS_PER_LEVEL,
      xpSuccess:COOK_XP_SUCCESS,
      xpBurn:COOK_XP_BURN,
    };
  });
  return recipes;
}

const COOKING_RECIPES=buildCookingRecipes();

const FIBER_DEFS={
  twisted_grass:{key:'twisted_grass',name:'Twisted Grass',icon:'🌾'},
  sinew:{key:'sinew',name:'Sinew',icon:'🦴'},
  nettles:{key:'nettles',name:'Nettles',icon:'🌿'},
  flax:{key:'flax',name:'Flax',icon:'🪻'},
  spiderweb:{key:'spiderweb',name:'Spiderweb',icon:'🕸️'},
  wool:{key:'wool',name:'Wool',icon:'🐑'},
  silk:{key:'silk',name:'Silk',icon:'🧶'},
  enchanted_web:{key:'enchanted_web',name:'Enchanted Web',icon:'✨'},
};

const THREAD_DEFS={
  basic:{key:'thread_basic',icon:'🧵',name:'Basic Thread',label:'Basic'},
  medium:{key:'thread_medium',icon:'🧶',name:'Medium Thread',label:'Medium'},
  enhanced:{key:'thread_enhanced',icon:'💫',name:'Enhanced Thread',label:'Enhanced'},
};

const SPIN_SUCCESS_PER_LEVEL=0.03;
const SPIN_XP_SUCCESS=10;
const SPIN_XP_FAIL=3;
const SPIN_ROPE_INPUT_QTY=3;
const SPIN_ROPE_FAIL_DISCARD_CHANCE=0.5;
const SPIN_ROPE_FAIL_EXTRA_MIN=1;
const SPIN_ROPE_FAIL_EXTRA_MAX=2;
const SPIN_ROPE_XP_SUCCESS=12;
const SPIN_ROPE_XP_FAIL=4;

const NET_CRAFT_MATERIALS={
  bronze_weights:{ key:'bronze_weights', icon:'⚖️', name:'Bronze Weights' },
  iron_rings:{ key:'iron_rings', icon:'⭕', name:'Iron Rings' },
  steel_weights:{ key:'steel_weights', icon:'⚖️', name:'Steel Weights' },
};

const SPIN_ROPE_FAIL_MSGS=[
  'The twist slips and extra thread vanishes into the wheel housing.',
  'A knot forms wrong — you sacrifice more thread to untangle it.',
  'The cord snaps mid-twist. More thread goes in the bin.',
  'Your fingers fumble; the wheel keeps spinning and eating thread.',
  'Too loose on one ply — you trim away the mess and try again.',
  'The spindle wobbles; thread unwinds itself straight onto the floor.',
  'Almost had it. The wheel disagrees. More thread lost.',
  'A tangle ambushes you from behind. Thread pays the price.',
];

function buildSpinningRecipes(){
  const recipes={};
  const add=(id,fiberId,threadTier,baseSuccess,opts={})=>{
    const fiber=FIBER_DEFS[fiberId];
    const thread=THREAD_DEFS[threadTier];
    recipes[id]={
      kind:'thread',
      rawKey:fiber.key,
      rawIcon:fiber.icon,
      rawName:fiber.name,
      outputKey:thread.key,
      outputIcon:thread.icon,
      outputName:thread.name,
      threadLabel:thread.label,
      inputQty:1,
      requiredCraftingLevel:1,
      baseSuccess,
      successPerLevel:SPIN_SUCCESS_PER_LEVEL,
      xpSuccess:SPIN_XP_SUCCESS,
      xpFail:SPIN_XP_FAIL,
      displayName:opts.displayName||null,
    };
  };
  add('twisted_grass','twisted_grass','basic',0.40);
  add('sinew','sinew','basic',0.50);
  add('nettles','nettles','basic',0.60);
  add('flax_basic','flax','basic',0.70);
  add('spiderweb','spiderweb','medium',0.22);
  add('wool','wool','medium',0.72);
  add('flax_medium','flax','medium',0.68,{displayName:'Flax → Medium Thread'});
  add('silk','silk','enhanced',0.45);
  add('enchanted_web','enchanted_web','enhanced',0.58);

  const addRope=(id,rawKey,rawIcon,rawName,requiredLevel,baseSuccess,opts={})=>{
    recipes[id]={
      kind:'rope',
      rawKey,
      rawIcon,
      rawName,
      outputKey:'rope',
      outputIcon:'⛓️',
      outputName:'Rope',
      threadLabel:'Rope',
      inputQty:SPIN_ROPE_INPUT_QTY,
      requiredCraftingLevel:requiredLevel,
      baseSuccess,
      successPerLevel:0,
      xpSuccess:SPIN_ROPE_XP_SUCCESS,
      xpFail:SPIN_ROPE_XP_FAIL,
      failDiscardChance:opts.failDiscardChance??SPIN_ROPE_FAIL_DISCARD_CHANCE,
      failExtraLossMin:opts.failExtraLossMin??SPIN_ROPE_FAIL_EXTRA_MIN,
      failExtraLossMax:opts.failExtraLossMax??SPIN_ROPE_FAIL_EXTRA_MAX,
      displayName:opts.displayName||null,
    };
  };
  addRope('rope_basic',THREAD_DEFS.basic.key,THREAD_DEFS.basic.icon,THREAD_DEFS.basic.name,2,0.40,
    {displayName:'3 Basic Thread → Rope'});
  addRope('rope_medium',THREAD_DEFS.medium.key,THREAD_DEFS.medium.icon,THREAD_DEFS.medium.name,14,0.70,
    {displayName:'3 Medium Thread → Rope'});
  addRope('rope_enhanced',THREAD_DEFS.enhanced.key,THREAD_DEFS.enhanced.icon,THREAD_DEFS.enhanced.name,32,1.0,
    {displayName:'3 Enhanced Thread → Rope'});
  addRope('rope_flax',FIBER_DEFS.flax.key,FIBER_DEFS.flax.icon,FIBER_DEFS.flax.name,20,1.0,
    {displayName:'3 Flax → Rope', failDiscardChance:0, failExtraLossMin:0, failExtraLossMax:0});

  return recipes;
}

const SPINNING_RECIPES=buildSpinningRecipes();
const SPIN_RECIPE_ORDER=[
  'twisted_grass','sinew','nettles','flax_basic','spiderweb','wool','flax_medium','silk','enchanted_web',
  'rope_basic','rope_medium','rope_enhanced','rope_flax',
];
const SPIN_TIER_ORDER=['Basic','Medium','Enhanced','Rope'];

function spinRecipeInputQty(recipe){
  return Math.max(1, recipe?.inputQty|0);
}

function isSpinRecipeUnlocked(recipe){
  if(!recipe) return false;
  const lvl=Number(state.skills?.crafting?.level)||1;
  return lvl>=(recipe.requiredCraftingLevel|0);
}

function spinRecipeLabel(recipe){
  if(recipe.displayName) return recipe.displayName;
  if(recipe.kind==='rope'){
    return spinRecipeInputQty(recipe)+' '+recipe.rawName+' → '+recipe.outputName;
  }
  return recipe.rawName+' → '+recipe.outputName;
}

function spinTierSectionTitle(tier){
  if(tier==='Rope') return 'ROPE';
  return tier.toUpperCase()+' THREAD';
}

function pickSpinRopeFailMsg(){
  return SPIN_ROPE_FAIL_MSGS[Math.floor(Math.random()*SPIN_ROPE_FAIL_MSGS.length)];
}

function getCraftMaterialDef(key){
  if(!key) return null;
  if(typeof NET_CRAFT_MATERIALS!=='undefined'&&NET_CRAFT_MATERIALS[key]) return NET_CRAFT_MATERIALS[key];
  if(typeof CRAFT_EXTRA_MATERIALS!=='undefined'&&CRAFT_EXTRA_MATERIALS[key]) return CRAFT_EXTRA_MATERIALS[key];
  if(typeof LOG_DEFS!=='undefined'&&LOG_DEFS[key]){
    const d=LOG_DEFS[key];
    return { key:d.key, icon:d.icon, name:d.name };
  }
  if(key==='rope') return { key:'rope', icon:'⛓️', name:'Rope' };
  if(typeof FABRIC_ITEMS!=='undefined'&&FABRIC_ITEMS[key]) return FABRIC_ITEMS[key];
  if(typeof BOTANY_ITEMS!=='undefined'&&BOTANY_ITEMS[key]) return BOTANY_ITEMS[key];
  if(typeof BOTANY_SEED_DEFS!=='undefined'&&BOTANY_SEED_DEFS[key]) return BOTANY_SEED_DEFS[key];
  if(typeof BOTANY_CROP_DEFS!=='undefined'&&BOTANY_CROP_DEFS[key]) return BOTANY_CROP_DEFS[key];
  if(typeof FIBER_DEFS!=='undefined'&&FIBER_DEFS[key]) return FIBER_DEFS[key];
  if(typeof THREAD_DEFS!=='undefined'){
    const thread=Object.values(THREAD_DEFS).find(t=>t.key===key);
    if(thread) return thread;
  }
  if(typeof getBagItemDef==='function') return getBagItemDef(key);
  return null;
}