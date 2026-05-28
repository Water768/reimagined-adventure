/* Hearthstead — interior grid */
'use strict';

/* ═══════════════════════════════════════
   INTERIOR GRID (layout + drag)
═══════════════════════════════════════ */
const intCellEls = {};
const intCoordEls = {};
const INT_CELL_PX = 92;
const INT_WALL_PX = 10;
const INT_DRAG_ICON = {
  wardrobe:'🚪', fireplace:'🔥', picture:'🖼️', workbench:'🪚',
  build:'＋', dogbed:'🛏️', doorway:'🚶', storeroom:'🗄️', spinningwheel:'🎡', apothecary_table:'⚗️', wonky_loom:'🧵', empty:'',
};
let intPanDrag = null;
let intSwapDrag = null;
let intDragGhost = null;
let intSuppressClick = false;

function interiorCoordKey(x,y){ return x+','+y; }

function parseInteriorCoordKey(key){
  const p=key.split(',');
  return { x:Number(p[0]), y:Number(p[1]) };
}

function parseInteriorCellKey(cellKey){
  if(!cellKey) return { type:null, instanceId:null, raw:cellKey };
  if(/^build\d+$/.test(cellKey)) return { type:'build', instanceId:null, raw:cellKey };
  if(cellKey.startsWith('storeroom:')){
    return { type:'storeroom', instanceId:cellKey.slice(10), raw:cellKey };
  }
  if(cellKey.startsWith('furniture:')){
    return { type:'furniture', instanceId:cellKey.slice(10), raw:cellKey };
  }
  return { type:cellKey, instanceId:null, raw:cellKey };
}

function interiorCellType(cellKey){
  return parseInteriorCellKey(cellKey).type;
}

function isInteriorBuildSlotKey(cellKey){
  const t=interiorCellType(cellKey);
  return t==='build'||t==='empty';
}

function migrateInteriorBuildSlots(){
  if(!state.interior?.cells) return;
  Object.keys(state.interior.cells).forEach(k=>{
    if(/^build\d+$/.test(state.interior.cells[k])) state.interior.cells[k]='build';
  });
}

function createDefaultStoreRoomData(id){
  return {
    id,
    shelves:{1:false,2:false,3:false,4:false},
    shelfTiers:{1:0,2:0,3:0,4:0},
    shelfStages:{1:0,2:0,3:0,4:0},
    shelfUpgradeStages:{1:0,2:0,3:0,4:0},
  };
}

function cloneStoreRoomShelfData(room, id){
  if(!room) return createDefaultStoreRoomData(id);
  return {
    id,
    shelves:{1:!!room.shelves?.[1],2:!!room.shelves?.[2],3:!!room.shelves?.[3],4:!!room.shelves?.[4]},
    shelfTiers:{1:room.shelfTiers?.[1]||0,2:room.shelfTiers?.[2]||0,3:room.shelfTiers?.[3]||0,4:room.shelfTiers?.[4]||0},
    shelfStages:{1:room.shelfStages?.[1]||0,2:room.shelfStages?.[2]||0,3:room.shelfStages?.[3]||0,4:room.shelfStages?.[4]||0},
    shelfUpgradeStages:{1:room.shelfUpgradeStages?.[1]||0,2:room.shelfUpgradeStages?.[2]||0,3:room.shelfUpgradeStages?.[3]||0,4:room.shelfUpgradeStages?.[4]||0},
  };
}

function listStoreRoomIdsOnMap(){
  migrateInterior();
  const ids=[];
  Object.values(state.interior.cells||{}).forEach(key=>{
    const {type,instanceId}=parseInteriorCellKey(key);
    if(type==='storeroom'&&instanceId) ids.push(instanceId);
  });
  return ids;
}

function listPlacableInteriorCellKeys(){
  return Object.entries(state.interior.cells||{})
    .filter(([,key])=>isInteriorBuildSlotKey(key))
    .map(([ck])=>ck);
}

function getStoreRoomCapacity(storeRoomId){
  migrateShelfTiers();
  if(!storeRoomId) return 0;
  let cap=500;
  [1,2,3,4].forEach(slot=>{ cap+=getShelfTier(slot, storeRoomId)*50; });
  return cap;
}

function syncStoreRoomsWithInterior(){
  migrateInterior();
  const purged=new Set(state.purgedStoreRoomIds||[]);
  purged.forEach(id=>{ delete state.storeRooms[id]; });
  Object.entries(state.interior.cells||{}).forEach(([ck,key])=>{
    const {instanceId}=parseInteriorCellKey(key);
    if(instanceId&&purged.has(instanceId)) delete state.interior.cells[ck];
  });
  const onMap=new Set(listStoreRoomIdsOnMap());
  onMap.forEach(id=>{
    if(purged.has(id)) return;
    if(!state.storeRooms[id]) state.storeRooms[id]=createDefaultStoreRoomData(id);
  });

  const stillOrphan=Object.keys(state.storeRooms).filter(id=>!listStoreRoomIdsOnMap().includes(id)&&!purged.has(id));
  if(stillOrphan.length){
    stillOrphan.forEach(id=>{
      if(typeof viewingStoreRoomId!=='undefined'&&viewingStoreRoomId===id) viewingStoreRoomId=null;
      if(typeof craft!=='undefined'&&craft.storeRoomId===id) craft.storeRoomId=null;
      delete state.storeRooms[id];
    });
    trimStorageToCapacity(listStoreRoomIdsOnMap().reduce((sum,id)=>sum+getStoreRoomCapacity(id),0));
    state._storeRoomsOrphansRemoved=(state._storeRoomsOrphansRemoved||0)+stillOrphan.length;
  }

  Object.keys(state.storeRooms).forEach(id=>{
    const room=state.storeRooms[id];
    if(!room) return;
    room.id=id;
    ensureStoreRoomShelfFields(room);
  });
}

function reclaimMissingStoreRoomCells(){
  migrateInterior();
  const purged=new Set(state.purgedStoreRoomIds||[]);
  const onMap=new Set(listStoreRoomIdsOnMap());
  const placable=listPlacableInteriorCellKeys();
  const orphanIds=Object.keys(state.storeRooms||{}).filter(id=>!onMap.has(id)&&!purged.has(id)).sort();
  let reclaimed=0;
  orphanIds.forEach(id=>{
    const ck=placable.shift();
    if(!ck) return;
    state.interior.cells[ck]='storeroom:'+id;
    reclaimed++;
  });
  if(reclaimed) state._storeRoomsReclaimed=(state._storeRoomsReclaimed||0)+reclaimed;
}

function migrateStoreRooms(){
  if(state._migratingStoreRooms||state._skipStoreRoomMigrateOnce) return;
  state._migratingStoreRooms=true;
  try{
  if(!state.storeRooms||typeof state.storeRooms!=='object') state.storeRooms={};
  migrateInterior();
  const purged=new Set(state.purgedStoreRoomIds||[]);
  const legacy=state.storeRoom;
  if(legacy?.built&&!purged.has('sr_0')){
    const id='sr_0';
    if(!state.storeRooms[id]){
      state.storeRooms[id]={
        id,
        shelves:legacy.shelves||{1:false,2:false,3:false,4:false},
        shelfTiers:legacy.shelfTiers||{1:0,2:0,3:0,4:0},
        shelfStages:legacy.shelfStages||{1:0,2:0,3:0,4:0},
        shelfUpgradeStages:legacy.shelfUpgradeStages||{1:0,2:0,3:0,4:0},
      };
    }
    let placed=false;
    forEachInteriorOccupied((x,y,key)=>{
      if(legacy.slot&&key===legacy.slot){
        state.interior.cells[interiorCoordKey(x,y)]='storeroom:'+id;
        placed=true;
      }
    });
    if(!placed&&legacy.slot){
      forEachInteriorOccupied((x,y,key)=>{
        if(/^build/.test(key)){
          state.interior.cells[interiorCoordKey(x,y)]='storeroom:'+id;
          placed=true;
        }
      });
    }
    delete state.storeRoom;
  }
  migrateInteriorBuildSlots();
  Object.entries(state.interior.cells).forEach(([ck,key])=>{
    if(key==='storeroom'){
      let n=0;
      while(state.storeRooms['sr_'+n]||purged.has('sr_'+n)) n++;
      const id='sr_'+n;
      state.storeRooms[id]=createDefaultStoreRoomData(id);
      state.interior.cells[ck]='storeroom:'+id;
    }
  });
  syncStoreRoomsWithInterior();
  }finally{
    state._migratingStoreRooms=false;
  }
}

