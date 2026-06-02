/* Hearthstead — feather pocket equip & storage */
'use strict';

const FEATHER_POCKET_DISPLAY_KEY = 'featherPocket';

function migrateFeatherPocket() {
  if (state.featherPocketCount == null) state.featherPocketCount = 0;
  if (!state.equippedFeatherPocket) {
    state.featherPocketCount = 0;
    return;
  }
  const def = getFeatherPocketDef(state.equippedFeatherPocket.key);
  if (!def) {
    state.equippedFeatherPocket = null;
    state.featherPocketCount = 0;
    return;
  }
  state.equippedFeatherPocket.cap = def.featherCap;
  state.equippedFeatherPocket.icon = def.icon;
  state.equippedFeatherPocket.name = def.name;
  if (state.featherPocketCount > def.featherCap) state.featherPocketCount = def.featherCap;
}

function getEquippedFeatherPocketCap() {
  migrateFeatherPocket();
  return state.equippedFeatherPocket?.cap | 0;
}

function getFeatherPocketFreeSpace() {
  const cap = getEquippedFeatherPocketCap();
  if (cap < 1) return 0;
  return Math.max(0, cap - (state.featherPocketCount | 0));
}

function getFeatherPocketDisplayEntry() {
  migrateFeatherPocket();
  if (!state.equippedFeatherPocket) return null;
  const cap = getEquippedFeatherPocketCap();
  const n = state.featherPocketCount | 0;
  return {
    key: FEATHER_POCKET_DISPLAY_KEY,
    icon: '🪶',
    name: state.equippedFeatherPocket.name,
    count: n,
    cap,
    label: n + '/' + cap,
  };
}

function showFeatherPocketInfo() {
  migrateFeatherPocket();
  if (!state.equippedFeatherPocket) {
    showToast('No feather pocket equipped — weave one at the loom.');
    return;
  }
  const n = state.featherPocketCount | 0;
  const cap = getEquippedFeatherPocketCap();
  showToast(
    state.equippedFeatherPocket.icon + ' ' + state.equippedFeatherPocket.name
      + ' · ' + n + '/' + cap + ' feathers in pocket'
  );
}

function equipFeatherPocketFromInv(key) {
  const def = getFeatherPocketDef(key);
  if (!def) return false;
  if (state.equippedFeatherPocket?.key === key) return true;
  if (invCount(key) < 1) {
    showToast('Not in bag.');
    return false;
  }
  if (state.equippedFeatherPocket) {
    const prev = state.equippedFeatherPocket;
    invAddDirect(prev.key, prev.icon, prev.name, 1);
    state.featherPocketCount = 0;
  }
  stackTake(state.inventory, key, 1);
  state.equippedFeatherPocket = {
    key: def.key,
    icon: def.icon,
    name: def.name,
    cap: def.featherCap,
  };
  state.featherPocketCount = 0;
  scheduleSaveGame();
  return true;
}

function unequipFeatherPocket() {
  migrateFeatherPocket();
  if (!state.equippedFeatherPocket) return;
  const { key, icon, name } = state.equippedFeatherPocket;
  const feathers = state.featherPocketCount | 0;
  if (feathers > 0) {
    const invBefore = invTotal();
    const added = tryAddFeathersToInventory(feathers, invBefore);
    state.featherPocketCount = Math.max(0, feathers - added);
    if (state.featherPocketCount > 0) {
      showToast('Bag full — ' + state.featherPocketCount + ' feathers still in the pocket.');
      return;
    }
  }
  if (invTotal() >= getInvCap()) {
    showToast('Need 1 bag slot to unequip the feather pocket.');
    return;
  }
  invAddDirect(key, icon, name, 1);
  state.equippedFeatherPocket = null;
  state.featherPocketCount = 0;
  scheduleSaveGame();
}

function tryAddFeathersToInventory(amount, invBefore) {
  if (amount < 1) return 0;
  const def = typeof getItemDef === 'function' ? getItemDef('feathers') : { icon: '🪶', name: 'Feathers' };
  const before = invBefore != null ? invBefore : invTotal();
  const space = getInvCap() - invTotal();
  const take = Math.min(amount, Math.max(0, space));
  if (take < 1) return 0;
  invAddDirect('feathers', def.icon, def.name, take, { pickupBaseline: before });
  return take;
}

function tryAddFeathersToPocket(amount) {
  const free = getFeatherPocketFreeSpace();
  if (free < 1 || amount < 1) return 0;
  const add = Math.min(amount, free);
  state.featherPocketCount = (state.featherPocketCount | 0) + add;
  return add;
}

function depositFeatherPocketToStorage() {
  if (!hasAnyStoreRoom()) return 0;
  migrateFeatherPocket();
  const feathers = state.featherPocketCount | 0;
  if (feathers < 1) return 0;
  const resolved = typeof resolveItemKey === 'function' ? resolveItemKey('feathers') : 'feathers';
  const already = stackCount(state.storage, resolved);
  const cap = typeof storageCapForKey === 'function' ? storageCapForKey(resolved) : storageCapPerType();
  const room = Math.max(0, cap - already);
  const move = Math.min(room, feathers);
  if (move < 1) return 0;
  stackAdd(state.storage, resolved, move);
  state.featherPocketCount -= move;
  return move;
}
