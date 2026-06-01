/* Hearthstead — wonky loom */
'use strict';

function buildWonkyLoomUtilityMenuItem(x,y){
  const def=INTERIOR_ROOM_DEFS.wonky_loom;
  if(!def) return '';
  const stock=itemCountBagAndStore(WONKY_LOOM_FURNITURE_KEY);
  const hasStock=stock>0;
  const tagHtml=typeof furnitureUtilityTaglineHtml==='function'?furnitureUtilityTaglineHtml(WONKY_LOOM_FURNITURE_KEY):'';
  const drops=(hasStock
    ?formatRecipeMatLine(def?.name||'Loom', 1, stock)+' — ready to place'
    :'Craft one at the workbench first')
    +(tagHtml?' · '+tagHtml:'');
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
let loomMaterialPickerOpen=false;
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
  if(key!==loomRecipeKey&&loomProcess.running) stopLoomWeaving();
  loomRecipeKey=key;
  loomRecipePickerOpen=false;
  loomMaterialPickerOpen=false;
  renderLoomScreen();
}

function toggleLoomRecipePicker(){
  loomRecipePickerOpen=!loomRecipePickerOpen;
  if(loomRecipePickerOpen) loomMaterialPickerOpen=false;
  renderLoomRecipePanel();
  renderLoomActivityButtons();
}

function toggleLoomMaterialPicker(){
  loomMaterialPickerOpen=!loomMaterialPickerOpen;
  renderLoomRecipePanel();
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
  const key=opt?.key;
  const qty=Math.max(1, opt?.qty||1);
  return formatRecipeMatLine(
    (typeof getCraftMaterialDef==='function'?getCraftMaterialDef(key)?.name:null)||key,
    qty,
    loomItemStock(key)
  );
}

function selectLoomInputOption(recipeKey, inputKey){
  if(loomSelectedInputKeys[recipeKey]===inputKey&&loomMaterialPickerOpen){
    loomMaterialPickerOpen=false;
  }else{
    loomSelectedInputKeys[recipeKey]=inputKey;
    loomMaterialPickerOpen=false;
  }
  renderLoomRecipePanel();
  renderLoomActivityButtons();
}

function loomMaterialHasAll(recipe){
  return recipe.inputs.every(input=>{
    const opt=pickLoomInputOption(input, recipe.id);
    return opt&&loomItemStock(opt.key)>=(opt.qty||1);
  });
}

function renderLoomMaterialCollapsedSummary(recipe){
  const inp=recipe.inputs[0];
  const hasAll=loomMaterialHasAll(recipe);
  const block=loomRecipeBlockReason(recipe);
  const blockMsg=loomRecipeBlockMessage(block);
  const opt=getLoomActiveInputOpt(recipe);
  const pct=loomSuccessPct(recipe, opt);
  let icon=recipe.icon;
  if(inp){
    const sel=getLoomSelectedInputOption(recipe, inp);
    if(sel) icon=loomInputOptionIcon(sel);
  }
  let bodyHtml;
  if(recipeHasLoomMaterialChoice(recipe)){
    const sel=getLoomSelectedInputOption(recipe, inp);
    bodyHtml=sel
      ?recipeMatStockLineHtml(sel.key, sel.qty||1, loomItemStock(sel.key), 'wb-mat-pick-avail')
      :'<span class="wb-mat-pick-avail missing wb-mat-pick-line">Pick a material</span>';
  }else{
    bodyHtml=loomRecipeInputLinesHtml(recipe, 'wb-mat-pick-avail');
  }
  return '<div class="wb-log-pick wb-log-pick-collapsed'+(hasAll?' ready':(blockMsg?' unavail':''))+'" onclick="toggleLoomMaterialPicker()">'
    +'<span class="wb-mat-icon">'+icon+'</span>'
    +'<div class="wb-mat-pick-body">'
    +bodyHtml
    +wbMatSuccessLineHtml(pct+'% success')
    +(blockMsg?'<span class="wb-mat-pick-name" style="font-size:11px;color:rgba(255,110,110,0.92)">'+blockMsg+'</span>':'')
    +'</div>'
    +'<span class="wb-log-pick-chevron">▾</span>'
    +'</div>';
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
  const def=typeof getCraftMaterialDef==='function'?getCraftMaterialDef(inp.key):null;
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
  return plotAddLevelBadge('crafting', Number(state.skills.crafting?.level)||1, recipe.requiredCraftingLevel||1, recipe.requiredCraftingLevel||1);
}

