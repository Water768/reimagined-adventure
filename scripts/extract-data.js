const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const htmlPath = path.join(dir, 'Game - Draft 1.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = html.match(/<script>\n([\s\S]*)<\/script>\n<\/body>/);
if (!scriptMatch) throw new Error('script not found');
const script = scriptMatch[1];

function sliceBetween(start, end) {
  const s = script.indexOf(start);
  if (s < 0) throw new Error('Start not found: ' + start);
  const e = end ? script.indexOf(end, s) : script.length;
  if (e < 0) throw new Error('End not found after: ' + start);
  return script.slice(s, e).trimEnd();
}

const plotLayout = sliceBetween('const DEFAULT_PLOT_SLOTS = [', 'const LOG_TIER_ORDER');
const resources = sliceBetween('const LOG_TIER_ORDER = [', 'const WOODLANDS = [');
const woodlands = sliceBetween('const WOODLANDS = [', 'const PLOT_TILE_DEFS = {');
const plotTileBaseRaw = sliceBetween('const PLOT_TILE_DEFS = {', 'WOODLANDS.forEach(w=>{');
const plotTileBase = plotTileBaseRaw.replace(/^const PLOT_TILE_DEFS = /, 'const PLOT_TILE_BASE = ');
const gathering = sliceBetween('const GATHERING_LOCATIONS=[', 'GATHERING_LOCATIONS.forEach(g=>{');
const nodesActivity =
  sliceBetween('const GATHER_BASE_SUCCESS=0.20;', 'const USELESS_LUMP=') +
  '\n' +
  sliceBetween('const USELESS_LUMP=', 'const PLOT_TILE_MENU = [');
const interior = sliceBetween('const PLOT_TILE_MENU = [', 'function getDefaultState()');
const equipment = sliceBetween('const SHARD_CHANCE = 0.01;', 'let invSelectedKey = null;');
const skills = sliceBetween('const SKILL_META={', 'const FISH_DEFS={');
const fish = sliceBetween('const FISH_DEFS={', 'const COOK_BASE_SUCCESS=0.20;');
const crafting = sliceBetween('const COOK_BASE_SUCCESS=0.20;', 'function spinRecipeLabel(recipe){') +
  '\n\n' +
  sliceBetween('function spinRecipeLabel(recipe){', 'const WATER_BODY_TYPES={');
const water = sliceBetween('const WATER_BODY_TYPES={', 'const fish={ running:false');
const furniture = sliceBetween('const WOOD_MODIFIERS={', 'Object.entries(FURNITURE_CRAFTS).forEach(([id,f])=>{');
const shelfRecipes = sliceBetween('const SHELF_RECIPES={', 'const RECIPES={ ...FURNITURE_CRAFTS, ...SHELF_RECIPES };');

const header = (name) => `/* Hearthstead — ${name} (static data) */\n'use strict';\n\n`;
const dataDir = path.join(dir, 'data');

fs.writeFileSync(path.join(dataDir, 'plot-layout.js'), header('plot layout') + plotLayout);
fs.writeFileSync(path.join(dataDir, 'resources.js'), header('resources') + sliceBetween('const LOG_TIER_ORDER = [', 'const WOODLANDS = ['));
fs.writeFileSync(
  path.join(dataDir, 'nodes.js'),
  header('nodes') +
    sliceBetween('const WOODLANDS = [', 'const PLOT_TILE_DEFS = {') +
    '\n\n' + plotTileBase + '\n\n' +
    gathering + '\n\n' +
    nodesActivity.trim()
);
fs.writeFileSync(path.join(dataDir, 'interior.js'), header('interior') + interior.trim());
fs.writeFileSync(path.join(dataDir, 'skills.js'), header('skills') + sliceBetween('const SKILL_META={', 'const FISH_DEFS={'));
fs.writeFileSync(path.join(dataDir, 'equipment.js'), header('equipment') + equipment.trim());
fs.writeFileSync(path.join(dataDir, 'fish.js'), header('fish') + sliceBetween('const FISH_DEFS={', 'const COOK_BASE_SUCCESS=0.20;'));
fs.writeFileSync(path.join(dataDir, 'crafting.js'), header('crafting') + crafting.trim());
fs.writeFileSync(path.join(dataDir, 'water.js'), header('water') + water.trim());
fs.writeFileSync(path.join(dataDir, 'furniture.js'), header('furniture') + furniture.trim() + '\n\n' + shelfRecipes.trim());

console.log('Wrote data files to', dataDir);
