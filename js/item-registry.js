/* Hearthstead — canonical item registry + lean stack maps */
'use strict';

const ITEM_REGISTRY = Object.create(null);
const ITEM_ALIASES = Object.create(null);

function registerItem(def) {
  if (!def?.key) return;
  const key = def.key;
  const existing = ITEM_REGISTRY[key];
  const entry = {
    key,
    name: def.name || existing?.name || key,
    icon: def.icon || existing?.icon || '📦',
    category: def.category || existing?.category || 'misc',
    stackable: def.stackable !== false,
    tags: def.tags || existing?.tags || [],
  };
  ITEM_REGISTRY[key] = entry;
}

function registerItemAlias(oldKey, newKey) {
  if (oldKey && newKey) ITEM_ALIASES[oldKey] = newKey;
}

function resolveItemKey(key) {
  if (!key) return key;
  let k = key;
  const seen = new Set();
  while (ITEM_ALIASES[k] && !seen.has(k)) {
    seen.add(k);
    k = ITEM_ALIASES[k];
  }
  return k;
}

function getItemDef(key) {
  const resolved = resolveItemKey(key);
  const def = ITEM_REGISTRY[resolved];
  if (def) return def;
  const label = String(resolved || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    key: resolved,
    name: label || 'Unknown',
    icon: '❓',
    category: 'unknown',
    stackable: true,
    tags: [],
    _unknown: true,
  };
}

/** Count for lean (number) or legacy ({ count }) stacks. */
function stackCount(map, key) {
  if (!map || key == null) return 0;
  const v = map[key];
  if (v == null) return 0;
  if (typeof v === 'number') return v > 0 ? v : 0;
  if (typeof v === 'object') return Math.max(0, Number(v.count) || 0);
  return 0;
}

function notifyStackChanged(map) {
  if (map === state.inventory || map === state.storage) {
    if (typeof markDirty === 'function') markDirty('inventory');
    if (typeof requestSaveGame === 'function') requestSaveGame();
  }
}

function stackSet(map, key, count, opts) {
  if (!map || key == null) return;
  const n = Math.max(0, Number(count) || 0);
  const before = stackCount(map, key);
  if (n <= 0) delete map[key];
  else map[key] = n;
  if (!opts?.silent && before !== n) notifyStackChanged(map);
}

function stackAdd(map, key, delta, opts) {
  if (!map || key == null || delta <= 0) return 0;
  const before = stackCount(map, key);
  const next = before + delta;
  stackSet(map, key, next, { silent: true });
  if (!opts?.silent) notifyStackChanged(map);
  return delta;
}

function stackTake(map, key, amount, opts) {
  const have = stackCount(map, key);
  const take = Math.min(have, Math.max(0, Number(amount) || 0));
  if (take > 0) stackSet(map, key, have - take, { silent: true });
  if (!opts?.silent && take > 0) notifyStackChanged(map);
  return take;
}

function invCount(key) {
  return stackCount(state.inventory, resolveItemKey(key));
}

function storageCount(key) {
  return stackCount(state.storage, resolveItemKey(key));
}

function registerLegacyItemMeta(key, icon, name) {
  if (!key || ITEM_REGISTRY[key]) return;
  if (icon || name) {
    registerItem({ key, icon: icon || '📦', name: name || key, category: 'legacy' });
  }
}

function normalizeStackMap(map) {
  if (!map || typeof map !== 'object') return;
  for (const key of Object.keys(map)) {
    const v = map[key];
    let count = 0;
    let icon;
    let name;
    if (typeof v === 'number') {
      count = v;
    } else if (v && typeof v === 'object') {
      count = Number(v.count) || 0;
      icon = v.icon;
      name = v.name;
    }
    if (count > 0 && !ITEM_REGISTRY[key] && (icon || name)) {
      registerLegacyItemMeta(key, icon, name);
    }
    if (count <= 0) delete map[key];
    else map[key] = count;
  }
}

function normalizeInventoryState() {
  normalizeStackMap(state.inventory);
  normalizeStackMap(state.storage);
}

