/* Hearthstead — plot edit, placement & taps */
'use strict';

function plotDragIconForSlot(slot){
  if(!slot) return '＋';
  const def=getPlotTileDef(slot.typeId);
  return def?.icon||'📦';
}

function applyPlotPan(){
  const world=document.getElementById('plot-world');
  if(world){
    world.style.transform='translate('+state.plot.panX+'px,'+state.plot.panY+'px)';
  }
  updatePlotHomeButton();
}

function updatePlotHomeButton(){
  const btn=document.getElementById('plot-home-btn');
  const hut=document.querySelector('.plot-cell.cell-hut');
  const viewport=document.getElementById('plot-viewport');
  if(!btn||!viewport) return;
  if(!hut){ btn.classList.remove('visible'); return; }
  const v=viewport.getBoundingClientRect();
  const h=hut.getBoundingClientRect();
  const hutCx=h.left+h.width/2;
  const hutCy=h.top+h.height/2;
  const viewCx=v.left+v.width/2;
  const viewCy=v.top+v.height/2;
  const centered=Math.abs(hutCx-viewCx)<14&&Math.abs(hutCy-viewCy)<14;
  btn.classList.toggle('visible', !centered);
}

function recenterPlotOnHome(){
  migratePlot();
  const viewport=document.getElementById('plot-viewport');
  const hut=document.querySelector('.plot-cell.cell-hut');
  if(!viewport||!hut) return;
  const v=viewport.getBoundingClientRect();
  const h=hut.getBoundingClientRect();
  state.plot.panX+=(v.left+v.width/2)-(h.left+h.width/2);
  state.plot.panY+=(v.top+v.height/2)-(h.top+h.height/2);
  applyPlotPan();
}

function clearPlotTileConfig(instanceId, typeId){
  const def=getPlotTileDef(typeId);
  if(def?.behavior==='water'&&fish.running) stopFishing(true);
  if(def?.behavior==='gather'&&gather.running&&gather.instanceId===instanceId) stopGathering(true);
  if(def?.behavior==='quarry'&&mine.instanceId===instanceId){
    stopMining(true);
    mine.stacks=0;
    mine.instanceId=null;
  }
  if(def?.behavior==='tree'&&wc.treeInstanceId===instanceId&&typeof stopWoodcutting==='function') stopWoodcutting(true);
  if(def?.behavior&&typeof clearPlotStructureActive==='function') clearPlotStructureActive(def.behavior, instanceId);
  delete state.plotConfigs[instanceId];
}

function togglePlotEditMode(){
  migratePlot();
  state.plot.editMode=!state.plot.editMode;
  closePlotAddMenu();
  hideAllPlotActivityMenus();
  updatePlotEditUI();
  renderPlotGrid();
  showToast(state.plot.editMode?'Edit mode — unlock tiles beside your land or move what you have.':'Land saved. Back to living on it.');
}

function updatePlotUnlockHint(){
  const el=document.getElementById('plot-unlock-hint');
  if(!el) return;
  el.hidden=true;
  el.textContent='';
}

function plotAddMenuShowsLocked(){
  if(!state.plot) return false;
  if(state.plot.addMenuShowLocked!=null) return !!state.plot.addMenuShowLocked;
  if(state.plot.addMenuHideLocked!=null) return !state.plot.addMenuHideLocked;
  return false;
}

function updatePlotUnlockSkyBanner(){
  const banner=document.getElementById('plot-unlock-sky-banner');
  const txt=document.getElementById('plot-unlock-sky-text');
  if(!banner||!txt) return;
  const edit=!!state.plot?.editMode;
  const onPlot=typeof currentScreen!=='undefined'&&currentScreen==='exterior-screen';
  if(!edit||!state.gameStarted||!onPlot){
    banner.hidden=true;
    return;
  }
  const rem=typeof getPlotUnlockCreditsRemaining==='function'?getPlotUnlockCreditsRemaining():0;
  if(rem<=0){
    banner.hidden=true;
    return;
  }
  banner.hidden=false;
  txt.textContent=rem+' unlock'+(rem===1?'':'s')+' available';
}

function updatePlotUnlockDisplays(){
  updatePlotUnlockHint();
  updatePlotUnlockSkyBanner();
}

function updatePlotEditUI(){
  const btn=document.getElementById('plot-edit-btn');
  const grid=document.getElementById('plot-grid');
  const bar=document.getElementById('plot-edit-bar');
  if(btn) btn.textContent=state.plot.editMode?'✓ Done editing':'✏️ Edit land';
  if(grid) grid.classList.toggle('plot-edit-mode',!!state.plot.editMode);
  document.getElementById('exterior-screen')?.classList.toggle('plot-edit-mode',!!state.plot.editMode);
  if(bar) bar.classList.toggle('plot-edit-active',!!state.plot.editMode);
  updatePlotUnlockDisplays();
  if(typeof refreshBarnPlotOverlays==='function') refreshBarnPlotOverlays();
}

let plotLockedMenuCloser=null;

function closePlotLockedTileMenu(){
  document.getElementById('plot-locked-menu')?.remove();
  if(plotLockedMenuCloser){
    document.removeEventListener('pointerdown',plotLockedMenuCloser,true);
    plotLockedMenuCloser=null;
  }
}

