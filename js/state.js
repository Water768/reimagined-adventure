/* Hearthstead — state & activity */
'use strict';

function getDefaultState(){
  return {
    gameStarted:false,
    gold:0, axeFound:false,
    dogBedCleaned:0, fireplaceStokes:0, logsOnFire:0,
    inventory:{},
    equipped:null,
    equippedBag:null,
    equippedFeatherPocket:null,
    featherPocketCount:0,
    toolStoreTools:{ axes:[], activeAxe:null, pickaxes:[], activePickaxe:null, rods:[], activeRod:null, nets:[], activeNet:null, basket:null },
    skills:{
      woodcut:{xp:0,level:1,xpToNext:100},
      foraging:{xp:0,level:1,xpToNext:100},
      fishing:{xp:0,level:1,xpToNext:100},
      mining:{xp:0,level:1,xpToNext:100},
      carpentry:{xp:0,level:1,xpToNext:100},
      metalworking:{xp:0,level:1,xpToNext:100},
      cooking:{xp:0,level:1,xpToNext:100},
      crafting:{xp:0,level:1,xpToNext:100},
      architecture:{xp:0,level:1,xpToNext:100},
      botany:{xp:0,level:1,xpToNext:100},
      husbandry:{xp:0,level:1,xpToNext:100},
      exploration:{xp:0,level:1,xpToNext:100},
      academia:{xp:0,level:1,xpToNext:100},
      magic:{xp:0,level:1,xpToNext:100},
      air:{xp:0,level:1,xpToNext:100},
      earth:{xp:0,level:1,xpToNext:100},
      fire:{xp:0,level:1,xpToNext:100},
      water:{xp:0,level:1,xpToNext:100},
    },
    storage:{},
    storeRooms:{},
    purgedStoreRoomIds:[],
    fishAttempts:0, fishCatches:0,
    fishAutoRelease:false,
    fireplaceQuickAction:'cook',
    firePitQuickAction:'cook',
    kilnQuickAction:'recipe',
    apothecaryQuickAction:'identify',
    plotLayout:null, plot:{ cells:null, editMode:false, panX:0, panY:0, unlocked:null, featureUnlocks:null, firstUnlockXpAwarded:null, addMenuShowLocked:false }, plotConfigs:{},
    interior:{ cells:null, buildMode:false, panX:0, panY:0 },
    interiorLayout:null, interiorPanX:0, interiorPanY:0,
    pockets:{ fire:0, water:0, earth:0, air:0, magic:0, glistening:0 },
    pets:[],
    craftProgress:{},
    studyDesk:{ books:{}, maps:{} },
    bookcase:{ activeChapters:{} },
    woodcutAuxiliary:null,
    lastWorkbenchRecipe:'chair',
    equippedPetIds:[],
    _seenHut:false, _seenPond:false, _seenShard:false, _seenMagicShard:false,
    _seenArchitectureLv2:false,
    exploreStaminaRolls:{},
    exploreHealingRolls:{},
    exploreTorchRolls:{},
    exploreWhisperWoodsRolls:{},
    exploreSunkenShallowsRolls:{},
    coastalDocksUnlocked:false,
    coastalDocksTier:0,
    wellUnlocked:false,
    wellFinishedUnlocked:false,
    wellHydratedUnlocked:false,
    wellQuickAction:'fill',
    firePitUnlocked:false,
    kilnUnlocked:false,
    kilnLitUnlocked:false,
    barnUnlocked:false,
    barnWallsUnlocked:false,
    barnDoorlessUnlocked:false,
    mediumBarnUnlocked:false,
    largeBarnUnlocked:false,
    washingLineFrameUnlocked:false,
    washingLineUnlocked:false,
    washingLineImprovedUnlocked:false,
    whisperCampUnlocked:false,
    whisperCampTier:0,
    kilnLastAction:null,
    kilnLastMetalTier:'copper',
    kilnMetalRecipeByTier:{},
    _archRoomBonuses:{},
    _archRoomBonusesMigrated:false,
    _structureCompleteBonuses:{},
    _structureCompleteBonusMigrated:false,
    _structureStageBonusFlagsMigrated:false,
    _structureBonusXpGranted:{},
    fawnComfort:0,
    fawnFeedCooldownUntil:0,
    mossyBarnBlueprintsUnlocked:false,
    _saveVersion:0,
  };
}
const state = getDefaultState();

function invTotal(){
  return Object.keys(state.inventory).reduce((s,k)=>s+stackCount(state.inventory,k),0);
}

function getInvCap(){
  const bonus=typeof getEquippedBagBonus==='function'?getEquippedBagBonus():0;
  return INV_BASE_CAP+bonus;
}

function storageAddDirect(key,icon,name,n){
  if(n<=0) return 0;
  const resolved=resolveItemKey(key);
  registerLegacyItemMeta(resolved, icon, name);
  const cap=typeof storageCapForKey==='function'?storageCapForKey(resolved):Infinity;
  const already=stackCount(state.storage, resolved);
  const room=Math.max(0, cap-already);
  const add=Math.min(room, n);
  if(add>0) stackAdd(state.storage, resolved, add);
  return add;
}

function getEquippedStorageFetchPet(){
  for(const id of (state.equippedPetIds||[])){
    const pet=state.pets?.find(p=>p.id===id);
    if(!pet) continue;
    const def=getPetSpeciesDef(pet.type);
    if(def.passiveType==='storageRedirect') return pet;
  }
  return null;
}

function splitInventoryByDogFetch(n){
  const fetchPet=getEquippedStorageFetchPet();
  if(!fetchPet||n<=0) return { toStorage:0, toBag:n, pet:null };
  const chance=typeof getPetDogFetchChance==='function'
    ?getPetDogFetchChance(fetchPet)
    :(getPetSpeciesDef(fetchPet.type).passiveChance??DOG_STORAGE_FETCH_CHANCE);
  let toStorage=0;
  for(let i=0;i<n;i++){
    if(Math.random()<chance) toStorage++;
  }
  return { toStorage, toBag:n-toStorage, pet:fetchPet };
}

function notifyDogStorageFetch(pet, icon, count){
  if(!pet||count<=0||typeof showQuickToast!=='function') return;
  showQuickToast(pet.name+' fetched '+(count>1?count+'× ':'')+icon+' to storage');
}

function invAdd(key,icon,name,n){
  if(n<=0) return 0;
  const before=invTotal();
  const split=splitInventoryByDogFetch(n);
  if(split.toStorage>0){
    storageAddDirect(key,icon,name,split.toStorage);
    notifyDogStorageFetch(split.pet, icon, split.toStorage);
  }
  if(split.toBag<=0) return split.toStorage;
  const space=getInvCap()-invTotal();
  if(space<=0) return split.toStorage;
  const add=Math.min(split.toBag,space);
  const resolved=resolveItemKey(key);
  registerLegacyItemMeta(resolved, icon, name);
  stackAdd(state.inventory, resolved, add);
  const net=invTotal()-before;
  if(net>0) flashInvPickup(getItemDef(resolved).icon, net);
  return split.toStorage+add;
}

