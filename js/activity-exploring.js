/* Hearthstead — exploring / expeditions */
'use strict';

function resetExpeditionTrekUi(){
  explore.running=false;
  clearTimeout(expeditionTimer);
  expeditionTimer=null;
  hideExpeditionTrekOverlay();
}

function resolveExploreDestinationKeyFromPlot(typeId, x, y){
  const def=typeId&&typeof getPlotTileDef==='function'?getPlotTileDef(typeId):null;
  if(def?.expeditionKey) return def.expeditionKey;
  if(typeId==='whispering_woods') return 'whispering_woods';
  if(typeId==='sunken_shallows') return 'sunken_shallows';
  if(typeof getPlotFeatureTileAt==='function'&&x!=null&&y!=null){
    const feat=getPlotFeatureTileAt(x,y);
    if(feat?.typeId==='sunken_shallows') return 'sunken_shallows';
    if(feat?.typeId==='whispering_woods') return 'whispering_woods';
  }
  return 'cave';
}

function findExplorePlotSlot(instanceId){
  if(!instanceId) return null;
  if(typeof findPlotSlotByInstanceId==='function'){
    const found=findPlotSlotByInstanceId(instanceId);
    if(found) return found;
  }
  if(typeof findPlotCoordForInstanceId==='function') return findPlotCoordForInstanceId(instanceId);
  return null;
}

function openExploringMenu(instanceId){
  resetExpeditionTrekUi();
  explore.destinationKey='cave';
  explore.plotX=null;
  explore.plotY=null;
  if(instanceId){
    explore.instanceId=instanceId;
    const found=findExplorePlotSlot(instanceId);
    explore.plotX=found?.x??null;
    explore.plotY=found?.y??null;
    explore.destinationKey=resolveExploreDestinationKeyFromPlot(found?.slot?.typeId, found?.x, found?.y);
  }else{
    explore.instanceId=null;
  }
  explore.focusFishId=null;
  explore.focusMedicineKey=null;
  explore.eitherChoice=null;
  explore.reqSubmenu=null;
  syncExploreTierToUnlocked();
  showScreen('exploring-screen');
  lastHome='exterior-screen';
  renderExploring();
}

function getExplorePlotSlot(){
  if(!explore.instanceId) return null;
  const found=findExplorePlotSlot(explore.instanceId);
  if(found){
    explore.plotX=found.x;
    explore.plotY=found.y;
  }
  return found;
}

function getExplorePlotTileDef(){
  const found=getExplorePlotSlot();
  const typeId=found?.slot?.typeId;
  return typeId&&typeof getPlotTileDef==='function'?getPlotTileDef(typeId):null;
}

function syncExploreDestinationFromPlot(){
  const found=getExplorePlotSlot();
  explore.destinationKey=resolveExploreDestinationKeyFromPlot(found?.slot?.typeId, found?.x, found?.y);
}

function resolveExploreDestinationFromInstance(){
  syncExploreDestinationFromPlot();
}

function getExploreDestinationKey(){
  syncExploreDestinationFromPlot();
  return explore.destinationKey||'cave';
}

function getExploreHeaderDisplay(){
  const destKey=getExploreDestinationKey();
  const dest=getExpeditionDestination(destKey);
  const tileDef=getExplorePlotTileDef();
  if(destKey!=='cave') return { label:dest.label||destKey, icon:dest.icon||'🧭' };
  if(tileDef?.expeditionKey){
    const linked=getExpeditionDestination(tileDef.expeditionKey);
    return {
      label:linked.label||tileDef.name||tileDef.expeditionKey,
      icon:linked.icon||tileDef.icon||'🧭',
    };
  }
  if(tileDef?.name) return { label:tileDef.name, icon:tileDef.icon||'🕳️' };
  return { label:'Cave', icon:'🕳️' };
}

function closeExploring(){
  if(explore.running){
    showToast('Wait for the expedition to finish.');
    return;
  }
  explore.reqSubmenu=null;
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  flushActivityUi('screen');
}

function getExploreDestination(){
  return getExpeditionDestination(getExploreDestinationKey());
}

function getExploreTierDef(){
  return getExpeditionTierDef(getExploreDestinationKey(), explore.tier);
}

function expeditionRollCacheKey(tierKey){
  const dest=getExploreDestinationKey();
  return dest==='cave'?tierKey:(dest+'_'+tierKey);
}

function getExpeditionAdjacentCampTier(){
  const destKey=getExploreDestinationKey();
  const dest=getExpeditionDestination(destKey);
  if(!dest.requiresAdjacentCamp||!explore.instanceId) return 0;
  const behavior=typeof getExpeditionAdjacentCampBehavior==='function'
    ?getExpeditionAdjacentCampBehavior(destKey)
    :null;
  if(!behavior) return 0;
  let tier=0;
  if(behavior==='coastal_docks'&&typeof getAdjacentCoastalDocksTierForShallows==='function'){
    tier=getAdjacentCoastalDocksTierForShallows(explore.instanceId);
  }else if(behavior==='whisper_camp'&&typeof getAdjacentWhisperCampTierForWoods==='function'){
    tier=getAdjacentWhisperCampTierForWoods(explore.instanceId);
  }else if(typeof getAdjacentPlotCampTier==='function'){
    const tierFn=behavior==='coastal_docks'?getCoastalDocksExpeditionTier
      :behavior==='whisper_camp'?getWhisperCampExpeditionTier
      :null;
    if(tierFn) tier=getAdjacentPlotCampTier(explore.instanceId, behavior, tierFn);
  }
  if(tier>0) return tier;
  if(explore.plotX==null||explore.plotY==null||typeof getAdjacentPlotCampTierAt!=='function') return 0;
  const tierFn=behavior==='coastal_docks'?getCoastalDocksExpeditionTier
    :behavior==='whisper_camp'?getWhisperCampExpeditionTier
    :null;
  return tierFn?getAdjacentPlotCampTierAt(explore.plotX, explore.plotY, behavior, tierFn):0;
}

function getAdjacentCampTierForExplore(){
  return getExpeditionAdjacentCampTier();
}

function syncExploreTierToUnlocked(){
  const destKey=getExploreDestinationKey();
  const order=getExpeditionTierOrder(destKey);
  if(isExploreTierUnlocked(explore.tier)) return;
  const firstUnlocked=order.find(t=>isExploreTierUnlocked(t));
  if(firstUnlocked) explore.tier=firstUnlocked;
}

function isExploreTierUnlocked(tierKey){
  const destKey=getExploreDestinationKey();
  const dest=getExpeditionDestination(destKey);
  const tierDef=getExpeditionTierDef(destKey, tierKey);
  const campReq=tierDef.campTierRequired|0;
  if(!campReq) return true;
  if(dest.requiresAdjacentCamp){
    if(!explore.instanceId) return false;
    const campTier=getAdjacentCampTierForExplore();
    return (campTier|0)>=campReq;
  }
  return true;
}

function getExpeditionCampGateMessage(tierKey){
  const destKey=getExploreDestinationKey();
  const dest=getExpeditionDestination(destKey);
  if(!dest.requiresAdjacentCamp) return null;
  const tierDef=getExpeditionTierDef(destKey, tierKey||explore.tier);
  const campReq=tierDef?.campTierRequired|0;
  if(!campReq||isExploreTierUnlocked(tierKey||explore.tier)) return null;
  const campName=typeof getExpeditionCampDisplayName==='function'
    ?getExpeditionCampDisplayName(destKey)
    :(destKey==='sunken_shallows'?'Coastal Docks':'Whispering Woods Camp');
  const tierName=destKey==='sunken_shallows'&&typeof coastalDocksDisplayTierName==='function'
    ?coastalDocksDisplayTierName(campReq)
    :(typeof whisperCampDisplayTierName==='function'?whisperCampDisplayTierName(campReq):('Tier '+campReq));
  if(campReq<=1){
    return 'Requires '+campName+' — not currently built';
  }
  return 'Requires '+campName+' ('+tierName+') — not currently built';
}

function ensureExpeditionStaminaRequired(tierKey){
  const key=expeditionRollCacheKey(tierKey);
  if(!state.exploreStaminaRolls) state.exploreStaminaRolls={};
  if(state.exploreStaminaRolls[key]==null){
    state.exploreStaminaRolls[key]=rollExpeditionStaminaRequired(tierKey, getExploreDestinationKey());
    scheduleSaveGame();
  }
  return state.exploreStaminaRolls[key];
}