function getStructurePlotMenuIds(){
  const ids=[];
  if(typeof isWellHydratedUnlocked==='function'&&isWellHydratedUnlocked()) ids.push('well_hydrated');
  else if(typeof isWellFinishedUnlocked==='function'&&isWellFinishedUnlocked()) ids.push('well_finished');
  else ids.push('well');
  if(typeof isBarnUnlocked==='function'&&isBarnUnlocked()){
    ids.push('small_barn_complete');
    if(typeof isLargeBarnUnlocked==='function'&&isLargeBarnUnlocked()
      &&typeof canUseLargeBarnStructure==='function'&&canUseLargeBarnStructure()){
      ids.push('large_barn_complete');
    }else if(typeof canUseMediumBarnStructure==='function'&&canUseMediumBarnStructure()){
      ids.push('medium_barn_complete');
    }
  }else if(typeof isBarnDoorlessUnlocked==='function'&&isBarnDoorlessUnlocked()) ids.push('small_barn_doorless');
  else if(typeof isBarnWallsUnlocked==='function'&&isBarnWallsUnlocked()) ids.push('small_barn_walls');
  else ids.push('small_barn');
  ids.push('fire_pit','simple_kiln','washing_line');
  return ids;
}

function isPlotAddMenuItemLocked(catId, id, def, wcLvl, mineLvl, x, y){
  if(!def) return true;
  if(catId==='woodland') return isWoodlandPlotAddLocked(id, def, wcLvl);
  if(catId==='quarry') return isQuarryPlotAddLocked(id, def, mineLvl);
  if(catId==='water') return isWaterPlotAddLocked();
  if(catId==='structures') return isStructurePlotAddItemLocked(id, def, x, y);
  return false;
}

function togglePlotAddMenuHideLocked(){
  if(!state.plot) state.plot={};
  state.plot.addMenuHideLocked=!state.plot.addMenuHideLocked;
  if(plotAddCoords) openPlotAddMenu(plotAddCoords.x, plotAddCoords.y);
}

