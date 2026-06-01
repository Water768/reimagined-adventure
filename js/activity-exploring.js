/* Hearthstead — exploring / expeditions */
'use strict';

function resetExpeditionTrekUi(){
  explore.running=false;
  clearTimeout(expeditionTimer);
  expeditionTimer=null;
  hideExpeditionTrekOverlay();
}

function openExploringMenu(instanceId){
  resetExpeditionTrekUi();
  if(instanceId) explore.instanceId=instanceId;
  explore.focusFishId=null;
  explore.focusMedicineKey=null;
  explore.eitherChoice=null;
  explore.reqSubmenu=null;
  showScreen('exploring-screen');
  lastHome='exterior-screen';
  renderExploring();
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

function ensureExpeditionStaminaRequired(tierKey){
  if(!state.exploreStaminaRolls) state.exploreStaminaRolls={};
  if(state.exploreStaminaRolls[tierKey]==null){
    state.exploreStaminaRolls[tierKey]=rollExpeditionStaminaRequired(tierKey);
    scheduleSaveGame();
  }
  return state.exploreStaminaRolls[tierKey];
}

function ensureExpeditionHealingRequired(tierKey){
  if(!state.exploreHealingRolls) state.exploreHealingRolls={};
  if(state.exploreHealingRolls[tierKey]==null){
    state.exploreHealingRolls[tierKey]=rollExpeditionHealingRequired(tierKey);
    scheduleSaveGame();
  }
  return state.exploreHealingRolls[tierKey];
}

function ensureExpeditionTorchRequired(tierKey){
  if(!state.exploreTorchRolls) state.exploreTorchRolls={};
  const tier=getExpeditionTier(tierKey);
  if(!expeditionSlotNeeded(tier, 'torch')) return 0;
  if(state.exploreTorchRolls[tierKey]==null){
    state.exploreTorchRolls[tierKey]=rollExpeditionTorchesRequired(tierKey);
    scheduleSaveGame();
  }
  return state.exploreTorchRolls[tierKey];
}

function selectExpeditionTier(key){
  if(!EXPEDITION_TIERS[key]) return;
  explore.tier=key;
  explore.focusFishId=null;
  explore.focusMedicineKey=null;
  explore.eitherChoice=null;
  explore.reqSubmenu=null;
  renderExploring();
}

function setExploreEitherChoice(choice){
  if(choice!=='medicine'&&choice!=='torch') return;
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
  const tier=getExpeditionTier(explore.tier);
  if(expeditionRequiresEither(tier)&&(slotKey==='medicine'||slotKey==='torch')){
    explore.eitherChoice=slotKey;
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

function expeditionMedicineRequired(tier){
  if(!expeditionSlotNeeded(tier, 'medicine')) return false;
  if(expeditionRequiresEither(tier)) return explore.eitherChoice==='medicine';
  return true;
}

function expeditionTorchRequired(tier){
  if(!expeditionSlotNeeded(tier, 'torch')) return false;
  if(expeditionRequiresEither(tier)) return explore.eitherChoice==='torch';
  return true;
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

function expeditionSuppliesReady(tier, staminaPlan, medicinePlan){
  if(!staminaPlan.sufficient) return { ready:false, reason:'rations' };
  if(expeditionRequiresEither(tier)){
    if(!explore.eitherChoice) return { ready:false, reason:'either' };
    if(explore.eitherChoice==='medicine'){
      if(!medicinePlan.sufficient) return { ready:false, reason:'medicine' };
      return { ready:true };
    }
    const torchNeed=ensureExpeditionTorchRequired(tier.key);
    if(countExpeditionSupply('torch')<torchNeed) return { ready:false, reason:'torch' };
    return { ready:true };
  }
  if(expeditionMedicineRequired(tier) && !medicinePlan.sufficient){
    return { ready:false, reason:'medicine' };
  }
  if(expeditionTorchRequired(tier)){
    const torchNeed=ensureExpeditionTorchRequired(tier.key);
    if(countExpeditionSupply('torch')<torchNeed) return { ready:false, reason:'torch' };
  }
  return { ready:true };
}

function expeditionReadyStatusText(tier, staminaPlan, medicinePlan, supplies){
  if(!staminaPlan.sufficient){
    if(!getAvailableExpeditionRations().length){
      return 'Cook fish and pack available rations';
    }
    return 'Need '+(staminaPlan.required-staminaPlan.totalAvailable)+' more stamina from rations';
  }
  if(supplies.ready) return 'All supplies packed • ready to depart';
  if(supplies.reason==='either') return 'Pick medicine or a torch';
  if(supplies.reason==='medicine'){
    if(!getAvailableExpeditionMedicine().length) return 'Craft bandages for medicine supplies';
    return 'Need '+(medicinePlan.required-medicinePlan.totalAvailable)+' more recovery from medicine';
  }
  if(supplies.reason==='torch'){
    const need=ensureExpeditionTorchRequired(tier.key);
    const have=countExpeditionSupply('torch');
    if(!getAvailableExpeditionTorches().length) return 'Light torches at the fire pit (Light tab)';
    if(have<need) return 'Need '+(need-have)+' more torch'+(need-have===1?'':'es')+' packed';
    return 'Pack torches for this expedition';
  }
  return 'Pack the required supplies';
}

function expeditionStartBtnSub(tier, staminaPlan, medicinePlan, supplies){
  if(!staminaPlan.sufficient) return 'pack enough rations for stamina';
  if(supplies.ready) return 'depart when ready';
  if(supplies.reason==='either') return 'pick medicine or a torch';
  if(supplies.reason==='medicine') return 'pack enough medicine for recovery';
  if(supplies.reason==='torch'){
    const need=ensureExpeditionTorchRequired(tier.key);
    const have=countExpeditionSupply('torch');
    if(have<need) return 'need '+need+' torch'+(need===1?'':'es')+' packed';
    return 'need torches packed';
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
  el.innerHTML=EXPEDITION_TIER_ORDER.map(key=>{
    const tier=getExpeditionTier(key);
    const active=explore.tier===key?' active':'';
    return '<button type="button" class="expedition-tier-btn'+active+'" onclick="selectExpeditionTier(\''+key+'\')">'+tier.label+'</button>';
  }).join('');
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

function renderExpeditionReqBox(slotKey, tier, opts){
  const slot=EXPEDITION_REQ_SLOTS[slotKey];
  const open=explore.reqSubmenu===slotKey;
  const openCls=open?' submenu-open':'';
  const selectedCls=opts?.selected?' either-selected':'';
  const dimCls=opts?.dimmed?' either-dimmed':'';
  if(slotKey==='rations'){
    const staminaPlan=opts.staminaPlan;
    const rationsCls=staminaStockClass(staminaPlan.totalAvailable, staminaPlan.required);
    return '<button type="button" class="expedition-req-box clickable'+openCls+'" onclick="toggleExploreReqSubmenu(\'rations\', event)">'
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
      :'<span class="expedition-req-na">not needed</span>';
    return '<button type="button" class="expedition-req-box clickable'+openCls+selectedCls+dimCls+(unneeded?' unneeded':'')+'" onclick="toggleExploreReqSubmenu(\'medicine\', event)">'
      +'<span class="expedition-req-icon">'+slot.icon+'</span>'
      +'<span class="expedition-req-label">'+slot.label+'</span>'
      +qtyHtml
      +'</button>';
  }
  if(slotKey==='torch'){
    const torchNeeded=expeditionTorchRequired(tier);
    const required=torchNeeded?ensureExpeditionTorchRequired(tier.key):0;
    const available=countExpeditionSupply('torch');
    const unneeded=!torchNeeded;
    const qtyHtml=unneeded
      ?'<span class="expedition-req-na">not needed</span>'
      :'<span class="expedition-req-qty '+staminaStockClass(available, required)+'">'+available+'/'+required+'</span>';
    return '<button type="button" class="expedition-req-box clickable'+openCls+selectedCls+dimCls+(unneeded?' unneeded':'')+'" onclick="toggleExploreReqSubmenu(\'torch\', event)">'
      +'<span class="expedition-req-icon">'+slot.icon+'</span>'
      +'<span class="expedition-req-label">'+slot.label+'</span>'
      +qtyHtml
      +'</button>';
  }
  const label=expeditionSlotQtyLabel(tier, slotKey);
  const unneeded=!label;
  const qtyHtml=unneeded
    ?'<span class="expedition-req-na">not needed</span>'
    :'<span class="expedition-req-qty">×'+(label?.qty||0)+'</span>';
  return '<button type="button" class="expedition-req-box clickable'+openCls+(unneeded?' unneeded':'')+'" onclick="toggleExploreReqSubmenu(\''+slotKey+'\', event)">'
    +'<span class="expedition-req-icon">'+slot.icon+'</span>'
    +'<span class="expedition-req-label">'+slot.label+'</span>'
    +qtyHtml
    +'</button>';
}

function renderExploreReqSubmenu(tier, staminaPlan, medicinePlan){
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
    const required=expeditionTorchRequired(tier)?ensureExpeditionTorchRequired(tier.key):0;
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

function renderExpeditionRequirements(tier, staminaPlan, medicinePlan){
  const row=document.getElementById('explore-req-row');
  if(!row) return;
  const medicineNeeded=expeditionMedicineRequired(tier);
  const hasEither=expeditionRequiresEither(tier);
  row.classList.toggle('has-either', hasEither);

  if(hasEither){
    const medSelected=explore.eitherChoice==='medicine';
    const torchSelected=explore.eitherChoice==='torch';
    row.innerHTML=renderExpeditionReqBox('rations', tier, { staminaPlan })
      +'<div class="expedition-req-either-wrap">'
      +'<div class="expedition-req-either-head">Either • pick medicine or torch</div>'
      +'<div class="expedition-req-either-pair">'
      +renderExpeditionReqBox('medicine', tier, {
        medicinePlan,
        medicineNeeded:true,
        selected:medSelected,
        dimmed:torchSelected,
      })
      +renderExpeditionReqBox('torch', tier, {
        selected:torchSelected,
        dimmed:medSelected,
      })
      +'</div></div>';
  }else{
    row.innerHTML=renderExpeditionReqBox('rations', tier, { staminaPlan })
      +renderExpeditionReqBox('medicine', tier, { medicinePlan, medicineNeeded })
      +renderExpeditionReqBox('torch', tier, {});
  }
  renderExploreReqSubmenu(tier, staminaPlan, medicinePlan);
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

function renderExploring(){
  if(explore.running) return;
  updateActivitySkillPill('explore', 'exploration');
  const tier=getExpeditionTier(explore.tier);
  const requiredStamina=ensureExpeditionStaminaRequired(tier.key);
  const requiredHealing=ensureExpeditionHealingRequired(tier.key);
  const staminaPlan=planExpeditionStamina(requiredStamina, explore.focusFishId);
  const medicinePlan=planExpeditionMedicine(requiredHealing, explore.focusMedicineKey);
  const def=getPlotTileDef('cave');
  const titleEl=document.getElementById('explore-screen-title');
  const nameEl=document.getElementById('explore-cave-name');
  const subEl=document.getElementById('explore-cave-sub');
  const iconEl=document.getElementById('explore-cave-icon');
  if(titleEl) titleEl.textContent='Exploring';
  if(nameEl) nameEl.textContent=def?.name||'Cave';
  if(subEl) subEl.textContent=tier.label+' expedition';
  if(iconEl) iconEl.textContent=def?.icon||'🕳️';
  renderExpeditionTierPicker();
  renderExpeditionRequirements(tier, staminaPlan, medicinePlan);
  renderExpeditionRewards(tier);
  renderExplorationPoolList(EXPLORATION_LOOT_POOL, 'explore-loot-pool', 'No loot defined.');
  renderExplorationPoolList(EXPLORATION_SUPER_RARE_POOL, 'explore-super-rare-pool', 'No super rare loot defined.');
  const supplies=expeditionSuppliesReady(tier, staminaPlan, medicinePlan);
  const status=document.getElementById('explore-status');
  if(status){
    status.textContent=expeditionReadyStatusText(tier, staminaPlan, medicinePlan, supplies);
    status.classList.toggle('idle',!supplies.ready);
  }
  const btnEl=document.getElementById('explore-buttons');
  if(btnEl){
    const canStart=supplies.ready;
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn once" '+(canStart?'':'disabled')+' onclick="startExpedition()">'
      +'🧭 START '+tier.label.toUpperCase()+' EXPEDITION'
      +'<span class="wb-btn-sub">'+expeditionStartBtnSub(tier, staminaPlan, medicinePlan, supplies)+'</span>'
      +'</button></div></div>';
  }
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

function consumeExpeditionOtherSupplies(tier){
  if(expeditionRequiresEither(tier)){
    if(explore.eitherChoice==='torch'){
      const need=ensureExpeditionTorchRequired(tier.key);
      if(need>0) consumeManyFromBagOrStore(SIMPLE_TORCH_KEY, need);
    }
    return;
  }
  if(expeditionTorchRequired(tier)){
    const need=ensureExpeditionTorchRequired(tier.key);
    if(need>0) consumeManyFromBagOrStore(SIMPLE_TORCH_KEY, need);
  }
}

function applyExpeditionRewardsToStorage(rewards){
  Object.entries(rewards.loot||{}).forEach(([key,count])=>{
    const def=getExpeditionLootDef(key);
    if(def&&count>0) storageAddDirect(key, def.icon, def.name, count);
  });
}

function formatExpeditionLootSummary(rewards){
  const entries=Object.entries(rewards.loot||{})
    .map(([key,count])=>({ def:getExpeditionLootDef(key), count }))
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

function showExpeditionResultsBanner(tier, rewards, starStats){
  const stars=starStats?.collected||0;
  const missed=starStats?.missed||0;
  const bonusExplore=stars*EXPEDITION_STAR_EXPLORATION_XP;
  const bonusAir=stars*EXPEDITION_STAR_AIR_XP;
  let body='Everything you found went straight to storage.<br><br>';
  body+=formatExpeditionLootSummary(rewards);
  body+='<br><br>';
  if(rewards.superRare){
    body+='<strong>Super rare find!</strong> '+rewards.superRare.icon+' '+rewards.superRare.name+' — the cave gave up something special.';
  }else{
    body+='No super rare this time. The cave kept its best secrets.';
  }
  body+='<br><br>+'+tier.explorationXp+' Exploration XP';
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

function finishExpedition(tier){
  expeditionTimer=null;
  explore.running=false;
  clearActivity('exploring');
  const starStats=harvestExpeditionStarStats();
  hideExpeditionTrekOverlay();
  const rewards=rollExpeditionRewards(tier);
  applyExpeditionRewardsToStorage(rewards);
  grantXP('exploration', tier.explorationXp, null, { keepActivities:true });
  completeExpedition();
  scheduleSaveGame();
  flushActivityUi('screen','inventory');
  showExpeditionResultsBanner(tier, rewards, starStats);
}

function startExpedition(){
  if(explore.running) return;
  const tier=getExpeditionTier(explore.tier);
  const requiredStamina=ensureExpeditionStaminaRequired(tier.key);
  const requiredHealing=ensureExpeditionHealingRequired(tier.key);
  const staminaPlan=planExpeditionStamina(requiredStamina, explore.focusFishId);
  const medicinePlan=planExpeditionMedicine(requiredHealing, explore.focusMedicineKey);
  const supplies=expeditionSuppliesReady(tier, staminaPlan, medicinePlan);
  if(!supplies.ready){
    if(supplies.reason==='rations') showToast('Not enough rations packed for this expedition.');
    else if(supplies.reason==='either') showToast('Pick medicine or a torch for this expedition.');
    else if(supplies.reason==='medicine') showToast('Not enough medicine packed for this expedition.');
    else showToast('Not enough torches packed for this expedition.');
    renderExploring();
    return;
  }
  explore.running=true;
  explore.reqSubmenu=null;
  setActivity('exploring');
  consumeExpeditionStaminaPlan(staminaPlan);
  if(expeditionMedicineRequired(tier)) consumeExpeditionMedicinePlan(medicinePlan);
  consumeExpeditionOtherSupplies(tier);
  const durationMs=getExpeditionDurationMs(tier.key);
  showExpeditionTrekOverlay(durationMs, tier.label);
  clearTimeout(expeditionTimer);
  expeditionTimer=setTimeout(()=>finishExpedition(tier), durationMs);
}

function completeExpedition(){
  clearExpeditionSupplyRolls();
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
