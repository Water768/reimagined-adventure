/* Hearthstead — large barn interior grid */
'use strict';

let activeBarnInteriorInstanceId = null;
let barnInteriorEditMode = false;
let barnIntDrag = null;
let barnIntDragGhost = null;
let barnIntSuppressClick = false;

function barnInteriorCoordKey(x, y) {
  return x + ',' + y;
}

function parseBarnInteriorCoordKey(key) {
  const p = key.split(',');
  return { x: Number(p[0]), y: Number(p[1]) };
}

function ensureBarnInterior(cfg) {
  if (!cfg || !isLargeBarn(cfg)) {
    if (cfg) cfg.barnInterior = null;
    return null;
  }
  if (!cfg.barnInterior) {
    const cells = {};
    BARN_INTERIOR_DEFAULT_LAYOUT.forEach((slotType, i) => {
      const x = i % BARN_INTERIOR_COLS;
      const y = Math.floor(i / BARN_INTERIOR_COLS);
      cells[barnInteriorCoordKey(x, y)] = slotType;
    });
    cfg.barnInterior = {
      cells,
      customPlacements: {},
      penAssignments: {},
      penAnimalTypes: [null, null, null, null],
    };
  }
  const bi = cfg.barnInterior;
  if (!bi.cells) bi.cells = {};
  if (!bi.customPlacements) bi.customPlacements = {};
  if (!bi.penAssignments) bi.penAssignments = {};
  if (!bi.penAnimalTypes) bi.penAnimalTypes = [null, null, null, null];
  migrateBarnInteriorLayout(bi);
  recoverOrphanedBarnInteriorItems(bi);
  pruneBarnInteriorCellData(bi);
  ensureBarnInteriorPenAssignments(bi);
  syncBarnInteriorPenAnimals(cfg);
  return bi;
}

/** Fix furniture saved on pen tile keys from an older buggy drag (e.g. lost butter churn). */
function recoverOrphanedBarnInteriorItems(bi) {
  const orphans = Object.keys(bi.customPlacements || {}).filter((key) => bi.cells[key] !== 'place');
  orphans.forEach((key) => {
    const item = bi.customPlacements[key];
    delete bi.customPlacements[key];
    const target = barnInteriorCellKeysOfType(bi.cells, 'place').find((k) => !bi.customPlacements[k]);
    if (target) bi.customPlacements[target] = item;
  });
}

function barnInteriorCellKeysOfType(cells, type) {
  return Object.entries(cells)
    .filter(([, t]) => t === type)
    .map(([k]) => k)
    .sort((a, b) => {
      const pa = parseBarnInteriorCoordKey(a);
      const pb = parseBarnInteriorCoordKey(b);
      return pa.y - pb.y || pa.x - pb.x;
    });
}

function migrateBarnInteriorLayout(bi) {
  if (!bi?.cells) return;
  const placeCount = Object.values(bi.cells).filter((t) => t === 'place').length;
  const penCount = Object.values(bi.cells).filter((t) => t === 'pen').length;
  if (placeCount >= BARN_INTERIOR_PLACE_SLOT_COUNT && penCount >= BARN_INTERIOR_PEN_COUNT) return;

  const savedPlacements = { ...(bi.customPlacements || {}) };
  const savedPenAssign = { ...(bi.penAssignments || {}) };
  const cells = {};
  BARN_INTERIOR_DEFAULT_LAYOUT.forEach((slotType, i) => {
    const x = i % BARN_INTERIOR_COLS;
    const y = Math.floor(i / BARN_INTERIOR_COLS);
    cells[barnInteriorCoordKey(x, y)] = slotType;
  });
  bi.cells = cells;
  bi.customPlacements = {};
  const placeKeys = barnInteriorCellKeysOfType(cells, 'place');
  const oldPlaceKeys = Object.keys(savedPlacements).sort((a, b) => {
    const pa = parseBarnInteriorCoordKey(a);
    const pb = parseBarnInteriorCoordKey(b);
    return pa.y - pb.y || pa.x - pb.x;
  });
  oldPlaceKeys.forEach((k, i) => {
    if (placeKeys[i]) bi.customPlacements[placeKeys[i]] = savedPlacements[k];
  });
  bi.penAssignments = {};
  const penKeys = barnInteriorCellKeysOfType(cells, 'pen');
  penKeys.forEach((key, defaultIdx) => {
    const prev = savedPenAssign[key];
    bi.penAssignments[key] = typeof prev === 'number' ? prev : defaultIdx;
  });
  normalizeBarnInteriorPenAssignments(bi);
}

