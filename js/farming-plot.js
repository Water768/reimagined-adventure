/* Hearthstead — farming plot */
'use strict';

let activeFarmInstanceId=null;
let farmSelectedSeedKey=null;
let farmSeedBatchQty=10;
let farmSeedPickerOpen=false;
let farmTimerHandle=null;

function normalizeFarmConfig(cfg){
  if(!cfg) return { seedKey:null, cropKey:null, seedQty:0, plantedAt:null };
  if(cfg.seedKey==null) cfg.seedKey=null;
  if(cfg.cropKey==null) cfg.cropKey=null;
  if(cfg.seedQty==null) cfg.seedQty=0;
  if(cfg.plantedAt==null) cfg.plantedAt=null;
  return cfg;
}

function getFarmConfig(instanceId){
  if(!instanceId) return null;
  return normalizeFarmConfig(getPlotConfig(instanceId,'farm','farm_plot'));
}

function setActiveFarm(instanceId){
  activeFarmInstanceId=instanceId||null;
}

function forEachFarmSlot(fn){
  if(typeof forEachPlotOccupied!=='function') return;
  forEachPlotOccupied((x,y,slot)=>{
    if(getPlotTileDef(slot.typeId)?.behavior==='farm') fn(x,y,slot);
  });
}

function farmPlotExists(instanceId){
  let found=false;
  forEachFarmSlot((x,y,slot)=>{ if(slot.instanceId===instanceId) found=true; });
  return found;
}

function getFarmVisualState(cfg){
  if(!isFarmPlotGrowing(cfg)){
    return { stage:'empty', icon:'🌾', label:'farming plot' };
  }
  const crop=getBotanyCropDef(cfg.cropKey);
  if(isFarmPlotReady(cfg)){
    return { stage:'ready', icon:crop?.icon||'🌿', label:'ready to harvest' };
  }
  const left=formatDuration(farmGrowthRemainingMs(cfg));
  return { stage:'growing', icon:crop?.icon||'🌱', label:'growing · '+left };
}

function stopFarmTimer(){
  if(farmTimerHandle){
    clearInterval(farmTimerHandle);
    farmTimerHandle=null;
  }
}

function startFarmTimer(){
  stopFarmTimer();
  farmTimerHandle=setInterval(()=>{
    if(currentScreen!=='farming-screen'){
      stopFarmTimer();
      return;
    }
    const cfg=getFarmConfig(activeFarmInstanceId);
    if(!cfg||!isFarmPlotGrowing(cfg)){
      stopFarmTimer();
      return;
    }
    renderFarmStatus();
    if(typeof updateFarmCells==='function') updateFarmCells();
    if(isFarmPlotReady(cfg)) renderFarmScreen();
  },1000);
}

function openFarmScreen(instanceId){
  if(instanceId) setActiveFarm(instanceId);
  if(!activeFarmInstanceId||!farmPlotExists(activeFarmInstanceId)){
    showToast('Place a farming plot on your land first.');
    return;
  }
  if(!farmSelectedSeedKey){
    const botanyLvl=typeof getBotanyLevel==='function'?getBotanyLevel():1;
    const first=getBotanySeedsSorted().find(s=>isBotanySeedUnlocked(s.key, botanyLvl));
    if(first) farmSelectedSeedKey=first.key;
  }
  showScreen('farming-screen');
  lastHome='exterior-screen';
  renderFarmScreen();
  startFarmTimer();
  syncUI();
}

function closeFarmScreen(){
  stopFarmTimer();
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  syncUI();
}

function setFarmSeedBatchQty(qty){
  const batch=getFarmSeedBatch(qty);
  if(!batch) return;
  farmSeedBatchQty=batch.qty;
  if(currentScreen==='farming-screen') renderFarmScreen();
}

function toggleFarmSeedPicker(){
  farmSeedPickerOpen=!farmSeedPickerOpen;
  if(currentScreen==='farming-screen') renderFarmSeedList();
}

