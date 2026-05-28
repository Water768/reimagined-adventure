/* Hearthstead — fire pit */
'use strict';

let activeFirePitInstanceId=null;

function normalizeFirePitConfig(cfg){
  if(!cfg) return { stone:0, clay:0, bricks:0, complete:false, freePlaced:false };
  if(cfg.stone==null) cfg.stone=0;
  if(cfg.clay==null) cfg.clay=0;
  if(cfg.bricks==null) cfg.bricks=0;
  if(cfg.complete==null) cfg.complete=false;
  if(cfg.freePlaced==null) cfg.freePlaced=false;
  if(isFirePitComplete(cfg)){
    FIRE_PIT_MATERIALS.forEach(m=>{ cfg[m.countKey]=m.required; });
    cfg.complete=true;
  }
  return cfg;
}

function getFirePitConfig(instanceId){
  if(!instanceId) return null;
  return normalizeFirePitConfig(getPlotConfig(instanceId,'fire_pit','fire_pit'));
}

function setActiveFirePit(instanceId){
  activeFirePitInstanceId=instanceId||null;
}

function resolveFirePitCell(el){
  if(el?.classList?.contains('cell-fire-pit')) return el;
  return el?.closest?.('.plot-cell.cell-fire-pit')||null;
}

function resolveFirePitInstanceId(eventOrCell){
  const cell=eventOrCell?.classList?eventOrCell:resolveFirePitCell(eventOrCell?.target);
  return cell?.dataset?.instanceId||activeFirePitInstanceId||null;
}

function forEachFirePitSlot(fn){
  if(typeof forEachPlotOccupied!=='function') return;
  forEachPlotOccupied((x,y,slot)=>{
    if(getPlotTileDef(slot.typeId)?.behavior==='fire_pit') fn(x,y,slot);
  });
}

function countFirePitsOnPlot(){
  let n=0;
  forEachFirePitSlot(()=>{ n++; });
  return n;
}

function getArchitectureLevelForStructures(){
  return Number(state.skills.architecture?.level)||1;
}

function canUseFirePitStructure(){
  return getArchitectureLevelForStructures()>=FIRE_PIT_ARCH_UNLOCK;
}

function isFirePitUnlocked(){
  migrateFirePit();
  return !!state.firePitUnlocked;
}

function canPlaceFirePit(){
  migrateFirePit();
  if(!canUseFirePitStructure()) return false;
  if(state.firePitUnlocked) return true;
  return countFirePitsOnPlot()===0;
}

function firePitSlotExists(instanceId){
  let found=false;
  forEachFirePitSlot((x,y,slot)=>{ if(slot.instanceId===instanceId) found=true; });
  return found;
}

function totalFirePitMaterialsEarned(){
  const totals={ stone:0, clay:0, bricks:0 };
  forEachFirePitSlot((x,y,slot)=>{
    const cfg=getFirePitConfig(slot.instanceId);
    if(cfg&&!cfg.freePlaced){
      totals.stone+=cfg.stone|0;
      totals.clay+=cfg.clay|0;
      totals.bricks+=cfg.bricks|0;
    }
  });
  return totals;
}

function unlockFirePits(){
  if(!state.firePitUnlocked){
    state.firePitUnlocked=true;
    scheduleSaveGame();
  }
}

function migrateFirePit(){
  if(state.firePitUnlocked==null) state.firePitUnlocked=false;
  forEachFirePitSlot((x,y,slot)=>{
    normalizeFirePitConfig(getPlotConfig(slot.instanceId));
    const cfg=getFirePitConfig(slot.instanceId);
    if(getFirePitStage(cfg)==='complete') state.firePitUnlocked=true;
  });
  if(!state.firePitUnlocked){
    forEachFirePitSlot((x,y,slot)=>{
      if(getFirePitStage(getFirePitConfig(slot.instanceId))==='complete') state.firePitUnlocked=true;
    });
  }
  migrateFirePitArchitectureXp();
}

function migrateFirePitArchitectureXp(){
  if(state._firePitArchXpMigrated) return;
  state._firePitArchXpMigrated=true;
  const totals=totalFirePitMaterialsEarned();
  const earned=totals.stone*structureArchXpForMaterial('stone')
    +totals.clay*structureArchXpForMaterial('clay')
    +totals.bricks*structureArchXpForMaterial('brick');
  if(earned>0&&state.skills?.architecture){
    const s=state.skills.architecture;
    s.xpToNext=xpForLevel(s.level);
    const current=getTotalSkillXp('architecture');
    if(current<earned) grantXP('architecture', earned-current, null);
  }
}

