/* Hearthstead — crafting desk (static data) */
'use strict';

const CRAFTING_DESK_FURNITURE_KEY = 'crafting_desk';

const CRAFTING_DESK_MATERIALS = {
  waterproof_paste: {
    key: 'waterproof_paste',
    icon: '🫙',
    name: 'Waterproof Paste',
    category: 'material',
  },
};

const CRAFTING_DESK_RECIPES = {
  waterproof_paste: {
    id: 'waterproof_paste',
    label: 'Waterproof Paste',
    icon: '🫙',
    outputKey: 'waterproof_paste',
    outputQty: 1,
    inputs: [{ key: 'glass_bottle', qty: 1 }, { key: 'barnacles', qty: 4 }],
    xp: 12,
    affinitySkill: 'fire',
    affinityXp: 6,
  },
  slick_grip_waders: {
    id: 'slick_grip_waders',
    label: 'Slick-Grip Waders',
    icon: '🥾',
    outputKey: 'slick_grip_waders',
    outputQty: 1,
    inputs: [
      { key: 'leather', qty: 8 },
      { key: 'simple_thread', qty: 40 },
      { key: 'glittering_fishscale', qty: 5 },
      { key: 'waterproof_paste', qty: 30 },
    ],
    xp: 560,
  },
};

const CRAFTING_DESK_RECIPE_KEYS = Object.keys(CRAFTING_DESK_RECIPES);

function getCraftingDeskRecipe(key) {
  return CRAFTING_DESK_RECIPES[key] || null;
}

function craftingDeskRecipeInputsSummary(recipe) {
  return (recipe?.inputs || [])
    .map((inp) => {
      const def = typeof getItemDef === 'function' ? getItemDef(inp.key) : null;
      const icon = def?.icon || '?';
      const name = def?.name || inp.key;
      const qty = inp.qty > 1 ? ' ×' + inp.qty : '';
      return icon + ' ' + name + qty;
    })
    .join(' + ');
}
