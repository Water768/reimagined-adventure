/* Hearthstead — activities */
'use strict';

/* ═══════════════════════════════════════
   FISHING
═══════════════════════════════════════ */
function notePondSeen(){
  if(state._seenPond) return;
  state._seenPond=true;
  migratePlot();
  forEachPlotOccupied((x,y,slot)=>{
    if(getPlotTileDef(slot.typeId)?.behavior==='water'){
      getPlotConfig(slot.instanceId,'water').seen=true;
    }
  });
  setTimeout(()=>showToast('Clear water ahead — tap a spot to see what lives there.'),400);
}

function updatePondCell(){
  const activeBodyId=getActiveWaterBodyId();
  document.querySelectorAll('.water-body-surface').forEach(surface=>{
    const bodyId=surface.dataset.waterBodyId||null;
    const isThisSpot=!!(fish.running&&activeBodyId&&bodyId===activeBodyId);
    surface.classList.toggle('fishing-active', isThisSpot);
    const label=surface.querySelector('.pond-label');
    const body=bodyId&&plotWaterBodies?.bodies?.[bodyId];
    const typeName=(body?WATER_BODY_TYPES[body.type]?.name:'Pond')||'Pond';
    if(label) label.textContent=isThisSpot?'fishing…':typeName.toLowerCase();
  });
}

function resolveWaterBodySurface(el){
  if(!el) return null;
  if(el.classList?.contains('water-body-surface')) return el;
  const bodyId=el.dataset?.waterBodyId;
  if(bodyId) return getWaterBodySurface(bodyId);
  return el.closest?.('.water-body-surface')||null;
}

function pondMenuTap(event, surface){
  event?.stopPropagation();
  surface=surface||resolveWaterBodySurface(event?.target);
  const pondId=typeof resolvePondInstanceIdFromSurface==='function'
    ?resolvePondInstanceIdFromSurface(surface)
    :surface?.dataset?.instanceId;
  if(pondId) fish.pondInstanceId=pondId;
  notePondSeen();
  openFishingMenu();
}

function openFishingMenu(){
  ensureFishingSpotSelected();
  showScreen('fishing-screen');
  lastHome='exterior-screen';
  renderFishing();
}

function closeFishing(){
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  syncUI();
}

function ensureFishingSpotSelected(){
  if(fish.pondInstanceId) return;
  forEachPlotOccupied((x,y,slot)=>{
    if(!fish.pondInstanceId&&getPlotTileDef(slot.typeId)?.behavior==='water'){
      fish.pondInstanceId=slot.instanceId;
    }
  });
}

function renderFishAvailableList(bodyType){
  const list=document.getElementById('fish-available-list');
  const container=document.getElementById('fish-spot-fish-list');
  const titleEl=document.getElementById('fish-available-title');
  if(!list) return;
  if(container) container.classList.remove('fish-spot-none-at-level');
  if(titleEl) titleEl.textContent='AVAILABLE FISH';
  if(!bodyType){
    list.innerHTML='<div class="store-line" style="color:rgba(200,169,110,0.45)">Select a fishing spot.</div>';
    return;
  }
  const fishKeys=WATER_BODY_TYPES[bodyType]?.fish||[];
  const fishLvl=state.skills.fishing?.level||1;
  const available=getAvailableFishForBody(bodyType);
  const noneAtLevel=fishKeys.length>0&&available.length===0;
  if(noneAtLevel){
    if(container) container.classList.add('fish-spot-none-at-level');
    if(titleEl) titleEl.textContent='AVAILABLE FISH — NONE AT CURRENT LEVEL';
  }
  list.innerHTML=fishKeys.map(key=>{
    const f=FISH_DEFS[key];
    if(!f) return '';
    const unlocked=fishLvl>=f.level;
    const rarityLabel=f.rarity==='rare'?'Rare':'Common';
    return '<div class="fish-list-row'+(unlocked?'':' locked')+'">'
      +'<span>'+f.icon+' '+f.name+'<span class="fish-rarity">'+rarityLabel+'</span></span>'
      +'<span class="fish-req">'+(unlocked?'Lv '+f.level+' ✓':'Lv '+f.level+' required')+'</span>'
      +'</div>';
  }).join('');
}

function tryUnderlevelFishLump(bodyType){
  if(!bodyType||canFishAtBody(bodyType)||Math.random()>=CLUTTER_CHANCE) return false;
  const added=invAdd(USELESS_LUMP.key,USELESS_LUMP.icon,USELESS_LUMP.name,1);
  if(!added){
    stopFishing();
    showToast('Bag full. Fishing stopped.');
    return true;
  }
  const typeCfg=WATER_BODY_TYPES[bodyType]||WATER_BODY_TYPES.pond;
  grantXP('fishing',typeCfg.xpMiss,null);
  addActivityLog('fish-log','🪨 Pulled up a useless lump. What even is this? +'+typeCfg.xpMiss+' Fishing','fail');
  return true;
}

function switchFishingSpot(pondInstanceId){
  if(!pondInstanceId) return;
  if(fish.pondInstanceId===pondInstanceId&&fish.running) return;
  const wasRunning=fish.running;
  stopReleasingFish();
  if(fish.timer){ clearTimeout(fish.timer); fish.timer=null; }
  fish.pondInstanceId=pondInstanceId;
  if(wasRunning){
    fish.running=true;
    setActivity('fishing');
    runNextFishAttempt();
  }
  renderFishing();
  updatePondCell();
  syncUI();
}

function getFishingActivitySkillKey(){
  return fish.releasing?'water':'fishing';
}

function renderFishAutoReleaseToggle(){
  const el=document.getElementById('fish-auto-release-toggle');
  if(!el) return;
  const pet=getEquippedGoldfishPet();
  if(!pet){
    el.hidden=true;
    el.innerHTML='';
    return;
  }
  el.hidden=false;
  const pct=getGoldfishAutoReleaseChancePercent(getPetLevel(pet));
  const on=!!state.fishAutoRelease;
  el.innerHTML='<button type="button" class="store-shelf-action fish-auto-release-btn'+(on?' active':'')+'" style="width:100%" onclick="toggleFishAutoRelease()">'
    +(on?'🐟 Auto-release: ON':'🐟 Auto-release: OFF')
    +' · '+pct+'%</button>';
}

function toggleFishAutoRelease(){
  if(!getEquippedGoldfishPet()){
    state.fishAutoRelease=false;
    renderFishAutoReleaseToggle();
    return;
  }
  state.fishAutoRelease=!state.fishAutoRelease;
  renderFishAutoReleaseToggle();
  scheduleSaveGame();
}

function tryGoldfishAutoRelease(fishDef, bodyType){
  if(!fishDef||!bodyType||!state.fishAutoRelease) return null;
  const pet=getEquippedGoldfishPet();
  if(!pet) return null;
  const fishId=getFishIdForItemKey(fishDef.key);
  if(!fishId||!getNativeFishIdsForBody(bodyType).includes(fishId)) return null;
  const chance=getGoldfishAutoReleaseChancePercent(getPetLevel(pet))/100;
  if(Math.random()>=chance) return null;
  const waterXp=waterXpForFishRelease(bodyType);
  grantXP('water', waterXp, null, { keepActivities:true });
  flashSkillPill('water');
  return waterXp;
}

function renderFishing(){
  ensureFishingSpotSelected();
  updateActivitySkillPill('fish', getFishingActivitySkillKey());
  const body=getCurrentFishingWaterBody();
  const typeCfg=body?WATER_BODY_TYPES[body.type]:null;
  const titleEl=document.getElementById('fish-screen-title');
  const nameEl=document.getElementById('fish-spot-name');
  const subEl=document.getElementById('fish-spot-sub');
  const iconEl=document.getElementById('fish-spot-icon');
  if(titleEl) titleEl.textContent=typeCfg?.name||'Fishing';
  if(nameEl) nameEl.textContent=typeCfg?.name||'Fishing spot';
  if(subEl){
    if(typeCfg){
      const pct=Math.round(typeCfg.successRate*100);
      subEl.textContent=body.cells.length+' tile'+(body.cells.length!==1?'s':'')+' • '+pct+'% catch chance';
    }else{
      subEl.textContent='Tap a water tile on your plot';
    }
  }
  if(iconEl) iconEl.textContent=body?.type==='ocean'?'🌊':body?.type==='river'?'🏞️':'🎣';
  renderFishAvailableList(body?.type);
  renderFishAutoReleaseToggle();
  const status=document.getElementById('fish-status');
  if(status){
    status.textContent=fish.releasing?'Releasing fish…':fish.running?'Fishing…':'Ready to fish';
    status.classList.toggle('idle',!fish.running&&!fish.releasing);
    status.classList.remove('fish-status-blocked');
  }
  const btnEl=document.getElementById('fish-buttons');
  if(!btnEl) return;
  const spotReady=!!body;
  const full=invTotal()>=getInvCap();
  let releaseBtn;
  if(fish.releasing){
    releaseBtn='<button class="wb-btn stop" style="flex:1" onclick="stopReleasingFish(); renderFishing(); syncUI();">⛔ STOP RELEASING</button>';
  }else{
    const releaseDisabled=!spotReady;
    releaseBtn='<button class="wb-btn stop" style="flex:1" '+(releaseDisabled?'disabled':'')+' onclick="startReleasingFish()">🐟 RELEASE FISH</button>';
  }
  if(fish.running){
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn stop" style="flex:1" onclick="stopFishing()">⛔ STOP FISHING</button>'
      +releaseBtn+'</div></div>';
  }else{
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn stop" style="flex:1" '+(!spotReady||(!fish.releasing&&full)?'disabled':'')+' onclick="startFishing()">'
      +'🎣 START FISHING</button>'
      +releaseBtn+'</div></div>';
  }
}

function startFishing(pondInstanceId){
  if(fish.running){
    if(pondInstanceId&&pondInstanceId!==fish.pondInstanceId) switchFishingSpot(pondInstanceId);
    return;
  }
  if(fish.releasing) stopReleasingFish();
  if(invTotal()>=getInvCap()){ showToast('Bag is full — make room for fish.'); return; }
  if(pondInstanceId) fish.pondInstanceId=pondInstanceId;
  else if(!fish.pondInstanceId){
    let firstPondId=null;
    forEachPlotOccupied((x,y,slot)=>{
      if(!firstPondId&&getPlotTileDef(slot.typeId)?.behavior==='water') firstPondId=slot.instanceId;
    });
    fish.pondInstanceId=firstPondId;
  }
  setActivity('fishing');
  fish.running=true;
  renderFishing();
  syncUI();
  runNextFishAttempt();
}

function pauseFishingTimer(){
  if(!fish.running&&!fish.timer) return;
  fish.running=false;
  clearTimeout(fish.timer);
  fish.timer=null;
  clearActivity('fishing');
  if(typeof updatePondCell==='function') updatePondCell();
}

function stopFishing(fromActivitySwitch){
  stopReleasingFish();
  pauseFishingTimer();
  if(currentScreen==='fishing-screen') renderFishing();
  syncUI();
}