function completeFirePit(instanceId){
  instanceId=instanceId||activeFirePitInstanceId;
  const cfg=getFirePitConfig(instanceId);
  if(!cfg) return;
  const showBanner=!cfg.complete;
  FIRE_PIT_MATERIALS.forEach(m=>{ cfg[m.countKey]=m.required; });
  cfg.complete=true;
  unlockFirePits();
  scheduleSaveGame();
  const refreshFirePitUi=()=>{
    if(typeof updateFirePitCells==='function') updateFirePitCells();
    if(currentScreen==='fire-pit-screen') renderFirePitScreen();
    syncUI();
  };
  if(showBanner){
    showFoundBanner(
      'FIRE PIT BUILT!',
      '🔥',
      'The fire pit is ready — cook, burn logs, or throw furniture on the flames.',
      'GOT IT',
      refreshFirePitUi
    );
  }
  refreshFirePitUi();
}

function placeFirePitMaterial(event, instanceId, materialKey){
  instanceId=instanceId||activeFirePitInstanceId;
  const mat=getFirePitMaterialDef(materialKey);
  const cfg=getFirePitConfig(instanceId);
  if(!mat||!cfg||cfg.complete||cfg.freePlaced) return false;
  const current=cfg[mat.countKey]|0;
  if(current>=mat.required){
    if(isFirePitComplete(cfg)) completeFirePit(instanceId);
    return false;
  }
  const needed=mat.required-current;
  const available=itemCountBagAndStore(mat.key);
  const amount=Math.min(needed, available);
  if(amount<1){
    showToast('You need '+mat.name.toLowerCase()+'. Try the quarry or Rocky Clearing.');
    return false;
  }
  const consumed=consumeUpToFromBagOrStore(mat.key, amount);
  if(consumed<1){
    showToast('You need '+mat.name.toLowerCase()+'. Try the quarry or Rocky Clearing.');
    return false;
  }
  cfg[mat.countKey]=current+consumed;
  const willComplete=isFirePitComplete(cfg);
  grantXP('architecture', getFirePitArchXpForMaterial(mat.key)*consumed, null, willComplete?{deferLevelUp:true}:null);
  if(willComplete) completeFirePit(instanceId);
  else{
    if(typeof updateFirePitCells==='function') updateFirePitCells();
    if(currentScreen==='fire-pit-screen') renderFirePitScreen();
    syncUI();
  }
  return true;
}

function firePitMenuTap(event){
  event?.stopPropagation();
  const instanceId=resolveFirePitInstanceId(event);
  if(instanceId) setActiveFirePit(instanceId);
  openFirePitScreen();
}

function openFirePitScreen(){
  migrateFirePit();
  const instanceId=activeFirePitInstanceId;
  if(!instanceId||!firePitSlotExists(instanceId)){
    showToast('Mark out a fire pit site on your plot first.');
    return;
  }
  showScreen('fire-pit-screen');
  lastHome='exterior-screen';
  renderFirePitScreen();
  syncUI();
}

function closeFirePitScreen(){
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  syncUI();
}

function renderFirePitMaterialGrid(materialKey, count){
  const mat=getFirePitMaterialDef(materialKey);
  if(!mat) return '';
  return '<div class="fire-pit-material-block">'
    +'<div class="fire-pit-material-title">'+mat.icon+' '+mat.name+' · '+count+' / '+mat.required+'</div>'
    +'<div class="well-brick-grid fire-pit-material-grid">'
    +Array.from({ length:mat.required }, (_,i)=>{
      const filled=i<count;
      return '<div class="well-brick-slot'+(filled?' filled':'')+'">'+(filled?mat.icon:'')+'</div>';
    }).join('')
    +'</div></div>';
}

let firePitTab='cook';
let firePitSelectedLog='logs';
let firePitSelectedFurniture=null;
let firePitLogPickerOpen=false;
let firePitFurnPickerOpen=false;
let firePitCookPickerOpen=false;

function getFirePitActivitySkillKey(){
  return firePitTab==='cook'?'cooking':'fire';
}

function setFirePitTab(tab){
  firePitTab=tab;
  firePitLogPickerOpen=false;
  firePitFurnPickerOpen=false;
  renderFirePitScreen();
}

function syncFirePitLogSelection(){
  for(let i=LOG_TIER_ORDER.length-1;i>=0;i--){
    const k=LOG_TIER_ORDER[i];
    if(logTypeCount(k)>0){ firePitSelectedLog=k; return; }
  }
  firePitSelectedLog=firePitSelectedLog||'logs';
}

