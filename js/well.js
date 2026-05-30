/* Hearthstead — well */
'use strict';

let activeWellInstanceId=null;
const wellFill={ filling:false, timer:null, queue:[], instanceId:null };

function normalizeWellConfig(cfg){
  if(!cfg) return { bricks:0, bucketless:false, equipped:false, hydrated:false, freePlaced:false };
  if(cfg.bricks==null) cfg.bricks=0;
  if(cfg.bucketless==null) cfg.bucketless=false;
  if(cfg.equipped==null) cfg.equipped=false;
  if(cfg.hydrated==null) cfg.hydrated=false;
  if(cfg.freePlaced==null) cfg.freePlaced=false;
  if(cfg.hydrated){
    cfg.bricks=WELL_BRICKS_REQUIRED;
    cfg.bucketless=true;
    cfg.equipped=true;
  }else if(cfg.equipped){
    cfg.bricks=WELL_BRICKS_REQUIRED;
    cfg.bucketless=true;
  }else if(cfg.bucketless||cfg.bricks>=WELL_BRICKS_REQUIRED){
    cfg.bricks=WELL_BRICKS_REQUIRED;
    cfg.bucketless=true;
  }
  return cfg;
}

function getWellConfig(instanceId){
  if(!instanceId) return null;
  return normalizeWellConfig(getPlotConfig(instanceId,'well','well'));
}

function setActiveWell(instanceId){
  activeWellInstanceId=instanceId||null;
}

function resolveWellCell(el){
  if(el?.classList?.contains('cell-well')) return el;
  return el?.closest?.('.plot-cell.cell-well')||null;
}

function resolveWellInstanceId(eventOrCell){
  const cell=eventOrCell?.classList?eventOrCell:resolveWellCell(eventOrCell?.target);
  return cell?.dataset?.instanceId||activeWellInstanceId||null;
}

function forEachWellSlot(fn){
  if(typeof forEachPlotOccupied!=='function') return;
  forEachPlotOccupied((x,y,slot)=>{
    if(getPlotTileDef(slot.typeId)?.behavior==='well') fn(x,y,slot);
  });
}

function countWellsOnPlot(){
  let n=0;
  forEachWellSlot(()=>{ n++; });
  return n;
}

function isWellUnlocked(){
  migrateWell();
  return !!state.wellUnlocked;
}

function canPlaceWell(){
  migrateWell();
  if(state.wellUnlocked) return true;
  return countWellsOnPlot()===0;
}

function hasWellOnPlot(){
  return countWellsOnPlot()>0;
}

function wellSlotExists(instanceId){
  let found=false;
  forEachWellSlot((x,y,slot)=>{ if(slot.instanceId===instanceId) found=true; });
  return found;
}

function totalWellBricksEarned(){
  let total=0;
  forEachWellSlot((x,y,slot)=>{
    const cfg=getWellConfig(slot.instanceId);
    if(cfg&&!cfg.freePlaced) total+=cfg.bricks|0;
  });
  return total;
}

function isWellFinishedUnlocked(){
  migrateWell();
  return !!state.wellFinishedUnlocked;
}

function isWellHydratedUnlocked(){
  migrateWell();
  return !!state.wellHydratedUnlocked;
}

function hasWellSupply(key){
  return itemCountBagAndStore(key)>0;
}

function unlockFinishedWells(){
  if(!state.wellFinishedUnlocked){
    state.wellFinishedUnlocked=true;
    scheduleSaveGame();
  }
}

function unlockHydratedWells(){
  if(!state.wellHydratedUnlocked){
    state.wellHydratedUnlocked=true;
    scheduleSaveGame();
  }
}

function getWellWaterLevel(){
  return Number(state.skills?.water?.level)||1;
}

function canHydrateWell(){
  return getWellWaterLevel()>=WELL_HYDRATE_WATER_LEVEL;
}

