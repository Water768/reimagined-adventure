/* Hearthstead — screen & stat pill registry */
'use strict';

/**
 * @typedef {'base'|'hut-overlay'|'world-overlay'} ScreenKind
 * @typedef {object} ScreenDef
 * @property {ScreenKind} kind
 * @property {() => void} [closeFn] — dismiss overlay (tap outside / back)
 * @property {() => void} [onLeave] — `(nextScreenId) => void` when navigating away
 * @property {() => void} [onFlushScreen] — re-render when `markDirty('screen')`
 * @property {string} [goldId] — `#gold-*` element id
 * @property {string} [invCountId] — `#inv-count-*` element id
 * @property {string} [equipStatId] — `#equip-val-*` (interior / workbench)
 * @property {string} [skillPrefix] — activity skill pill prefix (`wb`, `fish`, …)
 * @property {() => string} [skillResolver] — skill key for overlay pill
 */

const SCREEN_REGISTRY = Object.create(null);
const SCREEN_REGISTER_ORDER = [];

function registerScreen(id, def) {
  if (!id || !def) return;
  if (SCREEN_REGISTRY[id]) {
    console.warn('[Hearthstead] screen re-registered:', id);
  }
  SCREEN_REGISTRY[id] = { id, ...def };
  if (!SCREEN_REGISTER_ORDER.includes(id)) SCREEN_REGISTER_ORDER.push(id);
}

function getScreenDef(id) {
  return id ? SCREEN_REGISTRY[id] || null : null;
}

function getRegisteredScreenIds() {
  return SCREEN_REGISTER_ORDER.slice();
}

function isRegisteredScreen(id) {
  return !!SCREEN_REGISTRY[id];
}

function isHutOverlayScreen(id) {
  return getScreenDef(id)?.kind === 'hut-overlay';
}

function isWorldOverlayScreen(id) {
  return getScreenDef(id)?.kind === 'world-overlay';
}

function isActiveOverlayScreen(id) {
  const k = getScreenDef(id)?.kind;
  return k === 'hut-overlay' || k === 'world-overlay';
}

function getOverlayScreenIds() {
  return SCREEN_REGISTER_ORDER.filter((id) => isActiveOverlayScreen(id));
}

function getScreenGoldElementIds() {
  const ids = [];
  SCREEN_REGISTER_ORDER.forEach((id) => {
    const g = SCREEN_REGISTRY[id].goldId;
    if (g) ids.push(g);
  });
  return ids;
}

function getScreenInvCountElementIds() {
  const ids = [];
  SCREEN_REGISTER_ORDER.forEach((id) => {
    const n = SCREEN_REGISTRY[id].invCountId;
    if (n) ids.push(n);
  });
  return ids;
}

function getScreenEquipStatIds() {
  const ids = [];
  SCREEN_REGISTER_ORDER.forEach((id) => {
    const e = SCREEN_REGISTRY[id].equipStatId;
    if (e) ids.push(e);
  });
  return ids;
}

function getScreenSkillPrefix(id) {
  return getScreenDef(id)?.skillPrefix || null;
}

function getScreenSkillResolver(id) {
  return getScreenDef(id)?.skillResolver || null;
}

function getScreensWithFlushHook() {
  return SCREEN_REGISTER_ORDER.filter((id) => typeof SCREEN_REGISTRY[id].onFlushScreen === 'function');
}

function runScreenCloseFn(id) {
  const fn = getScreenDef(id)?.closeFn;
  if (fn) {
    try {
      fn();
    } catch (err) {
      console.error('[Hearthstead] screen close failed (' + id + '):', err);
    }
    return true;
  }
  return false;
}

function runScreenOnLeave(prevId, nextId) {
  const fn = getScreenDef(prevId)?.onLeave;
  if (!fn) return;
  try {
    fn(nextId);
  } catch (err) {
    console.error('[Hearthstead] screen onLeave failed (' + prevId + '):', err);
  }
}

function flushCurrentScreenIfRegistered() {
  const fn = getScreenDef(currentScreen)?.onFlushScreen;
  if (!fn) return;
  try {
    fn();
  } catch (err) {
    console.error('[Hearthstead] screen flush failed (' + currentScreen + '):', err);
  }
}