function ensureExpeditionHealingRequired(tierKey){
  const key=expeditionRollCacheKey(tierKey);
  if(!state.exploreHealingRolls) state.exploreHealingRolls={};
  if(state.exploreHealingRolls[key]==null){
    state.exploreHealingRolls[key]=rollExpeditionHealingRequired(tierKey, getExploreDestinationKey());
    scheduleSaveGame();
  }
  return state.exploreHealingRolls[key];
}

function ensureExpeditionTorchRequired(tierKey){
  const dest=getExploreDestinationKey();
  if(dest==='whispering_woods'){
    const tierDef=getExpeditionTierDef(dest, tierKey);
    const req=getExpeditionReqByType(tierDef, EXPEDITION_REQ_TYPE.TORCH, dest);
    return req&&isExpeditionRequirementEnabled(req)?Number(req.value)||0:0;
  }
  if(dest==='sunken_shallows'){
    const tierDef=getExpeditionTierDef(dest, tierKey);
    const req=getExpeditionReqByType(tierDef, EXPEDITION_REQ_TYPE.TORCH, dest);
    return req&&isExpeditionRequirementEnabled(req)?Number(req.value)||0:0;
  }
  const key=expeditionRollCacheKey(tierKey);
  if(!state.exploreTorchRolls) state.exploreTorchRolls={};
  const tierDef=getExpeditionTierDef(getExploreDestinationKey(), tierKey);
  if(!expeditionSlotNeeded(tierDef, 'torch')) return 0;
  if(state.exploreTorchRolls[key]==null){
    state.exploreTorchRolls[key]=rollExpeditionTorchesRequired(tierKey, getExploreDestinationKey());
    scheduleSaveGame();
  }
  return state.exploreTorchRolls[key];
}

function selectExpeditionTier(key){
  const destKey=getExploreDestinationKey();
  const order=getExpeditionTierOrder(destKey);
  if(!order.includes(key)) return;
  explore.tier=key;
  explore.focusFishId=null;
  explore.focusMedicineKey=null;
  explore.eitherChoice=null;
  explore.reqSubmenu=null;
  renderExploring();
}

function setExploreEitherChoice(choice){
  if(choice!==EXPEDITION_REQ_TYPE.MEDICINE&&choice!==EXPEDITION_REQ_TYPE.TORCH) return;
  explore.eitherChoice=choice;
  explore.reqSubmenu=null;
  renderExploring();
}

function setExploreMedicineFocus(medicineKey){
  explore.focusMedicineKey=medicineKey||null;
  renderExploring();
}

function toggleExploreReqSubmenu(slotKey, event){
  event?.stopPropagation?.();
  const tierDef=getExploreTierDef();
  const reqType=EXPEDITION_SLOT_TO_REQ_TYPE[slotKey];
  if(expeditionRequiresEitherChoice(tierDef)&&reqType&&(reqType===EXPEDITION_REQ_TYPE.MEDICINE||reqType===EXPEDITION_REQ_TYPE.TORCH)){
    explore.eitherChoice=reqType;
  }
  explore.reqSubmenu=explore.reqSubmenu===slotKey?null:slotKey;
  renderExploring();
}

function setExploreStaminaFocus(fishId){
  explore.focusFishId=fishId||null;
  renderExploring();
}

function getAvailableExpeditionRations(){
  const items=[];
  Object.entries(FISH_DEFS).forEach(([fishId,fish])=>{
    const recipe=COOKING_RECIPES[fishId];
    if(!recipe) return;
    const count=itemCountBagAndStore(recipe.cookedKey);
    if(count<=0) return;
    items.push({
      fishId,
      key:recipe.cookedKey,
      icon:recipe.cookedIcon,
      name:recipe.cookedName,
      stamina:fish.stamina,
      count,
    });
  });
  items.sort((a,b)=>a.stamina-b.stamina || a.name.localeCompare(b.name));
  return items;
}

function getAvailableExpeditionMedicine(){
  const items=[];
  EXPEDITION_MEDICINE_ITEMS.forEach(def=>{
    const count=itemCountBagAndStore(def.key);
    if(count<=0) return;
    const itemDef=(typeof getBotanyItemDef==='function'?getBotanyItemDef(def.key):null)
      ||(typeof getFabricItemDef==='function'?getFabricItemDef(def.key):null);
    items.push({
      medicineKey:def.key,
      key:def.key,
      icon:itemDef?.icon||'💊',
      name:itemDef?.name||def.key,
      recovery:def.recovery,
      count,
    });
  });
  items.sort((a,b)=>a.recovery-b.recovery || a.name.localeCompare(b.name));
  return items;
}

function getAvailableMedicineTypes(){
  return getAvailableExpeditionMedicine().map(item=>({
    medicineKey:item.medicineKey,
    icon:item.icon,
    name:item.name,
    recovery:item.recovery,
    count:item.count,
  }));
}

function expeditionRequirementAppliesForTier(tierDef, type){
  return typeof expeditionRequirementApplies==='function'&&expeditionRequirementApplies(tierDef, type);
}

function getExpeditionRequirementPlans(tierDef){
  const tierKey=tierDef?.key||explore.tier;
  const destKey=getExploreDestinationKey();
  const staminaReq=getExpeditionReqByType(tierDef, EXPEDITION_REQ_TYPE.STAMINA, destKey);
  const medicineReq=getExpeditionReqByType(tierDef, EXPEDITION_REQ_TYPE.MEDICINE, destKey);
  const requiredStamina=isExpeditionRequirementEnabled(staminaReq)?ensureExpeditionStaminaRequired(tierKey):0;
  const medicineRequired=isExpeditionRequirementEnabled(medicineReq);
  const requiredHealing=medicineRequired?ensureExpeditionHealingRequired(tierKey):0;
  return {
    stamina:requiredStamina>0?planExpeditionStamina(requiredStamina, explore.focusFishId):{ sufficient:true, required:0, totalAvailable:0, plan:[] },
    medicine:requiredHealing>0?planExpeditionMedicine(requiredHealing, explore.focusMedicineKey):{ sufficient:true, required:0, totalAvailable:0, plan:[] },
  };
}

function evaluateExpeditionRequirement(tierDef, req, plans){
  const type=req?.type;
  const tierKey=tierDef?.key||explore.tier;
  switch(type){
    case EXPEDITION_REQ_TYPE.STAMINA:
      return { met:!!plans.stamina?.sufficient, type, reason:'stamina' };
    case EXPEDITION_REQ_TYPE.MEDICINE:
      return { met:!!plans.medicine?.sufficient, type, reason:'medicine' };
    case EXPEDITION_REQ_TYPE.TORCH:{
      const need=Number(req?.value)||ensureExpeditionTorchRequired(tierKey);
      const have=countExpeditionSupply('torch');
      return { met:have>=need, type, reason:'torch', need, have };
    }
    case EXPEDITION_REQ_TYPE.POTION:{
      const need=Number(req?.value)||0;
      const have=typeof countExpeditionPotionsAvailable==='function'?countExpeditionPotionsAvailable():0;
      return { met:have>=need, type, reason:'potion', need, have };
    }
    case EXPEDITION_REQ_TYPE.ARMOUR:
      return {
        met:typeof isExpeditionArmourRequirementMet==='function'&&isExpeditionArmourRequirementMet(),
        type, reason:'armour',
      };
    case EXPEDITION_REQ_TYPE.EARTH_AFFINITY:{
      const need=Number(req?.value)||0;
      const have=typeof getEarthAffinityLevel==='function'?getEarthAffinityLevel():0;
      return { met:have>=need, type, reason:'earth_affinity', need, have };
    }
    case EXPEDITION_REQ_TYPE.DEFENSE_RATING:
      return {
        met:typeof isExpeditionDefenseRatingMet==='function'?isExpeditionDefenseRatingMet()
          :(typeof isExpeditionArmourRequirementMet==='function'&&isExpeditionArmourRequirementMet()),
        type, reason:'defense_rating',
      };
    case EXPEDITION_REQ_TYPE.EMPTY_BUCKET:{
      const need=Number(req?.value)||1;
      const have=typeof countEmptyBucketsAvailable==='function'?countEmptyBucketsAvailable():0;
      return { met:have>=need, type, reason:'empty_bucket', need, have };
    }
    case EXPEDITION_REQ_TYPE.WATER_AFFINITY:{
      const need=Number(req?.value)||0;
      const have=typeof getWaterAffinityLevel==='function'?getWaterAffinityLevel():0;
      return { met:have>=need, type, reason:'water_affinity', need, have };
    }
    case EXPEDITION_REQ_TYPE.FIRE_AFFINITY:{
      const need=Number(req?.value)||0;
      const have=typeof getFireAffinityLevel==='function'?getFireAffinityLevel():0;
      return { met:have>=need, type, reason:'fire_affinity', need, have };
    }
    case EXPEDITION_REQ_TYPE.INFUSED_CHARM:{
      const need=Number(req?.value)||20;
      const have=typeof countInfusedCharmsInStorage==='function'?countInfusedCharmsInStorage():0;
      return { met:have>=need, type, reason:'infused_charm', need, have };
    }
    case EXPEDITION_REQ_TYPE.EQUIPPED_TOOL:{
      const toolKey=req.toolKey||INCINERATING_AXE_KEY;
      let met=false;
      if(toolKey===INCINERATING_AXE_KEY){
        met=typeof isIncineratingAxeEquipped==='function'&&isIncineratingAxeEquipped();
      }else if(typeof SUNKEN_SHALLOWS_TOOL_KEY!=='undefined'&&toolKey===SUNKEN_SHALLOWS_TOOL_KEY){
        met=typeof isSunkenShallowsToolEquipped==='function'&&isSunkenShallowsToolEquipped();
      }
      return { met, type, reason:'equipped_tool' };
    }
    default:
      return { met:true, type:type||'unknown', reason:null };
  }
}