function genStoreRoomId(){
  migrateStoreRooms();
  const purged=new Set(state.purgedStoreRoomIds||[]);
  let n=0;
  while(state.storeRooms['sr_'+n]||purged.has('sr_'+n)) n++;
  return 'sr_'+n;
}

function getStoreRoomById(id){
  migrateStoreRooms();
  return id?state.storeRooms[id]||null:null;
}

function hasAnyStoreRoom(){
  migrateStoreRooms();
  return listStoreRoomIdsOnMap().length>0;
}

function getActiveStoreRoom(){
  const id=craft.storeRoomId||viewingStoreRoomId;
  return getStoreRoomById(id);
}

function getArchitectureLevel(){
  return Number(state.skills.architecture?.level)||1;
}

function getMaxInteriorRoomsAtLevel(lv){
  const extra=lv>=2?1+Math.floor((lv-2)/4):0;
  return 9+extra;
}

function getMaxInteriorRooms(){
  return getMaxInteriorRoomsAtLevel(getArchitectureLevel());
}

function getInteriorRoomCount(){
  return Object.keys(state.interior?.cells||{}).length;
}

function getNextArchitectureRoomUnlock(){
  const lv=getArchitectureLevel();
  if(lv<2) return 2;
  return 2+4*(Math.floor((lv-2)/4)+1);
}

function architectureRoomUnlockMessage(){
  const skill=SKILL_META.architecture?.name||'Architecture';
  return 'Reach level '+getNextArchitectureRoomUnlock()+' in '+skill+' to unlock another room!';
}

function formatOrdinalRoom(n){
  const j=n%10, k=n%100;
  if(j===1&&k!==11) return n+'st';
  if(j===2&&k!==12) return n+'nd';
  if(j===3&&k!==13) return n+'rd';
  return n+'th';
}

function architectureRoomBonusXp(roomNumber){
  if(roomNumber<ARCH_ROOM_BONUS_FIRST_ROOM) return 0;
  const tier=roomNumber-ARCH_ROOM_BONUS_FIRST_ROOM+1;
  return Math.floor(ARCH_ROOM_BONUS_BASE_XP*Math.pow(ARCH_ROOM_BONUS_SCALE, tier-1));
}

function migrateArchitectureRoomBonuses(){
  if(!state._archRoomBonuses) state._archRoomBonuses={};
  if(state._archRoomBonusesMigrated) return;
  const count=getInteriorRoomCount();
  for(let n=ARCH_ROOM_BONUS_FIRST_ROOM;n<=count;n++) state._archRoomBonuses[n]=true;
  state._archRoomBonusesMigrated=true;
}

function tryGrantArchitectureRoomBonus(roomNumber){
  if(roomNumber<ARCH_ROOM_BONUS_FIRST_ROOM) return;
  migrateArchitectureRoomBonuses();
  if(state._archRoomBonuses[roomNumber]) return;
  const xp=architectureRoomBonusXp(roomNumber);
  if(xp<1) return;
  state._archRoomBonuses[roomNumber]=true;
  scheduleSaveGame();
  grantXP('architecture', xp, null, {deferLevelUp:true});
  const ordinal=formatOrdinalRoom(roomNumber);
  showFoundBanner(
    'ARCHITECTURE BONUS',
    '🏗️',
    'You receive a bonus for building your '+ordinal+' room for the first time. +'+xp+' Architecture XP!',
    'GOT IT',
    ()=>{ syncUI(); }
  );
}

function computeInteriorAdjacentSpots(){
  migrateInterior();
  const occupied=new Set(Object.keys(state.interior.cells));
  const spots=[];
  const seen=new Set();
  Object.keys(state.interior.cells).forEach(k=>{
    const {x,y}=parseInteriorCoordKey(k);
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
      const nk=interiorCoordKey(x+dx,y+dy);
      if(!occupied.has(nk)&&!seen.has(nk)){
        seen.add(nk);
        spots.push({ x:x+dx, y:y+dy });
      }
    });
  });
  return spots;
}

function computeInteriorExpansionSpots(){
  if(getInteriorRoomCount()>=getMaxInteriorRooms()) return [];
  return computeInteriorAdjacentSpots();
}

function getInteriorExpansionSpots(){
  if(!state.interior.buildMode) return [];
  const atCap=getInteriorRoomCount()>=getMaxInteriorRooms();
  const spots=computeInteriorAdjacentSpots();
  return spots.map(s=>({ ...s, locked:atCap }));
}

function migrateInterior(){
  if(!state.interior) state.interior={ cells:null, buildMode:false, panX:0, panY:0 };
  if(state.interior.buildMode==null) state.interior.buildMode=false;
  if(!state.interior.furnitureRestore) state.interior.furnitureRestore={};
  if(state.interior.panX==null) state.interior.panX=state.interiorPanX||0;
  if(state.interior.panY==null) state.interior.panY=state.interiorPanY||0;
  state.interiorPanX=state.interior.panX;
  state.interiorPanY=state.interior.panY;

  if(state.interior.cells&&Object.keys(state.interior.cells).length){
    migrateInteriorBuildSlots();
    if(typeof migrateApothecaryTable==='function') migrateApothecaryTable();
    if(!isInteriorConnected(state.interior.cells)){
      const {doorwayKey, roomKeys}=collectInteriorRoomKeys();
      state.interior.cells=buildInteriorStackLayout(roomKeys, doorwayKey);
      state._interiorLayoutRepaired=true;
    }
    migrateArchitectureRoomBonuses();
    return;
  }

  state.interior.cells={};
  const layout=state.interiorLayout||DEFAULT_INTERIOR_LAYOUT.slice();
  layout.forEach((key,idx)=>{
    const x=idx%3, y=Math.floor(idx/3);
    state.interior.cells[interiorCoordKey(x,y)]=key;
  });
  migrateArchitectureRoomBonuses();
}

function getInteriorCellKey(x,y){
  return state.interior?.cells?.[interiorCoordKey(x,y)]||null;
}

function forEachInteriorOccupied(fn){
  migrateInterior();
  Object.entries(state.interior.cells).forEach(([k,key])=>{
    const {x,y}=parseInteriorCoordKey(k);
    fn(x,y,key);
  });
}

function getInteriorRenderBounds(expansionSpots){
  let minX=0, maxX=2, minY=0, maxY=2;
  const points=[];
  forEachInteriorOccupied((x,y)=>{ points.push({x,y}); });
  expansionSpots.forEach(p=>points.push(p));
  points.forEach(({x,y})=>{
    minX=Math.min(minX,x); maxX=Math.max(maxX,x);
    minY=Math.min(minY,y); maxY=Math.max(maxY,y);
  });
  const cols=maxX-minX+1, rows=maxY-minY+1;
  return { minX, minY, maxX, maxY, cols, rows, w:cols*INT_CELL_PX+INT_WALL_PX*2, h:rows*INT_CELL_PX+INT_WALL_PX*2 };
}

function getInteriorOccupiedSet(){
  migrateInterior();
  return new Set(Object.keys(state.interior.cells));
}

function applyInteriorWallFaces(el,x,y,key){
  const occ=getInteriorOccupiedSet();
  const outside=(dx,dy)=>!occ.has(interiorCoordKey(x+dx,y+dy));
  el.classList.remove('wall-n','wall-e','wall-s','wall-w');
  if(outside(0,-1)) el.classList.add('wall-n');
  if(outside(1,0)) el.classList.add('wall-e');
  if(outside(0,1)&&key!=='doorway') el.classList.add('wall-s');
  if(outside(-1,0)) el.classList.add('wall-w');
}

function positionInteriorCellEl(el,x,y,minX,minY){
  el.style.left=(INT_WALL_PX+(x-minX)*INT_CELL_PX)+'px';
  el.style.top=(INT_WALL_PX+(y-minY)*INT_CELL_PX)+'px';
  el.dataset.intX=String(x);
  el.dataset.intY=String(y);
}

function isInteriorBuildMode(){
  return !!state.interior?.buildMode;
}

