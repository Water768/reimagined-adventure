/* Hearthstead — workbench */
'use strict';

/* ═══════════════════════════════════════
   WORKBENCH
═══════════════════════════════════════ */

const craft={
  recipeKey:'chair',
  stage:0,
  complete:false,
  running:false,
  runTimer:null,
  selectedLog:'logs',
  selectedNail:'rusty',
  lockLogType:false,
  userPickedLog:false,
  upgradeShelfSlot:null,
  storeRoomId:null,
};

let wbLogPickerOpen=false;
let wbNailPickerOpen=false;
let wbFurniturePickerOpen=false;
const wbFurnitureTierCollapsed={ simple:true, hardwood:true, barn:true, artisan:true, mythical:true, journal:true };

// ── Furniture crafting data ──────────────────────────────────────────
function getCarpentryLevel(){
  return Number(state.skills.carpentry?.level)||1;
}

function getWoodModifier(logKey){
  return WOOD_MODIFIERS[logKey]??0;
}

function resolveAllowedWoods(spec){
  if(!spec) return WOOD_ALLOW.all;
  if(Array.isArray(spec)) return spec;
  return WOOD_ALLOW[spec]||WOOD_ALLOW.all;
}

function getListedWoodsForRecipe(recipe){
  if(!recipe) return WOOD_ALLOW.all;
  if(recipe.tier&&FURNITURE_TIER_WOODS[recipe.tier]) return FURNITURE_TIER_WOODS[recipe.tier].slice();
  return resolveAllowedWoods(recipe.allowedWoods);
}

function getAllowedWoodsForRecipe(recipe){
  const listed=getListedWoodsForRecipe(recipe);
  if(recipe?.tier==='mythical') return listed;
  if(listed.includes(FURNITURE_BONUS_WOOD)) return listed;
  return listed.concat(FURNITURE_BONUS_WOOD);
}

function formatTierWoodList(tier){
  const tierDef=FURNITURE_TIERS[tier];
  if(tierDef?.subtitle) return tierDef.subtitle;
  const keys=FURNITURE_TIER_WOODS[tier]||[];
  return keys.map(k=>LOG_TYPES[k]?.name||k).join(', ');
}

function formatFurnitureDetailLines(f){
  let line1=f.description||'';
  const tagKey=f.furnitureKey||f.id;
  const tagHtml=typeof furnitureUtilityTaglineHtml==='function'?furnitureUtilityTaglineHtml(tagKey):'';
  if(tagHtml) line1+=' · '+tagHtml;
  const line2=f.baseFurnitureChance+'% base success rate · '+formatTierWoodList(f.tier);
  return { line1, line2 };
}

function recipeUsesNails(recipe){
  return !!(recipe&&!recipe.skipNails&&(recipe.nailsPerAttempt==null||recipe.nailsPerAttempt>0));
}

function getRecipeLogsPerAttempt(recipe){
  if(recipe?.materialOnly) return 0;
  return Math.max(1, recipe?.logsPerAttempt||1);
}

function getRecipeLogKey(recipe){
  return recipe?.requiredLogKey||craft.selectedLog;
}

function consumeOneMaterialFromBagOrStore(key){
  if(invCount(key)>0){
    stackTake(state.inventory, key, 1);
    return true;
  }
  if(storageCount(key)>0){
    stackTake(state.storage, key, 1);
    return true;
  }
  return false;
}

function consumeRecipeLogsForAttempt(recipe){
  const logKey=getRecipeLogKey(recipe);
  const need=getRecipeLogsPerAttempt(recipe);
  for(let i=0;i<need;i++){
    if(!consumeOneMaterialFromBagOrStore(logKey)) return false;
  }
  return true;
}

function recipeExtraInputsMet(recipe){
  for(const inp of recipe?.extraInputs||[]){
    const need=Math.max(1, inp.qty||1);
    if(itemCountBagAndStore(inp.key)<need) return false;
  }
  return true;
}

function consumeRecipeExtraInputs(recipe){
  for(const inp of recipe?.extraInputs||[]){
    const need=Math.max(1, inp.qty||1);
    for(let i=0;i<need;i++){
      if(!consumeOneMaterialFromBagOrStore(inp.key)) return false;
    }
  }
  return true;
}

function wbNailStockLabel(count, infinite){
  if(infinite) return '∞';
  const cap=NAIL_SUCCESS_USE_MAX;
  return Math.max(0, count|0)+'/'+cap;
}

function plotAddStageBadge(stageNum, totalStages){
  const done=stageNum>=totalStages;
  return '<span class="plot-add-level-badge'+(done?' ok':'')+'">'
    +'<span class="plot-add-level-text">Stage: '+stageNum+'/'+totalStages+'</span>'
    +'</span>';
}

function renderFurnitureProjectCard(f, opts){
  const carpLvl=getCarpentryLevel();
  const craftLvl=Number(state.skills.crafting?.level)||1;
  const craftReq=f.requiredCraftingLevel||f.requiredTailoringLevel;
  const locked=carpLvl<f.requiredCarpentryLevel
    ||(craftReq&&craftLvl<craftReq);
  const selected=!!opts.selected;
  const stageNum=opts.stageNum!=null?opts.stageNum:0;
  const detail=formatFurnitureDetailLines(f);
  const lvlBadge=plotAddLevelBadge('carpentry', carpLvl, f.requiredCarpentryLevel, f.requiredCarpentryLevel);
  const stageBadge=!locked&&f.stages?plotAddStageBadge(stageNum, f.stages):'';
  const badge=lvlBadge+stageBadge;
  const onclick=opts.onclick||'';
  const clickAttr=onclick&&!locked?' onclick="'+onclick+'"':'';
  const title=(locked?'🔒':f.icon)+' '+f.name;
  return '<div class="fp-recipe-card wb-furn-project-card'+(selected?' selected':'')+(locked?' locked below-rec':'')+'"'+clickAttr+'>'
    +'<div class="fp-recipe-row">'+plotAddItemTitleRow(title, badge)+'</div>'
    +'<div class="wb-furn-card-sub">'+detail.line1+'</div>'
    +'<div class="wb-furn-card-sub">'+detail.line2+'</div>'
    +'</div>';
}

function isFurnitureRecipe(recipeKey){
  const r=RECIPES[recipeKey];
  return !!(r&&r.tier&&!r.autoInstallShelfSlot&&!r.outputToolKey);
}

function isStageWorkbenchRecipe(recipeKey){
  const r=RECIPES[recipeKey];
  return !!(r&&r.tier&&!r.autoInstallShelfSlot);
}

function isWorkbenchToolRecipe(recipeKey){
  return !!(typeof WORKBENCH_TOOL_CRAFTS!=='undefined'&&WORKBENCH_TOOL_CRAFTS[recipeKey]);
}

function getWorkbenchCraftDef(recipeKey){
  return FURNITURE_CRAFTS[recipeKey]||WORKBENCH_TOOL_CRAFTS?.[recipeKey]||null;
}

function meetsCarpentryRequirement(recipe){
  if(!recipe?.requiredCarpentryLevel) return true;
  return getCarpentryLevel()>=recipe.requiredCarpentryLevel;
}

function meetsCraftingRequirement(recipe){
  const req=recipe?.requiredCraftingLevel||recipe?.requiredTailoringLevel;
  if(!req) return true;
  return (Number(state.skills.crafting?.level)||1)>=req;
}

function isWoodAllowedForRecipe(recipeKey, logKey){
  const recipe=RECIPES[recipeKey];
  if(!recipe||recipe.autoInstallShelfSlot) return true;
  return getAllowedWoodsForRecipe(recipe).includes(logKey);
}

function getFurnitureSkillBonusPct(recipe){
  const unlock=recipe?.requiredCarpentryLevel||1;
  return Math.max(0, getCarpentryLevel()-unlock)*2;
}

function getFurnitureNailBonusPct(nailKey){
  const recipe=RECIPES[craft.recipeKey];
  if(recipe&&!recipeUsesNails(recipe)) return 0;
  const key=nailKey!=null?nailKey:getEffectiveCraftNailKey();
  return Math.round((NAIL_TYPES[key]?.bonus||0)*100);
}