function selectFarmSeed(seedKey){
  if(farmSelectedSeedKey===seedKey&&farmSeedPickerOpen){
    farmSeedPickerOpen=false;
  }else{
    farmSelectedSeedKey=seedKey;
    farmSeedPickerOpen=false;
  }
  if(currentScreen==='farming-screen') renderFarmScreen();
}

function canPlantFarmSeed(instanceId, seedKey, seedQty){
  const cfg=getFarmConfig(instanceId);
  if(isFarmPlotGrowing(cfg)) return { ok:false, reason:'Plot is already growing a crop.' };
  const seed=getBotanySeedDef(seedKey);
  if(!seed) return { ok:false, reason:'Pick a seed type first.' };
  const botanyLvl=typeof getBotanyLevel==='function'?getBotanyLevel():1;
  if(!isBotanySeedUnlocked(seedKey, botanyLvl)){
    return { ok:false, reason:'Need Botany Lv '+seed.requiredBotanyLevel+'.' };
  }
  const batch=getFarmSeedBatch(seedQty);
  if(!batch) return { ok:false, reason:'Pick how many seeds to plant.' };
  const stock=itemCountBagAndStore(seedKey);
  if(stock<batch.qty){
    return { ok:false, reason:'Need '+batch.qty+' '+seed.name+' ('+stock+' available).' };
  }
  return { ok:true, seed, batch };
}

function plantFarmCrop(instanceId){
  instanceId=instanceId||activeFarmInstanceId;
  const check=canPlantFarmSeed(instanceId, farmSelectedSeedKey, farmSeedBatchQty);
  if(!check.ok){
    showToast(check.reason||'Cannot plant that crop yet.');
    return false;
  }
  const { seed, batch }=check;
  if(!consumeManyFromBagOrStore(seed.key, batch.qty)){
    showToast('Not enough seeds.');
    return false;
  }
  const cfg=getFarmConfig(instanceId);
  cfg.seedKey=seed.key;
  cfg.cropKey=seed.cropKey;
  cfg.seedQty=batch.qty;
  cfg.plantedAt=Date.now();
  scheduleSaveGame();
  renderFarmScreen();
  if(typeof updateFarmCells==='function') updateFarmCells();
  startFarmTimer();
  const crop=getBotanyCropDef(seed.cropKey);
  showToast((crop?.icon||'🌱')+' Planted '+batch.qty+' '+seed.name+'.');
  return true;
}

function harvestFarmCrop(instanceId){
  instanceId=instanceId||activeFarmInstanceId;
  const cfg=getFarmConfig(instanceId);
  if(!isFarmPlotReady(cfg)){
    showToast('Still growing — check back later.');
    return false;
  }
  const crop=getBotanyCropDef(cfg.cropKey);
  if(!crop){
    showToast('Nothing to harvest.');
    return false;
  }
  const amount=calcFarmHarvestYield(cfg.seedQty);
  if(invTotal()+amount>getInvCap()){
    showToast('Bag full ('+invTotal()+'/'+getInvCap()+') — make room before harvesting.');
    return false;
  }
  invAddDirect(crop.key, crop.icon, crop.name, amount);
  grantXP('botany', FARM_HARVEST_XP, null);
  cfg.seedKey=null;
  cfg.cropKey=null;
  cfg.seedQty=0;
  cfg.plantedAt=null;
  scheduleSaveGame();
  stopFarmTimer();
  renderFarmScreen();
  if(typeof updateFarmCells==='function') updateFarmCells();
  showToast(crop.icon+' Harvested '+amount+' '+crop.name+'! +'+FARM_HARVEST_XP+' Botany');
  return true;
}

function farmSeedAvailLine(seedKey, qty){
  const seed=getBotanySeedDef(seedKey);
  const stock=itemCountBagAndStore(seedKey);
  return '<span class="wb-mat-pick-avail wb-mat-pick-line '+wbStockClass(stock, qty)+'">'
    +(seed?.name||seedKey)+', '+stock+'/'+qty+' available</span>';
}

