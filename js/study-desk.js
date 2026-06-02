/* Hearthstead — study desk (academia) */
'use strict';

function ensureStudyDeskState(){
  if(!state.studyDesk) state.studyDesk={ books:{}, maps:{} };
  if(!state.studyDesk.books) state.studyDesk.books={};
  if(!state.studyDesk.maps) state.studyDesk.maps={};
  Object.keys(ACADEMIA_BOOKS||{}).forEach((bookId)=>{
    if(!state.studyDesk.books[bookId]){
      state.studyDesk.books[bookId]={ pages:[], completed:false };
      return;
    }
    const b=state.studyDesk.books[bookId];
    if(!Array.isArray(b.pages)) b.pages=[];
    b.pages=b.pages.filter((n)=>Number.isFinite(n)&&n>=1).map((n)=>n|0);
    if(b.completed==null) b.completed=!!b.completed;
  });
  Object.keys(ACADEMIA_MAPS||{}).forEach((mapId)=>{
    if(!state.studyDesk.maps[mapId]){
      state.studyDesk.maps[mapId]={ pieces:[], completed:false };
      return;
    }
    const m=state.studyDesk.maps[mapId];
    if(!Array.isArray(m.pieces)) m.pieces=[];
    m.pieces=m.pieces.filter((n)=>Number.isFinite(n)&&n>=1).map((n)=>n|0);
    if(m.completed==null) m.completed=!!m.completed;
    const mapDef=getAcademiaMapDef(mapId);
    if(mapDef&&m.pieces.length>=mapDef.pieceCount) m.completed=true;
  });
}

function getStudyDeskMapState(mapId){
  ensureStudyDeskState();
  return state.studyDesk.maps[mapId]||{ pieces:[], completed:false };
}

function hasStudyDeskMapPiece(mapId,pieceNum){
  return getStudyDeskMapState(mapId).pieces.includes(pieceNum|0);
}

function studyDeskMapPieceCount(mapId){
  return getStudyDeskMapState(mapId).pieces.length;
}

function isStudyDeskMapComplete(mapId){
  const map=getAcademiaMapDef(mapId);
  const prog=getStudyDeskMapState(mapId);
  if(prog.completed) return true;
  return map&&prog.pieces.length>=map.pieceCount;
}

function rollMissingStudyDeskMapPiece(mapId){
  const map=getAcademiaMapDef(mapId);
  if(!map) return null;
  const missing=[];
  for(let n=1;n<=map.pieceCount;n++){
    if(!hasStudyDeskMapPiece(mapId,n)&&!wetMapPieceInBagOrStore(n)) missing.push(n);
  }
  if(!missing.length) return null;
  for(let i=missing.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    const tmp=missing[i];
    missing[i]=missing[j];
    missing[j]=tmp;
  }
  for(const num of missing){
    const denom=getAcademiaMapPieceDropDenom(mapId,num);
    if(!denom) continue;
    if(Math.random()<1/denom) return num;
  }
  return null;
}

function wetMapPieceItemKey(pieceNum){
  return 'wet_map_piece_'+(pieceNum|0);
}

function wetMapPieceInBagOrStore(pieceNum){
  return itemCountBagAndStore(wetMapPieceItemKey(pieceNum))>0;
}

function tryFishingWetMapPieceDrop(){
  const mapId='wet';
  if(isStudyDeskMapComplete(mapId)) return null;
  const pieceNum=rollMissingStudyDeskMapPiece(mapId);
  if(pieceNum==null) return null;
  if(wetMapPieceInBagOrStore(pieceNum)) return null;
  const key=wetMapPieceItemKey(pieceNum);
  const def=ACADEMIA_MAP_PIECE_ITEMS[key]||getItemDef(key);
  if(invTotal()>=getInvCap()){
    showToast('Bag full — could not keep wet map piece.');
    return null;
  }
  invAddDirect(key, def.icon, def.name, 1);
  const label=def.name||('Wet Map Piece '+pieceNum);
  const msg='🧩 '+label+' found!';
  addActivityLog('fish-log', msg, 'success');
  showToast(msg);
  if(typeof markDirty==='function') markDirty('inventory');
  scheduleSaveGame();
  return pieceNum;
}

