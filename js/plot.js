/* Hearthstead — plot grid */
'use strict';

/* ═══════════════════════════════════════
   PLOT GRID (layout + edit + drag)
═══════════════════════════════════════ */
let plotDrag = null;
let plotDragGhost = null;
let plotPanDrag = null;
const PLOT_PAN_THRESHOLD = 8;
let plotSuppressClick = false;
let plotAddCoords = null;
let plotAddMenuCloser = null;
let plotWaterBodies = null;
let plotNeedsHomeCenter = true;
let interiorNeedsHomeCenter = true;

function plotCoordKey(x,y){ return x+','+y; }

function parsePlotCoordKey(key){
  const p=key.split(',');
  return { x:Number(p[0]), y:Number(p[1]) };
}

function getExplorationLevel(){
  return Number(state.skills.exploration?.level)||1;
}

function getExplorationRings(){
  const level=getExplorationLevel();
  if(level<EXPLORATION_LAYER_FIRST_LEVEL) return 0;
  return Math.floor((level-EXPLORATION_LAYER_FIRST_LEVEL)/EXPLORATION_LAYER_STEP)+1;
}

function getNextExplorationLayerLevel(){
  return EXPLORATION_LAYER_FIRST_LEVEL+getExplorationRings()*EXPLORATION_LAYER_STEP;
}

function plotLayerUnlockMessage(){
  const skill=SKILL_META.exploration?.name||'Exploration';
  return 'Reach level '+getNextExplorationLayerLevel()+' in '+skill+' to unlock the next layer!';
}

function getPlotBounds(){
  const rings=getExplorationRings();
  return {
    minX:PLOT_CORE.minX-rings,
    maxX:PLOT_CORE.maxX+rings,
    minY:PLOT_CORE.minY-rings,
    maxY:PLOT_CORE.maxY+rings,
  };
}

function isCoordInUnlockedPlot(x,y){
  const b=getPlotBounds();
  return x>=b.minX&&x<=b.maxX&&y>=b.minY&&y<=b.maxY;
}

function getPlotRenderBounds(){
  const b=getPlotBounds();
  return {
    minX:b.minX-1,
    maxX:b.maxX+1,
    minY:b.minY-1,
    maxY:b.maxY+1,
  };
}

function isCoordInCore(x,y){
  return x>=PLOT_CORE.minX&&x<=PLOT_CORE.maxX&&y>=PLOT_CORE.minY&&y<=PLOT_CORE.maxY;
}

function getPlotCell(x,y){
  return state.plot?.cells?.[plotCoordKey(x,y)]||null;
}

function setPlotCell(x,y,slot){
  const key=plotCoordKey(x,y);
  if(!state.plot.cells) state.plot.cells={};
  if(slot) state.plot.cells[key]=slot;
  else delete state.plot.cells[key];
}

function forEachPlotCell(fn){
  const b=getPlotBounds();
  for(let y=b.minY;y<=b.maxY;y++){
    for(let x=b.minX;x<=b.maxX;x++) fn(x,y,getPlotCell(x,y));
  }
}

function forEachPlotOccupied(fn){
  Object.entries(state.plot?.cells||{}).forEach(([key,slot])=>{
    if(!slot) return;
    const {x,y}=parsePlotCoordKey(key);
    fn(x,y,slot);
  });
}

function migratePlotCellsFromSlots(slots){
  state.plot.cells={};
  slots.forEach((slot,i)=>{
    const coord=PLOT_INDEX_TO_COORD[i];
    if(!coord) return;
    if(slot) state.plot.cells[plotCoordKey(coord[0],coord[1])]=slot;
  });
}

function plotHasOccupiedCells(){
  const cells=state.plot?.cells;
  if(!cells||typeof cells!=='object'||Array.isArray(cells)) return false;
  return Object.keys(cells).some(key=>cells[key]);
}

function normalizePlotCellsStore(){
  if(!state.plot) state.plot={ cells:null, editMode:false, panX:0, panY:0 };
  const cells=state.plot.cells;
  if(Array.isArray(cells)){
    const obj={};
    cells.forEach((slot,i)=>{
      const coord=PLOT_INDEX_TO_COORD[i];
      if(coord&&slot) obj[plotCoordKey(coord[0],coord[1])]=slot;
    });
    state.plot.cells=obj;
    return;
  }
  if(cells&&typeof cells!=='object'){
    state.plot.cells=null;
  }
}

function migrateQuarryTypeIds(){
  if(!state.plot?.cells) return;
  Object.values(state.plot.cells).forEach(cell=>{
    if(cell?.typeId==='flint_deposit') cell.typeId='brick_deposit';
  });
}

function migratePlot(){
  if(!state.plot) state.plot={ cells:null, editMode:false, panX:0, panY:0 };
  if(state.plot.panX==null) state.plot.panX=0;
  if(state.plot.panY==null) state.plot.panY=0;
  if(!state.plotConfigs) state.plotConfigs={};
  normalizePlotCellsStore();
  migrateQuarryTypeIds();
  if(typeof migrateWell==='function') migrateWell();
  if(typeof migrateFirePit==='function') migrateFirePit();

  if(plotHasOccupiedCells()){
    migrateWoodlandTiles();
    return;
  }

  if(state.plot.slots?.length){
    migratePlotCellsFromSlots(state.plot.slots);
    delete state.plot.slots;
    migrateWoodlandTiles();
    return;
  }

  if(!state.plotLayout){
    state.plot.cells={};
    PLOT_STARTER_CELLS.forEach(s=>{
      state.plot.cells[plotCoordKey(s.x,s.y)]={ instanceId:s.instanceId, typeId:s.typeId };
      const def=getPlotTileDef(s.typeId);
      if(def&&!state.plotConfigs[s.instanceId])
        state.plotConfigs[s.instanceId]=defaultPlotConfig(def.behavior, s.typeId);
    });
    migrateWoodlandTiles();
    return;
  }

  const legacy=state.plotLayout||['tree','hut','empty1','empty2','rock','pond'];
  const typeMap={ hut:'hut', tree:'woodland_clearing', rock:'quarry_basic', pond:'water_basic' };
  const idMap={ hut:'plot_hut', tree:'plot_tree_1', rock:'plot_rock_1', pond:'plot_water_1' };
  const slots=[];
  legacy.forEach(key=>{
    if(!key||String(key).startsWith('empty')){ slots.push(null); return; }
    const typeId=typeMap[key];
    if(!typeId){ slots.push(null); return; }
    const instanceId=idMap[key]||genPlotInstanceId();
    slots.push({ instanceId, typeId });
    if(typeId==='woodland_clearing'||typeId?.startsWith('woodland_')){
      const def=getPlotTileDef(typeId);
      state.plotConfigs[instanceId]={ treeChops:state.treeChops||0, woodlandId:def?.woodlandId||1 };
    }else if(typeId==='water_basic'&&state._seenPond){
      state.plotConfigs[instanceId]={ seen:true };
    }else if(!state.plotConfigs[instanceId]){
      state.plotConfigs[instanceId]=defaultPlotConfig(getPlotTileDef(typeId).behavior, typeId);
    }
  });
  while(slots.length<PLOT_SLOT_COUNT) slots.push(null);
  migratePlotCellsFromSlots(slots.slice(0,PLOT_SLOT_COUNT));
  delete state.plot.slots;
  migrateWoodlandTiles();
}

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
  if(currentLvl>=requiredLvl&&currentLvl>=rec) return '';
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
  const locked=wcLvl<unlock;
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
  const loc=getGatheringByKey(gatherKey);
  if(!loc) return '';
  return loc.drops.map(d=>d.name+(d.rare?' (rare)':'')).join(' · ');
}

function buildCavePlotAddItem(id, def, x, y){
  return '<button type="button" class="plot-add-item" onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'
    +plotAddItemTitleRow(def.name, '')
    +'</span></button>';
}

