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
  const pocketPart=Object.keys(SHARD_META).map(k=>k+':'+(state.pockets[k]||0)).join('|');
  return invTotal()+'/'+invPart+'/'+pocketPart;
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
  const pocketHtml='<div class="inv-pockets"><div class="inv-pockets-title">POCKETS</div>'
    +'<div class="inv-shard-row">'
    +Object.keys(SHARD_META).map((k)=>{
      const m=SHARD_META[k];
      const n=state.pockets[k]||0;
      const emptyCls=n>0?'':' empty';
      return '<div class="inv-shard-chip'+emptyCls+'" tabindex="0">'
        +'<span class="inv-shard-icon">'+m.icon+'</span>'
        +'<span class="inv-shard-count">'+n+'</span>'
        +'<span class="inv-shard-tip">'+m.name+'</span>'
        +'</div>';
    }).join('')
    +'</div></div>';
  const rowsHtml=entries.length
    ?entries.map(({key, count, def})=>{
        const canEquipToStore=typeof canEquipToolToStore==='function'&&canEquipToolToStore(key);
        const canEquip=(EQUIPPABLE[key]&&state.equipped?.key!==key)
          ||(BAG_BY_KEY[key]&&state.equippedBag?.key!==key)
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
  if(BAG_BY_KEY[key]) return doEquipBagFromInv(key);
  if(typeof canEquipToolToStore==='function'&&canEquipToolToStore(key)){
    return doEquipToolToStoreFromInv(key);
  }
  const def = EQUIPPABLE[key];
  if(!def || state.equipped?.key===key) return;
  if(invCount(key)<=0){ showToast('Not in bag.'); return; }
  stackTake(state.inventory, key, 1);
  state.equipped = { key, icon:def.icon, name:def.name, tier:def.tier ?? 0 };
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
  el.innerHTML='<div class="panel-title">⚔️ EQUIPMENT</div>'
    +'<div style="font-family:var(--font-ui);font-size:11px;color:var(--ui-text-dim);letter-spacing:0.04em;margin-bottom:6px;">BAG SLOT</div>'
    +bagSlot;
  w.appendChild(el);
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