function depositStudyDeskMapPiece(mapId,pieceNum){
  ensureStudyDeskState();
  const map=getAcademiaMapDef(mapId);
  const num=pieceNum|0;
  if(!map||num<1||num>map.pieceCount) return { ok:false };
  if(hasStudyDeskMapPiece(mapId,num)){
    showToast('Piece '+num+' is already on the map.');
    renderStudyDeskScreen();
    return { ok:false };
  }
  if(isStudyDeskMapComplete(mapId)){
    showToast(map.name+' is already complete.');
    renderStudyDeskScreen();
    return { ok:false, complete:true };
  }
  const key=wetMapPieceItemKey(num);
  if(!wetMapPieceInBagOrStore(num)){
    showToast('No Wet Map Piece '+num+' in your bag or store room.');
    renderStudyDeskScreen();
    return { ok:false };
  }
  if(!consumeOneFromBagOrStore(key)){
    showToast('Could not take Wet Map Piece '+num+'.');
    return { ok:false };
  }
  const prog=state.studyDesk.maps[mapId];
  prog.pieces.push(num);
  prog.pieces.sort((a,b)=>a-b);
  const justCompleted=prog.pieces.length>=map.pieceCount;
  if(justCompleted) prog.completed=true;
  const pieceXp=typeof academiaMapPieceXpForPiece==='function'?academiaMapPieceXpForPiece(num):500*num;
  grantAcademiaStudyXp(pieceXp);
  addActivityLog('study-desk-log', '🧩 '+map.name+' piece '+num+' placed. +'+pieceXp+' Academia ('+prog.pieces.length+'/'+map.pieceCount+')', 'success');
  showToast('🧩 '+map.name+' piece '+num+' placed. +'+pieceXp+' Academia');
  if(justCompleted){
    setTimeout(()=>showToast(map.icon+' '+map.name+' complete!'), 450);
  }
  if(typeof markDirty==='function') markDirty('inventory','skills');
  scheduleSaveGame();
  renderStudyDeskScreen();
  syncUI();
  return { ok:true, pieceNum:num };
}

function depositWetMapPiece(pieceNum){
  return depositStudyDeskMapPiece('wet', pieceNum);
}

function getStudyDeskBookState(bookId){
  ensureStudyDeskState();
  return state.studyDesk.books[bookId]||{ pages:[], completed:false };
}

function hasStudyDeskPage(bookId,pageNum){
  const b=getStudyDeskBookState(bookId);
  return b.pages.includes(pageNum|0);
}

function studyDeskUniquePageCount(bookId){
  return new Set(getStudyDeskBookState(bookId).pages).size;
}

function studyDeskOwnedPageCount(bookId){
  return studyDeskUniquePageCount(bookId);
}

function isStudyDeskBookComplete(bookId){
  const book=getAcademiaBookDef(bookId);
  const b=getStudyDeskBookState(bookId);
  if(b.completed) return true;
  return book&&studyDeskUniquePageCount(bookId)>=book.pageCount;
}

function rollStudyDeskPageNumber(bookId,pageMin,pageMax){
  const book=getAcademiaBookDef(bookId);
  if(!book) return null;
  const min=pageMin!=null?pageMin|0:1;
  const max=pageMax!=null?pageMax|0:book.pageCount;
  if(max<min) return null;
  return min+Math.floor(Math.random()*(max-min+1));
}

function mysteryTierPageStock(tierKey){
  return itemCountBagAndStore(tierKey);
}

function mysteryPageStockForBook(bookId){
  const book=getAcademiaBookDef(bookId);
  if(!book) return 0;
  if(book.mysteryPageKey) return itemCountBagAndStore(book.mysteryPageKey);
  if(book.pageTiers?.length){
    return book.pageTiers.reduce((sum,t)=>sum+mysteryTierPageStock(t.key),0);
  }
  return 0;
}

function buildStudyDeskUtilityMenuItem(x,y){
  const def=INTERIOR_ROOM_DEFS.study_desk;
  if(!def) return '';
  const stock=itemCountBagAndStore(STUDY_DESK_FURNITURE_KEY);
  const hasStock=stock>0;
  const tagHtml=typeof furnitureUtilityTaglineHtml==='function'?furnitureUtilityTaglineHtml(STUDY_DESK_FURNITURE_KEY):'';
  const drops=(hasStock
    ?formatRecipeMatLine(def?.name||'Study Desk', 1, stock)+' — ready to place'
    :'Craft one at the workbench first')
    +(tagHtml?' · '+tagHtml:'');
  const cls='plot-add-item '+(hasStock?'structure-unlocked':'structure-locked below-rec is-disabled');
  return '<button type="button" class="'+cls+'"'+(hasStock?'':' disabled')+(hasStock?' onclick="placeInteriorStudyDesk('+x+','+y+')"':'')+'>'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'+def.name
    +'<span class="plot-add-item-drops">'+drops+'</span></span></button>';
}

function placeInteriorStudyDesk(x,y){
  const def=INTERIOR_ROOM_DEFS.study_desk;
  if(!def){ closeInteriorBuildMenu(); return; }
  if(!studyDeskInStock()){
    showToast('Craft a Study Desk at the workbench first.');
    closeInteriorBuildMenu();
    return;
  }
  migrateInterior();
  const ck=interiorCoordKey(x,y);
  const cellKey=state.interior.cells[ck];
  if(!isInteriorBuildSlotKey(cellKey)){
    showToast('Pick an empty room or build slot.');
    closeInteriorBuildMenu();
    return;
  }
  if(!consumeOneFromBagOrStore(STUDY_DESK_FURNITURE_KEY)){
    showToast('Could not take Study Desk.');
    closeInteriorBuildMenu();
    return;
  }
  state.interior.cells[ck]='study_desk';
  closeInteriorBuildMenu();
  renderInteriorGrid();
  syncUI();
  scheduleSaveGame();
  showToast(def.icon+' '+def.name+' built.');
}

