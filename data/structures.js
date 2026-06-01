/* Hearthstead — structures (shared static data) */
'use strict';

const STRUCTURE_FIRST_COMPLETE_XP_MULT = 1000;

/**
 * One-off Architecture XP per structure milestone (account-wide).
 * bonusKey must be unique; typeId sets XP via archUnlockLevel on the plot tile.
 */
const STRUCTURE_COMPLETE_BONUS = {
  well: { typeId: 'well', label: 'Well (bucketless)', icon: '🪣', milestone: 'Bucketless well built' },
  well_equipped: { typeId: 'well_finished', label: 'Well (dry)', icon: '🪣', milestone: 'Well equipped' },
  well_hydrated: { typeId: 'well_hydrated', label: 'Well', icon: '💧', milestone: 'Well hydrated' },
  fire_pit: { typeId: 'fire_pit', label: 'Fire Pit', icon: '🔥', milestone: 'Fire pit built' },
  kiln: { typeId: 'simple_kiln', label: 'Simple Kiln', icon: '🏺', milestone: 'Kiln fired' },
  kiln_moulded: { typeId: 'simple_kiln', label: 'Simple Kiln', icon: '🏺', milestone: 'Kiln moulded' },
  kiln_fueled: { typeId: 'simple_kiln', label: 'Simple Kiln', icon: '🏺', milestone: 'Kiln stocked' },
  kiln_lit: { typeId: 'simple_kiln', label: 'Simple Kiln', icon: '🔥', milestone: 'Kiln lit' },
  barn_walls: { typeId: 'small_barn_walls', label: 'Small Barn', icon: '🏚️', milestone: 'Barn walls raised' },
  barn_roof: { typeId: 'small_barn_doorless', label: 'Small Barn', icon: '🏚️', milestone: 'Barn roof laid' },
  barn: { typeId: 'small_barn_complete', label: 'Small Barn', icon: '🏚️', milestone: 'Small barn built' },
  medium_barn: { typeId: 'medium_barn_complete', label: 'Medium Barn', icon: '🏛️', milestone: 'Medium barn built' },
  large_barn: { typeId: 'large_barn_complete', label: 'Large Barn', icon: '🏛️', milestone: 'Large barn built' },
  washing_line_frame: { typeId: 'washing_line', label: 'Washing Line', icon: '🪵', milestone: 'Washing line frame raised' },
  washing_line: { typeId: 'washing_line', label: 'Washing Line', icon: '🧺', milestone: 'Washing line threaded' },
  washing_line_improved: { typeId: 'improved_washing_line', label: 'Washing Line', icon: '🧺', milestone: 'Washing line upgraded' },
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

function markStructureStageBonusGranted(bonusKey){
  if(!state._structureBonusXpGranted) state._structureBonusXpGranted={};
  state._structureBonusXpGranted[bonusKey]=true;
  if(!state._structureCompleteBonuses) state._structureCompleteBonuses={};
  state._structureCompleteBonuses[bonusKey]=true;
}

function isStructureStageBonusPending(bonusKey){
  if(!STRUCTURE_COMPLETE_BONUS[bonusKey]) return false;
  if(!state._structureBonusXpGranted) state._structureBonusXpGranted={};
  return !state._structureBonusXpGranted[bonusKey];
}

function migrateStructureStageBonusFlags(){
  if(state._structureStageBonusFlagsMigrated) return;
  state._structureStageBonusFlagsMigrated=true;
  if(!state._structureCompleteBonuses) state._structureCompleteBonuses={};
  if(state.wellFinishedUnlocked) state._structureCompleteBonuses.well_equipped=true;
  if(state.wellHydratedUnlocked) state._structureCompleteBonuses.well_hydrated=true;
  if(state.barnWallsUnlocked) state._structureCompleteBonuses.barn_walls=true;
  if(state.barnDoorlessUnlocked) state._structureCompleteBonuses.barn_roof=true;
  if(state.kilnLitUnlocked){
    state._structureCompleteBonuses.kiln_moulded=true;
    state._structureCompleteBonuses.kiln_fueled=true;
    state._structureCompleteBonuses.kiln_lit=true;
  }
  if(state.mediumBarnUnlocked) state._structureCompleteBonuses.medium_barn=true;
  if(state.washingLineFrameUnlocked) state._structureCompleteBonuses.washing_line_frame=true;
}

function migrateStructureCompleteBonuses(){
  if(!state._structureCompleteBonuses) state._structureCompleteBonuses={};
  if(!state._structureBonusXpGranted) state._structureBonusXpGranted={};
  if(state._structureCompleteBonusMigrated){
    migrateStructureStageBonusFlags();
    return;
  }
  state._structureCompleteBonusMigrated=true;
  if(state.wellUnlocked) state._structureCompleteBonuses.well=true;
  if(state.firePitUnlocked) state._structureCompleteBonuses.fire_pit=true;
  if(state.kilnUnlocked) state._structureCompleteBonuses.kiln=true;
  if(state.barnUnlocked) state._structureCompleteBonuses.barn=true;
  migrateStructureStageBonusFlags();
}

/** Old migration marked barn stage bonuses as granted without awarding XP (banner skipped by cfg.framed). */
function unreconcileFalseBarnStageBonusFlags(){
  if(state._barnStageBonusFlagsUnmarked) return;
  state._barnStageBonusFlagsUnmarked=true;
  const pairs=[['barn_walls','barnWallsUnlocked'],['barn_roof','barnDoorlessUnlocked']];
  for(const [bonusKey,unlockKey] of pairs){
    if(!state[unlockKey]) continue;
    if(!state._structureBonusXpGranted?.[bonusKey]) continue;
    delete state._structureBonusXpGranted[bonusKey];
    if(state._structureCompleteBonuses) state._structureCompleteBonuses[bonusKey]=false;
  }
}

/** Backfill first-build bonuses missed by earlier bugs (flag set without XP grant). */
function reconcileMissedStructureBonuses(){
  if(!state._structureBonusXpGranted) state._structureBonusXpGranted={};
  unreconcileFalseBarnStageBonusFlags();
  const unlockMap={
    well:'wellUnlocked',
    well_equipped:'wellFinishedUnlocked',
    well_hydrated:'wellHydratedUnlocked',
    fire_pit:'firePitUnlocked',
    kiln:'kilnUnlocked',
    kiln_lit:'kilnLitUnlocked',
    barn_walls:'barnWallsUnlocked',
    barn_roof:'barnDoorlessUnlocked',
    barn:'barnUnlocked',
    medium_barn:'mediumBarnUnlocked',
    large_barn:'largeBarnUnlocked',
    washing_line_frame:'washingLineFrameUnlocked',
    washing_line:'washingLineUnlocked',
    washing_line_improved:'washingLineImprovedUnlocked',
  };
  for(const bonusKey of Object.keys(unlockMap)){
    const unlockKey=unlockMap[bonusKey];
    if(!state[unlockKey]) continue;
    if(state._structureBonusXpGranted[bonusKey]) continue;
    if(state._structureCompleteBonuses?.[bonusKey]) state._structureCompleteBonuses[bonusKey]=false;
    const xp=tryGrantStructureCompleteBonus(bonusKey);
    if(xp>0){
      setTimeout(()=>{
        if(typeof displayStructureBonusBanner==='function'){
          displayStructureBonusBanner(xp, bonusKey, ()=>{
            if(typeof flushLevelUpQueue==='function') flushLevelUpQueue();
            if(typeof markDirty==='function'&&typeof flushDirty==='function'){
              markDirty('skills','meta');
              flushDirty();
            }else if(typeof syncUI==='function') syncUI();
          });
        }
      }, 900);
    }
  }
}

/** Grant one-time Architecture bonus for a structure milestone. Returns XP granted, or 0. */
function tryGrantStructureCompleteBonus(bonusKey){
  const meta=STRUCTURE_COMPLETE_BONUS[bonusKey];
  if(!meta) return 0;
  if(!state._structureBonusXpGranted) state._structureBonusXpGranted={};
  if(state._structureBonusXpGranted[bonusKey]) return 0;
  const xp=structureFirstCompleteBonusXp(meta.typeId);
  if(xp<1) return 0;
  state._structureBonusXpGranted[bonusKey]=true;
  if(!state._structureCompleteBonuses) state._structureCompleteBonuses={};
  state._structureCompleteBonuses[bonusKey]=true;
  if(typeof requestSaveGame==='function') requestSaveGame({ immediate:true });
  else if(typeof scheduleSaveGame==='function') scheduleSaveGame();
  if(typeof grantXP==='function') grantXP('architecture', xp, null, { deferLevelUp:true });
  return xp;
}

function structureCompleteBonusBlockHtml(xp, bonusKey){
  if(!xp||xp<1) return '';
  const meta=STRUCTURE_COMPLETE_BONUS[bonusKey];
  const label=meta?.label||'Structure';
  const milestone=meta?.milestone||'Milestone';
  return '<div class="structure-bonus-reward">'
    +'<div class="structure-bonus-kicker">'+milestone+'</div>'
    +'<div class="structure-bonus-amount">+'+xp.toLocaleString()+'</div>'
    +'<div class="structure-bonus-skill">🏗️ Architecture XP · '+label+'</div>'
    +'</div>';
}

/** @deprecated Use showStructureBuiltBanner — kept for any stray callers. */
function structureCompleteBonusBannerSuffix(bonusKey){
  const xp=tryGrantStructureCompleteBonus(bonusKey);
  return xp?(' +'+xp+' bonus Architecture XP!'):'';
}