function invAddDirect(key,icon,name,n,opts){
  if(n<=0) return 0;
  const pickupBaseline=opts?.pickupBaseline;
  const before=invTotal();
  const split=splitInventoryByDogFetch(n);
  if(split.toStorage>0){
    storageAddDirect(key,icon,name,split.toStorage);
    notifyDogStorageFetch(split.pet, icon, split.toStorage);
  }
  if(split.toBag<=0) return split.toStorage;
  const resolved=resolveItemKey(key);
  registerLegacyItemMeta(resolved, icon, name);
  stackAdd(state.inventory, resolved, split.toBag);
  const net=invTotal()-(pickupBaseline!=null?pickupBaseline:before);
  if(net>0) flashInvPickup(getItemDef(resolved).icon, net);
  return split.toStorage+split.toBag;
}
function migrateItemKeys(){
  if(typeof mergeLegacyStackKeyAliases==='function'){
    mergeLegacyStackKeyAliases(state.inventory);
    mergeLegacyStackKeyAliases(state.storage);
  }
  const renames=[['mackerel','raw_mackerel'],['rock','stone'],['flint','brick'],['desk','apothecary_table'],['table','study_desk'],['bookshelf','bookcase'],['hardwood_chair','crafting_desk'],['waterproof_mortar','waterproof_paste']];
  renames.forEach(([oldKey,newKey])=>{
    const invC=stackCount(state.inventory, oldKey);
    if(invC>0){
      stackAdd(state.inventory, newKey, invC);
      stackSet(state.inventory, oldKey, 0);
    }
    const storeC=stackCount(state.storage, oldKey);
    if(storeC>0){
      stackAdd(state.storage, newKey, storeC);
      stackSet(state.storage, oldKey, 0);
    }
  });
}

let invSelectedKey = null;

function ensureToolStoreTools(){
  if(!state.toolStoreTools||typeof state.toolStoreTools!=='object'){
    state.toolStoreTools={ axes:[], activeAxe:null, pickaxes:[], activePickaxe:null, rods:[], activeRod:null, nets:[], activeNet:null, basket:null };
  }
  if(!Array.isArray(state.toolStoreTools.axes)) state.toolStoreTools.axes=[];
  if(!Array.isArray(state.toolStoreTools.pickaxes)) state.toolStoreTools.pickaxes=[];
  if(!Array.isArray(state.toolStoreTools.rods)) state.toolStoreTools.rods=[];
  if(!Array.isArray(state.toolStoreTools.nets)) state.toolStoreTools.nets=[];
  if(state.toolStoreTools.activeAxe===undefined) state.toolStoreTools.activeAxe=null;
  if(state.toolStoreTools.activePickaxe===undefined) state.toolStoreTools.activePickaxe=null;
  if(state.toolStoreTools.activeRod===undefined) state.toolStoreTools.activeRod=null;
  if(state.toolStoreTools.activeNet===undefined) state.toolStoreTools.activeNet=null;
  TOOL_STORE_SLOT_DEFS.forEach((slot)=>{
    if(slot.id==='axe'||slot.id==='pickaxe'||slot.id==='fishing_rod'||slot.id==='fishing_net') return;
    if(state.toolStoreTools[slot.id]===undefined) state.toolStoreTools[slot.id]=null;
  });
}

function toolStoreBonusesActive(){
  return typeof hasToolStoreOnMap==='function'&&hasToolStoreOnMap();
}

function getOwnedToolStoreRodKeys(){
  ensureToolStoreTools();
  return state.toolStoreTools.rods.filter((key)=>!!FISHING_ROD_BY_KEY[key]);
}

function getBestOwnedRodDef(){
  let best=null;
  getOwnedToolStoreRodKeys().forEach((key)=>{
    const def=FISHING_ROD_BY_KEY[key];
    if(def&&(!best||def.tier>best.tier)) best=def;
  });
  return best;
}

function getActiveToolStoreRodDef(){
  ensureToolStoreTools();
  const key=state.toolStoreTools.activeRod;
  if(key&&getOwnedToolStoreRodKeys().includes(key)) return FISHING_ROD_BY_KEY[key];
  return getBestOwnedRodDef();
}

function getUsableToolStoreRodDef(){
  ensureToolStoreTools();
  const activeKey=state.toolStoreTools.activeRod;
  if(activeKey&&getOwnedToolStoreRodKeys().includes(activeKey)&&canSelectRodForFishing(activeKey)){
    return FISHING_ROD_BY_KEY[activeKey];
  }
  let best=null;
  getOwnedToolStoreRodKeys().forEach((key)=>{
    if(!canSelectRodForFishing(key)) return;
    const def=FISHING_ROD_BY_KEY[key];
    if(def&&(!best||def.tier>best.tier)) best=def;
  });
  return best;
}

function getOwnedToolStoreNetKeys(){
  ensureToolStoreTools();
  return state.toolStoreTools.nets.filter((key)=>!!FISHING_NET_BY_KEY[key]);
}

function getBestOwnedNetDef(){
  let best=null;
  getOwnedToolStoreNetKeys().forEach((key)=>{
    const def=FISHING_NET_BY_KEY[key];
    if(def&&(!best||def.tier>best.tier)) best=def;
  });
  return best;
}

function getActiveToolStoreNetDef(){
  ensureToolStoreTools();
  const key=state.toolStoreTools.activeNet;
  if(key&&getOwnedToolStoreNetKeys().includes(key)) return FISHING_NET_BY_KEY[key];
  return getBestOwnedNetDef();
}

function getUsableToolStoreNetDef(){
  ensureToolStoreTools();
  const activeKey=state.toolStoreTools.activeNet;
  if(activeKey&&getOwnedToolStoreNetKeys().includes(activeKey)&&canSelectNetForFishing(activeKey)){
    return FISHING_NET_BY_KEY[activeKey];
  }
  let best=null;
  getOwnedToolStoreNetKeys().forEach((key)=>{
    if(!canSelectNetForFishing(key)) return;
    const def=FISHING_NET_BY_KEY[key];
    if(def&&(!best||def.tier>best.tier)) best=def;
  });
  return best;
}

function getOwnedToolStorePickaxeKeys(){
  ensureToolStoreTools();
  return state.toolStoreTools.pickaxes.filter((key)=>!!PICKAXE_BY_KEY[key]);
}

