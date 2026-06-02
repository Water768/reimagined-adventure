/* Hearthstead — interior (static data) */
'use strict';

const PLOT_TILE_MENU = [
  {
    id:'woodland',
    label:'Woodlands',
    desc:'Use an axe to chop trees and obtain logs.',
    items:WOODLANDS.map(w=>'woodland_'+w.key),
  },
  {
    id:'gathering',
    label:'Clearings',
    desc:'Forage for herbs, fibres, and odd finds.',
    items:typeof GATHERING_LOCATIONS!=='undefined'
      ?GATHERING_LOCATIONS.map((g)=>g.typeId)
      :['gather_wet_clearing','gather_woodland_clearing','gather_rocky_clearing'],
  },
  {
    id:'water',
    label:'Water',
    desc:'Fish for raw catches. Pond shapes may affect what bites.',
    items:['water_basic'],
  },
  {
    id:'quarry',
    label:'Quarries',
    desc:'Stack mining strikes and haul stone, clay, and ore.',
    items:MINES.map(m=>m.key),
  },
  {
    id:'cave',
    label:'Caves',
    desc:'Explore underground passages and see what lies beneath.',
    items:['cave'],
  },
  {
    id:'expedition',
    label:'Expeditions',
    desc:'Launch treks from woodland trails — some need an adjacent camp.',
    items:['whispering_woods','sunken_shallows'],
  },
  {
    id:'structures',
    label:'Structures',
    desc:'Permanent builds that upgrade your homestead.',
    items:['well','well_finished','well_hydrated','fire_pit','simple_kiln','washing_line','whisper_camp','coastal_docks','small_barn','small_barn_walls','small_barn_doorless','small_barn_complete','medium_barn_complete','large_barn_complete'],
  },
  {
    id:'farming',
    label:'Farming',
    desc:'Plant seeds and harvest crops on timed plots.',
    items:['farm_plot'],
  },
];
const DEFAULT_INTERIOR_LAYOUT = [
  'wardrobe','fireplace','build',
  'workbench','build','build',
  'dogbed','doorway','build',
];
const INTERIOR_ROOM_DEFS = {
  storeroom: { typeId:'storeroom', name:'Store Room', icon:'🗄️', desc:'Deposit bag overflow and install shelves for +50 capacity each.', instanced:true },
  tool_store: { typeId:'tool_store', name:'Tool Storage', icon:'🧰', desc:'Tools and Bulk Storage — equip tools once, forever; extra room for buckets, materials, rope, and nails.' },
  workbench: { typeId:'workbench', name:'Workbench', icon:'🪚', desc:'Craft furniture, shelves, and carpentry projects.' },
  fireplace: { typeId:'fireplace', name:'Fireplace', icon:'🔥', desc:'Cook raw fish and stoke the hearth for Fire skill.' },
  wardrobe:  { typeId:'wardrobe',  name:'Wardrobe',  icon:'🚪', desc:'Change clothes and stash outfits out of the way.' },
  dogbed:    { typeId:'dogbed',    name:'Dog Bed',   icon:'🛏️', desc:'Tidy up, manage pets, and unlock husbandry perks.' },
  spinningwheel: { typeId:'spinningwheel', name:'Spinning Wheel', icon:'🎡', desc:'Spin fibers into thread, or twist thread and flax into rope.' },
  apothecary_table: { typeId:'apothecary_table', name:'Apothecary Table', icon:'⚗️', desc:'Identify foraged herbs and unlock botany work.' },
  wonky_loom: { typeId:'wonky_loom', name:'Wonky Loom', icon:'🧵', desc:'Weave thread and fiber into cloth — wobbly, but it works.' },
  study_desk: { typeId:'study_desk', name:'Study Desk', icon:'📖', desc:'Study academia — books, maps, and artefacts.' },
  bookcase: { typeId:'bookcase', name:'Bookcase', icon:'📚', desc:'Activate journal rewards earned at the study desk.' },
  crafting_desk: { typeId:'crafting_desk', name:'Crafting Desk', icon:'🛠️', desc:'Craft waterproof paste, waders, and other workshop goods.' },
};
const FURNITURE_DEFS={};

function furnitureActionForKey(key){
  return key==='chair'||key.endsWith('_chair')?'sit':null;
}

const CHAIR_SIT_LINES=[
  'You sit quietly for a while. The wind moves through the trees. Nothing needs doing right now.',
  'The chair creaks beneath you. Once, silence felt empty. Now it feels earned.',
  'You watch the light fade across the ground outside your home. Life has become smaller, and somehow fuller.',
  'For a moment, you remember the noise and rush of your old life. It feels very far away now.',
  'You lean back and listen to the crackle of the fire. The world is still difficult, but it finally feels honest.',
  'You rest your hands on your knees and breathe. The hut is small, but it is yours.',
  'Outside, something moves in the grass. You do not need to check. Not everything asks for your attention.',
  'The wood is warm where the sun touched it through the window. You stay a little longer.',
];
const INTERIOR_ROOM_MENU = ['storeroom','tool_store','workbench','fireplace','spinningwheel','wardrobe','dogbed'];

const ARCH_ROOM_BONUS_BASE_XP = 5000;
const ARCH_ROOM_BONUS_SCALE = 1.3;
const ARCH_ROOM_BONUS_FIRST_ROOM = 10;

/** Extra per-item capacity each tool store on the map adds (requires a store room for any storage). */
const TOOL_STORE_BULK_CAPS = {
  bucket: 500,
  brick: 500,
  slate: 500,
  rope: 500,
};
const TOOL_STORE_NAIL_BULK_CAP = 5000;