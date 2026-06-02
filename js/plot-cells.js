/* Hearthstead — plot cell HTML & tile helpers */
'use strict';

function genPlotInstanceId(){
  return 'plot_'+Date.now().toString(36)+'_'+Math.floor(Math.random()*9999);
}

function getWoodcutLevel(){
  return Number(state.skills.woodcut?.level)||1;
}

function getMineById(id){
  return MINES.find(m=>m.id===id)||MINES[0];
}

function getMineByTypeId(typeId){
  const def=getPlotTileDef(typeId);
  if(def?.mineId) return getMineById(def.mineId);
  return MINES[0];
}

function getMineRecommendedLevel(mineId){
  const m=getMineById(mineId);
  return m.recommendedLevel ?? m.unlockLevel ?? 1;
}

function formatMineDrops(mineId){
  const m=getMineById(mineId);
  const total=m.drops.reduce((s,d)=>s+d.weight,0);
  return m.drops.map(d=>{
    const n=MINE_RESOURCE_DEFS[d.ore]?.name||d.ore;
    const pct=Math.round((d.weight/total)*100);
    return pct+'% '+n;
  }).join(' · ');
}

function plotAddLevelBadge(skillKey, currentLvl, requiredLvl, recommendedLvl){
  const rec=recommendedLvl??requiredLvl;
  let cls='ok';
  if(currentLvl<requiredLvl) cls='low';
  else if(currentLvl<rec) cls='low';
  const icon=SKILL_META[skillKey]?.icon||'?';
  return '<span class="plot-add-level-badge '+cls+'">'
    +'<span class="plot-add-level-icon">'+icon+'</span>'
    +'<span class="plot-add-level-text">'+currentLvl+'/'+requiredLvl+'</span>'
    +'</span>';
}

function plotAddItemTitleRow(name, levelBadgeHtml){
  return '<span class="plot-add-item-title-row">'
    +'<span class="plot-add-item-title">'+name+'</span>'
    +(levelBadgeHtml||'')
    +'</span>';
}

function buildQuarryPlotAddItem(id, def, mineLvl, x, y){
  const unlock=def.unlockLevel||1;
  const rec=getMineRecommendedLevel(def.mineId);
  const locked=mineLvl<unlock;
  const belowRec=mineLvl<rec;
  let cls='plot-add-item';
  if(locked) cls+=' locked below-rec';
  else if(belowRec) cls+=' below-rec';
  const lvlBadge=plotAddLevelBadge('mining', mineLvl, unlock, rec);
  if(locked){
    return '<button type="button" class="'+cls+'" disabled>'
      +'<span class="plot-add-item-icon">🔒</span>'
      +'<span class="plot-add-item-name">'
      +plotAddItemTitleRow(def.name, lvlBadge)
      +'</span></button>';
  }
  return '<button type="button" class="'+cls+'" onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'
    +plotAddItemTitleRow(def.name, lvlBadge)
    +'</span></button>';
}

function buildWoodlandPlotAddItem(id, def, wcLvl, x, y){
  const unlock=def.unlockLevel||1;
  const rec=getWoodlandRecommendedLevel(def.woodlandId);
  const needsTile=typeof plotFeatureRequiresTileUnlock==='function'&&plotFeatureRequiresTileUnlock(id);
  const tileLocked=needsTile&&!(typeof isPlotFeatureUnlockedByTile==='function'&&isPlotFeatureUnlockedByTile(id));
  const locked=wcLvl<unlock||tileLocked;
  const belowRec=wcLvl<rec;
  let cls='plot-add-item';
  if(locked) cls+=' locked below-rec';
  else if(belowRec) cls+=' below-rec';
  const lvlBadge=plotAddLevelBadge('woodcut', wcLvl, unlock, rec);
  if(locked){
    return '<button type="button" class="'+cls+'" disabled>'
      +'<span class="plot-add-item-icon">🔒</span>'
      +'<span class="plot-add-item-name">'
      +plotAddItemTitleRow(def.name, lvlBadge)
      +'</span></button>';
  }
  return '<button type="button" class="'+cls+'" onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'
    +plotAddItemTitleRow(def.name, lvlBadge)
    +'</span></button>';
}

