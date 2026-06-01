/* Hearthstead — washing line */
'use strict';

let activeWashingLineInstanceId = null;
let washingLineDryTimerHandle = null;
let washingLinePassiveAirLastMs = 0;
let washingLineDefaultRecipeId = 'twisted_hay';
let washingLineRecipePickerOpen = false;

function washingLineEnsureDrySlotArrays(cfg) {
  const n = washingLineDrySlotCountForCfg(cfg);
  if (!Array.isArray(cfg.slotRecipeIds) || cfg.slotRecipeIds.length !== n) {
    const old = Array.isArray(cfg.slotRecipeIds) ? cfg.slotRecipeIds : [];
    cfg.slotRecipeIds = Array.from({ length: n }, (_, i) => (i < old.length ? old[i] : null));
  }
  if (!Array.isArray(cfg.drySlots) || cfg.drySlots.length !== n) {
    const old = Array.isArray(cfg.drySlots) ? cfg.drySlots : [];
    cfg.drySlots = Array.from({ length: n }, (_, i) => (i < old.length ? old[i] : null));
  }
}

function normalizeWashingLineConfig(cfg) {
  if (!cfg) {
    return {
      logs: 0,
      rope: 0,
      framed: false,
      complete: false,
      freePlaced: false,
      defaultRecipeId: washingLineDefaultRecipeId,
      slotRecipeIds: [null, null, null, null, null],
      drySlots: [null, null, null, null, null],
      improved: false,
    };
  }
  if (cfg.logs == null) cfg.logs = 0;
  if (cfg.improved == null) cfg.improved = false;
  if (cfg.rope == null) cfg.rope = 0;
  if (cfg.framed == null) cfg.framed = false;
  if (cfg.complete == null) cfg.complete = false;
  if (cfg.freePlaced == null) cfg.freePlaced = false;
  if (!cfg.defaultRecipeId) cfg.defaultRecipeId = washingLineDefaultRecipeId;
  washingLineEnsureDrySlotArrays(cfg);
  if (isWashingLineComplete(cfg)) {
    cfg.logs = WASHING_LINE_LOGS_REQUIRED;
    cfg.rope = WASHING_LINE_ROPE_REQUIRED;
    cfg.framed = true;
    cfg.complete = true;
  } else if ((cfg.logs | 0) >= WASHING_LINE_LOGS_REQUIRED) {
    cfg.logs = WASHING_LINE_LOGS_REQUIRED;
    cfg.framed = true;
  }
  return cfg;
}

function getWashingLineConfig(instanceId) {
  if (!instanceId) return null;
  return normalizeWashingLineConfig(getPlotConfig(instanceId, 'washing_line', 'washing_line'));
}

function setActiveWashingLine(instanceId) {
  activeWashingLineInstanceId = instanceId || null;
}

function resolveWashingLineCell(el) {
  if (el?.classList?.contains('cell-washing-line')) return el;
  return el?.closest?.('.plot-cell.cell-washing-line') || null;
}

function resolveWashingLineInstanceId(eventOrCell) {
  const cell = eventOrCell?.classList ? eventOrCell : resolveWashingLineCell(eventOrCell?.target);
  return cell?.dataset?.instanceId || activeWashingLineInstanceId || null;
}

function forEachWashingLineSlot(fn) {
  if (typeof forEachPlotStructureSlot === 'function') forEachPlotStructureSlot('washing_line', fn);
}

function countWashingLinesOnPlot() {
  let n = 0;
  forEachWashingLineSlot(() => { n++; });
  return n;
}

function canUseWashingLineStructure() {
  return (Number(state.skills.architecture?.level) || 1) >= WASHING_LINE_ARCH_UNLOCK;
}

function isWashingLineUnlocked() {
  migrateWashingLine();
  return !!state.washingLineUnlocked;
}

function canPlaceWashingLine() {
  migrateWashingLine();
  if (!canUseWashingLineStructure()) return false;
  if (state.washingLineUnlocked) return true;
  return countWashingLinesOnPlot() === 0;
}

function washingLineSlotExists(instanceId) {
  let found = false;
  forEachWashingLineSlot((x, y, slot) => {
    if (slot.instanceId === instanceId) found = true;
  });
  return found;
}

function totalWashingLineLogsEarned() {
  let total = 0;
  forEachWashingLineSlot((x, y, slot) => {
    const cfg = getWashingLineConfig(slot.instanceId);
    if (cfg && !cfg.freePlaced) total += cfg.logs | 0;
  });
  return total;
}

function unlockWashingLines() {
  if (!state.washingLineUnlocked) {
    state.washingLineUnlocked = true;
    scheduleSaveGame();
  }
}

function unlockWashingLineFrame() {
  if (!state.washingLineFrameUnlocked) {
    state.washingLineFrameUnlocked = true;
    scheduleSaveGame();
  }
}

function applyWashingLineImprovedOnSlot(slot, cfg) {
  if (!slot || !cfg) return;
  cfg.improved = true;
  cfg.logs = WASHING_LINE_LOGS_REQUIRED;
  cfg.rope = WASHING_LINE_ROPE_REQUIRED;
  cfg.complete = true;
  washingLineEnsureDrySlotArrays(cfg);
  slot.typeId = WASHING_LINE_IMPROVED_TYPE_ID;
  state.washingLineImprovedUnlocked = true;
}

function migrateWashingLine() {
  if (state.washingLineFrameUnlocked == null) state.washingLineFrameUnlocked = false;
  if (state.washingLineUnlocked == null) state.washingLineUnlocked = false;
  if (state.washingLineImprovedUnlocked == null) state.washingLineImprovedUnlocked = false;
  forEachWashingLineSlot((x, y, slot) => {
    if (slot.typeId === 'washing_line_complete') slot.typeId = 'washing_line';
    normalizeWashingLineConfig(getPlotConfig(slot.instanceId, 'washing_line', slot.typeId));
    const cfg = getWashingLineConfig(slot.instanceId);
    if (cfg.improved || slot.typeId === WASHING_LINE_IMPROVED_TYPE_ID) {
      applyWashingLineImprovedOnSlot(slot, cfg);
    }
    if ((cfg.logs | 0) >= WASHING_LINE_LOGS_REQUIRED) state.washingLineFrameUnlocked = true;
    if (isWashingLineComplete(cfg)) state.washingLineUnlocked = true;
  });
  if (!state.washingLineUnlocked) {
    forEachWashingLineSlot((x, y, slot) => {
      if (isWashingLineComplete(getWashingLineConfig(slot.instanceId))) state.washingLineUnlocked = true;
    });
  }
  migrateWashingLineArchitectureXp();
  forEachWashingLineSlot((x, y, slot) => {
    collectReadyWashingLineDrySlots(slot.instanceId);
  });
  ensureWashingLineDryTimer();
}