function ensureBarnInteriorPenAssignments(bi) {
  if (!bi.penAssignments) bi.penAssignments = {};
  const penKeys = barnInteriorCellKeysOfType(bi.cells, 'pen');
  penKeys.forEach((key, i) => {
    if (bi.penAssignments[key] == null) bi.penAssignments[key] = i;
  });
  normalizeBarnInteriorPenAssignments(bi);
}

function normalizeBarnInteriorPenAssignments(bi) {
  const penKeys = barnInteriorCellKeysOfType(bi.cells, 'pen');
  const used = new Set();
  penKeys.forEach((key, i) => {
    let slot = bi.penAssignments[key];
    if (typeof slot !== 'number' || slot < 0 || slot >= BARN_INTERIOR_PEN_COUNT || used.has(slot)) {
      slot = [0, 1, 2, 3].find((n) => !used.has(n)) ?? i;
    }
    bi.penAssignments[key] = slot;
    used.add(slot);
  });
}

/** Mirror the four barn animal slots (livestock), not companion pets. */
function syncBarnInteriorPenAnimals(cfg) {
  const bi = cfg?.barnInterior;
  if (!bi || !cfg) return;
  if (typeof ensureBarnAnimalSlots === 'function') ensureBarnAnimalSlots(cfg);
  if (!bi.penAnimalTypes) bi.penAnimalTypes = [null, null, null, null];
  for (let i = 0; i < BARN_INTERIOR_PEN_COUNT; i++) {
    bi.penAnimalTypes[i] = cfg.animalSlots?.[i]?.type || null;
  }
}

function getBarnInteriorBi() {
  const cfg = getBarnConfig(activeBarnInteriorInstanceId);
  return ensureBarnInterior(cfg);
}

function barnInteriorCellType(x, y, bi) {
  bi = bi || getBarnInteriorBi();
  return bi?.cells[barnInteriorCoordKey(x, y)] || 'empty';
}

function barnInteriorPenSlotIndexAt(x, y, bi) {
  const key = barnInteriorCoordKey(x, y);
  if (bi?.cells[key] !== 'pen') return -1;
  const slot = bi.penAssignments?.[key];
  return typeof slot === 'number' ? slot : -1;
}

function barnInteriorIsSwappableCellType(type) {
  return type === 'pen' || type === 'place';
}

function barnInteriorCanDragFrom(x, y) {
  const bi = getBarnInteriorBi();
  if (!bi || !barnInteriorEditMode) return false;
  return barnInteriorIsSwappableCellType(barnInteriorCellType(x, y, bi));
}

function barnInteriorCanDropOn(fromX, fromY, toX, toY) {
  const bi = getBarnInteriorBi();
  if (!bi) return false;
  if (fromX === toX && fromY === toY) return false;
  const fromType = bi.cells[barnInteriorCoordKey(fromX, fromY)];
  const toType = bi.cells[barnInteriorCoordKey(toX, toY)];
  return barnInteriorIsSwappableCellType(fromType) && barnInteriorIsSwappableCellType(toType);
}

function barnInteriorIsEmptyPlaceSlot(x, y, bi) {
  bi = bi || getBarnInteriorBi();
  const key = barnInteriorCoordKey(x, y);
  return bi?.cells[key] === 'place' && !bi.customPlacements[key];
}

/** Snapshot pen or place content at a grid cell (used for drag + drop). */
function captureBarnInteriorCellPayload(bi, x, y) {
  const key = barnInteriorCoordKey(x, y);
  const type = bi.cells[key];
  if (type === 'pen') {
    ensureBarnInteriorPenAssignments(bi);
    return { kind: 'pen', penSlot: bi.penAssignments[key] };
  }
  if (type === 'place') {
    return { kind: 'place', item: bi.customPlacements[key] || null };
  }
  return null;
}