function closeInteriorBuildOverlays(){
  closeInteriorBuildMenu();
  closeStoreOverlay();
  closeFireplaceOverlay();
  closeSpinningWheelOverlay();
  if(typeof closeApothecaryOverlay==='function') closeApothecaryOverlay();
  closeFurnitureOverlay();
}

function toggleInteriorBuildMode(){
  migrateInterior();
  state.interior.buildMode=!state.interior.buildMode;
  closeInteriorBuildOverlays();
  updateInteriorBuildUI();
  renderInteriorGrid();
  const lv=getArchitectureLevel();
  const max=getMaxInteriorRooms();
  const count=getInteriorRoomCount();
  showToast(state.interior.buildMode
    ?('Building mode — drag onto another room to swap, or onto a highlighted ＋ to shift the layout. Moves that disconnect the building are blocked. '+count+'/'+max+' rooms · Architecture Lv '+lv+'.')
    :'Layout saved. Back to living in it.');
}

function updateInteriorBuildUI(){
  const btn=document.getElementById('interior-build-btn');
  const roomsBtn=document.getElementById('interior-rooms-btn');
  const screen=document.getElementById('interior-screen');
  const inBuild=!!state.interior?.buildMode;
  if(btn) btn.textContent=inBuild?'✓ Done building':'🏗️ Building mode';
  if(roomsBtn){
    const count=getInteriorRoomCount();
    const max=getMaxInteriorRooms();
    roomsBtn.textContent=count+'/'+max+' rooms built';
    if(inBuild){
      roomsBtn.hidden=false;
      roomsBtn.classList.add('visible');
    }else{
      roomsBtn.classList.remove('visible');
      roomsBtn.hidden=true;
    }
  }
  screen?.classList.toggle('interior-build-mode',inBuild);
}

function showInteriorRoomCountInfo(){
  migrateInterior();
  const count=getInteriorRoomCount();
  const max=getMaxInteriorRooms();
  const lv=getArchitectureLevel();
  const nextUnlock=getNextArchitectureRoomUnlock();
  showToast(count+'/'+max+' rooms built · Architecture Lv '+lv+'. Next room unlocked at level '+nextUnlock+'.');
}

function previewRemoveInteriorRoom(x,y){
  migrateInterior();
  const k=interiorCoordKey(x,y);
  const cellKey=state.interior.cells[k];
  if(!cellKey||interiorCellType(cellKey)==='doorway') return null;
  const next={...state.interior.cells};
  delete next[k];
  if(Object.keys(next).length<1) return null;
  if(!Object.values(next).some(key=>interiorCellType(key)==='doorway')) return null;
  if(!isInteriorConnected(next)) return null;
  return next;
}

function previewRemoveInteriorEmptyRoom(x,y){
  return previewRemoveInteriorRoom(x,y);
}

function rememberInteriorSlotBeforeFurniture(coordKey, priorCellKey){
  migrateInterior();
  const slot=priorCellKey==='empty'?'empty':'build';
  state.interior.furnitureRestore[coordKey]=slot;
}

function restoreInteriorSlotAfterFurniture(coordKey){
  migrateInterior();
  const restore=state.interior.furnitureRestore[coordKey]||'build';
  delete state.interior.furnitureRestore[coordKey];
  return restore;
}

function moveInteriorFurnitureRestore(fromKey, toKey){
  migrateInterior();
  const r=state.interior.furnitureRestore;
  if(r[fromKey]===undefined) return;
  r[toKey]=r[fromKey];
  delete r[fromKey];
}

function swapInteriorFurnitureRestore(k1, k2){
  migrateInterior();
  const r=state.interior.furnitureRestore;
  const a=r[k1], b=r[k2];
  if(a!==undefined) r[k2]=a;
  else delete r[k2];
  if(b!==undefined) r[k1]=b;
  else delete r[k1];
}

function interiorRemoveBtnHtml(x,y){
  return isInteriorBuildMode()
    ?'<button type="button" class="int-empty-remove" onclick="confirmRemoveInteriorRoom('+x+','+y+',event)">remove</button>'
    :'';
}

function trimStorageToCapacity(cap){
  let trimmed=0;
  Object.keys(state.storage).forEach(key=>{
    const item=state.storage[key];
    if(!item?.count) return;
    if(item.count>cap){
      trimmed+=item.count-cap;
      item.count=cap;
      if(item.count<=0) delete state.storage[key];
    }
  });
  return trimmed;
}

function purgeStoreRoomById(id){
  if(!id) return 0;
  if(!state.purgedStoreRoomIds) state.purgedStoreRoomIds=[];
  if(!state.purgedStoreRoomIds.includes(id)) state.purgedStoreRoomIds.push(id);
  delete state.storeRooms[id];
  if(viewingStoreRoomId===id) viewingStoreRoomId=listStoreRoomIdsOnMap()[0]||null;
  if(typeof craft!=='undefined'&&craft.storeRoomId===id) craft.storeRoomId=null;
  const cap=listStoreRoomIdsOnMap().reduce((sum,rid)=>sum+getStoreRoomCapacity(rid),0);
  return trimStorageToCapacity(cap);
}

function unpurgeStoreRoomId(id){
  if(!state.purgedStoreRoomIds||!id) return;
  state.purgedStoreRoomIds=state.purgedStoreRoomIds.filter(x=>x!==id);
}

function countInteriorDogBeds(cells){
  const map=cells||state.interior?.cells||{};
  return Object.values(map).filter(key=>interiorCellType(key)==='dogbed').length;
}

function wouldRemoveLastDogBed(x,y, nextCells){
  const next=nextCells||previewRemoveInteriorRoom(x,y);
  if(!next) return false;
  return countInteriorDogBeds(next)===0;
}

function releaseAllPetsFromHome(){
  migratePets();
  const count=state.pets.length;
  if(!count) return 0;
  state.pets.forEach(p=>flushPetActiveTime(p));
  state.pets=[];
  state.equippedPetIds=[];
  viewingPetId=null;
  if(currentScreen==='pets-screen'){
    const detail=document.getElementById('pet-detail-panel');
    const list=document.getElementById('pet-list-panel');
    if(detail) detail.style.display='none';
    if(list) list.style.display='block';
  }
  return count;
}

function confirmRemoveInteriorRoom(x,y,e){
  e?.stopPropagation();
  e?.preventDefault();
  if(!isInteriorBuildMode()) return;
  migrateInterior();
  const cellKey=getInteriorCellKey(x,y);
  if(!cellKey||interiorCellType(cellKey)==='doorway') return;
  let {type, instanceId}=parseInteriorCellKey(cellKey);
  if(type==='storeroom'&&!instanceId){
    migrateStoreRooms();
    instanceId=parseInteriorCellKey(getInteriorCellKey(x,y)).instanceId;
  }
  const storeRoomId=instanceId;
  if(type==='furniture'){
    const fdef=getFurnitureDef(instanceId);
    showChoiceBanner(
      'Pick up furniture?',
      fdef?.icon||'🪑',
      'Remove '+(fdef?.name||'this item')+' from the floor? It returns to your supplies. The room stays.',
      'Pick it up',
      'Leave it',
      ()=>setTimeout(()=>removeInteriorFurniture(x,y),0)
    );
    return;
  }
  if(!previewRemoveInteriorRoom(x,y)){
    showToast('Cannot remove that room — the building must stay connected.');
    return;
  }
  showChoiceBanner(
    'Are you absolutely sure?',
    '⚠️',
    'Are you absolutely sure you want to do this? You will lose this room, including everything in it!',
    'Yes, remove it',
    'Keep it',
    ()=>{
      setTimeout(()=>{
        if(type==='storeroom'&&storeRoomId){
          confirmRemoveStoreRoomSecondStep(x,y, storeRoomId);
        }else if(type==='dogbed'&&wouldRemoveLastDogBed(x,y)&&state.pets?.length){
          confirmRemoveDogBedSecondStep(x,y);
        }else{
          removeInteriorRoom(x,y,{confirmed:true});
        }
      },0);
    }
  );
}

function confirmRemoveStoreRoomSecondStep(x,y, storeRoomId){
  showChoiceBanner(
    'Stored resources will be lost',
    '🗄️',
    'Removing this store room will shrink your shared storage capacity. Any item type where stock now exceeds your capacity will be reduced — the rest is destroyed. This cannot be undone.',
    'Destroy and remove',
    'Keep it',
    ()=>setTimeout(()=>removeInteriorRoom(x,y,{storeRoomId, confirmed:true}),0)
  );
}

