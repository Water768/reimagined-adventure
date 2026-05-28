/* Hearthstead — workbench */
'use strict';

/* ═══════════════════════════════════════
   WORKBENCH
═══════════════════════════════════════ */
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

function isFurnitureRecipe(recipeKey){
  const r=RECIPES[recipeKey];
  return !!(r&&r.tier&&!r.autoInstallShelfSlot);
}

function meetsCarpentryRequirement(recipe){
  if(!recipe?.requiredCarpentryLevel) return true;
  return getCarpentryLevel()>=recipe.requiredCarpentryLevel;
}

function isWoodAllowedForRecipe(recipeKey, logKey){
  const recipe=RECIPES[recipeKey];
  if(!recipe||recipe.autoInstallShelfSlot) return true;
  return resolveAllowedWoods(recipe.allowedWoods).includes(logKey);
}

function getFurnitureSkillBonusPct(recipe){
  const unlock=recipe?.requiredCarpentryLevel||1;
  return Math.max(0, getCarpentryLevel()-unlock)*2;
}

function getFurnitureNailBonusPct(){
  return Math.round((NAIL_TYPES[craft.selectedNail]?.bonus||0)*100);
}

function getFurnitureChanceBreakdown(recipe, logKey){
  const base=recipe.baseFurnitureChance??10;
  const wood=getWoodModifier(logKey);
  const skill=getFurnitureSkillBonusPct(recipe);
  const nail=getFurnitureNailBonusPct();
  const total=Math.min(100, Math.max(0, base+wood+skill+nail));
  return { base, wood, skill, nail, total };
}

function calcFurnitureChancePct(recipe, logKey){
  return getFurnitureChanceBreakdown(recipe, logKey).total;
}

function getBestAvailableLogKeyForRecipe(recipeKey){
  const recipe=RECIPES[recipeKey];
  if(!isFurnitureRecipe(recipeKey)) return getBestAvailableLogKey();
  const allowed=resolveAllowedWoods(recipe.allowedWoods);
  for(let i=LOG_TIER_ORDER.length-1;i>=0;i--){
    const k=LOG_TIER_ORDER[i];
    if(allowed.includes(k)&&logTypeCount(k)>0) return k;
  }
  return allowed[0]||'logs';
}

