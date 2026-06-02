/* Hearthstead — plot grid store & migration */
'use strict';

/* ═══════════════════════════════════════
   PLOT GRID (layout + edit + drag)
═══════════════════════════════════════ */
let plotDrag = null;
let plotDragGhost = null;
let plotPanDrag = null;
const PLOT_PAN_THRESHOLD = 8;
let plotSuppressClick = false;
let plotAddCoords = null;
let plotAddMenuCloser = null;
let plotWaterBodies = null;
let plotBarnBodies = null;
let plotRendering = false;
let plotNeedsHomeCenter = true;
let interiorNeedsHomeCenter = true;
/** Last rendered grid footprint (render bounds); null forces a full grid rebuild. */
let plotGridLayout = null;
let plotLastWaterOverlayKey = '';
let plotLastBarnOverlayKey = '';

function plotCoordKey(x,y){ return x+','+y; }

function parsePlotCoordKey(key){
  const p=key.split(',');
  return { x:Number(p[0]), y:Number(p[1]) };
}

function getExplorationLevel(){
  return Number(state.skills.exploration?.level)||1;
}

function ensurePlotUnlockedMap(){
  if(!state.plot) state.plot={ cells:null, editMode:false, panX:0, panY:0 };
  if(!state.plot.unlocked||typeof state.plot.unlocked!=='object') state.plot.unlocked={};
  if(!state.plot.featureUnlocks||typeof state.plot.featureUnlocks!=='object') state.plot.featureUnlocks={};
}

function seedPlotCoreUnlocked(){
  ensurePlotUnlockedMap();
  for(let y=PLOT_CORE.minY;y<=PLOT_CORE.maxY;y++){
    for(let x=PLOT_CORE.minX;x<=PLOT_CORE.maxX;x++){
      state.plot.unlocked[plotCoordKey(x,y)]=true;
    }
  }
}

function isPlotTileUnlocked(x,y){
  if(isCoordInCore(x,y)) return true;
  return !!state.plot?.unlocked?.[plotCoordKey(x,y)];
}

function isCoordInUnlockedPlot(x,y){
  if(!isCoordInPlotWorld(x,y)) return false;
  return isPlotTileUnlocked(x,y);
}

function getPlotBounds(){
  return { ...PLOT_WORLD };
}

function getPlotRenderBounds(){
  return { ...PLOT_WORLD };
}

function countUnlockedPlotTilesBeyondCore(){
  let n=0;
  forEachPlotWorldCoord((x,y)=>{
    if(isPlotTileUnlocked(x,y)&&!isCoordInCore(x,y)) n++;
  });
  return n;
}

function getPlotUnlockBudget(){
  return getPlotUnlockBudgetForExplorationLevel(getExplorationLevel());
}

function getPlotUnlockCreditsRemaining(){
  return Math.max(0, getPlotUnlockBudget()-countUnlockedPlotTilesBeyondCore());
}

function hasOrthUnlockedPlotNeighbor(x,y){
  return (
    isPlotTileUnlocked(x+1,y)||
    isPlotTileUnlocked(x-1,y)||
    isPlotTileUnlocked(x,y+1)||
    isPlotTileUnlocked(x,y-1)
  );
}

function isPlotTileUnlockable(x,y){
  if(!isCoordInPlotWorld(x,y)) return false;
  if(isPlotTileUnlocked(x,y)) return false;
  if(getPlotUnlockCreditsRemaining()<=0) return false;
  return hasOrthUnlockedPlotNeighbor(x,y);
}

