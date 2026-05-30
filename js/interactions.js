/* Hearthstead — interactions */
'use strict';

/* ═══════════════════════════════════════
   INTERACTIONS
═══════════════════════════════════════ */
const INV_FULL_MSGS=[
  "Your pockets are absolutely stuffed. Maybe build a log store outside...",
  "You swing the axe but there's nowhere to put the log. Your arms are full.",
  "Logs everywhere. On your head, under your arms. A log store would help.",
  "Inventory full! You could build something right now, or plan ahead.",
  "You get the log but drop three others. A log store would help enormously.",
];
let invFullIdx=0;

function chopTree(event, instanceId){
  if(plotSuppressClick||state.plot?.editMode) return;
  stopOtherActivities('woodcutting');
  if(instanceId) wc.treeInstanceId=instanceId;
  setActivity('woodcutting');
  if(!state.axeFound){showToast("You'd need something to chop with. Maybe check the hut?");return;}
  if(!hasAxeAvailable()){showToast("You swing your bare hands at the tree. It does not care.");return;}
  const sprite=instanceId
    ?document.querySelector('[data-tree-instance="'+instanceId+'"]')
    :document.querySelector('.cell-tree .tree-sprite');
  if(sprite){
    sprite.classList.remove('tree-shake'); void sprite.offsetWidth; sprite.classList.add('tree-shake');
  }
  if(event) spawnLeaves(event);
  const woodlandId=getTreeWoodlandId(instanceId);
  const logKey=rollWoodlandLog(woodlandId);
  const logDef=LOG_DEFS[logKey]||LOG_DEFS.logs;
  const axeTier = state.equipped?.tier ?? 0;
  const successChance = CHOP_RATES[logKey]?.[axeTier] ?? 0.75;
  const success = Math.random() < successChance;
  const found=findPlotSlotByInstanceId(instanceId);
  const cfg=getPlotConfig(instanceId||'plot_tree_1','tree', found?.slot?.typeId);
  cfg.treeChops=(cfg.treeChops||0)+1;
  cfg.woodlandId=woodlandId;
  const chops=cfg.treeChops;
  const chopXp=woodcutXpForLog(logKey);
  grantXP('woodcut',chopXp,null);
  if(!success){
    const missMsgs=[
      'The axe glances off. +'+chopXp+' Woodcutting',
      'Not this swing. +'+chopXp+' Woodcutting',
      'The tree shrugs it off. +'+chopXp+' Woodcutting',
      'A clean miss. +'+chopXp+' Woodcutting',
    ];
    addActivityLog('wc-log',missMsgs[Math.floor(Math.random()*missMsgs.length)],'fail');
    if(currentScreen==='woodcutting-screen') renderWoodcutting();
    if(instanceId){
      const cell=document.querySelector('.plot-cell.cell-tree[data-instance-id="'+instanceId+'"]');
      if(cell) revealPlotActivityMenu('wc:'+instanceId, cell);
    }
    syncUI();
    return;
  }
  if(!invAdd(logKey,logDef.icon,logDef.name,1)){
    addActivityLog('wc-log','Bag full — could not keep the log.','fail');
    showToast(INV_FULL_MSGS[invFullIdx++%INV_FULL_MSGS.length]);
    if(currentScreen==='woodcutting-screen') renderWoodcutting();
    if(instanceId){
      const cell=document.querySelector('.plot-cell.cell-tree[data-instance-id="'+instanceId+'"]');
      if(cell) revealPlotActivityMenu('wc:'+instanceId, cell);
    }
    syncUI();
    return;
  }
  addActivityLog('wc-log',logDef.icon+' Chopped '+logDef.name.toLowerCase()+'! +'+chopXp+' Woodcutting','success');
  if(logKey==='singing_oak'){
    showToast('The tree hums as it falls. Singing Oak. 🎶');
  }else if(chops===1&&logKey!=='logs'){
    showToast(logDef.icon+' '+logDef.name+'! '+logDef.vibe);
  }else if(chops===5){
    showToast("5 chops! You're getting somewhere. 🪵");
  }else if(chops===20){
    showToast("You could build something with all these... 🏗️");
  }else if(chops>20&&chops%15===0){
    showToast("The trees keep growing. They'll never run out. 🌳");
  }
  if(currentScreen==='woodcutting-screen') renderWoodcutting();
  if(instanceId) revealPlotActivityMenu('wc:'+instanceId, document.querySelector('.plot-cell.cell-tree[data-instance-id="'+instanceId+'"]'));
  syncUI();
}

function spawnLeaves(event){
  const w=document.getElementById('game-wrapper'),r=w.getBoundingClientRect();
  const cx=(event.touches?event.touches[0].clientX:event.clientX)-r.left;
  const cy=(event.touches?event.touches[0].clientY:event.clientY)-r.top;
  ['🍃','🌿','🍂','🍃'].forEach((leaf,i)=>{
    const el=document.createElement('div'); el.className='leaf'; el.textContent=leaf;
    const lx=(Math.random()-0.5)*80;
    el.style.cssText='left:'+(cx-10)+'px;top:'+(cy-10)+'px;--lx:'+lx+'px;animation-delay:'+(i*0.1)+'s;';
    w.appendChild(el); setTimeout(()=>el.remove(),1400);
  });
}

function openWardrobe(){
  if(state.axeFound){showToast("The wardrobe creaks. Empty now.");return;}
  showFoundBanner("ITEM FOUND!","🪓","A rusted axe, tucked behind some old coats. It could still fell a tree or two.","TAKE THE AXE",()=>{
    state.axeFound=true;
    invAdd('axe','🪓','Rusted Axe',1);
    document.querySelectorAll('.int-cell[data-int-key="wardrobe"] .int-item').forEach(el=>el.classList.remove('wardrobe-glow'));
    document.querySelectorAll('.int-cell[data-int-key="wardrobe"] .int-label').forEach(el=>el.textContent='wardrobe');
    syncUI(); showToast("🪓 Rusted Axe added to bag! Tap it in your bag to equip.");
  });
}

let pictureWonky=true,pictureCooldown=false;
function interactPicture(cell){
  if(pictureCooldown)return; pictureCooldown=true;
  const frame=cell?.querySelector?.('.int-item');
  if(!frame){ pictureCooldown=false; return; }
  if(pictureWonky){
    frame.style.transform='rotate(0deg)'; pictureWonky=false;
    grantXP('design',5,pseudoClickEventFromEl(cell));
    showToast("You straighten the picture. It looks better. ✨");
    setTimeout(()=>{
      frame.style.transition='none'; frame.style.transform='rotate(-8deg)'; pictureWonky=true;
      setTimeout(()=>{frame.style.transition='transform 0.5s';},50); pictureCooldown=false;
    },3000);
  }else{showToast("Already straight. For now."); pictureCooldown=false;}
}

let dogBedCD=false;
const DOG_MSGS=["You fluff the old dog bed. It still smells of someone else's dog. 🐾","You straighten it again. It's very empty.","You pat it flat. Whoever's dog this was, they're not here anymore.","Still just an empty bed. You fluff it anyway.","You wonder what the dog's name was. You'll never know.","The bed is clean. Perfectly, pointlessly clean.","You fluff it again. A habit now. A sad one."];

function tidyDogBed(event){
  if(dogBedCD)return; dogBedCD=true; state.dogBedCleaned++;
  grantXP('husbandry',1,event);
  showToast(DOG_MSGS[Math.min(state.dogBedCleaned-1,DOG_MSGS.length-1)]);
  setTimeout(()=>{dogBedCD=false;},2200);
}

function updateDogbedCell(){
  const unlocked=(state.skills.husbandry?.level||1)>=HUSBANDRY_PET_UNLOCK_LEVEL;
  document.querySelectorAll('.int-cell[data-int-key="dogbed"]').forEach(cell=>{
    cell.classList.toggle('dogbed-unlocked',unlocked);
  });
}

function dogbedMenuKey(cell){
  const x=cell?.dataset?.intX, y=cell?.dataset?.intY;
  return 'dogbed:'+x+','+y;
}

function dbMenuTap(event, cell){
  event?.stopPropagation?.();
  hidePlotActivityMenu(dogbedMenuKey(cell||event?.target?.closest?.('.int-cell[data-int-key="dogbed"]')));
  openPetsScreen();
}