function getBestOwnedPickaxeDef(){
  let best=null;
  getOwnedToolStorePickaxeKeys().forEach((key)=>{
    const def=PICKAXE_BY_KEY[key];
    if(def&&(!best||def.tier>best.tier)) best=def;
  });
  return best;
}

function getActiveToolStorePickaxeDef(){
  ensureToolStoreTools();
  const key=state.toolStoreTools.activePickaxe;
  if(key&&getOwnedToolStorePickaxeKeys().includes(key)) return PICKAXE_BY_KEY[key];
  return getBestOwnedPickaxeDef();
}

function getOwnedToolStoreAxeKeys(){
  ensureToolStoreTools();
  return state.toolStoreTools.axes.filter((key)=>!!AXE_BY_KEY[key]);
}

function getBestOwnedAxeDef(){
  let best=null;
  getOwnedToolStoreAxeKeys().forEach((key)=>{
    const def=AXE_BY_KEY[key];
    if(def&&(!best||def.tier>best.tier)) best=def;
  });
  return best;
}

function getActiveToolStoreAxeDef(){
  ensureToolStoreTools();
  const key=state.toolStoreTools.activeAxe;
  if(key&&getOwnedToolStoreAxeKeys().includes(key)) return AXE_BY_KEY[key];
  return getBestOwnedAxeDef();
}

function getUsableToolStoreAxeDef(){
  ensureToolStoreTools();
  const activeKey=state.toolStoreTools.activeAxe;
  if(activeKey&&getOwnedToolStoreAxeKeys().includes(activeKey)&&canSelectAxeForWoodcut(activeKey)){
    return AXE_BY_KEY[activeKey];
  }
  let best=null;
  getOwnedToolStoreAxeKeys().forEach((key)=>{
    if(!canSelectAxeForWoodcut(key)) return;
    const def=AXE_BY_KEY[key];
    if(def&&(!best||def.tier>best.tier)) best=def;
  });
  return best;
}

function getUsableToolStorePickaxeDef(){
  ensureToolStoreTools();
  const activeKey=state.toolStoreTools.activePickaxe;
  if(activeKey&&getOwnedToolStorePickaxeKeys().includes(activeKey)&&canSelectPickaxeForMining(activeKey)){
    return PICKAXE_BY_KEY[activeKey];
  }
  let best=null;
  getOwnedToolStorePickaxeKeys().forEach((key)=>{
    if(!canSelectPickaxeForMining(key)) return;
    const def=PICKAXE_BY_KEY[key];
    if(def&&(!best||def.tier>best.tier)) best=def;
  });
  return best;
}

function getToolStoreBonusAxeDef(){
  if(!toolStoreBonusesActive()) return null;
  return getBestOwnedAxeDef();
}

function getToolStoreAxeDef(){
  return getUsableToolStoreAxeDef();
}

function getToolStorePickaxeDef(){
  return getUsableToolStorePickaxeDef();
}

function getToolStoreRodDef(){
  return getUsableToolStoreRodDef();
}

function getToolStoreNetDef(){
  return getUsableToolStoreNetDef();
}

function isToolStoreToolKey(key){
  const resolved=typeof resolveItemKey==='function'?resolveItemKey(key):key;
  return !!TOOL_STORE_KEY_TO_SLOT[resolved];
}

function toolStoreSlotForKey(key){
  const resolved=typeof resolveItemKey==='function'?resolveItemKey(key):key;
  return TOOL_STORE_KEY_TO_SLOT[resolved]||null;
}

function isToolStoreSlotToolOwned(key){
  const resolved=typeof resolveItemKey==='function'?resolveItemKey(key):key;
  const slot=toolStoreSlotForKey(resolved);
  if(!slot) return false;
  if(slot==='axe') return getOwnedToolStoreAxeKeys().includes(resolved);
  if(slot==='pickaxe') return getOwnedToolStorePickaxeKeys().includes(resolved);
  if(slot==='fishing_rod') return getOwnedToolStoreRodKeys().includes(resolved);
  if(slot==='fishing_net') return getOwnedToolStoreNetKeys().includes(resolved);
  return state.toolStoreTools[slot]===resolved;
}

function canEquipToolToStore(key){
  const resolved=typeof resolveItemKey==='function'?resolveItemKey(key):key;
  if(!isToolStoreToolKey(resolved)||invCount(resolved)<=0) return false;
  return !isToolStoreSlotToolOwned(resolved);
}

function getBestToolStoreToolForSlot(slotId){
  ensureToolStoreTools();
  if(slotId==='axe') return getBestOwnedAxeDef();
  if(slotId==='pickaxe') return getBestOwnedPickaxeDef();
  if(slotId==='fishing_rod') return getBestOwnedRodDef();
  if(slotId==='fishing_net') return getBestOwnedNetDef();
  const key=state.toolStoreTools[slotId];
  if(!key) return null;
  return getItemDef(key);
}

function getToolStoreToolDisplay(slotId){
  const best=getBestToolStoreToolForSlot(slotId);
  return best?{ icon:best.icon, name:best.name, tier:best.tier }:null;
}

