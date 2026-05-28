/* Hearthstead — pets data */
'use strict';

/** Husbandry level for each owned-pet slot: Lv 2, Lv 3, then +6 per slot after. */
const HUSBANDRY_PET_SLOT_LEVELS = (()=>{
  const levels=[2, 3];
  for(let lv=9; levels.length<10; lv+=6) levels.push(lv);
  return levels;
})();

const DOG_STORAGE_FETCH_CHANCE = 0.05;

const PET_MAX_LEVEL = 5;
const PET_LEVEL_ITEM_COUNT = 20;
/** XP required to reach each level from the previous one (Lv 2 → 100, Lv 3 → 200, …). */
const PET_EXP_TO_LEVEL = { 2: 100, 3: 200, 4: 300, 5: 400 };
/** Level-up item keys per species; each tier uses 20 of the listed item. */
const PET_LEVEL_UP_ITEMS = {
  cat: { 2: 'cooked_frog', 3: 'cooked_minnow', 4: 'cooked_trout', 5: 'cooked_salmon' },
  dog: { 2: 'bones', 3: 'large_bone', 4: 'copper_ore', 5: 'iron_ore' },
  magpie: { 2: 'worms', 3: 'spiderweb', 4: 'silk', 5: 'enchanted_web' },
};

const PET_SPECIES = {
  cat: {
    key: 'cat',
    name: 'Cat',
    icon: '🐱',
    tier: 1,
    adoptCostKey: 'cooked_goldfish',
    adoptCostAmount: 20,
    adoptCostLabel: 'cooked goldfish',
    passiveType: 'shard',
    description: 'A shard hunter. Equip to passively find elemental shards while you play.',
    namePool: ['Mittens', 'Shadow', 'Pip', 'Whisker', 'Luna', 'Ginger', 'Soot', 'Pearl', 'Marble', 'Bean'],
  },
  dog: {
    key: 'dog',
    name: 'Dog',
    icon: '🐕',
    tier: 1,
    adoptCostKey: 'bones',
    adoptCostAmount: 40,
    adoptCostLabel: 'bones',
    passiveType: 'storageRedirect',
    passiveChance: DOG_STORAGE_FETCH_CHANCE,
    description: 'A loyal fetcher. When following you, sometimes carries new finds straight to storage.',
    namePool: ['Buddy', 'Rex', 'Maple', 'Scout', 'Copper', 'Daisy', 'Bear', 'Pepper', 'Rusty', 'Nova'],
  },
  magpie: {
    key: 'magpie',
    name: 'Magpie',
    icon: '🐦',
    tier: 1,
    adoptCostKey: 'worms',
    adoptCostAmount: 500,
    adoptCostLabel: 'worms',
    passiveType: 'nailCollect',
    description: 'A clever scavenger. While following you, collects one nail per minute and delivers it straight to storage.',
    namePool: ['Pied', 'Magpie', 'Spark', 'Ink', 'Flash', 'Chatter', 'Slate', 'Patch'],
  },
};

/** Husbandry XP on adoption = item cost × species tier (separate from pet level). */
function getPetSpeciesTier(def){
  const tier=Number(def?.tier);
  return tier>0?tier:1;
}

function husbandryXpForPetAdoption(def){
  const amount=Number(def?.adoptCostAmount)||0;
  return amount*getPetSpeciesTier(def);
}

function getPetTier(pet){
  const stored=Number(pet?.tier);
  if(stored>0) return stored;
  return getPetSpeciesTier(getPetSpeciesDef(pet?.type));
}

const PET_TREAT_AMOUNT_MIN=1;
const PET_TREAT_AMOUNT_MAX=50;

/** Magpie nail drop weights per pet level — iron / copper / forged / ironbark / gilded (%). */
const MAGPIE_NAIL_DROP_TABLES={
  1:[50,40,6,3,1],
  2:[0,80,10,8,2],
  3:[0,0,60,35,5],
  4:[0,0,0,90,10],
  5:[0,0,0,20,80],
};

function getPetTreatDayKey(date){
  const d=date||new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return ''+y+m+day;
}

function rollPetTreatAmount(){
  return PET_TREAT_AMOUNT_MIN+Math.floor(Math.random()*(PET_TREAT_AMOUNT_MAX-PET_TREAT_AMOUNT_MIN+1));
}