function stopReleasingFish(){
  fish.releasing=false;
  fish.releaseQueue=[];
  clearTimeout(fish.releaseTimer);
  fish.releaseTimer=null;
  fishReleaseLogBatch=null;
}

let fishReleaseLogBatch=null;

function resetFishReleaseLogBatch(){
  fishReleaseLogBatch=null;
}

function formatFishReleaseLogText(batch){
  const fishLine=(batch.totalFishXp>0)?(', +'+batch.totalFishXp+' Fishing'):'';
  const verb=batch.totalFishXp>0?'Caught & auto-released':'Released';
  if(batch.count===1){
    return batch.icon+' '+verb+' '+batch.name+'. +'+batch.totalXp+' water'+fishLine+'.';
  }
  return batch.icon+' '+verb+' '+batch.count+' '+batch.name+'. +'+batch.totalXp+' water ('+batch.xpEach+' each)'+fishLine+'.';
}

function recordFishReleaseLog(fishId, fishDef, waterXp, fishingXp){
  const name=(fishDef?.name||'fish').toLowerCase();
  const icon=fishDef?.icon||'🐟';
  const log=document.getElementById('fish-log');
  if(!log) return;
  const fishGain=Math.max(0, Number(fishingXp)||0);
  if(!fishReleaseLogBatch||fishReleaseLogBatch.fishId!==fishId){
    log.querySelector('.wb-log-entry.latest')?.classList.remove('latest');
    const entry=addActivityLog('fish-log', formatFishReleaseLogText({
      fishId, name, icon, count:1, totalXp:waterXp, xpEach:waterXp, totalFishXp:fishGain,
    }), 'success');
    fishReleaseLogBatch={ fishId, name, icon, count:1, totalXp:waterXp, xpEach:waterXp, totalFishXp:fishGain, entryEl:entry };
    return;
  }
  fishReleaseLogBatch.count++;
  fishReleaseLogBatch.totalXp+=waterXp;
  fishReleaseLogBatch.totalFishXp+=fishGain;
  updateActivityLogEntry(fishReleaseLogBatch.entryEl, formatFishReleaseLogText(fishReleaseLogBatch), 'success');
}

function buildFishReleaseQueue(bodyType){
  const nativeIds=new Set(getNativeFishIdsForBody(bodyType));
  const queue=[];
  Object.entries(state.inventory).forEach(([itemKey,item])=>{
    if(!item?.count) return;
    const fishId=getFishIdForItemKey(itemKey);
    if(!fishId||!nativeIds.has(fishId)) return;
    for(let i=0;i<item.count;i++){
      queue.push({ itemKey, fishId, icon:item.icon, name:item.name });
    }
  });
  return queue;
}

function startReleasingFish(){
  if(fish.releasing) return;
  pauseFishingTimer();
  ensureFishingSpotSelected();
  const body=getCurrentFishingWaterBody();
  if(!body?.type){
    showToast('Pick a water spot first.');
    return;
  }
  fish.releaseQueue=buildFishReleaseQueue(body.type);
  if(!fish.releaseQueue.length){
    showToast('Nothing in your inventory looks like it would be very happy here...');
    return;
  }
  fish.releasing=true;
  resetFishReleaseLogBatch();
  renderFishing();
  releaseNextFish();
}

function releaseNextFish(){
  if(!fish.releasing) return;
  const body=getCurrentFishingWaterBody();
  if(!body?.type||currentScreen!=='fishing-screen'){
    stopReleasingFish();
    if(currentScreen==='fishing-screen') renderFishing();
    return;
  }
  if(!fish.releaseQueue.length){
    stopReleasingFish();
    if(currentScreen==='fishing-screen') renderFishing();
    syncUI();
    return;
  }
  const next=fish.releaseQueue.shift();
  if(!consumeOneFromBag(next.itemKey)){
    fish.releaseTimer=setTimeout(releaseNextFish, FISH_RELEASE_MS);
    return;
  }
  const waterXp=waterXpForFishRelease(body.type);
  grantXP('water', waterXp, null, { keepActivities:true });
  flashSkillPill('water');
  const fishDef=FISH_DEFS[next.fishId];
  recordFishReleaseLog(next.fishId, fishDef, waterXp);
  syncUI();
  fish.releaseTimer=setTimeout(releaseNextFish, FISH_RELEASE_MS);
}

function runNextFishAttempt(){
  if(!fish.running) return;
  if(invTotal()>=getInvCap()){
    stopFishing();
    showToast('Bag full. Fishing stopped.');
    return;
  }
  fishAttempt();
  if(!fish.running) return;
  fish.timer=setTimeout(runNextFishAttempt,ACTION_TICK_MS);
}

function fishAttempt(){
  if(!fish.running) return;
  const body=getCurrentFishingWaterBody();
  const typeCfg=body?WATER_BODY_TYPES[body.type]:WATER_BODY_TYPES.pond;
  state.fishAttempts++;
  grantXP('water', FISH_ATTEMPT_WATER_XP, null, { keepActivities:true });
  if(body&&!canFishAtBody(body.type)){
    if(tryUnderlevelFishLump(body.type)){
      syncUI();
      return;
    }
    grantXP('fishing',typeCfg.xpMiss,null);
    const missMsgs=[
      'The line twitches. Nothing. +'+typeCfg.xpMiss+' Fishing',
      'A splash — too quick. +'+typeCfg.xpMiss+' Fishing',
      'Reeds rustle. Fish got away. +'+typeCfg.xpMiss+' Fishing',
      'You feel a nibble… then mud. +'+typeCfg.xpMiss+' Fishing',
    ];
    addActivityLog('fish-log',missMsgs[Math.floor(Math.random()*missMsgs.length)],'fail');
    syncUI();
    return;
  }
  const fishDef=body?rollFishForBody(body.type):null;
  const success=fishDef&&Math.random()<typeCfg.successRate;
  if(success){
    const waterXp=body&&tryGoldfishAutoRelease(fishDef, body.type);
    if(waterXp!=null){
      state.fishCatches++;
      grantXP('fishing',typeCfg.xpCatch,null);
      const fishId=getFishIdForItemKey(fishDef.key);
      recordFishReleaseLog(fishId, fishDef, waterXp, typeCfg.xpCatch);
      if(state.fishCatches===1) showToast('First catch! '+fishDef.icon+' (released)');
      syncUI();
      return;
    }
    const added=invAdd(fishDef.key,fishDef.icon,'Raw '+fishDef.name,1);
    if(!added){
      stopFishing();
      addActivityLog('fish-log','Bag full — could not keep the fish.', 'fail');
      showToast('Bag full. Fishing stopped.');
      return;
    }
    state.fishCatches++;
    grantXP('fishing',typeCfg.xpCatch,null);
    addActivityLog('fish-log',fishDef.icon+' Caught raw '+fishDef.name.toLowerCase()+'! +'+typeCfg.xpCatch+' Fishing','success');
    if(state.fishCatches===1) showToast('First catch! Check your bag. '+fishDef.icon);
  }else{
    grantXP('fishing',typeCfg.xpMiss,null);
    const missMsgs=[
      'The line twitches. Nothing. +'+typeCfg.xpMiss+' Fishing',
      'A splash — too quick. +'+typeCfg.xpMiss+' Fishing',
      'Reeds rustle. Fish got away. +'+typeCfg.xpMiss+' Fishing',
      'You feel a nibble… then mud. +'+typeCfg.xpMiss+' Fishing',
    ];
    addActivityLog('fish-log',missMsgs[Math.floor(Math.random()*missMsgs.length)],'fail');
  }
  syncUI();
}

function restartActivitySparkles(cell, layerSelector, sparkleSelector){
  const layer=cell.querySelector(layerSelector);
  if(!layer) return;
  layer.querySelectorAll(sparkleSelector).forEach(el=>{
    el.style.animation='none';
    void el.offsetWidth;
    el.style.removeProperty('animation');
  });
}

function restartGatherSparkles(cell){
  restartActivitySparkles(cell, '.gather-sparkles', '.gather-sparkle');
}

function restartMineSparkles(cell){
  restartActivitySparkles(cell, '.mine-sparkles', '.mine-sparkle');
}

function updateGatherCells(){
  document.querySelectorAll('.plot-cell.cell-gather').forEach(cell=>{
    const instanceId=cell.dataset.instanceId||null;
    const isThisSpot=!!(gather.running&&instanceId&&gather.instanceId===instanceId);
    const wasActive=cell.classList.contains('gathering-active');
    cell.classList.toggle('gathering-active', isThisSpot);
    if(isThisSpot&&!wasActive) restartGatherSparkles(cell);
    const label=cell.querySelector('.gather-label');
    const slot=instanceId?getGatheringSlotByInstanceId(instanceId):null;
    const loc=slot?getGatheringByTypeId(slot.slot.typeId):null;
    const spotName=(loc?.name||'gathering spot').toLowerCase();
    if(label) label.textContent=isThisSpot?('gathering… '+gather.itemsThisSession+'/'+GATHER_ITEMS_PER_SESSION):spotName;
  });
}

function resolveGatherCell(el){
  if(!el) return null;
  if(el.classList?.contains('cell-gather')) return el;
  return el.closest?.('.plot-cell.cell-gather')||null;
}

function gatherMenuTap(event, cell){
  event?.stopPropagation();
  cell=cell||resolveGatherCell(event?.target);
  if(cell?.dataset?.instanceId) gather.instanceId=cell.dataset.instanceId;
  openGatheringMenu();
}

function openGatheringMenu(){
  showScreen('gathering-screen');
  lastHome='exterior-screen';
  renderGathering();
}

function closeGathering(){
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  syncUI();
}

function renderGatherLootList(gatherKey){
  const list=document.getElementById('gather-loot-list');
  if(!list) return;
  if(!gatherKey){
    list.innerHTML='<div class="store-line" style="color:rgba(200,169,110,0.45)">Select a gathering spot.</div>';
    return;
  }
  list.innerHTML=sortedGatheringDrops(gatherKey).map(d=>{
    return '<div class="fish-list-row">'
      +'<span>'+d.icon+' '+d.name+(d.rare?'<span class="fish-rarity">Rare</span>':'')+'</span>'
      +'<span class="fish-req">~'+d.pct+'% of finds</span>'
      +'</div>';
  }).join('');
}

