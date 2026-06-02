/* Hearthstead — persistence */
'use strict';

/* ═══════════════════════════════════════
   PERSISTENCE (localStorage)
═══════════════════════════════════════ */
const SAVE_KEY='hearthstead-save';
const SAVE_VERSION=7;
/** Debounced autosave delay (ms) — inventory ticks no longer trigger this via syncUI. */
const SAVE_DEBOUNCE_MS=2500;
let saveGameTimer=null;
let saveLoadFinished=false;
let saveLoadSucceeded=false;
/** Blocks beforeunload / autosave while wiping (reload was re-saving after clear). */
let savePersistenceDisabled=false;

function canPersistGameState(){
  if(savePersistenceDisabled) return false;
  if(!saveLoadFinished) return false;
  // Never autosave a fresh session just because localStorage is empty (boot migrations
  // seed plot cells before the player starts — that was recreating "deleted" saves).
  if(saveLoadSucceeded) return true;
  return !!state.gameStarted;
}

function deepMergeDefaults(defaults, saved){
  if(saved==null) return defaults;
  if(typeof saved!=='object') return saved;
  if(Array.isArray(saved)) return saved.slice();
  const out={...defaults};
  Object.keys(saved).forEach(key=>{
    if(!(key in defaults)){
      out[key]=saved[key];
      return;
    }
    const dv=defaults[key], sv=saved[key];
    if(sv&&typeof sv==='object'&&!Array.isArray(sv)&&dv&&typeof dv==='object'&&!Array.isArray(dv)){
      out[key]=deepMergeDefaults(dv, sv);
    }else{
      out[key]=sv;
    }
  });
  return out;
}

function serializeGameState(){
  runPreSerializeMigrations();
  runVersionedSaveMigrations();
  if(typeof normalizeInventoryState==='function') normalizeInventoryState();
  const copy=JSON.parse(JSON.stringify(state));
  if(copy.plot) copy.plot.editMode=false;
  if(copy.interior) copy.interior.buildMode=false;
  return copy;
}

function runPreSerializeMigrations(){
  migratePlot();
  migrateInterior();
  if(typeof migrateApothecaryTable==='function') migrateApothecaryTable();
  if(typeof migrateStudyDesk==='function') migrateStudyDesk();
  if(typeof migrateBookcase==='function') migrateBookcase();
}

function runAllSaveMigrations(){
  try{
    migrateKnowledgeToAcademia();
    if(typeof migrateStudyDesk==='function') migrateStudyDesk();
    if(typeof ensurePocketsState==='function') ensurePocketsState();
    fillMissingSkillKeys();
    if(typeof migrateAllPlotStructures==='function') migrateAllPlotStructures();
    migrateItemKeys();
    if(typeof migrateLeanInventory==='function') migrateLeanInventory();
    migratePets();
    migrateTailoringToCrafting();
    migrateToolStoreTools();
    migrateEquippedBag();
    migratePlot();
    migrateInterior();
    if(typeof migrateApothecaryTable==='function') migrateApothecaryTable();
    if(typeof migrateStudyDesk==='function') migrateStudyDesk();
    if(typeof migrateBookcase==='function') migrateBookcase();
    migrateStoreRoomSlot();
    migrateStoreRooms();
    reclaimMissingStoreRoomCells();
    migrateInteriorPan();
    migrateShelfTiers();
    if(typeof migrateApothecaryProcessKey==='function') migrateApothecaryProcessKey();
    if(typeof migrateCleanBandageKey==='function') migrateCleanBandageKey();
    if(typeof migrateFawnComfortState==='function') migrateFawnComfortState();
    if(typeof migrateCraftingDesk==='function') migrateCraftingDesk();
  }catch(err){
    console.error('[Hearthstead] Save migration failed:', err);
  }
}

function runVersionedSaveMigrations(){
  const current=state._saveVersion||0;
  if(current>=SAVE_VERSION) return;
  runAllSaveMigrations();
  state._saveVersion=SAVE_VERSION;
}

function runPostLoadMigrations(){
  runVersionedSaveMigrations();
  if(typeof migrateCleanBandageKey==='function') migrateCleanBandageKey();
  if(typeof migrateLoomRecipeKey==='function') migrateLoomRecipeKey();
  if(typeof migrateLeanInventory==='function') migrateLeanInventory();
  if(typeof trimStorageToCapacity==='function') trimStorageToCapacity();
  if(typeof migrateFeatherPocket==='function') migrateFeatherPocket();
}

