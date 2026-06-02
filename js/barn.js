/* Hearthstead — small barn */
'use strict';

let activeBarnInstanceId=null;
let barnTimerHandle=null;
let barnTroughPreviewExpanded=false;

function getBarnActivitySkillKey(){
  const cfg=getBarnConfig(activeBarnInstanceId);
  return getBarnStage(cfg)==='complete'?'husbandry':'architecture';
}

function normalizeBarnConfig(cfg){
  if(!cfg) return {
    frameLogs:0, frameNails:0, roofSlate:0, roofNails:0, doorAshwood:0, doorNails:0,
    framed:false, roofed:false, complete:false, freePlaced:false,
    animalSlots:[], storedLoot:{}, storedEggs:0, storedFeathers:0, storedCollectXp:0,
    troughStock:{}, troughAutoFeed:false, troughRecentFoods:[],
  };
  if(cfg.frameLogs==null) cfg.frameLogs=0;
  if(cfg.frameNails==null) cfg.frameNails=0;
  if(cfg.roofSlate==null) cfg.roofSlate=0;
  if(cfg.roofNails==null) cfg.roofNails=0;
  if(cfg.doorAshwood==null) cfg.doorAshwood=0;
  if(cfg.doorNails==null) cfg.doorNails=0;
  if(cfg.framed==null) cfg.framed=false;
  if(cfg.roofed==null) cfg.roofed=false;
  if(cfg.complete==null) cfg.complete=false;
  if(cfg.freePlaced==null) cfg.freePlaced=false;
  if(cfg.size==null) cfg.size='small';
  if(cfg.orientation==null) cfg.orientation='h';
  if(cfg.storedEggs==null) cfg.storedEggs=0;
  if(cfg.storedFeathers==null) cfg.storedFeathers=0;
  if(cfg.storedCollectXp==null) cfg.storedCollectXp=0;
  clampBarnTroughStock(cfg);
  if(!cfg.troughRecentFoods) cfg.troughRecentFoods=[];
  ensureBarnAnimalSlots(cfg);
  migrateBarnStoredLoot(cfg);
  if(cfg.pendingEggs|0){
    const type=barnPrimaryAnimalType(cfg)||'chicken';
    ensureBarnStoredLoot(cfg);
    cfg.storedLoot[type].eggs=(cfg.storedLoot[type].eggs|0)+(cfg.pendingEggs|0);
    cfg.pendingEggs=0;
    syncBarnStoredTotals(cfg);
  }
  if(cfg.pendingFeathers|0){
    const type=barnPrimaryAnimalType(cfg)||'chicken';
    ensureBarnStoredLoot(cfg);
    cfg.storedLoot[type].feathers=(cfg.storedLoot[type].feathers|0)+(cfg.pendingFeathers|0);
    cfg.pendingFeathers=0;
    syncBarnStoredTotals(cfg);
  }
  if(isBarnFrameComplete(cfg)){
    cfg.frameLogs=BARN_FRAME_LOGS;
    cfg.frameNails=BARN_FRAME_NAILS;
    cfg.framed=true;
  }
  if(isBarnRoofComplete(cfg)){
    cfg.roofSlate=BARN_ROOF_SLATE;
    cfg.roofNails=BARN_ROOF_NAILS;
    cfg.roofed=true;
  }
  if(isBarnComplete(cfg)){
    cfg.doorAshwood=BARN_DOOR_ASHWOOD;
    cfg.doorNails=BARN_DOOR_NAILS;
    cfg.complete=true;
  }
  return cfg;
}

function getPlotInstanceBehavior(instanceId){
  if(!instanceId||typeof findPlotSlotByInstanceId!=='function') return null;
  const found=findPlotSlotByInstanceId(instanceId);
  if(!found?.slot?.typeId) return null;
  const def=typeof getPlotTileDef==='function'?getPlotTileDef(found.slot.typeId):null;
  return def?.behavior||null;
}

function configLooksLikeBarn(cfg){
  if(!cfg||typeof cfg!=='object') return false;
  return cfg.animalSlots!=null||cfg.frameLogs!=null||cfg.frameNails!=null
    ||cfg.size==='medium'||cfg.size==='large'
    ||(cfg.complete!=null&&(cfg.doorAshwood!=null||cfg.doorNails!=null));
}

function ensureBarnPlotConfig(instanceId, typeId){
  if(!instanceId) return null;
  if(getPlotInstanceBehavior(instanceId)!=='barn') return null;
  const tid=typeId||'small_barn';
  if(!state.plotConfigs?.[instanceId]){
    state.plotConfigs[instanceId]=defaultPlotConfig('barn', tid);
  }
  return normalizeBarnConfig(state.plotConfigs[instanceId]);
}

function barnPlotTypeIdOnInstance(instanceId){
  if(!instanceId||typeof findAllPlotCellsByInstanceId!=='function') return null;
  let hasLarge=false;
  let hasMedium=false;
  findAllPlotCellsByInstanceId(instanceId).forEach(({ slot })=>{
    if(slot?.typeId==='large_barn_complete') hasLarge=true;
    if(slot?.typeId==='medium_barn_complete') hasMedium=true;
  });
  if(hasLarge) return 'large_barn_complete';
  if(hasMedium) return 'medium_barn_complete';
  const found=typeof findPlotSlotByInstanceId==='function'?findPlotSlotByInstanceId(instanceId):null;
  return found?.slot?.typeId||null;
}

function getBarnPlotTypeIdFromPlot(instanceId, cfg){
  const fromPlot=barnPlotTypeIdOnInstance(instanceId);
  if(fromPlot==='large_barn_complete') return getLargeBarnTypeId();
  if(fromPlot==='medium_barn_complete') return getMediumBarnTypeId();
  return typeof getBarnPlotTypeId==='function'?getBarnPlotTypeId(cfg):'small_barn_complete';
}

function syncBarnConfigFromPlotTile(instanceId, cfg){
  if(!cfg||!instanceId) return cfg;
  const plotTypeId=barnPlotTypeIdOnInstance(instanceId);
  if(plotTypeId==='large_barn_complete'){
    cfg.size='large';
    cfg.complete=true;
  }else if(plotTypeId==='medium_barn_complete'&&cfg.size!=='large'){
    cfg.size='medium';
    cfg.complete=true;
  }
  return cfg;
}

function readBarnPlotConfig(instanceId){
  if(!instanceId) return null;
  const cfg=state.plotConfigs?.[instanceId];
  if(!cfg) return null;
  return syncBarnConfigFromPlotTile(instanceId, normalizeBarnConfig(cfg));
}

function getBarnConfig(instanceId){
  if(!instanceId) return null;
  if(getPlotInstanceBehavior(instanceId)!=='barn') return null;
  return readBarnPlotConfig(instanceId);
}

function isMediumBarnInstance(instanceId){
  if(!instanceId) return false;
  if(getPlotInstanceBehavior(instanceId)!=='barn') return false;
  const cfg=readBarnPlotConfig(instanceId);
  return isMediumBarn(cfg);
}

function isLargeBarnInstance(instanceId){
  if(!instanceId) return false;
  if(getPlotInstanceBehavior(instanceId)!=='barn') return false;
  const cfg=readBarnPlotConfig(instanceId);
  return isLargeBarn(cfg);
}

function isMultiTileBarnInstance(_instanceId){
  return false;
}

function setActiveBarn(instanceId){
  activeBarnInstanceId=instanceId||null;
}

function resolveBarnCell(el){
  if(el?.classList?.contains('cell-barn')||el?.classList?.contains('cell-barn-base')) return el;
  if(el?.classList?.contains('barn-body-surface')) return el;
  return el?.closest?.('.plot-cell.cell-barn,.plot-cell.cell-barn-base,.barn-body-surface')||null;
}

function resolveBarnInstanceId(eventOrCell){
  const cell=eventOrCell?.classList?eventOrCell:resolveBarnCell(eventOrCell?.target);
  if(cell?.dataset?.instanceId) return cell.dataset.instanceId;
  return cell?.closest?.('[data-instance-id]')?.dataset?.instanceId||activeBarnInstanceId||null;
}

function forEachBarnSlot(fn){
  if(typeof forEachPlotStructureSlot==='function') forEachPlotStructureSlot('barn', fn);
}

function forEachBarnInstance(fn){
  const seen=new Set();
  forEachBarnSlot((x,y,slot)=>{
    if(!slot?.instanceId||seen.has(slot.instanceId)) return;
    seen.add(slot.instanceId);
    fn(x,y,slot,getBarnConfig(slot.instanceId));
  });
}

function findAllPlotCellsByInstanceId(instanceId){
  const cells=[];
  if(!state.plot?.cells||!instanceId) return cells;
  for(const [key,slot] of Object.entries(state.plot.cells)){
    if(slot?.instanceId===instanceId){
      const {x,y}=parsePlotCoordKey(key);
      cells.push({ x, y, slot });
    }
  }
  return cells.sort((a,b)=>a.y-b.y||a.x-b.x);
}

function getBarnPlotOccupiedCells(instanceId){
  return findAllPlotCellsByInstanceId(instanceId)
    .map(c=>({ x:c.x, y:c.y }))
    .sort((a,b)=>a.y-b.y||a.x-b.x);
}

function inferBarnOrientationFromCells(cells){
  if(cells.length!==2) return null;
  const a=cells[0], b=cells[1];
  if(a.y===b.y&&Math.abs(a.x-b.x)===1) return 'h';
  if(a.x===b.x&&Math.abs(a.y-b.y)===1) return 'v';
  return null;
}

function inferBarnAnchorFromCells(cells, orientation){
  if(!cells.length) return null;
  if(orientation==='v') return cells.reduce((m,c)=>(c.y<m.y?c:m));
  return cells.reduce((m,c)=>(c.x<m.x?c:m));
}

/** Align cfg anchor/orientation with tiles actually on the plot (source of truth). */
function syncBarnCfgFromPlotCells(instanceId){
  const cfg=getBarnConfig(instanceId);
  if(!cfg||!isMultiTileBarn(cfg)) return null;
  const cells=getBarnPlotOccupiedCells(instanceId);
  const orient=inferBarnOrientationFromCells(cells);
  if(cells.length===2&&orient){
    const anchor=inferBarnAnchorFromCells(cells, orient);
    cfg.orientation=orient;
    cfg.anchorX=anchor.x;
    cfg.anchorY=anchor.y;
    return anchor;
  }
  for(const c of findAllPlotCellsByInstanceId(instanceId)){
    const el=typeof getPlotCellElement==='function'?getPlotCellElement(c.x,c.y):null;
    if(el?.dataset?.barnAnchor==='1'){
      cfg.anchorX=c.x;
      cfg.anchorY=c.y;
      return { x:c.x, y:c.y };
    }
  }
  if(cfg.anchorX!=null&&cfg.anchorY!=null
    &&cells.some(c=>c.x===cfg.anchorX&&c.y===cfg.anchorY)){
    return { x:cfg.anchorX|0, y:cfg.anchorY|0 };
  }
  if(cells.length){
    cfg.anchorX=cells[0].x;
    cfg.anchorY=cells[0].y;
    return { x:cells[0].x, y:cells[0].y };
  }
  const found=findPlotSlotByInstanceId(instanceId);
  return found?{ x:found.x, y:found.y }:null;
}

function getBarnAnchor(instanceId){
  return syncBarnCfgFromPlotCells(instanceId);
}

function getBarnFootprintCells(instanceId){
  const cfg=readBarnPlotConfig(instanceId)||getBarnConfig(instanceId);
  const plotCells=getBarnPlotOccupiedCells(instanceId);
  if(plotCells.length===2&&inferBarnOrientationFromCells(plotCells)) return plotCells;
  syncBarnCfgFromPlotCells(instanceId);
  const anchor=getBarnAnchor(instanceId);
  if(!anchor||!cfg) return plotCells;
  const offsets=getBarnFootprintOffsets(cfg.orientation||'h', cfg.size||'small');
  return offsets.map(o=>({ x:anchor.x+o.dx, y:anchor.y+o.dy }));
}

function isBarnAnchorCell(x,y, instanceId){
  const anchor=getBarnAnchor(instanceId);
  return !!anchor&&anchor.x===x&&anchor.y===y;
}

function findEmptyPlotCellForRelocate(excludeKeys){
  const b=typeof getPlotRenderBounds==='function'?getPlotRenderBounds():{ minX:0, maxX:0, minY:0, maxY:0 };
  for(let y=b.minY;y<=b.maxY;y++){
    for(let x=b.minX;x<=b.maxX;x++){
      const key=plotCoordKey(x,y);
      if(excludeKeys?.has(key)) continue;
      if(getPlotCell(x,y)) continue;
      if(typeof isCoordInUnlockedPlot==='function'&&!isCoordInUnlockedPlot(x,y)) continue;
      return { x, y };
    }
  }
  return null;
}

/** Claim both footprint tiles for a medium barn; fix overlap with other structures. */
function enforceMediumBarnFootprint(instanceId, cfg, opts){
  if(!cfg||!isMultiTileBarn(cfg)) return { fixed:false, displaced:0 };
  syncBarnCfgFromPlotCells(instanceId);
  let anchor=getBarnAnchor(instanceId);
  if(!anchor){
    if(cfg.anchorX==null||cfg.anchorY==null) return { fixed:false, displaced:0 };
    anchor={ x:cfg.anchorX|0, y:cfg.anchorY|0 };
  } else {
    cfg.anchorX=anchor.x;
    cfg.anchorY=anchor.y;
  }
  const orientation=cfg.orientation||'h';
  const footprint=getBarnFootprintOffsets(orientation, cfg.size||'medium').map(o=>({
    x:anchor.x+o.dx,
    y:anchor.y+o.dy,
  }));
  const footprintKeys=new Set(footprint.map(c=>plotCoordKey(c.x,c.y)));
  const tid=opts?.typeId||getBarnPlotTypeId(cfg);
  let displaced=0;

  findAllPlotCellsByInstanceId(instanceId).forEach(({ x, y })=>{
    if(!footprintKeys.has(plotCoordKey(x,y))) setPlotCell(x,y,null);
  });

  const conflicts=[];
  footprint.forEach(({ x, y })=>{
    const slot=getPlotCell(x,y);
    if(slot&&slot.instanceId!==instanceId) conflicts.push({ x, y, slot });
  });

  for(const { x, y, slot } of conflicts){
    const dest=findEmptyPlotCellForRelocate(footprintKeys);
    if(!dest){
      return { fixed:false, displaced, blocked:true };
    }
    setPlotCell(x,y,null);
    setPlotCell(dest.x,dest.y,slot);
    footprintKeys.add(plotCoordKey(dest.x,dest.y));
    displaced++;
  }

  footprint.forEach(({ x, y })=>{
    if(getPlotCell(x,y)?.instanceId&&getPlotCell(x,y).instanceId!==instanceId){
      return;
    }
    setPlotCell(x,y,{ instanceId, typeId:tid });
  });

  return { fixed:conflicts.length>0, displaced };
}

function syncBarnFootprintCells(instanceId, typeId){
  const cfg=readBarnPlotConfig(instanceId);
  if(!cfg||!isMultiTileBarn(cfg)) return true;
  const result=enforceMediumBarnFootprint(instanceId, cfg, { typeId:typeId||getBarnPlotTypeId(cfg) });
  return !result.blocked;
}

/** Keep cfg.anchorX/Y aligned with plot cells before drag/drop math. */
function syncBarnAnchorFromPlot(instanceId){
  const cfg=getBarnConfig(instanceId);
  if(!cfg||!isMultiTileBarn(cfg)) return null;
  const cells=findAllPlotCellsByInstanceId(instanceId);
  if(!cells.length) return null;
  let anchor=null;
  for(const c of cells){
    const el=typeof getPlotCellElement==='function'?getPlotCellElement(c.x,c.y):null;
    if(el?.dataset?.barnAnchor==='1'){ anchor={ x:c.x, y:c.y }; break; }
  }
  if(!anchor){
    if(cfg.anchorX!=null&&cfg.anchorY!=null
      &&cells.some(c=>c.x===cfg.anchorX&&c.y===cfg.anchorY)){
      anchor={ x:cfg.anchorX|0, y:cfg.anchorY|0 };
    }else{
      anchor={ x:cells[0].x, y:cells[0].y };
    }
  }
  cfg.anchorX=anchor.x;
  cfg.anchorY=anchor.y;
  return anchor;
}

/** Drop stray plot cells and keep exactly two footprint tiles per medium/large barn. */
function pruneAllMultiTileBarnFootprints(){
  if(!state.plot?.cells) return;
  const seen=new Set();
  forEachPlotOccupied((x,y,slot)=>{
    if(!slot?.instanceId||seen.has(slot.instanceId)) return;
    const cfg=getBarnConfig(slot.instanceId);
    if(!cfg||!isMultiTileBarn(cfg)) return;
    seen.add(slot.instanceId);
    enforceMediumBarnFootprint(slot.instanceId, cfg);
  });
}

