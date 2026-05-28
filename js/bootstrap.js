/* Hearthstead — bootstrap */
'use strict';

/* ═══════════════════════════════════════
   INIT
═══════════════════════════════════════ */
(function generateStars(){
  function addStars(container, count, inSkyOnly){
    if(!container) return;
    for(let i=0;i<count;i++){
      const el=document.createElement('div');
      el.className=(container.id==='world-stars'?'world-star':'star')+(Math.random()<0.18?' neb':'');
      const sz=Math.random()*2.2+0.5;
      const top=inSkyOnly ? Math.random()*92 : Math.random()*100;
      el.style.cssText='width:'+sz+'px;height:'+sz+'px;top:'+top+'%;left:'+(Math.random()*100)+'%;animation-delay:'+(Math.random()*2.5)+'s;animation-duration:'+(1.8+Math.random()*2.2)+'s;';
      container.appendChild(el);
    }
  }
  addStars(document.getElementById('stars-container'), 80, false);
  addStars(document.getElementById('world-stars'), 55, true);
})();

function bootStep(label, fn){
  try{
    fn();
  }catch(err){
    console.error('[Hearthstead] Boot step failed ('+label+'):', err);
  }
}

function resetTransientUiState(){
  plotSuppressClick=false;
  plotPanDrag=null;
  if(typeof closeStoreOverlay==='function') closeStoreOverlay();
  if(typeof closeFireplaceOverlay==='function') closeFireplaceOverlay();
  if(typeof closeSpinningWheelOverlay==='function') closeSpinningWheelOverlay();
  if(typeof closeApothecaryOverlay==='function') closeApothecaryOverlay();
  if(typeof closeFurnitureOverlay==='function') closeFurnitureOverlay();
  if(typeof closeInteriorBuildMenu==='function') closeInteriorBuildMenu();
  if(typeof closePlotAddMenu==='function') closePlotAddMenu();
}

bootStep('loadGameState', loadGameState);
resetTransientUiState();
bootStep('initPlotGrid', initPlotGrid);
bootStep('initInteriorGrid', initInteriorGrid);
bootStep('initSkillsScreen', initSkillsScreen);
bootStep('initSkillPillTips', initSkillPillTips);
bootStep('initOverlayDismiss', initOverlayDismiss);
bootStep('startPetPassiveLoop', startPetPassiveLoop);

if(state.gameStarted){
  bootStep('showScreen', ()=>{
    showScreen('exterior-screen');
    lastHome='exterior-screen';
  });
}

bootStep('syncUI', syncUI);
window.addEventListener('beforeunload', saveGameState);
