/* Hearthstead — state & activity */
'use strict';

function getDefaultState(){
  return {
    gameStarted:false,
    gold:0, axeFound:false,
    dogBedCleaned:0, fireplaceStokes:0, logsOnFire:0,
    inventory:{},
    equipped:null,
    skills:{
      woodcut:{xp:0,level:1,xpToNext:100},
      foraging:{xp:0,level:1,xpToNext:100},
      fishing:{xp:0,level:1,xpToNext:100},
      mining:{xp:0,level:1,xpToNext:100},
      carpentry:{xp:0,level:1,xpToNext:100},
      cooking:{xp:0,level:1,xpToNext:100},
      tailoring:{xp:0,level:1,xpToNext:100},
      architecture:{xp:0,level:1,xpToNext:100},
      botany:{xp:0,level:1,xpToNext:100},
      husbandry:{xp:0,level:1,xpToNext:100},
      design:{xp:0,level:1,xpToNext:100},
      exploration:{xp:0,level:1,xpToNext:100},
      knowledge:{xp:0,level:1,xpToNext:100},
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
    fireplaceQuickAction:'cook',
    firePitQuickAction:'cook',
    plotLayout:null, plot:{ cells:null, editMode:false, panX:0, panY:0 }, plotConfigs:{},
    interior:{ cells:null, buildMode:false, panX:0, panY:0 },
    interiorLayout:null, interiorPanX:0, interiorPanY:0,
    pockets:{ fire:0, water:0, earth:0, air:0, magic:0 },
    pets:[],
    craftProgress:{},
    lastWorkbenchRecipe:'chair',
    equippedPetIds:[],
    _seenHut:false, _seenPond:false, _seenShard:false, _seenMagicShard:false,
    _seenArchitectureLv2:false,
    exploreStaminaRolls:{},
    exploreHealingRolls:{},
    wellUnlocked:false,
    wellFinishedUnlocked:false,
    firePitUnlocked:false,
    _archRoomBonuses:{},
    _archRoomBonusesMigrated:false,
    _saveVersion:0,
  };
}
const state = getDefaultState();

function invTotal(){ return Object.values(state.inventory).reduce((s,i)=>s+i.count,0); }

function storageAddDirect(key,icon,name,n){
  if(n<=0) return 0;
  if(!state.storage[key]) state.storage[key]={icon,name,count:0};
  else{
    state.storage[key].icon=icon;
    state.storage[key].name=name;
  }
  state.storage[key].count+=n;
  return n;
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
  const space=INV_CAP-invTotal();
  if(space<=0) return split.toStorage;
  const add=Math.min(split.toBag,space);
  if(!state.inventory[key]) state.inventory[key]={icon,name,count:0};
  state.inventory[key].count+=add;
  const net=invTotal()-before;
  if(net>0) flashInvPickup(icon, net);
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
  if(!state.inventory[key]) state.inventory[key]={icon,name,count:0};
  else{
    state.inventory[key].icon=icon;
    state.inventory[key].name=name;
  }
  state.inventory[key].count+=split.toBag;
  const net=invTotal()-(pickupBaseline!=null?pickupBaseline:before);
  if(net>0) flashInvPickup(icon, net);
  return split.toStorage+split.toBag;
}
function migrateItemKeys(){
  const renames=[['mackerel','raw_mackerel','Raw Mackerel','🐟'],['rock','stone','Stone','🪨'],['flint','brick','Brick','🧱'],['desk','apothecary_table','Apothecary Table','⚗️']];
  renames.forEach(([oldKey,newKey,name,icon])=>{
    if(state.inventory[oldKey]){
      const c=state.inventory[oldKey].count;
      delete state.inventory[oldKey];
      if(!state.inventory[newKey]) state.inventory[newKey]={icon,name,count:0};
      state.inventory[newKey].count+=c;
    }
    if(state.storage[oldKey]){
      const c=state.storage[oldKey].count;
      delete state.storage[oldKey];
      if(!state.storage[newKey]) state.storage[newKey]={icon,name,count:0};
      state.storage[newKey].count+=c;
    }
  });
}

let invSelectedKey = null;

function migrateEquippedAxe(){
  if(!state.equipped) return;
  const def = AXE_BY_KEY[state.equipped.key];
  if(def && state.equipped.tier == null) state.equipped.tier = def.tier;
  if(state.equipped.key === 'axe' && state.equipped.tier == null) state.equipped.tier = 0;
}

function hasAxeAvailable(){
  if(state.equipped && AXE_BY_KEY[state.equipped.key]) return true;
  return AXE_DEFS.some(a => (state.inventory[a.key]?.count || 0) > 0);
}

function findAxeInBag(){
  for(let i = AXE_DEFS.length - 1; i >= 0; i--){
    const a = AXE_DEFS[i];
    if((state.inventory[a.key]?.count || 0) > 0) return a;
  }
  return null;
}

function equipAxeDef(def){
  if(!def || !(state.inventory[def.key]?.count > 0)) return false;
  state.inventory[def.key].count--;
  if(!state.inventory[def.key].count) delete state.inventory[def.key];
  state.equipped = { key:def.key, icon:def.icon, name:def.name, tier:def.tier };
  return true;
}


function itemCountBagAndStore(key, opts){
  opts=opts||{};
  if(opts.infiniteKeys?.includes(key)) return Infinity;
  if(opts.infinite) return Infinity;
  return (state.inventory[key]?.count||0) + (state.storage[key]?.count||0);
}

function formatAvailableCount(count, infinite){
  if(infinite||count===Infinity) return '∞ available';
  return count+' available';
}

function formatRecipeMatLine(name, qty, stock, opts){
  const q=Math.max(1, qty||1);
  let line=(name||'?')+' ×'+q;
  if(opts?.unobtainable) line+=' • not obtainable yet';
  else line+=' • '+formatAvailableCount(stock);
  return line;
}

function nailCount(key){
  const t=typeof NAIL_TYPES!=='undefined'?NAIL_TYPES[key]:null;
  if(t?.infinite) return Infinity;
  return itemCountBagAndStore(key);
}

function grantNailToStorage(nailKey){
  const def=typeof NAIL_TYPES!=='undefined'?NAIL_TYPES[nailKey]:null;
  if(!def||def.infinite) return false;
  if(!state.storage[nailKey]) state.storage[nailKey]={ icon:def.icon, name:def.name, count:0 };
  state.storage[nailKey].count++;
  return true;
}

function consumeOneFromBagOrStore(key){
  const inv=state.inventory[key];
  if(inv?.count){
    inv.count--;
    if(!inv.count) delete state.inventory[key];
    return true;
  }
  const stored=state.storage[key];
  if(stored?.count){
    stored.count--;
    if(!stored.count) delete state.storage[key];
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
  scheduleSaveGame();
  return n;
}

function getFurnitureDef(key){
  if(FURNITURE_DEFS[key]) return FURNITURE_DEFS[key];
  const item=state.inventory[key]||state.storage[key];
  if(item) return { key, icon:item.icon, name:item.name };
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

function returnOneToBagOrStore(key, icon, name){
  if(invTotal()<INV_CAP){
    invAddDirect(key, icon, name, 1);
    return 'bag';
  }
  if(!state.storage[key]) state.storage[key]={ icon, name, count:0 };
  state.storage[key].count++;
  return 'store';
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
    shard:def.passiveType==='shard'?rollPetShard():null,
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
  if((state.inventory[recipe.rawKey]?.count||0)>0) return true;
  return invTotal()<INV_CAP;
}

/** Take one raw ingredient for cooking — bag first; storage only if bag has room for the result. */
function consumeRawForCook(recipe){
  const key=recipe.rawKey;
  if((state.inventory[key]?.count||0)>0) return consumeOneFromBagOrStore(key);
  if(invTotal()>=INV_CAP) return false;
  return consumeOneFromBagOrStore(key);
}

function calcSpinSuccess(recipe){
  const lvl=Number(state.skills.tailoring?.level)||1;
  const levelsAbove=Math.max(0,lvl-1);
  return Math.min(1, recipe.baseSuccess + levelsAbove * recipe.successPerLevel);
}

function canSpinAnyFiber(){
  return Object.keys(SPINNING_RECIPES).some(k=>canSpinRecipe(SPINNING_RECIPES[k]));
}

function canSpinRecipe(recipe){
  return itemCountBagAndStore(recipe.rawKey)>0;
}

function canStoreSpinResult(recipe){
  if((state.inventory[recipe.rawKey]?.count||0)>0) return true;
  return invTotal()<INV_CAP;
}

function tryShardDrop(skill){
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

const fish={ running:false, timer:null, pondInstanceId:null };
const gather={ running:false, timer:null, instanceId:null, itemsThisSession:0 };
const wc={ treeInstanceId:null };
const mine={ running:false, timer:null, instanceId:null, stacks:0 };
const explore={ instanceId:null, tier:'short', focusFishId:null, focusMedicineKey:null, eitherChoice:null, reqSubmenu:null, running:false };
const ACTIVITY_MENU_SHOW_MS=3000;
const plotActivityMenuTimers={};
const cook={ running:false, timer:null, recipeKey:'goldfish' };
const spin={ running:false, timer:null, recipeKey:'twisted_grass' };
const apothProcess={ running:false, timer:null };
const loomProcess={ running:false, timer:null };
const activity={ type:null };
let skillFlashKey=null;
let skillFlashTimer=null;

function isInteriorContext(){
  return currentScreen==='interior-screen'||HUT_OVERLAY_SCREENS.has(currentScreen);
}

function isExteriorContext(){
  return currentScreen==='exterior-screen'||WORLD_OVERLAY_SCREENS.has(currentScreen);
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
  if(r?.label) return r.label;
  return type==='fishing'?'Fishing':type==='gathering'?'Gathering':type==='woodcutting'?'Woodcutting':type==='mining'?'Mining':type==='crafting'?'Workbench':type==='cooking'?'Cooking':type==='spinning'?'Spinning':type==='loom'?'Weaving':type==='apothecary'?'Processing':type==='exploring'?'Exploring':'';
}

const ACTIVITY_SKILL_KEYS={
  fishing:'fishing',
  gathering:'foraging',
  woodcutting:'woodcut',
  mining:'mining',
  cooking:'cooking',
  spinning:'tailoring',
  loom:'tailoring',
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
  tailoring:'spinning',
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
  if(type==='fishing') stopFishing(true);
  else if(type==='gathering') stopGathering(true);
  else if(type==='woodcutting'){ wc.treeInstanceId=null; clearActivity('woodcutting'); }
  else if(type==='mining') stopMining(true);
  else stopRegisteredActivity(type, true);
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
  if(fish.running) stopFishing(true);
  if(gather.running) stopGathering(true);
  if(mine.running) stopMining(true);
  if(wc.treeInstanceId){ wc.treeInstanceId=null; clearActivity('woodcutting'); }
  Object.keys(ACTIVITY_RUNNERS).forEach(type=>stopRegisteredActivity(type, true));
  activity.type=null;
}

function reconcileActivityState(){
  if(fish.running&&activity.type!=='fishing') stopFishing(true);
  if(gather.running&&activity.type!=='gathering') stopGathering(true);
  if(mine.running&&activity.type!=='mining') stopMining(true);
  if(wc.treeInstanceId&&activity.type!=='woodcutting') wc.treeInstanceId=null;
  Object.keys(ACTIVITY_RUNNERS).forEach(type=>{
    if(isActivityRunning(type)&&activity.type!==type) stopRegisteredActivity(type, true);
    if(activity.type===type&&!isActivityRunning(type)) clearActivity(type);
  });
}

function hasRunningActivity(){
  return fish.running||gather.running||mine.running||anyRegisteredActivityRunning()||!!wc.treeInstanceId||!!explore.running;
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
  if(!opts.deferSync) syncUI();
}