function isMediumBarnPlotCell(x,y){
  const slot=getPlotCell(x,y);
  if(!slot?.instanceId) return false;
  return isMultiTileBarnInstance(slot.instanceId);
}

function repairMediumBarnFootprint(instanceId, cfg){
  const plotCells=findAllPlotCellsByInstanceId(instanceId);
  if(plotCells.length<1){
    removeMediumBarnFromPlot(instanceId, { silent:true });
    return;
  }
  if(plotCells.length===1){
    const only=plotCells[0];
    const tries=[
      { orientation:'h', anchor:{ x:only.x, y:only.y } },
      { orientation:'v', anchor:{ x:only.x, y:only.y } },
      { orientation:'h', anchor:{ x:only.x-1, y:only.y } },
      { orientation:'v', anchor:{ x:only.x, y:only.y-1 } },
    ];
    for(const t of tries){
      const cells=getBarnFootprintOffsets(t.orientation, cfg.size||'medium').map(o=>({
        x:t.anchor.x+o.dx,
        y:t.anchor.y+o.dy,
      }));
      if(cells.some(c=>c.x===only.x&&c.y===only.y)&&cells.every(c=>isCoordInUnlockedPlot(c.x,c.y))){
        cfg.anchorX=t.anchor.x;
        cfg.anchorY=t.anchor.y;
        cfg.orientation=t.orientation;
        enforceMediumBarnFootprint(instanceId, cfg);
        return;
      }
    }
  }
  function findValidFootprint(cells){
    for(let i=0;i<cells.length;i++){
      for(let j=i+1;j<cells.length;j++){
        const a=cells[i], b=cells[j];
        if(a.y===b.y&&Math.abs(a.x-b.x)===1){
          return { anchor:a.x<b.x?a:b, orientation:'h', cells:[a,b] };
        }
        if(a.x===b.x&&Math.abs(a.y-b.y)===1){
          return { anchor:a.y<b.y?a:b, orientation:'v', cells:[a,b] };
        }
      }
    }
    return null;
  }
  const valid=findValidFootprint(plotCells);
  if(!valid){
    removeMediumBarnFromPlot(instanceId, { silent:true });
    return;
  }
  cfg.anchorX=valid.anchor.x;
  cfg.anchorY=valid.anchor.y;
  cfg.orientation=valid.orientation;
  const result=enforceMediumBarnFootprint(instanceId, cfg);
  if(result.fixed&&typeof showToast==='function'&&!state.plot?.editMode){
    showToast('🏛️ Medium barn footprint repaired on your plot.');
  }
}

/** Hit-test the medium barn overlay (edit drag/remove when cells underneath are wrong). */
function mediumBarnHitAtClientPoint(clientX, clientY){
  if(clientX==null||clientY==null) return null;
  if(typeof computeBarnBodies==='function') computeBarnBodies();
  const bodies=typeof plotBarnBodies!=='undefined'?plotBarnBodies?.bodies:null;
  if(bodies){
    for(const body of Object.values(bodies)){
      if(!body?.instanceId) continue;
      const el=typeof getBarnBodySurface==='function'?getBarnBodySurface(body.id):null;
      if(!el) continue;
      const r=el.getBoundingClientRect();
      if(clientX<r.left||clientX>r.right||clientY<r.top||clientY>r.bottom) continue;
      const anchor=typeof getBarnAnchor==='function'?getBarnAnchor(body.instanceId):null;
      const dragCell=anchor&&typeof getPlotCellElement==='function'?getPlotCellElement(anchor.x,anchor.y):null;
      if(dragCell) return { instanceId:body.instanceId, dragCell, surface:el };
    }
  }
  const under=typeof plotCellAtPoint==='function'?plotCellAtPoint(clientX,clientY):null;
  if(under?.dataset?.instanceId&&typeof isMultiTileBarnInstance==='function'&&isMultiTileBarnInstance(under.dataset.instanceId)){
    return {
      instanceId:under.dataset.instanceId,
      dragCell:typeof getBarnDragAnchorCell==='function'?getBarnDragAnchorCell(under):under,
      surface:null,
    };
  }
  return null;
}

function countBarnsOnPlot(){
  let n=0;
  forEachBarnInstance(()=>{ n++; });
  return n;
}

function canUseBarnStructure(){
  return (Number(state.skills.architecture?.level)||1)>=BARN_ARCH_UNLOCK;
}

function canUseMediumBarnStructure(){
  return (Number(state.skills.architecture?.level)||1)>=BARN_MEDIUM_ARCH_UNLOCK;
}

function canUseLargeBarnStructure(){
  return (Number(state.skills.architecture?.level)||1)>=BARN_LARGE_UPGRADE_ARCH_UNLOCK;
}

function isLargeBarnUnlocked(){
  migrateBarn();
  return !!state.largeBarnUnlocked;
}

function isBarnUnlocked(){
  migrateBarn();
  return !!state.barnUnlocked;
}

function canPlaceBarnSite(){
  migrateBarn();
  if(!canUseBarnStructure()) return false;
  if(state.barnWallsUnlocked) return false;
  return countBarnsOnPlot()===0;
}

function applyBarnWallsPlaced(cfg){
  if(!cfg) return;
  cfg.frameLogs=BARN_FRAME_LOGS;
  cfg.frameNails=BARN_FRAME_NAILS;
  cfg.framed=true;
}

function applyBarnDoorlessPlaced(cfg){
  if(!cfg) return;
  cfg.frameLogs=BARN_FRAME_LOGS;
  cfg.frameNails=BARN_FRAME_NAILS;
  cfg.framed=true;
  cfg.roofSlate=BARN_ROOF_SLATE;
  cfg.roofNails=BARN_ROOF_NAILS;
  cfg.roofed=true;
}

function applyBarnFreePlacedReady(cfg){
  if(!cfg) return;
  cfg.frameLogs=BARN_FRAME_LOGS;
  cfg.frameNails=BARN_FRAME_NAILS;
  cfg.framed=true;
  cfg.roofSlate=BARN_ROOF_SLATE;
  cfg.roofNails=BARN_ROOF_NAILS;
  cfg.roofed=true;
  cfg.doorAshwood=BARN_DOOR_ASHWOOD;
  cfg.doorNails=BARN_DOOR_NAILS;
  cfg.complete=true;
  cfg.freePlaced=true;
}

function barnSlotExists(instanceId){
  let found=false;
  forEachBarnSlot((x,y,slot)=>{ if(slot.instanceId===instanceId) found=true; });
  return found;
}

function totalBarnMaterialsEarned(){
  const totals={
    logs:0, slate:0, ashwood:0,
    nails:0,
  };
  forEachBarnSlot((x,y,slot)=>{
    const cfg=getBarnConfig(slot.instanceId);
    if(cfg&&!cfg.freePlaced){
      totals.logs+=cfg.frameLogs|0;
      totals.slate+=cfg.roofSlate|0;
      totals.ashwood+=cfg.doorAshwood|0;
      totals.nails+=(cfg.frameNails|0)+(cfg.roofNails|0)+(cfg.doorNails|0);
    }
  });
  return totals;
}

function unlockBarnWalls(){
  if(!state.barnWallsUnlocked){
    state.barnWallsUnlocked=true;
    scheduleSaveGame();
  }
}

function unlockBarnDoorless(){
  if(!state.barnDoorlessUnlocked){
    state.barnDoorlessUnlocked=true;
    scheduleSaveGame();
  }
}

function unlockBarns(){
  if(!state.barnUnlocked){
    state.barnUnlocked=true;
    scheduleSaveGame();
  }
}

function isBarnWallsUnlocked(){
  migrateBarn();
  return !!state.barnWallsUnlocked;
}

function isBarnDoorlessUnlocked(){
  migrateBarn();
  return !!state.barnDoorlessUnlocked;
}

function isMediumBarnUnlocked(){
  migrateBarn();
  return !!state.mediumBarnUnlocked;
}

function unlockMediumBarns(){
  if(!state.mediumBarnUnlocked){
    state.mediumBarnUnlocked=true;
    scheduleSaveGame();
  }
}

function canPlaceMediumBarn(){
  migrateBarn();
  if(!isMediumBarnUnlocked()) return false;
  return true;
}

function canPlaceMediumBarnAt(ax, ay){
  if(!canPlaceMediumBarn()) return false;
  return isCoordInUnlockedPlot(ax, ay)&&!getPlotCell(ax, ay);
}

function canPlaceSingleTileBarnAt(ax, ay){
  return isCoordInUnlockedPlot(ax, ay)&&!getPlotCell(ax, ay);
}

function findBarnPlacementAtClick(ax, ay, _size){
  if(!isCoordInUnlockedPlot(ax, ay)||getPlotCell(ax, ay)) return null;
  return { orientation:'h', anchor:{ x:ax, y:ay } };
}

function findMediumBarnPlacement(ax, ay){
  return findBarnPlacementAtClick(ax, ay, 'medium');
}

function getMediumBarnPlacementBlockReason(ax, ay){
  if(!isCoordInUnlockedPlot(ax, ay)) return 'That plot tile is not unlocked yet.';
  if(getPlotCell(ax, ay)) return 'That tile is already occupied.';
  return null;
}

function hasBarnUpgradeSpace(instanceId){
  return !!findPlotSlotByInstanceId(instanceId);
}

function getBarnUpgradePlacementBlockReason(instanceId){
  if(!findPlotSlotByInstanceId(instanceId)) return 'Could not find this barn on your plot.';
  return null;
}

function findBarnUpgradePlacement(bx, by){
  if(!isCoordInUnlockedPlot(bx, by)) return null;
  return { orientation:'h', anchor:{ x:bx, y:by } };
}

function barnUpgradeMaterialsMet(){
  const logs=itemCountBagAndStore('logs');
  const stone=itemCountBagAndStore('stone');
  const slate=itemCountBagAndStore('slate');
  return logs>=BARN_UPGRADE_LOGS
    &&stone>=BARN_UPGRADE_STONE
    &&slate>=BARN_UPGRADE_SLATE
    &&barnNailsCanAfford(BARN_UPGRADE_NAILS);
}

function consumeBarnUpgradeMaterials(){
  let archXp=0;
  const logs=consumeUpToFromBagOrStore('logs', BARN_UPGRADE_LOGS);
  if(logs<BARN_UPGRADE_LOGS) return { ok:false, archXp:0 };
  archXp+=getBarnArchXpForMaterial('logs')*logs;
  const stone=consumeUpToFromBagOrStore('stone', BARN_UPGRADE_STONE);
  if(stone<BARN_UPGRADE_STONE) return { ok:false, archXp:0 };
  archXp+=getBarnArchXpForMaterial('stone')*stone;
  const slate=consumeUpToFromBagOrStore('slate', BARN_UPGRADE_SLATE);
  if(slate<BARN_UPGRADE_SLATE) return { ok:false, archXp:0 };
  archXp+=getBarnArchXpForMaterial('slate')*slate;
  const nails=consumeBarnNailsWeakestFirst(BARN_UPGRADE_NAILS);
  if(nails.consumed<BARN_UPGRADE_NAILS) return { ok:false, archXp:0 };
  archXp+=nails.archXp;
  return { ok:true, archXp };
}

function canUpgradeSmallBarnToMedium(instanceId){
  instanceId=instanceId||activeBarnInstanceId;
  const cfg=getBarnConfig(instanceId);
  if(!cfg||getBarnStage(cfg)!=='complete'||isMediumBarn(cfg)) return false;
  if((Number(state.skills.architecture?.level)||1)<BARN_MEDIUM_ARCH_UNLOCK) return false;
  if(!barnUpgradeMaterialsMet()) return false;
  const found=findPlotSlotByInstanceId(instanceId);
  if(!found) return false;
  return !!findBarnUpgradePlacement(found.x, found.y);
}

function upgradeSmallBarnToMedium(){
  const instanceId=activeBarnInstanceId;
  const cfg=getBarnConfig(instanceId);
  if(!cfg||getBarnStage(cfg)!=='complete'||isMediumBarn(cfg)) return;
  if((Number(state.skills.architecture?.level)||1)<BARN_MEDIUM_ARCH_UNLOCK){
    showToast('Need Architecture Lv '+BARN_MEDIUM_ARCH_UNLOCK+' to upgrade the barn.');
    return;
  }
  const found=findPlotSlotByInstanceId(instanceId);
  if(!found){
    showToast('Could not find this barn on your plot.');
    return;
  }
  const placement=findBarnUpgradePlacement(found.x, found.y);
  if(!placement){
    showToast(getBarnUpgradePlacementBlockReason(instanceId));
    return;
  }
  if(!barnUpgradeMaterialsMet()){
    showToast('You need 300 logs, 200 stone, 100 slate, and 800 nails.');
    return;
  }
  const consumed=consumeBarnUpgradeMaterials();
  if(!consumed.ok){
    showToast('You need 300 logs, 200 stone, 100 slate, and 800 nails.');
    return;
  }
  cfg.size='medium';
  cfg.orientation=placement.orientation;
  cfg.anchorX=placement.anchor.x;
  cfg.anchorY=placement.anchor.y;
  ensureBarnAnimalSlots(cfg);
  if(typeof ensureBarnInterior==='function') ensureBarnInterior(cfg);
  const showBanner=typeof isStructureStageBonusPending==='function'
    ?isStructureStageBonusPending('medium_barn')
    :!state.mediumBarnUnlocked;
  unlockMediumBarns();
  setPlotCell(found.x, found.y, { instanceId, typeId:getMediumBarnTypeId() });
  grantXP('architecture', consumed.archXp, null);
  scheduleSaveGame();
  const refreshMedium=()=>{
    if(typeof renderPlotGrid==='function') renderPlotGrid();
    if(typeof updateBarnCells==='function') updateBarnCells();
    renderBarnScreen();
    syncUI();
  };
  if(showBanner){
    showStructureBuiltBanner({
      bonusKey:'medium_barn',
      title:'MEDIUM BARN!',
      icon:'🏛️',
      body:'Two animal pens and a barn interior — enter to arrange livestock and gear.',
      btnText:'GOT IT',
      cb:refreshMedium,
    });
  }else{
    showToast('🏛️ Small barn expanded into a medium barn!');
    refreshMedium();
  }
}

function applyMediumBarnFreePlacedReady(cfg){
  if(!cfg) return;
  applyBarnFreePlacedReady(cfg);
  cfg.size='medium';
  if(!cfg.orientation) cfg.orientation='h';
  ensureBarnAnimalSlots(cfg);
  if(typeof ensureBarnInterior==='function') ensureBarnInterior(cfg);
}

function placeMediumBarnPlotTile(x, y){
  migrateBarn();
  if(typeof canUseMediumBarnStructure==='function'&&!canUseMediumBarnStructure()){
    showToast('Need Architecture Lv '+BARN_MEDIUM_ARCH_UNLOCK+' for Medium Barn.');
    return false;
  }
  if(!isMediumBarnUnlocked()){
    showToast('Upgrade a small barn first.');
    return false;
  }
  const placement=findMediumBarnPlacement(x, y);
  if(!placement){
    showToast(getMediumBarnPlacementBlockReason(x, y));
    return false;
  }
  const instanceId=genPlotInstanceId();
  const tid=getMediumBarnTypeId();
  state.plotConfigs[instanceId]=defaultPlotConfig('barn', tid);
  const cfg=normalizeBarnConfig(state.plotConfigs[instanceId]);
  applyMediumBarnFreePlacedReady(cfg);
  cfg.orientation=placement.orientation;
  cfg.anchorX=placement.anchor.x;
  cfg.anchorY=placement.anchor.y;
  setPlotCell(placement.anchor.x, placement.anchor.y, { instanceId, typeId:tid });
  setActiveBarn(instanceId);
  scheduleSaveGame();
  if(typeof renderPlotGrid==='function') renderPlotGrid({ full:true });
  showToast('Medium barn placed.');
  return true;
}

function findLargeBarnPlacement(ax, ay){
  return findBarnPlacementAtClick(ax, ay, 'large');
}

function getLargeBarnPlacementBlockReason(ax, ay){
  if(!isCoordInUnlockedPlot(ax, ay)) return 'That plot tile is not unlocked yet.';
  if(getPlotCell(ax, ay)) return 'That tile is already occupied.';
  return null;
}

function canPlaceLargeBarnAt(ax, ay){
  if(!isLargeBarnUnlocked()) return false;
  return !!findLargeBarnPlacement(ax, ay);
}

function applyLargeBarnFreePlacedReady(cfg){
  if(!cfg) return;
  applyBarnFreePlacedReady(cfg);
  cfg.size='large';
  if(!cfg.orientation) cfg.orientation='h';
  ensureBarnAnimalSlots(cfg);
  ensureBarnInterior(cfg);
}