function placePlotDefaultTile(x,y){
  const typeId=typeof getPlotTileDefaultTypeAt==='function'?getPlotTileDefaultTypeAt(x,y):null;
  if(!typeId||getPlotCell(x,y)) return false;
  const def=getPlotTileDef(typeId);
  if(!def) return false;
  const instanceId=genPlotInstanceId();
  setPlotCell(x,y,{ instanceId, typeId });
  if(!state.plotConfigs) state.plotConfigs={};
  state.plotConfigs[instanceId]=defaultPlotConfig(def.behavior, typeId);
  if(def.behavior==='whisper_camp'){
    if(typeof migrateWhisperCamp==='function') migrateWhisperCamp();
    const slot=getPlotCell(x,y);
    const accountTier=typeof getWhisperCampAccountTier==='function'?getWhisperCampAccountTier():0;
    if(accountTier>=1&&slot&&typeof applyWhisperCampTierOnSlot==='function'){
      applyWhisperCampTierOnSlot(slot, accountTier);
      const cfg=state.plotConfigs[instanceId];
      if(cfg) cfg.freePlaced=!!state.whisperCampUnlocked;
    }
    if(typeof updateWhisperCampCells==='function') updateWhisperCampCells();
  }
  if(def.behavior==='coastal_docks'){
    if(typeof migrateCoastalDocks==='function') migrateCoastalDocks();
    const slot=getPlotCell(x,y);
    const accountTier=typeof getCoastalDocksAccountTier==='function'?getCoastalDocksAccountTier():0;
    if(accountTier>=1&&slot&&typeof applyCoastalDocksTierOnSlot==='function'){
      applyCoastalDocksTierOnSlot(slot, accountTier);
      const cfg=state.plotConfigs[instanceId];
      if(cfg) cfg.freePlaced=!!state.coastalDocksUnlocked;
    }
    if(typeof updateCoastalDocksCells==='function') updateCoastalDocksCells();
  }
  return true;
}

function applyPlotFeatureUnlocksForCell(x,y){
  const preset=getPlotFeatureTileAt(x,y);
  if(!preset) return;
  ensurePlotUnlockedMap();
  const firstDiscover=!state.plot.featureUnlocks[preset.typeId];
  if(firstDiscover) state.plot.featureUnlocks[preset.typeId]=true;
  const placed=placePlotDefaultTile(x,y);
  if(firstDiscover){
    showToast(preset.icon+' '+preset.name+(placed?' claimed — place more on unlocked land.':' discovered — place on unlocked land.'));
  }else if(placed){
    showToast(preset.icon+' '+preset.name+' claimed.');
  }
}

function unlockPlotTile(x,y){
  if(!isPlotTileUnlockable(x,y)) return false;
  ensurePlotUnlockedMap();
  state.plot.unlocked[plotCoordKey(x,y)]=true;
  awardFirstPlotUnlockExplorationBonus(x,y);
  applyPlotFeatureUnlocksForCell(x,y);
  if(typeof scheduleSaveGame==='function') scheduleSaveGame();
  return true;
}

function isPlotFeatureUnlockedByTile(typeId){
  return !!state.plot?.featureUnlocks?.[typeId];
}

function plotFeatureRequiresTileUnlock(typeId){
  return PLOT_FEATURE_TILE_UNLOCKS.some((f)=>f.typeId===typeId);
}

function getNextPlotUnlockLevelHint(fromLevel){
  const lvl=fromLevel|0;
  for(let l=lvl+1;l<=40;l++){
    if(plotUnlockTilesGrantedAtLevel(l)>0) return l;
  }
  return 40;
}

function getPlotTileTypeMaxLevelReq(typeId){
  if(typeof getPlotTileAccessRequirement!=='function') return 0;
  const req=getPlotTileAccessRequirement(typeId);
  return req?.level|0;
}

function getPlotCellMaxLevelReq(x,y){
  const typeId=typeof getPlotTileTypeIdForCellProspect==='function'
    ?getPlotTileTypeIdForCellProspect(x,y):null;
  return getPlotTileTypeMaxLevelReq(typeId);
}

function awardFirstPlotUnlockExplorationBonus(x,y){
  if(isCoordInCore(x,y)) return;
  ensurePlotUnlockedMap();
  if(!state.plot.firstUnlockXpAwarded) state.plot.firstUnlockXpAwarded={};
  const key=plotCoordKey(x,y);
  if(state.plot.firstUnlockXpAwarded[key]) return;
  state.plot.firstUnlockXpAwarded[key]=true;
  const maxLvl=getPlotCellMaxLevelReq(x,y);
  const xp=(typeof PLOT_UNLOCK_XP_PER_LEVEL==='number'?PLOT_UNLOCK_XP_PER_LEVEL:1200)*maxLvl;
  if(xp<=0||typeof grantXP!=='function') return;
  grantXP('exploration', xp, null, { keepActivities:true });
  const meta=SKILL_META.exploration;
  const skill=meta?.name||'Exploration';
  if(typeof flashSkillPill==='function') flashSkillPill('exploration');
  if(typeof spawnSkillXpToken==='function') spawnSkillXpToken('exploration', xp, 'ext-explore');
  showToast((meta?.icon||'🧭')+' +'+xp.toLocaleString()+' '+skill+' XP — new land opened.');
}