function applySavedState(saved){
  const defaults=getDefaultState();
  const merged=deepMergeDefaults(defaults, saved);
  // Player progress — use saved values only; defaults must not inject items or skill levels
  merged.inventory=saved.inventory!=null?{...saved.inventory}:{...defaults.inventory};
  merged.storage=saved.storage!=null?{...saved.storage}:{...defaults.storage};
  if(saved.skills!=null){
    merged.skills={...saved.skills};
    Object.keys(defaults.skills).forEach(key=>{
      if(!merged.skills[key]) merged.skills[key]={...defaults.skills[key]};
    });
  }else{
    merged.skills={...defaults.skills};
  }
  if(!merged.gameStarted && inferGameStarted(merged)) merged.gameStarted=true;
  if(saved.interior!=null){
    merged.interior={...defaults.interior,...saved.interior};
    if(saved.interior.cells&&typeof saved.interior.cells==='object'){
      merged.interior.cells={...saved.interior.cells};
    }
    if(saved.interior.furnitureRestore&&typeof saved.interior.furnitureRestore==='object'){
      merged.interior.furnitureRestore={...saved.interior.furnitureRestore};
    }
  }
  Object.keys(state).forEach(key=>{ delete state[key]; });
  Object.assign(state, merged);
  if(state.plot) state.plot.editMode=false;
  if(state.interior) state.interior.buildMode=false;
  runPostLoadMigrations();
}

function inferGameStarted(s){
  if(s.gameStarted) return true;
  if(s._seenHut||s._seenPond||s._seenShard||s._seenMagicShard) return true;
  if((s.gold||0)>0||s.axeFound) return true;
  if(s.plot?.cells&&Object.keys(s.plot.cells).length) return true;
  if(s.storeRooms&&Object.keys(s.storeRooms).length) return true;
  if((s.pets?.length||0)>0) return true;
  return false;
}

