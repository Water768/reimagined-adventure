/* Hearthstead — barn animals (static data) */
'use strict';

const BARN_SMALL_ANIMAL_SLOTS = 1;
const BARN_MEDIUM_ANIMAL_SLOTS = 2;
const BARN_LARGE_ANIMAL_SLOTS = 4;
const BARN_STORAGE_CAP = 50;
const BARN_LARGE_STORAGE_CAP = 400;

/** Produce keys that occupy barn storage (not pocket shards). */
const BARN_STORAGE_PRODUCE_KEYS = ['eggs', 'feathers', 'wool', 'milk', 'uncured_cow_hide', 'basic_herbs'];

const BARN_ANIMAL_FOODS = {
  wheat: { key: 'wheat', icon: '🌾', name: 'Wheat' },
  hay: { key: 'hay', icon: '🌾', name: 'Hay', unobtainable: true },
  mushrooms: { key: 'mushrooms', icon: '🍄', name: 'Mushrooms' },
};

const BARN_ANIMAL_PRODUCE = {
  egg: { key: 'egg', icon: '🥚', name: 'Egg' },
  feathers: { key: 'feathers', icon: '🪶', name: 'Feathers' },
  wool: { key: 'wool', icon: '🧶', name: 'Wool' },
  milk: { key: 'milk', icon: '🥛', name: 'Milk' },
  uncured_cow_hide: { key: 'uncured_cow_hide', icon: '🐄', name: 'Uncured Cow Hide' },
  basic_herbs: { key: 'basic_herbs', icon: '🌿', name: 'Basic Herbs' },
  bottle_of_milk: { key: 'bottle_of_milk', icon: '🥛', name: 'Bottle of Milk', category: 'food' },
  bucket_of_milk: { key: 'bucket_of_milk', icon: '🪣', name: 'Bucket of Milk', category: 'food' },
};

const BARN_MILK_CONTAINER_KEYS = ['glass_bottle', 'bucket'];

const BARN_ANIMALS = {
  chicken: {
    key: 'chicken',
    name: 'Chicken',
    icon: '🐔',
    minBarnSize: 'small',
    unlockLevel: 5,
    adoptCostKey: 'worms',
    adoptCostAmount: 40,
    adoptCostLabel: 'worms',
    feedMs: 30000,
    foods: [{ key: 'wheat', amount: 1, label: 'wheat' }],
  },
  duck: {
    key: 'duck',
    name: 'Duck',
    icon: '🦆',
    minBarnSize: 'small',
    unlockLevel: 8,
    adoptCostKey: 'worms',
    adoptCostAmount: 40,
    adoptCostLabel: 'worms',
    feedMs: 40000,
    foods: [{ key: 'wheat', amount: 1, label: 'wheat' }],
  },
  badger: {
    key: 'badger',
    name: 'Badger',
    icon: '🦡',
    minBarnSize: 'small',
    unlockLevel: 12,
    adoptCostKey: 'mushrooms',
    adoptCostAmount: 125,
    adoptCostLabel: 'mushrooms',
    feedMs: 30000,
    foods: [{ key: 'mushrooms', amount: 1, label: 'mushrooms' }],
  },
  sheep: {
    key: 'sheep',
    name: 'Sheep',
    icon: '🐑',
    minBarnSize: 'medium',
    unlockLevel: 15,
    adoptCostKey: 'hay',
    adoptCostAmount: 75,
    adoptCostLabel: 'hay',
    feedMs: 50000,
    foods: [{ key: 'hay', amount: 1, label: 'hay' }],
  },
  cow: {
    key: 'cow',
    name: 'Cow',
    icon: '🐄',
    minBarnSize: 'medium',
    unlockLevel: 20,
    adoptCostKey: 'hay',
    adoptCostAmount: 150,
    adoptCostLabel: 'hay',
    feedMs: 60000,
    foods: [{ key: 'hay', amount: 2, label: 'hay' }],
  },
  alpaca: {
    key: 'alpaca',
    name: 'Alpaca',
    icon: '🦙',
    minBarnSize: 'medium',
    unlockLevel: 22,
    adoptCostKey: 'hay',
    adoptCostAmount: 230,
    adoptCostLabel: 'hay',
    feedMs: 80000,
    foods: [{ key: 'hay', amount: 2, label: 'hay' }],
  },
};

const BARN_ANIMAL_ORDER = ['chicken', 'duck', 'badger', 'sheep', 'cow', 'alpaca'];

function getBarnAnimalFoods(def) {
  if (!def) return [];
  if (def._foodList) return def._foodList;
  def._foodList = (def.foods || []).map((f) => {
    if (typeof f === 'string') return { key: f, amount: 1, label: f };
    return {
      key: f.key,
      amount: Math.max(1, f.amount | 0),
      label: f.label || f.key,
    };
  });
  return def._foodList;
}

function getBarnAnimalPrimaryFood(def) {
  const foods = getBarnAnimalFoods(def);
  return foods[0] || { key: 'wheat', amount: 1, label: 'wheat' };
}

function getBarnAnimalDef(animalKey) {
  return BARN_ANIMALS[animalKey] || null;
}

