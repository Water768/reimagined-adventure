/* Hearthstead — plot layout (static data) */
'use strict';

const PLOT_WORLD_SIZE = 12;
const PLOT_WORLD = { minX: 0, maxX: 11, minY: 0, maxY: 11 };
/** 3×2 homestead centered on the 12×12 map (hut at 5,5). */
const PLOT_CORE = { minX: 4, maxX: 6, minY: 5, maxY: 6 };
const PLOT_HUT_COORD = { x: 5, y: 5 };
const PLOT_CORE_CELL_COUNT = 6;

/** Legacy 3×2 (pre–10×10); used when migrating saves. */
const PLOT_LEGACY_CORE = { minX: -1, maxX: 1, minY: 0, maxY: 1 };
const PLOT_COORD_SHIFT = { x: 4, y: 4 };
/** Shift 10×10 saves into centered 12×12 grid. */
const PLOT_COORD_SHIFT_12 = { x: 1, y: 1 };

const PLOT_CELL_PX = 106;
const PLOT_CELL_GAP = 4;
const PLOT_GRID_PAD = 4;
const WATER_BAND_PERIOD = 22;

const PLOT_SLOT_COUNT = 6;
const DEFAULT_PLOT_SLOTS = [
  { instanceId: 'plot_tree_1', typeId: 'woodland_clearing' },
  { instanceId: 'plot_hut', typeId: 'hut' },
  null,
  null,
  { instanceId: 'plot_rock_1', typeId: 'quarry_basic' },
  { instanceId: 'plot_water_1', typeId: 'water_basic' },
];

const PLOT_INDEX_TO_COORD = [
  [4, 5], [5, 5], [6, 5],
  [4, 6], [5, 6], [6, 6],
];

const PLOT_STARTER_CELLS = [
  { x: 4, y: 5, instanceId: 'plot_tree_1', typeId: 'woodland_clearing' },
  { x: 5, y: 5, instanceId: 'plot_hut', typeId: 'hut' },
  { x: 5, y: 6, instanceId: 'plot_rock_1', typeId: 'quarry_basic' },
  { x: 6, y: 6, instanceId: 'plot_water_1', typeId: 'water_basic' },
];

/** One-off Exploration XP per first unlock = PLOT_UNLOCK_XP_PER_LEVEL × max level req on tile. */
const PLOT_UNLOCK_XP_PER_LEVEL = 1200;

/** Tiles granted at specific Exploration levels (burst levels override bands). */
const PLOT_UNLOCK_LEVEL_BURST = {
  10: 6,
  20: 11,
  30: 15,
  40: 17,
};

function plotUnlockTilesGrantedAtLevel(level) {
  const lvl = level | 0;
  if (Object.prototype.hasOwnProperty.call(PLOT_UNLOCK_LEVEL_BURST, lvl)) {
    return PLOT_UNLOCK_LEVEL_BURST[lvl];
  }
  if (lvl >= 2 && lvl <= 9) return 1;
  if (lvl >= 11 && lvl <= 19) return 2;
  if (lvl >= 21 && lvl <= 29) return 3;
  if (lvl >= 31 && lvl <= 39) return 4;
  if (lvl > 40) return 4;
  return 0;
}

function getPlotUnlockBudgetForExplorationLevel(level) {
  const lvl = Math.max(1, level | 0);
  let total = 0;
  for (let l = 2; l <= lvl; l++) total += plotUnlockTilesGrantedAtLevel(l);
  return total;
}

/**
 * Feature sites on locked tiles — unlocking discovers the type for the add menu
 * and may place a default structure on that cell.
 */
const PLOT_FEATURE_TILE_UNLOCKS = [
  {
    x: 3,
    y: 5,
    typeId: 'woodland_ashwood_grove',
    defaultTypeId: 'woodland_ashwood_grove',
    placeOnUnlock: true,
    icon: '🌲',
    name: 'Ashwood Grove',
    desc: 'Unlock this tile to claim the grove and place more Ashwood Groves on your land.',
  },
  {
    x: 2,
    y: 5,
    typeId: 'woodland_ashwood_grove',
    defaultTypeId: 'woodland_ashwood_grove',
    placeOnUnlock: true,
    icon: '🌲',
    name: 'Ashwood Grove',
    desc: 'Unlock this tile to claim the grove and place more Ashwood Groves on your land.',
  },
];

const PLOT_FEATURE_TILE_BY_KEY = Object.fromEntries(
  PLOT_FEATURE_TILE_UNLOCKS.map((f) => [f.x + ',' + f.y, f])
);

function getPlotFeatureTileAt(x, y) {
  return PLOT_FEATURE_TILE_BY_KEY[x + ',' + y] || null;
}

/** Tile type placed when unlocking a preset cell; null = stay empty. */
function getPlotTileDefaultTypeAt(x, y) {
  const preset = getPlotFeatureTileAt(x, y);
  if (!preset || preset.placeOnUnlock === false) return null;
  return preset.defaultTypeId || preset.typeId || null;
}

function getPlotTileTypeIdForCellProspect(x, y) {
  return getPlotTileDefaultTypeAt(x, y) || getPlotFeatureTileAt(x, y)?.typeId || null;
}

function isCoordInPlotWorld(x, y) {
  return x >= PLOT_WORLD.minX && x <= PLOT_WORLD.maxX
    && y >= PLOT_WORLD.minY && y <= PLOT_WORLD.maxY;
}

function isCoordInCore(x, y) {
  return x >= PLOT_CORE.minX && x <= PLOT_CORE.maxX
    && y >= PLOT_CORE.minY && y <= PLOT_CORE.maxY;
}

function forEachPlotWorldCoord(fn) {
  for (let y = PLOT_WORLD.minY; y <= PLOT_WORLD.maxY; y++) {
    for (let x = PLOT_WORLD.minX; x <= PLOT_WORLD.maxX; x++) fn(x, y);
  }
}