function getUncappedCraftChancePct(nailKey){
  const recipe=RECIPES[craft.recipeKey];
  if(!recipe) return 0;
  const logKey=craft.selectedLog;
  if(isStageWorkbenchRecipe(craft.recipeKey)){
    const base=recipe.baseFurnitureChance??10;
    const wood=getWoodModifier(logKey);
    const skill=getFurnitureSkillBonusPct(recipe);
    const nail=getFurnitureNailBonusPct(nailKey);
    return base+wood+skill+nail;
  }
  const logBonus=LOG_TYPES[logKey]?.bonus||0;
  const nailBonus=NAIL_TYPES[nailKey]?.bonus||0;
  return Math.round((recipe.baseChance+logBonus+nailBonus)*100);
}

function wouldExceedMaxCraftChance(nailKey){
  return getUncappedCraftChancePct(nailKey)>100;
}

/** When selected nails would waste bonus above 100%, use free rusty nails instead. */
function getEffectiveCraftNailKey(){
  const selected=craft.selectedNail||'rusty';
  if(NAIL_TYPES[selected]?.infinite) return selected;
  if(wouldExceedMaxCraftChance(selected)) return 'rusty';
  return selected;
}

function craftUsesRustyNailFailsafe(){
  const selected=craft.selectedNail||'rusty';
  return selected!=='rusty'&&!NAIL_TYPES[selected]?.infinite&&wouldExceedMaxCraftChance(selected);
}

function consumeCraftNails(amount){
  const nailKey=getEffectiveCraftNailKey();
  const nailType=NAIL_TYPES[nailKey];
  if(!nailType||nailType.infinite) return { ok:true, used:0, nailType };
  const need=Math.max(0, amount|0);
  if(need<1) return { ok:true, used:0, nailType };
  if(!consumeManyFromBagOrStore(nailKey, need)){
    showToast('Not enough '+nailType.name+'.');
    return { ok:false, used:0, nailType };
  }
  return { ok:true, used:need, nailType };
}

function applyCraftNailUsage(progressed){
  const recipe=RECIPES[craft.recipeKey];
  if(recipe&&!recipeUsesNails(recipe)){
    return { ok:true, used:0, discarded:false, nailType:null };
  }
  const nailKey=getEffectiveCraftNailKey();
  const nailType=NAIL_TYPES[nailKey];
  if(!nailType||nailType.infinite){
    return { ok:true, used:0, discarded:false, nailType };
  }
  if(progressed){
    const rolled=NAIL_SUCCESS_USE_MIN+Math.floor(Math.random()*(NAIL_SUCCESS_USE_MAX-NAIL_SUCCESS_USE_MIN+1));
    const stock=nailTypeCount(nailKey);
    const amount=Math.min(rolled, stock);
    const result=consumeCraftNails(amount);
    return { ok:result.ok, used:result.used, discarded:false, nailType:result.nailType };
  }
  if(Math.random()>=NAIL_FAIL_DISCARD_CHANCE){
    return { ok:true, used:0, discarded:false, nailType };
  }
  if(nailTypeCount(nailKey)<1){
    return { ok:true, used:0, discarded:false, nailType };
  }
  const result=consumeCraftNails(1);
  return { ok:result.ok, used:result.used, discarded:result.used>0, nailType:result.nailType };
}

function formatCraftNailUsageNote(used, nailType){
  if(!used||!nailType||nailType.infinite) return '';
  return ' · −'+used+' '+nailType.name;
}

function selectedCraftNailAvailable(){
  const recipe=RECIPES[craft.recipeKey];
  if(recipe&&!recipeUsesNails(recipe)) return true;
  const selected=craft.selectedNail||'rusty';
  if(NAIL_TYPES[selected]?.infinite) return true;
  if(craftUsesRustyNailFailsafe()) return true;
  return nailTypeCount(selected)>0;
}

function getFurnitureChanceBreakdown(recipe, logKey, nailKey){
  const base=recipe.baseFurnitureChance??10;
  const wood=getWoodModifier(logKey);
  const skill=getFurnitureSkillBonusPct(recipe);
  const nail=getFurnitureNailBonusPct(nailKey);
  const total=Math.min(100, Math.max(0, base+wood+skill+nail));
  return { base, wood, skill, nail, total };
}

function calcFurnitureChancePct(recipe, logKey, nailKey){
  return getFurnitureChanceBreakdown(recipe, logKey, nailKey).total;
}

function getBestAvailableLogKeyForRecipe(recipeKey){
  const recipe=RECIPES[recipeKey];
  if(!isStageWorkbenchRecipe(recipeKey)) return getBestAvailableLogKey();
  if(recipe?.requiredLogKey) return recipe.requiredLogKey;
  const listed=getListedWoodsForRecipe(recipe);
  const allowed=getAllowedWoodsForRecipe(recipe);
  for(let i=LOG_TIER_ORDER.length-1;i>=0;i--){
    const k=LOG_TIER_ORDER[i];
    if(listed.includes(k)&&logTypeCount(k)>0) return k;
  }
  if(allowed.includes(FURNITURE_BONUS_WOOD)&&logTypeCount(FURNITURE_BONUS_WOOD)>0) return FURNITURE_BONUS_WOOD;
  return listed[0]||'logs';
}

function validateFurnitureCraft(recipeKey, logKey){
  const recipe=RECIPES[recipeKey];
  if(!recipe||recipe.autoInstallShelfSlot) return { ok:true };
  if(!recipe.materialOnly&&!meetsCarpentryRequirement(recipe)){
    return { ok:false, msg:'Need Carpentry Lv '+recipe.requiredCarpentryLevel+'.' };
  }
  if(!meetsCraftingRequirement(recipe)){
    const req=recipe.requiredCraftingLevel||recipe.requiredTailoringLevel;
    return { ok:false, msg:'Need Crafting Lv '+req+'.' };
  }
  if(!recipe.materialOnly){
  const useLog=recipe.requiredLogKey||logKey;
  if(!isWoodAllowedForRecipe(recipeKey, useLog)){
    const woodName=LOG_TYPES[useLog]?.name||'wood';
    return { ok:false, msg:woodName+' cannot be used for '+recipe.name+'.' };
  }
  const needLogs=getRecipeLogsPerAttempt(recipe);
  if(itemCountBagAndStore(useLog)<needLogs){
    const woodName=LOG_TYPES[useLog]?.name||useLog;
    return { ok:false, msg:'Need '+needLogs+' '+woodName+(needLogs>1?'':'')+'.' };
  }
  }
  if(!recipeExtraInputsMet(recipe)){
    const inp=(recipe.extraInputs||[]).find(i=>itemCountBagAndStore(i.key)<Math.max(1,i.qty||1));
    const def=inp&&typeof getCraftMaterialDef==='function'?getCraftMaterialDef(inp.key):null;
    return { ok:false, msg:'Need '+(inp?.qty||1)+' '+(def?.name||inp?.key||'material')+'.' };
  }
  return { ok:true };
}

function logTypeCount(key){
  return itemCountBagAndStore(key);
}

function getBestAvailableLogKey(){
  for(let i = LOG_TIER_ORDER.length - 1; i >= 0; i--){
    const k = LOG_TIER_ORDER[i];
    if(logTypeCount(k) > 0) return k;
  }
  return null;
}

function getActiveShelfRequiredLogKey(){
  const slot = RECIPES[craft.recipeKey]?.autoInstallShelfSlot;
  if(!slot) return null;
  return getShelfTargetLogKey(slot, craft.storeRoomId);
}