function onDogbedCellTap(cell, event){
  if(intSuppressClick||isInteriorBuildMode()) return;
  const unlocked=(state.skills.husbandry?.level||1)>=HUSBANDRY_PET_UNLOCK_LEVEL;
  if(!unlocked){
    if(dogBedCD){
      showToast('Give the bed a moment…');
      return;
    }
    tidyDogBed(null);
    return;
  }
  if(event?.target?.closest?.('.plot-menu-btn')){
    dbMenuTap(event, cell);
    return;
  }
  if(isPlotMenuZone(cell, event?.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    dbMenuTap(event, cell);
    return;
  }
  if(dogBedCD){
    showToast('Give the bed a moment…');
    return;
  }
  tidyDogBed(null);
  revealPlotActivityMenu(dogbedMenuKey(cell), cell);
}

function openPetsScreen(){
  viewingPetId=null;
  showScreen('pets-screen');
  lastHome='interior-screen';
  document.getElementById('pet-list-panel').style.display='block';
  document.getElementById('pet-detail-panel').style.display='none';
  document.getElementById('pet-partner-panel').style.display='none';
  updateActivitySkillPill('pets', 'husbandry');
  renderPetsScreen();
}

function closePetsScreen(){
  viewingPetId=null;
  showScreen('interior-screen');
}

let viewingPetId=null;
let petLevelPanelOpen=false;
let magpiePartnerFocusSeedKey=null;

function getMagpiePartnerAdoptStatus(){
  const seedKey=resolveMagpieSeedKey(magpiePartnerFocusSeedKey);
  const need=MAGPIE_ADOPT_SEED_COST;
  const stock=seedKey?itemCountBagAndStore(seedKey):0;
  const seedDef=seedKey?getBotanySeedDef(seedKey):null;
  return { seedKey, need, stock, seedDef, canAdopt:!!seedKey&&stock>=need };
}

function setMagpiePartnerSeedFocus(seedKey){
  magpiePartnerFocusSeedKey=seedKey||null;
  renderPetPartnerPanel();
}

function openPetPartnerScreen(){
  const max=maxOwnedPets();
  if(max===0||state.pets.length>=max){
    showToast('No empty pet slots.');
    return;
  }
  viewingPetId=null;
  magpiePartnerFocusSeedKey=null;
  document.getElementById('pet-list-panel').style.display='none';
  document.getElementById('pet-detail-panel').style.display='none';
  document.getElementById('pet-partner-panel').style.display='block';
  renderPetPartnerPanel();
}

function buildMagpiePartnerSeedInlineHtml(){
  const available=getSeedsWithStock();
  const status=getMagpiePartnerAdoptStatus();
  let html='<div class="pet-partner-seed-focus" onclick="event.stopPropagation()">'
    +'<div class="store-items-title" style="font-size:10px;margin:8px 0 4px">SEED TYPE</div>'
    +'<button type="button" class="explore-req-submenu-item'+(!magpiePartnerFocusSeedKey?' active':'')+'" onclick="setMagpiePartnerSeedFocus(null)">'
    +'<span>Lowest tier available</span>'
    +'<span class="explore-req-submenu-meta">auto-pick cheapest seed you have</span>'
    +'</button>';
  if(!available.length){
    html+='<div class="store-line" style="color:rgba(200,169,110,0.45);padding:4px 0 2px">No seeds in bag or storage.</div>';
  }else{
    html+=available.map(seed=>{
      const active=magpiePartnerFocusSeedKey===seed.key?' active':'';
      const count=itemCountBagAndStore(seed.key);
      return '<button type="button" class="explore-req-submenu-item'+active+'" onclick="setMagpiePartnerSeedFocus(\''+seed.key+'\')">'
        +'<span>'+seed.icon+' '+seed.name+'</span>'
        +'<span class="explore-req-submenu-meta">'+count+' available</span>'
        +'</button>';
    }).join('');
  }
  if(status.seedDef){
    const cls=wbStockClass(status.canAdopt?1:0);
    html+='<div class="store-line '+cls+'" style="margin-top:6px;font-size:11px">Uses: '+status.seedDef.icon+' '+status.seedDef.name+' · '+status.stock+'/'+status.need+'</div>';
  }
  html+='</div>';
  return html;
}

function closePetPartnerScreen(){
  document.getElementById('pet-partner-panel').style.display='none';
  document.getElementById('pet-list-panel').style.display='block';
  renderPetsScreen();
}

function petPartnerCostClass(have, need){
  if(have>=need) return 'stock-enough';
  if(have>0) return 'stock-partial';
  return 'stock-none';
}

function buildPetPartnerOptionHtml(def){
  if(petAdoptsWithSeeds(def)){
    const status=getMagpiePartnerAdoptStatus();
    const costCls=petPartnerCostClass(status.stock, status.need);
    const seedName=status.seedDef?.name||'seeds';
    return '<div class="pet-partner-card"'+(status.canAdopt?'':' style="opacity:0.72"')+' onclick="adoptPet(\''+def.key+'\')">'
      +'<div class="pet-partner-card-header">'
      +'<span class="pet-partner-icon">'+def.icon+'</span>'
      +'<div class="pet-partner-card-body">'
      +'<div class="pet-partner-name">'+def.name+'</div>'
      +'<div class="pet-partner-desc">'+def.description+'</div>'
      +'<div class="pet-partner-cost '+costCls+'">['+status.stock+'/'+status.need+' '+seedName+']</div>'
      +'</div></div>'
      +buildMagpiePartnerSeedInlineHtml()
      +'</div>';
  }
  if(petAdoptsWithMultipleCosts(def)){
    const status=getPetAdoptCostStatus(def);
    const costLines=status.lines.map(line=>{
      const costCls=line.stock>=line.need?'stock-enough':'stock-partial';
      const name=line.meta?.name||line.key;
      return '<div class="pet-partner-cost '+costCls+'">['+line.stock+'/'+line.need+' '+name+']</div>';
    }).join('');
    return '<div class="pet-partner-card" onclick="adoptPet(\''+def.key+'\')">'
      +'<div class="pet-partner-card-header">'
      +'<span class="pet-partner-icon">'+def.icon+'</span>'
      +'<div class="pet-partner-card-body">'
      +'<div class="pet-partner-name">'+def.name+'</div>'
      +'<div class="pet-partner-desc">'+def.description+'</div>'
      +costLines
      +'</div></div>'
      +'</div>';
  }
  const have=itemCountBagAndStore(def.adoptCostKey);
  const need=def.adoptCostAmount;
  const costCls=petPartnerCostClass(have, need);
  return '<div class="pet-partner-card" onclick="adoptPet(\''+def.key+'\')">'
    +'<div class="pet-partner-card-header">'
    +'<span class="pet-partner-icon">'+def.icon+'</span>'
    +'<div class="pet-partner-card-body">'
    +'<div class="pet-partner-name">'+def.name+'</div>'
    +'<div class="pet-partner-desc">'+def.description+'</div>'
    +'<div class="pet-partner-cost '+costCls+'">['+have+'/'+need+' '+def.adoptCostLabel+']</div>'
    +'</div></div>'
    +'</div>';
}

function renderPetPartnerPanel(){
  const panel=document.getElementById('pet-partner-panel');
  if(!panel) return;
  const optionsHtml=Object.values(PET_SPECIES).map(buildPetPartnerOptionHtml).join('');
  panel.innerHTML=
    '<button type="button" class="wb-btn once" onclick="closePetPartnerScreen()" style="margin-bottom:12px;width:100%;flex:none">◀ BACK</button>'
    +'<div class="wb-header">'
    +'<div class="wb-title-row"><span class="wb-icon">🐾</span>'
    +'<div><div class="wb-item-name">Partner a pet</div>'
    +'<div class="wb-item-sub">Choose a companion</div></div></div>'
    +'<div class="pet-following-empty pets-partner-intro">'+PET_PARTNER_INTRO+'</div>'
    +'</div>'
    +'<div class="store-items" style="margin-bottom:12px">'
    +'<div class="store-items-title">AVAILABLE PETS</div>'
    +'<div class="pet-partner-list">'+optionsHtml+'</div>'
    +'</div>';
}

function openPetDetail(id){
  if(viewingPetId!==id) petLevelPanelOpen=false;
  viewingPetId=id;
  document.getElementById('pet-list-panel').style.display='none';
  document.getElementById('pet-partner-panel').style.display='none';
  document.getElementById('pet-detail-panel').style.display='block';
  renderPetDetail(id);
}

function closePetDetail(){
  viewingPetId=null;
  petLevelPanelOpen=false;
  document.getElementById('pet-detail-panel').style.display='none';
  document.getElementById('pet-list-panel').style.display='block';
  renderPetsScreen();
}

function getPetAbilityText(pet, equipped){
  const def=getPetSpeciesDef(pet.type);
  if(def.passiveType==='nailCollect'){
    const drops=getPetNailCollectDropSummary(getPetLevel(pet));
    if(equipped){
      return pet.name+' follows you scavenging shiny nails — 1 delivered to storage each minute ('+drops+').';
    }
    return 'Equip '+pet.name+' to follow you. While equipped, they stash 1 nail per minute in storage ('+drops+').';
  }
  if(def.passiveType==='oreScout'){
    const goldPct=getMagpieGoldOreChancePercent(getPetLevel(pet));
    const diaPct=getMagpieDiamondChancePercent(getPetLevel(pet));
    let line=pet.name+(equipped?' follows you hunting treasure':' can hunt treasure when equipped')
      +' — '+goldPct+'% chance per minute for gold ore';
    if(diaPct>0) line+=', '+diaPct+'% for diamonds';
    line+='.';
    return line;
  }
  if(def.passiveType==='seedCollect'){
    const range=getDormouseSeedCollectRange(getPetLevel(pet));
    if(equipped){
      return pet.name+' dozes nearby but still forages — '+range.min+'–'+range.max+' random seeds to storage each minute.';
    }
    return 'Equip '+pet.name+' to forage. While equipped, they stash '+range.min+'–'+range.max+' random seeds per minute in storage.';
  }
  if(def.passiveType==='storageRedirect'){
    const pct=Math.round(getPetDogFetchChance(pet)*100);
    if(equipped){
      return pet.name+' follows you and sometimes fetches new loot straight to storage — '+pct+'% chance per item you pick up.';
    }
    return 'Equip '+pet.name+' to follow you. While equipped, picked-up items have a '+pct+'% chance to go to storage instead of your bag.';
  }
  if(def.passiveType==='shard'){
    const sm=SHARD_META[pet.shard]||SHARD_META.earth;
    const shardLabel=sm.name.toLowerCase().replace(' shard','');
    const pct=getCatShardChancePercent(getPetLevel(pet));
    if(equipped){
      return pet.name+' follows you and quietly hunts for '+shardLabel+' shards — about a '+pct+'% chance each minute while you play.';
    }
    return 'Equip '+pet.name+' to follow you. While equipped, they passively find '+shardLabel+' shards ('+pct+'% chance per minute). At home on the bed they rest.';
  }
  if(def.passiveType==='fishAutoRelease'){
    const pct=getGoldfishAutoReleaseChancePercent(getPetLevel(pet));
    if(equipped){
      return pet.name+' follows you to the water — open fishing to toggle auto-release ('+pct+'% chance to instantly return native catches for Water XP).';
    }
    return 'Equip '+pet.name+' to follow you. On the fishing screen, toggle auto-release for a '+pct+'% chance to return native catches immediately instead of filling your bag.';
  }
  return 'Equip '+pet.name+' to follow you. No passive effect yet.';
}

function buildPetEmptySlotHtml(){
  return '<div class="pet-slot pet-slot-empty" onclick="openPetPartnerScreen()">'
    +'<div class="pet-slot-empty-label">empty</div>'
    +'<div class="pet-slot-partner-hint">partner a pet</div>'
    +'</div>';
}

function buildPetLockedSlotHtml(unlockLvl){
  return '<div class="pet-slot pet-slot-next-locked">'
    +'<div class="pet-slot-unlock">'
    +'<span class="pet-slot-unlock-text">Next at lvl '+unlockLvl+'!</span>'
    +'</div></div>';
}

function buildMagpieSeedFocusHtml(pet){
  const available=getSeedsWithStock();
  const resolved=resolveMagpieLevelUpSeedKey(pet);
  let html='<div class="explore-req-submenu-section" style="margin-top:10px">SEED FOCUS</div>'
    +'<button type="button" class="explore-req-submenu-item'+(!pet.focusSeedKey?' active':'')+'" onclick="setMagpieSeedFocus(\''+pet.id+'\',null)">'
    +'<span>Lowest tier available</span>'
    +'<span class="explore-req-submenu-meta">auto-pick cheapest seed you have</span>'
    +'</button>';
  if(!available.length){
    html+='<div class="store-line" style="color:rgba(200,169,110,0.45);padding:6px 0 2px">No seeds in bag or storage.</div>';
  }else{
    html+=available.map(seed=>{
      const active=pet.focusSeedKey===seed.key?' active':'';
      const count=itemCountBagAndStore(seed.key);
      return '<button type="button" class="explore-req-submenu-item'+active+'" onclick="setMagpieSeedFocus(\''+pet.id+'\',\''+seed.key+'\')">'
        +'<span>'+seed.icon+' '+seed.name+'</span>'
        +'<span class="explore-req-submenu-meta">'+count+' available</span>'
        +'</button>';
    }).join('');
  }
  if(resolved){
    const meta=getPetLevelUpItemMeta(pet);
    const need=getPetLevelUpItemCount(pet);
    html+='<div class="store-line" style="margin-top:8px;font-size:13px">Level-up uses: '+(meta?.icon||'?')+' '+(meta?.name||resolved)+' ×'+need+'</div>';
  }
  return html;
}

function setMagpieSeedFocus(petId, seedKey){
  const pet=state.pets.find(p=>p.id===petId);
  if(!pet||pet.type!=='magpie') return;
  pet.focusSeedKey=seedKey||null;
  renderPetDetail(petId);
  scheduleSaveGame();
}

function buildPetLevelPanelHtml(pet){
  const status=getPetLevelUpStatus(pet);
  let body='<div class="pet-level-block">'
    +'<div class="store-items-title" style="margin-bottom:8px">PET PROGRESS</div>';
  if(status.maxLevel){
    body+='<div class="pet-stat-row" style="border-bottom:none"><span>Level</span><span>Lv '+status.level+' (max)</span></div>';
  }else{
    const expCls=wbStockClass(status.expOk?1:0);
    body+='<div class="pet-level-summary'+(petLevelPanelOpen?' open':'')+'" onclick="togglePetLevelPanel(\''+pet.id+'\')">'
      +'<span class="pet-level-summary-main">'
      +'<span class="wb-item-name">Lv '+status.level+' → Lv '+status.nextLevel+'</span>'
      +'<span class="wb-item-sub"><span class="wb-mat-pick-avail '+expCls+'">Pet progress '+status.exp+' / '+status.expReq+'</span></span>'
      +'</span>'
      +'<span class="pet-level-chevron">'+(petLevelPanelOpen?'▼':'▶')+'</span>'
      +'</div>';
    if(petLevelPanelOpen){
      const item=status.item;
      const itemCls=wbStockClass(status.itemOk?1:0);
      body+='<div class="pet-level-expand">'
        +'<div class="pet-level-benefit">'+status.benefit+'</div>';
      if(status.usesSeeds){
        body+=buildMagpieSeedFocusHtml(pet);
        if(item){
          body+='<div class="pet-stat-row"><span>'+item.icon+' '+item.name+' ×'+status.itemNeed+'</span>'
            +'<span class="wb-mat-pick-avail '+itemCls+'">'+formatAvailableCount(status.stock)+'</span></div>';
        }
      }else if(item){
        body+='<div class="pet-stat-row"><span>'+item.icon+' '+item.name+' ×'+status.itemNeed+'</span>'
          +'<span class="wb-mat-pick-avail '+itemCls+'">'+formatAvailableCount(status.stock)+'</span></div>';
      }
      body+='<div class="store-line" style="margin-top:8px;font-size:14px">Earns 1 progress each minute while following you.</div>'
        +'<button type="button" class="wb-btn'+(status.canLevelUp?'':' pet-level-btn-disabled')+'" style="margin-top:10px;width:100%" onclick="'+(status.canLevelUp?'levelUpPet(\''+pet.id+'\');event.stopPropagation();':'')+'">Level up → Lv '+status.nextLevel+'</button>'
        +'</div>';
    }
  }
  body+='</div>';
  return body;
}

function togglePetLevelPanel(id){
  if(petLevelPanelOpen&&viewingPetId===id) petLevelPanelOpen=false;
  else petLevelPanelOpen=true;
  renderPetDetail(id);
}

function levelUpPet(id){
  const pet=state.pets.find(p=>p.id===id);
  if(!pet) return;
  const status=getPetLevelUpStatus(pet);
  if(status.maxLevel){
    showToast(pet.name+' is already max level.');
    renderPetDetail(id);
    return;
  }
  if(!status.canLevelUp){
    const itemLabel=status.item?(status.itemNeed+' '+status.item.name):'level-up items';
    showToast('Need '+status.expReq+' pet progress and '+itemLabel+' to level up.');
    renderPetDetail(id);
    return;
  }
  if(!consumeManyFromBagOrStore(status.item.key, status.itemNeed)){
    showToast('Could not take level-up items.');
    return;
  }
  pet.exp=0;
  pet.level=status.nextLevel;
  showToast(getPetLevelUpGainMessage(pet, pet.level));
  petLevelPanelOpen=true;
  renderPetDetail(id);
  renderPetsScreen(id);
  scheduleSaveGame();
}

function buildPetTreatPanelHtml(pet){
  const treat=getPetTreatStatus(pet);
  if(!treat) return '';
  const { item, amount, stock, fed, xp, canFeed }=treat;
  let body='<div class="pet-treat-block">'
    +'<div class="store-items-title" style="margin-bottom:8px">TREAT PET</div>';
  if(fed){
    body+='<div class="store-line" style="margin-bottom:8px">Fed for today — a new request tomorrow.</div>'
      +'<div class="pet-stat-row"><span>Last treat</span><span>'+item.icon+' '+amount+' '+item.name+' · +'+xp+' Husbandry</span></div>';
  }else{
    const stockCls=wbStockClass(stock, amount);
    body+='<div class="store-line" style="margin-bottom:8px">'+escapeHtml(pet.name)+' wants a treat today.</div>'
      +'<div class="pet-treat-option'+(canFeed?'':' unavail')+'" onclick="'+(canFeed?'givePetTreat(\''+pet.id+'\')':'')+'">'
      +'<span class="pet-treat-option-icon">'+item.icon+'</span>'
      +'<span class="pet-treat-option-body">'
      +'<span class="wb-item-name">'+item.name+' ×'+amount+'</span>'
      +'<span class="wb-item-sub"><span class="wb-mat-pick-avail '+stockCls+'">'+formatAvailableCount(stock)+'</span> · +'+xp+' Husbandry</span>'
      +'</span></div>';
  }
  body+='</div>';
  return body;
}

function renderPetDetail(id){
  const pet=state.pets.find(p=>p.id===id);
  const panel=document.getElementById('pet-detail-panel');
  if(!pet||!panel){ closePetDetail(); return; }
  const def=getPetSpeciesDef(pet.type);
  const sm=pet.shard?(SHARD_META[pet.shard]||SHARD_META.earth):null;
  const equipped=isPetEquipped(id);
  const eqCount=(state.equippedPetIds||[]).length;
  const canEquip=!equipped&&eqCount<MAX_EQUIPPED_PETS;
  const subLine=sm
    ?(sm.icon+' '+sm.name+' · Lv '+getPetLevel(pet))
    :(def.icon+' '+def.name+' · Lv '+getPetLevel(pet));
  panel.innerHTML=
    '<button type="button" class="wb-btn once" onclick="closePetDetail()" style="margin-bottom:12px;width:100%">◀ BACK</button>'
    +'<div class="pet-detail-card">'
    +'<div class="pet-detail-header"><div class="pet-detail-icon">'+def.icon+'</div>'
    +'<div><div class="wb-item-name">'+escapeHtml(pet.name)+'</div>'
    +'<div class="wb-item-sub">'+subLine+'</div></div></div>'
    +'<div class="pet-ability-block">'+getPetAbilityText(pet, equipped)+'</div>'
    +(pet.type==='hedgehog'||pet.type==='magpie'?'<div class="pet-magpie-shiny">Ooh, shiny!</div>':'')
    +'<input type="text" class="pet-name-input" id="pet-name-input" maxlength="20" value="'+escapeHtml(pet.name)+'" onchange="savePetName(\''+pet.id+'\',this.value)">'
    +'<div class="pet-stat-row"><span>Birthday</span><span>'+formatPetBirthday(pet.birthday)+'</span></div>'
    +'<div class="pet-stat-row"><span>Active time</span><span>'+formatDuration(getPetActiveTimeMs(pet))+'</span></div>'
    +'<div class="pet-stat-row"><span>Following you</span><span>'+(equipped?'Yes 🐾':'No')+'</span></div>'
    +'</div>'
    +buildPetLevelPanelHtml(pet)
    +buildPetTreatPanelHtml(pet)
    +'<div class="pet-detail-actions">'
    +(equipped
      ?'<button type="button" class="wb-btn" onclick="unequipPet(\''+pet.id+'\')">Send home</button>'
      :(canEquip
        ?'<button type="button" class="wb-btn" onclick="equipPet(\''+pet.id+'\')">Equip — follow me</button>'
        :'<div class="store-line">Both follower slots full. Send another pet home first.</div>'))
    +'<button type="button" class="wb-btn pet-abandon-btn" onclick="confirmAbandonPet(\''+pet.id+'\')">Abandon…</button>'
    +'</div>';
}

function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
}

