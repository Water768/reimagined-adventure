/* Hearthstead — plot layout (static data) */
'use strict';

const DEFAULT_PLOT_SLOTS = [
  { instanceId:'plot_tree_1', typeId:'woodland_clearing' },
  { instanceId:'plot_hut', typeId:'hut' },
  null, null,
  { instanceId:'plot_rock_1', typeId:'quarry_basic' },
  { instanceId:'plot_water_1', typeId:'water_basic' },
];
const PLOT_SLOT_COUNT = 6;
const PLOT_CORE = { minX:-1, maxX:1, minY:0, maxY:1 };
const PLOT_HUT_COORD = { x:0, y:0 };
const PLOT_CELL_PX = 106;
const PLOT_CELL_GAP = 4;
const PLOT_GRID_PAD = 4;
const WATER_BAND_PERIOD = 22;
const PLOT_INDEX_TO_COORD = [[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]];
const PLOT_STARTER_CELLS = [
  { x:-1, y:0, instanceId:'plot_tree_1', typeId:'woodland_clearing' },
  { x:0, y:0, instanceId:'plot_hut', typeId:'hut' },
  { x:0, y:1, instanceId:'plot_rock_1', typeId:'quarry_basic' },
  { x:1, y:1, instanceId:'plot_water_1', typeId:'water_basic' },
];