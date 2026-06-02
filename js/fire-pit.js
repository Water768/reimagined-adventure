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
  if(typeof forEachPlotStructureSlot==='function') forEachPlotStructureSlot('fire_pit', fn);
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
    normalizeFirePitConfig(getPlotConfig(slot.instanceId,'fire_pit',slot.typeId));
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
  const showBanner=!state.firePitUnlocked;
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
    showStructureBuiltBanner({
      bonusKey:'fire_pit',
      title:'FIRE PIT BUILT!',
      icon:'🔥',
      body:'The fire pit is ready — cook, burn fuel, or light torches.',
      btnText:'GOT IT',
      cb:refreshFirePitUi,
    });
  }else{
    refreshFirePitUi();
  }
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
    +'<div class="fire-pit-material-title">'+formatRecipeMatTitle(mat.icon, mat.name, mat.required, count)+'</div>'
    +'<div class="well-brick-grid fire-pit-material-grid">'
    +Array.from({ length:mat.required }, (_,i)=>{
      const filled=i<count;
      return '<div class="well-brick-slot'+(filled?' filled':'')+'">'+(filled?mat.icon:'')+'</div>';
    }).join('')
    +'</div></div>';
}

let firePitTab='cook';
let firePitBurnFuelKind='log';
let firePitSelectedLog='logs';
let firePitSelectedFurniture=null;
let firePitLightSelectedLog='logs';
let firePitUserPickedBurnFuel=false;
let firePitUserPickedLightLog=false;
let firePitFuelPickerOpen=false;
let firePitLightLogPickerOpen=false;
let firePitCookPickerOpen=false;

function getFirePitActivitySkillKey(){
  return firePitTab==='cook'?'cooking':'fire';
}

function pickBestLogKeyForBurning(){
  for(let i=LOG_TIER_ORDER.length-1;i>=0;i--){
    const k=LOG_TIER_ORDER[i];
    if(itemCountBagAndStore(k)>0) return k;
  }
  return null;
}

/** Consume one log and grant Fire affinity XP (+ standard shard roll via grantXP). */
function burnLogForFireAffinity(logKey){
  const key=logKey||pickBestLogKeyForBurning();
  if(!key) return { ok:false, reason:'no_log' };
  const logDef=LOG_TYPES[key]||LOG_DEFS[key]||LOG_DEFS.logs;
  if(!consumeOneFromBagOrStore(key)) return { ok:false, reason:'consume_failed' };
  const xp=firePitFireXpForLog(key);
  grantXP('fire', xp, null);
  flashSkillPill('fire');
  return { ok:true, xp, logKey:key, logDef };
}

function setFirePitTab(tab){
  if(tab==='logs'||tab==='furniture') tab='burn';
  firePitTab=tab;
  firePitFuelPickerOpen=false;
  firePitLightLogPickerOpen=false;
  renderFirePitScreen();
}

function syncFirePitBurnSelection(){
  if(firePitUserPickedBurnFuel){
    if(firePitBurnFuelKind==='log'&&firePitSelectedLog&&logTypeCount(firePitSelectedLog)>0) return;
    if(firePitBurnFuelKind==='furniture'&&firePitSelectedFurniture&&itemCountBagAndStore(firePitSelectedFurniture)>0) return;
  }
  for(let i=LOG_TIER_ORDER.length-1;i>=0;i--){
    const k=LOG_TIER_ORDER[i];
    if(logTypeCount(k)>0){
      firePitBurnFuelKind='log';
      firePitSelectedLog=k;
      return;
    }
  }
  const owned=listBurnableFirePitFurniture();
  if(owned.length){
    firePitBurnFuelKind='furniture';
    firePitSelectedFurniture=owned[0].key;
    return;
  }
  firePitBurnFuelKind='log';
  firePitSelectedLog=firePitSelectedLog||'logs';
}

