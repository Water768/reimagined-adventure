/* Hearthstead — Whispering Woods Camp */
'use strict';

let activeWhisperCampInstanceId = null;

function normalizeWhisperCampConfig(cfg) {
  if (!cfg) {
    return { logs: 0, complete: false, freePlaced: false, campTier: 0 };
  }
  if (cfg.logs == null) cfg.logs = 0;
  if (cfg.complete == null) cfg.complete = false;
  if (cfg.freePlaced == null) cfg.freePlaced = false;
  if (cfg.campTier == null) cfg.campTier = cfg.complete ? 1 : 0;
  if (isWhisperCampComplete(cfg)) {
    cfg.logs = WHISPER_CAMP_LOGS_BUILD;
    cfg.complete = true;
    if (!cfg.campTier) cfg.campTier = 1;
  }
  return cfg;
}

function getWhisperCampConfig(instanceId) {
  if (!instanceId) return null;
  if (!state.plotConfigs) state.plotConfigs = {};
  if (!state.plotConfigs[instanceId]) {
    state.plotConfigs[instanceId] = typeof defaultPlotConfigForBehavior === 'function'
      ? defaultPlotConfigForBehavior('whisper_camp', WHISPER_CAMP_TYPE_T1)
      : { logs: 0, complete: false, freePlaced: false, campTier: 0 };
  }
  return normalizeWhisperCampConfig(state.plotConfigs[instanceId]);
}

function repairWhisperCampSlotState(slot) {
  if (!slot?.instanceId) return 0;
  const cfg = getWhisperCampConfig(slot.instanceId);
  const typeTier = whisperCampTierFromTypeId(slot.typeId);
  const accountTier = Math.max(0, state.whisperCampTier | 0);
  const effectiveTier = Math.max(typeTier, accountTier, cfg.campTier | 0);

  if (effectiveTier >= 1) {
    cfg.complete = true;
    cfg.logs = WHISPER_CAMP_LOGS_BUILD;
    cfg.campTier = effectiveTier;
    if (state.whisperCampUnlocked) cfg.freePlaced = true;
    if (typeTier !== effectiveTier) slot.typeId = whisperCampTypeIdForTier(effectiveTier);
    syncWhisperCampAccountTier(effectiveTier);
    return effectiveTier;
  }

  return cfg.complete || cfg.freePlaced ? Math.max(1, cfg.campTier | 0) : 0;
}

function setActiveWhisperCamp(instanceId) {
  activeWhisperCampInstanceId = instanceId || null;
}

function resolveWhisperCampCell(el) {
  if (el?.classList?.contains('cell-whisper-camp')) return el;
  return el?.closest?.('.plot-cell.cell-whisper-camp') || null;
}

function resolveWhisperCampInstanceId(eventOrCell) {
  const cell = eventOrCell?.classList ? eventOrCell : resolveWhisperCampCell(eventOrCell?.target);
  return cell?.dataset?.instanceId || activeWhisperCampInstanceId || null;
}

function forEachWhisperCampSlot(fn) {
  if (typeof forEachPlotStructureSlot === 'function') forEachPlotStructureSlot('whisper_camp', fn);
}

function countWhisperCampsOnPlot() {
  let n = 0;
  forEachWhisperCampSlot(() => { n++; });
  return n;
}

function getWhisperCampAccountTier() {
  migrateWhisperCamp();
  return Math.max(0, state.whisperCampTier | 0);
}

function getWhisperCampTierFromSlot(slot, cfg) {
  if (!slot) return getWhisperCampAccountTier();
  cfg = cfg || getWhisperCampConfig(slot.instanceId);
  const typeTier = whisperCampTierFromTypeId(slot.typeId);
  if (typeTier >= 1) {
    return Math.max(typeTier, cfg?.campTier | 0, getWhisperCampAccountTier());
  }
  if (!cfg?.complete && !cfg?.freePlaced) return 0;
  return Math.max(typeTier, cfg?.campTier | 0, getWhisperCampAccountTier());
}

