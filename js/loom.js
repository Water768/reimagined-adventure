/* Hearthstead — wonky loom */
'use strict';

function buildWonkyLoomUtilityMenuItem(x,y){
  const def=INTERIOR_ROOM_DEFS.wonky_loom;
  if(!def) return '';
  const stock=itemCountBagAndStore(WONKY_LOOM_FURNITURE_KEY);
  const hasStock=stock>0;
  const drops=hasStock
    ?(stock===1?'1 available — ready to place':formatAvailableCount(stock)+' — ready to place')
    :'Craft one at the workbench first';
  const cls='plot-add-item '+(hasStock?'structure-unlocked':'structure-locked below-rec is-disabled');
  return '<button type="button" class="'+cls+'"'+(hasStock?'':' disabled')+(hasStock?' onclick="placeInteriorWonkyLoom('+x+','+y+')"':'')+'>'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'+def.name
    +'<span class="plot-add-item-drops">'+drops+'</span></span></button>';
}

function placeInteriorWonkyLoom(x,y){
  const def=INTERIOR_ROOM_DEFS.wonky_loom;
  if(!def){ closeInteriorBuildMenu(); return; }
  if(!wonkyLoomInStock()){
    showToast('Craft a Wonky Loom at the workbench first.');
    closeInteriorBuildMenu();
    return;
  }
  migrateInterior();
  const ck=interiorCoordKey(x,y);
  const cellKey=state.interior.cells[ck];
  if(!isInteriorBuildSlotKey(cellKey)){
    showToast('Pick an empty room or build slot.');
    closeInteriorBuildMenu();
    return;
  }
  if(!consumeOneFromBagOrStore(WONKY_LOOM_FURNITURE_KEY)){
    showToast('Could not take Wonky Loom.');
    closeInteriorBuildMenu();
    return;
  }
  state.interior.cells[ck]='wonky_loom';
  closeInteriorBuildMenu();
  renderInteriorGrid();
  syncUI();
  scheduleSaveGame();
  showToast(def.icon+' '+def.name+' built.');
}

function migrateWonkyLoom(){
  if(!state.interior?.cells) return;
}

function renderWonkyLoomCellContent(el){
  el.dataset.intKey='wonky_loom';
  el.innerHTML='<div class="wonky-loom-idle"><div class="int-item">🧵</div><div class="int-label">wonky loom</div></div>'
    +'<div class="plot-activity-top">'
    +'<button type="button" class="int-quick-action-btn">weave fabric</button>'
    +'</div>'
    +'<div class="plot-activity-menu-zone">'
    +'<button type="button" class="plot-menu-btn">menu</button>'
    +'</div>';
  const quickBtn=el.querySelector('.int-quick-action-btn');
  const menuBtn=el.querySelector('.plot-menu-btn');
  if(quickBtn) quickBtn.onclick=(ev)=>{ ev.stopPropagation(); loomQuickTap(ev); };
  if(menuBtn) menuBtn.onclick=(ev)=>{ ev.stopPropagation(); loomMenuTap(ev); };
  el.onclick=(e)=>{
    if(intSuppressClick||isInteriorBuildMode()) return;
    if(e.target.closest('.plot-menu-btn')||e.target.closest('.int-quick-action-btn')) return;
    toggleLoomOverlayForCell(el, e);
  };
}

let loomOverlayCloser=null;
let activeLoomOverlayCell=null;
let loomRecipeKey='simple_cloth';
let loomRecipePickerOpen=false;
const loomSelectedInputKeys={};

function closeLoomOverlay(){
  if(activeLoomOverlayCell){
    activeLoomOverlayCell.classList.remove('plot-activity-menu-ready');
    activeLoomOverlayCell=null;
  }
  if(loomOverlayCloser){ document.removeEventListener('pointerdown',loomOverlayCloser,true); loomOverlayCloser=null; }
}

