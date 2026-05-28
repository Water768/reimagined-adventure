const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const htmlPath = path.join(dir, 'Game - Draft 1.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const scriptMatch = html.match(/<script>\n([\s\S]*)<\/script>\n<\/body>/);
if (!scriptMatch) throw new Error('script not found');
let script = scriptMatch[1];

function removeBetween(start, end) {
  const s = script.indexOf(start);
  if (s < 0) throw new Error('Start not found: ' + start);
  const e = script.indexOf(end, s);
  if (e < 0) throw new Error('End not found after: ' + start);
  script = script.slice(0, s) + script.slice(e);
}

removeBetween('const DEFAULT_PLOT_SLOTS = [', 'const LOG_TIER_ORDER = [');
removeBetween('const LOG_TIER_ORDER = [', 'const GATHER_BASE_SUCCESS=0.20;');
removeBetween('const PLOT_TILE_MENU = [', 'function getDefaultState()');
removeBetween('const SHARD_CHANCE = 0.01;', 'let invSelectedKey = null;');
removeBetween('const SKILL_META={', 'const WATER_BODY_TYPES={');
removeBetween('const WATER_BODY_TYPES={', 'const fish={ running:false');
removeBetween('const WOOD_MODIFIERS={', 'function getCarpentryLevel()');

const dataInit = `
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
    key, icon:f.icon, name:f.name, action:furnitureActionForKey(key),
  };
});
const RECIPES={ ...FURNITURE_CRAFTS, ...SHELF_RECIPES };

const LOG_TYPES = {};
Object.keys(LOG_DEFS).forEach(k=>{
  const d=LOG_DEFS[k];
  LOG_TYPES[k]={ key:d.key, icon:d.icon, name:d.name, bonus:d.bonus, infinite:false, vibe:d.vibe };
});

`;

const catEnd = script.indexOf('const CAT_NAMES = ');
if (catEnd < 0) throw new Error('CAT_NAMES not found');
const insertAt = script.indexOf('\n', script.indexOf('];', catEnd)) + 1;
script = script.slice(0, insertAt) + dataInit + script.slice(insertAt);

const dataScripts = [
  'data/plot-layout.js',
  'data/resources.js',
  'data/nodes.js',
  'data/interior.js',
  'data/skills.js',
  'data/equipment.js',
  'data/fish.js',
  'data/crafting.js',
  'data/water.js',
  'data/furniture.js',
].map(s => `<script src="${s}"></script>`).join('\n');

const newHtml = html.replace(
  /<script>\n[\s\S]*<\/script>\n<\/body>/,
  dataScripts + '\n<script>\n' + script + '</script>\n</body>'
);

fs.writeFileSync(htmlPath, newHtml);
console.log('Patched HTML successfully');
