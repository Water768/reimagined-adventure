/* Hearthstead — bookcase (journal reward toggles) */
'use strict';

function ensureBookcaseState(){
  if(!state.bookcase) state.bookcase={ activeChapters:{} };
  if(!state.bookcase.activeChapters) state.bookcase.activeChapters={};
  if(typeof ensureStudyDeskState==='function') ensureStudyDeskState();
  getBookcaseRewardBookOrder().forEach((bookId)=>{
    const reward=getBookcaseRewardBookDef(bookId);
    if(!reward) return;
    if(!state.bookcase.activeChapters[bookId]) state.bookcase.activeChapters[bookId]={};
    reward.chapters.forEach((ch)=>{
      if(state.bookcase.activeChapters[bookId][ch.num]==null){
        state.bookcase.activeChapters[bookId][ch.num]=false;
      }
    });
  });
}

function migrateBookcase(){
  if(state.craftProgress?.bookshelf){
    state.craftProgress.bookcase=state.craftProgress.bookshelf;
    delete state.craftProgress.bookshelf;
  }
  if(typeof craft!=='undefined'&&craft?.recipeKey==='bookshelf') craft.recipeKey='bookcase';
  if(state.lastWorkbenchRecipe==='bookshelf') state.lastWorkbenchRecipe='bookcase';
  if(!state.interior?.cells) return;
  Object.keys(state.interior.cells).forEach((k)=>{
    const key=state.interior.cells[k];
    if(key==='furniture:bookshelf'||key==='bookshelf') state.interior.cells[k]='bookcase';
  });
  ensureBookcaseState();
}

function isBookcaseChapterUnlocked(bookId,chapterNum){
  if(typeof isStudyDeskChapterComplete!=='function') return false;
  return isStudyDeskChapterComplete(bookId, chapterNum|0);
}

function isBookcaseChapterActive(bookId,chapterNum){
  ensureBookcaseState();
  const ch=chapterNum|0;
  if(!isBookcaseChapterUnlocked(bookId, ch)) return false;
  return !!state.bookcase.activeChapters[bookId]?.[ch];
}

function bookcaseChapterPageLabel(bookId,chapterNum){
  const book=getAcademiaBookDef(bookId);
  if(!book||typeof studyDeskBookChapterPageRange!=='function') return '';
  const { start, end }=studyDeskBookChapterPageRange(book, chapterNum|0);
  return 'Pages '+start+'–'+end;
}

function studyDeskChapterPagesOwned(bookId,chapterNum){
  const book=getAcademiaBookDef(bookId);
  if(!book||typeof studyDeskBookChapterPageRange!=='function') return { owned:0, total:0 };
  const { start, end }=studyDeskBookChapterPageRange(book, chapterNum|0);
  const total=end-start+1;
  const prog=getStudyDeskBookState(bookId);
  let owned=0;
  for(let n=start;n<=end;n++){
    if(prog.pages.includes(n)) owned++;
  }
  return { owned, total };
}

function bookcaseChapterStatusMeta(bookId,chapterNum,unlocked){
  if(unlocked){
    return { text:'Unlocked', cls:'ok' };
  }
  const { owned, total }=studyDeskChapterPagesOwned(bookId, chapterNum);
  const cls=typeof wbStockClass==='function'?wbStockClass(owned, total):'missing';
  return { text:owned+'/'+total+' pages', cls };
}

function toggleBookcaseChapterActive(bookId,chapterNum){
  ensureBookcaseState();
  const ch=chapterNum|0;
  if(!isBookcaseChapterUnlocked(bookId, ch)){
    showToast('Complete this chapter at the study desk first.');
    renderBookcaseScreen();
    return { ok:false };
  }
  const next=!state.bookcase.activeChapters[bookId][ch];
  state.bookcase.activeChapters[bookId][ch]=next;
  if(typeof markDirty==='function') markDirty('skills');
  scheduleSaveGame();
  renderBookcaseScreen();
  syncUI();
  return { ok:true, active:next };
}

function bookcaseChapterRowHtml(book,rewardCh){
  const bookId=book.id;
  const ch=rewardCh.num|0;
  const unlocked=isBookcaseChapterUnlocked(bookId, ch);
  const active=isBookcaseChapterActive(bookId, ch);
  const pageLabel=bookcaseChapterPageLabel(bookId, ch);
  const { text:statusText, cls:statusCls }=bookcaseChapterStatusMeta(bookId, ch, unlocked);
  let actionHtml='';
  if(unlocked){
    const btnCls='wb-btn once bookcase-chapter-toggle'+(active?' active':'');
    const label=active?'DEACTIVATE':'ACTIVATE';
    actionHtml='<button type="button" class="'+btnCls+'" onclick="toggleBookcaseChapterActive(\''+bookId+'\','+ch+')">'+label+'</button>';
  }else{
    actionHtml='<button type="button" class="wb-btn once" disabled>LOCKED</button>';
  }
  return '<div class="bookcase-chapter-row'+(unlocked?' is-unlocked':' is-locked')+(active?' is-active':'')+'">'
    +'<div class="bookcase-chapter-head">'
    +'<span class="bookcase-chapter-title">Chapter '+ch+'</span>'
    +'<span class="bookcase-chapter-pages">'+pageLabel+'</span>'
    +'<span class="bookcase-chapter-status wb-mat-pick-line '+statusCls+'">'+statusText+'</span>'
    +'</div>'
    +'<p class="bookcase-chapter-desc">'+rewardCh.desc+'</p>'
    +'<div class="bookcase-chapter-action">'+actionHtml+'</div>'
    +'</div>';
}