function mergeLegacyStackKeyAliases(map) {
  if (!map || typeof map !== 'object') return;
  const nailKeys = ['iron nails', 'Iron Nails', 'iron nail', 'Iron nail', 'Iron nails', 'copper nails', 'Copper Nails', 'forged nails', 'Forged Nails', 'ironbark nails', 'Ironbark Nails'];
  let nailTotal = stackCount(map, 'iron');
  nailKeys.forEach((k) => {
    nailTotal += stackCount(map, k);
    if (stackCount(map, k) > 0) stackSet(map, k, 0, { silent: true });
  });
  if (nailTotal > 0) stackSet(map, 'iron', nailTotal, { silent: true });

  const oreKeys = ['Iron Ore', 'iron ore'];
  let oreTotal = stackCount(map, 'iron_ore');
  oreKeys.forEach((k) => {
    oreTotal += stackCount(map, k);
    if (stackCount(map, k) > 0) stackSet(map, k, 0, { silent: true });
  });
  if (oreTotal > 0) stackSet(map, 'iron_ore', oreTotal, { silent: true });

  const ironBare = stackCount(map, 'Iron');
  if (ironBare > 0) {
    const raw = map['Iron'];
    const name = raw && typeof raw === 'object' ? String(raw.name || '') : '';
    const icon = raw && typeof raw === 'object' ? String(raw.icon || '') : '';
    const toNails = /nail/i.test(name) || (icon === '🔩' && !/ore/i.test(name));
    const target = toNails ? 'iron' : 'iron_ore';
    stackAdd(map, target, ironBare, { silent: true });
    stackSet(map, 'Iron', 0, { silent: true });
  }
}

function migrateNailTierKeys() {
  if (typeof NAIL_KEY_MIGRATION === 'undefined') return;
  if (state._nailTierMigrated) return;
  state._nailTierMigrated = true;
  [state.inventory, state.storage].forEach((map) => {
    if (!map) return;
    Object.entries(NAIL_KEY_MIGRATION).forEach(([oldKey, newKey]) => {
      if (oldKey === newKey) return;
      const count = stackCount(map, oldKey);
      if (count > 0) {
        stackAdd(map, newKey, count, { silent: true });
        stackSet(map, oldKey, 0, { silent: true });
      }
    });
  });
}

function migrateLeanInventory() {
  normalizeInventoryState();
  mergeLegacyStackKeyAliases(state.inventory);
  mergeLegacyStackKeyAliases(state.storage);
  migrateNailTierKeys();
}

function collectRegistryIssues() {
  const issues = [];
  const need = (key, label) => {
    if (key && !ITEM_REGISTRY[key]) issues.push(label + ':' + key);
  };
  if (typeof COOKING_RECIPES !== 'undefined') {
    Object.values(COOKING_RECIPES).forEach((r) => {
      need(r.rawKey, 'cook-raw');
      need(r.cookedKey, 'cook-out');
    });
  }
  if (typeof SPINNING_RECIPES !== 'undefined') {
    Object.values(SPINNING_RECIPES).forEach((r) => {
      need(r.rawKey, 'spin-raw');
      need(r.outputKey, 'spin-out');
    });
  }
  if (typeof LOOM_RECIPES !== 'undefined') {
    Object.values(LOOM_RECIPES).forEach((r) => need(r.outputKey, 'loom-out'));
  }
  if (typeof BOTANY_APOTHECARY_RECIPES !== 'undefined') {
    Object.values(BOTANY_APOTHECARY_RECIPES).forEach((r) => need(r.outputKey, 'botany-out'));
  }
  if (typeof KILN_ACTIONS !== 'undefined') {
    Object.values(KILN_ACTIONS).forEach((a) => {
      (a.inputs || []).forEach((i) => need(i.key, 'kiln-in'));
      (a.outputs || []).forEach((o) => need(o.key, 'kiln-out'));
    });
  }
  return issues;
}

function validateItemRegistry() {
  const issues = collectRegistryIssues();
  if (issues.length) {
    console.warn(
      '[Hearthstead] Item registry missing ' + issues.length + ' key(s): ' + issues.slice(0, 12).join(', ') +
        (issues.length > 12 ? '…' : '')
    );
  }
  return issues;
}

