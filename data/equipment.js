/* Hearthstead — equipment (static data) */
'use strict';

const SHARD_CHANCE = 0.01;
const SHARD_FOR_SKILL = {
  woodcut:'earth', foraging:'earth', fishing:'water', mining:'earth',
  carpentry:'earth', metalworking:'earth', cooking:'fire', crafting:'earth', architecture:'earth',
  botany:'earth', husbandry:'earth', design:'air', exploration:'air',
  knowledge:'air', magic:'magic', fire:'fire',
};
const SHARD_META = {
  fire:  { icon:'🔥', name:'Fire Shard' },
  water: { icon:'💧', name:'Water Shard' },
  earth: { icon:'🌿', name:'Earth Shard' },
  air:   { icon:'🌬️', name:'Air Shard' },
  magic: { icon:'💜', name:'Magic Shard' },
};
const MAGIC_SHARD_CHANCE = 0.005;

const AXE_EFFECT_BLURBS=[
  'Occasionally yields an extra log.',
  'Sometimes gives an extra log, that\'s a nice bonus.',
  'Gives extra logs fairly often.',
  'Regularly produces extra logs.',
  'Often gives multiple logs from one cut.',
  'Frequently yields extra logs when chopping.',
  'Frequently yields extra logs when chopping.',
  'Frequently yields extra logs when chopping.',
];

const PICKAXE_EFFECT_BLURBS=[
  'Adds a little more oomph to your swing.',
  'Gives your swing a bit more oomph.',
  'Puts noticeable oomph into your swing.',
  'Really adds oomph behind your swing.',
  'Packs a lot of oomph into each swing.',
  'Delivers serious oomph with every swing.',
  'Delivers serious oomph with every swing.',
  'Delivers serious oomph with every swing.',
];

const ROD_EFFECT_BLURBS=[
  'Makes rod fishing slightly quicker.',
  'Makes rod fishing a little quicker, that\'s more than slightly!',
  'Makes rod fishing quicker. woah',
  'Makes rod fishing noticeably quicker.',
  'Makes rod fishing much quicker now.',
  'Makes rod fishing even quicker.',
  'Makes rod fishing even quicker.',
  'Makes rod fishing even quicker.',
];

const NET_EFFECT_BLURBS=[
  'Makes net fishing slightly quicker.',
  'Makes net fishing a little quicker, that\'s more than slightly!',
  'Makes net fishing quicker. woah',
  'Makes net fishing noticeably quicker.',
  'Makes net fishing much quicker now.',
  'Makes net fishing even quicker.',
  'Makes net fishing even quicker.',
  'Makes net fishing even quicker.',
];

const AXE_DEFS = [
  { tier:0, key:'axe',    icon:'🪓', name:'Rusted Axe',   woodcutLevel:1,  effectBlurb:AXE_EFFECT_BLURBS[0] },
  { tier:1, key:'axe_1',  icon:'🪓', name:'Copper Axe',   woodcutLevel:5,  effectBlurb:AXE_EFFECT_BLURBS[1] },
  { tier:2, key:'axe_2',  icon:'🪓', name:'Bronze Axe',   woodcutLevel:10, effectBlurb:AXE_EFFECT_BLURBS[2] },
  { tier:3, key:'axe_3',  icon:'🪓', name:'Axe3',         woodcutLevel:14, effectBlurb:AXE_EFFECT_BLURBS[3] },
  { tier:4, key:'axe_4',  icon:'🪓', name:'Axe4',         woodcutLevel:18, effectBlurb:AXE_EFFECT_BLURBS[4] },
  { tier:5, key:'axe_5',  icon:'🪓', name:'Axe5',         woodcutLevel:22, effectBlurb:AXE_EFFECT_BLURBS[5] },
  { tier:6, key:'axe_6',  icon:'🪓', name:'Axe6',         woodcutLevel:26, effectBlurb:AXE_EFFECT_BLURBS[6] },
  { tier:7, key:'axe_7',  icon:'🪓', name:'Axe7',         woodcutLevel:30, effectBlurb:AXE_EFFECT_BLURBS[7] },
];
const AXE_BY_KEY = Object.fromEntries(AXE_DEFS.map(a=>[a.key,a]));