function buildGatheringPlotAddItem(id, def, x, y){
  const drops=formatGatheringDrops(def.gatherKey);
  return '<button type="button" class="plot-add-item" onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'
    +plotAddItemTitleRow(def.name, '')
    +'<span class="plot-add-item-drops">'+drops+'</span>'
    +'</span></button>';
}

function buildWaterPlotAddItem(id, def, x, y){
  return '<button type="button" class="plot-add-item" onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'
    +plotAddItemTitleRow(def.name, '')
    +'<span class="plot-add-item-drops">Different configurations of water may attract different types of fish.</span>'
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
  return Math.min(1, GATHER_BASE_SUCCESS + Math.max(0,lvl-1)*GATHER_SUCCESS_PER_LEVEL);
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
  return '<div class="plot-activity-top well-activity-top well-'+vis.stage+'">'
    +'<div class="well-sprite">'
    +'<span class="well-icon">'+vis.icon+'</span>'
    +'<span class="well-label">'+vis.label+'</span></div></div>'
    +'<div class="plot-activity-menu-zone well-menu-zone">'
    +'<button type="button" class="plot-menu-btn well-menu-btn" onclick="wellMenuTap(event)">menu</button>'
    +'</div>'
    +(editMode?'<div class="plot-edit-hint">remove</div>':'');
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
    +(complete
      ?'<div class="plot-activity-top fire-pit-quick-zone">'
        +'<button type="button" class="int-quick-action-btn fire-pit-quick-action-btn" onclick="firePitQuickTap(event)">'+quick+'</button>'
      +'</div>'
      :'')
    +'<div class="plot-activity-menu-zone fire-pit-menu-zone">'
    +'<button type="button" class="plot-menu-btn fire-pit-menu-btn" onclick="firePitMenuTap(event)">menu</button>'
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
  if(behavior==='well') return { bricks:0, bucketless:false, equipped:false, freePlaced:false };
  if(behavior==='fire_pit') return { stone:0, clay:0, bricks:0, complete:false, freePlaced:false };
  if(behavior==='farm') return { seedKey:null, cropKey:null, seedQty:0, plantedAt:null };
  return {};
}

function getPlotTileDef(typeId){
  return PLOT_TILE_DEFS[typeId]||null;
}

function getPlotConfig(instanceId, behavior, typeId){
  if(!state.plotConfigs) state.plotConfigs={};
  if(!state.plotConfigs[instanceId]){
    state.plotConfigs[instanceId]=defaultPlotConfig(behavior, typeId);
  }
  return state.plotConfigs[instanceId];
}

function plotDragIconForSlot(slot){
  if(!slot) return '＋';
  const def=getPlotTileDef(slot.typeId);
  return def?.icon||'📦';
}

function applyPlotPan(){
  const world=document.getElementById('plot-world');
  if(world){
    world.style.transform='translate('+state.plot.panX+'px,'+state.plot.panY+'px)';
  }
  updatePlotHomeButton();
}

function updatePlotHomeButton(){
  const btn=document.getElementById('plot-home-btn');
  const hut=document.querySelector('.plot-cell.cell-hut');
  const viewport=document.getElementById('plot-viewport');
  if(!btn||!viewport) return;
  if(!hut){ btn.classList.remove('visible'); return; }
  const v=viewport.getBoundingClientRect();
  const h=hut.getBoundingClientRect();
  const hutCx=h.left+h.width/2;
  const hutCy=h.top+h.height/2;
  const viewCx=v.left+v.width/2;
  const viewCy=v.top+v.height/2;
  const centered=Math.abs(hutCx-viewCx)<14&&Math.abs(hutCy-viewCy)<14;
  btn.classList.toggle('visible', !centered);
}

function recenterPlotOnHome(){
  migratePlot();
  const viewport=document.getElementById('plot-viewport');
  const hut=document.querySelector('.plot-cell.cell-hut');
  if(!viewport||!hut) return;
  const v=viewport.getBoundingClientRect();
  const h=hut.getBoundingClientRect();
  state.plot.panX+=(v.left+v.width/2)-(h.left+h.width/2);
  state.plot.panY+=(v.top+v.height/2)-(h.top+h.height/2);
  applyPlotPan();
}

function clearPlotTileConfig(instanceId, typeId){
  const def=getPlotTileDef(typeId);
  if(def?.behavior==='water'&&fish.running) stopFishing(true);
  if(def?.behavior==='gather'&&gather.running&&gather.instanceId===instanceId) stopGathering(true);
  if(def?.behavior==='quarry'&&mine.instanceId===instanceId){
    stopMining(true);
    mine.stacks=0;
    mine.instanceId=null;
  }
  if(def?.behavior==='tree'&&wc.treeInstanceId===instanceId) wc.treeInstanceId=null;
  if(def?.behavior==='well'&&typeof setActiveWell==='function'&&activeWellInstanceId===instanceId) setActiveWell(null);
  if(def?.behavior==='fire_pit'&&typeof setActiveFirePit==='function'&&activeFirePitInstanceId===instanceId) setActiveFirePit(null);
  if(def?.behavior==='farm'&&typeof setActiveFarm==='function'&&activeFarmInstanceId===instanceId) setActiveFarm(null);
  delete state.plotConfigs[instanceId];
}

function togglePlotEditMode(){
  migratePlot();
  state.plot.editMode=!state.plot.editMode;
  closePlotAddMenu();
  hideAllPlotActivityMenus();
  updatePlotEditUI();
  renderPlotGrid();
  showToast(state.plot.editMode?'Edit mode — reshape your land freely.':'Land saved. Back to living on it.');
}

function updatePlotEditUI(){
  const btn=document.getElementById('plot-edit-btn');
  const grid=document.getElementById('plot-grid');
  if(btn) btn.textContent=state.plot.editMode?'✓ Done editing':'✏️ Edit land';
  if(grid) grid.classList.toggle('plot-edit-mode',!!state.plot.editMode);
  document.getElementById('exterior-screen')?.classList.toggle('plot-edit-mode',!!state.plot.editMode);
}

function onEmptyPlotTap(x,y){
  if(plotSuppressClick) return;
  if(!isCoordInUnlockedPlot(x,y)){
    showToast(plotLayerUnlockMessage());
    return;
  }
  openPlotAddMenu(x,y);
}

function onPlotTileTap(event,x,y, slot){
  if(plotSuppressClick||!slot) return;
  const def=getPlotTileDef(slot.typeId);
  if(!def) return;
  if(state.plot.editMode){
    if(!def.removable) return;
    confirmRemovePlotTile(x,y, slot, def);
    return;
  }
  if(def.behavior==='hut') enterHut();
}

function buildQuarryCellHtml(slot, def, editMode){
  const isThisQuarry=mine.instanceId===slot.instanceId;
  const stacks=isThisQuarry?mine.stacks:0;
  const maxStacks=getMineMaxStacks();
  const isActive=mine.running&&isThisQuarry;
  const label=(def?.name||'Quarry').toLowerCase();
  const menuLabel=quarryMenuBtnLabel(stacks, isActive);
  return '<div class="plot-activity-top quarry-activity-top'+(isActive?' mining-active':'')+'">'
    +buildMineSparklesHtml()
    +quarryStackBadgeHtml(stacks, maxStacks)
    +'<div class="quarry-sprite">'
    +'<div class="quarry-rock-wrap">'
    +'<div class="rock-sprite"><div class="rock rock-big"></div><div class="rock rock-small"></div></div>'
    +'</div>'
    +'<span class="quarry-label">'+label+'</span>'
    +'</div></div>'
    +'<div class="plot-activity-menu-zone quarry-menu-zone">'
    +'<button type="button" class="plot-menu-btn quarry-menu-btn'+(stacks>0?' has-stacks':'')+'">'+menuLabel+'</button>'
    +'</div>'
    +(editMode?'<div class="plot-edit-hint">remove</div>':'');
}

