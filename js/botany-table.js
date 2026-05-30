/* Hearthstead — apothecary / botany table */
'use strict';

function buildApothecaryUtilityMenuItem(x,y){
  const def=INTERIOR_ROOM_DEFS.apothecary_table;
  if(!def) return '';
  const stock=itemCountBagAndStore(APOTHECARY_FURNITURE_KEY);
  const hasStock=stock>0;
  const drops=hasStock
    ?(stock===1?'1 available — ready to place':formatAvailableCount(stock)+' — ready to place')
    :'Craft one at the workbench first';
  const cls='plot-add-item '+(hasStock?'structure-unlocked':'structure-locked below-rec is-disabled');
  return '<button type="button" class="'+cls+'"'+(hasStock?'':' disabled')+(hasStock?' onclick="placeInteriorApothecaryTable('+x+','+y+')"':'')+'>'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'+def.name
    +'<span class="plot-add-item-drops">'+drops+'</span></span></button>';
}

function placeInteriorApothecaryTable(x,y){
  const def=INTERIOR_ROOM_DEFS.apothecary_table;
  if(!def){ closeInteriorBuildMenu(); return; }
  if(!apothecaryTableInStock()){
    showToast('Craft an Apothecary Table at the workbench first.');
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
  if(!consumeOneFromBagOrStore(APOTHECARY_FURNITURE_KEY)){
    showToast('Could not take Apothecary Table.');
    closeInteriorBuildMenu();
    return;
  }
  state.interior.cells[ck]='apothecary_table';
  closeInteriorBuildMenu();
  renderInteriorGrid();
  syncUI();
  scheduleSaveGame();
  showToast(def.icon+' '+def.name+' built.');
}

function migrateApothecaryTable(){
  if(state.lastWorkbenchRecipe==='desk') state.lastWorkbenchRecipe='apothecary_table';
  if(state.craftProgress?.desk){
    state.craftProgress.apothecary_table=state.craftProgress.desk;
    delete state.craftProgress.desk;
  }
  if(!state.interior?.cells) return;
  Object.keys(state.interior.cells).forEach(k=>{
    const key=state.interior.cells[k];
    if(key==='desk'||key==='furniture:desk'||key==='furniture:apothecary_table'){
      state.interior.cells[k]='apothecary_table';
    }
  });
}

let apothOverlayCloser=null;
let activeApothOverlayCell=null;
let apothecaryTab='identify';
let apothecaryProcessKey='aloe_gel';
let apothecaryProcessPickerOpen=false;

function closeApothecaryOverlay(){
  if(activeApothOverlayCell){
    activeApothOverlayCell.classList.remove('plot-activity-menu-ready');
    activeApothOverlayCell=null;
  }
  if(apothOverlayCloser){ document.removeEventListener('pointerdown',apothOverlayCloser,true); apothOverlayCloser=null; }
}

function isApothecaryOverlayOpen(){
  return !!activeApothOverlayCell?.classList.contains('plot-activity-menu-ready');
}

function openApothecaryOverlayForCell(cell){
  if(!cell) return;
  closeApothecaryOverlay();
  cell.classList.add('plot-activity-menu-ready');
  activeApothOverlayCell=cell;
  if(apothOverlayCloser) document.removeEventListener('pointerdown',apothOverlayCloser,true);
  apothOverlayCloser=function(e){
    if(activeApothOverlayCell?.contains(e.target)) return;
    closeApothecaryOverlay();
    e.preventDefault();
    e.stopPropagation();
  };
  setTimeout(()=>document.addEventListener('pointerdown',apothOverlayCloser,true),80);
}

function toggleApothecaryOverlayForCell(cell, event){
  if(intSuppressClick) return;
  if(event?.target?.closest?.('.plot-menu-btn')||event?.target?.closest?.('.int-quick-action-btn')) return;
  if(activeApothOverlayCell===cell&&isApothecaryOverlayOpen()) closeApothecaryOverlay();
  else openApothecaryOverlayForCell(cell);
}

function apothQuickTap(event){
  event.stopPropagation();
  closeApothecaryOverlay();
  if(apothecaryTab==='process') processSelectedBotanyRecipe();
  else identifyOneHerb();
}

function apothMenuTap(event){
  event.stopPropagation();
  closeApothecaryOverlay();
  openBotanyTableScreen();
}

function openBotanyTableScreen(){
  showScreen('botany-table-screen');
  lastHome='interior-screen';
  renderApothecaryScreen();
}

function closeBotanyTableScreen(){
  closeApothecaryOverlay();
  showScreen('interior-screen');
  lastHome='interior-screen';
  syncUI();
}

function setApothecaryTab(tab){
  if(tab!=='identify'&&tab!=='process') return;
  apothecaryTab=tab;
  apothecaryProcessPickerOpen=false;
  renderApothecaryScreen();
}

function selectApothecaryProcessRecipe(key){
  if(!BOTANY_APOTHECARY_RECIPES[key]) return;
  if(key!==apothecaryProcessKey&&apothProcess.running) stopApothecaryProcessing();
  apothecaryProcessKey=key;
  apothecaryProcessPickerOpen=false;
  renderApothecaryScreen();
}

function migrateApothecaryProcessKey(){
  if(apothecaryProcessKey==='crush_mint'||apothecaryProcessKey==='crush_sage') apothecaryProcessKey='crush_herb';
  if(apothecaryProcessKey==='bandage') apothecaryProcessKey='soothing_bandage';
  if(!BOTANY_APOTHECARY_RECIPES[apothecaryProcessKey]) apothecaryProcessKey='aloe_gel';
}

function getApothecaryActivitySkillKey(){
  if(apothecaryTab!=='process') return 'botany';
  const recipe=getBotanyApothecaryRecipe(apothecaryProcessKey);
  if(isCrushApothecaryRecipe(recipe)) return recipe.affinitySkill||'earth';
  return 'botany';
}

function getEarthLevel(){
  return Number(state.skills.earth?.level)||1;
}

function apothecaryRecipeLevelBadge(recipe){
  if(isCrushApothecaryRecipe(recipe)){
    return plotAddLevelBadge('earth', getEarthLevel(), 1, 1);
  }
  return plotAddLevelBadge('botany', getBotanyLevel(), recipe.requiredBotanyLevel||1, recipe.requiredBotanyLevel||1);
}

function botanyInputStockForInput(inp){
  const qty=inp.qty||1;
  if(isAnyOfBotanyInput(inp)){
    return botanyInputKeys(inp).reduce((sum,key)=>sum+botanyInputStock(key),0);
  }
  return botanyInputStock(inp.key);
}

function botanyInputLineHasEnough(key, qty){
  const def=getBotanyItemDef(key);
  const stock=botanyInputStock(key);
  if(def?.unobtainable&&stock<qty) return false;
  return stock>=qty;
}

function botanyInputLineText(key, qty){
  const def=getBotanyItemDef(key);
  const stock=botanyInputStock(key);
  const unobtainable=!!(def?.unobtainable&&stock<(qty||1));
  return formatRecipeMatLine(def?.name||key, qty, stock, { unobtainable });
}

function botanyInputStockLineHtml(inp, lineClass){
  const qty=inp.qty||1;
  if(isAnyOfBotanyInput(inp)){
    return botanyInputKeys(inp).map(key=>{
      const stock=botanyInputStock(key);
      return '<span class="'+lineClass+' wb-mat-pick-line '+wbStockClass(stock, qty)+'">'+botanyInputLineText(key, qty)+'</span>';
    }).join('');
  }
  const stock=botanyInputStock(inp.key);
  return '<span class="'+lineClass+' wb-mat-pick-line '+wbStockClass(stock, qty)+'">'+botanyInputLineText(inp.key, qty)+'</span>';
}

function botanyRecipeInputLinesHtml(recipe, lineClass){
  return recipe.inputs.map(inp=>botanyInputStockLineHtml(inp, lineClass)).join('');
}

function botanyProcessRecipeRewardLine(recipe){
  if(isCrushApothecaryRecipe(recipe)){
    return '+'+(recipe.affinityXp||0)+' Earth • Mint or Sage';
  }
  const parts=['+'+recipe.xp+' Botany'];
  if(recipe.tailoringXp) parts.push('+'+recipe.tailoringXp+' Tailoring');
  return parts.join(' • ');
}

function botanyProcessRecipeSubline(recipe){
  const block=botanyRecipeBlockReason(recipe);
  if(block) return botanyRecipeBlockMessage(block);
  return botanyProcessRecipeRewardLine(recipe);
}

function apothecaryRecipeXpPreview(recipe){
  if(isCrushApothecaryRecipe(recipe)){
    return 'Crush: +'+(recipe.affinityXp||0)+' Earth affinity';
  }
  let line='Process: +'+recipe.xp+' Botany';
  if(recipe.tailoringXp) line+=' • +'+recipe.tailoringXp+' Tailoring';
  return line;
}

function apothecaryProcessXpLogLine(recipe){
  let line='+'+recipe.xp+' Botany';
  if(recipe.tailoringXp) line+=' • +'+recipe.tailoringXp+' Tailoring';
  return line;
}

function botanyRecipeUiBlockMessage(block){
  if(!block||block.type==='level') return '';
  return botanyRecipeBlockMessage(block);
}

function basicHerbsInStock(){
  return itemCountBagAndStore('basic_herbs');
}

function getBotanyLevel(){
  return Number(state.skills.botany?.level)||1;
}

function botanyInputStock(key){
  return itemCountBagAndStore(key);
}

function toggleApothecaryProcessPicker(){
  apothecaryProcessPickerOpen=!apothecaryProcessPickerOpen;
  renderApothecaryProcessPanel();
  renderApothecaryActivityButtons();
}

function botanyRecipeLevelOk(recipe){
  if(isCrushApothecaryRecipe(recipe)) return true;
  return getBotanyLevel()>=(recipe.requiredBotanyLevel||1);
}

function botanyRecipeMissingInput(recipe){
  for(const inp of recipe.inputs){
    if(isAnyOfBotanyInput(inp)){
      if(botanyInputStockForInput(inp)<(inp.qty||1)) return inp;
    }else if(botanyInputStock(inp.key)<(inp.qty||1)) return inp;
  }
  return null;
}

function pickAnyOfBotanyInputKey(inp){
  const available=botanyInputKeys(inp).filter(key=>botanyInputStock(key)>=1);
  if(!available.length) return null;
  return available[Math.floor(Math.random()*available.length)];
}

function consumeApothecaryInput(inp){
  const qty=inp.qty||1;
  if(isAnyOfBotanyInput(inp)){
    let consumedKey=null;
    for(let i=0;i<qty;i++){
      const key=pickAnyOfBotanyInputKey(inp);
      if(!key||!consumeOneFromBagOrStore(key)) return { ok:false };
      consumedKey=key;
    }
    return { ok:true, consumedKey };
  }
  for(let i=0;i<qty;i++){
    if(!consumeOneFromBagOrStore(inp.key)) return { ok:false };
  }
  return { ok:true, consumedKey:inp.key };
}

function botanyRecipeBlockReason(recipe){
  if(!recipe) return { type:'unknown' };
  if(!botanyRecipeLevelOk(recipe)){
    return { type:'level', required:recipe.requiredBotanyLevel||1 };
  }
  const missing=botanyRecipeMissingInput(recipe);
  if(missing){
    const def=getBotanyItemDef(missing.key);
    return { type:'input', input:missing, def };
  }
  if(!isCrushApothecaryRecipe(recipe)&&invTotal()>=getInvCap()) return { type:'bag' };
  return null;
}

function botanyRecipeBlockMessage(reason){
  if(!reason) return '';
  if(reason.type==='level') return 'Need Botany Lv '+reason.required;
  if(reason.type==='input'){
    if(reason.input?.anyOf?.length) return 'Need mint or sage available';
    if(reason.def?.unobtainable) return 'Need '+reason.def.name+' • not obtainable yet';
    return 'Need '+((reason.def?.name)||reason.input.key)+' available';
  }
  if(reason.type==='bag') return 'Bag full — make space before processing';
  return '';
}

function canIdentifyHerb(){
  if(basicHerbsInStock()<1) return false;
  if(invTotal()>=getInvCap()) return false;
  return true;
}

function canProcessBotanyRecipe(recipeKey){
  const recipe=getBotanyApothecaryRecipe(recipeKey);
  if(!recipe) return false;
  return !botanyRecipeBlockReason(recipe);
}

function tryCrushEarthShardDrop(chance){
  const pct=chance??BOTANY_CRUSH_EARTH_SHARD_CHANCE;
  if(Math.random()>=pct) return false;
  if(!state.pockets) state.pockets={ fire:0, water:0, earth:0, air:0, magic:0 };
  state.pockets.earth=(state.pockets.earth||0)+1;
  const m=SHARD_META.earth;
  if(!state._seenShard){
    state._seenShard=true;
    showFoundBanner('POCKET FIND!', m.icon,
      'An elemental shard — tiny enough to live in your pockets. It uses no bag space. You\'ll gather these while training skills, for magic later.',
      'GOT IT', ()=>{ if(openPanel==='inv') renderInvPanel(); syncUI(); });
  }else{
    showToast(m.icon+' Something glinted in the mortar — an earth shard!');
  }
  if(openPanel==='inv') renderInvPanel();
  return true;
}

function identifyOneHerb(){
  stopOtherActivities(null);
  if(basicHerbsInStock()<1){
    showToast('No basic herbs available.');
    if(currentScreen==='botany-table-screen') renderApothecaryScreen();
    return {ok:false};
  }
  const invBefore=invTotal();
  if(!consumeOneFromBagOrStore('basic_herbs')){
    showToast('Could not take basic herbs.');
    return {ok:false};
  }
  const herbKey=rollIdentifiedHerbKey();
  const herb=getHerbDef(herbKey);
  if(!herb){
    if(!state.storage.basic_herbs) state.storage.basic_herbs={icon:'🌿',name:'Basic Herbs',count:0};
    state.storage.basic_herbs.count++;
    return {ok:false};
  }
  if(invTotal()>=getInvCap()){
    if(!state.storage.basic_herbs) state.storage.basic_herbs={icon:'🌿',name:'Basic Herbs',count:0};
    state.storage.basic_herbs.count++;
    showToast('Bag full — make space before identifying herbs.');
    if(currentScreen==='botany-table-screen') renderApothecaryScreen();
    return {ok:false,returned:true};
  }
  invAddDirect(herb.key,herb.icon,herb.name,1,{ pickupBaseline:invBefore });
  grantXP('botany',BOTANY_IDENTIFY_XP,null);
  addActivityLog('botany-log',herb.icon+' Identified as '+herb.name+'! +'+BOTANY_IDENTIFY_XP+' Botany','success');
  showToast(herb.icon+' '+herb.name+' identified!');
  if(currentScreen==='botany-table-screen') renderApothecaryScreen();
  syncUI();
  return {ok:true,herbKey};
}

function doApothecaryProcessAttempt(recipeKey){
  const key=recipeKey||apothecaryProcessKey;
  const recipe=getBotanyApothecaryRecipe(key);
  if(!recipe) return {ok:false};
  const block=botanyRecipeBlockReason(recipe);
  if(block) return {ok:false, block};
  const invBefore=invTotal();
  let consumedHerbKey=null;
  for(const inp of recipe.inputs){
    const consumed=consumeApothecaryInput(inp);
    if(!consumed.ok){
      showToast('Could not take ingredients.');
      return {ok:false};
    }
    if(consumed.consumedKey) consumedHerbKey=consumed.consumedKey;
  }
  if(isCrushApothecaryRecipe(recipe)){
    const herb=getBotanyItemDef(consumedHerbKey)||getBotanyItemDef(recipe.inputs[0]?.anyOf?.[0]);
    const skill=recipe.affinitySkill||'earth';
    const xp=recipe.affinityXp||0;
    grantXP(skill, xp, null, { skipShardDrop:true, deferSync:apothProcess.running, keepActivities:true });
    flashSkillPill(skill);
    const shard=tryCrushEarthShardDrop(recipe.earthShardChance);
    const skillName=SKILL_META[skill]?.name||'Earth';
    addActivityLog('botany-log',(herb?.icon||'🌿')+' '+(herb?.name||'Herb')+' crushed! +'+xp+' '+skillName,'success');
    if(!apothProcess.running) showToast((herb?.icon||'🌿')+' '+(herb?.name||'Herb')+' crushed. +'+xp+' '+skillName);
    if(!apothProcess.running) syncUI();
    return {ok:true, shard};
  }
  const out=getBotanyItemDef(recipe.outputKey);
  invAddDirect(out.key,out.icon,out.name,1,{ pickupBaseline:invBefore });
  grantXP('botany',recipe.xp,null,{ deferSync:apothProcess.running, keepActivities:true });
  if(recipe.tailoringXp){
    grantXP('tailoring',recipe.tailoringXp,null,{ deferSync:apothProcess.running, keepActivities:true });
  }
  const xpMsg=apothecaryProcessXpLogLine(recipe);
  addActivityLog('botany-log',out.icon+' '+out.name+' prepared! '+xpMsg,'success');
  if(!apothProcess.running) showToast(out.icon+' '+out.name+' crafted! '+xpMsg);
  if(!apothProcess.running) syncUI();
  return {ok:true};
}

let apothecaryProcessActivity=null;

function getApothecaryProcessActivity(){
  if(apothecaryProcessActivity) return apothecaryProcessActivity;
  apothecaryProcessActivity=createTimedActivity({
    type:'apothecary',
    state:apothProcess,
    label:'Processing',
    canContinue:()=>canProcessBotanyRecipe(apothecaryProcessKey),
    cannotStartMsg:'Nothing to process right now.',
    outOfResourcesMsg:'Out of ingredients.',
    onPrepare:()=>migrateApothecaryProcessKey(),
    onAttempt:()=>{
      const result=doApothecaryProcessAttempt();
      if(result.block){
        showToast(botanyRecipeBlockMessage(result.block)||'Cannot process that recipe yet.');
        return false;
      }
      return result.ok!==false;
    },
    onRefresh:()=>{ if(currentScreen==='botany-table-screen') renderApothecaryScreen(); },
  });
  return apothecaryProcessActivity;
}

function processOnce(){
  stopOtherActivities(null);
  migrateApothecaryProcessKey();
  const result=doApothecaryProcessAttempt();
  if(result.block){
    showToast(botanyRecipeBlockMessage(result.block)||'Cannot process that recipe yet.');
  }
  if(currentScreen==='botany-table-screen') renderApothecaryScreen();
  syncUI();
}

function processContinuous(){
  getApothecaryProcessActivity().startContinuous();
}

function stopApothecaryProcessing(fromActivitySwitch){
  getApothecaryProcessActivity().stop(fromActivitySwitch);
}

function processSelectedBotanyRecipe(){
  processOnce();
}

function renderApothecaryIdentifyPanel(){
  const stock=basicHerbsInStock();
  const stockCls=wbStockClass(stock, 1);
  const el=document.getElementById('apoth-identify-stock');
  if(el){
    el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed'+(stock<1?' unavail':'')+'">'
      +'<span class="wb-mat-icon">🌿</span>'
      +'<div class="wb-mat-pick-body">'
      +'<span class="wb-mat-pick-avail '+stockCls+'">'+formatRecipeMatLine('Basic Herbs', 1, stock)+'</span>'
      +'<span class="wb-mat-pick-name" style="font-size:11px;color:var(--ui-text-dim)">Each herb becomes aloe, mint, or sage (equal chance)</span>'
      +'</div></div>';
  }
  const xpEl=document.getElementById('apoth-identify-xp');
  if(xpEl) xpEl.innerHTML='<span class="wb-xp-line">Identify: +'+BOTANY_IDENTIFY_XP+' Botany per herb</span>';
}

function renderApothecaryProcessPanel(){
  migrateApothecaryProcessKey();
  const el=document.getElementById('apoth-process-recipe-list');
  if(!el) return;
  const recipe=getBotanyApothecaryRecipe(apothecaryProcessKey)||getBotanyApothecaryRecipe('aloe_gel');
  if(!recipe) return;
  const can=canProcessBotanyRecipe(recipe.id);
  const lvlBadge=apothecaryRecipeLevelBadge(recipe);
  const inputLines=botanyRecipeInputLinesHtml(recipe, 'wb-mat-pick-avail');

  if(!apothecaryProcessPickerOpen){
    el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed'+(can?'':' unavail')+'" onclick="toggleApothecaryProcessPicker()">'
      +'<span class="wb-mat-icon">'+recipe.icon+'</span>'
      +'<div class="wb-mat-pick-body">'
      +plotAddItemTitleRow(recipe.label, lvlBadge)
      +inputLines
      +'<span class="wb-mat-pick-name" style="font-size:11px;color:var(--ui-text-dim)">'+botanyProcessRecipeRewardLine(recipe)+'</span>'
      +'</div>'
      +'<span class="wb-log-pick-chevron">▾</span>'
      +'</div>';
  }else{
    el.innerHTML=BOTANY_APOTHECARY_SECTIONS.map(section=>{
      const rows=section.keys.map(key=>{
        const r=getBotanyApothecaryRecipe(key);
        if(!r) return '';
        const recipeCan=canProcessBotanyRecipe(key);
        const selCls=apothecaryProcessKey===key?' selected':'';
        const unavailCls=recipeCan?'':' unavail';
        return '<div class="wb-mat-option'+selCls+unavailCls+'" onclick="'+(apothecaryProcessKey===key?'toggleApothecaryProcessPicker()':'selectApothecaryProcessRecipe(\''+key+'\')')+'">'
          +'<span class="wb-mat-icon">'+r.icon+'</span>'
          +'<span class="wb-mat-info">'
          +plotAddItemTitleRow(r.label, apothecaryRecipeLevelBadge(r))
          +botanyRecipeInputLinesHtml(r, 'wb-mat-stock')
          +'<span class="wb-mat-stock" style="color:var(--ui-text-dim)">'+botanyProcessRecipeRewardLine(r)+'</span>'
          +'</span></div>';
      }).join('');
      if(!rows) return '';
      return '<div class="sw-tier-label">'+section.label+'</div>'+rows;
    }).join('');
  }

  const xpEl=document.getElementById('apoth-process-xp');
  if(xpEl){
    xpEl.innerHTML='<span class="wb-xp-line">'+apothecaryRecipeXpPreview(recipe)+'</span>';
  }
}

function renderApothecaryActivityButtons(){
  const btnEl=document.getElementById('botany-buttons');
  const status=document.getElementById('botany-status');
  if(!btnEl) return;
  if(apothecaryTab==='identify'){
    const can=canIdentifyHerb();
    const bagFull=basicHerbsInStock()>0&&invTotal()>=getInvCap();
    if(status){
      status.textContent=basicHerbsInStock()>0?'Ready to identify herbs':'Need basic herbs available';
      status.classList.toggle('idle',basicHerbsInStock()<1);
    }
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn once" '+(!can?'disabled':'')+' onclick="identifyOneHerb()">IDENTIFY HERB</button>'
      +'</div>'
      +(bagFull?'<div class="wb-cost-notice">Bag full — make space before identifying.</div>':'')
      +'</div>';
    return;
  }
  const recipe=getBotanyApothecaryRecipe(apothecaryProcessKey)||getBotanyApothecaryRecipe('aloe_gel');
  const can=recipe&&canProcessBotanyRecipe(recipe.id);
  const block=recipe?botanyRecipeBlockReason(recipe):null;
  const isCrush=recipe&&isCrushApothecaryRecipe(recipe);
  if(status){
    if(apothProcess.running){
      status.textContent='Processing…';
      status.classList.add('idle');
      status.classList.remove('blocked');
    }else{
      const uiBlock=block?botanyRecipeUiBlockMessage(block):'';
      if(uiBlock){
        status.textContent=uiBlock;
        status.classList.remove('idle');
        status.classList.add('blocked');
      }else{
        status.textContent=isCrush?'Grind mint or sage for earth affinity':'Prepare herbs and remedies at the table';
        status.classList.add('idle');
        status.classList.remove('blocked');
      }
    }
  }
  if(apothProcess.running){
    renderOnceContinuousButtons({
      btnEl,
      running:true,
      stopOnclick:'stopApothecaryProcessing()',
      stopLabel:'⛔ STOP PROCESSING',
    });
    return;
  }
  renderOnceContinuousButtons({
    btnEl,
    running:false,
    can,
    onceLabel:'1 PROCESS',
    onceOnclick:'processOnce()',
    continuousOnclick:'processContinuous()',
  });
}

function renderApothecaryScreen(){
  migrateApothecaryProcessKey();
  updateActivitySkillPill('botany', getApothecaryActivitySkillKey());
  const subEl=document.getElementById('botany-subtitle');
  if(subEl){
    if(apothecaryTab==='identify'){
      subEl.textContent='Sort available unidentified herbs';
    }else{
      const recipe=getBotanyApothecaryRecipe(apothecaryProcessKey);
      subEl.textContent=isCrushApothecaryRecipe(recipe)
        ?'Crush mint or sage for earth affinity'
        :'Combine ingredients into remedies and preparations';
    }
  }
  ['identify','process'].forEach(tab=>{
    const btn=document.getElementById('apoth-tab-'+tab);
    if(btn) btn.classList.toggle('active', apothecaryTab===tab);
    const panel=document.getElementById('apoth-panel-'+tab);
    if(panel) panel.hidden=apothecaryTab!==tab;
  });
  if(apothecaryTab==='identify') renderApothecaryIdentifyPanel();
  else renderApothecaryProcessPanel();
  renderApothecaryActivityButtons();
  updateApothecaryCellQuickAction();
}

function updateApothecaryCellQuickAction(){
  let quick='identify herb';
  if(apothecaryTab==='process'){
    const recipe=getBotanyApothecaryRecipe(apothecaryProcessKey);
    quick=isCrushApothecaryRecipe(recipe)?'crush herb':'process herb';
  }
  document.querySelectorAll('.int-cell[data-int-key="apothecary_table"]').forEach(cell=>{
    const btn=cell.querySelector('.int-quick-action-btn');
    if(btn) btn.textContent=quick;
  });
}

function renderBotanyTable(){
  renderApothecaryScreen();
}

getApothecaryProcessActivity();