/** Loop dynamic tier requirements to verify the player can launch. */
function verifyExpeditionLaunch(tierDef, plans){
  const destKey=getExploreDestinationKey();
  const reqs=getExpeditionRequirements(tierDef, destKey);

  for(const req of reqs){
    if(!isExpeditionRequirementEnabled(req)||req.either||req.type===EXPEDITION_REQ_TYPE.RESERVED) continue;
    const check=evaluateExpeditionRequirement(tierDef, req, plans);
    if(!check.met) return { ready:false, reason:check.reason, failedType:req.type, check };
  }

  const eitherGroups=groupExpeditionEitherRequirements(tierDef);
  for(const groupReqs of Object.values(eitherGroups)){
    if(groupReqs.length<2) continue;
    if(!explore.eitherChoice||!groupReqs.some(r=>r.type===explore.eitherChoice)){
      return { ready:false, reason:'either', failedType:null };
    }
    const selected=groupReqs.find(r=>r.type===explore.eitherChoice);
    const check=evaluateExpeditionRequirement(tierDef, selected, plans);
    if(!check.met) return { ready:false, reason:check.reason, failedType:selected.type, check };
  }

  return { ready:true };
}

function expeditionLaunchBlockMessage(supplies){
  switch(supplies.reason){
    case 'stamina': return 'Not enough rations packed for this expedition.';
    case 'either': return 'Pick medicine or a torch for this expedition.';
    case 'medicine': return 'Not enough medicine packed for this expedition.';
    case 'torch': return 'Not enough torches packed for this expedition.';
    case 'potion': return 'Not enough travel potions packed for this expedition.';
    case 'armour': return 'Equip body armour before departing on this trek.';
    case 'defense_rating': return 'Equip body armour before departing on this trek.';
    case 'empty_bucket': return 'Pack enough empty buckets before departing on this trek.';
    case 'earth_affinity': return 'Your Earth affinity is too low for this trek.';
    case 'water_affinity': return 'Your Water affinity is too low for this trek.';
    case 'fire_affinity': return 'Your Fire affinity is too low for this trek.';
    case 'infused_charm': return 'Not enough Infused Charms in storage for this trek.';
    case 'equipped_tool':{
      const destKey=getExploreDestinationKey();
      if(destKey==='sunken_shallows') return 'Bind a Bronze Pickaxe to your tool store before departing.';
      return 'Equip the required tool in your tool store before departing.';
    }
    default: return 'Expedition requirements not met.';
  }
}

function totalMedicineRecoveryAvailable(){
  return getAvailableExpeditionMedicine().reduce((sum,item)=>sum+(item.count*item.recovery), 0);
}

function planExpeditionMedicine(required, focusMedicineKey){
  const totalAvailable=totalMedicineRecoveryAvailable();
  let items=getAvailableExpeditionMedicine();
  if(focusMedicineKey) items=items.filter(item=>item.medicineKey===focusMedicineKey);
  items.sort((a,b)=>a.recovery-b.recovery || a.name.localeCompare(b.name));

  let remaining=required;
  const plan=[];
  for(const item of items){
    if(remaining<=0) break;
    const useCount=Math.min(item.count, Math.ceil(remaining/item.recovery));
    if(useCount<=0) continue;
    plan.push({ ...item, useCount });
    remaining-=useCount*item.recovery;
  }

  const totalProvided=plan.reduce((sum,line)=>sum+(line.useCount*line.recovery),0);
  const sufficient=totalProvided>=required;

  if(focusMedicineKey && !sufficient){
    const focusItem=items[0];
    const recovery=focusItem?.recovery||getExpeditionMedicineDef(focusMedicineKey)?.recovery||1;
    const typeHave=items.reduce((sum,item)=>sum+item.count,0);
    const typeNeed=Math.ceil(required/recovery);
    return {
      plan:[],
      focusSummary:{
        medicineKey:focusMedicineKey,
        icon:focusItem?.icon||'💊',
        name:focusItem?.name||focusMedicineKey,
        have:typeHave,
        need:typeNeed,
        recovery,
      },
      totalProvided,
      totalAvailable,
      required,
      sufficient:false,
      remaining:Math.max(0, required-totalProvided),
    };
  }

  const displayPlan=plan.map(line=>({
    ...line,
    displayHave:line.count,
    displayNeed:line.useCount,
  }));

  return {
    plan:displayPlan,
    focusSummary:null,
    totalProvided,
    totalAvailable,
    required,
    sufficient,
    remaining:Math.max(0, required-totalProvided),
  };
}

function getAvailableExpeditionTorches(){
  const def=getSimpleTorchDef();
  const count=itemCountBagAndStore(SIMPLE_TORCH_KEY);
  if(count<1) return [];
  return [{ key:SIMPLE_TORCH_KEY, icon:def.icon, name:def.name, count }];
}

function countExpeditionSupply(slotKey){
  if(slotKey==='medicine') return getAvailableExpeditionMedicine().reduce((sum,i)=>sum+i.count, 0);
  if(slotKey==='torch') return getAvailableExpeditionTorches().reduce((sum,i)=>sum+i.count, 0);
  return 0;
}

function expeditionReadyStatusText(tierDef, plans, supplies){
  if(supplies.ready) return 'All supplies packed • ready to depart';
  if(supplies.reason==='either') return 'Pick medicine or a torch';
  const tierKey=tierDef?.key||explore.tier;
  if(supplies.reason==='stamina'){
    if(!getAvailableExpeditionRations().length) return 'Cook fish and pack available rations';
    return 'Need '+(plans.stamina.required-plans.stamina.totalAvailable)+' more stamina from rations';
  }
  if(supplies.reason==='medicine'){
    if(!getAvailableExpeditionMedicine().length) return 'Craft bandages for medicine supplies';
    return 'Need '+(plans.medicine.required-plans.medicine.totalAvailable)+' more recovery from medicine';
  }
  if(supplies.reason==='torch'){
    const need=ensureExpeditionTorchRequired(tierKey);
    const have=countExpeditionSupply('torch');
    if(!getAvailableExpeditionTorches().length) return 'Light torches at the fire pit (Light tab)';
    if(have<need) return 'Need '+(need-have)+' more torch'+(need-have===1?'':'es')+' packed';
    return 'Pack torches for this expedition';
  }
  if(supplies.reason==='potion'){
    const req=getExpeditionReqByType(tierDef, EXPEDITION_REQ_TYPE.POTION, getExploreDestinationKey());
    const need=Number(req?.value)||0;
    const have=typeof countExpeditionPotionsAvailable==='function'?countExpeditionPotionsAvailable():0;
    if(have<need) return 'Need '+(need-have)+' more travel potion'+(need-have===1?'':'s')+' packed';
    return 'Pack travel potions for this trek';
  }
  if(supplies.reason==='armour') return 'Equip copper or bronze body armour';
  if(supplies.reason==='earth_affinity'){
    const req=getExpeditionReqByType(tierDef, EXPEDITION_REQ_TYPE.EARTH_AFFINITY, getExploreDestinationKey());
    const need=Number(req?.value)||0;
    const have=typeof getEarthAffinityLevel==='function'?getEarthAffinityLevel():0;
    if(have<need) return 'Need Earth level '+need+' (you are '+have+')';
    return 'Train Earth affinity for this trek';
  }
  if(supplies.reason==='infused_charm'){
    const req=getExpeditionReqByType(tierDef, EXPEDITION_REQ_TYPE.INFUSED_CHARM, getExploreDestinationKey());
    const need=Number(req?.value)||WHISPER_WOODS_INFUSED_CHARM_NEED;
    const have=typeof countInfusedCharmsInStorage==='function'?countInfusedCharmsInStorage():0;
    if(have<need) return 'Need '+need+' Infused Charms in storage ('+have+' stored)';
    return 'Stock Infused Charms in storage';
  }
  if(supplies.reason==='equipped_tool'){
    if(getExploreDestinationKey()==='sunken_shallows') return 'Bind a Bronze Pickaxe to your tool store';
    return 'Set the Incinerating Axe active in your tool store';
  }
  return 'Pack the required supplies';
}