function saveGameState(){
  if(!canPersistGameState()) return false;
  try{
    const payload={
      version:SAVE_VERSION,
      savedAt:Date.now(),
      skillsViewMode,
      state:serializeGameState(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  }catch(err){
    console.warn('[Hearthstead] Could not save game:', err);
    return false;
  }
}

function loadGameState(){
  saveLoadFinished=false;
  saveLoadSucceeded=false;
  try{
    const params=new URLSearchParams(location.search);
    if(params.get('fresh')==='1'){
      clearGameSave();
      try{
        const clean=location.pathname+location.hash;
        history.replaceState(null,'',clean);
      }catch(_urlErr){ /* ignore */ }
      saveLoadFinished=true;
      return false;
    }
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw){
      saveLoadFinished=true;
      return false;
    }
    const data=JSON.parse(raw);
    if(!data?.state||typeof data.state!=='object'){
      console.warn('[Hearthstead] Save data was invalid — progress was not loaded. Your save file was left untouched.');
      saveLoadFinished=true;
      return false;
    }
    applySavedState(data.state);
    if(data.skillsViewMode==='list'||data.skillsViewMode==='compact'){
      skillsViewMode=data.skillsViewMode;
    }
    saveLoadFinished=true;
    saveLoadSucceeded=true;
    if(typeof markDirty==='function') markDirty('all');
    return true;
  }catch(err){
    console.warn('[Hearthstead] Could not load save:', err);
    console.warn('[Hearthstead] Your existing save was not overwritten. Try reloading from the same browser and URL you normally use.');
    saveLoadFinished=true;
    return false;
  }
}

function clearGameSave(){
  try{
    localStorage.removeItem(SAVE_KEY);
    return true;
  }catch(err){
    console.warn('[Hearthstead] Could not clear save:', err);
    return false;
  }
}

/**
 * Queue a debounced save. Prefer over calling saveGameState directly during gameplay.
 * @param {{ immediate?: boolean, delay?: number }} [opts]
 */
function requestSaveGame(opts){
  if(!canPersistGameState()) return;
  const delay=opts?.immediate?0:(opts?.delay??SAVE_DEBOUNCE_MS);
  clearTimeout(saveGameTimer);
  saveGameTimer=setTimeout(()=>{
    saveGameTimer=null;
    saveGameState();
  }, delay);
}

/** @deprecated Use requestSaveGame — kept for existing call sites */
function scheduleSaveGame(){
  requestSaveGame();
}

function saveGameNow(){
  clearTimeout(saveGameTimer);
  saveGameTimer=null;
  return saveGameState();
}

const DEV_PLAYTEST_SKILL_LEVEL=30;
const DEV_PLAYTEST_ITEM_COUNT=300;
const DEV_PLAYTEST_SKIP_ITEM_CATEGORIES=new Set(['junk','unknown']);

function devEquipAllToolStoreTools(){
  if(typeof ensureToolStoreTools!=='function') return 0;
  ensureToolStoreTools();
  state.equipped=null;
  if(typeof AXE_DEFS!=='undefined') state.toolStoreTools.axes=AXE_DEFS.map(d=>d.key);
  if(typeof PICKAXE_DEFS!=='undefined') state.toolStoreTools.pickaxes=PICKAXE_DEFS.map(d=>d.key);
  if(typeof FISHING_ROD_DEFS!=='undefined') state.toolStoreTools.rods=FISHING_ROD_DEFS.map(d=>d.key);
  if(typeof FISHING_NET_DEFS!=='undefined') state.toolStoreTools.nets=FISHING_NET_DEFS.map(d=>d.key);
  state.toolStoreTools.basket='basket';
  state.toolStoreTools.activeAxe=getUsableToolStoreAxeDef()?.key||getBestOwnedAxeDef()?.key||null;
  state.toolStoreTools.activePickaxe=getUsableToolStorePickaxeDef()?.key||getBestOwnedPickaxeDef()?.key||null;
  state.toolStoreTools.activeRod=getUsableToolStoreRodDef()?.key||getBestOwnedRodDef()?.key||null;
  state.toolStoreTools.activeNet=getUsableToolStoreNetDef()?.key||getBestOwnedNetDef()?.key||null;
  state.axeFound=!!getOwnedToolStoreAxeKeys().length;
  const toolKeys=new Set([
    ...(state.toolStoreTools.axes||[]),
    ...(state.toolStoreTools.pickaxes||[]),
    ...(state.toolStoreTools.rods||[]),
    ...(state.toolStoreTools.nets||[]),
    state.toolStoreTools.basket,
  ].filter(Boolean));
  toolKeys.forEach(key=>{
    const def=getItemDef(key);
    if(def&&typeof registerLegacyItemMeta==='function') registerLegacyItemMeta(key, def.icon, def.name);
  });
  return toolKeys.size;
}

function devGrantPlaytestItems(storageCount){
  const n=Math.max(0, storageCount|0);
  if(!n||typeof ITEM_REGISTRY==='undefined') return { storageTypes:0, bagTypes:0, toolTypes:0 };
  state.inventory={};
  state.storage={};
  state.equippedBag=null;
  const toolTypes=devEquipAllToolStoreTools();
  let storageTypes=0;
  let bagTypes=0;
  Object.keys(ITEM_REGISTRY).forEach((key)=>{
    const def=ITEM_REGISTRY[key];
    if(!def||DEV_PLAYTEST_SKIP_ITEM_CATEGORIES.has(def.category)) return;
    if(typeof isToolStoreToolKey==='function'&&isToolStoreToolKey(key)) return;
    if(typeof isFeatherPocketKey==='function'&&isFeatherPocketKey(key)){
      stackSet(state.inventory, key, 1, { silent:true });
      bagTypes++;
      return;
    }
    if(def.stackable===false){
      stackSet(state.inventory, key, 1, { silent:true });
      bagTypes++;
      return;
    }
    stackSet(state.storage, key, n, { silent:true });
    storageTypes++;
  });
  if(typeof findBagInBag==='function'&&typeof equipBagDef==='function'){
    const bag=findBagInBag();
    if(bag) equipBagDef(bag);
  }
  if(typeof markDirty==='function') markDirty('inventory','equip');
  return { storageTypes, bagTypes, toolTypes };
}

function devSetAllSkillsToLevel(level){
  if(typeof fillMissingSkillKeys==='function') fillMissingSkillKeys();
  const lvl=Math.max(1, level|0);
  Object.keys(state.skills||{}).forEach((key)=>{
    const s=state.skills[key];
    if(!s) return;
    s.level=lvl;
    s.xp=0;
    s.xpToNext=typeof xpForLevel==='function'?xpForLevel(lvl):100;
  });
}

function devPlaytestReset(){
  if(!saveLoadFinished){
    showToast('Still loading — try again in a moment.');
    return;
  }
  if(!state.gameStarted){
    showToast('Start playing first, then use Reset.');
    return;
  }
  const msg=[
    'Playtest reset — your save is kept (Save after if you want it on disk).',
    '',
    '• All skills → Lv '+DEV_PLAYTEST_SKILL_LEVEL+' (Architecture may rise to fit every hut room)',
    '• Tool store → every axe, pickaxe, rod, net, and basket equipped',
    '• Storage → '+DEV_PLAYTEST_ITEM_COUNT+'× each stackable item',
    '• Bag → 1× each non-stackable item (bags auto-equipped; all feather pockets)',
    '• Hut fully built with every utility, craftable station, and home-made furniture',
  ].join('\n');
  if(!confirm(msg)) return;
  devSetAllSkillsToLevel(DEV_PLAYTEST_SKILL_LEVEL);
  const items=devGrantPlaytestItems(DEV_PLAYTEST_ITEM_COUNT);
  if(typeof devSetupPlaytestInterior==='function') devSetupPlaytestInterior();
  if(typeof migratePlot==='function') migratePlot();
  if(typeof markDirty==='function') markDirty('skills','inventory','activity','interior','equip');
  if(typeof flushDirty==='function') flushDirty();
  else if(typeof syncUI==='function') syncUI('full');
  requestSaveGame({ immediate:true });
  showQuickToast('Playtest reset — Lv '+DEV_PLAYTEST_SKILL_LEVEL+', '+items.toolTypes+' tools equipped, '+items.storageTypes+' storage types, '+items.bagTypes+' bag items.');
}

function updateSaveButtonUI(){
  const bar=document.getElementById('game-dev-bar');
  if(!bar) return;
  let hasSave=false;
  try{ hasSave=!!localStorage.getItem(SAVE_KEY); }catch(_err){ hasSave=false; }
  bar.hidden=!state.gameStarted&&!hasSave;
}

let saveBtnFlashTimer=null;
function manualSaveGame(){
  if(!saveLoadFinished){
    showToast('Still loading — try again in a moment.');
    return;
  }
  const btn=document.getElementById('save-game-btn');
  const ok=saveGameNow();
  if(ok){
    showQuickToast('Game saved.');
    if(btn){
      btn.classList.add('saved');
      clearTimeout(saveBtnFlashTimer);
      saveBtnFlashTimer=setTimeout(()=>btn.classList.remove('saved'), 1200);
    }
  }else{
    showToast('Could not save — storage may be full.');
  }
}

function resetGameState(){
  wipeToFreshGame({ silent:true });
}

function wipeToFreshGame(opts){
  opts=opts||{};
  savePersistenceDisabled=true;
  clearTimeout(saveGameTimer);
  saveGameTimer=null;
  clearGameSave();

  saveLoadFinished=true;
  saveLoadSucceeded=false;
  applySavedState(getDefaultState());

  if(typeof resetTransientUiState==='function') resetTransientUiState();
  if(typeof stopAllActivities==='function') stopAllActivities();
  if(typeof closeAllPanels==='function') closeAllPanels();

  if(typeof lastHome!=='undefined') lastHome='exterior-screen';
  if(typeof showScreen==='function') showScreen('intro-screen');

  if(typeof plotNeedsHomeCenter!=='undefined') plotNeedsHomeCenter=true;
  if(typeof interiorNeedsHomeCenter!=='undefined') interiorNeedsHomeCenter=true;
  if(typeof initPlotGrid==='function') initPlotGrid();
  if(typeof initInteriorGrid==='function') initInteriorGrid();
  if(typeof updateSaveButtonUI==='function') updateSaveButtonUI();
  if(typeof markDirty==='function') markDirty('all');
  if(typeof syncUIFull==='function') syncUIFull();
  else if(typeof syncUI==='function') syncUI('full');

  savePersistenceDisabled=false;

  let stillSaved=false;
  try{ stillSaved=!!localStorage.getItem(SAVE_KEY); }catch(_err){ stillSaved=false; }
  if(!opts.silent){
    if(stillSaved) showToast('Save could not be cleared — check browser storage permissions.');
    else showQuickToast('New game — progress cleared. Tap BEGIN when ready.');
  }
}

function deleteSaveAndRestart(){
  if(!confirm('Delete your save and start a brand-new game? This cannot be undone.')) return;
  wipeToFreshGame();
}
