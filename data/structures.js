/* Hearthstead — structures (shared static data) */
'use strict';

const STRUCTURE_FIRST_COMPLETE_XP_MULT = 1000;

/** Plot structure keys for one-off first-build Architecture bonuses. */
const STRUCTURE_COMPLETE_BONUS = {
  well: { typeId: 'well', label: 'Well', icon: '🪣' },
  fire_pit: { typeId: 'fire_pit', label: 'Fire Pit', icon: '🔥' },
  kiln: { typeId: 'simple_kiln', label: 'Simple Kiln', icon: '🏺' },
};

function structureMaterialUnlockLevel(resourceKey){
  const mine=MINE_RESOURCE_DEFS?.[resourceKey];
  if(mine?.unlockLevel!=null) return mine.unlockLevel|0;
  return 1;
}

function structureArchXpForMaterial(resourceKey){
  return Math.max(0, structureMaterialUnlockLevel(resourceKey)) * 2;
}

function getStructureArchUnlockLevel(typeId){
  const def=PLOT_TILE_BASE?.[typeId];
  const lvl=Number(def?.archUnlockLevel);
  return lvl>0?lvl:1;
}

function structureFirstCompleteBonusXp(typeId){
  return getStructureArchUnlockLevel(typeId)*STRUCTURE_FIRST_COMPLETE_XP_MULT;
}

function migrateStructureCompleteBonuses(){
  if(!state._structureCompleteBonuses) state._structureCompleteBonuses={};
  if(state._structureCompleteBonusMigrated) return;
  state._structureCompleteBonusMigrated=true;
  if(state.wellUnlocked) state._structureCompleteBonuses.well=true;
  if(state.firePitUnlocked) state._structureCompleteBonuses.fire_pit=true;
  if(state.kilnUnlocked) state._structureCompleteBonuses.kiln=true;
}

/** Grant first-time Architecture bonus for finishing a structure build. Returns XP granted, or 0. */
function tryGrantStructureCompleteBonus(bonusKey){
  const meta=STRUCTURE_COMPLETE_BONUS[bonusKey];
  if(!meta) return 0;
  migrateStructureCompleteBonuses();
  if(state._structureCompleteBonuses[bonusKey]) return 0;
  const xp=structureFirstCompleteBonusXp(meta.typeId);
  if(xp<1) return 0;
  state._structureCompleteBonuses[bonusKey]=true;
  if(typeof scheduleSaveGame==='function') scheduleSaveGame();
  if(typeof grantXP==='function') grantXP('architecture', xp, null, { deferLevelUp:true });
  return xp;
}

function structureCompleteBonusBannerSuffix(bonusKey){
  const xp=tryGrantStructureCompleteBonus(bonusKey);
  return xp?(' +'+xp+' bonus Architecture XP!'):'';
}
