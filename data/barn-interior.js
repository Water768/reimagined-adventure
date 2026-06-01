/* Hearthstead — large barn interior (static data) */
'use strict';

const BARN_INTERIOR_COLS = 3;
const BARN_INTERIOR_ROWS = 3;
const BARN_INTERIOR_PEN_COUNT = 4;
const BARN_INTERIOR_PLACE_SLOT_COUNT = 4;

/** Row-major 3×3: four pens, four ＋ slots, one exit (9 cells). */
const BARN_INTERIOR_DEFAULT_LAYOUT = [
  'pen', 'pen', 'pen',
  'pen', 'place', 'place',
  'place', 'doorway', 'place',
];

const BARN_INTERIOR_PLACEABLES = [
  {
    key: 'butter_churn',
    icon: '🧈',
    name: 'Butter Churn',
    craftAt: 'workbench',
    requiredCarpentryLevel: 15,
    desc: 'Craft at the workbench (Carpentry Lv 15 · 2 ashwood per attempt).',
  },
  {
    key: 'cat_bed',
    icon: '🛏️',
    name: 'Barn Cat Bed',
    craftAt: 'workbench',
    requiredCarpentryLevel: 15,
    desc: 'Craft at the workbench (Carpentry Lv 15 · 5 ashwood + cat cushion per attempt).',
  },
  {
    key: 'iron_trough',
    icon: '🪣',
    name: 'Iron Trough',
    craftAt: 'kiln',
    upgradeable: true,
    desc: 'Smelt at the kiln (upgradeable).',
  },
  {
    key: 'storage_chest',
    icon: '📦',
    name: 'Storage Chest',
    craftAt: 'workbench',
    requiredCarpentryLevel: 40,
    storageBonus: 100,
    desc: 'Craft at the workbench (Carpentry Lv 40 · 10 ebonwood per attempt). Adds +100 barn storage when placed.',
  },
];

const BARN_INTERIOR_PLACEABLE_BY_KEY = Object.fromEntries(
  BARN_INTERIOR_PLACEABLES.map((p) => [p.key, p])
);

function getBarnInteriorPlaceableDef(key) {
  return BARN_INTERIOR_PLACEABLE_BY_KEY[key] || null;
}
