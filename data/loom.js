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
const LOOM_NET_INPUT_QTY=10;
const LOOM_NET_XP_SUCCESS=18;
const LOOM_NET_XP_FAIL=5;
const LOOM_SUCCESS_PER_LEVEL=0.03;

const LOOM_LINEN_LOCKED_MSG="You're going to need a better loom....";

const LOOM_RECIPE_SECTIONS=[
  { label:'CLOTH', keys:['simple_cloth','silk_cloth','linen'] },
  { label:'BANDAGES', keys:['clean_bandage'] },
  { label:'BAGS', keys:['scrappy_pouch'] },
  { label:'NETS', keys:['net_basic','net_rope','net_weighted','net_reinforced','net_fine','net_heavy'] },
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
    requiredCraftingLevel:1,
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
    requiredCraftingLevel:10,
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
    requiredCraftingLevel:20,
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
    requiredCraftingLevel:5,
    baseSuccess:0.58,
    xpSuccess:LOOM_WEAVE_XP_SUCCESS,
    xpFail:LOOM_WEAVE_XP_FAIL,
  },
  scrappy_pouch:{
    id:'scrappy_pouch',
    label:'Scrappy Pouch',
    icon:'👝',
    outputKey:'scrappy_pouch',
    inputs:[
      { key:'simple_cloth', qty:2 },
      { key:'thread_basic', qty:5 },
    ],
    requiredCraftingLevel:8,
    baseSuccess:0.56,
    xpSuccess:LOOM_WEAVE_XP_SUCCESS,
    xpFail:LOOM_WEAVE_XP_FAIL,
  },
  net_basic:{
    id:'net_basic',
    label:'Basic Net',
    icon:'🥅',
    outputKey:'fishing_net',
    inputs:[{ key:'twisted_grass', qty:LOOM_NET_INPUT_QTY }],
    requiredCraftingLevel:2,
    baseSuccess:0.45,
    successFromRequiredLevel:true,
    xpSuccess:LOOM_NET_XP_SUCCESS,
    xpFail:LOOM_NET_XP_FAIL,
  },
  net_rope:{
    id:'net_rope',
    label:'Rope Net',
    icon:'🥅',
    outputKey:'fishing_net_1',
    inputs:[{ key:'rope', qty:LOOM_NET_INPUT_QTY }],
    requiredCraftingLevel:6,
    baseSuccess:0.50,
    successFromRequiredLevel:true,
    xpSuccess:LOOM_NET_XP_SUCCESS,
    xpFail:LOOM_NET_XP_FAIL,
  },
  net_weighted:{
    id:'net_weighted',
    label:'Weighted Net',
    icon:'🥅',
    outputKey:'fishing_net_2',
    inputs:[
      { key:'rope', qty:LOOM_NET_INPUT_QTY },
      { key:'bronze_weights', qty:LOOM_NET_INPUT_QTY },
    ],
    requiredCraftingLevel:11,
    baseSuccess:0.52,
    successFromRequiredLevel:true,
    xpSuccess:LOOM_NET_XP_SUCCESS,
    xpFail:LOOM_NET_XP_FAIL,
  },
  net_reinforced:{
    id:'net_reinforced',
    label:'Reinforced Net',
    icon:'🥅',
    outputKey:'fishing_net_3',
    inputs:[
      { key:'simple_cloth', qty:LOOM_NET_INPUT_QTY },
      { key:'iron_rings', qty:LOOM_NET_INPUT_QTY },
    ],
    requiredCraftingLevel:15,
    baseSuccess:0.55,
    successFromRequiredLevel:true,
    xpSuccess:LOOM_NET_XP_SUCCESS,
    xpFail:LOOM_NET_XP_FAIL,
  },
  net_fine:{
    id:'net_fine',
    label:'Fine Net',
    icon:'🥅',
    outputKey:'fishing_net_4',
    inputs:[{ key:'silk_cloth', qty:LOOM_NET_INPUT_QTY }],
    requiredCraftingLevel:19,
    baseSuccess:0.58,
    successFromRequiredLevel:true,
    xpSuccess:LOOM_NET_XP_SUCCESS,
    xpFail:LOOM_NET_XP_FAIL,
  },
  net_heavy:{
    id:'net_heavy',
    label:'Heavy Net',
    icon:'🥅',
    outputKey:'fishing_net_5',
    inputs:[
      { key:'silk_cloth', qty:LOOM_NET_INPUT_QTY },
      { key:'steel_weights', qty:LOOM_NET_INPUT_QTY },
    ],
    requiredCraftingLevel:23,
    baseSuccess:0.62,
    successFromRequiredLevel:true,
    xpSuccess:LOOM_NET_XP_SUCCESS,
    xpFail:LOOM_NET_XP_FAIL,
  },
};

function getFabricItemDef(key){
  return FABRIC_ITEMS[key]||null;
}

function getLoomOutputDef(key){
  if(typeof FISHING_NET_BY_KEY!=='undefined'&&FISHING_NET_BY_KEY[key]) return FISHING_NET_BY_KEY[key];
  return getFabricItemDef(key)||(typeof getBagItemDef==='function'?getBagItemDef(key):null);
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
  const def=typeof getCraftMaterialDef==='function'?getCraftMaterialDef(opt.key):null;
  return def?.icon||'?';
}

function loomInputOptionLabel(opt){
  const def=typeof getCraftMaterialDef==='function'?getCraftMaterialDef(opt.key):null;
  const name=def?.name||opt.key;
  const qty=Math.max(1, opt.qty||1);
  return name+' ×'+qty;
}

function loomInputMaterialName(opt){
  const def=typeof getCraftMaterialDef==='function'?getCraftMaterialDef(opt.key):null;
  return (def?.name||opt.key).toLowerCase();
}

function calcLoomSuccess(recipe, inputOpt){
  if(recipe?.outputKey&&typeof BAG_BY_KEY!=='undefined'&&BAG_BY_KEY[recipe.outputKey]) return 1;
  if(inputOpt?.key==='thread_enhanced') return 1;
  const lvl=Number(state.skills.crafting?.level)||1;
  const reqBase=recipe.successFromRequiredLevel?(recipe.requiredCraftingLevel||1):1;
  const levelsAbove=Math.max(0,lvl-reqBase);
  return Math.min(1,(recipe.baseSuccess||0.5)+levelsAbove*LOOM_SUCCESS_PER_LEVEL);
}
