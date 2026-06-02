/* Hearthstead — Fairy Grove fawn comfort */
'use strict';

function ensureFawnComfortState() {
  if (typeof state.fawnFriendship === 'number' && !Number.isNaN(state.fawnFriendship)) {
    if (typeof state.fawnComfort !== 'number' || Number.isNaN(state.fawnComfort)) {
      state.fawnComfort = state.fawnFriendship;
    }
    delete state.fawnFriendship;
  }
  if (typeof state.fawnComfort !== 'number' || Number.isNaN(state.fawnComfort)) {
    state.fawnComfort = 0;
  }
  if (state.fawnFeedCooldownUntil == null) state.fawnFeedCooldownUntil = 0;
}

function getFawnComfortPct() {
  ensureFawnComfortState();
  return Math.min(FAWN_COMFORT_MAX, Math.max(0, state.fawnComfort));
}

function isFawnFeedOnCooldown() {
  ensureFawnComfortState();
  return Date.now() < (state.fawnFeedCooldownUntil || 0);
}

function fawnFeedCooldownRemainingMs() {
  ensureFawnComfortState();
  return Math.max(0, (state.fawnFeedCooldownUntil || 0) - Date.now());
}

function feedFawnWildBerry() {
  ensureFawnComfortState();
  if (getFawnComfortPct() >= FAWN_COMFORT_MAX) {
    showToast('The fawns are already fully comfortable here.');
    if (currentScreen === 'gathering-screen') renderGatherFawnPanel();
    return { ok: false };
  }
  if (isFawnFeedOnCooldown()) {
    showToast('The fawn is still nibbling — wait a moment before feeding again.');
    if (currentScreen === 'gathering-screen') renderGatherFawnPanel();
    return { ok: false };
  }
  if (typeof itemCountBagAndStore !== 'function' || itemCountBagAndStore(FAWN_FEED_BERRY_KEY) < 1) {
    showToast('You need a wild berry to feed the fawn.');
    if (currentScreen === 'gathering-screen') renderGatherFawnPanel();
    return { ok: false };
  }
  if (!consumeOneFromBagOrStore(FAWN_FEED_BERRY_KEY)) {
    showToast('Could not take a wild berry.');
    return { ok: false };
  }
  state.fawnComfort = Math.min(
    FAWN_COMFORT_MAX,
    getFawnComfortPct() + FAWN_COMFORT_FEED_PCT
  );
  state.fawnFeedCooldownUntil = Date.now() + FAWN_FEED_COOLDOWN_MS;
  if (state.fawnComfort >= FAWN_COMFORT_MAX && !state.mossyBarnBlueprintsUnlocked) {
    state.mossyBarnBlueprintsUnlocked = true;
    showToast('The fawns settle in — mossy barn blueprints await at the large barn.');
  } else {
    showToast('The fawn happily munches the berry.');
  }
  if (typeof scheduleSaveGame === 'function') scheduleSaveGame();
  if (currentScreen === 'gathering-screen') renderGatherFawnPanel();
  syncUI();
  return { ok: true };
}

function renderGatherFawnPanel() {
  const panel = document.getElementById('gather-fawn-panel');
  if (!panel) return;
  const loc =
    typeof getCurrentGatheringLocation === 'function' ? getCurrentGatheringLocation() : null;
  if (!loc || loc.key !== 'fairy_grove') {
    panel.innerHTML = '';
    panel.style.display = 'none';
    return;
  }
  ensureFawnComfortState();
  const pct = getFawnComfortPct();
  const barW = Math.round((pct / FAWN_COMFORT_MAX) * 100);
  const onCd = isFawnFeedOnCooldown();
  const berries =
    typeof itemCountBagAndStore === 'function' ? itemCountBagAndStore(FAWN_FEED_BERRY_KEY) : 0;
  const full = pct >= FAWN_COMFORT_MAX;
  const canFeed = !full && !onCd && berries > 0;
  panel.style.display = 'block';
  panel.innerHTML =
    '<div class="gather-fawn-block">'
    + '<div class="gather-fawn-title">🦌 Woodland fawns</div>'
    + '<p class="gather-fawn-blurb">Woodland fawns are roaming the area. They are becoming increasingly comfortable with your presence.</p>'
    + '<div class="gather-fawn-comfort-label">Comfort level</div>'
    + '<div class="gather-fawn-bar-wrap" aria-hidden="true">'
    + '<div class="gather-fawn-bar-fill" style="width:' + barW + '%"></div>'
    + '</div>'
    + '<button type="button" class="wb-btn once gather-fawn-feed-btn" '
    + (canFeed ? '' : 'disabled ')
    + 'onclick="feedFawnWildBerry()">'
    + 'Feed wild berry'
    + '<span class="wb-btn-sub">'
    + (full
      ? 'Fully comfortable'
      : onCd
        ? 'Resting after a snack'
        : berries < 1
          ? 'Need wild berries in bag or storage'
          : 'Raises comfort · 2 min cooldown')
    + '</span></button>'
    + '</div>';
}

function migrateFairyGrovePlotTiles() {
  if (state.plot?.featureUnlocks?.gather_fae_grove) {
    state.plot.featureUnlocks.gather_fairy_grove = true;
    delete state.plot.featureUnlocks.gather_fae_grove;
  }
  if (!state.plot?.cells) return;
  Object.keys(state.plot.cells).forEach((ck) => {
    const cell = state.plot.cells[ck];
    if (!cell) return;
    if (cell.typeId === 'gather_fae_grove') cell.typeId = 'gather_fairy_grove';
  });
}

function migrateFawnComfortState() {
  ensureFawnComfortState();
  if (typeof migrateFairyGrovePlotTiles === 'function') migrateFairyGrovePlotTiles();
  const eq = state.equipped;
  if (eq && !eq.slot) {
    const def = typeof EQUIPPABLE !== 'undefined' ? EQUIPPABLE[eq.key] : null;
    eq.slot = def?.slot || 'body';
  }
}

/** @deprecated use migrateFawnComfortState */
function migrateFawnFriendshipState() {
  migrateFawnComfortState();
}
