/* Hearthstead — sync ui */
'use strict';

/* ═══════════════════════════════════════
   SYNC UI
═══════════════════════════════════════ */
function ensureSkillsScreenReady(){
  const body=document.getElementById('skills-body');
  if(!body||body.querySelector('.skill-row')) return;
  if(typeof fillMissingSkillKeys!=='function'||typeof renderSkillsBody!=='function') return;
  try{
    fillMissingSkillKeys();
    renderSkillsBody();
  }catch(err){
    console.error('[Hearthstead] Skills screen init failed:', err);
  }
}

function ensurePlotRenderComplete(){
  if(typeof plotHasOccupiedCells!=='function'||typeof renderPlotGrid!=='function') return;
  if(!plotHasOccupiedCells()) return;
  const rendered=document.querySelectorAll('#plot-grid .plot-cell.cell-placed').length;
  const occupied=Object.values(state.plot?.cells||{}).filter(Boolean).length;
  if(occupied>0&&rendered<occupied){
    plotNeedsHomeCenter=true;
    renderPlotGrid();
  }
}

const SCREEN_SKILL_RESOLVERS={
  'workbench-screen':()=>RECIPES[craft.recipeKey]?.skill||'carpentry',
  'fishing-screen':()=>'fishing',
  'gathering-screen':()=>'foraging',
  'woodcutting-screen':()=>'woodcut',
  'mining-screen':()=>'mining',
  'exploring-screen':()=>'exploration',
  'fire-pit-screen':()=>typeof getFirePitActivitySkillKey==='function'?getFirePitActivitySkillKey():'cooking',
  'fireplace-screen':()=>'cooking',
  'spinningwheel-screen':()=>'tailoring',
  'loom-screen':()=>'tailoring',
  'botany-table-screen':()=>typeof getApothecaryActivitySkillKey==='function'?getApothecaryActivitySkillKey():'botany',
  'pets-screen':()=>'husbandry',
};

const SCREEN_SKILL_PREFIX={
  'workbench-screen':'wb',
  'fishing-screen':'fish',
  'gathering-screen':'gather',
  'woodcutting-screen':'wc',
  'mining-screen':'mine',
  'exploring-screen':'explore',
  'fire-pit-screen':'firepit',
  'fireplace-screen':'fp',
  'spinningwheel-screen':'sw',
  'loom-screen':'loom',
  'botany-table-screen':'botany',
  'pets-screen':'pets',
};

function updateActivitySkillDisplays(){
  reconcileActivityState();
  const skillKey=getActiveActivitySkillKey();
  const screenResolver=SCREEN_SKILL_RESOLVERS[currentScreen];
  const screenPrefix=SCREEN_SKILL_PREFIX[currentScreen];
  if(screenResolver&&screenPrefix&&typeof updateActivitySkillPill==='function'){
    updateActivitySkillPill(screenPrefix, screenResolver());
  }

  const extPill=document.getElementById('ext-skill-pill');
  const intPill=document.getElementById('int-skill-pill');

  if(skillFlashKey){
    if(currentScreen==='interior-screen'&&intPill){
      setContextSkillPillVisible(intPill, true);
      updateActivitySkillPill('int', skillFlashKey);
      setContextSkillPillVisible(extPill, false);
      return;
    }
    if(currentScreen==='exterior-screen'&&extPill){
      setContextSkillPillVisible(extPill, true);
      updateActivitySkillPill('ext', skillFlashKey);
      setContextSkillPillVisible(intPill, false);
      return;
    }
  }

  const showExt=currentScreen==='exterior-screen'&&!!skillKey&&(
    (activity.type==='fishing'&&fish.running)||
    (activity.type==='gathering'&&gather.running)||
    (activity.type==='woodcutting'&&!!wc.treeInstanceId)||
    (activity.type==='mining'&&mine.running)||
    (activity.type==='exploring'&&explore.running)
  );
  const showInt=currentScreen==='interior-screen'&&!!skillKey&&(
    (activity.type==='cooking'&&cook.running)||
    (activity.type==='spinning'&&spin.running)||
    (activity.type==='loom'&&loomProcess.running)||
    (activity.type==='apothecary'&&apothProcess.running)
  );
  setContextSkillPillVisible(extPill, showExt);
  if(showExt) updateActivitySkillPill('ext', skillKey);
  setContextSkillPillVisible(intPill, showInt);
  if(showInt) updateActivitySkillPill('int', skillKey);
}

