/* Hearthstead — furniture (static data) */
'use strict';

const WOOD_MODIFIERS={
  logs:0, ashwood:10, teak:12, silverbirch:14,
  ebonwood:20, ironbark:24, yew:26, singing_oak:40,
};

const WOOD_ALLOW={
  all:['logs','ashwood','teak','silverbirch','ebonwood','ironbark','yew','singing_oak'],
  hardwood_plus:['ashwood','teak','silverbirch','ebonwood','ironbark','yew','singing_oak'],
  artisan_plus:['ebonwood','ironbark','yew','singing_oak'],
  singing_oak_only:['singing_oak'],
};

const FURNITURE_UTILITY_TAGLINES={
  apothecary_table:'processes herbs',
  wonky_loom:'used to make textiles',
  study_desk:'used to study academia',
  bookcase:'manage journal rewards',
  crafting_desk:'crafts items',
};

function furnitureUtilityTagline(key){
  return FURNITURE_UTILITY_TAGLINES[key]||'';
}

function furnitureUtilityTaglineHtml(key){
  const text=furnitureUtilityTagline(key);
  return text?'<span class="wb-furn-utility-tagline">'+text+'</span>':'';
}

const FURNITURE_TIERS={
  simple:{ label:'Simple', order:2, code:'S' },
  hardwood:{ label:'Hardwood', order:3, code:'H' },
  artisan:{ label:'Artisan', order:4, code:'A' },
  mythical:{ label:'Mythical', order:5, code:'M' },
  journal:{ label:'Journal Rewards', order:5.5, code:'J' },
  barn:{ label:'Barn furniture', order:6, code:'B', subtitle:'Placeable in large barn' },
};

const CRAFT_EXTRA_MATERIALS={
  cat_cushion:{ key:'cat_cushion', icon:'🧸', name:'Cat Cushion' },
};

/** Logs shown in UI / log picker per furniture tier. */
const FURNITURE_TIER_WOODS={
  simple:['logs','ashwood','teak'],
  hardwood:['teak','yew','ebonwood','silverbirch','ironbark'],
  barn:['ashwood','ebonwood'],
  artisan:['ebonwood','ironbark','yew'],
  mythical:['singing_oak'],
};

/** Singing Oak works on any tier but only appears in lists for Mythical. */
const FURNITURE_BONUS_WOOD='singing_oak';