function savePetName(id,name){
  const pet=state.pets.find(p=>p.id===id);
  if(!pet) return;
  const trimmed=(name||'').trim().slice(0,20);
  pet.name=trimmed||getPetSpeciesDef(pet.type).name;
  renderPetsScreen(id);
}

function givePetTreat(id){
  const pet=state.pets.find(p=>p.id===id);
  if(!pet) return;
  const treat=getPetTreatStatus(pet);
  if(treat.fed){
    showToast(pet.name+' already had a treat today.');
    renderPetDetail(id);
    return;
  }
  const { item, amount, xp }=treat;
  if(itemCountBagAndStore(item.key)<amount){
    showToast('Need '+amount+' '+item.name+'.');
    renderPetDetail(id);
    return;
  }
  if(!consumeManyFromBagOrStore(item.key, amount)){
    showToast('Could not take treat items.');
    return;
  }
  pet.treatFed=true;
  pet.treatXp=xp;
  grantXP('husbandry', xp, null);
  showToast(pet.name+' enjoyed the treat! +'+xp+' Husbandry');
  renderPetDetail(id);
  renderPetsScreen(id);
  scheduleSaveGame();
}

function equipPet(id){
  if(!state.equippedPetIds) state.equippedPetIds=[];
  if(isPetEquipped(id)) return;
  if(state.equippedPetIds.length>=MAX_EQUIPPED_PETS){
    showToast('Only '+MAX_EQUIPPED_PETS+' pets can follow you at once.');
    return;
  }
  const pet=state.pets.find(p=>p.id===id);
  if(!pet) return;
  pet.equippedSince=Date.now();
  state.equippedPetIds.push(id);
  showToast(pet.name+' will follow you now. 🐾');
  if(pet.type==='goldfish'&&currentScreen==='fishing-screen'&&typeof renderFishAutoReleaseToggle==='function') renderFishAutoReleaseToggle();
  renderPetDetail(id);
  renderPetsScreen(id);
}