function placeLargeBarnPlotTile(x, y){
  migrateBarn();
  if(typeof canUseLargeBarnStructure==='function'&&!canUseLargeBarnStructure()){
    showToast('Need Architecture Lv '+BARN_LARGE_UPGRADE_ARCH_UNLOCK+' for Large Barn.');
    return false;
  }
  if(!isLargeBarnUnlocked()){
    showToast('Upgrade a medium barn to large first.');
    return false;
  }
  const placement=findLargeBarnPlacement(x, y);
  if(!placement){
    showToast(getLargeBarnPlacementBlockReason(x, y));
    return false;
  }
  const instanceId=genPlotInstanceId();
  const tid=getLargeBarnTypeId();
  state.plotConfigs[instanceId]=defaultPlotConfig('barn', tid);
  const cfg=normalizeBarnConfig(state.plotConfigs[instanceId]);
  applyLargeBarnFreePlacedReady(cfg);
  cfg.orientation=placement.orientation;
  cfg.anchorX=placement.anchor.x;
  cfg.anchorY=placement.anchor.y;
  setPlotCell(placement.anchor.x, placement.anchor.y, { instanceId, typeId:tid });
  setActiveBarn(instanceId);
  scheduleSaveGame();
  if(typeof renderPlotGrid==='function') renderPlotGrid({ full:true });
  showToast('Large barn placed.');
  return true;
}

function setBarnSlotTypeId(instanceId, typeId){
  const found=typeof findPlotSlotByInstanceId==='function'?findPlotSlotByInstanceId(instanceId):null;
  if(found?.slot&&getPlotTileDef(typeId)){
    found.slot.typeId=typeId;
    setPlotCell(found.x, found.y, { instanceId, typeId });
  }
}

function getActiveBarnTypeId(){
  const found=typeof findPlotSlotByInstanceId==='function'?findPlotSlotByInstanceId(activeBarnInstanceId):null;
  return found?.slot?.typeId||'small_barn';
}

function collapseBarnFootprintsToSingleTile(){
  if(!state.plot?.cells) return;
  const byInstance=new Map();
  forEachPlotOccupied((x,y,slot)=>{
    if(!slot?.instanceId||getPlotInstanceBehavior(slot.instanceId)!=='barn') return;
    if(!byInstance.has(slot.instanceId)) byInstance.set(slot.instanceId, []);
    byInstance.get(slot.instanceId).push({ x, y });
  });
  byInstance.forEach((cells, instanceId)=>{
    let cfg=getBarnConfig(instanceId);
    if(!cfg&&cells.length){
      const slot=getPlotCell(cells[0].x, cells[0].y);
      if(slot?.typeId&&typeof ensureBarnPlotConfig==='function'){
        cfg=ensureBarnPlotConfig(instanceId, slot.typeId);
      }
    }
    if(!cfg){
      return;
    }
    let anchor=null;
    if(cfg.anchorX!=null&&cfg.anchorY!=null
      &&cells.some(c=>c.x===cfg.anchorX&&c.y===cfg.anchorY)){
      anchor={ x:cfg.anchorX|0, y:cfg.anchorY|0 };
    }
    if(!anchor){
      for(const c of cells){
        const el=typeof getPlotCellElement==='function'?getPlotCellElement(c.x,c.y):null;
        if(el?.dataset?.barnAnchor==='1'){ anchor={ x:c.x, y:c.y }; break; }
      }
    }
    if(!anchor){
      const sorted=[...cells].sort((a,b)=>a.y-b.y||a.x-b.x);
      anchor={ x:sorted[0].x, y:sorted[0].y };
    }
    cfg.anchorX=anchor.x;
    cfg.anchorY=anchor.y;
    const tid=getBarnPlotTypeId(cfg);
    cells.forEach(c=>{
      if(c.x===anchor.x&&c.y===anchor.y) setPlotCell(c.x,c.y,{ instanceId, typeId:tid });
      else setPlotCell(c.x,c.y,null);
    });
  });
}

function migrateBarn(){
  if(state.barnUnlocked==null) state.barnUnlocked=false;
  if(state.barnWallsUnlocked==null) state.barnWallsUnlocked=false;
  if(state.barnDoorlessUnlocked==null) state.barnDoorlessUnlocked=false;
  if(state.mediumBarnUnlocked==null) state.mediumBarnUnlocked=false;
  if(state.largeBarnUnlocked==null) state.largeBarnUnlocked=false;
  scrubMisassignedPlotConfigs();
  collapseBarnFootprintsToSingleTile();
  forEachBarnInstance((x,y,slot)=>{
    const cfg=ensureBarnPlotConfig(slot.instanceId, slot.typeId);
    if(!cfg) return;
    cfg.anchorX=x;
    cfg.anchorY=y;
    if(slot.typeId==='large_barn_complete'||cfg.size==='large'){
      cfg.size='large';
      cfg.complete=true;
      ensureBarnInterior(cfg);
      state.largeBarnUnlocked=true;
      if(slot.typeId!==getLargeBarnTypeId()) slot.typeId=getLargeBarnTypeId();
    }else if(slot.typeId==='medium_barn_complete'){
      cfg.size='medium';
      cfg.complete=true;
      state.mediumBarnUnlocked=true;
      if(typeof ensureBarnInterior==='function') ensureBarnInterior(cfg);
    }
    if(getBarnStage(cfg)==='complete'&&typeof ensureBarnInterior==='function') ensureBarnInterior(cfg);
    clampBarnTroughStock(cfg);
    if(cfg.size==='medium') state.mediumBarnUnlocked=true;
    const stage=getBarnStage(cfg);
    if(isBarnFrameComplete(cfg)) state.barnWallsUnlocked=true;
    if(isBarnRoofComplete(cfg)) state.barnDoorlessUnlocked=true;
    if(stage==='complete') state.barnUnlocked=true;
    if(!isMultiTileBarn(cfg)){
      const expectedType=getBarnTypeIdForStage(stage);
      if(slot.typeId!==expectedType&&getPlotTileDef(expectedType)) slot.typeId=expectedType;
    }
    if(getBarnStage(cfg)==='complete'){
      processBarnFeedCatchUp(cfg);
    }
  });
  if(typeof migrateFeatherPocket==='function') migrateFeatherPocket();
  migrateBarnArchitectureXp();
}

function migrateBarnArchitectureXp(){
  if(state._barnArchXpMigrated) return;
  state._barnArchXpMigrated=true;
  const totals=totalBarnMaterialsEarned();
  const earned=totals.logs*getBarnArchXpForMaterial('logs')
    +totals.slate*getBarnArchXpForMaterial('slate')
    +totals.ashwood*getBarnArchXpForMaterial('ashwood')
    +totals.nails*getBarnArchXpForMaterial('nails');
  if(earned>0&&state.skills?.architecture){
    const s=state.skills.architecture;
    s.xpToNext=xpForLevel(s.level);
    const current=getTotalSkillXp('architecture');
    if(current<earned) grantXP('architecture', earned-current, null, { deferSync:true });
  }
}

function totalFiniteBarnNailsAvailable(){
  let total=0;
  BARN_NAIL_ORDER.forEach(key=>{ total+=nailCount(key); });
  return total;
}

function barnNailsCanAfford(amount){
  const need=Math.max(0, amount|0);
  if(need<1) return true;
  return totalFiniteBarnNailsAvailable()>=need;
}

function consumeBarnNailsWeakestFirst(maxAmount){
  let left=Math.max(0, maxAmount|0);
  let archXp=0;
  let consumed=0;
  for(const nailKey of BARN_NAIL_ORDER){
    if(left<1) break;
    const nailType=NAIL_TYPES?.[nailKey];
    if(!nailType||nailType.infinite) continue;
    const stock=nailCount(nailKey);
    const take=Math.min(left, stock);
    if(take<1) continue;
    if(!consumeManyFromBagOrStore(nailKey, take)) break;
    archXp+=getBarnArchXpForNail(nailKey)*take;
    consumed+=take;
    left-=take;
  }
  return { consumed, archXp };
}

function completeBarn(instanceId){
  instanceId=instanceId||activeBarnInstanceId;
  const cfg=getBarnConfig(instanceId);
  if(!cfg) return;
  const showBanner=!state.barnUnlocked;
  cfg.doorAshwood=BARN_DOOR_ASHWOOD;
  cfg.doorNails=BARN_DOOR_NAILS;
  cfg.framed=true;
  cfg.roofed=true;
  cfg.complete=true;
  unlockBarns();
  ensureBarnAnimalSlots(cfg);
  if(typeof ensureBarnInterior==='function') ensureBarnInterior(cfg);
  setBarnSlotTypeId(instanceId, 'small_barn_complete');
  scheduleSaveGame();
  const refresh=()=>{
    if(typeof renderPlotGrid==='function') renderPlotGrid();
    if(typeof updateBarnCells==='function') updateBarnCells();
    if(currentScreen==='barn-screen') renderBarnScreen();
    syncUI();
  };
  if(showBanner){
    showStructureBuiltBanner({
      bonusKey:'barn',
      title:'SMALL BARN BUILT!',
      icon:'🏚️',
      body:'The small barn stands — adopt an animal and collect eggs and feathers.',
      btnText:'GOT IT',
      cb:refresh,
    });
  }else{
    refresh();
  }
}

function completeBarnWalls(instanceId){
  instanceId=instanceId||activeBarnInstanceId;
  const cfg=getBarnConfig(instanceId);
  if(!cfg||!isBarnFrameComplete(cfg)) return;
  const showBanner=typeof isStructureStageBonusPending==='function'
    ?isStructureStageBonusPending('barn_walls')
    :!state.barnWallsUnlocked;
  cfg.frameLogs=BARN_FRAME_LOGS;
  cfg.frameNails=BARN_FRAME_NAILS;
  cfg.framed=true;
  unlockBarnWalls();
  setBarnSlotTypeId(instanceId, 'small_barn_walls');
  scheduleSaveGame();
  const refresh=()=>{
    if(typeof renderPlotGrid==='function') renderPlotGrid();
    if(typeof updateBarnCells==='function') updateBarnCells();
    if(currentScreen==='barn-screen') renderBarnScreen();
    syncUI();
  };
  if(showBanner){
    showStructureBuiltBanner({
      bonusKey:'barn_walls',
      title:'WALLS RAISED!',
      icon:'🏚️',
      body:'The small barn stands with walls — add slate and nails for the roof. Wall-only barns are now free to place.',
      btnText:'GOT IT',
      cb:refresh,
    });
  }else{
    refresh();
  }
}

function completeBarnRoof(instanceId){
  instanceId=instanceId||activeBarnInstanceId;
  const cfg=getBarnConfig(instanceId);
  if(!cfg||!isBarnRoofComplete(cfg)) return;
  const showBanner=typeof isStructureStageBonusPending==='function'
    ?isStructureStageBonusPending('barn_roof')
    :!state.barnDoorlessUnlocked;
  cfg.roofSlate=BARN_ROOF_SLATE;
  cfg.roofNails=BARN_ROOF_NAILS;
  cfg.roofed=true;
  unlockBarnDoorless();
  setBarnSlotTypeId(instanceId, 'small_barn_doorless');
  scheduleSaveGame();
  const refresh=()=>{
    if(typeof renderPlotGrid==='function') renderPlotGrid();
    if(typeof updateBarnCells==='function') updateBarnCells();
    if(currentScreen==='barn-screen') renderBarnScreen();
    syncUI();
  };
  if(showBanner){
    showStructureBuiltBanner({
      bonusKey:'barn_roof',
      title:'ROOF LAID!',
      icon:'🏚️',
      body:'The roof is on — add ashwood and nails for the barn door. Doorless barns are now free to place.',
      btnText:'GOT IT',
      cb:refresh,
    });
  }else{
    refresh();
  }
}

function advanceBarnBuildPhase(instanceId, stage){
  instanceId=instanceId||activeBarnInstanceId;
  const cfg=getBarnConfig(instanceId);
  if(!cfg) return;
  if(stage==='frame'&&isBarnFrameComplete(cfg)){
    completeBarnWalls(instanceId);
  }else if(stage==='roof'&&isBarnRoofComplete(cfg)){
    completeBarnRoof(instanceId);
  }else if(stage==='door'&&isBarnComplete(cfg)){
    completeBarn(instanceId);
  }
}

function placeBarnMaterial(event, instanceId, materialKey){
  instanceId=instanceId||activeBarnInstanceId;
  const cfg=getBarnConfig(instanceId);
  if(!cfg||cfg.complete||cfg.freePlaced) return false;
  const stage=getBarnStage(cfg);
  if(stage==='complete') return false;
  const mat=getBarnMaterialDef(materialKey, stage);
  if(!mat) return false;
  const current=cfg[mat.countKey]|0;
  if(current>=mat.required){
    advanceBarnBuildPhase(instanceId, stage);
    return false;
  }
  const needed=mat.required-current;
  let consumed=0;
  let archXp=0;
  if(materialKey==='nails'){
    if(!barnNailsCanAfford(needed)){
      showToast('You need nails — smelt them at the kiln.');
      return false;
    }
    const result=consumeBarnNailsWeakestFirst(needed);
    consumed=result.consumed;
    archXp=result.archXp;
    if(consumed<1){
      showToast('You need nails — smelt them at the kiln.');
      return false;
    }
  }else{
    const available=itemCountBagAndStore(materialKey);
    const amount=Math.min(needed, available);
    if(amount<1){
      showToast('You need more '+mat.name.toLowerCase()+'.');
      return false;
    }
    consumed=consumeUpToFromBagOrStore(materialKey, amount);
    if(consumed<1){
      showToast('You need more '+mat.name.toLowerCase()+'.');
      return false;
    }
    archXp=getBarnArchXpForMaterial(materialKey)*consumed;
  }
  cfg[mat.countKey]=current+consumed;
  const phaseDone=(stage==='frame'&&isBarnFrameComplete(cfg))
    ||(stage==='roof'&&isBarnRoofComplete(cfg))
    ||(stage==='door'&&isBarnComplete(cfg));
  grantXP('architecture', archXp, null, phaseDone&&stage==='door'?{deferLevelUp:true}:null);
  if(phaseDone) advanceBarnBuildPhase(instanceId, stage);
  else{
    if(typeof updateBarnCells==='function') updateBarnCells();
    if(currentScreen==='barn-screen') renderBarnScreen();
    syncUI();
  }
  return true;
}

function barnMenuTap(event){
  event?.stopPropagation();
  if(typeof closeBarnInteriorPlaceMenu==='function') closeBarnInteriorPlaceMenu();
  const instanceId=resolveBarnInstanceId(event);
  if(instanceId) setActiveBarn(instanceId);
  openBarnScreen();
}

function openBarnScreen(){
  if(typeof closeBarnInteriorPlaceMenu==='function') closeBarnInteriorPlaceMenu();
  migrateBarn();
  const instanceId=activeBarnInstanceId;
  if(!instanceId||!barnSlotExists(instanceId)){
    showToast('Mark out a small barn site on your plot first.');
    return;
  }
  const fromInterior=currentScreen==='barn-interior-screen';
  showScreen('barn-screen');
  lastHome=fromInterior?'barn-interior-screen':'exterior-screen';
  renderBarnScreen();
  const cfg=getBarnConfig(instanceId);
  if(cfg&&barnAnyAnimalFeeding(cfg)) startBarnTimer();
  syncUI();
}

function closeBarnScreen(){
  barnTroughPreviewExpanded=false;
  if(typeof closeBarnTroughMenu==='function') closeBarnTroughMenu();
  if(typeof closeBarnInteriorPlaceMenu==='function') closeBarnInteriorPlaceMenu();
  stopBarnTimer();
  if(lastHome==='barn-interior-screen'&&activeBarnInteriorInstanceId&&typeof openBarnInterior==='function'){
    openBarnInterior(activeBarnInteriorInstanceId);
  }else{
    showScreen('exterior-screen');
    lastHome='exterior-screen';
  }
  syncUI();
}

function stopBarnTimer(){
  if(barnTimerHandle){
    clearInterval(barnTimerHandle);
    barnTimerHandle=null;
  }
}

function ensureBarnAnimalSlots(cfg){
  if(!cfg) return;
  const count=getBarnAnimalSlotCount(cfg);
  if(!cfg.animalSlots) cfg.animalSlots=[];
  if(cfg.animalType){
    if(!cfg.animalSlots.some(s=>s?.type)){
      cfg.animalSlots[0]={ type:cfg.animalType, feedEndsAt:cfg.feedEndsAt||null };
    }
    delete cfg.animalType;
    delete cfg.feedEndsAt;
    delete cfg.feedsRemaining;
  }
  while(cfg.animalSlots.length<count){
    cfg.animalSlots.push({ type:null, feedEndsAt:null });
  }
  cfg.animalSlots.length=count;
  for(let i=0;i<count;i++){
    if(!cfg.animalSlots[i]) cfg.animalSlots[i]={ type:null, feedEndsAt:null };
    if(cfg.animalSlots[i].type==null) cfg.animalSlots[i].type=null;
    if(cfg.animalSlots[i].feedEndsAt==null) cfg.animalSlots[i].feedEndsAt=null;
  }
}