function migrateWell(){
  if(state.wellUnlocked==null) state.wellUnlocked=false;
  if(state.wellFinishedUnlocked==null) state.wellFinishedUnlocked=false;
  if(state.wellHydratedUnlocked==null) state.wellHydratedUnlocked=false;
  if(state.wellQuickAction==null) state.wellQuickAction='fill';
  if(state.well?.instanceId){
    const cfg=getWellConfig(state.well.instanceId);
    if(state.well.bricks!=null) cfg.bricks=state.well.bricks|0;
    if(state.well.complete){
      cfg.bucketless=true;
      cfg.bricks=WELL_BRICKS_REQUIRED;
      state.wellUnlocked=true;
    }
  }
  forEachWellSlot((x,y,slot)=>{
    normalizeWellConfig(getWellConfig(slot.instanceId));
    const cfg=getWellConfig(slot.instanceId);
    const stage=getWellStage(cfg);
    if(stage==='hydrated'){
      state.wellHydratedUnlocked=true;
      state.wellFinishedUnlocked=true;
      state.wellUnlocked=true;
      if(slot.typeId!=='well_hydrated') slot.typeId='well_hydrated';
    }else if(stage==='equipped'){
      state.wellFinishedUnlocked=true;
      state.wellUnlocked=true;
      if(slot.typeId==='well') slot.typeId='well_finished';
    }else if(stage!=='building'){
      state.wellUnlocked=true;
    }
  });
  if(!state.wellUnlocked){
    forEachWellSlot((x,y,slot)=>{
      if(getWellStage(getWellConfig(slot.instanceId))!=='building') state.wellUnlocked=true;
    });
  }
  if(state.well) delete state.well;
  migrateWellArchitectureXp();
}

function migrateWellArchitectureXp(){
  if(state._wellArchXpMigrated) return;
  state._wellArchXpMigrated=true;
  const bricks=totalWellBricksEarned();
  if(bricks>0&&state.skills?.architecture){
    const perBrick=(typeof getWellArchXpPerBrick==='function'?getWellArchXpPerBrick():structureArchXpForMaterial('brick'));
    const earned=bricks*perBrick;
    const s=state.skills.architecture;
    s.xpToNext=xpForLevel(s.level);
    const current=getTotalSkillXp('architecture');
    if(current<earned) grantXP('architecture', earned-current, null);
  }
}

function unlockWells(){
  if(!state.wellUnlocked){
    state.wellUnlocked=true;
    scheduleSaveGame();
  }
}

function completeWell(instanceId){
  instanceId=instanceId||activeWellInstanceId;
  const cfg=getWellConfig(instanceId);
  if(!cfg) return;
  const showBanner=!cfg.bucketless;
  cfg.bricks=WELL_BRICKS_REQUIRED;
  cfg.bucketless=true;
  unlockWells();
  scheduleSaveGame();
  const refreshWellUi=()=>{
    if(typeof updateWellCells==='function') updateWellCells();
    if(currentScreen==='well-screen') renderWellScreen();
    syncUI();
  };
  if(showBanner){
    showFoundBanner(
      'WELL BUILT!',
      '🪣',
      'The walls are up — add a rope and bucket to finish it.'+structureCompleteBonusBannerSuffix('well'),
      'GOT IT',
      refreshWellUi
    );
  }
  refreshWellUi();
}

function finishWell(instanceId){
  if(instanceId&&typeof instanceId!=='string') instanceId=null;
  instanceId=instanceId||activeWellInstanceId;
  const cfg=getWellConfig(instanceId);
  if(!cfg||getWellStage(cfg)!=='bucketless') return false;
  if(!hasWellSupply('rope')||!hasWellSupply('bucket')){
    showToast('You need a rope and a bucket.');
    return false;
  }
  if(!consumeOneFromBagOrStore('rope')||!consumeOneFromBagOrStore('bucket')){
    showToast('You need a rope and a bucket.');
    return false;
  }
  const showBanner=!state.wellFinishedUnlocked;
  cfg.equipped=true;
  cfg.bucketless=true;
  cfg.bricks=WELL_BRICKS_REQUIRED;
  unlockFinishedWells();
  const found=typeof findPlotSlotByInstanceId==='function'?findPlotSlotByInstanceId(instanceId):null;
  if(found?.slot) found.slot.typeId='well_finished';
  scheduleSaveGame();
  const refreshWellUi=()=>{
    if(typeof updateWellCells==='function') updateWellCells();
    if(typeof renderPlotGrid==='function') renderPlotGrid();
    if(currentScreen==='well-screen') renderWellScreen();
    syncUI();
  };
  if(showBanner){
    showFoundBanner(
      'WELL READY!',
      '🪣',
      'Rope and bucket fitted — dry wells are now free to place. Hydrate one when it rains.',
      'GOT IT',
      refreshWellUi
    );
  }
  refreshWellUi();
  return true;
}

