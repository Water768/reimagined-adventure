/* Hearthstead — panels */
'use strict';

/* ═══════════════════════════════════════
   PANELS
═══════════════════════════════════════ */
let openPanel=null;
let invPanelRenderStamp=null;

function getInvPanelRenderStamp(){
  const invPart=Object.keys(state.inventory)
    .filter((k)=>stackCount(state.inventory,k)>0)
    .map((k)=>k+':'+stackCount(state.inventory,k))
    .sort()
    .join('|');
  const pocketMeta=typeof getPocketDisplayMeta==='function'?getPocketDisplayMeta():SHARD_META;
  const fpPocketKey=typeof FEATHER_POCKET_DISPLAY_KEY!=='undefined'?FEATHER_POCKET_DISPLAY_KEY:'featherPocket';
  const pocketPart=Object.keys(pocketMeta).map(k=>{
    if(k===fpPocketKey) return k+':'+(state.featherPocketCount|0);
    return k+':'+(state.pockets[k]||0);
  }).join('|');
  const fpKey=state.equippedFeatherPocket?.key||'';
  return invTotal()+'/'+invPart+'/'+pocketPart+'/'+fpKey;
}

function closeAllPanels(){
  document.getElementById('inv-panel')?.remove();
  document.getElementById('equip-panel')?.remove();
  openPanel=null;
  invSelectedKey=null;
  invPanelRenderStamp=null;
}
function togglePanel(which){
  if(openPanel===which){closeAllPanels();return;}
  closeAllPanels(); openPanel=which;
  if(which==='inv')renderInvPanel();
  if(which==='equip')renderEquipPanel();
}
document.addEventListener('click',e=>{
  if(!openPanel)return;
  const p=document.getElementById(openPanel==='inv'?'inv-panel':'equip-panel');
  if(!p||p.contains(e.target))return;
  closeAllPanels();
});

const ACTIVITY_LOG_MAX=20;

function addActivityLog(logId, msg, type){
  const log=typeof logId==='string'?document.getElementById(logId):logId;
  if(!log) return;
  log.querySelector('.wb-log-entry.latest')?.classList.remove('latest');
  const entry=document.createElement('div');
  entry.className='wb-log-entry latest'+(type?' '+type:'');
  entry.textContent=msg;
  log.insertBefore(entry, log.firstChild);
  while(log.children.length>ACTIVITY_LOG_MAX) log.removeChild(log.lastChild);
  return entry;
}

function updateActivityLogEntry(entry, msg, type){
  if(!entry?.isConnected) return;
  entry.textContent=msg;
  if(type) entry.className='wb-log-entry latest '+type;
}

function truncateInvLabel(text, maxLen){
  const s=String(text||'');
  if(s.length<=maxLen) return s;
  return s.slice(0,Math.max(1,maxLen-2))+'..';
}

