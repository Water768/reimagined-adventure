/* Hearthstead — resources (static data) */
'use strict';

const LOG_TIER_ORDER = ['logs','ashwood','teak','yew','ebonwood','silverbirch','ironbark','singing_oak'];

const WOODCUT_XP_DEFAULT = 8;

const LOG_DEFS = {
  logs:        { key:'logs',        icon:'🪵', name:'Log',         bonus:0,    woodcutXp:8,  vibe:'Plain old tree. The oak of this world.' },
  ashwood:     { key:'ashwood',     icon:'🪵', name:'Ashwood',     bonus:0.01, woodcutXp:16, vibe:'Pale, common in open clearings.' },
  teak:        { key:'teak',        icon:'🪵', name:'Teak',        bonus:0.02, woodcutXp:24, vibe:'Warmer, denser, a craftsman\'s staple.' },
  yew:         { key:'yew',         icon:'🪵', name:'Yew',         bonus:0.03, woodcutXp:32, vibe:'Ancient, slow-growing, revered.' },
  ebonwood:    { key:'ebonwood',    icon:'🪵', name:'Ebonwood',    bonus:0.04, woodcutXp:40, vibe:'Dark hardwood from shadowed groves.' },
  silverbirch: { key:'silverbirch', icon:'✨', name:'Silverbirch', bonus:0.045,woodcutXp:48, vibe:'Elegant, magical-adjacent, shimmers faintly.' },
  ironbark:    { key:'ironbark',    icon:'🪵', name:'Ironbark',    bonus:0.05, woodcutXp:56, vibe:'Almost metallic — feels like mining more than chopping.' },
  singing_oak: { key:'singing_oak', icon:'🎶', name:'Singing Oak', bonus:0.08, woodcutXp:64, vibe:'Rare, mythical, hums when cut.' },
};

function woodcutXpForLog(logKey){
  const xp=LOG_DEFS[logKey]?.woodcutXp;
  return (typeof xp==='number'&&xp>0)?xp:WOODCUT_XP_DEFAULT;
}

const CHOP_RATES = {
  logs:        [0.75, 0.90, 0.97, 0.99, 0.99, 0.99, 0.99, 0.99],
  ashwood:     [0.35, 0.70, 0.88, 0.96, 0.99, 0.99, 0.99, 0.99],
  teak:        [0.15, 0.40, 0.72, 0.88, 0.95, 0.99, 0.99, 0.99],
  yew:         [0.05, 0.18, 0.42, 0.70, 0.87, 0.95, 0.98, 0.99],
  silverbirch: [0.04, 0.14, 0.35, 0.65, 0.84, 0.93, 0.97, 0.99],
  ebonwood:    [0.02, 0.07, 0.18, 0.42, 0.68, 0.85, 0.94, 0.98],
  ironbark:    [0.01, 0.03, 0.09, 0.22, 0.45, 0.70, 0.86, 0.95],
  singing_oak: [0.01, 0.02, 0.04, 0.08, 0.14, 0.22, 0.32, 0.45],
};

const MINE_RESOURCE_DEFS = {
  stone:      { key:'stone',      icon:'🪨', name:'Stone',      category:'basic', unlockLevel:1,  vibe:'Common quarry rubble — the backbone of early building.' },
  brick:      { key:'brick',      icon:'🧱', name:'Brick',      category:'basic', unlockLevel:1,  vibe:'Fired clay blocks — sturdy building material.' },
  clay:       { key:'clay',       icon:'🟤', name:'Clay',       category:'basic', unlockLevel:1,  vibe:'Soft earth that holds shape when worked.' },
  limestone:  { key:'limestone',  icon:'⬜', name:'Limestone',  category:'basic', unlockLevel:1,  vibe:'Pale sedimentary rock, easy to quarry.' },
  chalk:      { key:'chalk',      icon:'🤍', name:'Chalk',      category:'basic', unlockLevel:3,  vibe:'Crumbly white stone from old seabeds.' },
  sandstone:  { key:'sandstone',  icon:'🟡', name:'Sandstone',  category:'basic', unlockLevel:3,  vibe:'Gritty layers pressed over ages.' },
  slate:      { key:'slate',      icon:'🩶', name:'Slate',      category:'basic', unlockLevel:5,  vibe:'Flat sheets that split clean and true.' },
  granite:    { key:'granite',    icon:'🪨', name:'Granite',    category:'stone', unlockLevel:8,  vibe:'Hard crystalline rock from deep quarries.' },
  basalt:     { key:'basalt',     icon:'⬛', name:'Basalt',     category:'stone', unlockLevel:10, vibe:'Dark volcanic stone, dense and stubborn.' },
  coal:       { key:'coal',       icon:'⚫', name:'Coal',       category:'fuel',  unlockLevel:12, vibe:'Black fuel locked in ancient peat.' },
  copper_ore: { key:'copper_ore', icon:'🟤', name:'Copper Ore', category:'ore',   unlockLevel:15, vibe:'Green-streaked ore worth smelting later.' },
  tin_ore:    { key:'tin_ore',    icon:'⚪', name:'Tin Ore',    category:'ore',   unlockLevel:22, vibe:'Dull grey ore that alloys with copper.' },
  iron_ore:   { key:'iron_ore',   icon:'🔩', name:'Iron Ore',   category:'ore',   unlockLevel:30, vibe:'Rust-red chunks from proper iron mines.' },
  salt_rock:  { key:'salt_rock',  icon:'🧂', name:'Salt Rock',  category:'mineral', unlockLevel:35, vibe:'Crystalline salt veins in deep stone.' },
  quartz:     { key:'quartz',     icon:'💎', name:'Quartz',     category:'mineral', unlockLevel:38, vibe:'Clear crystals glinting in the dark.' },
  silver_ore: { key:'silver_ore', icon:'🩶', name:'Silver Ore', category:'ore',   unlockLevel:48, vibe:'Precious streaks from the deepest veins.' },
  gold_ore:   { key:'gold_ore',   icon:'🟡', name:'Gold Ore',   category:'ore',   unlockLevel:60, vibe:'Rare golden flecks — a miner\'s dream.' },
  diamond:    { key:'diamond',    icon:'💎', name:'Diamond',    category:'mineral', unlockLevel:70, vibe:'Flawless crystal — rarer than gold.' },
  rope:       { key:'rope',       icon:'⛓️', name:'Rope',       category:'tool',  unlockLevel:1,  vibe:'Strong cord for drawing water from a well.' },
  bucket:     { key:'bucket',     icon:'🪣', name:'Bucket',     category:'tool',  unlockLevel:1,  vibe:'A bucket to haul water up from the depths.' },
};