function expeditionStartBtnSub(tierDef, plans, supplies){
  if(supplies.ready) return 'depart when ready';
  if(supplies.reason==='either') return 'pick medicine or a torch';
  if(supplies.reason==='stamina') return 'pack enough rations for stamina';
  if(supplies.reason==='medicine') return 'pack enough medicine for recovery';
  const tierKey=tierDef?.key||explore.tier;
  if(supplies.reason==='torch'){
    const need=ensureExpeditionTorchRequired(tierKey);
    const have=countExpeditionSupply('torch');
    if(have<need) return 'need '+need+' torch'+(need===1?'':'es')+' packed';
    return 'need torches packed';
  }
  if(supplies.reason==='potion') return 'need travel potions packed';
  if(supplies.reason==='armour') return 'equip body armour';
  if(supplies.reason==='earth_affinity') return 'raise Earth affinity level';
  if(supplies.reason==='infused_charm') return 'need Infused Charms in storage';
  if(supplies.reason==='equipped_tool'){
    if(getExploreDestinationKey()==='sunken_shallows') return 'bind Bronze Pickaxe to tool store';
    return 'equip Incinerating Axe';
  }
  return 'complete supply checks first';
}

function getAvailableFishSpecies(){
  const byId={};
  getAvailableExpeditionRations().forEach(item=>{
    if(!byId[item.fishId]){
      byId[item.fishId]={
        fishId:item.fishId,
        icon:item.icon,
        name:FISH_DEFS[item.fishId]?.name||item.name,
        stamina:item.stamina,
        count:0,
      };
    }
    byId[item.fishId].count+=item.count;
  });
  return Object.values(byId).sort((a,b)=>a.stamina-b.stamina || a.name.localeCompare(b.name));
}

function staminaStockClass(have, need){
  if(need<=0) return 'stock-none';
  if(have>=need) return 'stock-enough';
  if(have>0) return 'stock-partial';
  return 'stock-none';
}

function totalStaminaAvailable(){
  return getAvailableExpeditionRations().reduce((sum,item)=>sum+(item.count*item.stamina), 0);
}

function planExpeditionStamina(required, focusFishId){
  const totalAvailable=totalStaminaAvailable();
  let items=getAvailableExpeditionRations();
  if(focusFishId) items=items.filter(item=>item.fishId===focusFishId);
  items.sort((a,b)=>a.stamina-b.stamina || a.name.localeCompare(b.name));

  let remaining=required;
  const plan=[];
  for(const item of items){
    if(remaining<=0) break;
    const useCount=Math.min(item.count, Math.ceil(remaining/item.stamina));
    if(useCount<=0) continue;
    plan.push({ ...item, useCount });
    remaining-=useCount*item.stamina;
  }

  const totalProvided=plan.reduce((sum,line)=>sum+(line.useCount*line.stamina),0);
  const sufficient=totalProvided>=required;

  if(focusFishId && !sufficient){
    const stamina=FISH_DEFS[focusFishId]?.stamina||items[0]?.stamina||1;
    const speciesHave=items.reduce((sum,item)=>sum+item.count,0);
    const speciesNeed=Math.ceil(required/stamina);
    const focusName=FISH_DEFS[focusFishId]?.name||'Fish';
    const focusIcon=FISH_DEFS[focusFishId]?.icon||'🐟';
    return {
      plan:[],
      focusSummary:{
        fishId:focusFishId,
        icon:focusIcon,
        name:focusName,
        have:speciesHave,
        need:speciesNeed,
        stamina,
      },
      totalProvided,
      totalAvailable,
      required,
      sufficient:false,
      remaining:Math.max(0, required-totalProvided),
    };
  }

  const displayPlan=plan.map(line=>({
    ...line,
    displayHave:line.count,
    displayNeed:line.useCount,
  }));

  return {
    plan:displayPlan,
    focusSummary:null,
    totalProvided,
    totalAvailable,
    required,
    sufficient,
    remaining:Math.max(0, required-totalProvided),
  };
}

function renderExpeditionTierPicker(){
  const el=document.getElementById('explore-tier-picker');
  if(!el) return;
  const destKey=getExploreDestinationKey();
  const order=getExpeditionTierOrder(destKey);
  let html=order.map(key=>{
    const tierDef=getExpeditionTierDef(destKey, key);
    const active=explore.tier===key?' active':'';
    const unlocked=isExploreTierUnlocked(key);
    const label=(tierDef.label||key).replace(' Trek','');
    return '<button type="button" class="expedition-tier-btn'+active+(unlocked?'':' expedition-tier-btn--locked')+'" '
      +'onclick="selectExpeditionTier(\''+key+'\')">'
      +label+'</button>';
  }).join('');
  el.innerHTML=html;
}

function renderExpeditionRationsPlanHtml(staminaPlan){
  if(staminaPlan.focusSummary){
    const f=staminaPlan.focusSummary;
    const cls=staminaStockClass(f.have, f.need);
    return '<div class="explore-req-plan-line">'
      +'<span>'+f.icon+' '+f.name+'</span>'
      +'<span class="explore-req-plan-qty '+cls+'">'+f.have+'/'+f.need+'</span>'
      +'</div>';
  }
  if(!staminaPlan.plan.length){
    return '<div class="store-line" style="color:rgba(200,169,110,0.45);padding:2px 0">No rations packed.</div>';
  }
  return staminaPlan.plan.map(line=>{
    const cls=staminaStockClass(line.displayHave, line.displayNeed);
    return '<div class="explore-req-plan-line">'
      +'<span>'+line.icon+' '+line.name+'</span>'
      +'<span class="explore-req-plan-qty '+cls+'">'+line.displayHave+'/'+line.displayNeed+'</span>'
      +'</div>';
  }).join('');
}

function renderExpeditionMedicinePlanHtml(medicinePlan){
  if(medicinePlan.focusSummary){
    const f=medicinePlan.focusSummary;
    const cls=staminaStockClass(f.have, f.need);
    return '<div class="explore-req-plan-line">'
      +'<span>'+f.icon+' '+f.name+'</span>'
      +'<span class="explore-req-plan-qty '+cls+'">'+f.have+'/'+f.need+'</span>'
      +'</div>';
  }
  if(!medicinePlan.plan.length){
    return '<div class="store-line" style="color:rgba(200,169,110,0.45);padding:2px 0">No medicine packed.</div>';
  }
  return medicinePlan.plan.map(line=>{
    const cls=staminaStockClass(line.displayHave, line.displayNeed);
    return '<div class="explore-req-plan-line">'
      +'<span>'+line.icon+' '+line.name+' ×'+line.useCount+'</span>'
      +'<span class="explore-req-plan-qty '+cls+'">'+line.displayHave+'/'+line.displayNeed+'</span>'
      +'</div>';
  }).join('');
}

function renderExpeditionReservedBox(active){
  if(!active){
    return '<div class="expedition-req-box reserved unneeded" aria-hidden="true">'
      +'<span class="expedition-req-na">not required</span>'
      +'</div>';
  }
  return '<div class="expedition-req-box reserved" aria-label="Reserved supply slot">'
    +'<span class="expedition-req-icon">▫️</span>'
    +'<span class="expedition-req-label">Reserved</span>'
    +'<span class="expedition-req-na">coming soon</span>'
    +'</div>';
}