function loomRecipeXpPreview(recipe){
  const opt=getLoomActiveInputOpt(recipe);
  const pct=loomSuccessPct(recipe, opt);
  const lvl=Number(state.skills.crafting?.level)||1;
  return '<span class="wb-xp-line">Success: +'+recipe.xpSuccess+' Crafting • Fail: +'+recipe.xpFail+' Crafting</span>'
    +'<span class="wb-xp-line">'+pct+'% success at Crafting Lvl '+lvl+'</span>';
}

function loomInputBagConsumption(recipe){
  let fromBag=0;
  for(const inp of recipe.inputs){
    const opt=pickLoomInputOption(inp, recipe.id);
    if(!opt) return null;
    const need=opt.qty||1;
    const inBag=invCount(opt.key);
    fromBag+=Math.min(inBag, need);
  }
  return fromBag;
}

function canStoreLoomResult(recipe){
  const fromBag=loomInputBagConsumption(recipe);
  if(fromBag==null) return false;
  return invTotal()-fromBag+1<=getInvCap();
}

function loomRecipeBlockReason(recipe){
  if(!recipe) return { type:'unknown' };
  if(recipe.lockedOnWonkyLoom) return { type:'locked', message:LOOM_LINEN_LOCKED_MSG };
  const lvl=Number(state.skills.crafting?.level)||1;
  if(lvl<(recipe.requiredCraftingLevel||1)) return { type:'level', required:recipe.requiredCraftingLevel||1 };
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

function loomRecipeInputLinesHtml(recipe, lineClass){
  return recipe.inputs.map(inp=>{
    if(isOneOfLoomInput(inp)){
      return inp.oneOf.map(opt=>recipeMatStockLineHtml(opt.key, opt.qty||1, loomItemStock(opt.key), lineClass)).join('');
    }
    const qty=inp.qty||1;
    return recipeMatStockLineHtml(inp.key, qty, loomItemStock(inp.key), lineClass);
  }).join('');
}

function loomRecipePickerBodyHtml(recipe, locked){
  if(locked){
    return '<span class="wb-mat-stock" style="color:rgba(255,110,110,0.92)">'+LOOM_LINEN_LOCKED_MSG+'</span>';
  }
  if(recipeHasLoomMaterialChoice(recipe)){
    return '<span class="wb-mat-stock">options available</span>'
      +wbMatSuccessLineHtml(loomSuccessPctLabel(recipe));
  }
  const lines=recipe.inputs.flatMap(inp=>{
    if(isOneOfLoomInput(inp)){
      return inp.oneOf.map(opt=>recipeMatStockLineHtml(opt.key, opt.qty||1, loomItemStock(opt.key), 'wb-mat-stock'));
    }
    return [recipeMatStockLineHtml(inp.key, inp.qty||1, loomItemStock(inp.key), 'wb-mat-stock')];
  });
  return lines.join('')+wbMatSuccessLineHtml(loomSuccessPctLabel(recipe));
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
      const clickAttr=locked?'':(' onclick="'+(loomRecipeKey===key?'toggleLoomRecipePicker()':'selectLoomRecipe(\''+key+'\')')+'"');
      const bodyHtml=loomRecipePickerBodyHtml(r, locked);
      return '<div class="wb-mat-option'+selCls+unavailCls+'"'+clickAttr+'>'
        +'<span class="wb-mat-icon">'+r.icon+'</span>'
        +'<span class="wb-mat-info">'
        +plotAddItemTitleRow(r.label, loomRecipeLevelBadge(r))
        +'<div class="wb-mat-stock-lines">'+bodyHtml+'</div>'
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
  const block=loomRecipeBlockReason(recipe);
  const blockMsg=loomRecipeBlockMessage(block);
  const collapsedHtml='<div class="wb-log-pick wb-log-pick-collapsed'+(!canWeaveLoomRecipe(recipe.id)&&blockMsg?' unavail':'')+'" onclick="toggleLoomRecipePicker()">'
    +'<span class="wb-mat-icon">'+recipe.icon+'</span>'
    +'<div class="wb-mat-pick-body">'
    +'<span class="plot-add-item-title-row"><span class="plot-add-item-title">'+recipe.label+'</span>'
    +loomRecipeLevelBadge(recipe)+'</span>'
    +wbMatSuccessLineHtml(pct+'% success')
    +(blockMsg?'<span class="wb-mat-pick-name" style="font-size:11px;color:rgba(255,110,110,0.92)">'+blockMsg+'</span>':'')
    +'</div>'
    +'<span class="wb-log-pick-chevron">▾</span>'
    +'</div>';
  el.innerHTML=renderRecipeSectionPicker({
    title:'MAKING',
    open:loomRecipePickerOpen,
    collapsedHtml,
    openHtml:renderLoomRecipePickerList(),
  });
}

function renderLoomMaterialPanel(recipe){
  const inp=recipe.inputs[0];
  if(!inp) return '';
  const opt0=getLoomActiveInputOpt(recipe);
  if(isOneOfLoomInput(inp)){
    return inp.oneOf.map(opt=>{
      const stock=loomItemStock(opt.key);
      const hasEnough=stock>=(opt.qty||1);
      const selected=loomSelectedInputKeys[recipe.id]===opt.key
        ||(!loomSelectedInputKeys[recipe.id]&&getLoomSelectedInputOption(recipe, inp)?.key===opt.key);
      const clickAction=selected
        ?'toggleLoomMaterialPicker()'
        :('selectLoomInputOption(\''+recipe.id+'\',\''+opt.key+'\')');
      return '<div class="wb-mat-option'+(selected?' selected':'')+(hasEnough?'':' unavail')+'" onclick="'+clickAction+'">'
        +'<span class="wb-mat-icon">'+loomInputOptionIcon(opt)+'</span>'
        +'<span class="wb-mat-info">'
        +'<span class="wb-mat-name">'+loomInputOptionLabel(opt)+'</span>'
        +recipeMatStockLineHtml(opt.key, opt.qty||1, stock, 'wb-mat-stock')
        +wbMatSuccessLineHtml(loomSuccessPct(recipe, opt)+'% success')
        +'</span></div>';
    }).join('');
  }
  return '<div class="wb-mat-pick-body" style="gap:4px">'
    +loomRecipeInputLinesHtml(recipe, 'wb-mat-pick-avail')
    +wbMatSuccessLineHtml(loomSuccessPct(recipe, opt0)+'% success')
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
    for(const input of recipe.inputs){
      const mat=pickLoomInputOption(input, recipe.id);
      if(!mat||!consumeLoomMaterial(mat.key, mat.qty||1)){
        showToast('Could not take ingredients.');
        return { ok:false };
      }
    }
    const out=getLoomOutputDef(recipe.outputKey);
    if(!out){
      showToast('Could not weave that output.');
      return { ok:false };
    }
    invAddDirect(out.key,out.icon,out.name,1,{ pickupBaseline:invBefore });
    grantXP('crafting',recipe.xpSuccess,null,{ deferSync:loomProcess.running, keepActivities:true });
    addActivityLog('loom-log',out.icon+' '+out.name+' woven! +'+recipe.xpSuccess+' Crafting','success');
    if(!loomProcess.running) showToast(out.icon+' '+out.name+' woven!');
  }else{
    const lost=rollLoomFailLoss(needQty);
    if(!consumeLoomMaterial(picked.key, lost)){
      showToast('Could not take ingredients.');
      return { ok:false };
    }
    const snagMsg=loomSnagFailMessage(picked, lost, needQty);
    grantXP('crafting',recipe.xpFail,null,{ deferSync:loomProcess.running, keepActivities:true });
    addActivityLog('loom-log',snagMsg+' +'+recipe.xpFail+' Crafting ('+Math.round(rate*100)+'% was the odds)','fail');
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
  const matEl=document.getElementById('loom-material-section');
  if(!matEl) return;
  const recipe=getLoomRecipe(loomRecipeKey)||getLoomRecipe('simple_cloth');
  if(!recipe) return;
  const block=loomRecipeBlockReason(recipe);
  const blockMsg=loomRecipeBlockMessage(block);

  renderLoomOutputRow(recipe);

  if(loomRecipePickerOpen){
    matEl.innerHTML='';
    matEl.hidden=true;
  }else{
    matEl.hidden=false;
    matEl.innerHTML=renderRecipeSectionPicker({
      title:'MATERIAL',
      open:loomMaterialPickerOpen,
      collapsedHtml:renderLoomMaterialCollapsedSummary(recipe),
      openHtml:renderLoomMaterialPanel(recipe)
        +(blockMsg?'<span class="wb-mat-pick-name" style="display:block;margin-top:6px;font-size:11px;color:rgba(255,110,110,0.92)">'+blockMsg+'</span>':''),
    });
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
  updateActivitySkillPill('loom', 'crafting');
  const subEl=document.getElementById('loom-subtitle');
  if(subEl) subEl.textContent='Crafting skill • weave thread and fiber';
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