function isLoomOverlayOpen(){
  return !!activeLoomOverlayCell?.classList.contains('plot-activity-menu-ready');
}

function openLoomOverlayForCell(cell){
  if(!cell) return;
  closeLoomOverlay();
  cell.classList.add('plot-activity-menu-ready');
  activeLoomOverlayCell=cell;
  if(loomOverlayCloser) document.removeEventListener('pointerdown',loomOverlayCloser,true);
  loomOverlayCloser=function(e){
    if(activeLoomOverlayCell?.contains(e.target)) return;
    closeLoomOverlay();
    e.preventDefault();
    e.stopPropagation();
  };
  setTimeout(()=>document.addEventListener('pointerdown',loomOverlayCloser,true),80);
}

function toggleLoomOverlayForCell(cell, event){
  if(intSuppressClick) return;
  if(event?.target?.closest?.('.plot-menu-btn')||event?.target?.closest?.('.int-quick-action-btn')) return;
  if(activeLoomOverlayCell===cell&&isLoomOverlayOpen()) closeLoomOverlay();
  else openLoomOverlayForCell(cell);
}

function loomQuickTap(event){
  event.stopPropagation();
  closeLoomOverlay();
  if(loomProcess.running){ stopLoomWeaving(); return; }
  weaveOnce();
}

function loomMenuTap(event){
  event.stopPropagation();
  closeLoomOverlay();
  openLoomScreen();
}

function openLoomScreen(){
  showScreen('loom-screen');
  lastHome='interior-screen';
  renderLoomScreen();
}

function closeLoomScreen(){
  closeLoomOverlay();
  showScreen('interior-screen');
  lastHome='interior-screen';
  syncUI();
}

function selectLoomRecipe(key){
  if(!LOOM_RECIPES[key]) return;
  if(LOOM_RECIPES[key].lockedOnWonkyLoom){
    showToast(LOOM_LINEN_LOCKED_MSG);
    return;
  }
  loomRecipeKey=key;
  loomRecipePickerOpen=false;
  renderLoomScreen();
}

function toggleLoomRecipePicker(){
  loomRecipePickerOpen=!loomRecipePickerOpen;
  renderLoomRecipePanel();
  renderLoomActivityButtons();
}

function recipeHasLoomMaterialChoice(recipe){
  return recipe?.inputs?.some(isOneOfLoomInput);
}

function getLoomSelectedInputOption(recipe, inp){
  if(!inp) return null;
  if(isOneOfLoomInput(inp)){
    const saved=loomSelectedInputKeys[recipe.id];
    if(saved){
      const opt=inp.oneOf.find(o=>o.key===saved);
      if(opt) return opt;
    }
    return pickLoomInputOption(inp, recipe.id)||inp.oneOf[0]||null;
  }
  return inp;
}

function loomMatLineForOption(opt){
  const def=getFabricItemDef(opt.key)
    ||getBotanyItemDef?.(opt.key)
    ||FIBER_DEFS?.[opt.key]
    ||THREAD_DEFS&&Object.values(THREAD_DEFS).find(t=>t.key===opt.key);
  return formatRecipeMatLine(def?.name||opt.key, opt.qty, loomItemStock(opt.key));
}

function loomSelectedInputStockLine(recipe){
  const inp=recipe.inputs[0];
  const opt=getLoomSelectedInputOption(recipe, inp);
  if(!opt) return 'No material selected';
  const stock=loomItemStock(opt.key);
  const stockCls=wbStockClass(stock>=opt.qty?1:0);
  return '<span class="wb-mat-pick-avail '+stockCls+'">'+loomMatLineForOption(opt)+'</span>';
}

function loomSelectedInputHasStock(recipe){
  const inp=recipe.inputs[0];
  const opt=getLoomSelectedInputOption(recipe, inp);
  if(!opt) return false;
  return loomItemStock(opt.key)>=(opt.qty||1);
}