function migrateStudyDesk(){
  if(typeof craft!=='undefined'&&craft?.recipeKey==='table') craft.recipeKey='study_desk';
  if(state.lastWorkbenchRecipe==='table') state.lastWorkbenchRecipe='study_desk';
  if(state.craftProgress?.table){
    state.craftProgress.study_desk=state.craftProgress.table;
    delete state.craftProgress.table;
  }
  if(!state.interior?.cells) return;
  Object.keys(state.interior.cells).forEach(k=>{
    const key=state.interior.cells[k];
    if(key==='furniture:table'||key==='table') state.interior.cells[k]='study_desk';
  });
  ensureStudyDeskState();
  if(typeof ensurePocketsState==='function') ensurePocketsState();
}

function renderStudyDeskCellContent(el){
  el.dataset.intKey='study_desk';
  el.innerHTML='<div class="study-desk-idle"><div class="int-item">📖</div><div class="int-label">study desk</div></div>'
    +'<div class="plot-activity-top">'
    +'<button type="button" class="int-quick-action-btn">study</button>'
    +'</div>'
    +'<div class="plot-activity-menu-zone">'
    +'<button type="button" class="plot-menu-btn">menu</button>'
    +'</div>';
  const quickBtn=el.querySelector('.int-quick-action-btn');
  const menuBtn=el.querySelector('.plot-menu-btn');
  const open=()=>openStudyDeskScreen();
  if(quickBtn) quickBtn.onclick=(ev)=>{ ev.stopPropagation(); open(); };
  if(menuBtn) menuBtn.onclick=(ev)=>{ ev.stopPropagation(); open(); };
  el.onclick=(e)=>{
    if(intSuppressClick||isInteriorBuildMode()) return;
    if(e.target.closest('.plot-menu-btn')||e.target.closest('.int-quick-action-btn')) return;
    open();
  };
}

let studyDeskTab='books';
let studyBookId='gathering';
let studyBookPickerOpen=false;
let studyArtefactExamKey='artefact_basic';
let studyArtefactPickerOpen=false;
let studyWetMapPickerOpen=false;

function openStudyDeskScreen(){
  showScreen('study-desk-screen');
  lastHome='interior-screen';
  renderStudyDeskScreen();
}

function closeStudyDeskScreen(){
  showScreen('interior-screen');
  lastHome='interior-screen';
  syncUI();
}

function setStudyDeskTab(tab){
  if(tab!=='books'&&tab!=='maps'&&tab!=='artefacts') return;
  studyDeskTab=tab;
  if(tab==='artefacts') studyArtefactPickerOpen=false;
  if(tab==='maps') studyWetMapPickerOpen=false;
  if(tab==='books') studyBookPickerOpen=false;
  renderStudyDeskScreen();
}

function toggleStudyBookPicker(){
  studyBookPickerOpen=!studyBookPickerOpen;
  renderStudyDeskScreen();
}

function selectStudyBook(bookId){
  if(!ACADEMIA_BOOKS[bookId]) return;
  studyBookId=bookId;
  studyBookPickerOpen=false;
  renderStudyDeskScreen();
}

function toggleStudyWetMapPicker(){
  studyWetMapPickerOpen=!studyWetMapPickerOpen;
  renderStudyDeskScreen();
}

function grantAcademiaStudyXp(amount,opts){
  if(!amount) return;
  grantXP('academia', amount, null, { keepActivities:true, ...(opts||{}) });
  if(typeof spawnSkillXpToken==='function') spawnSkillXpToken('academia', amount, 'study');
}

function grantGlisteningPocketShard(){
  if(typeof ensurePocketsState==='function') ensurePocketsState();
  else if(!state.pockets) state.pockets={ fire:0, water:0, earth:0, air:0, magic:0, glistening:0 };
  state.pockets.glistening=(state.pockets.glistening||0)+1;
  const m=ACADEMIA_POCKET_ITEMS.glistening;
  if(!state._seenGlisteningShard){
    state._seenGlisteningShard=true;
    showFoundBanner('POCKET FIND!', m.icon,
      'A glistening shard — it catches the light even in your pocket. Save it for when magic and study truly meet.',
      'GOT IT', ()=>{ if(openPanel==='inv') renderInvPanel(); syncUI(); });
  }else if(openPanel==='inv') renderInvPanel();
  if(typeof markDirty==='function') markDirty('inventory');
  return true;
}

function artefactExamStock(key){
  return itemCountBagAndStore(key);
}

function studyArtefactAvailLineHtml(stock){
  const cls=typeof wbStockClass==='function'?wbStockClass(stock, 1):(stock>0?'ok':'missing');
  const text=stock>0
    ?(typeof formatAvailableCount==='function'?formatAvailableCount(stock):stock+' available')
    :'none in bag or store';
  return '<span class="wb-mat-pick-avail wb-mat-pick-line '+cls+'">'+text+'</span>';
}

function selectStudyArtefactExam(key){
  if(!ACADEMIA_ARTEFACT_EXAMINE[key]) return;
  studyArtefactExamKey=key;
  studyArtefactPickerOpen=false;
  renderStudyDeskScreen();
}

function toggleStudyArtefactPicker(){
  studyArtefactPickerOpen=!studyArtefactPickerOpen;
  renderStudyDeskScreen();
}

