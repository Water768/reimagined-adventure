/* Hearthstead — Coastal Docks */
'use strict';

let activeCoastalDocksInstanceId = null;

function normalizeCoastalDocksConfig(cfg) {
  if (!cfg) {
    return { logs: 0, complete: false, freePlaced: false, campTier: 0 };
  }
  if (cfg.logs == null) cfg.logs = 0;
  if (cfg.complete == null) cfg.complete = false;
  if (cfg.freePlaced == null) cfg.freePlaced = false;
  if (cfg.campTier == null) cfg.campTier = cfg.complete ? 1 : 0;
  if (isCoastalDocksComplete(cfg)) {
    cfg.logs = COASTAL_DOCKS_LOGS_BUILD;
    cfg.complete = true;
    if (!cfg.campTier) cfg.campTier = 1;
  }
  return cfg;
}

function getCoastalDocksConfig(instanceId) {
  if (!instanceId) return null;
  if (!state.plotConfigs) state.plotConfigs = {};
  if (!state.plotConfigs[instanceId]) {
    state.plotConfigs[instanceId] = typeof defaultPlotConfigForBehavior === 'function'
      ? defaultPlotConfigForBehavior('coastal_docks', COASTAL_DOCKS_TYPE_T1)
      : { logs: 0, complete: false, freePlaced: false, campTier: 0 };
  }
  return normalizeCoastalDocksConfig(state.plotConfigs[instanceId]);
}

function repairCoastalDocksSlotState(slot) {
  if (!slot?.instanceId) return 0;
  const cfg = getCoastalDocksConfig(slot.instanceId);
  const typeTier = coastalDocksTierFromTypeId(slot.typeId);
  const accountTier = Math.max(0, state.coastalDocksTier | 0);
  const effectiveTier = Math.max(typeTier, accountTier, cfg.campTier | 0);

  if (effectiveTier >= 1) {
    cfg.complete = true;
    cfg.logs = COASTAL_DOCKS_LOGS_BUILD;
    cfg.campTier = effectiveTier;
    if (state.coastalDocksUnlocked) cfg.freePlaced = true;
    if (typeTier !== effectiveTier) slot.typeId = coastalDocksTypeIdForTier(effectiveTier);
    syncCoastalDocksAccountTier(effectiveTier);
    return effectiveTier;
  }

  return cfg.complete || cfg.freePlaced ? Math.max(1, cfg.campTier | 0) : 0;
}

function setActiveCoastalDocks(instanceId) {
  activeCoastalDocksInstanceId = instanceId || null;
}

function resolveCoastalDocksCell(el) {
  if (el?.classList?.contains('cell-coastal-docks')) return el;
  return el?.closest?.('.plot-cell.cell-coastal-docks') || null;
}

function resolveCoastalDocksInstanceId(eventOrCell) {
  const cell = eventOrCell?.classList ? eventOrCell : resolveCoastalDocksCell(eventOrCell?.target);
  return cell?.dataset?.instanceId || activeCoastalDocksInstanceId || null;
}

function forEachCoastalDocksSlot(fn) {
  if (typeof forEachPlotStructureSlot === 'function') forEachPlotStructureSlot('coastal_docks', fn);
}

function countCoastalDocksOnPlot() {
  let n = 0;
  forEachCoastalDocksSlot(() => { n++; });
  return n;
}

function getCoastalDocksAccountTier() {
  migrateCoastalDocks();
  return Math.max(0, state.coastalDocksTier | 0);
}

function getCoastalDocksTierFromSlot(slot, cfg) {
  if (!slot) return getCoastalDocksAccountTier();
  cfg = cfg || getCoastalDocksConfig(slot.instanceId);
  const typeTier = coastalDocksTierFromTypeId(slot.typeId);
  if (typeTier >= 1) {
    return Math.max(typeTier, cfg?.campTier | 0, getCoastalDocksAccountTier());
  }
  if (!cfg?.complete && !cfg?.freePlaced) return 0;
  return Math.max(typeTier, cfg?.campTier | 0, getCoastalDocksAccountTier());
}