function validateFurnitureCraft(recipeKey, logKey){
  const recipe=RECIPES[recipeKey];
  if(!recipe||recipe.autoInstallShelfSlot) return { ok:true };
  if(!meetsCarpentryRequirement(recipe)){
    return { ok:false, msg:'Need Carpentry Lv '+recipe.requiredCarpentryLevel+'.' };
  }
  if(!isWoodAllowedForRecipe(recipeKey, logKey)){
    const woodName=LOG_TYPES[logKey]?.name||'wood';
    return { ok:false, msg:woodName+' cannot be used for '+recipe.name+'.' };
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
  const best = isFurnitureRecipe(craft.recipeKey)
    ? getBestAvailableLogKeyForRecipe(craft.recipeKey)
    : getBestAvailableLogKey();
  if(!best){
    craft.selectedLog = craft.selectedLog || 'logs';
    return;
  }
  if(!craft.userPickedLog){
    craft.selectedLog = best;
  } else if(logTypeCount(craft.selectedLog) < 1){
    craft.selectedLog = best;
    craft.userPickedLog = false;
  } else if(isFurnitureRecipe(craft.recipeKey) && !isWoodAllowedForRecipe(craft.recipeKey, craft.selectedLog)){
    craft.selectedLog = best;
    craft.userPickedLog = false;
  }
}

let wbLogPickerOpen = false;
let wbNailPickerOpen = false;
let wbFurniturePickerOpen = false;

function toggleWBFurniturePicker(){
  if(craft.running){ showToast('Stop crafting first.'); return; }
  wbFurniturePickerOpen=!wbFurniturePickerOpen;
  renderWBFurniturePicker();
}

function toggleWBLogPicker(){
  wbLogPickerOpen=!wbLogPickerOpen;
  if(wbLogPickerOpen) wbNailPickerOpen=false;
  renderWBMaterials();
}

function toggleWBNailPicker(){
  wbNailPickerOpen=!wbNailPickerOpen;
  if(wbNailPickerOpen) wbLogPickerOpen=false;
  renderWBMaterials();
}

function closeWBMatsPickers(){
  wbLogPickerOpen=false;
  wbNailPickerOpen=false;
}

function wbStockClass(count, infinite){
  if(infinite||count>0) return 'ok';
  return 'missing';
}

function wbAvailLabel(count, infinite){
  if(infinite) return '∞ available';
  return count+' available';
}

function nailTypeCount(key){
  return nailCount(key);
}

function getWBLogBonusLabel(){
  if(isFurnitureRecipe(craft.recipeKey)){
    return '+'+getWoodModifier(craft.selectedLog)+'%';
  }
  return '+'+Math.round((LOG_TYPES[craft.selectedLog]?.bonus||0)*100)+'%';
}

function getWBNailBonusLabel(){
  const b=NAIL_TYPES[craft.selectedNail]?.bonus||0;
  return (b>=0?'+':'')+Math.round(b*100)+'%';
}

function renderWBCollapsedPick({icon, name, count, infinite, locked, canOpen, bonusTxt, onClick}){
  const availCls=wbStockClass(infinite?1:count, infinite);
  const unavail=!infinite&&count<1;
  const clickAttr=canOpen&&onClick?' onclick="'+onClick+'"':'';
  const lockCls=locked&&!canOpen?' locked':'';
  return '<div class="wb-mat-pick-collapsed'+(unavail?' unavail':'')+lockCls+'"'+clickAttr+'>'
    +'<span class="wb-mat-icon">'+icon+'</span>'
    +'<span class="wb-mat-info">'
    +'<span class="wb-mat-name">'+name+'</span>'
    +'<span class="wb-mat-pick-avail '+availCls+'">'+wbAvailLabel(infinite?0:count, infinite)+'</span>'
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
  const tipHtml=(!infinite&&count>0&&!disabled)?'<span class="wb-mat-stock-tip">'+inBag+' bag · '+inStore+' storage</span>':'';
  const tipClass=(!infinite&&count>0&&!disabled)?' has-tip':'';
  return '<div class="wb-mat-option'+selCls+unavailCls+'"'+onclick+'>'
    +'<span class="wb-mat-icon">'+t.icon+'</span>'
    +'<span class="wb-mat-info">'
    +'<span class="wb-mat-name">'+t.name+'</span>'
    +'<span class="wb-mat-stock'+tipClass+' '+wbStockClass(count,infinite)+'">'+wbAvailLabel(count,infinite)+'</span>'
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
  const isFurn=isFurnitureRecipe(craft.recipeKey);
  const allowed=isFurn?resolveAllowedWoods(RECIPES[craft.recipeKey].allowedWoods):null;
  const logs=LOG_TIER_ORDER.map(k=>LOG_TYPES[k]).filter(Boolean);
  const logsHtml=logs.map(t=>{
    const stock=logTypeCount(t.key);
    const woodBlocked=isFurn&&!allowed.includes(t.key);
    const bonusTxt=isFurn?('+'+getWoodModifier(t.key)+'%'):('+'+Math.round((t.bonus||0)*100)+'%');
    const inBag=state.inventory[t.key]?.count||0;
    const inStore=state.storage[t.key]?.count||0;
    return renderWBMatListOption(t,{
      count:stock, infinite:false,
      selected:craft.selectedLog===t.key,
      onSelect:'selectLog(\''+t.key+'\')',
      disabled:logLocked||woodBlocked,
      bonusTxt,
      inBag, inStore,
    });
  }).join('');
  el.innerHTML='<div class="wb-mat-options">'+logsHtml+'</div>';
}

function renderWBNailPickerPanel(){
  const el=document.getElementById('wb-nail-picker');
  if(!el) return;
  if(!wbNailPickerOpen){
    el.classList.remove('open');
    el.innerHTML='';
    return;
  }
  el.classList.add('open');
  const nailsHtml=Object.values(NAIL_TYPES).map(t=>{
    const inBag=state.inventory[t.key]?.count||0;
    const inStore=state.storage[t.key]?.count||0;
    const total=t.infinite?0:inBag+inStore;
    const bonusTxt=(t.bonus>=0?'+':'')+Math.round((t.bonus||0)*100)+'%';
    return renderWBMatListOption(t,{
      count:total, infinite:!!t.infinite,
      selected:craft.selectedNail===t.key,
      onSelect:'selectNail(\''+t.key+'\')',
      bonusTxt,
      inBag, inStore,
    });
  }).join('');
  el.innerHTML='<div class="wb-mat-options">'+nailsHtml+'</div>';
}

function renderWBLogSummary(){
  syncWorkbenchLogDefault();
  const el=document.getElementById('wb-log-options');
  if(!el) return;
  const shelfLog=getActiveShelfRequiredLogKey();
  const sel=LOG_TYPES[craft.selectedLog]||LOG_TYPES.logs;
  const total=logTypeCount(craft.selectedLog);
  const locked=!!shelfLog||(craft.running&&craft.lockLogType);
  const reqSuffix=shelfLog?' <span class="wb-mat-req '+wbStockClass(total)+'">(required)</span>':'';
  el.innerHTML=renderWBCollapsedPick({
    icon:sel.icon,
    name:sel.name+reqSuffix,
    count:total,
    infinite:false,
    locked,
    canOpen:!locked,
    bonusTxt:getWBLogBonusLabel(),
    onClick:'toggleWBLogPicker()',
  });
}

function renderWBNailSummary(){
  const el=document.getElementById('wb-nail-options');
  if(!el) return;
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
  });
}