function examineArtefactAtStudyDesk(artefactKey){
  const def=getAcademiaArtefactExamineDef(artefactKey||studyArtefactExamKey);
  if(!def) return { ok:false };
  if(artefactExamStock(def.key)<1){
    showToast('No '+def.name.toLowerCase()+' in your bag or store room.');
    renderStudyDeskScreen();
    return { ok:false };
  }
  if(!consumeOneFromBagOrStore(def.key)){
    showToast('Could not take the artefact.');
    return { ok:false };
  }
  const invBefore=invTotal();
  const outcome=rollArtefactExamineOutcome(def);
  let academiaXp=def.academiaXp;
  let logMsg='';
  let logType='success';
  let toastMsg='';

  if(outcome==='shard'){
    grantGlisteningPocketShard();
    academiaXp=def.academiaXp+ACADEMIA_GLISTENING_SHARD_XP_BONUS;
    grantAcademiaStudyXp(academiaXp);
    const shardIcon=ACADEMIA_POCKET_ITEMS.glistening.icon;
    logMsg='Examined '+def.icon+' '+def.name+'. '+shardIcon+' Glistening shard! +'+academiaXp+' Academia';
    toastMsg=shardIcon+' Glistening shard! +'+academiaXp+' Academia';
  }else if(outcome==='botanical'){
    academiaXp=def.academiaXp*2;
    grantAcademiaStudyXp(academiaXp);
    const bot=typeof getBotanyItemDef==='function'?getBotanyItemDef(def.botanicalKey):null;
    if(bot&&invTotal()<getInvCap()){
      invAddDirect(bot.key, bot.icon, bot.name, 1, { pickupBaseline:invBefore });
      logMsg='Examined '+def.icon+' '+def.name+'. '+bot.icon+' '+bot.name+'! +'+academiaXp+' Academia';
      toastMsg=bot.icon+' '+bot.name+'! +'+academiaXp+' Academia';
    }else if(bot){
      logMsg='Examined '+def.icon+' '+def.name+'. '+bot.icon+' '+bot.name+'! +'+academiaXp+' Academia';
      toastMsg='+'+academiaXp+' Academia — bag full, could not keep the '+bot.name.toLowerCase()+'.';
    }else{
      logMsg='Examined '+def.icon+' '+def.name+'. +'+academiaXp+' Academia';
      toastMsg='+'+academiaXp+' Academia';
    }
  }else{
    grantXP('earth', ACADEMIA_ARTEFACT_NOTHING_EARTH_XP, null, { keepActivities:true, skipShardDrop:true });
    const flavor=pickArtefactNothingFlavor();
    logMsg=flavor;
    logType='fail';
    toastMsg=flavor;
  }

  addActivityLog('study-desk-log', logMsg, logType);
  if(outcome==='nothing') showToast(toastMsg, { dim:true });
  else showToast(toastMsg);
  if(typeof markDirty==='function') markDirty('inventory','skills');
  scheduleSaveGame();
  renderStudyDeskScreen();
  syncUI();
  return { ok:true, outcome };
}

function examineSelectedArtefact(){
  return examineArtefactAtStudyDesk(studyArtefactExamKey);
}

function depositStudyDeskMysteryPage(bookId,tierKey){
  ensureStudyDeskState();
  const book=getAcademiaBookDef(bookId);
  if(!book) return { ok:false };
  const prog=state.studyDesk.books[bookId];
  if(prog.completed||isStudyDeskBookComplete(bookId)){
    if(!prog.completed) prog.completed=true;
    showToast('📖 '+book.name+' is already complete.');
    renderStudyDeskScreen();
    return { ok:false, complete:true };
  }
  let consumeKey=null;
  let pageMin=1;
  let pageMax=book.pageCount;
  if(tierKey){
    const tier=getAcademiaBookTierDef(bookId,tierKey);
    if(!tier){
      showToast('Unknown page type.');
      return { ok:false };
    }
    consumeKey=tier.key;
    pageMin=tier.pageMin;
    pageMax=tier.pageMax;
    if(mysteryTierPageStock(tierKey)<1){
      showToast('No '+tier.name.toLowerCase()+' in your bag or store room.');
      renderStudyDeskScreen();
      return { ok:false };
    }
  }else if(book.mysteryPageKey){
    consumeKey=book.mysteryPageKey;
    if(mysteryTierPageStock(consumeKey)<1){
      showToast('No page for this book in your bag or store room.');
      renderStudyDeskScreen();
      return { ok:false };
    }
  }else{
    showToast('Nothing to deposit for this book.');
    return { ok:false };
  }
  const pageNum=rollStudyDeskPageNumber(bookId,pageMin,pageMax);
  if(pageNum==null){
    showToast('Could not read the page.');
    return { ok:false };
  }
  if(!consumeOneFromBagOrStore(consumeKey)){
    showToast('Could not take the page.');
    return { ok:false };
  }
  const pageXp=academiaPageXpForDeposit(book, tierKey||null);
  const isDuplicate=hasStudyDeskPage(bookId, pageNum);
  grantAcademiaStudyXp(pageXp);

  if(isDuplicate){
    const dupMsg='Duplicate page '+pageNum+' found, you throw it away. +'+pageXp+' Academia';
    addActivityLog('study-desk-log', dupMsg, 'fail');
    showToast(dupMsg, { dim:true });
  }else{
    prog.pages.push(pageNum);
    prog.pages.sort((a,b)=>a-b);
    const pageLabel=academiaNumberedPageLabel(book, pageNum);
    addActivityLog('study-desk-log', '📄 '+pageLabel+' added to the desk. +'+pageXp+' Academia', 'success');
    showToast('📄 '+pageLabel+' catalogued! +'+pageXp+' Academia');
  }

  let bookXp=0;
  if(!isDuplicate&&studyDeskUniquePageCount(bookId)>=book.pageCount&&!prog.completed){
    prog.completed=true;
    bookXp=academiaBookCompleteXpForBook(book);
    grantAcademiaStudyXp(bookXp);
    addActivityLog('study-desk-log', '📖 '+book.name+' complete! +'+bookXp+' Academia', 'success');
    setTimeout(()=>showToast('📖 '+book.name+' complete! +'+bookXp+' Academia'), 400);
  }

  if(typeof markDirty==='function') markDirty('inventory','skills');
  scheduleSaveGame();
  renderStudyDeskScreen();
  syncUI();
  return { ok:true, pageNum, pageXp, bookXp };
}

