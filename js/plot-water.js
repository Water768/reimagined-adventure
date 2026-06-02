/* Hearthstead — water bodies & pond surfaces */
'use strict';

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

function resolveWaterSurfaceFromPlotCell(cell){
  if(!cell?.classList?.contains('cell-water-base')) return null;
  const {x,y}=plotCoordsFromCell(cell);
  const slot=getPlotCell(x,y);
  return resolveWaterSurfaceForPlotCell(x,y,slot,cell);
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

function computeBarnBodies(){
  const bodies={};
  const instanceToBody={};
  let nextId=1;
  const seen=new Set();
  forEachPlotOccupied((x,y,slot)=>{
    if(!slot?.instanceId||seen.has(slot.instanceId)) return;
    const cfg=getBarnConfig(slot.instanceId);
    if(!cfg) return;
    if(typeof isMultiTileBarn==='function'){
      if(!isMultiTileBarn(cfg)) return;
    }else if(cfg.size!=='medium'&&cfg.size!=='large'){
      return;
    }
    seen.add(slot.instanceId);
    if(typeof syncBarnCfgFromPlotCells==='function') syncBarnCfgFromPlotCells(slot.instanceId);
    let cells=typeof getBarnPlotOccupiedCells==='function'
      ?getBarnPlotOccupiedCells(slot.instanceId)
      :[];
    if(cells.length<2||!inferBarnOrientationFromCells?.(cells)){
      cells=getBarnFootprintCells(slot.instanceId);
    }
    if(!cells.length) return;
    const id='bb_'+nextId++;
    bodies[id]={ id, instanceId:slot.instanceId, cells, orientation:cfg.orientation||'h' };
    instanceToBody[slot.instanceId]=id;
  });
  plotBarnBodies={ bodies, instanceToBody };
  return plotBarnBodies;
}

function getBarnBodySurface(bodyId){
  return document.querySelector('.barn-body-surface[data-barn-body-id="'+bodyId+'"]');
}

function resolveBarnSurfaceFromPlotCell(cell){
  if(!cell?.classList?.contains('cell-barn-base')) return null;
  const {x,y}=plotCoordsFromCell(cell);
  const slot=getPlotCell(x,y);
  if(!slot?.instanceId) return null;
  if(!plotBarnBodies) computeBarnBodies();
  const bodyId=plotBarnBodies?.instanceToBody?.[slot.instanceId];
  return bodyId?getBarnBodySurface(bodyId):document.querySelector('.barn-body-surface[data-instance-id="'+slot.instanceId+'"]');
}

function attachBarnSurfaceHandlers(surface){
  if(!surface||surface.dataset.barnHandlersAttached) return;
  surface.dataset.barnHandlersAttached='1';
}

function renderBarnBodyOverlays(grid, bbData, plotBounds){
  grid.querySelectorAll('.plot-barn-layer').forEach(n=>n.remove());
  if(!bbData) return;
  const editMode=!!state.plot?.editMode;

  const layer=document.createElement('div');
  layer.className='plot-barn-layer';
  layer.id='plot-barn-layer';

  Object.values(bbData.bodies).forEach(body=>{
    if(!body.cells?.length) return;
    const rect=getWaterBodyBounds(body.cells);
    const layout=waterRectSurfaceLayout(rect, plotBounds);
    const cfg=getBarnConfig(body.instanceId);
    const surface=document.createElement('div');
    const large=cfg&&typeof isLargeBarn==='function'&&isLargeBarn(cfg);
    surface.className='barn-body-surface barn-medium-surface'
      +(large?' barn-large-surface':'')
      +(editMode?' barn-medium-edit':'');
    if(body.orientation==='v') surface.classList.add('barn-body-vertical');
    else surface.classList.add('barn-body-horizontal');
    surface.dataset.barnBodyId=body.id;
    surface.dataset.instanceId=body.instanceId;
    surface.style.left=layout.left+'px';
    surface.style.top=layout.top+'px';
    surface.style.width=layout.width+'px';
    surface.style.height=layout.height+'px';
    if(body.cells.length>1){
      surface.classList.add('barn-piece-merge-right');
    }
    surface.innerHTML=buildBarnBodySurfaceHtml(cfg, editMode, body.instanceId);
    attachBarnSurfaceHandlers(surface);
    layer.appendChild(surface);
  });

  grid.appendChild(layer);
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

function buildWaterBaseCellHtml(def, editMode, bodyType){
  if(!editMode) return '';
  const typeCfg=bodyType&&typeof WATER_BODY_TYPES!=='undefined'?WATER_BODY_TYPES[bodyType]:null;
  const label=(typeCfg?.name||def?.name||'water').toLowerCase();
  const icon=typeof waterBodyPlotIcon==='function'?waterBodyPlotIcon(bodyType||'pond'):(def?.icon||'🌊');
  return '<div class="plot-activity-top water-edit-top">'
    +'<div class="water-edit-sprite">'
    +'<span class="water-edit-icon">'+icon+'</span>'
    +'<span class="water-edit-label">'+label+'</span></div></div>'
    +'<div class="plot-edit-hint">remove</div>';
}