function canUseCoastalDocksStructure() {
  return (Number(state.skills.architecture?.level) || 1) >= COASTAL_DOCKS_ARCH_UNLOCK;
}

function isCoastalDocksUnlocked() {
  migrateCoastalDocks();
  return !!state.coastalDocksUnlocked;
}

function canPlaceCoastalDocks() {
  migrateCoastalDocks();
  if (!canUseCoastalDocksStructure()) return false;
  if (typeof isPlotFeatureUnlockedByTile === 'function' && !isPlotFeatureUnlockedByTile('coastal_docks')) return false;
  if (state.coastalDocksUnlocked) return true;
  return countCoastalDocksOnPlot() === 0;
}

function coastalDocksSlotExists(instanceId) {
  let found = false;
  forEachCoastalDocksSlot((x, y, slot) => {
    if (slot.instanceId === instanceId) found = true;
  });
  return found;
}

function applyCoastalDocksTierOnSlot(slot, tier) {
  if (!slot) return;
  const t = Math.max(1, tier | 0);
  slot.typeId = coastalDocksTypeIdForTier(t);
  const cfg = getCoastalDocksConfig(slot.instanceId);
  cfg.campTier = t;
  cfg.complete = true;
  cfg.logs = COASTAL_DOCKS_LOGS_BUILD;
  cfg.freePlaced = cfg.freePlaced || !!state.coastalDocksUnlocked;
  syncCoastalDocksAccountTier(t);
  scheduleSaveGame();
}

function syncCoastalDocksAccountTier(tier) {
  const t = Math.max(state.coastalDocksTier | 0, tier | 0);
  state.coastalDocksTier = t;
  state.coastalDocksUnlocked = t >= 1;
}

function unlockCoastalDocksBuilt() {
  syncCoastalDocksAccountTier(Math.max(1, state.coastalDocksTier | 0));
  scheduleSaveGame();
}

function ensureCoastalDocksFeatureTilePlaced() {
  if (typeof PLOT_FEATURE_TILE_UNLOCKS === 'undefined' || typeof isPlotTileUnlocked !== 'function') return;
  if (countCoastalDocksOnPlot() > 0) return;
  for (const feat of PLOT_FEATURE_TILE_UNLOCKS) {
    if (feat.typeId !== 'coastal_docks') continue;
    if (!isPlotTileUnlocked(feat.x, feat.y)) continue;
    if (typeof getPlotCell === 'function' && getPlotCell(feat.x, feat.y)) continue;
    if (typeof placePlotDefaultTile === 'function') placePlotDefaultTile(feat.x, feat.y);
    return;
  }
}

function migrateCoastalDocks() {
  if (state.coastalDocksUnlocked == null) state.coastalDocksUnlocked = false;
  if (state.coastalDocksTier == null) state.coastalDocksTier = state.coastalDocksUnlocked ? 1 : 0;
  ensureCoastalDocksFeatureTilePlaced();
  forEachCoastalDocksSlot((x, y, slot) => {
    repairCoastalDocksSlotState(slot);
  });
}

function getCoastalDocksExpeditionTier(slot){
  if(!slot?.instanceId) return 0;
  repairCoastalDocksSlotState(slot);
  const cfg=getCoastalDocksConfig(slot.instanceId);
  if(!isCoastalDocksComplete(cfg)&&!cfg?.freePlaced) return 0;
  return getCoastalDocksTierFromSlot(slot, cfg);
}

function getAdjacentCoastalDocksTierForShallows(shallowsInstanceId) {
  migrateCoastalDocks();
  if(typeof getAdjacentPlotCampTier==='function'){
    return getAdjacentPlotCampTier(shallowsInstanceId, 'coastal_docks', getCoastalDocksExpeditionTier);
  }
  return 0;
}

