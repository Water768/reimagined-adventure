/* Hearthstead — well */
'use strict';

let activeWellInstanceId=null;

function normalizeWellConfig(cfg){
  if(!cfg) return { bricks:0, bucketless:false, equipped:false, freePlaced:false };
  if(cfg.bricks==null) cfg.bricks=0;
  if(cfg.bucketless==null) cfg.bucketless=false;
  if(cfg.equipped==null) cfg.equipped=false;
  if(cfg.freePlaced==null) cfg.freePlaced=false;
  if(cfg.equipped){
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

function hasWellSupply(key){
  return itemCountBagAndStore(key)>0;
}

function unlockFinishedWells(){
  if(!state.wellFinishedUnlocked){
    state.wellFinishedUnlocked=true;
    scheduleSaveGame();
  }
}

function migrateWell(){
  if(state.wellUnlocked==null) state.wellUnlocked=false;
  if(state.wellFinishedUnlocked==null) state.wellFinishedUnlocked=false;
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
    if(getWellStage(cfg)==='equipped'){
      state.wellFinishedUnlocked=true;
      if(slot.typeId==='well') slot.typeId='well_finished';
    }else if(getWellStage(cfg)!=='building'){
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
      'The structure is complete — add a rope and bucket to draw water.',
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
      'Rope and bucket fitted — finished wells are now free to place on your plot.',
      'GOT IT',
      refreshWellUi
    );
  }
  refreshWellUi();
  return true;
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
  const titleEl=document.querySelector('#well-screen .top-bar-title');
  const nameEl=document.querySelector('#well-screen .wb-item-name');
  const subEl=document.querySelector('#well-screen .wb-item-sub');
  const displayName=stage==='equipped'?WELL_COMPLETE_NAME:WELL_DISPLAY_NAME;
  if(titleEl) titleEl.textContent=displayName;
  if(nameEl) nameEl.textContent=displayName;
  if(subEl){
    subEl.textContent=stage==='building'
      ?'Lay bricks to raise the walls'
      :stage==='equipped'
      ?'Rope and bucket fitted — water coming soon'
      :'Add a rope and bucket to draw water';
  }
  if(countEl){
    countEl.hidden=stage!=='building';
    countEl.textContent=bricks+' / '+WELL_BRICKS_REQUIRED+' bricks placed';
  }
  if(document.getElementById('well-brick-grid')){
    document.getElementById('well-brick-grid').hidden=stage!=='building';
    renderWellBrickGrid(cfg);
  }
  if(reqEl){
    if(stage==='bucketless'){
      reqEl.innerHTML=renderWellKitHtml()
        +'<div class="well-req-note">Fit a rope and bucket to finish this well</div>';
      reqEl.hidden=false;
    }else if(stage==='equipped'){
      reqEl.innerHTML='<div class="well-req-note">Drawing water — coming soon</div>';
      reqEl.hidden=false;
    }else{
      reqEl.hidden=true;
      reqEl.innerHTML='';
    }
  }
  if(statusEl){
    if(stage==='equipped'){
      statusEl.textContent='Well ready — drawing water coming soon';
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
    cell.classList.remove('well-stage-1','well-stage-2','well-stage-3','well-built','well-complete','well-bucketless','well-equipped');
    cell.classList.add('well-'+vis.stage);
    const icon=cell.querySelector('.well-icon');
    const label=cell.querySelector('.well-label');
    if(icon) icon.textContent=vis.icon;
    if(label) label.textContent=vis.label;
    const top=cell.querySelector('.well-activity-top');
    if(top){
      top.classList.remove('well-stage-1','well-stage-2','well-stage-3','well-built','well-complete','well-bucketless','well-equipped');
      top.classList.add('well-'+vis.stage);
    }
  });
}