function canUseWhisperCampStructure() {
  return (Number(state.skills.architecture?.level) || 1) >= WHISPER_CAMP_ARCH_UNLOCK;
}

function isWhisperCampUnlocked() {
  migrateWhisperCamp();
  return !!state.whisperCampUnlocked;
}

function canPlaceWhisperCamp() {
  migrateWhisperCamp();
  if (!canUseWhisperCampStructure()) return false;
  if (typeof isPlotFeatureUnlockedByTile === 'function' && !isPlotFeatureUnlockedByTile('whisper_camp')) return false;
  if (state.whisperCampUnlocked) return true;
  return countWhisperCampsOnPlot() === 0;
}

function whisperCampSlotExists(instanceId) {
  let found = false;
  forEachWhisperCampSlot((x, y, slot) => {
    if (slot.instanceId === instanceId) found = true;
  });
  return found;
}

function applyWhisperCampTierOnSlot(slot, tier) {
  if (!slot) return;
  const t = Math.max(1, tier | 0);
  slot.typeId = whisperCampTypeIdForTier(t);
  const cfg = getWhisperCampConfig(slot.instanceId);
  cfg.campTier = t;
  cfg.complete = true;
  cfg.logs = WHISPER_CAMP_LOGS_BUILD;
  cfg.freePlaced = cfg.freePlaced || !!state.whisperCampUnlocked;
  syncWhisperCampAccountTier(t);
  scheduleSaveGame();
}

function syncWhisperCampAccountTier(tier) {
  const t = Math.max(state.whisperCampTier | 0, tier | 0);
  state.whisperCampTier = t;
  state.whisperCampUnlocked = t >= 1;
}

function unlockWhisperCampBuilt() {
  syncWhisperCampAccountTier(Math.max(1, state.whisperCampTier | 0));
  scheduleSaveGame();
}

function ensureWhisperCampFeatureTilePlaced() {
  if (typeof PLOT_FEATURE_TILE_UNLOCKS === 'undefined' || typeof isPlotTileUnlocked !== 'function') return;
  if (countWhisperCampsOnPlot() > 0) return;
  for (const feat of PLOT_FEATURE_TILE_UNLOCKS) {
    if (feat.typeId !== 'whisper_camp') continue;
    if (!isPlotTileUnlocked(feat.x, feat.y)) continue;
    if (typeof getPlotCell === 'function' && getPlotCell(feat.x, feat.y)) continue;
    if (typeof placePlotDefaultTile === 'function') placePlotDefaultTile(feat.x, feat.y);
    return;
  }
}

function migrateWhisperCamp() {
  if (state.whisperCampUnlocked == null) state.whisperCampUnlocked = false;
  if (state.whisperCampTier == null) state.whisperCampTier = state.whisperCampUnlocked ? 1 : 0;
  ensureWhisperCampFeatureTilePlaced();
  forEachWhisperCampSlot((x, y, slot) => {
    repairWhisperCampSlotState(slot);
  });
}

function getWhisperCampExpeditionTier(slot){
  if(!slot?.instanceId) return 0;
  repairWhisperCampSlotState(slot);
  const cfg=getWhisperCampConfig(slot.instanceId);
  if(!isWhisperCampComplete(cfg)&&!cfg?.freePlaced) return 0;
  return getWhisperCampTierFromSlot(slot, cfg);
}

function getAdjacentWhisperCampTierForWoods(woodsInstanceId) {
  migrateWhisperCamp();
  if(typeof getAdjacentPlotCampTier==='function'){
    return getAdjacentPlotCampTier(woodsInstanceId, 'whisper_camp', getWhisperCampExpeditionTier);
  }
  return 0;
}