function confirmRemoveDogBedSecondStep(x,y){
  const n=state.pets.length;
  showChoiceBanner(
    'Your pets will run away',
    '🛏️',
    'This is your last dog bed. With nowhere to sleep, '+(n===1?'your pet':'all '+n+' pets')+' will run away. This cannot be undone.',
    'Remove bed anyway',
    'Keep it',
    ()=>setTimeout(()=>removeInteriorRoom(x,y,{confirmed:true, lastDogBed:true}),0)
  );
}

function removeInteriorFurniture(x,y){
  migrateInterior();
  const k=interiorCoordKey(x,y);
  const cellKey=state.interior.cells?.[k];
  if(!cellKey||interiorCellType(cellKey)!=='furniture') return;
  const {instanceId}=parseInteriorCellKey(cellKey);
  if(!instanceId) return;
  closeInteriorBuildOverlays();
  state.interior.cells[k]=restoreInteriorSlotAfterFurniture(k);
  const fdef=getFurnitureDef(instanceId);
  const icon=fdef?.icon||'📦';
  const name=fdef?.name||instanceId;
  const where=returnOneToBagOrStore(instanceId, icon, name);
  renderInteriorGrid();
  syncUI();
  if(where==='bag') showToast(icon+' '+name+' picked up.');
  else if(where==='store') showToast(icon+' '+name+' returned to store room (bag full).');
  else showToast('Could not return furniture.');
}

function removeInteriorRoom(x,y, opts){
  opts=opts||{};
  migrateInterior();
  const k=interiorCoordKey(x,y);
  const cellKey=state.interior.cells?.[k];
  if(!cellKey){
    showToast('That room is already gone.');
    return;
  }
  const {type, instanceId}=parseInteriorCellKey(cellKey);
  const storeRoomId=opts.storeRoomId||instanceId;

  let next;
  if(opts.confirmed){
    next={...state.interior.cells};
    delete next[k];
    if(!Object.values(next).some(key=>interiorCellType(key)==='doorway')){
      showToast('Cannot remove the exit.');
      return;
    }
    if(Object.keys(next).length<1){
      showToast('Cannot remove that room.');
      return;
    }
    if(!isInteriorConnected(next)){
      showToast('Cannot remove that room — the building must stay connected.');
      return;
    }
  }else{
    next=previewRemoveInteriorRoom(x,y);
    if(!next){
      showToast('Cannot remove that room — the building must stay connected.');
      return;
    }
  }

  closeInteriorBuildOverlays();
  if(state.interior.furnitureRestore) delete state.interior.furnitureRestore[k];

  if(type==='storeroom'){
    if(currentScreen==='storeroom-screen'&&storeRoomId&&viewingStoreRoomId===storeRoomId){
      storeShelfMenuOpen=false;
      showScreen('interior-screen');
      lastHome='interior-screen';
    }
    state.interior.cells=next;
    let trimmed=0;
    if(storeRoomId){
      if(!state.purgedStoreRoomIds) state.purgedStoreRoomIds=[];
      if(!state.purgedStoreRoomIds.includes(storeRoomId)) state.purgedStoreRoomIds.push(storeRoomId);
      delete state.storeRooms[storeRoomId];
      if(viewingStoreRoomId===storeRoomId) viewingStoreRoomId=listStoreRoomIdsOnMap()[0]||null;
      if(typeof craft!=='undefined'&&craft.storeRoomId===storeRoomId) craft.storeRoomId=null;
      trimmed=trimStorageToCapacity(listStoreRoomIdsOnMap().reduce((sum,rid)=>sum+getStoreRoomCapacity(rid),0));
    }
    state._skipStoreRoomMigrateOnce=true;
    renderInteriorGrid();
    syncUI();
    if(trimmed>0) showToast('Store room removed. Excess stock destroyed ('+trimmed+' item'+(trimmed===1?'':'s')+' over capacity).');
    else showToast('Store room removed.');
    return;
  }

  if(type==='furniture'){
    removeInteriorFurniture(x,y);
    return;
  }

  if(type==='dogbed'){
    const lastDogBed=opts.lastDogBed||wouldRemoveLastDogBed(x,y, next);
    state.interior.cells=next;
    let fled=0;
    if(lastDogBed&&state.pets?.length) fled=releaseAllPetsFromHome();
    renderInteriorGrid();
    syncUI();
    if(fled>0){
      showToast('Dog bed removed. '+fled+' pet'+(fled===1?'':'s')+' ran away — nowhere left to sleep.');
    }else{
      showToast('Dog bed removed.');
    }
    return;
  }

  if(type==='apothecary_table'){
    state.interior.cells=next;
    const fdef=getFurnitureDef(APOTHECARY_FURNITURE_KEY);
    const where=returnOneToBagOrStore(APOTHECARY_FURNITURE_KEY, fdef?.icon||'⚗️', fdef?.name||'Apothecary Table');
    renderInteriorGrid();
    syncUI();
    if(where==='bag') showToast('⚗️ Apothecary Table picked up.');
    else if(where==='store') showToast('⚗️ Apothecary Table returned to store room (bag full).');
    else showToast('Apothecary Table removed.');
    return;
  }

  if(type==='wonky_loom'){
    state.interior.cells=next;
    const fdef=getFurnitureDef(WONKY_LOOM_FURNITURE_KEY);
    const where=returnOneToBagOrStore(WONKY_LOOM_FURNITURE_KEY, fdef?.icon||'🧵', fdef?.name||'Wonky Loom');
    renderInteriorGrid();
    syncUI();
    if(where==='bag') showToast('🧵 Wonky Loom picked up.');
    else if(where==='store') showToast('🧵 Wonky Loom returned to store room (bag full).');
    else showToast('Wonky Loom removed.');
    return;
  }

  state.interior.cells=next;
  renderInteriorGrid();
  syncUI();
  const label=INTERIOR_ROOM_DEFS[type]?.name||(type==='empty'?'Empty room':'Room');
  showToast(label+' removed.');
}

function confirmRemoveInteriorEmptyRoom(x,y,e){
  confirmRemoveInteriorRoom(x,y,e);
}

function removeInteriorEmptyRoom(x,y){
  removeInteriorRoom(x,y);
}

function addInteriorRoom(x,y){
  migrateInterior();
  if(getInteriorRoomCount()>=getMaxInteriorRooms()){
    showToast(architectureRoomUnlockMessage());
    return;
  }
  const ok=computeInteriorExpansionSpots().some(s=>s.x===x&&s.y===y);
  if(!ok){ showToast('New rooms must connect to an existing room.'); return; }
  state.interior.cells[interiorCoordKey(x,y)]='empty';
  const roomNumber=getInteriorRoomCount();
  tryGrantArchitectureRoomBonus(roomNumber);
  renderInteriorGrid();
  showToast('Room added. Drag items to fill it.');
  syncUI();
}

function isInteriorConnected(cells){
  const keys=Object.keys(cells);
  if(keys.length<=1) return true;
  const occ=new Set(keys);
  const visited=new Set();
  const queue=[keys[0]];
  visited.add(keys[0]);
  while(queue.length){
    const k=queue.shift();
    const {x,y}=parseInteriorCoordKey(k);
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
      const nk=interiorCoordKey(x+dx,y+dy);
      if(occ.has(nk)&&!visited.has(nk)){ visited.add(nk); queue.push(nk); }
    });
  }
  return visited.size===keys.length;
}

function previewInteriorMove(fromX,fromY,toX,toY){
  migrateInterior();
  const k1=interiorCoordKey(fromX,fromY), k2=interiorCoordKey(toX,toY);
  const roomKey=state.interior.cells[k1];
  if(!roomKey||state.interior.cells[k2]) return null;
  const next={...state.interior.cells};
  delete next[k1];
  next[k2]=roomKey;
  return next;
}

function previewInteriorRelocate(fromX,fromY,toX,toY){
  const next=previewInteriorMove(fromX,fromY,toX,toY);
  if(!next||!isInteriorConnected(next)) return null;
  return next;
}

function isValidInteriorRelocate(fromX,fromY,toX,toY){
  return !!previewInteriorRelocate(fromX,fromY,toX,toY);
}

