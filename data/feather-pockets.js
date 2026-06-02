/* Hearthstead — feather pocket items (equipable pocket storage) */
'use strict';

const FEATHER_POCKET_DEFS = [
  {
    key: 'feather_pouch_simple',
    icon: '🪶',
    name: 'Simple Feather Pouch',
    featherCap: 1000,
    requiredCraftingLevel: 5,
  },
  {
    key: 'feather_pouch_silk',
    icon: '🪶',
    name: 'Silk Feather Pouch',
    featherCap: 5000,
    requiredCraftingLevel: 12,
  },
  {
    key: 'feather_pouch_linen',
    icon: '🪶',
    name: 'Linen Feather Satchel',
    featherCap: 10000,
    requiredCraftingLevel: 20,
  },
];

const FEATHER_POCKET_BY_KEY = Object.fromEntries(FEATHER_POCKET_DEFS.map((d) => [d.key, d]));

function getFeatherPocketDef(key) {
  return FEATHER_POCKET_BY_KEY[key] || null;
}

function isFeatherPocketKey(key) {
  return !!FEATHER_POCKET_BY_KEY[key];
}

if (typeof registerItem === 'function') {
  FEATHER_POCKET_DEFS.forEach((d) => {
    registerItem({
      key: d.key,
      icon: d.icon,
      name: d.name,
      category: 'equipment',
      tags: ['feather_pocket'],
      stackable: false,
    });
  });
}