function rollMineOre(mineId){
  const mine=getMineById(mineId);
  if(!mine?.drops?.length) return null;
  const total=mine.drops.reduce((s,d)=>s+d.weight,0);
  let r=Math.random()*total;
  let oreKey=null;
  for(const d of mine.drops){
    r-=d.weight;
    if(r<0){ oreKey=d.ore; break; }
  }
  if(!oreKey) oreKey=mine.drops[mine.drops.length-1].ore;
  const lvl=Number(state.skills.mining?.level)||1;
  const res=MINE_RESOURCE_DEFS[oreKey];
  if(res&&res.unlockLevel>lvl) oreKey='stone';
  const out=MINE_RESOURCE_DEFS[oreKey]||MINE_RESOURCE_DEFS.stone;
  return { key:out.key, icon:out.icon, name:out.name };
}

function getWoodlandById(id){
  return WOODLANDS.find(w=>w.id===id)||WOODLANDS[0];
}

function getWoodlandByTypeId(typeId){
  const def=getPlotTileDef(typeId);
  if(def?.woodlandId) return getWoodlandById(def.woodlandId);
  return WOODLANDS[0];
}

function findPlotSlotByInstanceId(instanceId){
  if(!state.plot?.cells||!instanceId) return null;
  for(const [key,slot] of Object.entries(state.plot.cells)){
    if(slot?.instanceId===instanceId){
      const {x,y}=parsePlotCoordKey(key);
      return { x, y, slot };
    }
  }
  return null;
}

function getTreeWoodlandId(instanceId){
  const found=findPlotSlotByInstanceId(instanceId);
  if(found){
    const w=getWoodlandByTypeId(found.slot.typeId);
    return w.id;
  }
  const cfg=state.plotConfigs?.[instanceId];
  return cfg?.woodlandId||1;
}

function rollWoodlandLog(woodlandId){
  const w=getWoodlandById(woodlandId);
  const r=Math.random()*100;
  let cum=0;
  for(const d of w.drops){
    cum+=d.pct;
    if(r<cum) return d.log;
  }
  return w.drops[w.drops.length-1].log;
}

function formatWoodlandDrops(woodlandId){
  const w=getWoodlandById(woodlandId);
  return w.drops.map(d=>{
    const n=LOG_DEFS[d.log]?.name||d.log;
    return d.pct+'% '+n;
  }).join(' · ');
}

function getWoodlandRecommendedLevel(woodlandId){
  const w=getWoodlandById(woodlandId);
  return w.recommendedLevel ?? w.unlockLevel ?? 1;
}

function getGatheringByKey(key){
  return GATHERING_LOCATIONS.find(g=>g.key===key)||null;
}

function getGatheringByTypeId(typeId){
  const def=getPlotTileDef(typeId);
  if(!def?.gatherKey) return null;
  return getGatheringByKey(def.gatherKey);
}

function getGatheringSlotByInstanceId(instanceId){
  if(!instanceId) return null;
  let found=null;
  forEachPlotOccupied((x,y,slot)=>{
    if(slot.instanceId===instanceId) found={x,y,slot};
  });
  return found;
}

function getCurrentGatheringLocation(){
  if(!gather.instanceId) return null;
  const found=getGatheringSlotByInstanceId(gather.instanceId);
  if(!found) return null;
  return getGatheringByTypeId(found.slot.typeId);
}

function formatGatheringDrops(gatherKey){
  return sortedGatheringDrops(gatherKey)
    .map(d=>d.pct+'% '+d.name+(d.rare?' (rare)':''))
    .join(' · ');
}

function buildCavePlotAddItem(id, def, x, y){
  return '<button type="button" class="plot-add-item" onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'
    +plotAddItemTitleRow(def.name, '')
    +'</span></button>';
}