function completeCoastalDocksBuild(instanceId) {
  instanceId = instanceId || activeCoastalDocksInstanceId;
  const cfg = getCoastalDocksConfig(instanceId);
  const slot = findPlotCoordForInstanceId(instanceId)?.slot;
  if (!cfg || !slot) return;
  cfg.logs = COASTAL_DOCKS_LOGS_BUILD;
  cfg.complete = true;
  cfg.campTier = 1;
  applyCoastalDocksTierOnSlot(slot, 1);
  const showBanner = !state.coastalDocksUnlocked;
  unlockCoastalDocksBuilt();
  const refresh = () => {
    if (typeof updateCoastalDocksCells === 'function') updateCoastalDocksCells();
    if (currentScreen === 'coastal-docks-screen') renderCoastalDocksScreen();
    if(typeof renderExploring==='function') renderExploring();
    syncUI();
  };
  if (showBanner) {
    showStructureBuiltBanner({
      bonusKey: 'coastal_docks',
      title: 'DOCKS RAISED!',
      icon: '⚓',
      body: COASTAL_DOCKS_TIER_LABELS[1],
      btnText: 'GOT IT',
      cb: refresh,
    });
  } else {
    refresh();
  }
}

function donateCoastalDocksLogs(event, instanceId) {
  instanceId = instanceId || activeCoastalDocksInstanceId;
  const cfg = getCoastalDocksConfig(instanceId);
  if (!cfg || cfg.complete || cfg.freePlaced) return false;
  const need = COASTAL_DOCKS_LOGS_BUILD - (cfg.logs | 0);
  if (need < 1) {
    completeCoastalDocksBuild(instanceId);
    return false;
  }
  const consumed = consumeUpToFromBagOrStore('logs', need);
  if (consumed < 1) {
    showToast('Need logs to raise the camp frame.');
    return false;
  }
  cfg.logs = (cfg.logs | 0) + consumed;
  grantXP('architecture', structureArchXpForMaterial('logs') * consumed, null);
  if (isCoastalDocksComplete(cfg)) completeCoastalDocksBuild(instanceId);
  else {
    if (typeof updateCoastalDocksCells === 'function') updateCoastalDocksCells();
    if (currentScreen === 'coastal-docks-screen') renderCoastalDocksScreen();
    syncUI();
  }
  return true;
}

function coastalDocksUpgradeMaterialsMet(tier) {
  return getCoastalDocksUpgradeCost(tier).every((m) => itemCountBagAndStore(m.key) >= (m.qty | 0));
}

function upgradeCoastalDocksTier() {
  const instanceId = activeCoastalDocksInstanceId;
  const slot = findPlotCoordForInstanceId(instanceId)?.slot;
  if (!slot) {
    showToast('Build the camp first.');
    return;
  }
  repairCoastalDocksSlotState(slot);
  const cfg = getCoastalDocksConfig(instanceId);
  const currentTier = getCoastalDocksTierFromSlot(slot, cfg);
  if (currentTier < 1) {
    showToast('Donate logs to build Tier 1 before upgrading.');
    return;
  }
  const next = Math.min(3, currentTier + 1);
  if (next <= currentTier || next > 3) return;
  const costs = getCoastalDocksUpgradeCost(next);
  if (!costs.length) return;
  if (!coastalDocksUpgradeMaterialsMet(next)) {
    showToast('Need materials for this upgrade.');
    return;
  }
  for (const m of costs) {
    if (!consumeManyFromBagOrStore(m.key, m.qty)) {
      showToast('Missing ' + (m.name || m.key) + '.');
      return;
    }
  }
  applyCoastalDocksTierOnSlot(slot, next);
  syncCoastalDocksAccountTier(next);
  forEachCoastalDocksSlot((x, y, s) => {
    if (s.instanceId !== slot.instanceId && getCoastalDocksTierFromSlot(s) < next) {
      applyCoastalDocksTierOnSlot(s, next);
    }
  });
  scheduleSaveGame();
  showToast('⚓ ' + COASTAL_DOCKS_DISPLAY_NAME + ' — ' + COASTAL_DOCKS_TIER_LABELS[next]);
  if (typeof updateCoastalDocksCells === 'function') updateCoastalDocksCells();
  renderCoastalDocksScreen();
  if(typeof renderExploring==='function') renderExploring();
  syncUI();
}