function syncFirePitFurnitureSelection(){
  const owned=listBurnableFirePitFurniture();
  if(!owned.length){ firePitSelectedFurniture=null; return; }
  if(!firePitSelectedFurniture||!owned.some(f=>f.key===firePitSelectedFurniture)){
    firePitSelectedFurniture=owned[0].key;
  }
}

function listBurnableFirePitFurniture(){
  return listAvailableFurniture().filter(f=>getCraftRecipeForFurnitureKey(f.key));
}

function toggleFirePitLogPicker(){
  firePitLogPickerOpen=!firePitLogPickerOpen;
  renderFirePitLogsPanel();
}

function selectFirePitLog(key){
  firePitSelectedLog=key;
  firePitLogPickerOpen=false;
  renderFirePitScreen();
}

function toggleFirePitFurnPicker(){
  firePitFurnPickerOpen=!firePitFurnPickerOpen;
  renderFirePitFurniturePanel();
}

function selectFirePitFurniture(key){
  firePitSelectedFurniture=key;
  firePitFurnPickerOpen=false;
  renderFirePitScreen();
}

function selectFirePitCookRecipe(key){
  if(!COOKING_RECIPES[key]) return;
  cook.recipeKey=key;
  firePitCookPickerOpen=false;
  renderFirePitScreen();
}

function toggleFirePitDefault(){
  state.firePitQuickAction=state.firePitQuickAction==='cook'?'logs':'cook';
  updateFirePitCellQuickAction();
  renderFirePitScreen();
  showToast('Quick tap: '+(state.firePitQuickAction==='cook'?'cook food':'throw log')+'.');
  scheduleSaveGame();
}

function firePitQuickTap(event){
  event?.stopPropagation?.();
  if(getFirePitStage(getFirePitConfig(activeFirePitInstanceId))!=='complete') return;
  if(cook.running && state.firePitQuickAction==='cook'){
    openFirePitScreen();
    return;
  }
  if(state.firePitQuickAction==='logs'){
    burnLogOnFirePit();
    return;
  }
  startCooking();
}

function updateFirePitCellQuickAction(){
  const quick=state.firePitQuickAction==='logs'?'throw log':'cook food';
  document.querySelectorAll('.plot-cell.cell-fire-pit.fire-pit-complete').forEach(cell=>{
    const btn=cell.querySelector('.fire-pit-quick-action-btn');
    if(btn) btn.textContent=cook.running && state.firePitQuickAction==='cook'?'stop':quick;
  });
}

function toggleFirePitCookPicker(){
  firePitCookPickerOpen=!firePitCookPickerOpen;
  renderFirePitCookPanel();
}

function renderFirePitCookPanel(){
  const recipe=COOKING_RECIPES[cook.recipeKey]||COOKING_RECIPES.goldfish;
  if(state.firePitQuickAction==null) state.firePitQuickAction='cook';
  renderCookQuickTapToggle('fpc-default-toggle', state.firePitQuickAction, 'toggleFirePitDefault', 'firepit');
  renderCookRecipePickerList(
    document.getElementById('fpc-recipe-list'),
    firePitCookPickerOpen,
    'toggleFirePitCookPicker',
    'selectFirePitCookRecipe'
  );
  renderCookXpPreview(document.getElementById('fpc-xp-preview'), recipe);
}