function depositGatheringPage(){
  return depositStudyDeskMysteryPage('gathering');
}

function depositForestryTierPage(tierKey){
  return depositStudyDeskMysteryPage('forestry', tierKey);
}

function resetStudyDeskBook(bookId){
  ensureStudyDeskState();
  const book=getAcademiaBookDef(bookId);
  if(!book) return { ok:false };
  const prog=state.studyDesk.books[bookId];
  if(!prog.completed&&!isStudyDeskBookComplete(bookId)){
    showToast('Complete the book before you can reset it.');
    renderStudyDeskScreen();
    return { ok:false };
  }
  prog.pages=[];
  prog.completed=false;
  addActivityLog('study-desk-log', '📖 '+book.name+' book reset — pages cleared for another run.', 'success');
  showToast('📖 '+book.name+' book reset. Deposit pages again to earn Academia XP.');
  if(typeof markDirty==='function') markDirty('skills');
  scheduleSaveGame();
  renderStudyDeskScreen();
  syncUI();
  return { ok:true };
}

function resetGatheringBook(){
  return resetStudyDeskBook('gathering');
}

function resetForestryBook(){
  return resetStudyDeskBook('forestry');
}

const STUDY_DESK_PAGES_PER_CHAPTER=5;

function studyDeskBookChapterPageRange(book,chapterNum){
  const start=(chapterNum-1)*STUDY_DESK_PAGES_PER_CHAPTER+1;
  const end=Math.min(chapterNum*STUDY_DESK_PAGES_PER_CHAPTER, book.pageCount);
  return { start, end };
}

function studyDeskBookChapterCount(book){
  return Math.ceil((book?.pageCount||0)/STUDY_DESK_PAGES_PER_CHAPTER);
}

function isStudyDeskChapterComplete(bookId,chapterNum){
  const book=getAcademiaBookDef(bookId);
  if(!book) return false;
  const { start, end }=studyDeskBookChapterPageRange(book, chapterNum);
  const prog=getStudyDeskBookState(bookId);
  for(let n=start;n<=end;n++){
    if(!prog.pages.includes(n)) return false;
  }
  return true;
}

function studyDeskPageSlotHtml(book,pageNum,owned){
  const cls='study-page-slot'+(owned?' owned':'')+(owned&&isStudyDeskBookComplete(book.id)?' book-complete':'');
  const title=owned?(book.name+' Page '+pageNum):(book.name+' — page '+pageNum+' missing');
  return '<span class="'+cls+'" title="'+title+'">'+pageNum+'</span>';
}

function studyDeskBookProgressMeta(bookId){
  const book=getAcademiaBookDef(bookId);
  if(!book) return { text:'', cls:'' };
  const owned=studyDeskUniquePageCount(bookId);
  const total=book.pageCount;
  const complete=isStudyDeskBookComplete(bookId);
  const text=complete?'Complete':owned+'/'+total+' pages';
  const cls=complete?'ok':(typeof wbStockClass==='function'?wbStockClass(owned, total):'');
  return { text, cls };
}

function studyDeskBookChaptersBodyHtml(book){
  const prog=getStudyDeskBookState(book.id);
  const chapters=studyDeskBookChapterCount(book);
  let body='';
  for(let ch=1;ch<=chapters;ch++){
    const { start, end }=studyDeskBookChapterPageRange(book, ch);
    const chComplete=isStudyDeskChapterComplete(book.id, ch);
    let slots='';
    for(let n=start;n<=end;n++) slots+=studyDeskPageSlotHtml(book,n,prog.pages.includes(n));
    body+='<div class="study-book-chapter'+(chComplete?' is-complete':'')+'">'
      +'<div class="study-book-chapter-head">'
      +'<span class="study-book-chapter-label">Chapter '+ch+'</span>'
      +(chComplete?'<span class="study-book-chapter-complete">complete!</span>':'')
      +'</div>'
      +'<div class="study-page-row">'+slots+'</div>'
      +'</div>';
  }
  return '<div class="study-book-body">'+body+'</div>';
}

