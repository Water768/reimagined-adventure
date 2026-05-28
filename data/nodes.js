/* Hearthstead — nodes (static data) */
'use strict';

const WOODLANDS = [
  { id:1,  key:'clearing',        name:'The Clearing',      unlockLevel:1,  recommendedLevel:1,  drops:[{log:'logs',pct:100}] },
  { id:2,  key:'ashwood_grove',   name:'Ashwood Grove',     unlockLevel:8,  recommendedLevel:8,  drops:[{log:'logs',pct:70},{log:'ashwood',pct:30}] },
  { id:3,  key:'old_coppice',     name:'The Old Coppice',   unlockLevel:15, recommendedLevel:15, drops:[{log:'logs',pct:40},{log:'ashwood',pct:45},{log:'teak',pct:15}] },
  { id:4,  key:'teak_run',        name:'Teak Run',          unlockLevel:22, recommendedLevel:22, drops:[{log:'logs',pct:20},{log:'ashwood',pct:30},{log:'teak',pct:50}] },
  { id:5,  key:'yew_hollow',      name:'Yew Hollow',        unlockLevel:32, recommendedLevel:32, drops:[{log:'ashwood',pct:10},{log:'teak',pct:50},{log:'yew',pct:35},{log:'silverbirch',pct:5}] },
  { id:6,  key:'whisper_wood',    name:'The Whisper Wood',  unlockLevel:40, recommendedLevel:40, drops:[{log:'teak',pct:20},{log:'yew',pct:40},{log:'silverbirch',pct:35},{log:'ebonwood',pct:4},{log:'singing_oak',pct:1}] },
  { id:7,  key:'ebonwood_thicket',name:'Ebonwood Thicket',  unlockLevel:52, recommendedLevel:52, drops:[{log:'yew',pct:10},{log:'silverbirch',pct:25},{log:'ebonwood',pct:55},{log:'ironbark',pct:9},{log:'singing_oak',pct:1}] },
  { id:8,  key:'irongrove',       name:'The Irongrove',     unlockLevel:65, recommendedLevel:65, drops:[{log:'ebonwood',pct:10},{log:'silverbirch',pct:30},{log:'ironbark',pct:55},{log:'yew',pct:4},{log:'singing_oak',pct:1}] },
  { id:9,  key:'ancient_hollow',  name:'Ancient Hollow',    unlockLevel:78, recommendedLevel:78, drops:[{log:'ebonwood',pct:20},{log:'ironbark',pct:30},{log:'silverbirch',pct:40},{log:'yew',pct:9},{log:'singing_oak',pct:1}] },
  { id:10, key:'heartwood',       name:'The Heartwood',     unlockLevel:90, recommendedLevel:90, drops:[{log:'ironbark',pct:15},{log:'ebonwood',pct:35},{log:'silverbirch',pct:40},{log:'yew',pct:9},{log:'singing_oak',pct:1}] },
];

const PLOT_TILE_BASE = {
  hut:         { typeId:'hut',         name:'Your Hut',    icon:'🏠', behavior:'hut',   removable:false },
  water_basic: { typeId:'water_basic', name:'Basic Water', icon:'🌊', behavior:'water', removable:true,  category:'water' },
  cave:        { typeId:'cave',        name:'Cave',        icon:'🕳️', behavior:'cave',  removable:true,  category:'cave' },
  well:        { typeId:'well',        name:'Well (bucketless)', icon:'🪣', behavior:'well',  removable:true, category:'structure', archUnlockLevel:1, desc:'Build with 50 bricks — free after your first.' },
  well_finished:{ typeId:'well_finished', name:'Well', icon:'🪣', behavior:'well', removable:true, category:'structure', archUnlockLevel:1, desc:'A working well — free after your first.' },
  fire_pit:    { typeId:'fire_pit',    name:'Fire Pit', icon:'🔥', behavior:'fire_pit', removable:true, category:'structure', archUnlockLevel:4, desc:'Build with 50 stone, 50 clay, and 50 bricks — free after your first.' },
};