function completeWhisperCampBuild(instanceId) {
  instanceId = instanceId || activeWhisperCampInstanceId;
  const cfg = getWhisperCampConfig(instanceId);
  const slot = findPlotCoordForInstanceId(instanceId)?.slot;
  if (!cfg || !slot) return;
  cfg.logs = WHISPER_CAMP_LOGS_BUILD;
  cfg.complete = true;
  cfg.campTier = 1;
  applyWhisperCampTierOnSlot(slot, 1);
  const showBanner = !state.whisperCampUnlocked;
  unlockWhisperCampBuilt();
  const refresh = () => {
    if (typeof updateWhisperCampCells === 'function') updateWhisperCampCells();
    if (currentScreen === 'whisper-camp-screen') renderWhisperCampScreen();
    if(typeof renderExploring==='function') renderExploring();
    syncUI();
  };
  if (showBanner) {
    showStructureBuiltBanner({
      bonusKey: 'whisper_camp',
      title: 'CAMP RAISED!',
      icon: '⛺',
      body: WHISPER_CAMP_TIER_LABELS[1],
      btnText: 'GOT IT',
      cb: refresh,
    });
  } else {
    refresh();
  }
}

function donateWhisperCampLogs(event, instanceId) {
  instanceId = instanceId || activeWhisperCampInstanceId;
  const cfg = getWhisperCampConfig(instanceId);
  if (!cfg || cfg.complete || cfg.freePlaced) return false;
  const need = WHISPER_CAMP_LOGS_BUILD - (cfg.logs | 0);
  if (need < 1) {
    completeWhisperCampBuild(instanceId);
    return false;
  }
  const consumed = consumeUpToFromBagOrStore('logs', need);
  if (consumed < 1) {
    showToast('Need logs to raise the camp frame.');
    return false;
  }
  cfg.logs = (cfg.logs | 0) + consumed;
  grantXP('architecture', structureArchXpForMaterial('logs') * consumed, null);
  if (isWhisperCampComplete(cfg)) completeWhisperCampBuild(instanceId);
  else {
    if (typeof updateWhisperCampCells === 'function') updateWhisperCampCells();
    if (currentScreen === 'whisper-camp-screen') renderWhisperCampScreen();
    syncUI();
  }
  return true;
}

function whisperCampUpgradeMaterialsMet(tier) {
  return getWhisperCampUpgradeCost(tier).every((m) => itemCountBagAndStore(m.key) >= (m.qty | 0));
}

function upgradeWhisperCampTier() {
  const instanceId = activeWhisperCampInstanceId;
  const slot = findPlotCoordForInstanceId(instanceId)?.slot;
  if (!slot) {
    showToast('Build the camp first.');
    return;
  }
  repairWhisperCampSlotState(slot);
  const cfg = getWhisperCampConfig(instanceId);
  const currentTier = getWhisperCampTierFromSlot(slot, cfg);
  if (currentTier < 1) {
    showToast('Donate logs to build Tier 1 before upgrading.');
    return;
  }
  const next = Math.min(3, currentTier + 1);
  if (next <= currentTier || next > 3) return;
  const costs = getWhisperCampUpgradeCost(next);
  if (!costs.length) return;
  if (!whisperCampUpgradeMaterialsMet(next)) {
    showToast('Need materials for this upgrade.');
    return;
  }
  for (const m of costs) {
    if (!consumeManyFromBagOrStore(m.key, m.qty)) {
      showToast('Missing ' + (m.name || m.key) + '.');
      return;
    }
  }
  applyWhisperCampTierOnSlot(slot, next);
  syncWhisperCampAccountTier(next);
  forEachWhisperCampSlot((x, y, s) => {
    if (s.instanceId !== slot.instanceId && getWhisperCampTierFromSlot(s) < next) {
      applyWhisperCampTierOnSlot(s, next);
    }
  });
  scheduleSaveGame();
  showToast('⛺ ' + WHISPER_CAMP_DISPLAY_NAME + ' — ' + WHISPER_CAMP_TIER_LABELS[next]);
  if (typeof updateWhisperCampCells === 'function') updateWhisperCampCells();
  renderWhisperCampScreen();
  syncUI();
}