function renderGathering(){
  updateActivitySkillPill('gather', 'foraging');
  const loc=getCurrentGatheringLocation();
  const pct=Math.round(calcGatherSuccess()*100);
  const titleEl=document.getElementById('gather-screen-title');
  const nameEl=document.getElementById('gather-spot-name');
  const subEl=document.getElementById('gather-spot-sub');
  const iconEl=document.getElementById('gather-spot-icon');
  const xpEl=document.getElementById('gather-xp-preview');
  if(titleEl) titleEl.textContent=loc?.name||'Gathering';
  if(nameEl) nameEl.textContent=loc?.name||'Gathering spot';
  if(subEl){
    if(loc){
      subEl.textContent=pct+'% find chance • '+GATHER_ITEMS_PER_SESSION+' finds per visit • Foraging Lv '+(state.skills.foraging?.level||1);
    }else{
      subEl.textContent='Tap a gathering tile on your plot';
    }
  }
  if(iconEl) iconEl.textContent=loc?.icon||'🌿';
  renderGatherLootList(loc?.key);
  if(xpEl){
    xpEl.innerHTML='<span class="wb-xp-line">Find: +'+GATHER_XP_SUCCESS+' Foraging • Miss: +'+GATHER_XP_MISS+' Foraging</span>'
      +'<span class="wb-xp-line">'+pct+'% success at Foraging Lv '+(state.skills.foraging?.level||1)+'</span>';
  }
  const status=document.getElementById('gather-status');
  if(status){
    const invFull=invTotal()>=getInvCap();
    if(gather.running){
      status.textContent='Gathering… '+gather.itemsThisSession+' / '+GATHER_ITEMS_PER_SESSION+' found this visit';
    }else if(invFull){
      status.textContent='Bag full ('+invTotal()+'/'+getInvCap()+') — make room before foraging';
    }else{
      status.textContent='Ready to gather';
    }
    status.classList.toggle('idle',!gather.running&&!invFull);
  }
  const btnEl=document.getElementById('gather-buttons');
  if(!btnEl) return;
  if(gather.running){
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns"><button class="wb-btn stop" onclick="stopGathering()">⛔ STOP GATHERING</button></div></div>';
    return;
  }
  const full=invTotal()>=getInvCap();
  const spotReady=!!loc;
  btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
    +'<button class="wb-btn once" '+(full||!spotReady?'disabled':'')+' onclick="startGathering()">'
    +'🌿 START GATHERING<span class="wb-btn-sub">'+(spotReady?('search for loot ('+GATHER_ITEMS_PER_SESSION+' per visit)'):'pick a gathering spot first')+'</span></button>'
    +'</div>'
    +(spotReady&&!gather.running&&gather.itemsThisSession>0?'<div class="wb-cost-notice">Tap the spot again after a visit to search for more.</div>':'')
    +'</div>';
}

function switchGatheringSpot(instanceId){
  if(!instanceId) return;
  if(gather.instanceId===instanceId&&gather.running) return;
  const wasRunning=gather.running;
  if(gather.timer){ clearTimeout(gather.timer); gather.timer=null; }
  gather.instanceId=instanceId;
  gather.itemsThisSession=0;
  if(wasRunning){
    gather.running=true;
    setActivity('gathering');
    runNextGatherAttempt();
  }
  renderGathering();
  updateGatherCells();
  syncUI();
}

function startGathering(instanceId){
  if(gather.running){
    if(instanceId&&instanceId!==gather.instanceId) switchGatheringSpot(instanceId);
    return;
  }
  if(invTotal()>=getInvCap()){
    showToast('Bag full ('+invTotal()+'/'+getInvCap()+') — make room before foraging.');
    return;
  }
  if(instanceId) gather.instanceId=instanceId;
  else if(!gather.instanceId){
    forEachPlotOccupied((x,y,slot)=>{
      if(!gather.instanceId&&getPlotTileDef(slot.typeId)?.behavior==='gather') gather.instanceId=slot.instanceId;
    });
  }
  if(!gather.instanceId){ showToast('Build a gathering spot first.'); return; }
  gather.itemsThisSession=0;
  setActivity('gathering');
  gather.running=true;
  renderGathering();
  updateGatherCells();
  syncUI();
  runNextGatherAttempt();
}

function stopGathering(fromActivitySwitch){
  gather.running=false;
  clearTimeout(gather.timer);
  gather.timer=null;
  if(!fromActivitySwitch) clearActivity('gathering');
  if(currentScreen==='gathering-screen') renderGathering();
  updateGatherCells();
  syncUI();
}

function runNextGatherAttempt(){
  if(!gather.running) return;
  if(invTotal()>=getInvCap()){
    stopGathering();
    showToast('Bag full. Gathering stopped.');
    return;
  }
  if(gather.itemsThisSession>=GATHER_ITEMS_PER_SESSION){
    stopGathering();
    showToast('You\'re worn out — '+GATHER_ITEMS_PER_SESSION+' finds this visit. Tap the spot to search again.');
    return;
  }
  gatherAttempt();
  if(gather.running) gather.timer=setTimeout(runNextGatherAttempt,ACTION_TICK_MS);
}

function gatherAttempt(){
  const loc=getCurrentGatheringLocation();
  if(!loc) return;
  const rate=calcGatherSuccess();
  const success=Math.random()<rate;
  if(success){
    const loot=rollGatherLoot(loc.key);
    if(!loot) return;
    const added=invAdd(loot.key,loot.icon,loot.name,1);
    if(!added){
      stopGathering();
      addActivityLog('gather-log','Bag full — could not keep the find.','fail');
      showToast('Bag full. Gathering stopped.');
      return;
    }
    gather.itemsThisSession++;
    grantXP('foraging',GATHER_XP_SUCCESS,null);
    tryLocationShardDrop(loc.shardTypes);
    addActivityLog('gather-log',loot.icon+' Found '+loot.name.toLowerCase()+'! +'+GATHER_XP_SUCCESS+' Foraging','success');
    if(gather.itemsThisSession>=GATHER_ITEMS_PER_SESSION){
      stopGathering();
      showToast('Visit complete — '+GATHER_ITEMS_PER_SESSION+' finds! Tap the spot to search again.');
    }
  }else{
    grantXP('foraging',GATHER_XP_MISS,null);
    const missMsgs=[
      'You poke around. Nothing yet. +'+GATHER_XP_MISS+' Foraging',
      'Rustle in the undergrowth — gone. +'+GATHER_XP_MISS+' Foraging',
      'Almost had something… +'+GATHER_XP_MISS+' Foraging',
      'Wrong patch. Keep looking. +'+GATHER_XP_MISS+' Foraging',
    ];
    addActivityLog('gather-log',missMsgs[Math.floor(Math.random()*missMsgs.length)],'fail');
  }
  if(currentScreen==='gathering-screen') renderGathering();
  updateGatherCells();
  syncUI();
}

function getMineLevel(){
  return Number(state.skills.mining?.level)||1;
}

function quarryMenuBtnLabel(stacks, isActive){
  if(!stacks||stacks<=0) return 'menu';
  return isActive?'attempting to mine':'paused';
}

function calcMineSuccess(){
  const lvl=getMineLevel();
  return Math.min(1, MINE_BASE_SUCCESS+MINE_SUCCESS_PER_LEVEL*(lvl-1));
}

function rollMineLoot(){
  const spot=getCurrentQuarrySpot();
  const mineId=spot?.def?.mineId||MINES[0]?.id||1;
  return rollMineOre(mineId);
}

function renderMineLootList(mineId){
  const list=document.getElementById('mine-loot-list');
  if(!list) return;
  if(!mineId){
    list.innerHTML='<div class="store-line" style="color:rgba(200,169,110,0.45)">Select a quarry.</div>';
    return;
  }
  const mine=getMineById(mineId);
  const mineLvl=getMineLevel();
  const total=mine.drops.reduce((s,d)=>s+d.weight,0);
  list.innerHTML=mine.drops.map(d=>{
    const res=MINE_RESOURCE_DEFS[d.ore];
    const pct=Math.round((d.weight/total)*100);
    const locked=mineLvl<(res?.unlockLevel||1);
    return '<div class="fish-list-row'+(locked?' locked':'')+'">'
      +'<span>'+(res?.icon||'🪨')+' '+(res?.name||d.ore)+'</span>'
      +'<span class="fish-req">'+pct+'% on success'+(locked?' · Lv '+res.unlockLevel:'')+'</span>'
      +'</div>';
  }).join('');
}

function getQuarrySlotByInstanceId(instanceId){
  if(!instanceId) return null;
  let found=null;
  forEachPlotOccupied((x,y,slot)=>{
    if(slot.instanceId===instanceId&&getPlotTileDef(slot.typeId)?.behavior==='quarry') found={x,y,slot};
  });
  return found;
}

function getCurrentQuarrySpot(){
  if(!mine.instanceId) return null;
  const found=getQuarrySlotByInstanceId(mine.instanceId);
  if(!found) return null;
  const def=getPlotTileDef(found.slot.typeId);
  return { ...found, def };
}

function resolveQuarryCell(el){
  if(!el) return null;
  if(el.classList?.contains('cell-quarry')) return el;
  return el.closest?.('.plot-cell.cell-quarry')||null;
}

function updateQuarryCells(){
  const maxStacks=getMineMaxStacks();
  document.querySelectorAll('.plot-cell.cell-quarry').forEach(cell=>{
    const instanceId=cell.dataset.instanceId||null;
    const isThisQuarry=!!(instanceId&&mine.instanceId===instanceId);
    const isActive=mine.running&&isThisQuarry;
    const wasActive=cell.classList.contains('mining-active');
    cell.classList.toggle('mining-active', isActive);
    if(isActive&&!wasActive) restartMineSparkles(cell);
    const stacks=isThisQuarry?mine.stacks:0;
    cell.classList.toggle('has-mine-stacks', stacks>0);
    const activityTop=cell.querySelector('.quarry-activity-top')||cell.querySelector('.plot-activity-top');
    let badge=activityTop?.querySelector('.quarry-stack-badge');
    if(stacks>0&&activityTop){
      if(!badge){
        badge=document.createElement('div');
        badge.className='quarry-stack-badge';
        badge.innerHTML='<span class="quarry-stack-count"></span>';
        const sprite=activityTop.querySelector('.quarry-sprite');
        activityTop.insertBefore(badge, sprite||null);
      }
      const count=badge.querySelector('.quarry-stack-count');
      if(count) count.textContent=stacks+'/'+maxStacks;
    }else if(badge){
      badge.remove();
    }
    const menuBtn=cell.querySelector('.quarry-menu-btn');
    if(menuBtn){
      menuBtn.textContent=quarryMenuBtnLabel(stacks, isActive);
      menuBtn.classList.toggle('has-stacks', stacks>0);
    }
  });
}

function quarryMenuTap(event, cell){
  event?.stopPropagation();
  cell=cell||resolveQuarryCell(event?.target);
  if(cell?.dataset?.instanceId) mine.instanceId=cell.dataset.instanceId;
  openMiningMenu();
}

function openMiningMenu(){
  if(mine.instanceId) setActivity('mining');
  showScreen('mining-screen');
  lastHome='exterior-screen';
  renderMining();
}

function closeMining(){
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  syncUI();
}