function buildItemRegistry() {
  const reg = (def) => registerItem(def);

  if (typeof LOG_DEFS !== 'undefined') {
    Object.values(LOG_DEFS).forEach((d) => reg({ key: d.key, icon: d.icon, name: d.name, category: 'wood' }));
  }
  if (typeof MINE_RESOURCE_DEFS !== 'undefined') {
    Object.values(MINE_RESOURCE_DEFS).forEach((d) =>
      reg({ key: d.key, icon: d.icon, name: d.name, category: d.category || 'mining' })
    );
  }
  if (typeof FISH_DEFS !== 'undefined') {
    Object.values(FISH_DEFS).forEach((d) =>
      reg({ key: d.key, icon: d.icon, name: 'Raw ' + d.name, category: 'fish' })
    );
  }
  if (typeof COOKING_RECIPES !== 'undefined') {
    Object.values(COOKING_RECIPES).forEach((r) => {
      reg({ key: r.rawKey, icon: r.rawIcon, name: r.rawName, category: 'fish' });
      reg({ key: r.cookedKey, icon: r.cookedIcon, name: r.cookedName, category: 'food' });
    });
  }
  if (typeof FIBER_DEFS !== 'undefined') {
    Object.values(FIBER_DEFS).forEach((d) => reg({ ...d, category: 'fiber' }));
  }
  if (typeof THREAD_DEFS !== 'undefined') {
    Object.values(THREAD_DEFS).forEach((d) => reg({ ...d, category: 'thread' }));
  }
  if (typeof SPINNING_RECIPES !== 'undefined') {
    Object.values(SPINNING_RECIPES).forEach((r) => {
      reg({ key: r.rawKey, icon: r.rawIcon, name: r.rawName, category: 'fiber' });
      reg({ key: r.outputKey, icon: r.outputIcon, name: r.outputName, category: r.kind === 'rope' ? 'tool' : 'thread' });
    });
  }
  if (typeof AXE_DEFS !== 'undefined') {
    AXE_DEFS.forEach((d) => reg({ ...d, category: 'tool', stackable: false }));
  }
  if (typeof BAG_DEFS !== 'undefined') {
    BAG_DEFS.forEach((d) => reg({ ...d, category: 'bag', stackable: false }));
  }
  if (typeof FURNITURE_DEFS !== 'undefined') {
    Object.values(FURNITURE_DEFS).forEach((d) => reg({ ...d, category: 'furniture' }));
  }
  if (typeof FURNITURE_CRAFTS !== 'undefined') {
    Object.values(FURNITURE_CRAFTS).forEach((f) => {
      const key = f.furnitureKey || f.id;
      if (key) reg({ key, icon: f.icon, name: f.name, category: 'furniture' });
    });
  }
  if (typeof CRAFT_EXTRA_MATERIALS !== 'undefined') {
    Object.values(CRAFT_EXTRA_MATERIALS).forEach((d) => {
      if (d?.key) reg({ key: d.key, icon: d.icon, name: d.name, category: 'textile' });
    });
  }
  if (typeof BARN_INTERIOR_PLACEABLES !== 'undefined') {
    BARN_INTERIOR_PLACEABLES.forEach((p) => {
      if (p?.key) reg({ key: p.key, icon: p.icon, name: p.name, category: 'furniture' });
    });
  }
  if (typeof SHELF_RECIPES !== 'undefined') {
    Object.entries(SHELF_RECIPES).forEach(([id, r]) => reg({ key: id, icon: r.icon, name: r.name, category: 'furniture' }));
  }
  if (typeof BOTANY_ITEMS !== 'undefined') {
    Object.values(BOTANY_ITEMS).forEach((d) => reg({ ...d, category: 'herb' }));
  }
  if (typeof BOTANY_CROP_DEFS !== 'undefined') {
    Object.values(BOTANY_CROP_DEFS).forEach((d) => reg({ ...d, category: 'crop' }));
  }
  if (typeof BOTANY_SEED_DEFS !== 'undefined') {
    Object.values(BOTANY_SEED_DEFS).forEach((d) => reg({ ...d, category: 'seed' }));
  }
  if (typeof BOTANY_APOTHECARY_RECIPES !== 'undefined') {
    Object.values(BOTANY_APOTHECARY_RECIPES).forEach((r) => {
      reg({ key: r.outputKey, icon: r.icon, name: r.label, category: 'herb' });
      (r.inputs || []).forEach((i) => {
        const d = typeof getBotanyItemDef === 'function' ? getBotanyItemDef(i.key) : null;
        if (d) reg({ ...d, category: 'herb' });
      });
    });
  }
  if (typeof FABRIC_ITEMS !== 'undefined') {
    Object.values(FABRIC_ITEMS).forEach((d) => reg({ ...d, category: 'textile' }));
  }
  if (typeof LOOM_RECIPES !== 'undefined') {
    Object.values(LOOM_RECIPES).forEach((r) => {
      reg({ key: r.outputKey, icon: r.icon, name: r.label, category: 'textile' });
      (r.inputs || []).forEach((inp) => {
        const oneOf = inp.oneOf || [inp];
        oneOf.forEach((i) => {
          if (ITEM_REGISTRY[i.key]) return;
          const fiber = typeof FIBER_DEFS !== 'undefined' ? FIBER_DEFS[i.key] : null;
          const thread = typeof THREAD_DEFS !== 'undefined' ? THREAD_DEFS[i.key] : null;
          if (fiber) reg({ ...fiber, category: 'fiber' });
          else if (thread) reg({ ...thread, category: 'thread' });
        });
      });
    });
  }
  if (typeof WELL_ITEM_DEFS !== 'undefined') {
    Object.values(WELL_ITEM_DEFS).forEach((d) => reg({ ...d, category: d.category || 'tool' }));
  }
  if (typeof WATER_VESSELS !== 'undefined') {
    WATER_VESSELS.forEach((v) => {
      reg({ key: v.emptyKey, icon: v.emptyIcon, name: v.emptyName, category: 'tool' });
      reg({ key: v.filledKey, icon: v.filledIcon, name: v.filledName, category: 'consumable' });
    });
  }
  if (typeof SIMPLE_TORCH_DEF !== 'undefined') reg({ ...SIMPLE_TORCH_DEF, category: 'tool' });
  if (typeof USELESS_LUMP !== 'undefined') reg({ ...USELESS_LUMP, category: 'junk' });
  if (typeof BARN_ANIMAL_PRODUCE !== 'undefined') {
    Object.values(BARN_ANIMAL_PRODUCE).forEach((d) => reg({ ...d, category: 'produce' }));
  }
  if (typeof BARN_ANIMAL_FOODS !== 'undefined') {
    Object.values(BARN_ANIMAL_FOODS).forEach((d) => reg({ ...d, category: 'feed' }));
  }
  if (typeof GATHERING_LOCATIONS !== 'undefined') {
    GATHERING_LOCATIONS.forEach((loc) => {
      (loc.drops || []).forEach((d) => reg({ key: d.key, icon: d.icon, name: d.name, category: 'gather' }));
    });
  }
  if (typeof EXPLORATION_LOOT_POOL !== 'undefined') {
    EXPLORATION_LOOT_POOL.forEach((d) => reg({ ...d, category: 'loot' }));
  }
  if (typeof EXPLORATION_SUPER_RARE_POOL !== 'undefined') {
    EXPLORATION_SUPER_RARE_POOL.forEach((d) => reg({ ...d, category: 'loot', tags: ['rare'] }));
  }
  if (typeof KILN_ACTIONS !== 'undefined') {
    Object.values(KILN_ACTIONS).forEach((a) => {
      (a.outputs || []).forEach((o) => reg({ key: o.key, icon: o.icon, name: o.name, category: 'crafted' }));
    });
  }
  if (typeof NAIL_TYPES !== 'undefined') {
    Object.entries(NAIL_TYPES).forEach(([key, d]) => reg({ key, icon: d.icon, name: d.name, category: 'material' }));
  }
  if (typeof EQUIPPABLE !== 'undefined') {
    Object.entries(EQUIPPABLE).forEach(([key, d]) => reg({ key, icon: d.icon, name: d.name, category: 'tool', stackable: false }));
  }
  if (typeof AXE_DEFS !== 'undefined') {
    AXE_DEFS.forEach((a) => reg({ key: a.key, icon: a.icon, name: a.name, category: 'tool', stackable: false }));
  }
  if (typeof PICKAXE_DEFS !== 'undefined') {
    PICKAXE_DEFS.forEach((p) => reg({ key: p.key, icon: p.icon, name: p.name, category: 'tool', stackable: false }));
  }
  if (typeof NET_CRAFT_MATERIALS !== 'undefined') {
    Object.values(NET_CRAFT_MATERIALS).forEach((d) => reg({ ...d, category: 'material' }));
  }
  if (typeof FISHING_ROD_DEFS !== 'undefined') {
    FISHING_ROD_DEFS.forEach((r) => reg({ key: r.key, icon: r.icon, name: r.name, category: 'tool', stackable: false }));
  }
  if (typeof FISHING_NET_DEFS !== 'undefined') {
    FISHING_NET_DEFS.forEach((n) => reg({ key: n.key, icon: n.icon, name: n.name, category: 'tool', stackable: false }));
  }
  if (typeof TOOL_STORE_SLOT_DEFS !== 'undefined') {
    TOOL_STORE_SLOT_DEFS.forEach((slot) => {
      (slot.keys || []).forEach((key) => reg({ key, icon: slot.icon, name: slot.label, category: 'tool', stackable: false }));
    });
  }

  registerItemAlias('mackerel', 'raw_mackerel');
  registerItemAlias('rock', 'stone');
  registerItemAlias('flint', 'brick');
  registerItemAlias('desk', 'apothecary_table');
  registerItemAlias('iron nails', 'iron');
  registerItemAlias('Iron Nails', 'iron');
  registerItemAlias('iron nail', 'iron');
  registerItemAlias('Iron nail', 'iron');
  registerItemAlias('Iron nails', 'iron');
  registerItemAlias('copper nails', 'copper');
  registerItemAlias('Copper Nails', 'copper');
  registerItemAlias('bronze nails', 'bronze');
  registerItemAlias('Bronze Nails', 'bronze');
  registerItemAlias('forged nails', 'forged');
  registerItemAlias('Forged Nails', 'forged');
  registerItemAlias('ironbark nails', 'ironbark');
  registerItemAlias('Ironbark Nails', 'ironbark');
  registerItemAlias('Iron Ore', 'iron_ore');
  registerItemAlias('iron ore', 'iron_ore');

  validateItemRegistry();
}

buildItemRegistry();