function collectInteriorRoomKeys(){
  migrateInterior();
  let doorwayKey='doorway';
  const others=[];
  forEachInteriorOccupied((x,y,key)=>{
    if(interiorCellType(key)==='doorway'){
      doorwayKey=key;
      return;
    }
    others.push({x,y,key});
  });
  others.sort((a,b)=>a.y-b.y||a.x-b.x||String(a.key).localeCompare(String(b.key)));
  return { doorwayKey, roomKeys:others.map(o=>o.key) };
}

function buildInteriorStackLayout(roomKeys, doorwayKey){
  const doorway=doorwayKey||'doorway';
  const others=(roomKeys||[]).filter(k=>interiorCellType(k)!=='doorway');
  const count=others.length+1;
  const cols=3;
  const rows=Math.ceil(count/cols);
  const doorwayCoord=interiorCoordKey(1, rows-1);
  const cells={};
  cells[doorwayCoord]=doorway;
  let oi=0;
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const ck=interiorCoordKey(x,y);
      if(ck===doorwayCoord||oi>=others.length) continue;
      cells[ck]=others[oi++];
    }
  }
  return cells;
}

function buildDefaultInteriorCells(roomCount){
  const keyOrder=DEFAULT_INTERIOR_LAYOUT.slice();
  while(keyOrder.length<roomCount) keyOrder.push('empty');
  keyOrder.length=roomCount;
  const doorwayKey=keyOrder.find(k=>k==='doorway')||'doorway';
  const others=keyOrder.filter(k=>k!=='doorway');
  return buildInteriorStackLayout(others, doorwayKey);
}

function resetInteriorToDefault(){
  migrateInterior();
  const {doorwayKey, roomKeys}=collectInteriorRoomKeys();
  state.interior.cells=buildInteriorStackLayout(roomKeys, doorwayKey);
  closeInteriorBuildOverlays();
  updateInteriorBuildUI();
  renderInteriorGrid();
  requestAnimationFrame(()=>recenterInteriorOnHome());
  syncUI();
  showToast('Layout reset — same rooms, stacked three wide from the exit.');
}

function confirmResetInteriorLayout(){
  showChoiceBanner(
    'Reset to default?',
    '🏠',
    'Put every room you have now back into the default stack — three wide, growing up from the exit? Room types and contents stay exactly the same.',
    'Reset layout',
    'Keep it',
    ()=>resetInteriorToDefault()
  );
}

function applyInteriorRelocate(fromX,fromY,toX,toY){
  const next=previewInteriorRelocate(fromX,fromY,toX,toY);
  if(!next){
    showToast('That move would disconnect the building.');
    return false;
  }
  state.interior.cells=next;
  moveInteriorFurnitureRestore(interiorCoordKey(fromX,fromY), interiorCoordKey(toX,toY));
  renderInteriorGrid();
  syncUI();
  return true;
}

function swapInteriorCoords(x1,y1,x2,y2){
  migrateInterior();
  const k1=interiorCoordKey(x1,y1), k2=interiorCoordKey(x2,y2);
  const a=state.interior.cells[k1], b=state.interior.cells[k2];
  if(!a||!b||a===b) return;
  state.interior.cells[k1]=b;
  state.interior.cells[k2]=a;
  swapInteriorFurnitureRestore(k1, k2);
  renderInteriorGrid();
  syncUI();
}

function migrateStoreRoomSlot(){
  migrateStoreRooms();
}

function intDragIcon(cellKey){
  const {type, instanceId}=parseInteriorCellKey(cellKey);
  if(type==='storeroom') return '🗄️';
  if(type==='furniture'){
    return getFurnitureDef(instanceId)?.icon||'🪑';
  }
  return INT_DRAG_ICON[type]||'📦';
}

function buildInteriorCells(){
  // Room visuals are rendered per-cell in refreshInteriorCell().
}

function getInteriorCellElement(x,y){
  const ck=interiorCoordKey(x,y);
  if(!intCoordEls[ck]){
    intCoordEls[ck]=document.createElement('div');
  }
  return intCoordEls[ck];
}

let storeOverlayCloser=null;
let activeStoreOverlayCell=null;
let viewingStoreRoomId=null;

function getStoreRoomCellEl(storeRoomId){
  return document.querySelector('.int-cell[data-store-room-id="'+storeRoomId+'"]');
}

function isStoreOverlayOpen(){
  return !!activeStoreOverlayCell?.classList.contains('plot-activity-menu-ready');
}

function pulseStoreDepositMsg(cell){
  const msg=cell?.querySelector('.store-deposit-msg');
  if(!msg) return;
  msg.classList.remove('store-deposit-pulse');
  void msg.offsetWidth;
  msg.classList.add('store-deposit-pulse');
}

function closeStoreOverlay(){
  if(activeStoreOverlayCell){
    activeStoreOverlayCell.classList.remove('plot-activity-menu-ready');
    activeStoreOverlayCell=null;
  }
  if(storeOverlayCloser){ document.removeEventListener('pointerdown',storeOverlayCloser,true); storeOverlayCloser=null; }
}

function openStoreOverlay(storeRoomId, cell){
  const el=cell||getStoreRoomCellEl(storeRoomId);
  if(!el) return;
  closeStoreOverlay();
  el.classList.add('plot-activity-menu-ready');
  pulseStoreDepositMsg(el);
  activeStoreOverlayCell=el;
  if(storeOverlayCloser) document.removeEventListener('pointerdown',storeOverlayCloser,true);
  storeOverlayCloser=function(e){
    if(e.target.closest('[data-store-cell]')) return;
    closeStoreOverlay();
    e.preventDefault();
    e.stopPropagation();
  };
  setTimeout(()=>document.addEventListener('pointerdown',storeOverlayCloser,true),80);
}

function onStoreRoomCellTap(e, storeRoomId, cell){
  if(intSuppressClick) return;
  if(e?.target?.closest?.('.plot-menu-btn')) return;
  if(isPlotMenuZone(cell, e.clientY)&&cell.classList.contains('plot-activity-menu-ready')){
    storeMenuTap(e, storeRoomId);
    return;
  }
  if(cell.classList.contains('plot-activity-menu-ready')){
    depositAllToStorage();
    pulseStoreDepositMsg(cell);
    return;
  }
  depositAllToStorage();
  openStoreOverlay(storeRoomId, cell);
}

function storeMenuTap(e, storeRoomId){
  e.stopPropagation();
  closeStoreOverlay();
  openStoreRoomScreen(storeRoomId);
}

function renderFireplaceCellContent(el){
  const quick=state.fireplaceQuickAction==='cook'?'cook food':'add log';
  el.dataset.intKey='fireplace';
  el.innerHTML='<div class="fireplace-idle"><div class="int-item">🔥</div><div class="int-label">fireplace</div></div>'
    +'<div class="plot-activity-top">'
    +'<button type="button" class="int-quick-action-btn">'+quick+'</button>'
    +'</div>'
    +'<div class="plot-activity-menu-zone">'
    +'<button type="button" class="plot-menu-btn">menu</button>'
    +'</div>';
  const quickBtn=el.querySelector('.int-quick-action-btn');
  const menuBtn=el.querySelector('.plot-menu-btn');
  if(quickBtn) quickBtn.onclick=(ev)=>{ ev.stopPropagation(); fpQuickTap(ev); };
  if(menuBtn) menuBtn.onclick=(ev)=>{ ev.stopPropagation(); fpMenuTap(ev); };
  el.onclick=(e)=>{
    if(intSuppressClick||isInteriorBuildMode()) return;
    if(e.target.closest('.plot-menu-btn')||e.target.closest('.int-quick-action-btn')) return;
    toggleFireplaceOverlayForCell(el, e);
  };
}

