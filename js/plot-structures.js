/* Hearthstead — plot structure registry (well, kiln, barn, …) */
'use strict';

/**
 * @typedef {object} PlotStructureDef
 * @property {string} behavior — matches PLOT_TILE_DEFS[].behavior
 * @property {() => object} [defaultConfig] — fresh plotConfigs[instanceId] shape
 * @property {(instanceId:string) => void} [clearActive] — drop active instance on tile clear
 * @property {(slot:object, def:object, x?:number, y?:number) => void} [onRemove] — before plot cell deleted
 * @property {() => void} [migrate] — save/load normalization
 * @property {() => void} [updateCells] — refresh plot cell DOM after render
 * @property {() => void} [updateQuickAction] — sync-ui quick-action hooks
 * @property {(cell:HTMLElement, slot:object, def:object, x:number, y:number, editMode:boolean) => HTMLElement} [renderCell]
 * @property {(e:Event, cell:HTMLElement, slot:object) => void} [onCellTap]
 * @property {string} [screenId]
 * @property {() => void} [closeScreen]
 */

const PLOT_STRUCTURE_REGISTRY = Object.create(null);

function registerPlotStructure(behavior, def) {
  if (!behavior || !def) return;
  PLOT_STRUCTURE_REGISTRY[behavior] = { behavior, ...def };
}

function getPlotStructureRegistry(behavior) {
  return behavior ? PLOT_STRUCTURE_REGISTRY[behavior] || null : null;
}

function getRegisteredPlotStructureBehaviors() {
  return Object.keys(PLOT_STRUCTURE_REGISTRY);
}

function defaultPlotConfigForBehavior(behavior, typeId) {
  const reg = getPlotStructureRegistry(behavior);
  if (!reg?.defaultConfig) return null;
  return reg.defaultConfig(typeId);
}

function forEachPlotStructureSlot(behavior, fn) {
  if (typeof forEachPlotOccupied !== 'function' || typeof getPlotTileDef !== 'function') return;
  forEachPlotOccupied((x, y, slot) => {
    if (getPlotTileDef(slot.typeId)?.behavior === behavior) fn(x, y, slot);
  });
}

function forEachPlotStructureRegistry(fn) {
  Object.values(PLOT_STRUCTURE_REGISTRY).forEach((reg) => fn(reg.behavior, reg));
}

function clearPlotStructureActive(behavior, instanceId) {
  const reg = getPlotStructureRegistry(behavior);
  if (reg?.clearActive) reg.clearActive(instanceId);
}

function runPlotStructureOnRemove(slot, def, x, y) {
  const reg = getPlotStructureRegistry(def?.behavior);
  if (!reg?.onRemove) return;
  reg.onRemove(slot, def, x, y);
}

function migrateAllPlotStructures() {
  forEachPlotStructureRegistry((_behavior, reg) => {
    if (reg.migrate) {
      try {
        reg.migrate();
      } catch (err) {
        console.error('[Hearthstead] Plot structure migrate failed (' + reg.behavior + '):', err);
      }
    }
  });
}

function updateAllPlotStructureCells() {
  forEachPlotStructureRegistry((_behavior, reg) => {
    if (reg.updateCells) {
      try {
        reg.updateCells();
      } catch (err) {
        console.error('[Hearthstead] Plot structure updateCells failed (' + reg.behavior + '):', err);
      }
    }
    if (reg.updateQuickAction) {
      try {
        reg.updateQuickAction();
      } catch (err) {
        console.error('[Hearthstead] Plot structure updateQuickAction failed (' + reg.behavior + '):', err);
      }
    }
  });
}

function renderPlotStructureCell(cell, slot, def, x, y, editMode) {
  const reg = getPlotStructureRegistry(def?.behavior);
  if (!reg?.renderCell) return null;
  return reg.renderCell(cell, slot, def, x, y, editMode);
}

function handlePlotStructureCellTap(e, cell, slot, def) {
  const reg = getPlotStructureRegistry(def?.behavior);
  if (!reg?.onCellTap) return false;
  if (e?.target?.closest?.('.plot-menu-btn')) return true;
  reg.onCellTap(e, cell, slot);
  return true;
}
