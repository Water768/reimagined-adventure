/* Hearthstead — persistence */
'use strict';

/* ═══════════════════════════════════════
   PERSISTENCE (localStorage)
═══════════════════════════════════════ */
const SAVE_KEY='hearthstead-save';
const SAVE_VERSION=2;
let saveGameTimer=null;
let saveLoadFinished=false;
let saveLoadSucceeded=false;

function canPersistGameState(){
  if(!saveLoadFinished) return false;
  if(saveLoadSucceeded) return true;
  if(state.gameStarted) return true;
  try{
    return !localStorage.getItem(SAVE_KEY);
  }catch(_err){
    return false;
  }
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
  const copy=JSON.parse(JSON.stringify(state));
  if(copy.plot) copy.plot.editMode=false;
  if(copy.interior) copy.interior.buildMode=false;
  return copy;
}

function runPreSerializeMigrations(){
  migratePlot();
  migrateInterior();
  if(typeof migrateApothecaryTable==='function') migrateApothecaryTable();
}

function runAllSaveMigrations(){
  try{
    fillMissingSkillKeys();
    if(typeof migrateWell==='function') migrateWell();
    if(typeof migrateFirePit==='function') migrateFirePit();
    migrateItemKeys();
    migratePets();
    migrateEquippedAxe();
    migratePlot();
    migrateInterior();
    if(typeof migrateApothecaryTable==='function') migrateApothecaryTable();
    migrateStoreRoomSlot();
    migrateStoreRooms();
    reclaimMissingStoreRoomCells();
    migrateInteriorPan();
    migrateShelfTiers();
    if(typeof migrateApothecaryProcessKey==='function') migrateApothecaryProcessKey();
    if(typeof migrateFabricItems==='function') migrateFabricItems();
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

function scheduleSaveGame(){
  if(!canPersistGameState()) return;
  clearTimeout(saveGameTimer);
  saveGameTimer=setTimeout(saveGameState, 400);
}

function updateSaveButtonUI(){
  const btn=document.getElementById('save-game-btn');
  if(btn) btn.hidden=!state.gameStarted;
}

let saveBtnFlashTimer=null;
function manualSaveGame(){
  clearTimeout(saveGameTimer);
  saveGameTimer=null;
  if(!saveLoadFinished){
    showToast('Still loading — try again in a moment.');
    return;
  }
  const btn=document.getElementById('save-game-btn');
  const ok=saveGameState();
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
  clearGameSave();
  saveLoadFinished=true;
  saveLoadSucceeded=false;
  applySavedState(getDefaultState());
}