function equipToolToStore(key){
  const resolved=typeof resolveItemKey==='function'?resolveItemKey(key):key;
  if(!canEquipToolToStore(resolved)) return false;
  const slot=toolStoreSlotForKey(resolved);
  if(!slot) return false;
  const def=getItemDef(resolved);
  stackTake(state.inventory, resolved, 1);
  ensureToolStoreTools();
  if(slot==='axe'){
    state.toolStoreTools.axes.push(resolved);
    if(!state.toolStoreTools.activeAxe||!getOwnedToolStoreAxeKeys().includes(state.toolStoreTools.activeAxe)){
      state.toolStoreTools.activeAxe=resolved;
    }else if(canSelectAxeForWoodcut(resolved)&&!canSelectAxeForWoodcut(state.toolStoreTools.activeAxe)){
      state.toolStoreTools.activeAxe=resolved;
    }else if(canSelectAxeForWoodcut(resolved)){
      const cur=AXE_BY_KEY[state.toolStoreTools.activeAxe];
      const next=AXE_BY_KEY[resolved];
      if(next&&(!cur||next.tier>cur.tier)) state.toolStoreTools.activeAxe=resolved;
    }
    state.axeFound=true;
  }else if(slot==='pickaxe'){
    state.toolStoreTools.pickaxes.push(resolved);
    if(!state.toolStoreTools.activePickaxe||!getOwnedToolStorePickaxeKeys().includes(state.toolStoreTools.activePickaxe)){
      state.toolStoreTools.activePickaxe=resolved;
    }else if(canSelectPickaxeForMining(resolved)&&!canSelectPickaxeForMining(state.toolStoreTools.activePickaxe)){
      state.toolStoreTools.activePickaxe=resolved;
    }else if(canSelectPickaxeForMining(resolved)){
      const cur=PICKAXE_BY_KEY[state.toolStoreTools.activePickaxe];
      const next=PICKAXE_BY_KEY[resolved];
      if(next&&(!cur||next.tier>cur.tier)) state.toolStoreTools.activePickaxe=resolved;
    }
  }else if(slot==='fishing_rod'){
    state.toolStoreTools.rods.push(resolved);
    if(!state.toolStoreTools.activeRod||!getOwnedToolStoreRodKeys().includes(state.toolStoreTools.activeRod)){
      state.toolStoreTools.activeRod=resolved;
    }else if(canSelectRodForFishing(resolved)&&!canSelectRodForFishing(state.toolStoreTools.activeRod)){
      state.toolStoreTools.activeRod=resolved;
    }else if(canSelectRodForFishing(resolved)){
      const cur=FISHING_ROD_BY_KEY[state.toolStoreTools.activeRod];
      const next=FISHING_ROD_BY_KEY[resolved];
      if(next&&(!cur||next.tier>cur.tier)) state.toolStoreTools.activeRod=resolved;
    }
  }else if(slot==='fishing_net'){
    state.toolStoreTools.nets.push(resolved);
    if(!state.toolStoreTools.activeNet||!getOwnedToolStoreNetKeys().includes(state.toolStoreTools.activeNet)){
      state.toolStoreTools.activeNet=resolved;
    }else if(canSelectNetForFishing(resolved)&&!canSelectNetForFishing(state.toolStoreTools.activeNet)){
      state.toolStoreTools.activeNet=resolved;
    }else if(canSelectNetForFishing(resolved)){
      const cur=FISHING_NET_BY_KEY[state.toolStoreTools.activeNet];
      const next=FISHING_NET_BY_KEY[resolved];
      if(next&&(!cur||next.tier>cur.tier)) state.toolStoreTools.activeNet=resolved;
    }
  }else{
    state.toolStoreTools[slot]=resolved;
  }
  registerLegacyItemMeta(resolved, def.icon, def.name);
  if(currentScreen==='tool-store-screen'&&typeof renderToolStore==='function') renderToolStore();
  markDirty('inventory','equip');
  return true;
}

function setActiveToolStoreAxe(key){
  const resolved=typeof resolveItemKey==='function'?resolveItemKey(key):key;
  if(!getOwnedToolStoreAxeKeys().includes(resolved)) return false;
  if(!canSelectAxeForWoodcut(resolved)){
    showToast('Need Woodcutting Lv '+getAxeWoodcutLevel(resolved)+' to use '+AXE_BY_KEY[resolved].name+'.');
    return false;
  }
  ensureToolStoreTools();
  state.toolStoreTools.activeAxe=resolved;
  if(typeof collapseToolStoreAxePicker==='function') collapseToolStoreAxePicker();
  if(currentScreen==='woodcutting-screen'&&typeof renderWoodcutting==='function') renderWoodcutting();
  showToast(AXE_BY_KEY[resolved].icon+' '+AXE_BY_KEY[resolved].name+' is now your active axe.');
  return true;
}

function setActiveToolStorePickaxe(key){
  const resolved=typeof resolveItemKey==='function'?resolveItemKey(key):key;
  if(!getOwnedToolStorePickaxeKeys().includes(resolved)) return false;
  if(!canSelectPickaxeForMining(resolved)){
    showToast('Need Mining Lv '+getPickaxeMiningLevel(resolved)+' to use '+PICKAXE_BY_KEY[resolved].name+'.');
    return false;
  }
  ensureToolStoreTools();
  state.toolStoreTools.activePickaxe=resolved;
  if(typeof collapseToolStorePickaxePicker==='function') collapseToolStorePickaxePicker();
  showToast(PICKAXE_BY_KEY[resolved].icon+' '+PICKAXE_BY_KEY[resolved].name+' is now your active pickaxe.');
  return true;
}

function setActiveToolStoreRod(key){
  const resolved=typeof resolveItemKey==='function'?resolveItemKey(key):key;
  if(!getOwnedToolStoreRodKeys().includes(resolved)) return false;
  if(!canSelectRodForFishing(resolved)){
    showToast('Need Fishing Lv '+getRodFishingLevel(resolved)+' to use '+FISHING_ROD_BY_KEY[resolved].name+'.');
    return false;
  }
  ensureToolStoreTools();
  state.toolStoreTools.activeRod=resolved;
  if(typeof collapseToolStoreRodPicker==='function') collapseToolStoreRodPicker();
  if(currentScreen==='fish-screen'&&typeof renderFishing==='function') renderFishing();
  showToast(FISHING_ROD_BY_KEY[resolved].icon+' '+FISHING_ROD_BY_KEY[resolved].name+' is now your active rod.');
  return true;
}

function setActiveToolStoreNet(key){
  const resolved=typeof resolveItemKey==='function'?resolveItemKey(key):key;
  if(!getOwnedToolStoreNetKeys().includes(resolved)) return false;
  if(!canSelectNetForFishing(resolved)){
    showToast('Need Fishing Lv '+getNetFishingLevel(resolved)+' to use '+FISHING_NET_BY_KEY[resolved].name+'.');
    return false;
  }
  ensureToolStoreTools();
  state.toolStoreTools.activeNet=resolved;
  if(typeof collapseToolStoreNetPicker==='function') collapseToolStoreNetPicker();
  if(currentScreen==='fish-screen'&&typeof renderFishing==='function') renderFishing();
  showToast(FISHING_NET_BY_KEY[resolved].icon+' '+FISHING_NET_BY_KEY[resolved].name+' is now your active net.');
  return true;
}

function migrateToolStoreRodArray(){
  if(state._rodToolStoreArrayMigrated) return;
  ensureToolStoreTools();
  const legacyRod=state.toolStoreTools.fishing_rod;
  if(legacyRod&&FISHING_ROD_BY_KEY[legacyRod]&&!getOwnedToolStoreRodKeys().includes(legacyRod)){
    state.toolStoreTools.rods.push(legacyRod);
    if(!state.toolStoreTools.activeRod) state.toolStoreTools.activeRod=legacyRod;
  }
  delete state.toolStoreTools.fishing_rod;
  if(!state.toolStoreTools.activeRod&&getOwnedToolStoreRodKeys().length){
    state.toolStoreTools.activeRod=getBestOwnedRodDef()?.key||getOwnedToolStoreRodKeys()[0];
  }
  state._rodToolStoreArrayMigrated=true;
}

