/* Hearthstead — afternoon foraging drop mechanics */
'use strict';

const SUNKEN_LOCKBOX_FAIL_MSG =
  "You see a sunken lockbox but it's just out of reach! If only you had some better waders....";

function hasSlickGripWadersEquipped() {
  return state.equipped?.key === 'slick_grip_waders';
}

function storageHasItem(key) {
  return typeof storageCount === 'function' ? storageCount(key) > 0 : false;
}

function applyFawnComfortOnMushroomHarvest(loc) {
  if (!loc || loc.key !== 'fairy_grove') return;
  if (typeof ensureFawnComfortState === 'function') ensureFawnComfortState();
  const before = state.fawnComfort;
  state.fawnComfort = Math.min(
    FAWN_COMFORT_MAX,
    before + FAWN_COMFORT_MUSHROOM_PCT
  );
  if (state.fawnComfort >= FAWN_COMFORT_MAX && !state.mossyBarnBlueprintsUnlocked) {
    state.mossyBarnBlueprintsUnlocked = true;
    showToast('The fawns settle in — mossy barn blueprints await at the large barn.');
  }
}

/**
 * After a successful roll, decide whether the find is kept and any player message.
 * @returns {{ keep: boolean, message?: string, logKind?: string }}
 */
function resolveGatherAfternoonDrop(loc, loot) {
  if (!loc || !loot?.key) return { keep: true };

  const storageKey = GATHER_DROP_REQUIRES_STORAGE[loot.key];
  if (storageKey && !storageHasItem(storageKey)) {
    const vessel =
      loot.key === 'fairy_dust'
        ? 'an empty glass jar in storage'
        : 'a vial of water in storage';
    return {
      keep: false,
      message:
        loot.icon +
        ' ' +
        loot.name +
        ' slips away — you need ' +
        vessel +
        ' to keep it.',
      logKind: 'fail',
    };
  }

  const special = GATHER_DROP_SPECIAL[loot.key];
  if (special === 'sunken_lockbox_reach') {
    if (hasSlickGripWadersEquipped()) return { keep: true };
    if (Math.random() < 0.75) {
      return { keep: false, message: SUNKEN_LOCKBOX_FAIL_MSG, logKind: 'fail' };
    }
    return { keep: true };
  }

  return { keep: true };
}

function checkGatherAfternoonHarvestAllowed(loc) {
  if (!loc) return { ok: true };
  if (!meetsGatheringUnlockRequirements(loc)) {
    return { ok: false, message: getGatheringUnlockBlockMessage(loc) };
  }
  if (!canHarvestAtGatheringLocation(loc)) {
    return { ok: false, message: getGatheringHarvestBlockMessage(loc) };
  }
  return { ok: true };
}