function renderApothecaryTableCellContent(el){
  el.dataset.intKey='apothecary_table';
  el.innerHTML='<div class="apothecary-idle"><div class="int-item">⚗️</div><div class="int-label">apothecary table</div></div>'
    +'<div class="plot-activity-top">'
    +'<button type="button" class="int-quick-action-btn">identify herb</button>'
    +'</div>'
    +'<div class="plot-activity-menu-zone">'
    +'<button type="button" class="plot-menu-btn">menu</button>'
    +'</div>';
  const quickBtn=el.querySelector('.int-quick-action-btn');
  const menuBtn=el.querySelector('.plot-menu-btn');
  if(quickBtn) quickBtn.onclick=(ev)=>{ ev.stopPropagation(); apothQuickTap(ev); };
  if(menuBtn) menuBtn.onclick=(ev)=>{ ev.stopPropagation(); apothMenuTap(ev); };
  el.onclick=(e)=>{
    if(intSuppressClick||isInteriorBuildMode()) return;
    if(e.target.closest('.plot-menu-btn')||e.target.closest('.int-quick-action-btn')) return;
    toggleApothecaryOverlayForCell(el, e);
  };
}

function renderSpinningWheelCellContent(el){
  el.dataset.intKey='spinningwheel';
  el.innerHTML='<div class="spinningwheel-idle"><div class="int-item">🎡</div><div class="int-label">spinning wheel</div></div>'
    +'<div class="plot-activity-top">'
    +'<button type="button" class="int-quick-action-btn">spin fiber</button>'
    +'</div>'
    +'<div class="plot-activity-menu-zone">'
    +'<button type="button" class="plot-menu-btn">menu</button>'
    +'</div>';
  const quickBtn=el.querySelector('.int-quick-action-btn');
  const menuBtn=el.querySelector('.plot-menu-btn');
  if(quickBtn) quickBtn.onclick=(ev)=>{ ev.stopPropagation(); swQuickTap(ev); };
  if(menuBtn) menuBtn.onclick=(ev)=>{ ev.stopPropagation(); swMenuTap(ev); };
  el.onclick=(e)=>{
    if(intSuppressClick||isInteriorBuildMode()) return;
    if(e.target.closest('.plot-menu-btn')||e.target.closest('.int-quick-action-btn')) return;
    toggleSpinningWheelOverlayForCell(el, e);
  };
}

function renderDogbedCellContent(el){
  el.dataset.intKey='dogbed';
  el.innerHTML=
    '<div class="plot-activity-top">'
    +'<div class="int-item">🛏️</div><div class="int-label">dog bed</div>'
    +'</div>'
    +'<div class="plot-activity-menu-zone">'
    +'<button type="button" class="plot-menu-btn">menu</button>'
    +'</div>';
  const menuBtn=el.querySelector('.plot-menu-btn');
  if(menuBtn) menuBtn.onclick=(ev)=>{ ev.stopPropagation(); dbMenuTap(ev, el); };
  el.classList.toggle('dogbed-unlocked',(state.skills.husbandry?.level||1)>=HUSBANDRY_PET_UNLOCK_LEVEL);
}

let activeFurnitureOverlayCell=null;
let furnitureOverlayCloser=null;

function closeFurnitureOverlay(){
  if(activeFurnitureOverlayCell){
    activeFurnitureOverlayCell.querySelector('.fur-overlay')?.classList.remove('open');
    activeFurnitureOverlayCell.classList.remove('fur-menu-open');
    activeFurnitureOverlayCell=null;
  }
  if(furnitureOverlayCloser){ document.removeEventListener('pointerdown',furnitureOverlayCloser,true); furnitureOverlayCloser=null; }
}

function isFurnitureOverlayOpen(){
  return !!activeFurnitureOverlayCell?.querySelector('.fur-overlay.open');
}

function openFurnitureOverlayForCell(cell){
  const ov=cell?.querySelector('.fur-overlay');
  if(!cell||!ov) return;
  closeFurnitureOverlay();
  ov.classList.add('open');
  cell.classList.add('fur-menu-open');
  activeFurnitureOverlayCell=cell;
  if(furnitureOverlayCloser) document.removeEventListener('pointerdown',furnitureOverlayCloser,true);
  furnitureOverlayCloser=function(e){
    if(activeFurnitureOverlayCell?.contains(e.target)) return;
    closeFurnitureOverlay();
    e.preventDefault();
    e.stopPropagation();
  };
  setTimeout(()=>document.addEventListener('pointerdown',furnitureOverlayCloser,true),80);
}

function toggleFurnitureOverlayForCell(cell, event){
  if(intSuppressClick) return;
  if(event?.target?.closest('.fur-half')) return;
  if(activeFurnitureOverlayCell===cell&&isFurnitureOverlayOpen()) closeFurnitureOverlay();
  else openFurnitureOverlayForCell(cell);
}

function furnitureSitTap(ev, furnitureKey){
  ev.stopPropagation();
  closeFurnitureOverlay();
  if(getFurnitureDef(furnitureKey)?.action==='sit') sitOnChair();
}

function sitOnChair(){
  const msg=CHAIR_SIT_LINES[Math.floor(Math.random()*CHAIR_SIT_LINES.length)];
  showFoundBanner('A QUIET MOMENT', '🪑', msg, 'Stand up', ()=>{});
}

function renderFurnitureCellContent(el, instanceId, x, y){
  const fdef=getFurnitureDef(instanceId);
  el.dataset.intKey='furniture';
  el.dataset.furnitureKey=instanceId;
  let html=interiorRemoveBtnHtml(x,y)
    +'<div class="int-item">'+(fdef?.icon||'🪑')+'</div>'
    +'<div class="int-label">'+(fdef?.name||instanceId).toLowerCase()+'</div>';
  if(fdef?.action==='sit'){
    html+='<div class="fur-overlay">'
      +'<button type="button" class="fur-half">sit</button>'
      +'</div>';
  }
  el.innerHTML=html;
  if(fdef?.action==='sit'){
    const sitBtn=el.querySelector('.fur-half');
    if(sitBtn) sitBtn.onclick=(ev)=>{ ev.stopPropagation(); furnitureSitTap(ev, instanceId); };
    el.onclick=(e)=>{
      if(intSuppressClick||isInteriorBuildMode()) return;
      if(e.target.closest('.fur-half')) return;
      toggleFurnitureOverlayForCell(el, e);
    };
  }
}