function CoastalDocksMenuTap(event) {
  event?.stopPropagation();
  const instanceId = resolveCoastalDocksInstanceId(event);
  if (instanceId) setActiveCoastalDocks(instanceId);
  openCoastalDocksScreen();
}

function openCoastalDocksScreen() {
  migrateCoastalDocks();
  const instanceId = activeCoastalDocksInstanceId;
  if (!instanceId || !coastalDocksSlotExists(instanceId)) {
    showToast('Mark out a Coastal Docks site on your plot first.');
    return;
  }
  showScreen('coastal-docks-screen');
  lastHome = 'exterior-screen';
  renderCoastalDocksScreen();
}

function closeCoastalDocksScreen() {
  showScreen('exterior-screen');
  lastHome = 'exterior-screen';
  syncUI();
}

function renderCoastalDocksScreen() {
  migrateCoastalDocks();
  updateActivitySkillPill('coastal-docks', 'architecture');
  const instanceId = activeCoastalDocksInstanceId;
  const cfg = getCoastalDocksConfig(instanceId);
  const coord = findPlotCoordForInstanceId(instanceId);
  const slot = coord?.slot;
  if (slot) repairCoastalDocksSlotState(slot);
  const tier = getCoastalDocksTierFromSlot(slot, cfg);
  const titleEl = document.querySelector('#coastal-docks-screen .wb-item-name');
  const topTitleEl = document.querySelector('#coastal-docks-screen .top-bar-title');
  const subEl = document.getElementById('coastal-docks-subtitle');
  const progressEl = document.getElementById('coastal-docks-progress');
  const upgradeEl = document.getElementById('coastal-docks-upgrade-section');
  const statusEl = document.getElementById('coastal-docks-status');
  const buildEl = document.getElementById('coastal-docks-build-section');
  const activityEl = document.getElementById('coastal-docks-activity-section');

  if (titleEl) {
    titleEl.textContent = tier > 0
      ? COASTAL_DOCKS_DISPLAY_NAME + ' (' + coastalDocksDisplayTierName(tier) + ')'
      : COASTAL_DOCKS_DISPLAY_NAME;
  }
  if (topTitleEl) {
    topTitleEl.textContent = tier > 0
      ? COASTAL_DOCKS_DISPLAY_NAME + ' · ' + coastalDocksDisplayTierName(tier)
      : COASTAL_DOCKS_DISPLAY_NAME;
  }
  if (subEl) subEl.textContent = tier > 0 ? COASTAL_DOCKS_TIER_LABELS[tier] : 'Raise the camp with logs (Tier 1)';
  if (progressEl) {
    progressEl.textContent = tier > 0
      ? coastalDocksDisplayTierName(tier) + ' / Tier 3'
      : (cfg?.logs | 0) + ' / ' + COASTAL_DOCKS_LOGS_BUILD + ' logs';
  }
  if (buildEl) buildEl.hidden = tier > 0;
  if (activityEl) activityEl.hidden = tier < 1;

  if (upgradeEl) {
    if (tier < 1 || tier >= 3) {
      upgradeEl.innerHTML = '';
    } else {
      const next = tier + 1;
      const costs = getCoastalDocksUpgradeCost(next);
      const met = coastalDocksUpgradeMaterialsMet(next);
      const costLine = costs.map((m) => m.qty + ' ' + m.name).join(' · ');
      upgradeEl.innerHTML = '<div class="store-items">'
        + '<div class="store-items-title">UPGRADE TO ' + coastalDocksDisplayTierName(next).toUpperCase() + '</div>'
        + '<div class="store-line" style="font-size:12px;margin-bottom:8px">' + COASTAL_DOCKS_TIER_LABELS[next] + '</div>'
        + '<div class="store-line" style="font-size:11px;color:var(--ui-text-dim);margin-bottom:8px">' + costLine + '</div>'
        + '<div class="wb-use-box"><div class="wb-use-btns">'
        + '<button class="wb-btn once" ' + (met ? '' : 'disabled') + ' onclick="upgradeCoastalDocksTier()">UPGRADE DOCKS</button>'
        + '</div></div></div>';
    }
  }

  if (statusEl) {
    if (tier < 1) statusEl.textContent = 'Donate logs to raise the camp to Tier 1.';
    else if (tier >= 3) statusEl.textContent = 'Tier 3 camp ready — launch any trek at the adjacent Sunken Shallows.';
    else statusEl.textContent = '';
  }

  const btnEl = document.getElementById('coastal-docks-buttons');
  if (btnEl && tier < 1) {
    btnEl.innerHTML = '<div class="wb-use-box"><div class="wb-use-btns">'
      + '<button class="wb-btn once" onclick="donateCoastalDocksLogs()">DONATE LOGS</button>'
      + '</div></div>';
  } else if (btnEl) {
    btnEl.innerHTML = '';
  }
}

