/* Hearthstead — nodes (static data) */
'use strict';

const WOODLANDS = [
  { id:1,  key:'clearing',        name:'Lonely Tree',       unlockLevel:1,  recommendedLevel:1,  drops:[{log:'logs',pct:100}] },
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
  well_finished:{ typeId:'well_finished', name:'Well (dry)', icon:'🪣', behavior:'well', removable:true, category:'structure', archUnlockLevel:1, desc:'Rope and bucket fitted — hydrate to draw water.' },
  well_hydrated:{ typeId:'well_hydrated', name:'Well', icon:'💧', behavior:'well', removable:true, category:'structure', archUnlockLevel:1, waterSource:true, desc:'A working water source — free after your first.' },
  fire_pit:    { typeId:'fire_pit',    name:'Fire Pit', icon:'🔥', behavior:'fire_pit', removable:true, category:'structure', archUnlockLevel:4, desc:'Build with 50 stone, 50 clay, and 50 bricks — free after your first.' },
  simple_kiln: { typeId:'simple_kiln', name:'Simple Kiln', icon:'🏺', behavior:'kiln', removable:true, category:'structure', archUnlockLevel:8, desc:'Build with 50 stone, 50 clay, and 50 bricks — smelt bricks and glass.' },
  small_barn:           { typeId:'small_barn',           name:'Small Barn',           icon:'🏚️', behavior:'barn', removable:true, category:'structure', archUnlockLevel:5, desc:'Raise the frame with 200 logs and 200 nails — free after your first.' },
  small_barn_walls:     { typeId:'small_barn_walls',     name:'Small Barn (walls)',   icon:'🏚️', behavior:'barn', removable:true, category:'structure', archUnlockLevel:5, desc:'Walls raised — add 50 slate and 50 nails for the roof.' },
  small_barn_doorless:  { typeId:'small_barn_doorless',  name:'Small Barn (doorless)', icon:'🏚️', behavior:'barn', removable:true, category:'structure', archUnlockLevel:5, desc:'Roof fitted — add 50 ashwood and 50 nails for the barn door.' },
  small_barn_complete:  { typeId:'small_barn_complete',  name:'Small Barn',           icon:'🏚️', behavior:'barn', removable:true, category:'structure', archUnlockLevel:5, desc:'A finished barn — free to place after your first.' },
  medium_barn_complete: { typeId:'medium_barn_complete', name:'Medium Barn',          icon:'🏛️', behavior:'barn', removable:true, category:'structure', archUnlockLevel:15, footprint:1, desc:'Two animal pens and a barn interior — free to place after your first upgrade.' },
  large_barn_complete:  { typeId:'large_barn_complete',  name:'Large Barn',           icon:'🏛️', behavior:'barn', removable:true, category:'structure', archUnlockLevel:35, footprint:1, desc:'Four pens, barn interior, and specialty habitats — free after your first large barn upgrade.' },
  washing_line:          { typeId:'washing_line',          name:'Washing Line',          icon:'🧺', behavior:'washing_line', removable:true, category:'structure', archUnlockLevel:3, desc:'Raise with 20 logs, then 10 rope — dry grass, wheat, and hides with air.' },
  improved_washing_line: { typeId:'improved_washing_line', name:'Washing Line', icon:'🧺', behavior:'washing_line', removable:true, category:'structure', archUnlockLevel:3, desc:'Raise with 20 logs, then 10 rope — dry grass, wheat, and hides with air.' },
  whisper_camp:          { typeId:'whisper_camp',          name:'Whispering Woods Camp', icon:'⛺', behavior:'whisper_camp', removable:true, category:'structure', archUnlockLevel:1, desc:'Raise with logs — unlock treks at the adjacent Whispering Woods.' },
  whisper_camp_t2:       { typeId:'whisper_camp_t2',       name:'Whispering Woods Camp', icon:'⛺', behavior:'whisper_camp', removable:true, category:'structure', archUnlockLevel:1, desc:'Upgraded camp — Medium Treks at Whispering Woods.' },
  whisper_camp_t3:       { typeId:'whisper_camp_t3',       name:'Whispering Woods Camp', icon:'⛺', behavior:'whisper_camp', removable:true, category:'structure', archUnlockLevel:1, desc:'Max camp — Long Treks at Whispering Woods.' },
  whispering_woods:      { typeId:'whispering_woods',      name:'Whispering Woods',      icon:'🌲', behavior:'cave', expeditionKey:'whispering_woods', removable:true, category:'expedition', desc:'Launch treks when a camp is built next door.' },
  coastal_docks:         { typeId:'coastal_docks',         name:'Coastal Docks',         icon:'⚓', behavior:'coastal_docks', removable:true, category:'structure', archUnlockLevel:1, desc:'Raise with logs — unlock treks at the adjacent Sunken Shallows.' },
  coastal_docks_t2:      { typeId:'coastal_docks_t2',      name:'Coastal Docks',         icon:'⚓', behavior:'coastal_docks', removable:true, category:'structure', archUnlockLevel:1, desc:'Upgraded docks — Medium Treks at Sunken Shallows.' },
  coastal_docks_t3:      { typeId:'coastal_docks_t3',      name:'Coastal Docks',         icon:'⚓', behavior:'coastal_docks', removable:true, category:'structure', archUnlockLevel:1, desc:'Max docks — Long Treks at Sunken Shallows.' },
  sunken_shallows:       { typeId:'sunken_shallows',       name:'Sunken Shallows',       icon:'🌊', behavior:'cave', expeditionKey:'sunken_shallows', removable:true, category:'expedition', desc:'Launch coastal treks when docks are built next door.' },
  farm_plot:   { typeId:'farm_plot',   name:'Farming Plot', icon:'🌾', behavior:'farm', removable:true, category:'farming', desc:'Plant seeds and harvest crops over time.' },
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
      {key:'reeds',icon:'🌾',name:'Reeds',weight:25},
      {key:'worms',icon:'🪱',name:'Worms',weight:20},
      {key:'basic_herbs',icon:'🌿',name:'Basic Herbs',weight:20},
      {key:'feathers',icon:'🪶',name:'Feathers',weight:15},
      {key:'duckweed',icon:'🌿',name:'Duckweed',weight:20},
      {key:'gathering_page',icon:'📄',name:'Gathering Page',weight:4},
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
      {key:'gathering_page',icon:'📄',name:'Gathering Page',weight:4},
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
      {key:'copper_ore',icon:'🟤',name:'Copper Ore',weight:24},
      {key:'bones',icon:'🦴',name:'Bones',weight:5},
      {key:'large_bone',icon:'🦴',name:'Large Bone',weight:1},
      {key:'artefact_basic',icon:'🏺',name:'Basic Artefact',weight:9},
      {key:'old_coin',icon:'🪙',name:'Old Coin',weight:12},
      {key:'quartz',icon:'💎',name:'Quartz',weight:5,rare:true},
      {key:'artefact_rare',icon:'🗿',name:'Rare Artefact',weight:5,rare:true},
      {key:'pickaxe',icon:'⛏️',name:'Pickaxe',weight:2,rare:true},
      {key:'artefact_extreme',icon:'👑',name:'Extreme Artefact',weight:0.5,rare:true},
    ],
  },
  {
    key:'fairy_grove',
    typeId:'gather_fairy_grove',
    name:'The Fairy Grove',
    icon:'🧚',
    shardTypes:['earth'],
    harvestLevel:15,
    unlockRequirements:[
      { skill:'earth', level:15 },
      { skill:'husbandry', level:20 },
    ],
    drops:[
      {key:'mushrooms',icon:'🍄',name:'Mushrooms',weight:815},
      {key:'medium_apothecary_sprigs',icon:'🌿',name:'Medium Apothecary Sprigs',weight:120},
      {key:'fairy_dust',icon:'✨',name:'Fairy Dust',weight:40},
      {key:'gathering_page',icon:'📄',name:'Gathering Page',weight:20},
      {key:'shed_glowing_antler_piece',icon:'🦌',name:'Shed Glowing Antler Piece',weight:5,rare:true},
    ],
  },
  {
    key:'sunken_rock_pools',
    typeId:'gather_sunken_rock_pools',
    name:'The Sunken Rock Pools',
    icon:'🪨',
    shardTypes:['water'],
    harvestLevel:15,
    unlockRequirements:[{ skill:'water', level:15 }],
    drops:[
      {key:'seashell',icon:'🐚',name:'Seashell',weight:23},
      {key:'medium_apothecary_sprigs',icon:'🌿',name:'Medium Apothecary Sprigs',weight:17},
      {key:'pool_goby',icon:'🐟',name:'Pool Goby',weight:20},
      {key:'hermit_crab_shell',icon:'🦀',name:'Hermit Crab Shell',weight:15},
      {key:'purple_jelly_goo',icon:'🟣',name:'Purple Jelly Goo',weight:12},
      {key:'sunken_lockbox',icon:'📦',name:'Sunken Lockbox',weight:6},
      {key:'gathering_page',icon:'📄',name:'Gathering Page',weight:4},
      {key:'glittering_fishscale',icon:'✨',name:'Glittering Fishscale',weight:2,rare:true},
      {key:'glow_anemone_spores',icon:'🪸',name:'Glow-Anemone Spores',weight:1,rare:true},
    ],
  },
];

function sortedGatheringDrops(gatherKey){
  const loc=GATHERING_LOCATIONS.find(g=>g.key===gatherKey);
  if(!loc?.drops?.length) return [];
  const total=loc.drops.reduce((s,d)=>s+d.weight,0);
  return loc.drops.slice()
    .sort((a,b)=>b.weight-a.weight)
    .map(d=>({ ...d, pct:Math.round((d.weight/total)*100) }));
}

const GATHER_BASE_SUCCESS=0.14;
const GATHER_SUCCESS_PER_LEVEL=0.003;
const GATHER_MAX_SUCCESS=0.22;
const GATHER_ITEMS_PER_SESSION=8;
const GATHER_XP_SUCCESS=20;
const GATHER_XP_MISS=8;
const CLUTTER_CHANCE=1/3;

const MINE_MAX_STACKS=10;
const MINE_BASE_SUCCESS=0.30;
const MINE_SUCCESS_PER_LEVEL=0.03;
const MINE_XP_SUCCESS=8;
const MINE_XP_MISS=2;
const USELESS_LUMP={key:'useless_lump',icon:'🪨',name:'Useless Lump'};