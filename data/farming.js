/* Hearthstead — farming (static data) */
'use strict';

const FARM_GROWTH_MS=30*60*1000;
const FARM_BASE_YIELD=10;
const FARM_HARVEST_XP=8;

const FARM_SEED_BATCHES=[
  { qty:10, boostPct:0, label:'10 seeds', desc:'Standard yield' },
  { qty:20, boostPct:50, label:'20 seeds', desc:'+50% harvest' },
  { qty:30, boostPct:80, label:'30 seeds', desc:'+80% harvest' },
];

function getFarmSeedBatch(qty){
  return FARM_SEED_BATCHES.find(b=>b.qty===qty)||FARM_SEED_BATCHES[0];
}

function calcFarmHarvestYield(seedQty){
  const batch=getFarmSeedBatch(seedQty);
  return Math.max(1, Math.floor(FARM_BASE_YIELD*(1+batch.boostPct/100)));
}

function isFarmPlotGrowing(cfg){
  return !!(cfg?.plantedAt&&cfg?.cropKey);
}

function isFarmPlotReady(cfg){
  if(!isFarmPlotGrowing(cfg)) return false;
  return Date.now()-cfg.plantedAt>=FARM_GROWTH_MS;
}

function farmGrowthRemainingMs(cfg){
  if(!isFarmPlotGrowing(cfg)||isFarmPlotReady(cfg)) return 0;
  return Math.max(0, FARM_GROWTH_MS-(Date.now()-cfg.plantedAt));
}

function farmGrowthProgressPct(cfg){
  if(!isFarmPlotGrowing(cfg)) return 0;
  if(isFarmPlotReady(cfg)) return 100;
  const elapsed=Date.now()-cfg.plantedAt;
  return Math.min(100, Math.floor((elapsed/FARM_GROWTH_MS)*100));
}