function renderFirePitLogsPanel(){
  syncFirePitLogSelection();
  const el=document.getElementById('fpl-log-list');
  const xpEl=document.getElementById('fpl-xp-preview');
  if(!el) return;
  const logKey=firePitSelectedLog||'logs';
  const logDef=LOG_TYPES[logKey]||LOG_DEFS.logs;
  const total=logTypeCount(logKey);
  const fireXp=firePitFireXpForLog(logKey);
  if(!firePitLogPickerOpen){
    el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed'+(total<1?' unavail':'')+'" onclick="toggleFirePitLogPicker()">'
      +'<span class="wb-mat-icon">'+(logDef.icon||'🪵')+'</span>'
      +'<div class="wb-mat-pick-body">'
      +'<span class="wb-mat-pick-avail '+wbStockClass(total)+'">'+(logDef.name||'Log')+' - '+total+' in stock</span>'
      +'<span class="wb-mat-pick-name" style="font-size:11px;color:var(--ui-text-dim)">+'+fireXp+' Fire XP</span>'
      +'</div><span class="wb-log-pick-chevron">▾</span></div>';
  }else{
    el.innerHTML=LOG_TIER_ORDER.map(key=>{
      const d=LOG_TYPES[key]||LOG_DEFS[key];
      if(!d) return '';
      const stock=logTypeCount(key);
      const logFireXp=firePitFireXpForLog(key);
      const selCls=firePitSelectedLog===key?' selected':'';
      const unavailCls=stock<1?' unavail':'';
      const onclick=stock<1?'':' onclick="selectFirePitLog(\''+key+'\')"';
      return '<div class="wb-mat-option'+selCls+unavailCls+'"'+onclick+'>'
        +'<span class="wb-mat-icon">'+(d.icon||'🪵')+'</span><span class="wb-mat-info">'
        +'<span class="wb-mat-name">'+d.name+'</span>'
        +'<span class="wb-mat-stock '+wbStockClass(stock)+'">'+stock+' in stock • +'+logFireXp+' Fire XP</span>'
        +'</span></div>';
    }).join('');
  }
  if(xpEl){
    xpEl.innerHTML='<span class="wb-xp-line">+'+fireXp+' Fire XP</span>';
  }
}

function renderFirePitFurniturePanel(){
  syncFirePitFurnitureSelection();
  const el=document.getElementById('fpf-furn-list');
  const xpEl=document.getElementById('fpf-xp-preview');
  if(!el) return;
  const owned=listBurnableFirePitFurniture();
  const key=firePitSelectedFurniture;
  const def=key?getFurnitureDef(key):null;
  const total=key?itemCountBagAndStore(key):0;
  if(!owned.length){
    el.innerHTML='<div class="store-line" style="color:rgba(200,169,110,0.45)">No crafted furniture in bag or store room.</div>';
    if(xpEl) xpEl.innerHTML='';
    return;
  }
  if(!firePitFurnPickerOpen){
    const fireXp=key?firePitFireXpForFurniture(key):0;
    el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed'+(total<1?' unavail':'')+'" onclick="toggleFirePitFurnPicker()">'
      +'<span class="wb-mat-icon">'+(def?.icon||'🪑')+'</span>'
      +'<div class="wb-mat-pick-body">'
      +'<span class="wb-mat-pick-avail '+wbStockClass(total)+'">'+(def?.name||'Furniture')+' - '+total+' in stock</span>'
      +'<span class="wb-mat-pick-name" style="font-size:11px;color:var(--ui-text-dim)">+'+fireXp+' Fire XP</span>'
      +'</div><span class="wb-log-pick-chevron">▾</span></div>';
  }else{
    el.innerHTML=owned.map(f=>{
      const fireXp=firePitFireXpForFurniture(f.key);
      const selCls=firePitSelectedFurniture===f.key?' selected':'';
      return '<div class="wb-mat-option'+selCls+'" onclick="selectFirePitFurniture(\''+f.key+'\')">'
        +'<span class="wb-mat-icon">'+f.icon+'</span><span class="wb-mat-info">'
        +'<span class="wb-mat-name">'+f.name+'</span>'
        +'<span class="wb-mat-stock '+wbStockClass(f.count)+'">'+f.count+' in stock • +'+fireXp+' Fire XP</span>'
        +'</span></div>';
    }).join('');
  }
  if(xpEl&&key){
    xpEl.innerHTML='<span class="wb-xp-line">+'+firePitFireXpForFurniture(key)+' Fire XP</span>';
  }else if(xpEl){
    xpEl.innerHTML='';
  }
}