function syncWorkbenchLogDefault(){
  if(craft.running && craft.lockLogType) return;
  const shelfLog = getActiveShelfRequiredLogKey();
  if(shelfLog){
    craft.selectedLog = shelfLog;
    return;
  }
  const recipe=RECIPES[craft.recipeKey];
  if(recipe?.requiredLogKey){
    craft.selectedLog=recipe.requiredLogKey;
    craft.userPickedLog=false;
    return;
  }
  const best = isStageWorkbenchRecipe(craft.recipeKey)
    ? getBestAvailableLogKeyForRecipe(craft.recipeKey)
    : getBestAvailableLogKey();
  if(!best){
    craft.selectedLog = craft.selectedLog || 'logs';
    return;
  }
  if(!craft.userPickedLog){
    craft.selectedLog = best;
  } else if(logTypeCount(craft.selectedLog) < 1){
    return;
  } else if(isStageWorkbenchRecipe(craft.recipeKey) && !isWoodAllowedForRecipe(craft.recipeKey, craft.selectedLog)){
    craft.selectedLog = best;
    craft.userPickedLog = false;
  }
}

function toggleWBFurniturePicker(){
  if(craft.running){ showToast('Stop crafting first.'); return; }
  wbFurniturePickerOpen=!wbFurniturePickerOpen;
  renderWBFurniturePicker();
}

function syncWBFurnitureTierForSelection(){
  const def=getWorkbenchCraftDef(craft.recipeKey);
  if(def?.tier) delete wbFurnitureTierCollapsed[def.tier];
}

function toggleWBFurnitureTier(tier){
  if(wbFurnitureTierCollapsed[tier]) delete wbFurnitureTierCollapsed[tier];
  else wbFurnitureTierCollapsed[tier]=true;
  renderWBFurniturePicker();
}

function toggleWBLogPicker(){
  wbLogPickerOpen=!wbLogPickerOpen;
  if(wbLogPickerOpen) wbNailPickerOpen=false;
  renderWBMaterials();
}

function toggleWBNailPicker(){
  if(!recipeUsesNails(RECIPES[craft.recipeKey])) return;
  wbNailPickerOpen=!wbNailPickerOpen;
  if(wbNailPickerOpen) wbLogPickerOpen=false;
  renderWBMaterials();
}

function closeWBMatsPickers(){
  wbLogPickerOpen=false;
  wbNailPickerOpen=false;
}

function wbStockClass(stock, needOrInfinite){
  if(needOrInfinite===true||needOrInfinite===Infinity) return stock>0?'ok':'missing';
  const need=typeof needOrInfinite==='number'&&needOrInfinite>0?needOrInfinite:1;
  const n=Number(stock)||0;
  if(n<=0) return 'missing';
  if(n>=need) return 'ok';
  const ratio=n/need;
  if(ratio>=0.75) return 'partial-75';
  if(ratio>=0.50) return 'partial-50';
  if(ratio>=0.25) return 'partial-25';
  return 'partial-low';
}

function recipeMatStockLineHtml(key, qty, stock, lineClass){
  const def=typeof getCraftMaterialDef==='function'?getCraftMaterialDef(key):null;
  const name=def?.name||key;
  const q=Math.max(1, qty||1);
  const cls=wbStockClass(stock, q);
  const lineClassName=lineClass||'wb-mat-pick-avail';
  return '<span class="'+lineClassName+' wb-mat-pick-line '+cls+'">'+formatRecipeMatLine(name, q, stock)+'</span>';
}

function wbMatSuccessLineHtml(text){
  return '<span class="wb-mat-pick-success">'+text+'</span>';
}

function wbAvailLabel(count, infinite){
  return formatStockRatio(count, 1, { infinite });
}

function nailTypeCount(key){
  return nailCount(key);
}

function getWBLogBonusLabel(){
  if(isStageWorkbenchRecipe(craft.recipeKey)){
    return '+'+getWoodModifier(craft.selectedLog)+'%';
  }
  return '+'+Math.round((LOG_TYPES[craft.selectedLog]?.bonus||0)*100)+'%';
}

function getWBNailBonusLabel(){
  const key=getEffectiveCraftNailKey();
  const b=NAIL_TYPES[key]?.bonus||0;
  return (b>=0?'+':'')+Math.round(b*100)+'%';
}

function renderWBCollapsedPick({icon, name, count, infinite, locked, canOpen, bonusTxt, onClick, availLabel}){
  const availCls=wbStockClass(infinite?1:count, infinite);
  const unavail=!infinite&&count<1;
  const clickAttr=canOpen&&onClick?' onclick="'+onClick+'"':'';
  const lockCls=locked&&!canOpen?' locked':'';
  const availText=availLabel!=null?availLabel:wbAvailLabel(infinite?0:count, infinite);
  return '<div class="wb-mat-pick-collapsed'+(unavail?' unavail':'')+lockCls+'"'+clickAttr+'>'
    +'<span class="wb-mat-icon">'+icon+'</span>'
    +'<span class="wb-mat-info">'
    +'<span class="wb-mat-name">'+name+'</span>'
    +'<span class="wb-mat-pick-avail '+availCls+'">'+availText+'</span>'
    +'</span>'
    +'<span class="wb-mat-bonus">'+bonusTxt+'</span>'
    +'</div>';
}

function renderWBStaticPick({icon, name, sub}){
  return '<div class="wb-mat-pick-collapsed static">'
    +'<span class="wb-mat-icon">'+icon+'</span>'
    +'<span class="wb-mat-info">'
    +'<span class="wb-mat-name">'+name+'</span>'
    +(sub?('<span class="wb-mat-stock">'+sub+'</span>'):'')
    +'</span>'
    +'</div>';
}

function renderWBMatListOption(t, opts){
  const count=opts.count;
  const infinite=!!opts.infinite;
  const disabled=!!opts.disabled;
  const unavail=disabled||(!infinite&&count===0);
  const selCls=opts.selected?' selected':'';
  const unavailCls=unavail?' unavail':'';
  const onclick=unavail?'':' onclick="'+opts.onSelect+'"';
  const bonusTxt=opts.bonusTxt||'';
  const inBag=opts.inBag||0;
  const inStore=opts.inStore||0;
  const availText=opts.availLabel!=null?opts.availLabel:wbAvailLabel(count,infinite);
  const tipHtml=(!infinite&&count>0&&!disabled)?'<span class="wb-mat-stock-tip">'+inBag+' bag · '+inStore+' storage</span>':'';
  const tipClass=(!infinite&&count>0&&!disabled)?' has-tip':'';
  return '<div class="wb-mat-option'+selCls+unavailCls+'"'+onclick+'>'
    +'<span class="wb-mat-icon">'+t.icon+'</span>'
    +'<span class="wb-mat-info">'
    +'<span class="wb-mat-name">'+t.name+'</span>'
    +'<span class="wb-mat-stock'+tipClass+' '+wbStockClass(count,infinite)+'">'+availText+'</span>'
    +tipHtml
    +'</span>'
    +(bonusTxt?'<span class="wb-mat-bonus">'+bonusTxt+'</span>':'')
    +'</div>';
}

function renderWBLogPickerPanel(){
  const el=document.getElementById('wb-log-picker');
  if(!el) return;
  if(!wbLogPickerOpen){
    el.classList.remove('open');
    el.innerHTML='';
    return;
  }
  el.classList.add('open');
  const shelfLog=getActiveShelfRequiredLogKey();
  const logLocked=!!shelfLog||(craft.running&&craft.lockLogType);
  const isFurn=isStageWorkbenchRecipe(craft.recipeKey);
  const listed=isFurn?getListedWoodsForRecipe(RECIPES[craft.recipeKey]):null;
  const logs=LOG_TIER_ORDER.filter(k=>!isFurn||listed.includes(k)).map(k=>LOG_TYPES[k]).filter(Boolean);
  const logsHtml=logs.map(t=>{
    const stock=logTypeCount(t.key);
    const bonusTxt=isFurn?('+'+getWoodModifier(t.key)+'%'):('+'+Math.round((t.bonus||0)*100)+'%');
    const inBag=invCount(t.key);
    const inStore=storageCount(t.key);
    return renderWBMatListOption(t,{
      count:stock, infinite:false,
      selected:craft.selectedLog===t.key,
      onSelect:'selectLog(\''+t.key+'\')',
      disabled:logLocked,
      bonusTxt,
      inBag, inStore,
    });
  }).join('');
  el.innerHTML='<div class="wb-mat-options">'+logsHtml+'</div>';
}