function buildCoastalDocksCellHtml(slot, def, editMode) {
  migrateCoastalDocks();
  repairCoastalDocksSlotState(slot);
  const cfg = getCoastalDocksConfig(slot.instanceId);
  const tier = getCoastalDocksTierFromSlot(slot, cfg);
  const label = tier >= 1
    ? (COASTAL_DOCKS_DISPLAY_NAME + ' (' + coastalDocksDisplayTierName(tier) + ')')
    : ('Building ' + (cfg?.logs | 0) + '/' + COASTAL_DOCKS_LOGS_BUILD);
  return '<div class="plot-activity-top coastal-docks-activity-top">'
    + '<div class="coastal-docks-sprite">'
    + '<span class="coastal-docks-icon">' + (def?.icon || '⚓') + '</span>'
    + '<span class="coastal-docks-label">' + label + '</span></div></div>'
    + '<div class="plot-activity-menu-zone">'
    + '<button type="button" class="plot-menu-btn">menu</button>'
    + '</div>';
}

function handleCoastalDocksCellTap(e, cell, slot) {
  if (plotSuppressClick || state.plot?.editMode) return;
  if (e?.target?.closest?.('.plot-menu-btn')) {
    e.stopPropagation();
    setActiveCoastalDocks(slot.instanceId);
    openCoastalDocksScreen();
    return;
  }
  setActiveCoastalDocks(slot.instanceId);
  openCoastalDocksScreen();
}

function updateCoastalDocksCells() {
  migrateCoastalDocks();
  document.querySelectorAll('.plot-cell.cell-coastal-docks').forEach((cell) => {
    const instanceId = cell.dataset.instanceId;
    if (!instanceId) return;
    const coord = findPlotCoordForInstanceId(instanceId);
    const slot = coord?.slot;
    if (!slot) return;
    repairCoastalDocksSlotState(slot);
    const cfg = getCoastalDocksConfig(instanceId);
    const tier = getCoastalDocksTierFromSlot(slot, cfg);
    const def = getPlotTileDef(slot.typeId);
    const label = tier >= 1
      ? (COASTAL_DOCKS_DISPLAY_NAME + ' (' + coastalDocksDisplayTierName(tier) + ')')
      : ('Building ' + (cfg?.logs | 0) + '/' + COASTAL_DOCKS_LOGS_BUILD);
    if (cell.dataset.typeId !== slot.typeId) cell.dataset.typeId = slot.typeId;
    const icon = cell.querySelector('.coastal-docks-icon');
    const labelEl = cell.querySelector('.coastal-docks-label');
    if (icon) icon.textContent = def?.icon || '⚓';
    if (labelEl) labelEl.textContent = label;
  });
  if (typeof renderPlotGrid === 'function') renderPlotGrid();
}
