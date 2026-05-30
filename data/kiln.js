/* Hearthstead — simple kiln (static data) */
'use strict';

const KILN_ARCH_UNLOCK = 8;
const KILN_MOULD_IRON_REQUIRED = 10;
const KILN_FUEL_LOG_REQUIRED = 50;
const KILN_LIGHT_FIRE_LEVEL = 10;

const KILN_BUILD_MATERIALS = [
  { key:'stone', countKey:'stone', icon:'🪨', name:'Stone', required:50 },
  { key:'clay', countKey:'clay', icon:'🟤', name:'Clay', required:50 },
  { key:'brick', countKey:'bricks', icon:'🧱', name:'Brick', required:50 },
];

const KILN_FUEL_LOGS = [
  { key:'logs', countKey:'fuelLogs', icon:'🪵', name:'Log' },
  { key:'ashwood', countKey:'fuelAshwood', icon:'🪵', name:'Ashwood' },
  { key:'teak', countKey:'fuelTeak', icon:'🪵', name:'Teak' },
];

const KILN_DISPLAY_NAME = 'Simple Kiln';
const KILN_UNLIT_DISPLAY_NAME = 'Simple Kiln (unlit)';
const KILN_BUILDING_LABEL = 'simple kiln (building)';
const KILN_UNLIT_LABEL = 'simple kiln (unlit)';
const KILN_COMPLETE_LABEL = 'simple kiln';

const KILN_TABS = {
  clay:    { id:'clay',    label:'Clay',    actions:['fire_brick'] },
  melting: { id:'melting', label:'Melting', actions:['molten_glass'] },
  blow:    { id:'blow',    label:'Blow',    actions:['blow_vial','blow_bowl','blow_bottle'] },
};

const KILN_ACTIONS = {
  fire_brick: {
    id:'fire_brick',
    menu:'clay',
    label:'Fire brick',
    quickLabel:'fire brick',
    requiresMoulds:false,
    inputs:[{ key:'clay', count:2 }],
    outputs:[{ key:'brick', count:1, icon:'🧱', name:'Brick' }],
    xp:{ fire:12, architecture:2 },
    logOk:'Fired 2 clay into a brick.',
  },
  molten_glass: {
    id:'molten_glass',
    menu:'melting',
    label:'Melt glass',
    quickLabel:'melt glass',
    requiresMoulds:true,
    inputs:[{ key:'bucket_of_sand', count:1 }, { key:'limestone', count:1 }],
    outputs:[{ key:'molten_glass', count:1, icon:'🫙', name:'Molten Glass' }],
    xp:{ fire:10 },
    logOk:'Sand and limestone fuse into molten glass.',
  },
  blow_vial: {
    id:'blow_vial',
    menu:'blow',
    label:'Blow vial',
    quickLabel:'blow vial',
    requiresMoulds:true,
    glassblow:true,
    shardBonus:'air',
    inputs:[{ key:'molten_glass', count:1 }],
    skills:{ fire:10, air:10 },
    outputs:[{ key:'empty_vial', count:1, icon:'🧪', name:'Empty Vial' }],
    xp:{ fire:8 },
    logOk:'Shaped molten glass into an empty vial.',
  },
  blow_bowl: {
    id:'blow_bowl',
    menu:'blow',
    label:'Blow bowl',
    quickLabel:'blow bowl',
    requiresMoulds:true,
    glassblow:true,
    shardBonus:'air',
    inputs:[{ key:'molten_glass', count:1 }],
    skills:{ fire:15, air:15 },
    outputs:[{ key:'glass_bowl', count:1, icon:'🥣', name:'Glass Bowl' }],
    xp:{ fire:10 },
    logOk:'Shaped molten glass into a glass bowl.',
  },
  blow_bottle: {
    id:'blow_bottle',
    menu:'blow',
    label:'Blow bottle',
    quickLabel:'blow bottle',
    requiresMoulds:true,
    glassblow:true,
    shardBonus:'air',
    inputs:[{ key:'molten_glass', count:1 }],
    skills:{ fire:20, air:20 },
    outputs:[{ key:'glass_bottle', count:1, icon:'🍾', name:'Glass Bottle' }],
    xp:{ fire:12 },
    logOk:'Shaped molten glass into a glass bottle.',
  },
};

function getKilnArchXpForMaterial(materialKey){
  return structureArchXpForMaterial(materialKey);
}

function getKilnBuildMaterialDef(materialKey){
  return KILN_BUILD_MATERIALS.find(m=>m.key===materialKey)||null;
}

function getKilnFuelLogDef(logKey){
  return KILN_FUEL_LOGS.find(l=>l.key===logKey)||null;
}

function getKilnTotalBuildRequired(){
  return KILN_BUILD_MATERIALS.reduce((sum,m)=>sum+m.required, 0);
}

function getKilnTotalFuelRequired(){
  return KILN_FUEL_LOGS.length*KILN_FUEL_LOG_REQUIRED;
}