function renderWBNailPickerPanel(){
  const el=document.getElementById('wb-nail-picker');
  if(!el) return;
  const recipe=RECIPES[craft.recipeKey];
  if(recipe&&!recipeUsesNails(recipe)){
    el.classList.remove('open');
    el.innerHTML='';
    el.hidden=true;
    return;
  }
  el.hidden=false;
  if(!wbNailPickerOpen){
    el.classList.remove('open');
    el.innerHTML='';
    return;
  }
  el.classList.add('open');
  const nailsHtml=NAIL_PICKER_ORDER.map(key=>{
    const t=NAIL_TYPES[key];
    if(!t) return '';
    const inBag=invCount(t.key);
    const inStore=storageCount(t.key);
    const total=t.infinite?0:inBag+inStore;
    const bonusTxt=(t.bonus>=0?'+':'')+Math.round((t.bonus||0)*100)+'%';
    return renderWBMatListOption(t,{
      count:total, infinite:!!t.infinite,
      selected:craft.selectedNail===t.key,
      onSelect:'selectNail(\''+t.key+'\')',
      bonusTxt,
      inBag, inStore,
      availLabel:wbNailStockLabel(total, !!t.infinite),
    });
  }).join('');
  el.innerHTML='<div class="wb-mat-options">'+nailsHtml+'</div>';
}

function renderWBLogSummary(){
  syncWorkbenchLogDefault();
  const el=document.getElementById('wb-log-options');
  if(!el) return;
  const recipe=RECIPES[craft.recipeKey];
  const shelfLog=getActiveShelfRequiredLogKey();
  const logKey=getRecipeLogKey(recipe);
  const sel=LOG_TYPES[logKey]||LOG_TYPES.logs;
  const total=logTypeCount(logKey);
  const need=getRecipeLogsPerAttempt(recipe);
  const locked=!!shelfLog||!!recipe?.requiredLogKey||(craft.running&&craft.lockLogType);
  const reqSuffix=(shelfLog||recipe?.requiredLogKey)?' <span class="wb-mat-req '+wbStockClass(total, need)+'">(required)</span>':'';
  const nameSuffix=need>1?' · uses '+need:'';
  el.innerHTML=renderWBCollapsedPick({
    icon:sel.icon,
    name:sel.name+nameSuffix+reqSuffix,
    count:total,
    infinite:false,
    locked,
    canOpen:!locked,
    bonusTxt:getWBLogBonusLabel(),
    onClick:'toggleWBLogPicker()',
    availLabel:total+'/'+need,
  });
}

function renderWBExtraInputsSummary(){
  let el=document.getElementById('wb-extra-options');
  const parent=document.querySelector('#workbench-screen .wb-materials');
  if(!parent) return;
  if(!el){
    el=document.createElement('div');
    el.id='wb-extra-options';
    el.className='wb-mat-options';
    const nailRow=parent.querySelector('.wb-mat-row.nails');
    if(nailRow) parent.insertBefore(el, nailRow);
    else parent.appendChild(el);
  }
  const recipe=RECIPES[craft.recipeKey];
  const inputs=recipe?.extraInputs;
  if(!inputs?.length){
    el.innerHTML='';
    el.hidden=true;
    return;
  }
  el.hidden=false;
  el.innerHTML=inputs.map(inp=>{
    const def=typeof getCraftMaterialDef==='function'?getCraftMaterialDef(inp.key):null;
    const need=Math.max(1, inp.qty||1);
    const stock=itemCountBagAndStore(inp.key);
    return renderWBStaticPick({
      icon:def?.icon||'📦',
      name:(def?.name||inp.key)+' · uses '+need,
      sub:stock+'/'+need+' in bag or storage',
    });
  }).join('');
}

function renderWBNailSummary(){
  const el=document.getElementById('wb-nail-options');
  if(!el) return;
  const col=el.closest('.wb-mat-col');
  const recipe=RECIPES[craft.recipeKey];
  if(recipe&&!recipeUsesNails(recipe)){
    if(col) col.hidden=false;
    el.hidden=false;
    el.innerHTML=renderWBStaticPick({
      icon:'—',
      name:'None required',
      sub:'No nails for this project',
    });
    return;
  }
  if(col) col.hidden=false;
  el.hidden=false;
  const sel=NAIL_TYPES[craft.selectedNail]||NAIL_TYPES.rusty;
  const total=sel.infinite?0:nailTypeCount(craft.selectedNail);
  el.innerHTML=renderWBCollapsedPick({
    icon:sel.icon,
    name:sel.name,
    count:total,
    infinite:!!sel.infinite,
    locked:false,
    canOpen:true,
    bonusTxt:getWBNailBonusLabel(),
    onClick:'toggleWBNailPicker()',
    availLabel:wbNailStockLabel(total, !!sel.infinite),
  });
}

function getWBChanceInfo(){
  const recipe=RECIPES[craft.recipeKey];
  if(!recipe) return null;
  const nailKey=getEffectiveCraftNailKey();
  if(isStageWorkbenchRecipe(craft.recipeKey)){
    const breakdown=getFurnitureChanceBreakdown(recipe, craft.selectedLog, nailKey);
    const levelsAbove=Math.max(0, getCarpentryLevel()-recipe.requiredCarpentryLevel);
    return { isFurniture:true, breakdown, skill:breakdown.skill, total:breakdown.total, levelsAbove, failsafe:craftUsesRustyNailFailsafe() };
  }
  const total=Math.min(100, getUncappedCraftChancePct(nailKey));
  const logPct=Math.round((LOG_TYPES[craft.selectedLog]?.bonus||0)*100);
  const nailPct=Math.round((NAIL_TYPES[nailKey]?.bonus||0)*100);
  return { isFurniture:false, total, logPct, nailPct, skill:0, levelsAbove:0, failsafe:craftUsesRustyNailFailsafe() };
}

function renderWBSkillSummary(){
  const el=document.getElementById('wb-skill-summary');
  if(!el) return;
  const info=getWBChanceInfo();
  if(!info){
    el.innerHTML='';
    return;
  }
  if(info.isFurniture||isStageWorkbenchRecipe(craft.recipeKey)){
    el.innerHTML=renderWBStaticPick({
      icon:'🪚',
      name:'+'+info.skill+'%',
      sub:'2% per level',
    });
    return;
  }
  el.innerHTML=renderWBStaticPick({
    icon:'🪚',
    name:'+0%',
    sub:'2% per level',
  });
}

function renderWBFinalChance(){
  const el=document.getElementById('wb-chance-summary');
  if(!el) return;
  const info=getWBChanceInfo();
  if(!info){
    el.innerHTML='';
    return;
  }
  el.innerHTML=renderWBStaticPick({
    icon:'✨',
    name:info.total+'% success',
  });
}

function totalLogCount(){
  return Object.keys(LOG_TYPES).reduce((s,k)=>s+logTypeCount(k),0);
}

function calcChance() {
  const recipe = RECIPES[craft.recipeKey];
  if (!recipe) return 0;
  const nailKey=getEffectiveCraftNailKey();
  if (recipe.autoInstallShelfSlot) {
    const logBonus  = LOG_TYPES[craft.selectedLog]?.bonus  || 0;
    const nailBonus = NAIL_TYPES[nailKey]?.bonus || 0;
    return Math.min(1, Math.max(0.001, recipe.baseChance + logBonus + nailBonus));
  }
  return calcFurnitureChancePct(recipe, craft.selectedLog, nailKey) / 100;
}

function isShelfInstalled(slot, storeRoomId){
  return getShelfTier(slot, storeRoomId)>0;
}