function isBarnAnimalUnlocked(animalKey) {
  const def = getBarnAnimalDef(animalKey);
  if (!def) return false;
  return (Number(state.skills.husbandry?.level) || 1) >= def.unlockLevel;
}

const BARN_SIZE_TIER = { small: 1, medium: 2, large: 3 };

function getBarnSizeTier(cfg) {
  if (!cfg) return 0;
  if (typeof isLargeBarn === 'function' && isLargeBarn(cfg)) return BARN_SIZE_TIER.large;
  if (typeof isMediumBarn === 'function' && isMediumBarn(cfg)) return BARN_SIZE_TIER.medium;
  return BARN_SIZE_TIER.small;
}

function isBarnAnimalAllowedAtBarn(animalKey, cfg) {
  const def = getBarnAnimalDef(animalKey);
  if (!def) return false;
  const required = BARN_SIZE_TIER[def.minBarnSize] || BARN_SIZE_TIER.small;
  return getBarnSizeTier(cfg) >= required;
}

function husbandryXpPerBarnCollect(animalKey) {
  const def = getBarnAnimalDef(animalKey);
  if (!def) return 0;
  return Math.max(0, def.unlockLevel) * 2;
}

function rollBarnCowProduce(cfg) {
  const out = { milk: 1, uncured_cow_hide: 0 };
  if (!cfg) return out;
  if (cfg.cowHidePity == null) {
    cfg.cowHidePity = cfg.cowLeatherPity != null ? cfg.cowLeatherPity : 0;
    delete cfg.cowLeatherPity;
  }
  const hit = Math.random() < 0.1 || cfg.cowHidePity >= 9;
  if (hit) {
    out.uncured_cow_hide = 1;
    cfg.cowHidePity = 0;
  } else {
    cfg.cowHidePity = (cfg.cowHidePity | 0) + 1;
  }
  return out;
}

function rollBarnBadgerProduce() {
  const out = { basic_herbs: 1 };
  if (Math.random() < 0.2) out.earthShards = 1;
  return out;
}

function rollBarnAnimalProduce(animalKey, cfg) {
  if (animalKey === 'chicken') return { eggs: 1, feathers: 1 };
  if (animalKey === 'duck') return { eggs: Math.random() < 0.5 ? 1 : 0, feathers: 5 };
  if (animalKey === 'sheep') return { wool: 1 };
  if (animalKey === 'alpaca') return { wool: 2 };
  if (animalKey === 'cow') return rollBarnCowProduce(cfg);
  if (animalKey === 'badger') return rollBarnBadgerProduce();
  return {};
}

function barnAnimalProducesText(animalKey) {
  if (animalKey === 'chicken') return '1 egg + 1 feather';
  if (animalKey === 'duck') return '5 feathers + 50% egg';
  if (animalKey === 'badger') return 'basic herbs';
  if (animalKey === 'sheep') return 'wool';
  if (animalKey === 'alpaca') return '2× wool';
  if (animalKey === 'cow') return '1 milk + 10% uncured cow hide';
  return '';
}

function barnAggregateProducesText(cfg) {
  if (!cfg?.animalSlots) return '';
  let eggs = 0;
  let feathers = 0;
  let wool = 0;
  let milk = 0;
  let ducks = 0;
  let cows = 0;
  cfg.animalSlots.forEach((s) => {
    if (!s?.type) return;
    if (s.type === 'chicken') {
      eggs++;
      feathers++;
    } else if (s.type === 'duck') {
      feathers += 5;
      ducks++;
    } else if (s.type === 'sheep') wool++;
    else if (s.type === 'alpaca') wool += 2;
    else if (s.type === 'cow') {
      milk++;
      cows++;
    }
  });
  const parts = [];
  if (eggs) parts.push(eggs + ' egg');
  if (feathers) parts.push(feathers + ' feather');
  if (wool) parts.push(wool + '× wool');
  if (milk) parts.push(milk + '× milk');
  if (cows) parts.push(cows === 1 ? '10% uncured cow hide' : cows + '× 10% uncured cow hide');
  if (ducks) parts.push(ducks === 1 ? '50% egg' : ducks + '× 50% egg');
  if (cfg.animalSlots.some((s) => s?.type === 'badger')) parts.push('herbs');
  return parts.join(' + ');
}

function barnAnimalFeedSeconds(animalKey) {
  const def = getBarnAnimalDef(animalKey);
  return def ? Math.round(def.feedMs / 1000) : 0;
}

function barnProduceDef(produceKey) {
  return BARN_ANIMAL_PRODUCE[produceKey] || null;
}

function barnStoredLootCount(loot, produceKey) {
  if (!loot) return 0;
  return Math.max(0, loot[produceKey] | 0);
}

function barnStoredEarthShards(loot) {
  if (!loot) return 0;
  return Math.max(0, loot.earthShards | 0);
}

function countBarnMilkContainers() {
  if (typeof itemCountBagAndStore !== 'function') return 0;
  return BARN_MILK_CONTAINER_KEYS.reduce((n, k) => n + itemCountBagAndStore(k), 0);
}

function emptyBarnStoredLootShape() {
  const loot = { earthShards: 0 };
  BARN_STORAGE_PRODUCE_KEYS.forEach((k) => {
    loot[k] = 0;
  });
  return loot;
}
