/* Hearthstead — shared plot activity sparkle helpers */
'use strict';

function restartActivitySparkles(cell, layerSelector, sparkleSelector){
  const layer=cell.querySelector(layerSelector);
  if(!layer) return;
  layer.querySelectorAll(sparkleSelector).forEach(el=>{
    el.style.animation='none';
    void el.offsetWidth;
    el.style.removeProperty('animation');
  });
}

function restartGatherSparkles(cell){
  restartActivitySparkles(cell, '.gather-sparkles', '.gather-sparkle');
}

function restartMineSparkles(cell){
  restartActivitySparkles(cell, '.mine-sparkles', '.mine-sparkle');
}
