/* Hearthstead — sync ui */
'use strict';

/* ═══════════════════════════════════════
   SYNC UI (dirty-tracked)
═══════════════════════════════════════ */
const UI_DIRTY_KEYS = new Set([
  'inventory', 'gold', 'equip', 'activity', 'plot', 'skills', 'screen', 'meta',
]);

const UI_DIRTY_STANDARD = ['inventory', 'gold', 'equip', 'activity', 'plot', 'meta'];

let uiDirty = new Set();

function markDirty(...keys) {
  keys.forEach((k) => {
    if (k === 'all') {
      UI_DIRTY_KEYS.forEach((d) => uiDirty.add(d));
      return;
    }
    if (UI_DIRTY_KEYS.has(k)) uiDirty.add(k);
  });
}

function clearDirty() {
  uiDirty.clear();
}

function flushMetaDirty() {
  if (state._skipStoreRoomMigrateOnce) {
    delete state._skipStoreRoomMigrateOnce;
  }
  if (state._storeRoomsReclaimed) {
    const n = state._storeRoomsReclaimed;
    delete state._storeRoomsReclaimed;
    if (currentScreen === 'interior-screen' && !state._skipStoreRoomReclaimRender) renderInteriorGrid();
    delete state._skipStoreRoomReclaimRender;
    setTimeout(
      () => showToast('🗄️ ' + n + ' missing store room' + (n === 1 ? ' was' : 's were') + ' restored to your map.'),
      300
    );
  }
  if (state._storeRoomsOrphansRemoved) {
    const n = state._storeRoomsOrphansRemoved;
    delete state._storeRoomsOrphansRemoved;
    setTimeout(
      () =>
        showToast(
          '🗄️ ' + n + ' store room' + (n === 1 ? '' : 's') + ' had no space on the map — ghost capacity removed.'
        ),
      600
    );
  }
  updateSaveButtonUI();
  ensureSkillsScreenReady();
  ensurePlotRenderComplete();
}

function flushGoldDirty() {
  const goldIds =
    typeof getScreenGoldElementIds === 'function'
      ? getScreenGoldElementIds()
      : ['gold-ext', 'gold-int'];
  goldIds.forEach((id) => {
    const e = document.getElementById(id);
    if (e) e.textContent = state.gold;
  });
  document.querySelectorAll('.stat-pill-gold').forEach((el) => el.classList.toggle('visible', state.gold > 0));
}

function flushEquipDirty() {
  const eqLabel = state.equipped?.icon || state.equippedBag?.icon || '—';
  const equipIds =
    typeof getScreenEquipStatIds === 'function'
      ? getScreenEquipStatIds()
      : ['equip-val-int', 'equip-val-wb'];
  equipIds.forEach((id) => {
    const e = document.getElementById(id);
    if (e) e.textContent = eqLabel;
  });
}

function flushActivityDirty() {
  reconcileActivityState();
  document.querySelectorAll('.int-cell[data-int-key="fireplace"]').forEach((el) =>
    el.classList.toggle('fireplace-cooking', cook.running)
  );
  document.querySelectorAll('.int-cell[data-int-key="spinningwheel"]').forEach((el) =>
    el.classList.toggle('spinning-wheel-active', spin.running)
  );
  document.querySelectorAll('.int-cell[data-int-key="apothecary_table"]').forEach((el) =>
    el.classList.toggle('apothecary-processing', apothProcess.running)
  );
  document.querySelectorAll('.int-cell[data-int-key="wonky_loom"]').forEach((el) =>
    el.classList.toggle('wonky-loom-weaving', loomProcess.running)
  );
  updateActivitySkillDisplays();
}

function flushPlotDirty() {
  updatePondCell();
  updateGatherCells();
  updateQuarryCells();
  updateFireplaceCell();
  if (typeof updateAllPlotStructureCells === 'function') updateAllPlotStructureCells();
  updateSpinningWheelCell();
  if (typeof updateApothecaryCellQuickAction === 'function') updateApothecaryCellQuickAction();
  if (typeof updateLoomCellQuickAction === 'function') updateLoomCellQuickAction();
  updateDogbedCell();
}

function updateExteriorExplorationPill(){
  const pill=document.getElementById('ext-explore-skill-pill');
  if(!pill||currentScreen!=='exterior-screen') return;
  if(typeof updateActivitySkillPill==='function') updateActivitySkillPill('ext-explore','exploration');
  pill.classList.toggle('explore-pill-flash', skillFlashKey==='exploration');
}

function flushSkillsDirty() {
  Object.keys(state.skills).forEach((key) => {
    const s = state.skills[key];
    const pct = Math.min((s.xp / s.xpToNext) * 100, 100);
    const bar = document.getElementById('sk-bar-' + key);
    const lvl = document.getElementById('sk-lvl-' + key);
    const txt = document.getElementById('sk-txt-' + key);
    if (bar) bar.style.width = pct + '%';
    if (lvl) lvl.textContent = 'Lvl ' + s.level;
    if (txt) txt.textContent = s.xp + ' / ' + s.xpToNext + ' xp';
  });
  updateExteriorExplorationPill();
}