function renderStudyBookChaptersSection(book){
  return '<div class="store-items study-chapters-section">'
    +'<div class="store-items-title">CHAPTERS</div>'
    +studyDeskBookChaptersBodyHtml(book)
    +'</div>';
}

function renderStudyBookCollapsedHeader(book){
  const { text, cls }=studyDeskBookProgressMeta(book.id);
  const complete=isStudyDeskBookComplete(book.id);
  return '<div class="wb-log-pick wb-log-pick-collapsed study-book-toggle'+(complete?' ready':'')+' selected" onclick="toggleStudyBookPicker()">'
    +'<span class="wb-mat-icon">'+book.icon+'</span>'
    +'<div class="wb-mat-pick-body">'
    +'<span class="plot-add-item-title-row"><span class="plot-add-item-title">'+book.name+'</span></span>'
    +'<span class="wb-mat-pick-avail wb-mat-pick-line '+cls+'">'+text+'</span>'
    +'</div>'
    +'<span class="wb-log-pick-chevron">▾</span>'
    +'</div>';
}

function renderStudyBookPickerList(){
  return Object.keys(ACADEMIA_BOOKS).map((id)=>{
    const book=ACADEMIA_BOOKS[id];
    const sel=studyBookId===id;
    const { text, cls }=studyDeskBookProgressMeta(id);
    const clickAction=sel?'toggleStudyBookPicker()':'selectStudyBook(\''+id+'\')';
    return '<div class="wb-mat-option'+(sel?' selected':'')+'" onclick="'+clickAction+'">'
      +'<span class="wb-mat-icon">'+book.icon+'</span>'
      +'<span class="wb-mat-info">'
      +'<span class="wb-mat-name">'+book.name+'</span>'
      +'<span class="wb-mat-pick-avail wb-mat-pick-line '+cls+'">'+text+'</span>'
      +'</span></div>';
  }).join('');
}

function renderStudyDeskBooksPanel(){
  const el=document.getElementById('study-books-stock');
  if(!el) return;
  ensureStudyDeskState();
  const bookIds=Object.keys(ACADEMIA_BOOKS||{});
  if(!bookIds.length){
    el.innerHTML='<div class="store-line" style="color:rgba(200,169,110,0.45)">No books defined yet.</div>';
    return;
  }
  if(!ACADEMIA_BOOKS[studyBookId]) studyBookId=bookIds[0];
  const book=getAcademiaBookDef(studyBookId);
  const bookCollapsed=renderStudyBookCollapsedHeader(book);
  const bookOpen=renderStudyBookPickerList();
  const bookSection=typeof renderRecipeSectionPicker==='function'
    ?renderRecipeSectionPicker({
      title:'BOOKS',
      open:studyBookPickerOpen,
      collapsedHtml:bookCollapsed,
      openHtml:bookOpen,
    })
    :(studyBookPickerOpen?bookOpen:bookCollapsed);
  el.innerHTML=bookSection+renderStudyBookChaptersSection(book);
}

function studyDeskMapPieceSlotHtml(map,mapId,pieceNum,owned){
  const cls='study-page-slot study-map-slot'+(owned?' owned':' study-map-slot--placeable');
  const title=owned
    ?(map.name+' — piece '+pieceNum)
    :(map.name+' — place piece '+pieceNum+' (needs Wet Map Piece '+pieceNum+' in bag or store)');
  const click=owned?'':' onclick="depositStudyDeskMapPiece(\''+mapId+'\','+pieceNum+')"';
  return '<span class="'+cls+'"'+click+' title="'+title+'" role="button" tabindex="0">'+pieceNum+'</span>';
}

function renderStudyDeskMapCollapsedSummary(map,expanded){
  const owned=studyDeskMapPieceCount(map.id);
  const total=map.pieceCount;
  const complete=isStudyDeskMapComplete(map.id);
  const progress=complete?'Complete':owned+'/'+total+' pieces';
  return '<div class="wb-log-pick wb-log-pick-collapsed study-map-toggle'+(complete?' ready':'')+(expanded?' study-map-toggle--open':'')+' selected" onclick="toggleStudyWetMapPicker()">'
    +'<span class="wb-mat-icon">'+map.icon+'</span>'
    +'<div class="wb-mat-pick-body">'
    +'<span class="plot-add-item-title-row"><span class="plot-add-item-title">'+map.name+'</span></span>'
    +'<span class="wb-mat-pick-avail wb-mat-pick-line'+(complete?' ok':'')+'">'+progress+'</span>'
    +'</div>'
    +'<span class="wb-log-pick-chevron">▾</span>'
    +'</div>';
}

function renderStudyDeskMapExpandedBody(map){
  const mapId=map.id;
  const prog=getStudyDeskMapState(mapId);
  const cols=map.gridCols||3;
  let slots='';
  for(let n=1;n<=map.pieceCount;n++){
    slots+=studyDeskMapPieceSlotHtml(map,mapId,n,prog.pieces.includes(n));
  }
  return renderStudyDeskMapCollapsedSummary(map, true)
    +'<div class="study-map-expanded">'
    +'<div class="study-map-grid" style="grid-template-columns:repeat('+cols+',28px)">'+slots+'</div>'
    +'<span class="study-book-xp-hint">Fish for wet map pieces, then tap a number to place it on the map.</span>'
    +'</div>';
}

