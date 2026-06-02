/* Hearthstead — crafting desk */
'use strict';

function buildCraftingDeskUtilityMenuItem(x, y) {
  const def = INTERIOR_ROOM_DEFS.crafting_desk;
  if (!def) return '';
  const stock = itemCountBagAndStore(CRAFTING_DESK_FURNITURE_KEY);
  const hasStock = stock > 0;
  const tagHtml =
    typeof furnitureUtilityTaglineHtml === 'function'
      ? furnitureUtilityTaglineHtml(CRAFTING_DESK_FURNITURE_KEY)
      : '';
  const drops =
    (hasStock
      ? formatRecipeMatLine(def?.name || 'Crafting Desk', 1, stock) + ' — ready to place'
      : 'Craft one at the workbench first') + (tagHtml ? ' · ' + tagHtml : '');
  const cls =
    'plot-add-item ' + (hasStock ? 'structure-unlocked' : 'structure-locked below-rec is-disabled');
  return (
    '<button type="button" class="' +
    cls +
    '"' +
    (hasStock ? '' : ' disabled') +
    (hasStock ? ' onclick="placeInteriorCraftingDesk(' + x + ',' + y + ')"' : '') +
    '>'
    + '<span class="plot-add-item-icon">' +
    def.icon +
    '</span>'
    + '<span class="plot-add-item-name">' +
    def.name +
    '<span class="plot-add-item-drops">' +
    drops +
    '</span></span></button>'
  );
}

function placeInteriorCraftingDesk(x, y) {
  const def = INTERIOR_ROOM_DEFS.crafting_desk;
  if (!def) {
    closeInteriorBuildMenu();
    return;
  }
  if (!craftingDeskInStock()) {
    showToast('Craft a Crafting Desk at the workbench first.');
    closeInteriorBuildMenu();
    return;
  }
  migrateInterior();
  const ck = interiorCoordKey(x, y);
  const cellKey = state.interior.cells[ck];
  if (!isInteriorBuildSlotKey(cellKey)) {
    showToast('Pick an empty room or build slot.');
    closeInteriorBuildMenu();
    return;
  }
  if (!consumeOneFromBagOrStore(CRAFTING_DESK_FURNITURE_KEY)) {
    showToast('Could not take Crafting Desk.');
    closeInteriorBuildMenu();
    return;
  }
  state.interior.cells[ck] = 'crafting_desk';
  closeInteriorBuildMenu();
  renderInteriorGrid();
  syncUI();
  scheduleSaveGame();
  showToast(def.icon + ' ' + def.name + ' built.');
}

function migrateCraftingDesk() {
  if (state.lastWorkbenchRecipe === 'hardwood_chair') {
    state.lastWorkbenchRecipe = 'crafting_desk';
  }
  if (state.craftProgress?.hardwood_chair) {
    state.craftProgress.crafting_desk = state.craftProgress.hardwood_chair;
    delete state.craftProgress.hardwood_chair;
  }
  if (!state.inventory && !state.storage) return;
  const maps = [state.inventory, state.storage];
  maps.forEach((map) => {
    if (!map) return;
    const n = stackCount(map, 'hardwood_chair');
    if (n > 0) {
      stackAdd(map, 'crafting_desk', n);
      stackSet(map, 'hardwood_chair', 0);
    }
  });
  if (!state.interior?.cells) return;
  Object.keys(state.interior.cells).forEach((k) => {
    const key = state.interior.cells[k];
    if (key === 'hardwood_chair' || key === 'furniture:hardwood_chair') {
      state.interior.cells[k] = 'crafting_desk';
    }
  });
}

let craftingDeskOverlayCloser = null;
let activeCraftingDeskOverlayCell = null;
let craftingDeskRecipeKey = 'waterproof_paste';
let craftingDeskRecipePickerOpen = false;

function closeCraftingDeskOverlay() {
  if (activeCraftingDeskOverlayCell) {
    activeCraftingDeskOverlayCell.classList.remove('plot-activity-menu-ready');
    activeCraftingDeskOverlayCell = null;
  }
  if (craftingDeskOverlayCloser) {
    document.removeEventListener('pointerdown', craftingDeskOverlayCloser, true);
    craftingDeskOverlayCloser = null;
  }
}

function isCraftingDeskOverlayOpen() {
  return !!activeCraftingDeskOverlayCell?.classList.contains('plot-activity-menu-ready');
}