function refreshInteriorCell(cellKey, el, x, y){
  el.className='int-cell';
  delete el.dataset.storeCell;
  delete el.dataset.storeRoomId;
  el.onclick=null;
  const {type, instanceId}=parseInteriorCellKey(cellKey);

  if(type==='storeroom'&&instanceId){
    el.classList.remove('buildable','empty-room');
    el.dataset.intKey='storeroom';
    el.dataset.storeRoomId=instanceId;
    el.dataset.storeCell='1';
    el.innerHTML=interiorRemoveBtnHtml(x,y)
      +'<div class="store-room-idle"><div class="int-item">🗄️</div><div class="int-label">store room</div></div>'
      +'<div class="plot-activity-top store-deposit-zone">'
      +'<span class="store-deposit-msg store-deposit-pulse">inventory deposited</span>'
      +'</div>'
      +'<div class="plot-activity-menu-zone">'
      +'<button type="button" class="plot-menu-btn">menu</button>'
      +'</div>';
    el.querySelector('.plot-menu-btn')?.addEventListener('click',(ev)=>{
      ev.stopPropagation(); storeMenuTap(ev, instanceId);
    });
    el.onclick=(e)=>{ if(intSuppressClick||isInteriorBuildMode()) return; onStoreRoomCellTap(e, instanceId, el); };
    return;
  }

  if(type==='empty'){
    el.classList.add('buildable','empty-room');
    el.dataset.intKey='empty';
    el.innerHTML=interiorRemoveBtnHtml(x,y)+'<div class="int-item" style="opacity:0.2">▫</div><div class="int-label">empty</div>';
    if(!isInteriorBuildMode()){
      el.onclick=()=>{ if(intSuppressClick) return; openInteriorBuildMenu(x,y); };
    }
    return;
  }

  if(type==='build'){
    el.classList.add('buildable');
    el.dataset.intKey='build';
    el.innerHTML=interiorRemoveBtnHtml(x,y)+'<div class="int-item">＋</div><div class="int-label">build</div>';
    el.onclick=()=>{ if(intSuppressClick||isInteriorBuildMode()) return; openInteriorBuildMenu(x,y); };
    return;
  }

  if(type==='doorway'){
    el.classList.add('doorway');
    el.dataset.intKey='doorway';
    el.innerHTML='<div class="int-item">🚶</div><div class="int-label">exit</div>';
    return;
  }

  if(type==='wardrobe'){
    el.dataset.intKey='wardrobe';
    const glow=!state.axeFound?' wardrobe-glow':'';
    el.innerHTML=interiorRemoveBtnHtml(x,y)+'<div class="int-item'+glow+'">🚪</div><div class="int-label">wardrobe</div>';
    el.onclick=()=>{ if(intSuppressClick||isInteriorBuildMode()) return; openWardrobe(); };
    return;
  }

  if(type==='fireplace'){
    renderFireplaceCellContent(el);
    const rm=interiorRemoveBtnHtml(x,y);
    if(rm) el.insertAdjacentHTML('afterbegin', rm);
    return;
  }

  if(type==='spinningwheel'){
    renderSpinningWheelCellContent(el);
    const rm=interiorRemoveBtnHtml(x,y);
    if(rm) el.insertAdjacentHTML('afterbegin', rm);
    return;
  }

  if(type==='apothecary_table'){
    renderApothecaryTableCellContent(el);
    const rm=interiorRemoveBtnHtml(x,y);
    if(rm) el.insertAdjacentHTML('afterbegin', rm);
    return;
  }

  if(type==='wonky_loom'){
    renderWonkyLoomCellContent(el);
    const rm=interiorRemoveBtnHtml(x,y);
    if(rm) el.insertAdjacentHTML('afterbegin', rm);
    return;
  }

  if(type==='picture'){
    el.dataset.intKey='picture';
    el.innerHTML=interiorRemoveBtnHtml(x,y)+'<div class="int-item" style="transform:rotate(-8deg);display:inline-block">🖼️</div><div class="int-label">picture</div>';
    el.onclick=()=>{ if(intSuppressClick||isInteriorBuildMode()) return; interactPicture(el); };
    return;
  }

  if(type==='workbench'){
    el.dataset.intKey='workbench';
    el.innerHTML=interiorRemoveBtnHtml(x,y)+'<div class="int-item">🪚</div><div class="int-label">workbench</div>';
    el.onclick=()=>{ if(intSuppressClick||isInteriorBuildMode()) return; openWorkbench(); };
    return;
  }

  if(type==='dogbed'){
    renderDogbedCellContent(el);
    const rm=interiorRemoveBtnHtml(x,y);
    if(rm) el.insertAdjacentHTML('afterbegin', rm);
    return;
  }

  if(type==='furniture'&&instanceId){
    renderFurnitureCellContent(el, instanceId, x, y);
    return;
  }

  el.dataset.intKey=type||'';
  el.innerHTML=interiorRemoveBtnHtml(x,y)+'<div class="int-item">📦</div><div class="int-label">'+(type||'?')+'</div>';
}

function decorateInteriorCellEl(el,key){
  el.classList.remove('floor-a','floor-b','doorway');
  const type=interiorCellType(key);
  if(type==='doorway') el.classList.add('doorway');
  const x=Number(el.dataset.intX), y=Number(el.dataset.intY);
  if(!Number.isNaN(x)&&!Number.isNaN(y)){
    el.classList.add((x+y)%2===0?'floor-a':'floor-b');
    applyInteriorWallFaces(el,x,y,type||key);
  }
}

function renderInteriorGrid(){
  const grid=document.getElementById('interior-grid');
  if(!grid) return;
  migrateInterior();
  migrateStoreRoomSlot();
  grid.innerHTML='';
  const expansionSpots=getInteriorExpansionSpots();
  const bounds=getInteriorRenderBounds(computeInteriorExpansionSpots());
  grid.style.width=bounds.w+'px';
  grid.style.height=bounds.h+'px';
  const activeCoords=new Set();

  forEachInteriorOccupied((x,y,key)=>{
    const ck=interiorCoordKey(x,y);
    activeCoords.add(ck);
    const el=getInteriorCellElement(x,y);
    refreshInteriorCell(key, el, x, y);
    positionInteriorCellEl(el,x,y,bounds.minX,bounds.minY);
    decorateInteriorCellEl(el,key);
    grid.appendChild(el);
  });
  Object.keys(intCoordEls).forEach(k=>{ if(!activeCoords.has(k)) delete intCoordEls[k]; });

  if(isInteriorBuildMode()){
    expansionSpots.forEach(({x,y,locked})=>{
      const el=document.createElement('div');
      el.className='int-cell int-expansion'+(locked?' int-expansion-locked':'');
      el.innerHTML='<div class="int-item">＋</div><div class="int-label">'+(locked?'expand':'add room')+'</div>';
      positionInteriorCellEl(el,x,y,bounds.minX,bounds.minY);
      el.onclick=()=>{
        if(intSuppressClick) return;
        if(locked) showToast(architectureRoomUnlockMessage());
        else addInteriorRoom(x,y);
      };
      grid.appendChild(el);
    });
  }

  updateInteriorBuildUI();
  applyInteriorPan();
  if(state._interiorLayoutRepaired){
    state._interiorLayoutRepaired=false;
    showToast('Floor plan was disconnected — restored to a valid layout.');
  }
}

function renderInteriorCells(){
  renderInteriorGrid();
}

function markInteriorDropTarget(target, fromX, fromY){
  if(!target||target.dataset.intX==null) return;
  const tx=Number(target.dataset.intX), ty=Number(target.dataset.intY);
  if(tx===fromX&&ty===fromY) return;
  if(target.classList.contains('int-expansion')){
    if(target.classList.contains('int-expansion-locked')) return;
    if(isValidInteriorRelocate(fromX,fromY,tx,ty)) target.classList.add('int-drop-target');
    return;
  }
  if(getInteriorCellKey(tx,ty)) target.classList.add('int-drop-target');
}

function resolveInteriorDrop(fromX, fromY, target){
  if(!target||target.dataset.intX==null) return false;
  const tx=Number(target.dataset.intX), ty=Number(target.dataset.intY);
  if(tx===fromX&&ty===fromY) return false;
  if(target.classList.contains('int-expansion')){
    if(target.classList.contains('int-expansion-locked')) return false;
    return applyInteriorRelocate(fromX,fromY,tx,ty);
  }
  swapInteriorCoords(fromX,fromY,tx,ty);
  return true;
}

function clearInteriorDropTargets(){
  document.querySelectorAll('.int-cell.int-drop-target').forEach(c=>c.classList.remove('int-drop-target'));
}

function intCellAtPoint(x,y){
  intDragGhost?.style.setProperty('display','none');
  const under=document.elementFromPoint(x,y);
  intDragGhost?.style.removeProperty('display');
  return under?.closest?.('.int-cell');
}

function startIntDragGhost(x,y,key){
  const dragKey=key||intPanDrag?.key;
  intDragGhost=document.createElement('div');
  intDragGhost.className='int-drag-ghost';
  intDragGhost.innerHTML='<span style="font-size:32px;line-height:1;">'+intDragIcon(dragKey)+'</span>';
  document.getElementById('game-wrapper').appendChild(intDragGhost);
  intDragGhost.style.left=x+'px';
  intDragGhost.style.top=y+'px';
}

function moveIntDragGhost(x,y){
  if(!intDragGhost) return;
  intDragGhost.style.left=x+'px';
  intDragGhost.style.top=y+'px';
}

function endIntDragGhost(){
  intDragGhost?.remove();
  intDragGhost=null;
}

function migrateInteriorPan(){
  migrateInterior();
  if(state.interior.panX==null) state.interior.panX=0;
  if(state.interior.panY==null) state.interior.panY=0;
  state.interiorPanX=state.interior.panX;
  state.interiorPanY=state.interior.panY;
}

function applyInteriorPan(){
  migrateInteriorPan();
  const world=document.getElementById('interior-world');
  if(world) world.style.transform='translate('+state.interior.panX+'px,'+state.interior.panY+'px)';
  updateInteriorHomeButton();
}

function getExteriorHutScreenPoint(){
  const hut=document.querySelector('.plot-cell.cell-hut');
  if(hut){
    const h=hut.getBoundingClientRect();
    return { x:h.left+h.width/2, y:h.top+h.height/2 };
  }
  const viewport=document.getElementById('plot-viewport');
  if(!viewport) return null;
  const v=viewport.getBoundingClientRect();
  return { x:v.left+v.width/2, y:v.top+v.height/2 };
}

