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

/** Metal tier groups — add new tiers here to expand the kiln metal menu. */
const KILN_METAL_TIERS={
  copper:{
    id:'copper',
    label:'Copper',
    actions:['smelt_copper_nails','smelt_copper_axe','smelt_copper_pickaxe','smelt_copper_armour','smelt_copper_trough'],
  },
  bronze:{
    id:'bronze',
    label:'Bronze',
    actions:['smelt_bronze_nails','smelt_bronze_axe','smelt_bronze_pickaxe','smelt_bronze_weights','smelt_bronze_armour','smelt_bronze_trough'],
  },
};

function getKilnMetalTierKeys(){
  return Object.keys(KILN_METAL_TIERS);
}

function getKilnMetalTierDef(tierId){
  return KILN_METAL_TIERS[tierId]||null;
}

function getKilnMetalTierForAction(actionId){
  for(const tierId of getKilnMetalTierKeys()){
    const tier=KILN_METAL_TIERS[tierId];
    if(tier.actions.includes(actionId)) return tierId;
  }
  return getKilnMetalTierKeys()[0]||'copper';
}

function getKilnRecipesForMetalTier(tierId){
  const tier=getKilnMetalTierDef(tierId);
  if(!tier) return [];
  return tier.actions.map(id=>getKilnActionDef(id)).filter(Boolean);
}

function getKilnMetalActionIds(){
  return getKilnMetalTierKeys().flatMap(tierId=>KILN_METAL_TIERS[tierId].actions);
}

const KILN_TABS={
  clay:    { id:'clay',    label:'Clay',  actions:['fire_brick'] },
  melting: { id:'melting', label:'Melt',  actions:['molten_glass'] },
  blow:    { id:'blow',    label:'Blow',  actions:['blow_vial','blow_bowl','blow_bottle','blow_glass_jar'] },
  metal:   { id:'metal',   label:'Metal', actions:getKilnMetalActionIds() },
};

