/* Hearthstead — pets data */
'use strict';

/** Husbandry level for each owned-pet slot: Lv 2, Lv 3, then +6 per slot after. */
const HUSBANDRY_PET_SLOT_LEVELS = (()=>{
  const levels=[2, 3];
  for(let lv=9; levels.length<10; lv+=6) levels.push(lv);
  return levels;
})();

const DOG_STORAGE_FETCH_CHANCE = 0.05;

const PET_SPECIES = {
  cat: {
    key: 'cat',
    name: 'Cat',
    icon: '🐱',
    adoptCostKey: 'cooked_goldfish',
    adoptCostAmount: 20,
    adoptCostLabel: 'cooked goldfish',
    passiveType: 'shard',
    description: 'A shard hunter. Equip to passively find elemental shards while you play.',
    namePool: ['Mittens', 'Shadow', 'Pip', 'Whisker', 'Luna', 'Ginger', 'Soot', 'Pearl', 'Marble', 'Bean'],
  },
  dog: {
    key: 'dog',
    name: 'Dog',
    icon: '🐕',
    adoptCostKey: 'logs',
    adoptCostAmount: 30,
    adoptCostLabel: 'logs',
    passiveType: 'storageRedirect',
    passiveChance: DOG_STORAGE_FETCH_CHANCE,
    description: 'A loyal fetcher. When following you, sometimes carries new finds straight to storage.',
    namePool: ['Buddy', 'Rex', 'Maple', 'Scout', 'Copper', 'Daisy', 'Bear', 'Pepper', 'Rusty', 'Nova'],
  },
  magpie: {
    key: 'magpie',
    name: 'Magpie',
    icon: '🐦',
    adoptCostKey: 'worms',
    adoptCostAmount: 500,
    adoptCostLabel: 'worms',
    description: 'A clever companion. Equip to follow you — no passive effect yet.',
    namePool: ['Pied', 'Magpie', 'Spark', 'Ink', 'Flash', 'Chatter', 'Slate', 'Patch'],
  },
};

const PET_PARTNER_INTRO =
  'Partnering a pet costs supplies up front. Equip them to bring their abilities on your adventures.';