function farmSeedYieldLine(seedKey, batchQty){
  const seed=getBotanySeedDef(seedKey);
  const crop=getBotanyCropDef(seed?.cropKey);
  const yieldAmt=calcFarmHarvestYield(batchQty);
  const cropName=(crop?.name||seed?.cropKey||'crop').toLowerCase();
  return '<span class="wb-mat-pick-name" style="font-size:11px;color:var(--ui-text-dim)">'
    +cropName+' · '+yieldAmt+' yield</span>';
}

function farmSeedStockLine(seedKey, qty){
  return farmSeedAvailLine(seedKey, qty);
}

function renderFarmSeedList(){
  const el=document.getElementById('farm-seed-list');
  if(!el) return;
  const botanyLvl=typeof getBotanyLevel==='function'?getBotanyLevel():1;
  const batch=getFarmSeedBatch(farmSeedBatchQty);

  if(!farmSeedPickerOpen){
    const seed=farmSelectedSeedKey?getBotanySeedDef(farmSelectedSeedKey):null;
    if(!seed){
      el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed unavail" onclick="toggleFarmSeedPicker()">'
        +'<span class="wb-mat-icon">🌱</span>'
        +'<div class="wb-mat-pick-body">'
        +'<span class="wb-mat-pick-avail">Pick a seed</span>'
        +'</div>'
        +'<span class="wb-log-pick-chevron">▾</span>'
        +'</div>';
      return;
    }
    el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed" onclick="toggleFarmSeedPicker()">'
      +'<span class="wb-mat-icon">'+(seed.icon||'🌱')+'</span>'
      +'<div class="wb-mat-pick-body">'
      +farmSeedAvailLine(seed.key, batch.qty)
      +farmSeedYieldLine(seed.key, batch.qty)
      +'</div>'
      +'<span class="wb-log-pick-chevron">▾</span>'
      +'</div>';
    return;
  }

  el.innerHTML=getBotanySeedsSorted().map(seed=>{
    const unlocked=isBotanySeedUnlocked(seed.key, botanyLvl);
    const selected=farmSelectedSeedKey===seed.key;
    const badge=typeof plotAddLevelBadge==='function'
      ?plotAddLevelBadge('botany', botanyLvl, seed.requiredBotanyLevel, seed.requiredBotanyLevel)
      :'';
    const cls='farm-seed-row'+(selected?' selected':'')+(unlocked?'':' locked');
    return '<button type="button" class="'+cls+'"'+(unlocked?' onclick="selectFarmSeed(\''+seed.key+'\')"':' disabled')+'>'
      +'<span class="farm-seed-icon">'+(seed.icon||'🌱')+'</span>'
      +'<span class="farm-seed-meta">'
      +(unlocked
        ?(farmSeedAvailLine(seed.key, batch.qty)+farmSeedYieldLine(seed.key, batch.qty))
        :('<span class="plot-add-item-title-row"><span class="plot-add-item-title">'+seed.name+'</span>'+badge+'</span>'
          +'<span class="farm-seed-sub">Need Botany Lv '+seed.requiredBotanyLevel+'</span>'))
      +'</span></button>';
  }).join('');
}

function renderFarmBatchPicker(){
  const el=document.getElementById('farm-batch-picker');
  if(!el) return;
  el.innerHTML=FARM_SEED_BATCHES.map(batch=>{
    const active=farmSeedBatchQty===batch.qty;
    const yieldAmt=calcFarmHarvestYield(batch.qty);
    return '<button type="button" class="expedition-tier-btn'+(active?' active':'')+'" onclick="setFarmSeedBatchQty('+batch.qty+')">'
      +batch.label
      +'<span style="display:block;font-size:10px;font-weight:500;opacity:0.75;margin-top:4px">'
      +(batch.boostPct?batch.desc:'Base yield · '+yieldAmt)
      +(batch.boostPct?' · '+yieldAmt+' harvest':'')
      +'</span></button>';
  }).join('');
}