function loadCraftState(recipeKey) {
  const recipe = RECIPES[recipeKey];
  if (!recipe) return;
  const slot = recipe.autoInstallShelfSlot;
  if (slot) {
    const roomId=craft.storeRoomId;
    const room=getStoreRoomById(roomId);
    if (!room) {
      craft.stage = 0;
      craft.complete = false;
      return;
    }
    repairShelfSlotState(room, slot);
    if (craft.upgradeShelfSlot === slot) {
      craft.stage = Math.min(room.shelfUpgradeStages[slot] || 0, recipe.stages);
    } else if (isShelfInstalled(slot, roomId)) {
      craft.stage = 0;
      craft.complete = false;
    } else {
      craft.stage = Math.min(room.shelfStages[slot] || 0, recipe.stages);
    }
    craft.complete = false;
  } else {
    if (!state.craftProgress) state.craftProgress = {};
    const saved = state.craftProgress[recipeKey] || { stage: 0, complete: false };
    craft.stage = saved.stage || 0;
    craft.complete = !!saved.complete;
  }
}

function saveCraftState() {
  const recipe = RECIPES[craft.recipeKey];
  if (!recipe || recipe.autoInstallShelfSlot) return;
  if (!state.craftProgress) state.craftProgress = {};
  state.craftProgress[craft.recipeKey] = { stage: craft.stage, complete: craft.complete };
}

function formatSkillXpTip(skillKey){
  const sk=state.skills[skillKey];
  if(!sk) return '';
  const left=Math.max(0, sk.xpToNext-sk.xp);
  const total=formatSkillXp(getTotalSkillXp(skillKey));
  return total+' xp · '+left+' to lvl '+(sk.level+1);
}

function syncFloatingSkillPillTip(pill){
  if(!pill||pill.hidden) return;
  const tip=pill.querySelector('.skill-pill-tip');
  if(!tip||!tip.textContent.trim()) return;
  const r=pill.getBoundingClientRect();
  tip.style.position='fixed';
  tip.style.top=(r.bottom+7)+'px';
  tip.style.right=(window.innerWidth-r.right)+'px';
  tip.style.left='auto';
  tip.style.bottom='auto';
  tip.style.zIndex='10000';
}

function clearFloatingSkillPillTip(pill){
  const tip=pill?.querySelector('.skill-pill-tip');
  if(!tip) return;
  tip.style.position='';
  tip.style.top='';
  tip.style.right='';
  tip.style.left='';
  tip.style.bottom='';
  tip.style.zIndex='';
}

function initSkillPillTips(){
  const root=document.getElementById('game-wrapper');
  if(!root||root.dataset.skillPillTipsInited) return;
  root.dataset.skillPillTipsInited='1';
  root.addEventListener('mouseover',(e)=>{
    const pill=e.target.closest('.stat-pill-skill');
    if(pill) syncFloatingSkillPillTip(pill);
  });
  root.addEventListener('mouseout',(e)=>{
    const pill=e.target.closest('.stat-pill-skill');
    if(pill&&!pill.contains(e.relatedTarget)) clearFloatingSkillPillTip(pill);
  });
  root.addEventListener('focusin',(e)=>{
    const pill=e.target.closest('.stat-pill-skill');
    if(pill) syncFloatingSkillPillTip(pill);
  });
  root.addEventListener('focusout',(e)=>{
    const pill=e.target.closest('.stat-pill-skill');
    if(pill&&!pill.contains(e.relatedTarget)) clearFloatingSkillPillTip(pill);
  });
}

function setContextSkillPillVisible(pill, visible){
  if(!pill) return;
  pill.hidden=!visible;
  if(!visible) clearFloatingSkillPillTip(pill);
}

function updateActivitySkillPill(prefix, skillKey) {
  const sk = state.skills[skillKey];
  const meta = SKILL_META[skillKey];
  const iconEl = document.getElementById(prefix + '-skill-icon');
  const lvlEl = document.getElementById(prefix + '-skill-lvl');
  const fillEl = document.getElementById(prefix + '-skill-fill');
  const tipEl = document.getElementById(prefix + '-skill-tip');
  const pillEl = document.getElementById(prefix + '-skill-pill');
  if (!sk || !meta) return;
  if (iconEl) iconEl.textContent = meta.icon;
  if (lvlEl) lvlEl.textContent = sk.level;
  if (fillEl) {
    const pct = Math.min((sk.xp / sk.xpToNext) * 100, 100);
    fillEl.style.height = pct + '%';
    fillEl.className = 'skill-pill-fill sk-' + skillKey;
  }
  const tip=formatSkillXpTip(skillKey);
  if (tipEl) tipEl.textContent = tip;
  if (pillEl) pillEl.setAttribute('aria-label', meta.name+' Lv '+sk.level+': '+tip);
  if(pillEl&&(pillEl.matches(':hover')||pillEl.matches(':focus-within'))) syncFloatingSkillPillTip(pillEl);
}

function updateWorkbenchSkillPill() {
  updateActivitySkillPill('wb', RECIPES[craft.recipeKey]?.skill || 'carpentry');
}

function openWorkbench() {
  const last=state.lastWorkbenchRecipe;
  const key=(last&&(FURNITURE_CRAFTS[last]||WORKBENCH_TOOL_CRAFTS?.[last]))?last:'chair';
  openWorkbenchForRecipe(key);
}

function openWorkbenchForRecipe(recipeKey, options) {
  const opts = options || {};
  migrateShelfTiers();
  const recipe = RECIPES[recipeKey];
  const slot = recipe?.autoInstallShelfSlot;
  if (slot) {
    const roomId=opts.storeRoomId||viewingStoreRoomId;
    if(!roomId){
      showToast('Open a Store Room menu to craft shelves.');
      return;
    }
    craft.storeRoomId=roomId;
    if (opts.upgrade) {
      if (!canUpgradeShelf(slot, roomId)) {
        showToast('This shelf cannot be upgraded further.');
        return;
      }
      craft.upgradeShelfSlot = slot;
    } else {
      craft.upgradeShelfSlot = null;
      if (isShelfInstalled(slot, roomId)) {
        showToast('Shelf slot '+slot+' is already installed in this room. Use Upgrade.');
        return;
      }
    }
  } else {
    craft.upgradeShelfSlot = null;
    craft.storeRoomId = null;
  }
  saveCraftState();
  craft.recipeKey = recipeKey;
  if(isStageWorkbenchRecipe(recipeKey)) state.lastWorkbenchRecipe=recipeKey;
  craft.userPickedLog = false;
  craft.lockLogType = false;
  closeWBMatsPickers();
  wbFurniturePickerOpen = false;
  loadCraftState(recipeKey);
  if (slot) {
    const reqLog = getShelfTargetLogKey(slot, craft.storeRoomId);
    if (reqLog) craft.selectedLog = reqLog;
  }
  showScreen('workbench-screen');
  renderWorkbench();
}

function openShelfUpgrade(slot) {
  if(!viewingStoreRoomId){ showToast('Open a Store Room first.'); return; }
  openWorkbenchForRecipe('shelf_'+slot, { upgrade: true, storeRoomId: viewingStoreRoomId });
}

function closeWorkbench() {
  craft.upgradeShelfSlot = null;
  const wasShelf=!!RECIPES[craft.recipeKey]?.autoInstallShelfSlot;
  const returnStoreId=craft.storeRoomId||viewingStoreRoomId;
  craft.storeRoomId = null;
  closeWBMatsPickers();
  wbFurniturePickerOpen = false;
  if (wasShelf && returnStoreId) {
    viewingStoreRoomId=returnStoreId;
    showScreen('storeroom-screen');
    renderStoreRoom();
    return;
  }
  showScreen('interior-screen');
  lastHome = 'interior-screen';
}

function getFurnitureProjectStage(recipeKey){
  const f=getWorkbenchCraftDef(recipeKey);
  if(!f) return 0;
  if(recipeKey===craft.recipeKey){
    return craft.complete?f.stages:craft.stage;
  }
  const saved=state.craftProgress?.[recipeKey];
  if(saved?.complete) return f.stages;
  return saved?.stage||0;
}