const PICKAXE_DEFS = [
  { tier:0, key:'pickaxe',    icon:'⛏️', name:'Rusted Pickaxe',   miningLevel:1,  effectBlurb:PICKAXE_EFFECT_BLURBS[0] },
  { tier:1, key:'pickaxe_1',  icon:'⛏️', name:'Copper Pickaxe',   miningLevel:5,  effectBlurb:PICKAXE_EFFECT_BLURBS[1] },
  { tier:2, key:'pickaxe_2',  icon:'⛏️', name:'Bronze Pickaxe',   miningLevel:10, effectBlurb:PICKAXE_EFFECT_BLURBS[2] },
  { tier:3, key:'pickaxe_3',  icon:'⛏️', name:'Pickaxe3',         miningLevel:14, effectBlurb:PICKAXE_EFFECT_BLURBS[3] },
  { tier:4, key:'pickaxe_4',  icon:'⛏️', name:'Pickaxe4',         miningLevel:18, effectBlurb:PICKAXE_EFFECT_BLURBS[4] },
  { tier:5, key:'pickaxe_5',  icon:'⛏️', name:'Pickaxe5',         miningLevel:22, effectBlurb:PICKAXE_EFFECT_BLURBS[5] },
  { tier:6, key:'pickaxe_6',  icon:'⛏️', name:'Pickaxe6',         miningLevel:26, effectBlurb:PICKAXE_EFFECT_BLURBS[6] },
  { tier:7, key:'pickaxe_7',  icon:'⛏️', name:'Pickaxe7',         miningLevel:30, effectBlurb:PICKAXE_EFFECT_BLURBS[7] },
];
const PICKAXE_BY_KEY = Object.fromEntries(PICKAXE_DEFS.map(p=>[p.key,p]));

function getAxeWoodcutLevel(keyOrDef){
  const def=typeof keyOrDef==='object'?keyOrDef:AXE_BY_KEY[keyOrDef];
  return def?.woodcutLevel??99;
}

function getPickaxeMiningLevel(keyOrDef){
  const def=typeof keyOrDef==='object'?keyOrDef:PICKAXE_BY_KEY[keyOrDef];
  return def?.miningLevel??99;
}

function canSelectAxeForWoodcut(key){
  const lvl=Number(state?.skills?.woodcut?.level)||1;
  return lvl>=getAxeWoodcutLevel(key);
}

function canSelectPickaxeForMining(key){
  const lvl=Number(state?.skills?.mining?.level)||1;
  return lvl>=getPickaxeMiningLevel(key);
}

const FISHING_ROD_DEFS = [
  { tier:0, key:'fishing_rod',   icon:'🎣', name:'String on a Stick',      fishingLevel:1,  tickMs:980, effectBlurb:ROD_EFFECT_BLURBS[0] },
  { tier:1, key:'fishing_rod_1', icon:'🎣', name:'Simple Rod',             fishingLevel:5,  tickMs:950, effectBlurb:ROD_EFFECT_BLURBS[1] },
  { tier:2, key:'fishing_rod_2', icon:'🎣', name:'Bronze Reel Rod',        fishingLevel:10, tickMs:910, effectBlurb:ROD_EFFECT_BLURBS[2] },
  { tier:3, key:'fishing_rod_3', icon:'🎣', name:'Iron Reel Rod',          fishingLevel:14, tickMs:870, effectBlurb:ROD_EFFECT_BLURBS[3] },
  { tier:4, key:'fishing_rod_4', icon:'🎣', name:'Steel Reel Rod',         fishingLevel:18, tickMs:830, effectBlurb:ROD_EFFECT_BLURBS[4] },
  { tier:5, key:'fishing_rod_5', icon:'🎣', name:'Deep Water Rod',         fishingLevel:22, tickMs:800, effectBlurb:ROD_EFFECT_BLURBS[5] },
  { tier:6, key:'fishing_rod_6', icon:'🎣', name:"Master Angler's Rod",    fishingLevel:26, tickMs:800, effectBlurb:ROD_EFFECT_BLURBS[6] },
  { tier:7, key:'fishing_rod_7', icon:'🎣', name:'Enchanted Rod',          fishingLevel:30, tickMs:800, effectBlurb:ROD_EFFECT_BLURBS[7] },
];
const FISHING_ROD_BY_KEY = Object.fromEntries(FISHING_ROD_DEFS.map(r=>[r.key,r]));

function getRodFishingLevel(keyOrDef){
  const def=typeof keyOrDef==='object'?keyOrDef:FISHING_ROD_BY_KEY[keyOrDef];
  return def?.fishingLevel??99;
}

function canSelectRodForFishing(key){
  const lvl=Number(state?.skills?.fishing?.level)||1;
  return lvl>=getRodFishingLevel(key);
}

const FISHING_TICK_MS_DEFAULT=1000;