function unequipPet(id){
  const pet=state.pets.find(p=>p.id===id);
  if(!pet||!isPetEquipped(id)) return;
  flushPetActiveTime(pet);
  state.equippedPetIds=state.equippedPetIds.filter(x=>x!==id);
  if(pet.type==='goldfish'){
    state.fishAutoRelease=false;
    if(currentScreen==='fishing-screen'&&typeof renderFishAutoReleaseToggle==='function') renderFishAutoReleaseToggle();
  }
  showToast(pet.name+' stays home on the dog bed.');
  renderPetDetail(id);
  renderPetsScreen(id);
}

function getAbandonGuiltText(pet){
  const sm=SHARD_META[pet.shard]||SHARD_META.earth;
  const active=formatDuration(getPetActiveTimeMs(pet));
  const msgs=[
    pet.name+' looks up at you with those eyes. You\'re really doing this just because you wanted a '+sm.name.toLowerCase().replace(' shard','')+' cat instead?',
    'The dog bed will be empty again. '+pet.name+' has been with you for '+active+'. That meant something, didn\'t it?',
    pet.name+' kneads the blanket one last time. A different-coloured shard isn\'t worth this.',
    'You fed them twenty goldfish to earn their trust. Now you\'re walking away over a colour.',
    pet.name+' doesn\'t know about shard types. They just know your voice. Are you sure?',
  ];
  return msgs[Math.floor(Math.random()*msgs.length)];
}

function confirmAbandonPet(id){
  const pet=state.pets.find(p=>p.id===id);
  if(!pet) return;
  showChoiceBanner(
    'Let '+pet.name+' go?',
    '🐱',
    getAbandonGuiltText(pet),
    'Yes, abandon',
    'No — keep '+pet.name,
    ()=>doAbandonPet(id)
  );
}

function doAbandonPet(id){
  const pet=state.pets.find(p=>p.id===id);
  if(!pet) return;
  const name=pet.name;
  if(isPetEquipped(id)){
    flushPetActiveTime(pet);
    state.equippedPetIds=state.equippedPetIds.filter(x=>x!==id);
  }
  state.pets=state.pets.filter(p=>p.id!==id);
  viewingPetId=null;
  document.getElementById('pet-detail-panel').style.display='none';
  document.getElementById('pet-list-panel').style.display='block';
  showToast(name+' watches you leave from the doorway. …You don\'t look back.');
  renderPetsScreen();
  syncUI();
}

function renderPetsScreen(keepDetailId){
  migratePets();
  updateActivitySkillPill('pets', 'husbandry');
  if(keepDetailId&&viewingPetId===keepDetailId){
    renderPetDetail(keepDetailId);
  }
  const grid=document.getElementById('pet-slot-grid');
  const capLabel=document.getElementById('pets-cap-label');
  const eqLabel=document.getElementById('pets-equipped-label');
  const followRow=document.getElementById('pets-following-row');
  const max=maxOwnedPets();
  const eqIds=state.equippedPetIds||[];
  const eqCount=eqIds.length;
  if(capLabel) capLabel.textContent=state.pets.length+' / '+max;
  if(eqLabel) eqLabel.textContent=eqCount+' / '+MAX_EQUIPPED_PETS;
  if(followRow){
    if(!eqCount){
      followRow.innerHTML='<div class="pet-following-empty">No pets following — equip one below.</div>';
    }else{
      followRow.innerHTML=eqIds.map(eid=>{
        const p=state.pets.find(pet=>pet.id===eid);
        if(!p) return '';
        const sm=p.shard?(SHARD_META[p.shard]||SHARD_META.earth):null;
        const shardBit=sm?(' '+sm.icon):'';
        return '<div class="pet-following-chip" onclick="openPetDetail(\''+p.id+'\')">'+getPetIcon(p)+' '+escapeHtml(p.name)+shardBit+'</div>';
      }).join('');
    }
  }
  if(!grid) return;
  grid.innerHTML='';
  state.pets.forEach(p=>{
    const sm=p.shard?(SHARD_META[p.shard]||SHARD_META.earth):null;
    const equipped=isPetEquipped(p.id);
    const slot=document.createElement('div');
    slot.className='pet-slot filled';
    if(equipped) slot.classList.add('equipped');
    slot.onclick=()=>openPetDetail(p.id);
    slot.innerHTML=(equipped?'<div class="pet-slot-badge">🐾</div>':'')
      +'<div class="pet-slot-icon">'+getPetIcon(p)+'</div>'
      +(sm?('<div class="pet-slot-shard">'+sm.icon+'</div>'):'')
      +'<div class="pet-slot-name">'+escapeHtml(p.name)+'</div>';
    grid.appendChild(slot);
  });
  if(state.pets.length<max){
    const wrap=document.createElement('div');
    wrap.innerHTML=buildPetEmptySlotHtml();
    grid.appendChild(wrap.firstElementChild);
  }
  const nextUnlock=nextPetSlotUnlockLevel();
  if(nextUnlock!=null){
    const wrap=document.createElement('div');
    wrap.innerHTML=buildPetLockedSlotHtml(nextUnlock);
    grid.appendChild(wrap.firstElementChild);
  }
  const actions=document.getElementById('pets-actions');
  if(actions){
    actions.innerHTML=max===0
      ?'<div class="pet-following-empty">Reach Husbandry Lv '+HUSBANDRY_PET_UNLOCK_LEVEL+' to partner pets.</div>'
      :'';
  }
}

function adoptPet(type){
  const def=getPetSpeciesDef(type);
  if(!def) return;
  if(!state.pets) state.pets=[];
  if(state.pets.length>=maxOwnedPets()){ showToast('No empty pet slots.'); return; }
  if(petAdoptsWithSeeds(def)){
    const seedKey=resolveMagpieSeedKey(magpiePartnerFocusSeedKey);
    const need=MAGPIE_ADOPT_SEED_COST;
    const seedDef=seedKey?getBotanySeedDef(seedKey):null;
    if(!seedKey||itemCountBagAndStore(seedKey)<need){
      showToast('Need '+need+' '+(seedDef?.name||'seeds')+'.');
      return;
    }
    if(!consumeManyFromBagOrStore(seedKey, need)){
      showToast('Could not pay for seeds.'); return;
    }
    const pet=createPet(type);
    pet.focusSeedKey=magpiePartnerFocusSeedKey||seedKey;
    state.pets.push(pet);
    const husbandryXp=husbandryXpForPetAdoption(def);
    grantXP('husbandry', husbandryXp, null);
    if(!state.equippedPetIds) state.equippedPetIds=[];
    if(state.equippedPetIds.length<MAX_EQUIPPED_PETS){
      pet.equippedSince=Date.now();
      state.equippedPetIds.push(pet.id);
    }
    showToast(def.icon+' '+pet.name+' settles on the bed. Something shiny awaits. +'+husbandryXp+' Husbandry');
    const partnerOpen=document.getElementById('pet-partner-panel')?.style.display!=='none';
    if(partnerOpen) closePetPartnerScreen();
    else renderPetsScreen();
    syncUI();
    return;
  }
  if(petAdoptsWithMultipleCosts(def)){
    const status=getPetAdoptCostStatus(def);
    if(!status.canAdopt){
      const missing=status.lines.find(line=>!line.ok);
      const name=missing?.meta?.name||missing?.key||'supplies';
      showToast('Need '+missing.need+' '+name+'.');
      return;
    }
    for(const line of status.lines){
      if(!consumeManyFromBagOrStore(line.key, line.need)){
        showToast('Could not pay adoption costs.');
        return;
      }
    }
    const pet=createPet(type);
    state.pets.push(pet);
    const husbandryXp=husbandryXpForPetAdoption(def);
    grantXP('husbandry', husbandryXp, null);
    if(!state.equippedPetIds) state.equippedPetIds=[];
    if(state.equippedPetIds.length<MAX_EQUIPPED_PETS){
      pet.equippedSince=Date.now();
      state.equippedPetIds.push(pet.id);
    }
    showToast(def.icon+' '+pet.name+' settles into the bowl. Auto-release awaits at the fishing spot. +'+husbandryXp+' Husbandry');
    const partnerOpen=document.getElementById('pet-partner-panel')?.style.display!=='none';
    if(partnerOpen) closePetPartnerScreen();
    else renderPetsScreen();
    syncUI();
    return;
  }
  if(itemCountBagAndStore(def.adoptCostKey)<def.adoptCostAmount){
    showToast('Need '+def.adoptCostAmount+' '+def.adoptCostLabel+'.');
    return;
  }
  if(!consumeManyFromBagOrStore(def.adoptCostKey,def.adoptCostAmount)){
    showToast('Could not pay for '+def.adoptCostLabel+'.'); return;
  }
  const pet=createPet(type);
  state.pets.push(pet);
  const husbandryXp=husbandryXpForPetAdoption(def);
  grantXP('husbandry', husbandryXp, null);
  if(!state.equippedPetIds) state.equippedPetIds=[];
  if(state.equippedPetIds.length<MAX_EQUIPPED_PETS){
    pet.equippedSince=Date.now();
    state.equippedPetIds.push(pet.id);
  }
  const xpNote=' +'+husbandryXp+' Husbandry';
  if(def.passiveType==='shard'&&pet.shard){
    const sm=SHARD_META[pet.shard];
    showToast(def.icon+' '+pet.name+' settles on the bed. A '+sm.name.toLowerCase()+' hunter.'+xpNote);
  }else if(def.passiveType==='storageRedirect'){
    showToast(def.icon+' '+pet.name+' settles on the bed. Ready to fetch.'+xpNote);
  }else if(def.passiveType==='nailCollect'){
    showToast(def.icon+' '+pet.name+' settles on the bed. Ooh, shiny!'+xpNote);
  }else if(def.passiveType==='oreScout'){
    showToast(def.icon+' '+pet.name+' settles on the bed. Something shiny awaits.'+xpNote);
  }else if(def.passiveType==='seedCollect'){
    showToast(def.icon+' '+pet.name+' curls up — but those paws still find seeds.'+xpNote);
  }else{
    showToast(def.icon+' '+pet.name+' settles on the bed.'+xpNote);
  }
  const partnerOpen=document.getElementById('pet-partner-panel')?.style.display!=='none';
  if(partnerOpen) closePetPartnerScreen();
  else renderPetsScreen();
  syncUI();
}

function adoptKitten(){
  adoptPet('cat');
}