function renderFarmStatus(){
  const status=document.getElementById('farm-status');
  const progress=document.getElementById('farm-progress');
  const cfg=getFarmConfig(activeFarmInstanceId);
  if(!status) return;
  if(!isFarmPlotGrowing(cfg)){
    status.textContent='Choose a seed and how many to plant.';
    status.className='fish-status idle';
    if(progress) progress.hidden=true;
    return;
  }
  const crop=getBotanyCropDef(cfg.cropKey);
  if(isFarmPlotReady(cfg)){
    status.textContent=(crop?.name||'Crop')+' is ready to harvest!';
    status.className='fish-status';
    if(progress){
      progress.hidden=false;
      progress.textContent='100% grown';
    }
    return;
  }
  const left=formatDuration(farmGrowthRemainingMs(cfg));
  status.textContent=(crop?.icon||'🌱')+' '+(crop?.name||'Crop')+' growing — '+left+' left';
  status.className='fish-status idle';
  if(progress){
    progress.hidden=false;
    progress.textContent=farmGrowthProgressPct(cfg)+'% grown';
  }
}

function renderFarmButtons(){
  const el=document.getElementById('farm-buttons');
  if(!el) return;
  const cfg=getFarmConfig(activeFarmInstanceId);
  if(isFarmPlotReady(cfg)){
    el.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn once" style="flex:1" onclick="harvestFarmCrop()">🌾 HARVEST</button>'
      +'</div></div>';
    return;
  }
  if(isFarmPlotGrowing(cfg)){
    el.innerHTML='';
    return;
  }
  const check=canPlantFarmSeed(activeFarmInstanceId, farmSelectedSeedKey, farmSeedBatchQty);
  el.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
    +'<button class="wb-btn once" style="flex:1"'+(check.ok?'':' disabled')+' onclick="plantFarmCrop()">🌱 PLANT</button>'
    +'</div></div>';
}

function renderFarmScreen(){
  const cfg=getFarmConfig(activeFarmInstanceId);
  const sub=document.getElementById('farm-subtitle');
  const idlePanel=document.getElementById('farm-panel-idle');
  const growingPanel=document.getElementById('farm-panel-growing');
  if(sub){
    if(isFarmPlotGrowing(cfg)){
      const crop=getBotanyCropDef(cfg.cropKey);
      sub.textContent=isFarmPlotReady(cfg)
        ?(crop?.name||'Crop')+' ready'
        :'Growing '+(crop?.name||'crop');
    }else{
      sub.textContent='Each crop takes 30 minutes to grow';
    }
  }
  if(idlePanel) idlePanel.hidden=!!isFarmPlotGrowing(cfg);
  if(growingPanel) growingPanel.hidden=!isFarmPlotGrowing(cfg);
  if(!isFarmPlotGrowing(cfg)){
    renderFarmBatchPicker();
    renderFarmSeedList();
  }else{
    const cropEl=document.getElementById('farm-growing-crop');
    const batchEl=document.getElementById('farm-growing-batch');
    const crop=getBotanyCropDef(cfg.cropKey);
    if(cropEl) cropEl.innerHTML=(crop?.icon||'🌱')+' '+(crop?.name||cfg.cropKey);
    if(batchEl){
      const yieldAmt=calcFarmHarvestYield(cfg.seedQty);
      batchEl.textContent=cfg.seedQty+' seeds planted · '+yieldAmt+' expected harvest';
    }
  }
  renderFarmStatus();
  renderFarmButtons();
}

function updateFarmCells(){
  document.querySelectorAll('.plot-cell.cell-farm').forEach(cell=>{
    const instanceId=cell.dataset.instanceId;
    const cfg=getFarmConfig(instanceId);
    const vis=getFarmVisualState(cfg);
    cell.classList.toggle('farm-growing', vis.stage==='growing');
    cell.classList.toggle('farm-ready', vis.stage==='ready');
    const icon=cell.querySelector('.farm-icon');
    const label=cell.querySelector('.farm-label');
    if(icon) icon.textContent=vis.icon;
    if(label) label.textContent=vis.label;
  });
}

function openFarmPlotMenu(instanceId){
  if(instanceId) setActiveFarm(instanceId);
  openFarmScreen();
}