function hydrateWell(instanceId){
  instanceId=instanceId||activeWellInstanceId;
  const cfg=getWellConfig(instanceId);
  if(!cfg||getWellStage(cfg)!=='equipped') return false;
  if(!canHydrateWell()){
    showToast('Need Water Lv '+WELL_HYDRATE_WATER_LEVEL+' to hydrate a well.');
    return false;
  }
  const showBanner=!state.wellHydratedUnlocked;
  cfg.hydrated=true;
  cfg.equipped=true;
  cfg.bucketless=true;
  cfg.bricks=WELL_BRICKS_REQUIRED;
  unlockHydratedWells();
  const found=typeof findPlotSlotByInstanceId==='function'?findPlotSlotByInstanceId(instanceId):null;
  if(found?.slot) found.slot.typeId='well_hydrated';
  scheduleSaveGame();
  const refreshWellUi=()=>{
    if(typeof updateWellCells==='function') updateWellCells();
    if(typeof renderPlotGrid==='function') renderPlotGrid();
    if(currentScreen==='well-screen') renderWellScreen();
    syncUI();
  };
  if(showBanner){
    showFoundBanner(
      'WELL FILLED!',
      '💧',
      'Next time it rains, you angle the gutters toward the well. By morning the shaft gleams with water — your first proper water source.',
      'GOT IT',
      refreshWellUi
    );
  }else{
    showToast('Rain fills the well. Water rings the bucket now.');
    refreshWellUi();
  }
  return true;
}

function wellQuickTapLabel(){
  return state.wellQuickAction==='coin'?'toss a coin':'fill vessel';
}

function stopWellFillVessels(){
  wellFill.filling=false;
  wellFill.queue=[];
  clearTimeout(wellFill.timer);
  wellFill.timer=null;
}

function fillNextVessel(){
  if(!wellFill.filling) return;
  if(!isWaterSourceInstanceId(wellFill.instanceId)){
    stopWellFillVessels();
    if(currentScreen==='well-screen') renderWellScreen();
    syncUI();
    return;
  }
  if(!wellFill.queue.length){
    stopWellFillVessels();
    if(currentScreen==='well-screen') renderWellScreen();
    syncUI();
    return;
  }
  const vessel=wellFill.queue.shift();
  if(!consumeOneFromBag(vessel.emptyKey)){
    wellFill.timer=setTimeout(fillNextVessel, WELL_FILL_VESSEL_MS);
    return;
  }
  const added=invAdd(vessel.filledKey, vessel.filledIcon, vessel.filledName, 1);
  if(!added){
    invAdd(vessel.emptyKey, vessel.emptyIcon, vessel.emptyName, 1);
    stopWellFillVessels();
    showToast('Bag full — make room for filled vessels.');
    if(currentScreen==='well-screen') renderWellScreen();
    syncUI();
    return;
  }
  const xp=WELL_FILL_VESSEL_WATER_XP;
  grantXP('water', xp, null, { keepActivities:true });
  flashSkillPill('water');
  const name=vessel.filledName.toLowerCase();
  const msg=WELL_FILL_VESSEL_MSGS[Math.floor(Math.random()*WELL_FILL_VESSEL_MSGS.length)]
    .replace('{name}', name).replace('{xp}', xp);
  addActivityLog('well-log', vessel.filledIcon+' '+msg, 'success');
  const cell=document.querySelector('.plot-cell.cell-well[data-instance-id="'+wellFill.instanceId+'"]');
  if(cell){
    cell.classList.remove('well-draw-flash');
    void cell.offsetWidth;
    cell.classList.add('well-draw-flash');
  }
  syncUI();
  if(currentScreen==='well-screen') renderWellScreen();
  wellFill.timer=setTimeout(fillNextVessel, WELL_FILL_VESSEL_MS);
}

function fillVesselsFromWell(instanceId){
  instanceId=instanceId||activeWellInstanceId;
  if(wellFill.filling) return false;
  if(!isWaterSourceInstanceId(instanceId)){
    showToast('This well needs water first.');
    return false;
  }
  wellFill.queue=buildEmptyVesselQueue();
  if(!wellFill.queue.length){
    showToast('Nothing to fill — you need an empty vessel in your bag.');
    return false;
  }
  wellFill.instanceId=instanceId;
  wellFill.filling=true;
  if(instanceId) setActiveWell(instanceId);
  if(currentScreen==='well-screen') renderWellScreen();
  fillNextVessel();
  return true;
}