function getDynamicExpeditionReqDisplayMeta(req){
  const destKey=getExploreDestinationKey();
  if(destKey==='sunken_shallows'&&typeof getSunkenShallowsReqDisplayMeta==='function'){
    return getSunkenShallowsReqDisplayMeta(req);
  }
  if(typeof getWhisperWoodsReqDisplayMeta==='function') return getWhisperWoodsReqDisplayMeta(req);
  return { icon:'▫️', label:'Requirement', sub:'' };
}

function renderWhisperWoodsDynamicReqBox(req, tierDef, plans){
  const enabled=isExpeditionRequirementEnabled(req);
  if(!enabled) return renderExpeditionReservedBox(false);
  const check=evaluateExpeditionRequirement(tierDef, req, plans);
  const meta=getDynamicExpeditionReqDisplayMeta(req);
  const required=!!enabled;
  const metCls=check.met?' supply-met':'';
  const shortCls=required&&!check.met?' supply-short':'';
  let qtyHtml='';
  if(req.type===EXPEDITION_REQ_TYPE.ARMOUR||req.type===EXPEDITION_REQ_TYPE.DEFENSE_RATING||req.type===EXPEDITION_REQ_TYPE.EQUIPPED_TOOL){
    qtyHtml=check.met
      ?'<span class="expedition-req-qty stock-enough">ready</span>'
      :'<span class="expedition-req-qty stock-none">missing</span>';
  }else if(req.type===EXPEDITION_REQ_TYPE.EARTH_AFFINITY
    ||req.type===EXPEDITION_REQ_TYPE.WATER_AFFINITY
    ||req.type===EXPEDITION_REQ_TYPE.FIRE_AFFINITY){
    const cls=staminaStockClass(check.have, check.need);
    qtyHtml='<span class="expedition-req-qty '+cls+'">'+(check.have|0)+'/'+(check.need|0)+'</span>';
  }else if(check.need!=null){
    const cls=staminaStockClass(check.have, check.need);
    qtyHtml='<span class="expedition-req-qty '+cls+'">'+(check.have|0)+'/'+(check.need|0)+'</span>';
  }
  return '<div class="expedition-req-box'+metCls+shortCls+'" aria-label="'+meta.label+' requirement">'
    +'<span class="expedition-req-icon">'+meta.icon+'</span>'
    +'<span class="expedition-req-label">'+meta.label+'</span>'
    +qtyHtml
    +'</div>';
}

function renderExpeditionReqBoxForRequirement(req, tierDef, plans){
  if(req.type===EXPEDITION_REQ_TYPE.RESERVED){
    return renderExpeditionReservedBox(isExpeditionRequirementEnabled(req));
  }
  const slotKey=EXPEDITION_REQ_TYPE_TO_SLOT[req.type];
  if(slotKey){
    if(slotKey==='medicine'){
      const medicineNeeded=isExpeditionRequirementEnabled(req);
      return renderExpeditionReqBox('medicine', tierDef, {
        medicinePlan:plans.medicine,
        medicineNeeded,
        supplyRequired:medicineNeeded,
        supplyMet:medicineNeeded&&!!plans.medicine?.sufficient,
      });
    }
    if(slotKey==='rations'){
      const staminaNeeded=isExpeditionRequirementEnabled(req);
      return renderExpeditionReqBox('rations', tierDef, {
        staminaPlan:plans.stamina,
        supplyRequired:staminaNeeded,
        supplyMet:staminaNeeded&&!!plans.stamina?.sufficient,
      });
    }
    if(slotKey==='torch'){
      const torchNeeded=isExpeditionRequirementEnabled(req);
      const tierKey=tierDef?.key||explore.tier;
      const required=torchNeeded?Number(req.value)||ensureExpeditionTorchRequired(tierKey):0;
      const available=countExpeditionSupply('torch');
      const unneeded=!torchNeeded;
      const met=torchNeeded&&available>=required;
      const qtyHtml=unneeded
        ?'<span class="expedition-req-na">not required</span>'
        :'<span class="expedition-req-qty '+staminaStockClass(available, required)+'">'+available+'/'+required+'</span>';
      const stateCls=(met?' supply-met':'')+(torchNeeded&&!met?' supply-short':'');
      return '<button type="button" class="expedition-req-box clickable'+stateCls+(unneeded?' unneeded':'')+'" onclick="toggleExploreReqSubmenu(\'torch\', event)">'
        +'<span class="expedition-req-icon">🔥</span>'
        +'<span class="expedition-req-label">Torch</span>'
        +qtyHtml
        +'</button>';
    }
  }
  if(req.type===EXPEDITION_REQ_TYPE.POTION
    ||req.type===EXPEDITION_REQ_TYPE.ARMOUR
    ||req.type===EXPEDITION_REQ_TYPE.DEFENSE_RATING
    ||req.type===EXPEDITION_REQ_TYPE.EMPTY_BUCKET
    ||req.type===EXPEDITION_REQ_TYPE.EARTH_AFFINITY
    ||req.type===EXPEDITION_REQ_TYPE.WATER_AFFINITY
    ||req.type===EXPEDITION_REQ_TYPE.FIRE_AFFINITY
    ||req.type===EXPEDITION_REQ_TYPE.INFUSED_CHARM
    ||req.type===EXPEDITION_REQ_TYPE.EQUIPPED_TOOL){
    return renderWhisperWoodsDynamicReqBox(req, tierDef, plans);
  }
  return renderExpeditionReservedBox(false);
}

function renderExpeditionRequirements(tierDef, plans, tierGateMsg){
  const row=document.getElementById('explore-req-row');
  if(!row) return;
  const previewLocked=!!tierGateMsg;
  const tierKey=tierDef?.key||explore.tier;
  const destKey=getExploreDestinationKey();
  const columns=typeof getExpeditionRequirementColumns==='function'
    ?getExpeditionRequirementColumns(tierKey, destKey)
    :getExpeditionRequirements(tierDef, destKey).map(r=>[r]);
  row.classList.remove('has-either', 'layout-2', 'layout-4', 'layout-6');
  row.classList.add('expedition-req-columns');
  row.classList.toggle('expedition-req-preview', previewLocked);
  row.innerHTML=columns.map((colReqs)=>(
    '<div class="expedition-req-column">'
    +colReqs.map((req)=>renderExpeditionReqBoxForRequirement(req, tierDef, plans)).join('')
    +'</div>'
  )).join('');
  const sub=document.getElementById('explore-req-submenu');
  if(previewLocked){
    if(sub){ sub.hidden=true; sub.innerHTML=''; }
    return;
  }
  renderExploreReqSubmenu(tierDef, plans.stamina, plans.medicine);
}