function migrateWashingLineArchitectureXp() {
  if (state._washingLineArchXpMigrated) return;
  state._washingLineArchXpMigrated = true;
  const logs = totalWashingLineLogsEarned();
  if (logs > 0 && state.skills?.architecture) {
    const earned = logs * getWashingLineArchXpForLog();
    const current = getTotalSkillXp('architecture');
    if (current < earned) grantXP('architecture', earned - current, null);
  }
}

function completeWashingLineFrame(instanceId) {
  instanceId = instanceId || activeWashingLineInstanceId;
  const cfg = getWashingLineConfig(instanceId);
  if (!cfg || (cfg.logs | 0) < WASHING_LINE_LOGS_REQUIRED) return;
  const showBanner = typeof isStructureStageBonusPending === 'function'
    ? isStructureStageBonusPending('washing_line_frame')
    : !state.washingLineFrameUnlocked;
  cfg.logs = WASHING_LINE_LOGS_REQUIRED;
  cfg.framed = true;
  unlockWashingLineFrame();
  scheduleSaveGame();
  const refresh = () => {
    if (typeof updateWashingLineCells === 'function') updateWashingLineCells();
    if (currentScreen === 'washing-line-screen') renderWashingLineScreen();
    syncUI();
  };
  if (showBanner) {
    showStructureBuiltBanner({
      bonusKey: 'washing_line_frame',
      title: 'FRAME RAISED!',
      icon: '🪵',
      body: 'Posts and crossbeams stand — thread ten lengths of rope to finish the line.',
      btnText: 'GOT IT',
      cb: refresh,
    });
  } else {
    refresh();
  }
}

function completeWashingLine(instanceId) {
  instanceId = instanceId || activeWashingLineInstanceId;
  const cfg = getWashingLineConfig(instanceId);
  if (!cfg) return;
  const showBanner = typeof isStructureStageBonusPending === 'function'
    ? isStructureStageBonusPending('washing_line')
    : !state.washingLineUnlocked;
  cfg.logs = WASHING_LINE_LOGS_REQUIRED;
  cfg.rope = WASHING_LINE_ROPE_REQUIRED;
  cfg.framed = true;
  cfg.complete = true;
  unlockWashingLines();
  scheduleSaveGame();
  const refresh = () => {
    if (typeof updateWashingLineCells === 'function') updateWashingLineCells();
    if (currentScreen === 'washing-line-screen') renderWashingLineScreen();
    syncUI();
  };
  if (showBanner) {
    showStructureBuiltBanner({
      bonusKey: 'washing_line',
      title: 'WASHING LINE READY!',
      icon: '🧺',
      body: 'Hang laundry to dry — air skill cleans twisted grass, wheat, and hides.',
      btnText: 'GOT IT',
      cb: refresh,
    });
  } else {
    refresh();
  }
}

function placeWashingLineLog(instanceId) {
  instanceId = instanceId || activeWashingLineInstanceId;
  const cfg = getWashingLineConfig(instanceId);
  if (!cfg || cfg.complete || cfg.freePlaced) return false;
  if ((cfg.logs | 0) >= WASHING_LINE_LOGS_REQUIRED) return false;
  const needed = WASHING_LINE_LOGS_REQUIRED - (cfg.logs | 0);
  const available = itemCountBagAndStore('logs');
  const amount = Math.min(needed, available);
  if (amount < 1) {
    showToast('You need logs from the woodland.');
    return false;
  }
  const consumed = consumeUpToFromBagOrStore('logs', amount);
  if (consumed < 1) {
    showToast('You need logs from the woodland.');
    return false;
  }
  cfg.logs = (cfg.logs | 0) + consumed;
  grantXP('architecture', getWashingLineArchXpForLog() * consumed, null);
  if (typeof requestSaveGame === 'function') requestSaveGame({ immediate: true });
  else scheduleSaveGame();
  if ((cfg.logs | 0) >= WASHING_LINE_LOGS_REQUIRED) {
    completeWashingLineFrame(instanceId);
  } else {
    if (typeof updateWashingLineCells === 'function') updateWashingLineCells();
    if (currentScreen === 'washing-line-screen') renderWashingLineScreen();
    syncUI();
  }
  return true;
}

function placeWashingLineRope(instanceId) {
  instanceId = instanceId || activeWashingLineInstanceId;
  const cfg = getWashingLineConfig(instanceId);
  if (!cfg || cfg.complete || cfg.freePlaced) return false;
  if ((cfg.logs | 0) < WASHING_LINE_LOGS_REQUIRED) {
    showToast('Raise the frame with logs first.');
    return false;
  }
  if ((cfg.rope | 0) >= WASHING_LINE_ROPE_REQUIRED) {
    if (isWashingLineComplete(cfg)) completeWashingLine(instanceId);
    return false;
  }
  const needed = WASHING_LINE_ROPE_REQUIRED - (cfg.rope | 0);
  const available = itemCountBagAndStore('rope');
  const amount = Math.min(needed, available);
  if (amount < 1) {
    showToast('You need rope.');
    return false;
  }
  const consumed = consumeUpToFromBagOrStore('rope', amount);
  if (consumed < 1) {
    showToast('You need rope.');
    return false;
  }
  cfg.rope = (cfg.rope | 0) + consumed;
  const willComplete = (cfg.rope | 0) >= WASHING_LINE_ROPE_REQUIRED;
  grantXP('architecture', getWashingLineArchXpForRope() * consumed, null, willComplete ? { deferLevelUp: true } : null);
  if (typeof requestSaveGame === 'function') requestSaveGame({ immediate: true });
  else scheduleSaveGame();
  if (willComplete) completeWashingLine(instanceId);
  else {
    if (typeof updateWashingLineCells === 'function') updateWashingLineCells();
    if (currentScreen === 'washing-line-screen') renderWashingLineScreen();
    syncUI();
  }
  return true;
}

function washingLineRecipeForSlot(cfg, slotIndex) {
  const id = cfg.defaultRecipeId || washingLineDefaultRecipeId;
  return getWashingLineDryRecipe(id);
}

function washingLineCountFreeSlots(cfg) {
  if (!cfg?.drySlots) return 0;
  const total = washingLineDrySlotCountForCfg(cfg);
  let n = 0;
  for (let i = 0; i < total; i++) {
    if (!cfg.drySlots[i]) n++;
  }
  return n;
}