function plotUnlockCreditsMessage(){
  const rem=getPlotUnlockCreditsRemaining();
  if(rem>0){
    return 'Edit land — tap a glowing tile next to your homestead ('+rem+' unlock'+(rem===1?'':'s')+' left).';
  }
  const skill=SKILL_META.exploration?.name||'Exploration';
  const next=getNextPlotUnlockLevelHint(getExplorationLevel());
  return 'No land unlocks left — reach '+skill+' level '+next+' for more.';
}

function plotLayerUnlockMessage(){
  return plotUnlockCreditsMessage();
}

function plotCellNeedsCoordShift(){
  const cells=state.plot?.cells;
  if(cells&&Object.keys(cells).length){
    return Object.keys(cells).some((key)=>{
      const { x, y }=parsePlotCoordKey(key);
      return x<0||y<0||!isCoordInPlotWorld(x,y);
    });
  }
  return !!(state.plot?.slots?.length||state.plotLayout);
}

function migratePlotCellCoordinates(){
  if(state.plot._coordsMigrated10x10) return;
  if(!plotCellNeedsCoordShift()&&!state.plot?.slots?.length&&!state.plotLayout){
    state.plot._coordsMigrated10x10=true;
    return;
  }
  const cells=state.plot?.cells||{};
  const next={};
  Object.entries(cells).forEach(([key, slot])=>{
    const { x, y }=parsePlotCoordKey(key);
    next[plotCoordKey(x+PLOT_COORD_SHIFT.x, y+PLOT_COORD_SHIFT.y)]=slot;
  });
  state.plot.cells=next;
  if(state.plot.unlocked){
    const shifted={};
    Object.entries(state.plot.unlocked).forEach(([key, on])=>{
      if(!on) return;
      const { x, y }=parsePlotCoordKey(key);
      shifted[plotCoordKey(x+PLOT_COORD_SHIFT.x, y+PLOT_COORD_SHIFT.y)]=true;
    });
    state.plot.unlocked=shifted;
  }
  state.plot._coordsMigrated10x10=true;
}

function migratePlotWorld12x12(){
  if(state.plot._migrated12x12) return;
  if(PLOT_WORLD_SIZE!==12) return;
  const cells=state.plot?.cells;
  const keys=cells?Object.keys(cells):[];
  if(!keys.length){
    state.plot._migrated12x12=true;
    return;
  }
  const needsShift=keys.some((key)=>{
    const slot=cells[key];
    if(slot?.typeId==='hut'){
      const { x,y }=parsePlotCoordKey(key);
      return x===4&&y===4;
    }
    return false;
  })||!!cells['4,4'];
  if(!needsShift){
    state.plot._migrated12x12=true;
    return;
  }
  const shift=PLOT_COORD_SHIFT_12;
  if(keys.length){
    const next={};
    Object.entries(cells).forEach(([key,slot])=>{
      const { x,y }=parsePlotCoordKey(key);
      next[plotCoordKey(x+shift.x,y+shift.y)]=slot;
    });
    state.plot.cells=next;
  }
  if(state.plot?.unlocked){
    const shifted={};
    Object.entries(state.plot.unlocked).forEach(([key,on])=>{
      if(!on) return;
      const { x,y }=parsePlotCoordKey(key);
      shifted[plotCoordKey(x+shift.x,y+shift.y)]=true;
    });
    state.plot.unlocked=shifted;
  }
  if(state.plot?.firstUnlockXpAwarded){
    const shiftedXp={};
    Object.entries(state.plot.firstUnlockXpAwarded).forEach(([key,v])=>{
      const { x,y }=parsePlotCoordKey(key);
      shiftedXp[plotCoordKey(x+shift.x,y+shift.y)]=v;
    });
    state.plot.firstUnlockXpAwarded=shiftedXp;
  }
  state.plot._migrated12x12=true;
}