function pruneBarnInteriorCellData(bi) {
  Object.keys(bi.penAssignments || {}).forEach((key) => {
    if (bi.cells[key] !== 'pen') delete bi.penAssignments[key];
  });
  Object.keys(bi.customPlacements || {}).forEach((key) => {
    if (bi.cells[key] !== 'place') delete bi.customPlacements[key];
  });
}

function applyBarnInteriorCellPayload(bi, key, payload) {
  delete bi.penAssignments[key];
  delete bi.customPlacements[key];
  if (!payload) return;
  bi.cells[key] = payload.kind;
  if (payload.kind === 'pen') {
    bi.penAssignments[key] = payload.penSlot;
  } else if (payload.kind === 'place' && payload.item) {
    bi.customPlacements[key] = payload.item;
  }
}

function barnInteriorCustomPlacementsIncludeStorage(bi) {
  return Object.values(bi?.customPlacements || {}).some((key) => getBarnInteriorPlaceableDef(key)?.storageBonus);
}

function finishBarnInteriorLayoutEdit(bi) {
  pruneBarnInteriorCellData(bi);
  ensureBarnInteriorPenAssignments(bi);
  normalizeBarnInteriorPenAssignments(bi);
  scheduleSaveGame();
  renderBarnInteriorGrid();
  if (barnInteriorCustomPlacementsIncludeStorage(bi) && typeof renderBarnScreen === 'function') {
    renderBarnScreen();
  }
}

function applyBarnInteriorDrop(fromX, fromY, toX, toY) {
  const cfg = getBarnConfig(activeBarnInteriorInstanceId);
  const bi = ensureBarnInterior(cfg);
  if (!bi || !barnInteriorCanDropOn(fromX, fromY, toX, toY)) return false;
  const payloadFrom = barnIntDrag?.payload || captureBarnInteriorCellPayload(bi, fromX, fromY);
  const payloadTo = captureBarnInteriorCellPayload(bi, toX, toY);
  if (!payloadFrom || !payloadTo) return false;
  const k1 = barnInteriorCoordKey(fromX, fromY);
  const k2 = barnInteriorCoordKey(toX, toY);
  applyBarnInteriorCellPayload(bi, k1, payloadTo);
  applyBarnInteriorCellPayload(bi, k2, payloadFrom);
  finishBarnInteriorLayoutEdit(bi);
  return true;
}

function renderBarnInteriorDragGhostHtml(payload, cfg) {
  if (!payload || !cfg) return '<span>📦</span>';
  const bi = cfg.barnInterior;
  if (payload.kind === 'pen') {
    const animalKey = bi?.penAnimalTypes?.[payload.penSlot] || cfg.animalSlots?.[payload.penSlot]?.type;
    return renderBarnInteriorPenCell(payload.penSlot, animalKey);
  }
  if (payload.kind === 'place') {
    if (payload.item) {
      const def = getBarnInteriorPlaceableDef(payload.item);
      return '<div class="barn-int-place filled">'
        + '<span class="barn-int-place-icon">' + (def?.icon || '📦') + '</span>'
        + '<span class="barn-int-place-label">' + (def?.name || payload.item) + '</span>'
        + '</div>';
    }
    return '<div class="barn-int-place-empty barn-int-drag-ghost-empty">'
      + '<span class="barn-int-place-add-icon">＋</span>'
      + '</div>';
  }
  return '<span>📦</span>';
}

function renderBarnInteriorPenCell(penIndex, animalKey) {
  const def = animalKey && typeof getBarnAnimalDef === 'function' ? getBarnAnimalDef(animalKey) : null;
  if (def) {
    const slotHint = barnInteriorEditMode && penIndex >= 0
      ? (' · slot ' + (penIndex + 1))
      : '';
    return '<div class="barn-int-pen filled">'
      + '<span class="barn-int-pen-icon">' + (def.icon || '🐾') + '</span>'
      + '<span class="barn-int-pen-label">' + (def.name || animalKey) + slotHint + '</span>'
      + '</div>';
  }
  const slotHint = barnInteriorEditMode && penIndex >= 0
    ? (' · slot ' + (penIndex + 1))
    : '';
  return '<div class="barn-int-pen empty">'
    + '<span class="barn-int-pen-icon">🌾</span>'
    + '<span class="barn-int-pen-label">empty pen' + slotHint + '</span>'
    + '</div>';
}