function buildExpeditionPlotAddItem(id, def, x, y){
  const featureUnlocked=typeof isPlotFeatureUnlockedByTile==='function'?isPlotFeatureUnlockedByTile(id):true;
  const drops=def.desc||'Launch treks from this location.';
  const cls='plot-add-item'+(!featureUnlocked?' structure-locked below-rec is-disabled':'');
  return '<button type="button" class="'+cls+'"'+(featureUnlocked?'':' disabled')+(featureUnlocked?(' onclick="placePlotTile('+x+','+y+',\''+id+'\')"'):'')+'>'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'
    +plotAddItemTitleRow(def.name, '')
    +'<span class="plot-add-item-drops">'+drops+'</span>'
    +'</span></button>';
}

function buildGatheringPlotAddItem(id, def, x, y){
  const loc=typeof getGatheringByKey==='function'?getGatheringByKey(def.gatherKey):null;
  const foragingLvl=Number(state.skills.foraging?.level)||1;
  const unlockOk=loc&&typeof meetsGatheringUnlockRequirements==='function'
    ?meetsGatheringUnlockRequirements(loc)
    :true;
  const harvestOk=loc&&typeof canHarvestAtGatheringLocation==='function'
    ?canHarvestAtGatheringLocation(loc)
    :true;
  const locked=!unlockOk;
  const belowRec=unlockOk&&!harvestOk;
  let cls='plot-add-item';
  if(locked) cls+=' locked below-rec';
  else if(belowRec) cls+=' below-rec';
  const drops=formatGatheringDrops(def.gatherKey);
  const unlockMsg=loc&&typeof getGatheringUnlockBlockMessage==='function'
    ?getGatheringUnlockBlockMessage(loc)
    :'';
  const sub=locked&&unlockMsg?unlockMsg:drops;
  const primaryReq=loc?.unlockRequirements?.[0];
  const lvlBadge=primaryReq
    ?plotAddLevelBadge(primaryReq.skill, Number(state.skills[primaryReq.skill]?.level)||1, primaryReq.level, primaryReq.level)
    :plotAddLevelBadge('foraging', foragingLvl, loc?getGatheringHarvestLevel(loc):1, loc?getGatheringHarvestLevel(loc):1);
  if(locked){
    return '<button type="button" class="'+cls+'" disabled>'
      +'<span class="plot-add-item-icon">🔒</span>'
      +'<span class="plot-add-item-name">'
      +plotAddItemTitleRow(def.name, lvlBadge)
      +'<span class="plot-add-item-drops">'+sub+'</span>'
      +'</span></button>';
  }
  return '<button type="button" class="'+cls+'" onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'
    +plotAddItemTitleRow(def.name, lvlBadge)
    +'<span class="plot-add-item-drops">'+sub+'</span>'
    +'</span></button>';
}

function getPlotTileAccessRequirement(typeId){
  const def=getPlotTileDef(typeId);
  if(!def) return null;
  if(def.behavior==='tree') return { skill:'woodcut', level:def.unlockLevel||1 };
  if(def.behavior==='quarry') return { skill:'mining', level:def.unlockLevel||1 };
  if(def.behavior==='gather'){
    const loc=typeof getGatheringByKey==='function'?getGatheringByKey(def.gatherKey):null;
    if(loc&&typeof plotGatherUnlockMaxLevel==='function'){
      return { skill:'foraging', level:plotGatherUnlockMaxLevel(loc) };
    }
    return { skill:'foraging', level:loc?.harvestLevel||1 };
  }
  if(def.behavior==='cave') return { skill:'exploration', level:1 };
  if(def.archUnlockLevel) return { skill:'architecture', level:def.archUnlockLevel };
  if(def.unlockLevel) return { skill:'woodcut', level:def.unlockLevel };
  return null;
}

function formatPlotAccessRequirementLabel(req){
  if(!req||!req.level) return '';
  const meta=typeof SKILL_META!=='undefined'?SKILL_META[req.skill]:null;
  const skillName=meta?.name||req.skill;
  return 'Lv '+req.level+' '+skillName;
}

