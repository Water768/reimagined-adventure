/* Hearthstead — forestry journal volume 1 (bookcase chapter mechanics) */
'use strict';

let wcAuxiliaryPickerOpen=false;

function ensureWoodcutAuxiliaryState(){
  if(state.woodcutAuxiliary==null) state.woodcutAuxiliary=null;
}

function isWoodcutAuxiliarySlotUnlocked(){
  return typeof isForestryJournalChapterActive==='function'&&isForestryJournalChapterActive(2);
}

function getWoodcutAuxiliaryItemKey(){
  ensureWoodcutAuxiliaryState();
  const key=state.woodcutAuxiliary;
  if(!key||invCount(key)<1){
    if(key) state.woodcutAuxiliary=null;
    return null;
  }
  return key;
}

function listWoodcutAuxiliaryCandidates(){
  return Object.keys(state.inventory||{}).filter((key)=>{
    if(invCount(key)<1) return false;
    if(typeof isToolStoreToolKey==='function'&&isToolStoreToolKey(key)) return false;
    return true;
  });
}

function equipWoodcutAuxiliaryItem(key){
  if(!isWoodcutAuxiliarySlotUnlocked()){
    showToast('Unlock Forestry Journal chapter 2 at the bookcase first.');
    return false;
  }
  const resolved=typeof resolveItemKey==='function'?resolveItemKey(key):key;
  if(!resolved||invCount(resolved)<1){
    showToast('That item is not in your bag.');
    return false;
  }
  state.woodcutAuxiliary=resolved;
  wcAuxiliaryPickerOpen=false;
  scheduleSaveGame();
  if(typeof renderWoodcutting==='function') renderWoodcutting();
  const def=getItemDef(resolved);
  showToast((def?.icon||'📦')+' '+(def?.name||resolved)+' equipped in auxiliary slot.');
  return true;
}

function clearWoodcutAuxiliaryItem(){
  if(!state.woodcutAuxiliary) return;
  state.woodcutAuxiliary=null;
  wcAuxiliaryPickerOpen=false;
  scheduleSaveGame();
  if(typeof renderWoodcutting==='function') renderWoodcutting();
}

function toggleWoodcutAuxiliaryPicker(){
  if(!isWoodcutAuxiliarySlotUnlocked()) return;
  wcAuxiliaryPickerOpen=!wcAuxiliaryPickerOpen;
  if(typeof renderWoodcutting==='function') renderWoodcutting();
}

function renderWoodcutAuxiliaryPanel(){
  const wrap=document.getElementById('wc-auxiliary-slot');
  if(!wrap) return;
  if(!isWoodcutAuxiliarySlotUnlocked()){
    wrap.hidden=true;
    wrap.innerHTML='';
    return;
  }
  wrap.hidden=false;
  const equippedKey=getWoodcutAuxiliaryItemKey();
  const equipped=equippedKey?getItemDef(equippedKey):null;
  const summary=equipped
    ?equipped.icon+' '+equipped.name
    :'Empty — tap to equip from bag';
  let html='<div class="store-items wc-auxiliary-section">'
    +'<div class="store-items-title">AUXILIARY</div>'
    +'<div class="wb-log-pick wb-log-pick-collapsed wc-auxiliary-toggle'+(wcAuxiliaryPickerOpen?' wc-auxiliary-toggle--open':'')+' selected" onclick="toggleWoodcutAuxiliaryPicker()">'
    +'<span class="wb-mat-icon">'+(equipped?.icon||'📦')+'</span>'
    +'<div class="wb-mat-pick-body">'
    +'<span class="plot-add-item-title-row"><span class="plot-add-item-title">Auxiliary slot</span></span>'
    +'<span class="wb-mat-pick-avail wb-mat-pick-line">'+summary+'</span>'
    +'</div>'
    +'<span class="wb-log-pick-chevron">▾</span>'
    +'</div>';
  if(wcAuxiliaryPickerOpen){
    const keys=listWoodcutAuxiliaryCandidates();
    html+=keys.length?keys.map((key)=>{
      const def=getItemDef(key);
      const sel=equippedKey===key;
      const click=sel?'toggleWoodcutAuxiliaryPicker()':'equipWoodcutAuxiliaryItem(\''+key+'\')';
      return '<div class="wb-mat-option'+(sel?' selected':'')+'" onclick="'+click+'">'
        +'<span class="wb-mat-icon">'+(def?.icon||'📦')+'</span>'
        +'<span class="wb-mat-info">'
        +'<span class="wb-mat-name">'+(def?.name||key)+'</span>'
        +'<span class="wb-mat-pick-avail wb-mat-pick-line ok">'+invCount(key)+' in bag</span>'
        +'</span></div>';
    }).join('')
      :'<div class="store-line" style="color:rgba(200,169,110,0.45);padding:6px 0">No bag items to equip.</div>';
    if(equippedKey){
      html+='<button type="button" class="wb-btn once wc-auxiliary-clear" onclick="clearWoodcutAuxiliaryItem()">CLEAR SLOT</button>';
    }
  }
  html+='</div>';
  wrap.innerHTML=html;
}

