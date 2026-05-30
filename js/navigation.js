/* Hearthstead — navigation */
'use strict';

/* ═══════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════ */
const ALL_SCREENS=['intro-screen','exterior-screen','interior-screen','skills-screen','workbench-screen','storeroom-screen','fishing-screen','gathering-screen','woodcutting-screen','mining-screen','exploring-screen','fireplace-screen','spinningwheel-screen','loom-screen','botany-table-screen','pets-screen','well-screen','fire-pit-screen','kiln-screen','farming-screen'];
const HUT_OVERLAY_SCREENS=new Set(['workbench-screen','storeroom-screen','fireplace-screen','spinningwheel-screen','loom-screen','botany-table-screen','pets-screen']);
const WORLD_OVERLAY_SCREENS=new Set(['fishing-screen','gathering-screen','woodcutting-screen','mining-screen','exploring-screen','well-screen','fire-pit-screen','kiln-screen','farming-screen']);
const OVERLAY_CLOSE_FN={
  'workbench-screen':()=>{ if(typeof closeWorkbench==='function') closeWorkbench(); },
  'storeroom-screen':()=>{ if(typeof closeStoreRoom==='function') closeStoreRoom(); },
  'fireplace-screen':()=>{ if(typeof closeFireplaceScreen==='function') closeFireplaceScreen(); },
  'spinningwheel-screen':()=>{ if(typeof closeSpinningWheelScreen==='function') closeSpinningWheelScreen(); },
  'loom-screen':()=>{ if(typeof closeLoomScreen==='function') closeLoomScreen(); },
  'botany-table-screen':()=>{ if(typeof closeBotanyTableScreen==='function') closeBotanyTableScreen(); },
  'pets-screen':()=>{ if(typeof closePetsScreen==='function') closePetsScreen(); },
  'fishing-screen':()=>{ if(typeof closeFishing==='function') closeFishing(); },
  'gathering-screen':()=>{ if(typeof closeGathering==='function') closeGathering(); },
  'woodcutting-screen':()=>{ if(typeof closeWoodcutting==='function') closeWoodcutting(); },
  'mining-screen':()=>{ if(typeof closeMining==='function') closeMining(); },
  'exploring-screen':()=>{ if(typeof closeExploring==='function') closeExploring(); },
  'well-screen':()=>{ if(typeof closeWellScreen==='function') closeWellScreen(); },
  'fire-pit-screen':()=>{ if(typeof closeFirePitScreen==='function') closeFirePitScreen(); },
  'kiln-screen':()=>{ if(typeof closeKilnScreen==='function') closeKilnScreen(); },
  'farming-screen':()=>{ if(typeof closeFarmScreen==='function') closeFarmScreen(); },
};
let currentScreen='intro-screen', lastHome='exterior-screen', skillsReturnScreen='exterior-screen';

function isActiveOverlayScreen(id){
  return HUT_OVERLAY_SCREENS.has(id)||WORLD_OVERLAY_SCREENS.has(id);
}

function isOverlayChromeOrPanelTarget(target){
  if(!target) return false;
  return !!(
    target.closest('.activity-panel')
    ||target.closest('.top-bar')
    ||target.closest('.top-nav')
    ||target.closest('.panel')
    ||target.closest('.found-banner')
    ||target.closest('#banner-dim')
    ||target.closest('.plot-add-menu')
    ||target.closest('#interior-build-menu')
  );
}

function dismissActiveOverlayScreen(){
  if(!isActiveOverlayScreen(currentScreen)) return false;
  if(typeof openPanel!=='undefined'&&openPanel){
    closeAllPanels();
    return true;
  }
  const closeFn=OVERLAY_CLOSE_FN[currentScreen];
  if(closeFn){ closeFn(); return true; }
  return false;
}