function getPlotCellAccessRequirementLabel(x,y){
  const typeId=typeof getPlotTileTypeIdForCellProspect==='function'
    ?getPlotTileTypeIdForCellProspect(x,y):null;
  if(!typeId) return '';
  return formatPlotAccessRequirementLabel(getPlotTileAccessRequirement(typeId));
}

function isWoodlandPlotAddLocked(id, def, wcLvl){
  const unlock=def.unlockLevel||1;
  const needsTile=typeof plotFeatureRequiresTileUnlock==='function'&&plotFeatureRequiresTileUnlock(id);
  const tileLocked=needsTile&&!(typeof isPlotFeatureUnlockedByTile==='function'&&isPlotFeatureUnlockedByTile(id));
  return wcLvl<unlock||tileLocked;
}

function isQuarryPlotAddLocked(id, def, mineLvl){
  return mineLvl<(def.unlockLevel||1);
}

function isWaterPlotAddLocked(){
  return typeof canPlaceAnotherWaterPlotTile==='function'&&!canPlaceAnotherWaterPlotTile();
}

function isStructurePlotAddItemLocked(id, def, x, y){
  const html=typeof buildStructurePlotAddItem==='function'?buildStructurePlotAddItem(id,def,x,y):'';
  if(!html) return true;
  if(html.includes(' is-disabled')) return true;
  if(/Need Architecture Lv/i.test(html)) return true;
  return false;
}

function getPlotTileProspectItems(typeId){
  const def=getPlotTileDef(typeId);
  if(!def) return [];
  const seen=new Set();
  const out=[];
  const add=(icon,name)=>{
    const key=String(name||'').toLowerCase();
    if(!key||seen.has(key)) return;
    seen.add(key);
    out.push({ icon:icon||'📦', name });
  };
  if(def.behavior==='tree'){
    const w=getWoodlandById(def.woodlandId);
    (w?.drops||[]).forEach((d)=>{
      const log=typeof LOG_DEFS!=='undefined'?LOG_DEFS[d.log]:null;
      add(log?.icon, log?.name||d.log);
    });
    return out;
  }
  if(def.behavior==='gather'){
    const loc=typeof getGatheringByKey==='function'?getGatheringByKey(def.gatherKey):null;
    (loc?.drops||[]).forEach((d)=>add(d.icon, d.name));
    return out;
  }
  if(def.behavior==='quarry'){
    const mine=typeof getMineById==='function'?getMineById(def.mineId):null;
    (mine?.drops||[]).forEach((d)=>{
      const ore=typeof MINE_RESOURCE_DEFS!=='undefined'?MINE_RESOURCE_DEFS[d.ore]:null;
      add(ore?.icon, ore?.name||d.ore);
    });
    return out;
  }
  if(def.behavior==='water'){
    if(typeof FISH_DEFS!=='undefined'){
      Object.values(FISH_DEFS).forEach((f)=>add(f.icon, f.name));
    }else{
      add('🐟', 'Fish');
    }
    return out;
  }
  if(def.behavior==='cave'){
    add('🎒', 'Expedition loot');
    if(def.expeditionKey==='whispering_woods') add('⛺', 'Needs adjacent camp');
    if(def.expeditionKey==='sunken_shallows') add('⚓', 'Needs adjacent docks');
    else add('🔦', 'Torches & supplies');
    return out;
  }
  return out;
}

function buildWaterPlotAddItem(id, def, x, y){
  const atCap=typeof canPlaceAnotherWaterPlotTile==='function'&&!canPlaceAnotherWaterPlotTile();
  const max=typeof getMaxWaterPlotTiles==='function'?getMaxWaterPlotTiles():1;
  const placed=typeof countPlacedWaterPlotTiles==='function'?countPlacedWaterPlotTiles():0;
  const sub=atCap
    ?(typeof waterPlotTileLimitMessage==='function'?waterPlotTileLimitMessage():'Water tile limit reached.')
    :'Water tiles: '+placed+'/'+max+' · shape affects fish';
  const cls='plot-add-item'+(atCap?' locked below-rec':'');
  return '<button type="button" class="'+cls+'"'+(atCap?' disabled':'')+' onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'
    +plotAddItemTitleRow(def.name, '')
    +'<span class="plot-add-item-drops">'+sub+'</span>'
    +'</span></button>';
}