const MINES = [
  {
    id:1, key:'quarry_basic', name:'Quarry', icon:'⛏️',
    unlockLevel:1, recommendedLevel:1,
    drops:[
      { ore:'stone', weight:40 },
      { ore:'limestone', weight:15 },
      { ore:'brick', weight:15 },
      { ore:'clay', weight:10 },
      { ore:'sandstone', weight:10 },
      { ore:'slate', weight:5 },
      { ore:'granite', weight:3 },
      { ore:'coal', weight:2 },
    ],
  },
  {
    id:2, key:'stone_quarry', name:'Stone Quarry', icon:'🪨',
    unlockLevel:10, recommendedLevel:10,
    drops:[
      { ore:'stone', weight:55 },
      { ore:'limestone', weight:20 },
      { ore:'sandstone', weight:10 },
      { ore:'slate', weight:8 },
      { ore:'granite', weight:5 },
      { ore:'clay', weight:2 },
    ],
  },
  {
    id:3, key:'clay_pit', name:'Clay Pit', icon:'🟤',
    unlockLevel:15, recommendedLevel:15,
    drops:[
      { ore:'clay', weight:50 },
      { ore:'stone', weight:20 },
      { ore:'brick', weight:10 },
      { ore:'limestone', weight:10 },
      { ore:'chalk', weight:8 },
      { ore:'copper_ore', weight:2 },
    ],
  },
  {
    id:4, key:'brick_deposit', name:'Brick Deposit', icon:'🧱',
    unlockLevel:18, recommendedLevel:18,
    drops:[
      { ore:'brick', weight:45 },
      { ore:'stone', weight:25 },
      { ore:'chalk', weight:10 },
      { ore:'limestone', weight:10 },
      { ore:'clay', weight:7 },
      { ore:'copper_ore', weight:3 },
    ],
  },
  {
    id:5, key:'coal_mine', name:'Coal Mine', icon:'⚫',
    unlockLevel:28, recommendedLevel:28,
    drops:[
      { ore:'coal', weight:45 },
      { ore:'slate', weight:15 },
      { ore:'stone', weight:15 },
      { ore:'iron_ore', weight:10 },
      { ore:'copper_ore', weight:8 },
      { ore:'quartz', weight:5 },
      { ore:'salt_rock', weight:2 },
    ],
  },
  {
    id:6, key:'iron_mine', name:'Iron Mine', icon:'🔩',
    unlockLevel:42, recommendedLevel:42,
    drops:[
      { ore:'iron_ore', weight:40 },
      { ore:'stone', weight:20 },
      { ore:'slate', weight:10 },
      { ore:'coal', weight:10 },
      { ore:'copper_ore', weight:10 },
      { ore:'tin_ore', weight:7 },
      { ore:'silver_ore', weight:3 },
    ],
  },
  {
    id:7, key:'deep_vein', name:'Deep Vein', icon:'💎',
    unlockLevel:58, recommendedLevel:58,
    drops:[
      { ore:'iron_ore', weight:25 },
      { ore:'copper_ore', weight:20 },
      { ore:'tin_ore', weight:15 },
      { ore:'stone', weight:10 },
      { ore:'coal', weight:10 },
      { ore:'silver_ore', weight:10 },
      { ore:'gold_ore', weight:5 },
      { ore:'quartz', weight:5 },
    ],
  },
];

const GATHERING_LOCATIONS=[
  {
    key:'wet_clearing',
    typeId:'gather_wet_clearing',
    name:'Wet Clearing',
    icon:'💧',
    shardTypes:['water'],
    drops:[
      {key:'reeds',icon:'🌾',name:'Reeds',weight:30},
      {key:'worms',icon:'🪱',name:'Worms',weight:25},
      {key:'basic_herbs',icon:'🌿',name:'Basic Herbs',weight:25},
      {key:'feathers',icon:'🪶',name:'Feathers',weight:20},
    ],
  },
  {
    key:'woodland_clearing',
    typeId:'gather_woodland_clearing',
    name:'Woodland Clearing',
    icon:'🍄',
    shardTypes:['earth','air'],
    drops:[
      {key:'twisted_grass',icon:'🌾',name:'Twisted Grass',weight:25},
      {key:'nettles',icon:'🌿',name:'Nettles',weight:25},
      {key:'mushrooms',icon:'🍄',name:'Mushrooms',weight:20},
      {key:'basic_herbs',icon:'🌿',name:'Basic Herbs',weight:20},
      {key:'feathers',icon:'🪶',name:'Feathers',weight:10},
    ],
  },
  {
    key:'rocky_clearing',
    typeId:'gather_rocky_clearing',
    name:'Rocky Clearing',
    icon:'🪨',
    shardTypes:['earth'],
    drops:[
      {key:'brick',icon:'🧱',name:'Brick',weight:35},
      {key:'copper_ore',icon:'🟤',name:'Copper Ore',weight:30},
      {key:'artefact_basic',icon:'🏺',name:'Basic Artefact',weight:18},
      {key:'quartz',icon:'💎',name:'Quartz',weight:8,rare:true},
      {key:'artefact_rare',icon:'🗿',name:'Rare Artefact',weight:5,rare:true},
      {key:'pickaxe',icon:'⛏️',name:'Pickaxe',weight:2,rare:true},
      {key:'artefact_extreme',icon:'👑',name:'Extreme Artefact',weight:0.5,rare:true},
    ],
  },
];

const GATHER_BASE_SUCCESS=0.20;
const GATHER_SUCCESS_PER_LEVEL=0.05;
const GATHER_ITEMS_PER_SESSION=4;
const GATHER_XP_SUCCESS=8;
const GATHER_XP_MISS=2;
const CLUTTER_CHANCE=1/3;

const MINE_MAX_STACKS=10;
const MINE_BASE_SUCCESS=0.30;
const MINE_SUCCESS_PER_LEVEL=0.03;
const MINE_XP_SUCCESS=8;
const MINE_XP_MISS=2;
const USELESS_LUMP={key:'useless_lump',icon:'🪨',name:'Useless Lump'};