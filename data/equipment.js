/* Hearthstead — equipment (static data) */
'use strict';

const SHARD_CHANCE = 0.01;
const SHARD_FOR_SKILL = {
  woodcut:'earth', foraging:'earth', fishing:'water', mining:'earth',
  carpentry:'earth', cooking:'fire', tailoring:'earth', architecture:'earth',
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

const AXE_DEFS = [
  { tier:0, key:'axe',    icon:'🪓', name:'Rusted Axe' },
  { tier:1, key:'axe_1',  icon:'🪓', name:'Axe1' },
  { tier:2, key:'axe_2',  icon:'🪓', name:'Axe2' },
  { tier:3, key:'axe_3',  icon:'🪓', name:'Axe3' },
  { tier:4, key:'axe_4',  icon:'🪓', name:'Axe4' },
  { tier:5, key:'axe_5',  icon:'🪓', name:'Axe5' },
  { tier:6, key:'axe_6',  icon:'🪓', name:'Axe6' },
  { tier:7, key:'axe_7',  icon:'🪓', name:'Axe7' },
];
const AXE_BY_KEY = Object.fromEntries(AXE_DEFS.map(a=>[a.key,a]));
const EQUIPPABLE = Object.fromEntries(AXE_DEFS.map(a=>[a.key,{ icon:a.icon, name:a.name, tier:a.tier, slot:'tool' }]));

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