function barnHasAnyAnimal(cfg){
  ensureBarnAnimalSlots(cfg);
  return cfg.animalSlots.some(s=>s?.type);
}

function barnActiveAnimalCount(cfg){
  ensureBarnAnimalSlots(cfg);
  return cfg.animalSlots.filter(s=>s?.type).length;
}

function barnHungryAnimalCount(cfg){
  ensureBarnAnimalSlots(cfg);
  return cfg.animalSlots.filter(s=>s?.type&&!barnIsSlotFeeding(s)).length;
}

function barnFirstEmptyAnimalSlotIndex(cfg){
  ensureBarnAnimalSlots(cfg);
  return cfg.animalSlots.findIndex(s=>!s?.type);
}

function barnIsSlotFeeding(slot){
  return !!slot?.feedEndsAt&&Date.now()<slot.feedEndsAt;
}

function barnSlotFeedRemainingMs(slot){
  if(!slot?.feedEndsAt) return 0;
  return Math.max(0, slot.feedEndsAt-Date.now());
}

function barnSlotFeedCountdownLabel(slot){
  const sec=Math.max(1, Math.ceil(barnSlotFeedRemainingMs(slot)/1000));
  return sec+'s';
}

function barnAnyAnimalFeeding(cfg){
  ensureBarnAnimalSlots(cfg);
  return cfg.animalSlots.some(s=>s?.type&&barnIsSlotFeeding(s));
}

function ensureBarnStoredLoot(cfg){
  if(!cfg) return;
  if(!cfg.storedLoot||typeof cfg.storedLoot!=='object') cfg.storedLoot={};
  const emptyShape=typeof emptyBarnStoredLootShape==='function'?emptyBarnStoredLootShape():{ eggs:0, feathers:0, earthShards:0 };
  BARN_ANIMAL_ORDER.forEach(key=>{
    if(!cfg.storedLoot[key]) cfg.storedLoot[key]={ ...emptyShape };
    const loot=cfg.storedLoot[key];
    if(loot.earthShards==null) loot.earthShards=0;
    (BARN_STORAGE_PRODUCE_KEYS||[]).forEach(pk=>{
      if(loot[pk]==null) loot[pk]=0;
    });
    if((loot.leather|0)>0){
      loot.uncured_cow_hide=(loot.uncured_cow_hide|0)+(loot.leather|0);
      loot.leather=0;
    }
    if(loot.eggs==null) loot.eggs=0;
    if(loot.feathers==null) loot.feathers=0;
  });
}

function barnStoredProduceTotal(cfg, produceKey){
  ensureBarnStoredLoot(cfg);
  return BARN_ANIMAL_ORDER.reduce((n,k)=>n+barnStoredLootCount(cfg.storedLoot[k], produceKey),0);
}

function barnStoredEggsTotal(cfg){
  return barnStoredProduceTotal(cfg,'eggs');
}

function barnStoredFeathersTotal(cfg){
  return barnStoredProduceTotal(cfg,'feathers');
}

function barnStoredCollectXpTotal(cfg){
  ensureBarnStoredLoot(cfg);
  return BARN_ANIMAL_ORDER.reduce((sum,k)=>{
    const loot=cfg.storedLoot[k];
    if(!loot) return sum;
    const xpEach=typeof husbandryXpPerBarnCollect==='function'?husbandryXpPerBarnCollect(k):0;
    let units=0;
    (BARN_STORAGE_PRODUCE_KEYS||[]).forEach(pk=>{
      const n=barnStoredLootCount(loot,pk);
      if(n>0) units+=n;
    });
    return sum+xpEach*units;
  },0);
}

function syncBarnStoredTotals(cfg){
  cfg.storedEggs=barnStoredEggsTotal(cfg);
  cfg.storedFeathers=barnStoredFeathersTotal(cfg);
  cfg.storedCollectXp=barnStoredCollectXpTotal(cfg);
}

function migrateBarnStoredLoot(cfg){
  if(!cfg) return;
  ensureBarnStoredLoot(cfg);
  if(cfg._storedLootMigrated) return;
  const flatEggs=cfg.storedEggs|0;
  const flatFeathers=cfg.storedFeathers|0;
  const typedTotal=barnStoredEggsTotal(cfg)+barnStoredFeathersTotal(cfg);
  if(flatEggs+flatFeathers>0&&typedTotal<1){
    const items=flatEggs+flatFeathers;
    let type='chicken';
    if(cfg.storedCollectXp|0){
      const xpPerItem=Math.round(cfg.storedCollectXp/items);
      if(xpPerItem>=14) type='duck';
    }
    cfg.storedLoot[type].eggs=flatEggs;
    cfg.storedLoot[type].feathers=flatFeathers;
  }
  syncBarnStoredTotals(cfg);
  cfg._storedLootMigrated=true;
}

function clearBarnStoredLoot(cfg){
  ensureBarnStoredLoot(cfg);
  const emptyShape=typeof emptyBarnStoredLootShape==='function'?emptyBarnStoredLootShape():{ eggs:0, feathers:0, earthShards:0 };
  BARN_ANIMAL_ORDER.forEach(key=>{ cfg.storedLoot[key]={ ...emptyShape }; });
  cfg.storedEggs=0;
  cfg.storedFeathers=0;
  cfg.storedCollectXp=0;
}

function isBarnLiveUIScreen(){
  return currentScreen==='barn-screen'||currentScreen==='barn-interior-screen';
}

function refreshBarnLiveUI(cfg){
  if(!cfg) cfg=getBarnConfig(activeBarnInstanceId);
  if(!cfg) return;
  if(currentScreen==='barn-screen'){
    renderBarnAnimalSlots(cfg);
    const troughEl=document.getElementById('barn-trough-section');
    if(troughEl) troughEl.innerHTML=renderBarnTroughSection(cfg);
    renderBarnAnimalPanel(cfg);
    renderBarnAnimalStatus(cfg);
  }
  if(currentScreen==='barn-interior-screen'&&typeof renderBarnInteriorGrid==='function'){
    const icfg=getBarnConfig(activeBarnInteriorInstanceId||activeBarnInstanceId);
    if(icfg&&typeof syncBarnInteriorPenAnimals==='function') syncBarnInteriorPenAnimals(icfg);
    renderBarnInteriorGrid();
  }
}

function startBarnTimer(){
  stopBarnTimer();
  barnTimerHandle=setInterval(()=>{
    if(!isBarnLiveUIScreen()){
      stopBarnTimer();
      return;
    }
    const cfg=getBarnConfig(activeBarnInstanceId);
    if(!cfg||!barnHasAnyAnimal(cfg)){
      stopBarnTimer();
      return;
    }
    const hadFeeding=barnAnyAnimalFeeding(cfg);
    processBarnFeedCatchUp(cfg);
    if(barnAnyAnimalFeeding(cfg)||hadFeeding){
      refreshBarnLiveUI(cfg);
    }
    if(processBarnTroughAutoFeed(cfg)&&currentScreen==='barn-screen') renderBarnScreen();
    if(!barnAnyAnimalFeeding(cfg)){
      if(currentScreen==='barn-screen') renderBarnScreen();
      stopBarnTimer();
      syncUI();
    }
  },1000);
}

function barnFeathersInBarnStorage(cfg){
  return barnStoredProduceTotal(cfg,'feathers');
}

function barnFeathersCountedTowardCap(cfg){
  const feathers=barnFeathersInBarnStorage(cfg);
  const pocketFree=typeof getFeatherPocketFreeSpace==='function'?getFeatherPocketFreeSpace():0;
  return Math.max(0, feathers-pocketFree);
}

function barnEffectiveStorageCap(cfg){
  const base=typeof barnStorageCap==='function'?barnStorageCap(cfg):50;
  const pocketCap=typeof getEquippedFeatherPocketCap==='function'?getEquippedFeatherPocketCap():0;
  return base+pocketCap;
}

function barnStorageTotal(cfg){
  ensureBarnStoredLoot(cfg);
  let total=0;
  (BARN_STORAGE_PRODUCE_KEYS||[]).forEach(pk=>{
    if(pk==='feathers') total+=barnFeathersCountedTowardCap(cfg);
    else total+=barnStoredProduceTotal(cfg,pk);
  });
  return total;
}

function barnInteriorStorageBonus(cfg){
  const placements=cfg?.barnInterior?.customPlacements;
  if(!placements||typeof placements!=='object') return 0;
  let bonus=0;
  Object.values(placements).forEach((key)=>{
    const def=typeof getBarnInteriorPlaceableDef==='function'?getBarnInteriorPlaceableDef(key):null;
    if(def?.storageBonus) bonus+=def.storageBonus;
  });
  return bonus;
}

function barnStorageCap(cfg){
  let cap=typeof BARN_STORAGE_CAP==='number'?BARN_STORAGE_CAP:50;
  if(cfg&&typeof isLargeBarn==='function'&&isLargeBarn(cfg)){
    cap=typeof BARN_LARGE_STORAGE_CAP==='number'?BARN_LARGE_STORAGE_CAP:400;
    cap+=barnInteriorStorageBonus(cfg);
  }
  return cap;
}

function barnStorageSpace(cfg){
  return Math.max(0, barnStorageCap(cfg)-barnStorageTotal(cfg));
}

function barnStorageFull(cfg){
  return barnStorageSpace(cfg)<1;
}

function addToBarnStorage(cfg, produce, animalType){
  if(!cfg||!produce||!animalType) return 0;
  ensureBarnStoredLoot(cfg);
  if(!cfg.storedLoot[animalType]) cfg.storedLoot[animalType]=typeof emptyBarnStoredLootShape==='function'?emptyBarnStoredLootShape():{};
  let space=barnStorageSpace(cfg);
  let added=0;
  const loot=cfg.storedLoot[animalType];
  (BARN_STORAGE_PRODUCE_KEYS||[]).forEach(pk=>{
    const want=produce[pk]|0;
    if(want<1||space<1) return;
    const n=Math.min(want, space);
    if(n>0){
      loot[pk]=(loot[pk]|0)+n;
      space-=n;
      added+=n;
    }
  });
  const shards=produce.earthShards|0;
  if(shards>0){
    loot.earthShards=(loot.earthShards|0)+shards;
    added+=shards;
  }
  if(added>0) syncBarnStoredTotals(cfg);
  return added;
}

function processBarnFeedCatchUp(cfg){
  if(!cfg) return false;
  ensureBarnAnimalSlots(cfg);
  let changed=false;
  cfg.animalSlots.forEach(slot=>{
    if(!slot?.type||!slot.feedEndsAt||Date.now()<slot.feedEndsAt) return;
    const produce=typeof rollBarnAnimalProduce==='function'?rollBarnAnimalProduce(slot.type, cfg):{ eggs:0, feathers:0 };
    if(addToBarnStorage(cfg, produce, slot.type)>0) changed=true;
    slot.feedEndsAt=null;
    changed=true;
  });
  if(changed) scheduleSaveGame();
  return changed;
}

function barnHasStoredProduce(cfg){
  if(barnStorageTotal(cfg)>0) return true;
  ensureBarnStoredLoot(cfg);
  return BARN_ANIMAL_ORDER.some(k=>barnStoredEarthShards(cfg.storedLoot[k])>0);
}

function barnPrimaryAnimalType(cfg){
  ensureBarnAnimalSlots(cfg);
  const slot=cfg.animalSlots.find(s=>s?.type);
  return slot?.type||null;
}

let pendingBarnAdoptPenSlot=null;

function activeBarnMenuInstanceId(){
  return activeBarnInteriorInstanceId||activeBarnInstanceId;
}

function adoptBarnAnimal(animalKey, slotIdx){
  const instanceId=activeBarnMenuInstanceId();
  const cfg=getBarnConfig(instanceId);
  if(!cfg) return;
  ensureBarnAnimalSlots(cfg);
  if(typeof slotIdx!=='number'||slotIdx<0) slotIdx=barnFirstEmptyAnimalSlotIndex(cfg);
  if(slotIdx<0){
    showToast('All animal slots are full.');
    return;
  }
  if(cfg.animalSlots[slotIdx]?.type){
    showToast('That pen is already occupied.');
    return;
  }
  const def=getBarnAnimalDef(animalKey);
  if(!def) return;
  if(!isBarnAnimalUnlocked(animalKey)){
    showToast('Reach Husbandry Lv '+def.unlockLevel+' to adopt a '+def.name.toLowerCase()+'.');
    return;
  }
  if(itemCountBagAndStore(def.adoptCostKey)<def.adoptCostAmount){
    showToast('Need '+def.adoptCostAmount+' '+def.adoptCostLabel+'.');
    return;
  }
  if(!consumeManyFromBagOrStore(def.adoptCostKey, def.adoptCostAmount)){
    showToast('Could not pay adoption cost.');
    return;
  }
  cfg.animalSlots[slotIdx]={ type:animalKey, feedEndsAt:null };
  scheduleSaveGame();
  if(typeof closeBarnAdoptMenu==='function') closeBarnAdoptMenu();
  showToast(def.icon+' '+def.name+' moved into the barn!');
  renderBarnScreen();
  if(typeof syncBarnInteriorPenAnimals==='function') syncBarnInteriorPenAnimals(cfg);
  if(typeof renderBarnInteriorGrid==='function'&&activeBarnInteriorInstanceId===instanceId) renderBarnInteriorGrid();
  syncUI();
}

let barnAdoptMenuCloser=null;

function closeBarnAdoptMenu(){
  document.getElementById('barn-int-adopt-menu')?.remove();
  if(barnAdoptMenuCloser){
    document.removeEventListener('pointerdown', barnAdoptMenuCloser, true);
    barnAdoptMenuCloser=null;
  }
}

function bindBarnAdoptMenuCloser(){
  if(barnAdoptMenuCloser){
    document.removeEventListener('pointerdown', barnAdoptMenuCloser, true);
    barnAdoptMenuCloser=null;
  }
  setTimeout(()=>{
    barnAdoptMenuCloser=function(e){
      const menu=document.getElementById('barn-int-adopt-menu');
      if(!menu){
        document.removeEventListener('pointerdown', barnAdoptMenuCloser, true);
        barnAdoptMenuCloser=null;
        return;
      }
      if(menu.contains(e.target)) return;
      closeBarnAdoptMenu();
    };
    document.addEventListener('pointerdown', barnAdoptMenuCloser, true);
  }, 80);
}

function openBarnAdoptMenu(penSlotIdx){
  const instanceId=activeBarnMenuInstanceId();
  const cfg=getBarnConfig(instanceId);
  if(!cfg) return;
  ensureBarnAnimalSlots(cfg);
  if(typeof penSlotIdx!=='number'||penSlotIdx<0) penSlotIdx=barnFirstEmptyAnimalSlotIndex(cfg);
  if(penSlotIdx<0){
    showToast('All animal pens are full.');
    return;
  }
  if(cfg.animalSlots[penSlotIdx]?.type){
    showToast('That pen is already occupied.');
    return;
  }
  closeBarnAdoptMenu();
  if (typeof closeBarnInteriorPlaceMenu === 'function') closeBarnInteriorPlaceMenu();
  const w=document.getElementById('game-wrapper');
  if(!w) return;
  const m=document.createElement('div');
  m.id='barn-int-adopt-menu';
  m.className='plot-add-menu barn-menu';
  m.onclick=(e)=>e.stopPropagation();
  const options=renderBarnAdoptOptions(cfg, penSlotIdx);
  if(!options){
    showToast('No animals available yet — raise Husbandry level.');
    return;
  }
  m.innerHTML='<div class="plot-add-title">Add animal</div>'
    +'<div class="plot-add-sub">Pen '+(penSlotIdx+1)+' — pick livestock for this pen.</div>'
    +'<div class="plot-add-items barn-adopt-items">'+options+'</div>'
    +'<button type="button" class="plot-add-cancel" onclick="closeBarnAdoptMenu()">cancel</button>';
  w.appendChild(m);
  bindBarnAdoptMenuCloser();
}

function barnOpenInteriorForPen(slotIdx){
  pendingBarnAdoptPenSlot=slotIdx;
  openBarnInterior(activeBarnInstanceId);
}

function ensureBarnTroughStock(cfg){
  if(!cfg) return;
  if(!cfg.troughStock||typeof cfg.troughStock!=='object') cfg.troughStock={};
  if(typeof BARN_TROUGH_FOOD_KEYS!=='undefined'){
    BARN_TROUGH_FOOD_KEYS.forEach(fk=>{
      if(cfg.troughStock[fk]==null) cfg.troughStock[fk]=0;
    });
  }
  if(cfg.troughAutoFeed==null) cfg.troughAutoFeed=false;
}

function clampBarnTroughStock(cfg){
  if(!cfg) return;
  ensureBarnTroughStock(cfg);
  if(typeof barnTroughFoodCapPerType!=='function') return;
  const caps=barnTroughFoodCapPerType(cfg.barnInterior);
  (BARN_TROUGH_FOOD_KEYS||[]).forEach(fk=>{
    cfg.troughStock[fk]=Math.min(cfg.troughStock[fk]|0, caps[fk]|0);
  });
}