const FURNITURE_CRAFTS={
  // ── Simple tier (includes former home-made utility pieces) ──
  chair:{
    id:'chair', name:'Chair', icon:'🪑', tier:'simple',
    requiredCarpentryLevel:1, stages:3, baseFurnitureChance:10,
    allowedWoods:'all',
    description:'A simple seat hewn from whatever wood was handy.',
    furnitureKey:'chair', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:15, xpComplete:50, completeLabel:'chair',
  },
  bookcase:{
    id:'bookcase', name:'Bookcase', icon:'📚', tier:'simple',
    requiredCarpentryLevel:5, stages:4, baseFurnitureChance:55,
    allowedWoods:'all',
    description:'A rough wooden shelf for journals and their hard-won rewards.',
    furnitureKey:'bookcase', skill:'carpentry', utility:true,
    nailsPerAttempt:10, xpFail:2, xpStage:12, xpComplete:40, completeLabel:'bookcase',
  },
  bucket:{
    id:'bucket', name:'Bucket', icon:'🪣', tier:'simple',
    requiredCarpentryLevel:1, stages:3, baseFurnitureChance:50,
    allowedWoods:'all', supplyKey:'bucket',
    description:'A wooden bucket for wells, sand, and barn chores.',
    skill:'carpentry',
    nailsPerAttempt:10, xpFail:1, xpStage:5, xpComplete:25, completeLabel:'bucket',
  },
  study_desk:{
    id:'study_desk', name:'Study Desk', icon:'📖', tier:'simple',
    requiredCarpentryLevel:8, stages:4, baseFurnitureChance:45,
    allowedWoods:'all',
    description:'A sturdy desk for books, maps, and curious finds.',
    furnitureKey:'study_desk', skill:'carpentry', utility:true,
    nailsPerAttempt:10, xpFail:2, xpStage:14, xpComplete:55, completeLabel:'study desk',
  },
  // ── Former home-made utility (now simple tier) ──
  wonky_loom:{
    id:'wonky_loom', name:'Wonky Loom', icon:'🧵', tier:'simple',
    requiredCarpentryLevel:10, stages:5, baseFurnitureChance:48,
    allowedWoods:'all',
    description:'A wobbly frame for weaving thread into cloth.',
    furnitureKey:'wonky_loom', skill:'carpentry', utility:true,
    nailsPerAttempt:10, xpFail:2, xpStage:14, xpComplete:58, completeLabel:'wonky loom',
  },
  apothecary_table:{
    id:'apothecary_table', name:'Apothecary Table', icon:'⚗️', tier:'simple',
    requiredCarpentryLevel:13, stages:6, baseFurnitureChance:35,
    allowedWoods:'all',
    description:'A sturdy work surface for herbs and botany.',
    furnitureKey:'apothecary_table', skill:'carpentry', utility:true,
    nailsPerAttempt:10, xpFail:2, xpStage:16, xpComplete:65, completeLabel:'apothecary table',
  },
  // ── Hardwood tier (starts Lv 20) ──
  crafting_desk:{
    id:'crafting_desk', name:'Crafting Desk', icon:'🛠️', tier:'hardwood',
    requiredCarpentryLevel:20, stages:4, baseFurnitureChance:35,
    allowedWoods:'hardwood_plus',
    description:'A sturdy desk for mixing pastes, gear, and odd workshop crafts.',
    furnitureKey:'crafting_desk', skill:'carpentry', utility:true,
    nailsPerAttempt:10, xpFail:2, xpStage:16, xpComplete:65, completeLabel:'crafting desk',
  },
  hardwood_bookcase:{
    id:'hardwood_bookcase', name:'Hardwood Bookcase', icon:'📚', tier:'hardwood',
    requiredCarpentryLevel:24, stages:5, baseFurnitureChance:30,
    allowedWoods:'hardwood_plus',
    description:'Tall shelves meant to hold books and keepsakes.',
    furnitureKey:'hardwood_bookcase', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:18, xpComplete:75, completeLabel:'bookcase',
  },
  hardwood_desk:{
    id:'hardwood_desk', name:'Hardwood Desk', icon:'🖥️', tier:'hardwood',
    requiredCarpentryLevel:32, stages:7, baseFurnitureChance:28,
    allowedWoods:'hardwood_plus',
    description:'A broad hardwood desk built for long sessions of work.',
    furnitureKey:'hardwood_desk', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:18, xpComplete:80, completeLabel:'desk',
  },
  // ── Artisan tier (starts Lv 42) ──
  artisan_chair:{
    id:'artisan_chair', name:'Artisan Chair', icon:'🪑', tier:'artisan',
    requiredCarpentryLevel:42, stages:5, baseFurnitureChance:22,
    allowedWoods:'artisan_plus',
    description:'Fine joinery and a seat shaped for comfort.',
    furnitureKey:'artisan_chair', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:20, xpComplete:95, completeLabel:'chair',
  },
  artisan_bookcase:{
    id:'artisan_bookcase', name:'Artisan Bookcase', icon:'📚', tier:'artisan',
    requiredCarpentryLevel:46, stages:6, baseFurnitureChance:20,
    allowedWoods:'artisan_plus',
    description:'Carefully fitted shelves with clean, even lines.',
    furnitureKey:'artisan_bookcase', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:20, xpComplete:100, completeLabel:'bookcase',
  },
  artisan_desk:{
    id:'artisan_desk', name:'Artisan Desk', icon:'🖥️', tier:'artisan',
    requiredCarpentryLevel:54, stages:8, baseFurnitureChance:18,
    allowedWoods:'artisan_plus',
    description:'An elegant desk suited for long evenings of study.',
    furnitureKey:'artisan_desk', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:22, xpComplete:110, completeLabel:'desk',
  },
  artisan_display_case:{
    id:'artisan_display_case', name:'Artisan Display Case', icon:'🗃️', tier:'artisan',
    requiredCarpentryLevel:58, stages:7, baseFurnitureChance:16,
    allowedWoods:'artisan_plus',
    description:'A glass-front cabinet for treasured possessions.',
    furnitureKey:'artisan_display_case', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:22, xpComplete:115, completeLabel:'display case',
  },
  // ── Mythical tier (starts Lv 65) ──
  mythical_chimes:{
    id:'mythical_chimes', name:'Mythical Chimes', icon:'🎐', tier:'mythical',
    requiredCarpentryLevel:65, stages:60, baseFurnitureChance:10,
    allowedWoods:'singing_oak_only',
    description:'Soft tones drift from the wood even in still air.',
    furnitureKey:'mythical_chimes', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:25, xpComplete:150, completeLabel:'chimes',
  },
  // ── Barn furniture (placeable in large barn) ──
  butter_churn:{
    id:'butter_churn', name:'Butter Churn', icon:'🧈', tier:'barn',
    requiredCarpentryLevel:15, stages:15, baseFurnitureChance:20,
    requiredLogKey:'ashwood', logsPerAttempt:2,
    allowedWoods:['ashwood'],
    description:'Place in a large barn interior after crafting (Carpentry Lv 15).',
    furnitureKey:'butter_churn', skill:'carpentry',
    nailsPerAttempt:10, xpFail:3, xpStage:20, xpComplete:80, completeLabel:'butter churn',
  },
  cat_bed:{
    id:'cat_bed', name:'Barn Cat Bed', icon:'🛏️', tier:'barn',
    requiredCarpentryLevel:15, stages:5, baseFurnitureChance:40,
    requiredLogKey:'ashwood', logsPerAttempt:5,
    allowedWoods:['ashwood'],
    extraInputs:[{ key:'cat_cushion', qty:1 }],
    description:'Ashwood and a cat cushion — place in a large barn (Carpentry Lv 15).',
    furnitureKey:'cat_bed', skill:'carpentry',
    nailsPerAttempt:10, xpFail:3, xpStage:18, xpComplete:70, completeLabel:'barn cat bed',
  },
  storage_chest:{
    id:'storage_chest', name:'Storage Chest', icon:'📦', tier:'barn',
    requiredCarpentryLevel:40, stages:10, baseFurnitureChance:20,
    requiredLogKey:'ebonwood', logsPerAttempt:10,
    allowedWoods:['ebonwood'],
    description:'Adds +100 barn storage when placed in a large barn (Carpentry Lv 40).',
    furnitureKey:'storage_chest', skill:'carpentry',
    nailsPerAttempt:10, xpFail:3, xpStage:18, xpComplete:75, completeLabel:'storage chest',
  },
};