function isKilnBuildComplete(cfg){
  if(!cfg) return false;
  if(cfg.fired) return true;
  return KILN_BUILD_MATERIALS.every(m=>(cfg[m.countKey]|0)>=m.required);
}

function isKilnMoulded(cfg){
  if(!cfg) return false;
  if(cfg.moulded) return true;
  return (cfg.mouldIron|0)>=KILN_MOULD_IRON_REQUIRED;
}

function isKilnFueled(cfg){
  if(!cfg) return false;
  if(cfg.fueled) return true;
  return KILN_FUEL_LOGS.every(l=>(cfg[l.countKey]|0)>=KILN_FUEL_LOG_REQUIRED);
}

function isKilnLit(cfg){
  return !!cfg?.lit;
}

function getKilnStage(cfg){
  if(!isKilnBuildComplete(cfg)) return 'building';
  if(!isKilnMoulded(cfg)) return 'moulding';
  if(!isKilnLit(cfg)) return 'unlit';
  return 'complete';
}

function getKilnDisplayName(stage){
  if(stage==='unlit') return KILN_UNLIT_DISPLAY_NAME;
  return KILN_DISPLAY_NAME;
}

function getKilnBuildProgress(cfg){
  if(!cfg) return 0;
  return KILN_BUILD_MATERIALS.reduce((sum,m)=>sum+Math.min(cfg[m.countKey]|0, m.required), 0);
}

function getKilnFuelProgress(cfg){
  if(!cfg) return 0;
  return KILN_FUEL_LOGS.reduce((sum,l)=>sum+Math.min(cfg[l.countKey]|0, KILN_FUEL_LOG_REQUIRED), 0);
}

function getKilnActionDef(actionId){
  return KILN_ACTIONS[actionId]||null;
}

function getKilnTabDef(tabId){
  return KILN_TABS[tabId]||null;
}

function getKilnTabForAction(actionId){
  return getKilnActionDef(actionId)?.menu||'clay';
}

function getKilnRecipesForTab(tabId){
  const tab=KILN_TABS[tabId];
  if(!tab?.actions?.length) return [];
  return tab.actions.map(id=>getKilnActionDef(id)).filter(Boolean);
}

function getKilnItemDef(key){
  if(!key) return null;
  const mine=MINE_RESOURCE_DEFS?.[key];
  if(mine) return { key, icon:mine.icon, name:mine.name };
  const log=LOG_DEFS?.[key];
  if(log) return { key, icon:log.icon, name:log.name };
  for(const action of Object.values(KILN_ACTIONS)){
    const out=action.outputs?.find(o=>o.key===key);
    if(out) return { key, icon:out.icon, name:out.name };
    const inp=action.inputs?.find(i=>i.key===key);
    if(inp){
      const d=MINE_RESOURCE_DEFS?.[inp.key]||LOG_DEFS?.[inp.key];
      if(d) return { key, icon:d.icon, name:d.name };
    }
  }
  return { key, icon:'📦', name:key };
}

function getKilnRecipeDisplay(action){
  const out=action?.outputs?.[0];
  return {
    icon:out?.icon||'🏺',
    label:out?.name||action?.label||'Recipe',
  };
}

function getKilnRecipeXpLine(action){
  if(!action?.xp) return '';
  const parts=[];
  if(action.xp.fire) parts.push('+'+action.xp.fire+' Fire');
  if(action.glassblow&&action.xp.fire) parts.push('+'+action.xp.fire+' Air');
  if(action.xp.architecture) parts.push('+'+action.xp.architecture+' Architecture');
  return parts.join(' • ');
}

function kilnActionAvailable(cfg, actionId){
  const action=getKilnActionDef(actionId);
  if(!action||!cfg) return false;
  if(!isKilnLit(cfg)) return false;
  if(action.requiresMoulds&&!isKilnMoulded(cfg)) return false;
  return true;
}

function getKilnVisualState(cfg){
  const stage=getKilnStage(cfg);
  if(stage==='complete'){
    return { icon:'🏺', label:KILN_COMPLETE_LABEL, stage:'complete' };
  }
  if(stage==='unlit'){
    if(isKilnFueled(cfg)){
      return { icon:'🏺', label:KILN_UNLIT_LABEL, stage:'unlit' };
    }
    const total=getKilnFuelProgress(cfg);
    const max=getKilnTotalFuelRequired();
    return { icon:'🪵', label:total+'/'+max+' logs', stage:'unlit' };
  }
  if(stage==='moulding'){
    const iron=Math.min(KILN_MOULD_IRON_REQUIRED, cfg?.mouldIron|0);
    return { icon:'🏺', label:iron+'/'+KILN_MOULD_IRON_REQUIRED+' iron', stage:'moulding' };
  }
  const total=getKilnBuildProgress(cfg);
  const max=getKilnTotalBuildRequired();
  if(total>=100) return { icon:'🏺', label:total+'/'+max, stage:'stage-3' };
  if(total>=50) return { icon:'🪨', label:total+'/'+max, stage:'stage-2' };
  return { icon:'▫️', label:total+'/'+max, stage:'stage-1' };
}