function getFirePitBurnSelection(){
  syncFirePitBurnSelection();
  if(firePitBurnFuelKind==='furniture'){
    const key=firePitSelectedFurniture;
    const def=key?getFurnitureDef(key):null;
    const total=key?itemCountBagAndStore(key):0;
    return {
      kind:'furniture',
      key,
      icon:def?.icon||'🪑',
      name:def?.name||'Furniture',
      total,
      fireXp:key?firePitFireXpForFurniture(key):0,
    };
  }
  const key=firePitSelectedLog||'logs';
  const logDef=LOG_TYPES[key]||LOG_DEFS[key]||LOG_DEFS.logs;
  const total=logTypeCount(key);
  return {
    kind:'log',
    key,
    icon:logDef.icon||'🪵',
    name:logDef.name||'Log',
    total,
    fireXp:firePitFireXpForLog(key),
  };
}

function listAllBurnableFirePitFurnitureTypes(){
  const out=[];
  const seen=new Set();
  for(const id of Object.keys(FURNITURE_CRAFTS||{})){
    const r=FURNITURE_CRAFTS[id];
    const key=r.furnitureKey||r.id;
    if(!key||seen.has(key)||!getCraftRecipeForFurnitureKey(key)) continue;
    seen.add(key);
    const def=getFurnitureDef(key);
    const fallback=FURNITURE_DEFS[key];
    out.push({
      key,
      icon:def?.icon||fallback?.icon||r.icon||'🪑',
      name:def?.name||fallback?.name||r.name||key,
      count:itemCountBagAndStore(key),
    });
  }
  return out.sort((a,b)=>a.name.localeCompare(b.name));
}

function renderFirePitBurnFuelOption(kind, key, icon, name, stock, sel){
  const selected=sel.kind===kind&&sel.key===key;
  const selCls=selected?' selected':'';
  const unavailCls=stock<1?' unavail':'';
  const onclick=stock<1?'':(' onclick="'+(selected?'toggleFirePitFuelPicker()':'selectFirePitBurnFuel(\''+kind+'\',\''+key+'\')')+'"');
  return '<div class="wb-mat-option'+selCls+unavailCls+'"'+onclick+'>'
    +'<span class="wb-mat-icon">'+icon+'</span><span class="wb-mat-info">'
    +'<span class="plot-add-item-title-row"><span class="plot-add-item-title">'+name+'</span></span>'
    +'<span class="wb-mat-stock wb-mat-pick-line '+wbStockClass(stock, 1)+'">'+formatRecipeMatLine(name, 1, stock)+'</span>'
    +'</span></div>';
}

function toggleFirePitFuelPicker(){
  firePitFuelPickerOpen=!firePitFuelPickerOpen;
  renderFirePitBurnPanel();
}

function selectFirePitBurnFuel(kind, key){
  if(kind==='log'){
    firePitBurnFuelKind='log';
    firePitSelectedLog=key;
  }else{
    firePitBurnFuelKind='furniture';
    firePitSelectedFurniture=key;
  }
  firePitUserPickedBurnFuel=true;
  firePitFuelPickerOpen=false;
  renderFirePitScreen();
}

function listBurnableFirePitFurniture(){
  return listAvailableFurniture().filter(f=>getCraftRecipeForFurnitureKey(f.key));
}

function syncFirePitLightLogSelection(){
  if(firePitUserPickedLightLog) return;
  for(const k of getSimpleTierLogKeys()){
    if(itemCountBagAndStore(k)>0){ firePitLightSelectedLog=k; return; }
  }
  firePitLightSelectedLog=firePitLightSelectedLog||'logs';
}

function toggleFirePitLightLogPicker(){
  firePitLightLogPickerOpen=!firePitLightLogPickerOpen;
  renderFirePitLightPanel();
}

function selectFirePitLightLog(key){
  firePitLightSelectedLog=key;
  firePitUserPickedLightLog=true;
  firePitLightLogPickerOpen=false;
  renderFirePitScreen();
}