function getWBChanceInfo(){
  const recipe=RECIPES[craft.recipeKey];
  if(!recipe) return null;
  if(isFurnitureRecipe(craft.recipeKey)){
    const breakdown=getFurnitureChanceBreakdown(recipe, craft.selectedLog);
    const levelsAbove=Math.max(0, getCarpentryLevel()-recipe.requiredCarpentryLevel);
    return { isFurniture:true, breakdown, skill:breakdown.skill, total:breakdown.total, levelsAbove };
  }
  const total=Math.round(calcChance()*100);
  const logPct=Math.round((LOG_TYPES[craft.selectedLog]?.bonus||0)*100);
  const nailPct=Math.round((NAIL_TYPES[craft.selectedNail]?.bonus||0)*100);
  return { isFurniture:false, total, logPct, nailPct, skill:0, levelsAbove:0 };
}

function renderWBSkillSummary(){
  const el=document.getElementById('wb-skill-summary');
  if(!el) return;
  const info=getWBChanceInfo();
  if(!info){
    el.innerHTML='';
    return;
  }
  if(info.isFurniture){
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

// Nail types — bonus is additive modifier to chance
// Active craft state
const craft = {
  recipeKey: 'chair',
  stage: 0,
  complete: false,
  running: false,
  runTimer: null,
  selectedLog:  'logs',
  selectedNail: 'rusty',
  lockLogType: false,
  userPickedLog: false,
  upgradeShelfSlot: null,
  storeRoomId: null,
};

function calcChance() {
  const recipe = RECIPES[craft.recipeKey];
  if (!recipe) return 0;
  if (recipe.autoInstallShelfSlot) {
    const logBonus  = LOG_TYPES[craft.selectedLog]?.bonus  || 0;
    const nailBonus = NAIL_TYPES[craft.selectedNail]?.bonus || 0;
    return Math.min(1, Math.max(0.001, recipe.baseChance + logBonus + nailBonus));
  }
  return calcFurnitureChancePct(recipe, craft.selectedLog) / 100;
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

function formatSkillXpTip(sk){
  if(!sk) return '';
  const left=Math.max(0, sk.xpToNext-sk.xp);
  return sk.xp+' / '+sk.xpToNext+' xp · '+left+' to next level';
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
  const tip=formatSkillXpTip(sk);
  if (tipEl) tipEl.textContent = tip;
  if (pillEl) pillEl.setAttribute('aria-label', meta.name+' Lv '+sk.level+': '+tip);
  if(pillEl&&(pillEl.matches(':hover')||pillEl.matches(':focus-within'))) syncFloatingSkillPillTip(pillEl);
}

function updateWorkbenchSkillPill() {
  updateActivitySkillPill('wb', RECIPES[craft.recipeKey]?.skill || 'carpentry');
}

function openWorkbench() {
  const last=state.lastWorkbenchRecipe;
  const key=(last&&FURNITURE_CRAFTS[last])?last:'chair';
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
  if(isFurnitureRecipe(recipeKey)) state.lastWorkbenchRecipe=recipeKey;
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
  const cur=FURNITURE_CRAFTS[craft.recipeKey]||FURNITURE_CRAFTS.chair;
  const tierLabel=FURNITURE_TIERS[cur.tier]?.label||'';
  const carpLvl=getCarpentryLevel();
  const woodName=LOG_TYPES[craft.selectedLog]?.name||'Log';
  const stageNum=craft.complete?cur.stages:craft.stage;
  const curLvlBadge=plotAddLevelBadge('carpentry', carpLvl, cur.requiredCarpentryLevel, cur.requiredCarpentryLevel);
  let html='<div class="wb-furn-pick-collapsed selected" onclick="toggleWBFurniturePicker()">'
    +'<span class="wb-furn-pick-icon">'+cur.icon+'</span>'
    +'<div class="wb-furn-pick-body">'
    +'<span class="wb-furn-pick-name">'+plotAddItemTitleRow(cur.name, curLvlBadge)+'</span>'
    +'<span class="wb-furn-pick-sub"><span class="wb-furn-tier-tag">'+tierLabel+' tier</span>'
    +(wbFurniturePickerOpen?'':' · tap to change')+'</span>'
    +'<span class="wb-furn-pick-detail">'+(cur.description||'')
    +(cur.unlocksBotany?' · unlocks botany!':'')
    +' · '+cur.baseFurnitureChance+'% base success rate · '+woodName+' · stage '+stageNum+'/'+cur.stages+'</span>'
    +'</div>'
    +'<span class="wb-furn-pick-chevron">'+(wbFurniturePickerOpen?'▴':'▾')+'</span>'
    +'</div>';
  if(wbFurniturePickerOpen){
    const tierOrder=['simple','hardwood','artisan','mythical'];
    html+='<div class="wb-furn-pick-panel open">';
    tierOrder.forEach(tier=>{
      const items=Object.entries(FURNITURE_CRAFTS).filter(([,f])=>f.tier===tier);
      if(!items.length) return;
      html+='<div class="wb-furn-tier"><div class="store-items-title">'+FURNITURE_TIERS[tier].label.toUpperCase()+' TIER</div>';
      items.forEach(([id,f])=>{
        const itemLocked=carpLvl<f.requiredCarpentryLevel;
        const sel=craft.recipeKey===id;
        const lvlBadge=plotAddLevelBadge('carpentry', carpLvl, f.requiredCarpentryLevel, f.requiredCarpentryLevel);
        html+='<div class="fp-recipe-card'+(sel?' selected':'')+(itemLocked?' locked below-rec':'')+'"'
          +(itemLocked?'':' onclick="selectFurnitureRecipe(\''+id+'\')"')+'>'
          +'<div class="fp-recipe-row"><span>'+(itemLocked?'🔒':f.icon)+' '+f.name+'</span>'
          +lvlBadge+'</div>'
          +'<div class="wb-furn-card-sub">'+f.stages+' stages · '+f.baseFurnitureChance+'% base success rate · '+f.description
          +(f.unlocksBotany?'<span class="wb-furn-unlock-hint">unlocks botany!</span>':'')+'</div>'
          +'</div>';
      });
      html+='</div>';
    });
    html+='</div>';
  }
  el.innerHTML=html;
}

function selectFurnitureRecipe(recipeKey){
  if(craft.running){ showToast('Stop crafting first.'); return; }
  if(!FURNITURE_CRAFTS[recipeKey]) return;
  saveCraftState();
  craft.recipeKey=recipeKey;
  state.lastWorkbenchRecipe=recipeKey;
  craft.userPickedLog=false;
  craft.lockLogType=false;
  loadCraftState(recipeKey);
  syncWorkbenchLogDefault();
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
  const isFurn=isFurnitureRecipe(craft.recipeKey);
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
  const logType = LOG_TYPES[craft.selectedLog];
  const logs = logType ? logTypeCount(logType.key) : 0;
  const noLogs = logs < 1;
  const recipe = RECIPES[craft.recipeKey];
  const shelfSlot = recipe.autoInstallShelfSlot;
  const upgrading = shelfSlot && craft.upgradeShelfSlot === shelfSlot;
  const shelfDone = shelfSlot && isShelfInstalled(shelfSlot, craft.storeRoomId) && !upgrading;
  const furnCheck=isFurnitureRecipe(craft.recipeKey)?validateFurnitureCraft(craft.recipeKey, craft.selectedLog):{ ok:true };
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
    const label = recipe.completeLabel || 'item';
    el.innerHTML = '<div class="wb-use-box"><div class="wb-use-btns"><button class="wb-btn collect" onclick="collectItem()">'
      + 'Collect ' + label + ' (+' + recipe.xpComplete + ' bonus exp)</button></div></div>';
    return;
  }

  if (craft.running) {
    el.innerHTML = '<div class="wb-use-box"><div class="wb-use-btns"><button class="wb-btn stop" onclick="stopCrafting()">Stop</button></div></div>';
    return;
  }

  const disableCraft=noLogs||blocked;
  const blockHint=blocked?('<div class="wb-use-chance" style="color:rgba(255,110,110,0.9)">'+furnCheck.msg+'</div>'):'';

  el.innerHTML =
    '<div class="wb-use-box">'
    + blockHint
    + '<div class="wb-use-btns">'
    + '<button class="wb-btn once" ' + (disableCraft ? 'disabled' : '') + ' onclick="craftOnce()">Use 1 log</button>'
    + '<button class="wb-btn continuous" ' + (disableCraft ? 'disabled' : '') + ' onclick="craftContinuous()">Use all logs</button>'
    + '</div></div>';
}

function selectLog(key) {
  if(getActiveShelfRequiredLogKey()) return;
  if(craft.running && craft.lockLogType) return;
  if(isFurnitureRecipe(craft.recipeKey) && !isWoodAllowedForRecipe(craft.recipeKey, key)){
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
  if(isFurnitureRecipe(craft.recipeKey) && !valid.ok){
    showToast(valid.msg);
    return;
  }
  craft.lockLogType = true;
  craft.userPickedLog = true;
  const logType = LOG_TYPES[craft.selectedLog];
  if (!logType.infinite) {
    const available = logTypeCount(logType.key);
    if (!available) { showToast("No "+logType.name+"s available."); return; }
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
  const logType = LOG_TYPES[craft.selectedLog];
  const hasLogs = logType.infinite || logTypeCount(logType.key) > 0;
  if (!hasLogs || craft.complete) { stopCrafting(); renderWorkbench(); return; }

  const advanced = doAttempt();
  renderWorkbench();

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
  const logType  = LOG_TYPES[craft.selectedLog];
  const nailType = NAIL_TYPES[craft.selectedNail];

  if (shelfSlot) {
    const reqLog = getShelfTargetLogKey(shelfSlot, craft.storeRoomId);
    if (reqLog && craft.selectedLog !== reqLog) {
      showToast('This shelf requires '+LOG_TYPES[reqLog].name+' wood.');
      return false;
    }
  } else {
    const valid=validateFurnitureCraft(craft.recipeKey, craft.selectedLog);
    if(!valid.ok){ showToast(valid.msg); return false; }
  }

  // Check log availability
  const logKey = logType.key;
  if (!logType.infinite) {
    const logItem = state.inventory[logKey];
    if (logItem?.count) {
      logItem.count--;
      if (!logItem.count) delete state.inventory[logKey];
    } else {
      const stored = state.storage[logKey];
      if (!stored?.count) { showToast("No "+logType.name+"s available."); return false; }
      stored.count--;
      if (!stored.count) delete state.storage[logKey];
    }
  }
  // Nails: consume from inventory if not infinite
  if (!nailType.infinite) {
    const nailItem = state.inventory[nailType.key];
    const bagCount = nailItem?.count || 0;
    const storeCount = state.storage[nailType.key]?.count || 0;
    let need = recipe.nailsPerAttempt;
    if ((bagCount + storeCount) < need) {
      showToast("Not enough "+nailType.name+"."); return false;
    }
    if (bagCount >= need) {
      nailItem.count -= need;
      if (!nailItem.count) delete state.inventory[nailType.key];
    } else {
      if (nailItem?.count) delete state.inventory[nailType.key];
      need -= bagCount;
      const storedNails = state.storage[nailType.key];
      storedNails.count -= need;
      if (!storedNails.count) delete state.storage[nailType.key];
    }
  }

  const success = Math.random() < calcChance();

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
        addActivityLog('wb-log',recipe.icon+' '+recipe.name+' complete! Collect it below.', 'complete');
        showToast(recipe.icon+' '+recipe.name+' complete!');
      }
    } else {
      saveCraftState();
      addActivityLog('wb-log','Stage '+craft.stage+' complete! '+stagesLeft+' to go. +'+recipe.xpStage+' Carpentry', 'success');
    }
  } else {
    grantXP('carpentry', recipe.xpFail, null);
    const failMsgs = [
      'The joint does not hold. +'+recipe.xpFail+' Carpentry',
      'Nail bends. You try again. +'+recipe.xpFail+' Carpentry',
      'Wood splits slightly. Not quite. +'+recipe.xpFail+' Carpentry',
      'Almost. Not yet. +'+recipe.xpFail+' Carpentry',
      'The nails go in wrong. +'+recipe.xpFail+' Carpentry',
    ];
    addActivityLog('wb-log',failMsgs[Math.floor(Math.random()*failMsgs.length)], 'fail');
  }

  syncUI();
  return success;
}

function collectItem() {
  const recipe = RECIPES[craft.recipeKey];
  grantXP(recipe.skill || 'carpentry', recipe.xpComplete, null);
  craft.stage = 0;
  craft.complete = false;
  saveCraftState();
  if (isFurnitureRecipe(craft.recipeKey)) {
    const key = recipe.furnitureKey || craft.recipeKey;
    invAdd(key, recipe.icon, recipe.name, 1);
    showToast(recipe.icon + ' ' + recipe.name + ' added to your bag! +' + recipe.xpComplete + ' bonus Carpentry');
  }
  syncUI();
  renderWorkbench();
}

registerActivityRunner('crafting', {
  isRunning:()=>craft.running,
  stop:(from)=>stopCrafting(from),
  label:'Workbench',
});

registerActivityRunner('crafting', {
  isRunning:()=>craft.running,
  stop:(from)=>stopCrafting(from),
  label:'Workbench',
});
