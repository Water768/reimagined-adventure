/* Hearthstead — loom / fabric (static data) */
'use strict';

const WONKY_LOOM_FURNITURE_KEY='wonky_loom';

const FABRIC_ITEMS={
  simple_cloth:{ key:'simple_cloth', icon:'🧵', name:'Simple Cloth' },
  silk_cloth:{ key:'silk_cloth', icon:'🧶', name:'Silk Cloth' },
  linen:{ key:'linen', icon:'🪡', name:'Linen' },
  clean_bandage:{ key:'clean_bandage', icon:'🩹', name:'Clean Bandage' },
  soothing_bandage:{ key:'soothing_bandage', icon:'🩹', name:'Soothing Bandage' },
  improved_soothing_bandage:{ key:'improved_soothing_bandage', icon:'🩹', name:'Improved Soothing Bandage' },
};

const LOOM_WEAVE_XP_SUCCESS=40;
const LOOM_WEAVE_XP_FAIL=10;
const LOOM_SUCCESS_PER_LEVEL=0.03;

const LOOM_LINEN_LOCKED_MSG="You're going to need a better loom....";

const LOOM_RECIPE_SECTIONS=[
  { label:'CLOTH', keys:['simple_cloth','silk_cloth','linen'] },
  { label:'BANDAGES', keys:['clean_bandage'] },
];

const LOOM_RECIPES={
  simple_cloth:{
    id:'simple_cloth',
    label:'Simple Cloth',
    icon:'🧵',
    outputKey:'simple_cloth',
    inputs:[{
      oneOf:[
        { key:'thread_basic', qty:5 },
        { key:'thread_medium', qty:3 },
        { key:'thread_enhanced', qty:1 },
        { key:'wool', qty:3 },
      ],
    }],
    requiredTailoringLevel:1,
    baseSuccess:0.55,
    xpSuccess:LOOM_WEAVE_XP_SUCCESS,
    xpFail:LOOM_WEAVE_XP_FAIL,
  },
  silk_cloth:{
    id:'silk_cloth',
    label:'Silk Cloth',
    icon:'🧶',
    outputKey:'silk_cloth',
    inputs:[{ key:'silk', qty:5 }],
    requiredTailoringLevel:10,
    baseSuccess:0.50,
    xpSuccess:LOOM_WEAVE_XP_SUCCESS,
    xpFail:LOOM_WEAVE_XP_FAIL,
  },
  linen:{
    id:'linen',
    label:'Linen',
    icon:'🪡',
    outputKey:'linen',
    inputs:[{ key:'flax', qty:5 }],
    requiredTailoringLevel:20,
    lockedOnWonkyLoom:true,
    baseSuccess:0.52,
    xpSuccess:LOOM_WEAVE_XP_SUCCESS,
    xpFail:LOOM_WEAVE_XP_FAIL,
  },
  clean_bandage:{
    id:'clean_bandage',
    label:'Clean Bandage',
    icon:'🩹',
    outputKey:'clean_bandage',
    inputs:[{ key:'simple_cloth', qty:2 }],
    requiredTailoringLevel:5,
    baseSuccess:0.58,
    xpSuccess:LOOM_WEAVE_XP_SUCCESS,
    xpFail:LOOM_WEAVE_XP_FAIL,
  },
};

function getFabricItemDef(key){
  return FABRIC_ITEMS[key]||null;
}

function getLoomRecipe(key){
  return LOOM_RECIPES[key]||null;
}

function isOneOfLoomInput(inp){
  return Array.isArray(inp?.oneOf)&&inp.oneOf.length>0;
}

function loomInputOptionKeys(inp){
  if(isOneOfLoomInput(inp)) return inp.oneOf.map(o=>o.key);
  return inp?.key?[inp.key]:[];
}

function loomInputOptionIcon(opt){
  const def=getFabricItemDef(opt.key)
    ||getBotanyItemDef?.(opt.key)
    ||FIBER_DEFS?.[opt.key]
    ||THREAD_DEFS&&Object.values(THREAD_DEFS).find(t=>t.key===opt.key);
  return def?.icon||'?';
}

function loomInputOptionLabel(opt){
  const def=getFabricItemDef(opt.key)
    ||getBotanyItemDef?.(opt.key)
    ||FIBER_DEFS?.[opt.key]
    ||THREAD_DEFS&&Object.values(THREAD_DEFS).find(t=>t.key===opt.key);
  const name=def?.name||opt.key;
  const qty=Math.max(1, opt.qty||1);
  return name+' ×'+qty;
}

function loomInputMaterialName(opt){
  const def=getFabricItemDef(opt.key)
    ||getBotanyItemDef?.(opt.key)
    ||FIBER_DEFS?.[opt.key]
    ||THREAD_DEFS&&Object.values(THREAD_DEFS).find(t=>t.key===opt.key);
  return (def?.name||opt.key).toLowerCase();
}

function calcLoomSuccess(recipe, inputOpt){
  if(inputOpt?.key==='thread_enhanced') return 1;
  const lvl=Number(state.skills.tailoring?.level)||1;
  const levelsAbove=Math.max(0,lvl-1);
  return Math.min(1,(recipe.baseSuccess||0.5)+levelsAbove*LOOM_SUCCESS_PER_LEVEL);
}