function tryForestrySpecialLeavesDrop(){
  if(typeof isForestryJournalChapterActive!=='function'||!isForestryJournalChapterActive(3)) return false;
  if(Math.random()>=FORESTRY_CH3_SPECIAL_LEAVES_PCT/100) return false;
  const def=FORESTRY_JOURNAL_ITEMS?.special_leaves||getItemDef(SPECIAL_LEAVES_ITEM_KEY);
  if(invTotal()>=getInvCap()){
    addActivityLog('wc-log', '🍃 Special leaves found but your bag is full.', 'fail');
    return false;
  }
  invAddDirect(SPECIAL_LEAVES_ITEM_KEY, def?.icon||'🍃', def?.name||'Special Leaves', 1);
  addActivityLog('wc-log', '🍃 Special leaves found!', 'success');
  showToast('🍃 Special leaves found!');
  return true;
}

function awardWoodcutDuplicateLogs(logKey,logDef,chopXp,dupCount){
  let added=0;
  for(let i=0;i<dupCount;i++){
    if(!invAdd(logKey,logDef.icon,logDef.name,1)) break;
    added++;
    grantXP('woodcut', chopXp, null);
    addActivityLog('wc-log', logDef.icon+' Bonus log — timber split clean! +'+chopXp+' Woodcutting', 'success');
  }
  if(added>0) showToast('🪓 +'+added+' bonus '+(logDef.name||'log').toLowerCase()+(added===1?'!':'s!'));
  return added;
}

function processSuccessfulWoodcutHarvest(ctx){
  const { logKey, logDef, chopXp, axeDef }=ctx;
  const dupPct=typeof getWoodcutDuplicateLogBonusPct==='function'?getWoodcutDuplicateLogBonusPct(axeDef):0;
  const dupCount=typeof rollBonusDuplicateLogCount==='function'?rollBonusDuplicateLogCount(dupPct):0;
  const totalLogs=1+dupCount;
  const incinerate=typeof isIncineratingAxeEquipped==='function'
    &&isIncineratingAxeEquipped()
    &&Math.random()<INCINERATING_AXE_INCINERATE_CHANCE;

  if(incinerate){
    const wcXp=chopXp*INCINERATING_AXE_WOODCUT_XP_MULT;
    grantXP('woodcut', wcXp, null, { skipShardDrop:true });
    grantXP('fire', wcXp, null, { skipShardDrop:true });
    if(typeof grantGuaranteedFireShards==='function') grantGuaranteedFireShards(totalLogs);
    addActivityLog('wc-log', '🔥 Logs incinerated! +'+wcXp+' Woodcutting · +'+wcXp+' Fire · +'+totalLogs+' fire shard'+(totalLogs===1?'':'s'), 'success');
    showToast('🔥 Incinerating axe burned the timber for bonus XP and fire shards!');
    tryForestrySpecialLeavesDrop();
    return { ok:true, incinerated:true, totalLogs, wcXp };
  }

  if(!invAdd(logKey,logDef.icon,logDef.name,1)){
    return { ok:false, bagFull:true };
  }
  grantXP('woodcut', chopXp, null);
  addActivityLog('wc-log', logDef.icon+' Chopped '+(logDef.name||logKey).toLowerCase()+'! +'+chopXp+' Woodcutting', 'success');

  if(dupCount>0) awardWoodcutDuplicateLogs(logKey, logDef, chopXp, dupCount);
  tryForestrySpecialLeavesDrop();
  return { ok:true, dupCount };
}
