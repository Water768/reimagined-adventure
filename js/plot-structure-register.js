/* Hearthstead — wire plot modules into PLOT_STRUCTURE_REGISTRY */
'use strict';

(function registerBuiltInPlotStructures() {
  registerPlotStructure('well', {
    defaultConfig: () => ({
      bricks: 0,
      bucketless: false,
      equipped: false,
      hydrated: false,
      freePlaced: false,
    }),
    clearActive: (instanceId) => {
      if (typeof setActiveWell === 'function' && activeWellInstanceId === instanceId) setActiveWell(null);
    },
    onRemove: (slot) => {
      if (typeof stopWellFillVessels === 'function') stopWellFillVessels();
      if (typeof setActiveWell === 'function' && activeWellInstanceId === slot.instanceId) {
        setActiveWell(null);
        if (currentScreen === 'well-screen' && typeof closeWellScreen === 'function') closeWellScreen();
      }
    },
    migrate: () => {
      if (typeof migrateWell === 'function') migrateWell();
    },
    updateCells: () => {
      if (typeof updateWellCells === 'function') updateWellCells();
    },
    updateQuickAction: () => {
      if (typeof updateWellCellQuickAction === 'function') updateWellCellQuickAction();
    },
    renderCell: (cell, slot, def, x, y, editMode) => {
      cell.classList.add('cell-well');
      cell.innerHTML = buildWellCellHtml(slot, def, editMode);
      return cell;
    },
    onCellTap: (e, cell, slot) => {
      if (typeof handleWellCellTap === 'function') handleWellCellTap(e, cell, slot);
    },
    screenId: 'well-screen',
    closeScreen: () => {
      if (typeof closeWellScreen === 'function') closeWellScreen();
    },
  });

  registerPlotStructure('fire_pit', {
    defaultConfig: () => ({
      stone: 0,
      clay: 0,
      bricks: 0,
      complete: false,
      freePlaced: false,
    }),
    clearActive: (instanceId) => {
      if (typeof setActiveFirePit === 'function' && activeFirePitInstanceId === instanceId) {
        setActiveFirePit(null);
      }
    },
    onRemove: (slot) => {
      if (typeof setActiveFirePit === 'function' && activeFirePitInstanceId === slot.instanceId) {
        setActiveFirePit(null);
        if (currentScreen === 'fire-pit-screen' && typeof closeFirePitScreen === 'function') {
          closeFirePitScreen();
        }
      }
    },
    migrate: () => {
      if (typeof migrateFirePit === 'function') migrateFirePit();
    },
    updateCells: () => {
      if (typeof updateFirePitCells === 'function') updateFirePitCells();
    },
    updateQuickAction: () => {
      if (typeof updateFirePitCellQuickAction === 'function') updateFirePitCellQuickAction();
    },
    renderCell: (cell, slot, def, x, y, editMode) => {
      cell.classList.add('cell-fire-pit');
      cell.innerHTML = buildFirePitCellHtml(slot, def, editMode);
      return cell;
    },
    onCellTap: (e, cell, slot) => {
      if (typeof handleFirePitCellTap === 'function') handleFirePitCellTap(e, cell, slot);
    },
    screenId: 'fire-pit-screen',
    closeScreen: () => {
      if (typeof closeFirePitScreen === 'function') closeFirePitScreen();
    },
  });

  registerPlotStructure('kiln', {
    defaultConfig: () => ({
      stone: 0,
      clay: 0,
      bricks: 0,
      mouldIron: 0,
      fuelLogs: 0,
      fuelAshwood: 0,
      fuelTeak: 0,
      fired: false,
      moulded: false,
      fueled: false,
      lit: false,
      freePlaced: false,
    }),
    clearActive: (instanceId) => {
      if (typeof setActiveKiln === 'function' && activeKilnInstanceId === instanceId) setActiveKiln(null);
    },
    onRemove: (slot) => {
      if (typeof setActiveKiln === 'function' && activeKilnInstanceId === slot.instanceId) {
        setActiveKiln(null);
        if (currentScreen === 'kiln-screen' && typeof closeKilnScreen === 'function') closeKilnScreen();
      }
    },
    migrate: () => {
      if (typeof migrateKiln === 'function') migrateKiln();
    },
    updateCells: () => {
      if (typeof updateKilnCells === 'function') updateKilnCells();
    },
    updateQuickAction: () => {
      if (typeof updateKilnCellQuickAction === 'function') updateKilnCellQuickAction();
    },
    renderCell: (cell, slot, def, x, y, editMode) => {
      cell.classList.add('cell-kiln');
      cell.innerHTML = buildKilnCellHtml(slot, def, editMode);
      return cell;
    },
    onCellTap: (e, cell, slot) => {
      if (typeof handleKilnCellTap === 'function') handleKilnCellTap(e, cell, slot);
    },
    screenId: 'kiln-screen',
    closeScreen: () => {
      if (typeof closeKilnScreen === 'function') closeKilnScreen();
    },
  });

  registerPlotStructure('barn', {
    defaultConfig: () => ({
      frameLogs: 0,
      frameNails: 0,
      roofSlate: 0,
      roofNails: 0,
      doorAshwood: 0,
      doorNails: 0,
      framed: false,
      roofed: false,
      complete: false,
      freePlaced: false,
      size: 'small',
      orientation: 'h',
      animalSlots: [],
      storedLoot: {},
      storedEggs: 0,
      storedFeathers: 0,
      storedCollectXp: 0,
    }),
    clearActive: (instanceId) => {
      if (typeof setActiveBarn === 'function' && activeBarnInstanceId === instanceId) setActiveBarn(null);
    },
    onRemove: (slot) => {
      if (typeof setActiveBarn === 'function' && activeBarnInstanceId === slot.instanceId) {
        setActiveBarn(null);
        if (currentScreen === 'barn-screen' && typeof closeBarnScreen === 'function') closeBarnScreen();
      }
      if (typeof activeBarnInteriorInstanceId !== 'undefined' && activeBarnInteriorInstanceId === slot.instanceId) {
        if (typeof exitBarnInterior === 'function') exitBarnInterior();
      }
    },
    migrate: () => {
      if (typeof migrateBarn === 'function') migrateBarn();
    },
    updateCells: () => {
      if (typeof updateBarnCells === 'function') updateBarnCells();
    },
    renderCell: (cell, slot, def, x, y, editMode) => {
      cell.classList.add('cell-barn');
      delete cell.dataset.barnAnchor;
      cell.innerHTML = buildBarnCellHtml(slot, def, editMode);
      return cell;
    },
    onCellTap: (e, cell, slot) => {
      if (typeof handleBarnCellTap === 'function') handleBarnCellTap(e, cell, slot);
    },
    screenId: 'barn-screen',
    closeScreen: () => {
      if (typeof closeBarnScreen === 'function') closeBarnScreen();
    },
  });

  registerPlotStructure('washing_line', {
    defaultConfig: () => ({
      logs: 0,
      rope: 0,
      framed: false,
      complete: false,
      freePlaced: false,
      defaultRecipeId: 'twisted_hay',
      slotRecipeIds: [null, null, null, null, null],
      drySlots: [null, null, null, null, null],
      improved: false,
    }),
    clearActive: (instanceId) => {
      if (typeof setActiveWashingLine === 'function' && activeWashingLineInstanceId === instanceId) {
        setActiveWashingLine(null);
      }
    },
    onRemove: (slot) => {
      if (typeof setActiveWashingLine === 'function' && activeWashingLineInstanceId === slot.instanceId) {
        setActiveWashingLine(null);
        if (currentScreen === 'washing-line-screen' && typeof closeWashingLineScreen === 'function') {
          closeWashingLineScreen();
        }
      }
    },
    migrate: () => {
      if (typeof migrateWashingLine === 'function') migrateWashingLine();
    },
    updateCells: () => {
      if (typeof updateWashingLineCells === 'function') updateWashingLineCells();
    },
    renderCell: (cell, slot, def, x, y, editMode) => {
      cell.classList.add('cell-washing-line');
      cell.innerHTML = buildWashingLineCellHtml(slot, def, editMode);
      return cell;
    },
    onCellTap: (e, cell, slot) => {
      if (typeof handleWashingLineCellTap === 'function') handleWashingLineCellTap(e, cell, slot);
    },
    screenId: 'washing-line-screen',
    closeScreen: () => {
      if (typeof closeWashingLineScreen === 'function') closeWashingLineScreen();
    },
  });

  registerPlotStructure('whisper_camp', {
    defaultConfig: () => ({
      logs: 0,
      complete: false,
      freePlaced: false,
      campTier: 0,
    }),
    clearActive: (instanceId) => {
      if (typeof setActiveWhisperCamp === 'function' && activeWhisperCampInstanceId === instanceId) {
        setActiveWhisperCamp(null);
      }
    },
    onRemove: (slot) => {
      if (typeof setActiveWhisperCamp === 'function' && activeWhisperCampInstanceId === slot.instanceId) {
        setActiveWhisperCamp(null);
        if (currentScreen === 'whisper-camp-screen' && typeof closeWhisperCampScreen === 'function') {
          closeWhisperCampScreen();
        }
      }
    },
    migrate: () => {
      if (typeof migrateWhisperCamp === 'function') migrateWhisperCamp();
    },
    updateCells: () => {
      if (typeof updateWhisperCampCells === 'function') updateWhisperCampCells();
    },
    renderCell: (cell, slot, def, x, y, editMode) => {
      cell.classList.add('cell-whisper-camp');
      cell.innerHTML = buildWhisperCampCellHtml(slot, def, editMode);
      return cell;
    },
    onCellTap: (e, cell, slot) => {
      if (typeof handleWhisperCampCellTap === 'function') handleWhisperCampCellTap(e, cell, slot);
    },
    screenId: 'whisper-camp-screen',
    closeScreen: () => {
      if (typeof closeWhisperCampScreen === 'function') closeWhisperCampScreen();
    },
  });

  registerPlotStructure('coastal_docks', {
    defaultConfig: () => ({
      logs: 0,
      complete: false,
      freePlaced: false,
      campTier: 0,
    }),
    clearActive: (instanceId) => {
      if (typeof setActiveCoastalDocks === 'function' && activeCoastalDocksInstanceId === instanceId) {
        setActiveCoastalDocks(null);
      }
    },
    onRemove: (slot) => {
      if (typeof setActiveCoastalDocks === 'function' && activeCoastalDocksInstanceId === slot.instanceId) {
        setActiveCoastalDocks(null);
        if (currentScreen === 'coastal-docks-screen' && typeof closeCoastalDocksScreen === 'function') {
          closeCoastalDocksScreen();
        }
      }
    },
    migrate: () => {
      if (typeof migrateCoastalDocks === 'function') migrateCoastalDocks();
    },
    updateCells: () => {
      if (typeof updateCoastalDocksCells === 'function') updateCoastalDocksCells();
    },
    renderCell: (cell, slot, def, x, y, editMode) => {
      cell.classList.add('cell-coastal-docks');
      cell.innerHTML = buildCoastalDocksCellHtml(slot, def, editMode);
      return cell;
    },
    onCellTap: (e, cell, slot) => {
      if (typeof handleCoastalDocksCellTap === 'function') handleCoastalDocksCellTap(e, cell, slot);
    },
    screenId: 'coastal-docks-screen',
    closeScreen: () => {
      if (typeof closeCoastalDocksScreen === 'function') closeCoastalDocksScreen();
    },
  });

  registerPlotStructure('farm', {
    defaultConfig: () => ({
      seedKey: null,
      cropKey: null,
      seedQty: 0,
      plantedAt: null,
    }),
    clearActive: (instanceId) => {
      if (typeof setActiveFarm === 'function' && activeFarmInstanceId === instanceId) setActiveFarm(null);
    },
    onRemove: (slot) => {
      if (typeof setActiveFarm === 'function' && activeFarmInstanceId === slot.instanceId) {
        setActiveFarm(null);
        if (currentScreen === 'farming-screen' && typeof closeFarmScreen === 'function') closeFarmScreen();
      }
    },
    renderCell: (cell, slot, def, x, y, editMode) => {
      const cfg = typeof getFarmConfig === 'function' ? getFarmConfig(slot.instanceId) : null;
      const vis = typeof getFarmVisualState === 'function' ? getFarmVisualState(cfg) : null;
      cell.classList.add('cell-farm');
      if (vis?.stage === 'growing') cell.classList.add('farm-growing');
      if (vis?.stage === 'ready') cell.classList.add('farm-ready');
      cell.innerHTML = buildFarmCellHtml(slot, def, editMode);
      return cell;
    },
    onCellTap: (_e, _cell, slot) => {
      if (typeof openFarmPlotMenu === 'function') openFarmPlotMenu(slot.instanceId);
    },
    screenId: 'farming-screen',
    closeScreen: () => {
      if (typeof closeFarmScreen === 'function') closeFarmScreen();
    },
  });
})();
