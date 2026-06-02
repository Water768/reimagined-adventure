/* Hearthstead — gathering */
'use strict';

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
      const harvestNote=typeof getGatheringHarvestBlockMessage==='function'?getGatheringHarvestBlockMessage(loc):'';
      subEl.textContent=harvestNote
        ?harvestNote
        :pct+'% find chance • '+GATHER_ITEMS_PER_SESSION+' finds per visit • Foraging Lv '+(state.skills.foraging?.level||1);
    }else{
      subEl.textContent='Tap a gathering tile on your plot';
    }
  }
  if(iconEl) iconEl.textContent=loc?.icon||'🌿';
  renderGatherLootList(loc?.key);
  if(xpEl){
    xpEl.innerHTML='<span class="wb-xp-line">Find: +'+GATHER_XP_SUCCESS+' Foraging XP</span>';
  }
  const status=document.getElementById('gather-status');
  if(status){
    const invFull=invTotal()>=getInvCap();
    if(gather.running){
      status.textContent='Gathering… '+gather.itemsThisSession+' / '+GATHER_ITEMS_PER_SESSION+' found this visit';
    }else if(invFull){
      status.textContent='Bag full ('+invTotal()+'/'+getInvCap()+') — make room before foraging';
    }else{
      status.textContent='';
    }
    status.classList.toggle('idle',!gather.running&&!invFull);
  }
  const btnEl=document.getElementById('gather-buttons');
  if(!btnEl) return;
  if(gather.running){
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns"><button class="wb-btn stop" onclick="stopGathering()">⛔ STOP GATHERING</button></div></div>';
    if(typeof renderGatherFawnPanel==='function') renderGatherFawnPanel();
    return;
  }
  const full=invTotal()>=getInvCap();
  const spotReady=!!loc;
  const harvestBlock=loc&&typeof checkGatherAfternoonHarvestAllowed==='function'
    ?checkGatherAfternoonHarvestAllowed(loc):{ok:true};
  const canStart=spotReady&&!full&&harvestBlock.ok;
  btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
    +'<button class="wb-btn once" '+(canStart?'':'disabled')+' onclick="startGathering()">'
    +'🌿 START GATHERING<span class="wb-btn-sub">'+(spotReady?('search for loot ('+GATHER_ITEMS_PER_SESSION+' per visit)'):'pick a gathering spot first')+'</span></button>'
    +'</div>'
    +(spotReady&&!harvestBlock.ok?'<div class="wb-cost-notice">'+harvestBlock.message+'</div>':'')
    +(spotReady&&harvestBlock.ok&&!gather.running&&gather.itemsThisSession>0?'<div class="wb-cost-notice">Tap the spot again after a visit to search for more.</div>':'')
    +'</div>';
  if(typeof renderGatherFawnPanel==='function') renderGatherFawnPanel();
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
  if(currentScreen==='gathering-screen') renderGathering();
  flushActivityUi('screen');
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
  const startLoc=getCurrentGatheringLocation();
  if(startLoc&&typeof checkGatherAfternoonHarvestAllowed==='function'){
    const allowed=checkGatherAfternoonHarvestAllowed(startLoc);
    if(!allowed.ok){
      showToast(allowed.message||'Cannot forage here yet.');
      return;
    }
  }
  gather.itemsThisSession=0;
  setActivity('gathering');
  gather.running=true;
  if(currentScreen==='gathering-screen') renderGathering();
  flushActivityUi('screen');
  runNextGatherAttempt();
}

function stopGathering(fromActivitySwitch){
  gather.running=false;
  clearTimeout(gather.timer);
  gather.timer=null;
  if(!fromActivitySwitch) clearActivity('gathering');
  if(currentScreen==='gathering-screen') renderGathering();
  flushActivityUi('screen');
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
    const drop=typeof resolveGatherAfternoonDrop==='function'
      ?resolveGatherAfternoonDrop(loc, loot)
      :{keep:true};
    if(!drop.keep){
      gather.itemsThisSession++;
      grantXP('foraging',GATHER_XP_SUCCESS,null);
      tryLocationShardDrop(loc.shardTypes);
      const msg=drop.message||('Almost had '+loot.name.toLowerCase()+'…');
      addActivityLog('gather-log',msg+' +'+GATHER_XP_SUCCESS+' Foraging XP',drop.logKind||'fail');
      if(drop.message) showToast(drop.message);
      if(currentScreen==='gathering-screen'){
        renderGathering();
        if(typeof renderGatherFawnPanel==='function') renderGatherFawnPanel();
      }
      flushActivityUi('screen');
      return;
    }
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
    addActivityLog('gather-log',loot.icon+' Found '+loot.name.toLowerCase()+'! +'+GATHER_XP_SUCCESS+' Foraging XP','success');
    if(loot.key==='mushrooms'&&typeof applyFawnComfortOnMushroomHarvest==='function'){
      applyFawnComfortOnMushroomHarvest(loc);
    }
    if(gather.itemsThisSession>=GATHER_ITEMS_PER_SESSION){
      stopGathering();
      showToast('Visit complete — '+GATHER_ITEMS_PER_SESSION+' finds! Tap the spot to search again.');
    }
  }else{
    grantXP('foraging',GATHER_XP_MISS,null);
    const missMsgs=[
      'You poke around. Nothing yet. +'+GATHER_XP_MISS+' Foraging XP',
      'Rustle in the undergrowth — gone. +'+GATHER_XP_MISS+' Foraging XP',
      'Almost had something… +'+GATHER_XP_MISS+' Foraging XP',
      'Wrong patch. Keep looking. +'+GATHER_XP_MISS+' Foraging XP',
    ];
    addActivityLog('gather-log',missMsgs[Math.floor(Math.random()*missMsgs.length)],'fail');
  }
  if(currentScreen==='gathering-screen') renderGathering();
  flushActivityUi('screen');
}