function barnHasTroughCapacity(cfg){
  const summary=typeof barnTroughCapacitySummary==='function'
    ?barnTroughCapacitySummary(cfg?.barnInterior)
    :{ hasTroughs:false };
  return !!summary.hasTroughs;
}

function barnFoodAvailableForFeed(cfg, foodKey, amount){
  ensureBarnTroughStock(cfg);
  const need=Math.max(1, amount|0);
  if((cfg.troughStock[foodKey]|0)>=need) return true;
  return itemCountBagAndStore(foodKey)>=need;
}

function barnConsumeFoodForFeed(cfg, food){
  const need=Math.max(1, food.amount|0);
  ensureBarnTroughStock(cfg);
  const key=food.key;
  const inTrough=cfg.troughStock[key]|0;
  if(inTrough>=need){
    cfg.troughStock[key]=inTrough-need;
    recordBarnTroughFoodUse(cfg, key);
    return true;
  }
  if(itemCountBagAndStore(key)<need) return false;
  if(!consumeManyFromBagOrStore(key, need)) return false;
  recordBarnTroughFoodUse(cfg, key);
  return true;
}

function recordBarnTroughFoodUse(cfg, foodKey){
  if(!cfg||!foodKey) return;
  if(!cfg.troughRecentFoods) cfg.troughRecentFoods=[];
  cfg.troughRecentFoods=cfg.troughRecentFoods.filter(k=>k!==foodKey);
  cfg.troughRecentFoods.unshift(foodKey);
  if(cfg.troughRecentFoods.length>12) cfg.troughRecentFoods.length=12;
}

function processBarnTroughAutoFeed(cfg){
  if(!cfg?.troughAutoFeed||!barnHasAnyAnimal(cfg)) return false;
  if(barnStorageFull(cfg)) return false;
  processBarnFeedCatchUp(cfg);
  const hungry=cfg.animalSlots.filter(s=>s?.type&&!barnIsSlotFeeding(s));
  if(!hungry.length) return false;
  let fed=0;
  hungry.forEach(slot=>{
    const def=getBarnAnimalDef(slot.type);
    if(!def) return;
    const food=typeof getBarnAnimalPrimaryFood==='function'?getBarnAnimalPrimaryFood(def):{ key:'wheat', amount:1 };
    if(!barnConsumeFoodForFeed(cfg, food)) return;
    slot.feedEndsAt=Date.now()+def.feedMs;
    fed++;
  });
  if(fed>0) scheduleSaveGame();
  return fed>0;
}

function fillBarnTroughFromBag(){
  const cfg=getBarnConfig(activeBarnInstanceId);
  if(!cfg) return;
  if(!barnHasTroughCapacity(cfg)){
    showToast('Place a trough inside the barn first.');
    return;
  }
  const summary=barnTroughCapacitySummary(cfg.barnInterior);
  ensureBarnTroughStock(cfg);
  let moved=0;
  (BARN_TROUGH_FOOD_KEYS||[]).forEach(fk=>{
    const cap=summary.perTypeCap|0;
    const room=Math.max(0, cap-(cfg.troughStock[fk]|0));
    if(room<1) return;
    const take=Math.min(room, itemCountBagAndStore(fk));
    if(take<1) return;
    if(!consumeManyFromBagOrStore(fk, take)) return;
    cfg.troughStock[fk]=(cfg.troughStock[fk]|0)+take;
    moved+=take;
  });
  clampBarnTroughStock(cfg);
  scheduleSaveGame();
  if(moved<1) showToast('No feed in bag or storage, or troughs are full.');
  else showToast('Added '+moved+' feed to the trough.');
  renderBarnScreen();
  syncUI();
}

function toggleBarnTroughAutoFeed(){
  const cfg=getBarnConfig(activeBarnInstanceId);
  if(!cfg) return;
  ensureBarnTroughStock(cfg);
  cfg.troughAutoFeed=!cfg.troughAutoFeed;
  scheduleSaveGame();
  if(cfg.troughAutoFeed) processBarnTroughAutoFeed(cfg);
  showToast(cfg.troughAutoFeed?'Auto-feed on — hungry animals eat from the trough or bag.':'Auto-feed off.');
  renderBarnScreen();
  if(cfg.troughAutoFeed) startBarnTimer();
  syncUI();
}

function closeBarnTroughMenu(){
  document.getElementById('barn-trough-menu')?.remove();
}

function openBarnTroughMenu(){
  closeBarnTroughMenu();
  const cfg=getBarnConfig(activeBarnInstanceId);
  if(!cfg) return;
  ensureBarnTroughStock(cfg);
  const w=document.getElementById('game-wrapper');
  if(!w) return;
  const m=document.createElement('div');
  m.id='barn-trough-menu';
  m.className='plot-add-menu barn-trough-menu barn-menu';
  m.onclick=(e)=>e.stopPropagation();
  const summary=typeof barnTroughCapacitySummary==='function'
    ?barnTroughCapacitySummary(cfg.barnInterior)
    :{ hasTroughs:false, perTypeCap:0, parts:[] };
  let capHtml='';
  if(summary.hasTroughs){
    capHtml='<p class="barn-trough-menu-cap">'
      +(summary.parts.length?summary.parts.join(' · ')+' — ':'')
      +summary.perTypeCap+' max per feed type</p>';
  }else{
    capHtml='<p class="barn-trough-menu-cap barn-trough-menu-cap--warn">No trough placed — add copper, bronze, or iron troughs inside the barn.</p>';
  }
  const stockLines=(BARN_TROUGH_FOOD_KEYS||[]).map(fk=>{
    const foodDef=BARN_ANIMAL_FOODS[fk];
    const label=foodDef?.name||fk;
    const stock=cfg.troughStock[fk]|0;
    const cap=summary.perTypeCap|0;
    return '<div class="barn-trough-menu-stock">'+label+': <strong>'+stock+'</strong>/'+cap+'</div>';
  }).join('');
  const animalLines=typeof barnGroupedAnimalTroughLines==='function'
    ?barnGroupedAnimalTroughLines(cfg, cfg.troughStock)
    :[];
  const dietHtml=animalLines.length
    ?('<div class="barn-trough-menu-diet">'+animalLines.map(l=>'<div class="barn-trough-menu-animal">'+l+'</div>').join('')+'</div>')
    :'<p class="barn-trough-menu-empty">No livestock in this barn.</p>';
  const autoOn=!!cfg.troughAutoFeed;
  const menuCap=summary.perTypeCap|0;
  m.innerHTML='<div class="plot-add-title">Trough'+(menuCap>0?' ('+menuCap+' per type max)':'')+'</div>'
    +capHtml
    +'<div class="store-items-title">TROUGH STOCK</div>'
    +'<div class="barn-trough-menu-stocks">'+stockLines+'</div>'
    +'<div class="store-items-title">LIVESTOCK</div>'
    +dietHtml
    +'<div class="barn-trough-menu-actions">'
    +'<button type="button" class="wb-btn once" onclick="toggleBarnTroughAutoFeed();closeBarnTroughMenu()">'
    +(autoOn?'✓ Auto-feed ON':'Auto-feed OFF')+'</button>'
    +'<button type="button" class="wb-btn once" onclick="fillBarnTroughFromBag();closeBarnTroughMenu()">Fill from bag</button>'
    +'<button type="button" class="wb-btn once" onclick="feedAllBarnAnimals();closeBarnTroughMenu()">Feed hungry</button>'
    +'</div>'
    +'<button type="button" class="plot-add-cancel" onclick="closeBarnTroughMenu()">close</button>';
  w.appendChild(m);
  setTimeout(()=>{
    document.addEventListener('click', barnTroughMenuOutsideClick, { once:true });
  }, 0);
}

function barnTroughMenuOutsideClick(e){
  const menu=document.getElementById('barn-trough-menu');
  if(menu&&!menu.contains(e.target)) closeBarnTroughMenu();
}

function feedAllBarnAnimals(){
  const cfg=getBarnConfig(activeBarnInstanceId);
  if(!cfg||!barnHasAnyAnimal(cfg)) return;
  processBarnFeedCatchUp(cfg);
  if(barnStorageFull(cfg)){
    showToast('Barn storage is full ('+barnEffectiveStorageCap(cfg)+') — collect first.');
    renderBarnScreen();
    return;
  }
  const hungry=cfg.animalSlots.filter(s=>s?.type&&!barnIsSlotFeeding(s));
  if(!hungry.length){
    showToast('Every animal is already eating.');
    renderBarnScreen();
    return;
  }
  let fed=0;
  hungry.forEach(slot=>{
    const def=getBarnAnimalDef(slot.type);
    if(!def) return;
    const food=typeof getBarnAnimalPrimaryFood==='function'?getBarnAnimalPrimaryFood(def):{ key:'wheat', amount:1 };
    if(!barnConsumeFoodForFeed(cfg, food)) return;
    slot.feedEndsAt=Date.now()+def.feedMs;
    fed++;
  });
  if(fed<1){
    showToast('Need feed in the trough or bag.');
    renderBarnScreen();
    return;
  }
  scheduleSaveGame();
  showToast('Fed '+fed+' animal'+(fed===1?'':'s')+' — one feed each.');
  renderBarnScreen();
  startBarnTimer();
  syncUI();
}

function grantBarnPocketEarthShards(cfg){
  ensureBarnStoredLoot(cfg);
  let shards=0;
  BARN_ANIMAL_ORDER.forEach(k=>{
    shards+=barnStoredEarthShards(cfg.storedLoot[k]);
  });
  if(shards<1) return 0;
  if(!state.pockets) state.pockets={ fire:0, water:0, earth:0, air:0, magic:0 };
  state.pockets.earth=(state.pockets.earth|0)+shards;
  return shards;
}

function collectBarnMilkUnits(milkUnits){
  if(milkUnits<1) return { filled: 0, wasted: 0 };
  let bottles=typeof itemCountBagAndStore==='function'?itemCountBagAndStore('glass_bottle'):0;
  let buckets=typeof itemCountBagAndStore==='function'?itemCountBagAndStore('bucket'):0;
  const containers=bottles+buckets;
  const fill=Math.min(milkUnits, containers);
  const wasted=milkUnits-fill;
  if(wasted>0){
    showToast('Warning: you don\'t have enough milk containers — any excess will be wasted.');
  }
  let remaining=fill;
  const bottleDef=BARN_ANIMAL_PRODUCE.bottle_of_milk;
  const bucketDef=BARN_ANIMAL_PRODUCE.bucket_of_milk;
  const useBottles=Math.min(bottles, remaining);
  for(let i=0;i<useBottles;i++){
    if(!consumeOneFromBagOrStore('glass_bottle')) break;
    invAdd('bottle_of_milk', bottleDef.icon, bottleDef.name, 1);
    remaining--;
  }
  for(let i=0;i<remaining;i++){
    if(!consumeOneFromBagOrStore('bucket')) break;
    invAdd('bucket_of_milk', bucketDef.icon, bucketDef.name, 1);
  }
  return { filled: fill, wasted };
}

function invAddBarnProduceKey(produceKey, count){
  if(count<1) return;
  const def=typeof barnProduceDef==='function'?barnProduceDef(produceKey):BARN_ANIMAL_PRODUCE[produceKey];
  if(!def||def.internal) return;
  const invKey=typeof barnInventoryKeyForStoredProduce==='function'
    ?barnInventoryKeyForStoredProduce(produceKey)
    :(def.key||produceKey);
  invAdd(invKey, def.icon, def.name, count);
}

function barnCollectWithdrawPlan(cfg){
  const plan={ items:[], shortfall:[] };
  let invRoom=Math.max(0, getInvCap()-invTotal());
  let pocketRoom=typeof getFeatherPocketFreeSpace==='function'?getFeatherPocketFreeSpace():0;
  (BARN_STORAGE_PRODUCE_KEYS||[]).forEach(pk=>{
    const n=barnStoredProduceTotal(cfg,pk);
    if(n<1||pk==='milk') return;
    let canTake=0;
    if(pk==='feathers'){
      const toPocket=Math.min(n, pocketRoom);
      pocketRoom-=toPocket;
      const rest=Math.min(n-toPocket, invRoom);
      invRoom-=rest;
      canTake=toPocket+rest;
    }else{
      canTake=Math.min(n, invRoom);
      invRoom-=canTake;
    }
    plan.items.push({ pk, n, canTake });
    if(canTake<n){
      const def=barnProduceDef(pk);
      const label=(def?.name||pk).toLowerCase();
      plan.shortfall.push((n-canTake)+' '+label);
    }
  });
  return plan;
}

function collectAllBarnStorage(){
  const cfg=getBarnConfig(activeBarnInstanceId);
  if(!cfg) return;
  processBarnFeedCatchUp(cfg);
  if(!barnHasStoredProduce(cfg)){
    showToast('Barn storage is empty.');
    renderBarnScreen();
    return;
  }
  const plan=barnCollectWithdrawPlan(cfg);
  if(plan.items.every(i=>i.canTake<1)){
    showToast('Not enough inventory space — free bag slots'
      +(typeof getEquippedFeatherPocketCap==='function'&&getEquippedFeatherPocketCap()>0?' or feather pocket room':'')
      +'.');
    renderBarnScreen();
    return;
  }
  const xp=barnStoredCollectXpTotal(cfg);
  const bits=[];
  const milkTotal=barnStoredProduceTotal(cfg,'milk');
  if(milkTotal>0) collectBarnMilkUnits(milkTotal);
  let partial=false;
  (BARN_STORAGE_PRODUCE_KEYS||[]).forEach(pk=>{
    if(pk==='milk') return;
    const row=plan.items.find(i=>i.pk===pk);
    if(!row||row.n<1) return;
    if(row.canTake<1){
      if(row.n>0) partial=true;
      return;
    }
    if(pk==='feathers'){
      const total=row.n;
      const toPocket=typeof tryAddFeathersToPocket==='function'?tryAddFeathersToPocket(total):0;
      const rest=total-toPocket;
      let toInv=0;
      if(rest>0&&typeof tryAddFeathersToInventory==='function'){
        toInv=tryAddFeathersToInventory(rest, invTotal());
      }
      const moved=toPocket+toInv;
      if(moved>0){
        barnRemoveStoredProduce(cfg,'feathers', moved);
        bits.push(moved+'× 🪶');
      }
      if(moved<total) partial=true;
      return;
    }
    invAddBarnProduceKey(pk, row.canTake);
    const def=barnProduceDef(pk)||BARN_ANIMAL_PRODUCE[pk];
    if(def) bits.push(row.canTake+'× '+def.icon);
    if(row.canTake<row.n){
      barnRemoveStoredProduce(cfg, pk, row.n-row.canTake);
      partial=true;
    }else{
      barnClearStoredProduceType(cfg, pk);
    }
  });
  const earthShards=grantBarnPocketEarthShards(cfg);
  if(earthShards>0){
    const m=typeof SHARD_META!=='undefined'?SHARD_META.earth:{ icon:'🌿', name:'Earth Shard' };
    bits.push(earthShards+'× '+m.icon);
  }
  if(!partial&&!barnHasStoredProduce(cfg)){
    clearBarnStoredLoot(cfg);
  }
  if(xp>0) grantXP('husbandry', xp, null);
  scheduleSaveGame();
  let msg=bits.length?'Collected '+bits.join(', '):'Collected barn goods';
  if(plan.shortfall.length){
    msg+=' — could not take '+plan.shortfall.join(', ')+' (bag full).';
  }
  if(xp) msg+=' · +'+xp+' Husbandry';
  showToast(msg);
  renderBarnScreen();
  syncUI();
}

function barnClearStoredProduceType(cfg, produceKey){
  ensureBarnStoredLoot(cfg);
  BARN_ANIMAL_ORDER.forEach(k=>{
    if(cfg.storedLoot[k]) cfg.storedLoot[k][produceKey]=0;
  });
  syncBarnStoredTotals(cfg);
}

function barnRemoveStoredProduce(cfg, produceKey, amount){
  let left=amount|0;
  if(left<1) return;
  ensureBarnStoredLoot(cfg);
  BARN_ANIMAL_ORDER.forEach(k=>{
    if(left<1) return;
    const loot=cfg.storedLoot[k];
    if(!loot) return;
    const take=Math.min(left, barnStoredLootCount(loot, produceKey));
    loot[produceKey]=(barnStoredLootCount(loot, produceKey)-take);
    left-=take;
  });
  syncBarnStoredTotals(cfg);
}

function barnAnimalSlotTap(slotIdx){
  const cfg=getBarnConfig(activeBarnInstanceId);
  if(!cfg) return;
  ensureBarnAnimalSlots(cfg);
  const slot=cfg.animalSlots[slotIdx];
  if(!slot?.type) return;
  const def=getBarnAnimalDef(slot.type);
  if(!def) return;
  let body='Release this animal from the barn? The slot will open so you can adopt a different one.';
  if(barnIsSlotFeeding(slot)){
    body='This '+def.name.toLowerCase()+' is still eating — dismissing will cancel the current feed. '+body;
  }
  showChoiceBanner(
    'Dismiss '+def.name+'?',
    def.icon,
    body,
    'Dismiss',
    'Keep '+def.name,
    ()=>dismissBarnAnimal(slotIdx)
  );
}