function renderExpeditionReqBox(slotKey, tierDef, opts){
  const slot=EXPEDITION_REQ_SLOTS[slotKey];
  const open=explore.reqSubmenu===slotKey;
  const openCls=open?' submenu-open':'';
  const selectedCls=opts?.selected?' either-selected':'';
  const dimCls=opts?.dimmed?' either-dimmed':'';
  const required=!!opts?.supplyRequired;
  const metCls=opts?.supplyMet?' supply-met':'';
  const shortCls=required&&!opts?.supplyMet?' supply-short':'';
  const stateCls=metCls+shortCls;
  if(slotKey==='rations'){
    const staminaPlan=opts.staminaPlan;
    const rationsCls=staminaStockClass(staminaPlan.totalAvailable, staminaPlan.required);
    return '<button type="button" class="expedition-req-box clickable'+openCls+stateCls+'" onclick="toggleExploreReqSubmenu(\'rations\', event)">'
      +'<span class="expedition-req-icon">'+slot.icon+'</span>'
      +'<span class="expedition-req-label">'+slot.label+'</span>'
      +'<span class="expedition-req-qty '+rationsCls+'">'+staminaPlan.totalAvailable+'/'+staminaPlan.required+'</span>'
      +'</button>';
  }
  if(slotKey==='medicine' && opts?.medicinePlan){
    const medicinePlan=opts.medicinePlan;
    const medicineNeeded=!!opts?.medicineNeeded;
    const unneeded=!medicineNeeded;
    const medicineCls=staminaStockClass(medicinePlan.totalAvailable, medicinePlan.required);
    const qtyHtml=medicineNeeded
      ?'<span class="expedition-req-qty '+medicineCls+'">'+medicinePlan.totalAvailable+'/'+medicinePlan.required+'</span>'
      :'<span class="expedition-req-na">not required</span>';
    return '<button type="button" class="expedition-req-box clickable'+openCls+selectedCls+dimCls+stateCls+(unneeded?' unneeded':'')+'" onclick="toggleExploreReqSubmenu(\'medicine\', event)">'
      +'<span class="expedition-req-icon">'+slot.icon+'</span>'
      +'<span class="expedition-req-label">'+slot.label+'</span>'
      +qtyHtml
      +'</button>';
  }
  if(slotKey==='torch'){
    const torchNeeded=expeditionRequirementAppliesForTier(tierDef, EXPEDITION_REQ_TYPE.TORCH);
    const tierKey=tierDef?.key||explore.tier;
    const required=torchNeeded?ensureExpeditionTorchRequired(tierKey):0;
    const available=countExpeditionSupply('torch');
    const unneeded=!torchNeeded;
    const qtyHtml=unneeded
      ?'<span class="expedition-req-na">not required</span>'
      :'<span class="expedition-req-qty '+staminaStockClass(available, required)+'">'+available+'/'+required+'</span>';
    return '<button type="button" class="expedition-req-box clickable'+openCls+selectedCls+dimCls+(unneeded?' unneeded':'')+'" onclick="toggleExploreReqSubmenu(\'torch\', event)">'
      +'<span class="expedition-req-icon">'+slot.icon+'</span>'
      +'<span class="expedition-req-label">'+slot.label+'</span>'
      +qtyHtml
      +'</button>';
  }
  const label=expeditionSlotQtyLabel(tierDef, slotKey);
  const unneeded=!label;
  const qtyHtml=unneeded
    ?'<span class="expedition-req-na">not required</span>'
    :'<span class="expedition-req-qty">×'+(label?.qty||0)+'</span>';
  return '<button type="button" class="expedition-req-box clickable'+openCls+(unneeded?' unneeded':'')+'" onclick="toggleExploreReqSubmenu(\''+slotKey+'\', event)">'
    +'<span class="expedition-req-icon">'+slot.icon+'</span>'
    +'<span class="expedition-req-label">'+slot.label+'</span>'
    +qtyHtml
    +'</button>';
}

function renderExploreReqSubmenu(tierDef, staminaPlan, medicinePlan){
  const el=document.getElementById('explore-req-submenu');
  if(!el) return;
  const key=explore.reqSubmenu;
  if(!key){
    el.hidden=true;
    el.innerHTML='';
    return;
  }
  el.hidden=false;
  const slot=EXPEDITION_REQ_SLOTS[key];
  const tierKey=tierDef?.key||explore.tier;
  if(key==='rations'){
    const totalCls=staminaStockClass(staminaPlan.totalAvailable, staminaPlan.required);
    const species=getAvailableFishSpecies();
    let html='<div class="explore-req-submenu-title">RATIONS</div>'
      +'<div class="explore-req-submenu-sub">Stamina from cooked fish</div>'
      +'<div class="explore-req-submenu-summary '+totalCls+'"><span class="stamina-val">'+staminaPlan.totalAvailable+'/'+staminaPlan.required+'</span> stamina available</div>'
      +'<div class="explore-req-submenu-section">PLANNED</div>'
      +renderExpeditionRationsPlanHtml(staminaPlan)
      +'<div class="explore-req-submenu-section">FOCUS</div>'
      +'<button type="button" class="explore-req-submenu-item'+(!explore.focusFishId?' active':'')+'" onclick="setExploreStaminaFocus(null)">'
      +'<span>Weakest first (auto)</span>'
      +'<span class="explore-req-submenu-meta">lowest stamina rations</span>'
      +'</button>';
    if(!species.length){
      html+='<div class="store-line" style="color:rgba(200,169,110,0.45);padding:6px 0 2px">No cooked fish available.</div>';
    }else{
      html+=species.map(sp=>{
        const active=explore.focusFishId===sp.fishId?' active':'';
        return '<button type="button" class="explore-req-submenu-item'+active+'" onclick="setExploreStaminaFocus(\''+sp.fishId+'\')">'
          +'<span>'+sp.icon+' '+sp.name+'</span>'
          +'<span class="explore-req-submenu-meta">'+sp.stamina+' stam • '+sp.count+' packed</span>'
          +'</button>';
      }).join('');
    }
    el.innerHTML=html;
    return;
  }
  if(key==='medicine'){
    const totalCls=staminaStockClass(medicinePlan.totalAvailable, medicinePlan.required);
    const types=getAvailableMedicineTypes();
    let html='<div class="explore-req-submenu-title">MEDICINE</div>'
      +'<div class="explore-req-submenu-sub">'+slot.submenuTitle+' • each bandage used once</div>'
      +'<div class="explore-req-submenu-summary '+totalCls+'"><span class="stamina-val">'+medicinePlan.totalAvailable+'/'+medicinePlan.required+'</span> recovery available</div>'
      +'<div class="explore-req-submenu-section">PLANNED</div>'
      +renderExpeditionMedicinePlanHtml(medicinePlan)
      +'<div class="explore-req-submenu-section">FOCUS</div>'
      +'<button type="button" class="explore-req-submenu-item'+(!explore.focusMedicineKey?' active':'')+'" onclick="setExploreMedicineFocus(null)">'
      +'<span>Weakest first (auto)</span>'
      +'<span class="explore-req-submenu-meta">lowest recovery first</span>'
      +'</button>';
    if(!types.length){
      html+='<div class="store-line" style="color:rgba(200,169,110,0.45);padding:6px 0 2px">No bandages available • craft at loom or apothecary table.</div>';
    }else{
      html+=types.map(item=>{
        const active=explore.focusMedicineKey===item.medicineKey?' active':'';
        return '<button type="button" class="explore-req-submenu-item'+active+'" onclick="setExploreMedicineFocus(\''+item.medicineKey+'\')">'
          +'<span>'+item.icon+' '+item.name+'</span>'
          +'<span class="explore-req-submenu-meta">+'+item.recovery+' recovery • '+item.count+' packed</span>'
          +'</button>';
      }).join('');
    }
    el.innerHTML=html;
    return;
  }
  if(key==='torch'){
    const required=expeditionRequirementAppliesForTier(tierDef, EXPEDITION_REQ_TYPE.TORCH)?ensureExpeditionTorchRequired(tierKey):0;
    const available=countExpeditionSupply('torch');
    const totalCls=staminaStockClass(available, required);
    const torches=getAvailableExpeditionTorches();
    let html='<div class="explore-req-submenu-title">TORCH</div>'
      +'<div class="explore-req-submenu-sub">'+slot.submenuTitle+' • simple torches from the fire pit</div>';
    if(!required){
      html+='<div class="store-line" style="color:rgba(200,169,110,0.45);padding:4px 0">Not needed for this expedition.</div>';
    }else{
      html+='<div class="explore-req-submenu-summary '+totalCls+'"><span class="stamina-val">'+available+'/'+required+'</span> torches packed</div>';
      if(!torches.length){
        html+='<div class="store-line" style="color:rgba(200,169,110,0.45);padding:6px 0 2px">No torches available • craft at the fire pit (Light tab).</div>';
      }else{
        html+='<div class="explore-req-submenu-section">AVAILABLE</div>';
        html+=torches.map(item=>'<div class="explore-req-submenu-item static">'
          +'<span>'+item.icon+' '+item.name+'</span>'
          +'<span class="explore-req-submenu-meta">'+item.count+' in bag or storage</span>'
          +'</div>').join('');
      }
    }
    el.innerHTML=html;
  }
}

function renderExpeditionRewards(tier){
  const el=document.getElementById('explore-rewards');
  if(!el) return;
  el.innerHTML=
    '<div class="expedition-reward-line"><span class="reward-val">+'+tier.explorationXp+'</span> Exploration XP on completion</div>'
    +'<div class="expedition-reward-line"><span class="reward-val">'+tier.lootRolls+'</span> random items from the loot pool</div>'
    +'<div class="expedition-reward-line"><span class="reward-val">'+tier.superRarePct+'%</span> chance of a super rare find</div>';
}

function renderExplorationPoolList(pool, containerId, emptyMsg){
  const el=document.getElementById(containerId);
  if(!el) return;
  if(!pool?.length){
    el.innerHTML='<div class="store-line" style="color:rgba(200,169,110,0.45)">'+(emptyMsg||'Nothing listed.')+'</div>';
    return;
  }
  el.innerHTML=pool.map(item=>'<div class="fish-list-row">'
    +'<span>'+item.icon+' '+item.name+'</span>'
    +'</div>').join('');
}