function selectFirePitCookRecipe(key){
  if(!COOKING_RECIPES[key]) return;
  if(key!==cook.recipeKey&&cook.running) stopCooking();
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

function renderFirePitBurnXpPreview(sel){
  const xpEl=document.getElementById('fpb-xp-preview');
  if(!xpEl) return;
  xpEl.innerHTML=sel&&sel.fireXp>0
    ?('<span class="wb-xp-line">'+formatSkillXp(sel.fireXp, 'Fire')+'</span>')
    :'';
}

function renderFirePitBurnPanel(){
  const el=document.getElementById('fpb-fuel-list');
  if(!el) return;
  const sel=getFirePitBurnSelection();
  const canBurn=sel.total>0;

  if(!firePitFuelPickerOpen){
    el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed'+(canBurn?' ready':' unavail')+'" onclick="toggleFirePitFuelPicker()">'
      +'<span class="wb-mat-icon">'+sel.icon+'</span>'
      +'<div class="wb-mat-pick-body">'
      +'<span class="wb-mat-pick-avail wb-mat-pick-line '+wbStockClass(sel.total, 1)+'">'+formatRecipeMatLine(sel.name, 1, sel.total)+'</span>'
      +'</div><span class="wb-log-pick-chevron">▾</span></div>';
    renderFirePitBurnXpPreview(sel);
    return;
  }

  let html='';
  const logRows=LOG_TIER_ORDER.map(key=>{
    const d=LOG_TYPES[key]||LOG_DEFS[key];
    if(!d) return '';
    return renderFirePitBurnFuelOption('log', key, d.icon||'🪵', d.name, logTypeCount(key), sel);
  }).join('');
  if(logRows) html+='<div class="sw-tier-label">LOGS</div>'+logRows;

  const furn=listAllBurnableFirePitFurnitureTypes();
  const furnRows=furn.map(f=>renderFirePitBurnFuelOption(
    'furniture', f.key, f.icon, f.name, f.count, sel
  )).join('');
  if(furnRows) html+='<div class="sw-tier-label">FURNITURE</div>'+furnRows;
  if(!html){
    html='<div class="store-line" style="color:rgba(200,169,110,0.45);padding:4px 0">No fuel in bag or storage.</div>';
  }

  el.innerHTML=html;
  renderFirePitBurnXpPreview(sel);
}

function renderFirePitLightReqPreview(fireLevel){
  const el=document.getElementById('fpl-xp-preview');
  if(!el) return;
  el.innerHTML=fireLevel<TORCH_FIRE_LEVEL_REQUIRED
    ?'<span class="wb-xp-line">Fire Lv '+TORCH_FIRE_LEVEL_REQUIRED+' required</span>'
    :'';
}

function renderFirePitLightPanel(){
  syncFirePitLightLogSelection();
  const el=document.getElementById('fpl-light-log-list');
  if(!el) return;
  const logKey=firePitLightSelectedLog||'logs';
  const logDef=LOG_TYPES[logKey]||LOG_DEFS[logKey]||LOG_DEFS.logs;
  const total=itemCountBagAndStore(logKey);
  const fireLevel=getFireSkillLevel();
  const torchDef=getSimpleTorchDef();
  const locked=fireLevel<TORCH_FIRE_LEVEL_REQUIRED;
  const lvlBadge=typeof plotAddLevelBadge==='function'
    ?plotAddLevelBadge('fire', fireLevel, TORCH_FIRE_LEVEL_REQUIRED, TORCH_FIRE_LEVEL_REQUIRED)
    :'';

  if(!firePitLightLogPickerOpen){
    el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed'+((locked||total<TORCH_SIMPLE_LOG_COST)?' unavail':' ready')+'" onclick="toggleFirePitLightLogPicker()">'
      +'<span class="wb-mat-icon">'+(logDef.icon||'🪵')+'</span>'
      +'<div class="wb-mat-pick-body">'
      +'<span class="wb-mat-pick-avail wb-mat-pick-line '+wbStockClass(total, TORCH_SIMPLE_LOG_COST)+'">'+formatRecipeMatLine(logDef.name||'Log', TORCH_SIMPLE_LOG_COST, total)+'</span>'
      +wbMatSuccessLineHtml((logDef.icon||'🪵')+' → '+torchDef.icon+' '+torchDef.name)
      +'</div><span class="wb-log-pick-chevron">▾</span></div>';
    renderFirePitLightReqPreview(fireLevel);
    return;
  }

  el.innerHTML=getSimpleTierLogKeys().map(key=>{
    const d=LOG_TYPES[key]||LOG_DEFS[key];
    if(!d) return '';
    const stock=itemCountBagAndStore(key);
    const selected=firePitLightSelectedLog===key;
    const selCls=selected?' selected':'';
    const unavailCls=locked||stock<TORCH_SIMPLE_LOG_COST?' unavail':'';
    const onclick=locked?'':(' onclick="'+(selected?'toggleFirePitLightLogPicker()':'selectFirePitLightLog(\''+key+'\')')+'"');
    const desc=locked
      ?'Need Fire Lv '+TORCH_FIRE_LEVEL_REQUIRED
      :('<span class="wb-mat-stock wb-mat-pick-line '+wbStockClass(stock, TORCH_SIMPLE_LOG_COST)+'">'+formatRecipeMatLine(d.name, TORCH_SIMPLE_LOG_COST, stock)+'</span>'
        +wbMatSuccessLineHtml(torchDef.icon+' '+torchDef.name));
    return '<div class="wb-mat-option'+selCls+unavailCls+'"'+onclick+'>'
      +'<span class="wb-mat-icon">'+(d.icon||'🪵')+'</span><span class="wb-mat-info">'
      +plotAddItemTitleRow(d.name, lvlBadge)
      +'<span class="wb-mat-stock">'+desc+'</span>'
      +'</span></div>';
  }).join('');
  renderFirePitLightReqPreview(fireLevel);
}

function lightSimpleTorch(){
  stopOtherActivities(null);
  const fireLevel=getFireSkillLevel();
  if(fireLevel<TORCH_FIRE_LEVEL_REQUIRED){
    showToast('Fire Lv '+TORCH_FIRE_LEVEL_REQUIRED+' required to light a torch.');
    return;
  }
  const logKey=firePitLightSelectedLog||'logs';
  const logDef=LOG_TYPES[logKey]||LOG_DEFS[logKey]||LOG_DEFS.logs;
  const have=itemCountBagAndStore(logKey);
  if(have<TORCH_SIMPLE_LOG_COST){
    showToast('Need '+TORCH_SIMPLE_LOG_COST+' '+((logDef?.name||'log').toLowerCase())+'s.');
    return;
  }
  const consumed=consumeUpToFromBagOrStore(logKey, TORCH_SIMPLE_LOG_COST);
  if(consumed<TORCH_SIMPLE_LOG_COST){
    showToast('Could not take enough logs from bag or storage.');
    return;
  }
  const torch=getSimpleTorchDef();
  invAddDirect(torch.key, torch.icon, torch.name, 1);
  addActivityLog('firepit-log', torch.icon+' '+torch.name+' lit and packed.','success');
  showToast(torch.icon+' '+torch.name+' ready for the cave.');
  renderFirePitScreen();
  syncUI();
}

function renderFirePitActivityButtons(){
  const btnEl=document.getElementById('fire-pit-buttons');
  const statusEl=document.getElementById('fire-pit-status');
  if(!btnEl) return;
  btnEl.hidden=false;
  if(firePitTab==='cook'){
    const recipe=COOKING_RECIPES[cook.recipeKey]||COOKING_RECIPES.goldfish;
    if(statusEl){
      statusEl.textContent=cook.running?'Cooking on the open fire…':'';
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
    renderOnceContinuousButtons({
      btnEl,
      running:false,
      can,
      onceLabel:'1 COOK',
      onceOnclick:'cookOnce()',
      continuousOnclick:'cookContinuous()',
      stopOnclick:'stopCooking()',
      stopLabel:'⛔ STOP COOKING',
      noticeHtml:!can?('<div class="wb-cost-notice">'+(getCookBlockReason(recipe)||'Cannot cook right now.')+'</div>'):'',
    });
    return;
  }
  if(firePitTab==='burn'){
    const sel=getFirePitBurnSelection();
    const can=sel.total>0;
    if(statusEl){
      statusEl.textContent=can?'':'';
      statusEl.classList.add('idle');
    }
    const onceLabel=sel.kind==='log'?'1 BURN LOG':'1 BURN FURNITURE';
    renderOnceContinuousButtons({
      btnEl,
      running:false,
      can,
      onceLabel,
      onceOnclick:'burnSelectedFuelOnFirePit()',
      noticeHtml:!can?'<div class="wb-cost-notice">Need fuel in bag or storage.</div>':'',
    });
    return;
  }
  if(firePitTab==='light'){
    syncFirePitLightLogSelection();
    const logKey=firePitLightSelectedLog||'logs';
    const logDef=LOG_TYPES[logKey]||LOG_DEFS[logKey]||LOG_DEFS.logs;
    const total=itemCountBagAndStore(logKey);
    const fireLevel=getFireSkillLevel();
    const canLight=fireLevel>=TORCH_FIRE_LEVEL_REQUIRED&&total>=TORCH_SIMPLE_LOG_COST;
    const torchDef=getSimpleTorchDef();
    let notice='';
    if(fireLevel<TORCH_FIRE_LEVEL_REQUIRED){
      notice='<div class="wb-cost-notice">Reach Fire Lv '+TORCH_FIRE_LEVEL_REQUIRED+' to light torches.</div>';
    }else if(total<TORCH_SIMPLE_LOG_COST){
      notice='<div class="wb-cost-notice">Need '+TORCH_SIMPLE_LOG_COST+' '+((logDef?.name||'logs').toLowerCase())+'s.</div>';
    }
    if(statusEl){
      statusEl.textContent='';
      statusEl.classList.add('idle');
    }
    renderOnceContinuousButtons({
      btnEl,
      running:false,
      can:canLight,
      onceLabel:'1 LIGHT TORCH',
      onceOnclick:'lightSimpleTorch()',
      noticeHtml:notice,
    });
    return;
  }
}

function burnSelectedFuelOnFirePit(){
  const sel=getFirePitBurnSelection();
  if(sel.kind==='furniture') burnFurnitureOnFirePit();
  else burnLogOnFirePit();
}

function burnLogOnFirePit(){
  stopOtherActivities(null);
  const logKey=firePitSelectedLog||'logs';
  const logDef=LOG_TYPES[logKey]||LOG_DEFS[logKey]||LOG_DEFS.logs;
  if(!logKey||itemCountBagAndStore(logKey)<1){
    showToast('No '+((logDef?.name||'log').toLowerCase())+'s available.');
    return;
  }
  const result=burnLogForFireAffinity(logKey);
  if(!result.ok){
    showToast('No wood available.');
    return;
  }
  addActivityLog('firepit-log',(result.logDef.icon||'🪵')+' '+(result.logDef.name||'Log')+' burned. +'+result.xp+' Fire','success');
  showToast('The log catches. +' + result.xp + ' Fire 🔥');
  renderFirePitScreen();
  syncUI();
}

function burnFurnitureOnFirePit(){
  stopOtherActivities(null);
  const key=firePitSelectedFurniture;
  const def=key?getFurnitureDef(key):null;
  if(!key||!def){
    showToast('Select furniture to burn.');
    return;
  }
  if(itemCountBagAndStore(key)<1){
    showToast('No '+def.name.toLowerCase()+' available.');
    return;
  }
  if(!consumeOneFromBagOrStore(key)){
    showToast('Could not take furniture from storage.');
    return;
  }
  const xp=firePitFireXpForFurniture(key);
  const shards=grantGuaranteedFireShards(firePitShardsForFurniture(key));
  grantXP('fire', xp, null);
  flashSkillPill('fire');
  addActivityLog('firepit-log',def.icon+' '+def.name+' sacrificed to the flames. +'+xp+' Fire • +'+shards+' fire shard'+(shards===1?'':'s'),'success');
  showToast(def.icon+' '+def.name+' burns bright. +'+xp+' Fire • +'+shards+' 🔥 shard'+(shards===1?'':'s'));
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
  ['cook','burn','light'].forEach(tab=>{
    const btn=document.getElementById('fire-pit-tab-'+tab);
    if(btn) btn.classList.toggle('active', firePitTab===tab);
    const panel=document.getElementById('fire-pit-panel-'+tab);
    if(panel) panel.hidden=firePitTab!==tab;
  });
  if(firePitTab==='cook') renderFirePitCookPanel();
  else if(firePitTab==='burn') renderFirePitBurnPanel();
  else renderFirePitLightPanel();
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
    statusEl.textContent='Use the buttons below to add materials';
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
      ?(firePitTab==='cook'?'Uses available raw fish'
        :firePitTab==='burn'?'Open fuel material — pick logs or furniture to burn'
        :'Light simple torches for cave expeditions')
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
