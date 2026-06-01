/* Hearthstead — world activity registration */
'use strict';

function registerWorldActivityRunners(){
  registerActivityRunner('fishing', {
    isRunning:()=>!!fish.running,
    stop:stopFishing,
    label:'Fishing',
  });
  registerActivityRunner('gathering', {
    isRunning:()=>!!gather.running,
    stop:stopGathering,
    label:'Gathering',
  });
  registerActivityRunner('mining', {
    isRunning:()=>!!mine.running,
    stop:stopMining,
    label:'Mining',
  });
  registerActivityRunner('woodcutting', {
    isRunning:()=>!!wc.treeInstanceId,
    stop:stopWoodcutting,
    label:'Woodcutting',
  });
}

registerWorldActivityRunners();