function renderStudyDeskMapsPanel(){
  const el=document.getElementById('study-maps-stock');
  if(!el) return;
  ensureStudyDeskState();
  const map=getAcademiaMapDef('wet');
  if(!map){
    el.innerHTML='<div class="store-line" style="color:rgba(200,169,110,0.45)">No maps yet.</div>';
    return;
  }
  if(typeof renderRecipeSectionPicker==='function'){
    el.innerHTML=renderRecipeSectionPicker({
      title:'MAPS',
      open:studyWetMapPickerOpen,
      collapsedHtml:renderStudyDeskMapCollapsedSummary(map),
      openHtml:renderStudyDeskMapExpandedBody(map),
    });
  }else{
    el.innerHTML=(studyWetMapPickerOpen?renderStudyDeskMapExpandedBody(map):renderStudyDeskMapCollapsedSummary(map));
  }
}

function renderStudyArtefactPickerList(){
  return ACADEMIA_ARTEFACT_EXAMINE_ORDER.map((key)=>{
    const def=ACADEMIA_ARTEFACT_EXAMINE[key];
    const stock=artefactExamStock(key);
    const sel=studyArtefactExamKey===key;
    const unavail=stock<1;
    const clickAction=sel?'toggleStudyArtefactPicker()':'selectStudyArtefactExam(\''+key+'\')';
    return '<div class="wb-mat-option'+(sel?' selected':'')+(unavail?' unavail':'')+'" onclick="'+clickAction+'">'
      +'<span class="wb-mat-icon">'+def.icon+'</span>'
      +'<span class="wb-mat-info">'
      +'<span class="wb-mat-name">'+def.tierLabel+' — '+def.name+'</span>'
      +studyArtefactAvailLineHtml(stock)
      +'</span></div>';
  }).join('');
}

function renderStudyArtefactCollapsedSummary(def){
  const stock=artefactExamStock(def.key);
  const unavail=stock<1;
  return '<div class="wb-log-pick wb-log-pick-collapsed'+(unavail?' unavail':' ready')+' selected" onclick="toggleStudyArtefactPicker()">'
    +'<span class="wb-mat-icon">'+def.icon+'</span>'
    +'<div class="wb-mat-pick-body">'
    +'<span class="plot-add-item-title-row"><span class="plot-add-item-title">'+def.tierLabel+' — '+def.name+'</span></span>'
    +studyArtefactAvailLineHtml(stock)
    +'</div>'
    +'<span class="wb-log-pick-chevron">▾</span>'
    +'</div>';
}

function renderStudyDeskArtefactsPanel(){
  const el=document.getElementById('study-artefacts-stock');
  if(!el) return;
  if(!ACADEMIA_ARTEFACT_EXAMINE_ORDER?.length){
    el.innerHTML='<div class="store-line" style="color:rgba(200,169,110,0.45)">No artefacts to examine.</div>';
    return;
  }
  if(!ACADEMIA_ARTEFACT_EXAMINE[studyArtefactExamKey]){
    studyArtefactExamKey=ACADEMIA_ARTEFACT_EXAMINE_ORDER[0];
  }
  const selDef=getAcademiaArtefactExamineDef(studyArtefactExamKey);
  if(typeof renderRecipeSectionPicker==='function'){
    el.innerHTML=renderRecipeSectionPicker({
      title:'ARTEFACT EXAMINATION',
      open:studyArtefactPickerOpen,
      collapsedHtml:renderStudyArtefactCollapsedSummary(selDef),
      openHtml:renderStudyArtefactPickerList(),
    });
  }else{
    el.innerHTML=studyArtefactPickerOpen?renderStudyArtefactPickerList():renderStudyArtefactCollapsedSummary(selDef);
  }
  const xpEl=document.getElementById('study-artefact-xp-preview');
  if(xpEl) xpEl.innerHTML='';
}

function renderStudyDeskArtefactButtons(){
  const btnEl=document.getElementById('study-desk-buttons');
  const status=document.getElementById('study-desk-status');
  if(!btnEl) return;
  const def=getAcademiaArtefactExamineDef(studyArtefactExamKey);
  const stock=def?artefactExamStock(def.key):0;
  const can=stock>0&&!!def;
  if(status){
    if(can){
      status.textContent='Examine an artefact to learn what it truly is';
      status.classList.add('idle');
    }else{
      status.textContent='Find artefacts while gathering or exploring, then examine them here';
      status.classList.add('idle');
    }
  }
  btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
    +'<button class="wb-btn once" '+(!can?'disabled':'')+' onclick="examineSelectedArtefact()">EXAMINE ARTEFACT</button>'
    +'</div>'
    +(def&&stock<1?'<div class="wb-cost-notice">Need a '+def.name.toLowerCase()+' in your bag or store room.</div>':'')
    +(can&&invTotal()>=getInvCap()?'<div class="wb-cost-notice">Bag full — ingredient finds need bag space.</div>':'')
    +'</div>';
}