let petPassiveTimer=null;
function tickPetPassives(){
  const ids=state.equippedPetIds||[];
  if(!ids.length) return;
  let detailRefresh=false;
  ids.forEach(id=>{
    const pet=state.pets.find(p=>p.id===id);
    if(!pet) return;
    if(grantPetFollowProgress(pet)&&viewingPetId===id) detailRefresh=true;
    const def=getPetSpeciesDef(pet.type);
    if(def.passiveType==='shard'&&pet.shard){
      if(Math.random()>=getPetShardPassiveChance(pet)) return;
      state.pockets[pet.shard]=(state.pockets[pet.shard]||0)+1;
      const sm=SHARD_META[pet.shard];
      showQuickToast(pet.name+' found '+sm.icon);
      if(openPanel==='inv') renderInvPanel();
    }else if(def.passiveType==='nailCollect'){
      const nailKey=rollNailCollectDrop(getPetLevel(pet));
      if(!nailKey||!grantNailToStorage(nailKey)) return;
      const nail=NAIL_TYPES[nailKey];
      showQuickToast(pet.name+': ooh shiny! '+(nail?.icon||'🔩'));
    }else if(def.passiveType==='oreScout'){
      const level=getPetLevel(pet);
      const goldPct=getMagpieGoldOreChancePercent(level)/100;
      const diaPct=getMagpieDiamondChancePercent(level)/100;
      let found=false;
      if(Math.random()<goldPct){
        const ore=MINE_RESOURCE_DEFS?.gold_ore;
        if(ore&&storageAddDirect('gold_ore', ore.icon, ore.name, 1)){
          showQuickToast(pet.name+' found '+ore.icon+' gold ore!');
          found=true;
        }
      }
      if(Math.random()<diaPct){
        const gem=MINE_RESOURCE_DEFS?.diamond;
        if(gem&&storageAddDirect('diamond', gem.icon, gem.name, 1)){
          showQuickToast(pet.name+' found '+gem.icon+' diamond!');
          found=true;
        }
      }
      if(found&&openPanel==='inv') renderInvPanel();
    }else if(def.passiveType==='seedCollect'){
      const range=getDormouseSeedCollectRange(getPetLevel(pet));
      const amount=range.min+Math.floor(Math.random()*(range.max-range.min+1));
      const counts={};
      for(let i=0;i<amount;i++){
        const seedKey=rollRandomBotanySeedKey();
        const seedDef=getBotanySeedDef(seedKey);
        if(!seedDef) continue;
        storageAddDirect(seedKey, seedDef.icon, seedDef.name, 1);
        counts[seedKey]=(counts[seedKey]||0)+1;
      }
      const total=Object.values(counts).reduce((s,n)=>s+n,0);
      if(total>0){
        const preview=Object.entries(counts).slice(0,2).map(([key,n])=>{
          const sd=getBotanySeedDef(key);
          return (n>1?n+'× ':'')+(sd?.icon||'🌱');
        }).join(' ');
        showQuickToast(pet.name+' stashed '+total+' seed'+(total===1?'':'s')+' '+preview);
        if(openPanel==='inv') renderInvPanel();
      }
    }
  });
  if(detailRefresh) renderPetDetail(viewingPetId);
  syncUI();
}

function startPetPassiveLoop(){
  if(petPassiveTimer) clearInterval(petPassiveTimer);
  petPassiveTimer=setInterval(tickPetPassives,PET_PASSIVE_INTERVAL_MS);
}

let fpCD=false;
let fpOverlayCloser=null;
let activeFpOverlayCell=null;

function updateFireplaceCell(){
  const quick=state.fireplaceQuickAction==='logs'?'add log':'cook food';
  document.querySelectorAll('.int-cell[data-int-key="fireplace"]').forEach(cell=>{
    const label=cell.querySelector('.fireplace-idle .int-label');
    const btn=cell.querySelector('.int-quick-action-btn');
    if(label) label.textContent=cook.running?'cooking…':(quick==='add log'?'fireplace':'fireplace');
    if(btn) btn.textContent=cook.running?'stop':quick;
  });
}

function isFpOverlayOpen(){
  return !!activeFpOverlayCell?.classList.contains('plot-activity-menu-ready');
}

function closeFireplaceOverlay(){
  if(activeFpOverlayCell){
    activeFpOverlayCell.classList.remove('plot-activity-menu-ready');
    activeFpOverlayCell=null;
  }
  if(fpOverlayCloser){ document.removeEventListener('pointerdown',fpOverlayCloser,true); fpOverlayCloser=null; }
}

function openFireplaceOverlayForCell(cell){
  if(!cell) return;
  closeFireplaceOverlay();
  updateFireplaceCell();
  cell.classList.add('plot-activity-menu-ready');
  activeFpOverlayCell=cell;
  if(fpOverlayCloser) document.removeEventListener('pointerdown',fpOverlayCloser,true);
  fpOverlayCloser=function(e){
    if(activeFpOverlayCell?.contains(e.target)) return;
    closeFireplaceOverlay();
    e.preventDefault();
    e.stopPropagation();
  };
  setTimeout(()=>document.addEventListener('pointerdown',fpOverlayCloser,true),80);
}

function toggleFireplaceOverlayForCell(cell, event){
  if(intSuppressClick) return;
  if(event?.target?.closest?.('.plot-menu-btn')||event?.target?.closest?.('.int-quick-action-btn')) return;
  if(activeFpOverlayCell===cell&&isFpOverlayOpen()) closeFireplaceOverlay();
  else openFireplaceOverlayForCell(cell);
}

function fpQuickTap(event){
  event.stopPropagation();
  closeFireplaceOverlay();
  if(cook.running && state.fireplaceQuickAction==='cook'){ openFireplaceScreen(); return; }
  if(state.fireplaceQuickAction==='logs'){ addLogToFire(); return; }
  startCooking();
}

function fpMenuTap(event){
  event.stopPropagation();
  closeFireplaceOverlay();
  openFireplaceScreen();
}

function openFireplaceScreen(){
  fpRecipePickerOpen=false;
  showScreen('fireplace-screen');
  lastHome='interior-screen';
  renderFireplace();
}

function closeFireplaceScreen(){
  showScreen('interior-screen');
  lastHome='interior-screen';
  syncUI();
}

function toggleFireplaceDefault(){
  state.fireplaceQuickAction=state.fireplaceQuickAction==='cook'?'logs':'cook';
  updateFireplaceCell();
  renderFireplace();
  showToast('Quick tap: '+(state.fireplaceQuickAction==='cook'?'cook food':'add log')+'.');
}

let fpRecipePickerOpen=false;

function toggleFpRecipePicker(){
  fpRecipePickerOpen=!fpRecipePickerOpen;
  renderFpRecipePicker();
}

function selectCookRecipe(key){
  if(!COOKING_RECIPES[key]) return;
  if(key!==cook.recipeKey&&cook.running) stopCooking();
  cook.recipeKey=key;
  fpRecipePickerOpen=false;
  renderFireplace();
}

function cookQuickTapLabel(quickAction, variant){
  if(quickAction==='cook') return '🍳 Cook food';
  return variant==='firepit'?'🪵 Throw log':'🪵 Add log';
}

function renderCookQuickTapToggle(containerId, quickAction, toggleHandler, variant){
  const el=document.getElementById(containerId);
  if(!el) return;
  el.innerHTML='<button type="button" class="store-shelf-action" style="width:100%" onclick="'+toggleHandler+'()">Quick tap: '
    +cookQuickTapLabel(quickAction, variant)+' (tap to change)</button>';
}

function renderCookXpPreview(el, recipe){
  if(!el||!recipe) return;
  const pct=Math.round(calcCookSuccess(recipe)*100);
  const cookLvl=Number(state.skills.cooking?.level)||1;
  el.innerHTML='<span class="wb-xp-line">Success: +'+recipe.xpSuccess+' Cooking • Burn: +'+recipe.xpBurn+' Cooking</span>'
    +'<span class="wb-xp-line">'+pct+'% success at Cooking Lv '+cookLvl+'</span>';
}

function renderCookRecipePickerList(el, pickerOpen, toggleHandler, selectHandler){
  if(!el) return;
  const recipe=COOKING_RECIPES[cook.recipeKey]||COOKING_RECIPES.goldfish;
  const total=itemCountBagAndStore(recipe.rawKey);
  const pct=Math.round(calcCookSuccess(recipe)*100);
  const cookLvl=Number(state.skills.cooking?.level)||1;
  const stockCls=wbStockClass(total, 1);
  const stockLine=recipe.rawName+' — '+formatAvailableCount(total);

  if(!pickerOpen){
    el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed'+(total<1?' unavail':' ready')+'" onclick="'+toggleHandler+'()">'
      +'<span class="wb-mat-icon">'+recipe.rawIcon+'</span>'
      +'<div class="wb-mat-pick-body">'
      +'<span class="wb-mat-pick-avail wb-mat-pick-line '+stockCls+'">'+stockLine+'</span>'
      +wbMatSuccessLineHtml(recipe.rawIcon+' → '+recipe.cookedName+' • '+pct+'% success')
      +'</div>'
      +'<span class="wb-log-pick-chevron">▾</span>'
      +'</div>';
    return;
  }

  const sorted=Object.keys(COOKING_RECIPES).sort((a,b)=>
    (COOKING_RECIPES[a].unlockLevel||0)-(COOKING_RECIPES[b].unlockLevel||0));
  el.innerHTML=sorted.map(key=>{
    const r=COOKING_RECIPES[key];
    const stock=itemCountBagAndStore(r.rawKey);
    const p=Math.round(calcCookSuccess(r)*100);
    const locked=cookLvl<r.unlockLevel;
    const selCls=cook.recipeKey===key?' selected':'';
    const unavailCls=locked||stock===0?' unavail':'';
    const onclick=locked?'':(' onclick="'+(cook.recipeKey===key?toggleHandler+'()':selectHandler+'(\''+key+'\')')+'"');
    const desc=locked
      ?('🔒 Cooking Lv '+r.unlockLevel+' (same as Fishing)')
      :('<span class="wb-mat-stock wb-mat-pick-line '+wbStockClass(stock, 1)+'">'+r.rawName+' — '+formatAvailableCount(stock)+'</span>'
        +wbMatSuccessLineHtml(p+'% success'));
    return '<div class="wb-mat-option'+selCls+unavailCls+'"'+onclick+'>'
      +'<span class="wb-mat-icon">'+r.rawIcon+'</span>'
      +'<span class="wb-mat-info">'
      +'<span class="wb-mat-name">'+r.rawName+' → '+r.cookedIcon+'</span>'
      +'<span class="wb-mat-stock">'+desc+'</span>'
      +'</span></div>';
  }).join('');
}

function renderFpRecipePicker(){
  renderCookRecipePickerList(
    document.getElementById('fp-recipe-list'),
    fpRecipePickerOpen,
    'toggleFpRecipePicker',
    'selectCookRecipe'
  );
}

function refreshCookingScreen(){
  if(currentScreen==='fireplace-screen') renderFireplace();
  else if(currentScreen==='fire-pit-screen'&&typeof renderFirePitScreen==='function') renderFirePitScreen();
}

function getCookActivityLogId(){
  return currentScreen==='fire-pit-screen'?'firepit-log':'fp-log';
}