function migrateKnowledgeToAcademia(){
  if(state._knowledgeToAcademiaMigrated) return;
  if(state.skills?.knowledge){
    if(!state.skills.academia) state.skills.academia={...state.skills.knowledge};
    else{
      const k=state.skills.knowledge;
      const a=state.skills.academia;
      if((k.level||1)>(a.level||1)||((k.level||1)===(a.level||1)&&(k.xp||0)>(a.xp||0))){
        a.level=k.level;
        a.xp=k.xp;
        a.xpToNext=k.xpToNext;
      }
    }
    delete state.skills.knowledge;
  }
  state._knowledgeToAcademiaMigrated=true;
}

function migrateTailoringToCrafting(){
  if(state._tailoringToCraftingMigrated) return;
  if(state.skills?.tailoring){
    if(!state.skills.crafting) state.skills.crafting={...state.skills.tailoring};
    else{
      const t=state.skills.tailoring;
      const c=state.skills.crafting;
      if((t.level||1)>(c.level||1)||((t.level||1)===(c.level||1)&&(t.xp||0)>(c.xp||0))){
        c.level=t.level;
        c.xp=t.xp;
        c.xpToNext=t.xpToNext;
      }
    }
    delete state.skills.tailoring;
  }
  state._tailoringToCraftingMigrated=true;
}

