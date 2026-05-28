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
    items:['gather_wet_clearing','gather_woodland_clearing','gather_rocky_clearing'],
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
    id:'structures',
    label:'Structures',
    desc:'Permanent builds that upgrade your homestead.',
    items:['well','well_finished','fire_pit'],
  },
];
const DEFAULT_INTERIOR_LAYOUT = [
  'wardrobe','fireplace','picture',
  'workbench','build','build',
  'dogbed','doorway','build',
];
const INTERIOR_ROOM_DEFS = {
  storeroom: { typeId:'storeroom', name:'Store Room', icon:'🗄️', desc:'Deposit bag overflow and install shelves for +50 capacity each.', instanced:true },
  workbench: { typeId:'workbench', name:'Workbench', icon:'🪚', desc:'Craft furniture, shelves, and carpentry projects.' },
  fireplace: { typeId:'fireplace', name:'Fireplace', icon:'🔥', desc:'Cook raw fish and stoke the hearth for Fire skill.' },
  wardrobe:  { typeId:'wardrobe',  name:'Wardrobe',  icon:'🚪', desc:'Change clothes and stash outfits out of the way.' },
  picture:   { typeId:'picture',   name:'Picture',   icon:'🖼️', desc:'A crooked frame — poke it and see what falls loose.' },
  dogbed:    { typeId:'dogbed',    name:'Dog Bed',   icon:'🛏️', desc:'Tidy up, manage pets, and unlock husbandry perks.' },
  spinningwheel: { typeId:'spinningwheel', name:'Spinning Wheel', icon:'🎡', desc:'Spin fibers into thread — basic, medium, and enhanced.' },
  apothecary_table: { typeId:'apothecary_table', name:'Apothecary Table', icon:'⚗️', desc:'Identify foraged herbs and unlock botany work.' },
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
const INTERIOR_ROOM_MENU = ['storeroom','workbench','fireplace','spinningwheel','wardrobe','picture','dogbed'];

const ARCH_ROOM_BONUS_BASE_XP = 5000;
const ARCH_ROOM_BONUS_SCALE = 1.3;
const ARCH_ROOM_BONUS_FIRST_ROOM = 10;