function whisperCampMenuTap(event) {
  event?.stopPropagation();
  const instanceId = resolveWhisperCampInstanceId(event);
  if (instanceId) setActiveWhisperCamp(instanceId);
  openWhisperCampScreen();
}

function openWhisperCampScreen() {
  migrateWhisperCamp();
  const instanceId = activeWhisperCampInstanceId;
  if (!instanceId || !whisperCampSlotExists(instanceId)) {
    showToast('Mark out a Whispering Woods Camp site on your plot first.');
    return;
  }
  showScreen('whisper-camp-screen');
  lastHome = 'exterior-screen';
  renderWhisperCampScreen();
}

function closeWhisperCampScreen() {
  showScreen('exterior-screen');
  lastHome = 'exterior-screen';
  syncUI();
}

function renderWhisperCampScreen() {
  migrateWhisperCamp();
  updateActivitySkillPill('whisper-camp', 'architecture');
  const instanceId = activeWhisperCampInstanceId;
  const cfg = getWhisperCampConfig(instanceId);
  const coord = findPlotCoordForInstanceId(instanceId);
  const slot = coord?.slot;
  if (slot) repairWhisperCampSlotState(slot);
  const tier = getWhisperCampTierFromSlot(slot, cfg);
  const titleEl = document.querySelector('#whisper-camp-screen .wb-item-name');
  const topTitleEl = document.querySelector('#whisper-camp-screen .top-bar-title');
  const subEl = document.getElementById('whisper-camp-subtitle');
  const progressEl = document.getElementById('whisper-camp-progress');
  const upgradeEl = document.getElementById('whisper-camp-upgrade-section');
  const statusEl = document.getElementById('whisper-camp-status');
  const buildEl = document.getElementById('whisper-camp-build-section');
  const activityEl = document.getElementById('whisper-camp-activity-section');

  if (titleEl) {
    titleEl.textContent = tier > 0
      ? WHISPER_CAMP_DISPLAY_NAME + ' (' + whisperCampDisplayTierName(tier) + ')'
      : WHISPER_CAMP_DISPLAY_NAME;
  }
  if (topTitleEl) {
    topTitleEl.textContent = tier > 0
      ? WHISPER_CAMP_DISPLAY_NAME + ' · ' + whisperCampDisplayTierName(tier)
      : WHISPER_CAMP_DISPLAY_NAME;
  }
  if (subEl) subEl.textContent = tier > 0 ? WHISPER_CAMP_TIER_LABELS[tier] : 'Raise the camp with logs (Tier 1)';
  if (progressEl) {
    progressEl.textContent = tier > 0
      ? whisperCampDisplayTierName(tier) + ' / Tier 3'
      : (cfg?.logs | 0) + ' / ' + WHISPER_CAMP_LOGS_BUILD + ' logs';
  }
  if (buildEl) buildEl.hidden = tier > 0;
  if (activityEl) activityEl.hidden = tier < 1;

  if (upgradeEl) {
    if (tier < 1 || tier >= 3) {
      upgradeEl.innerHTML = tier >= 3
        ? '<div class="store-line" style="color:rgba(200,169,110,0.55)">Tier 3 — all trek lengths unlocked at Whispering Woods.</div>'
        : '';
    } else {
      const next = tier + 1;
      const costs = getWhisperCampUpgradeCost(next);
      const met = whisperCampUpgradeMaterialsMet(next);
      const costLine = costs.map((m) => m.qty + ' ' + m.name).join(' · ');
      upgradeEl.innerHTML = '<div class="store-items">'
        + '<div class="store-items-title">UPGRADE TO ' + whisperCampDisplayTierName(next).toUpperCase() + '</div>'
        + '<div class="store-line" style="font-size:12px;margin-bottom:8px">' + WHISPER_CAMP_TIER_LABELS[next] + '</div>'
        + '<div class="store-line" style="font-size:11px;color:var(--ui-text-dim);margin-bottom:8px">' + costLine + '</div>'
        + '<div class="wb-use-box"><div class="wb-use-btns">'
        + '<button class="wb-btn once" ' + (met ? '' : 'disabled') + ' onclick="upgradeWhisperCampTier()">UPGRADE CAMP</button>'
        + '</div></div></div>';
    }
  }

  if (statusEl) {
    if (tier < 1) statusEl.textContent = 'Donate logs to raise the camp to Tier 1.';
    else if (tier < 3) statusEl.textContent = 'Upgrade to ' + whisperCampDisplayTierName(tier + 1) + ' to unlock longer treks at Whispering Woods.';
    else statusEl.textContent = 'Tier 3 camp ready — launch any trek at the adjacent Whispering Woods.';
  }

  const btnEl = document.getElementById('whisper-camp-buttons');
  if (btnEl && tier < 1) {
    btnEl.innerHTML = '<div class="wb-use-box"><div class="wb-use-btns">'
      + '<button class="wb-btn once" onclick="donateWhisperCampLogs()">DONATE LOGS</button>'
      + '</div></div>';
  } else if (btnEl) {
    btnEl.innerHTML = '';
  }
}

