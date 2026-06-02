/* Hearthstead — Whispering Woods Camp (static data) */
'use strict';

const WHISPER_CAMP_ARCH_UNLOCK = 1;
const WHISPER_CAMP_DISPLAY_NAME = 'Whispering Woods Camp';
const WHISPER_CAMP_LOGS_BUILD = 5;
const WHISPER_CAMP_TYPE_T1 = 'whisper_camp';
const WHISPER_CAMP_TYPE_T2 = 'whisper_camp_t2';
const WHISPER_CAMP_TYPE_T3 = 'whisper_camp_t3';

const WHISPER_CAMP_TIER_NAMES = {
  1: 'Tier 1',
  2: 'Tier 2',
  3: 'Tier 3',
};

const WHISPER_CAMP_TIER_LABELS = {
  1: 'Tier 1 — Short Treks unlocked at adjacent Whispering Woods',
  2: 'Tier 2 — Medium Treks unlocked',
  3: 'Tier 3 — Long Treks unlocked',
};

const WHISPER_CAMP_UPGRADE_COSTS = {
  2: [{ key: 'logs', qty: 5, icon: '🪵', name: 'Logs' }],
  3: [{ key: 'logs', qty: 10, icon: '🪵', name: 'Logs' }],
};

function whisperCampTypeIdForTier(tier) {
  const t = tier | 0;
  if (t >= 3) return WHISPER_CAMP_TYPE_T3;
  if (t >= 2) return WHISPER_CAMP_TYPE_T2;
  return WHISPER_CAMP_TYPE_T1;
}

function whisperCampTierFromTypeId(typeId) {
  if (typeId === WHISPER_CAMP_TYPE_T3) return 3;
  if (typeId === WHISPER_CAMP_TYPE_T2) return 2;
  if (typeId === WHISPER_CAMP_TYPE_T1) return 1;
  return 0;
}

function whisperCampDisplayTierName(tier) {
  return WHISPER_CAMP_TIER_NAMES[tier | 0] || ('Tier ' + (tier | 0));
}

function getWhisperCampUpgradeCost(tier) {
  return WHISPER_CAMP_UPGRADE_COSTS[tier | 0] || [];
}

function isWhisperCampComplete(cfg) {
  return !!(cfg?.complete || (cfg?.logs | 0) >= WHISPER_CAMP_LOGS_BUILD);
}