function renderInvPanel(){
  document.getElementById('inv-panel')?.remove();
  const w=document.getElementById('game-wrapper');
  const el=document.createElement('div'); el.id='inv-panel'; el.className='panel inv-panel';
  const used=invTotal(), cap=getInvCap(), pct=(used/cap)*100;
  const fc=used>=cap?'full':used>=40?'warn':'';
  const entries=Object.keys(state.inventory)
    .map((key)=>({ key, count:stackCount(state.inventory,key), def:getItemDef(key) }))
    .filter((e)=>e.count>0);
  const pocketMetaBase=typeof getPocketDisplayMeta==='function'?getPocketDisplayMeta():SHARD_META;
  const fpDisplayKey=typeof FEATHER_POCKET_DISPLAY_KEY!=='undefined'?FEATHER_POCKET_DISPLAY_KEY:'featherPocket';
  const shardChipHtml=Object.keys(pocketMetaBase).filter(k=>k!==fpDisplayKey).map((k)=>{
    const m=pocketMetaBase[k];
    const n=state.pockets[k]||0;
    const emptyCls=n>0?'':' empty';
    return '<div class="inv-shard-chip'+emptyCls+'" tabindex="0">'
      +'<span class="inv-shard-icon">'+m.icon+'</span>'
      +'<span class="inv-shard-count">'+n+'</span>'
      +'<span class="inv-shard-tip">'+m.name+'</span>'
      +'</div>';
  }).join('');
  const fpEntry=typeof getFeatherPocketDisplayEntry==='function'?getFeatherPocketDisplayEntry():null;
  const featherRowHtml=fpEntry
    ?('<div class="inv-feather-pocket-row"><div class="inv-shard-row">'
      +'<div class="inv-shard-chip" tabindex="0" onclick="showFeatherPocketInfo()">'
      +'<span class="inv-shard-icon">'+fpEntry.icon+'</span>'
      +'<span class="inv-shard-count">'+fpEntry.count+'</span>'
      +'<span class="inv-shard-tip">'+fpEntry.name+' · '+fpEntry.label+'</span>'
      +'</div></div></div>')
    :'';
  const pocketHtml='<div class="inv-pockets"><div class="inv-pockets-title">POCKETS</div>'
    +'<div class="inv-shard-row">'+shardChipHtml+'</div>'
    +featherRowHtml
    +'</div>';
  const rowsHtml=entries.length
    ?entries.map(({key, count, def})=>{
        const canEquipToStore=typeof canEquipToolToStore==='function'&&canEquipToolToStore(key);
        const equipDef=EQUIPPABLE[key];
        const canEquipFeather=typeof isFeatherPocketKey==='function'&&isFeatherPocketKey(key)
          &&state.equippedFeatherPocket?.key!==key;
        const canEquip=(equipDef&&state.equipped?.key!==key)
          ||(BAG_BY_KEY[key]&&state.equippedBag?.key!==key)
          ||canEquipFeather
          ||canEquipToStore;
        const sel=invSelectedKey===key;
        const equipBtn=canEquip
          ?'<button class="inv-row-equip" onclick="event.stopPropagation();doEquipFromInv(\''+key+'\')">EQUIP</button>'
          :'';
        const nameLabel=truncateInvLabel(def.name, 22);
        return '<div class="inv-row'+(sel?' selected':'')+'" onclick="selectInvRow(\''+key+'\')">'
          +'<span class="inv-row-icon">'+def.icon+'</span>'
          +'<span class="inv-row-name" title="'+def.name.replace(/"/g,'&quot;')+'">'+nameLabel+'</span>'
          +equipBtn
          +'<span class="inv-row-count">x'+count+'</span></div>';
      }).join('')
    :'<div class="inv-empty">Empty. Go find something.</div>';
  el.innerHTML='<div class="panel-title">INVENTORY — '+used+'/'+cap+'</div>'
    +'<div class="inv-bar-wrap"><div class="inv-bar-fill '+fc+'" style="width:'+pct+'%"></div></div>'
    +'<div class="inv-items">'+rowsHtml+'</div>'
    +pocketHtml;
  w.appendChild(el);
  invPanelRenderStamp=getInvPanelRenderStamp();
}

function selectInvRow(key){
  invSelectedKey=invSelectedKey===key?null:key;
  renderInvPanel();
}

function doEquipFromInv(key){
  if(typeof isFeatherPocketKey==='function'&&isFeatherPocketKey(key)) return doEquipFeatherPocketFromInv(key);
  if(BAG_BY_KEY[key]) return doEquipBagFromInv(key);
  if(typeof canEquipToolToStore==='function'&&canEquipToolToStore(key)){
    return doEquipToolToStoreFromInv(key);
  }
  const def = EQUIPPABLE[key];
  if(!def || state.equipped?.key===key) return;
  if(def.slot==='body') return doEquipBodyFromInv(key);
  if(def.slot==='legs') return doEquipLegsFromInv(key);
  if(invCount(key)<=0){ showToast('Not in bag.'); return; }
  if(state.equipped){
    const prev=state.equipped;
    invAddDirect(prev.key, prev.icon, prev.name, 1);
  }
  stackTake(state.inventory, key, 1);
  state.equipped = { key, icon:def.icon, name:def.name, tier:def.tier ?? 0, slot:def.slot||'body' };
  invSelectedKey=null;
  renderInvPanel();
  markDirty('equip','inventory');
  flushDirty();
  showToast(def.icon+' '+def.name+' equipped!');
}

function doEquipToolToStoreFromInv(key){
  if(!equipToolToStore(key)){ showToast('Cannot equip that to your tool store.'); return; }
  const def=getItemDef(key);
  invSelectedKey=null;
  renderInvPanel();
  markDirty('equip','inventory');
  flushDirty();
  showToast(def.icon+' '+def.name+' equipped to tool store — bound forever.');
}

function doEquipBagFromInv(key){
  const def=BAG_BY_KEY[key];
  if(!def||state.equippedBag?.key===key) return;
  if(invCount(key)<=0){ showToast('Not in bag.'); return; }
  if(!equipBagDef(def)) return;
  invSelectedKey=null;
  renderInvPanel();
  markDirty('equip','inventory');
  flushDirty();
  showToast(def.icon+' '+def.name+' equipped! +'+def.invBonus+' bag space');
}

function doEquipFeatherPocketFromInv(key){
  if(!equipFeatherPocketFromInv(key)) return;
  const def=getFeatherPocketDef(key);
  invSelectedKey=null;
  renderInvPanel();
  markDirty('equip','inventory');
  flushDirty();
  showToast((def?.icon||'🪶')+' '+(def?.name||'Feather pocket')+' equipped — '+def.featherCap+' feather storage in pocket.');
}

function renderEquipPanel(){
  document.getElementById('equip-panel')?.remove();
  const w=document.getElementById('game-wrapper');
  const el=document.createElement('div'); el.id='equip-panel'; el.className='panel equip-panel';
  const bagEq=state.equippedBag;
  const bagInBag=findBagInBag();
  let bagSlot;
  if(bagEq){
    const bonus=BAG_BY_KEY[bagEq.key]?.invBonus||bagEq.invBonus||0;
    bagSlot='<div class="equip-slot filled"><span class="equip-slot-icon">'+bagEq.icon+'</span><span class="equip-slot-info"><span class="equip-slot-name">'+bagEq.name+'</span><span class="equip-slot-hint">+'+bonus+' inventory space · '+getInvCap()+' total</span></span><button class="equip-action-btn do-unequip" onclick="doUnequipBag()">UNEQUIP</button></div>';
  }else if(bagInBag){
    bagSlot='<div class="equip-slot"><span class="equip-slot-icon">'+bagInBag.icon+'</span><span class="equip-slot-info"><span class="equip-slot-name">'+bagInBag.name+'</span><span class="equip-slot-hint">In bag — equip for +'+bagInBag.invBonus+' space</span></span><button class="equip-action-btn do-equip" onclick="doEquipBag()">EQUIP</button></div>';
  }else{
    bagSlot='<div class="equip-slot"><span class="equip-slot-icon" style="opacity:0.3">👝</span><span class="equip-slot-info"><span class="equip-slot-name" style="opacity:0.4">No bag</span><span class="equip-slot-hint">Weave a pouch at the loom</span></span></div>';
  }
  const eq=state.equipped;
  const bodyEq=eq&&(eq.slot==='legs'?null:eq);
  const legsEq=eq&&eq.slot==='legs'?eq:null;
  const bodyInBag=bodyEq?null:findEquippableInBag('body');
  const legsInBag=legsEq?null:findEquippableInBag('legs');
  let bodySlot;
  if(bodyEq){
    bodySlot='<div class="equip-slot filled"><span class="equip-slot-icon">'+bodyEq.icon+'</span><span class="equip-slot-info"><span class="equip-slot-name">'+bodyEq.name+'</span><span class="equip-slot-hint">Body armour equipped</span></span><button class="equip-action-btn do-unequip" onclick="doUnequipBody()">UNEQUIP</button></div>';
  }else if(bodyInBag){
    bodySlot='<div class="equip-slot"><span class="equip-slot-icon">'+bodyInBag.icon+'</span><span class="equip-slot-info"><span class="equip-slot-name">'+bodyInBag.name+'</span><span class="equip-slot-hint">In bag — equip for protection</span></span><button class="equip-action-btn do-equip" onclick="doEquipBodyFromInv(\''+bodyInBag.key+'\')">EQUIP</button></div>';
  }else{
    bodySlot='<div class="equip-slot"><span class="equip-slot-icon" style="opacity:0.3">🛡️</span><span class="equip-slot-info"><span class="equip-slot-name" style="opacity:0.4">No body armour</span><span class="equip-slot-hint">Craft armour at the workbench</span></span></div>';
  }
  let legsSlot;
  if(legsEq){
    legsSlot='<div class="equip-slot filled"><span class="equip-slot-icon">'+legsEq.icon+'</span><span class="equip-slot-info"><span class="equip-slot-name">'+legsEq.name+'</span><span class="equip-slot-hint">Utility legwear — reach tidal lockboxes</span></span><button class="equip-action-btn do-unequip" onclick="doUnequipLegs()">UNEQUIP</button></div>';
  }else if(legsInBag){
    legsSlot='<div class="equip-slot"><span class="equip-slot-icon">'+legsInBag.icon+'</span><span class="equip-slot-info"><span class="equip-slot-name">'+legsInBag.name+'</span><span class="equip-slot-hint">In bag — equip for rock-pool foraging</span></span><button class="equip-action-btn do-equip" onclick="doEquipLegsFromInv(\''+legsInBag.key+'\')">EQUIP</button></div>';
  }else{
    legsSlot='<div class="equip-slot"><span class="equip-slot-icon" style="opacity:0.3">🥾</span><span class="equip-slot-info"><span class="equip-slot-name" style="opacity:0.4">No legwear</span><span class="equip-slot-hint">Slick-grip waders help at sunken pools</span></span></div>';
  }
  el.innerHTML='<div class="panel-title">⚔️ EQUIPMENT</div>'
    +'<div style="font-family:var(--font-ui);font-size:11px;color:var(--ui-text-dim);letter-spacing:0.04em;margin-bottom:6px;">BAG SLOT</div>'
    +bagSlot
    +'<div style="font-family:var(--font-ui);font-size:11px;color:var(--ui-text-dim);letter-spacing:0.04em;margin:12px 0 6px;">BODY SLOT</div>'
    +bodySlot
    +'<div style="font-family:var(--font-ui);font-size:11px;color:var(--ui-text-dim);letter-spacing:0.04em;margin:12px 0 6px;">LEGS SLOT</div>'
    +legsSlot;
  w.appendChild(el);
}

function findEquippableInBag(slot){
  for(const key of Object.keys(state.inventory||{})){
    const def=EQUIPPABLE[key];
    if(def?.slot===slot&&invCount(key)>0) return { key, ...def };
  }
  return null;
}

function equipSlotFromInv(key, slot){
  const def=EQUIPPABLE[key];
  if(!def||def.slot!==slot||state.equipped?.key===key) return false;
  if(invCount(key)<=0){ showToast('Not in bag.'); return false; }
  if(state.equipped){
    const prev=state.equipped;
    invAddDirect(prev.key, prev.icon, prev.name, 1);
  }
  stackTake(state.inventory, key, 1);
  state.equipped={ key, icon:def.icon, name:def.name, tier:def.tier??0, slot:def.slot };
  return true;
}

function doEquipBodyFromInv(key){
  if(!equipSlotFromInv(key,'body')) return;
  invSelectedKey=null;
  renderInvPanel();
  markDirty('equip','inventory');
  flushDirty();
  showToast(state.equipped.icon+' '+state.equipped.name+' equipped!');
}

function doEquipLegsFromInv(key){
  if(!equipSlotFromInv(key,'legs')) return;
  invSelectedKey=null;
  renderInvPanel();
  markDirty('equip','inventory');
  flushDirty();
  showToast(state.equipped.icon+' '+state.equipped.name+' equipped!');
}

function doUnequipBody(){
  if(state.equipped?.slot!=='body') return;
  const{key,icon,name}=state.equipped;
  invAddDirect(key, icon, name, 1);
  state.equipped=null;
  closeAllPanels(); renderEquipPanel(); openPanel='equip';
  syncUI(); showToast(icon+' '+name+' moved back to bag.');
}

function doUnequipLegs(){
  if(state.equipped?.slot!=='legs') return;
  const{key,icon,name}=state.equipped;
  invAddDirect(key, icon, name, 1);
  state.equipped=null;
  closeAllPanels(); renderEquipPanel(); openPanel='equip';
  syncUI(); showToast(icon+' '+name+' moved back to bag.');
}

function doEquipBag(){
  const def=findBagInBag();
  if(!def||!equipBagDef(def)) return;
  closeAllPanels(); renderEquipPanel(); openPanel='equip';
  syncUI(); showToast(def.icon+' '+def.name+' equipped! +'+def.invBonus+' bag space');
}

function doUnequipBag(){
  if(!state.equippedBag) return;
  const{key,icon,name}=state.equippedBag;
  invAddDirect(key, icon, name, 1);
  state.equippedBag=null;
  closeAllPanels(); renderEquipPanel(); openPanel='equip';
  syncUI(); showToast(icon+' '+name+' moved back to bag.');
}