function selectLoomInputOption(recipeKey, inputKey){
  loomSelectedInputKeys[recipeKey]=inputKey;
  renderLoomRecipePanel();
  renderLoomActivityButtons();
}

function migrateLoomRecipeKey(){
  if(loomRecipeKey==='bandage') loomRecipeKey='clean_bandage';
  if(!LOOM_RECIPES[loomRecipeKey]) loomRecipeKey='simple_cloth';
}

function migrateCleanBandageKey(){
  if(state._cleanBandageKeyMigrated) return;
  state._cleanBandageKeyMigrated=true;
  const cleanDef=getFabricItemDef('clean_bandage');
  const sootheDef=getFabricItemDef('soothing_bandage');
  ['inventory','storage'].forEach(storeName=>{
    const store=state[storeName];
    if(!store?.bandage) return;
    const item=store.bandage;
    const count=item.count||0;
    if(count<=0){ delete store.bandage; return; }
    const legacySoothing=/soothing/i.test(item.name||'');
    const targetKey=legacySoothing?'soothing_bandage':'clean_bandage';
    const def=legacySoothing?sootheDef:cleanDef;
    if(!store[targetKey]) store[targetKey]={ icon:def?.icon||item.icon, name:def?.name||item.name, count:0 };
    store[targetKey].count+=count;
    delete store.bandage;
  });
  if(loomRecipeKey==='bandage') loomRecipeKey='clean_bandage';
}

function loomItemStock(key){
  return itemCountBagAndStore(key);
}

function loomInputStockForOption(opt){
  return Math.floor(loomItemStock(opt.key)/(opt.qty||1));
}

function loomInputStockForInput(inp){
  if(isOneOfLoomInput(inp)){
    return inp.oneOf.reduce((sum,opt)=>sum+loomInputStockForOption(opt),0);
  }
  return Math.floor(loomItemStock(inp.key)/(inp.qty||1));
}

function pickLoomInputOption(inp, recipeId){
  if(isOneOfLoomInput(inp)){
    const saved=recipeId&&loomSelectedInputKeys[recipeId];
    if(saved){
      const opt=inp.oneOf.find(o=>o.key===saved);
      if(opt&&loomItemStock(opt.key)>=(opt.qty||1)) return opt;
      return null;
    }
    for(const opt of inp.oneOf){
      if(loomInputStockForOption(opt)>0) return opt;
    }
    return null;
  }
  if(loomItemStock(inp.key)>=(inp.qty||1)) return inp;
  return null;
}

function loomInputStockLine(inp){
  if(isOneOfLoomInput(inp)){
    return inp.oneOf.map(opt=>loomMatLineForOption(opt)).join(' • ');
  }
  const def=getFabricItemDef(inp.key)||getBotanyItemDef(inp.key)||FIBER_DEFS?.[inp.key];
  return formatRecipeMatLine(def?.name||inp.key, inp.qty, loomItemStock(inp.key));
}

function loomRecipeStockLine(recipe){
  return recipe.inputs.map(inp=>loomInputStockLine(inp)).join(' • ');
}

function getLoomActiveInputOpt(recipe){
  const inp=recipe?.inputs?.[0];
  if(!inp) return null;
  return getLoomSelectedInputOption(recipe, inp);
}

function loomSuccessPct(recipe, inputOpt){
  return Math.round(calcLoomSuccess(recipe, inputOpt)*100);
}

function loomSuccessPctLabel(recipe, inputOpt){
  if(recipeHasLoomMaterialChoice(recipe)&&!inputOpt){
    const inp=recipe.inputs[0];
    let min=100, max=0;
    inp.oneOf.forEach(opt=>{
      const pct=loomSuccessPct(recipe, opt);
      min=Math.min(min, pct);
      max=Math.max(max, pct);
    });
    if(min===max) return min+'% success';
    return min+'–'+max+'% success';
  }
  return loomSuccessPct(recipe, inputOpt)+'% success';
}

