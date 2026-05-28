/* Hearthstead — ui banners & notifications */
'use strict';

/* ═══════════════════════════════════════
   FOUND BANNER
═══════════════════════════════════════ */
let _bannerCB=null;
let _bannerCancelCB=null;
function buildFoundBannerHtml(title,icon,text,buttonsHtml){
  return '<div class="cosmic-flare cosmic-flare--modal"></div>'
    +'<div class="found-banner-panel">'
    +'<div class="found-banner-kicker">'+title+'</div>'
    +'<div class="found-banner-icon">'+icon+'</div>'
    +'<p class="found-banner-text">'+text+'</p>'
    +buttonsHtml
    +'</div>';
}
function showFoundBanner(title,icon,text,btnText,cb){
  _bannerCB=cb; _bannerCancelCB=null;
  const w=document.getElementById('game-wrapper');
  const dim=document.createElement('div'); dim.className='overlay-dim'; dim.id='banner-dim';
  const b=document.createElement('div'); b.className='found-banner'; b.id='found-banner';
  b.innerHTML=buildFoundBannerHtml(title,icon,text,'<button type="button" class="found-banner-btn" onclick="closeBanner()">'+btnText+'</button>');
  w.appendChild(dim); w.appendChild(b);
}
function showChoiceBanner(title,icon,text,confirmText,cancelText,onConfirm,onCancel){
  _bannerCB=onConfirm; _bannerCancelCB=onCancel||null;
  const w=document.getElementById('game-wrapper');
  const dim=document.createElement('div'); dim.className='overlay-dim'; dim.id='banner-dim';
  const b=document.createElement('div'); b.className='found-banner'; b.id='found-banner';
  b.innerHTML=buildFoundBannerHtml(title,icon,text,
    '<div class="banner-btns">'
    +'<button type="button" class="found-banner-btn found-banner-btn--ghost" onclick="closeBannerCancel()">'+cancelText+'</button>'
    +'<button type="button" class="found-banner-btn found-banner-btn--ghost" onclick="closeBanner()">'+confirmText+'</button>'
    +'</div>');
  w.appendChild(dim); w.appendChild(b);
}
function closeBanner(){
  document.getElementById('found-banner')?.remove();
  document.getElementById('banner-dim')?.remove();
  if(_bannerCB){_bannerCB();_bannerCB=null;}
  _bannerCancelCB=null;
  flushLevelUpQueue();
}
function closeBannerCancel(){
  document.getElementById('found-banner')?.remove();
  document.getElementById('banner-dim')?.remove();
  if(_bannerCancelCB){_bannerCancelCB();}
  _bannerCB=null; _bannerCancelCB=null;
  flushLevelUpQueue();
}

/* ═══════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════ */
function spawnXPPopup(text,color,event){
  const w=document.getElementById('game-wrapper'),r=w.getBoundingClientRect();
  const x=event?(event.touches?event.touches[0].clientX:event.clientX)-r.left:195;
  const y=event?(event.touches?event.touches[0].clientY:event.clientY)-r.top:400;
  const el=document.createElement('div'); el.className='xp-popup'; el.textContent=text;
  el.style.cssText='left:'+x+'px;top:'+y+'px;color:'+color+';';
  w.appendChild(el); setTimeout(()=>el.remove(),1900);
}
let _levelUpQueue=[];
let _levelUpFlushTimers=[];
const LEVELUP_BANNER_MS=3200;
const LEVELUP_QUEUE_GAP_MS=3400;
function clearLevelUpQueue(){
  _levelUpQueue=[];
  _levelUpFlushTimers.forEach(t=>clearTimeout(t));
  _levelUpFlushTimers=[];
}
function dismissLevelUpBanners(){
  document.querySelectorAll('.levelup-banner').forEach(el=>el.remove());
  clearLevelUpQueue();
}
function displayLevelUpBanner(skillName,level){
  const w=document.getElementById('game-wrapper');
  const el=document.createElement('div'); el.className='levelup-banner';
  el.innerHTML='<div class="levelup-panel">'
    +'<div class="cosmic-flare cosmic-flare--level"></div>'
    +'<div class="levelup-body">'
    +'<div class="levelup-kicker">Level up</div>'
    +'<div class="levelup-skill">'+skillName+'</div>'
    +'<div class="levelup-num">Level '+level+'</div>'
    +'</div></div>';
  w.appendChild(el); setTimeout(()=>el.remove(),LEVELUP_BANNER_MS);
}
function flushLevelUpQueue(){
  if(!_levelUpQueue.length) return;
  const items=_levelUpQueue.splice(0,_levelUpQueue.length);
  items.forEach((item,i)=>{
    _levelUpFlushTimers.push(setTimeout(()=>displayLevelUpBanner(item.skillName,item.level), i*LEVELUP_QUEUE_GAP_MS));
  });
}
function showLevelUp(skillName,level,defer){
  if(defer||document.getElementById('found-banner')||document.getElementById('banner-dim')){
    _levelUpQueue.push({skillName,level});
    return;
  }
  displayLevelUpBanner(skillName,level);
}
let toastTimer;
function dismissToast(){
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  toastTimer=null;
}
function showToast(msg){
  dismissToast();
  const w=document.getElementById('game-wrapper');
  const el=document.createElement('div');
  el.className='toast';
  el.textContent=msg;
  w.appendChild(el);
  toastTimer=setTimeout(()=>el.remove(),2200);
}
function showQuickToast(msg){
  dismissToast();
  const w=document.getElementById('game-wrapper');
  const el=document.createElement('div');
  el.className='toast quick';
  el.textContent=msg;
  w.appendChild(el);
  toastTimer=setTimeout(()=>el.remove(),1050);
}