function getMineMaxStacks(){
  return MINE_MAX_STACKS;
}

function quarryStackBadgeHtml(stacks, maxStacks){
  if(stacks<=0) return '';
  return '<div class="quarry-stack-badge"><span class="quarry-stack-count">'+stacks+'/'+maxStacks+'</span></div>';
}

function hidePlotActivityMenu(key){
  if(key&&plotActivityMenuTimers[key]){
    clearTimeout(plotActivityMenuTimers[key]);
    delete plotActivityMenuTimers[key];
  }
}

function hideAllPlotActivityMenus(){
  Object.keys(plotActivityMenuTimers).forEach(hidePlotActivityMenu);
  document.querySelectorAll('.plot-activity-menu-ready').forEach(el=>{
    el.classList.remove('plot-activity-menu-ready');
  });
}

function revealPlotActivityMenu(key, el){
  if(!key||!el) return;
  hideAllPlotActivityMenus();
  hidePlotActivityMenu(key);
  el.classList.add('plot-activity-menu-ready');
  plotActivityMenuTimers[key]=setTimeout(()=>{
    el.classList.remove('plot-activity-menu-ready');
    delete plotActivityMenuTimers[key];
  }, ACTIVITY_MENU_SHOW_MS);
}

function isPlotMenuZone(el, clientY){
  const rect=el.getBoundingClientRect();
  return (clientY-rect.top)/rect.height>=0.66;
}