function loomRecipeLevelBadge(recipe){
  return plotAddLevelBadge('tailoring', Number(state.skills.tailoring?.level)||1, recipe.requiredTailoringLevel||1, recipe.requiredTailoringLevel||1);
}

function loomRecipeXpPreview(recipe){
  const opt=getLoomActiveInputOpt(recipe);
  const pct=loomSuccessPct(recipe, opt);
  const lvl=Number(state.skills.tailoring?.level)||1;
  return '<span class="wb-xp-line">Success: +'+recipe.xpSuccess+' Tailoring • Fail: +'+recipe.xpFail+' Tailoring</span>'
    +'<span class="wb-xp-line">'+pct+'% success at Tailoring Lvl '+lvl+'</span>';
}

function loomInputBagConsumption(recipe){
  let fromBag=0;
  for(const inp of recipe.inputs){
    const opt=pickLoomInputOption(inp, recipe.id);
    if(!opt) return null;
    const need=opt.qty||1;
    const inBag=state.inventory[opt.key]?.count||0;
    fromBag+=Math.min(inBag, need);
  }
  return fromBag;
}

function canStoreLoomResult(recipe){
  const fromBag=loomInputBagConsumption(recipe);
  if(fromBag==null) return false;
  return invTotal()-fromBag+1<=INV_CAP;
}

function loomRecipeBlockReason(recipe){
  if(!recipe) return { type:'unknown' };
  if(recipe.lockedOnWonkyLoom) return { type:'locked', message:LOOM_LINEN_LOCKED_MSG };
  const lvl=Number(state.skills.tailoring?.level)||1;
  if(lvl<(recipe.requiredTailoringLevel||1)) return { type:'level', required:recipe.requiredTailoringLevel||1 };
  for(const inp of recipe.inputs){
    if(!pickLoomInputOption(inp, recipe.id)) return { type:'input', inp };
  }
  if(!canStoreLoomResult(recipe)) return { type:'bag' };
  return null;
}

function loomRecipeBlockMessage(reason){
  if(!reason) return '';
  if(reason.type==='input'||reason.type==='level') return '';
  if(reason.type==='locked') return reason.message||LOOM_LINEN_LOCKED_MSG;
  if(reason.type==='bag') return 'Bag full — make space before weaving';
  return '';
}

function loomRecipePickerStockLine(recipe){
  if(recipe.lockedOnWonkyLoom) return LOOM_LINEN_LOCKED_MSG;
  const successLine=loomSuccessPctLabel(recipe);
  if(recipeHasLoomMaterialChoice(recipe)) return 'options available • '+successLine;
  const inp=recipe.inputs[0];
  const opt=getLoomSelectedInputOption(recipe, inp);
  if(!opt) return successLine;
  return loomMatLineForOption(opt)+' • '+successLine;
}

function renderLoomRecipePickerList(){
  return LOOM_RECIPE_SECTIONS.map(section=>{
    const rows=section.keys.map(key=>{
      const r=getLoomRecipe(key);
      if(!r) return '';
      const rowBlock=loomRecipeBlockReason(r);
      const locked=rowBlock?.type==='locked';
      const selCls=loomRecipeKey===key?' selected':'';
      const unavailCls=(!locked&&canWeaveLoomRecipe(key))?'':' unavail';
      const clickAttr=locked?'':' onclick="selectLoomRecipe(\''+key+'\')"';
      const stockLine=loomRecipePickerStockLine(r);
      return '<div class="wb-mat-option'+selCls+unavailCls+'"'+clickAttr+'>'
        +'<span class="wb-mat-icon">'+r.icon+'</span>'
        +'<span class="wb-mat-info">'
        +plotAddItemTitleRow(r.label, loomRecipeLevelBadge(r))
        +'<span class="wb-mat-stock'+(locked?'':' '+wbStockClass(canWeaveLoomRecipe(key)?1:0))+'"'
        +(locked?' style="color:rgba(255,110,110,0.92)"':'')
        +'>'+stockLine+'</span>'
        +'</span></div>';
    }).join('');
    if(!rows) return '';
    return '<div class="sw-tier-label">'+section.label+'</div>'+rows;
  }).join('');
}

