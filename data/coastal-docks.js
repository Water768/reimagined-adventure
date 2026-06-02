/* Hearthstead — Coastal Docks (static data) */
'use strict';

const COASTAL_DOCKS_ARCH_UNLOCK=1;
const COASTAL_DOCKS_DISPLAY_NAME='Coastal Docks';
const COASTAL_DOCKS_LOGS_BUILD=5;
const COASTAL_DOCKS_TYPE_T1='coastal_docks';
const COASTAL_DOCKS_TYPE_T2='coastal_docks_t2';
const COASTAL_DOCKS_TYPE_T3='coastal_docks_t3';

const COASTAL_DOCKS_TIER_NAMES={
  1:'Tier 1',
  2:'Tier 2',
  3:'Tier 3',
};

const COASTAL_DOCKS_TIER_LABELS={
  1:'Tier 1 — Short Treks unlocked at adjacent Sunken Shallows',
  2:'Tier 2 — Medium Treks unlocked',
  3:'Tier 3 — Long Treks unlocked',
};

const COASTAL_DOCKS_UPGRADE_COSTS={
  2:[
    { key:'logs', qty:5, icon:'🪵', name:'Logs' },
    { key:WATERPROOF_MORTAR_KEY, qty:3, icon:'🫙', name:'Waterproof Mortar' },
  ],
  3:[
    { key:'stone', qty:8, icon:'🪨', name:'Stone' },
    { key:WATERPROOF_MORTAR_KEY, qty:10, icon:'🫙', name:'Waterproof Mortar' },
  ],
};

function coastalDocksTypeIdForTier(tier){
  const t=tier|0;
  if(t>=3) return COASTAL_DOCKS_TYPE_T3;
  if(t>=2) return COASTAL_DOCKS_TYPE_T2;
  return COASTAL_DOCKS_TYPE_T1;
}

function coastalDocksTierFromTypeId(typeId){
  if(typeId===COASTAL_DOCKS_TYPE_T3) return 3;
  if(typeId===COASTAL_DOCKS_TYPE_T2) return 2;
  if(typeId===COASTAL_DOCKS_TYPE_T1) return 1;
  return 0;
}

function coastalDocksDisplayTierName(tier){
  return COASTAL_DOCKS_TIER_NAMES[tier|0]||('Tier '+(tier|0));
}

function getCoastalDocksUpgradeCost(tier){
  return COASTAL_DOCKS_UPGRADE_COSTS[tier|0]||[];
}

function isCoastalDocksComplete(cfg){
  return !!(cfg?.complete||(cfg?.logs|0)>=COASTAL_DOCKS_LOGS_BUILD);
}