function getPetTreatItemMeta(def){
  const key=def?.adoptCostKey;
  if(!key) return { key:'', icon:'🍖', name:'treat' };
  if(typeof NAIL_TYPES!=='undefined'&&NAIL_TYPES[key]){
    const nail=NAIL_TYPES[key];
    if(!nail.infinite) return { key, icon:nail.icon, name:nail.name };
  }
  if(typeof COOKING_RECIPES!=='undefined'){
    for(const r of Object.values(COOKING_RECIPES)){
      if(r.cookedKey===key) return { key, icon:r.cookedIcon, name:r.cookedName };
      if(r.rawKey===key) return { key, icon:r.rawIcon, name:r.rawName };
    }
  }
  if(typeof GATHERING_LOCATIONS!=='undefined'){
    for(const loc of GATHERING_LOCATIONS){
      const drop=loc.drops?.find(d=>d.key===key);
      if(drop) return { key, icon:drop.icon, name:drop.name };
    }
  }
  if(typeof getBotanyItemDef==='function'){
    const bot=getBotanyItemDef(key);
    if(bot) return { key, icon:bot.icon, name:bot.name };
  }
  if(typeof FIBER_DEFS!=='undefined'&&FIBER_DEFS[key]){
    const fiber=FIBER_DEFS[key];
    return { key, icon:fiber.icon, name:fiber.name };
  }
  if(typeof MINE_RESOURCE_DEFS!=='undefined'&&MINE_RESOURCE_DEFS[key]){
    const res=MINE_RESOURCE_DEFS[key];
    return { key, icon:res.icon, name:res.name };
  }
  const stored=state.inventory[key]||state.storage[key];
  if(stored) return { key, icon:stored.icon, name:stored.name };
  return { key, icon:def.icon, name:def.adoptCostLabel||key };
}

function ensurePetTreatState(pet){
  if(!pet) return null;
  const dayKey=getPetTreatDayKey();
  if(pet.treatDay!==dayKey){
    pet.treatDay=dayKey;
    pet.treatAmount=rollPetTreatAmount();
    pet.treatFed=false;
    pet.treatXp=0;
  }
  if(!pet.treatAmount||pet.treatAmount<1) pet.treatAmount=rollPetTreatAmount();
  return pet;
}

function getPetTreatStatus(pet){
  const def=getPetSpeciesDef(pet?.type);
  ensurePetTreatState(pet);
  const item=getPetTreatItemMeta(def);
  const amount=pet.treatAmount;
  const stock=itemCountBagAndStore(item.key);
  const previewXp=husbandryXpForPetTreat(pet, amount);
  const xp=pet.treatFed
    ?(Number(pet.treatXp)>0?Number(pet.treatXp):previewXp)
    :previewXp;
  return {
    def,
    item,
    amount,
    stock,
    fed:!!pet.treatFed,
    xp,
    canFeed:!pet.treatFed&&stock>=amount,
  };
}

function getPetLevel(pet){
  const lv=Number(pet?.level);
  if(!lv||lv<1) return 1;
  return Math.min(PET_MAX_LEVEL, lv);
}

function getPetExpRequiredForNextLevel(pet){
  const next=getPetLevel(pet)+1;
  if(next>PET_MAX_LEVEL) return null;
  return PET_EXP_TO_LEVEL[next];
}

function getPetExpCap(pet){
  return getPetExpRequiredForNextLevel(pet);
}

function clampPetExp(pet){
  if(!pet) return 0;
  const cap=getPetExpCap(pet);
  let exp=Math.max(0, Number(pet.exp)||0);
  if(cap!=null&&exp>cap) exp=cap;
  pet.exp=exp;
  return exp;
}

function getPetExp(pet){
  return clampPetExp(pet);
}

function canPetGainFollowProgress(pet){
  if(getPetLevel(pet)>=PET_MAX_LEVEL) return false;
  const cap=getPetExpCap(pet);
  if(cap==null) return false;
  return getPetExp(pet)<cap;
}

function grantPetFollowProgress(pet){
  if(!canPetGainFollowProgress(pet)) return false;
  pet.exp=(pet.exp||0)+1;
  clampPetExp(pet);
  return true;
}

function getPetLevelUpItemKey(pet){
  const next=getPetLevel(pet)+1;
  if(next>PET_MAX_LEVEL) return null;
  const map=PET_LEVEL_UP_ITEMS[pet?.type]||PET_LEVEL_UP_ITEMS.cat;
  return map[next]||null;
}

function getPetLevelUpItemMeta(pet){
  const key=getPetLevelUpItemKey(pet);
  if(!key) return null;
  return getPetTreatItemMeta({ adoptCostKey: key });
}

function getCatShardChancePercent(level){
  return Math.min(PET_MAX_LEVEL, Math.max(1, level|0))+1;
}