function renderMining(){
  updateActivitySkillPill('mine', 'mining');
  const spot=getCurrentQuarrySpot();
  const pct=Math.round(calcMineSuccess()*100);
  const titleEl=document.getElementById('mine-screen-title');
  const nameEl=document.getElementById('mine-spot-name');
  const subEl=document.getElementById('mine-spot-sub');
  const iconEl=document.getElementById('mine-spot-icon');
  if(titleEl) titleEl.textContent=spot?.def?.name||'Mining';
  if(nameEl) nameEl.textContent=spot?.def?.name||'Quarry';
  if(subEl){
    if(spot){
      subEl.textContent=pct+'% strike chance • stacks last until you find ore • Mining Lv '+getMineLevel();
    }else{
      subEl.textContent='Tap the quarry on your plot to stack mining attempts';
    }
  }
  if(iconEl) iconEl.textContent=spot?.def?.icon||'⛏️';
  renderMineLootList(spot?.def?.mineId);
  const status=document.getElementById('mine-status');
  if(status){
    const invFull=invTotal()>=getInvCap();
    if(mine.running){
      status.textContent='Mining… '+mine.stacks+'/'+getMineMaxStacks()+' stacked';
    }else if(invFull){
      status.textContent='Bag full ('+invTotal()+'/'+getInvCap()+') — make room before mining';
    }else if(mine.stacks>0){
      status.textContent=mine.stacks+'/'+getMineMaxStacks()+' stacked — swing or start mining';
    }else{
      status.textContent='Tap the quarry or swing to stack attempts (up to '+getMineMaxStacks()+')';
    }
    status.classList.toggle('idle',!mine.running&&!invFull);
  }
  const btnEl=document.getElementById('mine-buttons');
  if(!btnEl) return;
  const maxStacks=getMineMaxStacks();
  const stackFull=mine.stacks>=maxStacks;
  const stackLabel=mine.stacks+'/'+maxStacks;
  const spotReady=!!spot;
  const full=invTotal()>=getInvCap();
  const hasStacks=mine.stacks>0;
  if(mine.running){
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn once" style="flex:1" '+(stackFull?'disabled':'')+' onclick="mineMenuSwing()">'
      +'⛏️ SWING<span class="wb-btn-sub">'+stackLabel+' stacked</span></button>'
      +'<button class="wb-btn stop" style="flex:1" onclick="stopMining()">⛔ STOP MINING</button>'
      +'</div></div>';
    return;
  }
  btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
    +'<button class="wb-btn once" style="flex:1" '+(stackFull||!spotReady?'disabled':'')+' onclick="mineMenuSwing()">'
    +'⛏️ SWING<span class="wb-btn-sub">'+(spotReady?stackLabel+' stacked':'queue a swing')+'</span></button>'
    +'<button class="wb-btn once" style="flex:1" '+(full||!spotReady||!hasStacks?'disabled':'')+' onclick="startMining()">'
    +'▶ START MINING<span class="wb-btn-sub">'+(hasStacks?'auto-mine every second':'stack swings first')+'</span></button>'
    +'</div>'
    +(!full&&spotReady&&!hasStacks?'<div class="wb-cost-notice">Each swing adds one stack (max '+maxStacks+'). Stacks are only spent when you find ore.</div>':'')
    +'</div>';
}

function mineMenuSwing(){
  const spot=getCurrentQuarrySpot();
  if(!spot){
    forEachPlotOccupied((x,y,slot)=>{
      if(!mine.instanceId&&getPlotTileDef(slot.typeId)?.behavior==='quarry') mine.instanceId=slot.instanceId;
    });
  }
  if(!mine.instanceId){ showToast('Build a quarry first.'); return; }
  addMineStack(mine.instanceId);
}

function addMineStack(instanceId){
  if(!instanceId) return;
  stopOtherActivities('mining');
  if(mine.instanceId&&mine.instanceId!==instanceId&&mine.stacks>0){
    showToast('Finish mining this quarry first.');
    return;
  }
  mine.instanceId=instanceId;
  setActivity('mining');
  if(mine.stacks>=getMineMaxStacks()){
    showToast('Stack full ('+mine.stacks+'/'+getMineMaxStacks()+').');
    ensureMiningLoop();
    updateQuarryCells();
    syncUI();
    return;
  }
  mine.stacks++;
  ensureMiningLoop();
  updateQuarryCells();
  if(currentScreen==='mining-screen') renderMining();
  syncUI();
}

function ensureMiningLoop(){
  if(mine.stacks<=0){
    if(mine.running) stopMining(true);
    return;
  }
  if(invTotal()>=getInvCap()){
    if(mine.running) stopMining();
    showToast('Bag full ('+invTotal()+'/'+getInvCap()+') — make room before mining.');
    return;
  }
  if(!mine.running){
    mine.running=true;
    setActivity('mining');
    runNextMineAttempt();
  }
}

function startMining(instanceId){
  if(instanceId) mine.instanceId=instanceId;
  else if(!mine.instanceId){
    forEachPlotOccupied((x,y,slot)=>{
      if(!mine.instanceId&&getPlotTileDef(slot.typeId)?.behavior==='quarry') mine.instanceId=slot.instanceId;
    });
  }
  if(!mine.instanceId){ showToast('Build a quarry first.'); return; }
  if(mine.stacks<=0){ showToast('Tap the quarry to stack mining attempts first.'); return; }
  if(invTotal()>=getInvCap()){
    showToast('Bag full ('+invTotal()+'/'+getInvCap()+') — make room before mining.');
    return;
  }
  setActivity('mining');
  mine.running=true;
  renderMining();
  updateQuarryCells();
  syncUI();
  runNextMineAttempt();
}

function stopMining(fromActivitySwitch){
  mine.running=false;
  clearTimeout(mine.timer);
  mine.timer=null;
  if(!fromActivitySwitch) clearActivity('mining');
  if(currentScreen==='mining-screen') renderMining();
  updateQuarryCells();
  syncUI();
}

function runNextMineAttempt(){
  if(!mine.running) return;
  if(mine.stacks<=0){
    stopMining(true);
    showToast('All stacks spent — tap the quarry to queue more attempts.');
    return;
  }
  if(invTotal()>=getInvCap()){
    stopMining();
    showToast('Bag full. Mining stopped.');
    return;
  }
  mineAttempt();
  if(mine.running) mine.timer=setTimeout(runNextMineAttempt,ACTION_TICK_MS);
}

function mineAttempt(){
  const successRoll=Math.random()<calcMineSuccess();
  if(!successRoll){
    grantXP('mining',MINE_XP_MISS,null);
    const missMsgs=[
      'Your pick glances off. +'+MINE_XP_MISS+' Mining',
      'Stone chips, but nothing useful. +'+MINE_XP_MISS+' Mining',
      'A dull thunk. Keep swinging. +'+MINE_XP_MISS+' Mining',
      'Not this strike. +'+MINE_XP_MISS+' Mining',
    ];
    addActivityLog('mine-log',missMsgs[Math.floor(Math.random()*missMsgs.length)],'fail');
    if(currentScreen==='mining-screen') renderMining();
    updateQuarryCells();
    syncUI();
    return;
  }
  const loot=rollMineLoot();
  const added=invAdd(loot.key,loot.icon,loot.name,1);
  if(!added){
    stopMining();
    addActivityLog('mine-log','Bag full — could not keep the '+loot.name.toLowerCase()+'.','fail');
    showToast('Bag full. Mining stopped.');
    return;
  }
  mine.stacks=Math.max(0, mine.stacks-1);
  grantXP('mining',MINE_XP_SUCCESS,null);
  addActivityLog('mine-log',loot.icon+' Mined '+loot.name.toLowerCase()+'! +'+MINE_XP_SUCCESS+' Mining','success');
  if(mine.stacks<=0){
    mine.running=false;
    clearTimeout(mine.timer);
    mine.timer=null;
    clearActivity('mining');
  }
  if(currentScreen==='mining-screen') renderMining();
  updateQuarryCells();
  syncUI();
}

function getWoodlandSlotByInstanceId(instanceId){
  if(!instanceId) return null;
  let found=null;
  forEachPlotOccupied((x,y,slot)=>{
    if(slot.instanceId===instanceId) found={x,y,slot};
  });
  return found;
}

function getCurrentWoodlandSpot(){
  if(!wc.treeInstanceId) return null;
  const found=getWoodlandSlotByInstanceId(wc.treeInstanceId);
  if(!found) return null;
  const def=getPlotTileDef(found.slot.typeId);
  const woodland=getWoodlandByTypeId(found.slot.typeId);
  const cfg=getPlotConfig(found.slot.instanceId,'tree', found.slot.typeId);
  return { ...found, def, woodland, cfg };
}

function getEquippedAxeDef(){
  if(state.equipped&&AXE_BY_KEY[state.equipped.key]) return AXE_BY_KEY[state.equipped.key];
  return findAxeInBag();
}

function resolveWoodlandCell(el){
  if(!el) return null;
  if(el.classList?.contains('cell-tree')) return el;
  return el.closest?.('.plot-cell.cell-tree')||null;
}

function wcMenuTap(event, cell){
  event?.stopPropagation();
  cell=cell||resolveWoodlandCell(event?.target);
  if(cell?.dataset?.instanceId) wc.treeInstanceId=cell.dataset.instanceId;
  openWoodcuttingMenu();
}

function wcMenuChop(){
  if(!wc.treeInstanceId) return;
  chopTree(null, wc.treeInstanceId);
  revealPlotActivityMenu('wc:'+wc.treeInstanceId, document.querySelector('.plot-cell.cell-tree[data-instance-id="'+wc.treeInstanceId+'"]'));
}

function openWoodcuttingMenu(){
  if(wc.treeInstanceId) setActivity('woodcutting');
  showScreen('woodcutting-screen');
  lastHome='exterior-screen';
  renderWoodcutting();
}

function closeWoodcutting(){
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  syncUI();
}

function renderWoodcutLootList(woodlandId){
  const list=document.getElementById('wc-loot-list');
  if(!list) return;
  if(!woodlandId){
    list.innerHTML='<div class="store-line" style="color:rgba(200,169,110,0.45)">Select a woodland.</div>';
    return;
  }
  const w=getWoodlandById(woodlandId);
  const axeDef=getEquippedAxeDef();
  const axeTier=axeDef?.tier??0;
  list.innerHTML=w.drops.map(d=>{
    const logDef=LOG_DEFS[d.log];
    const chopPct=Math.round((CHOP_RATES[d.log]?.[axeTier]??0.75)*100);
    return '<div class="fish-list-row">'
      +'<span>'+(logDef?.icon||'🪵')+' '+(logDef?.name||d.log)+'</span>'
      +'<span class="fish-req">'+d.pct+'% encounter · '+chopPct+'% success</span>'
      +'</div>';
  }).join('');
}

