/* Hearthstead — fishing */
'use strict';

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
  flushActivityUi('screen');
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
  if(currentScreen==='fishing-screen') renderFishing();
  flushActivityUi('screen');
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
      let sub=body.cells.length+' tile'+(body.cells.length!==1?'s':'')+' • '+pct+'% catch chance';
      const bestRod=typeof getToolStoreRodDef==='function'?getToolStoreRodDef():null;
      if(bestRod){
        sub+=' • always uses '+bestRod.icon+' '+bestRod.name;
        if(typeof toolStoreBonusesActive==='function'&&!toolStoreBonusesActive()){
          sub+=' (build a tool store for rod bonuses)';
        }
      }
      subEl.textContent=sub;
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
    releaseBtn='<button class="wb-btn stop" style="flex:1" onclick="stopReleasingFish(); renderFishing(); flushActivityUi(\'screen\');">⛔ STOP RELEASING</button>';
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
  if(currentScreen==='fishing-screen') renderFishing();
  flushActivityUi('screen');
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
  flushActivityUi('screen');
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
    flushActivityUi('screen');
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
  flushActivityUi('screen');
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
  fish.timer=setTimeout(runNextFishAttempt, typeof getFishingTickMs==='function'?getFishingTickMs():ACTION_TICK_MS);
}

function fishAttempt(){
  if(!fish.running) return;
  const body=getCurrentFishingWaterBody();
  const typeCfg=body?WATER_BODY_TYPES[body.type]:WATER_BODY_TYPES.pond;
  state.fishAttempts++;
  if(typeof tryFishingWetMapPieceDrop==='function') tryFishingWetMapPieceDrop();
  grantXP('water', FISH_ATTEMPT_WATER_XP, null, { keepActivities:true });
  if(body&&!canFishAtBody(body.type)){
    if(tryUnderlevelFishLump(body.type)){
      flushActivityUi('screen');
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
    flushActivityUi('screen');
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
      flushActivityUi('screen');
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
  if(currentScreen==='fishing-screen') renderFishing();
  flushActivityUi('screen');
}

