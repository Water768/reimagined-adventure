# Build manifest

`manifest.json` is the **single source of truth** for which scripts load into `Game - Draft 1.html`, and in what order.

## Adding or reordering a script

1. Add the file under `data/` or `js/`.
2. Insert its path in `manifest.json` `scripts` (respect dependencies — data before `js/data-init.js`, feature modules after `plot.js` / `state.js` as needed).
3. Run `npm run manifest:sync` to update the HTML script tags.
4. Run `npm run ci` locally before pushing.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run manifest:check` | Fail if HTML script tags differ from manifest (CI) |
| `npm run manifest:sync` | Rewrite HTML script block from manifest |
| `npm run audit` | Full codebase audit (uses manifest order) |
| `npm run ci` | `manifest:check` + `audit` |

## Inventory format (save v4+)

Player `state.inventory` and `state.storage` use **lean stacks**: `{ "logs": 12, "stone": 3 }` (count only).

Display metadata (`name`, `icon`, `category`) lives in `ITEM_REGISTRY` (`js/item-registry.js`), built at boot from data defs. Legacy saves with `{ icon, name, count }` are normalized on load via `migrateLeanInventory()`.

## UI sync & saves (stage 3)

- **`markDirty(...keys)`** / **`flushDirty()`** — partial UI updates (`inventory`, `gold`, `equip`, `activity`, `plot`, `skills`, `screen`, `meta`).
- **`syncUI()`** — flushes the standard set (not skill bars unless `skills` is dirty). Does **not** save.
- **`syncUIFull()`** — boot / rare full refresh (`markDirty('all')`).
- **`requestSaveGame()`** — debounced autosave (**2.5s**). Inventory/storage changes call this via `stackAdd` / `stackTake` in `item-registry.js`.
- **`saveGameNow()`** — immediate save (manual save button, `beforeunload`).

## Plot structures (stage 4)

Register multi-tile buildings in **`js/plot-structure-register.js`** via `registerPlotStructure(behavior, { … })`:

| Hook | Purpose |
|------|---------|
| `defaultConfig` | Initial `plotConfigs[instanceId]` |
| `migrate` | Save/load normalization |
| `renderCell` | Plot grid HTML |
| `onCellTap` / `onRemove` / `clearActive` | Interaction & teardown |
| `updateCells` / `updateQuickAction` | DOM refresh after `renderPlotGrid` / `syncUI` |

Core API lives in **`js/plot-structures.js`** (loads before `plot.js`). Wiring loads after `farming-plot.js`.

**Add a new plot structure:** define `data/` + `js/` module, add tile to `PLOT_TILE_BASE`, append one `registerPlotStructure(...)` block (or a small new register file + manifest entry).

## Activity engine (stage 5)

All player activities register via **`ACTIVITY_RUNNERS`** in `js/activity-engine.js`:

| API | Purpose |
|-----|---------|
| `registerActivityRunner(type, { isRunning, stop, label })` | Register start/stop for reconcile |
| `createTimedActivity({ type, state, … })` | Shared once/continuous timer loop (auto-registers) |
| `stopRegisteredActivity` / `stopAllActivities` | Unified teardown |
| `reconcileActivityState()` | Sync `activity.type` with runner state (called from `flushActivityDirty`) |
| `flushActivityUi(...extraDirty)` | Partial UI refresh without save (world-activity ticks) |

World activities registered in `js/activities.js` (`registerWorldActivityRunners`): **fishing**, **gathering**, **mining**, **woodcutting**, plus **exploring** and workbench **crafting**. Interior timed activities use `createTimedActivity` in their modules.

**Add a new timed activity:** prefer `createTimedActivity` + `registerActivityRunner` if custom; call `flushActivityUi()` on ticks instead of `syncUI()`.

## Mega-file split (stage 6)

Large modules are split so each file has a single concern. Load order is in `build/manifest.json` (run `npm run manifest:sync` after edits).

### Plot (`js/plot-*.js`)

| File | Role |
|------|------|
| `plot-store.js` | Cell store, migration, exploration rings, shared drag/pan state |
| `plot-cells.js` | Tile lookups, loot rolls, `build*CellHtml` helpers |
| `plot-water.js` | Water-body flood fill, overlays, fishing-on-plot helpers |
| `plot.js` | Edit mode, placement, add menu, cell taps |
| `plot-renderer.js` | `renderPlotGrid`, pan/drag, `initPlotGrid` |

Plot structures still register via `plot-structures.js` + `plot-structure-register.js` (stage 4).

### World activities (`js/activity-*.js`)

| File | Role |
|------|------|
| `activity-shared.js` | Sparkle restart helpers used by plot cells |
| `activity-fishing.js` | Fishing loop + screen |
| `activity-gathering.js` | Gathering |
| `activity-mining.js` | Mining / quarry stacks |
| `activity-woodcutting.js` | Woodcutting |
| `activity-exploring.js` | Expeditions |
| `activities.js` | `registerWorldActivityRunners()` only |

### HTML shell

- Styles live in `css/game.css` (listed in manifest `styles`).
- `npm run styles:sync` / `styles:check` keep the HTML `<link>` in sync (included in `npm run ci`).
- Game markup stays in `Game - Draft 1.html` (~1k lines after CSS extract).

**Re-splitting** (rare): `node scripts/split-stage6-extract.js` expects the monolithic sources; use git to restore before re-running.

## Incremental plot DOM (stage 7)

`renderPlotGrid()` no longer clears `#plot-grid` on every call when the render footprint is unchanged.

| Path | When |
|------|------|
| **Incremental** | Same bounds as last render, same cell count — patch each cell only if `data-plot-sig` changed; refresh water/barn overlay layers only when topology changes |
| **Full** | First render, `renderPlotGrid({ full: true })`, bounds/size change, or cell count mismatch |

Helpers in `plot-renderer.js`: `invalidatePlotGrid()`, `patchPlotCellElement()`, `syncPlotGridOverlays()`.

`flushPlotDirty()` still uses lightweight `updatePondCell` / `updateQuarryCells` / structure `updateCells` for activity ticks — no full grid rebuild.

**Force full rebuild:** `renderPlotGrid({ full: true })` or `invalidatePlotGrid()` then `renderPlotGrid()`.

## Screen & stat registry (stage 8)

Screens, overlay dismiss, gold/inv stat pills, and activity skill pills are registered in **`js/screen-registry.js`** + **`js/screen-register.js`** (loads after feature modules, before `navigation.js`).

| API | Purpose |
|-----|---------|
| `registerScreen(id, def)` | `kind`: `base` \| `hut-overlay` \| `world-overlay` |
| `getRegisteredScreenIds()` | Canonical screen list for `showScreen()` |
| `isHutOverlayScreen` / `isWorldOverlayScreen` | Context checks (`state.js`, overlays) |
| `runScreenCloseFn(id)` | Overlay dismiss (replaces `OVERLAY_CLOSE_FN`) |
| `getScreenGoldElementIds()` / `getScreenInvCountElementIds()` | `flushGoldDirty` / `updateInvCountPills` |
| `getScreenSkillPrefix` / `getScreenSkillResolver` | Overlay activity skill pill |
| `onFlushScreen` | `flushScreenDirty` when `markDirty('screen')` |

**Add a new screen:** one `registerScreen(...)` block in `screen-register.js` (or a small `screen-register-*.js` + manifest entry) with `kind`, `closeFn`, and stat element ids matching the HTML top bar.