function renderWoodcutting(){
  updateActivitySkillPill('wc', 'woodcut');
  const spot=getCurrentWoodlandSpot();
  const woodland=spot?.woodland;
  const wcLvl=Number(state.skills.woodcut?.level)||1;
  const rec=woodland?getWoodlandRecommendedLevel(woodland.id):null;
  const axeDef=getEquippedAxeDef();
  const titleEl=document.getElementById('wc-screen-title');
  const nameEl=document.getElementById('wc-spot-name');
  const subEl=document.getElementById('wc-spot-sub');
  const iconEl=document.getElementById('wc-spot-icon');
  const xpEl=document.getElementById('wc-xp-preview');
  if(titleEl) titleEl.textContent=woodland?.name||'Woodcutting';
  if(nameEl) nameEl.textContent=woodland?.name||'Woodland';
  if(subEl){
    if(woodland){
      const chops=spot?.cfg?.treeChops||0;
      const recLine=rec?'Recommended: Woodcutting Lv '+rec+' · ':'';
      subEl.textContent=recLine+chops+' chop'+(chops===1?'':'s')+' on this tree';
    }else{
      subEl.textContent='Tap a woodland tile on your plot';
    }
  }
  if(iconEl) iconEl.textContent='🌲';
  renderWoodcutLootList(woodland?.id);
  if(xpEl){
    const wcXpVals=LOG_TIER_ORDER.map(woodcutXpForLog);
    const wcXpMin=Math.min(...wcXpVals);
    const wcXpMax=Math.max(...wcXpVals);
    const wcXpLine=wcXpMin===wcXpMax
      ?('Each chop: +'+wcXpMin+' Woodcutting')
      :('Each chop: +'+wcXpMin+'–+'+wcXpMax+' Woodcutting');
    xpEl.innerHTML='<span class="wb-xp-line">'+wcXpLine+'</span>'
      +(axeDef?'<span class="wb-xp-line">'+axeDef.icon+' '+axeDef.name+' — higher tiers improve rare log chances</span>'
        :'<span class="wb-xp-line">Equip an axe from your bag to chop</span>');
  }
  const status=document.getElementById('wc-status');
  if(status){
    if(!woodland) status.textContent='Select a woodland on your plot';
    else if(!state.axeFound) status.textContent='Find an axe in the hut first';
    else if(!hasAxeAvailable()) status.textContent='Equip an axe to chop';
    else if(invTotal()>=getInvCap()) status.textContent='Bag full — make room for logs';
    else status.textContent='Tap the tree to chop';
    status.classList.add('idle');
  }
  const btnEl=document.getElementById('wc-buttons');
  if(btnEl){
    const full=invTotal()>=getInvCap();
    const canChop=!!woodland&&state.axeFound&&hasAxeAvailable()&&!full;
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn once" style="flex:1" '+(canChop?'':'disabled')+' onclick="wcMenuChop()">'
      +'🪓 CHOP<span class="wb-btn-sub">one swing</span></button>'
      +'<button class="wb-btn once" style="flex:1" onclick="closeWoodcutting()">'
      +'🗺️ BACK TO PLOT<span class="wb-btn-sub">return to the tree</span></button>'
      +'</div></div>';
  }
}

/* ═══════════════════════════════════════
   CAVE EXPLORATION
═══════════════════════════════════════ */
function resetExpeditionTrekUi(){
  explore.running=false;
  clearTimeout(expeditionTimer);
  expeditionTimer=null;
  hideExpeditionTrekOverlay();
}

function openExploringMenu(instanceId){
  resetExpeditionTrekUi();
  if(instanceId) explore.instanceId=instanceId;
  explore.focusFishId=null;
  explore.focusMedicineKey=null;
  explore.eitherChoice=null;
  explore.reqSubmenu=null;
  showScreen('exploring-screen');
  lastHome='exterior-screen';
  renderExploring();
}

function closeExploring(){
  if(explore.running){
    showToast('Wait for the expedition to finish.');
    return;
  }
  explore.reqSubmenu=null;
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  syncUI();
}

function ensureExpeditionStaminaRequired(tierKey){
  if(!state.exploreStaminaRolls) state.exploreStaminaRolls={};
  if(state.exploreStaminaRolls[tierKey]==null){
    state.exploreStaminaRolls[tierKey]=rollExpeditionStaminaRequired(tierKey);
    scheduleSaveGame();
  }
  return state.exploreStaminaRolls[tierKey];
}

function ensureExpeditionHealingRequired(tierKey){
  if(!state.exploreHealingRolls) state.exploreHealingRolls={};
  if(state.exploreHealingRolls[tierKey]==null){
    state.exploreHealingRolls[tierKey]=rollExpeditionHealingRequired(tierKey);
    scheduleSaveGame();
  }
  return state.exploreHealingRolls[tierKey];
}

function ensureExpeditionTorchRequired(tierKey){
  if(!state.exploreTorchRolls) state.exploreTorchRolls={};
  const tier=getExpeditionTier(tierKey);
  if(!expeditionSlotNeeded(tier, 'torch')) return 0;
  if(state.exploreTorchRolls[tierKey]==null){
    state.exploreTorchRolls[tierKey]=rollExpeditionTorchesRequired(tierKey);
    scheduleSaveGame();
  }
  return state.exploreTorchRolls[tierKey];
}

function selectExpeditionTier(key){
  if(!EXPEDITION_TIERS[key]) return;
  explore.tier=key;
  explore.focusFishId=null;
  explore.focusMedicineKey=null;
  explore.eitherChoice=null;
  explore.reqSubmenu=null;
  renderExploring();
}

function setExploreEitherChoice(choice){
  if(choice!=='medicine'&&choice!=='torch') return;
  explore.eitherChoice=choice;
  explore.reqSubmenu=null;
  renderExploring();
}

function setExploreMedicineFocus(medicineKey){
  explore.focusMedicineKey=medicineKey||null;
  renderExploring();
}

function toggleExploreReqSubmenu(slotKey, event){
  event?.stopPropagation?.();
  const tier=getExpeditionTier(explore.tier);
  if(expeditionRequiresEither(tier)&&(slotKey==='medicine'||slotKey==='torch')){
    explore.eitherChoice=slotKey;
  }
  explore.reqSubmenu=explore.reqSubmenu===slotKey?null:slotKey;
  renderExploring();
}

function setExploreStaminaFocus(fishId){
  explore.focusFishId=fishId||null;
  renderExploring();
}

function getAvailableExpeditionRations(){
  const items=[];
  Object.entries(FISH_DEFS).forEach(([fishId,fish])=>{
    const recipe=COOKING_RECIPES[fishId];
    if(!recipe) return;
    const count=itemCountBagAndStore(recipe.cookedKey);
    if(count<=0) return;
    items.push({
      fishId,
      key:recipe.cookedKey,
      icon:recipe.cookedIcon,
      name:recipe.cookedName,
      stamina:fish.stamina,
      count,
    });
  });
  items.sort((a,b)=>a.stamina-b.stamina || a.name.localeCompare(b.name));
  return items;
}

function getAvailableExpeditionMedicine(){
  const items=[];
  EXPEDITION_MEDICINE_ITEMS.forEach(def=>{
    const count=itemCountBagAndStore(def.key);
    if(count<=0) return;
    const itemDef=(typeof getBotanyItemDef==='function'?getBotanyItemDef(def.key):null)
      ||(typeof getFabricItemDef==='function'?getFabricItemDef(def.key):null);
    items.push({
      medicineKey:def.key,
      key:def.key,
      icon:itemDef?.icon||'💊',
      name:itemDef?.name||def.key,
      recovery:def.recovery,
      count,
    });
  });
  items.sort((a,b)=>a.recovery-b.recovery || a.name.localeCompare(b.name));
  return items;
}

function getAvailableMedicineTypes(){
  return getAvailableExpeditionMedicine().map(item=>({
    medicineKey:item.medicineKey,
    icon:item.icon,
    name:item.name,
    recovery:item.recovery,
    count:item.count,
  }));
}

function expeditionMedicineRequired(tier){
  if(!expeditionSlotNeeded(tier, 'medicine')) return false;
  if(expeditionRequiresEither(tier)) return explore.eitherChoice==='medicine';
  return true;
}

function expeditionTorchRequired(tier){
  if(!expeditionSlotNeeded(tier, 'torch')) return false;
  if(expeditionRequiresEither(tier)) return explore.eitherChoice==='torch';
  return true;
}

function totalMedicineRecoveryAvailable(){
  return getAvailableExpeditionMedicine().reduce((sum,item)=>sum+(item.count*item.recovery), 0);
}

function planExpeditionMedicine(required, focusMedicineKey){
  const totalAvailable=totalMedicineRecoveryAvailable();
  let items=getAvailableExpeditionMedicine();
  if(focusMedicineKey) items=items.filter(item=>item.medicineKey===focusMedicineKey);
  items.sort((a,b)=>a.recovery-b.recovery || a.name.localeCompare(b.name));

  let remaining=required;
  const plan=[];
  for(const item of items){
    if(remaining<=0) break;
    const useCount=Math.min(item.count, Math.ceil(remaining/item.recovery));
    if(useCount<=0) continue;
    plan.push({ ...item, useCount });
    remaining-=useCount*item.recovery;
  }

  const totalProvided=plan.reduce((sum,line)=>sum+(line.useCount*line.recovery),0);
  const sufficient=totalProvided>=required;

  if(focusMedicineKey && !sufficient){
    const focusItem=items[0];
    const recovery=focusItem?.recovery||getExpeditionMedicineDef(focusMedicineKey)?.recovery||1;
    const typeHave=items.reduce((sum,item)=>sum+item.count,0);
    const typeNeed=Math.ceil(required/recovery);
    return {
      plan:[],
      focusSummary:{
        medicineKey:focusMedicineKey,
        icon:focusItem?.icon||'💊',
        name:focusItem?.name||focusMedicineKey,
        have:typeHave,
        need:typeNeed,
        recovery,
      },
      totalProvided,
      totalAvailable,
      required,
      sufficient:false,
      remaining:Math.max(0, required-totalProvided),
    };
  }

  const displayPlan=plan.map(line=>({
    ...line,
    displayHave:line.count,
    displayNeed:line.useCount,
  }));

  return {
    plan:displayPlan,
    focusSummary:null,
    totalProvided,
    totalAvailable,
    required,
    sufficient,
    remaining:Math.max(0, required-totalProvided),
  };
}

function getAvailableExpeditionTorches(){
  const def=getSimpleTorchDef();
  const count=itemCountBagAndStore(SIMPLE_TORCH_KEY);
  if(count<1) return [];
  return [{ key:SIMPLE_TORCH_KEY, icon:def.icon, name:def.name, count }];
}

function countExpeditionSupply(slotKey){
  if(slotKey==='medicine') return getAvailableExpeditionMedicine().reduce((sum,i)=>sum+i.count, 0);
  if(slotKey==='torch') return getAvailableExpeditionTorches().reduce((sum,i)=>sum+i.count, 0);
  return 0;
}

function expeditionSuppliesReady(tier, staminaPlan, medicinePlan){
  if(!staminaPlan.sufficient) return { ready:false, reason:'rations' };
  if(expeditionRequiresEither(tier)){
    if(!explore.eitherChoice) return { ready:false, reason:'either' };
    if(explore.eitherChoice==='medicine'){
      if(!medicinePlan.sufficient) return { ready:false, reason:'medicine' };
      return { ready:true };
    }
    const torchNeed=ensureExpeditionTorchRequired(tier.key);
    if(countExpeditionSupply('torch')<torchNeed) return { ready:false, reason:'torch' };
    return { ready:true };
  }
  if(expeditionMedicineRequired(tier) && !medicinePlan.sufficient){
    return { ready:false, reason:'medicine' };
  }
  if(expeditionTorchRequired(tier)){
    const torchNeed=ensureExpeditionTorchRequired(tier.key);
    if(countExpeditionSupply('torch')<torchNeed) return { ready:false, reason:'torch' };
  }
  return { ready:true };
}