function renderFirePitActivityButtons(){
  const btnEl=document.getElementById('fire-pit-buttons');
  const statusEl=document.getElementById('fire-pit-status');
  if(!btnEl) return;
  btnEl.hidden=false;
  if(firePitTab==='cook'){
    const recipe=COOKING_RECIPES[cook.recipeKey]||COOKING_RECIPES.goldfish;
    if(statusEl){
      statusEl.textContent=cook.running?'Cooking on the open fire…':'Cook raw fish over the fire pit';
      statusEl.classList.toggle('idle',!cook.running);
    }
    if(cook.running){
      renderOnceContinuousButtons({
        btnEl,
        running:true,
        stopOnclick:'stopCooking()',
        stopLabel:'⛔ STOP COOKING',
      });
      return;
    }
    const can=canCookRecipe(recipe);
    const needSpace=!canStoreCookedResult(recipe)&&itemCountBagAndStore(recipe.rawKey)>0;
    renderOnceContinuousButtons({
      btnEl,
      running:false,
      can,
      onceLabel:'1 COOK',
      onceOnclick:'cookOnce()',
      continuousOnclick:'cookContinuous()',
      stopOnclick:'stopCooking()',
      stopLabel:'⛔ STOP COOKING',
      noticeHtml:needSpace?'<div class="wb-cost-notice">Bag full — only burns possible until you make space.</div>':'',
    });
    return;
  }
  if(firePitTab==='logs'){
    const logKey=firePitSelectedLog||'logs';
    const total=logTypeCount(logKey);
    const logDef=LOG_TYPES[logKey]||LOG_DEFS.logs;
    const fireXp=firePitFireXpForLog(logKey);
    if(statusEl){
      statusEl.textContent='Feed the fire one log at a time';
      statusEl.classList.add('idle');
    }
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn once" style="flex:1" '+(total<1?'disabled':'')+' onclick="burnLogOnFirePit()">'
      +(logDef.icon||'🪵')+' THROW LOG ON FIRE'
      +'<span class="wb-btn-sub">+'+fireXp+' Fire XP</span></button></div></div>';
    return;
  }
  if(firePitTab==='furniture'){
    syncFirePitFurnitureSelection();
    const key=firePitSelectedFurniture;
    const total=key?itemCountBagAndStore(key):0;
    const def=key?getFurnitureDef(key):null;
    const fireXp=key?firePitFireXpForFurniture(key):0;
    if(statusEl){
      statusEl.textContent='Sacrifice crafted furniture to the flames';
      statusEl.classList.add('idle');
    }
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn once" style="flex:1" '+(!key||total<1?'disabled':'')+' onclick="burnFurnitureOnFirePit()">'
      +(def?.icon||'🪑')+' THROW ON FIRE'
      +'<span class="wb-btn-sub">+'+fireXp+' Fire XP</span></button></div></div>';
  }
}

function burnLogOnFirePit(){
  stopOtherActivities(null);
  syncFirePitLogSelection();
  const logKey=firePitSelectedLog||'logs';
  const logDef=LOG_TYPES[logKey]||LOG_DEFS.logs;
  if(logTypeCount(logKey)<1){
    showToast('No '+((logDef.name||'log').toLowerCase())+'s in bag or store room.');
    return;
  }
  if(!consumeOneFromBagOrStore(logKey)){
    showToast('No wood available.');
    return;
  }
  const xp=firePitFireXpForLog(logKey);
  grantXP('fire', xp, null);
  addActivityLog('firepit-log',(logDef.icon||'🪵')+' '+(logDef.name||'Log')+' burned. +'+xp+' Fire XP','success');
  showToast('The log catches. +' + xp + ' Fire XP 🔥');
  renderFirePitScreen();
  syncUI();
}

function burnFurnitureOnFirePit(){
  stopOtherActivities(null);
  syncFirePitFurnitureSelection();
  const key=firePitSelectedFurniture;
  const def=key?getFurnitureDef(key):null;
  if(!key||!def){
    showToast('Select furniture to burn.');
    return;
  }
  if(itemCountBagAndStore(key)<1){
    showToast('No '+def.name.toLowerCase()+' in bag or store room.');
    return;
  }
  if(!consumeOneFromBagOrStore(key)){
    showToast('Could not take furniture from storage.');
    return;
  }
  const xp=firePitFireXpForFurniture(key);
  const shards=grantGuaranteedFireShards(firePitShardsForFurniture(key));
  grantXP('fire', xp, null);
  addActivityLog('firepit-log',def.icon+' '+def.name+' sacrificed to the flames. +'+xp+' Fire XP • +'+shards+' fire shard'+(shards===1?'':'s'),'success');
  showToast(def.icon+' '+def.name+' burns bright. +'+xp+' Fire XP • +'+shards+' 🔥 shard'+(shards===1?'':'s'));
  renderFirePitScreen();
  syncUI();
}

function renderFirePitActivitySection(){
  updateActivitySkillPill('firepit', getFirePitActivitySkillKey());
  const buildSection=document.getElementById('fire-pit-build-section');
  const activitySection=document.getElementById('fire-pit-activity-section');
  const logEl=document.getElementById('firepit-log');
  if(buildSection) buildSection.hidden=true;
  if(activitySection) activitySection.hidden=false;
  if(logEl) logEl.hidden=false;
  ['cook','logs','furniture'].forEach(tab=>{
    const btn=document.getElementById('fire-pit-tab-'+tab);
    if(btn) btn.classList.toggle('active', firePitTab===tab);
    const panel=document.getElementById('fire-pit-panel-'+tab);
    if(panel) panel.hidden=firePitTab!==tab;
  });
  if(firePitTab==='cook') renderFirePitCookPanel();
  else if(firePitTab==='logs') renderFirePitLogsPanel();
  else renderFirePitFurniturePanel();
  renderFirePitActivityButtons();
}

