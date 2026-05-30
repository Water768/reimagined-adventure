/* Hearthstead — panels */
'use strict';

/* ═══════════════════════════════════════
   PANELS
═══════════════════════════════════════ */
let openPanel=null;
let invPanelRenderStamp=null;

function getInvPanelRenderStamp(){
  const invPart=Object.entries(state.inventory)
    .filter(([,i])=>i.count>0)
    .map(([k,i])=>k+':'+i.count)
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

function renderInvPanel(){
  document.getElementById('inv-panel')?.remove();
  const w=document.getElementById('game-wrapper');
  const el=document.createElement('div'); el.id='inv-panel'; el.className='panel inv-panel';
  const used=invTotal(), cap=getInvCap(), pct=(used/cap)*100;
  const fc=used>=cap?'full':used>=40?'warn':'';
  const entries=Object.entries(state.inventory).filter(([,i])=>i.count>0);
  const shards=Object.keys(SHARD_META).filter(k=>(state.pockets[k]||0)>0);
  const pocketHtml=shards.length
    ?'<div class="inv-pockets"><div class="inv-pockets-title">POCKETS</div>'
      +shards.map(k=>'<div class="inv-pocket-row"><span>'+SHARD_META[k].icon+'</span><span>'+SHARD_META[k].name+'</span><span>x'+(state.pockets[k]||0)+'</span></div>').join('')
      +'</div>'
    :'<div class="inv-pockets"><div class="inv-pockets-title">POCKETS</div><div class="inv-empty" style="padding:6px 0">No shards yet.</div></div>';
  const rowsHtml=entries.length
    ?entries.map(([key,i])=>{
        const canEquip=(EQUIPPABLE[key]&&state.equipped?.key!==key)
          ||(BAG_BY_KEY[key]&&state.equippedBag?.key!==key);
        const sel=invSelectedKey===key;
        const equipBtn=(sel&&canEquip)
          ?'<button class="inv-row-equip" onclick="event.stopPropagation();doEquipFromInv(\''+key+'\')">EQUIP</button>'
          :'';
        return '<div class="inv-row'+(sel?' selected':'')+'" onclick="selectInvRow(\''+key+'\')">'
          +'<span class="inv-row-icon">'+i.icon+'</span>'
          +'<span class="inv-row-name">'+i.name+'</span>'
          +equipBtn
          +'<span class="inv-row-count">x'+i.count+'</span></div>';
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
  const def = EQUIPPABLE[key];
  if(!def || state.equipped?.key===key) return;
  if(!state.inventory[key]?.count){ showToast('Not in bag.'); return; }
  state.inventory[key].count--;
  if(!state.inventory[key].count) delete state.inventory[key];
  state.equipped = { key, icon:def.icon, name:def.name, tier:def.tier ?? 0 };
  invSelectedKey=null;
  renderInvPanel();
  syncUI();
  showToast(def.icon+' '+def.name+' equipped!');
}

function doEquipBagFromInv(key){
  const def=BAG_BY_KEY[key];
  if(!def||state.equippedBag?.key===key) return;
  if(!state.inventory[key]?.count){ showToast('Not in bag.'); return; }
  if(!equipBagDef(def)) return;
  invSelectedKey=null;
  renderInvPanel();
  syncUI();
  showToast(def.icon+' '+def.name+' equipped! +'+def.invBonus+' bag space');
}

function renderEquipPanel(){
  document.getElementById('equip-panel')?.remove();
  const w=document.getElementById('game-wrapper');
  const el=document.createElement('div'); el.id='equip-panel'; el.className='panel equip-panel';
  const eq=state.equipped;
  const bagAxe=findAxeInBag();
  const axeEq=eq && AXE_BY_KEY[eq.key];
  let toolSlot;
  if(axeEq){
    toolSlot='<div class="equip-slot filled"><span class="equip-slot-icon">'+eq.icon+'</span><span class="equip-slot-info"><span class="equip-slot-name">'+eq.name+'</span><span class="equip-slot-hint">Chop trees for logs · Tier '+(eq.tier ?? 0)+'</span></span><button class="equip-action-btn do-unequip" onclick="doUnequip()">UNEQUIP</button></div>';
  }else if(bagAxe){
    toolSlot='<div class="equip-slot"><span class="equip-slot-icon">'+bagAxe.icon+'</span><span class="equip-slot-info"><span class="equip-slot-name">'+bagAxe.name+'</span><span class="equip-slot-hint">In bag — equip to use · Tier '+bagAxe.tier+'</span></span><button class="equip-action-btn do-equip" onclick="doEquip()">EQUIP</button></div>';
  }else{
    toolSlot='<div class="equip-slot"><span class="equip-slot-icon" style="opacity:0.3">🔧</span><span class="equip-slot-info"><span class="equip-slot-name" style="opacity:0.4">No tool</span><span class="equip-slot-hint">Find tools to equip</span></span></div>';
  }
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
    +'<div style="font-family:var(--font-ui);font-size:11px;color:var(--ui-text-dim);letter-spacing:0.04em;margin-bottom:6px;">TOOL SLOT</div>'
    +toolSlot
    +'<div style="font-family:var(--font-ui);font-size:11px;color:var(--ui-text-dim);letter-spacing:0.04em;margin:10px 0 6px;">BAG SLOT</div>'
    +bagSlot
    +'<div class="equip-store"><s>Tool Store</s> <span class="lock-badge">🔒 LOCKED</span></div>';
  w.appendChild(el);
}

function doEquip(){
  const def = findAxeInBag();
  if(!def || !equipAxeDef(def)) return;
  closeAllPanels(); renderEquipPanel(); openPanel='equip';
  syncUI(); showToast('🪓 '+def.name+' equipped! Now go use it.');
}
function doUnequip(){
  if(!state.equipped)return;
  const{key,icon,name}=state.equipped;
  if(!invAdd(key,icon,name,1)){showToast("Bag is full! Can't unequip right now.");return;}
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
