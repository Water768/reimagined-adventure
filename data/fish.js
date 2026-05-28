/* Hearthstead — fish (static data) */
'use strict';

/** Cooked ration stamina scales with fishing level: 10 at lvl 1 → 32 at lvl 50. Raw fish has none. */
function staminaForFishLevel(level){
  const lvl=Math.max(1, Math.min(50, level|0));
  return Math.round(10 + (lvl - 1) * 22 / 49);
}

const FISH_DEFS={
  goldfish:{key:'raw_goldfish',name:'Goldfish',icon:'🐠',level:1,rarity:'common'},
  frog:{key:'raw_frog',name:'Frog',icon:'🐸',level:5,rarity:'rare'},
  minnow:{key:'raw_minnow',name:'Minnow',icon:'🐟',level:8,rarity:'common'},
  koi:{key:'raw_koi',name:'Koi',icon:'🎏',level:15,rarity:'rare'},
  trout:{key:'raw_trout',name:'Trout',icon:'🐟',level:12,rarity:'common'},
  salmon:{key:'raw_salmon',name:'Salmon',icon:'🐟',level:22,rarity:'rare'},
  perch:{key:'raw_perch',name:'Perch',icon:'🐟',level:18,rarity:'common'},
  pike:{key:'raw_pike',name:'Pike',icon:'🐟',level:30,rarity:'rare'},
  catfish:{key:'raw_catfish',name:'Catfish',icon:'🐟',level:25,rarity:'common'},
  sturgeon:{key:'raw_sturgeon',name:'Sturgeon',icon:'🐟',level:40,rarity:'rare'},
  sardine:{key:'raw_sardine',name:'Sardine',icon:'🐟',level:10,rarity:'common'},
  mackerel:{key:'raw_mackerel',name:'Mackerel',icon:'🐟',level:12,rarity:'common'},
  anchovy:{key:'raw_anchovy',name:'Anchovy',icon:'🐟',level:14,rarity:'common'},
  jellyfish:{key:'raw_jellyfish',name:'Jellyfish',icon:'🪼',level:16,rarity:'common'},
  crab:{key:'raw_crab',name:'Crab',icon:'🦀',level:18,rarity:'common'},
  clownfish:{key:'raw_clownfish',name:'Clownfish',icon:'🐠',level:20,rarity:'common'},
  seaweed:{key:'raw_seaweed',name:'Seaweed',icon:'🌿',level:8,rarity:'common'},
  tuna:{key:'raw_tuna',name:'Tuna',icon:'🐟',level:28,rarity:'rare'},
  swordfish:{key:'raw_swordfish',name:'Swordfish',icon:'🐟',level:32,rarity:'rare'},
  shark:{key:'raw_shark',name:'Shark',icon:'🦈',level:38,rarity:'rare'},
  octopus:{key:'raw_octopus',name:'Octopus',icon:'🐙',level:35,rarity:'rare'},
  lobster:{key:'raw_lobster',name:'Lobster',icon:'🦞',level:42,rarity:'rare'},
  pufferfish:{key:'raw_pufferfish',name:'Pufferfish',icon:'🐡',level:30,rarity:'rare'},
  sea_turtle:{key:'raw_sea_turtle',name:'Sea Turtle',icon:'🐢',level:50,rarity:'rare'},
};

Object.values(FISH_DEFS).forEach(fish=>{
  fish.stamina=staminaForFishLevel(fish.level);
});