function openCraftingDeskOverlayForCell(cell) {
  if (!cell) return;
  closeCraftingDeskOverlay();
  cell.classList.add('plot-activity-menu-ready');
  activeCraftingDeskOverlayCell = cell;
  if (craftingDeskOverlayCloser) {
    document.removeEventListener('pointerdown', craftingDeskOverlayCloser, true);
  }
  craftingDeskOverlayCloser = function (e) {
    if (activeCraftingDeskOverlayCell?.contains(e.target)) return;
    closeCraftingDeskOverlay();
    e.preventDefault();
    e.stopPropagation();
  };
  setTimeout(() => document.addEventListener('pointerdown', craftingDeskOverlayCloser, true), 80);
}

function toggleCraftingDeskOverlayForCell(cell, event) {
  if (intSuppressClick) return;
  if (event?.target?.closest?.('.plot-menu-btn') || event?.target?.closest?.('.int-quick-action-btn')) {
    return;
  }
  if (activeCraftingDeskOverlayCell === cell && isCraftingDeskOverlayOpen()) {
    closeCraftingDeskOverlay();
  } else {
    openCraftingDeskOverlayForCell(cell);
  }
}

function craftingDeskQuickTap(event) {
  event.stopPropagation();
  closeCraftingDeskOverlay();
  processSelectedCraftingDeskRecipe();
}

function craftingDeskMenuTap(event) {
  event.stopPropagation();
  closeCraftingDeskOverlay();
  openCraftingDeskScreen();
}

function openCraftingDeskScreen() {
  showScreen('crafting-desk-screen');
  lastHome = 'interior-screen';
  renderCraftingDeskScreen();
}

function closeCraftingDeskScreen() {
  closeCraftingDeskOverlay();
  showScreen('interior-screen');
  lastHome = 'interior-screen';
  syncUI();
}

function craftingDeskInputStock(key) {
  return itemCountBagAndStore(key);
}

function craftingDeskInputLineHtml(inp, lineClass) {
  const stock = craftingDeskInputStock(inp.key);
  const qty = inp.qty || 1;
  const def = typeof getItemDef === 'function' ? getItemDef(inp.key) : null;
  return (
    '<span class="' +
    lineClass +
    ' wb-mat-pick-line ' +
    wbStockClass(stock, qty) +
    '">' +
    formatRecipeMatLine(def?.name || inp.key, qty, stock) +
    '</span>'
  );
}

function craftingDeskRecipeInputLinesHtml(recipe, lineClass) {
  return (recipe?.inputs || []).map((inp) => craftingDeskInputLineHtml(inp, lineClass)).join('');
}

function craftingDeskRecipeBlockReason(recipe) {
  if (!recipe) return { type: 'unknown' };
  for (const inp of recipe.inputs) {
    if (craftingDeskInputStock(inp.key) < (inp.qty || 1)) {
      const def = typeof getItemDef === 'function' ? getItemDef(inp.key) : null;
      return { type: 'input', key: inp.key, def };
    }
  }
  if (invTotal() >= getInvCap()) return { type: 'bag' };
  return null;
}

function craftingDeskRecipeBlockMessage(reason) {
  if (!reason) return '';
  if (reason.type === 'input') {
    return 'Need ' + ((reason.def?.name) || reason.key) + ' available';
  }
  if (reason.type === 'bag') return 'Bag full — make space before crafting';
  return '';
}

function canProcessCraftingDeskRecipe(recipeKey) {
  const recipe = getCraftingDeskRecipe(recipeKey);
  if (!recipe) return false;
  return !craftingDeskRecipeBlockReason(recipe);
}

function craftingDeskRecipeXpPreview(recipe) {
  if (!recipe) return '';
  const xp = recipe.xp || recipe.craftingXp || 0;
  if (!xp) return '';
  return formatSkillXp(xp, 'Crafting');
}

function craftingDeskProcessXpLogLine(recipe) {
  const xp = recipe?.xp || recipe?.craftingXp || 0;
  return xp ? '+' + xp + ' Crafting XP' : '';
}

