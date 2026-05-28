/* Hearthstead — data init */
'use strict';

/* ═══════════════════════════════════════
   DATA INIT (derived registrations)
═══════════════════════════════════════ */
const PLOT_TILE_DEFS = { ...PLOT_TILE_BASE };
WOODLANDS.forEach(w=>{
  PLOT_TILE_DEFS['woodland_'+w.key]={
    typeId:'woodland_'+w.key,
    name:w.name,
    icon:'🌲',
    behavior:'tree',
    removable:true,
    category:'woodland',
    woodlandId:w.id,
    unlockLevel:w.unlockLevel,
  };
});
GATHERING_LOCATIONS.forEach(g=>{
  PLOT_TILE_DEFS[g.typeId]={
    typeId:g.typeId,
    name:g.name,
    icon:g.icon,
    behavior:'gather',
    removable:true,
    category:'gathering',
    gatherKey:g.key,
  };
});
MINES.forEach(m=>{
  PLOT_TILE_DEFS[m.key]={
    typeId:m.key,
    name:m.name,
    icon:m.icon,
    behavior:'quarry',
    removable:true,
    category:'quarry',
    mineId:m.id,
    unlockLevel:m.unlockLevel,
  };
});
Object.entries(FURNITURE_CRAFTS).forEach(([id,f])=>{
  const key=f.furnitureKey||id;
  FURNITURE_DEFS[key]={
    key, icon:f.icon, name:f.name, action:furnitureActionForKey(key), utility:!!f.utility,
  };
});
const FURNITURE_RECIPES={ ...FURNITURE_CRAFTS };
const SHELF_CRAFT_RECIPES={ ...SHELF_RECIPES };
const RECIPES={ ...FURNITURE_RECIPES, ...SHELF_CRAFT_RECIPES };

const LOG_TYPES = {};
Object.keys(LOG_DEFS).forEach(k=>{
  const d=LOG_DEFS[k];
  LOG_TYPES[k]={ key:d.key, icon:d.icon, name:d.name, bonus:d.bonus, infinite:false, vibe:d.vibe };
});