/** Drop non-core unlocks above the Exploration budget (fixes old ring migration saves). */
function sanitizePlotUnlocksToBudget(){
  ensurePlotUnlockedMap();
  seedPlotCoreUnlocked();
  const budget=getPlotUnlockBudget();
  const extraKeys=[];
  forEachPlotWorldCoord((x,y)=>{
    if(isCoordInCore(x,y)) return;
    const key=plotCoordKey(x,y);
    if(state.plot.unlocked[key]) extraKeys.push(key);
  });
  if(extraKeys.length<=budget) return;
  extraKeys.forEach((key)=>{ delete state.plot.unlocked[key]; });
}

function getPlotCell(x,y){
  return state.plot?.cells?.[plotCoordKey(x,y)]||null;
}

function setPlotCell(x,y,slot){
  const key=plotCoordKey(x,y);
  if(!state.plot.cells) state.plot.cells={};
  if(slot) state.plot.cells[key]=slot;
  else delete state.plot.cells[key];
}

function forEachPlotCell(fn){
  forEachPlotWorldCoord((x,y)=>fn(x,y,getPlotCell(x,y)));
}

function forEachPlotOccupied(fn){
  Object.entries(state.plot?.cells||{}).forEach(([key,slot])=>{
    if(!slot) return;
    const {x,y}=parsePlotCoordKey(key);
    fn(x,y,slot);
  });
}

function findPlotCoordForInstanceId(instanceId){
  if(!instanceId||typeof forEachPlotOccupied!=='function') return null;
  let found=null;
  forEachPlotOccupied((x,y,slot)=>{
    if(slot.instanceId===instanceId) found={ x, y, slot };
  });
  return found;
}

function getAdjacentPlotCampTierAt(originX, originY, campBehavior, tierForSlot){
  if(originX==null||originY==null||!campBehavior||typeof tierForSlot!=='function') return 0;
  const deltas=[[1,0],[-1,0],[0,1],[0,-1]];
  let maxTier=0;
  deltas.forEach(([dx,dy])=>{
    const neighbor=getPlotCell(originX+dx, originY+dy);
    if(!neighbor) return;
    const def=getPlotTileDef(neighbor.typeId);
    if(!def||def.behavior!==campBehavior) return;
    maxTier=Math.max(maxTier, tierForSlot(neighbor)|0);
  });
  return maxTier|0;
}

function getAdjacentPlotCampTier(originInstanceId, campBehavior, tierForSlot){
  if(!originInstanceId||!campBehavior||typeof tierForSlot!=='function') return 0;
  const origin=findPlotCoordForInstanceId(originInstanceId);
  if(!origin) return 0;
  return getAdjacentPlotCampTierAt(origin.x, origin.y, campBehavior, tierForSlot);
}

function migratePlotCellsFromSlots(slots){
  state.plot.cells={};
  slots.forEach((slot,i)=>{
    const coord=PLOT_INDEX_TO_COORD[i];
    if(!coord) return;
    if(slot) state.plot.cells[plotCoordKey(coord[0],coord[1])]=slot;
  });
}

function plotHasOccupiedCells(){
  const cells=state.plot?.cells;
  if(!cells||typeof cells!=='object'||Array.isArray(cells)) return false;
  return Object.keys(cells).some(key=>cells[key]);
}

function normalizePlotCellsStore(){
  if(!state.plot) state.plot={ cells:null, editMode:false, panX:0, panY:0 };
  const cells=state.plot.cells;
  if(Array.isArray(cells)){
    const obj={};
    cells.forEach((slot,i)=>{
      const coord=PLOT_INDEX_TO_COORD[i];
      if(coord&&slot) obj[plotCoordKey(coord[0],coord[1])]=slot;
    });
    state.plot.cells=obj;
    return;
  }
  if(cells&&typeof cells!=='object'){
    state.plot.cells=null;
  }
}

