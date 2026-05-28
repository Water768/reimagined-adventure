/* Hearthstead — water (static data) */
'use strict';

const WATER_BODY_TYPES={
  pond:{name:'Pond',fish:['goldfish','frog'],successRate:0.5,xpCatch:8,xpMiss:2},
  large_pond:{name:'Large Pond',fish:['minnow','koi'],successRate:0.45,xpCatch:10,xpMiss:2},
  river:{name:'River',fish:['trout','salmon'],successRate:0.4,xpCatch:12,xpMiss:3},
  lake:{name:'Lake',fish:['perch','pike'],successRate:0.35,xpCatch:14,xpMiss:3},
  large_lake:{name:'Large Lake',fish:['catfish','sturgeon'],successRate:0.3,xpCatch:16,xpMiss:3},
  ocean:{name:'Ocean',fish:['sardine','mackerel','anchovy','jellyfish','crab','clownfish','seaweed','tuna','swordfish','shark','octopus','lobster','pufferfish','sea_turtle'],successRate:0.25,xpCatch:18,xpMiss:4},
};