function renderFireplace(){
  updateActivitySkillPill('fp', 'cooking');
  const recipe=COOKING_RECIPES[cook.recipeKey]||COOKING_RECIPES.goldfish;
  renderCookQuickTapToggle('fp-default-toggle', state.fireplaceQuickAction, 'toggleFireplaceDefault', 'indoor');
  renderFpRecipePicker();
  renderCookXpPreview(document.getElementById('fp-xp-preview'), recipe);
  const status=document.getElementById('fp-status');
  if(status){
    status.textContent=cook.running?'Cooking…':'Cook raw fish over the hearth';
    status.classList.toggle('idle',!cook.running);
  }
  const btnEl=document.getElementById('fp-buttons');
  if(!btnEl) return;
  const can=canCookRecipe(recipe);
  renderOnceContinuousButtons({
    btnEl,
    running:cook.running,
    can,
    onceLabel:'1 COOK',
    onceOnclick:'cookOnce()',
    continuousOnclick:'cookContinuous()',
    stopOnclick:'stopCooking()',
    stopLabel:'⛔ STOP COOKING',
    noticeHtml:!can?('<div class="wb-cost-notice">'+escapeHtml(getCookBlockReason(recipe)||'Cannot cook right now.')+'</div>'):'',
  });
}

let cookActivity=null;

function getCookActivity(){
  if(cookActivity) return cookActivity;
  cookActivity=createTimedActivity({
    type:'cooking',
    state:cook,
    label:'Cooking',
    canContinue:()=>canCookRecipe(COOKING_RECIPES[cook.recipeKey]),
    cannotStartMsg:'No raw food to cook.',
    outOfResourcesMsg:'Out of that raw food or bag full.',
    onAttempt:()=>{
      const recipe=COOKING_RECIPES[cook.recipeKey];
      const blockReason=getCookBlockReason(recipe);
      if(blockReason){
        showToast(blockReason);
        return false;
      }
      doCookAttempt(cook.recipeKey);
    },
    onRefresh:()=>{
      refreshCookingScreen();
      updateFireplaceCell();
    },
    onStop:()=>{ updateFireplaceCell(); },
  });
  return cookActivity;
}

function startCooking(){
  getCookActivity().startContinuous();
}

function stopCooking(fromActivitySwitch){
  getCookActivity().stop(fromActivitySwitch);
}

function cookOnce(){
  stopOtherActivities(null);
  const recipe=COOKING_RECIPES[cook.recipeKey];
  const blockReason=getCookBlockReason(recipe);
  if(blockReason){
    showToast(blockReason);
    refreshCookingScreen();
    return;
  }
  doCookAttempt(cook.recipeKey);
  refreshCookingScreen();
  syncUI();
}

function cookContinuous(){
  const recipe=COOKING_RECIPES[cook.recipeKey];
  const blockReason=getCookBlockReason(recipe);
  if(blockReason){
    showToast(blockReason);
    refreshCookingScreen();
    return;
  }
  getCookActivity().startContinuous();
}

function doCookAttempt(recipeKey){
  const recipe=COOKING_RECIPES[recipeKey];
  if(!recipe||!canCookRecipe(recipe)) return {ok:false};
  const invBefore=invTotal();
  if(!consumeRawForCook(recipe)) return {ok:false};
  const rate=calcCookSuccess(recipe);
  const success=Math.random()<rate;
  const logId=getCookActivityLogId();
  if(success){
    if(invTotal()<getInvCap()){
      invAddDirect(recipe.cookedKey,recipe.cookedIcon,recipe.cookedName,1,{ pickupBaseline:invBefore });
      grantXP('cooking',recipe.xpSuccess,null,{ deferSync:cook.running });
      addActivityLog(logId,recipe.cookedIcon+' '+recipe.cookedName+' cooked! +'+recipe.xpSuccess+' Cooking','success');
      return {ok:true,success:true};
    }
    returnOneToBagOrStore(recipe.rawKey,recipe.rawIcon,recipe.rawName);
    addActivityLog(logId,'Bag full — raw fish returned.','fail');
    return {ok:true,success:false,bagFull:true};
  }
  grantXP('cooking',recipe.xpBurn,null,{ deferSync:cook.running });
  const msg='Burnt. +' + recipe.xpBurn + ' Cooking (' + Math.round(rate*100) + '% was the odds)';
  addActivityLog(logId,msg,'fail');
  return {ok:true,success:false,burned:true};
}

let swOverlayCloser=null;
let activeSwOverlayCell=null;
let swRecipePickerOpen=false;

function updateSpinningWheelCell(){
  document.querySelectorAll('.int-cell[data-int-key="spinningwheel"]').forEach(cell=>{
    const btn=cell.querySelector('.int-quick-action-btn');
    if(btn) btn.textContent=spin.running?'stop':'spin fiber';
  });
}

function isSwOverlayOpen(){
  return !!activeSwOverlayCell?.classList.contains('plot-activity-menu-ready');
}

function closeSpinningWheelOverlay(){
  if(activeSwOverlayCell){
    activeSwOverlayCell.classList.remove('plot-activity-menu-ready');
    activeSwOverlayCell=null;
  }
  if(swOverlayCloser){ document.removeEventListener('pointerdown',swOverlayCloser,true); swOverlayCloser=null; }
}

function openSpinningWheelOverlayForCell(cell){
  if(!cell) return;
  closeSpinningWheelOverlay();
  updateSpinningWheelCell();
  cell.classList.add('plot-activity-menu-ready');
  activeSwOverlayCell=cell;
  if(swOverlayCloser) document.removeEventListener('pointerdown',swOverlayCloser,true);
  swOverlayCloser=function(e){
    if(activeSwOverlayCell?.contains(e.target)) return;
    closeSpinningWheelOverlay();
    e.preventDefault();
    e.stopPropagation();
  };
  setTimeout(()=>document.addEventListener('pointerdown',swOverlayCloser,true),80);
}

function toggleSpinningWheelOverlayForCell(cell, event){
  if(intSuppressClick) return;
  if(event?.target?.closest?.('.plot-menu-btn')||event?.target?.closest?.('.int-quick-action-btn')) return;
  if(activeSwOverlayCell===cell&&isSwOverlayOpen()) closeSpinningWheelOverlay();
  else openSpinningWheelOverlayForCell(cell);
}

function swQuickTap(event){
  event.stopPropagation();
  closeSpinningWheelOverlay();
  if(spin.running){ stopSpinning(); return; }
  spinOnce();
}

function swMenuTap(event){
  event.stopPropagation();
  closeSpinningWheelOverlay();
  openSpinningWheelScreen();
}

function openSpinningWheelScreen(){
  swRecipePickerOpen=false;
  showScreen('spinningwheel-screen');
  lastHome='interior-screen';
  renderSpinningWheel();
}

function closeSpinningWheelScreen(){
  closeSpinningWheelOverlay();
  showScreen('interior-screen');
  lastHome='interior-screen';
  syncUI();
}

function selectSpinRecipe(key){
  if(!SPINNING_RECIPES[key]) return;
  if(key!==spin.recipeKey&&spin.running) stopSpinning();
  spin.recipeKey=key;
  swRecipePickerOpen=false;
  renderSpinningWheel();
}

function renderSwRecipePicker(){
  const el=document.getElementById('sw-recipe-list');
  if(!el) return;
  const recipe=SPINNING_RECIPES[spin.recipeKey]||SPINNING_RECIPES.twisted_grass;
  const total=itemCountBagAndStore(recipe.rawKey);
  const pct=Math.round(calcSpinSuccess(recipe)*100);
  const stockCls=wbStockClass(total, 1);
  const stockLine=recipe.rawName+' — '+formatAvailableCount(total);

  if(!swRecipePickerOpen){
    el.innerHTML='<div class="wb-log-pick wb-log-pick-collapsed'+(total<1?' unavail':' ready')+'" onclick="toggleSwRecipePicker()">'
      +'<span class="wb-mat-icon">'+recipe.rawIcon+'</span>'
      +'<div class="wb-mat-pick-body">'
      +'<span class="wb-mat-pick-avail wb-mat-pick-line '+stockCls+'">'+stockLine+'</span>'
      +wbMatSuccessLineHtml(spinRecipeLabel(recipe)+' • '+pct+'% success')
      +'</div>'
      +'<span class="wb-log-pick-chevron">▾</span>'
      +'</div>';
    return;
  }

  const byTier={};
  SPIN_RECIPE_ORDER.forEach(key=>{
    const r=SPINNING_RECIPES[key];
    if(!r) return;
    if(!byTier[r.threadLabel]) byTier[r.threadLabel]=[];
    byTier[r.threadLabel].push(key);
  });

  el.innerHTML=SPIN_TIER_ORDER.map(tier=>{
    const keys=byTier[tier];
    if(!keys?.length) return '';
    const rows=keys.map(key=>{
      const r=SPINNING_RECIPES[key];
      const stock=itemCountBagAndStore(r.rawKey);
      const p=Math.round(calcSpinSuccess(r)*100);
      const selCls=spin.recipeKey===key?' selected':'';
      const unavailCls=stock===0?' unavail':'';
      const onclick=stock===0?'':(' onclick="'+(spin.recipeKey===key?'toggleSwRecipePicker()':'selectSpinRecipe(\''+key+'\')')+'"');
      return '<div class="wb-mat-option'+selCls+unavailCls+'"'+onclick+'>'
        +'<span class="wb-mat-icon">'+r.rawIcon+'</span>'
        +'<span class="wb-mat-info">'
        +'<span class="wb-mat-name">'+spinRecipeLabel(r)+'</span>'
        +'<span class="wb-mat-stock wb-mat-pick-line '+wbStockClass(stock, 1)+'">'+r.rawName+' — '+formatAvailableCount(stock)+'</span>'
        +wbMatSuccessLineHtml(p+'% success')
        +'</span></div>';
    }).join('');
    return '<div class="sw-tier-label">'+tier.toUpperCase()+' THREAD</div>'+rows;
  }).join('');
}

function toggleSwRecipePicker(){
  swRecipePickerOpen=!swRecipePickerOpen;
  renderSwRecipePicker();
}