function renderBarnInteriorPlaceCell(x, y, bi) {
  const key = barnInteriorCoordKey(x, y);
  const placed = bi.customPlacements[key];
  if (placed) {
    const def = getBarnInteriorPlaceableDef(placed);
    const removeBtn = barnInteriorEditMode
      ? ('<button type="button" class="barn-int-remove" onclick="event.stopPropagation();clearBarnInteriorPlace(' + x + ',' + y + ')">✕</button>')
      : '';
    return '<div class="barn-int-place filled">'
      + removeBtn
      + '<span class="barn-int-place-icon">' + (def?.icon || '📦') + '</span>'
      + '<span class="barn-int-place-label">' + (def?.name || placed) + '</span>'
      + '</div>';
  }
  if (barnInteriorEditMode) {
    return '<div class="barn-int-place-empty" role="button" tabindex="0" aria-label="Place item">'
      + '<span class="barn-int-place-add-icon">＋</span>'
      + '</div>';
  }
  return '<div class="barn-int-place-empty barn-int-place-empty--view"></div>';
}

function renderBarnInteriorCell(x, y, cfg) {
  const bi = ensureBarnInterior(cfg);
  const key = barnInteriorCoordKey(x, y);
  const type = bi?.cells[key] || 'empty';
  if (type === 'pen') {
    const penIndex = barnInteriorPenSlotIndexAt(x, y, bi);
    const animalKey = penIndex >= 0 ? (bi.penAnimalTypes?.[penIndex] || cfg.animalSlots?.[penIndex]?.type) : null;
    return renderBarnInteriorPenCell(penIndex, animalKey);
  }
  if (type === 'place') return renderBarnInteriorPlaceCell(x, y, bi);
  if (type === 'doorway') {
    return '<button type="button" class="barn-int-doorway" onclick="exitBarnInterior()">'
      + '<span>🚪</span><span>exit</span></button>';
  }
  return '<div class="barn-int-empty"></div>';
}

function renderBarnInteriorGrid() {
  const grid = document.getElementById('barn-interior-grid');
  if (!grid) return;
  const cfg = getBarnConfig(activeBarnInteriorInstanceId);
  if (!cfg) return;
  ensureBarnInterior(cfg);
  syncBarnInteriorPenAnimals(cfg);
  let html = '';
  for (let y = 0; y < BARN_INTERIOR_ROWS; y++) {
    for (let x = 0; x < BARN_INTERIOR_COLS; x++) {
      const type = barnInteriorCellType(x, y, cfg.barnInterior);
      const draggable = barnInteriorEditMode && barnInteriorCanDragFrom(x, y);
      const classes = ['barn-int-cell', 'barn-int-cell--' + type];
      if (type === 'place') classes.push('barn-int-cell--place-slot');
      if (barnInteriorEditMode && (type === 'pen' || type === 'place')) classes.push('barn-int-cell--editable');
      if (draggable) classes.push('barn-int-cell--draggable');
      html += '<div class="' + classes.join(' ') + '" data-barn-int-x="' + x + '" data-barn-int-y="' + y + '" data-barn-int-type="' + type + '">'
        + renderBarnInteriorCell(x, y, cfg)
        + '</div>';
    }
  }
  grid.innerHTML = html;
  grid.style.gridTemplateColumns = 'repeat(' + BARN_INTERIOR_COLS + ', 1fr)';
  document.getElementById('barn-interior-screen')?.classList.toggle('barn-interior-edit-mode', barnInteriorEditMode);
}

function syncBarnInteriorEditButtons() {
  const btn = document.getElementById('barn-interior-edit-btn');
  if (btn) btn.textContent = barnInteriorEditMode ? '✓ Done editing' : '✏️ Edit layout';
}