function handleOverlayScreenDismiss(e){
  if(!isActiveOverlayScreen(currentScreen)) return;
  if(isOverlayChromeOrPanelTarget(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  dismissActiveOverlayScreen();
}

function initOverlayDismiss(){
  [...HUT_OVERLAY_SCREENS, ...WORLD_OVERLAY_SCREENS].forEach(id=>{
    const el=document.getElementById(id);
    if(!el||el.dataset.overlayDismissBound) return;
    el.dataset.overlayDismissBound='1';
    el.addEventListener('pointerdown', handleOverlayScreenDismiss);
  });
}

function showScreen(id){
  dismissLevelUpBanners();
  skillFlashKey=null;
  clearTimeout(skillFlashTimer);
  skillFlashTimer=null;
  if(currentScreen==='farming-screen'&&id!=='farming-screen'&&typeof stopFarmTimer==='function') stopFarmTimer();
  if(document.activeElement?.blur) document.activeElement.blur();
  const hutOverlay=HUT_OVERLAY_SCREENS.has(id);
  const worldOverlay=WORLD_OVERLAY_SCREENS.has(id);
  ALL_SCREENS.forEach(s=>{
    const el=document.getElementById(s);
    if(!el) return;
    const isTarget=s===id;
    const keepInterior=hutOverlay&&s==='interior-screen';
    const keepExterior=worldOverlay&&s==='exterior-screen';
    el.classList.toggle('active', isTarget||keepInterior||keepExterior);
    el.classList.toggle('hut-overlay', hutOverlay&&isTarget);
    el.classList.toggle('world-overlay', worldOverlay&&isTarget);
    el.classList.toggle('under-overlay', keepInterior||keepExterior);
  });
  currentScreen=id;
  if(id!=='exterior-screen'){
    closePlotAddMenu();
    if(state.plot?.editMode){
      state.plot.editMode=false;
      updatePlotEditUI();
    }
  }
  if(id!=='interior-screen'&&state.interior?.buildMode){
    state.interior.buildMode=false;
    updateInteriorBuildUI();
  }
  const wb=document.getElementById('world-backdrop');
  if(wb){
    const world=id==='exterior-screen'||id==='interior-screen'||hutOverlay||worldOverlay;
    wb.classList.toggle('visible', world);
    wb.classList.toggle('interior', id==='interior-screen'||hutOverlay);
  }
  updateActivitySkillDisplays();
}
function startGame(){
  state.gameStarted=true;
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  updateSaveButtonUI();
  scheduleSaveGame();
  showToast("Welcome home. Such as it is. 🏡");
}
function enterHut(){
  reconcileActivityState();
  if(!cook.running) clearActivity('cooking');
  if(!spin.running) clearActivity('spinning');
  if(!loomProcess.running) clearActivity('loom');
  showScreen('interior-screen'); lastHome='interior-screen';
  interiorNeedsHomeCenter=true;
  requestAnimationFrame(()=>{
    if(interiorNeedsHomeCenter){
      interiorNeedsHomeCenter=false;
      recenterInteriorOnHome();
    }
  });
  if(!state._seenHut){state._seenHut=true;setTimeout(()=>showToast("Your new home. Cosy, if you squint. Poke around."),500);}
}
function exitHut(){ showScreen('exterior-screen'); lastHome='exterior-screen'; }
function navHome(){
  stopAllActivities();
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  syncUI();
}
function navTo(dest){
  closeAllPanels();
  if(dest==='skills'){
    if(currentScreen==='skills-screen'){
      if(viewingSkillKey){ closeSkillDetail(); return; }
      showScreen(skillsReturnScreen);
    }else{
      skillsReturnScreen=currentScreen;
      closeSkillDetail();
      showScreen('skills-screen');
    }
  }
  syncUI();
}

let viewingSkillKey=null;
let skillsViewMode='compact';

function fillMissingSkillKeys(){
  if(!state.skills) state.skills={};
  const defaults=getDefaultState().skills;
  Object.keys(state.skills).forEach(key=>{
    if(!defaults[key]) delete state.skills[key];
  });
  Object.keys(defaults).forEach(key=>{
    if(!state.skills[key]) state.skills[key]={...defaults[key]};
    const s=state.skills[key];
    if(!s.level||s.level<1) s.level=1;
    if(s.xp==null||s.xp<0) s.xp=0;
    s.xpToNext=xpForLevel(s.level);
  });
}

function pseudoClickEventFromEl(el){
  if(!el) return null;
  const r=el.getBoundingClientRect();
  return { clientX:r.left+r.width/2, clientY:r.top+r.height/2, touches:null };
}

function skillRowHtml(key){
  const m=SKILL_META[key];
  if(!m) return '';
  const s=state.skills[key];
  const xpTxt=s?(s.xp+' / '+s.xpToNext+' xp'):'0 / 100 xp';
  return '<div class="skill-row sk-'+key+'" data-skill="'+key+'" tabindex="0">'
    +'<span class="skill-row-icon">'+m.icon+'</span>'
    +'<div class="skill-row-body">'
    +'<div class="skill-row-top">'
    +'<span class="skill-row-name">'+m.name.toUpperCase()+'</span>'
    +'<span class="skill-row-level" id="sk-lvl-'+key+'">Lvl 1</span>'
    +'</div>'
    +'<div class="skill-row-bar"><div class="skill-row-fill sk-'+key+'" id="sk-bar-'+key+'" style="width:0%"></div></div>'
    +'<span class="skill-row-xp" id="sk-txt-'+key+'">'+xpTxt+'</span>'
    +'</div></div>';
}

function renderSkillsBody(){
  const body=document.getElementById('skills-body');
  if(!body) return;
  let html='';
  SKILL_CATEGORIES.forEach(cat=>{
    html+='<div class="skills-category" data-category="'+cat.id+'">'
      +'<div class="skills-group-title">'+cat.label.toUpperCase()+'</div>'
      +'<div class="skills-category-grid">';
    cat.skills.forEach(key=>{ html+=skillRowHtml(key); });
    html+='</div></div>';
  });
  html+='<button type="button" class="skills-view-toggle" id="skills-view-toggle" onclick="toggleSkillsView()">'
    +'<span class="skills-view-toggle-icon">☰</span> Full list</button>';
  body.innerHTML=html;
  body.classList.toggle('skills-view-list',skillsViewMode==='list');
  body.classList.toggle('skills-view-compact',skillsViewMode==='compact');
  updateSkillsViewToggleLabel();
  bindSkillRows();
  syncUI();
}

function updateSkillsViewToggleLabel(){
  const btn=document.getElementById('skills-view-toggle');
  if(!btn) return;
  btn.innerHTML=skillsViewMode==='compact'
    ?'<span class="skills-view-toggle-icon">☰</span> Full list'
    :'<span class="skills-view-toggle-icon">⊞</span> Compact grid';
}

function toggleSkillsView(){
  skillsViewMode=skillsViewMode==='compact'?'list':'compact';
  const body=document.getElementById('skills-body');
  if(!body) return;
  body.classList.toggle('skills-view-list',skillsViewMode==='list');
  body.classList.toggle('skills-view-compact',skillsViewMode==='compact');
  updateSkillsViewToggleLabel();
  scheduleSaveGame();
}

function bindSkillRows(){
  document.querySelectorAll('#skills-body .skill-row').forEach(row=>{
    const key=row.dataset.skill;
    if(!key) return;
    row.onclick=()=>openSkillDetail(key);
  });
}

function openSkillDetail(key){
  viewingSkillKey=key;
  const body=document.getElementById('skills-body');
  const panel=document.getElementById('skill-detail-panel');
  if(body) body.style.display='none';
  if(panel){ panel.style.display='block'; renderSkillDetail(key); }
}

function closeSkillDetail(){
  viewingSkillKey=null;
  const body=document.getElementById('skills-body');
  const panel=document.getElementById('skill-detail-panel');
  if(body) body.style.display='block';
  if(panel) panel.style.display='none';
}

function renderSkillDetail(key){
  const panel=document.getElementById('skill-detail-panel');
  const s=state.skills[key];
  const m=SKILL_META[key];
  if(!panel||!s||!m){ closeSkillDetail(); return; }
  const pct=Math.min((s.xp/s.xpToNext)*100,100);
  const lvlLabel='Lvl '+s.level;
  const totalXp=formatSkillXp(getTotalSkillXp(key));
  const note=m.blurb||('Train '+m.name.toLowerCase()+' through activities across Hearthstead.');
  panel.innerHTML=
    '<button type="button" class="skill-detail-back" onclick="closeSkillDetail()">◀ Skills</button>'
    +'<div class="skill-detail-header">'
    +'<span class="skill-detail-icon">'+m.icon+'</span>'
    +'<div><div class="skill-detail-title">'+m.name.toUpperCase()+'</div>'
    +'<div class="skill-detail-level">'+lvlLabel+' · '+totalXp+' xp total</div></div></div>'
    +'<div class="skill-detail-section">EXPERIENCE</div>'
    +'<div class="skill-detail-bar-wrap"><div class="skill-detail-bar-fill sk-'+key+'" style="width:'+pct+'%"></div></div>'
    +'<div class="skill-detail-xp">'+s.xp+' / '+s.xpToNext+' xp to next level</div>'
    +'<div class="skill-detail-section">OVERVIEW</div>'
    +'<div class="skill-detail-note">'+note+'</div>';
}

function initSkillsScreen(){
  fillMissingSkillKeys();
  renderSkillsBody();
}