function dismissBarnAnimal(slotIdx){
  const cfg=getBarnConfig(activeBarnInstanceId);
  if(!cfg) return;
  ensureBarnAnimalSlots(cfg);
  const slot=cfg.animalSlots[slotIdx];
  if(!slot?.type) return;
  const def=getBarnAnimalDef(slot.type);
  processBarnFeedCatchUp(cfg);
  cfg.animalSlots[slotIdx]={ type:null, feedEndsAt:null };
  scheduleSaveGame();
  stopBarnTimer();
  showToast((def?.icon||'')+' '+(def?.name||'Animal')+' left the barn.');
  renderBarnScreen();
  syncUI();
}

function barnHusbandryLevelBadge(required){
  const current=Number(state.skills.husbandry?.level)||1;
  const cls=current>=required?'ok':'low';
  const icon=SKILL_META.husbandry?.icon||'🐾';
  return '<span class="plot-add-level-badge '+cls+'">'
    +'<span class="plot-add-level-icon">'+icon+'</span>'
    +'<span class="plot-add-level-text">'+current+'/'+required+'</span>'
    +'</span>';
}

function barnHusbandryLevelBadges(required){
  return '<span class="kiln-skill-level-stack">'+barnHusbandryLevelBadge(required)+'</span>';
}

function barnResourceLineHtml(prefix, resourceLabel, stock, need){
  const cls=wbStockClass(stock, need);
  const label=prefix?(prefix+' '+resourceLabel):resourceLabel;
  return '<span class="wb-mat-stock wb-mat-pick-line '+cls+'">'
    +formatRecipeMatLine(label, need, stock)
    +'</span>';
}

function barnAnimalTitleHtml(animalKey){
  const def=getBarnAnimalDef(animalKey);
  if(!def) return '';
  const secs=barnAnimalFeedSeconds(animalKey);
  return '<span class="plot-add-item-title">'+def.name
    +' <span class="barn-animal-timer">'+secs+'s</span></span>';
}

function barnAnimalAdoptLineHtml(def){
  const stock=itemCountBagAndStore(def.adoptCostKey);
  const label=def.adoptCostLabel||def.adoptCostKey;
  return barnResourceLineHtml('adopt', label, stock, def.adoptCostAmount);
}

function barnAnimalEatsLineHtml(animalKey){
  const def=getBarnAnimalDef(animalKey);
  const food=typeof getBarnAnimalPrimaryFood==='function'?getBarnAnimalPrimaryFood(def):{ key:'wheat', amount:1, label:'wheat' };
  const stock=itemCountBagAndStore(food.key);
  const label=food.amount>1?food.amount+'× '+food.label:food.label;
  return barnResourceLineHtml('eats', label, stock, food.amount);
}

function barnAnimalProducesLineHtml(animalKey){
  const text=barnAnimalProducesText(animalKey);
  if(!text) return '';
  return '<span class="wb-mat-stock barn-animal-produces-line">'+text+'</span>';
}

function barnArchLevelBadge(required){
  const current=Number(state.skills.architecture?.level)||1;
  const cls=current>=required?'ok':'low';
  const icon=SKILL_META.architecture?.icon||'🏗️';
  return '<span class="plot-add-level-badge '+cls+'">'
    +'<span class="plot-add-level-icon">'+icon+'</span>'
    +'<span class="plot-add-level-text">'+current+'/'+required+'</span>'
    +'</span>';
}

function renderBarnUpgradeMaterials(){
  const nailsAvail=totalFiniteBarnNailsAvailable();
  return BARN_UPGRADE_MATERIALS.map(m=>{
    const stock=m.key==='nails'?nailsAvail:itemCountBagAndStore(m.key);
    return barnResourceLineHtml('need', m.name.toLowerCase(), stock, m.required);
  }).join('');
}

function toggleBarnUpgradeSection(){
  document.querySelector('.barn-upgrade-cat')?.classList.toggle('open');
}

function barnLargeUpgradeMaterialsMet(){
  return BARN_LARGE_UPGRADE_MATERIALS.every(m=>itemCountBagAndStore(m.key)>=m.required);
}

function consumeBarnLargeUpgradeMaterials(){
  for(const m of BARN_LARGE_UPGRADE_MATERIALS){
    if(consumeUpToFromBagOrStore(m.key, m.required)<m.required) return false;
  }
  return true;
}

function canUpgradeMediumBarnToLarge(instanceId){
  instanceId=instanceId||activeBarnInstanceId;
  const cfg=getBarnConfig(instanceId);
  if(!cfg||getBarnStage(cfg)!=='complete'||isLargeBarn(cfg)) return false;
  if(!isMediumBarn(cfg)) return false;
  if((Number(state.skills.architecture?.level)||1)<BARN_LARGE_UPGRADE_ARCH_UNLOCK) return false;
  return barnLargeUpgradeMaterialsMet();
}

function applyLargeBarnOnSlot(slot, cfg){
  if(!slot||!cfg) return;
  cfg.size='large';
  cfg.complete=true;
  slot.typeId=getLargeBarnTypeId();
  state.largeBarnUnlocked=true;
  ensureBarnAnimalSlots(cfg);
  ensureBarnInterior(cfg);
}

function upgradeMediumBarnToLarge(){
  migrateBarn();
  const instanceId=activeBarnInstanceId;
  if(!instanceId){
    showToast('Open the menu from your medium barn first.');
    return;
  }
  const cfg=getBarnConfig(instanceId);
  if(!cfg){
    showToast('Could not load barn data.');
    return;
  }
  if(isLargeBarn(cfg)){
    showToast('This barn is already large.');
    return;
  }
  if(!isMediumBarn(cfg)){
    showToast('Upgrade a medium barn first.');
    return;
  }
  if(getBarnStage(cfg)!=='complete'){
    showToast('Finish building this barn first.');
    return;
  }
  if((Number(state.skills.architecture?.level)||1)<BARN_LARGE_UPGRADE_ARCH_UNLOCK){
    showToast('Need Architecture Lv '+BARN_LARGE_UPGRADE_ARCH_UNLOCK+'.');
    return;
  }
  if(!barnLargeUpgradeMaterialsMet()){
    showToast('Need 1 copper ore, 1 stone, 1 coal, and 1 quartz.');
    return;
  }
  let plotSlot=null;
  forEachBarnSlot((x,y,slot)=>{
    if(slot.instanceId===instanceId) plotSlot=slot;
  });
  if(!plotSlot){
    const found=typeof findPlotSlotByInstanceId==='function'?findPlotSlotByInstanceId(instanceId):null;
    if(found?.slot) plotSlot=found.slot;
  }
  if(!plotSlot){
    showToast('Could not find this barn on your plot.');
    return;
  }
  if(!consumeBarnLargeUpgradeMaterials()){
    showToast('Need 1 copper ore, 1 stone, 1 coal, and 1 quartz.');
    return;
  }
  applyLargeBarnOnSlot(plotSlot, cfg);
  const found=typeof findPlotSlotByInstanceId==='function'?findPlotSlotByInstanceId(instanceId):null;
  if(found) setPlotCell(found.x, found.y, { instanceId, typeId:getLargeBarnTypeId() });
  if(typeof plotLastBarnOverlayKey!=='undefined') plotLastBarnOverlayKey='';
  if(typeof renderPlotGrid==='function') renderPlotGrid({ full:true });
  else if(typeof refreshBarnPlotOverlays==='function') refreshBarnPlotOverlays();
  scheduleSaveGame();
  showStructureBuiltBanner({
    bonusKey:'large_barn',
    title:'LARGE BARN!',
    icon:'🏛️',
    body:'Four livestock slots and a barn interior — tap the top of the barn to enter.',
    btnText:'GOT IT',
    cb:()=>{
      if(typeof renderPlotGrid==='function') renderPlotGrid();
      if(typeof updateBarnCells==='function') updateBarnCells();
      renderBarnScreen();
      syncUI();
    },
  });
}

function renderBarnLargeUpgradeMaterials(){
  return BARN_LARGE_UPGRADE_MATERIALS.map(m=>{
    const stock=itemCountBagAndStore(m.key);
    return barnResourceLineHtml('need', m.name.toLowerCase(), stock, m.required);
  }).join('');
}

function renderBarnLargeUpgradeSection(cfg){
  if(!cfg||getBarnStage(cfg)!=='complete'||isLargeBarn(cfg)||!isMediumBarn(cfg)) return '';
  const archOk=(Number(state.skills.architecture?.level)||1)>=BARN_LARGE_UPGRADE_ARCH_UNLOCK;
  const matsOk=barnLargeUpgradeMaterialsMet();
  const btnDisabled=!archOk||!matsOk;
  return '<div class="barn-panel-dark barn-upgrade-cat barn-large-upgrade-cat plot-add-cat open">'
    +'<button type="button" class="plot-add-cat-head" onclick="document.querySelector(\'.barn-large-upgrade-cat\')?.classList.toggle(\'open\')">'
    +'<span class="plot-add-cat-chevron">▶</span>'
    +'<span class="plot-add-cat-title">UPGRADE TO LARGE BARN</span>'
    +'</button>'
    +'<div class="plot-add-cat-body">'
    +'<p class="barn-upgrade-flavor">Same footprint — four livestock slots and an interior for animals and barn items.</p>'
    +'<div class="barn-upgrade-materials">'+renderBarnLargeUpgradeMaterials()+'</div>'
    +'<div class="barn-upgrade-action">'
    +barnArchLevelBadge(BARN_LARGE_UPGRADE_ARCH_UNLOCK)
    +'<button type="button" class="wb-btn once barn-upgrade-btn" '
    +(btnDisabled?'disabled':'')+' onclick="upgradeMediumBarnToLarge()">'
    +'🏛️ UPGRADE TO LARGE BARN'
    +'<span class="wb-btn-sub">1 copper · 1 stone · 1 coal · 1 quartz</span>'
    +'</button></div></div></div>';
}

function renderBarnUpgradeSection(cfg){
  if(!cfg||isMediumBarn(cfg)||isLargeBarn(cfg)||getBarnStage(cfg)!=='complete') return '';
  const archOk=(Number(state.skills.architecture?.level)||1)>=BARN_MEDIUM_ARCH_UNLOCK;
  const matsOk=barnUpgradeMaterialsMet();
  const spaceOk=hasBarnUpgradeSpace(activeBarnInstanceId);
  const canUpgrade=archOk&&matsOk&&spaceOk;
  const btnDisabled=!archOk||!matsOk;
  return '<div class="barn-panel-dark barn-upgrade-cat plot-add-cat">'
    +'<button type="button" class="plot-add-cat-head" onclick="toggleBarnUpgradeSection()">'
    +'<span class="plot-add-cat-chevron">▶</span>'
    +'<span class="plot-add-cat-title">EXPAND BARN</span>'
    +'</button>'
    +'<div class="plot-add-cat-body">'
    +'<div class="barn-upgrade-materials">'+renderBarnUpgradeMaterials()+'</div>'
    +'<div class="barn-upgrade-action">'
    +barnArchLevelBadge(BARN_MEDIUM_ARCH_UNLOCK)
    +'<button type="button" class="wb-btn once barn-upgrade-btn" '
    +(btnDisabled?'disabled':'')+' onclick="upgradeSmallBarnToMedium()">'
    +'🏛️ UPGRADE SMALL BARN'
    +'<span class="wb-btn-sub">2 animal pens · barn interior</span>'
    +'</button></div></div></div>';
}

function removeBarnFootprintFromPlot(instanceId){
  findAllPlotCellsByInstanceId(instanceId).forEach(({ x, y })=>setPlotCell(x,y,null));
}

function confirmRemoveMediumBarn(instanceId){
  const cells=findAllPlotCellsByInstanceId(instanceId);
  if(!cells.length) return;
  const cfg=typeof getBarnConfig==='function'?getBarnConfig(instanceId):null;
  const typeId=cells[0].slot?.typeId||(cfg&&typeof getBarnPlotTypeId==='function'?getBarnPlotTypeId(cfg):getMediumBarnTypeId());
  const def=getPlotTileDef(typeId)||getPlotTileDef(getMediumBarnTypeId());
  if(!def?.removable) return;
  const barnName=typeof getBarnDisplayName==='function'?getBarnDisplayName(typeId, cfg):(def?.name||'barn');
  showChoiceBanner(
    'Clear '+barnName.toLowerCase()+'?',
    def.icon||'🏛️',
    'Remove '+barnName.toLowerCase()+'? Nothing is lost forever.',
    'Clear barn',
    'Keep it',
    ()=>removeMediumBarnFromPlot(instanceId)
  );
}

function removeMediumBarnFromPlot(instanceId, opts){
  if(!instanceId) return;
  const cells=findAllPlotCellsByInstanceId(instanceId);
  if(!cells.length){
    delete state.plotConfigs?.[instanceId];
    return;
  }
  const typeId=cells[0].slot?.typeId||getMediumBarnTypeId();
  const def=getPlotTileDef(typeId);
  if(typeof runPlotStructureOnRemove==='function'&&def){
    runPlotStructureOnRemove(cells[0].slot, def, cells[0].x, cells[0].y);
  }
  removeBarnFootprintFromPlot(instanceId);
  clearPlotTileConfig(instanceId, typeId);
  if(typeof renderPlotGrid==='function') renderPlotGrid();
  if(!opts?.silent){
    showToast((def?.icon||'🏛️')+' Cleared. Your land, your rules.');
  }
}

function rotateBarnFootprint(instanceId){
  instanceId=instanceId||activeBarnInstanceId;
  const cfg=getBarnConfig(instanceId);
  if(!cfg||!isMultiTileBarn(cfg)) return;
  const anchor=getBarnAnchor(instanceId);
  if(!anchor) return;
  const next=cfg.orientation==='h'?'v':'h';
  const oldCells=getBarnFootprintCells(instanceId);
  const nextOffsets=getBarnFootprintOffsets(next, cfg.size);
  const newCells=nextOffsets.map(o=>({ x:anchor.x+o.dx, y:anchor.y+o.dy }));
  const oldSecond=oldCells.find(c=>!(c.x===anchor.x&&c.y===anchor.y));
  const newSecond=newCells.find(c=>!(c.x===anchor.x&&c.y===anchor.y));
  if(!oldSecond||!newSecond) return;
  if(!isCoordInUnlockedPlot(newSecond.x,newSecond.y)){
    showToast('That tile is not unlocked yet.');
    return;
  }
  const displaced=getPlotCell(newSecond.x,newSecond.y);
  if(displaced&&displaced.instanceId===instanceId) displaced=null;
  setPlotCell(oldSecond.x,oldSecond.y,null);
  cfg.orientation=next;
  setPlotCell(newSecond.x,newSecond.y,{ instanceId, typeId:getBarnPlotTypeId(cfg) });
  if(displaced) setPlotCell(oldSecond.x,oldSecond.y,displaced);
  scheduleSaveGame();
  renderPlotGrid();
  showToast('Rotated barn '+(next==='h'?'horizontal':'vertical')+'.');
}

/** Map a drop on any footprint tile to the anchor for moveBarnFootprint. */
function resolveBarnDropAnchor(instanceId, dropX, dropY, hint){
  if(hint?.anchorX!=null&&hint?.anchorY!=null
    &&typeof canMoveBarnFootprintTo==='function'
    &&canMoveBarnFootprintTo(instanceId, hint.anchorX, hint.anchorY)){
    const cfg=getBarnConfig(instanceId);
    const offsets=getBarnFootprintOffsets(cfg?.orientation||'h', cfg?.size||'medium');
    const footprint=offsets.map(o=>({ x:hint.anchorX+o.dx, y:hint.anchorY+o.dy }));
    if(footprint.some(c=>c.x===dropX&&c.y===dropY)){
      return { x:hint.anchorX, y:hint.anchorY };
    }
  }
  if(typeof canMoveBarnFootprintTo!=='function') return null;
  const cfg=getBarnConfig(instanceId);
  if(!cfg||!isMultiTileBarn(cfg)) return null;
  const orientation=cfg.orientation||'h';
  const offsets=getBarnFootprintOffsets(orientation, cfg.size);
  const from=hint?.fromAnchor||getBarnAnchor(instanceId);
  const candidates=[];
  for(const o of offsets){
    const ax=dropX-o.dx, ay=dropY-o.dy;
    if(!canMoveBarnFootprintTo(instanceId, ax, ay)) continue;
    const footprint=offsets.map(off=>({ x:ax+off.dx, y:ay+off.dy }));
    if(!footprint.some(c=>c.x===dropX&&c.y===dropY)) continue;
    const offsetIdx=offsets.findIndex(off=>off.dx===o.dx&&off.dy===o.dy);
    candidates.push({ x:ax, y:ay, offsetIdx });
  }
  if(!candidates.length) return null;
  if(candidates.length===1) return { x:candidates[0].x, y:candidates[0].y };
  const dragDx=hint?.dragDx??0, dragDy=hint?.dragDy??0;
  if(Math.abs(dragDx)>8||Math.abs(dragDy)>8){
    if(orientation==='v'){
      if(dragDy>8) return pickBarnDropCandidate(candidates, 'maxY');
      if(dragDy<-8) return pickBarnDropCandidate(candidates, 'minY');
    }else{
      if(dragDx>8) return pickBarnDropCandidate(candidates, 'maxX');
      if(dragDx<-8) return pickBarnDropCandidate(candidates, 'minX');
    }
  }
  const atClick=candidates.filter(c=>c.offsetIdx===0);
  if(atClick.length===1) return { x:atClick[0].x, y:atClick[0].y };
  if(from){
    candidates.sort((a,b)=>{
      const da=Math.abs(a.x-from.x)+Math.abs(a.y-from.y);
      const db=Math.abs(b.x-from.x)+Math.abs(b.y-from.y);
      return da-db;
    });
    const nearest=candidates[0];
    const farthest=candidates[candidates.length-1];
    if(Math.abs(nearest.x-from.x)+Math.abs(nearest.y-from.y)===0) return { x:farthest.x, y:farthest.y };
    return { x:nearest.x, y:nearest.y };
  }
  return { x:candidates[0].x, y:candidates[0].y };
}