function bookcaseBookCardHtml(bookId){
  const book=getAcademiaBookDef(bookId);
  const reward=getBookcaseRewardBookDef(bookId);
  if(!book||!reward) return '';
  const chaptersHtml=reward.chapters.map((ch)=>bookcaseChapterRowHtml(book, ch)).join('');
  return '<div class="bookcase-book-card">'
    +'<div class="bookcase-book-header">'
    +'<span class="bookcase-book-icon">'+book.icon+'</span>'
    +'<span class="bookcase-book-title">'+book.name+'</span>'
    +'</div>'
    +'<div class="bookcase-chapter-list">'+chaptersHtml+'</div>'
    +'</div>';
}

function renderBookcasePanel(){
  const el=document.getElementById('bookcase-rewards-stock');
  if(!el) return;
  ensureBookcaseState();
  const html=getBookcaseRewardBookOrder().map((id)=>bookcaseBookCardHtml(id)).filter(Boolean).join('');
  el.innerHTML=html||'<div class="store-line" style="color:rgba(200,169,110,0.45)">No journal rewards yet.</div>';
}

function renderBookcaseScreen(){
  ensureBookcaseState();
  if(typeof updateActivitySkillPill==='function') updateActivitySkillPill('bookcase', 'academia');
  renderBookcasePanel();
}

function openBookcaseScreen(){
  showScreen('bookcase-screen');
  lastHome='interior-screen';
  renderBookcaseScreen();
}

function closeBookcaseScreen(){
  showScreen('interior-screen');
  lastHome='interior-screen';
  syncUI();
}

function buildBookcaseUtilityMenuItem(x,y){
  const def=INTERIOR_ROOM_DEFS.bookcase;
  if(!def) return '';
  const stock=itemCountBagAndStore(BOOKCASE_FURNITURE_KEY);
  const hasStock=stock>0;
  const tagHtml=typeof furnitureUtilityTaglineHtml==='function'?furnitureUtilityTaglineHtml(BOOKCASE_FURNITURE_KEY):'';
  const drops=(hasStock
    ?formatRecipeMatLine(def?.name||'Bookcase', 1, stock)+' — ready to place'
    :'Craft one at the workbench first')
    +(tagHtml?' · '+tagHtml:'');
  const cls='plot-add-item '+(hasStock?'structure-unlocked':'structure-locked below-rec is-disabled');
  return '<button type="button" class="'+cls+'"'+(hasStock?'':' disabled')+(hasStock?' onclick="placeInteriorBookcase('+x+','+y+')"':'')+'>'
    +'<span class="plot-add-item-icon">'+def.icon+'</span>'
    +'<span class="plot-add-item-name">'+def.name
    +'<span class="plot-add-item-drops">'+drops+'</span></span></button>';
}

function placeInteriorBookcase(x,y){
  const def=INTERIOR_ROOM_DEFS.bookcase;
  if(!def){ closeInteriorBuildMenu(); return; }
  if(!bookcaseInStock()){
    showToast('Craft a Bookcase at the workbench first.');
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
  if(!consumeOneFromBagOrStore(BOOKCASE_FURNITURE_KEY)){
    showToast('Could not take Bookcase.');
    closeInteriorBuildMenu();
    return;
  }
  state.interior.cells[ck]='bookcase';
  closeInteriorBuildMenu();
  renderInteriorGrid();
  syncUI();
  scheduleSaveGame();
  showToast(def.icon+' '+def.name+' built.');
}

function renderBookcaseCellContent(el){
  el.dataset.intKey='bookcase';
  el.innerHTML='<div class="bookcase-idle"><div class="int-item">📚</div><div class="int-label">bookcase</div></div>'
    +'<div class="plot-activity-top">'
    +'<button type="button" class="int-quick-action-btn">browse</button>'
    +'</div>'
    +'<div class="plot-activity-menu-zone">'
    +'<button type="button" class="plot-menu-btn">menu</button>'
    +'</div>';
  const quickBtn=el.querySelector('.int-quick-action-btn');
  const menuBtn=el.querySelector('.plot-menu-btn');
  const open=()=>openBookcaseScreen();
  if(quickBtn) quickBtn.onclick=(ev)=>{ ev.stopPropagation(); open(); };
  if(menuBtn) menuBtn.onclick=(ev)=>{ ev.stopPropagation(); open(); };
  el.onclick=(e)=>{
    if(intSuppressClick||isInteriorBuildMode()) return;
    if(e.target.closest('.plot-menu-btn')||e.target.closest('.int-quick-action-btn')) return;
    open();
  };
}