function expeditionReadyStatusText(tier, staminaPlan, medicinePlan, supplies){
  if(!staminaPlan.sufficient){
    if(!getAvailableExpeditionRations().length){
      return 'Cook fish and pack available rations';
    }
    return 'Need '+(staminaPlan.required-staminaPlan.totalAvailable)+' more stamina from rations';
  }
  if(supplies.ready) return 'All supplies packed • ready to depart';
  if(supplies.reason==='either') return 'Pick medicine or a torch';
  if(supplies.reason==='medicine'){
    if(!getAvailableExpeditionMedicine().length) return 'Craft bandages for medicine supplies';
    return 'Need '+(medicinePlan.required-medicinePlan.totalAvailable)+' more recovery from medicine';
  }
  if(supplies.reason==='torch'){
    const need=ensureExpeditionTorchRequired(tier.key);
    const have=countExpeditionSupply('torch');
    if(!getAvailableExpeditionTorches().length) return 'Light torches at the fire pit (Light tab)';
    if(have<need) return 'Need '+(need-have)+' more torch'+(need-have===1?'':'es')+' packed';
    return 'Pack torches for this expedition';
  }
  return 'Pack the required supplies';
}

function expeditionStartBtnSub(tier, staminaPlan, medicinePlan, supplies){
  if(!staminaPlan.sufficient) return 'pack enough rations for stamina';
  if(supplies.ready) return 'depart when ready';
  if(supplies.reason==='either') return 'pick medicine or a torch';
  if(supplies.reason==='medicine') return 'pack enough medicine for recovery';
  if(supplies.reason==='torch'){
    const need=ensureExpeditionTorchRequired(tier.key);
    const have=countExpeditionSupply('torch');
    if(have<need) return 'need '+need+' torch'+(need===1?'':'es')+' packed';
    return 'need torches packed';
  }
  return 'complete supply checks first';
}

function getAvailableFishSpecies(){
  const byId={};
  getAvailableExpeditionRations().forEach(item=>{
    if(!byId[item.fishId]){
      byId[item.fishId]={
        fishId:item.fishId,
        icon:item.icon,
        name:FISH_DEFS[item.fishId]?.name||item.name,
        stamina:item.stamina,
        count:0,
      };
    }
    byId[item.fishId].count+=item.count;
  });
  return Object.values(byId).sort((a,b)=>a.stamina-b.stamina || a.name.localeCompare(b.name));
}

function staminaStockClass(have, need){
  if(need<=0) return 'stock-none';
  if(have>=need) return 'stock-enough';
  if(have>0) return 'stock-partial';
  return 'stock-none';
}

function totalStaminaAvailable(){
  return getAvailableExpeditionRations().reduce((sum,item)=>sum+(item.count*item.stamina), 0);
}

function planExpeditionStamina(required, focusFishId){
  const totalAvailable=totalStaminaAvailable();
  let items=getAvailableExpeditionRations();
  if(focusFishId) items=items.filter(item=>item.fishId===focusFishId);
  items.sort((a,b)=>a.stamina-b.stamina || a.name.localeCompare(b.name));

  let remaining=required;
  const plan=[];
  for(const item of items){
    if(remaining<=0) break;
    const useCount=Math.min(item.count, Math.ceil(remaining/item.stamina));
    if(useCount<=0) continue;
    plan.push({ ...item, useCount });
    remaining-=useCount*item.stamina;
  }

  const totalProvided=plan.reduce((sum,line)=>sum+(line.useCount*line.stamina),0);
  const sufficient=totalProvided>=required;

  if(focusFishId && !sufficient){
    const stamina=FISH_DEFS[focusFishId]?.stamina||items[0]?.stamina||1;
    const speciesHave=items.reduce((sum,item)=>sum+item.count,0);
    const speciesNeed=Math.ceil(required/stamina);
    const focusName=FISH_DEFS[focusFishId]?.name||'Fish';
    const focusIcon=FISH_DEFS[focusFishId]?.icon||'🐟';
    return {
      plan:[],
      focusSummary:{
        fishId:focusFishId,
        icon:focusIcon,
        name:focusName,
        have:speciesHave,
        need:speciesNeed,
        stamina,
      },
      totalProvided,
      totalAvailable,
      required,
      sufficient:false,
      remaining:Math.max(0, required-totalProvided),
    };
  }

  const displayPlan=plan.map(line=>({
    ...line,
    displayHave:line.count,
    displayNeed:line.useCount,
  }));

  return {
    plan:displayPlan,
    focusSummary:null,
    totalProvided,
    totalAvailable,
    required,
    sufficient,
    remaining:Math.max(0, required-totalProvided),
  };
}

function renderExpeditionTierPicker(){
  const el=document.getElementById('explore-tier-picker');
  if(!el) return;
  el.innerHTML=EXPEDITION_TIER_ORDER.map(key=>{
    const tier=getExpeditionTier(key);
    const active=explore.tier===key?' active':'';
    return '<button type="button" class="expedition-tier-btn'+active+'" onclick="selectExpeditionTier(\''+key+'\')">'+tier.label+'</button>';
  }).join('');
}

function renderExpeditionRationsPlanHtml(staminaPlan){
  if(staminaPlan.focusSummary){
    const f=staminaPlan.focusSummary;
    const cls=staminaStockClass(f.have, f.need);
    return '<div class="explore-req-plan-line">'
      +'<span>'+f.icon+' '+f.name+'</span>'
      +'<span class="explore-req-plan-qty '+cls+'">'+f.have+'/'+f.need+'</span>'
      +'</div>';
  }
  if(!staminaPlan.plan.length){
    return '<div class="store-line" style="color:rgba(200,169,110,0.45);padding:2px 0">No rations packed.</div>';
  }
  return staminaPlan.plan.map(line=>{
    const cls=staminaStockClass(line.displayHave, line.displayNeed);
    return '<div class="explore-req-plan-line">'
      +'<span>'+line.icon+' '+line.name+'</span>'
      +'<span class="explore-req-plan-qty '+cls+'">'+line.displayHave+'/'+line.displayNeed+'</span>'
      +'</div>';
  }).join('');
}

function renderExpeditionMedicinePlanHtml(medicinePlan){
  if(medicinePlan.focusSummary){
    const f=medicinePlan.focusSummary;
    const cls=staminaStockClass(f.have, f.need);
    return '<div class="explore-req-plan-line">'
      +'<span>'+f.icon+' '+f.name+'</span>'
      +'<span class="explore-req-plan-qty '+cls+'">'+f.have+'/'+f.need+'</span>'
      +'</div>';
  }
  if(!medicinePlan.plan.length){
    return '<div class="store-line" style="color:rgba(200,169,110,0.45);padding:2px 0">No medicine packed.</div>';
  }
  return medicinePlan.plan.map(line=>{
    const cls=staminaStockClass(line.displayHave, line.displayNeed);
    return '<div class="explore-req-plan-line">'
      +'<span>'+line.icon+' '+line.name+' ×'+line.useCount+'</span>'
      +'<span class="explore-req-plan-qty '+cls+'">'+line.displayHave+'/'+line.displayNeed+'</span>'
      +'</div>';
  }).join('');
}

function renderExpeditionReqBox(slotKey, tier, opts){
  const slot=EXPEDITION_REQ_SLOTS[slotKey];
  const open=explore.reqSubmenu===slotKey;
  const openCls=open?' submenu-open':'';
  const selectedCls=opts?.selected?' either-selected':'';
  const dimCls=opts?.dimmed?' either-dimmed':'';
  if(slotKey==='rations'){
    const staminaPlan=opts.staminaPlan;
    const rationsCls=staminaStockClass(staminaPlan.totalAvailable, staminaPlan.required);
    return '<button type="button" class="expedition-req-box clickable'+openCls+'" onclick="toggleExploreReqSubmenu(\'rations\', event)">'
      +'<span class="expedition-req-icon">'+slot.icon+'</span>'
      +'<span class="expedition-req-label">'+slot.label+'</span>'
      +'<span class="expedition-req-qty '+rationsCls+'">'+staminaPlan.totalAvailable+'/'+staminaPlan.required+'</span>'
      +'</button>';
  }
  if(slotKey==='medicine' && opts?.medicinePlan){
    const medicinePlan=opts.medicinePlan;
    const medicineNeeded=!!opts?.medicineNeeded;
    const unneeded=!medicineNeeded;
    const medicineCls=staminaStockClass(medicinePlan.totalAvailable, medicinePlan.required);
    const qtyHtml=medicineNeeded
      ?'<span class="expedition-req-qty '+medicineCls+'">'+medicinePlan.totalAvailable+'/'+medicinePlan.required+'</span>'
      :'<span class="expedition-req-na">not needed</span>';
    return '<button type="button" class="expedition-req-box clickable'+openCls+selectedCls+dimCls+(unneeded?' unneeded':'')+'" onclick="toggleExploreReqSubmenu(\'medicine\', event)">'
      +'<span class="expedition-req-icon">'+slot.icon+'</span>'
      +'<span class="expedition-req-label">'+slot.label+'</span>'
      +qtyHtml
      +'</button>';
  }
  if(slotKey==='torch'){
    const torchNeeded=expeditionTorchRequired(tier);
    const required=torchNeeded?ensureExpeditionTorchRequired(tier.key):0;
    const available=countExpeditionSupply('torch');
    const unneeded=!torchNeeded;
    const qtyHtml=unneeded
      ?'<span class="expedition-req-na">not needed</span>'
      :'<span class="expedition-req-qty '+staminaStockClass(available, required)+'">'+available+'/'+required+'</span>';
    return '<button type="button" class="expedition-req-box clickable'+openCls+selectedCls+dimCls+(unneeded?' unneeded':'')+'" onclick="toggleExploreReqSubmenu(\'torch\', event)">'
      +'<span class="expedition-req-icon">'+slot.icon+'</span>'
      +'<span class="expedition-req-label">'+slot.label+'</span>'
      +qtyHtml
      +'</button>';
  }
  const label=expeditionSlotQtyLabel(tier, slotKey);
  const unneeded=!label;
  const qtyHtml=unneeded
    ?'<span class="expedition-req-na">not needed</span>'
    :'<span class="expedition-req-qty">×'+(label?.qty||0)+'</span>';
  return '<button type="button" class="expedition-req-box clickable'+openCls+(unneeded?' unneeded':'')+'" onclick="toggleExploreReqSubmenu(\''+slotKey+'\', event)">'
    +'<span class="expedition-req-icon">'+slot.icon+'</span>'
    +'<span class="expedition-req-label">'+slot.label+'</span>'
    +qtyHtml
    +'</button>';
}