function doCraftingDeskProcessAttempt(recipeKey) {
  const key = recipeKey || craftingDeskRecipeKey;
  const recipe = getCraftingDeskRecipe(key);
  if (!recipe) return { ok: false };
  const block = craftingDeskRecipeBlockReason(recipe);
  if (block) return { ok: false, block };
  const invBefore = invTotal();
  for (const inp of recipe.inputs) {
    for (let i = 0; i < (inp.qty || 1); i++) {
      if (!consumeOneFromBagOrStore(inp.key)) {
        showToast('Could not take ingredients.');
        return { ok: false };
      }
    }
  }
  if (recipe.affinitySkill && recipe.affinityXp) {
    grantXP(recipe.affinitySkill, recipe.affinityXp, null, {
      skipShardDrop: true,
      deferSync: craftingDeskProcess.running,
      keepActivities: true,
    });
  }
  const outDef = typeof getItemDef === 'function' ? getItemDef(recipe.outputKey) : null;
  const qty = recipe.outputQty || 1;
  const added = invAddDirect(
    recipe.outputKey,
    outDef?.icon || recipe.icon,
    outDef?.name || recipe.label,
    qty,
    { pickupBaseline: invBefore }
  );
  if (!added) {
    showToast('Bag full — could not keep the craft.');
    return { ok: false };
  }
  const craftXp = recipe.xp || recipe.craftingXp || 0;
  if (craftXp) {
    grantXP('crafting', craftXp, null, {
      deferSync: craftingDeskProcess.running,
      keepActivities: true,
    });
  }
  const xpMsg = craftingDeskProcessXpLogLine(recipe);
  addActivityLog(
    'crafting-desk-log',
    (outDef?.icon || recipe.icon) + ' ' + (outDef?.name || recipe.label) + ' crafted! ' + xpMsg,
    'success'
  );
  if (!craftingDeskProcess.running) {
    showToast((outDef?.icon || recipe.icon) + ' ' + (outDef?.name || recipe.label) + ' crafted! ' + xpMsg);
    syncUI();
  }
  return { ok: true };
}

function selectCraftingDeskRecipe(key) {
  if (!CRAFTING_DESK_RECIPES[key]) return;
  if (key !== craftingDeskRecipeKey && craftingDeskProcess.running) {
    stopCraftingDeskProcessing();
  }
  craftingDeskRecipeKey = key;
  craftingDeskRecipePickerOpen = false;
  renderCraftingDeskScreen();
}

function toggleCraftingDeskRecipePicker() {
  craftingDeskRecipePickerOpen = !craftingDeskRecipePickerOpen;
  renderCraftingDeskScreen();
}

function renderCraftingDeskRecipePanel() {
  const el = document.getElementById('crafting-desk-recipe-list');
  if (!el) return;
  const recipe =
    getCraftingDeskRecipe(craftingDeskRecipeKey) || getCraftingDeskRecipe('waterproof_paste');
  if (!recipe) return;
  const can = canProcessCraftingDeskRecipe(recipe.id);
  const inputLines = craftingDeskRecipeInputLinesHtml(recipe, 'wb-mat-pick-avail');

  if (!craftingDeskRecipePickerOpen) {
    el.innerHTML =
      '<div class="wb-log-pick wb-log-pick-collapsed' +
      (can ? '' : ' unavail') +
      '" onclick="toggleCraftingDeskRecipePicker()">'
      + '<span class="wb-mat-icon">' +
      recipe.icon +
      '</span>'
      + '<div class="wb-mat-pick-body">'
      + plotAddItemTitleRow(recipe.label, '')
      + inputLines
      + '</div>'
      + '<span class="wb-log-pick-chevron">▾</span>'
      + '</div>';
  } else {
    el.innerHTML = CRAFTING_DESK_RECIPE_KEYS.map((key) => {
      const r = getCraftingDeskRecipe(key);
      if (!r) return '';
      const recipeCan = canProcessCraftingDeskRecipe(key);
      const selCls = craftingDeskRecipeKey === key ? ' selected' : '';
      const unavailCls = recipeCan ? '' : ' unavail';
      return (
        '<div class="wb-mat-option' +
        selCls +
        unavailCls +
        '" onclick="' +
        (craftingDeskRecipeKey === key
          ? 'toggleCraftingDeskRecipePicker()'
          : "selectCraftingDeskRecipe('" + key + "')") +
        '">'
        + '<span class="wb-mat-icon">' +
        r.icon +
        '</span>'
        + '<span class="wb-mat-info">'
        + plotAddItemTitleRow(r.label, '')
        + craftingDeskRecipeInputLinesHtml(r, 'wb-mat-stock')
        + '</span></div>'
      );
    }).join('');
  }

  const xpEl = document.getElementById('crafting-desk-xp');
  if (xpEl) {
    xpEl.innerHTML = '<span class="wb-xp-line">' + craftingDeskRecipeXpPreview(recipe) + '</span>';
  }
}