function renderLoomOutputRow(recipe){
  const el=document.getElementById('loom-output-row');
  if(!el) return;
  el.hidden=false;
  const opt=getLoomActiveInputOpt(recipe);
  const pct=loomSuccessPct(recipe, opt);
  let body=loomRecipePickerOpen?renderLoomRecipePickerList():'';
  el.innerHTML='<div class="store-items">'
    +'<div class="store-items-title">MAKING</div>'
    +'<div class="wb-log-pick wb-log-pick-collapsed'+(loomRecipePickerOpen?' selected':'')+'" onclick="toggleLoomRecipePicker()">'
    +'<span class="wb-mat-icon">'+recipe.icon+'</span>'
    +'<div class="wb-mat-pick-body">'
    +'<span class="plot-add-item-title-row"><span class="plot-add-item-title">'+recipe.label+'</span>'
    +loomRecipeLevelBadge(recipe)+'</span>'
    +(loomRecipePickerOpen?'':'<span class="wb-mat-pick-name" style="font-size:11px;color:var(--ui-text-dim)">'+pct+'% success</span>')
    +'</div>'
    +'<span class="wb-log-pick-chevron">'+(loomRecipePickerOpen?'▴':'▾')+'</span>'
    +'</div>'
    +body
    +'</div>';
}

function renderLoomMaterialPanel(recipe){
  const inp=recipe.inputs[0];
  if(!inp) return '';
  if(isOneOfLoomInput(inp)){
    return inp.oneOf.map(opt=>{
      const stock=loomItemStock(opt.key);
      const hasEnough=stock>=(opt.qty||1);
      const selected=loomSelectedInputKeys[recipe.id]===opt.key
        ||(!loomSelectedInputKeys[recipe.id]&&getLoomSelectedInputOption(recipe, inp)?.key===opt.key);
      return '<div class="wb-mat-option'+(selected?' selected':'')+(hasEnough?'':' unavail')+'" onclick="selectLoomInputOption(\''+recipe.id+'\',\''+opt.key+'\')">'
        +'<span class="wb-mat-icon">'+loomInputOptionIcon(opt)+'</span>'
        +'<span class="wb-mat-info">'
        +'<span class="wb-mat-name">'+loomInputOptionLabel(opt)+'</span>'
        +'<span class="wb-mat-stock '+wbStockClass(hasEnough?1:0)+'">'+loomMatLineForOption(opt)+' • '+loomSuccessPct(recipe, opt)+'% success</span>'
        +'</span></div>';
    }).join('');
  }
  const opt=getLoomSelectedInputOption(recipe, inp);
  const inputIcon=opt?loomInputOptionIcon(opt):recipe.icon;
  const hasStock=opt?loomItemStock(opt.key)>=(opt.qty||1):false;
  return '<div class="wb-log-pick wb-log-pick-collapsed static'+(hasStock?'':' unavail')+'">'
    +'<span class="wb-mat-icon">'+inputIcon+'</span>'
    +'<div class="wb-mat-pick-body">'+loomSelectedInputStockLine(recipe)
    +'<span class="wb-mat-pick-name" style="font-size:11px;color:var(--ui-text-dim)">'+loomSuccessPct(recipe, opt)+'% success</span>'
    +'</div>'
    +'</div>';
}

function rollLoomFailLoss(maxQty){
  const max=Math.max(1, maxQty||1);
  return 1+Math.floor(Math.random()*max);
}

