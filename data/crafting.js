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

function buildSpinningRecipes(){
  const recipes={};
  const add=(id,fiberId,threadTier,baseSuccess,opts={})=>{
    const fiber=FIBER_DEFS[fiberId];
    const thread=THREAD_DEFS[threadTier];
    recipes[id]={
      rawKey:fiber.key,
      rawIcon:fiber.icon,
      rawName:fiber.name,
      outputKey:thread.key,
      outputIcon:thread.icon,
      outputName:thread.name,
      threadLabel:thread.label,
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
  return recipes;
}

const SPINNING_RECIPES=buildSpinningRecipes();
const SPIN_RECIPE_ORDER=['twisted_grass','sinew','nettles','flax_basic','spiderweb','wool','flax_medium','silk','enchanted_web'];
const SPIN_TIER_ORDER=['Basic','Medium','Enhanced'];

function spinRecipeLabel(recipe){
  if(recipe.displayName) return recipe.displayName;
  return recipe.rawName+' → '+recipe.outputName;
}

function getCraftMaterialDef(key){
  if(!key) return null;
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