function renderCraftingDeskActivityButtons() {
  const btnEl = document.getElementById('crafting-desk-buttons');
  const status = document.getElementById('crafting-desk-status');
  if (!btnEl) return;
  const recipe = getCraftingDeskRecipe(craftingDeskRecipeKey);
  const can = recipe && canProcessCraftingDeskRecipe(recipe.id);
  const block = recipe ? craftingDeskRecipeBlockReason(recipe) : null;
  if (status) {
    if (craftingDeskProcess.running) {
      status.textContent = 'Crafting…';
      status.classList.add('idle');
      status.classList.remove('blocked');
    } else {
      const uiBlock = block ? craftingDeskRecipeBlockMessage(block) : '';
      if (uiBlock) {
        status.textContent = uiBlock;
        status.classList.remove('idle');
        status.classList.add('blocked');
      } else {
        status.textContent = '';
        status.classList.add('idle');
        status.classList.remove('blocked');
      }
    }
  }
  if (craftingDeskProcess.running) {
    renderOnceContinuousButtons({
      btnEl,
      running: true,
      stopOnclick: 'stopCraftingDeskProcessing()',
      stopLabel: '⛔ STOP CRAFTING',
    });
    return;
  }
  renderOnceContinuousButtons({
    btnEl,
    running: false,
    can,
    onceLabel: '1 CRAFT',
    onceOnclick: 'craftingDeskProcessOnce()',
    continuousOnclick: 'craftingDeskProcessContinuous()',
  });
}

function renderCraftingDeskScreen() {
  migrateCraftingDesk();
  updateActivitySkillPill('crafting-desk', 'crafting');
  const subEl = document.getElementById('crafting-desk-subtitle');
  if (subEl) subEl.textContent = 'Combine materials into paste, gear, and more';
  renderCraftingDeskRecipePanel();
  renderCraftingDeskActivityButtons();
}

function renderCraftingDeskCellContent(el) {
  el.dataset.intKey = 'crafting_desk';
  el.innerHTML =
    '<div class="crafting-desk-idle"><div class="int-item">🛠️</div><div class="int-label">crafting desk</div></div>'
    + '<div class="plot-activity-top">'
    + '<button type="button" class="int-quick-action-btn">craft item</button>'
    + '</div>'
    + '<div class="plot-activity-menu-zone">'
    + '<button type="button" class="plot-menu-btn">menu</button>'
    + '</div>';
  const quickBtn = el.querySelector('.int-quick-action-btn');
  const menuBtn = el.querySelector('.plot-menu-btn');
  if (quickBtn) quickBtn.onclick = (ev) => craftingDeskQuickTap(ev);
  if (menuBtn) menuBtn.onclick = (ev) => craftingDeskMenuTap(ev);
  el.onclick = (e) => {
    if (intSuppressClick || isInteriorBuildMode()) return;
    if (e.target.closest('.plot-menu-btn') || e.target.closest('.int-quick-action-btn')) return;
    toggleCraftingDeskOverlayForCell(el, e);
  };
}

function getCraftingDeskProcessActivity() {
  if (craftingDeskProcessActivity) return craftingDeskProcessActivity;
  craftingDeskProcessActivity = createTimedActivity({
    type: 'crafting_desk',
    state: craftingDeskProcess,
    label: 'Crafting',
    canContinue: () => canProcessCraftingDeskRecipe(craftingDeskRecipeKey),
    cannotStartMsg: 'Nothing to craft right now.',
    outOfResourcesMsg: 'Out of ingredients.',
    onAttempt: () => {
      const result = doCraftingDeskProcessAttempt();
      if (result.block) {
        showToast(craftingDeskRecipeBlockMessage(result.block) || 'Cannot craft that yet.');
        return false;
      }
      return result.ok !== false;
    },
    onRefresh: () => {
      if (currentScreen === 'crafting-desk-screen') renderCraftingDeskScreen();
    },
  });
  return craftingDeskProcessActivity;
}

let craftingDeskProcessActivity = null;

function craftingDeskProcessOnce() {
  stopOtherActivities(null);
  const result = doCraftingDeskProcessAttempt();
  if (result.block) {
    showToast(craftingDeskRecipeBlockMessage(result.block) || 'Cannot craft that yet.');
  }
  if (currentScreen === 'crafting-desk-screen') renderCraftingDeskScreen();
  syncUI();
}

function craftingDeskProcessContinuous() {
  getCraftingDeskProcessActivity().startContinuous();
}

function stopCraftingDeskProcessing(fromActivitySwitch) {
  getCraftingDeskProcessActivity().stop(fromActivitySwitch);
}

function processSelectedCraftingDeskRecipe() {
  craftingDeskProcessOnce();
}

getCraftingDeskProcessActivity();