function renderWBFurniturePicker(){
  const el=document.getElementById('wb-furniture-picker');
  if(!el) return;
  const recipe=RECIPES[craft.recipeKey];
  if(recipe?.autoInstallShelfSlot){
    el.hidden=true;
    el.innerHTML='';
    return;
  }
  el.hidden=false;
  const cur=getWorkbenchCraftDef(craft.recipeKey)||FURNITURE_CRAFTS.chair;
  const stageNum=getFurnitureProjectStage(craft.recipeKey);

  let html='';
  if(!wbFurniturePickerOpen){
    html+=renderFurnitureProjectCard(cur, {
      selected:true,
      stageNum,
      onclick:'toggleWBFurniturePicker()',
    });
  }else{
    syncWBFurnitureTierForSelection();
    const tierOrder=Object.keys(FURNITURE_TIERS).sort((a,b)=>(FURNITURE_TIERS[a].order||0)-(FURNITURE_TIERS[b].order||0));
    html+='<div class="wb-furn-pick-panel open">';
    tierOrder.forEach(tier=>{
      let items=Object.entries(FURNITURE_CRAFTS).filter(([,f])=>f.tier===tier);
      if(tier==='journal'&&typeof WORKBENCH_TOOL_CRAFTS!=='undefined'){
        items=Object.entries(WORKBENCH_TOOL_CRAFTS).filter(([,f])=>f.tier===tier&&isWorkbenchToolRecipeUnlocked(f));
      }
      if(!items.length) return;
      const woodList=formatTierWoodList(tier);
      const tierOpen=!wbFurnitureTierCollapsed[tier];
      const tierLabel=(FURNITURE_TIERS[tier]?.label||tier).toUpperCase();
      html+='<div class="wb-furn-tier'+(tierOpen?' open':'')+'">'
        +'<button type="button" class="wb-furn-tier-head" onclick="toggleWBFurnitureTier(\''+tier+'\')">'
        +'<span class="wb-furn-tier-label">'+tierLabel+' TIER</span>'
        +'<span class="wb-furn-tier-woods">'+woodList+'</span>'
        +'<span class="wb-furn-tier-chevron">▸</span>'
        +'</button>'
        +'<div class="wb-furn-tier-body">';
      items.forEach(([id,f])=>{
        const isSel=id===craft.recipeKey;
        html+=renderFurnitureProjectCard(f, {
          selected:isSel,
          stageNum:getFurnitureProjectStage(id),
          onclick:isSel?'toggleWBFurniturePicker()':'selectFurnitureRecipe(\''+id+'\')',
        });
      });
      html+='</div></div>';
    });
    html+='</div>';
  }
  el.innerHTML=html;
}

function selectFurnitureRecipe(recipeKey){
  if(craft.running){ showToast('Stop crafting first.'); return; }
  if(!FURNITURE_CRAFTS[recipeKey]&&!WORKBENCH_TOOL_CRAFTS?.[recipeKey]) return;
  if(WORKBENCH_TOOL_CRAFTS?.[recipeKey]&&!isWorkbenchToolRecipeUnlocked(WORKBENCH_TOOL_CRAFTS[recipeKey])){
    showToast('Unlock this recipe at the bookcase first.');
    return;
  }
  saveCraftState();
  craft.recipeKey=recipeKey;
  state.lastWorkbenchRecipe=recipeKey;
  craft.userPickedLog=false;
  craft.lockLogType=false;
  loadCraftState(recipeKey);
  syncWorkbenchLogDefault();
  syncWBFurnitureTierForSelection();
  closeWBMatsPickers();
  wbFurniturePickerOpen=false;
  renderWorkbench();
}

function renderWorkbench() {
  const recipe = RECIPES[craft.recipeKey];
  const headerEl = document.querySelector('#workbench-screen .wb-header');
  const nameEl = document.querySelector('#workbench-screen .wb-item-name');
  const subEl = document.getElementById('wb-item-sub');
  const iconEl = document.querySelector('#workbench-screen .wb-icon');
  const isFurn=isStageWorkbenchRecipe(craft.recipeKey);
  if(headerEl) headerEl.hidden=!!isFurn;
  if (nameEl) nameEl.textContent = recipe.name;
  const shelfSlot = recipe.autoInstallShelfSlot;
  if (subEl) {
    if (shelfSlot) {
      const reqKey = getShelfTargetLogKey(shelfSlot, craft.storeRoomId);
      const reqName = reqKey ? (LOG_TYPES[reqKey]?.name || 'Log') : '';
      if (craft.upgradeShelfSlot === shelfSlot) {
        subEl.textContent = 'Upgrading to '+getLogTierName(getShelfTier(shelfSlot, craft.storeRoomId) + 1)+' · requires '+reqName;
      } else if (reqName) {
        subEl.textContent = 'Requires '+reqName;
      } else {
        subEl.textContent = '';
      }
    } else if(isFurn) {
      subEl.textContent = '';
    } else {
      subEl.textContent = '';
    }
  }
  if (iconEl) iconEl.textContent = recipe.icon;
  updateWorkbenchSkillPill();
  renderWBFurniturePicker();
  renderWBStages();
  renderWBMaterials();
  renderWBButtons();
}

function toggleMatTip(event, el) {
  event.stopPropagation();
  const opt = el.closest('.wb-mat-option');
  if (!opt || opt.classList.contains('unavail')) return;
  document.querySelectorAll('.wb-mat-option.show-tip').forEach(o => { if (o !== opt) o.classList.remove('show-tip'); });
  opt.classList.toggle('show-tip');
}

function renderWBMaterials() {
  renderWBLogSummary();
  renderWBExtraInputsSummary();
  renderWBNailSummary();
  renderWBSkillSummary();
  renderWBFinalChance();
  renderWBLogPickerPanel();
  renderWBNailPickerPanel();
}

const NEB_SPARK_COLORS = [
  ['#ff58b8', '#ff3890'],
  ['#c060ff', '#8840e8'],
  ['#ff7848', '#ff5030'],
  ['#ff48d0', '#c030a0'],
  ['#9860ff', '#6030c8'],
];

function fireworkStageSVG(n, completedStages, activeIndex, size) {
  const cx = size / 2, cy = size / 2;
  const sw = Math.max(1.2, 2.8 - n * 0.04);
  const tipR = Math.max(2.5, 7 - n * 0.12);
  let defs = NEB_SPARK_COLORS.map((c, i) =>
    '<linearGradient id="fw-grad-' + i + '" x1="0%" y1="100%" x2="100%" y2="0%">'
    + '<stop offset="0%" stop-color="' + c[1] + '"/><stop offset="100%" stop-color="' + c[0] + '"/></linearGradient>'
  ).join('');
  defs += '<radialGradient id="fw-core-grad"><stop offset="0%" stop-color="#ffb8e8"/><stop offset="60%" stop-color="#c060ff"/><stop offset="100%" stop-color="#4820a0"/></radialGradient>';
  const groups = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const len = size * 0.36;
    const x0 = cx + Math.cos(angle) * (size * 0.06);
    const y0 = cy + Math.sin(angle) * (size * 0.06);
    const x2 = cx + Math.cos(angle) * len;
    const y2 = cy + Math.sin(angle) * len;
    const bend = angle + (i % 2 ? 0.35 : -0.35);
    const cpx = cx + Math.cos(bend) * len * 0.55;
    const cpy = cy + Math.sin(bend) * len * 0.55;
    const filled = i < completedStages;
    const active = activeIndex >= 0 && i === activeIndex && !filled;
    const colIdx = i % NEB_SPARK_COLORS.length;
    const [c1] = NEB_SPARK_COLORS[colIdx];
    const fill = filled ? 'url(#fw-grad-' + colIdx + ')' : '#2a2838';
    const stroke = filled ? c1 : '#404058';
    const opacity = filled ? 1 : (active ? 0.75 : 0.22);
    const cls = 'fw-spark' + (filled ? ' lit' : '') + (active ? ' blooming' : '');
    const s1a = angle + 0.55, s2a = angle - 0.55;
    const sr = tipR * 0.55;
    groups.push('<g class="' + cls + '" opacity="' + opacity + '">'
      + '<path d="M' + x0 + ',' + y0 + ' Q' + cpx + ',' + cpy + ' ' + x2 + ',' + y2 + '" fill="none" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linecap="round"/>'
      + '<circle cx="' + x2 + '" cy="' + y2 + '" r="' + tipR + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="0.5"/>'
      + '<circle cx="' + (x2 + Math.cos(s1a) * tipR * 1.6) + '" cy="' + (y2 + Math.sin(s1a) * tipR * 1.6) + '" r="' + sr + '" fill="' + fill + '" opacity="0.75"/>'
      + '<circle cx="' + (x2 + Math.cos(s2a) * tipR * 1.6) + '" cy="' + (y2 + Math.sin(s2a) * tipR * 1.6) + '" r="' + sr + '" fill="' + fill + '" opacity="0.75"/>'
      + '</g>');
  }
  const allLit = completedStages >= n;
  const coreR = size * 0.07;
  const coreCls = 'fw-core' + (allLit ? ' lit' : '');
  const coreFill = allLit ? 'url(#fw-core-grad)' : '#1a1830';
  return '<svg class="wb-firework" viewBox="0 0 ' + size + ' ' + size + '" xmlns="http://www.w3.org/2000/svg">'
    + '<defs>' + defs + '</defs>'
    + '<circle class="' + coreCls + '" cx="' + cx + '" cy="' + cy + '" r="' + coreR + '" fill="' + coreFill + '" opacity="' + (allLit ? 1 : 0.35) + '"/>'
    + groups.join('')
    + '</svg>';
}