function loomSnagFailMessage(opt, lost, maxQty){
  const name=loomInputMaterialName(opt);
  if(lost>=maxQty){
    return 'Thread is everywhere, it\'s better to just start over. '+lost+' '+name+' lost.';
  }
  if(lost===1){
    return 'The loom snags. '+lost+' '+name+' lost.';
  }
  if(lost>=Math.ceil(maxQty*0.6)){
    return 'A hopeless tangle. '+lost+' '+name+' lost.';
  }
  return 'The wonky loom snags. '+lost+' '+name+' lost.';
}

function consumeLoomMaterial(key, qty){
  for(let i=0;i<qty;i++){
    if(!consumeOneFromBagOrStore(key)) return false;
  }
  return true;
}

function canWeaveLoomRecipe(recipeKey){
  const recipe=getLoomRecipe(recipeKey);
  if(!recipe) return false;
  return !loomRecipeBlockReason(recipe);
}

function consumeLoomInput(inp, recipeId, qty){
  const opt=pickLoomInputOption(inp, recipeId);
  if(!opt) return { ok:false };
  const take=qty!=null?qty:(opt.qty||1);
  if(!consumeLoomMaterial(opt.key, take)) return { ok:false };
  return { ok:true, key:opt.key, opt, qty:take };
}

function doLoomWeaveAttempt(recipeKey){
  const key=recipeKey||loomRecipeKey;
  const recipe=getLoomRecipe(key);
  if(!recipe) return { ok:false };
  const block=loomRecipeBlockReason(recipe);
  if(block) return { ok:false, block };
  const inp=recipe.inputs[0];
  const picked=pickLoomInputOption(inp, recipe.id);
  if(!picked) return { ok:false, block:{ type:'input' } };
  const rate=calcLoomSuccess(recipe, picked);
  const success=Math.random()<rate;
  const needQty=picked.qty||1;
  if(success){
    const invBefore=invTotal();
    if(!consumeLoomMaterial(picked.key, needQty)){
      showToast('Could not take ingredients.');
      return { ok:false };
    }
    const out=getFabricItemDef(recipe.outputKey);
    invAddDirect(out.key,out.icon,out.name,1,{ pickupBaseline:invBefore });
    grantXP('tailoring',recipe.xpSuccess,null,{ deferSync:loomProcess.running, keepActivities:true });
    addActivityLog('loom-log',out.icon+' '+out.name+' woven! +'+recipe.xpSuccess+' Tailoring','success');
    if(!loomProcess.running) showToast(out.icon+' '+out.name+' woven!');
  }else{
    const lost=rollLoomFailLoss(needQty);
    if(!consumeLoomMaterial(picked.key, lost)){
      showToast('Could not take ingredients.');
      return { ok:false };
    }
    const snagMsg=loomSnagFailMessage(picked, lost, needQty);
    grantXP('tailoring',recipe.xpFail,null,{ deferSync:loomProcess.running, keepActivities:true });
    addActivityLog('loom-log',snagMsg+' +'+recipe.xpFail+' Tailoring ('+Math.round(rate*100)+'% was the odds)','fail');
    if(!loomProcess.running) showToast(snagMsg);
  }
  if(!loomProcess.running) syncUI();
  return { ok:true, success };
}

let loomWeaveActivity=null;

function getLoomWeaveActivity(){
  if(loomWeaveActivity) return loomWeaveActivity;
  loomWeaveActivity=createTimedActivity({
    type:'loom',
    state:loomProcess,
    label:'Weaving',
    canContinue:()=>canWeaveLoomRecipe(loomRecipeKey),
    cannotStartMsg:'Nothing to weave right now.',
    outOfResourcesMsg:'Out of ingredients.',
    onPrepare:()=>migrateLoomRecipeKey(),
    onAttempt:()=>{
      const result=doLoomWeaveAttempt();
      if(result.block){
        showToast(loomRecipeBlockMessage(result.block)||'Cannot weave that yet.');
        return false;
      }
      return result.ok!==false;
    },
    onRefresh:()=>{ if(currentScreen==='loom-screen') renderLoomScreen(); },
  });
  return loomWeaveActivity;
}

