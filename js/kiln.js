/* Hearthstead — simple kiln */
'use strict';

let activeKilnInstanceId=null;
let kilnTab='clay';
let kilnRecipePickerOpen=false;
let kilnMetalTier='copper';
const kilnRecipeByTab={ clay:'fire_brick', melting:'molten_glass', blow:'blow_vial', metal:'smelt_copper_nails' };
const kilnRecipeByMetalTier={ copper:'smelt_copper_nails', bronze:'smelt_bronze_nails' };

function normalizeKilnConfig(cfg){
  if(!cfg) return { stone:0, clay:0, bricks:0, mouldIron:0, fuelLogs:0, fuelAshwood:0, fuelTeak:0, fired:false, moulded:false, fueled:false, lit:false, freePlaced:false };
  if(cfg.stone==null) cfg.stone=0;
  if(cfg.clay==null) cfg.clay=0;
  if(cfg.bricks==null) cfg.bricks=0;
  if(cfg.mouldIron==null) cfg.mouldIron=0;
  if(cfg.fuelLogs==null) cfg.fuelLogs=0;
  if(cfg.fuelAshwood==null) cfg.fuelAshwood=0;
  if(cfg.fuelTeak==null) cfg.fuelTeak=0;
  if(cfg.fired==null) cfg.fired=false;
  if(cfg.moulded==null) cfg.moulded=false;
  if(cfg.fueled==null) cfg.fueled=false;
  if(cfg.lit==null) cfg.lit=false;
  if(cfg.freePlaced==null) cfg.freePlaced=false;
  if(isKilnBuildComplete(cfg)){
    KILN_BUILD_MATERIALS.forEach(m=>{ cfg[m.countKey]=m.required; });
    cfg.fired=true;
  }
  if(isKilnMoulded(cfg)){
    cfg.mouldIron=KILN_MOULD_IRON_REQUIRED;
    cfg.moulded=true;
  }
  if(isKilnFueled(cfg)){
    KILN_FUEL_LOGS.forEach(l=>{ cfg[l.countKey]=KILN_FUEL_LOG_REQUIRED; });
    cfg.fueled=true;
  }
  return cfg;
}

function getKilnConfig(instanceId){
  if(!instanceId) return null;
  return normalizeKilnConfig(getPlotConfig(instanceId,'kiln','simple_kiln'));
}

function setActiveKiln(instanceId){
  activeKilnInstanceId=instanceId||null;
}

function resolveKilnCell(el){
  if(el?.classList?.contains('cell-kiln')) return el;
  return el?.closest?.('.plot-cell.cell-kiln')||null;
}

function resolveKilnInstanceId(eventOrCell){
  const cell=eventOrCell?.classList?eventOrCell:resolveKilnCell(eventOrCell?.target);
  return cell?.dataset?.instanceId||activeKilnInstanceId||null;
}

function forEachKilnSlot(fn){
  if(typeof forEachPlotStructureSlot==='function') forEachPlotStructureSlot('kiln', fn);
}

function countKilnsOnPlot(){
  let n=0;
  forEachKilnSlot(()=>{ n++; });
  return n;
}

function canUseKilnStructure(){
  return (Number(state.skills.architecture?.level)||1)>=KILN_ARCH_UNLOCK;
}

function isKilnUnlocked(){
  migrateKiln();
  return !!state.kilnUnlocked;
}

function isKilnLitUnlocked(){
  migrateKiln();
  return !!state.kilnLitUnlocked;
}

function canPlaceKiln(){
  migrateKiln();
  if(!canUseKilnStructure()) return false;
  if(state.kilnLitUnlocked||state.kilnUnlocked) return true;
  return countKilnsOnPlot()===0;
}

function applyKilnFreePlacedReady(cfg){
  if(!cfg) return;
  KILN_BUILD_MATERIALS.forEach(m=>{ cfg[m.countKey]=m.required; });
  cfg.fired=true;
  cfg.mouldIron=KILN_MOULD_IRON_REQUIRED;
  cfg.moulded=true;
  KILN_FUEL_LOGS.forEach(l=>{ cfg[l.countKey]=KILN_FUEL_LOG_REQUIRED; });
  cfg.fueled=true;
  cfg.lit=true;
  cfg.freePlaced=true;
}

function kilnSlotExists(instanceId){
  let found=false;
  forEachKilnSlot((x,y,slot)=>{ if(slot.instanceId===instanceId) found=true; });
  return found;
}

function totalKilnBuildMaterialsEarned(){
  const totals={ stone:0, clay:0, bricks:0 };
  forEachKilnSlot((x,y,slot)=>{
    const cfg=getKilnConfig(slot.instanceId);
    if(cfg&&!cfg.freePlaced){
      totals.stone+=cfg.stone|0;
      totals.clay+=cfg.clay|0;
      totals.bricks+=cfg.bricks|0;
    }
  });
  return totals;
}

function unlockKilns(){
  if(!state.kilnUnlocked){
    state.kilnUnlocked=true;
    scheduleSaveGame();
  }
}

function migrateKiln(){
  if(state.kilnUnlocked==null) state.kilnUnlocked=false;
  if(state.kilnLitUnlocked==null) state.kilnLitUnlocked=false;
  if(state.kilnLastAction==null) state.kilnLastAction=null;
  if(!state.kilnLastMetalTier) state.kilnLastMetalTier='copper';
  if(!state.kilnMetalRecipeByTier) state.kilnMetalRecipeByTier={};
  if(state.kilnQuickAction==null) state.kilnQuickAction='recipe';
  forEachKilnSlot((x,y,slot)=>{
    normalizeKilnConfig(getPlotConfig(slot.instanceId,'kiln',slot.typeId));
    const cfg=getKilnConfig(slot.instanceId);
    if(isKilnBuildComplete(cfg)) state.kilnUnlocked=true;
    if(isKilnLit(cfg)) state.kilnLitUnlocked=true;
  });
  migrateKilnArchitectureXp();
}

function unlockLitKilns(){
  if(!state.kilnLitUnlocked){
    state.kilnLitUnlocked=true;
    scheduleSaveGame();
  }
}

function getKilnFireLevel(){
  return Number(state.skills?.fire?.level)||1;
}

function canLightKiln(){
  return getKilnFireLevel()>=KILN_LIGHT_FIRE_LEVEL;
}

