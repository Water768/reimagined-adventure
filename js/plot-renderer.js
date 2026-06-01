/* Hearthstead — plot grid render, pan & drag */
'use strict';

function buildPlotEmptyCellHtml(x,y,editMode,unlockable,unlocked){
  const feat=typeof getPlotFeatureTileAt==='function'?getPlotFeatureTileAt(x,y):null;
  const showFog=!!feat&&!unlocked;
  if(showFog){
    const hint=editMode&&unlockable?' · unlock':'';
    return '<span class="plot-feature-preview plot-feature-fogged" aria-hidden="true">'+feat.icon+'</span>'
      +'<span class="plot-feature-preview-label plot-feature-fogged">'+feat.name+hint+'</span>';
  }
  if(editMode&&unlockable) return '<span class="empty-icon plot-unlock-icon" aria-hidden="true">🔓</span>';
  if(unlocked) return '<span class="empty-icon" aria-hidden="true">＋</span>';
  return '';
}

function createPlotCellElement(x,y,wbData){
  const slot=getPlotCell(x,y);
  const cell=document.createElement('div');
  cell.className='plot-cell';
  cell.dataset.plotX=String(x);
  cell.dataset.plotY=String(y);
  const editMode=!!state.plot?.editMode;

  if(!slot){
    if(!isCoordInPlotWorld(x,y)){
      cell.classList.add('cell-plot-margin');
      return cell;
    }
    const unlocked=isPlotTileUnlocked(x,y);
    const unlockable=editMode&&isPlotTileUnlockable(x,y);
    cell.classList.add('cell-empty');
    if(!unlocked) cell.classList.add('cell-locked-expansion');
    if(unlockable) cell.classList.add('cell-unlockable');
    cell.innerHTML=buildPlotEmptyCellHtml(x,y,editMode,unlockable,unlocked);
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
    const bodyType=bodyId?wbData?.bodies?.[bodyId]?.type:null;
    cell.classList.add('cell-water-base','cell-water');
    if(bodyId) cell.dataset.waterBodyId=bodyId;
    cell.innerHTML=buildWaterBaseCellHtml(def, editMode, bodyType);
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

  const structureCell=typeof renderPlotStructureCell==='function'
    ?renderPlotStructureCell(cell, slot, def, x, y, editMode)
    :null;
  if(structureCell) return structureCell;

  return cell;
}

function invalidatePlotGrid(){
  plotGridLayout=null;
  plotLastWaterOverlayKey='';
  plotLastBarnOverlayKey='';
}

function plotLayoutEqual(a,b){
  if(!a||!b) return false;
  return a.minX===b.minX&&a.maxX===b.maxX&&a.minY===b.minY&&a.maxY===b.maxY
    &&a.cols===b.cols&&a.rows===b.rows;
}

function plotLayoutFromBounds(b){
  return {
    minX:b.minX,
    maxX:b.maxX,
    minY:b.minY,
    maxY:b.maxY,
    cols:b.maxX-b.minX+1,
    rows:b.maxY-b.minY+1,
  };
}

function applyPlotGridLayoutStyles(grid, layout){
  grid.style.setProperty('--plot-cell-px', PLOT_CELL_PX+'px');
  grid.style.setProperty('--plot-cell-gap', PLOT_CELL_GAP+'px');
  grid.style.gridTemplateColumns='repeat('+layout.cols+', '+PLOT_CELL_PX+'px)';
  grid.style.gridTemplateRows='repeat('+layout.rows+', '+PLOT_CELL_PX+'px)';
}

function getPlotCellElement(x,y){
  return document.querySelector(
    '#plot-grid .plot-cell[data-plot-x="'+x+'"][data-plot-y="'+y+'"]'
  );
}

function plotStructureCellSig(instanceId, behavior){
  const cfg=state.plotConfigs?.[instanceId];
  if(!cfg&&behavior!=='farm') return '';
  if(behavior==='well'){
    return 'wl:'+cfg.bricks+':'+(cfg.bucketless?1:0)+':'+(cfg.hydrated?1:0)+':'+(cfg.equipped?1:0);
  }
  if(behavior==='fire_pit'){
    return 'fp:'+cfg.stone+':'+cfg.clay+':'+cfg.bricks+':'+(cfg.complete?1:0);
  }
  if(behavior==='kiln'){
    return 'kl:'+(cfg.bricks||0)+':'+(cfg.complete?1:0)+':'+(cfg.lit?1:0);
  }
  if(behavior==='barn'){
    const c=typeof getBarnConfig==='function'?getBarnConfig(instanceId):cfg;
    if(!c) return 'b:';
    const slot=typeof findPlotSlotByInstanceId==='function'?findPlotSlotByInstanceId(instanceId):null;
    const typeId=slot?.typeId||'';
    if(typeof getBarnVisualState==='function'){
      const plotTypeId=typeof getBarnPlotTypeIdFromPlot==='function'?getBarnPlotTypeIdFromPlot(instanceId, c):typeId;
      const vis=getBarnVisualState(c, plotTypeId||typeId);
      return 'b:'+(c.size||'')+':'+(plotTypeId||typeId)+':'+(c.orientation||'')+':'+(vis.stage||'')+':'+(vis.label||'')+':'+(vis.icon||'');
    }
    return 'b:'+(c.size||'')+':'+(c.orientation||'')+':'+(c.frameLogs||0);
  }
  if(behavior==='farm'&&typeof getFarmVisualState==='function'){
    const vis=getFarmVisualState(cfg);
    return 'fm:'+(vis?.stage||'')+':'+(vis?.icon||'');
  }
  if(behavior==='washing_line'){
    const c=typeof getWashingLineConfig==='function'?getWashingLineConfig(instanceId):cfg;
    if(!c) return 'wl:';
    const found=typeof findPlotSlotByInstanceId==='function'?findPlotSlotByInstanceId(instanceId):null;
    const typeId=found?.slot?.typeId||'';
    const vis=typeof getWashingLineVisualState==='function'?getWashingLineVisualState(c, typeId):null;
    return 'wl:'+(c.logs|0)+':'+(c.rope|0)+':'+(c.complete?1:0)+':'+(c.improved?1:0)
      +':'+(vis?.stage||'')+':'+(vis?.icon||'');
  }
  return '';
}

function plotCellSignature(x,y,wbData){
  const edit=state.plot?.editMode?'1':'0';
  const slot=getPlotCell(x,y);
  if(!slot){
    const feat=typeof getPlotFeatureTileAt==='function'?getPlotFeatureTileAt(x,y):null;
    const featDisc=feat&&(typeof isPlotFeatureUnlockedByTile==='function'&&isPlotFeatureUnlockedByTile(feat.typeId))?1:0;
    return 'e|'+edit+'|'+(isPlotTileUnlocked(x,y)?1:0)+'|'+(isPlotTileUnlockable(x,y)?1:0)+'|'+(feat?.typeId||'')+'|'+featDisc;
  }
  const def=getPlotTileDef(slot.typeId);
  let sig='p|'+edit+'|'+slot.typeId+'|'+slot.instanceId;
  if(def?.behavior==='water'){
    const key=plotCoordKey(x,y);
    const bid=wbData?.cellToBody?.[key]||'';
    const bt=bid?(wbData.bodies[bid]?.type||''):'';
    sig+='|w|'+bid+'|'+bt;
  }
  if(def?.behavior==='tree'){
    const tc=state.plotConfigs?.[slot.instanceId]?.treeChops;
    sig+='|tc|'+(tc==null?0:tc);
  }
  if(def?.behavior){
    sig+='|'+plotStructureCellSig(slot.instanceId, def.behavior);
  }
  return sig;
}

function patchPlotCellElement(cell,x,y,wbData){
  const next=createPlotCellElement(x,y,wbData);
  if(cell.className!==next.className) cell.className=next.className;
  const dataKeys=new Set([
    ...Object.keys(cell.dataset),
    ...Object.keys(next.dataset),
  ]);
  dataKeys.forEach((k)=>{
    if(next.dataset[k]!==undefined) cell.dataset[k]=next.dataset[k];
    else delete cell.dataset[k];
  });
  if(cell.innerHTML!==next.innerHTML) cell.innerHTML=next.innerHTML;
}

function waterBodiesOverlayKey(wbData){
  if(!wbData?.bodies) return '';
  return Object.keys(wbData.bodies).sort().map((id)=>{
    const body=wbData.bodies[id];
    return id+':'+body.type+':'+(body.cells?.length||0)+':'+body.labelKey;
  }).join('|');
}

function barnBodiesOverlayKey(bbData){
  const edit=state.plot?.editMode?'1':'0';
  if(!bbData?.bodies) return 'e'+edit+'|';
  return 'e'+edit+'|'+Object.keys(bbData.bodies).sort().map((id)=>{
    const body=bbData.bodies[id];
    const cellKey=(body.cells||[]).map(c=>c.x+','+c.y).sort().join(';');
    const found=typeof findPlotSlotByInstanceId==='function'?findPlotSlotByInstanceId(body.instanceId):null;
    const cfg=typeof getBarnConfig==='function'?getBarnConfig(body.instanceId):null;
    const typeId=found?.slot?.typeId||'';
    const vis=cfg&&typeof getBarnVisualState==='function'?getBarnVisualState(cfg, typeId):null;
    const visKey=vis?(vis.stage+':'+(vis.large?'L':'M')+':'+(vis.label||'')+':'+(vis.icon||'')):'';
    return id+':'+body.instanceId+':'+(body.orientation||'')+':'+visKey+':'+cellKey;
  }).join('|');
}

function refreshBarnPlotOverlays(){
  const grid=document.getElementById('plot-grid');
  if(!grid||typeof computeBarnBodies!=='function'||typeof renderBarnBodyOverlays!=='function') return;
  const bbData=computeBarnBodies();
  const b=typeof getPlotRenderBounds==='function'?getPlotRenderBounds()
    :(typeof getPlotBounds==='function'?getPlotBounds():null);
  if(!b) return;
  renderBarnBodyOverlays(grid, bbData, b);
  plotLastBarnOverlayKey=barnBodiesOverlayKey(bbData);
}

function syncPlotGridOverlays(grid, wbData, bbData, b){
  const wKey=waterBodiesOverlayKey(wbData);
  if(wKey!==plotLastWaterOverlayKey){
    renderWaterBodyOverlays(grid, wbData, b);
    plotLastWaterOverlayKey=wKey;
  }
  const bKey=barnBodiesOverlayKey(bbData);
  if(bKey!==plotLastBarnOverlayKey){
    renderBarnBodyOverlays(grid, bbData, b);
    plotLastBarnOverlayKey=bKey;
  }
}

function renderPlotGridFull(grid, b, layout, wbData, bbData){
  applyPlotGridLayoutStyles(grid, layout);
  grid.innerHTML='';
  for(let y=b.minY;y<=b.maxY;y++){
    for(let x=b.minX;x<=b.maxX;x++){
      const cell=createPlotCellElement(x,y,wbData);
      cell.dataset.plotSig=plotCellSignature(x,y,wbData);
      grid.appendChild(cell);
    }
  }
  renderWaterBodyOverlays(grid, wbData, b);
  renderBarnBodyOverlays(grid, bbData, b);
  plotLastWaterOverlayKey=waterBodiesOverlayKey(wbData);
  plotLastBarnOverlayKey=barnBodiesOverlayKey(bbData);
  plotGridLayout=layout;
}

function renderPlotGridIncremental(grid, b, layout, wbData, bbData){
  applyPlotGridLayoutStyles(grid, layout);
  for(let y=b.minY;y<=b.maxY;y++){
    for(let x=b.minX;x<=b.maxX;x++){
      const sig=plotCellSignature(x,y,wbData);
      let cell=getPlotCellElement(x,y);
      if(!cell){
        cell=createPlotCellElement(x,y,wbData);
        cell.dataset.plotSig=sig;
        grid.appendChild(cell);
        continue;
      }
      if(cell.dataset.plotSig===sig) continue;
      patchPlotCellElement(cell,x,y,wbData);
      cell.dataset.plotSig=sig;
    }
  }
  syncPlotGridOverlays(grid, wbData, bbData, b);
  plotGridLayout=layout;
}

function finishPlotGridRender(){
  updatePlotEditUI();
  updatePondCell();
  updateGatherCells();
  updateQuarryCells();
  if(typeof updateAllPlotStructureCells==='function') updateAllPlotStructureCells();
  hideAllPlotActivityMenus();
  applyPlotPan();
  if(plotNeedsHomeCenter){
    plotNeedsHomeCenter=false;
    requestAnimationFrame(()=>recenterPlotOnHome());
  }else{
    updatePlotHomeButton();
  }
}

function renderPlotGrid(opts){
  migratePlot();
  const grid=document.getElementById('plot-grid');
  if(!grid) return;
  if(plotRendering) return;
  plotRendering=true;
  try{
    const wbData=computeWaterBodies();
    const bbData=computeBarnBodies();
    const b=getPlotRenderBounds();
    const layout=plotLayoutFromBounds(b);
    const forceFull=!!opts?.full;
    const expectedCells=layout.cols*layout.rows;
    const existingCells=grid.querySelectorAll('.plot-cell').length;
    const canIncremental=!forceFull&&plotGridLayout&&plotLayoutEqual(plotGridLayout, layout)
      &&existingCells===expectedCells;

    if(canIncremental){
      renderPlotGridIncremental(grid, b, layout, wbData, bbData);
    }else{
      renderPlotGridFull(grid, b, layout, wbData, bbData);
    }
    finishPlotGridRender();
  }catch(err){
    console.error('[Hearthstead] Plot render failed:', err);
    invalidatePlotGrid();
    showToast('Plot could not render fully — try reloading.');
  }finally{
    plotRendering=false;
  }
}

function swapPlotCells(x1,y1,x2,y2){
  if(x1===x2&&y1===y2) return;
  const a=getPlotCell(x1,y1);
  const b=getPlotCell(x2,y2);
  if(a?.instanceId&&typeof isMultiTileBarnInstance==='function'&&isMultiTileBarnInstance(a.instanceId)) return;
  if(b?.instanceId&&typeof isMultiTileBarnInstance==='function'&&isMultiTileBarnInstance(b.instanceId)) return;
  setPlotCell(x1,y1,b);
  setPlotCell(x2,y2,a);
  renderPlotGrid();
}

function plotCoordsFromCell(cell){
  return { x:Number(cell.dataset.plotX), y:Number(cell.dataset.plotY) };
}

function resolvePlotDragCell(cell, barnSurface, clientX, clientY){
  let dragCell=cell;
  if(dragCell&&typeof getBarnDragAnchorCell==='function'){
    dragCell=getBarnDragAnchorCell(dragCell);
  }else if(!dragCell&&barnSurface?.dataset?.instanceId){
    const instanceId=barnSurface.dataset.instanceId;
    if(typeof isMultiTileBarnInstance==='function'&&isMultiTileBarnInstance(instanceId)){
      const anchor=typeof getBarnAnchor==='function'?getBarnAnchor(instanceId):null;
      if(anchor&&typeof getPlotCellElement==='function') dragCell=getPlotCellElement(anchor.x,anchor.y);
    }
  }
  if((!dragCell||!isBarnDragCell(dragCell))&&typeof mediumBarnHitAtClientPoint==='function'){
    const hit=mediumBarnHitAtClientPoint(clientX,clientY);
    if(hit?.dragCell) dragCell=hit.dragCell;
  }
  return dragCell;
}

function clearPlotDropTargets(){
  document.querySelectorAll('.plot-cell.plot-drop-target').forEach(c=>{
    c.classList.remove('plot-drop-target');
    delete c.dataset.barnDropAnchorX;
    delete c.dataset.barnDropAnchorY;
  });
}

function barnDropAnchorScore(ax, ay, fromX, fromY, dragDx, dragDy){
  if(Math.abs(dragDx)>8) return dragDx>0?ax:-ax;
  if(Math.abs(dragDy)>8) return dragDy>0?ay:-ay;
  return Math.abs(ax-fromX)+Math.abs(ay-fromY);
}

function tagBarnDropAnchorOnCell(el, ax, ay, fromX, fromY, dragDx, dragDy){
  if(!el) return;
  const prevX=el.dataset.barnDropAnchorX;
  if(prevX!=null){
    const prevY=Number(el.dataset.barnDropAnchorY);
    const prevScore=barnDropAnchorScore(Number(prevX), prevY, fromX, fromY, dragDx, dragDy);
    const nextScore=barnDropAnchorScore(ax, ay, fromX, fromY, dragDx, dragDy);
    if(nextScore<prevScore) return;
  }
  el.dataset.barnDropAnchorX=String(ax);
  el.dataset.barnDropAnchorY=String(ay);
}

function barnDropAnchorFromCell(cell){
  if(!cell?.dataset?.barnDropAnchorX) return null;
  const x=Number(cell.dataset.barnDropAnchorX);
  const y=Number(cell.dataset.barnDropAnchorY);
  if(!Number.isFinite(x)||!Number.isFinite(y)) return null;
  return { x, y };
}

function isPlotCellValidDropTarget(cell, fromX, fromY){
  if(!cell||cell.dataset.plotX==null) return false;
  const tx=Number(cell.dataset.plotX), ty=Number(cell.dataset.plotY);
  if(tx===fromX&&ty===fromY) return false;
  if(plotDrag?.barnMulti&&plotDrag.instanceId){
    return typeof resolveBarnDropAnchor==='function'&&!!resolveBarnDropAnchor(plotDrag.instanceId, tx, ty);
  }
  if(cell.classList.contains('cell-empty')){
    return isCoordInUnlockedPlot(tx, ty);
  }
  const targetSlot=getPlotCell(tx,ty);
  if(!targetSlot) return false;
  const fromSlot=getPlotCell(fromX,fromY);
  if(typeof isMultiTileBarnPlotCell==='function'&&isMultiTileBarnPlotCell(tx,ty)&&targetSlot.instanceId!==fromSlot?.instanceId){
    return false;
  }
  return true;
}

function isMultiTileBarnPlotCell(x,y){
  return typeof isMediumBarnPlotCell==='function'&&isMediumBarnPlotCell(x,y);
}

function isMultiTileBarnSwapBlockedTarget(cell, fromX, fromY){
  if(!cell||cell.dataset.plotX==null) return false;
  const tx=Number(cell.dataset.plotX), ty=Number(cell.dataset.plotY);
  const targetSlot=getPlotCell(tx,ty);
  const fromSlot=getPlotCell(fromX,fromY);
  return !!(isMultiTileBarnPlotCell(tx,ty)&&targetSlot?.instanceId!==fromSlot?.instanceId);
}

function plotCellAtPoint(x,y){
  plotDragGhost?.style.setProperty('display','none');
  const waterLayer=document.getElementById('plot-water-layer');
  const barnLayer=document.getElementById('plot-barn-layer');
  let restoreWater=false;
  let restoreBarn=false;
  if(waterLayer&&waterLayer.style.display!=='none'){
    waterLayer.style.display='none';
    restoreWater=true;
  }
  if(barnLayer&&barnLayer.style.display!=='none'){
    barnLayer.style.display='none';
    restoreBarn=true;
  }
  const under=document.elementFromPoint(x,y);
  if(restoreWater) waterLayer.style.display='';
  if(restoreBarn) barnLayer.style.display='';
  plotDragGhost?.style.removeProperty('display');
  return under?.closest?.('.plot-cell');
}

/** How far past a tile edge we still count as “on” that tile (covers grid gaps). */
function plotCellHitBleedPx(){
  return Math.max(6, PLOT_CELL_GAP*0.9);
}

function plotCellExpandedRect(cell, bleed){
  const r=cell.getBoundingClientRect();
  const b=bleed??plotCellHitBleedPx();
  return { left:r.left-b, right:r.right+b, top:r.top-b, bottom:r.bottom+b };
}

function clientPointInPlotCellRect(clientX, clientY, cell, bleed){
  const r=plotCellExpandedRect(cell, bleed);
  return clientX>=r.left&&clientX<=r.right&&clientY>=r.top&&clientY<=r.bottom;
}

function pickNearestPlotCellAtClient(clientX, clientY, candidates){
  let best=null, bestDist=Infinity;
  for(const cell of candidates){
    const r=cell.getBoundingClientRect();
    const cx=(r.left+r.right)/2, cy=(r.top+r.bottom)/2;
    const d=(clientX-cx)**2+(clientY-cy)**2;
    if(d<bestDist){ bestDist=d; best=cell; }
  }
  return best;
}

function plotDropTargetCellsAtClient(clientX, clientY){
  const bleed=plotCellHitBleedPx();
  const hits=[];
  document.querySelectorAll('.plot-cell.plot-drop-target[data-plot-x]').forEach(cell=>{
    if(clientPointInPlotCellRect(clientX, clientY, cell, bleed)) hits.push(cell);
  });
  return hits;
}

function plotCellFromClientPoint(clientX, clientY, opts){
  const preferDrop=!!opts?.preferDropTargets;
  const bleed=plotCellHitBleedPx();

  if(preferDrop){
    const dropHits=plotDropTargetCellsAtClient(clientX, clientY);
    if(dropHits.length===1) return dropHits[0];
    if(dropHits.length>1) return pickNearestPlotCellAtClient(clientX, clientY, dropHits);
  }

  const direct=plotCellAtPoint(clientX, clientY);
  if(direct){
    if(!preferDrop||direct.classList.contains('plot-drop-target')) return direct;
  }

  const grid=document.getElementById('plot-grid');
  if(!grid) return direct||null;

  const pool=[];
  const onlyDrop=preferDrop;
  grid.querySelectorAll('.plot-cell[data-plot-x]').forEach(cell=>{
    if(onlyDrop&&!cell.classList.contains('plot-drop-target')) return;
    if(clientPointInPlotCellRect(clientX, clientY, cell, bleed)) pool.push(cell);
  });
  if(pool.length) return pickNearestPlotCellAtClient(clientX, clientY, pool);

  let nearest=null, nearestDist=Infinity;
  grid.querySelectorAll('.plot-cell[data-plot-x]').forEach(cell=>{
    if(onlyDrop&&!cell.classList.contains('plot-drop-target')) return;
    const r=cell.getBoundingClientRect();
    const cx=(r.left+r.right)/2, cy=(r.top+r.bottom)/2;
    const d=(clientX-cx)**2+(clientY-cy)**2;
    if(d<nearestDist){ nearestDist=d; nearest=cell; }
  });
  const snapMax=(PLOT_CELL_PX*0.55)**2;
  if(nearest&&nearestDist<=snapMax) return nearest;

  if(opts?.stickyCell&&clientPointInPlotCellRect(clientX, clientY, opts.stickyCell, bleed*1.35)){
    return opts.stickyCell;
  }

  return direct||null;
}

function plotCellFromClientPointForBarnDrag(clientX, clientY){
  const prefer={ preferDropTargets:true, stickyCell:plotDrag?.lastHoverCell||null };
  return plotCellFromClientPoint(clientX, clientY, prefer);
}

function resolveBarnDropAtClient(instanceId, clientX, clientY, hint){
  if(!instanceId||typeof resolveBarnDropAnchor!=='function') return null;
  if(typeof syncBarnAnchorFromPlot==='function') syncBarnAnchorFromPlot(instanceId);
  const cell=plotCellFromClientPointForBarnDrag(clientX, clientY);
  const tagged=cell?barnDropAnchorFromCell(cell):null;
  if(tagged){
    const tx=Number(cell.dataset.plotX), ty=Number(cell.dataset.plotY);
    const anchor=resolveBarnDropAnchor(instanceId, tx, ty, {
      ...hint,
      anchorX:tagged.x,
      anchorY:tagged.y,
    });
    if(anchor) return anchor;
  }
  if(cell?.dataset?.plotX!=null){
    return resolveBarnDropAnchor(
      instanceId,
      Number(cell.dataset.plotX),
      Number(cell.dataset.plotY),
      hint,
    );
  }
  return null;
}

function getBarnFootprintCellsAtAnchor(instanceId, anchorX, anchorY){
  const cfg=getBarnConfig(instanceId);
  if(!cfg||typeof isMultiTileBarn!=='function'||!isMultiTileBarn(cfg)) return [];
  const offsets=getBarnFootprintOffsets(cfg.orientation||'h', cfg.size||'medium');
  return offsets.map(o=>({ x:anchorX+o.dx, y:anchorY+o.dy }));
}

function highlightBarnDropTargets(fromX, fromY){
  if(!plotDrag?.barnMulti||!plotDrag.instanceId) return;
  const dragDx=plotDrag.active?(plotDrag.lastX??plotDrag.startX)-plotDrag.startX:0;
  const dragDy=plotDrag.active?(plotDrag.lastY??plotDrag.startY)-plotDrag.startY:0;
  const b=getPlotRenderBounds();
  for(let y=b.minY;y<=b.maxY;y++){
    for(let x=b.minX;x<=b.maxX;x++){
      if(x===fromX&&y===fromY) continue;
      if(typeof canMoveBarnFootprintTo!=='function'||!canMoveBarnFootprintTo(plotDrag.instanceId, x, y)) continue;
      getBarnFootprintCellsAtAnchor(plotDrag.instanceId, x, y).forEach(c=>{
        const el=document.querySelector('.plot-cell[data-plot-x="'+c.x+'"][data-plot-y="'+c.y+'"]');
        if(!el) return;
        el.classList.add('plot-drop-target');
        tagBarnDropAnchorOnCell(el, x, y, fromX, fromY, dragDx, dragDy);
      });
    }
  }
}

function setBarnFootprintDragging(instanceId, on){
  if(!instanceId) return;
  getBarnFootprintCells(instanceId).forEach(c=>{
    const el=document.querySelector('.plot-cell[data-plot-x="'+c.x+'"][data-plot-y="'+c.y+'"]');
    el?.classList.toggle('plot-dragging', !!on);
  });
  document.querySelectorAll('.barn-body-surface[data-instance-id="'+instanceId+'"]')
    .forEach(el=>el.classList.toggle('barn-overlay-dragging', !!on));
  const barnLayer=document.getElementById('plot-barn-layer');
  if(barnLayer) barnLayer.style.pointerEvents=on?'none':'';
}

function startPlotDragGhost(cell,x,y){
  const {x:cx,y:cy}=plotCoordsFromCell(cell);
  const slot=getPlotCell(cx,cy);
  plotDragGhost=document.createElement('div');
  plotDragGhost.className='plot-drag-ghost '+cell.className.replace('plot-cell','').trim();
  if(plotDrag?.barnMulti&&plotDrag.instanceId){
    const cfg=typeof getBarnConfig==='function'?getBarnConfig(plotDrag.instanceId):null;
    const orient=cfg?.orientation||'h';
    const cellPx=PLOT_CELL_PX, gap=PLOT_CELL_GAP;
    if(orient==='h'){
      plotDragGhost.style.width=(cellPx*2+gap)+'px';
      plotDragGhost.style.height=cellPx+'px';
    }else{
      plotDragGhost.style.width=cellPx+'px';
      plotDragGhost.style.height=(cellPx*2+gap)+'px';
    }
    plotDragGhost.classList.add('plot-drag-ghost-barn-multi');
    const sizeLabel=cfg?.size==='large'?'large barn':cfg?.size==='medium'?'medium barn':'barn';
    plotDragGhost.innerHTML='<span class="plot-drag-ghost-barn-icon">🏛️</span><span class="plot-drag-ghost-barn-label">'+sizeLabel+'</span>';
  }else{
    plotDragGhost.innerHTML='<span style="font-size:32px;line-height:1;">'+plotDragIconForSlot(slot)+'</span>';
  }
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

function handlePlotPointerTap(e, cell, waterSurface, barnSurface){
  if(state.plot?.editMode){
    if(plotSuppressClick) return;
    if(e.target?.closest('.barn-edit-remove-hint')) return;
    const barnHit=typeof mediumBarnHitAtClientPoint==='function'?mediumBarnHitAtClientPoint(e.clientX,e.clientY):null;
    if(barnHit?.instanceId&&typeof confirmRemoveMediumBarn==='function'){
      confirmRemoveMediumBarn(barnHit.instanceId);
      return;
    }
    const barnTap=barnSurface||e.target?.closest?.('.barn-body-surface')||resolveBarnSurfaceFromPlotCell(cell);
    if(barnTap?.dataset?.instanceId&&typeof confirmRemoveMediumBarn==='function'){
      confirmRemoveMediumBarn(barnTap.dataset.instanceId);
      return;
    }
    if(!cell) return;
    const {x,y}=plotCoordsFromCell(cell);
    const slot=getPlotCell(x,y);
    if(!slot){
      onEmptyPlotTap(x,y);
      return;
    }
    onPlotTileTap(e,x,y,slot);
    return;
  }
  const barnSurfaceResolved=barnSurface||e.target?.closest?.('.barn-body-surface')||resolveBarnSurfaceFromPlotCell(cell);
  if(barnSurfaceResolved){
    if(e.target?.closest?.('.barn-rotate-btn')) return;
    if(e.target?.closest('.barn-edit-remove-hint')) return;
    if(typeof handleBarnSurfaceTap==='function'){
      handleBarnSurfaceTap(e, barnSurfaceResolved);
      return;
    }
    if(typeof setActiveBarn==='function') setActiveBarn(barnSurfaceResolved.dataset.instanceId);
    barnMenuTap(e);
    return;
  }
  const surface=waterSurface||resolveWaterSurfaceFromPlotCell(cell);
  if(surface){
    if(e.target?.closest?.('.plot-menu-btn')) return;
    handleWaterSurfaceTap(e, surface);
    return;
  }
  if(plotSuppressClick) return;
  if(cell){
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
    if(def?.behavior&&typeof handlePlotStructureCellTap==='function'&&handlePlotStructureCellTap(e, cell, slot, def)){
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
  if(e.target.closest('.barn-rotate-btn')) return;
  let waterSurface=e.target.closest('.water-body-surface');
  if(!waterSurface) waterSurface=resolveWaterSurfaceFromPlotCell(cell);
  let barnSurface=e.target.closest('.barn-body-surface');
  if(!barnSurface) barnSurface=resolveBarnSurfaceFromPlotCell(cell);
  if(e.target.closest('.barn-rotate-btn')) return;
  if(e.target.closest('.barn-edit-remove-hint')) return;
  const dragCell=resolvePlotDragCell(cell,barnSurface,e.clientX,e.clientY);
  const canTileDrag=state.plot?.editMode&&dragCell&&dragCell.classList.contains('cell-placed')
    &&!dragCell.classList.contains('cell-hut')
    &&((!dragCell.classList.contains('cell-barn')&&!dragCell.classList.contains('cell-barn-base'))||isBarnDragCell(dragCell));
  if(canTileDrag){
    e.preventDefault();
    onPlotTilePointerDown(e, dragCell);
    return;
  }
  if(state.plot?.editMode&&barnSurface?.dataset?.instanceId
    &&typeof isMultiTileBarnInstance==='function'&&isMultiTileBarnInstance(barnSurface.dataset.instanceId)){
    const hit=typeof mediumBarnHitAtClientPoint==='function'?mediumBarnHitAtClientPoint(e.clientX,e.clientY):null;
    const fallbackCell=hit?.dragCell||dragCell;
    if(fallbackCell&&isBarnDragCell(fallbackCell)){
      e.preventDefault();
      onPlotTilePointerDown(e, fallbackCell);
      return;
    }
    e.preventDefault();
    showToast('Drag the barn from its anchor tile (marked in edit mode).');
    return;
  }
  if(barnSurface&&!state.plot?.editMode){
    e.preventDefault();
    handlePlotPointerTap(e, cell, null, barnSurface);
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
    startBarn:barnSurface,
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
  const {active,startCell,startWater,startBarn,startX,startY,viewport}=plotPanDrag;
  document.removeEventListener('pointermove',onPlotViewportPointerMove);
  document.removeEventListener('pointerup',onPlotViewportPointerUp);
  document.removeEventListener('pointercancel',onPlotViewportPointerUp);
  try{ viewport?.releasePointerCapture(e.pointerId); }catch(_err){}
  document.getElementById('plot-viewport')?.classList.remove('panning');
  const moved=Math.hypot(e.clientX-startX,e.clientY-startY)>=PLOT_PAN_THRESHOLD;
  const waterTapTarget=startWater||resolveWaterSurfaceFromPlotCell(startCell);
  const barnTapTarget=startBarn||e.target?.closest?.('.barn-body-surface')||resolveBarnSurfaceFromPlotCell(startCell);
  if(waterTapTarget&&!active){
    handlePlotPointerTap(e, startCell, waterTapTarget, barnTapTarget);
  }else if(active||moved){
    plotSuppressClick=true;
    setTimeout(()=>{ plotSuppressClick=false; }, 280);
  }else{
    handlePlotPointerTap(e, startCell, startWater, barnTapTarget);
  }
  plotPanDrag=null;
}

function onPlotTilePointerDown(e, dragCellOverride){
  if(e.button!==undefined&&e.button!==0) return;
  let cell=dragCellOverride||e.target.closest('.plot-cell');
  if(!cell||cell.dataset.plotX==null) return;
  if(e.target.closest('.plot-menu-btn')) return;
  if(typeof getBarnDragAnchorCell==='function') cell=getBarnDragAnchorCell(cell);
  const {x,y}=plotCoordsFromCell(cell);
  const slot=getPlotCell(x,y);
  if(!slot) return;
  plotDrag={
    x, y, cell,
    startX:e.clientX, startY:e.clientY,
    active:false, pointerId:e.pointerId,
    hoverAnchor:null, lastHoverCell:null,
  };
  const cfg=typeof getBarnConfig==='function'?getBarnConfig(slot.instanceId):null;
  if(cfg&&typeof isMultiTileBarn==='function'&&isMultiTileBarn(cfg)){
    plotDrag.barnMulti=true;
    plotDrag.instanceId=slot.instanceId;
    if(typeof syncBarnAnchorFromPlot==='function'){
      const anchor=syncBarnAnchorFromPlot(slot.instanceId);
      if(anchor){ plotDrag.x=anchor.x; plotDrag.y=anchor.y; }
    }
  }
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
    if(plotDrag.barnMulti&&plotDrag.instanceId){
      setBarnFootprintDragging(plotDrag.instanceId, true);
    }else{
      plotDrag.cell.classList.add('plot-dragging');
    }
    startPlotDragGhost(plotDrag.cell,e.clientX,e.clientY);
  }
  plotDrag.lastX=e.clientX;
  plotDrag.lastY=e.clientY;
  movePlotDragGhost(e.clientX,e.clientY);
  clearPlotDropTargets();
  if(plotDrag.barnMulti&&plotDrag.instanceId){
    const dragHint={
      dragDx:e.clientX-plotDrag.startX,
      dragDy:e.clientY-plotDrag.startY,
      fromAnchor:{ x:plotDrag.x, y:plotDrag.y },
    };
    highlightBarnDropTargets(plotDrag.x, plotDrag.y);
    const hoverCell=plotCellFromClientPointForBarnDrag(e.clientX,e.clientY);
    if(hoverCell?.classList?.contains('plot-drop-target')){
      plotDrag.lastHoverCell=hoverCell;
    }
    const tagged=hoverCell?barnDropAnchorFromCell(hoverCell):null;
    if(tagged){
      plotDrag.hoverAnchor={ x:tagged.x, y:tagged.y };
    }else if(hoverCell?.dataset?.plotX!=null){
      plotDrag.hoverAnchor=resolveBarnDropAtClient(plotDrag.instanceId, e.clientX, e.clientY, dragHint);
    }else if(plotDrag.lastHoverCell?.classList?.contains('plot-drop-target')){
      const sticky=barnDropAnchorFromCell(plotDrag.lastHoverCell);
      if(sticky) plotDrag.hoverAnchor={ x:sticky.x, y:sticky.y };
    }else{
      plotDrag.hoverAnchor=null;
    }
  }else{
    const target=plotCellAtPoint(e.clientX,e.clientY);
    if(isPlotCellValidDropTarget(target, plotDrag.x, plotDrag.y)){
      target.classList.add('plot-drop-target');
    }
  }
}

function onPlotPointerUp(e){
  if(!plotDrag||e.pointerId!==plotDrag.pointerId) return;
  const cell=plotDrag.cell;
  const wasTap=!plotDrag.active;
  const {x,y}=plotDrag;
  const barnMulti=!!(plotDrag.barnMulti&&plotDrag.instanceId);
  const barnInstanceId=plotDrag.instanceId;
  const slot=getPlotCell(x,y);
  cell.releasePointerCapture(e.pointerId);
  cell.removeEventListener('pointermove',onPlotPointerMove);
  cell.removeEventListener('pointerup',onPlotPointerUp);
  cell.removeEventListener('pointercancel',onPlotPointerUp);
  if(plotDrag.active){
    const target=plotCellFromClientPoint(e.clientX,e.clientY);
    if(plotDrag.barnMulti&&plotDrag.instanceId){
      const dropHint={
        dragDx:e.clientX-plotDrag.startX,
        dragDy:e.clientY-plotDrag.startY,
        fromAnchor:{ x, y },
      };
      let anchor=plotDrag.hoverAnchor;
      if(anchor&&typeof canMoveBarnFootprintTo==='function'
        &&!canMoveBarnFootprintTo(plotDrag.instanceId, anchor.x, anchor.y)){
        anchor=null;
      }
      if(!anchor){
        anchor=resolveBarnDropAtClient(plotDrag.instanceId, e.clientX, e.clientY, dropHint);
      }
      let moved=false;
      if(anchor&&typeof moveBarnFootprint==='function'){
        moved=moveBarnFootprint(plotDrag.instanceId, anchor.x, anchor.y);
      }
      if(moved){
        plotLastBarnOverlayKey='';
        if(typeof syncBarnCfgFromPlotCells==='function') syncBarnCfgFromPlotCells(barnInstanceId);
        renderPlotGrid({ full:true });
      }else{
        showToast('No room to place the barn there — need two clear adjacent tiles.');
      }
    }else if(isPlotCellValidDropTarget(target, x, y)){
      const tx=Number(target.dataset.plotX), ty=Number(target.dataset.plotY);
      swapPlotCells(x,y,tx,ty);
    }else if(isMultiTileBarnSwapBlockedTarget(target, x, y)){
      showToast('Move the barn first — you can\'t swap a single tile onto it.');
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
  if(barnMulti&&barnInstanceId) setBarnFootprintDragging(barnInstanceId, false);
  plotDrag=null;
}

function initPlotGrid(){
  migratePlot();
  renderPlotGrid();
  document.getElementById('plot-viewport')?.addEventListener('pointerdown',onPlotViewportPointerDown);
}