function toggleWellDefault(){
  state.wellQuickAction=state.wellQuickAction==='fill'?'coin':'fill';
  updateWellCellQuickAction();
  renderWellScreen();
  showToast('Quick tap: '+wellQuickTapLabel()+'.');
  scheduleSaveGame();
}

function tossCoinInWell(instanceId){
  stopWellFillVessels();
  instanceId=instanceId||activeWellInstanceId;
  const cfg=getWellConfig(instanceId);
  const stage=getWellStage(cfg);
  if(stage!=='hydrated'){
    showToast('Hydrate the well before tossing coins.');
    return false;
  }
  if(itemCountBagAndStore('old_coin')<1){
    showToast('You need an old coin.');
    return false;
  }
  if(!consumeOneFromBagOrStore('old_coin')){
    showToast('You need an old coin.');
    return false;
  }
  const xp=WELL_COIN_WATER_XP;
  grantXP('water', xp, null);
  flashSkillPill('water');
  const quip=WELL_COIN_TOSS_MSGS[Math.floor(Math.random()*WELL_COIN_TOSS_MSGS.length)];
  addActivityLog('well-log', '🪙 '+quip+' +'+xp+' Water', 'success');
  const cell=document.querySelector('.plot-cell.cell-well[data-instance-id="'+instanceId+'"]');
  if(cell){
    cell.classList.remove('well-coin-flash');
    void cell.offsetWidth;
    cell.classList.add('well-coin-flash');
  }
  if(currentScreen==='well-screen') renderWellScreen();
  syncUI();
  return true;
}

function wellQuickTap(event){
  event?.stopPropagation?.();
  const instanceId=resolveWellInstanceId(event);
  if(instanceId) setActiveWell(instanceId);
  const cfg=getWellConfig(instanceId);
  if(getWellStage(cfg)!=='hydrated'&&state.wellQuickAction==='fill'){
    if(getWellStage(cfg)==='equipped'){
      showToast('Hydrate the well before filling vessels.');
      return;
    }
    showToast('This well is not ready yet.');
    return;
  }
  if(state.wellQuickAction==='coin') tossCoinInWell(instanceId);
  else fillVesselsFromWell(instanceId);
}

function updateWellCellQuickAction(){
  const quick=wellQuickTapLabel();
  document.querySelectorAll('.plot-cell.cell-well.well-hydrated').forEach(cell=>{
    const btn=cell.querySelector('.well-quick-action-btn');
    if(btn) btn.textContent=quick;
  });
}

function renderWellKitHtml(){
  const hasRope=hasWellSupply('rope');
  const hasBucket=hasWellSupply('bucket');
  const canFinish=hasRope&&hasBucket;
  return '<div class="well-kit-row">'
    +'<div class="well-kit-btn '+(hasRope?'have':'need')+'">'
    +'<span class="well-kit-icon">⛓️</span><span class="well-kit-label">Rope</span></div>'
    +'<div class="well-kit-btn '+(hasBucket?'have':'need')+'">'
    +'<span class="well-kit-icon">🪣</span><span class="well-kit-label">Bucket</span></div>'
    +'</div>'
    +'<div class="wb-use-box"><div class="wb-use-btns">'
    +'<button class="wb-btn once well-finish-btn" style="flex:1" '+(canFinish?'':'disabled')+' onclick="finishWell()">'
    +'✓ FINISH WELL</button></div></div>';
}

function renderWellHydrateHtml(){
  const waterLvl=getWellWaterLevel();
  const canDo=canHydrateWell();
  return '<div class="well-req-note">When the next storm rolls in, you can aim the roof gutters here and let rain do the rest.</div>'
    +'<div class="well-req-line'+(canDo?'':' locked')+'">Water Lv '+WELL_HYDRATE_WATER_LEVEL+' required'
    +(canDo?' ✓':' (you are Lv '+waterLvl+')')+'</div>'
    +'<div class="wb-use-box"><div class="wb-use-btns">'
    +'<button class="wb-btn once" style="flex:1" '+(canDo?'':'disabled')+' onclick="hydrateWell()">'
    +'💧 HYDRATE WELL</button></div></div>';
}