function rollGatherLoot(gatherKey){
  const loc=getGatheringByKey(gatherKey);
  if(!loc?.drops?.length) return null;
  const total=loc.drops.reduce((s,d)=>s+d.weight,0);
  let r=Math.random()*total;
  for(const d of loc.drops){
    r-=d.weight;
    if(r<0) return d;
  }
  return loc.drops[loc.drops.length-1];
}

function calcGatherSuccess(){
  const lvl=Number(state.skills.foraging?.level)||1;
  const cap=typeof GATHER_MAX_SUCCESS==='number'?GATHER_MAX_SUCCESS:1;
  return Math.min(cap, GATHER_BASE_SUCCESS + Math.max(0,lvl-1)*GATHER_SUCCESS_PER_LEVEL);
}

function tryLocationShardDrop(shardTypes){
  if(!shardTypes?.length||Math.random()>=SHARD_CHANCE) return;
  const elem=shardTypes[Math.floor(Math.random()*shardTypes.length)];
  state.pockets[elem]=(state.pockets[elem]||0)+1;
  const m=SHARD_META[elem];
  if(!state._seenShard){
    state._seenShard=true;
    showFoundBanner('POCKET FIND!', m.icon,
      'An elemental shard — tiny enough to live in your pockets. It uses no bag space. You\'ll gather these while training skills, for magic later.',
      'GOT IT', ()=>{ if(openPanel==='inv') renderInvPanel(); syncUI(); });
  }else if(openPanel==='inv') renderInvPanel();
  syncUI();
}

function buildActivitySparklesHtml(layerClass, sparkleClass, variantClass){
  let sparkles='';
  for(let i=0;i<14;i++){
    const star=i%3===0;
    const sym=star?['✦','✧','⋆'][i%3]:'';
    sparkles+='<span class="'+sparkleClass+(star?' sparkle-star':'')+'" style="left:'+(5+((i*13)%88))+'%;top:'+(10+((i*19)%78))+'%;animation-delay:'+(i*0.1)+'s;animation-duration:'+(0.9+(i%4)*0.15)+'s;">'+sym+'</span>';
  }
  const variant=variantClass?' '+variantClass:'';
  return '<div class="'+layerClass+variant+'">'+sparkles+'</div>';
}

function buildGatherSparklesHtml(gatherKey){
  const variant={
    wet_clearing:'sparkles-wet',
    woodland_clearing:'sparkles-woodland',
    rocky_clearing:'sparkles-rocky',
    fairy_grove:'sparkles-fae',
    sunken_rock_pools:'sparkles-pools',
  }[gatherKey]||'sparkles-woodland';
  return buildActivitySparklesHtml('gather-sparkles', 'gather-sparkle', variant);
}

function buildMineSparklesHtml(){
  return buildActivitySparklesHtml('mine-sparkles', 'mine-sparkle', '');
}

function buildGatherCellHtml(def, editMode){
  const loc=getGatheringByKey(def.gatherKey);
  const label=(loc?.name||def.name).toLowerCase();
  return '<div class="plot-activity-top gather-activity-top">'
    +buildGatherSparklesHtml(def.gatherKey)
    +'<div class="gather-sprite">'
    +'<span class="gather-icon">'+(loc?.icon||def.icon)+'</span>'
    +'<span class="gather-label">'+label+'</span></div></div>'
    +'<div class="plot-activity-menu-zone gather-menu-zone">'
    +'<button type="button" class="plot-menu-btn gather-menu-btn" onclick="gatherMenuTap(event)">menu</button>'
    +'</div>'
    +(editMode?'<div class="plot-edit-hint">remove</div>':'');
}

function buildCaveCellHtml(def, editMode){
  const label=(def?.name||'Cave').toLowerCase();
  return '<div class="plot-activity-top cave-activity-top">'
    +'<div class="cave-sprite">'
    +'<span class="cave-icon">'+(def?.icon||'🕳️')+'</span>'
    +'<span class="cave-label">'+label+'</span></div></div>'
    +(editMode?'<div class="plot-edit-hint">remove</div>':'');
}