function pickBarnDropCandidate(candidates, mode){
  let best=candidates[0];
  for(const c of candidates){
    if(mode==='maxX'&&c.x>best.x) best=c;
    if(mode==='minX'&&c.x<best.x) best=c;
    if(mode==='maxY'&&c.y>best.y) best=c;
    if(mode==='minY'&&c.y<best.y) best=c;
  }
  return { x:best.x, y:best.y };
}

function canMoveBarnFootprintTo(instanceId, newAnchorX, newAnchorY){
  const cfg=getBarnConfig(instanceId);
  if(!cfg||!isMultiTileBarn(cfg)) return false;
  const offsets=getBarnFootprintOffsets(cfg.orientation||'h', cfg.size);
  const newCells=offsets.map(o=>({ x:newAnchorX+o.dx, y:newAnchorY+o.dy }));
  if(!newCells.every(c=>isCoordInUnlockedPlot(c.x,c.y))) return false;
  const oldCells=getBarnFootprintCells(instanceId);
  const oldKeys=new Set(oldCells.map(c=>plotCoordKey(c.x,c.y)));
  const newKeys=new Set(newCells.map(c=>plotCoordKey(c.x,c.y)));
  if([...newKeys].every(k=>oldKeys.has(k))) return false;
  let displaceCount=0;
  for(const c of newCells){
    if(oldKeys.has(plotCoordKey(c.x,c.y))) continue;
    const slot=getPlotCell(c.x,c.y);
    if(!slot) continue;
    if(slot.instanceId===instanceId) continue;
    const def=getPlotTileDef(slot.typeId);
    if(!def?.removable) return false;
    displaceCount++;
  }
  const vacatedCount=oldCells.filter(c=>!newKeys.has(plotCoordKey(c.x,c.y))).length;
  return displaceCount<=vacatedCount;
}

function moveBarnFootprint(instanceId, newAnchorX, newAnchorY){
  const cfg=getBarnConfig(instanceId);
  if(!cfg||!isMultiTileBarn(cfg)) return false;
  syncBarnAnchorFromPlot(instanceId);
  if(!canMoveBarnFootprintTo(instanceId, newAnchorX, newAnchorY)) return false;
  const orientation=cfg.orientation||'h';
  const offsets=getBarnFootprintOffsets(orientation, cfg.size);
  const oldCells=getBarnFootprintCells(instanceId);
  const newCells=offsets.map(o=>({ x:newAnchorX+o.dx, y:newAnchorY+o.dy }));
  const oldKeys=new Set(oldCells.map(c=>plotCoordKey(c.x,c.y)));
  const newKeys=new Set(newCells.map(c=>plotCoordKey(c.x,c.y)));
  const toDisplace=[];
  newCells.forEach(c=>{
    if(oldKeys.has(plotCoordKey(c.x,c.y))) return;
    const slot=getPlotCell(c.x,c.y);
    if(slot) toDisplace.push(slot);
  });
  const vacated=oldCells.filter(c=>!newKeys.has(plotCoordKey(c.x,c.y)));
  oldCells.forEach(c=>setPlotCell(c.x,c.y,null));
  newCells.forEach(c=>setPlotCell(c.x,c.y,{ instanceId, typeId:getBarnPlotTypeId(cfg) }));
  const vacatedUsed=new Set();
  toDisplace.forEach((slot,i)=>{
    let dest=vacated[i];
    if(dest){
      const key=plotCoordKey(dest.x,dest.y);
      if(vacatedUsed.has(key)) dest=null;
      else vacatedUsed.add(key);
    }
    if(dest){
      setPlotCell(dest.x,dest.y,slot);
      return;
    }
    const exclude=new Set([...newKeys,...oldKeys]);
    vacated.forEach(v=>exclude.add(plotCoordKey(v.x,v.y)));
    vacatedUsed.forEach(k=>exclude.add(k));
    const alt=findEmptyPlotCellForRelocate(exclude);
    if(alt){
      setPlotCell(alt.x,alt.y,slot);
      vacatedUsed.add(plotCoordKey(alt.x,alt.y));
    }
  });
  cfg.anchorX=newAnchorX;
  cfg.anchorY=newAnchorY;
  enforceMediumBarnFootprint(instanceId, cfg);
  if(typeof plotLastBarnOverlayKey!=='undefined') plotLastBarnOverlayKey='';
  scheduleSaveGame();
  return true;
}

function barnAdoptOptionDropsHtml(def, animalKey){
  const food=typeof getBarnAnimalPrimaryFood==='function'?getBarnAnimalPrimaryFood(def):{ key:'wheat', amount:1, label:'wheat' };
  const adoptStock=itemCountBagAndStore(def.adoptCostKey);
  const foodStock=itemCountBagAndStore(food.key);
  const adoptLabel=def.adoptCostLabel||def.adoptCostKey;
  const eatLabel=food.amount>1?(food.amount+'× '+food.label):food.label;
  const parts=[
    formatRecipeMatLine(adoptLabel, def.adoptCostAmount, adoptStock),
    formatRecipeMatLine(eatLabel, food.amount, foodStock),
  ];
  const produce=barnAnimalProducesText(animalKey);
  if(produce) parts.push('Produces: '+produce);
  const secs=barnAnimalFeedSeconds(animalKey);
  if(secs) parts.push(secs+'s feed cycle');
  return parts.join(' · ');
}

function renderBarnAdoptOptions(cfg, penSlotIdx){
  const slotArg=typeof penSlotIdx==='number'?penSlotIdx:-1;
  return BARN_ANIMAL_ORDER.map(key=>{
    const def=getBarnAnimalDef(key);
    if(!def) return '';
    const unlocked=isBarnAnimalUnlocked(key);
    const adoptStock=itemCountBagAndStore(def.adoptCostKey);
    const canPay=adoptStock>=def.adoptCostAmount;
    const disabled=!unlocked||!canPay;
    const onclick=disabled?'':' onclick="adoptBarnAnimal(\''+key+'\','+slotArg+')"';
    return '<button type="button" class="plot-add-item barn-adopt-item'+(!unlocked||!canPay?' unavail':'')+'"'
      +(disabled?' disabled':'')+onclick+'>'
      +'<span class="plot-add-item-icon">'+def.icon+'</span>'
      +'<span class="plot-add-item-name">'
      +'<span class="plot-add-item-title-row">'
      +'<span class="plot-add-item-title">'+def.name+'</span>'
      +barnHusbandryLevelBadge(def.unlockLevel)
      +'</span>'
      +'<span class="plot-add-item-drops">'+barnAdoptOptionDropsHtml(def, key)+'</span>'
      +'</span></button>';
  }).join('');
}

function renderBarnAnimalSlotCell(slot, slotIdx){
  if(!slot?.type){
    return '<button type="button" class="barn-animal-slot empty" onclick="barnOpenInteriorForPen('+slotIdx+')" title="Add inside the barn">'
      +'<span class="barn-animal-slot-add-icon">＋</span>'
      +'</button>';
  }
  const def=getBarnAnimalDef(slot.type);
  const feeding=barnIsSlotFeeding(slot);
  const timerOverlay=feeding
    ?('<div class="barn-animal-slot-feed-overlay">'+barnSlotFeedCountdownLabel(slot)+'</div>')
    :'';
  return '<button type="button" class="barn-animal-slot filled selected" onclick="barnAnimalSlotTap('+slotIdx+')" title="Tap to dismiss">'
    +'<div class="barn-animal-slot-icon-wrap">'
    +'<div class="barn-animal-slot-icon">'+def.icon+'</div>'
    +timerOverlay
    +'</div>'
    +'<div class="barn-animal-slot-name">'+def.name+'</div>'
    +'</button>';
}

function renderBarnAnimalSlots(cfg){
  const slotsEl=document.getElementById('barn-animal-slots');
  const hintEl=document.getElementById('barn-animal-slots-hint');
  const titleEl=document.getElementById('barn-animal-slots-title');
  if(!slotsEl) return;
  ensureBarnAnimalSlots(cfg);
  if(titleEl){
    const filled=barnActiveAnimalCount(cfg);
    const total=cfg.animalSlots.length;
    titleEl.textContent='ANIMAL SLOTS · '+filled+'/'+total;
  }
  slotsEl.innerHTML=cfg.animalSlots.map((slot,i)=>renderBarnAnimalSlotCell(slot,i)).join('');
  if(hintEl){
    hintEl.hidden=!barnHasAnyAnimal(cfg);
    hintEl.textContent='Tap an animal to dismiss it';
  }
}

function renderBarnStoragePanel(cfg){
  const panel=document.querySelector('#barn-animal-panel .barn-storage-panel');
  if(!panel) return;
  panel.outerHTML=renderBarnStorage(cfg);
}

function renderBarnStorage(cfg){
  migrateBarnStoredLoot(cfg);
  const total=barnStorageTotal(cfg);
  const cap=barnEffectiveStorageCap(cfg);
  const xpTotal=barnStoredCollectXpTotal(cfg);
  let chips='';
  (BARN_STORAGE_PRODUCE_KEYS||[]).forEach(pk=>{
    const n=barnStoredProduceTotal(cfg,pk);
    if(n<1) return;
    const def=barnProduceDef(pk)||BARN_ANIMAL_PRODUCE[pk];
    if(!def||pk==='milk') return;
    const label=def.name.toLowerCase();
    const pocketHint=pk==='feathers'
      ? ' <span class="barn-milk-hint">(go to pocket)</span>'
      : '';
    chips+='<div class="barn-produce-chip">'+def.icon+' '+n+'× '+label+pocketHint+'</div>';
  });
  const milk=barnStoredProduceTotal(cfg,'milk');
  if(milk>0){
    const def=BARN_ANIMAL_PRODUCE.milk;
    chips+='<div class="barn-produce-chip">'+def.icon+' '+milk+'× milk <span class="barn-milk-hint">(needs bottle or bucket)</span></div>';
  }
  let earthTotal=0;
  BARN_ANIMAL_ORDER.forEach(k=>{ earthTotal+=barnStoredEarthShards(cfg.storedLoot[k]); });
  if(earthTotal>0){
    const m=typeof SHARD_META!=='undefined'?SHARD_META.earth:{ icon:'🌿', name:'shard' };
    chips+='<div class="barn-produce-chip">'+m.icon+' '+earthTotal+'× bonus find</div>';
  }
  if(!chips){
    chips='<div class="barn-storage-empty">Nothing stored yet — feed animals and produce stacks here.</div>';
  }
  const fullLine=total>=cap?('<div class="barn-storage-full">Storage full — collect to make room.</div>'):'';
  const collectBtn=renderBarnStorageCollectButton(cfg);
  return '<div class="barn-panel-dark barn-storage-panel">'
    +'<div class="store-items-title">BARN STORAGE · '+total+'/'+cap+'</div>'
    +'<div class="barn-produce-chips">'+chips+'</div>'
    +fullLine
    +(xpTotal?('<div class="barn-produce-xp">+'+xpTotal+' Husbandry on collect</div>'):'')
    +(collectBtn?('<div class="wb-use-box barn-storage-actions"><div class="wb-use-btns">'+collectBtn+'</div></div>'):'')
    +'</div>';
}

function renderBarnAnimalFeedInfo(cfg){
  if(!barnHasAnyAnimal(cfg)) return '';
  ensureBarnAnimalSlots(cfg);
  ensureBarnTroughStock(cfg);
  const lines=typeof barnGroupedAnimalTroughLines==='function'
    ?barnGroupedAnimalTroughLines(cfg, cfg.troughStock)
    :[];
  if(!lines.length) return '';
  return '<div class="barn-animal-feed-info">'
    +lines.map(l=>'<div class="barn-trough-animal-line">'+l+'</div>').join('')
    +'</div>';
}

function barnTroughTitleSuffix(cfg){
  ensureBarnInterior(cfg);
  const summary=typeof barnTroughCapacitySummary==='function'
    ?barnTroughCapacitySummary(cfg.barnInterior)
    :{ perTypeCap:0 };
  const cap=summary.perTypeCap|0;
  if(cap<1) return '';
  return ' ('+cap+' per type max)';
}

function barnTroughPreviewFoodKeys(cfg){
  clampBarnTroughStock(cfg);
  const levelOrder=typeof BARN_TROUGH_FOOD_LEVEL_ORDER!=='undefined'
    ?BARN_TROUGH_FOOD_LEVEL_ORDER
    :(BARN_TROUGH_FOOD_KEYS||[]);
  if(barnTroughPreviewExpanded) return levelOrder.slice();
  return levelOrder.filter(k=>(cfg.troughStock[k]|0)>0);
}

function renderBarnTroughFoodCell(foodKey, stock){
  const def=typeof barnTroughFoodDef==='function'?barnTroughFoodDef(foodKey):{ icon:'🌾' };
  const n=Math.max(0,stock|0);
  return '<div class="barn-trough-food-cell" title="'+foodKey+'">'
    +'<span class="barn-trough-food-icon">'+def.icon+'</span>'
    +'<span class="barn-trough-food-count">'+n+'</span>'
    +'</div>';
}

function renderBarnTroughSplitTop(cfg){
  clampBarnTroughStock(cfg);
  const keys=barnTroughPreviewFoodKeys(cfg);
  const levelOrder=typeof BARN_TROUGH_FOOD_LEVEL_ORDER!=='undefined'
    ?BARN_TROUGH_FOOD_LEVEL_ORDER
    :(BARN_TROUGH_FOOD_KEYS||[]);
  const canExpand=levelOrder.length>0;
  const gridCls='barn-trough-food-grid'+(barnTroughPreviewExpanded?' is-expanded':'');
  let inner='';
  if(keys.length){
    inner=keys.map(k=>renderBarnTroughFoodCell(k, cfg.troughStock[k])).join('');
  }else{
    inner='<span class="barn-trough-food-empty">Feed animals to track diet here</span>';
  }
  const expandBtn=canExpand
    ?('<span class="barn-trough-expand-btn" role="button" tabindex="0" onclick="event.stopPropagation();toggleBarnTroughPreviewExpand()" aria-label="'+(barnTroughPreviewExpanded?'Collapse':'Expand')+'">'+(barnTroughPreviewExpanded?'▲':'▼')+'</span>')
    :'';
  return '<div class="barn-trough-split-top" title="Feed in trough">'
    +'<div class="'+gridCls+'">'+inner+'</div>'
    +expandBtn
    +'</div>';
}

function barnHasBagFeedRoomForTrough(cfg){
  if(!barnHasTroughCapacity(cfg)) return false;
  clampBarnTroughStock(cfg);
  const summary=typeof barnTroughCapacitySummary==='function'
    ?barnTroughCapacitySummary(cfg.barnInterior)
    :{ perTypeCap:0 };
  const cap=summary.perTypeCap|0;
  return (BARN_TROUGH_FOOD_KEYS||[]).some(fk=>{
    const room=Math.max(0, cap-(cfg.troughStock[fk]|0));
    return room>0&&itemCountBagAndStore(fk)>0;
  });
}