function handleWellCellTap(e, cell, slot){
  setActiveWell(slot.instanceId);
  if(e.target?.closest('.plot-menu-btn')){ wellMenuTap(e); return; }
  if(isPlotMenuZone(cell, e.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    wellMenuTap(e);
    return;
  }
  const cfg=typeof getWellConfig==='function'?getWellConfig(slot.instanceId):null;
  if(getWellStage(cfg)==='building'&&typeof placeWellBrick==='function') placeWellBrick(e, slot.instanceId);
  const freshCell=document.querySelector('.plot-cell.cell-well[data-instance-id="'+slot.instanceId+'"]')||cell;
  revealPlotActivityMenu('well:'+slot.instanceId, freshCell);
}

function handleFirePitCellTap(e, cell, slot){
  setActiveFirePit(slot.instanceId);
  if(e.target?.closest('.fire-pit-quick-action-btn')){ firePitQuickTap(e); return; }
  if(e.target?.closest('.plot-menu-btn')){ firePitMenuTap(e); return; }
  if(isPlotMenuZone(cell, e.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    firePitMenuTap(e);
    return;
  }
  const cfg=typeof getFirePitConfig==='function'?getFirePitConfig(slot.instanceId):null;
  if(getFirePitStage(cfg)==='building'&&typeof placeFirePitMaterial==='function'){
    const next=FIRE_PIT_MATERIALS.find(m=>(cfg[m.countKey]|0)<m.required);
    if(next) placeFirePitMaterial(e, slot.instanceId, next.key);
  }
  const freshCell=document.querySelector('.plot-cell.cell-fire-pit[data-instance-id="'+slot.instanceId+'"]')||cell;
  revealPlotActivityMenu('fire_pit:'+slot.instanceId, freshCell);
}

function handleWoodlandCellTap(e, cell, slot){
  if(e.target?.closest('.plot-menu-btn')){ wcMenuTap(e, cell); return; }
  if(isPlotMenuZone(cell, e.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    wcMenuTap(e, cell);
    return;
  }
  chopTree(e, slot.instanceId);
  revealPlotActivityMenu('wc:'+slot.instanceId, cell);
}

function quarryMenuSplitActive(cell){
  return cell.classList.contains('plot-activity-menu-ready')||cell.classList.contains('has-mine-stacks');
}

function handleQuarryCellTap(e, cell, slot){
  if(e.target?.closest('.plot-menu-btn')&&quarryMenuSplitActive(cell)){
    quarryMenuTap(e, cell);
    return;
  }
  if(quarryMenuSplitActive(cell)&&isPlotMenuZone(cell, e.clientY)){
    quarryMenuTap(e, cell);
    return;
  }
  addMineStack(slot.instanceId);
  revealPlotActivityMenu('quarry:'+slot.instanceId, cell);
}

function handleGatherCellTap(e, cell, slot){
  if(e.target?.closest('.plot-menu-btn')){ gatherMenuTap(e, cell); return; }
  if(isPlotMenuZone(cell, e.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    gatherMenuTap(e, cell);
    return;
  }
  const instanceId=slot.instanceId;
  if(gather.running&&gather.instanceId===instanceId){
    revealPlotActivityMenu('gather:'+instanceId, cell);
    return;
  }
  if(gather.running&&gather.instanceId!==instanceId){
    if(invTotal()>=INV_CAP){
      showToast('Bag full ('+INV_CAP+'/'+INV_CAP+') — make room before foraging.');
      revealPlotActivityMenu('gather:'+instanceId, cell);
      return;
    }
    switchGatheringSpot(instanceId);
    revealPlotActivityMenu('gather:'+instanceId, cell);
    return;
  }
  if(invTotal()>=INV_CAP){
    showToast('Bag full ('+INV_CAP+'/'+INV_CAP+') — make room before foraging.');
    revealPlotActivityMenu('gather:'+instanceId, cell);
    return;
  }
  startGathering(instanceId);
  revealPlotActivityMenu('gather:'+instanceId, cell);
}

function handleWaterSurfaceTap(e, surface){
  const pondId=surface.dataset.instanceId||null;
  const menuKey='pond:'+(surface.dataset.waterBodyId||pondId||'spot');
  if(e.target?.closest('.plot-menu-btn')){ pondMenuTap(e, surface); return; }
  if(isPlotMenuZone(surface, e.clientY)&&surface.classList.contains('plot-activity-menu-ready')){
    pondMenuTap(e, surface);
    return;
  }
  notePondSeen();
  if(fish.running&&pondId&&fish.pondInstanceId===pondId){
    revealPlotActivityMenu(menuKey, surface);
    return;
  }
  if(fish.running&&pondId&&fish.pondInstanceId!==pondId){
    if(invTotal()>=INV_CAP){
      showToast('Bag is full — make room for fish.');
      revealPlotActivityMenu(menuKey, surface);
      return;
    }
    switchFishingSpot(pondId);
    revealPlotActivityMenu(menuKey, surface);
    return;
  }
  if(pondId) fish.pondInstanceId=pondId;
  if(invTotal()>=INV_CAP){
    showToast('Bag is full — make room for fish.');
    revealPlotActivityMenu(menuKey, surface);
    return;
  }
  startFishing(pondId);
  revealPlotActivityMenu(menuKey, surface);
}

function confirmRemovePlotTile(x,y, slot, def){
  showChoiceBanner(
    'Clear this tile?',
    def.icon,
    'Remove '+def.name+'? Nothing is lost forever — you can always build something else here.',
    'Clear tile',
    'Keep it',
    ()=>removePlotTile(x,y)
  );
}

function removePlotTile(x,y){
  const slot=getPlotCell(x,y);
  if(!slot) return;
  const def=getPlotTileDef(slot.typeId);
  if(!def?.removable) return;
  if(def.behavior==='well'&&typeof setActiveWell==='function'&&activeWellInstanceId===slot.instanceId){
    setActiveWell(null);
    if(currentScreen==='well-screen'&&typeof closeWellScreen==='function') closeWellScreen();
  }
  if(def.behavior==='fire_pit'&&typeof setActiveFirePit==='function'&&activeFirePitInstanceId===slot.instanceId){
    setActiveFirePit(null);
    if(currentScreen==='fire-pit-screen'&&typeof closeFirePitScreen==='function') closeFirePitScreen();
  }
  clearPlotTileConfig(slot.instanceId, slot.typeId);
  setPlotCell(x,y,null);
  renderPlotGrid();
  showToast(def.icon+' Cleared. Your land, your rules.');
}

function structurePlotAddItemHtml(id, def, x, y, opts){
  const unlocked=!!opts?.unlocked;
  const disabled=!!opts?.disabled;
  const drops=opts?.drops||(unlocked?'Unlocked. Free to place':'Locked. Place structure to finish building');
  const cls='plot-add-item '+(unlocked?'structure-unlocked':'structure-locked'+(disabled?' is-disabled':''));
  return '<button type="button" class="'+cls+'"'+(disabled?' disabled':'')+' onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'+def.name
    +'<span class="plot-add-item-drops">'+drops+'</span></span></button>';
}

function buildStructurePlotAddItem(id, def, x, y){
  if(id==='well_finished'){
    const unlocked=typeof isWellFinishedUnlocked==='function'&&isWellFinishedUnlocked();
    return structurePlotAddItemHtml(id, def, x, y, { unlocked, disabled:!unlocked });
  }
  if(id==='well'){
    if(typeof isWellFinishedUnlocked==='function'&&isWellFinishedUnlocked()) return '';
    const unlocked=typeof isWellUnlocked==='function'&&isWellUnlocked();
    const canPlace=typeof canPlaceWell==='function'&&canPlaceWell();
    return structurePlotAddItemHtml(id, def, x, y, { unlocked, disabled:!canPlace });
  }
  if(id==='fire_pit'){
    if(typeof canUseFirePitStructure==='function'&&!canUseFirePitStructure()){
      return structurePlotAddItemHtml(id, def, x, y, {
        unlocked:false,
        disabled:true,
        drops:'Need Architecture Lv '+FIRE_PIT_ARCH_UNLOCK,
      });
    }
    const unlocked=typeof isFirePitUnlocked==='function'&&isFirePitUnlocked();
    const canPlace=typeof canPlaceFirePit==='function'&&canPlaceFirePit();
    return structurePlotAddItemHtml(id, def, x, y, { unlocked, disabled:!canPlace });
  }
  return structurePlotAddItemHtml(id, def, x, y, { unlocked:false, disabled:false });
}

function placePlotTile(x,y, typeId){
  migratePlot();
  if(getPlotCell(x,y)) return;
  const def=getPlotTileDef(typeId);
  if(!def) return;
  if(!def.removable) return;
  if(def.behavior==='well'&&typeId==='well'&&typeof canPlaceWell==='function'&&!canPlaceWell()){
    showToast('Finish building your first well before placing another.');
    return;
  }
  if(def.behavior==='well'&&typeId==='well_finished'&&typeof isWellFinishedUnlocked==='function'&&!isWellFinishedUnlocked()){
    showToast('Finish a well with rope and bucket first.');
    return;
  }
  if(def.behavior==='fire_pit'){
    if(typeof canUseFirePitStructure==='function'&&!canUseFirePitStructure()){
      showToast('Need Architecture Lv '+FIRE_PIT_ARCH_UNLOCK+' for Fire Pit.');
      return;
    }
    if(typeof canPlaceFirePit==='function'&&!canPlaceFirePit()){
      showToast('Finish building your first fire pit before placing another.');
      return;
    }
  }
  if(def.unlockLevel){
    if(def.behavior==='quarry'&&def.unlockLevel>(Number(state.skills.mining?.level)||1)){
      showToast('Need Mining Lv '+def.unlockLevel+' for '+def.name+'.');
      return;
    }
    if(def.behavior==='tree'&&def.unlockLevel>getWoodcutLevel()){
      showToast('Need Woodcutting Lv '+def.unlockLevel+' for '+def.name+'.');
      return;
    }
  }
  const instanceId=genPlotInstanceId();
  setPlotCell(x,y,{ instanceId, typeId });
  state.plotConfigs[instanceId]=defaultPlotConfig(def.behavior, typeId);
  closePlotAddMenu();
  if(def.behavior==='well'){
    migrateWell();
    const cfg=getWellConfig(instanceId);
    setActiveWell(instanceId);
    if(typeId==='well_finished'){
      cfg.bricks=WELL_BRICKS_REQUIRED;
      cfg.bucketless=true;
      cfg.equipped=true;
      cfg.freePlaced=true;
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Well placed.');
    }else if(state.wellUnlocked){
      cfg.bricks=WELL_BRICKS_REQUIRED;
      cfg.bucketless=true;
      cfg.freePlaced=true;
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Well (bucketless) placed.');
    }else{
      scheduleSaveGame();
      renderPlotGrid();
      showToast('You mark out the site. Now you need bricks.');
    }
    return;
  }
  if(def.behavior==='fire_pit'){
    migrateFirePit();
    const cfg=getFirePitConfig(instanceId);
    setActiveFirePit(instanceId);
    if(state.firePitUnlocked){
      FIRE_PIT_MATERIALS.forEach(m=>{ cfg[m.countKey]=m.required; });
      cfg.complete=true;
      cfg.freePlaced=true;
      scheduleSaveGame();
      renderPlotGrid();
      showToast('Fire pit placed.');
    }else{
      scheduleSaveGame();
      renderPlotGrid();
      showToast('You mark out the site. Stone, clay, and bricks needed.');
    }
    return;
  }
  renderPlotGrid();
  showToast(def.icon+' '+def.name+' placed.');
}

function closePlotAddMenu(){
  document.getElementById('plot-add-menu')?.remove();
  plotAddCoords=null;
  if(plotAddMenuCloser){
    document.removeEventListener('pointerdown',plotAddMenuCloser,true);
    plotAddMenuCloser=null;
  }
}

function openPlotAddMenu(x,y){
  closePlotAddMenu();
  hideAllPlotActivityMenus();
  plotAddCoords={ x, y };
  const w=document.getElementById('game-wrapper');
  const m=document.createElement('div');
  m.id='plot-add-menu';
  m.className='plot-add-menu';
  m.onclick=(e)=>e.stopPropagation();
  let catsHtml='';
  PLOT_TILE_MENU.forEach(cat=>{
    const wcLvl=getWoodcutLevel();
    const mineLvl=Number(state.skills.mining?.level)||1;
    const items=cat.items.map(id=>{
      const def=PLOT_TILE_DEFS[id];
      if(!def) return '';
      if(cat.id==='woodland'){
        return buildWoodlandPlotAddItem(id, def, wcLvl, x, y);
      }
      if(cat.id==='gathering'){
        return buildGatheringPlotAddItem(id, def, x, y);
      }
      if(cat.id==='quarry'){
        return buildQuarryPlotAddItem(id, def, mineLvl, x, y);
      }
      if(cat.id==='cave'){
        return buildCavePlotAddItem(id, def, x, y);
      }
      if(cat.id==='structures'){
        return buildStructurePlotAddItem(id, def, x, y);
      }
      if(cat.id==='water'){
        return buildWaterPlotAddItem(id, def, x, y);
      }
      return '<button type="button" class="plot-add-item" onclick="placePlotTile('+x+','+y+',\''+id+'\')">'
        +'<span class="plot-add-item-icon">'+def.icon+'</span>'
        +'<span class="plot-add-item-name">'+def.name+'</span></button>';
    }).join('');
    catsHtml+='<div class="plot-add-cat">'
      +'<button type="button" class="plot-add-cat-head" onclick="togglePlotAddCategory(this)">'
      +'<span>'+cat.label+'</span><span class="plot-add-cat-chevron">▸</span></button>'
      +'<div class="plot-add-cat-body">'
      +(cat.desc?'<div class="plot-add-cat-desc">'+cat.desc+'</div>':'')
      +items
      +'</div></div>';
  });
  m.innerHTML='<div class="plot-add-title">ADD TO YOUR LAND</div>'
    +'<div class="plot-add-sub">Pick what belongs here. You can change your mind anytime.</div>'
    +'<div class="plot-add-cats">'+catsHtml+'</div>'
    +'<button type="button" class="plot-add-cancel" onclick="closePlotAddMenu()">cancel</button>';
  w.appendChild(m);
  setTimeout(()=>{
    plotAddMenuCloser=function(e){
      const menu=document.getElementById('plot-add-menu');
      if(!menu){
        document.removeEventListener('pointerdown',plotAddMenuCloser,true);
        plotAddMenuCloser=null;
        return;
      }
      if(menu.contains(e.target)) return;
      closePlotAddMenu();
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('pointerdown',plotAddMenuCloser,true);
  },80);
}

function togglePlotAddCategory(headBtn){
  headBtn.closest('.plot-add-cat')?.classList.toggle('open');
}

function isWaterTileAt(x,y){
  const slot=getPlotCell(x,y);
  return !!(slot&&getPlotTileDef(slot.typeId)?.behavior==='water');
}

function floodFillWaterBody(startX,startY,visited){
  const cells=[];
  const stack=[{x:startX,y:startY}];
  while(stack.length){
    const {x,y}=stack.pop();
    const key=plotCoordKey(x,y);
    if(visited.has(key)) continue;
    if(!isWaterTileAt(x,y)) continue;
    visited.add(key);
    cells.push({x,y});
    stack.push({x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1});
  }
  return cells;
}

function isWaterRiver(cells){
  if(cells.length<3) return false;
  const b=getWaterBodyBounds(cells);
  const w=b.maxX-b.minX+1;
  const h=b.maxY-b.minY+1;
  const thin=Math.min(w,h);
  const long=Math.max(w,h);
  if(thin!==1||long<3) return false;
  return cells.length===long&&isWaterBodySolidRectangle(cells);
}

function hasFilledWaterBlock(cells, blockSize){
  if(cells.length<blockSize*blockSize) return false;
  const set=new Set(cells.map(c=>plotCoordKey(c.x,c.y)));
  const xs=cells.map(c=>c.x), ys=cells.map(c=>c.y);
  const minX=Math.min(...xs), maxX=Math.max(...xs);
  const minY=Math.min(...ys), maxY=Math.max(...ys);
  for(let y=minY;y<=maxY-blockSize+1;y++){
    for(let x=minX;x<=maxX-blockSize+1;x++){
      let full=true;
      for(let dy=0;dy<blockSize&&full;dy++){
        for(let dx=0;dx<blockSize&&full;dx++){
          if(!set.has(plotCoordKey(x+dx,y+dy))) full=false;
        }
      }
      if(full) return true;
    }
  }
  return false;
}

function waterBodyTouchesEdge(cells,bounds){
  return cells.some(c=>c.x===bounds.minX||c.x===bounds.maxX||c.y===bounds.minY||c.y===bounds.maxY);
}

function classifyWaterBody(cells,bounds){
  const size=cells.length;
  const atEdge=waterBodyTouchesEdge(cells,bounds);

  if(size===1) return 'pond';
  if(isWaterRiver(cells)) return 'river';
  if(atEdge&&size>=4&&hasFilledWaterBlock(cells,2)) return 'ocean';
  if(size>=9&&hasFilledWaterBlock(cells,3)) return 'large_lake';
  if(size>=4&&hasFilledWaterBlock(cells,2)) return 'lake';
  return 'large_pond';
}

function pickWaterBodyLabelKey(cells){
  const cx=cells.reduce((s,c)=>s+c.x,0)/cells.length;
  const cy=cells.reduce((s,c)=>s+c.y,0)/cells.length;
  let best=cells[0],bestD=Infinity;
  cells.forEach(c=>{
    const d=(c.x-cx)**2+(c.y-cy)**2;
    if(d<bestD){ bestD=d; best=c; }
  });
  return plotCoordKey(best.x,best.y);
}

function getWaterBodyBounds(cells){
  const xs=cells.map(c=>c.x), ys=cells.map(c=>c.y);
  return { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys) };
}

function isWaterBodySolidRectangle(cells){
  const b=getWaterBodyBounds(cells);
  return cells.length===(b.maxX-b.minX+1)*(b.maxY-b.minY+1);
}

function decomposeWaterBodyRectangles(cells){
  const cellSet=new Set(cells.map(c=>plotCoordKey(c.x,c.y)));
  const bounds=getWaterBodyBounds(cells);
  const rects=[];

  for(let y=bounds.minY;y<=bounds.maxY;y++){
    let start=null;
    for(let x=bounds.minX;x<=bounds.maxX+1;x++){
      const inBody=x<=bounds.maxX&&cellSet.has(plotCoordKey(x,y));
      if(inBody&&start===null) start=x;
      if(!inBody&&start!==null){
        const seg={ minX:start, maxX:x-1, minY:y, maxY:y };
        const stacked=rects.find(r=>r.maxY===y-1&&r.minX===seg.minX&&r.maxX===seg.maxX);
        if(stacked) stacked.maxY=y;
        else rects.push(seg);
        start=null;
      }
    }
  }
  return rects;
}

function waterRectSurfaceLayout(rect, plotBounds){
  const cell=PLOT_CELL_PX, gap=PLOT_CELL_GAP, pad=PLOT_GRID_PAD;
  const col0=rect.minX-plotBounds.minX;
  const row0=rect.minY-plotBounds.minY;
  const cols=rect.maxX-rect.minX+1;
  const rows=rect.maxY-rect.minY+1;
  return {
    left:pad+col0*(cell+gap),
    top:pad+row0*(cell+gap),
    width:cols*cell+(cols-1)*gap,
    height:rows*cell+(rows-1)*gap,
  };
}

function getWaterPieceMergeClasses(rect, cellSet){
  let cls='';
  for(let x=rect.minX;x<=rect.maxX;x++){
    if(cellSet.has(plotCoordKey(x,rect.minY-1))){ cls+=' water-piece-merge-top'; break; }
  }
  for(let x=rect.minX;x<=rect.maxX;x++){
    if(cellSet.has(plotCoordKey(x,rect.maxY+1))){ cls+=' water-piece-merge-bottom'; break; }
  }
  for(let y=rect.minY;y<=rect.maxY;y++){
    if(cellSet.has(plotCoordKey(rect.minX-1,y))){ cls+=' water-piece-merge-left'; break; }
  }
  for(let y=rect.minY;y<=rect.maxY;y++){
    if(cellSet.has(plotCoordKey(rect.maxX+1,y))){ cls+=' water-piece-merge-right'; break; }
  }
  return cls;
}

function waterBodyHash(str){
  let h=0;
  for(let i=0;i<str.length;i++) h=((h<<5)-h+str.charCodeAt(i))|0;
  return Math.abs(h);
}

function getWaterBandDirection(bodyId){
  return waterBodyHash(bodyId)%3;
}

function applyWaterBandAppearance(surface, bodyId, rect, bodyType){
  const cellPx=PLOT_CELL_PX, gap=PLOT_CELL_GAP, period=WATER_BAND_PERIOD;
  const worldX=rect.minX*(cellPx+gap);
  const worldY=rect.minY*(cellPx+gap);
  const ocean=bodyType==='ocean';
  const c0=ocean?'#1a2c3c':'#243848';
  const c1=ocean?'#223648':'#2d4454';
  const hi=ocean?'rgba(58,108,142,0.2)':'rgba(72,132,162,0.17)';
  const dir=getWaterBandDirection(bodyId);
  const mid=(period*0.48).toFixed(1);

  surface.style.backgroundColor=c0;
  if(dir===0){
    surface.classList.add('water-bands-h');
    surface.style.backgroundImage='repeating-linear-gradient(180deg,'+c0+' 0px,'+c0+' '+mid+'px,'+hi+' '+mid+'px,'+c1+' '+period+'px)';
    surface.style.backgroundSize='100% '+period+'px';
    surface.style.backgroundPosition='0px '+(-worldY)+'px';
  }else if(dir===1){
    surface.classList.add('water-bands-d1');
    surface.style.backgroundImage='repeating-linear-gradient(135deg,'+c0+' 0px,'+c0+' 8px,'+hi+' 8px,'+c1+' 16px)';
    surface.style.backgroundSize='24px 24px';
    surface.style.backgroundPosition=( -(worldX+worldY))+'px '+(-worldY)+'px';
  }else{
    surface.classList.add('water-bands-d2');
    surface.style.backgroundImage='repeating-linear-gradient(45deg,'+c0+' 0px,'+c0+' 8px,'+hi+' 8px,'+c1+' 16px)';
    surface.style.backgroundSize='24px 24px';
    surface.style.backgroundPosition=( -(worldX-worldY))+'px '+(-worldY)+'px';
  }
}

function buildWaterBodySurfaceHtml(typeName, opts){
  const labelText=(typeName||'Pond').toLowerCase();
  const showLabel=opts?.label!==false;
  const showDecor=!!opts?.decor;
  const icon=opts?.icon||'🎣';
  let decorHtml='';
  if(showDecor){
    let sparkles='';
    for(let i=0;i<14;i++){
      const star=i%3===0;
      const sym=star?['✦','✧','⋆'][i%3]:'';
      sparkles+='<span class="fish-sparkle'+(star?' sparkle-star':'')+'" style="left:'+(5+((i*13)%88))+'%;top:'+(10+((i*19)%78))+'%;animation-delay:'+(i*0.1)+'s;animation-duration:'+(0.9+(i%4)*0.15)+'s;">'+sym+'</span>';
    }
    decorHtml='<div class="fish-sparkles">'+sparkles+'</div>'
      +'<div class="water-shimmer"></div><div class="water-shimmer"></div>';
  }
  let labelHtml=showLabel
    ?'<div class="pond-sprite"><span class="pond-icon">'+icon+'</span><div class="water-label pond-label">'+labelText+'</div></div>'
    :'';
  return '<div class="plot-activity-top pond-activity-top">'+decorHtml+labelHtml+'</div>'
    +'<div class="plot-activity-menu-zone pond-menu-zone">'
    +'<button type="button" class="plot-menu-btn pond-menu-btn" onclick="pondMenuTap(event)">menu</button>'
    +'</div>';
}

function waterBodyPlotIcon(bodyType){
  if(bodyType==='ocean') return '🌊';
  if(bodyType==='river') return '🏞️';
  return '🎣';
}

function attachWaterSurfaceHandlers(_surface){
  /* tap handled via plot viewport pointer (pan vs tap) */
}

function renderWaterBodyOverlays(grid, wbData, plotBounds){
  grid.querySelectorAll('.plot-water-layer,.plot-water-defs').forEach(n=>n.remove());
  if(!wbData) return;

  const layer=document.createElement('div');
  layer.className='plot-water-layer';
  layer.id='plot-water-layer';

  Object.values(wbData.bodies).forEach(body=>{
    const cellSet=new Set(body.cells.map(c=>plotCoordKey(c.x,c.y)));
    const primary=body.cells.find(c=>plotCoordKey(c.x,c.y)===body.labelKey)||body.cells[0];
    const slot=getPlotCell(primary.x, primary.y);
    const instanceId=slot?.instanceId||'';
    const typeCfg=WATER_BODY_TYPES[body.type];
    const typeName=typeCfg?.name||'Pond';
    const solid=isWaterBodySolidRectangle(body.cells);
    const rects=solid?[getWaterBodyBounds(body.cells)]:decomposeWaterBodyRectangles(body.cells);

    rects.forEach(rect=>{
      const layout=waterRectSurfaceLayout(rect, plotBounds);
      const surface=document.createElement('div');
      surface.className='water-body-surface cell-'+body.type.replace(/_/g,'-');
      surface.dataset.waterBodyId=body.id;
      surface.dataset.instanceId=instanceId;
      surface.style.left=layout.left+'px';
      surface.style.top=layout.top+'px';
      surface.style.width=layout.width+'px';
      surface.style.height=layout.height+'px';

      if(!solid){
        getWaterPieceMergeClasses(rect, cellSet).trim().split(/\s+/).filter(Boolean).forEach(cls=>surface.classList.add(cls));
      }

      applyWaterBandAppearance(surface, body.id, rect, body.type);
      const isPrimary=primary.x>=rect.minX&&primary.x<=rect.maxX&&primary.y>=rect.minY&&primary.y<=rect.maxY;
      surface.innerHTML=buildWaterBodySurfaceHtml(typeName, {
        label:true,
        decor:solid||isPrimary,
        icon:waterBodyPlotIcon(body.type),
      });
      attachWaterSurfaceHandlers(surface);
      layer.appendChild(surface);
    });
  });

  grid.appendChild(layer);
}

function getWaterBodySurface(bodyId){
  return document.querySelector('.water-body-surface[data-water-body-id="'+bodyId+'"]');
}

function computeWaterBodies(){
  migratePlot();
  const bounds=getPlotBounds();
  const visited=new Set();
  const bodies={};
  const cellToBody={};
  const instanceToBody={};
  let nextId=1;

  forEachPlotOccupied((x,y,slot)=>{
    if(getPlotTileDef(slot.typeId)?.behavior!=='water') return;
    const key=plotCoordKey(x,y);
    if(visited.has(key)) return;
    const cells=floodFillWaterBody(x,y,visited);
    const id='wb_'+nextId++;
    const type=classifyWaterBody(cells,bounds);
    const labelKey=pickWaterBodyLabelKey(cells);
    bodies[id]={ id,type,cells,labelKey };
    cells.forEach(c=>{
      const ck=plotCoordKey(c.x,c.y);
      cellToBody[ck]=id;
      const cellSlot=getPlotCell(c.x,c.y);
      if(cellSlot?.instanceId) instanceToBody[cellSlot.instanceId]=id;
    });
  });

  plotWaterBodies={ bodies,cellToBody,instanceToBody };
  return plotWaterBodies;
}

function getWaterBodyByInstanceId(instanceId){
  if(!plotWaterBodies) computeWaterBodies();
  const bodyId=plotWaterBodies?.instanceToBody?.[instanceId];
  return bodyId?plotWaterBodies.bodies[bodyId]:null;
}

function getCurrentFishingWaterBody(){
  if(!fish.pondInstanceId) return null;
  return getWaterBodyByInstanceId(fish.pondInstanceId);
}

function getActiveWaterBodyId(){
  if(!fish.running||!fish.pondInstanceId) return null;
  if(!plotWaterBodies) computeWaterBodies();
  return plotWaterBodies?.instanceToBody?.[fish.pondInstanceId]||null;
}

function getAvailableFishForBody(bodyType){
  const fishKeys=WATER_BODY_TYPES[bodyType]?.fish||[];
  const fishLvl=state.skills.fishing?.level||1;
  return fishKeys.map(k=>FISH_DEFS[k]).filter(f=>f&&fishLvl>=f.level);
}

function canFishAtBody(bodyType){
  return getAvailableFishForBody(bodyType).length>0;
}

function rollFishForBody(bodyType){
  const available=getAvailableFishForBody(bodyType);
  if(!available.length) return null;
  const commons=available.filter(f=>f.rarity==='common');
  const rares=available.filter(f=>f.rarity==='rare');
  if(rares.length&&Math.random()<0.15) return rares[Math.floor(Math.random()*rares.length)];
  if(commons.length) return commons[Math.floor(Math.random()*commons.length)];
  return rares[Math.floor(Math.random()*rares.length)];
}

function buildWaterBaseCellHtml(editMode){
  return (editMode?'<div class="plot-edit-hint">remove</div>':'');
}

function createPlotCellElement(x,y,wbData){
  const slot=getPlotCell(x,y);
  const cell=document.createElement('div');
  cell.className='plot-cell';
  cell.dataset.plotX=String(x);
  cell.dataset.plotY=String(y);
  const editMode=!!state.plot?.editMode;

  if(!slot){
    const inUnlocked=isCoordInUnlockedPlot(x,y);
    if(!editMode&&!inUnlocked){
      cell.classList.add('cell-plot-margin');
      return cell;
    }
    cell.classList.add('cell-empty');
    if(inUnlocked){
      if(!isCoordInCore(x,y)) cell.classList.add('cell-frontier');
    }else{
      cell.classList.add('cell-locked-expansion');
    }
    cell.innerHTML='<span class="empty-icon">＋</span>';
    return cell;
  }

  const def=getPlotTileDef(slot.typeId);
  if(!def) return cell;
  cell.classList.add('cell-placed');
  cell.dataset.instanceId=slot.instanceId;
  cell.dataset.typeId=slot.typeId;

  if(def.behavior==='hut'){
    cell.classList.add('cell-hut');
    cell.innerHTML='<div class="hut-sprite"><div class="hut-chimney"></div><div class="smoke"></div><div class="smoke"></div>'
      +'<div class="hut-roof"></div><div class="hut-body"><div class="hut-window left"></div><div class="hut-window right"></div>'
      +'<div class="hut-door"></div></div></div>'
      +(editMode?'<div class="plot-edit-hint">home</div>':'');
    return cell;
  }

  if(def.behavior==='tree'){
    cell.classList.add('cell-tree');
    cell.innerHTML=buildWoodlandCellHtml(slot, def, editMode);
    return cell;
  }

  if(def.behavior==='water'){
    const bodyKey=plotCoordKey(x,y);
    const bodyId=wbData?.cellToBody?.[bodyKey]||null;
    cell.classList.add('cell-water-base');
    if(bodyId) cell.dataset.waterBodyId=bodyId;
    cell.innerHTML=buildWaterBaseCellHtml(editMode);
    return cell;
  }

  if(def.behavior==='quarry'){
    cell.classList.add('cell-quarry');
    cell.innerHTML=buildQuarryCellHtml(slot, def, editMode);
    return cell;
  }

  if(def.behavior==='gather'){
    const loc=getGatheringByKey(def.gatherKey);
    cell.classList.add('cell-gather','cell-gather-'+(loc?.key||'spot'));
    cell.innerHTML=buildGatherCellHtml(def, editMode);
    return cell;
  }

  if(def.behavior==='cave'){
    cell.classList.add('cell-cave');
    cell.innerHTML=buildCaveCellHtml(def, editMode);
    return cell;
  }

  if(def.behavior==='farm'){
    const cfg=typeof getFarmConfig==='function'?getFarmConfig(slot.instanceId):null;
    const vis=typeof getFarmVisualState==='function'?getFarmVisualState(cfg):null;
    cell.classList.add('cell-farm');
    if(vis?.stage==='growing') cell.classList.add('farm-growing');
    if(vis?.stage==='ready') cell.classList.add('farm-ready');
    cell.innerHTML=buildFarmCellHtml(slot, def, editMode);
    return cell;
  }

  if(def.behavior==='well'){
    cell.classList.add('cell-well');
    cell.innerHTML=buildWellCellHtml(slot, def, editMode);
    return cell;
  }

  if(def.behavior==='fire_pit'){
    cell.classList.add('cell-fire-pit');
    cell.innerHTML=buildFirePitCellHtml(slot, def, editMode);
    return cell;
  }

  return cell;
}

function renderPlotGrid(){
  migratePlot();
  const grid=document.getElementById('plot-grid');
  if(!grid) return;
  try{
  const wbData=computeWaterBodies();
  const b=getPlotRenderBounds();
  const cols=b.maxX-b.minX+1;
  const rows=b.maxY-b.minY+1;
  grid.style.setProperty('--plot-cell-px', PLOT_CELL_PX+'px');
  grid.style.setProperty('--plot-cell-gap', PLOT_CELL_GAP+'px');
  grid.style.gridTemplateColumns='repeat('+cols+', '+PLOT_CELL_PX+'px)';
  grid.style.gridTemplateRows='repeat('+rows+', '+PLOT_CELL_PX+'px)';
  grid.innerHTML='';
  for(let y=b.minY;y<=b.maxY;y++){
    for(let x=b.minX;x<=b.maxX;x++){
      grid.appendChild(createPlotCellElement(x,y,wbData));
    }
  }
  renderWaterBodyOverlays(grid, wbData, b);
  updatePlotEditUI();
  updatePondCell();
  updateGatherCells();
  updateQuarryCells();
  if(typeof updateWellCells==='function') updateWellCells();
  if(typeof updateFirePitCells==='function') updateFirePitCells();
  if(typeof updateFarmCells==='function') updateFarmCells();
  hideAllPlotActivityMenus();
  applyPlotPan();
  if(plotNeedsHomeCenter){
    plotNeedsHomeCenter=false;
    requestAnimationFrame(()=>recenterPlotOnHome());
  } else {
    updatePlotHomeButton();
  }
  }catch(err){
    console.error('[Hearthstead] Plot render failed:', err);
    showToast('Plot could not render fully — try reloading.');
  }
}

function swapPlotCells(x1,y1,x2,y2){
  if(x1===x2&&y1===y2) return;
  const a=getPlotCell(x1,y1);
  const b=getPlotCell(x2,y2);
  setPlotCell(x1,y1,b);
  setPlotCell(x2,y2,a);
  renderPlotGrid();
}

function plotCoordsFromCell(cell){
  return { x:Number(cell.dataset.plotX), y:Number(cell.dataset.plotY) };
}

function clearPlotDropTargets(){
  document.querySelectorAll('.plot-cell.plot-drop-target').forEach(c=>c.classList.remove('plot-drop-target'));
}

function isPlotCellValidDropTarget(cell, fromX, fromY){
  if(!cell||cell.dataset.plotX==null) return false;
  const tx=Number(cell.dataset.plotX), ty=Number(cell.dataset.plotY);
  if(tx===fromX&&ty===fromY) return false;
  if(cell.classList.contains('cell-empty')) return false;
  return !!getPlotCell(tx,ty);
}

function plotCellAtPoint(x,y){
  plotDragGhost?.style.setProperty('display','none');
  const waterLayer=document.getElementById('plot-water-layer');
  let restoreWater=false;
  if(waterLayer&&waterLayer.style.display!=='none'){
    waterLayer.style.display='none';
    restoreWater=true;
  }
  const under=document.elementFromPoint(x,y);
  if(restoreWater) waterLayer.style.display='';
  plotDragGhost?.style.removeProperty('display');
  return under?.closest?.('.plot-cell');
}

function startPlotDragGhost(cell,x,y){
  const {x:cx,y:cy}=plotCoordsFromCell(cell);
  const slot=getPlotCell(cx,cy);
  plotDragGhost=document.createElement('div');
  plotDragGhost.className='plot-drag-ghost '+cell.className.replace('plot-cell','').trim();
  plotDragGhost.innerHTML='<span style="font-size:32px;line-height:1;">'+plotDragIconForSlot(slot)+'</span>';
  document.getElementById('game-wrapper').appendChild(plotDragGhost);
  plotDragGhost.style.left=x+'px';
  plotDragGhost.style.top=y+'px';
}

function movePlotDragGhost(x,y){
  if(!plotDragGhost) return;
  plotDragGhost.style.left=x+'px';
  plotDragGhost.style.top=y+'px';
}

function endPlotDragGhost(){
  plotDragGhost?.remove();
  plotDragGhost=null;
}

function handlePlotPointerTap(e, cell, waterSurface){
  if(plotSuppressClick) return;
  if(waterSurface&&!state.plot?.editMode){
    if(e.target?.closest?.('.plot-menu-btn')) return;
    handleWaterSurfaceTap(e, waterSurface);
    return;
  }
  if(cell&&!state.plot?.editMode){
    const {x,y}=plotCoordsFromCell(cell);
    const slot=getPlotCell(x,y);
    const def=slot&&getPlotTileDef(slot.typeId);
    if(def?.behavior==='gather'){
      if(e.target?.closest?.('.plot-menu-btn')) return;
      handleGatherCellTap(e, cell, slot);
      return;
    }
    if(def?.behavior==='tree'){
      if(e.target?.closest?.('.plot-menu-btn')) return;
      handleWoodlandCellTap(e, cell, slot);
      return;
    }
    if(def?.behavior==='quarry'){
      handleQuarryCellTap(e, cell, slot);
      return;
    }
    if(def?.behavior==='cave'){
      openExploringMenu(slot.instanceId);
      return;
    }
    if(def?.behavior==='farm'){
      openFarmPlotMenu(slot.instanceId);
      return;
    }
    if(def?.behavior==='well'){
      if(e.target?.closest?.('.plot-menu-btn')) return;
      handleWellCellTap(e, cell, slot);
      return;
    }
    if(def?.behavior==='fire_pit'){
      if(e.target?.closest?.('.plot-menu-btn')) return;
      handleFirePitCellTap(e, cell, slot);
      return;
    }
  }
  if(!cell) return;
  const {x,y}=plotCoordsFromCell(cell);
  const slot=getPlotCell(x,y);
  if(!slot){
    onEmptyPlotTap(x,y);
    return;
  }
  onPlotTileTap(e,x,y,slot);
}

function onPlotViewportPointerDown(e){
  if(e.button!==undefined&&e.button!==0) return;
  if(e.target.closest('.plot-edit-btn')) return;
  const cell=e.target.closest('.plot-cell');
  if(e.target.closest('.plot-menu-btn')&&!cell?.classList?.contains('cell-quarry')) return;
  const waterSurface=e.target.closest('.water-body-surface');
  const canTileDrag=state.plot?.editMode&&cell&&cell.classList.contains('cell-placed')&&!cell.classList.contains('cell-hut')&&!cell.classList.contains('cell-well')&&!cell.classList.contains('cell-fire-pit');
  if(canTileDrag){
    e.preventDefault();
    onPlotTilePointerDown(e);
    return;
  }
  const viewport=document.getElementById('plot-viewport');
  try{ viewport?.setPointerCapture(e.pointerId); }catch(_err){}
  plotPanDrag={
    startX:e.clientX,
    startY:e.clientY,
    startPanX:state.plot.panX,
    startPanY:state.plot.panY,
    active:false,
    pointerId:e.pointerId,
    startCell:cell,
    startWater:waterSurface,
    viewport,
  };
  document.addEventListener('pointermove',onPlotViewportPointerMove);
  document.addEventListener('pointerup',onPlotViewportPointerUp);
  document.addEventListener('pointercancel',onPlotViewportPointerUp);
  e.preventDefault();
}

function onPlotViewportPointerMove(e){
  if(!plotPanDrag||e.pointerId!==plotPanDrag.pointerId) return;
  const dx=e.clientX-plotPanDrag.startX;
  const dy=e.clientY-plotPanDrag.startY;
  if(!plotPanDrag.active){
    if(Math.hypot(dx,dy)<PLOT_PAN_THRESHOLD) return;
    plotPanDrag.active=true;
    hideAllPlotActivityMenus();
    plotSuppressClick=true;
    document.getElementById('plot-viewport')?.classList.add('panning');
  }
  state.plot.panX=plotPanDrag.startPanX+dx;
  state.plot.panY=plotPanDrag.startPanY+dy;
  applyPlotPan();
}

function onPlotViewportPointerUp(e){
  if(!plotPanDrag||e.pointerId!==plotPanDrag.pointerId) return;
  const {active,startCell,startWater,startX,startY,viewport}=plotPanDrag;
  document.removeEventListener('pointermove',onPlotViewportPointerMove);
  document.removeEventListener('pointerup',onPlotViewportPointerUp);
  document.removeEventListener('pointercancel',onPlotViewportPointerUp);
  try{ viewport?.releasePointerCapture(e.pointerId); }catch(_err){}
  document.getElementById('plot-viewport')?.classList.remove('panning');
  const moved=Math.hypot(e.clientX-startX,e.clientY-startY)>=PLOT_PAN_THRESHOLD;
  if(active||moved){
    plotSuppressClick=true;
    setTimeout(()=>{ plotSuppressClick=false; }, 280);
  }else{
    handlePlotPointerTap(e, startCell, startWater);
  }
  plotPanDrag=null;
}

function onPlotTilePointerDown(e){
  if(e.button!==undefined&&e.button!==0) return;
  const cell=e.target.closest('.plot-cell');
  if(!cell||cell.dataset.plotX==null) return;
  if(e.target.closest('.plot-menu-btn')) return;
  const {x,y}=plotCoordsFromCell(cell);
  const slot=getPlotCell(x,y);
  if(!slot) return;
  plotDrag={ x, y, cell, startX:e.clientX, startY:e.clientY, active:false, pointerId:e.pointerId };
  cell.setPointerCapture(e.pointerId);
  cell.addEventListener('pointermove',onPlotPointerMove);
  cell.addEventListener('pointerup',onPlotPointerUp);
  cell.addEventListener('pointercancel',onPlotPointerUp);
}

function onPlotPointerMove(e){
  if(!plotDrag||e.pointerId!==plotDrag.pointerId) return;
  const dx=e.clientX-plotDrag.startX, dy=e.clientY-plotDrag.startY;
  if(!plotDrag.active){
    if(Math.hypot(dx,dy)<14) return;
    plotDrag.active=true;
    hideAllPlotActivityMenus();
    plotDrag.cell.classList.add('plot-dragging');
    startPlotDragGhost(plotDrag.cell,e.clientX,e.clientY);
  }
  movePlotDragGhost(e.clientX,e.clientY);
  clearPlotDropTargets();
  const target=plotCellAtPoint(e.clientX,e.clientY);
  if(isPlotCellValidDropTarget(target, plotDrag.x, plotDrag.y)){
    target.classList.add('plot-drop-target');
  }
}

function onPlotPointerUp(e){
  if(!plotDrag||e.pointerId!==plotDrag.pointerId) return;
  const cell=plotDrag.cell;
  const wasTap=!plotDrag.active;
  const {x,y}=plotDrag;
  const slot=getPlotCell(x,y);
  cell.releasePointerCapture(e.pointerId);
  cell.removeEventListener('pointermove',onPlotPointerMove);
  cell.removeEventListener('pointerup',onPlotPointerUp);
  cell.removeEventListener('pointercancel',onPlotPointerUp);
  if(plotDrag.active){
    const target=plotCellAtPoint(e.clientX,e.clientY);
    if(isPlotCellValidDropTarget(target, x, y)){
      const tx=Number(target.dataset.plotX), ty=Number(target.dataset.plotY);
      swapPlotCells(x,y,tx,ty);
    }
    cell.classList.remove('plot-dragging');
    clearPlotDropTargets();
    endPlotDragGhost();
    plotSuppressClick=true;
    setTimeout(()=>{ plotSuppressClick=false; }, 320);
    syncUI();
  }else if(wasTap&&slot){
    onPlotTileTap(e,x,y,slot);
  }
  plotDrag=null;
}

function initPlotGrid(){
  migratePlot();
  renderPlotGrid();
  document.getElementById('plot-viewport')?.addEventListener('pointerdown',onPlotViewportPointerDown);
}