function renderExploreReqSubmenu(tier, staminaPlan, medicinePlan){
  const el=document.getElementById('explore-req-submenu');
  if(!el) return;
  const key=explore.reqSubmenu;
  if(!key){
    el.hidden=true;
    el.innerHTML='';
    return;
  }
  el.hidden=false;
  const slot=EXPEDITION_REQ_SLOTS[key];
  if(key==='rations'){
    const totalCls=staminaStockClass(staminaPlan.totalAvailable, staminaPlan.required);
    const species=getAvailableFishSpecies();
    let html='<div class="explore-req-submenu-title">RATIONS</div>'
      +'<div class="explore-req-submenu-sub">Stamina from cooked fish</div>'
      +'<div class="explore-req-submenu-summary '+totalCls+'"><span class="stamina-val">'+staminaPlan.totalAvailable+'/'+staminaPlan.required+'</span> stamina available</div>'
      +'<div class="explore-req-submenu-section">PLANNED</div>'
      +renderExpeditionRationsPlanHtml(staminaPlan)
      +'<div class="explore-req-submenu-section">FOCUS</div>'
      +'<button type="button" class="explore-req-submenu-item'+(!explore.focusFishId?' active':'')+'" onclick="setExploreStaminaFocus(null)">'
      +'<span>Weakest first (auto)</span>'
      +'<span class="explore-req-submenu-meta">lowest stamina rations</span>'
      +'</button>';
    if(!species.length){
      html+='<div class="store-line" style="color:rgba(200,169,110,0.45);padding:6px 0 2px">No cooked fish available.</div>';
    }else{
      html+=species.map(sp=>{
        const active=explore.focusFishId===sp.fishId?' active':'';
        return '<button type="button" class="explore-req-submenu-item'+active+'" onclick="setExploreStaminaFocus(\''+sp.fishId+'\')">'
          +'<span>'+sp.icon+' '+sp.name+'</span>'
          +'<span class="explore-req-submenu-meta">'+sp.stamina+' stam • '+sp.count+' packed</span>'
          +'</button>';
      }).join('');
    }
    el.innerHTML=html;
    return;
  }
  if(key==='medicine'){
    const totalCls=staminaStockClass(medicinePlan.totalAvailable, medicinePlan.required);
    const types=getAvailableMedicineTypes();
    let html='<div class="explore-req-submenu-title">MEDICINE</div>'
      +'<div class="explore-req-submenu-sub">'+slot.submenuTitle+' • each bandage used once</div>'
      +'<div class="explore-req-submenu-summary '+totalCls+'"><span class="stamina-val">'+medicinePlan.totalAvailable+'/'+medicinePlan.required+'</span> recovery available</div>'
      +'<div class="explore-req-submenu-section">PLANNED</div>'
      +renderExpeditionMedicinePlanHtml(medicinePlan)
      +'<div class="explore-req-submenu-section">FOCUS</div>'
      +'<button type="button" class="explore-req-submenu-item'+(!explore.focusMedicineKey?' active':'')+'" onclick="setExploreMedicineFocus(null)">'
      +'<span>Weakest first (auto)</span>'
      +'<span class="explore-req-submenu-meta">lowest recovery first</span>'
      +'</button>';
    if(!types.length){
      html+='<div class="store-line" style="color:rgba(200,169,110,0.45);padding:6px 0 2px">No bandages available • craft at loom or apothecary table.</div>';
    }else{
      html+=types.map(item=>{
        const active=explore.focusMedicineKey===item.medicineKey?' active':'';
        return '<button type="button" class="explore-req-submenu-item'+active+'" onclick="setExploreMedicineFocus(\''+item.medicineKey+'\')">'
          +'<span>'+item.icon+' '+item.name+'</span>'
          +'<span class="explore-req-submenu-meta">+'+item.recovery+' recovery • '+item.count+' packed</span>'
          +'</button>';
      }).join('');
    }
    el.innerHTML=html;
    return;
  }
  if(key==='torch'){
    const required=expeditionTorchRequired(tier)?ensureExpeditionTorchRequired(tier.key):0;
    const available=countExpeditionSupply('torch');
    const totalCls=staminaStockClass(available, required);
    const torches=getAvailableExpeditionTorches();
    let html='<div class="explore-req-submenu-title">TORCH</div>'
      +'<div class="explore-req-submenu-sub">'+slot.submenuTitle+' • simple torches from the fire pit</div>';
    if(!required){
      html+='<div class="store-line" style="color:rgba(200,169,110,0.45);padding:4px 0">Not needed for this expedition.</div>';
    }else{
      html+='<div class="explore-req-submenu-summary '+totalCls+'"><span class="stamina-val">'+available+'/'+required+'</span> torches packed</div>';
      if(!torches.length){
        html+='<div class="store-line" style="color:rgba(200,169,110,0.45);padding:6px 0 2px">No torches available • craft at the fire pit (Light tab).</div>';
      }else{
        html+='<div class="explore-req-submenu-section">AVAILABLE</div>';
        html+=torches.map(item=>'<div class="explore-req-submenu-item static">'
          +'<span>'+item.icon+' '+item.name+'</span>'
          +'<span class="explore-req-submenu-meta">'+item.count+' in bag or storage</span>'
          +'</div>').join('');
      }
    }
    el.innerHTML=html;
  }
}

function renderExpeditionRequirements(tier, staminaPlan, medicinePlan){
  const row=document.getElementById('explore-req-row');
  if(!row) return;
  const medicineNeeded=expeditionMedicineRequired(tier);
  const hasEither=expeditionRequiresEither(tier);
  row.classList.toggle('has-either', hasEither);

  if(hasEither){
    const medSelected=explore.eitherChoice==='medicine';
    const torchSelected=explore.eitherChoice==='torch';
    row.innerHTML=renderExpeditionReqBox('rations', tier, { staminaPlan })
      +'<div class="expedition-req-either-wrap">'
      +'<div class="expedition-req-either-head">Either • pick medicine or torch</div>'
      +'<div class="expedition-req-either-pair">'
      +renderExpeditionReqBox('medicine', tier, {
        medicinePlan,
        medicineNeeded:true,
        selected:medSelected,
        dimmed:torchSelected,
      })
      +renderExpeditionReqBox('torch', tier, {
        selected:torchSelected,
        dimmed:medSelected,
      })
      +'</div></div>';
  }else{
    row.innerHTML=renderExpeditionReqBox('rations', tier, { staminaPlan })
      +renderExpeditionReqBox('medicine', tier, { medicinePlan, medicineNeeded })
      +renderExpeditionReqBox('torch', tier, {});
  }
  renderExploreReqSubmenu(tier, staminaPlan, medicinePlan);
}

function renderExpeditionRewards(tier){
  const el=document.getElementById('explore-rewards');
  if(!el) return;
  el.innerHTML=
    '<div class="expedition-reward-line"><span class="reward-val">+'+tier.explorationXp+'</span> Exploration XP on completion</div>'
    +'<div class="expedition-reward-line"><span class="reward-val">'+tier.lootRolls+'</span> random items from the loot pool</div>'
    +'<div class="expedition-reward-line"><span class="reward-val">'+tier.superRarePct+'%</span> chance of a super rare find</div>';
}

function renderExplorationPoolList(pool, containerId, emptyMsg){
  const el=document.getElementById(containerId);
  if(!el) return;
  if(!pool?.length){
    el.innerHTML='<div class="store-line" style="color:rgba(200,169,110,0.45)">'+(emptyMsg||'Nothing listed.')+'</div>';
    return;
  }
  el.innerHTML=pool.map(item=>'<div class="fish-list-row">'
    +'<span>'+item.icon+' '+item.name+'</span>'
    +'</div>').join('');
}

function renderExploring(){
  if(explore.running) return;
  updateActivitySkillPill('explore', 'exploration');
  const tier=getExpeditionTier(explore.tier);
  const requiredStamina=ensureExpeditionStaminaRequired(tier.key);
  const requiredHealing=ensureExpeditionHealingRequired(tier.key);
  const staminaPlan=planExpeditionStamina(requiredStamina, explore.focusFishId);
  const medicinePlan=planExpeditionMedicine(requiredHealing, explore.focusMedicineKey);
  const def=getPlotTileDef('cave');
  const titleEl=document.getElementById('explore-screen-title');
  const nameEl=document.getElementById('explore-cave-name');
  const subEl=document.getElementById('explore-cave-sub');
  const iconEl=document.getElementById('explore-cave-icon');
  if(titleEl) titleEl.textContent='Exploring';
  if(nameEl) nameEl.textContent=def?.name||'Cave';
  if(subEl) subEl.textContent=tier.label+' expedition';
  if(iconEl) iconEl.textContent=def?.icon||'🕳️';
  renderExpeditionTierPicker();
  renderExpeditionRequirements(tier, staminaPlan, medicinePlan);
  renderExpeditionRewards(tier);
  renderExplorationPoolList(EXPLORATION_LOOT_POOL, 'explore-loot-pool', 'No loot defined.');
  renderExplorationPoolList(EXPLORATION_SUPER_RARE_POOL, 'explore-super-rare-pool', 'No super rare loot defined.');
  const supplies=expeditionSuppliesReady(tier, staminaPlan, medicinePlan);
  const status=document.getElementById('explore-status');
  if(status){
    status.textContent=expeditionReadyStatusText(tier, staminaPlan, medicinePlan, supplies);
    status.classList.toggle('idle',!supplies.ready);
  }
  const btnEl=document.getElementById('explore-buttons');
  if(btnEl){
    const canStart=supplies.ready;
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn once" '+(canStart?'':'disabled')+' onclick="startExpedition()">'
      +'🧭 START '+tier.label.toUpperCase()+' EXPEDITION'
      +'<span class="wb-btn-sub">'+expeditionStartBtnSub(tier, staminaPlan, medicinePlan, supplies)+'</span>'
      +'</button></div></div>';
  }
}

let expeditionTimer=null;

function consumeExpeditionStaminaPlan(staminaPlan){
  (staminaPlan.plan||[]).forEach(line=>{
    if(line.useCount>0) consumeManyFromBagOrStore(line.key, line.useCount);
  });
}

function consumeExpeditionMedicinePlan(medicinePlan){
  for(const line of medicinePlan.plan){
    consumeManyFromBagOrStore(line.key, line.useCount);
  }
}

function consumeExpeditionOtherSupplies(tier){
  if(expeditionRequiresEither(tier)){
    if(explore.eitherChoice==='torch'){
      const need=ensureExpeditionTorchRequired(tier.key);
      if(need>0) consumeManyFromBagOrStore(SIMPLE_TORCH_KEY, need);
    }
    return;
  }
  if(expeditionTorchRequired(tier)){
    const need=ensureExpeditionTorchRequired(tier.key);
    if(need>0) consumeManyFromBagOrStore(SIMPLE_TORCH_KEY, need);
  }
}

function applyExpeditionRewardsToStorage(rewards){
  Object.entries(rewards.loot||{}).forEach(([key,count])=>{
    const def=getExpeditionLootDef(key);
    if(def&&count>0) storageAddDirect(key, def.icon, def.name, count);
  });
}