const INV_COUNT_PILL_IDS=[
  'inv-count-ext','inv-count-int','inv-count-wb','inv-count-sk','inv-count-store',
  'inv-count-fish','inv-count-gather','inv-count-wc','inv-count-mine','inv-count-explore',
  'inv-count-fp','inv-count-sw','inv-count-loom','inv-count-botany','inv-count-pets','inv-count-well','inv-count-firepit',
];

function updateInvCountPills(){
  const used=invTotal();
  INV_COUNT_PILL_IDS.forEach(id=>{
    const e=document.getElementById(id);
    if(e) e.textContent=used;
  });
}

function syncInventoryUI(){
  updateInvCountPills();
  if(openPanel==='inv'){
    const stamp=getInvPanelRenderStamp();
    if(stamp!==invPanelRenderStamp) renderInvPanel();
  }
}

function syncUI(){
  reconcileActivityState();
  if(state._skipStoreRoomMigrateOnce){
    delete state._skipStoreRoomMigrateOnce;
  }
  if(state._storeRoomsReclaimed){
    const n=state._storeRoomsReclaimed;
    delete state._storeRoomsReclaimed;
    if(currentScreen==='interior-screen'&&!state._skipStoreRoomReclaimRender) renderInteriorGrid();
    delete state._skipStoreRoomReclaimRender;
    setTimeout(()=>showToast('🗄️ '+n+' missing store room'+(n===1?' was':'s were')+' restored to your map.'),300);
  }
  if(state._storeRoomsOrphansRemoved){
    const n=state._storeRoomsOrphansRemoved;
    delete state._storeRoomsOrphansRemoved;
    setTimeout(()=>showToast('🗄️ '+n+' store room'+(n===1?'':'s')+' had no space on the map — ghost capacity removed.'),600);
  }
  syncInventoryUI();
  ['gold-ext','gold-int','gold-wb','gold-sk','gold-store','gold-fish','gold-gather','gold-wc','gold-mine','gold-explore','gold-fp','gold-sw','gold-loom','gold-botany','gold-pets','gold-well','gold-firepit'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=state.gold;});
  document.querySelectorAll('.stat-pill-gold').forEach(el=>el.classList.toggle('visible',state.gold>0));
  document.querySelectorAll('.int-cell[data-int-key="fireplace"]').forEach(el=>el.classList.toggle('fireplace-cooking',cook.running));
  document.querySelectorAll('.int-cell[data-int-key="spinningwheel"]').forEach(el=>el.classList.toggle('spinning-wheel-active',spin.running));
  document.querySelectorAll('.int-cell[data-int-key="apothecary_table"]').forEach(el=>el.classList.toggle('apothecary-processing',apothProcess.running));
  document.querySelectorAll('.int-cell[data-int-key="wonky_loom"]').forEach(el=>el.classList.toggle('wonky-loom-weaving',loomProcess.running));
  updatePondCell();
  updateGatherCells();
  updateQuarryCells();
  updateFireplaceCell();
  if(typeof updateFirePitCellQuickAction==='function') updateFirePitCellQuickAction();
  updateSpinningWheelCell();
  if(typeof updateApothecaryCellQuickAction==='function') updateApothecaryCellQuickAction();
  if(typeof updateLoomCellQuickAction==='function') updateLoomCellQuickAction();
  updateDogbedCell();
  if(currentScreen==='pets-screen') renderPetsScreen(viewingPetId);
  if(currentScreen==='exploring-screen') renderExploring();
  if(currentScreen==='skills-screen'&&viewingSkillKey) renderSkillDetail(viewingSkillKey);
  updateActivitySkillDisplays();
  const eqLabel = state.equipped ? state.equipped.icon : '—';
  ['equip-val-ext','equip-val-int','equip-val-wb'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=eqLabel;});
  Object.keys(state.skills).forEach(key=>{
    const s=state.skills[key],pct=Math.min((s.xp/s.xpToNext)*100,100);
    const bar=document.getElementById('sk-bar-'+key);
    const lvl=document.getElementById('sk-lvl-'+key);
    const txt=document.getElementById('sk-txt-'+key);
    if(bar)bar.style.width=pct+'%';
    if(lvl)lvl.textContent='Lvl '+s.level;
    if(txt)txt.textContent=s.xp+' / '+s.xpToNext+' xp';
  });
  updateSaveButtonUI();
  ensureSkillsScreenReady();
  ensurePlotRenderComplete();
  scheduleSaveGame();
}