function renderSpinningWheel(){
  updateActivitySkillPill('sw', 'tailoring');
  const recipe=SPINNING_RECIPES[spin.recipeKey]||SPINNING_RECIPES.twisted_grass;
  const pct=Math.round(calcSpinSuccess(recipe)*100);
  renderSwRecipePicker();
  const xpEl=document.getElementById('sw-xp-preview');
  if(xpEl){
    xpEl.innerHTML='<span class="wb-xp-line">Success: +'+recipe.xpSuccess+' Tailoring • Fail: +'+recipe.xpFail+' Tailoring</span>'
      +'<span class="wb-xp-line">'+pct+'% success at Tailoring Lvl '+(state.skills.tailoring?.level||1)+'</span>';
  }
  const status=document.getElementById('sw-status');
  if(status){
    status.textContent=spin.running?'Spinning…':'Ready to spin';
    status.classList.toggle('idle',!spin.running);
  }
  const btnEl=document.getElementById('sw-buttons');
  if(!btnEl) return;
  const can=canSpinRecipe(recipe)&&canStoreSpinResult(recipe);
  const needSpace=!canStoreSpinResult(recipe)&&itemCountBagAndStore(recipe.rawKey)>0;
  renderOnceContinuousButtons({
    btnEl,
    running:spin.running,
    can,
    onceLabel:'1 SPIN',
    onceOnclick:'spinOnce()',
    continuousOnclick:'spinContinuous()',
    stopOnclick:'stopSpinning()',
    stopLabel:'⛔ STOP SPINNING',
    noticeHtml:needSpace?'<div class="wb-cost-notice">Bag full — only failures possible until you make space.</div>':'',
  });
}

let spinActivity=null;

function getSpinActivity(){
  if(spinActivity) return spinActivity;
  spinActivity=createTimedActivity({
    type:'spinning',
    state:spin,
    label:'Spinning',
    canContinue:()=>{
      const recipe=SPINNING_RECIPES[spin.recipeKey];
      return recipe&&canSpinRecipe(recipe)&&canStoreSpinResult(recipe);
    },
    getOutOfResourcesMsg:()=>{
      const recipe=SPINNING_RECIPES[spin.recipeKey];
      if(recipe&&canSpinRecipe(recipe)) return 'Bag full — make room before spinning.';
      return 'Out of that fiber.';
    },
    cannotStartMsg:'No fibers to spin.',
    outOfResourcesMsg:'Out of that fiber.',
    onAttempt:()=>{
      const recipe=SPINNING_RECIPES[spin.recipeKey];
      if(!recipe||!canSpinRecipe(recipe)) return false;
      if(!canStoreSpinResult(recipe)) return false;
      doSpinAttempt(spin.recipeKey);
    },
    onRefresh:()=>{
      renderSpinningWheel();
      updateSpinningWheelCell();
    },
    onStop:()=>{ updateSpinningWheelCell(); },
  });
  return spinActivity;
}

function startSpinning(){
  getSpinActivity().startContinuous();
}

function stopSpinning(fromActivitySwitch){
  getSpinActivity().stop(fromActivitySwitch);
}

function spinOnce(){
  stopOtherActivities(null);
  const recipe=SPINNING_RECIPES[spin.recipeKey];
  if(!recipe||!canSpinRecipe(recipe)){
    showToast('No fibers to spin.');
    renderSpinningWheel();
    return;
  }
  if(!canStoreSpinResult(recipe)){
    showToast('Bag full — make room before spinning.');
    renderSpinningWheel();
    return;
  }
  doSpinAttempt(spin.recipeKey);
  renderSpinningWheel();
  syncUI();
}

function spinContinuous(){
  getSpinActivity().startContinuous();
}

function doSpinAttempt(recipeKey){
  const recipe=SPINNING_RECIPES[recipeKey];
  if(!recipe||!canSpinRecipe(recipe)) return {ok:false};
  const invBefore=invTotal();
  const rawInBag=(state.inventory[recipe.rawKey]?.count||0)>0;
  if(!consumeOneFromBagOrStore(recipe.rawKey)) return {ok:false};
  const rate=calcSpinSuccess(recipe);
  const success=Math.random()<rate;
  if(success){
    if(rawInBag||invTotal()<getInvCap()){
      invAddDirect(recipe.outputKey,recipe.outputIcon,recipe.outputName,1,{ pickupBaseline:invBefore });
      grantXP('tailoring',recipe.xpSuccess,null,{ deferSync:spin.running });
      addActivityLog('sw-log',recipe.outputIcon+' '+recipe.outputName+' spun! +'+recipe.xpSuccess+' Tailoring','success');
      return {ok:true,success:true};
    }
    if(!state.storage[recipe.rawKey]) state.storage[recipe.rawKey]={icon:recipe.rawIcon,name:recipe.rawName,count:0};
    state.storage[recipe.rawKey].count++;
    addActivityLog('sw-log','Bag full — fiber returned to storage.','fail');
    return {ok:true,success:false,returned:true};
  }
  grantXP('tailoring',recipe.xpFail,null,{ deferSync:spin.running });
  addActivityLog('sw-log','Snapped. +' + recipe.xpFail + ' Tailoring (' + Math.round(rate*100) + '% was the odds)','fail');
  return {ok:true,success:false,broken:true};
}

function pokeFireplace(){
  document.getElementById('fp-menu')?.remove();
  if(fpCD)return; fpCD=true; state.fireplaceStokes++;
  showToast("You poke the fire. It crackles contentedly. 🔥");
  setTimeout(()=>{fpCD=false;},1800);
}

function addLogToFire(){
  document.getElementById('fp-menu')?.remove();
  stopOtherActivities(null);
  const logKey=pickBestLogKeyForBurning();
  if(!logKey){
    showToast('No wood available.');
    return;
  }
  const result=burnLogForFireAffinity(logKey);
  if(!result.ok){
    showToast('No wood available.');
    return;
  }
  state.logsOnFire++;
  addActivityLog('fp-log',(result.logDef.icon||'🪵')+' '+(result.logDef.name||'Log')+' fed to the hearth. +'+result.xp+' Fire','success');
  showToast('You feed the fire. It brightens. +' + result.xp + ' Fire 🔥');
  syncUI();
}

function ensureStoreRoomShelfFields(room){
  if(!room.shelfTiers) room.shelfTiers={1:0,2:0,3:0,4:0};
  if(!room.shelfStages) room.shelfStages={1:0,2:0,3:0,4:0};
  if(!room.shelfUpgradeStages) room.shelfUpgradeStages={1:0,2:0,3:0,4:0};
  if(!room.shelves) room.shelves={1:false,2:false,3:false,4:false};
}

function repairShelfSlotState(room, slot){
  if(!room) return false;
  ensureStoreRoomShelfFields(room);
  const recipe=RECIPES['shelf_'+slot];
  if(!recipe) return false;
  const stages=recipe.stages;
  let repaired=false;
  const tier=room.shelfTiers[slot]||0;

  if(room.shelves[slot]&&!tier){
    room.shelfTiers[slot]=1;
    repaired=true;
  }
  if(tier<1&&(room.shelfStages[slot]||0)>=stages){
    room.shelves[slot]=true;
    room.shelfTiers[slot]=1;
    room.shelfStages[slot]=stages;
    repaired=true;
  }else if(tier<1&&(room.shelfStages[slot]||0)>stages){
    room.shelfStages[slot]=stages;
    repaired=true;
  }
  if(tier>=1&&tier<LOG_TIER_ORDER.length&&(room.shelfUpgradeStages[slot]||0)>=stages){
    room.shelfTiers[slot]=tier+1;
    room.shelfUpgradeStages[slot]=0;
    repaired=true;
  }else if(tier>=1&&(room.shelfUpgradeStages[slot]||0)>stages){
    room.shelfUpgradeStages[slot]=stages;
    repaired=true;
  }
  return repaired;
}

function repairAllShelfStates(){
  if(!state.storeRooms) return;
  Object.values(state.storeRooms).forEach(room=>{
    [1,2,3,4].forEach(slot=>repairShelfSlotState(room, slot));
  });
}

function migrateShelfTiers(){
  migrateStoreRooms();
  repairAllShelfStates();
}

function getStoreRoomForCraft(){
  if(!craft.storeRoomId) return null;
  migrateStoreRooms();
  return state.storeRooms[craft.storeRoomId]||null;
}

function finalizeShelfCraft(shelfSlot, recipe, isUpgrade, grantStageXp){
  const roomId=craft.storeRoomId;
  if(!roomId){
    showToast('Store room link lost — open the shelf from that store room again.');
    return false;
  }
  migrateStoreRooms();
  const room=state.storeRooms[roomId];
  if(!room){
    showToast('Store room link lost — open the shelf from that store room again.');
    return false;
  }
  ensureStoreRoomShelfFields(room);
  if(isUpgrade){
    room.shelfTiers[shelfSlot]=(room.shelfTiers[shelfSlot]||1)+1;
    room.shelfUpgradeStages[shelfSlot]=0;
  }else{
    room.shelves[shelfSlot]=true;
    room.shelfTiers[shelfSlot]=1;
    room.shelfStages[shelfSlot]=recipe.stages;
  }
  craft.stage=0;
  craft.complete=false;
  if(grantStageXp) grantXP('carpentry', recipe.xpStage, null);
  grantXP('carpentry', recipe.xpComplete, null);
  if(isUpgrade){
    const tierName=getLogTierName(room.shelfTiers[shelfSlot]);
    craft.upgradeShelfSlot=null;
    addActivityLog('wb-log','🗄️ Shelf slot '+shelfSlot+' upgraded to '+tierName+'! +'+recipe.xpComplete+' xp', 'complete');
    showToast('🗄️ Shelf upgraded to '+tierName+' (+50 capacity).');
  }else{
    addActivityLog('wb-log','🗄️ Shelf slot '+shelfSlot+' installed! +'+recipe.xpComplete+' xp', 'complete');
    showToast('🗄️ Shelf installed. Storage capacity increased.');
  }
  stopCrafting(true);
  clearActivity('crafting');
  if(viewingStoreRoomId&&viewingStoreRoomId!==craft.storeRoomId) viewingStoreRoomId=craft.storeRoomId;
  renderStoreRoom();
  return true;
}

function getShelfTier(slot, storeRoomId){
  migrateShelfTiers();
  const room=getStoreRoomById(storeRoomId||craft.storeRoomId||viewingStoreRoomId);
  if(!room) return 0;
  return room.shelfTiers[slot]||0;
}

function getLogTierName(tier){
  const key = LOG_TIER_ORDER[tier - 1];
  return LOG_TYPES[key]?.name || 'Log';
}

function canUpgradeShelf(slot, storeRoomId){
  const tier=getShelfTier(slot, storeRoomId);
  return tier>=1 && tier<LOG_TIER_ORDER.length;
}

function getShelfTargetLogKey(slot, storeRoomId){
  const tier=getShelfTier(slot, storeRoomId);
  if(tier>=LOG_TIER_ORDER.length) return null;
  return LOG_TIER_ORDER[tier];
}

function storageCapPerType(){
  migrateShelfTiers();
  return listStoreRoomIdsOnMap().reduce((sum,id)=>sum+getStoreRoomCapacity(id),0);
}