function toggleBarnInteriorEditMode() {
  barnInteriorEditMode = !barnInteriorEditMode;
  syncBarnInteriorEditButtons();
  const hint = document.getElementById('barn-interior-hint');
  if (hint) {
    hint.textContent = barnInteriorEditMode
      ? 'Drag any pen or ＋ tile to swap positions — animals and furniture move with their tile.'
      : 'Turn on edit layout to rearrange pens and barn items.';
  }
  if (!barnInteriorEditMode) {
    closeBarnInteriorPlaceMenu();
    unbindBarnIntDragDocumentListeners();
    barnIntDrag = null;
    endBarnIntDragGhost();
    clearBarnInteriorDropTargets();
  }
  renderBarnInteriorGrid();
  showToast(barnInteriorEditMode ? 'Edit mode — drag pens and ＋ tiles to swap animals and furniture.' : 'Layout saved.');
}

function closeBarnInteriorPlaceMenu() {
  document.getElementById('barn-int-place-menu')?.remove();
}

function openBarnInteriorPlaceMenu(x, y) {
  if (!barnInteriorEditMode) {
    showToast('Turn on edit layout first.');
    return;
  }
  const cfg = getBarnConfig(activeBarnInteriorInstanceId);
  const bi = ensureBarnInterior(cfg);
  if (!bi) return;
  const key = barnInteriorCoordKey(x, y);
  if (bi.cells[key] !== 'place' || bi.customPlacements[key]) return;
  closeBarnInteriorPlaceMenu();
  const w = document.getElementById('game-wrapper');
  if (!w) return;
  const m = document.createElement('div');
  m.id = 'barn-int-place-menu';
  m.className = 'plot-add-menu';
  m.onclick = (e) => e.stopPropagation();
  let options = '';
  BARN_INTERIOR_PLACEABLES.forEach((def) => {
    const owned = barnInteriorPlaceableOwned(def.key);
    const stockLine = barnInteriorPlaceableStockLabel(def.key);
    const unavail = owned ? '' : ' unavail';
    const onclick = owned
      ? (' onclick="placeBarnInteriorItem(' + x + ',' + y + ',\'' + def.key + '\');closeBarnInteriorPlaceMenu()"')
      : '';
    options += '<button type="button" class="plot-add-item' + unavail + '"' + onclick + '>'
      + '<span class="plot-add-item-icon">' + def.icon + '</span>'
      + '<span class="plot-add-item-name">' + def.name
      + '<span class="plot-add-item-drops">' + stockLine + ' — ' + def.desc + '</span></span></button>';
  });
  m.innerHTML = '<div class="plot-add-title">Place in barn</div>'
    + '<div class="plot-add-sub">Pick something for this slot (must be in bag or storage).</div>'
    + options
    + '<button type="button" class="plot-add-cancel" onclick="closeBarnInteriorPlaceMenu()">cancel</button>';
  w.appendChild(m);
}

function barnInteriorPlaceableOwned(key) {
  return itemCountBagAndStore(key) > 0;
}

function barnInteriorPlaceableStockLabel(key) {
  if (barnInteriorPlaceableOwned(key)) {
    const n = itemCountBagAndStore(key);
    return formatRecipeMatLine(getBarnInteriorPlaceableDef(key)?.name || key, 1, n);
  }
  return 'none in inventory or storage';
}

function placeBarnInteriorItem(x, y, placeableKey) {
  const cfg = getBarnConfig(activeBarnInteriorInstanceId);
  const bi = ensureBarnInterior(cfg);
  if (!bi) return;
  const def = getBarnInteriorPlaceableDef(placeableKey);
  if (!barnInteriorPlaceableOwned(placeableKey)) {
    showToast('None in inventory or storage.');
    return;
  }
  const key = barnInteriorCoordKey(x, y);
  if (bi.cells[key] !== 'place' || bi.customPlacements[key]) return;
  if (!consumeOneFromBagOrStore(placeableKey)) {
    showToast('Could not take ' + (def?.name || placeableKey) + '.');
    return;
  }
  bi.customPlacements[key] = placeableKey;
  scheduleSaveGame();
  renderBarnInteriorGrid();
  if (typeof syncUI === 'function') syncUI();
  if (def?.storageBonus && currentScreen === 'barn-screen' && typeof renderBarnScreen === 'function') {
    renderBarnScreen();
  }
  showToast((def?.icon || '📦') + ' Placed.');
}