function migrateKilnArchitectureXp(){
  if(state._kilnArchXpMigrated) return;
  state._kilnArchXpMigrated=true;
  const totals=totalKilnBuildMaterialsEarned();
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

function completeKilnFiring(instanceId){
  instanceId=instanceId||activeKilnInstanceId;
  const cfg=getKilnConfig(instanceId);
  if(!cfg) return;
  const showBanner=!state.kilnUnlocked;
  KILN_BUILD_MATERIALS.forEach(m=>{ cfg[m.countKey]=m.required; });
  cfg.fired=true;
  unlockKilns();
  scheduleSaveGame();
  const refresh=()=>{
    if(typeof updateKilnCells==='function') updateKilnCells();
    if(currentScreen==='kiln-screen') renderKilnScreen();
    syncUI();
  };
  if(showBanner){
    showStructureBuiltBanner({
      bonusKey:'kiln',
      title:'KILN FIRED!',
      icon:'🏺',
      body:'The simple kiln stands — add iron ore for moulds, then stock it with simple-tier logs.',
      btnText:'GOT IT',
      cb:refresh,
    });
  }else{
    refresh();
  }
}

function completeKilnMoulds(instanceId){
  instanceId=instanceId||activeKilnInstanceId;
  const cfg=getKilnConfig(instanceId);
  if(!cfg||!cfg.fired) return;
  const showBanner=typeof isStructureStageBonusPending==='function'
    ?isStructureStageBonusPending('kiln_moulded')
    :!cfg.moulded;
  cfg.mouldIron=KILN_MOULD_IRON_REQUIRED;
  cfg.moulded=true;
  scheduleSaveGame();
  const refresh=()=>{
    if(typeof updateKilnCells==='function') updateKilnCells();
    if(currentScreen==='kiln-screen') renderKilnScreen();
    syncUI();
  };
  if(showBanner){
    showStructureBuiltBanner({
      bonusKey:'kiln_moulded',
      title:'MOULDS FITTED!',
      icon:'🏺',
      body:'Crude iron moulds line the mouth — stock the kiln with simple-tier logs before lighting it.',
      btnText:'GOT IT',
      cb:refresh,
    });
  }else{
    refresh();
  }
}

function completeKilnFuel(instanceId){
  instanceId=instanceId||activeKilnInstanceId;
  const cfg=getKilnConfig(instanceId);
  if(!cfg||!cfg.moulded) return;
  const showBanner=typeof isStructureStageBonusPending==='function'
    ?isStructureStageBonusPending('kiln_fueled')
    :!cfg.fueled;
  KILN_FUEL_LOGS.forEach(l=>{ cfg[l.countKey]=KILN_FUEL_LOG_REQUIRED; });
  cfg.fueled=true;
  scheduleSaveGame();
  const refresh=()=>{
    if(typeof updateKilnCells==='function') updateKilnCells();
    if(currentScreen==='kiln-screen') renderKilnScreen();
    syncUI();
  };
  if(showBanner){
    showStructureBuiltBanner({
      bonusKey:'kiln_fueled',
      title:'KILN STOCKED!',
      icon:'🪵',
      body:'Simple-tier logs fill the firebox — light the kiln when your Fire skill is ready.',
      btnText:'GOT IT',
      cb:refresh,
    });
  }else{
    refresh();
  }
}

function lightKiln(instanceId){
  instanceId=instanceId||activeKilnInstanceId;
  const cfg=getKilnConfig(instanceId);
  if(!cfg||getKilnStage(cfg)!=='unlit'||!isKilnFueled(cfg)) return false;
  if(!canLightKiln()){
    showToast('Need Fire Lv '+KILN_LIGHT_FIRE_LEVEL+' to light the kiln.');
    return false;
  }
  const showBanner=!state.kilnLitUnlocked;
  cfg.lit=true;
  cfg.fueled=true;
  cfg.moulded=true;
  cfg.fired=true;
  unlockLitKilns();
  scheduleSaveGame();
  const refresh=()=>{
    if(typeof updateKilnCells==='function') updateKilnCells();
    if(currentScreen==='kiln-screen') renderKilnScreen();
    syncUI();
  };
  if(showBanner){
    showStructureBuiltBanner({
      bonusKey:'kiln_lit',
      title:'KILN LIT!',
      icon:'🔥',
      body:'The simple kiln roars to life — fire clay, melt glass, and shape vials.',
      btnText:'GOT IT',
      cb:refresh,
    });
  }else{
    showToast('You strike a flame. The kiln glows hot.');
    refresh();
  }
  return true;
}

function placeKilnFuelLog(event, instanceId, logKey){
  instanceId=instanceId||activeKilnInstanceId;
  const logDef=getKilnFuelLogDef(logKey);
  const cfg=getKilnConfig(instanceId);
  if(!logDef||!cfg||!cfg.moulded||cfg.fueled||cfg.lit||cfg.freePlaced) return false;
  const current=cfg[logDef.countKey]|0;
  if(current>=KILN_FUEL_LOG_REQUIRED){
    if(isKilnFueled(cfg)) completeKilnFuel(instanceId);
    return false;
  }
  const def=LOG_DEFS?.[logKey];
  const needed=KILN_FUEL_LOG_REQUIRED-current;
  const available=itemCountBagAndStore(logKey);
  const amount=Math.min(needed, available);
  if(amount<1){
    showToast('You need '+(def?.name||logKey).toLowerCase()+'. Try the woodlands.');
    return false;
  }
  const consumed=consumeUpToFromBagOrStore(logKey, amount);
  if(consumed<1){
    showToast('You need '+(def?.name||logKey).toLowerCase()+'. Try the woodlands.');
    return false;
  }
  cfg[logDef.countKey]=current+consumed;
  if(isKilnFueled(cfg)) completeKilnFuel(instanceId);
  else{
    if(typeof updateKilnCells==='function') updateKilnCells();
    if(currentScreen==='kiln-screen') renderKilnScreen();
    syncUI();
  }
  return true;
}

function placeKilnBuildMaterial(event, instanceId, materialKey){
  instanceId=instanceId||activeKilnInstanceId;
  const mat=getKilnBuildMaterialDef(materialKey);
  const cfg=getKilnConfig(instanceId);
  if(!mat||!cfg||cfg.fired||cfg.freePlaced) return false;
  const current=cfg[mat.countKey]|0;
  if(current>=mat.required){
    if(isKilnBuildComplete(cfg)) completeKilnFiring(instanceId);
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
  const willComplete=isKilnBuildComplete(cfg);
  grantXP('architecture', getKilnArchXpForMaterial(mat.key)*consumed, null, willComplete?{deferLevelUp:true}:null);
  if(willComplete) completeKilnFiring(instanceId);
  else{
    if(typeof updateKilnCells==='function') updateKilnCells();
    if(currentScreen==='kiln-screen') renderKilnScreen();
    syncUI();
  }
  return true;
}

function placeKilnMouldIron(event, instanceId){
  instanceId=instanceId||activeKilnInstanceId;
  const cfg=getKilnConfig(instanceId);
  if(!cfg||!cfg.fired||cfg.moulded||cfg.freePlaced) return false;
  const current=cfg.mouldIron|0;
  if(current>=KILN_MOULD_IRON_REQUIRED){
    completeKilnMoulds(instanceId);
    return false;
  }
  const needed=KILN_MOULD_IRON_REQUIRED-current;
  const available=itemCountBagAndStore('iron_ore');
  const amount=Math.min(needed, available);
  if(amount<1){
    showToast('You need iron ore for the crude moulds.');
    return false;
  }
  const consumed=consumeUpToFromBagOrStore('iron_ore', amount);
  if(consumed<1){
    showToast('You need iron ore for the crude moulds.');
    return false;
  }
  cfg.mouldIron=current+consumed;
  const willComplete=isKilnMoulded(cfg);
  grantXP('architecture', structureArchXpForMaterial('iron_ore')*consumed, null, willComplete?{deferLevelUp:true}:null);
  if(willComplete) completeKilnMoulds(instanceId);
  else{
    if(typeof updateKilnCells==='function') updateKilnCells();
    if(currentScreen==='kiln-screen') renderKilnScreen();
    syncUI();
  }
  return true;
}

function getKilnSkillLevel(skillKey){
  return Number(state.skills?.[skillKey]?.level)||1;
}

function kilnSkillLevelBadge(skillKey, current, required){
  const cls=current>=required?'ok':'low';
  const icon=SKILL_META[skillKey]?.icon||'?';
  return '<span class="plot-add-level-badge '+cls+'">'
    +'<span class="plot-add-level-icon">'+icon+'</span>'
    +'<span class="plot-add-level-text">'+current+'/'+required+'</span>'
    +'</span>';
}

function kilnSkillLevelBadges(action){
  if(!action?.skills) return '';
  const badges=Object.entries(action.skills).map(([skillKey, required])=>{
    const current=getKilnSkillLevel(skillKey);
    if(typeof plotAddLevelBadge==='function'){
      return plotAddLevelBadge(skillKey, current, required, required);
    }
    return kilnSkillLevelBadge(skillKey, current, required);
  }).filter(Boolean);
  if(!badges.length) return '';
  return '<span class="kiln-skill-level-stack">'+badges.join('')+'</span>';
}

function kilnRecipeTitleHtml(action){
  return '<span class="plot-add-item-title">'+action.label+'</span>';
}

function kilnActionCanRun(actionId){
  const action=getKilnActionDef(actionId);
  const cfg=getKilnConfig(activeKilnInstanceId);
  if(!action||!kilnActionAvailable(cfg, actionId)) return { ok:false, reason:'locked' };
  if(action.skills){
    for(const [skillKey, required] of Object.entries(action.skills)){
      const current=getKilnSkillLevel(skillKey);
      if(current<required){
        return { ok:false, reason:'level', skill:skillKey, required, current };
      }
    }
  }
  for(const input of action.inputs||[]){
    if(itemCountBagAndStore(input.key)<input.count){
      const def=MINE_RESOURCE_DEFS?.[input.key];
      return { ok:false, reason:'missing', item:def?.name||input.key };
    }
  }
  const out=action.outputs?.[0];
  if(out&&invTotal()>=getInvCap()) return { ok:false, reason:'full' };
  return { ok:true, action, cfg };
}

function getKilnGlassblowShardChance(action){
  if(!action?.glassblow||!action.shardBonus) return 0;
  const out=action.outputs?.[0];
  if(!out) return 0;
  return Number(MINE_RESOURCE_DEFS?.[out.key]?.unlockLevel)||1;
}

function tryKilnGlassblowShardBonus(action){
  const chance=getKilnGlassblowShardChance(action);
  if(chance<=0||Math.random()*100>=chance) return false;
  const elem=action.shardBonus;
  if(!state.pockets) state.pockets={ fire:0, water:0, earth:0, air:0, magic:0 };
  state.pockets[elem]=(state.pockets[elem]|0)+1;
  return true;
}

function kilnActionFailureToast(check){
  if(!check||check.ok) return;
  if(check.reason==='locked'){
    const cfg=getKilnConfig(activeKilnInstanceId);
    showToast(getKilnStage(cfg)==='unlit'?'Light the kiln first.':'That is not available on this kiln yet.');
  }else if(check.reason==='missing') showToast('You need '+check.item+'.');
  else if(check.reason==='level'){
    const name=SKILL_META[check.skill]?.name||check.skill;
    showToast('Need '+name+' Lv '+check.required+'.');
  }else if(check.reason==='full') showToast('Bag full — make room first.');
}

function doKilnActionAttempt(actionId){
  const check=kilnActionCanRun(actionId);
  if(!check.ok) return { ok:false, check };
  const action=check.action;
  for(const input of action.inputs){
    let left=input.count;
    while(left>0){
      if(!consumeOneFromBagOrStore(input.key)) return { ok:false, check:{ ok:false, reason:'missing', item:input.key } };
      left--;
    }
  }
  for(const output of action.outputs||[]){
    if(output.isNail&&typeof grantNailToStorage==='function'){
      let added=0;
      for(let i=0;i<(output.count|0);i++){
        if(grantNailToStorage(output.key)) added++;
      }
      if(added<(output.count|0)) return { ok:false, check:{ ok:false, reason:'full' } };
      continue;
    }
    const added=invAdd(output.key, output.icon, output.name, output.count);
    if(!added) return { ok:false, check:{ ok:false, reason:'full' } };
  }
  if(action.xp?.fire){
    grantXP('fire', action.xp.fire, null, { deferSync:kilnProcess.running, keepActivities:true });
    if(action.glassblow) grantXP('air', action.xp.fire, null, { deferSync:kilnProcess.running, keepActivities:true });
  }
  if(action.xp?.crafting){
    grantXP('crafting', action.xp.crafting, null, { deferSync:kilnProcess.running, keepActivities:true });
  }
  if(action.xp?.metalworking){
    grantXP('metalworking', action.xp.metalworking, null, { deferSync:kilnProcess.running, keepActivities:true });
  }
  if(action.xp?.architecture) grantXP('architecture', action.xp.architecture, null, { deferSync:kilnProcess.running, keepActivities:true });
  flashSkillPill(getKilnActivitySkillKey());
  state.kilnLastAction=actionId;
  kilnTab=getKilnTabForAction(actionId);
  kilnRecipeByTab[kilnTab]=actionId;
  if(kilnTab==='metal'){
    const tier=getKilnMetalTierForAction(actionId);
    kilnMetalTier=tier;
    state.kilnLastMetalTier=tier;
    kilnRecipeByMetalTier[tier]=actionId;
    state.kilnMetalRecipeByTier[tier]=actionId;
  }
  scheduleSaveGame();
  const shardBonus=tryKilnGlassblowShardBonus(action);
  let logMsg='🏺 '+action.logOk;
  if(action.xp?.crafting) logMsg+=' +'+action.xp.crafting+' Crafting';
  if(action.xp?.metalworking) logMsg+=' +'+action.xp.metalworking+' Metalworking';
  if(action.xp?.architecture) logMsg+=' +'+action.xp.architecture+' Architecture';
  if(shardBonus) logMsg+=' +1 Air shard';
  addActivityLog('kiln-log', logMsg, 'success');
  if(!kilnProcess.running){
    if(shardBonus) showQuickToast?.('💨 +1 Air shard from glassblowing');
    syncUI();
  }
  return { ok:true, action, shardBonus };
}

function performKilnAction(actionId, instanceId){
  instanceId=instanceId||activeKilnInstanceId;
  if(instanceId) setActiveKiln(instanceId);
  if(kilnProcess.running) stopKilnRecipeContinuous(true);
  stopOtherActivities(null);
  const result=doKilnActionAttempt(actionId);
  if(!result.ok){
    kilnActionFailureToast(result.check);
    return false;
  }
  if(currentScreen==='kiln-screen'){
    renderKilnActivitySection();
    renderKilnActivityButtons();
  }
  return true;
}

let kilnRecipeActivity=null;

function kilnTabHasContinuousRecipes(tab){
  return tab==='clay'||tab==='melting'||tab==='blow'||tab==='metal';
}

function kilnContinuousStatusLabel(tab){
  if(tab==='melting') return 'Melting…';
  if(tab==='blow') return 'Blowing…';
  if(tab==='metal') return 'Smelting…';
  return 'Firing…';
}

function kilnContinuousStopLabel(tab){
  if(tab==='melting') return '⛔ STOP MELTING';
  if(tab==='blow') return '⛔ STOP BLOWING';
  if(tab==='metal') return '⛔ STOP SMELTING';
  return '⛔ STOP FIRING';
}

function getKilnRecipeActivity(){
  if(kilnRecipeActivity) return kilnRecipeActivity;
  kilnRecipeActivity=createTimedActivity({
    type:'kiln',
    state:kilnProcess,
    label:'Kiln',
    canContinue:()=>{
      if(!kilnTabHasContinuousRecipes(kilnTab)) return false;
      return kilnActionCanRun(getActiveKilnRecipeKey()).ok;
    },
    cannotStartMsg:'Nothing to craft right now.',
    outOfResourcesMsg:'Out of materials.',
    onAttempt:()=>{
      const result=doKilnActionAttempt(getActiveKilnRecipeKey());
      if(!result.ok){
        kilnActionFailureToast(result.check);
        return false;
      }
      return true;
    },
    onRefresh:()=>{
      if(currentScreen==='kiln-screen'){
        renderKilnActivitySection();
        renderKilnActivityButtons();
      }
    },
  });
  return kilnRecipeActivity;
}

function kilnRecipeContinuous(){
  getKilnRecipeActivity().startContinuous();
}

function stopKilnRecipeContinuous(fromActivitySwitch){
  getKilnRecipeActivity().stop(fromActivitySwitch);
}

function blowKilnContinuous(){
  kilnRecipeContinuous();
}

function stopKilnBlowing(fromActivitySwitch){
  stopKilnRecipeContinuous(fromActivitySwitch);
}

function kilnQuickTapLabel(){
  const action=state.kilnLastAction?getKilnActionDef(state.kilnLastAction):null;
  return action?.quickLabel||'open menu';
}

function kilnQuickTapShortLabel(quickAction){
  if(quickAction==='menu') return 'open menu';
  const label=kilnQuickTapLabel();
  if(label==='open menu') return 'run recipe';
  return label+' (last made)';
}

function kilnQuickTapToggleLabel(quickAction){
  if(quickAction==='menu') return '📋 Open menu';
  const short=kilnQuickTapShortLabel('recipe');
  return '🏺 '+short;
}

function renderKilnQuickTapToggle(){
  const el=document.getElementById('kiln-default-toggle');
  if(!el) return;
  if(state.kilnQuickAction==null) state.kilnQuickAction='recipe';
  el.innerHTML='<button type="button" class="store-shelf-action" style="width:100%" onclick="toggleKilnDefault()">Quick tap: '
    +kilnQuickTapToggleLabel(state.kilnQuickAction)+' (tap to change)</button>';
}

function toggleKilnDefault(){
  state.kilnQuickAction=state.kilnQuickAction==='recipe'?'menu':'recipe';
  updateKilnCellQuickAction();
  renderKilnQuickTapToggle();
  scheduleSaveGame();
  showToast('Quick tap: '+kilnQuickTapShortLabel(state.kilnQuickAction)+'.');
}

function kilnMaterialBtnHtml(m, cfg, required, placeFn){
  const req=required!=null?required:(m.required||0);
  const count=cfg[m.countKey]|0;
  const done=count>=req;
  const canAdd=!done&&itemCountBagAndStore(m.key)>0;
  const def=LOG_DEFS?.[m.key];
  const name=(m.name||def?.name||m.key).toUpperCase();
  const icon=m.icon||def?.icon||'';
  return '<button class="wb-btn once" style="flex:1" '+(done||!canAdd?'disabled':'')+' onclick="'+placeFn+'(event,null,\''+m.key+'\')">'
    +icon+' ADD '+name
    +'<span class="wb-btn-sub">'+count+'/'+req+'</span></button>';
}

function kilnQuickTap(event){
  event?.stopPropagation?.();
  const instanceId=resolveKilnInstanceId(event);
  if(instanceId) setActiveKiln(instanceId);
  const cfg=getKilnConfig(instanceId);
  const stage=getKilnStage(cfg);
  if(stage==='building'){
    const next=KILN_BUILD_MATERIALS.find(m=>(cfg[m.countKey]|0)<m.required&&itemCountBagAndStore(m.key)>0)
      ||KILN_BUILD_MATERIALS.find(m=>(cfg[m.countKey]|0)<m.required);
    if(next) placeKilnBuildMaterial(event, instanceId, next.key);
    return;
  }
  if(stage==='moulding'){
    placeKilnMouldIron(event, instanceId);
    return;
  }
  if(stage==='unlit'){
    if(!isKilnFueled(cfg)){
      const next=KILN_FUEL_LOGS.find(l=>(cfg[l.countKey]|0)<KILN_FUEL_LOG_REQUIRED&&itemCountBagAndStore(l.key)>0)
        ||KILN_FUEL_LOGS.find(l=>(cfg[l.countKey]|0)<KILN_FUEL_LOG_REQUIRED);
      if(next) placeKilnFuelLog(event, instanceId, next.key);
      return;
    }
    openKilnScreen();
    return;
  }
  if(kilnProcess.running&&state.kilnQuickAction==='recipe'){
    openKilnScreen();
    return;
  }
  if(state.kilnQuickAction==='menu'||!state.kilnLastAction){
    openKilnScreen();
    return;
  }
  performKilnAction(state.kilnLastAction, instanceId);
}

function kilnMenuTap(event){
  event?.stopPropagation();
  const instanceId=resolveKilnInstanceId(event);
  if(instanceId) setActiveKiln(instanceId);
  openKilnScreen();
}

function openKilnScreen(){
  migrateKiln();
  if(!activeKilnInstanceId||!kilnSlotExists(activeKilnInstanceId)){
    showToast('Mark out a kiln site on your plot first.');
    return;
  }
  migrateKilnRecipeKeys();
  restoreKilnScreenState();
  showScreen('kiln-screen');
  lastHome='exterior-screen';
  renderKilnScreen();
  syncUI();
}

function closeKilnScreen(){
  if(kilnProcess.running) stopKilnRecipeContinuous(true);
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  syncUI();
}

function renderKilnMaterialGrid(materialKey, count){
  const mat=getKilnBuildMaterialDef(materialKey);
  if(!mat) return '';
  return '<div class="kiln-material-block">'
    +'<div class="kiln-material-title">'+formatRecipeMatTitle(mat.icon, mat.name, mat.required, count)+'</div>'
    +'<div class="well-brick-grid fire-pit-material-grid">'
    +Array.from({ length:mat.required }, (_,i)=>{
      const filled=i<count;
      return '<div class="well-brick-slot'+(filled?' filled':'')+'">'+(filled?mat.icon:'')+'</div>';
    }).join('')
    +'</div></div>';
}

function renderKilnMouldGrid(cfg){
  const iron=cfg?.mouldIron|0;
  return '<div class="kiln-material-block">'
    +'<div class="kiln-material-title">'+formatRecipeMatTitle('🔩', 'Iron ore', KILN_MOULD_IRON_REQUIRED, iron)+'</div>'
    +'<div class="well-brick-grid fire-pit-material-grid">'
    +Array.from({ length:KILN_MOULD_IRON_REQUIRED }, (_,i)=>{
      const filled=i<iron;
      return '<div class="well-brick-slot'+(filled?' filled':'')+'">'+(filled?'🔩':'')+'</div>';
    }).join('')
    +'</div></div>';
}

function getKilnActivitySkillKey(){
  if(kilnTab==='metal') return 'metalworking';
  return 'crafting';
}

function migrateKilnRecipeKeys(){
  if(!kilnRecipeByTab.clay) kilnRecipeByTab.clay='fire_brick';
  if(!kilnRecipeByTab.melting) kilnRecipeByTab.melting='molten_glass';
  if(!kilnRecipeByTab.blow) kilnRecipeByTab.blow='blow_vial';
  if(!kilnRecipeByTab.metal) kilnRecipeByTab.metal='smelt_copper_nails';
  getKilnMetalTierKeys().forEach(tierId=>{
    const saved=state.kilnMetalRecipeByTier?.[tierId];
    const fallback=KILN_METAL_TIERS[tierId]?.actions?.[0];
    if(saved&&KILN_ACTIONS[saved]) kilnRecipeByMetalTier[tierId]=saved;
    else if(fallback) kilnRecipeByMetalTier[tierId]=fallback;
  });
  if(!KILN_METAL_TIERS[kilnMetalTier]){
    kilnMetalTier=(state.kilnLastMetalTier&&KILN_METAL_TIERS[state.kilnLastMetalTier])
      ?state.kilnLastMetalTier
      :(getKilnMetalTierKeys()[0]||'copper');
  }
  if(!state._kilnRecipeTabMigrated){
    state._kilnRecipeTabMigrated=true;
    if(state.kilnLastAction&&KILN_ACTIONS[state.kilnLastAction]){
      const tab=getKilnTabForAction(state.kilnLastAction);
      kilnTab=tab;
      kilnRecipeByTab[tab]=state.kilnLastAction;
      if(tab==='metal'){
        const tier=getKilnMetalTierForAction(state.kilnLastAction);
        kilnMetalTier=tier;
        state.kilnLastMetalTier=tier;
        kilnRecipeByMetalTier[tier]=state.kilnLastAction;
        if(!state.kilnMetalRecipeByTier) state.kilnMetalRecipeByTier={};
        state.kilnMetalRecipeByTier[tier]=state.kilnLastAction;
      }
    }
  }
  if(kilnTab==='metal') syncKilnMetalTierFromRecipe();
}

function restoreKilnScreenState(){
  if(state.kilnLastMetalTier&&KILN_METAL_TIERS[state.kilnLastMetalTier]){
    kilnMetalTier=state.kilnLastMetalTier;
  }
  if(state.kilnLastAction&&KILN_ACTIONS[state.kilnLastAction]){
    kilnTab=getKilnTabForAction(state.kilnLastAction);
    if(kilnTab!=='metal') kilnRecipeByTab[kilnTab]=state.kilnLastAction;
  }
  if(kilnTab==='metal') syncKilnMetalTierFromRecipe();
}

function getActiveKilnMetalTier(){
  if(KILN_METAL_TIERS[kilnMetalTier]) return kilnMetalTier;
  return getKilnMetalTierKeys()[0]||'copper';
}

function syncKilnMetalTierFromRecipe(){
  if(kilnTab!=='metal') return;
  const tier=getActiveKilnMetalTier();
  const key=kilnRecipeByTab.metal;
  if(key&&getKilnMetalTierForAction(key)===tier) return;
  const fallback=kilnRecipeByMetalTier[tier]||getKilnRecipesForMetalTier(tier)[0]?.id;
  if(fallback) kilnRecipeByTab.metal=fallback;
}

function getActiveKilnRecipeKey(){
  migrateKilnRecipeKeys();
  if(kilnTab==='metal') syncKilnMetalTierFromRecipe();
  const key=kilnRecipeByTab[kilnTab];
  if(key&&KILN_ACTIONS[key]) return key;
  const fallback=KILN_TABS[kilnTab]?.actions?.[0];
  if(fallback) kilnRecipeByTab[kilnTab]=fallback;
  return fallback||'fire_brick';
}

function kilnTabHasRecipeChoice(tab){
  return (KILN_TABS[tab]?.actions?.length||0)>1;
}

function kilnInputStockLine(input){
  const def=getKilnItemDef(input.key);
  const stock=itemCountBagAndStore(input.key);
  const has=stock>=(input.count||1);
  return {
    icon:def?.icon||'?',
    name:def?.name||input.key,
    stock,
    has,
    need:input.count||1,
  };
}

function kilnRecipeBlockMessage(check){
  if(!check||check.ok) return '';
  if(check.reason==='locked') return getKilnStage(getKilnConfig(activeKilnInstanceId))==='unlit'?'Light the kiln first.':'Not available on this kiln yet.';
  if(check.reason==='missing') return 'Need '+check.item+'.';
  if(check.reason==='level'){
    const name=SKILL_META[check.skill]?.name||check.skill;
    return 'Need '+name+' Lv '+check.required+'.';
  }
  if(check.reason==='full') return 'Bag full — make room first.';
  return '';
}

function kilnRecipeInputLinesHtml(action, lineClass){
  return (action?.inputs||[]).map(input=>{
    const line=kilnInputStockLine(input);
    return '<span class="'+lineClass+' wb-mat-pick-line '+wbStockClass(line.stock, line.need)+'">'
      +formatRecipeMatLine(line.name, line.need, line.stock)+'</span>';
  }).join('');
}

function kilnRecipeRewardLine(action){
  return getKilnRecipeXpLine(action);
}

function kilnRecipeXpPreview(action){
  if(!action) return '';
  const verb=action.menu==='melting'?'Melt':action.menu==='blow'?'Blow':action.menu==='metal'?'Smelt':'Fire';
  const xp=getKilnRecipeXpLine(action);
  return verb+': '+(xp||'No XP listed');
}

function kilnRecipeUiBlockMessage(check){
  if(!check||check.ok) return '';
  if(check.reason==='missing'||check.reason==='level') return '';
  return kilnRecipeBlockMessage(check);
}

function selectKilnRecipe(actionId){
  const action=getKilnActionDef(actionId);
  if(!action) return;
  const tab=getKilnTabForAction(actionId);
  const prevKey=kilnRecipeByTab[tab];
  if(actionId!==prevKey&&kilnProcess.running) stopKilnRecipeContinuous(true);
  kilnRecipeByTab[tab]=actionId;
  if(tab==='metal'){
    const tier=getKilnMetalTierForAction(actionId);
    kilnMetalTier=tier;
    state.kilnLastMetalTier=tier;
    kilnRecipeByMetalTier[tier]=actionId;
    state.kilnMetalRecipeByTier[tier]=actionId;
    scheduleSaveGame();
  }
  kilnRecipePickerOpen=false;
  renderKilnActivitySection();
  renderKilnActivityButtons();
  renderKilnQuickTapToggle();
}

function selectKilnMetalTier(tierId){
  if(!KILN_METAL_TIERS[tierId]) return;
  if(kilnMetalTier===tierId&&kilnTab==='metal') return;
  if(kilnProcess.running) stopKilnRecipeContinuous(true);
  kilnMetalTier=tierId;
  state.kilnLastMetalTier=tierId;
  const recipe=kilnRecipeByMetalTier[tierId]||getKilnRecipesForMetalTier(tierId)[0]?.id;
  if(recipe){
    kilnRecipeByTab.metal=recipe;
    state.kilnMetalRecipeByTier[tierId]=recipe;
  }
  scheduleSaveGame();
  kilnRecipePickerOpen=true;
  renderKilnActivitySection();
  renderKilnActivityButtons();
}

function toggleKilnRecipePicker(){
  if(!kilnTabHasRecipeChoice(kilnTab)) return;
  kilnRecipePickerOpen=!kilnRecipePickerOpen;
  renderKilnTabPanel(kilnTab);
  renderKilnActivityButtons();
}

function renderKilnMetalTierRowHtml(){
  const tier=getActiveKilnMetalTier();
  return '<div class="fire-pit-tab-row kiln-metal-tier-row">'
    +getKilnMetalTierKeys().map(tierId=>{
      const def=KILN_METAL_TIERS[tierId];
      const active=tier===tierId?' active':'';
      return '<button type="button" class="expedition-tier-btn'+active+'" onclick="selectKilnMetalTier(\''+tierId+'\')">'+def.label+'</button>';
    }).join('')
    +'</div>';
}

function renderKilnMetalRecipePickerList(tierId){
  const cfg=getKilnConfig(activeKilnInstanceId);
  return getKilnRecipesForMetalTier(tierId).map(action=>{
    const display=getKilnRecipeDisplay(action);
    const selected=getActiveKilnRecipeKey()===action.id&&kilnTab==='metal';
    const avail=kilnActionAvailable(cfg, action.id);
    const skillCls=action.skills?' kiln-recipe-option':'';
    return '<div class="wb-mat-option'+skillCls+(selected?' selected':'')+(avail?'':' unavail')+'" onclick="'+(selected?'toggleKilnRecipePicker()':'selectKilnRecipe(\''+action.id+'\')')+'">'
      +'<span class="wb-mat-icon">'+display.icon+'</span>'
      +'<span class="wb-mat-info">'
      +kilnRecipeTitleHtml(action)
      +kilnRecipeInputLinesHtml(action, 'wb-mat-stock')
      +'<span class="wb-mat-stock" style="color:var(--ui-text-dim)">'+kilnRecipeRewardLine(action)+'</span>'
      +'</span>'
      +kilnSkillLevelBadges(action)
      +'</div>';
  }).join('');
}

function renderKilnMetalTabPanel(tab){
  const recipeKey=getActiveKilnRecipeKey();
  const action=getKilnActionDef(recipeKey);
  const el=document.getElementById('kiln-recipe-list-'+tab);
  if(!el||!action) return;
  const tier=getActiveKilnMetalTier();
  const check=kilnActionCanRun(action.id);
  const can=!!check.ok;
  const uiBlock=kilnRecipeUiBlockMessage(check);
  const display=getKilnRecipeDisplay(action);
  const inputLines=kilnRecipeInputLinesHtml(action, 'wb-mat-pick-avail');
  const pickerOpen=kilnRecipePickerOpen&&tab===kilnTab;
  const skillBadges=kilnSkillLevelBadges(action);
  const pickSkillCls=action.skills?' kiln-recipe-pick':'';
  const bodySkillCls=action.skills?' kiln-recipe-pick-body':'';
  let recipesHtml='';
  if(!pickerOpen){
    recipesHtml='<div class="wb-log-pick wb-log-pick-collapsed selected'+pickSkillCls+(can?'':' unavail')+'" onclick="toggleKilnRecipePicker()">'
      +'<span class="wb-mat-icon">'+display.icon+'</span>'
      +'<div class="wb-mat-pick-body'+bodySkillCls+'">'
      +kilnRecipeTitleHtml(action)
      +inputLines
      +'<span class="wb-mat-pick-name" style="font-size:11px;color:var(--ui-text-dim)">'+kilnRecipeRewardLine(action)+'</span>'
      +(uiBlock?'<span class="wb-mat-pick-name" style="font-size:11px;color:rgba(255,110,110,0.92)">'+uiBlock+'</span>':'')
      +'</div>'
      +skillBadges
      +'<span class="wb-log-pick-chevron">▾</span>'
      +'</div>';
  }else{
    recipesHtml='<div class="kiln-metal-recipes">'+renderKilnMetalRecipePickerList(tier)+'</div>';
  }
  el.innerHTML=renderKilnMetalTierRowHtml()+recipesHtml;
  const xpEl=document.getElementById('kiln-xp-preview-'+tab);
  if(xpEl){
    let html='<span class="wb-xp-line">'+kilnRecipeXpPreview(action)+'</span>';
    if(uiBlock) html+='<span class="wb-xp-line">'+uiBlock+'</span>';
    xpEl.innerHTML=html;
  }
}

function renderKilnRecipePickerList(tab){
  const cfg=getKilnConfig(activeKilnInstanceId);
  return getKilnRecipesForTab(tab).map(action=>{
    const display=getKilnRecipeDisplay(action);
    const selected=getActiveKilnRecipeKey()===action.id&&tab===kilnTab;
    const avail=kilnActionAvailable(cfg, action.id);
    const skillCls=action.skills?' kiln-recipe-option':'';
    return '<div class="wb-mat-option'+skillCls+(selected?' selected':'')+(avail?'':' unavail')+'" onclick="'+(selected?'toggleKilnRecipePicker()':'selectKilnRecipe(\''+action.id+'\')')+'">'
      +'<span class="wb-mat-icon">'+display.icon+'</span>'
      +'<span class="wb-mat-info">'
      +kilnRecipeTitleHtml(action)
      +kilnRecipeInputLinesHtml(action, 'wb-mat-stock')
      +'<span class="wb-mat-stock" style="color:var(--ui-text-dim)">'+kilnRecipeRewardLine(action)+'</span>'
      +'</span>'
      +kilnSkillLevelBadges(action)
      +'</div>';
  }).join('');
}

function renderKilnTabPanel(tab){
  if(tab==='metal'){
    renderKilnMetalTabPanel(tab);
    return;
  }
  const recipeKey=tab===kilnTab?getActiveKilnRecipeKey():kilnRecipeByTab[tab];
  const action=getKilnActionDef(recipeKey);
  const el=document.getElementById('kiln-recipe-list-'+tab);
  if(!el||!action) return;
  const check=kilnActionCanRun(action.id);
  const can=!!check.ok;
  const uiBlock=kilnRecipeUiBlockMessage(check);
  const display=getKilnRecipeDisplay(action);
  const inputLines=kilnRecipeInputLinesHtml(action, 'wb-mat-pick-avail');
  const hasChoice=kilnTabHasRecipeChoice(tab);
  const pickerOpen=hasChoice&&kilnRecipePickerOpen&&tab===kilnTab;

  const skillBadges=kilnSkillLevelBadges(action);
  const pickSkillCls=action.skills?' kiln-recipe-pick':'';
  const bodySkillCls=action.skills?' kiln-recipe-pick-body':'';

  if(!hasChoice){
    el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed static'+pickSkillCls+(can?'':' unavail')+'">'
      +'<span class="wb-mat-icon">'+display.icon+'</span>'
      +'<div class="wb-mat-pick-body'+bodySkillCls+'">'
      +kilnRecipeTitleHtml(action)
      +inputLines
      +'<span class="wb-mat-pick-name" style="font-size:11px;color:var(--ui-text-dim)">'+kilnRecipeRewardLine(action)+'</span>'
      +(uiBlock?'<span class="wb-mat-pick-name" style="font-size:11px;color:rgba(255,110,110,0.92)">'+uiBlock+'</span>':'')
      +'</div>'
      +skillBadges
      +'</div>';
  }else if(!pickerOpen){
    el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed selected'+pickSkillCls+(can?'':' unavail')+'" onclick="toggleKilnRecipePicker()">'
      +'<span class="wb-mat-icon">'+display.icon+'</span>'
      +'<div class="wb-mat-pick-body'+bodySkillCls+'">'
      +kilnRecipeTitleHtml(action)
      +inputLines
      +'<span class="wb-mat-pick-name" style="font-size:11px;color:var(--ui-text-dim)">'+kilnRecipeRewardLine(action)+'</span>'
      +(uiBlock?'<span class="wb-mat-pick-name" style="font-size:11px;color:rgba(255,110,110,0.92)">'+uiBlock+'</span>':'')
      +'</div>'
      +skillBadges
      +'<span class="wb-log-pick-chevron">▾</span>'
      +'</div>';
  }else{
    el.innerHTML=renderKilnRecipePickerList(tab);
  }

  const xpEl=document.getElementById('kiln-xp-preview-'+tab);
  if(xpEl){
    let html='<span class="wb-xp-line">'+kilnRecipeXpPreview(action)+'</span>';
    if(uiBlock) html+='<span class="wb-xp-line">'+uiBlock+'</span>';
    xpEl.innerHTML=html;
  }
}

function kilnActionVerb(tab){
  if(tab==='melting') return 'MELT';
  if(tab==='blow') return 'BLOW';
  if(tab==='metal') return 'SMELT';
  return 'FIRE';
}

function renderKilnActivityButtons(){
  const btnEl=document.getElementById('kiln-buttons');
  const statusEl=document.getElementById('kiln-status');
  if(!btnEl) return;
  const recipeKey=getActiveKilnRecipeKey();
  const action=getKilnActionDef(recipeKey);
  const check=action?kilnActionCanRun(action.id):{ ok:false };
  const can=!!check.ok;
  const blockMsg=kilnRecipeBlockMessage(check);
  const uiBlock=kilnRecipeUiBlockMessage(check);
  if(statusEl){
    if(kilnProcess.running&&kilnTabHasContinuousRecipes(kilnTab)) statusEl.textContent=kilnContinuousStatusLabel(kilnTab);
    else statusEl.textContent=uiBlock||blockMsg||'Ready';
    statusEl.classList.toggle('idle',!kilnProcess.running);
  }
  btnEl.hidden=false;
  if(!kilnTabHasContinuousRecipes(kilnTab)){
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn once" style="flex:1" '+(can?'':'disabled')+' onclick="performKilnAction(\''+recipeKey+'\')">'
      +'1 '+kilnActionVerb(kilnTab)
      +'</button></div></div>'
      +(blockMsg&&blockMsg.includes('full')?'<div class="wb-cost-notice">Bag full — make space first.</div>':'');
    return;
  }
  if(kilnProcess.running){
    renderOnceContinuousButtons({
      btnEl,
      running:true,
      stopOnclick:'stopKilnRecipeContinuous()',
      stopLabel:kilnContinuousStopLabel(kilnTab),
    });
    return;
  }
  renderOnceContinuousButtons({
    btnEl,
    running:false,
    can,
    onceLabel:'1 '+kilnActionVerb(kilnTab),
    onceOnclick:'performKilnAction(\''+recipeKey+'\')',
    continuousOnclick:'kilnRecipeContinuous()',
    noticeHtml:blockMsg&&blockMsg.includes('full')?'<div class="wb-cost-notice">Bag full — make space first.</div>':'',
  });
}

function setKilnTab(tab){
  if(!KILN_TABS[tab]) tab='clay';
  if(kilnProcess.running) stopKilnRecipeContinuous(true);
  kilnTab=tab;
  kilnRecipePickerOpen=false;
  if(tab==='metal') syncKilnMetalTierFromRecipe();
  renderKilnActivitySection();
  renderKilnActivityButtons();
}

function renderKilnActivitySection(){
  migrateKilnRecipeKeys();
  renderKilnQuickTapToggle();
  updateActivitySkillPill('kiln', getKilnActivitySkillKey());
  const activitySection=document.getElementById('kiln-activity-section');
  const logEl=document.getElementById('kiln-log');
  if(!activitySection) return;
  activitySection.hidden=false;
  if(logEl) logEl.hidden=false;
  Object.keys(KILN_TABS).forEach(tab=>{
    const btn=document.getElementById('kiln-tab-'+tab);
    if(btn) btn.classList.toggle('active', kilnTab===tab);
    const panel=document.getElementById('kiln-panel-'+tab);
    if(panel) panel.hidden=kilnTab!==tab;
    if(kilnTab===tab) renderKilnTabPanel(tab);
  });
}

function renderKilnFuelGrid(logKey, count){
  const logDef=getKilnFuelLogDef(logKey);
  if(!logDef) return '';
  const def=LOG_DEFS?.[logKey];
  const icon=def?.icon||logDef.icon;
  const name=def?.name||logDef.name;
  return '<div class="kiln-material-block">'
    +'<div class="kiln-material-title">'+formatRecipeMatTitle(icon, name, KILN_FUEL_LOG_REQUIRED, count)+'</div>'
    +'<div class="well-brick-grid fire-pit-material-grid">'
    +Array.from({ length:KILN_FUEL_LOG_REQUIRED }, (_,i)=>{
      const filled=i<count;
      return '<div class="well-brick-slot'+(filled?' filled':'')+'">'+(filled?icon:'')+'</div>';
    }).join('')
    +'</div></div>';
}

function renderKilnLightHtml(){
  const fireLvl=getKilnFireLevel();
  const canDo=canLightKiln();
  return '<div class="well-req-note">The firebox is full — strike a flame when your Fire skill is strong enough.</div>'
    +'<div class="well-req-line'+(canDo?'':' locked')+'">Fire Lv '+KILN_LIGHT_FIRE_LEVEL+' required'
    +(canDo?' ✓':' (you are Lv '+fireLvl+')')+'</div>'
    +'<div class="wb-use-box"><div class="wb-use-btns">'
    +'<button class="wb-btn once" style="flex:1" '+(canDo?'':'disabled')+' onclick="lightKiln()">'
    +'🔥 LIGHT KILN</button></div></div>';
}

function kilnPlotQuickLabel(stage, cfg){
  if(stage==='building') return 'add material';
  if(stage==='moulding') return 'add iron ore';
  if(stage==='unlit'){
    if(!isKilnFueled(cfg)) return 'add log';
    return 'open menu';
  }
  if(kilnProcess.running&&state.kilnQuickAction==='recipe') return 'stop';
  return kilnQuickTapShortLabel(state.kilnQuickAction||'recipe');
}

function renderKilnScreen(){
  migrateKiln();
  const cfg=getKilnConfig(activeKilnInstanceId);
  const stage=getKilnStage(cfg);
  const displayName=getKilnDisplayName(stage);
  updateActivitySkillPill('kiln', getKilnActivitySkillKey());
  const titleEl=document.querySelector('#kiln-screen .top-bar-title');
  const nameEl=document.querySelector('#kiln-screen .wb-item-name');
  const subEl=document.getElementById('kiln-subtitle');
  const buildSection=document.getElementById('kiln-build-section');
  const reqEl=document.getElementById('kiln-requirements');
  const activitySection=document.getElementById('kiln-activity-section');
  const logEl=document.getElementById('kiln-log');
  const statusEl=document.getElementById('kiln-status');
  const btnEl=document.getElementById('kiln-buttons');
  const countEl=document.getElementById('kiln-progress-count');
  const gridsEl=document.getElementById('kiln-material-grids');
  if(titleEl) titleEl.textContent=displayName;
  if(nameEl) nameEl.textContent=displayName;
  if(subEl){
    subEl.textContent=stage==='building'
      ?'Lay stone, clay, and bricks to build the kiln'
      :stage==='moulding'
      ?'Moulds still needed — add iron ore for glass shaping'
      :stage==='unlit'
      ?(isKilnFueled(cfg)
        ?'Logs stacked — light the kiln when your Fire skill is ready'
        :'Stock the kiln with simple-tier logs')
      :'Smelt clay, melt glass, or blow vessels';
  }
  if(buildSection) buildSection.hidden=stage!=='building';
  if(countEl){
    countEl.hidden=stage!=='building';
    if(stage==='building'){
      const progress=getKilnBuildProgress(cfg);
      const total=getKilnTotalBuildRequired();
      countEl.textContent=progress+' / '+total+' materials placed';
    }
  }
  if(gridsEl){
    gridsEl.hidden=stage!=='building';
    if(stage==='building'){
      gridsEl.innerHTML=KILN_BUILD_MATERIALS.map(m=>renderKilnMaterialGrid(m.key, cfg[m.countKey]|0)).join('');
    }
  }
  if(reqEl){
    if(stage==='moulding'){
      reqEl.hidden=false;
      reqEl.innerHTML=renderKilnMouldGrid(cfg)
        +'<div class="well-req-note">Crude moulds for basic glass shaping.</div>';
    }else if(stage==='unlit'){
      reqEl.hidden=false;
      const fuelProgress=getKilnFuelProgress(cfg);
      const fuelTotal=getKilnTotalFuelRequired();
      reqEl.innerHTML='<div class="kiln-progress-count">'+fuelProgress+' / '+fuelTotal+' logs placed</div>'
        +KILN_FUEL_LOGS.map(l=>renderKilnFuelGrid(l.key, cfg[l.countKey]|0)).join('')
        +(isKilnFueled(cfg)?renderKilnLightHtml():'<div class="well-req-note">50 of each simple-tier log — logs, ashwood, and teak.</div>');
    }else{
      reqEl.hidden=true;
      reqEl.innerHTML='';
    }
  }
  if(activitySection){
    if(stage==='complete') renderKilnActivitySection();
    else activitySection.hidden=true;
  }
  if(logEl) logEl.hidden=stage!=='complete';
  if(statusEl){
    statusEl.classList.add('idle');
    if(stage!=='complete'){
      if(stage==='unlit'){
        statusEl.textContent=isKilnFueled(cfg)
          ?'Simple kiln (unlit) — light with Fire Lv '+KILN_LIGHT_FIRE_LEVEL
          :'Simple kiln (unlit) — add simple-tier logs to the firebox';
      }else if(stage==='moulding'){
        statusEl.textContent='Use the button below to add iron ore';
      }else{
        statusEl.textContent='Use the button below to add materials';
      }
    }
  }
  if(btnEl&&stage!=='complete'){
    if(stage==='building'){
      const showBuild=KILN_BUILD_MATERIALS.some(m=>(cfg[m.countKey]|0)<m.required);
      btnEl.hidden=!showBuild;
      btnEl.innerHTML=showBuild
        ?'<div class="wb-use-box"><div class="wb-use-btns kiln-use-btns">'
          +KILN_BUILD_MATERIALS.map(m=>kilnMaterialBtnHtml(m, cfg, m.required, 'placeKilnBuildMaterial')).join('')
          +'</div></div>'
        :'';
    }else if(stage==='moulding'){
      const ironLeft=(cfg.mouldIron|0)<KILN_MOULD_IRON_REQUIRED;
      const canAdd=ironLeft&&itemCountBagAndStore('iron_ore')>0;
      btnEl.hidden=!ironLeft;
      btnEl.innerHTML=ironLeft
        ?'<div class="wb-use-box"><div class="wb-use-btns kiln-use-btns">'
          +'<button class="wb-btn once" style="flex:1" '+(!canAdd?'disabled':'')+' onclick="placeKilnMouldIron(event)">🔩 ADD IRON ORE'
          +'<span class="wb-btn-sub">'+(cfg.mouldIron|0)+'/'+KILN_MOULD_IRON_REQUIRED+'</span></button></div></div>'
        :'';
    }else if(stage==='unlit'&&!isKilnFueled(cfg)){
      const html=KILN_FUEL_LOGS.some(l=>(cfg[l.countKey]|0)<KILN_FUEL_LOG_REQUIRED)
        ?'<div class="wb-use-box"><div class="wb-use-btns kiln-use-btns">'
          +KILN_FUEL_LOGS.map(l=>kilnMaterialBtnHtml(l, cfg, KILN_FUEL_LOG_REQUIRED, 'placeKilnFuelLog')).join('')
          +'</div></div>'
        :'';
      btnEl.hidden=!html;
      btnEl.innerHTML=html;
    }else{
      btnEl.hidden=true;
      btnEl.innerHTML='';
    }
  }
  if(stage==='complete') renderKilnActivityButtons();
}

function updateKilnCells(){
  migrateKiln();
  document.querySelectorAll('.plot-cell.cell-kiln').forEach(cell=>{
    const cfg=getKilnConfig(cell.dataset.instanceId);
    const vis=getKilnVisualState(cfg);
    const stage=getKilnStage(cfg);
    cell.classList.remove('kiln-stage-1','kiln-stage-2','kiln-stage-3','kiln-moulding','kiln-unlit','kiln-complete','kiln-building');
    cell.classList.add('kiln-'+vis.stage);
    const icon=cell.querySelector('.kiln-icon');
    const label=cell.querySelector('.kiln-label');
    if(icon) icon.textContent=vis.icon;
    if(label) label.textContent=vis.label;
    const quickBtn=cell.querySelector('.kiln-quick-action-btn');
    if(quickBtn) quickBtn.textContent=kilnPlotQuickLabel(stage, cfg);
    const top=cell.querySelector('.kiln-activity-top');
    if(top){
      top.classList.remove('kiln-stage-1','kiln-stage-2','kiln-stage-3','kiln-moulding','kiln-unlit','kiln-complete','kiln-building');
      top.classList.add('kiln-'+vis.stage);
    }
  });
}

function updateKilnCellQuickAction(){
  document.querySelectorAll('.plot-cell.cell-kiln').forEach(cell=>{
    const cfg=getKilnConfig(cell.dataset.instanceId);
    const stage=getKilnStage(cfg);
    const btn=cell.querySelector('.kiln-quick-action-btn');
    if(!btn) return;
    btn.textContent=kilnPlotQuickLabel(stage, cfg);
  });
}