function flushScreenDirty() {
  if (typeof flushCurrentScreenIfRegistered === 'function') flushCurrentScreenIfRegistered();
}

function flushDirty() {
  if (!uiDirty.size) return;

  const want = uiDirty;
  uiDirty = new Set();

  if (want.has('meta')) flushMetaDirty();
  if (want.has('inventory')) syncInventoryUI();
  if (want.has('gold')) flushGoldDirty();
  if (want.has('equip')) flushEquipDirty();
  if (want.has('activity')) flushActivityDirty();
  else if (want.has('plot') || want.has('screen')) reconcileActivityState();
  if (want.has('plot')) flushPlotDirty();
  if (want.has('skills')) flushSkillsDirty();
  if (want.has('screen')) flushScreenDirty();
}

function syncUIFull() {
  markDirty('all');
  flushDirty();
}

/**
 * Refresh UI for dirty regions. Does not schedule a save (use requestSaveGame).
 * @param {boolean|'full'|string[]|Record<string,boolean>} [opts] — true/'full' = everything; array = dirty keys
 */
function syncUI(opts) {
  if (opts === true || opts === 'full' || opts?.full) {
    markDirty('all');
  } else if (Array.isArray(opts)) {
    markDirty(...opts);
  } else if (opts && typeof opts === 'object') {
    Object.keys(opts).forEach((k) => {
      if (opts[k]) markDirty(k);
    });
  } else {
    markDirty(...UI_DIRTY_STANDARD);
    if (
      typeof getScreensWithFlushHook === 'function' &&
      getScreensWithFlushHook().includes(currentScreen)
    ) {
      markDirty('screen');
    }
  }
  flushDirty();
}

function ensureSkillsScreenReady(){
  const body=document.getElementById('skills-body');
  if(!body||body.querySelector('.skill-row')) return;
  if(typeof fillMissingSkillKeys!=='function'||typeof renderSkillsBody!=='function') return;
  try{
    fillMissingSkillKeys();
    renderSkillsBody();
  }catch(err){
    console.error('[Hearthstead] Skills screen init failed:', err);
  }
}

function ensurePlotRenderComplete(){
  if(typeof plotHasOccupiedCells!=='function'||typeof renderPlotGrid!=='function') return;
  if(!plotHasOccupiedCells()) return;
  if(typeof plotRendering!=='undefined'&&plotRendering){
    requestAnimationFrame(ensurePlotRenderComplete);
    return;
  }
  const rendered=document.querySelectorAll('#plot-grid .plot-cell.cell-placed').length;
  const occupied=Object.values(state.plot?.cells||{}).filter(Boolean).length;
  if(occupied>0&&rendered<occupied){
    plotNeedsHomeCenter=true;
    renderPlotGrid();
  }
}

function updateActivitySkillDisplays(){
  const skillKey=getActiveActivitySkillKey();
  const screenResolver=typeof getScreenSkillResolver==='function'?getScreenSkillResolver(currentScreen):null;
  const screenPrefix=typeof getScreenSkillPrefix==='function'?getScreenSkillPrefix(currentScreen):null;
  if(screenResolver&&screenPrefix&&typeof updateActivitySkillPill==='function'){
    updateActivitySkillPill(screenPrefix, screenResolver());
  }

  const extPill=document.getElementById('ext-skill-pill');
  const intPill=document.getElementById('int-skill-pill');

  if(skillFlashKey){
    if(currentScreen==='interior-screen'&&intPill){
      setContextSkillPillVisible(intPill, true);
      updateActivitySkillPill('int', skillFlashKey);
      setContextSkillPillVisible(extPill, false);
      return;
    }
    if(currentScreen==='exterior-screen'&&extPill){
      setContextSkillPillVisible(extPill, true);
      updateActivitySkillPill('ext', skillFlashKey);
      setContextSkillPillVisible(intPill, false);
      return;
    }
  }

  const showExt=currentScreen==='exterior-screen'&&(
    fish.releasing||
    (!!skillKey&&activity.type&&typeof isActivityRunning==='function'&&isActivityRunning(activity.type))
  );
  const showInt=currentScreen==='interior-screen'&&!!skillKey&&(
    activity.type&&typeof isActivityRunning==='function'&&isActivityRunning(activity.type)
  );
  setContextSkillPillVisible(extPill, showExt);
  if(showExt) updateActivitySkillPill('ext', fish.releasing?'water':skillKey);
  setContextSkillPillVisible(intPill, showInt);
  if(showInt) updateActivitySkillPill('int', skillKey);
  updateExteriorExplorationPill();
}

function updateInvCountPills(){
  const used=invTotal();
  const cap=getInvCap();
  const invIds=
    typeof getScreenInvCountElementIds==='function'
      ? getScreenInvCountElementIds()
      : ['inv-count-ext', 'inv-count-int'];
  invIds.forEach(id=>{
    const e=document.getElementById(id);
    if(e) e.textContent=used;
  });
  document.querySelectorAll('.inv-cap-display').forEach(el=>{ el.textContent=cap; });
}

function syncInventoryUI(){
  updateInvCountPills();
  if(openPanel==='inv'){
    const stamp=getInvPanelRenderStamp();
    if(stamp!==invPanelRenderStamp) renderInvPanel();
  }
}
