/* Hearthstead — well (static data) */
'use strict';

const WELL_BRICKS_REQUIRED = 50;
const WELL_DISPLAY_NAME = 'Well (bucketless)';
const WELL_DISPLAY_LABEL = 'well (bucketless)';
const WELL_COMPLETE_NAME = 'Well';
const WELL_COMPLETE_LABEL = 'well';

const WELL_ITEM_DEFS = {
  rope:   { key:'rope',   icon:'⛓️', name:'Rope',   vibe:'Strong cord for drawing water from a well.' },
  bucket: { key:'bucket', icon:'🪣', name:'Bucket', vibe:'A bucket to haul water up from the depths.' },
};

function getWellArchXpPerBrick(){
  return structureArchXpForMaterial('brick');
}

function getWellStage(cfg){
  if(!cfg) return 'building';
  if(cfg.equipped) return 'equipped';
  if(cfg.bucketless||cfg.bricks>=WELL_BRICKS_REQUIRED) return 'bucketless';
  return 'building';
}

function getWellVisualState(cfg){
  const stage=getWellStage(cfg);
  const n=Math.min(WELL_BRICKS_REQUIRED, Math.max(0, cfg?.bricks|0));
  if(stage==='equipped'){
    return { icon:'🪣', label:WELL_COMPLETE_LABEL, stage:'equipped' };
  }
  if(stage==='bucketless'){
    return { icon:'🪣', label:WELL_DISPLAY_LABEL, stage:'bucketless' };
  }
  if(n>=30) return { icon:'🧱', label:n+'/'+WELL_BRICKS_REQUIRED, stage:'stage-3' };
  if(n>=10) return { icon:'🧱', label:n+'/'+WELL_BRICKS_REQUIRED, stage:'stage-2' };
  return { icon:'▫️', label:n+'/'+WELL_BRICKS_REQUIRED, stage:'stage-1' };
}
