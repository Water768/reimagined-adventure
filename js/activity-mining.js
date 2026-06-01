/* Hearthstead — mining */
'use strict';

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
  flushActivityUi('screen');
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
    if(currentScreen==='mining-screen') renderMining();
    flushActivityUi('screen');
    return;
  }
  mine.stacks++;
  ensureMiningLoop();
  if(currentScreen==='mining-screen') renderMining();
  flushActivityUi('screen');
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
  if(currentScreen==='mining-screen') renderMining();
  flushActivityUi('screen');
  runNextMineAttempt();
}

function stopMining(fromActivitySwitch){
  mine.running=false;
  clearTimeout(mine.timer);
  mine.timer=null;
  if(!fromActivitySwitch) clearActivity('mining');
  if(currentScreen==='mining-screen') renderMining();
  flushActivityUi('screen');
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
    flushActivityUi('screen');
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
  flushActivityUi('screen');
}