function renderExpeditionStartButton(tierDef, plans, supplies, tierGateMsg){
  const btnEl=document.getElementById('explore-buttons');
  if(!btnEl) return;
  const canStart=supplies.ready&&!tierGateMsg;
  const trekLabel=(tierDef.label||explore.tier).replace(' Trek','').toUpperCase();
  const startSub=tierGateMsg
    ?'preview only — upgrade camp to depart'
    :expeditionStartBtnSub(tierDef, plans, supplies);
  btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
    +'<button class="wb-btn once" '+(canStart?'':'disabled')+' onclick="startExpedition()">'
    +'🧭 START '+trekLabel
    +'<span class="wb-btn-sub">'+startSub+'</span>'
    +'</button></div></div>';
}

function renderExploring(){
  if(explore.running) return;
  resolveExploreDestinationFromInstance();
  updateActivitySkillPill('explore', 'exploration');
  const destKey=getExploreDestinationKey();
  const dest=getExploreDestination();
  const tierDef=getExploreTierDef();
  const plans=getExpeditionRequirementPlans(tierDef);
  const headerDisplay=getExploreHeaderDisplay();
  const titleEl=document.getElementById('explore-screen-title');
  const nameEl=document.getElementById('explore-cave-name');
  const subEl=document.getElementById('explore-cave-sub');
  const iconEl=document.getElementById('explore-cave-icon');
  const setupPanel=document.getElementById('explore-setup-panel');
  const tierGateMsg=getExpeditionCampGateMessage(explore.tier);
  if(setupPanel) setupPanel.classList.toggle('expedition-camp-preview', !!tierGateMsg);
  if(titleEl) titleEl.textContent='Exploring';
  if(nameEl) nameEl.textContent=headerDisplay.label;
  if(subEl){
    if(tierGateMsg){
      subEl.innerHTML='<span class="expedition-gate-msg">'+tierGateMsg+'</span>';
    }else{
      subEl.textContent=(tierDef.label||explore.tier).replace(' Trek','')+' expedition';
      subEl.classList.remove('expedition-gate-wrap');
    }
  }
  if(iconEl) iconEl.textContent=headerDisplay.icon;
  renderExpeditionTierPicker();
  renderExpeditionRequirements(tierDef, plans, tierGateMsg);
  const supplies=tierGateMsg?{ ready:false, reason:'camp' }:verifyExpeditionLaunch(tierDef, plans);
  renderExpeditionStartButton(tierDef, plans, supplies, tierGateMsg);
  const status=document.getElementById('explore-status');
  if(status){
    if(tierGateMsg){
      status.textContent='';
      status.hidden=true;
    }else{
      status.hidden=false;
      status.textContent=expeditionReadyStatusText(tierDef, plans, supplies);
    }
    status.classList.toggle('idle',!supplies.ready||!!tierGateMsg);
  }
  renderExpeditionRewards(tierDef);
  const pools=getExpeditionLootPools(destKey);
  renderExplorationPoolList(pools.loot, 'explore-loot-pool', 'No loot defined.');
  renderExplorationPoolList(pools.superRare, 'explore-super-rare-pool', 'No super rare loot defined.');
}

let expeditionTimer=null;

function consumeExpeditionStaminaPlan(staminaPlan){
  (staminaPlan.plan||[]).forEach(line=>{
    if(line.useCount>0) consumeManyFromBagOrStore(line.key, line.useCount);
  });
}

function consumeExpeditionMedicinePlan(medicinePlan){
  for(const line of medicinePlan.plan){
    consumeManyFromBagOrStore(line.key, line.useCount);
  }
}

function consumeExpeditionRequirements(tierDef, plans){
  const destKey=getExploreDestinationKey();
  getExpeditionRequirements(tierDef, destKey).forEach((req)=>{
    if(!isExpeditionRequirementEnabled(req)||req.either) return;
    switch(req.type){
      case EXPEDITION_REQ_TYPE.STAMINA:
        consumeExpeditionStaminaPlan(plans.stamina);
        break;
      case EXPEDITION_REQ_TYPE.MEDICINE:
        consumeExpeditionMedicinePlan(plans.medicine);
        break;
      case EXPEDITION_REQ_TYPE.TORCH:{
        const need=Number(req.value)||ensureExpeditionTorchRequired(tierDef?.key||explore.tier);
        if(need>0) consumeManyFromBagOrStore(SIMPLE_TORCH_KEY, need);
        break;
      }
      case EXPEDITION_REQ_TYPE.POTION:{
        const need=Number(req.value)||0;
        if(need>0) consumeManyFromBagOrStore(EXPEDITION_POTION_KEY, need);
        break;
      }
      case EXPEDITION_REQ_TYPE.INFUSED_CHARM:{
        const need=Number(req.value)||0;
        if(need>0&&typeof consumeInfusedCharmsFromStorage==='function') consumeInfusedCharmsFromStorage(need);
        break;
      }
      case EXPEDITION_REQ_TYPE.EMPTY_BUCKET:{
        const need=Number(req.value)||1;
        if(need>0) consumeManyFromBagOrStore('bucket', need);
        break;
      }
      default:
        break;
    }
  });
}

function applyExpeditionRewardsToStorage(rewards, destKey){
  Object.entries(rewards.loot||{}).forEach(([key,count])=>{
    const def=getExpeditionLootDef(key, destKey);
    if(def&&count>0) storageAddDirect(key, def.icon, def.name, count);
  });
}

function formatExpeditionLootSummary(rewards, destKey){
  const entries=Object.entries(rewards.loot||{})
    .map(([key,count])=>({ def:getExpeditionLootDef(key, destKey), count }))
    .filter(e=>e.def&&e.count>0)
    .sort((a,b)=>a.def.name.localeCompare(b.def.name));
  if(!entries.length) return 'Nothing this time — the cave was picked clean.';
  return entries.map(e=>e.def.icon+' '+e.def.name+' ×'+e.count).join('<br>');
}

const expeditionStarGame={ active:false, spawnTimer:null, spawned:0, collected:0, missed:0 };

function markExpeditionStarMissed(star){
  if(!star||star.classList.contains('collected')||star.classList.contains('missed')) return;
  star.classList.add('missed','expired');
  expeditionStarGame.missed=(expeditionStarGame.missed||0)+1;
  if(star._expireTimer){
    clearTimeout(star._expireTimer);
    star._expireTimer=null;
  }
  setTimeout(()=>{ if(star.isConnected) star.remove(); }, 480);
}

function harvestExpeditionStarStats(){
  const layer=document.getElementById('expedition-trek-stars');
  if(layer){
    layer.querySelectorAll('.expedition-trek-star:not(.collected)').forEach(star=>{
      markExpeditionStarMissed(star);
    });
  }
  return {
    collected:expeditionStarGame.collected||0,
    missed:expeditionStarGame.missed||0,
    spawned:expeditionStarGame.spawned||0,
  };
}

function collectExpeditionStar(){
  expeditionStarGame.collected=(expeditionStarGame.collected||0)+1;
  if(!state.pockets) state.pockets={ fire:0, water:0, earth:0, air:0, magic:0 };
  state.pockets.air=(state.pockets.air||0)+1;
  const m=SHARD_META.air;
  grantXP('exploration', EXPEDITION_STAR_EXPLORATION_XP, null, {
    skipShardDrop:true, keepActivities:true, deferSync:true,
  });
  grantXP('air', EXPEDITION_STAR_AIR_XP, null, {
    skipShardDrop:true, keepActivities:true, deferSync:true,
  });
  if(!state._seenShard){
    state._seenShard=true;
    showFoundBanner('POCKET FIND!', m.icon,
      'An elemental shard — tiny enough to live in your pockets. It uses no bag space. You\'ll gather these while training skills, for magic later.',
      'GOT IT', ()=>{ if(openPanel==='inv') renderInvPanel(); syncUI(); });
  }else{
    showQuickToast('⭐ +' + EXPEDITION_STAR_EXPLORATION_XP + ' Exploration • +' + EXPEDITION_STAR_AIR_XP + ' Air • ' + m.icon);
  }
  flashSkillPill('exploration');
  flashSkillPill('air');
  if(openPanel==='inv') renderInvPanel();
  scheduleSaveGame();
}