function clearBarnInteriorPlace(x, y) {
  const cfg = getBarnConfig(activeBarnInteriorInstanceId);
  const bi = ensureBarnInterior(cfg);
  if (!bi) return;
  const cellKey = barnInteriorCoordKey(x, y);
  if (bi.cells[cellKey] !== 'place') return;
  const prev = bi.customPlacements[cellKey];
  if (!prev) return;
  delete bi.customPlacements[cellKey];
  const def = getBarnInteriorPlaceableDef(prev);
  const where = returnOneToBagOrStore(prev, def?.icon || '📦', def?.name || prev);
  scheduleSaveGame();
  renderBarnInteriorGrid();
  if (typeof syncUI === 'function') syncUI();
  if (def?.storageBonus && currentScreen === 'barn-screen' && typeof renderBarnScreen === 'function') {
    renderBarnScreen();
  }
  if (where === 'bag') showToast((def?.icon || '📦') + ' ' + (def?.name || prev) + ' picked up.');
  else if (where === 'store') showToast((def?.icon || '📦') + ' ' + (def?.name || prev) + ' returned to storage (bag full).');
  else if (where) showToast('Could not return ' + (def?.name || prev) + '.');
}

function barnInteriorCellAtPoint(clientX, clientY) {
  barnIntDragGhost?.style.setProperty('display', 'none');
  const el = document.elementFromPoint(clientX, clientY)?.closest?.('.barn-int-cell');
  barnIntDragGhost?.style.removeProperty('display');
  return el;
}

function clearBarnInteriorDropTargets() {
  document.querySelectorAll('.barn-int-cell.barn-int-drop-target').forEach((c) => c.classList.remove('barn-int-drop-target'));
}

function pickBarnInteriorDropTarget(clientX, clientY, hoverTarget, fromX, fromY) {
  const candidates = [];
  if (hoverTarget?.dataset?.barnIntX != null) candidates.push(hoverTarget);
  const atPoint = barnInteriorCellAtPoint(clientX, clientY);
  if (atPoint?.dataset?.barnIntX != null && !candidates.includes(atPoint)) candidates.push(atPoint);
  for (const target of candidates) {
    const tx = Number(target.dataset.barnIntX);
    const ty = Number(target.dataset.barnIntY);
    if (barnInteriorCanDropOn(fromX, fromY, tx, ty)) return target;
  }
  return null;
}

function highlightBarnInteriorDropTargets(fromX, fromY) {
  document.querySelectorAll('#barn-interior-grid .barn-int-cell').forEach((cell) => {
    const tx = Number(cell.dataset.barnIntX);
    const ty = Number(cell.dataset.barnIntY);
    if (barnInteriorCanDropOn(fromX, fromY, tx, ty)) cell.classList.add('barn-int-drop-target');
  });
}

function startBarnIntDragGhost(clientX, clientY, payload, sourceCell) {
  const cfg = getBarnConfig(activeBarnInteriorInstanceId);
  barnIntDragGhost = document.createElement('div');
  barnIntDragGhost.className = 'barn-int-drag-ghost';
  barnIntDragGhost.innerHTML = renderBarnInteriorDragGhostHtml(payload, cfg);
  const rect = sourceCell?.getBoundingClientRect?.();
  const size = rect ? Math.round(Math.min(rect.width, rect.height)) : 88;
  barnIntDragGhost.style.width = size + 'px';
  barnIntDragGhost.style.height = size + 'px';
  document.getElementById('game-wrapper').appendChild(barnIntDragGhost);
  barnIntDragGhost.style.left = clientX + 'px';
  barnIntDragGhost.style.top = clientY + 'px';
}

function moveBarnIntDragGhost(clientX, clientY) {
  if (!barnIntDragGhost) return;
  barnIntDragGhost.style.left = clientX + 'px';
  barnIntDragGhost.style.top = clientY + 'px';
}

function endBarnIntDragGhost() {
  barnIntDragGhost?.remove();
  barnIntDragGhost = null;
}