function depositAllToStorage(){
  if(!hasAnyStoreRoom()) return 0;
  const cap = storageCapPerType();
  let moved = 0;
  Object.keys(state.inventory).forEach(key=>{
    if(key === 'axe') return;
    const item = state.inventory[key];
    if(!item?.count) return;
    const already = state.storage[key]?.count || 0;
    const room = Math.max(0, cap - already);
    const take = Math.min(room, item.count);
    if(take <= 0) return;
    if(!state.storage[key]) state.storage[key] = { icon:item.icon, name:item.name, count:0 };
    state.storage[key].count += take;
    item.count -= take;
    moved += take;
    if(item.count <= 0) delete state.inventory[key];
  });
  syncUI();
  return moved;
}

let interiorBuildCoords=null;
let interiorBuildMenuCloser=null;

function closeInteriorBuildMenu(){
  document.getElementById('interior-build-menu')?.remove();
  interiorBuildCoords=null;
  if(interiorBuildMenuCloser){
    document.removeEventListener('pointerdown',interiorBuildMenuCloser,true);
    interiorBuildMenuCloser=null;
  }
}

function buildInteriorFurnitureMenuItems(x,y){
  const items=listAvailableFurniture();
  if(!items.length){
    return '<div class="store-line" style="padding:8px 4px;color:rgba(200,169,110,0.45)">No furniture available.</div>';
  }
  return items.map(item=>{
    const stock=item.count===1?'1 available':item.count+' available';
    return '<button type="button" class="plot-add-item" onclick="placeInteriorFurniture('+x+','+y+',\''+item.key+'\')">'
      +'<span class="plot-add-item-icon">'+item.icon+'</span>'
      +'<span class="plot-add-item-name">'+item.name
      +'<span class="plot-add-item-drops">'+stock+'</span></span></button>';
  }).join('');
}

function openInteriorBuildMenu(x,y){
  closeInteriorBuildMenu();
  const ck=interiorCoordKey(x,y);
  const cellKey=state.interior?.cells?.[ck];
  if(!isInteriorBuildSlotKey(cellKey)){
    showToast('Pick an empty room or build slot.');
    return;
  }
  interiorBuildCoords={ x, y };
  const w=document.getElementById('game-wrapper');
  const m=document.createElement('div');
  m.id='interior-build-menu';
  m.className='plot-add-menu';
  m.onclick=(e)=>e.stopPropagation();
  const roomsHtml=INTERIOR_ROOM_MENU.map(typeId=>{
    const def=INTERIOR_ROOM_DEFS[typeId];
    if(!def) return '';
    return '<button type="button" class="plot-add-item" onclick="placeInteriorRoom('+x+','+y+',\''+typeId+'\')">'
      +'<span class="plot-add-item-icon">'+def.icon+'</span>'
      +'<span class="plot-add-item-name">'+def.name
      +'<span class="plot-add-item-drops">'+def.desc+'</span></span></button>';
  }).join('')
  +buildApothecaryUtilityMenuItem(x,y)
  +buildWonkyLoomUtilityMenuItem(x,y);
  const furnitureHtml=buildInteriorFurnitureMenuItems(x,y);
  m.innerHTML='<div class="plot-add-title">FILL A SPACE</div>'
    +'<div class="plot-add-sub">Pick what belongs here. Duplicates are fine — go wild.</div>'
    +'<div class="plot-add-cats">'
    +'<div class="plot-add-cat">'
    +'<button type="button" class="plot-add-cat-head" onclick="togglePlotAddCategory(this)"><span>Utilities</span><span class="plot-add-cat-chevron">▸</span></button>'
    +'<div class="plot-add-cat-body">'+roomsHtml+'</div></div>'
    +'<div class="plot-add-cat">'
    +'<button type="button" class="plot-add-cat-head" onclick="togglePlotAddCategory(this)"><span>Home-made furniture</span><span class="plot-add-cat-chevron">▸</span></button>'
    +'<div class="plot-add-cat-body">'+furnitureHtml+'</div></div>'
    +'</div>'
    +'<button type="button" class="plot-add-cancel" onclick="closeInteriorBuildMenu()">cancel</button>';
  w.appendChild(m);
  setTimeout(()=>{
    interiorBuildMenuCloser=function(e){
      const menu=document.getElementById('interior-build-menu');
      if(!menu){
        document.removeEventListener('pointerdown',interiorBuildMenuCloser,true);
        interiorBuildMenuCloser=null;
        return;
      }
      if(menu.contains(e.target)) return;
      closeInteriorBuildMenu();
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('pointerdown',interiorBuildMenuCloser,true);
  },80);
}

function placeInteriorRoom(x,y,typeId){
  const def=INTERIOR_ROOM_DEFS[typeId];
  if(!def){ closeInteriorBuildMenu(); return; }
  migrateInterior();
  const ck=interiorCoordKey(x,y);
  const cellKey=state.interior.cells[ck];
  if(!isInteriorBuildSlotKey(cellKey)){
    showToast('Pick an empty room or build slot.');
    closeInteriorBuildMenu();
    return;
  }
  if(typeId==='storeroom'){
    const id=genStoreRoomId();
    unpurgeStoreRoomId(id);
    state.storeRooms[id]=createDefaultStoreRoomData(id);
    state.interior.cells[ck]='storeroom:'+id;
  }else{
    state.interior.cells[ck]=typeId;
  }
  closeInteriorBuildMenu();
  renderInteriorGrid();
  syncUI();
  showToast(def.icon+' '+def.name+' built.');
}

function placeInteriorFurniture(x,y, furnitureKey){
  const fdef=getFurnitureDef(furnitureKey);
  if(!fdef){ closeInteriorBuildMenu(); return; }
  if(itemCountBagAndStore(furnitureKey)<1){
    showToast('You don\'t have any '+fdef.name+' left.');
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
  if(!consumeOneFromBagOrStore(furnitureKey)){
    showToast('Could not take '+fdef.name+'.');
    closeInteriorBuildMenu();
    return;
  }
  rememberInteriorSlotBeforeFurniture(ck, cellKey);
  state.interior.cells[ck]='furniture:'+furnitureKey;
  closeInteriorBuildMenu();
  renderInteriorGrid();
  syncUI();
  showToast(fdef.icon+' '+fdef.name+' placed.');
}

function openStoreRoomScreen(storeRoomId){
  migrateStoreRooms();
  const onMap=listStoreRoomIdsOnMap();
  if(storeRoomId&&onMap.includes(storeRoomId)) viewingStoreRoomId=storeRoomId;
  else if(!viewingStoreRoomId||!onMap.includes(viewingStoreRoomId)) viewingStoreRoomId=onMap[0]||null;
  if(!viewingStoreRoomId){ showToast('Build a Store Room first.'); return; }
  showScreen('storeroom-screen');
  renderStoreRoom();
}

function closeStoreRoom(){
  closeStoreOverlay();
  storeShelfMenuOpen=false;
  showScreen('interior-screen');
  lastHome='interior-screen';
}

let storeShelfMenuOpen=false;

function toggleStoreShelfMenu(){
  storeShelfMenuOpen=!storeShelfMenuOpen;
  renderStoreRoom();
}

function renderStoreRoom(){
  migrateShelfTiers();
  const onMap=listStoreRoomIdsOnMap();
  if(!viewingStoreRoomId||!onMap.includes(viewingStoreRoomId)) viewingStoreRoomId=onMap[0]||null;
  const activeRoom=getStoreRoomById(viewingStoreRoomId);
  if(!activeRoom) return;
  const cap=storageCapPerType();
  const roomCap=getStoreRoomCapacity(viewingStoreRoomId);
  const roomCount=onMap.length;
  const roomIndex=onMap.indexOf(viewingStoreRoomId)+1;
  const titleEl=document.querySelector('#storeroom-screen .top-bar-title');
  if(titleEl) titleEl.textContent=roomCount>1?'Store Room '+roomIndex:'Store Room';
  const sumEl=document.getElementById('store-summary');
  if(sumEl){
    const roomShelves=[1,2,3,4].filter(slot=>getShelfTier(slot, viewingStoreRoomId)>0).length;
    sumEl.innerHTML='<div class="store-summary-tap'+(storeShelfMenuOpen?' open':'')+'" onclick="toggleStoreShelfMenu()">'
      +'<div class="store-line">Capacity per item type: '+cap+'</div>'
      +'<div class="store-line">This room: '+roomCap+' ('+roomShelves+' / 4 shelves)</div>'
      +'<div class="store-summary-hint">Shelf slots · tap to '+(storeShelfMenuOpen?'hide':'manage')+' '+(storeShelfMenuOpen?'▴':'▾')+'</div>'
      +'</div>';
  }
  const listEl=document.getElementById('store-items-list');
  if(listEl){
    const rows=Object.values(state.storage).filter(i=>i.count>0);
    listEl.innerHTML=rows.length
      ?rows.map(i=>'<div class="store-item-row"><span>'+i.icon+' '+i.name+'</span><span>x'+i.count+'/'+cap+'</span></div>').join('')
      :'<div class="store-line" style="color:rgba(200,169,110,0.45)">Nothing stored yet.</div>';
  }
  const shelfSection=document.getElementById('store-shelves-section');
  if(shelfSection) shelfSection.hidden=!storeShelfMenuOpen;
  const shelfEl=document.getElementById('store-shelves');
  if(shelfEl){
    shelfEl.innerHTML='';
    if(!storeShelfMenuOpen) return;
    [1,2,3,4].forEach(slot=>{
      const tier=getShelfTier(slot, viewingStoreRoomId);
      const done=tier>0;
      const recipeKey='shelf_'+slot;
      const r=RECIPES[recipeKey];
      const capBonus=tier*50;
      const stageTxt=done
        ?(getLogTierName(tier)+' · +'+capBonus)
        :((activeRoom.shelfStages[slot]||0)+'/'+r.stages+' stages');
      const canUp=canUpgradeShelf(slot, viewingStoreRoomId);
      const nextName=canUp?getLogTierName(tier+1):'';
      let actions='';
      if(!done){
        actions='<button class="store-shelf-action" onclick="openWorkbenchForRecipe(\''+recipeKey+'\',{storeRoomId:\''+viewingStoreRoomId+'\'})">Craft</button>';
      }else if(canUp){
        actions='<button class="store-shelf-action" disabled>Installed</button>'
          +'<button class="store-shelf-action secondary" onclick="openShelfUpgrade('+slot+')">→ '+nextName+' (+50)</button>';
      }else{
        actions='<button class="store-shelf-action" disabled>Max ('+getLogTierName(tier)+')</button>';
      }
      const card=document.createElement('div');
      card.className='store-shelf-card'+(done?' done':'');
      card.innerHTML='<div class="store-shelf-title">Slot '+slot+' '+(done?'✓':'')+'</div>'
        +'<div class="store-shelf-desc">'+stageTxt+'</div>'
        +'<div class="store-shelf-actions">'+actions+'</div>';
      shelfEl.appendChild(card);
    });
  }
}

getCookActivity();
getSpinActivity();