function renderFirePitBuildSection(cfg){
  const progress=getFirePitProgress(cfg);
  const total=getFirePitTotalRequired();
  const buildSection=document.getElementById('fire-pit-build-section');
  const activitySection=document.getElementById('fire-pit-activity-section');
  const logEl=document.getElementById('firepit-log');
  const countEl=document.getElementById('fire-pit-progress-count');
  const gridsEl=document.getElementById('fire-pit-material-grids');
  const statusEl=document.getElementById('fire-pit-status');
  const btnEl=document.getElementById('fire-pit-buttons');
  if(buildSection) buildSection.hidden=false;
  if(activitySection) activitySection.hidden=true;
  if(logEl) logEl.hidden=true;
  if(countEl){
    countEl.hidden=false;
    countEl.textContent=progress+' / '+total+' materials placed';
  }
  if(gridsEl){
    gridsEl.hidden=false;
    gridsEl.innerHTML=FIRE_PIT_MATERIALS.map(m=>renderFirePitMaterialGrid(m.key, cfg?.[m.countKey]|0)).join('');
  }
  if(statusEl){
    statusEl.textContent='Tap the site or use the buttons below to add materials';
    statusEl.classList.add('idle');
  }
  if(btnEl){
    btnEl.hidden=false;
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns fire-pit-use-btns">'
      +FIRE_PIT_MATERIALS.map(m=>{
        const count=cfg?.[m.countKey]|0;
        const done=count>=m.required;
        return '<button class="wb-btn once" style="flex:1" '+(done?'disabled':'')+' onclick="placeFirePitMaterial(event,null,\''+m.key+'\')">'
          +m.icon+' ADD '+m.name.toUpperCase()
          +'<span class="wb-btn-sub">'+count+'/'+m.required+'</span>'
          +'</button>';
      }).join('')
      +'</div></div>';
  }
}

function renderFirePitScreen(){
  migrateFirePit();
  const cfg=getFirePitConfig(activeFirePitInstanceId);
  const stage=getFirePitStage(cfg);
  const titleEl=document.querySelector('#fire-pit-screen .top-bar-title');
  const nameEl=document.querySelector('#fire-pit-screen .wb-item-name');
  const subEl=document.getElementById('fire-pit-subtitle');
  const skillPill=document.getElementById('firepit-skill-pill');
  if(titleEl) titleEl.textContent=FIRE_PIT_DISPLAY_NAME;
  if(nameEl) nameEl.textContent=FIRE_PIT_DISPLAY_NAME;
  if(skillPill) skillPill.hidden=stage!=='complete';
  if(subEl){
    subEl.textContent=stage==='complete'
      ?(firePitTab==='cook'?'Raw fish from bag or store room'
        :firePitTab==='logs'?'Burn logs one at a time for Fire XP'
        :'Sacrifice furniture for Fire XP and shards')
      :'Lay stone, clay, and bricks to build the fire pit';
  }
  if(stage==='building') renderFirePitBuildSection(cfg);
  else renderFirePitActivitySection();
}

function updateFirePitCells(){
  migrateFirePit();
  document.querySelectorAll('.plot-cell.cell-fire-pit').forEach(cell=>{
    const cfg=getFirePitConfig(cell.dataset.instanceId);
    const vis=getFirePitVisualState(cfg);
    cell.classList.remove('fire-pit-stage-1','fire-pit-stage-2','fire-pit-stage-3','fire-pit-complete','fire-pit-building');
    cell.classList.add('fire-pit-'+vis.stage);
    const icon=cell.querySelector('.fire-pit-icon');
    const label=cell.querySelector('.fire-pit-label');
    if(icon) icon.textContent=vis.icon;
    if(label) label.textContent=vis.label;
    const top=cell.querySelector('.fire-pit-activity-top');
    if(top){
      top.classList.remove('fire-pit-stage-1','fire-pit-stage-2','fire-pit-stage-3','fire-pit-complete','fire-pit-building');
      top.classList.add('fire-pit-'+vis.stage);
    }
  });
  updateFirePitCellQuickAction();
}