function buildFarmCellHtml(slot, def, editMode){
  const cfg=typeof getFarmConfig==='function'?getFarmConfig(slot.instanceId):null;
  const vis=typeof getFarmVisualState==='function'?getFarmVisualState(cfg):{ icon:def?.icon||'🌾', label:'farming plot' };
  return '<div class="plot-activity-top farm-activity-top">'
    +'<div class="farm-sprite">'
    +'<span class="farm-icon">'+vis.icon+'</span>'
    +'<span class="farm-label">'+vis.label+'</span></div></div>'
    +(editMode?'<div class="plot-edit-hint">remove</div>':'');
}

function buildWellCellHtml(slot, def, editMode){
  if(typeof migrateWell==='function') migrateWell();
  const cfg=typeof getWellConfig==='function'?getWellConfig(slot.instanceId):null;
  const vis=getWellVisualState(cfg);
  const hydrated=vis.stage==='hydrated';
  const quick=typeof wellQuickTapLabel==='function'?wellQuickTapLabel():'fill vessel';
  return '<div class="plot-activity-top well-activity-top well-'+vis.stage+'">'
    +'<div class="well-sprite">'
    +'<span class="well-icon">'+vis.icon+'</span>'
    +'<span class="well-label">'+vis.label+'</span></div></div>'
    +(editMode
      ?'<div class="plot-edit-hint">drag · remove</div>'
      :(hydrated
        ?'<div class="plot-activity-top well-quick-zone">'
          +'<button type="button" class="int-quick-action-btn well-quick-action-btn" onclick="wellQuickTap(event)">'+quick+'</button>'
        +'</div>'
        :'')
      +'<div class="plot-activity-menu-zone well-menu-zone">'
      +'<button type="button" class="plot-menu-btn well-menu-btn" onclick="wellMenuTap(event)">menu</button>'
      +'</div>');
}

function buildFirePitCellHtml(slot, def, editMode){
  if(typeof migrateFirePit==='function') migrateFirePit();
  const cfg=typeof getFirePitConfig==='function'?getFirePitConfig(slot.instanceId):null;
  const vis=getFirePitVisualState(cfg);
  const complete=vis.stage==='complete';
  const quick=state.firePitQuickAction==='logs'?'throw log':'cook food';
  return '<div class="plot-activity-top fire-pit-activity-top fire-pit-'+vis.stage+'">'
    +'<div class="fire-pit-sprite">'
    +'<span class="fire-pit-icon">'+vis.icon+'</span>'
    +'<span class="fire-pit-label">'+vis.label+'</span></div></div>'
    +(editMode
      ?'<div class="plot-edit-hint">drag · remove</div>'
      :(complete
        ?'<div class="plot-activity-top fire-pit-quick-zone">'
          +'<button type="button" class="int-quick-action-btn fire-pit-quick-action-btn" onclick="firePitQuickTap(event)">'+quick+'</button>'
        +'</div>'
        :'')
      +'<div class="plot-activity-menu-zone fire-pit-menu-zone">'
      +'<button type="button" class="plot-menu-btn fire-pit-menu-btn" onclick="firePitMenuTap(event)">menu</button>'
      +'</div>');
}