function placeWellBrick(event, instanceId){
  instanceId=instanceId||activeWellInstanceId;
  const cfg=getWellConfig(instanceId);
  if(!cfg||cfg.bucketless||cfg.freePlaced) return false;
  if(cfg.bricks>=WELL_BRICKS_REQUIRED){
    if(!cfg.bucketless) completeWell(instanceId);
    return false;
  }
  if(itemCountBagAndStore('brick')<1){
    showToast('You need bricks. Try the Rocky Clearing.');
    return false;
  }
  if(!consumeOneFromBagOrStore('brick')){
    showToast('You need bricks. Try the Rocky Clearing.');
    return false;
  }
  cfg.bricks++;
  grantXP('architecture', getWellArchXpPerBrick(), null);
  if(cfg.bricks>=WELL_BRICKS_REQUIRED) completeWell(instanceId);
  else{
    if(typeof updateWellCells==='function') updateWellCells();
    if(currentScreen==='well-screen') renderWellScreen();
    syncUI();
  }
  return true;
}

function wellMenuTap(event){
  event?.stopPropagation();
  const instanceId=resolveWellInstanceId(event);
  if(instanceId) setActiveWell(instanceId);
  openWellScreen();
}

function openWellScreen(){
  migrateWell();
  const instanceId=activeWellInstanceId;
  if(!instanceId||!wellSlotExists(instanceId)){
    showToast('Mark out a well site on your plot first.');
    return;
  }
  showScreen('well-screen');
  lastHome='exterior-screen';
  renderWellScreen();
  syncUI();
}

function closeWellScreen(){
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  syncUI();
}

function renderWellBrickGrid(cfg){
  const el=document.getElementById('well-brick-grid');
  if(!el) return;
  const stage=getWellStage(cfg);
  if(stage==='equipped'||stage==='hydrated'){
    const cells=getWellWallGridCells(cfg);
    if(!cells) return;
    el.innerHTML=cells.map(c=>'<div class="well-brick-slot '+c.cls+'">'+c.content+'</div>').join('');
    return;
  }
  const bricks=cfg?.bricks|0;
  el.innerHTML=Array.from({ length:WELL_BRICKS_REQUIRED }, (_,i)=>{
    const filled=i<bricks;
    return '<div class="well-brick-slot'+(filled?' filled':'')+'">'+(filled?'🧱':'')+'</div>';
  }).join('');
}

