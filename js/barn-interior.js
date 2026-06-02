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
  if (!cfg || typeof isBarnInteriorAvailable !== 'function' || !isBarnInteriorAvailable(cfg)) {
    if (cfg) cfg.barnInterior = null;
    return null;
  }
  const spec = getBarnInteriorLayoutSpec(cfg);
  const penCount = getBarnAnimalSlotCount(cfg);
  if (!cfg.barnInterior) {
    const cells = {};
    spec.layout.forEach((slotType, i) => {
      const x = i % spec.cols;
      const y = Math.floor(i / spec.cols);
      cells[barnInteriorCoordKey(x, y)] = slotType;
    });
    cfg.barnInterior = {
      cols: spec.cols,
      rows: spec.rows,
      cells,
      customPlacements: {},
      placementStock: {},
      penAssignments: {},
      penAnimalTypes: Array(penCount).fill(null),
    };
  }
  const bi = cfg.barnInterior;
  if (!bi.cells) bi.cells = {};
  if (!bi.customPlacements) bi.customPlacements = {};
  if (!bi.placementStock) bi.placementStock = {};
  if (!bi.penAssignments) bi.penAssignments = {};
  if (!bi.penAnimalTypes) bi.penAnimalTypes = [];
  if (!bi.cols || !bi.rows) {
    bi.cols = spec.cols;
    bi.rows = spec.rows;
  }
  if (!barnInteriorLayoutMatchesSpec(bi, cfg)) migrateBarnInteriorLayout(bi, cfg);
  recoverOrphanedBarnInteriorItems(bi);
  pruneBarnInteriorCellData(bi);
  ensureBarnInteriorPenAssignments(bi, cfg);
  syncBarnInteriorPenAnimals(cfg);
  return bi;
}