function barnTroughPrimaryAction(cfg){
  if(!cfg) return { mode:'fill', label:'FILL TROUGH', sub:'', disabled:true };
  processBarnFeedCatchUp(cfg);
  ensureBarnAnimalSlots(cfg);
  clampBarnTroughStock(cfg);
  const hungry=barnHungryAnimalCount(cfg);
  const storageFull=barnStorageFull(cfg);
  if(hungry>0&&!storageFull){
    if(barnHasFeedForHungry(cfg)){
      return {
        mode:'feed',
        label:'FEED ALL',
        sub:barnFeedAllSubText(cfg),
        disabled:false,
      };
    }
    return {
      mode:'feed',
      label:'FEED ALL',
      sub:'need feed in trough or bag',
      disabled:true,
    };
  }
  if(hungry>0&&storageFull){
    return {
      mode:'feed',
      label:'FEED ALL',
      sub:barnFeedAllSubText(cfg),
      disabled:true,
    };
  }
  const canFill=barnHasBagFeedRoomForTrough(cfg);
  return {
    mode:'fill',
    label:'FILL TROUGH',
    sub:barnFillTroughSubText(cfg),
    disabled:!canFill,
  };
}

function barnTroughPrimaryActionClick(){
  const cfg=getBarnConfig(activeBarnInstanceId);
  if(!cfg) return;
  const action=barnTroughPrimaryAction(cfg);
  if(action.disabled) return;
  if(action.mode==='feed') feedAllBarnAnimals();
  else fillBarnTroughFromBag();
}

function toggleBarnTroughPreviewExpand(){
  barnTroughPreviewExpanded=!barnTroughPreviewExpanded;
  const cfg=getBarnConfig(activeBarnInstanceId);
  const troughEl=document.getElementById('barn-trough-section');
  if(troughEl&&cfg) troughEl.innerHTML=renderBarnTroughSection(cfg);
}

function renderBarnTroughMenuTile(){
  return '<button type="button" class="barn-trough-side-btn barn-trough-tile-manage" onclick="openBarnTroughMenu()" title="Trough stock and settings">'
    +'<span class="barn-trough-tile-icon">📋</span>'
    +'<span class="barn-trough-tile-label">Trough</span>'
    +'</button>';
}

function renderBarnTroughAutoTile(cfg){
  ensureBarnTroughStock(cfg);
  const autoOn=!!cfg.troughAutoFeed;
  return '<button type="button" class="barn-trough-side-btn barn-trough-tile-auto'+(autoOn?' is-on':'')+'" onclick="toggleBarnTroughAutoFeed()" title="Toggle auto-feed">'
    +'<span class="barn-trough-tile-icon">'+(autoOn?'✓':'○')+'</span>'
    +'<span class="barn-trough-tile-label">Auto'+(autoOn?' ON':'')+'</span>'
    +'</button>';
}

function renderBarnTroughMainPanel(cfg){
  const action=barnTroughPrimaryAction(cfg);
  const inner=renderBarnTroughSplitTop(cfg);
  return '<div class="barn-trough-main-panel">'
    +'<div class="barn-trough-preview-shell" onclick="event.stopPropagation();toggleBarnTroughPreviewExpand()">'
    +inner
    +'</div>'
    +'<button type="button" class="barn-trough-main-action barn-action-btn" '
    +(action.disabled?'disabled':'')+' onclick="barnTroughPrimaryActionClick()">'
    +'<span class="barn-trough-main-label">'+action.label+'</span>'
    +'<span class="barn-trough-main-sub">'+action.sub+'</span>'
    +'</button>'
    +'</div>';
}

function renderBarnTroughControls(cfg){
  if(!barnHasAnyAnimal(cfg)) return '';
  return '<div class="barn-trough-layout">'
    +'<div class="barn-trough-sidebar">'
    +renderBarnTroughMenuTile()
    +renderBarnTroughAutoTile(cfg)
    +'</div>'
    +renderBarnTroughMainPanel(cfg)
    +'</div>';
}

function renderBarnTroughSection(cfg){
  const feedInfo=barnHasAnyAnimal(cfg)?renderBarnAnimalFeedInfo(cfg):'';
  const controls=renderBarnTroughControls(cfg);
  const titleSuffix=barnTroughTitleSuffix(cfg);
  if(!feedInfo&&!controls){
    return '<div class="store-items-title">TROUGH'+titleSuffix+'</div>'
      +'<div class="barn-trough-empty">No animals yet — add livestock inside the barn.</div>';
  }
  const capNote=barnHasTroughCapacity(cfg)?'':'<p class="barn-trough-cap-note">Place troughs inside the barn to store feed (10 / 20 / 30 per type).</p>';
  return '<div class="store-items-title">TROUGH'+titleSuffix+'</div>'
    +capNote
    +feedInfo
    +(controls||'');
}

function renderBarnStorageCollectButton(cfg){
  const hasStored=barnHasStoredProduce(cfg);
  const collectSub=barnCollectSubText(cfg);
  return '<button type="button" class="wb-btn once barn-action-btn" style="flex:1" '
    +(!hasStored?'disabled':'')+' onclick="collectAllBarnStorage()">'
    +'COLLECT ALL'
    +'<span class="wb-btn-sub">'+collectSub+'</span>'
    +'</button>';
}

function renderBarnAnimalStatus(cfg){
  const statusEl=document.getElementById('barn-status');
  if(!statusEl) return;
  if(!barnHasAnyAnimal(cfg)){
    if(barnHasStoredProduce(cfg)){
      statusEl.textContent='Collect barn storage, or add an animal inside the barn.';
      statusEl.className='fish-status idle';
    }else{
      statusEl.textContent='Enter the barn and tap an empty pen to add livestock.';
      statusEl.className='fish-status idle';
    }
    return;
  }
  processBarnFeedCatchUp(cfg);
  ensureBarnAnimalSlots(cfg);
  const feedingCount=cfg.animalSlots.filter(s=>s?.type&&barnIsSlotFeeding(s)).length;
  const hungry=barnHungryAnimalCount(cfg);
  const stored=barnHasStoredProduce(cfg);
  if(feedingCount>0){
    statusEl.textContent='';
    statusEl.className='fish-status idle';
    return;
  }
  if(stored){
    const total=barnStorageTotal(cfg);
    const cap=barnEffectiveStorageCap(cfg);
    statusEl.textContent='Barn storage: '+total+'/'+cap+' — collect whenever you like, or feed again.';
    statusEl.className='fish-status idle';
    return;
  }
  if(barnStorageFull(cfg)){
    statusEl.textContent='Barn storage is full — collect before feeding again.';
    statusEl.className='fish-status idle';
    return;
  }
  if(hungry<1){
    if(barnHasEmptyAnimalSlot(cfg)){
      statusEl.textContent='All animals are fed — you have an empty slot.';
    }else{
      statusEl.textContent='No animals ready to feed.';
    }
    statusEl.className='fish-status idle';
    return;
  }
  statusEl.textContent='Feed all feeds each animal once — one feed per animal.';
  statusEl.className='fish-status idle';
}

function barnHasFeedForHungry(cfg){
  ensureBarnAnimalSlots(cfg);
  ensureBarnTroughStock(cfg);
  return cfg.animalSlots.some(s=>{
    if(!s?.type||barnIsSlotFeeding(s)) return false;
    const def=getBarnAnimalDef(s.type);
    const food=typeof getBarnAnimalPrimaryFood==='function'?getBarnAnimalPrimaryFood(def):{ key:'wheat', amount:1 };
    return barnFoodAvailableForFeed(cfg, food.key, food.amount);
  });
}

function barnFillTroughSubText(cfg){
  ensureBarnTroughStock(cfg);
  if(!barnHasTroughCapacity(cfg)) return 'place a trough inside';
  const summary=typeof barnTroughCapacitySummary==='function'
    ?barnTroughCapacitySummary(cfg.barnInterior)
    :{ perTypeCap:0 };
  const cap=summary.perTypeCap|0;
  let minRoom=cap;
  (BARN_TROUGH_FOOD_KEYS||[]).forEach(fk=>{
    const room=Math.max(0, cap-(cfg.troughStock[fk]|0));
    if(room<minRoom) minRoom=room;
  });
  if(minRoom<1) return 'trough full ('+cap+' per type)';
  return 'room for '+minRoom+' more per type';
}

function barnFeedAllSubText(cfg){
  const hungry=barnHungryAnimalCount(cfg);
  const feedingCount=cfg.animalSlots.filter(s=>s?.type&&barnIsSlotFeeding(s)).length;
  const cap=barnStorageCap(cfg);
  if(barnStorageFull(cfg)) return 'storage full ('+cap+')';
  if(hungry<1) return feedingCount>0?'all animals eating':'none hungry';
  if(feedingCount>0) return hungry+' hungry · '+feedingCount+' eating';
  return hungry+' hungry · trough or bag';
}

function barnCollectSubText(cfg){
  if(!barnHasStoredProduce(cfg)) return 'barn storage empty';
  const parts=[];
  (BARN_STORAGE_PRODUCE_KEYS||[]).forEach(pk=>{
    const n=barnStoredProduceTotal(cfg,pk);
    if(n<1) return;
    const def=barnProduceDef(pk);
    const name=(def?.name||pk).toLowerCase();
    parts.push(n+' '+name+(n>1?'s':''));
  });
  return parts.length?parts.join(', '):'bonus finds';
}

function barnHasEmptyAnimalSlot(cfg){
  return barnFirstEmptyAnimalSlotIndex(cfg)>=0;
}

function renderBarnAnimalPanel(cfg){
  const panelEl=document.getElementById('barn-animal-panel');
  const btnEl=document.getElementById('barn-buttons');
  if(!panelEl) return;
  panelEl.innerHTML=renderBarnStorage(cfg);
  if(btnEl){ btnEl.hidden=true; btnEl.innerHTML=''; }
}

function renderBarnActivitySection(cfg){
  const buildSection=document.getElementById('barn-build-section');
  const activitySection=document.getElementById('barn-activity-section');
  const upgradeEl=document.getElementById('barn-upgrade-section');
  const troughEl=document.getElementById('barn-trough-section');
  if(buildSection) buildSection.hidden=true;
  if(activitySection) activitySection.hidden=false;
  processBarnFeedCatchUp(cfg);
  renderBarnAnimalSlots(cfg);
  if(troughEl) troughEl.innerHTML=renderBarnTroughSection(cfg);
  renderBarnAnimalPanel(cfg);
  renderBarnAnimalStatus(cfg);
  if(upgradeEl){
    upgradeEl.innerHTML=renderBarnUpgradeSection(cfg)+renderBarnLargeUpgradeSection(cfg);
  }
  const btnEl=document.getElementById('barn-buttons');
  if(btnEl){ btnEl.hidden=true; btnEl.innerHTML=''; }
  if(barnAnyAnimalFeeding(cfg)) startBarnTimer();
  else stopBarnTimer();
}

function renderBarnMaterialGrid(mat, count){
  if(!mat) return '';
  const done=count>=mat.required;
  return '<div class="barn-material-block'+(done?' barn-material-done':'')+'">'
    +'<div class="barn-material-title">'+formatRecipeMatTitle(mat.icon, mat.name, mat.required, count, { done })+'</div>'
    +'<div class="well-brick-grid fire-pit-material-grid">'
    +Array.from({ length:mat.required }, (_,i)=>{
      const filled=i<count;
      return '<div class="well-brick-slot'+(filled?' filled':'')+'">'+(filled?mat.icon:'')+'</div>';
    }).join('')
    +'</div></div>';
}

function renderBarnMaterialAction(m, cfg){
  const count=cfg?.[m.countKey]|0;
  const done=count>=m.required;
  if(done){
    return '<div class="barn-mat-complete">'
      +'<span class="barn-mat-complete-icon">'+m.icon+'</span>'
      +'<span class="barn-mat-complete-label">'+m.name+', complete!</span>'
      +'</div>';
  }
  const canAdd=m.key==='nails'?barnNailsCanAfford(1):itemCountBagAndStore(m.key)>0;
  return '<button class="wb-btn once barn-action-btn" style="flex:1" '+(!canAdd?'disabled':'')+' onclick="placeBarnMaterial(event,null,\''+m.key+'\')">'
    +m.icon+' ADD '+m.name.toUpperCase()
    +'<span class="wb-btn-sub">'+count+'/'+m.required+'</span>'
    +'</button>';
}

function renderBarnBuildSection(cfg){
  const stage=getBarnStage(cfg);
  const progress=getBarnProgress(cfg);
  const total=getBarnTotalRequired();
  const materials=getBarnMaterialsForStage(stage);
  const buildSection=document.getElementById('barn-build-section');
  const activitySection=document.getElementById('barn-activity-section');
  const upgradeEl=document.getElementById('barn-upgrade-section');
  const countEl=document.getElementById('barn-progress-count');
  const gridsEl=document.getElementById('barn-material-grids');
  const statusEl=document.getElementById('barn-status');
  const btnEl=document.getElementById('barn-buttons');
  if(buildSection) buildSection.hidden=false;
  if(activitySection) activitySection.hidden=true;
  if(upgradeEl) upgradeEl.innerHTML='';
  const troughEl=document.getElementById('barn-trough-section');
  if(troughEl) troughEl.innerHTML='';
  if(countEl){
    countEl.hidden=false;
    countEl.textContent=progress+' / '+total+' materials placed';
  }
  if(gridsEl){
    gridsEl.hidden=false;
    gridsEl.innerHTML=materials.map(m=>renderBarnMaterialGrid(m, cfg?.[m.countKey]|0)).join('');
  }
  if(statusEl){
    statusEl.textContent='Use the buttons below to add materials';
    statusEl.classList.add('idle');
  }
  if(btnEl){
    btnEl.hidden=false;
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns barn-use-btns">'
      +materials.map(m=>renderBarnMaterialAction(m, cfg)).join('')
      +'</div></div>';
  }
}

function renderBarnScreen(){
  migrateBarn();
  const cfg=getBarnConfig(activeBarnInstanceId);
  const stage=getBarnStage(cfg);
  const typeId=getActiveBarnTypeId();
  const displayName=getBarnDisplayName(typeId, cfg);
  const titleEl=document.querySelector('#barn-screen .top-bar-title');
  const nameEl=document.querySelector('#barn-screen .wb-item-name');
  const subEl=document.getElementById('barn-subtitle');
  const skillPill=document.getElementById('barn-skill-pill');
  if(titleEl) titleEl.textContent=displayName;
  if(nameEl) nameEl.textContent=displayName;
  if(skillPill) skillPill.hidden=stage!=='complete';
  if(subEl) subEl.textContent=getBarnStageLabel(stage, cfg);
  if(stage==='complete'){
    renderBarnActivitySection(cfg);
    if(typeof updateActivitySkillPill==='function') updateActivitySkillPill('barn', getBarnActivitySkillKey());
  }else{
    stopBarnTimer();
    renderBarnBuildSection(cfg);
    if(typeof updateActivitySkillPill==='function') updateActivitySkillPill('barn', 'architecture');
  }
  if(activeBarnInteriorInstanceId&&activeBarnInteriorInstanceId===activeBarnInstanceId){
    if(typeof syncBarnInteriorPenAnimals==='function') syncBarnInteriorPenAnimals(cfg);
    if(typeof renderBarnInteriorGrid==='function') renderBarnInteriorGrid();
  }
}

function updateBarnCells(){
  migrateBarn();
  document.querySelectorAll('.plot-cell.cell-barn').forEach(cell=>{
    const cfg=getBarnConfig(cell.dataset.instanceId);
    const typeId=cell.dataset.typeId||getBarnTypeIdForStage(getBarnStage(cfg));
    const vis=getBarnVisualState(cfg, typeId);
    cell.classList.remove('barn-building','barn-walls','barn-doorless','barn-complete');
    cell.classList.add('barn-'+vis.stage);
    const icon=cell.querySelector('.barn-icon');
    const label=cell.querySelector('.barn-label');
    if(icon) icon.textContent=vis.icon;
    if(label) label.textContent=vis.label;
    const top=cell.querySelector('.barn-activity-top');
    if(top){
      top.classList.remove('barn-building','barn-walls','barn-doorless','barn-complete');
      top.classList.add('barn-'+vis.stage);
    }
  });
  document.querySelectorAll('.barn-body-surface').forEach(surface=>{
    const instanceId=surface.dataset?.instanceId;
    if(!instanceId) return;
    const cfg=getBarnConfig(instanceId);
    const typeId=typeof getBarnPlotTypeIdFromPlot==='function'
      ?getBarnPlotTypeIdFromPlot(instanceId, cfg)
      :getBarnPlotTypeId(cfg);
    const vis=getBarnVisualState(cfg, typeId);
    const icon=surface.querySelector('.barn-icon');
    const label=surface.querySelector('.barn-label');
    if(icon) icon.textContent=vis.icon;
    if(label) label.textContent=vis.label;
    const top=surface.querySelector('.barn-activity-top');
    if(top){
      top.classList.remove('barn-building','barn-walls','barn-doorless','barn-complete','barn-large-surface');
      top.classList.add('barn-'+vis.stage);
      if(vis.large) top.classList.add('barn-large-surface');
    }
    if(vis.large) surface.classList.add('barn-large-surface');
    else surface.classList.remove('barn-large-surface');
  });
  if(typeof plotLastBarnOverlayKey!=='undefined') plotLastBarnOverlayKey='';
  if(typeof refreshBarnPlotOverlays==='function') refreshBarnPlotOverlays();
}