function openPlotLockedTileMenu(x,y){
  closePlotAddMenu();
  closePlotLockedTileMenu();
  hideAllPlotActivityMenus();
  const feat=typeof getPlotFeatureTileAt==='function'?getPlotFeatureTileAt(x,y):null;
  const unlockable=!!state.plot?.editMode&&typeof isPlotTileUnlockable==='function'&&isPlotTileUnlockable(x,y);
  const rem=typeof getPlotUnlockCreditsRemaining==='function'?getPlotUnlockCreditsRemaining():0;
  const access=typeof getPlotCellAccessRequirementLabel==='function'?getPlotCellAccessRequirementLabel(x,y):'';
  let title='Unclaimed land';
  let icon='🌿';
  let desc='';
  let items=[];
  if(feat){
    title=feat.name;
    icon=feat.icon;
    desc=feat.desc||'Unlock this tile in Edit land to discover and place it anywhere on your homestead.';
    items=typeof getPlotTileProspectItems==='function'?getPlotTileProspectItems(feat.typeId):[];
  }else if(unlockable){
    desc='You can unlock this tile now in Edit land.';
  }else if(rem>0){
    desc='Unlock adjacent land in Edit land first, then you can claim this tile.';
  }else{
    desc='Raise Exploration to earn more land unlocks, then expand in Edit land.';
  }
  let itemsHtml='';
  if(items.length){
    itemsHtml='<div class="plot-locked-items-title">Available here</div>'
      +'<ul class="plot-locked-items">'
      +items.map((it)=>'<li><span class="plot-locked-item-icon">'+it.icon+'</span><span>'+it.name+'</span></li>').join('')
      +'</ul>';
  }
  const unlockBtn=unlockable
    ?'<button type="button" class="plot-locked-unlock-btn" onclick="unlockPlotTileFromLockedMenu('+x+','+y+')">Unlock this tile</button>'
    :'';
  const w=document.getElementById('game-wrapper');
  const m=document.createElement('div');
  m.id='plot-locked-menu';
  m.className='plot-add-menu plot-locked-menu';
  m.onclick=(e)=>e.stopPropagation();
  m.innerHTML='<div class="plot-add-title">'+icon+' '+title+'</div>'
    +(access?'<div class="plot-locked-access">'+access+' required</div>':'')
    +'<div class="plot-add-sub">'+desc+'</div>'
    +itemsHtml
    +unlockBtn
    +'<button type="button" class="plot-add-cancel" onclick="closePlotLockedTileMenu()">close</button>';
  w.appendChild(m);
  setTimeout(()=>{
    plotLockedMenuCloser=function(e){
      const menu=document.getElementById('plot-locked-menu');
      if(!menu){
        document.removeEventListener('pointerdown',plotLockedMenuCloser,true);
        plotLockedMenuCloser=null;
        return;
      }
      if(menu.contains(e.target)) return;
      closePlotLockedTileMenu();
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('pointerdown',plotLockedMenuCloser,true);
  },80);
}

function unlockPlotTileFromLockedMenu(x,y){
  if(unlockPlotTile(x,y)){
    closePlotLockedTileMenu();
    renderPlotGrid();
    updatePlotUnlockDisplays();
    return;
  }
  showToast(plotLayerUnlockMessage());
}

function onEmptyPlotTap(x,y){
  if(plotSuppressClick) return;
  if(state.plot?.editMode&&typeof isPlotTileUnlockable==='function'&&isPlotTileUnlockable(x,y)){
    if(unlockPlotTile(x,y)){
      renderPlotGrid();
      updatePlotUnlockDisplays();
      return;
    }
  }
  if(!isPlotTileUnlocked(x,y)){
    openPlotLockedTileMenu(x,y);
    return;
  }
  openPlotAddMenu(x,y);
}

function onPlotTileTap(event,x,y, slot){
  if(plotSuppressClick||!slot) return;
  const def=getPlotTileDef(slot.typeId);
  if(!def) return;
  if(state.plot.editMode){
    if(!def.removable) return;
    if(def.behavior==='barn'){
      const cfg=typeof getBarnConfig==='function'?getBarnConfig(slot.instanceId):null;
      const multi=cfg&&(typeof isMultiTileBarn==='function'?isMultiTileBarn(cfg):(cfg.size==='medium'||cfg.size==='large'));
      if(multi&&typeof confirmRemoveMediumBarn==='function'){
        confirmRemoveMediumBarn(slot.instanceId);
        return;
      }
    }
    confirmRemovePlotTile(x,y, slot, def);
    return;
  }
  if(def.behavior==='hut') enterHut();
}

function buildQuarryCellHtml(slot, def, editMode){
  const isThisQuarry=mine.instanceId===slot.instanceId;
  const stacks=isThisQuarry?mine.stacks:0;
  const maxStacks=getMineMaxStacks();
  const isActive=mine.running&&isThisQuarry;
  const label=(def?.name||'Quarry').toLowerCase();
  const menuLabel=quarryMenuBtnLabel(stacks, isActive);
  return '<div class="plot-activity-top quarry-activity-top'+(isActive?' mining-active':'')+'">'
    +buildMineSparklesHtml()
    +quarryStackBadgeHtml(stacks, maxStacks)
    +'<div class="quarry-sprite">'
    +'<div class="quarry-rock-wrap">'
    +'<div class="rock-sprite"><div class="rock rock-big"></div><div class="rock rock-small"></div></div>'
    +'</div>'
    +'<span class="quarry-label">'+label+'</span>'
    +'</div></div>'
    +'<div class="plot-activity-menu-zone quarry-menu-zone">'
    +'<button type="button" class="plot-menu-btn quarry-menu-btn'+(stacks>0?' has-stacks':'')+'">'+menuLabel+'</button>'
    +'</div>'
    +(editMode?'<div class="plot-edit-hint">remove</div>':'');
}

function getMineMaxStacks(){
  return MINE_MAX_STACKS;
}

function quarryStackBadgeHtml(stacks, maxStacks){
  if(stacks<=0) return '';
  return '<div class="quarry-stack-badge"><span class="quarry-stack-count">'+stacks+'/'+maxStacks+'</span></div>';
}

function hidePlotActivityMenu(key){
  if(!key||!plotActivityMenuTimers[key]) return;
  const entry=plotActivityMenuTimers[key];
  if(entry.timer) clearTimeout(entry.timer);
  if(entry.el?.classList) entry.el.classList.remove('plot-activity-menu-ready');
  delete plotActivityMenuTimers[key];
}

function hideAllPlotActivityMenus(){
  Object.keys(plotActivityMenuTimers).forEach(hidePlotActivityMenu);
  document.querySelectorAll('.plot-activity-menu-ready').forEach(el=>{
    el.classList.remove('plot-activity-menu-ready');
  });
}

function revealPlotActivityMenu(key, el){
  if(!key||!el) return;
  hideAllPlotActivityMenus();
  el.classList.add('plot-activity-menu-ready');
  const timer=setTimeout(()=>hidePlotActivityMenu(key), ACTIVITY_MENU_SHOW_MS);
  plotActivityMenuTimers[key]={ timer, el };
}

function isPlotMenuZone(el, clientY){
  const rect=el.getBoundingClientRect();
  return (clientY-rect.top)/rect.height>=0.66;
}

function handleWellCellTap(e, cell, slot){
  setActiveWell(slot.instanceId);
  if(e.target?.closest('.well-quick-action-btn')){ wellQuickTap(e); return; }
  if(e.target?.closest('.plot-menu-btn')){ wellMenuTap(e); return; }
  if(isPlotMenuZone(cell, e.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    wellMenuTap(e);
    return;
  }
  const cfg=typeof getWellConfig==='function'?getWellConfig(slot.instanceId):null;
  const stage=typeof getWellStage==='function'?getWellStage(cfg):'building';
  if(stage==='building'){
    wellMenuTap(e);
    return;
  }
  if(stage==='hydrated'&&typeof wellQuickTap==='function') wellQuickTap(e);
  const freshCell=document.querySelector('.plot-cell.cell-well[data-instance-id="'+slot.instanceId+'"]')||cell;
  revealPlotActivityMenu('well:'+slot.instanceId, freshCell);
}

function handleFirePitCellTap(e, cell, slot){
  setActiveFirePit(slot.instanceId);
  if(e.target?.closest('.fire-pit-quick-action-btn')){ firePitQuickTap(e); return; }
  if(e.target?.closest('.plot-menu-btn')){ firePitMenuTap(e); return; }
  if(isPlotMenuZone(cell, e.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    firePitMenuTap(e);
    return;
  }
  const cfg=typeof getFirePitConfig==='function'?getFirePitConfig(slot.instanceId):null;
  if(getFirePitStage(cfg)==='building'){
    firePitMenuTap(e);
    return;
  }
  const freshCell=document.querySelector('.plot-cell.cell-fire-pit[data-instance-id="'+slot.instanceId+'"]')||cell;
  revealPlotActivityMenu('fire_pit:'+slot.instanceId, freshCell);
}

function handleBarnCellTap(e, cell, slot){
  setActiveBarn(slot.instanceId);
  const cfg=typeof getBarnConfig==='function'?getBarnConfig(slot.instanceId):null;
  if(cfg&&typeof isLargeBarn==='function'&&isLargeBarn(cfg)){
    if(e.target?.closest('.plot-menu-btn')){ barnMenuTap(e); return; }
    if(isPlotMenuZone(cell, e.clientY)){
      barnMenuTap(e);
      return;
    }
    if(typeof barnEnterTap==='function') barnEnterTap(e);
    return;
  }
  if(e.target?.closest('.plot-menu-btn')){ barnMenuTap(e); return; }
  if(isPlotMenuZone(cell, e.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    barnMenuTap(e);
    return;
  }
  barnMenuTap(e);
}

function handleKilnCellTap(e, cell, slot){
  setActiveKiln(slot.instanceId);
  if(e.target?.closest('.kiln-quick-action-btn')){ kilnQuickTap(e); return; }
  if(e.target?.closest('.plot-menu-btn')){ kilnMenuTap(e); return; }
  if(isPlotMenuZone(cell, e.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    kilnMenuTap(e);
    return;
  }
  const cfg=typeof getKilnConfig==='function'?getKilnConfig(slot.instanceId):null;
  const stage=getKilnStage(cfg);
  if(stage!=='complete'){
    kilnMenuTap(e);
    return;
  }
  if(typeof kilnQuickTap==='function') kilnQuickTap(e);
  const freshCell=document.querySelector('.plot-cell.cell-kiln[data-instance-id="'+slot.instanceId+'"]')||cell;
  revealPlotActivityMenu('kiln:'+slot.instanceId, freshCell);
}

function handleWoodlandCellTap(e, cell, slot){
  if(e.target?.closest('.plot-menu-btn')){ wcMenuTap(e, cell); return; }
  if(isPlotMenuZone(cell, e.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    wcMenuTap(e, cell);
    return;
  }
  chopTree(e, slot.instanceId);
  revealPlotActivityMenu('wc:'+slot.instanceId, cell);
}

function quarryMenuSplitActive(cell){
  return cell.classList.contains('plot-activity-menu-ready')||cell.classList.contains('has-mine-stacks');
}

function handleQuarryCellTap(e, cell, slot){
  if(e.target?.closest('.plot-menu-btn')&&quarryMenuSplitActive(cell)){
    quarryMenuTap(e, cell);
    return;
  }
  if(quarryMenuSplitActive(cell)&&isPlotMenuZone(cell, e.clientY)){
    quarryMenuTap(e, cell);
    return;
  }
  addMineStack(slot.instanceId);
  revealPlotActivityMenu('quarry:'+slot.instanceId, cell);
}

function handleGatherCellTap(e, cell, slot){
  if(e.target?.closest('.plot-menu-btn')){ gatherMenuTap(e, cell); return; }
  if(isPlotMenuZone(cell, e.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    gatherMenuTap(e, cell);
    return;
  }
  const instanceId=slot.instanceId;
  if(gather.running&&gather.instanceId===instanceId){
    revealPlotActivityMenu('gather:'+instanceId, cell);
    return;
  }
  if(gather.running&&gather.instanceId!==instanceId){
    if(invTotal()>=getInvCap()){
      showToast('Bag full ('+invTotal()+'/'+getInvCap()+') — make room before foraging.');
      revealPlotActivityMenu('gather:'+instanceId, cell);
      return;
    }
    switchGatheringSpot(instanceId);
    revealPlotActivityMenu('gather:'+instanceId, cell);
    return;
  }
  if(invTotal()>=getInvCap()){
    showToast('Bag full ('+invTotal()+'/'+getInvCap()+') — make room before foraging.');
    revealPlotActivityMenu('gather:'+instanceId, cell);
    return;
  }
  startGathering(instanceId);
  revealPlotActivityMenu('gather:'+instanceId, cell);
}

function resolveWaterSurfaceForPlotCell(x, y, slot, cell){
  if(!plotWaterBodies) computeWaterBodies();
  const bodyKey=plotCoordKey(x,y);
  const bodyId=plotWaterBodies?.cellToBody?.[bodyKey]||cell?.dataset?.waterBodyId;
  if(bodyId){
    const surface=getWaterBodySurface(bodyId);
    if(surface) return surface;
  }
  if(slot?.instanceId){
    return document.querySelector('.water-body-surface[data-instance-id="'+slot.instanceId+'"]');
  }
  return null;
}

function resolvePondInstanceIdFromSurface(surface){
  if(!surface) return null;
  if(surface.dataset.instanceId) return surface.dataset.instanceId;
  const bodyId=surface.dataset.waterBodyId;
  if(!bodyId) return null;
  if(!plotWaterBodies) computeWaterBodies();
  const body=plotWaterBodies?.bodies?.[bodyId];
  if(!body?.cells?.length) return null;
  for(const c of body.cells){
    const slot=getPlotCell(c.x,c.y);
    if(slot?.instanceId) return slot.instanceId;
  }
  return null;
}

function handleWaterSurfaceTap(e, surface){
  const pondId=resolvePondInstanceIdFromSurface(surface);
  const menuKey='pond:'+(surface.dataset.waterBodyId||pondId||'spot');
  if(e.target?.closest('.plot-menu-btn')){ pondMenuTap(e, surface); return; }
  if(isPlotMenuZone(surface, e.clientY)&&surface.classList.contains('plot-activity-menu-ready')){
    pondMenuTap(e, surface);
    return;
  }
  notePondSeen();
  if(pondId) fish.pondInstanceId=pondId;
  if(fish.releasing) stopReleasingFish();
  const instanceId=pondId;
  if(fish.running&&fish.pondInstanceId===instanceId){
    revealPlotActivityMenu(menuKey, surface);
    return;
  }
  if(fish.running&&fish.pondInstanceId!==instanceId){
    if(invTotal()>=getInvCap()){
      showToast('Bag is full ('+invTotal()+'/'+getInvCap()+') — make room for fish.');
      revealPlotActivityMenu(menuKey, surface);
      return;
    }
    switchFishingSpot(instanceId);
    revealPlotActivityMenu(menuKey, surface);
    return;
  }
  if(invTotal()>=getInvCap()){
    showToast('Bag is full ('+invTotal()+'/'+getInvCap()+') — make room for fish.');
    revealPlotActivityMenu(menuKey, surface);
    return;
  }
  startFishing(instanceId);
  revealPlotActivityMenu(menuKey, surface);
}

function confirmRemovePlotTile(x,y, slot, def){
  showChoiceBanner(
    'Clear this tile?',
    def.icon,
    'Remove '+def.name+'? Nothing is lost forever — you can always build something else here.',
    'Clear tile',
    'Keep it',
    ()=>removePlotTile(x,y)
  );
}

function removePlotTile(x,y){
  const slot=getPlotCell(x,y);
  if(!slot) return;
  const def=getPlotTileDef(slot.typeId);
  if(!def?.removable) return;
  if(def.behavior==='barn'){
    const cfg=typeof getBarnConfig==='function'?getBarnConfig(slot.instanceId):null;
    if(cfg?.size==='medium'){
      if(typeof removeMediumBarnFromPlot==='function') removeMediumBarnFromPlot(slot.instanceId);
      return;
    }
  }
  if(typeof runPlotStructureOnRemove==='function') runPlotStructureOnRemove(slot, def, x, y);
  clearPlotTileConfig(slot.instanceId, slot.typeId);
  setPlotCell(x,y,null);
  renderPlotGrid();
  showToast(def.icon+' Cleared. Your land, your rules.');
}

function structurePlotAddItemHtml(id, def, x, y, opts){
  const unlocked=!!opts?.unlocked;
  const disabled=!!opts?.disabled;
  const drops=opts?.drops||(unlocked?'Unlocked. Free to place':'Locked. Place structure to finish building');
  const cls='plot-add-item '+(unlocked?'structure-unlocked':'structure-locked'+(disabled?' is-disabled':''));
  return '<button type="button" class="'+cls+'"'+(disabled?' disabled':'')+' onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'+def.name
    +'<span class="plot-add-item-drops">'+drops+'</span></span></button>';
}

function buildStructurePlotAddItem(id, def, x, y){
  if(id==='well_hydrated'){
    const unlocked=typeof isWellHydratedUnlocked==='function'&&isWellHydratedUnlocked();
    return structurePlotAddItemHtml(id, def, x, y, { unlocked, disabled:!unlocked });
  }
  if(id==='well_finished'){
    if(typeof isWellHydratedUnlocked==='function'&&isWellHydratedUnlocked()) return '';
    const unlocked=typeof isWellFinishedUnlocked==='function'&&isWellFinishedUnlocked();
    return structurePlotAddItemHtml(id, def, x, y, {
      unlocked:false,
      disabled:!unlocked,
      drops:unlocked
        ?'Incomplete — hydrate with Water Lv '+WELL_HYDRATE_WATER_LEVEL
        :'Locked. Finish a well with rope and bucket first.',
    });
  }
  if(id==='well'){
    if(typeof isWellFinishedUnlocked==='function'&&isWellFinishedUnlocked()) return '';
    const unlocked=typeof isWellUnlocked==='function'&&isWellUnlocked();
    const canPlace=typeof canPlaceWell==='function'&&canPlaceWell();
    return structurePlotAddItemHtml(id, def, x, y, { unlocked, disabled:!canPlace });
  }
  if(id==='fire_pit'){
    if(typeof canUseFirePitStructure==='function'&&!canUseFirePitStructure()){
      return structurePlotAddItemHtml(id, def, x, y, {
        unlocked:false,
        disabled:true,
        drops:'Need Architecture Lv '+FIRE_PIT_ARCH_UNLOCK,
      });
    }
    const unlocked=typeof isFirePitUnlocked==='function'&&isFirePitUnlocked();
    const canPlace=typeof canPlaceFirePit==='function'&&canPlaceFirePit();
    return structurePlotAddItemHtml(id, def, x, y, { unlocked, disabled:!canPlace });
  }
  if(id==='simple_kiln'){
    if(typeof canUseKilnStructure==='function'&&!canUseKilnStructure()){
      return structurePlotAddItemHtml(id, def, x, y, {
        unlocked:false,
        disabled:true,
        drops:'Need Architecture Lv '+KILN_ARCH_UNLOCK,
      });
    }
    const unlocked=typeof isKilnLitUnlocked==='function'&&isKilnLitUnlocked();
    const canPlace=typeof canPlaceKiln==='function'&&canPlaceKiln();
    return structurePlotAddItemHtml(id, def, x, y, { unlocked, disabled:!canPlace });
  }
  if(id==='small_barn'){
    if(typeof canUseBarnStructure==='function'&&!canUseBarnStructure()){
      return structurePlotAddItemHtml(id, def, x, y, {
        unlocked:false,
        disabled:true,
        drops:'Need Architecture Lv '+BARN_ARCH_UNLOCK,
      });
    }
    if(typeof isBarnWallsUnlocked==='function'&&isBarnWallsUnlocked()) return '';
    const canPlace=typeof canPlaceBarnSite==='function'&&canPlaceBarnSite();
    return structurePlotAddItemHtml(id, def, x, y, { unlocked:false, disabled:!canPlace });
  }
  if(id==='small_barn_walls'){
    if(typeof isBarnDoorlessUnlocked==='function'&&isBarnDoorlessUnlocked()) return '';
    const unlocked=typeof isBarnWallsUnlocked==='function'&&isBarnWallsUnlocked();
    return structurePlotAddItemHtml(id, def, x, y, {
      unlocked:false,
      disabled:!unlocked,
      drops:unlocked
        ?'Incomplete — add slate and nails for the roof'
        :'Locked. Raise the barn walls first.',
    });
  }
  if(id==='small_barn_doorless'){
    if(typeof isBarnUnlocked==='function'&&isBarnUnlocked()) return '';
    const unlocked=typeof isBarnDoorlessUnlocked==='function'&&isBarnDoorlessUnlocked();
    return structurePlotAddItemHtml(id, def, x, y, {
      unlocked:false,
      disabled:!unlocked,
      drops:unlocked
        ?'Incomplete — add ashwood and nails for the barn door'
        :'Locked. Roof a barn first.',
    });
  }
  if(id==='small_barn_complete'){
    const unlocked=typeof isBarnUnlocked==='function'&&isBarnUnlocked();
    return structurePlotAddItemHtml(id, def, x, y, { unlocked, disabled:!unlocked });
  }
  if(id==='washing_line'){
    if(typeof canUseWashingLineStructure==='function'&&!canUseWashingLineStructure()){
      return structurePlotAddItemHtml(id, def, x, y, {
        unlocked:false,
        disabled:true,
        drops:'Need Architecture Lv '+WASHING_LINE_ARCH_UNLOCK,
      });
    }
    const unlocked=typeof isWashingLineUnlocked==='function'&&isWashingLineUnlocked();
    const canPlace=typeof canPlaceWashingLine==='function'&&canPlaceWashingLine();
    return structurePlotAddItemHtml(id, def, x, y, { unlocked, disabled:!canPlace });
  }
  if(id==='improved_washing_line') return '';
  if(id==='large_barn_complete'){
    if(typeof canUseLargeBarnStructure==='function'&&!canUseLargeBarnStructure()){
      return structurePlotAddItemHtml(id, def, x, y, {
        unlocked:false,
        disabled:true,
        drops:'Need Architecture Lv '+BARN_LARGE_UPGRADE_ARCH_UNLOCK,
      });
    }
    const unlocked=typeof isLargeBarnUnlocked==='function'&&isLargeBarnUnlocked();
    const canPlace=typeof canPlaceLargeBarnAt==='function'&&canPlaceLargeBarnAt(x, y);
    return structurePlotAddItemHtml(id, def, x, y, {
      unlocked,
      disabled:!unlocked,
      drops:!unlocked
        ?'Locked. Upgrade a medium barn to large first.'
        :!canPlace
          ?'Need two adjacent empty unlocked tiles here'
          :'Spans 2 tiles — free after your first large barn upgrade',
    });
  }
  if(id==='medium_barn_complete'){
    if(typeof canUseMediumBarnStructure==='function'&&!canUseMediumBarnStructure()){
      return structurePlotAddItemHtml(id, def, x, y, {
        unlocked:false,
        disabled:true,
        drops:'Need Architecture Lv '+BARN_MEDIUM_ARCH_UNLOCK,
      });
    }
    const unlocked=typeof isMediumBarnUnlocked==='function'&&isMediumBarnUnlocked();
    const canPlace=typeof canPlaceMediumBarnAt==='function'&&canPlaceMediumBarnAt(x, y);
    return structurePlotAddItemHtml(id, def, x, y, {
      unlocked,
      disabled:!unlocked,
      drops:!unlocked
        ?'Locked. Upgrade a small barn first.'
        :!canPlace
          ?'Need two adjacent empty unlocked tiles here'
          :'Spans 2 tiles — free after your first upgrade',
    });
  }
  return structurePlotAddItemHtml(id, def, x, y, { unlocked:false, disabled:false });
}

function placePlotTile(x,y, typeId){
  migratePlot();
  if(getPlotCell(x,y)) return;
  const def=getPlotTileDef(typeId);
  if(!def) return;
  if(!def.removable) return;
  if(def.behavior==='water'&&typeof canPlaceAnotherWaterPlotTile==='function'&&!canPlaceAnotherWaterPlotTile()){
    showToast(typeof waterPlotTileLimitMessage==='function'?waterPlotTileLimitMessage():'Water tile limit reached.');
    return;
  }
  if(def.behavior==='well'&&typeId==='well'&&typeof canPlaceWell==='function'&&!canPlaceWell()){
    showToast('Finish building your first well before placing another.');
    return;
  }
  if(def.behavior==='well'&&typeId==='well_finished'&&typeof isWellFinishedUnlocked==='function'&&!isWellFinishedUnlocked()){
    showToast('Finish a well with rope and bucket first.');
    return;
  }
  if(def.behavior==='well'&&typeId==='well_hydrated'&&typeof isWellHydratedUnlocked==='function'&&!isWellHydratedUnlocked()){
    showToast('Hydrate a well first.');
    return;
  }
  if(def.behavior==='fire_pit'){
    if(typeof canUseFirePitStructure==='function'&&!canUseFirePitStructure()){
      showToast('Need Architecture Lv '+FIRE_PIT_ARCH_UNLOCK+' for Fire Pit.');
      return;
    }
    if(typeof canPlaceFirePit==='function'&&!canPlaceFirePit()){
      showToast('Finish building your first fire pit before placing another.');
      return;
    }
  }
  if(def.behavior==='kiln'){
    if(typeof canUseKilnStructure==='function'&&!canUseKilnStructure()){
      showToast('Need Architecture Lv '+KILN_ARCH_UNLOCK+' for Simple Kiln.');
      return;
    }
    if(typeof canPlaceKiln==='function'&&!canPlaceKiln()){
      showToast('Finish building your first kiln before placing another.');
      return;
    }
  }
  if(def.behavior==='washing_line'){
    if(typeof canUseWashingLineStructure==='function'&&!canUseWashingLineStructure()){
      showToast('Need Architecture Lv '+WASHING_LINE_ARCH_UNLOCK+' for Washing Line.');
      return;
    }
    if(typeof canPlaceWashingLine==='function'&&!canPlaceWashingLine()){
      showToast('Finish building your first washing line before placing another.');
      return;
    }
  }
  if(def.behavior==='barn'){
    if(typeof canUseBarnStructure==='function'&&!canUseBarnStructure()){
      showToast('Need Architecture Lv '+BARN_ARCH_UNLOCK+' for Small Barn.');
      return;
    }
    if(typeId==='small_barn'&&typeof canPlaceBarnSite==='function'&&!canPlaceBarnSite()){
      showToast('Finish building your first barn frame before placing another.');
      return;
    }
    if(typeId==='small_barn_walls'&&typeof isBarnWallsUnlocked==='function'&&!isBarnWallsUnlocked()){
      showToast('Raise the barn walls first.');
      return;
    }
    if(typeId==='small_barn_doorless'&&typeof isBarnDoorlessUnlocked==='function'&&!isBarnDoorlessUnlocked()){
      showToast('Roof a barn first.');
      return;
    }
    if(typeId==='small_barn_complete'&&typeof isBarnUnlocked==='function'&&!isBarnUnlocked()){
      showToast('Finish building a small barn first.');
      return;
    }
    if(typeId==='medium_barn_complete'){
      if(typeof placeMediumBarnPlotTile==='function'){
        if(placeMediumBarnPlotTile(x, y)) closePlotAddMenu();
      }else if(typeof getMediumBarnPlacementBlockReason==='function'){
        showToast(getMediumBarnPlacementBlockReason(x, y));
      }
      return;
    }
    if(typeId==='large_barn_complete'){
      if(typeof placeLargeBarnPlotTile==='function'){
        if(placeLargeBarnPlotTile(x, y)) closePlotAddMenu();
      }else if(typeof getLargeBarnPlacementBlockReason==='function'){
        showToast(getLargeBarnPlacementBlockReason(x, y));
      }
      return;
    }
  }
  if(def.unlockLevel){
    if(def.behavior==='quarry'&&def.unlockLevel>(Number(state.skills.mining?.level)||1)){
      showToast('Need Mining Lv '+def.unlockLevel+' for '+def.name+'.');
      return;
    }
    if(def.behavior==='tree'&&def.unlockLevel>getWoodcutLevel()){
      showToast('Need Woodcutting Lv '+def.unlockLevel+' for '+def.name+'.');
      return;
    }
  }
  const instanceId=genPlotInstanceId();
  setPlotCell(x,y,{ instanceId, typeId });
  state.plotConfigs[instanceId]=defaultPlotConfig(def.behavior, typeId);
  closePlotAddMenu();
  if(def.behavior==='well'){
    migrateWell();
    const cfg=getWellConfig(instanceId);
    setActiveWell(instanceId);
    if(typeId==='well_hydrated'){
      cfg.bricks=WELL_BRICKS_REQUIRED;
      cfg.bucketless=true;
      cfg.equipped=true;
      cfg.hydrated=true;
      cfg.freePlaced=true;
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Well placed.');
    }else if(typeId==='well_finished'){
      cfg.bricks=WELL_BRICKS_REQUIRED;
      cfg.bucketless=true;
      cfg.equipped=true;
      cfg.freePlaced=true;
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Well (dry) placed.');
    }else if(state.wellUnlocked){
      cfg.bricks=WELL_BRICKS_REQUIRED;
      cfg.bucketless=true;
      cfg.freePlaced=true;
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Well (bucketless) placed.');
    }else{
      scheduleSaveGame();
      renderPlotGrid();
      showToast('You mark out the site. Now you need bricks.');
    }
    return;
  }
  if(def.behavior==='fire_pit'){
    migrateFirePit();
    const cfg=getFirePitConfig(instanceId);
    setActiveFirePit(instanceId);
    if(state.firePitUnlocked){
      FIRE_PIT_MATERIALS.forEach(m=>{ cfg[m.countKey]=m.required; });
      cfg.complete=true;
      cfg.freePlaced=true;
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Fire pit placed.');
    }else{
      scheduleSaveGame();
      renderPlotGrid();
      showToast('You mark out the site. Stone, clay, and bricks needed.');
    }
    return;
  }
  if(def.behavior==='kiln'){
    migrateKiln();
    const cfg=getKilnConfig(instanceId);
    setActiveKiln(instanceId);
    if(state.kilnLitUnlocked){
      applyKilnFreePlacedReady(cfg);
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Simple kiln placed.');
    }else if(state.kilnUnlocked){
      KILN_BUILD_MATERIALS.forEach(m=>{ cfg[m.countKey]=m.required; });
      cfg.fired=true;
      cfg.freePlaced=true;
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Simple kiln placed.');
    }else{
      scheduleSaveGame();
      renderPlotGrid();
      showToast('You mark out the site. Stone, clay, and bricks needed.');
    }
    return;
  }
  if(def.behavior==='washing_line'){
    migrateWashingLine();
    const cfg=getWashingLineConfig(instanceId);
    setActiveWashingLine(instanceId);
    const slot=getPlotCell(x,y);
    if(state.washingLineImprovedUnlocked&&slot){
      slot.typeId=WASHING_LINE_IMPROVED_TYPE_ID;
      cfg.improved=true;
      cfg.logs=WASHING_LINE_LOGS_REQUIRED;
      cfg.rope=WASHING_LINE_ROPE_REQUIRED;
      cfg.complete=true;
      cfg.freePlaced=true;
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Washing line placed.');
    }else if(state.washingLineUnlocked){
      cfg.logs=WASHING_LINE_LOGS_REQUIRED;
      cfg.rope=WASHING_LINE_ROPE_REQUIRED;
      cfg.complete=true;
      cfg.freePlaced=true;
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Washing line placed.');
    }else{
      scheduleSaveGame();
      renderPlotGrid();
      showToast('You mark out the site. Twenty logs for the frame.');
    }
    return;
  }
  if(def.behavior==='barn'){
    migrateBarn();
    const cfg=getBarnConfig(instanceId);
    setActiveBarn(instanceId);
    if(typeId==='small_barn_complete'){
      applyBarnFreePlacedReady(cfg);
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Small barn placed.');
    }else if(typeId==='small_barn_doorless'){
      applyBarnDoorlessPlaced(cfg);
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Small Barn (doorless) placed.');
    }else if(typeId==='small_barn_walls'){
      applyBarnWallsPlaced(cfg);
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Small Barn (walls) placed.');
    }else{
      scheduleSaveGame();
      renderPlotGrid();
      showToast('You mark out the site. Logs and nails needed for the frame.');
    }
    return;
  }
  renderPlotGrid();
  showToast(def.icon+' '+def.name+' placed.');
}

function closePlotAddMenu(){
  document.getElementById('plot-add-menu')?.remove();
  plotAddCoords=null;
  if(plotAddMenuCloser){
    document.removeEventListener('pointerdown',plotAddMenuCloser,true);
    plotAddMenuCloser=null;
  }
}

function openPlotAddMenu(x,y){
  closePlotAddMenu();
  closePlotLockedTileMenu();
  hideAllPlotActivityMenus();
  plotAddCoords={ x, y };
  const showLocked=plotAddMenuShowsLocked();
  const w=document.getElementById('game-wrapper');
  const m=document.createElement('div');
  m.id='plot-add-menu';
  m.className='plot-add-menu';
  m.onclick=(e)=>e.stopPropagation();
  let catsHtml='';
  PLOT_TILE_MENU.forEach(cat=>{
    const wcLvl=getWoodcutLevel();
    const mineLvl=Number(state.skills.mining?.level)||1;
    const menuIds=cat.id==='structures'?getStructurePlotMenuIds():cat.items;
    const items=menuIds.map(id=>{
      const def=PLOT_TILE_DEFS[id];
      if(!def) return '';
      if(!showLocked&&isPlotAddMenuItemLocked(cat.id, id, def, wcLvl, mineLvl, x, y)) return '';
      if(cat.id==='woodland'){
        return buildWoodlandPlotAddItem(id, def, wcLvl, x, y);
      }
      if(cat.id==='gathering'){
        return buildGatheringPlotAddItem(id, def, x, y);
      }
      if(cat.id==='quarry'){
        return buildQuarryPlotAddItem(id, def, mineLvl, x, y);
      }
      if(cat.id==='cave'){
        return buildCavePlotAddItem(id, def, x, y);
      }
      if(cat.id==='structures'){
        return buildStructurePlotAddItem(id, def, x, y);
      }
      if(cat.id==='water'){
        return buildWaterPlotAddItem(id, def, x, y);
      }
      return '<button type="button" class="plot-add-item" onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
        +'<span class="plot-add-item-icon">'+def.icon+'</span>'
        +'<span class="plot-add-item-name">'+def.name+'</span></button>';
    }).join('');
    catsHtml+='<div class="plot-add-cat">'
      +'<button type="button" class="plot-add-cat-head" onclick="togglePlotAddCategory(this)">'
      +'<span>'+cat.label+'</span><span class="plot-add-cat-chevron">▸</span></button>'
      +'<div class="plot-add-cat-body">'
      +(cat.desc?'<div class="plot-add-cat-desc">'+cat.desc+'</div>':'')
      +items
      +'</div></div>';
  });
  m.innerHTML='<div class="plot-add-head">'
    +'<div class="plot-add-title">ADD TO YOUR LAND</div>'
    +'<label class="plot-add-show-locked">'
    +'<input type="checkbox"'+(showLocked?' checked':'')+' onchange="togglePlotAddMenuShowLocked()">'
    +'<span>Show locked</span></label></div>'
    +'<div class="plot-add-sub">Pick what belongs here. You can change your mind anytime.</div>'
    +'<div class="plot-add-cats">'+catsHtml+'</div>'
    +'<button type="button" class="plot-add-cancel" onclick="closePlotAddMenu()">cancel</button>';
  w.appendChild(m);
  setTimeout(()=>{
    plotAddMenuCloser=function(e){
      const menu=document.getElementById('plot-add-menu');
      if(!menu){
        document.removeEventListener('pointerdown',plotAddMenuCloser,true);
        plotAddMenuCloser=null;
        return;
      }
      if(menu.contains(e.target)) return;
      closePlotAddMenu();
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('pointerdown',plotAddMenuCloser,true);
  },80);
}

function togglePlotAddCategory(headBtn){
  headBtn.closest('.plot-add-cat')?.classList.toggle('open');
}