function updateInteriorHomeButton(){
  const btn=document.getElementById('interior-home-btn');
  const doorway=document.querySelector('.int-cell[data-int-key="doorway"]');
  const target=getExteriorHutScreenPoint();
  if(!btn||!doorway||!target) return;
  const d=doorway.getBoundingClientRect();
  const doorCx=d.left+d.width/2;
  const doorCy=d.top+d.height/2;
  const centered=Math.abs(doorCx-target.x)<14&&Math.abs(doorCy-target.y)<14;
  btn.classList.toggle('visible', !centered);
}

function recenterInteriorOnHome(){
  migrateInteriorPan();
  const doorway=document.querySelector('.int-cell[data-int-key="doorway"]');
  const target=getExteriorHutScreenPoint();
  if(!doorway||!target) return;
  const d=doorway.getBoundingClientRect();
  state.interior.panX+=target.x-(d.left+d.width/2);
  state.interior.panY+=target.y-(d.top+d.height/2);
  state.interiorPanX=state.interior.panX;
  state.interiorPanY=state.interior.panY;
  applyInteriorPan();
}

function handleInteriorCellTap(key, cell, event){
  if(!key||!cell||intSuppressClick||isInteriorBuildMode()) return;
  if(key==='doorway'){ exitHut(); return; }
  if(key==='dogbed'){ onDogbedCellTap(cell, event); return; }
}

function onInteriorViewportPointerDown(e){
  if(e.button!==undefined&&e.button!==0) return;
  if(e.target.closest('#interior-home-btn')) return;
  if(e.target.closest('#interior-rooms-btn')) return;
  if(e.target.closest('#interior-build-btn')) return;
  if(e.target.closest('#interior-reset-btn')) return;
  if(e.target.closest('.int-empty-remove')) return;
  if(e.target.closest('.plot-menu-btn')) return;
  if(e.target.closest('.int-quick-action-btn')) return;
  if(e.target.closest('.fur-half')||e.target.closest('.fur-overlay.open')) return;
  const cell=e.target.closest('.int-cell');
  const canSwap=isInteriorBuildMode()&&cell&&cell.dataset.intKey&&!cell.classList.contains('int-expansion');
  if(canSwap){
    e.preventDefault();
    onInteriorCellPointerDown(e, cell);
    return;
  }
  migrateInteriorPan();
  intPanDrag={
    startX:e.clientX,
    startY:e.clientY,
    startPanX:state.interior.panX,
    startPanY:state.interior.panY,
    cell,
    key:cell?.dataset?.intKey||null,
    mode:null,
    active:false,
    pointerId:e.pointerId,
  };
  document.addEventListener('pointermove',onInteriorViewportPointerMove);
  document.addEventListener('pointerup',onInteriorViewportPointerUp);
  document.addEventListener('pointercancel',onInteriorViewportPointerUp);
}

function onInteriorCellPointerDown(e, cell){
  if(e.button!==undefined&&e.button!==0) return;
  const x=Number(cell.dataset.intX), y=Number(cell.dataset.intY);
  const key=getInteriorCellKey(x,y);
  if(!key) return;
  intSwapDrag={ x, y, key, cell, startX:e.clientX, startY:e.clientY, active:false, pointerId:e.pointerId, hoverTarget:null };
  cell.setPointerCapture(e.pointerId);
  cell.addEventListener('pointermove',onInteriorCellPointerMove);
  cell.addEventListener('pointerup',onInteriorCellPointerUp);
  cell.addEventListener('pointercancel',onInteriorCellPointerUp);
}

function onInteriorCellPointerMove(e){
  if(!intSwapDrag||e.pointerId!==intSwapDrag.pointerId) return;
  const dx=e.clientX-intSwapDrag.startX, dy=e.clientY-intSwapDrag.startY;
  if(!intSwapDrag.active){
    if(Math.hypot(dx,dy)<14) return;
    intSwapDrag.active=true;
    closeInteriorBuildOverlays();
    intSwapDrag.cell.classList.add('int-dragging');
    startIntDragGhost(e.clientX,e.clientY,intSwapDrag.key);
  }
  moveIntDragGhost(e.clientX,e.clientY);
  clearInteriorDropTargets();
  const target=intCellAtPoint(e.clientX,e.clientY);
  intSwapDrag.hoverTarget=target;
  markInteriorDropTarget(target, intSwapDrag.x, intSwapDrag.y);
}

function pickInteriorDropTarget(clientX, clientY, hoverTarget, fromX, fromY){
  const candidates=[];
  if(hoverTarget?.dataset?.intX!=null) candidates.push(hoverTarget);
  const atPoint=intCellAtPoint(clientX,clientY);
  if(atPoint?.dataset?.intX!=null&&!candidates.includes(atPoint)) candidates.push(atPoint);
  for(const target of candidates){
    const tx=Number(target.dataset.intX), ty=Number(target.dataset.intY);
    if(tx===fromX&&ty===fromY) continue;
    if(target.classList.contains('int-expansion')){
      if(target.classList.contains('int-expansion-locked')) continue;
      if(isValidInteriorRelocate(fromX,fromY,tx,ty)) return target;
      continue;
    }
    if(getInteriorCellKey(tx,ty)) return target;
  }
  return null;
}

function onInteriorCellPointerUp(e){
  if(!intSwapDrag||e.pointerId!==intSwapDrag.pointerId) return;
  const cell=intSwapDrag.cell;
  const {x,y}=intSwapDrag;
  cell.releasePointerCapture(e.pointerId);
  cell.removeEventListener('pointermove',onInteriorCellPointerMove);
  cell.removeEventListener('pointerup',onInteriorCellPointerUp);
  cell.removeEventListener('pointercancel',onInteriorCellPointerUp);
  if(intSwapDrag.active){
    const target=pickInteriorDropTarget(e.clientX,e.clientY,intSwapDrag.hoverTarget,x,y);
    resolveInteriorDrop(x,y,target);
    cell.classList.remove('int-dragging');
    clearInteriorDropTargets();
    endIntDragGhost();
    intSuppressClick=true;
    setTimeout(()=>{ intSuppressClick=false; },320);
  }else{
    intSuppressClick=true;
    setTimeout(()=>{ intSuppressClick=false; },280);
  }
  intSwapDrag=null;
}

function onInteriorViewportPointerMove(e){
  if(!intPanDrag||e.pointerId!==intPanDrag.pointerId) return;
  const dx=e.clientX-intPanDrag.startX;
  const dy=e.clientY-intPanDrag.startY;
  if(!intPanDrag.active){
    if(Math.hypot(dx,dy)<10) return;
    intPanDrag.active=true;
    closeInteriorBuildMenu();
    closeStoreOverlay();
    closeFireplaceOverlay();
    closeSpinningWheelOverlay();
    closeFurnitureOverlay();
    hideAllPlotActivityMenus();
    intPanDrag.mode='pan';
    intSuppressClick=true;
    document.getElementById('interior-viewport')?.classList.add('panning');
  }
  if(intPanDrag.mode==='pan'){
    state.interior.panX=intPanDrag.startPanX+dx;
    state.interior.panY=intPanDrag.startPanY+dy;
    state.interiorPanX=state.interior.panX;
    state.interiorPanY=state.interior.panY;
    applyInteriorPan();
  }
}

function onInteriorViewportPointerUp(e){
  if(!intPanDrag||e.pointerId!==intPanDrag.pointerId) return;
  const wasTap=!intPanDrag.active;
  const {key}=intPanDrag;
  document.removeEventListener('pointermove',onInteriorViewportPointerMove);
  document.removeEventListener('pointerup',onInteriorViewportPointerUp);
  document.removeEventListener('pointercancel',onInteriorViewportPointerUp);
  document.getElementById('interior-viewport')?.classList.remove('panning');
  if(intPanDrag.active){
    setTimeout(()=>{ intSuppressClick=false; },280);
  }else if(wasTap){
    handleInteriorCellTap(key, intPanDrag.cell, e);
  }
  intPanDrag=null;
}

function initInteriorGrid(){
  buildInteriorCells();
  migrateInterior();
  migrateStoreRoomSlot();
  migrateInteriorPan();
  renderInteriorGrid();
  if(interiorNeedsHomeCenter){
    interiorNeedsHomeCenter=false;
    requestAnimationFrame(()=>recenterInteriorOnHome());
  }
  document.getElementById('interior-viewport')?.addEventListener('pointerdown',onInteriorViewportPointerDown);
}
