/* Hearthstead — structures (shared static data) */
'use strict';

function structureMaterialUnlockLevel(resourceKey){
  const mine=MINE_RESOURCE_DEFS?.[resourceKey];
  if(mine?.unlockLevel!=null) return mine.unlockLevel|0;
  return 1;
}

function structureArchXpForMaterial(resourceKey){
  return Math.max(0, structureMaterialUnlockLevel(resourceKey)) * 2;
}