/** Fix furniture saved on pen tile keys from an older buggy drag (e.g. lost butter churn). */
function recoverOrphanedBarnInteriorItems(bi) {
  const orphans = Object.keys(bi.customPlacements || {}).filter((key) => bi.cells[key] !== 'place');
  orphans.forEach((key) => {
    const item = bi.customPlacements[key];
    const stock = bi.placementStock?.[key];
    delete bi.customPlacements[key];
    if (bi.placementStock) delete bi.placementStock[key];
    const target = barnInteriorCellKeysOfType(bi.cells, 'place').find((k) => !bi.customPlacements[k]);
    if (target) {
      bi.customPlacements[target] = item;
      if (stock && item === 'hay_bale') {
        if (!bi.placementStock) bi.placementStock = {};
        bi.placementStock[target] = stock;
      }
    }
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

function migrateBarnInteriorLayout(bi, cfg) {
  if (!bi?.cells || !cfg) return;
  if (barnInteriorLayoutMatchesSpec(bi, cfg)) return;

  const savedPlacements = { ...(bi.customPlacements || {}) };
  const savedPenAssign = { ...(bi.penAssignments || {}) };
  const spec = getBarnInteriorLayoutSpec(cfg);
  const cells = {};
  spec.layout.forEach((slotType, i) => {
    const x = i % spec.cols;
    const y = Math.floor(i / spec.cols);
    cells[barnInteriorCoordKey(x, y)] = slotType;
  });
  bi.cols = spec.cols;
  bi.rows = spec.rows;
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
  normalizeBarnInteriorPenAssignments(bi, cfg);
}

function ensureBarnInteriorPenAssignments(bi, cfg) {
  if (!bi.penAssignments) bi.penAssignments = {};
  const penKeys = barnInteriorCellKeysOfType(bi.cells, 'pen');
  penKeys.forEach((key, i) => {
    if (bi.penAssignments[key] == null) bi.penAssignments[key] = i;
  });
  normalizeBarnInteriorPenAssignments(bi, cfg);
}

function normalizeBarnInteriorPenAssignments(bi, cfg) {
  const penKeys = barnInteriorCellKeysOfType(bi.cells, 'pen');
  const penCount = penKeys.length;
  const used = new Set();
  penKeys.forEach((key, i) => {
    let slot = bi.penAssignments[key];
    const slots = Array.from({ length: penCount }, (_, n) => n);
    if (typeof slot !== 'number' || slot < 0 || slot >= penCount || used.has(slot)) {
      slot = slots.find((n) => !used.has(n)) ?? i;
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
  const penCount = getBarnAnimalSlotCount(cfg);
  while (bi.penAnimalTypes.length < penCount) bi.penAnimalTypes.push(null);
  bi.penAnimalTypes.length = penCount;
  for (let i = 0; i < penCount; i++) {
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
  return type === 'pen' || type === 'place' || type === 'layout';
}

function barnInteriorIsUtilityCellType(type) {
  return type === 'place';
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
    const item = bi.customPlacements[key] || null;
    const stock = item === 'hay_bale' && bi.placementStock?.[key]
      ? { hay: Math.max(0, Number(bi.placementStock[key].hay) || 0) }
      : null;
    return { kind: 'place', item, stock };
  }
  if (type === 'layout' || type === 'empty') {
    return { kind: 'layout' };
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
  Object.keys(bi.placementStock || {}).forEach((key) => {
    if (bi.cells[key] !== 'place') delete bi.placementStock[key];
  });
}

function applyBarnInteriorCellPayload(bi, key, payload) {
  delete bi.penAssignments[key];
  delete bi.customPlacements[key];
  if (bi.placementStock) delete bi.placementStock[key];
  if (!payload) return;
  bi.cells[key] = payload.kind;
  if (payload.kind === 'pen') {
    bi.penAssignments[key] = payload.penSlot;
  } else if (payload.kind === 'place') {
    if (payload.item) {
      bi.customPlacements[key] = payload.item;
      if (payload.item === 'hay_bale' && payload.stock) {
        if (!bi.placementStock) bi.placementStock = {};
        bi.placementStock[key] = {
          hay: Math.min(BARN_HAY_BALE_MAX_HAY, Math.max(0, Number(payload.stock.hay) || 0)),
        };
      }
    }
  } else if (payload.kind === 'layout') {
    bi.cells[key] = 'layout';
  }
}

function returnHayToBagOrStore(amount) {
  let left = Math.max(0, amount | 0);
  if (left < 1) return 0;
  const icon = '🌾';
  const name = 'Hay';
  while (left > 0 && invTotal() < getInvCap()) {
    const added = invAddDirect('hay', icon, name, 1);
    if (added < 1) break;
    left--;
  }
  while (left > 0) {
    const added = storageAddDirect('hay', icon, name, left);
    if (added < 1) break;
    left -= added;
  }
  return amount - left;
}

function barnInteriorCustomPlacementsIncludeStorage(bi) {
  return Object.values(bi?.customPlacements || {}).some((key) => getBarnInteriorPlaceableDef(key)?.storageBonus);
}

function finishBarnInteriorLayoutEdit(bi, cfg) {
  pruneBarnInteriorCellData(bi);
  cfg = cfg || getBarnConfig(activeBarnInteriorInstanceId);
  ensureBarnInteriorPenAssignments(bi, cfg);
  normalizeBarnInteriorPenAssignments(bi, cfg);
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
  finishBarnInteriorLayoutEdit(bi, cfg);
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
      if (payload.item === 'hay_bale') {
        const hay = Math.min(BARN_HAY_BALE_MAX_HAY, Math.max(0, Number(payload.stock?.hay) || 0));
        return '<div class="barn-int-place filled barn-int-place--haybale">'
          + '<span class="barn-int-place-icon">🌾</span>'
          + '<span class="barn-int-place-label">Hay Bale</span>'
          + '<span class="barn-int-hay-stat">' + hay + '/' + BARN_HAY_BALE_MAX_HAY + '</span>'
          + '</div>';
      }
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
  if (payload.kind === 'layout') {
    return '<div class="barn-int-layout barn-int-layout--ghost"></div>';
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
  if (barnInteriorEditMode) {
    return '<div class="barn-int-pen empty">'
      + '<span class="barn-int-pen-icon">🌾</span>'
      + '<span class="barn-int-pen-label">empty pen' + slotHint + '</span>'
      + '</div>';
  }
  return '<div class="barn-int-pen empty barn-int-pen--add" role="button" tabindex="0" aria-label="Add animal to pen">'
    + '<span class="barn-int-pen-add-icon">＋</span>'
    + '<span class="barn-int-pen-label">add animal' + slotHint + '</span>'
    + '</div>';
}

function renderBarnInteriorLayoutCell() {
  if (barnInteriorEditMode) {
    return '<div class="barn-int-layout" aria-hidden="true">'
      + '<span class="barn-int-layout-hint">⇄</span>'
      + '</div>';
  }
  return '<div class="barn-int-layout barn-int-layout--hidden" aria-hidden="true"></div>';
}

function renderBarnInteriorHabitatCell() {
  return '<div class="barn-int-habitat inactive" aria-disabled="true">'
    + '<span class="barn-int-habitat-icon">🌿</span>'
    + '<span class="barn-int-habitat-label">Specialty habitat</span>'
    + '<span class="barn-int-habitat-sub">locked</span>'
    + '</div>';
}

function barnInteriorRemoveBtnHtml(x, y) {
  return '<button type="button" class="barn-int-remove" aria-label="Remove"'
    + ' onpointerdown="event.stopPropagation();event.preventDefault();clearBarnInteriorPlace(' + x + ',' + y + ')">✕</button>';
}

function renderBarnInteriorHayBaleCell(x, y, bi) {
  const key = barnInteriorCoordKey(x, y);
  const hay = Math.min(BARN_HAY_BALE_MAX_HAY, Math.max(0, Number(bi.placementStock?.[key]?.hay) || 0));
  const full = hay >= BARN_HAY_BALE_MAX_HAY;
  const haveHay = itemCountBagAndStore('hay');
  const canAdd10 = !full && haveHay > 0;
  const canAddMax = !full && haveHay > 0;
  const removeBtn = barnInteriorEditMode ? barnInteriorRemoveBtnHtml(x, y) : '';
  const add10 = canAdd10
    ? (' onpointerdown="event.stopPropagation();event.preventDefault();barnHayBaleAddHay(' + x + ',' + y + ',' + BARN_HAY_BALE_ADD_CHUNK + ')"')
    : ' disabled';
  const addMax = canAddMax
    ? (' onpointerdown="event.stopPropagation();event.preventDefault();barnHayBaleAddHay(' + x + ',' + y + ',0)"')
    : ' disabled';
  return '<div class="barn-int-place filled barn-int-place--haybale">'
    + removeBtn
    + '<span class="barn-int-place-icon">🌾</span>'
    + '<span class="barn-int-place-label">Hay Bale</span>'
    + '<span class="barn-int-hay-stat">' + hay + '/' + BARN_HAY_BALE_MAX_HAY + '</span>'
    + '<div class="barn-int-haybale-actions">'
    + '<button type="button" class="barn-int-hay-btn"' + add10 + '>+10</button>'
    + '<button type="button" class="barn-int-hay-btn"' + addMax + '>Add max</button>'
    + '</div></div>';
}

function renderBarnInteriorPlaceCell(x, y, bi) {
  const key = barnInteriorCoordKey(x, y);
  const placed = bi.customPlacements[key];
  if (placed) {
    if (placed === 'hay_bale') return renderBarnInteriorHayBaleCell(x, y, bi);
    const def = getBarnInteriorPlaceableDef(placed);
    const removeBtn = barnInteriorEditMode ? barnInteriorRemoveBtnHtml(x, y) : '';
    return '<div class="barn-int-place filled">'
      + removeBtn
      + '<span class="barn-int-place-icon">' + (def?.icon || '📦') + '</span>'
      + '<span class="barn-int-place-label">' + (def?.name || placed) + '</span>'
      + '</div>';
  }
  return '<div class="barn-int-place-empty barn-int-place-empty--add" role="button" tabindex="0" aria-label="Place barn furniture">'
    + '<span class="barn-int-place-add-icon">＋</span>'
    + '</div>';
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
  if (type === 'layout' || type === 'empty') return renderBarnInteriorLayoutCell();
  if (type === 'habitat') return renderBarnInteriorHabitatCell();
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
  const cols = cfg.barnInterior.cols || getBarnInteriorLayoutSpec(cfg).cols;
  const rows = cfg.barnInterior.rows || getBarnInteriorLayoutSpec(cfg).rows;
  let html = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const type = barnInteriorCellType(x, y, cfg.barnInterior);
      const draggable = barnInteriorEditMode && barnInteriorCanDragFrom(x, y);
      const classes = ['barn-int-cell', 'barn-int-cell--' + type];
      if (type === 'place') classes.push('barn-int-cell--place-slot');
      if (type === 'habitat') classes.push('barn-int-cell--habitat-slot', 'barn-int-cell--locked');
      if (type === 'layout' || type === 'empty') classes.push('barn-int-cell--layout-slot');
      if (barnInteriorEditMode && barnInteriorIsSwappableCellType(type)) classes.push('barn-int-cell--editable');
      if (draggable) classes.push('barn-int-cell--draggable');
      html += '<div class="' + classes.join(' ') + '" data-barn-int-x="' + x + '" data-barn-int-y="' + y + '" data-barn-int-type="' + type + '">'
        + renderBarnInteriorCell(x, y, cfg)
        + '</div>';
    }
  }
  grid.innerHTML = html;
  grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
  grid.dataset.barnIntCols = String(cols);
  grid.dataset.barnIntRows = String(rows);
  document.getElementById('barn-interior-screen')?.classList.toggle('barn-interior-edit-mode', barnInteriorEditMode);
  const titleEl = document.querySelector('#barn-interior-screen .top-bar-title');
  if (titleEl && typeof getBarnDisplayName === 'function') {
    const typeId = typeof getBarnPlotTypeId === 'function' ? getBarnPlotTypeId(cfg) : 'small_barn_complete';
    titleEl.textContent = getBarnDisplayName(typeId, cfg) + ' Interior';
  }
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
      ? 'Drag pens, ＋ utilities, or the ⇄ spacer. Tap ✕ on a utility to pick it up (hay bales return their hay).'
      : 'Turn on edit layout to rearrange pens, utilities, and spacing.';
  }
  if (!barnInteriorEditMode) {
    closeBarnInteriorPlaceMenu();
    unbindBarnIntDragDocumentListeners();
    barnIntDrag = null;
    endBarnIntDragGhost();
    clearBarnInteriorDropTargets();
  }
  renderBarnInteriorGrid();
  showToast(barnInteriorEditMode ? 'Edit mode — drag pens, ＋ slots, or the ⇄ spacer to customize layout.' : 'Layout saved.');
}

function closeBarnInteriorPlaceMenu() {
  document.getElementById('barn-int-place-menu')?.remove();
}

function openBarnInteriorPlaceMenu(x, y) {
  if (typeof closeBarnAdoptMenu === 'function') closeBarnAdoptMenu();
  const cfg = getBarnConfig(activeBarnInteriorInstanceId);
  const bi = ensureBarnInterior(cfg);
  if (!bi) return;
  const key = barnInteriorCoordKey(x, y);
  if (bi.cells[key] !== 'place') {
    showToast('Utilities can only be placed in ＋ slots.');
    return;
  }
  if (bi.customPlacements[key]) return;
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
  m.innerHTML = '<div class="plot-add-title">Barn furniture</div>'
    + '<div class="plot-add-sub">Utility slot — pick from bag or storage.</div>'
    + options
    + '<button type="button" class="plot-add-cancel" onclick="closeBarnInteriorPlaceMenu()">cancel</button>';
  w.appendChild(m);
}

function barnInteriorPlaceableOwned(key) {
  const def = getBarnInteriorPlaceableDef(key);
  if (def?.builtFromHay) return itemCountBagAndStore('hay') >= BARN_HAY_BALE_BUILD_HAY;
  return itemCountBagAndStore(key) > 0;
}

function barnInteriorPlaceableStockLabel(key) {
  const def = getBarnInteriorPlaceableDef(key);
  if (def?.builtFromHay) {
    const n = itemCountBagAndStore('hay');
    return formatRecipeMatLine('hay', BARN_HAY_BALE_BUILD_HAY, n);
  }
  if (barnInteriorPlaceableOwned(key)) {
    const n = itemCountBagAndStore(key);
    return formatRecipeMatLine(def?.name || key, 1, n);
  }
  return 'none in inventory or storage';
}

function placeBarnInteriorItem(x, y, placeableKey) {
  const cfg = getBarnConfig(activeBarnInteriorInstanceId);
  const bi = ensureBarnInterior(cfg);
  if (!bi) return;
  const def = getBarnInteriorPlaceableDef(placeableKey);
  if (!barnInteriorPlaceableOwned(placeableKey)) {
    showToast(def?.builtFromHay
      ? ('Need ' + BARN_HAY_BALE_BUILD_HAY + ' hay in bag or storage.')
      : 'None in inventory or storage.');
    return;
  }
  const key = barnInteriorCoordKey(x, y);
  if (bi.cells[key] !== 'place') {
    showToast('Utilities can only be placed in ＋ slots.');
    return;
  }
  if (bi.customPlacements[key]) return;
  if (def?.builtFromHay) {
    if (!consumeManyFromBagOrStore('hay', BARN_HAY_BALE_BUILD_HAY)) {
      showToast('Could not take ' + BARN_HAY_BALE_BUILD_HAY + ' hay.');
      return;
    }
    bi.customPlacements[key] = placeableKey;
    if (!bi.placementStock) bi.placementStock = {};
    bi.placementStock[key] = { hay: BARN_HAY_BALE_BUILD_HAY };
  } else {
    if (!consumeOneFromBagOrStore(placeableKey)) {
      showToast('Could not take ' + (def?.name || placeableKey) + '.');
      return;
    }
    bi.customPlacements[key] = placeableKey;
  }
  scheduleSaveGame();
  renderBarnInteriorGrid();
  if (typeof syncUI === 'function') syncUI();
  if (def?.storageBonus && currentScreen === 'barn-screen' && typeof renderBarnScreen === 'function') {
    renderBarnScreen();
  }
  showToast((def?.icon || '📦') + ' Placed.');
}

function barnHayBaleAddHay(x, y, amount) {
  const cfg = getBarnConfig(activeBarnInteriorInstanceId);
  const bi = ensureBarnInterior(cfg);
  if (!bi) return;
  const key = barnInteriorCoordKey(x, y);
  if (bi.customPlacements[key] !== 'hay_bale') return;
  if (!bi.placementStock) bi.placementStock = {};
  const cur = Math.min(BARN_HAY_BALE_MAX_HAY, Math.max(0, Number(bi.placementStock[key]?.hay) || 0));
  const room = BARN_HAY_BALE_MAX_HAY - cur;
  if (room < 1) {
    showToast('Hay bale is full.');
    return;
  }
  const have = itemCountBagAndStore('hay');
  if (have < 1) {
    showToast('No hay in bag or storage.');
    return;
  }
  const want = amount > 0
    ? Math.min(room, amount, have)
    : Math.min(room, have);
  if (want < 1) return;
  if (!consumeManyFromBagOrStore('hay', want)) {
    showToast('Could not take hay.');
    return;
  }
  bi.placementStock[key] = { hay: cur + want };
  scheduleSaveGame();
  renderBarnInteriorGrid();
  if (typeof syncUI === 'function') syncUI();
  showToast('🌾 Added ' + want + ' hay (' + bi.placementStock[key].hay + '/' + BARN_HAY_BALE_MAX_HAY + ').');
}

function clearBarnInteriorPlace(x, y) {
  const cfg = getBarnConfig(activeBarnInteriorInstanceId);
  const bi = ensureBarnInterior(cfg);
  if (!bi) return;
  const cellKey = barnInteriorCoordKey(x, y);
  if (bi.cells[cellKey] !== 'place') return;
  const prev = bi.customPlacements[cellKey];
  if (!prev) return;
  const def = getBarnInteriorPlaceableDef(prev);
  if (prev === 'hay_bale') {
    const hay = Math.max(0, Number(bi.placementStock?.[cellKey]?.hay) || 0);
    delete bi.customPlacements[cellKey];
    if (bi.placementStock) delete bi.placementStock[cellKey];
    const returned = returnHayToBagOrStore(hay);
    scheduleSaveGame();
    renderBarnInteriorGrid();
    if (typeof syncUI === 'function') syncUI();
    if (returned >= hay) showToast('🌾 Hay bale removed — ' + hay + ' hay returned.');
    else if (returned > 0) showToast('🌾 Bale removed; ' + returned + '/' + hay + ' hay returned (bag and storage full).');
    else showToast('🌾 Bale removed but hay could not be returned (inventory full).');
    return;
  }
  delete bi.customPlacements[cellKey];
  if (bi.placementStock) delete bi.placementStock[cellKey];
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
  if (e.target.closest('.barn-int-remove, .barn-int-haybale-actions')) return;
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
  if (e.target.closest('#barn-int-adopt-menu')) return;
  if (e.target.closest('.barn-int-remove, .barn-int-haybale-actions')) return;
  const cell = e.target.closest('.barn-int-cell');
  if (!cell) {
    closeBarnInteriorPlaceMenu();
    if (typeof closeBarnAdoptMenu === 'function') closeBarnAdoptMenu();
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
  const type = barnInteriorCellType(x, y);
  if (type === 'pen') {
    const bi = getBarnInteriorBi();
    const penIndex = barnInteriorPenSlotIndexAt(x, y, bi);
    const cfg = getBarnConfig(activeBarnInteriorInstanceId);
    const occupied = penIndex >= 0 && (cfg?.animalSlots?.[penIndex]?.type || bi?.penAnimalTypes?.[penIndex]);
    if (!occupied) {
      if (barnIntSuppressClick || barnIntDrag) return;
      if (typeof openBarnAdoptMenu === 'function') openBarnAdoptMenu(penIndex);
      return;
    }
    showToast('Manage this animal from the barn menu.');
    return;
  }
  if (type === 'place') {
    if (barnInteriorIsEmptyPlaceSlot(x, y)) {
      if (barnIntSuppressClick || barnIntDrag) return;
      openBarnInteriorPlaceMenu(x, y);
      return;
    }
    return;
  }
  if (type === 'habitat') {
    showToast('Specialty habitat slots unlock later via Architecture.');
    return;
  }
  if (type === 'layout' || type === 'empty') {
    showToast('Turn on edit layout to move the invisible spacer tile.');
    return;
  }
  if (barnInteriorIsSwappableCellType(type)) {
    showToast('Turn on edit layout to drag pens and utility tiles.');
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
  if (!cfg || typeof isBarnInteriorAvailable !== 'function' || !isBarnInteriorAvailable(cfg)) {
    showToast('Finish building the barn before entering.');
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
  if (pendingBarnAdoptPenSlot != null) {
    const penIdx = pendingBarnAdoptPenSlot;
    pendingBarnAdoptPenSlot = null;
    if (typeof openBarnAdoptMenu === 'function') openBarnAdoptMenu(penIdx);
  }
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
  if (!cfg || typeof isBarnInteriorAvailable !== 'function' || !isBarnInteriorAvailable(cfg)) {
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