function buildWhisperCampCellHtml(slot, def, editMode) {
  migrateWhisperCamp();
  repairWhisperCampSlotState(slot);
  const cfg = getWhisperCampConfig(slot.instanceId);
  const tier = getWhisperCampTierFromSlot(slot, cfg);
  const label = tier >= 1
    ? (WHISPER_CAMP_DISPLAY_NAME + ' (' + whisperCampDisplayTierName(tier) + ')')
    : ('Building ' + (cfg?.logs | 0) + '/' + WHISPER_CAMP_LOGS_BUILD);
  return '<div class="plot-activity-top whisper-camp-activity-top">'
    + '<div class="whisper-camp-sprite">'
    + '<span class="whisper-camp-icon">' + (def?.icon || '⛺') + '</span>'
    + '<span class="whisper-camp-label">' + label + '</span></div></div>'
    + '<div class="plot-activity-menu-zone">'
    + '<button type="button" class="plot-menu-btn">menu</button>'
    + '</div>';
}

function handleWhisperCampCellTap(e, cell, slot) {
  if (plotSuppressClick || state.plot?.editMode) return;
  if (e?.target?.closest?.('.plot-menu-btn')) {
    e.stopPropagation();
    setActiveWhisperCamp(slot.instanceId);
    openWhisperCampScreen();
    return;
  }
  setActiveWhisperCamp(slot.instanceId);
  openWhisperCampScreen();
}

function updateWhisperCampCells() {
  migrateWhisperCamp();
  document.querySelectorAll('.plot-cell.cell-whisper-camp').forEach((cell) => {
    const instanceId = cell.dataset.instanceId;
    if (!instanceId) return;
    const coord = findPlotCoordForInstanceId(instanceId);
    const slot = coord?.slot;
    if (!slot) return;
    repairWhisperCampSlotState(slot);
    const cfg = getWhisperCampConfig(instanceId);
    const tier = getWhisperCampTierFromSlot(slot, cfg);
    const def = getPlotTileDef(slot.typeId);
    const label = tier >= 1
      ? (WHISPER_CAMP_DISPLAY_NAME + ' (' + whisperCampDisplayTierName(tier) + ')')
      : ('Building ' + (cfg?.logs | 0) + '/' + WHISPER_CAMP_LOGS_BUILD);
    if (cell.dataset.typeId !== slot.typeId) cell.dataset.typeId = slot.typeId;
    const icon = cell.querySelector('.whisper-camp-icon');
    const labelEl = cell.querySelector('.whisper-camp-label');
    if (icon) icon.textContent = def?.icon || '⛺';
    if (labelEl) labelEl.textContent = label;
  });
  if (typeof renderPlotGrid === 'function') renderPlotGrid();
}