function migrateBronzeAxeTierKey(){
  if(state._bronzeAxeTierMigrated) return;
  const BRONZE_AXE_OLD_KEY='axe_1';
  const BRONZE_AXE_NEW_KEY='axe_2';
  const moveStackKey=(map)=>{
    if(!map) return;
    const count=stackCount(map, BRONZE_AXE_OLD_KEY);
    if(count<=0) return;
    stackAdd(map, BRONZE_AXE_NEW_KEY, count);
    stackSet(map, BRONZE_AXE_OLD_KEY, 0);
  };
  moveStackKey(state.inventory);
  moveStackKey(state.storage);
  ensureToolStoreTools();
  if(Array.isArray(state.toolStoreTools.axes)){
    const seen=new Set();
    state.toolStoreTools.axes=state.toolStoreTools.axes.map((key)=>{
      if(key===BRONZE_AXE_OLD_KEY) return BRONZE_AXE_NEW_KEY;
      return key;
    }).filter((key)=>{
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if(state.toolStoreTools.activeAxe===BRONZE_AXE_OLD_KEY){
    state.toolStoreTools.activeAxe=BRONZE_AXE_NEW_KEY;
  }
  state._bronzeAxeTierMigrated=true;
}

function migrateToolStorePickaxeArray(){
  if(state._pickaxeToolStoreArrayMigrated) return;
  ensureToolStoreTools();
  const legacyPickaxe=state.toolStoreTools.pickaxe;
  if(legacyPickaxe&&PICKAXE_BY_KEY[legacyPickaxe]&&!getOwnedToolStorePickaxeKeys().includes(legacyPickaxe)){
    state.toolStoreTools.pickaxes.push(legacyPickaxe);
    if(!state.toolStoreTools.activePickaxe) state.toolStoreTools.activePickaxe=legacyPickaxe;
  }
  delete state.toolStoreTools.pickaxe;
  if(!state.toolStoreTools.activePickaxe&&getOwnedToolStorePickaxeKeys().length){
    state.toolStoreTools.activePickaxe=getBestOwnedPickaxeDef()?.key||getOwnedToolStorePickaxeKeys()[0];
  }
  state._pickaxeToolStoreArrayMigrated=true;
}

function migrateToolStoreTools(){
  migrateBronzeAxeTierKey();
  migrateToolStorePickaxeArray();
  migrateToolStoreRodArray();
  ensureToolStoreTools();
  const legacyAxe=state.toolStoreTools.axe;
  if(legacyAxe&&AXE_BY_KEY[legacyAxe]&&!getOwnedToolStoreAxeKeys().includes(legacyAxe)){
    state.toolStoreTools.axes.push(legacyAxe);
    if(!state.toolStoreTools.activeAxe) state.toolStoreTools.activeAxe=legacyAxe;
  }
  delete state.toolStoreTools.axe;
  if(state.equipped&&AXE_BY_KEY[state.equipped.key]){
    const key=state.equipped.key;
    if(!getOwnedToolStoreAxeKeys().includes(key)) state.toolStoreTools.axes.push(key);
    if(!state.toolStoreTools.activeAxe) state.toolStoreTools.activeAxe=key;
    state.equipped=null;
  }
  if(!state.toolStoreTools.activeAxe&&getOwnedToolStoreAxeKeys().length){
    state.toolStoreTools.activeAxe=getBestOwnedAxeDef()?.key||getOwnedToolStoreAxeKeys()[0];
  }
  TOOL_STORE_SLOT_DEFS.forEach((slot)=>{
    if(slot.id==='axe') return;
    (slot.keys||[]).forEach((toolKey)=>{
      if(state.toolStoreTools[slot.id]) return;
      const inStore=stackCount(state.storage, toolKey);
      if(inStore>0){
        const def=getItemDef(toolKey);
        invAddDirect(toolKey, def.icon, def.name, inStore);
        stackSet(state.storage, toolKey, 0);
      }
    });
  });
  FISHING_ROD_DEFS.forEach((def)=>{
    const inStore=stackCount(state.storage, def.key);
    if(inStore>0&&!getOwnedToolStoreRodKeys().includes(def.key)){
      invAddDirect(def.key, def.icon, def.name, inStore);
      stackSet(state.storage, def.key, 0);
    }
  });
  FISHING_NET_DEFS.forEach((def)=>{
    const inStore=stackCount(state.storage, def.key);
    if(inStore>0&&!getOwnedToolStoreNetKeys().includes(def.key)){
      invAddDirect(def.key, def.icon, def.name, inStore);
      stackSet(state.storage, def.key, 0);
    }
  });
  AXE_DEFS.forEach((def)=>{
    const inStore=stackCount(state.storage, def.key);
    if(inStore>0&&!getOwnedToolStoreAxeKeys().includes(def.key)){
      invAddDirect(def.key, def.icon, def.name, inStore);
      stackSet(state.storage, def.key, 0);
    }
  });
  if(getOwnedToolStoreAxeKeys().length) state.axeFound=true;
  PICKAXE_DEFS.forEach((def)=>{
    const inStore=stackCount(state.storage, def.key);
    if(inStore>0&&!getOwnedToolStorePickaxeKeys().includes(def.key)){
      invAddDirect(def.key, def.icon, def.name, inStore);
      stackSet(state.storage, def.key, 0);
    }
  });
}

function hasAxeAvailable(){
  return getOwnedToolStoreAxeKeys().length>0;
}

function findBagInBag(){
  for(let i=BAG_DEFS.length-1;i>=0;i--){
    const b=BAG_DEFS[i];
    if(invCount(b.key)>0) return b;
  }
  return null;
}

function equipBagDef(def){
  if(!def || invCount(def.key) <= 0) return false;
  if(state.equippedBag){
    const prev=state.equippedBag;
    invAddDirect(prev.key, prev.icon, prev.name, 1);
    state.equippedBag=null;
  }
  stackTake(state.inventory, def.key, 1);
  state.equippedBag={ key:def.key, icon:def.icon, name:def.name, invBonus:def.invBonus };
  return true;
}

function migrateEquippedBag(){
  if(!state.equippedBag) return;
  const def=BAG_BY_KEY[state.equippedBag.key];
  if(!def){ state.equippedBag=null; return; }
  if(state.equippedBag.invBonus==null) state.equippedBag.invBonus=def.invBonus;
  state.equippedBag.icon=def.icon;
  state.equippedBag.name=def.name;
}


function itemCountBagAndStore(key, opts){
  opts=opts||{};
  if(opts.infiniteKeys?.includes(key)) return Infinity;
  if(opts.infinite) return Infinity;
  const resolved=resolveItemKey(key);
  return invCount(resolved) + storageCount(resolved);
}

function formatAvailableCount(count, infinite){
  if(infinite||count===Infinity) return '∞ available';
  return count+' available';
}

/** Stock vs required, e.g. 300/1 */
function formatStockRatio(stock, need, opts){
  const needN=Math.max(1, need|0||1);
  if(opts?.infinite||stock===Infinity) return '∞/'+needN;
  return (Number(stock)||0)+'/'+needN;
}

function formatRecipeMatLine(name, qty, stock, opts){
  const q=Math.max(1, qty|0||1);
  if(opts?.unobtainable) return (name||'?')+' — not obtainable yet';
  return (name||'?')+' '+formatStockRatio(stock, q, opts);
}

function formatRecipeMatTitle(icon, name, need, stock, opts){
  const prefix=icon?(icon+' '):'';
  const suffix=opts?.done?' ✓':'';
  return prefix+formatRecipeMatLine(name, need, stock, opts)+suffix;
}

function nailCount(key){
  const t=typeof NAIL_TYPES!=='undefined'?NAIL_TYPES[key]:null;
  if(t?.infinite) return Infinity;
  return itemCountBagAndStore(key);
}

function grantNailToStorage(nailKey){
  const def=typeof NAIL_TYPES!=='undefined'?NAIL_TYPES[nailKey]:null;
  if(!def||def.infinite) return false;
  return storageAddDirect(nailKey, def.icon, def.name, 1)>0;
}

function consumeOneFromBag(key){
  const resolved=resolveItemKey(key);
  if(invCount(resolved)<=0) return false;
  stackTake(state.inventory, resolved, 1);
  return true;
}

function consumeOneFromBagOrStore(key){
  const resolved=resolveItemKey(key);
  if(invCount(resolved)>0){
    stackTake(state.inventory, resolved, 1);
    return true;
  }
  if(storageCount(resolved)>0){
    stackTake(state.storage, resolved, 1);
    return true;
  }
  return false;
}

function consumeManyFromBagOrStore(key, amount){
  let left=amount;
  while(left>0){
    if(!consumeOneFromBagOrStore(key)) return false;
    left--;
  }
  return true;
}

function consumeUpToFromBagOrStore(key, maxAmount){
  const want=Math.max(0, maxAmount|0);
  let consumed=0;
  while(consumed<want&&consumeOneFromBagOrStore(key)) consumed++;
  return consumed;
}

function grantGuaranteedFireShards(count){
  if(!state.pockets) state.pockets={ fire:0, water:0, earth:0, air:0, magic:0 };
  const n=Math.max(0, count|0);
  if(n<1) return 0;
  state.pockets.fire=(state.pockets.fire||0)+n;
  if(typeof markDirty==='function') markDirty('inventory');
  if(typeof requestSaveGame==='function') requestSaveGame();
  return n;
}

function getFurnitureDef(key){
  if(FURNITURE_DEFS[key]) return FURNITURE_DEFS[key];
  if(itemCountBagAndStore(key)>0){
    const d=getItemDef(key);
    return { key, icon:d.icon, name:d.name };
  }
  return null;
}

function listAvailableFurniture(){
  return Object.keys(FURNITURE_DEFS)
    .filter(k=>!FURNITURE_DEFS[k].utility&&itemCountBagAndStore(k)>0)
    .map(k=>({ ...FURNITURE_DEFS[k], count:itemCountBagAndStore(k) }));
}

function apothecaryTableInStock(){
  return itemCountBagAndStore(APOTHECARY_FURNITURE_KEY)>0;
}

function wonkyLoomInStock(){
  return itemCountBagAndStore(WONKY_LOOM_FURNITURE_KEY)>0;
}

function studyDeskInStock(){
  return itemCountBagAndStore(STUDY_DESK_FURNITURE_KEY)>0;
}

function bookcaseInStock(){
  return itemCountBagAndStore(BOOKCASE_FURNITURE_KEY)>0;
}

function craftingDeskInStock(){
  return itemCountBagAndStore(CRAFTING_DESK_FURNITURE_KEY)>0;
}

function returnOneToBagOrStore(key, icon, name){
  if(invTotal()<getInvCap()){
    invAddDirect(key, icon, name, 1);
    return 'bag';
  }
  if(storageAddDirect(key, icon, name, 1)>0) return 'store';
  return null;
}

function maxOwnedPets(){
  const lvl=Number(state.skills.husbandry?.level)||1;
  if(lvl<HUSBANDRY_PET_UNLOCK_LEVEL) return 0;
  let n=0;
  for(const req of HUSBANDRY_PET_SLOT_LEVELS){
    if(lvl>=req) n++;
    else break;
  }
  return n;
}

function nextPetSlotUnlockLevel(){
  const lvl=Number(state.skills.husbandry?.level)||1;
  for(const req of HUSBANDRY_PET_SLOT_LEVELS){
    if(lvl<req) return req;
  }
  return null;
}

function getPetSpeciesDef(type){
  return PET_SPECIES[type]||PET_SPECIES.cat;
}

function getPetIcon(pet){
  return getPetSpeciesDef(pet?.type).icon;
}

function migratePets(){
  if(!state.pets) state.pets=[];
  if(!state.equippedPetIds) state.equippedPetIds=[];
  if(!state._magpieToHedgehogMigrated){
    state._magpieToHedgehogMigrated=true;
    state.pets.forEach(p=>{
      if(p.type==='magpie') p.type='hedgehog';
    });
  }
  state.pets.forEach(p=>{
    if(!p.type) p.type='cat';
    if(!p.birthday) p.birthday=Date.now();
    if(p.activeTimeMs==null) p.activeTimeMs=0;
    if(!p.tier||p.tier<1) p.tier=getPetSpeciesTier(getPetSpeciesDef(p.type));
    if(!p.level||p.level<1) p.level=1;
    if(p.exp==null||p.exp<0) p.exp=0;
    if(p.level>PET_MAX_LEVEL) p.level=PET_MAX_LEVEL;
    clampPetExp(p);
  });
  state.equippedPetIds=state.equippedPetIds.filter(id=>state.pets.some(p=>p.id===id)).slice(0,MAX_EQUIPPED_PETS);
  state.equippedPetIds.forEach(id=>{
    const pet=state.pets.find(p=>p.id===id);
    if(pet&&!pet.equippedSince) pet.equippedSince=Date.now();
  });
}

function isPetEquipped(id){
  return (state.equippedPetIds||[]).includes(id);
}

function getPetActiveTimeMs(pet){
  let t=pet.activeTimeMs||0;
  if(pet.equippedSince) t+=Date.now()-pet.equippedSince;
  return t;
}

function flushPetActiveTime(pet){
  if(!pet.equippedSince) return;
  pet.activeTimeMs=(pet.activeTimeMs||0)+(Date.now()-pet.equippedSince);
  pet.equippedSince=null;
}

function formatDuration(ms){
  const sec=Math.floor(ms/1000);
  const min=Math.floor(sec/60);
  const hr=Math.floor(min/60);
  const day=Math.floor(hr/24);
  if(day>0) return day+'d '+(hr%24)+'h';
  if(hr>0) return hr+'h '+(min%60)+'m';
  if(min>0) return min+' min';
  return sec+' sec';
}

function formatPetBirthday(ts){
  const d=new Date(ts);
  const day=String(d.getDate()).padStart(2,'0');
  const month=String(d.getMonth()+1).padStart(2,'0');
  const year=String(d.getFullYear()).slice(-2);
  return day+'/'+month+'/'+year;
}

function rollPetShard(){
  return PET_SHARD_TYPES[Math.floor(Math.random()*PET_SHARD_TYPES.length)];
}

function createPet(type){
  const def=getPetSpeciesDef(type);
  const now=Date.now();
  const names=def.namePool||[def.name];
  return {
    id:def.key+'_'+now+'_'+Math.floor(Math.random()*9999),
    type:def.key,
    name:names[Math.floor(Math.random()*names.length)],
    tier:getPetSpeciesTier(def),
    shard:def.fixedShard||(def.passiveType==='shard'?rollPetShard():null),
    level:1,
    exp:0,
    birthday:now,
    activeTimeMs:0,
    equippedSince:null,
  };
}

function calcCookSuccess(recipe){
  const lvl=Number(state.skills.cooking?.level)||1;
  const unlock=Number(recipe.unlockLevel)||1;
  if(lvl<unlock) return 0;
  const levelsAbove=Math.max(0,lvl-unlock);
  return Math.min(1, recipe.baseSuccess + levelsAbove * recipe.successPerLevel);
}

function canCookAnyRaw(){
  return Object.keys(COOKING_RECIPES).some(k=>canCookRecipe(COOKING_RECIPES[k]));
}

function canCookRecipe(recipe){
  return (Number(state.skills.cooking?.level)||1)>=(recipe.unlockLevel||1)
    && itemCountBagAndStore(recipe.rawKey)>0
    && canStoreCookedResult(recipe);
}

function getCookBlockReason(recipe){
  if(!recipe) return 'No recipe selected.';
  if((Number(state.skills.cooking?.level)||1)<(recipe.unlockLevel||1)){
    return 'Need Cooking Lv '+(recipe.unlockLevel||1)+'.';
  }
  if(itemCountBagAndStore(recipe.rawKey)<=0) return 'No raw food to cook.';
  if(!canStoreCookedResult(recipe)) return 'Bag full — keep raw fish in your bag or make space.';
  return null;
}

function canStoreCookedResult(recipe){
  if(invCount(recipe.rawKey)>0) return true;
  return invTotal()<getInvCap();
}

/** Take one raw ingredient for cooking — bag first; storage only if bag has room for the result. */
function consumeRawForCook(recipe){
  const key=recipe.rawKey;
  if(invCount(key)>0) return consumeOneFromBagOrStore(key);
  if(invTotal()>=getInvCap()) return false;
  return consumeOneFromBagOrStore(key);
}

function calcSpinSuccess(recipe){
  if(!recipe||!isSpinRecipeUnlocked(recipe)) return 0;
  const lvl=Number(state.skills.crafting?.level)||1;
  const perLevel=recipe.successPerLevel??SPIN_SUCCESS_PER_LEVEL;
  const levelsAbove=Math.max(0,lvl-(recipe.requiredCraftingLevel||recipe.requiredTailoringLevel||1));
  return Math.min(1, recipe.baseSuccess + levelsAbove * perLevel);
}

function canSpinAnyFiber(){
  return Object.keys(SPINNING_RECIPES).some(k=>canSpinRecipe(SPINNING_RECIPES[k]));
}

function canSpinRecipe(recipe){
  if(!recipe||!isSpinRecipeUnlocked(recipe)) return false;
  const need=typeof spinRecipeInputQty==='function'?spinRecipeInputQty(recipe):1;
  return itemCountBagAndStore(recipe.rawKey)>=need;
}

function canStoreSpinResult(recipe){
  if(invCount(recipe.rawKey)>0) return true;
  return invTotal()<getInvCap();
}

function ensurePocketsState(){
  if(!state.pockets) state.pockets={ fire:0, water:0, earth:0, air:0, magic:0, glistening:0 };
  if(state.pockets.glistening==null) state.pockets.glistening=0;
}

function tryShardDrop(skill){
  ensurePocketsState();
  const elem=SHARD_FOR_SKILL[skill];
  if(!elem||Math.random()>=SHARD_CHANCE) return;
  state.pockets[elem]=(state.pockets[elem]||0)+1;
  const m=SHARD_META[elem];
  if(!state._seenShard){
    state._seenShard=true;
    showFoundBanner('POCKET FIND!', m.icon,
      'An elemental shard — tiny enough to live in your pockets. It uses no bag space. You\'ll gather these while training skills, for magic later.',
      'GOT IT', ()=>{ if(openPanel==='inv') renderInvPanel(); syncUI(); });
  }else if(openPanel==='inv') renderInvPanel();
  syncUI();
}

function tryMagicShardDrop(){
  ensurePocketsState();
  if(Math.random()>=MAGIC_SHARD_CHANCE) return;
  state.pockets.magic=(state.pockets.magic||0)+1;
  const m=SHARD_META.magic;
  if(!state._seenMagicShard){
    state._seenMagicShard=true;
    showFoundBanner('POCKET FIND!', m.icon,
      'A magic shard — rarer than the elemental kind, and just as pocket-sized. Save these for when you learn real magic.',
      'GOT IT', ()=>{ if(openPanel==='inv') renderInvPanel(); syncUI(); });
  }else if(openPanel==='inv') renderInvPanel();
  syncUI();
}

let invPickupTimer=null;
function flashInvPickup(icon,amount){
  document.querySelectorAll('.stat-pill-inv').forEach(pill=>{
    const bagIcon=pill.querySelector('.inv-bag-icon');
    const badge=pill.querySelector('.inv-pickup-badge');
    if(!bagIcon||!badge) return;
    bagIcon.textContent=icon;
    badge.textContent='+'+amount;
    badge.style.animation='none';
    void badge.offsetWidth;
    badge.style.animation='';
  });
  clearTimeout(invPickupTimer);
  invPickupTimer=setTimeout(()=>{
    document.querySelectorAll('.inv-bag-icon').forEach(el=>{ el.textContent='🎒'; });
  },1000);
}
function xpForLevel(l){ return Math.floor(SKILL_XP_LEVEL_BASE*Math.pow(l,1.8)); }

function getTotalSkillXp(key){
  const s=state.skills[key];
  if(!s) return 0;
  let total=s.xp;
  for(let l=1;l<s.level;l++) total+=xpForLevel(l);
  return total;
}

function formatSkillXp(n){ return Number(n).toLocaleString(); }

const fish={ running:false, timer:null, pondInstanceId:null, releasing:false, releaseTimer:null, releaseQueue:[] };
const gather={ running:false, timer:null, instanceId:null, itemsThisSession:0 };
const wc={ treeInstanceId:null };
const mine={ running:false, timer:null, instanceId:null, stacks:0 };
const explore={ instanceId:null, plotX:null, plotY:null, destinationKey:'cave', tier:'short', focusFishId:null, focusMedicineKey:null, eitherChoice:null, reqSubmenu:null, running:false };
const ACTIVITY_MENU_SHOW_MS=3000;
const plotActivityMenuTimers={};
const cook={ running:false, timer:null, recipeKey:'goldfish' };
const spin={ running:false, timer:null, recipeKey:'twisted_grass' };
const apothProcess={ running:false, timer:null };
const craftingDeskProcess={ running:false, timer:null };
const loomProcess={ running:false, timer:null };
const kilnProcess={ running:false, timer:null };
const activity={ type:null };
let skillFlashKey=null;
let skillFlashTimer=null;

function isInteriorContext(){
  return currentScreen==='interior-screen'||(
    typeof isHutOverlayScreen==='function'&&isHutOverlayScreen(currentScreen)
  );
}

function isExteriorContext(){
  return currentScreen==='exterior-screen'||(
    typeof isWorldOverlayScreen==='function'&&isWorldOverlayScreen(currentScreen)
  );
}

function flashSkillPill(skillKey){
  skillFlashKey=skillKey;
  clearTimeout(skillFlashTimer);
  updateActivitySkillDisplays();
  skillFlashTimer=setTimeout(()=>{
    skillFlashKey=null;
    skillFlashTimer=null;
    updateActivitySkillDisplays();
  },2500);
}

function activityLabel(type){
  const r=getActivityRunner(type);
  return r?.label||type||'';
}

const ACTIVITY_SKILL_KEYS={
  fishing:'fishing',
  gathering:'foraging',
  woodcutting:'woodcut',
  mining:'mining',
  cooking:'cooking',
  spinning:'crafting',
  loom:'crafting',
  apothecary:'botany',
  exploring:'exploration',
  crafting:'carpentry',
};

const SKILL_ACTIVITY={
  fishing:'fishing',
  foraging:'gathering',
  woodcut:'woodcutting',
  mining:'mining',
  cooking:'cooking',
  crafting:'spinning',
  carpentry:'crafting',
  botany:'apothecary',
};

function getActiveActivitySkillKey(){
  if(!activity.type) return null;
  if(activity.type==='crafting') return RECIPES[craft.recipeKey]?.skill||'carpentry';
  return ACTIVITY_SKILL_KEYS[activity.type]||null;
}

function clearActivity(type){
  if(activity.type===type) activity.type=null;
}

function stopActivity(type){
  stopRegisteredActivity(type, true);
}

function stopOtherActivities(keepType){
  if(activity.type&&activity.type!==keepType){
    const label=activityLabel(activity.type);
    stopActivity(activity.type);
    if(label) showToast('Stopped '+label+'.');
  }
}

function setActivity(type){
  stopOtherActivities(type);
  activity.type=type;
}

function stopAllActivities(){
  Object.keys(ACTIVITY_RUNNERS).forEach(type=>stopRegisteredActivity(type, true));
  activity.type=null;
}

function reconcileActivityState(){
  Object.keys(ACTIVITY_RUNNERS).forEach(type=>{
    if(isActivityRunning(type)&&activity.type!==type) stopRegisteredActivity(type, true);
    if(activity.type===type&&!isActivityRunning(type)) clearActivity(type);
  });
}

function hasRunningActivity(){
  return anyRegisteredActivityRunning();
}

function grantXP(skill,amount,event,opts){
  opts=opts||{};
  const s=state.skills[skill]; if(!s)return;
  const skillActivity=SKILL_ACTIVITY[skill];
  if(!opts.keepActivities){
    if(skillActivity){
      if(activity.type!==skillActivity) stopAllActivities();
    }else if(activity.type||hasRunningActivity()){
      stopAllActivities();
    }
  }
  if(!s.level||s.level<1) s.level=1;
  if(s.xp==null||s.xp<0) s.xp=0;
  s.xpToNext=xpForLevel(s.level);
  s.xp+=amount;
  const m=SKILL_META[skill];
  while(s.xp>=s.xpToNext){
    s.xp-=s.xpToNext;
    s.level++;
    s.xpToNext=xpForLevel(s.level);
    if(s.level>1) showLevelUp(m.name,s.level,opts.deferLevelUp);
    if(skill==='architecture'&&s.level===2&&!state._seenArchitectureLv2){
      state._seenArchitectureLv2=true;
      setTimeout(()=>showToast('Architecture Lv 2 — you can now build a new room in your hut.'), 1200);
    }
  }
  if(event) spawnXPPopup('+'+amount+' '+m.icon+' · Lv '+s.level,m.color,event);
  if(event||skill==='woodcut'||skill==='husbandry') flashSkillPill(skill);
  if(!opts.skipShardDrop){
    tryShardDrop(skill);
    tryMagicShardDrop();
  }
  if(typeof markDirty==='function') markDirty('skills','activity');
  if(!opts.deferSync){
    if(typeof flushDirty==='function') flushDirty();
    else syncUI('full');
  }
}