function washingLineCountBusySlots(cfg) {
  return washingLineDrySlotCountForCfg(cfg) - washingLineCountFreeSlots(cfg);
}

function washingLineCanAffordRecipeTimes(recipe, times) {
  if (!recipe || times < 1) return false;
  return recipe.inputs.every((inp) => itemCountBagAndStore(inp.key) >= inp.qty * times);
}

function washingLineDryDurationLabel(recipe) {
  const dur = washingLineDryDurationMs(recipe);
  if (dur == null) return '';
  if (dur <= 0) return 'instant';
  if (dur >= 60000) return Math.round(dur / 60000) + ' min';
  return Math.round(dur / 1000) + 's';
}

function wlDryDurationMs(slot) {
  const d = Number(slot?.durationMs);
  return Number.isFinite(d) && d >= 0 ? Math.floor(d) : 0;
}

function wlDryStartedAt(slot) {
  const t = Number(slot?.startedAt);
  return Number.isFinite(t) && t > 0 ? t : 0;
}

function wlDryEndsAt(slot) {
  const t = Number(slot?.endsAt);
  return Number.isFinite(t) && t > 0 ? t : 0;
}

function repairWashingLineDrySlot(dry) {
  if (!dry) return null;
  const recipe = getWashingLineDryRecipe(dry.recipeId);
  if (dry.durationMs == null && recipe) {
    const d = washingLineDryDurationMs(recipe);
    if (d != null) dry.durationMs = d;
  }
  const started = wlDryStartedAt(dry);
  const dur = wlDryDurationMs(dry);
  const ends = wlDryEndsAt(dry);
  if (started > 0 && (ends <= started || ends < started + dur)) {
    dry.endsAt = dur > 0 ? started + dur : started;
  }
  return dry;
}

function repairWashingLineDrySlotForLine(dry, slotIndex) {
  dry = repairWashingLineDrySlot(dry);
  if (dry && slotIndex != null) wlEnsureDustOrder(dry, slotIndex);
  return dry;
}

function washingLineDryProgress(slot) {
  slot = repairWashingLineDrySlot(slot);
  const started = wlDryStartedAt(slot);
  if (!started) return 0;
  const ends = wlDryEndsAt(slot);
  const dur = ends > started ? ends - started : wlDryDurationMs(slot);
  if (dur <= 0) return 1;
  const elapsed = Date.now() - started;
  if (elapsed >= dur) return 1;
  return Math.min(1, Math.max(0, elapsed / dur));
}

function washingLineDrySlotReady(slot) {
  slot = repairWashingLineDrySlot(slot);
  if (!slot) return false;
  const started = wlDryStartedAt(slot);
  const ends = wlDryEndsAt(slot);
  if (ends > started) return Date.now() >= ends;
  if (!started) return false;
  const dur = wlDryDurationMs(slot);
  if (dur <= 0) return true;
  return Date.now() - started >= dur;
}

function wlMulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wlDustOrderSeed(dry, slotIndex) {
  const started = wlDryStartedAt(dry) || Date.now();
  let recipeMix = 0;
  const id = dry.recipeId || '';
  for (let i = 0; i < id.length; i++) recipeMix = (recipeMix + id.charCodeAt(i) * (i + 3)) | 0;
  return (started ^ Math.imul(slotIndex + 1, 0x9e3779b1) ^ recipeMix) >>> 0 || 1;
}