function bindBarnIntDragDocumentListeners() {
  document.addEventListener('pointermove', onBarnInteriorDocumentPointerMove);
  document.addEventListener('pointerup', onBarnInteriorDocumentPointerUp);
  document.addEventListener('pointercancel', onBarnInteriorDocumentPointerUp);
}

function unbindBarnIntDragDocumentListeners() {
  document.removeEventListener('pointermove', onBarnInteriorDocumentPointerMove);
  document.removeEventListener('pointerup', onBarnInteriorDocumentPointerUp);
  document.removeEventListener('pointercancel', onBarnInteriorDocumentPointerUp);
}

function onBarnInteriorCellPointerDown(e, cell) {
  if (e.button !== undefined && e.button !== 0) return;
  const x = Number(cell.dataset.barnIntX);
  const y = Number(cell.dataset.barnIntY);
  if (!barnInteriorCanDragFrom(x, y)) return;
  const bi = getBarnInteriorBi();
  const payload = bi ? captureBarnInteriorCellPayload(bi, x, y) : null;
  if (!payload) return;
  e.preventDefault();
  e.stopPropagation();
  barnIntDrag = {
    x, y, cell, payload,
    startX: e.clientX, startY: e.clientY, active: false, pointerId: e.pointerId, hoverTarget: null,
  };
  if (cell.setPointerCapture) cell.setPointerCapture(e.pointerId);
  bindBarnIntDragDocumentListeners();
}

function onBarnInteriorDocumentPointerMove(e) {
  if (!barnIntDrag || e.pointerId !== barnIntDrag.pointerId) return;
  const dx = e.clientX - barnIntDrag.startX;
  const dy = e.clientY - barnIntDrag.startY;
  if (!barnIntDrag.active) {
    if (Math.hypot(dx, dy) < 14) return;
    barnIntDrag.active = true;
    closeBarnInteriorPlaceMenu();
    barnIntDrag.cell.classList.add('barn-int-dragging');
    startBarnIntDragGhost(e.clientX, e.clientY, barnIntDrag.payload, barnIntDrag.cell);
  }
  moveBarnIntDragGhost(e.clientX, e.clientY);
  clearBarnInteriorDropTargets();
  const target = barnInteriorCellAtPoint(e.clientX, e.clientY);
  barnIntDrag.hoverTarget = target;
  highlightBarnInteriorDropTargets(barnIntDrag.x, barnIntDrag.y);
}

function onBarnInteriorDocumentPointerUp(e) {
  if (!barnIntDrag || e.pointerId !== barnIntDrag.pointerId) return;
  const cell = barnIntDrag.cell;
  const { x, y } = barnIntDrag;
  if (cell.releasePointerCapture) {
    try { cell.releasePointerCapture(e.pointerId); } catch (_err) { /* already released */ }
  }
  unbindBarnIntDragDocumentListeners();
  if (barnIntDrag.active) {
    const target = pickBarnInteriorDropTarget(
      e.clientX, e.clientY, barnIntDrag.hoverTarget, x, y
    );
    if (target) {
      const tx = Number(target.dataset.barnIntX);
      const ty = Number(target.dataset.barnIntY);
      if (!applyBarnInteriorDrop(x, y, tx, ty)) showToast('Can\'t place that there.');
    }
    cell.classList.remove('barn-int-dragging');
    clearBarnInteriorDropTargets();
    endBarnIntDragGhost();
    barnIntSuppressClick = true;
    setTimeout(() => { barnIntSuppressClick = false; }, 320);
  }
  barnIntDrag = null;
}

function onBarnInteriorViewportPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (e.target.closest('#barn-interior-edit-bar')) return;
  if (e.target.closest('.barn-int-doorway')) return;
  if (e.target.closest('#barn-int-place-menu')) return;
  if (e.target.closest('.barn-int-remove')) return;
  const cell = e.target.closest('.barn-int-cell');
  if (!cell) {
    closeBarnInteriorPlaceMenu();
    return;
  }

  if (barnInteriorEditMode) {
    const x = Number(cell.dataset.barnIntX);
    const y = Number(cell.dataset.barnIntY);
    if (!barnInteriorIsEmptyPlaceSlot(x, y)) closeBarnInteriorPlaceMenu();
    if (barnInteriorCanDragFrom(x, y)) {
      onBarnInteriorCellPointerDown(e, cell);
      return;
    }
    if (barnInteriorIsEmptyPlaceSlot(x, y)) {
      if (barnIntSuppressClick || barnIntDrag) return;
      openBarnInteriorPlaceMenu(x, y);
      return;
    }
    return;
  }

  const x = Number(cell.dataset.barnIntX);
  const y = Number(cell.dataset.barnIntY);
  if (barnInteriorIsSwappableCellType(barnInteriorCellType(x, y))) {
    showToast('Turn on edit layout to drag pens and ＋ tiles.');
  } else if (barnInteriorIsEmptyPlaceSlot(x, y)) {
    showToast('Turn on edit layout to place items.');
  }
}

function initBarnInteriorViewport() {
  const vp = document.querySelector('#barn-interior-screen .barn-interior-viewport');
  if (!vp || vp._barnIntViewportInit) return;
  vp._barnIntViewportInit = true;
  vp.addEventListener('pointerdown', onBarnInteriorViewportPointerDown);
}

function openBarnInterior(instanceId) {
  instanceId = instanceId || activeBarnInstanceId;
  const cfg = getBarnConfig(instanceId);
  if (!cfg || !isLargeBarn(cfg)) {
    showToast('Enter is only available at a large barn.');
    return;
  }
  activeBarnInteriorInstanceId = instanceId;
  setActiveBarn(instanceId);
  ensureBarnInterior(cfg);
  syncBarnInteriorPenAnimals(cfg);
  showScreen('barn-interior-screen');
  lastHome = 'barn-interior-screen';
  initBarnInteriorViewport();
  syncBarnInteriorEditButtons();
  renderBarnInteriorGrid();
  const feedingCfg = getBarnConfig(instanceId);
  if (feedingCfg && typeof barnAnyAnimalFeeding === 'function' && barnAnyAnimalFeeding(feedingCfg) && typeof startBarnTimer === 'function') {
    startBarnTimer();
  }
  syncUI();
}

function exitBarnInterior() {
  closeBarnInteriorPlaceMenu();
  unbindBarnIntDragDocumentListeners();
  barnIntDrag = null;
  endBarnIntDragGhost();
  barnInteriorEditMode = false;
  syncBarnInteriorEditButtons();
  activeBarnInteriorInstanceId = null;
  showScreen('exterior-screen');
  lastHome = 'exterior-screen';
  syncUI();
}

function barnEnterTap(event) {
  event?.stopPropagation();
  const instanceId = typeof resolveBarnInstanceId === 'function' ? resolveBarnInstanceId(event) : activeBarnInstanceId;
  if (instanceId) setActiveBarn(instanceId);
  openBarnInterior(instanceId);
}

function isBarnMenuZone(el, clientY) {
  if (!el?.getBoundingClientRect) return false;
  const rect = el.getBoundingClientRect();
  return (clientY - rect.top) / rect.height >= 0.66;
}

function isBarnEnterZone(el, clientY) {
  if (!el?.getBoundingClientRect) return false;
  const rect = el.getBoundingClientRect();
  return (clientY - rect.top) / rect.height < 0.66;
}

function handleBarnSurfaceTap(e, surface) {
  if (!surface) return;
  closeBarnInteriorPlaceMenu();
  const instanceId = surface.dataset?.instanceId;
  if (!instanceId) return;
  setActiveBarn(instanceId);
  const cfg = getBarnConfig(instanceId);
  if (!cfg || !isLargeBarn(cfg)) {
    barnMenuTap(e);
    return;
  }
  if (e.target?.closest?.('.plot-menu-btn') || e.target?.closest?.('.barn-menu-zone')) {
    barnMenuTap(e);
    return;
  }
  if (isBarnMenuZone(surface, e.clientY)) {
    barnMenuTap(e);
    return;
  }
  if (isBarnEnterZone(surface, e.clientY)) {
    barnEnterTap(e);
    return;
  }
  openBarnInterior(instanceId);
}

initBarnInteriorViewport();