function studyDeskBookDepositButtonHtml(bookId){
  const book=getAcademiaBookDef(bookId);
  if(!book||isStudyDeskBookComplete(bookId)) return '';
  if(book.pageTiers?.length){
    return book.pageTiers.map((tier)=>{
      const stock=mysteryTierPageStock(tier.key);
      const can=stock>0;
      const label='DEPOSIT '+tier.name.toUpperCase();
      return '<button class="wb-btn once" '+(!can?'disabled':'')+' onclick="depositStudyDeskMysteryPage(\''+bookId+'\',\''+tier.key+'\')">'+label+'</button>';
    }).join('');
  }
  if(book.mysteryPageKey){
    const stock=mysteryTierPageStock(book.mysteryPageKey);
    const can=stock>0;
    const onclick=bookId==='gathering'?'depositGatheringPage()':'depositStudyDeskMysteryPage(\''+bookId+'\')';
    const label='DEPOSIT '+(bookId==='gathering'?'GATHERING PAGE':book.name.toUpperCase()+' PAGE');
    return '<button class="wb-btn once" '+(!can?'disabled':'')+' onclick="'+onclick+'">'+label+'</button>';
  }
  return '';
}

function studyDeskBookResetButtonHtml(bookId){
  const book=getAcademiaBookDef(bookId);
  if(!book||!isStudyDeskBookComplete(bookId)) return '';
  const fn=bookId==='gathering'?'resetGatheringBook()':('resetStudyDeskBook(\''+bookId+'\')');
  return '<button class="wb-btn once" onclick="'+fn+'">RESET '+book.name.toUpperCase()+'</button>';
}

function renderStudyDeskBookButtons(){
  const btnEl=document.getElementById('study-desk-buttons');
  const status=document.getElementById('study-desk-status');
  if(!btnEl) return;
  const bookIds=Object.keys(ACADEMIA_BOOKS||{});
  if(!ACADEMIA_BOOKS[studyBookId]&&bookIds.length) studyBookId=bookIds[0];
  const bookId=studyBookId;
  const book=getAcademiaBookDef(bookId);
  if(!book){
    btnEl.innerHTML='';
    return;
  }
  const complete=isStudyDeskBookComplete(bookId);
  const stock=mysteryPageStockForBook(bookId);
  if(status){
    if(complete){
      status.textContent=book.name+' complete — reset to fill it again for more Academia XP';
    }else if(stock>0){
      status.textContent='Deposit pages to reveal random slots in this book';
    }else{
      status.textContent='Find pages for this book while gathering or woodcutting';
    }
    status.classList.add('idle');
  }
  const xpPreview=document.getElementById('study-desk-xp-preview');
  if(xpPreview) xpPreview.innerHTML='';
  const depositBtns=studyDeskBookDepositButtonHtml(bookId);
  const resetBtns=studyDeskBookResetButtonHtml(bookId);
  const notices=[];
  if(!complete&&!stock){
    notices.push('<div class="wb-cost-notice">Need pages for this book in your bag or store room.</div>');
  }
  btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
    +(depositBtns||resetBtns||'')
    +'</div>'
    +notices.join('')
    +'</div>';
}

function renderStudyDeskActivityButtons(){
  const btnEl=document.getElementById('study-desk-buttons');
  const status=document.getElementById('study-desk-status');
  if(!btnEl) return;
  if(studyDeskTab==='maps'){
    btnEl.innerHTML='';
    if(status){
      const wetComplete=isStudyDeskMapComplete('wet');
      status.textContent=wetComplete
        ?'Wet map complete'
        :'Expand the wet map and tap a number to place a piece from your bag';
      status.classList.add('idle');
    }
    return;
  }
  if(studyDeskTab==='artefacts'){
    renderStudyDeskArtefactButtons();
    return;
  }
  if(studyDeskTab!=='books'){
    btnEl.innerHTML='';
    return;
  }
  renderStudyDeskBookButtons();
}

function renderStudyDeskScreen(){
  ensureStudyDeskState();
  migrateStudyDesk();
  if(typeof updateActivitySkillPill==='function') updateActivitySkillPill('study', 'academia');
  const tabs=['books','maps','artefacts'];
  tabs.forEach(t=>{
    const btn=document.getElementById('study-tab-'+t);
    if(btn) btn.classList.toggle('active', studyDeskTab===t);
    const panel=document.getElementById('study-panel-'+t);
    if(panel) panel.hidden=studyDeskTab!==t;
  });
  if(studyDeskTab==='books') renderStudyDeskBooksPanel();
  else if(studyDeskTab==='maps') renderStudyDeskMapsPanel();
  else renderStudyDeskArtefactsPanel();
  renderStudyDeskActivityButtons();
  const sub=document.getElementById('study-desk-subtitle');
  if(sub){
    if(studyDeskTab==='books') sub.textContent='Catalogue pages into books for Academia XP';
    else if(studyDeskTab==='maps') sub.textContent='Fish for pieces, then tap a number on the wet map to place it';
    else sub.textContent='Examine artefacts for Academia XP, glistening shards, and botanical finds';
  }
}