function wlBuildDustOrder(seed) {
  const rng = wlMulberry32(seed);
  const order = [];
  for (let i = 0; i < WASHING_LINE_DRY_TILE_COUNT; i++) order.push(i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

function wlEnsureDustOrder(dry, slotIndex) {
  if (Array.isArray(dry.dustOrder) && dry.dustOrder.length === WASHING_LINE_DRY_TILE_COUNT) {
    return dry.dustOrder;
  }
  dry.dustOrder = wlBuildDustOrder(wlDustOrderSeed(dry, slotIndex));
  return dry.dustOrder;
}

function wlDustRankByTile(dry, slotIndex) {
  if (!dry._dustRankByTile || dry._dustRankSlot !== slotIndex) {
    const order = wlEnsureDustOrder(dry, slotIndex);
    const rank = new Uint8Array(WASHING_LINE_DRY_TILE_COUNT);
    for (let r = 0; r < order.length; r++) rank[order[r]] = r;
    dry._dustRankByTile = rank;
    dry._dustRankSlot = slotIndex;
  }
  return dry._dustRankByTile;
}

function wlTileCosmicPhase(dry, tileIndex) {
  const started = wlDryStartedAt(dry) || 1;
  return (((started ^ Math.imul(tileIndex + 1, 0x85ebca6b)) >>> 0) % 997) / 997;
}

function wlCosmicTileStyle(dry, tileIndex, dissolve) {
  const phase = dry ? wlTileCosmicPhase(dry, tileIndex) : (tileIndex % 17) / 17;
  const spark = dry ? ((((wlDryStartedAt(dry) >>> 0) ^ tileIndex * 40503) % 23) === 0 ? 1 : 0) : 0;
  return '--wl-dissolve:' + dissolve.toFixed(4)
    + ';--wl-phase:' + phase.toFixed(4)
    + ';--wl-spark:' + spark;
}

function washingLineDryTileVisual(dry, progress, tileIndex, slotIndex) {
  const phase = dry ? wlTileCosmicPhase(dry, tileIndex) : (tileIndex % 17) / 17;
  if (!dry || progress <= 0) {
    return {
      cls: 'wl-dry-tile dust idle',
      style: '--wl-phase:' + phase.toFixed(4) + ';--wl-spark:0;--wl-dissolve:0;',
    };
  }
  const total = WASHING_LINE_DRY_TILE_COUNT;
  const exact = Math.min(1, Math.max(0, progress)) * total;
  const clearedCount = Math.floor(exact);
  const dissolveFrac = exact - clearedCount;
  const rank = wlDustRankByTile(dry, slotIndex)[tileIndex];

  if (rank < clearedCount) {
    return { cls: 'wl-dry-tile dust cleared', style: wlCosmicTileStyle(dry, tileIndex, 1) };
  }
  if (rank > clearedCount) {
    return { cls: 'wl-dry-tile dust', style: wlCosmicTileStyle(dry, tileIndex, 0) };
  }
  return {
    cls: 'wl-dry-tile dust dissolving',
    style: wlCosmicTileStyle(dry, tileIndex, dissolveFrac),
  };
}

/** True while any line still holds a load (drying or ready to auto-gather). */
function washingLineHasPendingDrySlots(cfg) {
  if (!cfg?.drySlots) return false;
  return cfg.drySlots.some((s) => s != null);
}

function collectReadyWashingLineDrySlots(instanceId) {
  const cfg = getWashingLineConfig(instanceId);
  if (!cfg?.drySlots) return false;
  let changed = false;
  const slotTotal = washingLineDrySlotCountForCfg(cfg);
  for (let i = 0; i < slotTotal; i++) {
    const dry = repairWashingLineDrySlotForLine(cfg.drySlots[i], i);
    if (!dry) continue;
    if (washingLineDrySlotReady(dry)) {
      finishWashingLineDrySlot(cfg, i, instanceId);
      changed = true;
    }
  }
  return changed;
}

function stopWashingLineDryTimer() {
  if (washingLineDryTimerHandle) {
    clearInterval(washingLineDryTimerHandle);
    washingLineDryTimerHandle = null;
  }
  washingLinePassiveAirLastMs = 0;
}

/** Lines with a load still drying (not finished / ready to gather). */
function washingLineCountActiveDrying() {
  let n = 0;
  forEachWashingLineSlot((x, y, slot) => {
    const cfg = getWashingLineConfig(slot.instanceId);
    if (!cfg?.drySlots) return;
    const slotTotal = washingLineDrySlotCountForCfg(cfg);
    for (let i = 0; i < slotTotal; i++) {
      const dry = repairWashingLineDrySlotForLine(cfg.drySlots[i], i);
      if (dry && !washingLineDrySlotReady(dry)) n++;
    }
  });
  return n;
}

function syncWashingLineAirSkillPill() {
  const airFill = document.getElementById('washing-line-skill-fill');
  const airLvl = document.getElementById('washing-line-skill-lvl');
  if (!state.skills?.air) return;
  const s = state.skills.air;
  if (airFill) {
    airFill.style.height = Math.min(100, (s.xp / (s.xpToNext || 100)) * 100) + '%';
  }
  if (airLvl) airLvl.textContent = String(s.level || 1);
}

function washingLineGrantPassiveAirXp() {
  const drying = washingLineCountActiveDrying();
  if (drying < 1) {
    washingLinePassiveAirLastMs = 0;
    return;
  }
  const now = Date.now();
  if (!washingLinePassiveAirLastMs) washingLinePassiveAirLastMs = now;
  const elapsed = now - washingLinePassiveAirLastMs;
  if (elapsed < 1000) return;
  const seconds = Math.floor(elapsed / 1000);
  washingLinePassiveAirLastMs += seconds * 1000;
  const perSec = washingLinePassiveAirXpPerSecond(drying);
  const amount = seconds * perSec;
  if (amount < 1) return;
  grantXP('air', amount, null, { skipShardDrop: true, keepActivities: true, deferSync: true });
  scheduleSaveGame();
  if (currentScreen === 'washing-line-screen') {
    if (typeof spawnSkillXpToken === 'function') spawnSkillXpToken('air', amount, 'washing-line');
    syncWashingLineAirSkillPill();
    if (typeof flashSkillPill === 'function') flashSkillPill('air');
  }
  if (typeof markDirty === 'function') markDirty('skills');
}

function ensureWashingLineDryTimer() {
  let any = false;
  forEachWashingLineSlot((x, y, slot) => {
    const cfg = getWashingLineConfig(slot.instanceId);
    if (washingLineHasPendingDrySlots(cfg)) any = true;
  });
  if (!any) {
    stopWashingLineDryTimer();
    return;
  }
  if (washingLineDryTimerHandle) return;
  washingLineDryTimerHandle = setInterval(washingLineDryTick, 100);
}

function washingLineDryTick() {
  washingLineGrantPassiveAirXp();
  let anyPending = false;
  forEachWashingLineSlot((x, y, slot) => {
    const cfg = getWashingLineConfig(slot.instanceId);
    const slotTotal = washingLineDrySlotCountForCfg(cfg);
    for (let i = 0; i < slotTotal; i++) {
      const dry = repairWashingLineDrySlotForLine(cfg.drySlots[i], i);
      if (!dry) continue;
      anyPending = true;
      if (washingLineDrySlotReady(dry)) {
        finishWashingLineDrySlot(cfg, i, slot.instanceId);
      }
    }
  });
  if (!anyPending) stopWashingLineDryTimer();
  if (currentScreen === 'washing-line-screen') {
    const cfg = getWashingLineConfig(activeWashingLineInstanceId);
    renderWashingLineDrySlots();
    renderWashingLineDryControls(cfg);
    if (cfg) {
      const btnState = renderWashingLineButtons(cfg);
      const status = document.getElementById('washing-line-status');
      if (status && btnState) {
        const { free, busy, recipe } = btnState;
        if (busy > 0 && free === 0) {
          status.textContent = 'All lines drying — the air is working.';
        } else if (busy > 0) {
          status.textContent = busy + ' drying, ' + free + ' free — change load or hang the rest.';
        } else if (recipe) {
          const dur = washingLineDryDurationLabel(recipe);
          status.textContent = 'Choose a load' + (dur ? ' (' + dur + ' per line)' : '') + ', then hang & dry.';
        } else {
          status.textContent = 'Choose what to hang.';
        }
        status.classList.toggle('idle', busy < 1);
      }
    }
  }
  if (typeof updateWashingLineCells === 'function') updateWashingLineCells();
}

function finishWashingLineDrySlot(cfg, slotIndex, instanceId) {
  const dry = cfg.drySlots[slotIndex];
  if (!dry) return;
  const recipe = getWashingLineDryRecipe(dry.recipeId);
  cfg.drySlots[slotIndex] = null;
  if (recipe) {
    recipe.outputs.forEach((out) => {
      const def = typeof getItemDef === 'function' ? getItemDef(out.key) : null;
      invAdd(out.key, def?.icon || '📦', def?.name || out.key, out.qty);
    });
    grantXP('air', recipe.airXp | 0, null, { skipShardDrop: true });
    const chance = washingLineShardChanceForRecipe(recipe);
    if (chance > 0 && Math.random() < chance) {
      if (!state.pockets) state.pockets = { fire: 0, water: 0, earth: 0, air: 0, magic: 0 };
      state.pockets.air = (state.pockets.air || 0) + 1;
      const m = SHARD_META.air;
      if (!state._seenShard) {
        state._seenShard = true;
        showFoundBanner('POCKET FIND!', m.icon,
          'An elemental shard — tiny enough to live in your pockets. It uses no bag space.',
          'GOT IT', () => { if (openPanel === 'inv') renderInvPanel(); syncUI(); });
      } else {
        showQuickToast(m.icon + ' Air shard');
      }
    }
    flashSkillPill('air');
  }
  scheduleSaveGame();
  if (activeWashingLineInstanceId === instanceId && currentScreen === 'washing-line-screen') {
    renderWashingLineScreen();
  }
}

function washingLineCanAffordRecipe(recipe) {
  if (!recipe) return false;
  return recipe.inputs.every((inp) => itemCountBagAndStore(inp.key) >= inp.qty);
}

function startWashingLineDrySlot(cfg, slotIndex, recipe) {
  if (!cfg || !recipe || cfg.drySlots[slotIndex]) return false;
  if (!washingLineCanUseDryRecipe(recipe)) return false;
  const durationMs = washingLineDryDurationMs(recipe);
  if (durationMs == null) return false;
  for (const inp of recipe.inputs) {
    const consumed = consumeUpToFromBagOrStore(inp.key, inp.qty);
    if (consumed < inp.qty) return false;
  }
  const now = Date.now();
  const dustOrder = wlBuildDustOrder(wlDustOrderSeed({ recipeId: recipe.id, startedAt: now }, slotIndex));
  cfg.drySlots[slotIndex] = {
    recipeId: recipe.id,
    startedAt: now,
    durationMs,
    endsAt: now + durationMs,
    dustOrder,
  };
  return true;
}

function washingLineAfterStartDry(cfg) {
  scheduleSaveGame();
  ensureWashingLineDryTimer();
  let anyInstant = false;
  const slotTotal = washingLineDrySlotCountForCfg(cfg);
  for (let i = 0; i < slotTotal; i++) {
    const dry = cfg.drySlots[i];
    if (dry && (dry.durationMs | 0) <= 0) anyInstant = true;
  }
  if (anyInstant) washingLineDryTick();
  renderWashingLineScreen();
  syncUI();
}

function startWashingLineDryAt(lineIndex) {
  const instanceId = activeWashingLineInstanceId;
  const cfg = getWashingLineConfig(instanceId);
  if (!cfg || !isWashingLineComplete(cfg)) return;
  const slotTotal = washingLineDrySlotCountForCfg(cfg);
  if (lineIndex < 0 || lineIndex >= slotTotal) return;
  if (cfg.drySlots[lineIndex]) {
    showToast('That line is already drying.');
    return;
  }
  const recipe = washingLineRecipeForSlot(cfg, 0);
  if (!recipe) {
    showToast('Pick what to hang first.');
    return;
  }
  if (!washingLineCanUseDryRecipe(recipe)) {
    showToast('Need Air Lv ' + recipe.airLevel + ' for this.');
    return;
  }
  if (!washingLineCanAffordRecipe(recipe)) {
    showToast('Not enough materials for this line.');
    return;
  }
  if (!startWashingLineDrySlot(cfg, lineIndex, recipe)) {
    showToast('Could not start drying on that line.');
    return;
  }
  washingLineAfterStartDry(cfg);
}

function startWashingLineDryAll() {
  const instanceId = activeWashingLineInstanceId;
  const cfg = getWashingLineConfig(instanceId);
  if (!cfg || !isWashingLineComplete(cfg)) return;
  const recipe = washingLineRecipeForSlot(cfg, 0);
  if (!recipe) {
    showToast('Pick what to hang first.');
    return;
  }
  if (!washingLineCanUseDryRecipe(recipe)) {
    showToast('Need Air Lv ' + recipe.airLevel + ' for this.');
    return;
  }
  const slotTotal = washingLineDrySlotCountForCfg(cfg);
  const free = [];
  for (let i = 0; i < slotTotal; i++) {
    if (!cfg.drySlots[i]) free.push(i);
  }
  if (!free.length) {
    showToast('Every line is already drying.');
    return;
  }
  if (!washingLineCanAffordRecipeTimes(recipe, free.length)) {
    showToast('Not enough materials for ' + free.length + ' lines.');
    return;
  }
  let started = 0;
  free.forEach((i) => {
    if (startWashingLineDrySlot(cfg, i, recipe)) started++;
  });
  if (started < 1) {
    showToast('Could not start drying.');
    return;
  }
  washingLineAfterStartDry(cfg);
}

function washingLineUpgradeMaterialsMet() {
  return WASHING_LINE_UPGRADE_MATERIALS.every((m) => itemCountBagAndStore(m.key) >= m.required);
}

function consumeWashingLineUpgradeMaterials() {
  let archXp = 0;
  for (const m of WASHING_LINE_UPGRADE_MATERIALS) {
    const consumed = consumeUpToFromBagOrStore(m.key, m.required);
    if (consumed < m.required) return { ok: false, archXp: 0 };
    archXp += structureArchXpForMaterial(m.key) * consumed;
  }
  return { ok: true, archXp };
}

function upgradeWashingLine() {
  const instanceId = activeWashingLineInstanceId;
  const cfg = getWashingLineConfig(instanceId);
  if (!cfg || !isWashingLineComplete(cfg) || cfg.improved) return;
  if ((Number(state.skills.architecture?.level) || 1) < WASHING_LINE_UPGRADE_ARCH_UNLOCK) {
    showToast('Need Architecture Lv ' + WASHING_LINE_UPGRADE_ARCH_UNLOCK + ' to upgrade.');
    return;
  }
  if (!washingLineUpgradeMaterialsMet()) {
    showToast('Need ' + WASHING_LINE_UPGRADE_ASHWOOD + ' ashwood and ' + WASHING_LINE_UPGRADE_ROPE + ' rope.');
    return;
  }
  const consumed = consumeWashingLineUpgradeMaterials();
  if (!consumed.ok) {
    showToast('Need ' + WASHING_LINE_UPGRADE_ASHWOOD + ' ashwood and ' + WASHING_LINE_UPGRADE_ROPE + ' rope.');
    return;
  }
  let plotSlot = null;
  forEachWashingLineSlot((x, y, slot) => {
    if (slot.instanceId === instanceId) plotSlot = slot;
  });
  if (!plotSlot) {
    showToast('Could not find this washing line on your plot.');
    return;
  }
  applyWashingLineImprovedOnSlot(plotSlot, cfg);
  grantXP('architecture', consumed.archXp, null);
  scheduleSaveGame();
  const refresh = () => {
    if (typeof updateWashingLineCells === 'function') updateWashingLineCells();
    if (currentScreen === 'washing-line-screen') renderWashingLineScreen();
    syncUI();
  };
  showStructureBuiltBanner({
    bonusKey: 'washing_line_improved',
    title: 'WASHING LINE UPGRADED!',
    icon: '🧺',
    body: 'A second row of lines — ten spots total. Same drying; tap one line or fill every free line.',
    btnText: 'GOT IT',
    cb: refresh,
  });
}

function setWashingLineDefaultRecipe(recipeId) {
  if (!getWashingLineDryRecipe(recipeId)) return;
  washingLineDefaultRecipeId = recipeId;
  washingLineRecipePickerOpen = false;
  const cfg = getWashingLineConfig(activeWashingLineInstanceId);
  if (cfg) {
    cfg.defaultRecipeId = recipeId;
    scheduleSaveGame();
  }
  renderWashingLineScreen();
}

function toggleWashingLineRecipePicker() {
  washingLineRecipePickerOpen = !washingLineRecipePickerOpen;
  renderWashingLineDryControls(getWashingLineConfig(activeWashingLineInstanceId));
}

function washingLineStockLineHtml(key, qty, lineMult) {
  const mult = Math.max(1, lineMult | 0);
  const need = Math.max(1, qty | 0) * mult;
  const stock = itemCountBagAndStore(key);
  const def = typeof getItemDef === 'function' ? getItemDef(key) : null;
  const cls = wbStockClass(stock, need);
  const icon = def?.icon || '📦';
  const name = def?.name || key;
  return '<span class="wb-mat-stock wb-mat-pick-line ' + cls + '">' + stock + '/' + need + ' ' + icon + ' ' + name + '</span>';
}

function washingLineRecipeStockLabelHtml(recipe, lineMult) {
  if (!recipe) return '';
  const mult = Math.max(1, lineMult | 0);
  const inPart = recipe.inputs.map((inp) => washingLineStockLineHtml(inp.key, inp.qty, mult)).join(' ');
  const outPart = recipe.outputs.map((out) => {
    const need = (out.qty | 0) * mult;
    const stock = itemCountBagAndStore(out.key);
    const def = typeof getItemDef === 'function' ? getItemDef(out.key) : null;
    return '<span class="wb-mat-stock wb-mat-pick-line">' + stock + '/' + need + ' ' + (def?.icon || '📦') + ' ' + (def?.name || out.key) + '</span>';
  }).join(' ');
  return inPart + ' <span class="wl-recipe-arrow">→</span> ' + outPart;
}

function washingLineMenuTap(event) {
  event?.stopPropagation();
  const instanceId = resolveWashingLineInstanceId(event);
  if (instanceId) setActiveWashingLine(instanceId);
  openWashingLineScreen();
}

function openWashingLineScreen() {
  washingLineRecipePickerOpen = false;
  migrateWashingLine();
  const instanceId = activeWashingLineInstanceId;
  if (!instanceId || !washingLineSlotExists(instanceId)) {
    showToast('Mark out a washing line on your plot first.');
    return;
  }
  showScreen('washing-line-screen');
  lastHome = 'exterior-screen';
  renderWashingLineScreen();
  syncUI();
  ensureWashingLineDryTimer();
}

function closeWashingLineScreen() {
  showScreen('exterior-screen');
  lastHome = 'exterior-screen';
  syncUI();
}

function renderWashingLineBuildSection(cfg) {
  const stage = getWashingLineStage(cfg);
  const logs = cfg.logs | 0;
  const rope = cfg.rope | 0;
  const logsDone = logs >= WASHING_LINE_LOGS_REQUIRED;
  const ropeDone = rope >= WASHING_LINE_ROPE_REQUIRED;
  const canAddLogs = stage === 'building' && !logsDone && itemCountBagAndStore('logs') > 0;
  const canAddRope = stage === 'unthreaded' && !ropeDone && itemCountBagAndStore('rope') > 0;
  let html = '<div class="washing-line-progress-count" id="washing-line-progress-count">';
  if (stage === 'building') {
    html += logs + ' / ' + WASHING_LINE_LOGS_REQUIRED + ' logs';
  } else {
    html += rope + ' / ' + WASHING_LINE_ROPE_REQUIRED + ' rope';
  }
  html += '</div>';
  if (stage === 'building') {
    html += '<div class="well-brick-grid washing-line-material-grid">'
      + Array.from({ length: WASHING_LINE_LOGS_REQUIRED }, (_, i) => {
        const filled = i < logs;
        return '<div class="well-brick-slot' + (filled ? ' filled' : '') + '" onclick="placeWashingLineLog()">'
          + (filled ? '🪵' : '') + '</div>';
      }).join('')
      + '</div>';
    html += '<div class="wb-use-box"><div class="wb-use-btns washing-line-use-btns">'
      + '<button type="button" class="wb-btn once" style="flex:1" ' + (logsDone || !canAddLogs ? 'disabled' : '') + ' onclick="placeWashingLineLog()">'
      + '🪵 ADD LOGS<span class="wb-btn-sub">' + logs + '/' + WASHING_LINE_LOGS_REQUIRED + '</span></button>'
      + '</div></div>';
  } else {
    html += '<div class="well-brick-grid washing-line-material-grid">'
      + Array.from({ length: WASHING_LINE_ROPE_REQUIRED }, (_, i) => {
        const filled = i < rope;
        return '<div class="well-brick-slot' + (filled ? ' filled' : '') + '" onclick="placeWashingLineRope()">'
          + (filled ? '⛓️' : '') + '</div>';
      }).join('')
      + '</div>';
    html += '<div class="wb-use-box"><div class="wb-use-btns washing-line-use-btns">'
      + '<button type="button" class="wb-btn once" style="flex:1" ' + (ropeDone || !canAddRope ? 'disabled' : '') + ' onclick="placeWashingLineRope()">'
      + '⛓️ ADD ROPE<span class="wb-btn-sub">' + rope + '/' + WASHING_LINE_ROPE_REQUIRED + '</span></button>'
      + '</div></div>';
  }
  return html;
}

function renderWashingLineDryControls(cfg) {
  const el = document.getElementById('washing-line-recipe-list');
  if (!el || !cfg) return;
  const recipeId = cfg.defaultRecipeId || washingLineDefaultRecipeId;
  const recipe = getWashingLineDryRecipe(recipeId) || WASHING_LINE_DRY_RECIPES[0];
  const free = washingLineCountFreeSlots(cfg);
  const allBusy = free < 1;
  const ok = recipe && washingLineCanUseDryRecipe(recipe);
  const afford = recipe && washingLineCanAffordRecipe(recipe);
  const dur = recipe ? washingLineDryDurationLabel(recipe) : '';

  if (!washingLineRecipePickerOpen) {
    const pickCls = 'wb-log-pick wb-log-pick-collapsed' + (ok && afford && !allBusy ? ' ready' : ' unavail');
    const meta = !ok
      ? (typeof wbMatSuccessLineHtml === 'function' ? wbMatSuccessLineHtml('Air Lv ' + (recipe?.airLevel || 1)) : '')
      : (typeof wbMatSuccessLineHtml === 'function' ? wbMatSuccessLineHtml(dur ? dur + ' per line' : '') : '');
    el.innerHTML = '<div class="' + pickCls + '" onclick="toggleWashingLineRecipePicker()">'
      + '<span class="wb-mat-icon">' + (recipe?.inputs?.[0] ? (getItemDef(recipe.inputs[0].key)?.icon || '🧺') : '🧺') + '</span>'
      + '<div class="wb-mat-pick-body">'
      + '<span class="wb-mat-pick-avail wb-mat-pick-line">' + washingLineRecipeStockLabelHtml(recipe, 1) + '</span>'
      + meta
      + '</div>'
      + '<span class="wb-log-pick-chevron">▾</span>'
      + '</div>';
    return;
  }

  el.innerHTML = WASHING_LINE_DRY_RECIPES.map((r) => {
    const unlocked = washingLineCanUseDryRecipe(r);
    const sel = r.id === recipeId ? ' selected' : '';
    const canPick = unlocked;
    const onclick = canPick ? (' onclick="setWashingLineDefaultRecipe(\'' + r.id + '\')"') : '';
    const meta = !unlocked
      ? (typeof wbMatSuccessLineHtml === 'function' ? wbMatSuccessLineHtml('Air Lv ' + r.airLevel) : '')
      : (typeof wbMatSuccessLineHtml === 'function'
        ? wbMatSuccessLineHtml(washingLineDryDurationLabel(r) + ' per line')
        : '');
    return '<div class="wb-mat-option' + sel + (canPick ? '' : ' unavail') + '"' + onclick + '>'
      + '<span class="wb-mat-info">'
      + '<span class="wb-mat-name">' + washingLineRecipeStockLabelHtml(r, 1) + '</span>'
      + meta
      + '</span></div>';
  }).join('');
}

function renderWashingLineDryLineHtml(cfg, lineIndex) {
  const rawDry = cfg.drySlots[lineIndex];
  const dry = rawDry ? repairWashingLineDrySlotForLine(rawDry, lineIndex) : null;
  const progress = dry ? washingLineDryProgress(dry) : 0;
  const busy = !!rawDry;
  const lineCls = 'wl-line' + (busy ? ' busy' : ' empty wl-line-tap');
  const lineAttrs = busy
    ? ''
    : ' role="button" tabindex="0" onclick="startWashingLineDryAt(' + lineIndex + ')"';
  let tiles = '';
  for (let t = 0; t < WASHING_LINE_DRY_TILE_COUNT; t++) {
    const tile = washingLineDryTileVisual(dry, progress, t, lineIndex);
    tiles += '<div class="' + tile.cls + '"' + (tile.style ? ' style="' + tile.style + '"' : '') + '></div>';
  }
  return '<div class="' + lineCls + '"' + lineAttrs
    + ' title="' + (busy ? 'Drying' : 'Hang load on line ' + (lineIndex + 1)) + '">'
    + '<div class="wl-line-label">' + (lineIndex + 1) + '</div>'
    + '<div class="wl-dry-grid" data-slot="' + lineIndex + '">'
    + tiles
    + '</div></div>';
}

function renderWashingLineDrySlots() {
  const el = document.getElementById('washing-line-dry-slots');
  if (!el) return;
  const cfg = getWashingLineConfig(activeWashingLineInstanceId);
  if (!cfg) return;
  const improved = !!cfg.improved;
  const perRow = WASHING_LINE_DRY_SLOTS_PER_ROW;
  const total = washingLineDrySlotCountForCfg(cfg);
  let html = '';
  if (improved) {
    html += '<div class="wl-lines-improved">';
    for (let i = 0; i < total; i++) html += renderWashingLineDryLineHtml(cfg, i);
    html += '</div>';
  } else {
    html += '<div class="wl-lines-row">';
    for (let i = 0; i < total; i++) html += renderWashingLineDryLineHtml(cfg, i);
    html += '</div>';
  }
  el.innerHTML = html;
}

function renderWashingLineButtons(cfg) {
  const btnEl = document.getElementById('washing-line-buttons');
  const free = washingLineCountFreeSlots(cfg);
  const busy = washingLineCountBusySlots(cfg);
  const recipe = washingLineRecipeForSlot(cfg, 0);
  if (btnEl) {
    const canHang = free > 0 && recipe && washingLineCanUseDryRecipe(recipe)
      && washingLineCanAffordRecipeTimes(recipe, free);
    if (free > 0 && recipe) {
      btnEl.innerHTML = '<button type="button" class="wb-btn once"' + (canHang ? '' : ' disabled')
        + ' onclick="startWashingLineDryAll()">🌬️ HANG AND DRY ALL</button>';
    } else {
      btnEl.innerHTML = '';
    }
  }
  return { free, busy, recipe };
}

function renderWashingLineUpgradeMaterials() {
  return WASHING_LINE_UPGRADE_MATERIALS.map((m) => {
    const stock = itemCountBagAndStore(m.key);
    const cls = wbStockClass(stock, m.required);
    return '<span class="wb-mat-stock wb-mat-pick-line ' + cls + '">' + formatRecipeMatLine(m.name, m.required, stock) + '</span>';
  }).join('');
}

function toggleWashingLineUpgradeSection() {
  document.querySelector('.wl-upgrade-cat')?.classList.toggle('open');
}

function renderWashingLineUpgradeSection(cfg) {
  if (!cfg || cfg.improved || !isWashingLineComplete(cfg)) return '';
  const archLvl = Number(state.skills.architecture?.level) || 1;
  const archOk = archLvl >= WASHING_LINE_UPGRADE_ARCH_UNLOCK;
  const matsOk = washingLineUpgradeMaterialsMet();
  const btnDisabled = !archOk || !matsOk;
  const bonusXp = typeof structureFirstCompleteBonusXp === 'function'
    ? structureFirstCompleteBonusXp(WASHING_LINE_IMPROVED_TYPE_ID)
    : 0;
  return '<div class="barn-panel-dark wl-upgrade-cat plot-add-cat">'
    + '<button type="button" class="plot-add-cat-head" onclick="toggleWashingLineUpgradeSection()">'
    + '<span class="plot-add-cat-chevron">▶</span>'
    + '<span class="plot-add-cat-title">UPGRADE WASHING LINE</span>'
    + '</button>'
    + '<div class="plot-add-cat-body">'
    + '<p class="barn-upgrade-flavor">Add a second row on this tile — ten lines total, same drying as now.'
    + (bonusXp > 0 ? ' One-time +' + bonusXp.toLocaleString() + ' Architecture XP when upgraded.' : '')
    + '</p>'
    + '<div class="barn-upgrade-materials">' + renderWashingLineUpgradeMaterials() + '</div>'
    + '<div class="barn-upgrade-action">'
    + (typeof barnArchLevelBadge === 'function'
      ? barnArchLevelBadge(WASHING_LINE_UPGRADE_ARCH_UNLOCK)
      : '<span class="plot-add-level-badge">🏗️ ' + archLvl + '/' + WASHING_LINE_UPGRADE_ARCH_UNLOCK + '</span>')
    + '<button type="button" class="wb-btn once barn-upgrade-btn"'
    + (btnDisabled ? ' disabled' : '')
    + ' onclick="upgradeWashingLine()">'
    + '✨ UPGRADE WASHING LINE'
    + '<span class="wb-btn-sub">second row · 10 lines · +' + getWashingLineUpgradeArchXp() + ' Arch XP from materials</span>'
    + '</button>'
    + (!archOk
      ? '<p class="barn-upgrade-flavor">Reach Architecture Lv ' + WASHING_LINE_UPGRADE_ARCH_UNLOCK + ' first.</p>'
      : '')
    + '</div></div></div>';
}

function renderWashingLineScreen() {
  migrateWashingLine();
  const cfg = getWashingLineConfig(activeWashingLineInstanceId);
  const buildEl = document.getElementById('washing-line-build-section');
  const activityEl = document.getElementById('washing-line-activity-section');
  const subtitle = document.getElementById('washing-line-subtitle');
  const status = document.getElementById('washing-line-status');
  const btnEl = document.getElementById('washing-line-buttons');
  const upgradeEl = document.getElementById('washing-line-upgrade-section');
  if (!cfg) return;
  const complete = isWashingLineComplete(cfg);
  if (subtitle) {
    const title = document.querySelector('#washing-line-screen .wb-item-name');
    if (title) title.textContent = WASHING_LINE_DISPLAY_NAME;
    subtitle.textContent = complete
      ? 'Pick a load — tap a line or hang on every free line'
      : getWashingLineStage(cfg) === 'unthreaded'
        ? 'Thread rope to finish the unstrung line'
        : 'Raise the frame with twenty logs';
  }
  if (buildEl) buildEl.hidden = complete;
  if (activityEl) activityEl.hidden = !complete;
  if (btnEl) btnEl.innerHTML = '';
  if (buildEl && !complete) buildEl.innerHTML = renderWashingLineBuildSection(cfg);
  if (complete) {
    renderWashingLineDryControls(cfg);
    renderWashingLineDrySlots();
    const btnState = renderWashingLineButtons(cfg);
    if (upgradeEl) upgradeEl.innerHTML = renderWashingLineUpgradeSection(cfg);
    if (status && btnState) {
      const { free, busy, recipe } = btnState;
      if (busy > 0 && free === 0) {
        status.textContent = 'All lines drying — the air is working.';
      } else if (busy > 0) {
        status.textContent = busy + ' drying, ' + free + ' free — change load or hang the rest.';
      } else if (recipe) {
        const dur = washingLineDryDurationLabel(recipe);
        status.textContent = 'Choose a load' + (dur ? ' (' + dur + ' per line)' : '') + ', then hang & dry.';
      } else {
        status.textContent = 'Choose what to hang.';
      }
      status.classList.toggle('idle', busy < 1);
    }
  } else {
    if (upgradeEl) upgradeEl.innerHTML = '';
    if (status) {
      const stage = getWashingLineStage(cfg);
      status.textContent = stage === 'unthreaded'
        ? 'Thread the line with rope — tap the grid or button below.'
        : 'Raise the frame with logs — tap the grid or button below.';
      status.classList.add('idle');
    }
  }
  syncWashingLineAirSkillPill();
}

function updateWashingLineCells() {
  migrateWashingLine();
  document.querySelectorAll('.plot-cell.cell-washing-line').forEach((cell) => {
    const instanceId = cell.dataset.instanceId;
    const cfg = getWashingLineConfig(instanceId);
    const typeId = cell.dataset.typeId || 'washing_line';
    const vis = getWashingLineVisualState(cfg, typeId);
    cell.classList.remove('washing-line-building', 'washing-line-unthreaded', 'washing-line-complete');
    cell.classList.add('washing-line-' + vis.stage);
    const icon = cell.querySelector('.washing-line-icon');
    const label = cell.querySelector('.washing-line-label');
    if (icon) icon.textContent = vis.icon;
    if (label) label.textContent = vis.label;
    const top = cell.querySelector('.washing-line-activity-top');
    if (top) {
      top.classList.remove('washing-line-building', 'washing-line-unthreaded', 'washing-line-complete');
      top.classList.add('washing-line-' + vis.stage);
    }
  });
}

function buildWashingLineCellHtml(slot, def, editMode) {
  if (typeof migrateWashingLine === 'function') migrateWashingLine();
  const cfg = typeof getWashingLineConfig === 'function' ? getWashingLineConfig(slot.instanceId) : null;
  const vis = getWashingLineVisualState(cfg, slot.typeId);
  const complete = vis.stage === 'complete';
  return '<div class="plot-activity-top washing-line-activity-top washing-line-' + vis.stage + '">'
    + '<div class="washing-line-sprite">'
    + '<span class="washing-line-icon">' + vis.icon + '</span>'
    + '<span class="washing-line-label">' + vis.label + '</span></div></div>'
    + '<div class="plot-activity-menu-zone washing-line-menu-zone">'
    + '<button type="button" class="plot-menu-btn washing-line-menu-btn" onclick="washingLineMenuTap(event)">menu</button>'
    + '</div>'
    + (editMode ? '<div class="plot-edit-hint">remove</div>' : '');
}

function handleWashingLineCellTap(e, cell, slot) {
  if (e?.target?.closest?.('.washing-line-menu-btn')) return;
  setActiveWashingLine(slot.instanceId);
  openWashingLineScreen();
}