function buildBarnCellHtml(slot, def, editMode){
  const cfg=typeof getBarnConfig==='function'?getBarnConfig(slot.instanceId):null;
  const vis=getBarnVisualState(cfg, slot.typeId);
  const complete=vis.stage==='complete';
  const menuZone=!editMode
    ?(complete
      ?('<div class="barn-surface-zones">'
        +'<button type="button" class="barn-enter-zone" onclick="event.stopPropagation();barnEnterTap(event)">enter barn</button>'
        +'<div class="plot-activity-menu-zone barn-menu-zone">'
        +'<button type="button" class="plot-menu-btn barn-menu-btn" onclick="event.stopPropagation();barnMenuTap(event)">menu</button>'
        +'</div></div>')
      :('<div class="plot-activity-menu-zone barn-menu-zone">'
        +'<button type="button" class="plot-menu-btn barn-menu-btn" onclick="barnMenuTap(event)">menu</button>'
        +'</div>'))
    :'';
  return '<div class="plot-activity-top barn-activity-top barn-'+vis.stage+'">'
    +'<div class="barn-sprite">'
    +'<span class="barn-icon">'+vis.icon+'</span>'
    +'<span class="barn-label">'+vis.label+'</span></div></div>'
    +menuZone
    +(editMode?'<div class="plot-edit-hint">remove</div>':'');
}

/** Multi-tile barns draw only via plot-barn-layer overlay — keep plot cells empty. */
function buildBarnBaseCellHtml(){
  return '';
}

function buildBarnBodySurfaceHtml(cfg, editMode, instanceId){
  const typeId=typeof getBarnPlotTypeIdFromPlot==='function'
    ?getBarnPlotTypeIdFromPlot(instanceId, cfg)
    :(typeof getBarnPlotTypeId==='function'?getBarnPlotTypeId(cfg):getMediumBarnTypeId());
  const vis=getBarnVisualState(cfg, typeId);
  const large=!!vis.large;
  const sprite='<div class="plot-activity-top barn-activity-top barn-'+vis.stage+(large?' barn-large-surface':'')+'">'
    +'<div class="barn-sprite">'
    +'<span class="barn-icon">'+vis.icon+'</span>'
    +'<span class="barn-label">'+vis.label+'</span></div></div>';
  const editBar=editMode
    ?('<div class="barn-edit-bar">'
      +'<button type="button" class="barn-rotate-btn" onclick="event.stopPropagation();rotateBarnFootprint(\''+instanceId+'\')">↻ rotate</button>'
      +'<button type="button" class="plot-edit-hint barn-edit-remove-hint"'
      +' onclick="event.stopPropagation();confirmRemoveMediumBarn(\''+instanceId+'\')">remove</button>'
      +'</div>')
    :'';
  const complete=vis.stage==='complete';
  const menuZone=!editMode
    ?(complete
      ?('<div class="barn-surface-zones">'
        +'<button type="button" class="barn-enter-zone" onclick="event.stopPropagation();barnEnterTap(event)">enter barn</button>'
        +'<div class="plot-activity-menu-zone barn-menu-zone">'
        +'<button type="button" class="plot-menu-btn barn-menu-btn" onclick="event.stopPropagation();barnMenuTap(event)">menu</button>'
        +'</div></div>')
      :('<div class="plot-activity-menu-zone barn-menu-zone">'
        +'<button type="button" class="plot-menu-btn barn-menu-btn" onclick="barnMenuTap(event)">menu</button>'
        +'</div>'))
    :'';
  return sprite+editBar+menuZone;
}

function isBarnDragCell(cell){
  if(!cell?.dataset?.instanceId) return false;
  return cell.classList.contains('cell-barn');
}

function getBarnDragAnchorCell(cell){
  return cell;
}

function buildKilnCellHtml(slot, def, editMode){
  if(typeof migrateKiln==='function') migrateKiln();
  const cfg=typeof getKilnConfig==='function'?getKilnConfig(slot.instanceId):null;
  const vis=getKilnVisualState(cfg);
  const stage=getKilnStage(cfg);
  const lit=stage==='complete';
  const quick=typeof kilnPlotQuickLabel==='function'?kilnPlotQuickLabel(stage, cfg):'open menu';
  return '<div class="plot-activity-top kiln-activity-top kiln-'+vis.stage+'">'
    +'<div class="kiln-sprite">'
    +'<span class="kiln-icon">'+vis.icon+'</span>'
    +'<span class="kiln-label">'+vis.label+'</span></div></div>'
    +(lit
      ?'<div class="plot-activity-top kiln-quick-zone">'
        +'<button type="button" class="int-quick-action-btn kiln-quick-action-btn" onclick="kilnQuickTap(event)">'+quick+'</button>'
      +'</div>'
      :'')
    +'<div class="plot-activity-menu-zone kiln-menu-zone">'
    +'<button type="button" class="plot-menu-btn kiln-menu-btn" onclick="kilnMenuTap(event)">menu</button>'
    +'</div>'
    +(editMode?'<div class="plot-edit-hint">remove</div>':'');
}