function getRodFishingTickMs(keyOrDef){
  const def=typeof keyOrDef==='object'?keyOrDef:FISHING_ROD_BY_KEY[keyOrDef];
  return def?.tickMs??FISHING_TICK_MS_DEFAULT;
}

function getFishingTickMs(){
  const rod=typeof getUsableToolStoreRodDef==='function'?getUsableToolStoreRodDef():null;
  if(!rod) return FISHING_TICK_MS_DEFAULT;
  return getRodFishingTickMs(rod);
}

const FISHING_NET_DEFS = [
  { tier:0, key:'fishing_net',   icon:'🥅', name:'Basic Net',       fishingLevel:2,  effectBlurb:NET_EFFECT_BLURBS[0] },
  { tier:1, key:'fishing_net_1', icon:'🥅', name:'Rope Net',        fishingLevel:6,  effectBlurb:NET_EFFECT_BLURBS[1] },
  { tier:2, key:'fishing_net_2', icon:'🥅', name:'Weighted Net',    fishingLevel:11, effectBlurb:NET_EFFECT_BLURBS[2] },
  { tier:3, key:'fishing_net_3', icon:'🥅', name:'Reinforced Net',  fishingLevel:15, effectBlurb:NET_EFFECT_BLURBS[3] },
  { tier:4, key:'fishing_net_4', icon:'🥅', name:'Fine Net',        fishingLevel:19, effectBlurb:NET_EFFECT_BLURBS[4] },
  { tier:5, key:'fishing_net_5', icon:'🥅', name:'Heavy Net',       fishingLevel:23, effectBlurb:NET_EFFECT_BLURBS[5] },
  { tier:6, key:'fishing_net_6', icon:'🥅', name:'Expedition Net',  fishingLevel:27, effectBlurb:NET_EFFECT_BLURBS[6] },
  { tier:7, key:'fishing_net_7', icon:'🥅', name:'Legendary Net',   fishingLevel:31, effectBlurb:NET_EFFECT_BLURBS[7] },
];
const FISHING_NET_BY_KEY = Object.fromEntries(FISHING_NET_DEFS.map(n=>[n.key,n]));

function getNetFishingLevel(keyOrDef){
  const def=typeof keyOrDef==='object'?keyOrDef:FISHING_NET_BY_KEY[keyOrDef];
  return def?.fishingLevel??99;
}

function canSelectNetForFishing(key){
  const lvl=Number(state?.skills?.fishing?.level)||1;
  return lvl>=getNetFishingLevel(key);
}

/** Tools bound to the account via the tool store (equip once from bag; never unequip). */
const TOOL_STORE_SLOT_DEFS = [
  { id:'axe', label:'Axe', icon:'🪓' },
  { id:'pickaxe', label:'Pickaxe', icon:'⛏️' },
  { id:'fishing_rod', label:'Fishing Rod', icon:'🎣' },
  { id:'fishing_net', label:'Fishing Net', icon:'🥅' },
  { id:'basket', label:'Basket', icon:'🧺', keys:['basket'] },
];
const TOOL_STORE_KEY_TO_SLOT = Object.fromEntries(
  TOOL_STORE_SLOT_DEFS.flatMap((slot)=>{
    if(slot.id==='axe') return AXE_DEFS.map((a)=>[a.key, slot.id]);
    if(slot.id==='pickaxe') return PICKAXE_DEFS.map((p)=>[p.key, slot.id]);
    if(slot.id==='fishing_rod') return FISHING_ROD_DEFS.map((r)=>[r.key, slot.id]);
    if(slot.id==='fishing_net') return FISHING_NET_DEFS.map((n)=>[n.key, slot.id]);
    return (slot.keys||[]).map((key)=>[key, slot.id]);
  })
);

function axeDuplicateLogChance(tier){
  return 0.1*(Number(tier||0)+1);
}

const EQUIPPABLE = Object.fromEntries([
  ['copper_armour',{ icon:'🛡️', name:'Copper Armour', tier:1, slot:'body' }],
  ['bronze_armour',{ icon:'🛡️', name:'Bronze Armour', tier:2, slot:'body' }],
]);

const BAG_DEFS = [
  { key:'scrappy_pouch', icon:'👝', name:'Scrappy Pouch', invBonus:10 },
];
const BAG_BY_KEY = Object.fromEntries(BAG_DEFS.map(b=>[b.key,b]));

function getBagItemDef(key){
  return BAG_BY_KEY[key]||null;
}

function getEquippedBagBonus(){
  const key=state?.equippedBag?.key;
  if(!key) return 0;
  return BAG_BY_KEY[key]?.invBonus||state.equippedBag.invBonus||0;
}