const KILN_ACTIONS={
  fire_brick:{
    id:'fire_brick',
    material:'clay', process:'melt',
    menu:'clay',
    label:'Fire brick',
    quickLabel:'fire brick',
    requiresMoulds:false,
    inputs:[{ key:'clay', count:2 }],
    outputs:[{ key:'brick', count:1, icon:'🧱', name:'Brick' }],
    xp:{ fire:12, crafting:9, architecture:2 },
    logOk:'Fired 2 clay into a brick.',
  },
  molten_glass:{
    id:'molten_glass',
    material:'clay', process:'melt',
    menu:'melting',
    label:'Molten glass',
    quickLabel:'melt glass',
    requiresMoulds:true,
    inputs:[{ key:'bucket_of_sand', count:1 }, { key:'limestone', count:1 }],
    outputs:[{ key:'molten_glass', count:1, icon:'🫙', name:'Molten Glass' }],
    xp:{ fire:10, crafting:15 },
    logOk:'Sand and limestone fuse into molten glass.',
  },
  blow_vial:{
    id:'blow_vial',
    material:'clay', process:'blow',
    menu:'blow',
    label:'Vial',
    quickLabel:'vial',
    requiresMoulds:true,
    glassblow:true,
    shardBonus:'air',
    inputs:[{ key:'molten_glass', count:1 }],
    skills:{ fire:10, air:10 },
    outputs:[{ key:'empty_vial', count:1, icon:'🧪', name:'Empty Vial' }],
    xp:{ fire:8, crafting:20 },
    logOk:'Shaped molten glass into an empty vial.',
  },
  blow_bowl:{
    id:'blow_bowl',
    material:'clay', process:'blow',
    menu:'blow',
    label:'Bowl',
    quickLabel:'bowl',
    requiresMoulds:true,
    glassblow:true,
    shardBonus:'air',
    inputs:[{ key:'molten_glass', count:1 }],
    skills:{ fire:15, air:15 },
    outputs:[{ key:'glass_bowl', count:1, icon:'🥣', name:'Glass Bowl' }],
    xp:{ fire:10, crafting:25 },
    logOk:'Shaped molten glass into a glass bowl.',
  },
  blow_bottle:{
    id:'blow_bottle',
    material:'clay', process:'blow',
    menu:'blow',
    label:'Bottle',
    quickLabel:'bottle',
    requiresMoulds:true,
    glassblow:true,
    shardBonus:'air',
    inputs:[{ key:'molten_glass', count:1 }],
    skills:{ fire:20, air:20 },
    outputs:[{ key:'glass_bottle', count:1, icon:'🍾', name:'Glass Bottle' }],
    xp:{ fire:12, crafting:30 },
    logOk:'Shaped molten glass into a glass bottle.',
  },
  blow_glass_jar:{
    id:'blow_glass_jar',
    material:'clay', process:'blow',
    menu:'blow',
    label:'Glass jar',
    quickLabel:'glass jar',
    requiresMoulds:true,
    glassblow:true,
    shardBonus:'air',
    inputs:[{ key:'molten_glass', count:1 }],
    skills:{ fire:12, air:12 },
    outputs:[{ key:'empty_glass_jar', count:1, icon:'🫙', name:'Empty Glass Jar' }],
    xp:{ fire:10, crafting:22 },
    logOk:'Shaped molten glass into an empty glass jar.',
  },
  smelt_copper_nails:{
    id:'smelt_copper_nails',
    material:'metal', process:'melt',
    menu:'metal',
    label:'Copper nails',
    quickLabel:'copper nails',
    requiresMoulds:true,
    inputs:[{ key:'copper_ore', count:1 }],
    outputs:[{ key:'copper', count:10, icon:'🔩', name:'Copper Nails', isNail:true }],
    skills:{ metalworking:1 },
    xp:{ fire:8, metalworking:80 },
    logOk:'Smelted ore into a batch of 10 copper nails.',
  },
  smelt_copper_axe:{
    id:'smelt_copper_axe',
    material:'metal', process:'melt',
    menu:'metal',
    label:'Copper axe',
    quickLabel:'copper axe',
    requiresMoulds:true,
    inputs:[{ key:'copper_ore', count:1 }, { key:'logs', count:1 }],
    outputs:[{ key:'axe_1', count:1, icon:'🪓', name:'Copper Axe' }],
    skills:{ metalworking:5 },
    xp:{ fire:10, metalworking:120 },
    logOk:'Cast and hafted a copper axe.',
  },
  smelt_copper_pickaxe:{
    id:'smelt_copper_pickaxe',
    material:'metal', process:'melt',
    menu:'metal',
    label:'Copper pickaxe',
    quickLabel:'copper pickaxe',
    requiresMoulds:true,
    inputs:[{ key:'copper_ore', count:1 }, { key:'logs', count:1 }],
    outputs:[{ key:'pickaxe_1', count:1, icon:'⛏️', name:'Copper Pickaxe' }],
    skills:{ metalworking:6 },
    xp:{ fire:10, metalworking:130 },
    logOk:'Cast and hafted a copper pickaxe.',
  },
  smelt_copper_armour:{
    id:'smelt_copper_armour',
    material:'metal', process:'melt',
    menu:'metal',
    label:'Copper armour',
    quickLabel:'copper armour',
    requiresMoulds:true,
    inputs:[{ key:'copper_ore', count:15 }],
    outputs:[{ key:'copper_armour', count:1, icon:'🛡️', name:'Copper Armour' }],
    skills:{ metalworking:8 },
    xp:{ fire:12, metalworking:200 },
    logOk:'Hammered copper ore into a cuirass.',
  },
  smelt_copper_trough:{
    id:'smelt_copper_trough',
    material:'metal', process:'melt',
    menu:'metal',
    label:'Copper trough',
    quickLabel:'copper trough',
    requiresMoulds:true,
    inputs:[{ key:'copper_ore', count:12 }],
    outputs:[{ key:'copper_trough', count:1, icon:'🪣', name:'Copper Trough' }],
    skills:{ metalworking:10 },
    xp:{ fire:12, metalworking:180 },
    logOk:'Cast a copper trough.',
  },
  smelt_bronze_axe:{
    id:'smelt_bronze_axe',
    material:'metal', process:'melt',
    menu:'metal',
    label:'Bronze axe',
    quickLabel:'bronze axe',
    requiresMoulds:true,
    inputs:[{ key:'copper_ore', count:1 }, { key:'tin_ore', count:1 }, { key:'ashwood', count:1 }],
    outputs:[{ key:'axe_2', count:1, icon:'🪓', name:'Bronze Axe' }],
    skills:{ metalworking:15 },
    xp:{ fire:10, metalworking:160 },
    logOk:'Cast and hafted a bronze axe.',
  },
  smelt_bronze_pickaxe:{
    id:'smelt_bronze_pickaxe',
    material:'metal', process:'melt',
    menu:'metal',
    label:'Bronze pickaxe',
    quickLabel:'bronze pickaxe',
    requiresMoulds:true,
    inputs:[{ key:'copper_ore', count:1 }, { key:'tin_ore', count:1 }, { key:'ashwood', count:1 }],
    outputs:[{ key:'pickaxe_2', count:1, icon:'⛏️', name:'Bronze Pickaxe' }],
    skills:{ metalworking:16 },
    xp:{ fire:10, metalworking:170 },
    logOk:'Cast and hafted a bronze pickaxe.',
  },
  smelt_bronze_nails:{
    id:'smelt_bronze_nails',
    material:'metal', process:'melt',
    menu:'metal',
    label:'Bronze nails',
    quickLabel:'bronze nails',
    requiresMoulds:true,
    inputs:[{ key:'tin_ore', count:1 }, { key:'copper_ore', count:1 }],
    outputs:[{ key:'bronze', count:10, icon:'🔩', name:'Bronze Nails', isNail:true }],
    skills:{ metalworking:10 },
    xp:{ fire:10, metalworking:120 },
    logOk:'Alloyed tin and copper into a batch of 10 bronze nails.',
  },
  smelt_bronze_weights:{
    id:'smelt_bronze_weights',
    material:'metal', process:'melt',
    menu:'metal',
    label:'Bronze weights',
    quickLabel:'bronze weights',
    requiresMoulds:true,
    inputs:[{ key:'tin_ore', count:5 }, { key:'copper_ore', count:5 }],
    outputs:[{ key:'bronze_weights', count:10, icon:'⚖️', name:'Bronze Weights' }],
    skills:{ metalworking:16 },
    xp:{ fire:10, metalworking:150 },
    logOk:'Cast a batch of 10 bronze weights.',
  },
  smelt_bronze_armour:{
    id:'smelt_bronze_armour',
    material:'metal', process:'melt',
    menu:'metal',
    label:'Bronze armour',
    quickLabel:'bronze armour',
    requiresMoulds:true,
    inputs:[{ key:'copper_ore', count:15 }, { key:'tin_ore', count:15 }],
    outputs:[{ key:'bronze_armour', count:1, icon:'🛡️', name:'Bronze Armour' }],
    skills:{ metalworking:18 },
    xp:{ fire:14, metalworking:240 },
    logOk:'Forged a bronze armour set.',
  },
  smelt_bronze_trough:{
    id:'smelt_bronze_trough',
    material:'metal', process:'melt',
    menu:'metal',
    label:'Bronze trough',
    quickLabel:'bronze trough',
    requiresMoulds:true,
    inputs:[{ key:'copper_ore', count:12 }, { key:'tin_ore', count:12 }],
    outputs:[{ key:'bronze_trough', count:1, icon:'🪣', name:'Bronze Trough' }],
    skills:{ metalworking:20 },
    xp:{ fire:14, metalworking:220 },
    logOk:'Cast a bronze trough.',
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
  const action=getKilnActionDef(actionId);
  if(action?.menu) return action.menu;
  if(action?.material==='metal') return 'metal';
  return 'clay';
}

function getKilnMaterialForAction(actionId){
  const action=getKilnActionDef(actionId);
  if(action?.material) return action.material;
  const menu=action?.menu;
  if(menu==='metal') return 'metal';
  if(menu==='melting'||menu==='clay') return 'clay';
  if(menu==='blow') return 'clay';
  return 'clay';
}

function kilnModeKey(material, process){
  return material+'_'+process;
}

function getKilnActionsForMode(material, process){
  return Object.values(KILN_ACTIONS)
    .filter(a=>a.material===material&&a.process===process)
    .sort((a,b)=>{
      const la=a.skills?.metalworking||a.skills?.fire||0;
      const lb=b.skills?.metalworking||b.skills?.fire||0;
      return la-lb;
    });
}

function getKilnMetalMeltActions(){
  return getKilnActionsForMode('metal','melt');
}

function getKilnRecipesForTab(tabId){
  const tab=KILN_TABS[tabId];
  if(!tab?.actions?.length) return [];
  const recipes=tab.actions.map(id=>getKilnActionDef(id)).filter(Boolean);
  if(tabId==='metal'){
    return recipes.sort((a,b)=>(a.skills?.metalworking||0)-(b.skills?.metalworking||0));
  }
  return recipes;
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
  if(action.xp.fire) parts.push('+'+action.xp.fire+' Fire XP');
  if(action.glassblow&&action.xp.fire) parts.push('+'+action.xp.fire+' Air XP');
  if(action.xp.crafting) parts.push('+'+action.xp.crafting+' Crafting XP');
  if(action.xp.metalworking) parts.push('+'+action.xp.metalworking+' Metalworking XP');
  if(action.xp.architecture) parts.push('+'+action.xp.architecture+' Architecture XP');
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