function migrateQuarryTypeIds(){
  if(!state.plot?.cells) return;
  Object.values(state.plot.cells).forEach(cell=>{
    if(cell?.typeId==='flint_deposit') cell.typeId='brick_deposit';
  });
}

function migrateExpeditionPlotTiles(){
  if(typeof PLOT_FEATURE_TILE_UNLOCKS==='undefined'||!state.plot?.cells) return;
  PLOT_FEATURE_TILE_UNLOCKS.forEach((feat)=>{
    if(feat.typeId!=='sunken_shallows'&&feat.typeId!=='whispering_woods') return;
    const slot=getPlotCell(feat.x, feat.y);
    if(!slot) return;
    const expected=feat.defaultTypeId||feat.typeId;
    if(slot.typeId===expected) return;
    const def=getPlotTileDef(slot.typeId);
    if(slot.typeId==='cave'||(def?.behavior==='cave'&&!def?.expeditionKey)){
      slot.typeId=expected;
    }
  });
}

function migratePlot(){
  if(!state.plot) state.plot={ cells:null, editMode:false, panX:0, panY:0 };
  if(state.plot.panX==null) state.plot.panX=0;
  if(state.plot.panY==null) state.plot.panY=0;
  if(!state.plotConfigs) state.plotConfigs={};
  normalizePlotCellsStore();
  if(typeof migrateFairyGrovePlotTiles==='function') migrateFairyGrovePlotTiles();
  migratePlotCellCoordinates();
  migratePlotWorld12x12();
  ensurePlotUnlockedMap();
  seedPlotCoreUnlocked();
  sanitizePlotUnlocksToBudget();
  migrateQuarryTypeIds();
  migrateExpeditionPlotTiles();
  if(typeof migrateAllPlotStructures==='function') migrateAllPlotStructures();
  if(typeof scrubMisassignedPlotConfigs==='function') scrubMisassignedPlotConfigs();

  if(plotHasOccupiedCells()){
    migrateWoodlandTiles();
    return;
  }

  if(state.plot.slots?.length){
    migratePlotCellsFromSlots(state.plot.slots);
    delete state.plot.slots;
    migrateWoodlandTiles();
    return;
  }

  if(!state.plotLayout){
    state.plot.cells={};
    PLOT_STARTER_CELLS.forEach(s=>{
      state.plot.cells[plotCoordKey(s.x,s.y)]={ instanceId:s.instanceId, typeId:s.typeId };
      const def=getPlotTileDef(s.typeId);
      if(def&&!state.plotConfigs[s.instanceId])
        state.plotConfigs[s.instanceId]=defaultPlotConfig(def.behavior, s.typeId);
    });
    migrateWoodlandTiles();
    return;
  }

  const legacy=state.plotLayout||['tree','hut','empty1','empty2','rock','pond'];
  const typeMap={ hut:'hut', tree:'woodland_clearing', rock:'quarry_basic', pond:'water_basic' };
  const idMap={ hut:'plot_hut', tree:'plot_tree_1', rock:'plot_rock_1', pond:'plot_water_1' };
  const slots=[];
  legacy.forEach(key=>{
    if(!key||String(key).startsWith('empty')){ slots.push(null); return; }
    const typeId=typeMap[key];
    if(!typeId){ slots.push(null); return; }
    const instanceId=idMap[key]||genPlotInstanceId();
    slots.push({ instanceId, typeId });
    if(typeId==='woodland_clearing'||typeId?.startsWith('woodland_')){
      const def=getPlotTileDef(typeId);
      state.plotConfigs[instanceId]={ treeChops:state.treeChops||0, woodlandId:def?.woodlandId||1 };
    }else if(typeId==='water_basic'&&state._seenPond){
      state.plotConfigs[instanceId]={ seen:true };
    }else if(!state.plotConfigs[instanceId]){
      state.plotConfigs[instanceId]=defaultPlotConfig(getPlotTileDef(typeId).behavior, typeId);
    }
  });
  while(slots.length<PLOT_SLOT_COUNT) slots.push(null);
  migratePlotCellsFromSlots(slots.slice(0,PLOT_SLOT_COUNT));
  delete state.plot.slots;
  migrateWoodlandTiles();
}