const SHELF_RECIPES={
  shelf_1:{
    name:'Store Shelf I', icon:'🗄️', skill:'carpentry', stages:5, baseChance:0.10,
    nailsPerAttempt:10, xpFail:2, xpStage:15, xpComplete:60,
    completeLabel:'shelf', autoInstallShelfSlot:1,
  },
  shelf_2:{
    name:'Store Shelf II', icon:'🗄️', skill:'carpentry', stages:10, baseChance:0.10,
    nailsPerAttempt:10, xpFail:2, xpStage:15, xpComplete:75,
    completeLabel:'shelf', autoInstallShelfSlot:2,
  },
  shelf_3:{
    name:'Store Shelf III', icon:'🗄️', skill:'carpentry', stages:20, baseChance:0.10,
    nailsPerAttempt:10, xpFail:2, xpStage:15, xpComplete:100,
    completeLabel:'shelf', autoInstallShelfSlot:3,
  },
  shelf_4:{
    name:'Store Shelf IV', icon:'🗄️', skill:'carpentry', stages:40, baseChance:0.10,
    nailsPerAttempt:10, xpFail:2, xpStage:15, xpComplete:130,
    completeLabel:'shelf', autoInstallShelfSlot:4,
  },
};

const NAIL_TIER_ORDER = ['copper','bronze','iron','steel','titanium','gilded'];
const NAIL_PICKER_ORDER = ['rusty', ...NAIL_TIER_ORDER];
/** On failed attempt: 50% chance one nail is discarded. On success: 1–5 nails used. */
const NAIL_FAIL_DISCARD_CHANCE = 0.5;
const NAIL_SUCCESS_USE_MIN = 1;
const NAIL_SUCCESS_USE_MAX = 5;

const NAIL_TYPES = {
  rusty: { key:'rusty', icon:'📌', name:'Rusty Nails', bonus:0, infinite:true },
  copper: { key:'copper', icon:'🔩', name:'Copper Nails', bonus:0.05, infinite:false },
  bronze: { key:'bronze', icon:'🔩', name:'Bronze Nails', bonus:0.10, infinite:false },
  iron: { key:'iron', icon:'🔩', name:'Iron Nails', bonus:0.15, infinite:false },
  steel: { key:'steel', icon:'🔩', name:'Steel Nails', bonus:0.20, infinite:false },
  titanium: { key:'titanium', icon:'🔩', name:'Titanium Nails', bonus:0.25, infinite:false },
  gilded: { key:'gilded', icon:'✨', name:'Gilded Nails', bonus:0.25, infinite:false },
};

/** Old save keys → new nail tier keys (one-time migration). */
const NAIL_KEY_MIGRATION={
  iron:'copper',
  copper:'bronze',
  forged:'iron',
  ironbark:'steel',
  gilded:'gilded',
};