function burstExpeditionStarSparkles(star, layer){
  if(!star||!layer) return;
  const rect=star.getBoundingClientRect();
  const layerRect=layer.getBoundingClientRect();
  const cx=rect.left+rect.width/2-layerRect.left;
  const cy=rect.top+rect.height/2-layerRect.top;
  const glyphs=['✨','⭐','✦'];
  for(let i=0;i<6;i++){
    const spark=document.createElement('span');
    spark.className='expedition-trek-star-sparkle';
    spark.textContent=glyphs[i%glyphs.length];
    spark.style.left=(cx+(Math.random()*36-18))+'px';
    spark.style.top=(cy+(Math.random()*36-18))+'px';
    spark.style.animationDelay=(i*0.04)+'s';
    layer.appendChild(spark);
    setTimeout(()=>spark.remove(), 650);
  }
}

function spawnExpeditionStar(){
  const layer=document.getElementById('expedition-trek-stars');
  if(!expeditionStarGame.active||!layer) return;
  const star=document.createElement('button');
  star.type='button';
  star.className='expedition-trek-star';
  star.setAttribute('aria-label','Collect star shard');
  star.textContent='⭐';
  star.style.left=(10+Math.random()*80)+'%';
  star.style.top=(14+Math.random()*56)+'%';
  star.style.animationDelay=(expeditionStarGame.spawned*0.04)+'s';
  expeditionStarGame.spawned=(expeditionStarGame.spawned||0)+1;
  star._expireTimer=setTimeout(()=>markExpeditionStarMissed(star), EXPEDITION_STAR_LIFETIME_MS);
  star.onclick=(e)=>{
    e.stopPropagation();
    e.preventDefault();
    if(!expeditionStarGame.active||star.classList.contains('collected')||star.classList.contains('missed')) return;
    if(star._expireTimer){
      clearTimeout(star._expireTimer);
      star._expireTimer=null;
    }
    star.classList.add('collected');
    collectExpeditionStar();
    burstExpeditionStarSparkles(star, layer);
    setTimeout(()=>star.remove(), 520);
  };
  layer.appendChild(star);
}

function startExpeditionStarGame(){
  stopExpeditionStarGame();
  const layer=document.getElementById('expedition-trek-stars');
  if(layer) layer.innerHTML='';
  expeditionStarGame.active=true;
  expeditionStarGame.spawned=0;
  expeditionStarGame.collected=0;
  expeditionStarGame.missed=0;
  const spawnNext=()=>{
    if(!expeditionStarGame.active) return;
    spawnExpeditionStar();
    expeditionStarGame.spawnTimer=setTimeout(spawnNext, 520);
  };
  spawnNext();
}

function stopExpeditionStarGame(){
  expeditionStarGame.active=false;
  clearTimeout(expeditionStarGame.spawnTimer);
  expeditionStarGame.spawnTimer=null;
  const layer=document.getElementById('expedition-trek-stars');
  if(layer) layer.innerHTML='';
}

function showExpeditionTrekOverlay(durationMs, tierLabel){
  const overlay=document.getElementById('expedition-trek-overlay');
  const walker=document.getElementById('expedition-trek-walker');
  const label=document.getElementById('expedition-trek-label');
  const setup=document.getElementById('explore-setup-panel');
  const body=document.querySelector('#exploring-screen .explore-body');
  if(setup) setup.hidden=true;
  if(body) body.hidden=true;
  if(!overlay||!walker) return;
  overlay.hidden=false;
  if(label) label.textContent=(tierLabel||'Short')+' expedition…';
  walker.style.left='-12%';
  walker.style.animation='none';
  void walker.offsetWidth;
  walker.style.animation='expedition-walk '+durationMs+'ms linear forwards';
  startExpeditionStarGame();
}

function hideExpeditionTrekOverlay(){
  stopExpeditionStarGame();
  const overlay=document.getElementById('expedition-trek-overlay');
  const setup=document.getElementById('explore-setup-panel');
  const body=document.querySelector('#exploring-screen .explore-body');
  if(overlay) overlay.hidden=true;
  if(setup) setup.hidden=false;
  if(body) body.hidden=false;
  const walker=document.getElementById('expedition-trek-walker');
  if(walker){
    walker.style.animation='none';
    walker.style.left='-12%';
  }
}

function showExpeditionResultsBanner(tierDef, rewards, starStats, destKey){
  const stars=starStats?.collected||0;
  const missed=starStats?.missed||0;
  const bonusExplore=stars*EXPEDITION_STAR_EXPLORATION_XP;
  const bonusAir=stars*EXPEDITION_STAR_AIR_XP;
  let body='Everything you found went straight to storage.<br><br>';
  body+=formatExpeditionLootSummary(rewards, destKey);
  body+='<br><br>';
  if(rewards.superRare){
    body+='<strong>Super rare find!</strong> '+rewards.superRare.icon+' '+rewards.superRare.name+' — the cave gave up something special.';
  }else{
    body+='No super rare this time. The cave kept its best secrets.';
  }
  body+='<br><br>+'+tierDef.explorationXp+' Exploration XP';
  if(stars>0||missed>0){
    body+='<br><br><strong>Stars on the trek:</strong> '+stars+' collected ⭐';
    if(missed>0) body+=' • '+missed+' missed (too slow)';
    if(stars>0){
      body+='<br>+'+bonusExplore+' bonus Exploration XP • +'+bonusAir+' bonus Air XP';
      body+='<br>'+stars+' Air Shard'+(stars===1?'':'s')+' collected';
    }
  }else{
    body+='<br><br>No stars collected on the trek.';
  }
  showFoundBanner('EXPEDITION COMPLETE','🧭',body,'CONTINUE',()=>{
    renderExploring();
    flushActivityUi('screen');
  });
}

function cancelExpedition(fromActivitySwitch){
  if(!explore.running) return;
  clearTimeout(expeditionTimer);
  expeditionTimer=null;
  explore.running=false;
  hideExpeditionTrekOverlay();
  if(!fromActivitySwitch) clearActivity('exploring');
  if(currentScreen==='exploring-screen') renderExploring();
  if(!fromActivitySwitch) flushActivityUi('screen');
}

function finishExpedition(tierDef){
  expeditionTimer=null;
  explore.running=false;
  clearActivity('exploring');
  const destKey=getExploreDestinationKey();
  const starStats=harvestExpeditionStarStats();
  hideExpeditionTrekOverlay();
  const rewards=rollExpeditionRewards(tierDef, destKey);
  applyExpeditionRewardsToStorage(rewards, destKey);
  grantXP('exploration', tierDef.explorationXp, null, { keepActivities:true });
  completeExpedition(destKey);
  scheduleSaveGame();
  flushActivityUi('screen','inventory');
  showExpeditionResultsBanner(tierDef, rewards, starStats, destKey);
}

function startExpedition(){
  if(explore.running) return;
  const tierGateMsg=getExpeditionCampGateMessage(explore.tier);
  if(tierGateMsg){
    showToast(tierGateMsg);
    renderExploring();
    return;
  }
  const tierDef=getExploreTierDef();
  const plans=getExpeditionRequirementPlans(tierDef);
  const supplies=verifyExpeditionLaunch(tierDef, plans);
  if(!supplies.ready){
    showToast(expeditionLaunchBlockMessage(supplies));
    renderExploring();
    return;
  }
  explore.running=true;
  explore.reqSubmenu=null;
  setActivity('exploring');
  consumeExpeditionRequirements(tierDef, plans);
  const tierKey=tierDef.key||explore.tier;
  const durationMs=getExpeditionDurationMsFor(getExploreDestinationKey(), tierKey);
  showExpeditionTrekOverlay(durationMs, tierDef.label||tierKey);
  clearTimeout(expeditionTimer);
  expeditionTimer=setTimeout(()=>finishExpedition(tierDef), durationMs);
}

function completeExpedition(destKey){
  destKey=destKey||getExploreDestinationKey();
  if(typeof clearExpeditionSupplyRollsForDestination==='function'){
    clearExpeditionSupplyRollsForDestination(destKey);
  }else{
    clearExpeditionSupplyRolls();
  }
}

registerActivityRunner('exploring', {
  isRunning:()=>explore.running,
  stop:(from)=>cancelExpedition(from),
  label:'Exploring',
});

function stopWoodcutting(fromActivitySwitch){
  if(!wc.treeInstanceId) return;
  wc.treeInstanceId=null;
  if(!fromActivitySwitch) clearActivity('woodcutting');
  if(currentScreen==='woodcutting-screen'&&typeof renderWoodcutting==='function') renderWoodcutting();
  flushActivityUi();
}
