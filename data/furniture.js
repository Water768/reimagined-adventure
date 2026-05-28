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

const FURNITURE_TIERS={
  simple:{ label:'Simple', order:1, code:'S' },
  hardwood:{ label:'Hardwood', order:2, code:'H' },
  artisan:{ label:'Artisan', order:3, code:'A' },
  mythical:{ label:'Mythical', order:4, code:'M' },
};

/** Logs shown in UI / log picker per furniture tier. */
const FURNITURE_TIER_WOODS={
  simple:['logs','ashwood','teak'],
  hardwood:['teak','yew','ebonwood','silverbirch','ironbark'],
  artisan:['ebonwood','ironbark','yew'],
  mythical:['singing_oak'],
};

/** Singing Oak works on any tier but only appears in lists for Mythical. */
const FURNITURE_BONUS_WOOD='singing_oak';

const FURNITURE_CRAFTS={
  // ── Simple tier ──
  chair:{
    id:'chair', name:'Chair', icon:'🪑', tier:'simple',
    requiredCarpentryLevel:1, stages:3, baseFurnitureChance:10,
    allowedWoods:'all',
    description:'A simple seat hewn from whatever wood was handy.',
    furnitureKey:'chair', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:15, xpComplete:50, completeLabel:'chair',
  },
  bookshelf:{
    id:'bookshelf', name:'Bookshelf', icon:'📚', tier:'simple',
    requiredCarpentryLevel:5, stages:4, baseFurnitureChance:55,
    allowedWoods:'all',
    description:'A rough wooden shelf hammered together by hand.',
    furnitureKey:'bookshelf', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:12, xpComplete:40, completeLabel:'bookshelf',
  },
  table:{
    id:'table', name:'Table', icon:'🍽️', tier:'simple',
    requiredCarpentryLevel:8, stages:4, baseFurnitureChance:45,
    allowedWoods:'all',
    description:'A sturdy flat surface for meals and work.',
    furnitureKey:'table', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:14, xpComplete:55, completeLabel:'table',
  },
  wonky_loom:{
    id:'wonky_loom', name:'Wonky Loom', icon:'🧵', tier:'simple',
    requiredCarpentryLevel:10, stages:5, baseFurnitureChance:48,
    allowedWoods:'all',
    description:'A wobbly frame that somehow turns thread into fabric — just not very well.',
    furnitureKey:'wonky_loom', skill:'carpentry', utility:true, makesFabric:true,
    nailsPerAttempt:10, xpFail:2, xpStage:14, xpComplete:58, completeLabel:'wonky loom',
  },
  apothecary_table:{
    id:'apothecary_table', name:'Apothecary Table', icon:'⚗️', tier:'simple',
    requiredCarpentryLevel:13, stages:6, baseFurnitureChance:35,
    allowedWoods:'all',
    description:'A sturdy work surface for sorting and preparing herbs.',
    furnitureKey:'apothecary_table', skill:'carpentry', utility:true, unlocksBotany:true,
    nailsPerAttempt:10, xpFail:2, xpStage:16, xpComplete:65, completeLabel:'apothecary table',
  },
  // ── Hardwood tier (starts Lv 20) ──
  hardwood_chair:{
    id:'hardwood_chair', name:'Hardwood Chair', icon:'🪑', tier:'hardwood',
    requiredCarpentryLevel:20, stages:4, baseFurnitureChance:35,
    allowedWoods:'hardwood_plus',
    description:'A solid chair built from proper hardwood stock.',
    furnitureKey:'hardwood_chair', skill:'carpentry',
    nailsPerAttempt:10, xpFail:2, xpStage:16, xpComplete:65, completeLabel:'chair',
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

const NAIL_TIER_ORDER = ['iron', 'copper', 'forged', 'ironbark', 'gilded'];
const NAIL_PICKER_ORDER = ['rusty', ...NAIL_TIER_ORDER];
/** On failed attempt: 50% chance one nail is discarded. On success: 1–5 nails used. */
const NAIL_FAIL_DISCARD_CHANCE = 0.5;
const NAIL_SUCCESS_USE_MIN = 1;
const NAIL_SUCCESS_USE_MAX = 5;

const NAIL_TYPES = {
  rusty: { key:'rusty', icon:'📌', name:'Rusty Nails', bonus:0, infinite:true },
  iron: { key:'iron', icon:'🔩', name:'Iron Nails', bonus:0.05, infinite:false },
  copper: { key:'copper', icon:'🔩', name:'Copper Nails', bonus:0.10, infinite:false },
  forged: { key:'forged', icon:'🔩', name:'Forged Nails', bonus:0.15, infinite:false },
  ironbark: { key:'ironbark', icon:'🔩', name:'Ironbark Nails', bonus:0.20, infinite:false },
  gilded: { key:'gilded', icon:'✨', name:'Gilded Nails', bonus:0.25, infinite:false },
};