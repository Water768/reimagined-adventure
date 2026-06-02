/* Hearthstead — afternoon foraging expansion (static data) */
'use strict';

const MEDIUM_APOTHECARY_SPRIGS_KEY = 'medium_apothecary_sprigs';
const IDENTIFIED_SPRIG_KEYS = ['silver_vein_fern', 'adders_tongue', 'feather_moss'];

const FORAGING_AFTERNOON_ITEMS = {
  fairy_dust: { key: 'fairy_dust', icon: '✨', name: 'Fairy Dust' },
  shed_glowing_antler_piece: { key: 'shed_glowing_antler_piece', icon: '🦌', name: 'Shed Glowing Antler Piece' },
  seashell: { key: 'seashell', icon: '🐚', name: 'Seashell' },
  pool_goby: { key: 'pool_goby', icon: '🐟', name: 'Pool Goby' },
  hermit_crab_shell: { key: 'hermit_crab_shell', icon: '🦀', name: 'Hermit Crab Shell' },
  glittering_fishscale: { key: 'glittering_fishscale', icon: '✨', name: 'Glittering Fishscale' },
  purple_jelly_goo: { key: 'purple_jelly_goo', icon: '🟣', name: 'Purple Jelly Goo' },
  glow_anemone_spores: { key: 'glow_anemone_spores', icon: '🪸', name: 'Glow-Anemone Spores' },
  slick_grip_waders: {
    key: 'slick_grip_waders',
    icon: '🥾',
    name: 'Slick-Grip Waders',
    category: 'utility',
    stackable: false,
  },
  empty_glass_jar: {
    key: 'empty_glass_jar',
    icon: '🫙',
    name: 'Empty Glass Jar',
    category: 'tool',
  },
};

const FAWN_COMFORT_MAX = 100;
const FAWN_COMFORT_MUSHROOM_PCT = 0.1;
const FAWN_COMFORT_FEED_PCT = 5;
const FAWN_FEED_COOLDOWN_MS = 2 * 60 * 1000;
const FAWN_FEED_BERRY_KEY = 'wild_berries';

const GATHER_DROP_REQUIRES_STORAGE = {
  fairy_dust: 'empty_glass_jar',
  glow_anemone_spores: 'vial_of_water',
};

const GATHER_DROP_SPECIAL = {
  sunken_lockbox: 'sunken_lockbox_reach',
};

function rollIdentifiedSprigKey() {
  return IDENTIFIED_SPRIG_KEYS[Math.floor(Math.random() * IDENTIFIED_SPRIG_KEYS.length)];
}

function getGatheringLocationDef(gatherKey) {
  return typeof getGatheringByKey === 'function' ? getGatheringByKey(gatherKey) : null;
}

function getGatheringHarvestLevel(loc) {
  return Math.max(1, Number(loc?.harvestLevel) || 1);
}

function getGatheringUnlockRequirements(loc) {
  if (loc?.unlockRequirements?.length) return loc.unlockRequirements.slice();
  return [];
}

function meetsGatheringUnlockRequirements(loc) {
  const reqs = getGatheringUnlockRequirements(loc);
  if (!reqs.length) return true;
  return reqs.every((r) => (Number(state.skills[r.skill]?.level) || 1) >= (r.level | 0));
}

function getGatheringUnlockBlockMessage(loc) {
  const reqs = getGatheringUnlockRequirements(loc);
  if (!reqs.length) return '';
  const missing = reqs.filter((r) => (Number(state.skills[r.skill]?.level) || 1) < (r.level | 0));
  if (!missing.length) return '';
  return missing
    .map((r) => {
      const meta = typeof SKILL_META !== 'undefined' ? SKILL_META[r.skill] : null;
      return 'Lv ' + r.level + ' ' + (meta?.name || r.skill);
    })
    .join(' · ');
}

function canHarvestAtGatheringLocation(loc) {
  if (!loc) return false;
  const foragingLvl = Number(state.skills.foraging?.level) || 1;
  return foragingLvl >= getGatheringHarvestLevel(loc);
}

function getGatheringHarvestBlockMessage(loc) {
  if (!loc || canHarvestAtGatheringLocation(loc)) return '';
  const meta = typeof SKILL_META !== 'undefined' ? SKILL_META.foraging : null;
  return 'Need Lv ' + getGatheringHarvestLevel(loc) + ' ' + (meta?.name || 'Foraging') + ' to harvest here';
}

function plotGatherUnlockMaxLevel(loc) {
  const reqs = getGatheringUnlockRequirements(loc);
  if (!reqs.length) return getGatheringHarvestLevel(loc);
  return Math.max(getGatheringHarvestLevel(loc), ...reqs.map((r) => r.level | 0));
}