function buildWoodlandCellHtml(slot, def, editMode){
  const woodland=getWoodlandByTypeId(slot.typeId);
  const label=(woodland?.name||def.name).toLowerCase();
  return '<div class="plot-activity-top woodland-chop-zone">'
    +'<div class="tree-sprite" data-tree-instance="'+slot.instanceId+'">'
    +'<div class="tree-top"></div><div class="tree-top2"></div><div class="tree-top3"></div><div class="tree-trunk"></div></div>'
    +'<span class="woodland-label">'+label+'</span></div>'
    +'<div class="plot-activity-menu-zone woodland-menu-zone">'
    +'<button type="button" class="plot-menu-btn wc-menu-btn" onclick="wcMenuTap(event)">menu</button>'
    +'</div>'
    +(editMode?'<div class="plot-edit-hint">remove</div>':'');
}

function migrateWoodlandTiles(){
  if(!state.plot?.cells) return;
  forEachPlotOccupied((x,y,slot)=>{
    if(slot?.typeId==='tree_basic') slot.typeId='woodland_clearing';
    if(slot?.typeId==='rock_basic') slot.typeId='quarry_basic';
  });
  Object.values(state.plotConfigs||{}).forEach(cfg=>{
    if(cfg&&cfg.treeChops!=null&&!cfg.woodlandId) cfg.woodlandId=1;
  });
}

function defaultPlotConfig(behavior, typeId){
  if(behavior==='tree'){
    const def=typeId?getPlotTileDef(typeId):null;
    return { treeChops:0, woodlandId:def?.woodlandId||1 };
  }
  if(behavior==='water') return { seen:false };
  if(behavior==='gather') return { seen:false };
  if(behavior==='cave') return { seen:false };
  const fromRegistry=typeof defaultPlotConfigForBehavior==='function'?defaultPlotConfigForBehavior(behavior, typeId):null;
  if(fromRegistry) return fromRegistry;
  return {};
}

function getPlotTileDef(typeId){
  return PLOT_TILE_DEFS[typeId]||null;
}

function getPlotConfig(instanceId, behavior, typeId){
  if(!state.plotConfigs) state.plotConfigs={};
  if(!state.plotConfigs[instanceId]){
    if(!behavior){
      const found=findPlotSlotByInstanceId(instanceId);
      const def=found?.slot?.typeId?getPlotTileDef(found.slot.typeId):null;
      behavior=def?.behavior;
      typeId=typeId||found?.slot?.typeId;
    }
    state.plotConfigs[instanceId]=defaultPlotConfig(behavior, typeId);
  }
  return state.plotConfigs[instanceId];
}

function scrubMisassignedPlotConfigs(){
  if(!state.plot?.cells||!state.plotConfigs) return;
  const used=new Set();
  forEachPlotOccupied((x,y,slot)=>{
    if(!slot?.instanceId) return;
    used.add(slot.instanceId);
    const def=getPlotTileDef(slot.typeId);
    const behavior=def?.behavior;
    const cfg=state.plotConfigs[slot.instanceId];
    if(!behavior){
      delete state.plotConfigs[slot.instanceId];
      return;
    }
    if(behavior!=='barn'&&typeof configLooksLikeBarn==='function'&&configLooksLikeBarn(cfg)){
      state.plotConfigs[slot.instanceId]=defaultPlotConfig(behavior, slot.typeId);
      return;
    }
    if(!cfg){
      state.plotConfigs[slot.instanceId]=defaultPlotConfig(behavior, slot.typeId);
    }
  });
  Object.keys(state.plotConfigs).forEach((id)=>{
    if(!used.has(id)) delete state.plotConfigs[id];
  });
}