function rollMagpieNailDrop(petLevel){
  const lv=Math.min(PET_MAX_LEVEL, Math.max(1, Number(petLevel)||1));
  const weights=MAGPIE_NAIL_DROP_TABLES[lv]||MAGPIE_NAIL_DROP_TABLES[1];
  const roll=Math.random()*100;
  let acc=0;
  for(let i=0;i<NAIL_TIER_ORDER.length;i++){
    acc+=weights[i]||0;
    if(roll<acc) return NAIL_TIER_ORDER[i];
  }
  return NAIL_TIER_ORDER[NAIL_TIER_ORDER.length-1];
}

function formatMagpieNailDropTable(petLevel){
  const lv=Math.min(PET_MAX_LEVEL, Math.max(1, Number(petLevel)||1));
  const weights=MAGPIE_NAIL_DROP_TABLES[lv]||MAGPIE_NAIL_DROP_TABLES[1];
  return NAIL_TIER_ORDER.map((key,i)=>{
    const pct=weights[i]||0;
    if(!pct) return null;
    const nail=NAIL_TYPES[key];
    return (nail?.name||key)+' '+pct+'%';
  }).filter(Boolean).join(' · ');
}

function getPetMagpieNailDropSummary(petLevel){
  return formatMagpieNailDropTable(petLevel);
}

function getPetShardPassiveChance(pet){
  const def=getPetSpeciesDef(pet?.type);
  if(def.passiveType!=='shard') return 0;
  return getCatShardChancePercent(getPetLevel(pet))/100;
}

function getPetDogFetchChance(pet){
  const def=getPetSpeciesDef(pet?.type);
  if(def.passiveType!=='storageRedirect') return 0;
  const base=def.passiveChance??DOG_STORAGE_FETCH_CHANCE;
  return base+(getPetLevel(pet)-1)*0.01;
}

function getPetLevelBenefitPreview(pet, targetLevel){
  const def=getPetSpeciesDef(pet?.type);
  if(def.passiveType==='nailCollect'){
    return 'Nail finds shift toward better tiers: '+formatMagpieNailDropTable(targetLevel)+'.';
  }
  if(def.passiveType==='shard'){
    return 'Shard find chance rises to '+getCatShardChancePercent(targetLevel)+'% per minute while following.';
  }
  if(def.passiveType==='storageRedirect'){
    const pct=Math.round((DOG_STORAGE_FETCH_CHANCE+(targetLevel-1)*0.01)*100);
    return 'Storage fetch chance rises to '+pct+'% per picked-up item.';
  }
  return 'Treat Husbandry XP scales with pet level (×'+targetLevel+').';
}

function getPetLevelUpGainMessage(pet, newLevel){
  const def=getPetSpeciesDef(pet?.type);
  if(def.passiveType==='nailCollect'){
    return pet.name+' reached Lv '+newLevel+'! Nail finds: '+formatMagpieNailDropTable(newLevel)+'.';
  }
  if(def.passiveType==='shard'){
    return pet.name+' reached Lv '+newLevel+'! Shard hunts at '+getCatShardChancePercent(newLevel)+'% per minute.';
  }
  if(def.passiveType==='storageRedirect'){
    return pet.name+' reached Lv '+newLevel+'! Fetch to storage at '+Math.round(getPetDogFetchChance(pet)*100)+'% per item.';
  }
  return pet.name+' reached Lv '+newLevel+'! Treats now grant '+newLevel+'× Husbandry XP.';
}

function getPetLevelUpStatus(pet){
  const level=getPetLevel(pet);
  const expReq=getPetExpRequiredForNextLevel(pet);
  if(expReq==null){
    return { maxLevel:true, level, exp:getPetExp(pet), expReq:null };
  }
  const exp=getPetExp(pet);
  const item=getPetLevelUpItemMeta(pet);
  const itemNeed=PET_LEVEL_ITEM_COUNT;
  const stock=item?itemCountBagAndStore(item.key):0;
  const expOk=exp>=expReq;
  const itemOk=stock>=itemNeed;
  return {
    maxLevel:false,
    level,
    nextLevel:level+1,
    exp,
    expReq,
    expOk,
    item,
    itemNeed,
    stock,
    itemOk,
    canLevelUp:expOk&&itemOk,
    benefit:getPetLevelBenefitPreview(pet, level+1),
  };
}

/** Bonus Husbandry XP for daily treat = 2 × tier × items × pet level. */
function husbandryXpForPetTreat(pet, itemCount){
  const qty=Math.max(0, Number(itemCount)||0);
  return 2*getPetTier(pet)*qty*getPetLevel(pet);
}

const PET_PARTNER_INTRO =
  'Partnering a pet costs supplies up front. Equip them to bring their abilities on your adventures.';
