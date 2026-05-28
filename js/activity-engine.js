/* Hearthstead — shared activity loop + workbench UI helpers */
'use strict';

const ACTIVITY_RUNNERS={};

function registerActivityRunner(type, runner){
  ACTIVITY_RUNNERS[type]=runner;
}

function getActivityRunner(type){
  return ACTIVITY_RUNNERS[type]||null;
}

function isActivityRunning(type){
  const r=ACTIVITY_RUNNERS[type];
  return r?.isRunning?.()||false;
}

function stopRegisteredActivity(type, fromActivitySwitch){
  const r=ACTIVITY_RUNNERS[type];
  if(r?.stop) r.stop(fromActivitySwitch);
}

function anyRegisteredActivityRunning(){
  return Object.keys(ACTIVITY_RUNNERS).some(type=>isActivityRunning(type));
}

function createTimedActivity(config){
  const{
    type,
    state:actState,
    canContinue,
    onPrepare,
    onAttempt,
    onRefresh,
    onStop,
    tickMs=ACTION_TICK_MS,
    outOfResourcesMsg='Out of resources.',
    cannotStartMsg='Nothing to do right now.',
    label=type,
  }=config;

  function stop(fromActivitySwitch){
    if(!actState.running&&!actState.timer) return;
    actState.running=false;
    clearTimeout(actState.timer);
    actState.timer=null;
    if(onStop) onStop(fromActivitySwitch);
    if(!fromActivitySwitch) clearActivity(type);
    if(onRefresh) onRefresh();
    if(!fromActivitySwitch) syncUI();
  }

  function runNext(){
    if(!actState.running) return;
    if(!canContinue()){
      stop();
      showToast(outOfResourcesMsg);
      return;
    }
    const ok=onAttempt();
    if(ok===false){
      stop();
      return;
    }
    if(onRefresh) onRefresh();
    syncInventoryUI();
    actState.timer=setTimeout(runNext, tickMs);
  }

  function once(){
    stopOtherActivities(null);
    if(!canContinue()){
      if(cannotStartMsg) showToast(cannotStartMsg);
      if(onRefresh) onRefresh();
      return;
    }
    onAttempt();
    if(onRefresh) onRefresh();
  }

  function startContinuous(){
    if(actState.running) return;
    if(!canContinue()){
      if(cannotStartMsg) showToast(cannotStartMsg);
      return;
    }
    if(onPrepare) onPrepare();
    setActivity(type);
    actState.running=true;
    if(onRefresh) onRefresh();
    syncUI();
    runNext();
  }

  registerActivityRunner(type, { isRunning:()=>!!actState.running, stop, label });

  return { once, startContinuous, stop, runNext };
}

function renderOnceContinuousButtons(opts){
  const{
    btnEl,
    running,
    can,
    onceLabel='1 PROCESS',
    onceOnclick,
    continuousOnclick,
    stopLabel='⛔ STOP PROCESSING',
    stopOnclick,
    noticeHtml='',
  }=opts;
  if(!btnEl) return;
  if(running){
    btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
      +'<button class="wb-btn stop" onclick="'+stopOnclick+'">'+stopLabel+'</button>'
      +'</div></div>';
    return;
  }
  btnEl.innerHTML='<div class="wb-use-box"><div class="wb-use-btns">'
    +'<button class="wb-btn once" '+(!can?'disabled':'')+' onclick="'+onceOnclick+'">'+onceLabel+'</button>'
    +'<button class="wb-btn continuous" '+(!can?'disabled':'')+' onclick="'+continuousOnclick+'">CONTINUOUS</button>'
    +'</div>'
    +noticeHtml
    +'</div>';
}

function renderRecipePickerCollapsed(opts){
  const{
    icon,
    stockLine,
    stockCls,
    subtitle='',
    blockMessage='',
    unavail=false,
    toggleOnclick,
  }=opts;
  return '<div class="wb-log-pick wb-log-pick-collapsed'+(unavail?' unavail':'')+'" onclick="'+toggleOnclick+'">'
    +'<span class="wb-mat-icon">'+icon+'</span>'
    +'<div class="wb-mat-pick-body">'
    +'<span class="wb-mat-pick-avail '+stockCls+'">'+stockLine+'</span>'
    +(subtitle?'<span class="wb-mat-pick-name" style="font-size:11px;color:var(--ui-text-dim)">'+subtitle+'</span>':'')
    +(blockMessage?'<span class="wb-mat-pick-name" style="font-size:11px;color:rgba(255,110,110,0.92)">'+blockMessage+'</span>':'')
    +'</div>'
    +'<span class="wb-log-pick-chevron">▾</span>'
    +'</div>';
}

function isTimedActivityActive(){
  return cook.running||spin.running||loomProcess.running||apothProcess.running||craft.running;
}
