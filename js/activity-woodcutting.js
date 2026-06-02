/* Hearthstead — woodcutting */
'use strict';

function getWoodlandSlotByInstanceId(instanceId){
  if(!instanceId) return null;
  let found=null;
  forEachPlotOccupied((x,y,slot)=>{
    if(slot.instanceId===instanceId) found={x,y,slot};
  });
  return found;
}

function getCurrentWoodlandSpot(){
  if(!wc.treeInstanceId) return null;
  const found=getWoodlandSlotByInstanceId(wc.treeInstanceId);
  if(!found) return null;
  const def=getPlotTileDef(found.slot.typeId);
  const woodland=getWoodlandByTypeId(found.slot.typeId);
  const cfg=getPlotConfig(found.slot.instanceId,'tree', found.slot.typeId);
  return { ...found, def, woodland, cfg };
}

function getEquippedAxeDef(){
  return getToolStoreAxeDef();
}

function resolveWoodlandCell(el){
  if(!el) return null;
  if(el.classList?.contains('cell-tree')) return el;
  return el.closest?.('.plot-cell.cell-tree')||null;
}

function wcMenuTap(event, cell){
  event?.stopPropagation();
  cell=cell||resolveWoodlandCell(event?.target);
  if(cell?.dataset?.instanceId) wc.treeInstanceId=cell.dataset.instanceId;
  openWoodcuttingMenu();
}

function wcMenuChop(){
  if(!wc.treeInstanceId) return;
  chopTree(null, wc.treeInstanceId);
  revealPlotActivityMenu('wc:'+wc.treeInstanceId, document.querySelector('.plot-cell.cell-tree[data-instance-id="'+wc.treeInstanceId+'"]'));
}

function openWoodcuttingMenu(){
  if(wc.treeInstanceId) setActivity('woodcutting');
  showScreen('woodcutting-screen');
  lastHome='exterior-screen';
  renderWoodcutting();
}

function closeWoodcutting(){
  showScreen('exterior-screen');
  lastHome='exterior-screen';
  flushActivityUi('screen');
}

function renderWoodcutLootList(woodlandId){
  const list=document.getElementById('wc-loot-list');
  if(!list) return;
  if(!woodlandId){
    list.innerHTML='<div class="store-line" style="color:rgba(200,169,110,0.45)">Select a woodland.</div>';
    return;
  }
  const w=getWoodlandById(woodlandId);
  const axeDef=getEquippedAxeDef();
  const axeTier=axeDef?.tier??0;
  list.innerHTML=w.drops.map(d=>{
    const logDef=LOG_DEFS[d.log];
    const chopPct=Math.round((CHOP_RATES[d.log]?.[axeTier]??0.75)*100);
    return '<div class="fish-list-row">'
      +'<span>'+(logDef?.icon||'🪵')+' '+(logDef?.name||d.log)+'</span>'
      +'<span class="fish-req">'+d.pct+'% encounter · '+chopPct+'% success</span>'
      +'</div>';
  }).join('');
}

function renderWoodcutting(){
  updateActivitySkillPill('wc', 'woodcut');
  const spot=getCurrentWoodlandSpot();
  const woodland=spot?.woodland;
  const wcLvl=Number(state.skills.woodcut?.level)||1;
  const rec=woodland?getWoodlandRecommendedLevel(woodland.id):null;
  const axeDef=getEquippedAxeDef();
  const titleEl=document.getElementById('wc-screen-title');
  const nameEl=document.getElementById('wc-spot-name');
  const subEl=document.getElementById('wc-spot-sub');
  const iconEl=document.getElementById('wc-spot-icon');
  const xpEl=document.getElementById('wc-xp-preview');
  if(titleEl) titleEl.textContent=woodland?.name||'Woodcutting';
  if(nameEl) nameEl.textContent=woodland?.name||'Woodland';
  if(subEl){
    if(woodland){
      const chops=spot?.cfg?.treeChops||0;
      const recLine=rec?'Recommended: Woodcutting Lv '+rec+' · ':'';
      subEl.textContent=recLine+chops+' chop'+(chops===1?'':'s')+' on this tree';
    }else{
      subEl.textContent='Tap a woodland tile on your plot';
    }
  }
  if(iconEl) iconEl.textContent='🌲';
  renderWoodcutAuxiliaryPanel();
  renderWoodcutLootList(woodland?.id);
  if(xpEl){
    const wcXpVals=LOG_TIER_ORDER.map(woodcutXpForLog);
    const wcXpMin=Math.min(...wcXpVals);
    const wcXpMax=Math.max(...wcXpVals);
    const wcXpLine=wcXpMin===wcXpMax
      ?('Each chop: +'+wcXpMin+' Woodcutting')
      :('Each chop: +'+wcXpMin+'–+'+wcXpMax+' Woodcutting');
    const dupPct=typeof getWoodcutDuplicateLogBonusPct==='function'?getWoodcutDuplicateLogBonusPct(axeDef):0;
    const journalLines=[];
    if(typeof isForestryJournalChapterActive==='function'){
      if(isForestryJournalChapterActive(1)&&dupPct>0){
        journalLines.push('Journal ch.1: +'+Math.round(dupPct)+'% duplicate log chance (additive)');
      }
      if(isForestryJournalChapterActive(3)){
        journalLines.push('Journal ch.3: '+FORESTRY_CH3_SPECIAL_LEAVES_PCT+'% special leaves on chop');
      }
      if(isForestryJournalChapterActive(4)&&typeof isIncineratingAxeEquipped==='function'&&isIncineratingAxeEquipped()){
        journalLines.push('Incinerating axe: 40% burn for triple Woodcutting XP, Fire XP, and fire shards');
      }
    }
    xpEl.innerHTML='<span class="wb-xp-line">'+wcXpLine+'</span>'
      +(axeDef?'<span class="wb-xp-line">'+axeDef.icon+' '+axeDef.name+' active — higher tiers improve rare log chances</span>'
        +(getToolStoreBonusAxeDef()?'<span class="wb-xp-line">Best axe bonus: '+Math.round(axeDuplicateLogChance(getToolStoreBonusAxeDef().tier)*100)+'% duplicate log (tool store built)</span>'
          :'<span class="wb-xp-line">Build a tool store to unlock axe bonuses</span>')
        :'<span class="wb-xp-line">Equip an axe to your tool store from inventory</span>')
      +journalLines.map((line)=>'<span class="wb-xp-line">'+line+'</span>').join('');
  }
  const status=document.getElementById('wc-status');
  if(status){
    if(!woodland) status.textContent='Select a woodland on your plot';
    else if(!state.axeFound) status.textContent='Find an axe in the hut first';
    else if(!hasAxeAvailable()) status.textContent='Equip an axe to your tool store from inventory';
    else if(invTotal()>=getInvCap()) status.textContent='Bag full — make room for logs';
    else status.textContent='Tap the tree to chop';
    status.classList.add('idle');
  }
  const btnEl=document.getElementById('wc-buttons');
  if(btnEl){
    const full=invTotal()>=getInvCap();
    const canChop=!!woodland&&state.axeFound&&hasAxeAvailable()&&!full;
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn once" style="flex:1" '+(canChop?'':'disabled')+' onclick="wcMenuChop()">'
      +'🪓 CHOP<span class="wb-btn-sub">one swing</span></button>'
      +'<button class="wb-btn once" style="flex:1" onclick="closeWoodcutting()">'
      +'🗺️ BACK TO PLOT<span class="wb-btn-sub">return to the tree</span></button>'
      +'</div></div>';
  }
}