function formatExpeditionLootSummary(rewards){
  const entries=Object.entries(rewards.loot||{})
    .map(([key,count])=>({ def:getExpeditionLootDef(key), count }))
    .filter(e=>e.def&&e.count>0)
    .sort((a,b)=>a.def.name.localeCompare(b.def.name));
  if(!entries.length) return 'Nothing this time — the cave was picked clean.';
  return entries.map(e=>e.def.icon+' '+e.def.name+' ×'+e.count).join('<br>');
}

const expeditionStarGame={ active:false, spawnTimer:null, spawned:0, collected:0, missed:0 };

function markExpeditionStarMissed(star){
  if(!star||star.classList.contains('collected')||star.classList.contains('missed')) return;
  star.classList.add('missed','expired');
  expeditionStarGame.missed=(expeditionStarGame.missed||0)+1;
  if(star._expireTimer){
    clearTimeout(star._expireTimer);
    star._expireTimer=null;
  }
  setTimeout(()=>{ if(star.isConnected) star.remove(); }, 480);
}

function harvestExpeditionStarStats(){
  const layer=document.getElementById('expedition-trek-stars');
  if(layer){
    layer.querySelectorAll('.expedition-trek-star:not(.collected)').forEach(star=>{
      markExpeditionStarMissed(star);
    });
  }
  return {
    collected:expeditionStarGame.collected||0,
    missed:expeditionStarGame.missed||0,
    spawned:expeditionStarGame.spawned||0,
  };
}

function collectExpeditionStar(){
  expeditionStarGame.collected=(expeditionStarGame.collected||0)+1;
  if(!state.pockets) state.pockets={ fire:0, water:0, earth:0, air:0, magic:0 };
  state.pockets.air=(state.pockets.air||0)+1;
  const m=SHARD_META.air;
  grantXP('exploration', EXPEDITION_STAR_EXPLORATION_XP, null, {
    skipShardDrop:true, keepActivities:true, deferSync:true,
  });
  grantXP('air', EXPEDITION_STAR_AIR_XP, null, {
    skipShardDrop:true, keepActivities:true, deferSync:true,
  });
  if(!state._seenShard){
    state._seenShard=true;
    showFoundBanner('POCKET FIND!', m.icon,
      'An elemental shard — tiny enough to live in your pockets. It uses no bag space. You\'ll gather these while training skills, for magic later.',
      'GOT IT', ()=>{ if(openPanel==='inv') renderInvPanel(); syncUI(); });
  }else{
    showQuickToast('⭐ +' + EXPEDITION_STAR_EXPLORATION_XP + ' Exploration • +' + EXPEDITION_STAR_AIR_XP + ' Air • ' + m.icon);
  }
  flashSkillPill('exploration');
  flashSkillPill('air');
  if(openPanel==='inv') renderInvPanel();
  scheduleSaveGame();
}

function burstExpeditionStarSparkles(star, layer){
  if(!star||!layer) return;
  const rect=star.getBoundingClientRect();
  const layerRect=layer.getBoundingClientRect();
  const cx=rect.left+rect.width/2-layerRect.left;
  const cy=rect.top+rect.height/2-layerRect.top;
  const glyphs=['✨','⭐','✦'];
  for(let i=0;i<6;i++){
    const spark=document.createElement('span');
    spark.className='expedition-trek-star-sparkle';
    spark.textContent=glyphs[i%glyphs.length];
    spark.style.left=(cx+(Math.random()*36-18))+'px';
    spark.style.top=(cy+(Math.random()*36-18))+'px';
    spark.style.animationDelay=(i*0.04)+'s';
    layer.appendChild(spark);
    setTimeout(()=>spark.remove(), 650);
  }
}

function spawnExpeditionStar(){
  const layer=document.getElementById('expedition-trek-stars');
  if(!expeditionStarGame.active||!layer) return;
  const star=document.createElement('button');
  star.type='button';
  star.className='expedition-trek-star';
  star.setAttribute('aria-label','Collect star shard');
  star.textContent='⭐';
  star.style.left=(10+Math.random()*80)+'%';
  star.style.top=(14+Math.random()*56)+'%';
  star.style.animationDelay=(expeditionStarGame.spawned*0.04)+'s';
  expeditionStarGame.spawned=(expeditionStarGame.spawned||0)+1;
  star._expireTimer=setTimeout(()=>markExpeditionStarMissed(star), EXPEDITION_STAR_LIFETIME_MS);
  star.onclick=(e)=>{
    e.stopPropagation();
    e.preventDefault();
    if(!expeditionStarGame.active||star.classList.contains('collected')||star.classList.contains('missed')) return;
    if(star._expireTimer){
      clearTimeout(star._expireTimer);
      star._expireTimer=null;
    }
    star.classList.add('collected');
    collectExpeditionStar();
    burstExpeditionStarSparkles(star, layer);
    setTimeout(()=>star.remove(), 520);
  };
  layer.appendChild(star);
}

function startExpeditionStarGame(){
  stopExpeditionStarGame();
  const layer=document.getElementById('expedition-trek-stars');
  if(layer) layer.innerHTML='';
  expeditionStarGame.active=true;
  expeditionStarGame.spawned=0;
  expeditionStarGame.collected=0;
  expeditionStarGame.missed=0;
  const spawnNext=()=>{
    if(!expeditionStarGame.active) return;
    spawnExpeditionStar();
    expeditionStarGame.spawnTimer=setTimeout(spawnNext, 520);
  };
  spawnNext();
}

function stopExpeditionStarGame(){
  expeditionStarGame.active=false;
  clearTimeout(expeditionStarGame.spawnTimer);
  expeditionStarGame.spawnTimer=null;
  const layer=document.getElementById('expedition-trek-stars');
  if(layer) layer.innerHTML='';
}

function showExpeditionTrekOverlay(durationMs, tierLabel){
  const overlay=document.getElementById('expedition-trek-overlay');
  const walker=document.getElementById('expedition-trek-walker');
  const label=document.getElementById('expedition-trek-label');
  const setup=document.getElementById('explore-setup-panel');
  const body=document.querySelector('#exploring-screen .explore-body');
  if(setup) setup.hidden=true;
  if(body) body.hidden=true;
  if(!overlay||!walker) return;
  overlay.hidden=false;
  if(label) label.textContent=(tierLabel||'Short')+' expedition…';
  walker.style.left='-12%';
  walker.style.animation='none';
  void walker.offsetWidth;
  walker.style.animation='expedition-walk '+durationMs+'ms linear forwards';
  startExpeditionStarGame();
}

function hideExpeditionTrekOverlay(){
  stopExpeditionStarGame();
  const overlay=document.getElementById('expedition-trek-overlay');
  const setup=document.getElementById('explore-setup-panel');
  const body=document.querySelector('#exploring-screen .explore-body');
  if(overlay) overlay.hidden=true;
  if(setup) setup.hidden=false;
  if(body) body.hidden=false;
  const walker=document.getElementById('expedition-trek-walker');
  if(walker){
    walker.style.animation='none';
    walker.style.left='-12%';
  }
}

function showExpeditionResultsBanner(tier, rewards, starStats){
  const stars=starStats?.collected||0;
  const missed=starStats?.missed||0;
  const bonusExplore=stars*EXPEDITION_STAR_EXPLORATION_XP;
  const bonusAir=stars*EXPEDITION_STAR_AIR_XP;
  let body='Everything you found went straight to storage.<br><br>';
  body+=formatExpeditionLootSummary(rewards);
  body+='<br><br>';
  if(rewards.superRare){
    body+='<strong>Super rare find!</strong> '+rewards.superRare.icon+' '+rewards.superRare.name+' — the cave gave up something special.';
  }else{
    body+='No super rare this time. The cave kept its best secrets.';
  }
  body+='<br><br>+'+tier.explorationXp+' Exploration XP';
  if(stars>0||missed>0){
    body+='<br><br><strong>Stars on the trek:</strong> '+stars+' collected ⭐';
    if(missed>0) body+=' • '+missed+' missed (too slow)';
    if(stars>0){
      body+='<br>+'+bonusExplore+' bonus Exploration XP • +'+bonusAir+' bonus Air XP';
      body+='<br>'+stars+' Air Shard'+(stars===1?'':'s')+' collected';
    }
  }else{
    body+='<br><br>No stars collected on the trek.';
  }
  showFoundBanner('EXPEDITION COMPLETE','🧭',body,'CONTINUE',()=>{
    renderExploring();
    syncUI();
  });
}

function cancelExpedition(fromActivitySwitch){
  if(!explore.running) return;
  clearTimeout(expeditionTimer);
  expeditionTimer=null;
  explore.running=false;
  hideExpeditionTrekOverlay();
  if(!fromActivitySwitch) clearActivity('exploring');
  if(currentScreen==='exploring-screen') renderExploring();
  if(!fromActivitySwitch) syncUI();
}

function finishExpedition(tier){
  expeditionTimer=null;
  explore.running=false;
  clearActivity('exploring');
  const starStats=harvestExpeditionStarStats();
  hideExpeditionTrekOverlay();
  const rewards=rollExpeditionRewards(tier);
  applyExpeditionRewardsToStorage(rewards);
  grantXP('exploration', tier.explorationXp, null, { keepActivities:true });
  completeExpedition();
  scheduleSaveGame();
  syncUI();
  showExpeditionResultsBanner(tier, rewards, starStats);
}

function startExpedition(){
  if(explore.running) return;
  const tier=getExpeditionTier(explore.tier);
  const requiredStamina=ensureExpeditionStaminaRequired(tier.key);
  const requiredHealing=ensureExpeditionHealingRequired(tier.key);
  const staminaPlan=planExpeditionStamina(requiredStamina, explore.focusFishId);
  const medicinePlan=planExpeditionMedicine(requiredHealing, explore.focusMedicineKey);
  const supplies=expeditionSuppliesReady(tier, staminaPlan, medicinePlan);
  if(!supplies.ready){
    if(supplies.reason==='rations') showToast('Not enough rations packed for this expedition.');
    else if(supplies.reason==='either') showToast('Pick medicine or a torch for this expedition.');
    else if(supplies.reason==='medicine') showToast('Not enough medicine packed for this expedition.');
    else showToast('Not enough torches packed for this expedition.');
    renderExploring();
    return;
  }
  explore.running=true;
  explore.reqSubmenu=null;
  setActivity('exploring');
  consumeExpeditionStaminaPlan(staminaPlan);
  if(expeditionMedicineRequired(tier)) consumeExpeditionMedicinePlan(medicinePlan);
  consumeExpeditionOtherSupplies(tier);
  const durationMs=getExpeditionDurationMs(tier.key);
  showExpeditionTrekOverlay(durationMs, tier.label);
  clearTimeout(expeditionTimer);
  expeditionTimer=setTimeout(()=>finishExpedition(tier), durationMs);
}

function completeExpedition(){
  clearExpeditionSupplyRolls();
}

registerActivityRunner('exploring', {
  isRunning:()=>explore.running,
  stop:(from)=>cancelExpedition(from),
  label:'Exploring',
});
