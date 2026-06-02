/* Hearthstead — barn interior layouts (static data) */
'use strict';

const BARN_INTERIOR_COLS = 3;
const BARN_INTERIOR_ROWS = 4;

/** Large barn: 3×4 — 4 pens, 4 utilities, 2 habitats, 1 layout spacer, exit. */
const BARN_INTERIOR_LARGE_LAYOUT = [
  'pen', 'pen', 'pen',
  'pen', 'place', 'place',
  'habitat', 'place', 'place',
  'layout', 'doorway', 'habitat',
];

/** Medium barn: 3×2 — two pens, two utilities, one habitat, exit. */
const BARN_INTERIOR_MEDIUM_LAYOUT = [
  'pen', 'pen', 'place',
  'habitat', 'doorway', 'place',
];

/** Small barn: 2×2 — one pen, one utility, exit. */
const BARN_INTERIOR_SMALL_LAYOUT = [
  'pen', 'place',
  'doorway', 'empty',
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
    key: 'copper_trough',
    icon: '🪣',
    name: 'Copper Trough',
    troughTier: 'copper',
    desc: 'Holds 10 of each feed type per trough (place from bag when you have one).',
  },
  {
    key: 'bronze_trough',
    icon: '🪣',
    name: 'Bronze Trough',
    troughTier: 'bronze',
    desc: 'Holds 20 of each feed type per trough (place from bag when you have one).',
  },
  {
    key: 'iron_trough',
    icon: '🪣',
    name: 'Iron Trough',
    craftAt: 'kiln',
    troughTier: 'iron',
    upgradeable: true,
    desc: 'Holds 30 of each feed type per trough. Smelt at the kiln (upgradeable).',
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
  {
    key: 'hay_bale',
    icon: '🌾',
    name: 'Hay Bale',
    builtFromHay: true,
    desc: 'Build with 50 hay from bag or storage. Holds up to 200 hay; removing the bale returns all stored hay.',
  },
];

const BARN_HAY_BALE_BUILD_HAY = 50;
const BARN_HAY_BALE_MAX_HAY = 200;
const BARN_HAY_BALE_ADD_CHUNK = 10;

const BARN_INTERIOR_PLACEABLE_BY_KEY = Object.fromEntries(
  BARN_INTERIOR_PLACEABLES.map((p) => [p.key, p])
);

function getBarnInteriorPlaceableDef(key) {
  return BARN_INTERIOR_PLACEABLE_BY_KEY[key] || null;
}

function getBarnInteriorLayoutSpec(cfg) {
  if (typeof isLargeBarn === 'function' && isLargeBarn(cfg)) {
    return { cols: 3, rows: 4, layout: BARN_INTERIOR_LARGE_LAYOUT.slice() };
  }
  if (typeof isMediumBarn === 'function' && isMediumBarn(cfg)) {
    return { cols: 3, rows: 2, layout: BARN_INTERIOR_MEDIUM_LAYOUT.slice() };
  }
  return { cols: 2, rows: 2, layout: BARN_INTERIOR_SMALL_LAYOUT.slice() };
}

function getBarnLayoutSpacerCount(cfg) {
  if (typeof isLargeBarn === 'function' && isLargeBarn(cfg)) return 1;
  return 0;
}

function barnInteriorSlotCounts(cells) {
  const vals = Object.values(cells || {});
  return {
    pen: vals.filter((t) => t === 'pen').length,
    place: vals.filter((t) => t === 'place').length,
    habitat: vals.filter((t) => t === 'habitat').length,
    layout: vals.filter((t) => t === 'layout' || t === 'empty').length,
  };
}

function barnInteriorLayoutMatchesSpec(bi, cfg) {
  if (!bi?.cells || !cfg) return false;
  const spec = getBarnInteriorLayoutSpec(cfg);
  const counts = barnInteriorSlotCounts(bi.cells);
  return bi.cols === spec.cols
    && bi.rows === spec.rows
    && counts.pen === getBarnAnimalSlotCount(cfg)
    && counts.place === getBarnUtilitySlotCount(cfg)
    && counts.habitat === getBarnHabitatSlotCount(cfg)
    && counts.layout === getBarnLayoutSpacerCount(cfg);
}

/** @deprecated use getBarnAnimalSlotCount(cfg) */
const BARN_INTERIOR_PEN_COUNT = 4;
/** @deprecated use getBarnUtilitySlotCount(cfg) */
const BARN_INTERIOR_PLACE_SLOT_COUNT = 4;