function renderWellScreen(){
  migrateWell();
  const cfg=getWellConfig(activeWellInstanceId);
  const stage=getWellStage(cfg);
  const bricks=cfg?.bricks|0;
  const countEl=document.getElementById('well-brick-count');
  const statusEl=document.getElementById('well-status');
  const reqEl=document.getElementById('well-requirements');
  const btnEl=document.getElementById('well-buttons');
  const toggleEl=document.getElementById('well-quick-toggle');
  const logEl=document.getElementById('well-log');
  const titleEl=document.querySelector('#well-screen .top-bar-title');
  const nameEl=document.querySelector('#well-screen .wb-item-name');
  const subEl=document.querySelector('#well-screen .wb-item-sub');
  const displayName=getWellDisplayName(stage);
  if(titleEl) titleEl.textContent=displayName;
  if(nameEl) nameEl.textContent=displayName;
  if(subEl){
    subEl.textContent=stage==='building'
      ?'Lay bricks to raise the walls'
      :stage==='hydrated'
      ?'A working water source — fill vessels or toss a coin'
      :stage==='equipped'
      ?'Rope and bucket fitted — hydrate when it rains'
      :'Add a rope and bucket to finish this well';
  }
  if(countEl){
    countEl.hidden=stage!=='building';
    countEl.textContent=bricks+' / '+WELL_BRICKS_REQUIRED+' bricks placed';
  }
  const gridEl=document.getElementById('well-brick-grid');
  if(gridEl){
    gridEl.hidden=stage==='bucketless';
    renderWellBrickGrid(cfg);
  }
  if(reqEl){
    if(stage==='bucketless'){
      reqEl.innerHTML=renderWellKitHtml()
        +'<div class="well-req-note">Fit a rope and bucket to finish this well</div>';
      reqEl.hidden=false;
    }else if(stage==='equipped'){
      reqEl.innerHTML=renderWellHydrateHtml();
      reqEl.hidden=false;
    }else if(stage==='hydrated'){
      reqEl.innerHTML='<div class="well-req-note">Water rings the bucket. This well counts as a water source.</div>';
      reqEl.hidden=false;
    }else{
      reqEl.hidden=true;
      reqEl.innerHTML='';
    }
  }
  if(toggleEl){
    if(stage==='hydrated'){
      toggleEl.hidden=false;
      const label=state.wellQuickAction==='coin'?'🪙 Toss a coin':'💧 Fill vessel';
      toggleEl.innerHTML='<button type="button" class="store-shelf-action" style="width:100%" onclick="toggleWellDefault()">Quick tap: '
        +label+' (tap to change)</button>';
    }else{
      toggleEl.hidden=true;
      toggleEl.innerHTML='';
    }
  }
  if(logEl){
    logEl.hidden=stage!=='hydrated';
    if(stage==='hydrated'&&!logEl.querySelector('.wb-log-entry')){
      logEl.innerHTML='<div class="wb-log-entry" style="color:rgba(200,169,110,0.45)">Actions at the well appear here.</div>';
    }
  }
  if(statusEl){
    if(stage==='hydrated'){
      statusEl.textContent=wellFill.filling
        ?'Filling vessels…'
        :'Water source active — tap the well or use quick actions';
    }else if(stage==='equipped'){
      statusEl.textContent='Well (dry) — hydrate with Water Lv '+WELL_HYDRATE_WATER_LEVEL;
    }else if(stage==='bucketless'){
      statusEl.textContent='Well (bucketless) built — rope and bucket still needed';
    }else if(bricks>=WELL_BRICKS_REQUIRED){
      statusEl.textContent='Finishing the well…';
    }else{
      statusEl.textContent='Tap the well site or use the button below to place bricks';
    }
    statusEl.classList.add('idle');
  }
  if(btnEl){
    if(stage==='building'){
      const done=cfg.bucketless||bricks>=WELL_BRICKS_REQUIRED;
      btnEl.hidden=false;
      btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
        +'<button class="wb-btn once" style="flex:1" '+(done?'disabled':'')+' onclick="placeWellBrick(event)">'
        +'🧱 PLACE A BRICK'
        +'<span class="wb-btn-sub">'+bricks+'/'+WELL_BRICKS_REQUIRED+'</span>'
        +'</button></div></div>';
    }else if(stage==='hydrated'){
      const hasCoin=itemCountBagAndStore('old_coin')>0;
      const hasVessels=countEmptyVesselsInBag()>0;
      const filling=wellFill.filling;
      btnEl.hidden=false;
      btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
        +'<button class="wb-btn stop" style="flex:1" '+(filling||!hasVessels?'disabled':'')+' onclick="fillVesselsFromWell()">'
        +'💧 FILL VESSEL<span class="wb-btn-sub">+'+WELL_FILL_VESSEL_WATER_XP+' Water each</span></button>'
        +'<button class="wb-btn stop" style="flex:1" '+(!hasCoin?'disabled':'')+' onclick="tossCoinInWell()">'
        +'🪙 TOSS COIN<span class="wb-btn-sub">+'+WELL_COIN_WATER_XP+' Water</span></button>'
        +'</div></div>';
    }else{
      btnEl.hidden=true;
      btnEl.innerHTML='';
    }
  }
}

function updateWellCells(){
  migrateWell();
  document.querySelectorAll('.plot-cell.cell-well').forEach(cell=>{
    const cfg=getWellConfig(cell.dataset.instanceId);
    const vis=getWellVisualState(cfg);
    cell.classList.remove('well-stage-1','well-stage-2','well-stage-3','well-built','well-complete','well-bucketless','well-equipped','well-hydrated');
    cell.classList.add('well-'+vis.stage);
    const label=cell.querySelector('.well-label');
    const icon=cell.querySelector('.well-icon');
    if(label) label.textContent=vis.label;
    if(icon) icon.textContent=vis.icon;
    const top=cell.querySelector('.well-activity-top.well-activity-top');
    if(top){
      top.classList.remove('well-stage-1','well-stage-2','well-stage-3','well-built','well-complete','well-bucketless','well-equipped','well-hydrated');
      top.classList.add('well-'+vis.stage);
    }
    const quickBtn=cell.querySelector('.well-quick-action-btn');
    if(quickBtn) quickBtn.textContent=wellQuickTapLabel();
  });
}