function weaveOnce(){
  stopOtherActivities(null);
  migrateLoomRecipeKey();
  const result=doLoomWeaveAttempt();
  if(result.block) showToast(loomRecipeBlockMessage(result.block)||'Cannot weave that yet.');
  if(currentScreen==='loom-screen') renderLoomScreen();
  syncUI();
}

function weaveContinuous(){
  getLoomWeaveActivity().startContinuous();
}

function stopLoomWeaving(fromActivitySwitch){
  getLoomWeaveActivity().stop(fromActivitySwitch);
}

function renderLoomRecipePanel(){
  migrateLoomRecipeKey();
  const el=document.getElementById('loom-recipe-list');
  const matSection=document.getElementById('loom-material-section');
  if(!el) return;
  const recipe=getLoomRecipe(loomRecipeKey)||getLoomRecipe('simple_cloth');
  if(!recipe) return;
  const block=loomRecipeBlockReason(recipe);
  const blockMsg=loomRecipeBlockMessage(block);

  renderLoomOutputRow(recipe);

  if(matSection) matSection.hidden=!!loomRecipePickerOpen;

  if(!loomRecipePickerOpen){
    el.innerHTML=renderLoomMaterialPanel(recipe)
      +(blockMsg?'<span class="wb-mat-pick-name" style="display:block;margin-top:6px;font-size:11px;color:rgba(255,110,110,0.92)">'+blockMsg+'</span>':'');
  }else{
    el.innerHTML='';
  }

  const xpEl=document.getElementById('loom-xp-preview');
  if(xpEl){
    let html=loomRecipeXpPreview(recipe);
    if(blockMsg) html+='<span class="wb-xp-line">'+blockMsg+'</span>';
    xpEl.innerHTML=html;
  }
}

function renderLoomActivityButtons(){
  const btnEl=document.getElementById('loom-buttons');
  const status=document.getElementById('loom-status');
  if(!btnEl) return;
  const recipe=getLoomRecipe(loomRecipeKey)||getLoomRecipe('simple_cloth');
  const can=recipe&&canWeaveLoomRecipe(recipe.id);
  const block=recipe?loomRecipeBlockReason(recipe):null;
  if(status){
    if(loomProcess.running) status.textContent='Weaving…';
    else{
      const msg=loomRecipeBlockMessage(block);
      status.textContent=msg||'Turn thread and fiber into fabric';
    }
    status.classList.toggle('idle',!loomProcess.running);
  }
  if(loomProcess.running){
    renderOnceContinuousButtons({
      btnEl,
      running:true,
      stopOnclick:'stopLoomWeaving()',
      stopLabel:'⛔ STOP WEAVING',
    });
    return;
  }
  const needSpace=block?.type==='bag';
  renderOnceContinuousButtons({
    btnEl,
    running:false,
    can,
    onceLabel:'1 WEAVE',
    onceOnclick:'weaveOnce()',
    continuousOnclick:'weaveContinuous()',
    noticeHtml:needSpace?'<div class="wb-cost-notice">Bag full — make space before weaving.</div>':'',
  });
}

function renderLoomScreen(){
  migrateLoomRecipeKey();
  updateActivitySkillPill('loom', 'tailoring');
  const subEl=document.getElementById('loom-subtitle');
  if(subEl) subEl.textContent='Tailoring skill • weave thread and fiber';
  renderLoomRecipePanel();
  renderLoomActivityButtons();
  updateLoomCellQuickAction();
}

function updateLoomCellQuickAction(){
  document.querySelectorAll('.int-cell[data-int-key="wonky_loom"]').forEach(cell=>{
    const btn=cell.querySelector('.int-quick-action-btn');
    if(btn) btn.textContent=loomProcess.running?'stop':'weave fabric';
  });
}

getLoomWeaveActivity();