function renderWBStages() {
  const recipe = RECIPES[craft.recipeKey];
  const el = document.getElementById('wb-stages');
  if (!el || !recipe) return;
  const n = recipe.stages;
  const upgrading = recipe.autoInstallShelfSlot && craft.upgradeShelfSlot === recipe.autoInstallShelfSlot;
  const installed = recipe.autoInstallShelfSlot && isShelfInstalled(recipe.autoInstallShelfSlot, craft.storeRoomId) && !upgrading;
  const completed = installed || craft.complete ? n : craft.stage;
  const active = installed || craft.complete ? -1 : Math.min(craft.stage, n - 1);
  el.innerHTML = fireworkStageSVG(n, completed, active, 168);
}

function renderWBButtons() {
  const el = document.getElementById('wb-buttons');
  if (!el) return;
  const recipe = RECIPES[craft.recipeKey];
  if (!recipe) return;
  const logKey=getRecipeLogKey(recipe);
  const logType = LOG_TYPES[logKey];
  const needLogs=getRecipeLogsPerAttempt(recipe);
  const logs = logType ? logTypeCount(logKey) : 0;
  const noLogs = logs < needLogs || !recipeExtraInputsMet(recipe);
  const shelfSlot = recipe.autoInstallShelfSlot;
  const upgrading = shelfSlot && craft.upgradeShelfSlot === shelfSlot;
  const shelfDone = shelfSlot && isShelfInstalled(shelfSlot, craft.storeRoomId) && !upgrading;
  const furnCheck=isStageWorkbenchRecipe(craft.recipeKey)?validateFurnitureCraft(craft.recipeKey, craft.selectedLog):{ ok:true };
  const blocked=!furnCheck.ok;

  if (shelfDone && !canUpgradeShelf(shelfSlot, craft.storeRoomId)) {
    el.innerHTML = '<div class="wb-use-box"><div class="wb-use-chance">Shelf slot '+shelfSlot+' at max tier ('+getLogTierName(getShelfTier(shelfSlot, craft.storeRoomId))+')</div></div>';
    return;
  }

  if (shelfDone && !upgrading) {
    el.innerHTML = '<div class="wb-use-box"><div class="wb-use-chance">Shelf slot '+shelfSlot+' already installed</div></div>';
    return;
  }

  if (craft.complete) {
    el.innerHTML = '<div class="wb-use-box"><div class="wb-use-btns"><button class="wb-btn collect" onclick="collectItem()">'
      + 'Collect (+' + recipe.xpComplete + ' bonus exp)</button></div></div>';
    return;
  }

  if (craft.running) {
    el.innerHTML = '<div class="wb-use-box"><div class="wb-use-btns"><button class="wb-btn stop" onclick="stopCrafting()">Stop</button></div></div>';
    return;
  }

  const disableCraft=noLogs||blocked||!selectedCraftNailAvailable();
  const blockHint=blocked?('<div class="wb-use-chance" style="color:rgba(255,110,110,0.9)">'+furnCheck.msg+'</div>'):'';
  const failsafeHint=recipeUsesNails(recipe)&&craftUsesRustyNailFailsafe()?('<div class="wb-use-chance" style="color:var(--ui-text-dim)">Success already 100% — using free rusty nails instead.</div>'):'';
  const nailHint=recipeUsesNails(recipe)&&!selectedCraftNailAvailable()&&!craftUsesRustyNailFailsafe()?('<div class="wb-use-chance" style="color:rgba(255,110,110,0.9)">No '+((NAIL_TYPES[craft.selectedNail]?.name)||'nails')+' available.</div>'):'';
  const logLabel=logType?(needLogs>1?'Use '+needLogs+' '+logType.name:'Use 1 '+logType.name):'Use logs';
  const allLabel=needLogs>1?'Use all sets':'Use all logs';

  el.innerHTML =
    '<div class="wb-use-box">'
    + blockHint
    + failsafeHint
    + nailHint
    + '<div class="wb-use-btns">'
    + '<button class="wb-btn once" ' + (disableCraft ? 'disabled' : '') + ' onclick="craftOnce()">'+logLabel+'</button>'
    + '<button class="wb-btn continuous" ' + (disableCraft ? 'disabled' : '') + ' onclick="craftContinuous()">'+allLabel+'</button>'
    + '</div></div>';
}

function selectLog(key) {
  if(getActiveShelfRequiredLogKey()) return;
  const reqLog=RECIPES[craft.recipeKey]?.requiredLogKey;
  if(reqLog){
    showToast('This project requires '+((LOG_TYPES[reqLog]?.name)||reqLog)+'.');
    return;
  }
  if(craft.running && craft.lockLogType) return;
  if(isStageWorkbenchRecipe(craft.recipeKey) && !isWoodAllowedForRecipe(craft.recipeKey, key)){
    showToast(LOG_TYPES[key]?.name+' cannot be used for this project.');
    return;
  }
  craft.selectedLog = key;
  craft.userPickedLog = true;
  wbLogPickerOpen = false;
  renderWBMaterials();
  renderWBButtons();
}

function selectNail(key) {
  craft.selectedNail = key;
  wbNailPickerOpen = false;
  renderWBMaterials();
  renderWBButtons();
}

function craftOnce() {
  const result = doAttempt();
  renderWorkbench();
  return result;
}

function craftContinuous() {
  if (craft.running) return;
  const recipe = RECIPES[craft.recipeKey];
  const shelfSlot = recipe.autoInstallShelfSlot;
  if (shelfSlot) {
    if (craft.upgradeShelfSlot === shelfSlot) {
      if (!canUpgradeShelf(shelfSlot, craft.storeRoomId)) {
        showToast('This shelf cannot be upgraded further.');
        renderWBButtons();
        return;
      }
    } else if (isShelfInstalled(shelfSlot, craft.storeRoomId)) {
      showToast('This shelf is already installed in this store room.');
      renderWBButtons();
      return;
    }
  }
  syncWorkbenchLogDefault();
  if (shelfSlot) {
    const reqLog = getShelfTargetLogKey(shelfSlot, craft.storeRoomId);
    if (reqLog) craft.selectedLog = reqLog;
  } else {
    const logKey = craft.userPickedLog ? craft.selectedLog : (getBestAvailableLogKeyForRecipe(craft.recipeKey) || craft.selectedLog);
    craft.selectedLog = logKey;
  }
  const valid=validateFurnitureCraft(craft.recipeKey, craft.selectedLog);
  if(isStageWorkbenchRecipe(craft.recipeKey) && !valid.ok){
    showToast(valid.msg);
    return;
  }
  craft.lockLogType = true;
  craft.userPickedLog = true;
  const logType = LOG_TYPES[craft.selectedLog];
  const needLogs = getRecipeLogsPerAttempt(recipe);
  if (!logType.infinite) {
    const available = logTypeCount(logType.key);
    if (available < needLogs) {
      showToast('Need '+needLogs+' '+logType.name+(needLogs>1?'':'')+'.');
      return;
    }
  }
  if(recipeUsesNails(recipe) && !selectedCraftNailAvailable()){
    showToast('No '+((NAIL_TYPES[craft.selectedNail]?.name)||'nails')+' available.');
    return;
  }
  setActivity('crafting');
  craft.running = true;
  renderWBMaterials();
  renderWBButtons();
  runNextAttempt();
}

