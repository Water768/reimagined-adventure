/* Hearthstead — washing line (static data) */
'use strict';

const WASHING_LINE_ARCH_UNLOCK = 3;
const WASHING_LINE_LOGS_REQUIRED = 20;
const WASHING_LINE_ROPE_REQUIRED = 10;
const WASHING_LINE_DISPLAY_NAME = 'Washing Line';
const WASHING_LINE_BUILDING_LABEL = 'washing line (building)';
const WASHING_LINE_FRAME_LABEL = 'washing line (unstrung)';
const WASHING_LINE_COMPLETE_LABEL = 'washing line';
const WASHING_LINE_IMPROVED_TYPE_ID = 'improved_washing_line';

const WASHING_LINE_DRY_SLOT_COUNT = 5;
const WASHING_LINE_IMPROVED_DRY_SLOT_COUNT = 10;
const WASHING_LINE_DRY_SLOTS_PER_ROW = 5;
const WASHING_LINE_DRY_GRID_SIZE = 8;
const WASHING_LINE_DRY_TILE_COUNT = WASHING_LINE_DRY_GRID_SIZE * WASHING_LINE_DRY_GRID_SIZE;
const WASHING_LINE_AIR_LEVELS_FOR_INSTANT = 30;

/** Passive Air XP per second while lines are drying (by active load count). */
const WASHING_LINE_PASSIVE_AIR_TIER1_MAX = 5;
const WASHING_LINE_PASSIVE_AIR_TIER2_MAX = 10;

function washingLinePassiveAirXpPerSecond(activeDryingCount) {
  const n = activeDryingCount | 0;
  if (n < 1) return 0;
  if (n <= WASHING_LINE_PASSIVE_AIR_TIER1_MAX) return 1;
  if (n <= WASHING_LINE_PASSIVE_AIR_TIER2_MAX) return 2;
  return 2;
}

const WASHING_LINE_UPGRADE_ARCH_UNLOCK = 13;
const WASHING_LINE_UPGRADE_TIER_LABEL = 25;
const WASHING_LINE_UPGRADE_ASHWOOD = 50;
const WASHING_LINE_UPGRADE_ROPE = 20;

const WASHING_LINE_UPGRADE_MATERIALS = [
  { key: 'ashwood', icon: '🪵', name: 'Ashwood', required: WASHING_LINE_UPGRADE_ASHWOOD },
  { key: 'rope', icon: '⛓️', name: 'Rope', required: WASHING_LINE_UPGRADE_ROPE },
];

const WASHING_LINE_DRY_RECIPES = [
  {
    id: 'twisted_hay',
    label: 'Twisted grass → Hay',
    inputs: [{ key: 'twisted_grass', qty: 2 }],
    outputs: [{ key: 'hay', qty: 1 }],
    airLevel: 1,
    baseMs: 60000,
    airXp: 1,
  },
  {
    id: 'wheat_hay',
    label: '5 Wheat → 5 Hay',
    inputs: [{ key: 'wheat', qty: 5 }],
    outputs: [{ key: 'hay', qty: 5 }],
    airLevel: 3,
    baseMs: 120000,
    airXp: 5,
  },
  {
    id: 'hide_leather',
    label: 'Uncured hide → Leather',
    inputs: [{ key: 'uncured_cow_hide', qty: 1 }],
    outputs: [{ key: 'leather', qty: 1 }],
    airLevel: 10,
    baseMs: 600000,
    airXp: 10,
  },
];

const WASHING_LINE_DRY_RECIPE_BY_ID = Object.fromEntries(
  WASHING_LINE_DRY_RECIPES.map((r) => [r.id, r])
);

function getWashingLineDryRecipe(recipeId) {
  return WASHING_LINE_DRY_RECIPE_BY_ID[recipeId] || null;
}

function getWashingLineAirLevel() {
  return Number(state.skills?.air?.level) || 1;
}

function washingLineDryDurationMs(recipe) {
  if (!recipe) return null;
  const airLvl = getWashingLineAirLevel();
  if (airLvl < recipe.airLevel) return null;
  const levelsAbove = Math.min(WASHING_LINE_AIR_LEVELS_FOR_INSTANT, Math.max(0, airLvl - recipe.airLevel));
  const mult = 1 - levelsAbove / WASHING_LINE_AIR_LEVELS_FOR_INSTANT;
  return Math.max(0, Math.floor(recipe.baseMs * mult));
}

function washingLineCanUseDryRecipe(recipe) {
  if (!recipe) return false;
  return getWashingLineAirLevel() >= recipe.airLevel;
}

function washingLineShardChanceForRecipe(recipe) {
  if (!recipe) return 0;
  return recipe.airLevel / 100;
}

function getWashingLineStage(cfg) {
  if (!cfg) return 'building';
  if (cfg.complete) return 'complete';
  if ((cfg.logs | 0) >= WASHING_LINE_LOGS_REQUIRED) return 'unthreaded';
  return 'building';
}

function isWashingLineComplete(cfg) {
  return getWashingLineStage(cfg) === 'complete';
}

function isWashingLineImprovedType(typeId) {
  return typeId === WASHING_LINE_IMPROVED_TYPE_ID;
}

function isWashingLineImproved(cfg, typeId) {
  if (!cfg) return isWashingLineImprovedType(typeId);
  return !!(cfg.improved || isWashingLineImprovedType(typeId));
}

function getWashingLineVisualState(cfg, typeId) {
  const stage = getWashingLineStage(cfg);
  if (stage === 'complete') {
    return {
      icon: '🧺',
      label: WASHING_LINE_COMPLETE_LABEL,
      stage: 'complete',
    };
  }
  if (stage === 'unthreaded') {
    const rope = cfg.rope | 0;
    return {
      icon: '🧵',
      label: WASHING_LINE_FRAME_LABEL + (rope > 0 ? ' · ' + rope + '/' + WASHING_LINE_ROPE_REQUIRED : ''),
      stage: 'unthreaded',
    };
  }
  const logs = cfg.logs | 0;
  return {
    icon: logs > 0 ? '🪵' : '▫️',
    label: logs > 0 ? logs + '/' + WASHING_LINE_LOGS_REQUIRED : WASHING_LINE_BUILDING_LABEL,
    stage: 'building',
  };
}

function getWashingLineArchXpForLog() {
  return structureArchXpForMaterial('logs');
}

function getWashingLineArchXpForRope() {
  return structureArchXpForMaterial('rope');
}

function washingLineDrySlotCountForCfg(cfg) {
  if (!cfg) return WASHING_LINE_DRY_SLOT_COUNT;
  return cfg.improved ? WASHING_LINE_IMPROVED_DRY_SLOT_COUNT : WASHING_LINE_DRY_SLOT_COUNT;
}

function getWashingLineUpgradeArchXp() {
  return WASHING_LINE_UPGRADE_MATERIALS.reduce(
    (sum, m) => sum + structureArchXpForMaterial(m.key) * (m.required | 0),
    0
  );
}