function runNextAttempt() {
  if (!craft.running) return;
  const recipe = RECIPES[craft.recipeKey];
  const shelfSlot = recipe.autoInstallShelfSlot;
  if (shelfSlot) {
    if (craft.upgradeShelfSlot === shelfSlot) {
      if (!canUpgradeShelf(shelfSlot, craft.storeRoomId)) {
        stopCrafting();
        renderWorkbench();
        return;
      }
    } else if (isShelfInstalled(shelfSlot, craft.storeRoomId)) {
      stopCrafting();
      renderWorkbench();
      return;
    }
  }
  const logKey=getRecipeLogKey(recipe);
  const logType = LOG_TYPES[logKey];
  const needLogs=getRecipeLogsPerAttempt(recipe);
  const hasLogs = logType.infinite || logTypeCount(logKey) >= needLogs;
  if (!hasLogs || craft.complete || !recipeExtraInputsMet(recipe)) { stopCrafting(); renderWorkbench(); return; }
  if(!selectedCraftNailAvailable()) { stopCrafting(); renderWorkbench(); return; }

  const advanced = doAttempt();
  renderWorkbench();

  if(advanced===false){
    stopCrafting();
    renderWorkbench();
    return;
  }

  if (craft.complete) {
    stopCrafting();
    renderWorkbench();
    return;
  }
  craft.runTimer = setTimeout(runNextAttempt, ACTION_TICK_MS);
}

function stopCrafting(fromActivitySwitch) {
  craft.running = false;
  craft.lockLogType = false;
  clearTimeout(craft.runTimer);
  if(!fromActivitySwitch) clearActivity('crafting');
  renderWBButtons();
}

// Returns true if stage advanced
function doAttempt() {
  const recipe   = RECIPES[craft.recipeKey];
  const shelfSlot = recipe.autoInstallShelfSlot;
  if (shelfSlot) {
    if (!craft.storeRoomId) {
      showToast('Store room link lost — open the shelf from that store room again.');
      stopCrafting();
      return false;
    }
    if (craft.upgradeShelfSlot === shelfSlot) {
      if (!canUpgradeShelf(shelfSlot, craft.storeRoomId)) {
        showToast('This shelf cannot be upgraded further.');
        return false;
      }
    } else if (isShelfInstalled(shelfSlot, craft.storeRoomId)) {
      showToast('This shelf is already installed in this store room.');
      return false;
    }
  }
  const logKey=getRecipeLogKey(recipe);
  const logType  = LOG_TYPES[logKey];

  if (shelfSlot) {
    const reqLog = getShelfTargetLogKey(shelfSlot, craft.storeRoomId);
    if (reqLog && craft.selectedLog !== reqLog) {
      showToast('This shelf requires '+LOG_TYPES[reqLog].name+' wood.');
      return false;
    }
  } else {
    const valid=validateFurnitureCraft(craft.recipeKey, logKey);
    if(!valid.ok){ showToast(valid.msg); return false; }
  }

  if (!logType.infinite) {
    if(!consumeRecipeLogsForAttempt(recipe)){
      showToast('Not enough '+(logType.name||'logs')+'.');
      return false;
    }
  }
  if(!consumeRecipeExtraInputs(recipe)){
    showToast('Missing materials for this project.');
    return false;
  }
  const success = Math.random() < calcChance();
  const nailUsage=applyCraftNailUsage(success);
  if(!nailUsage.ok) return false;

  if (success) {
    const isUpgrade=!!(shelfSlot&&craft.upgradeShelfSlot===shelfSlot);
    const nextStage=craft.stage+1;
    if (shelfSlot) {
      const room=getStoreRoomForCraft();
      if(!room){
        showToast('Store room link lost — open the shelf from that store room again.');
        syncUI();
        return false;
      }
      ensureStoreRoomShelfFields(room);
      if (nextStage >= recipe.stages) {
        if(!finalizeShelfCraft(shelfSlot, recipe, isUpgrade, true)){
          syncUI();
          return false;
        }
        syncUI();
        return success;
      }
      craft.stage=nextStage;
      if (isUpgrade) room.shelfUpgradeStages[shelfSlot]=craft.stage;
      else room.shelfStages[shelfSlot]=craft.stage;
    } else {
      craft.stage=nextStage;
    }
    grantXP('carpentry', recipe.xpStage, null);
    const stagesLeft = recipe.stages - craft.stage;
    if (craft.stage >= recipe.stages) {
      if (shelfSlot) {
        if(!finalizeShelfCraft(shelfSlot, recipe, isUpgrade, false)){
          syncUI();
          return false;
        }
      } else {
        craft.complete = true;
        saveCraftState();
        addActivityLog('wb-log',recipe.icon+' '+recipe.name+' complete! Collect.', 'complete');
        showToast(recipe.icon+' '+recipe.name+' complete!');
      }
    } else {
      saveCraftState();
      const nailNote=formatCraftNailUsageNote(nailUsage.used, nailUsage.nailType);
      addActivityLog('wb-log','Stage '+craft.stage+' complete! '+stagesLeft+' to go. +'+recipe.xpStage+' xp'+nailNote, 'success');
    }
  } else {
    grantXP('carpentry', recipe.xpFail, null);
    if(nailUsage.discarded){
      addActivityLog('wb-log','The nails go in wrong and one is discarded. +'+recipe.xpFail+' xp', 'fail');
    }else{
      const failMsgs=[
        'The joint does not hold. +'+recipe.xpFail+' xp',
        'Wood splits slightly. Not quite. +'+recipe.xpFail+' xp',
        'Almost. Not yet. +'+recipe.xpFail+' xp',
      ];
      addActivityLog('wb-log',failMsgs[Math.floor(Math.random()*failMsgs.length)], 'fail');
    }
  }

  syncUI();
  return true;
}

function collectItem() {
  const recipe = RECIPES[craft.recipeKey];
  grantXP(recipe.skill || 'carpentry', recipe.xpComplete, null);
  craft.stage = 0;
  craft.complete = false;
  saveCraftState();
  if (recipe.supplyKey) {
    invAdd(recipe.supplyKey, recipe.icon, recipe.name, 1);
    showToast(recipe.icon + ' ' + recipe.name + ' added to your bag! +' + recipe.xpComplete + ' bonus xp');
  } else if (recipe.outputToolKey) {
    invAdd(recipe.outputToolKey, recipe.icon, recipe.name, 1);
    showToast(recipe.icon + ' ' + recipe.name + ' added to your bag! Equip it from inventory. +' + recipe.xpComplete + ' bonus xp');
  } else if (isFurnitureRecipe(craft.recipeKey)) {
    const key = recipe.furnitureKey || craft.recipeKey;
    invAdd(key, recipe.icon, recipe.name, 1);
    showToast(recipe.icon + ' ' + recipe.name + ' added to your bag! +' + recipe.xpComplete + ' bonus xp');
  }
  syncUI();
  renderWorkbench();
}

registerActivityRunner('crafting', {
  isRunning:()=>craft.running,
  stop:(from)=>stopCrafting(from),
  label:'Workbench',
});
