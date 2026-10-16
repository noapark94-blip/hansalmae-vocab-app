(function(){
  'use strict';
  function boot(){
    const screen=document.getElementById('vocabScreen');
    if(!screen)return;
    const filter=screen.querySelector('.filter-check');
    const only=document.getElementById('showCheckedOnly');
    const actions=screen.querySelector('.vocab-actions');
    const buttons=actions.querySelectorAll('button');
    const save=buttons[0],share=buttons[1];
    buttons[2].remove();
    let selecting=false;
    const entry=document.createElement('button');
    entry.id='hsmVocabSelect';entry.type='button';entry.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 3 3 5-6"/></svg><span>단어 선택하기</span>';
    entry.setAttribute('aria-expanded','false');entry.setAttribute('aria-controls','hsmVocabSelectionPanel');
    entry.dataset.hsmIconReady='1';
    const bar=document.createElement('div');bar.id='hsmVocabSelectionBar';
    bar.innerHTML='<span class="hsm-selection-count" aria-live="polite"><strong id="hsmVocabSelectedCount">0</strong>개 선택</span><button type="button" id="hsmVocabSelectAll" data-hsm-icon-ready="1">전체 선택</button><button type="button" id="hsmVocabSelectClear" data-hsm-icon-ready="1">선택 해제</button><button type="button" id="hsmVocabSelectCancel" data-hsm-icon-ready="1" aria-label="단어 선택 모드 완료">완료</button>';
    filter.before(entry,bar);
    const panel=document.createElement('div');panel.id='hsmVocabSelectionPanel';
    bar.before(panel);panel.append(bar,filter,actions);
    filter.hidden=true;
    const toggle=document.createElement('button');toggle.type='button';toggle.id='hsmVocabOnlySelected';
    toggle.dataset.hsmIconReady='1';toggle.textContent='선택만 보기';
    toggle.setAttribute('aria-pressed','false');
    bar.querySelector('.hsm-selection-count').after(toggle);
    const more=document.createElement('button');more.type='button';more.id='hsmVocabMore';more.textContent='⋯';more.dataset.hsmIconReady='1';more.setAttribute('aria-label','선택 단어 더보기');more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-controls','hsmVocabMoreDialog');actions.append(more);
    const menu=document.createElement('dialog');menu.id='hsmVocabMoreDialog';menu.setAttribute('aria-labelledby','hsmVocabMoreTitle');
    menu.innerHTML='<header><h2 id="hsmVocabMoreTitle" data-hsm-icon-ready="1">선택한 단어</h2><button type="button" data-hsm-icon-ready="1" aria-label="닫기">×</button></header><div class="hsm-vocab-more-items"></div>';
    menu.querySelector('div').append(save,share);document.body.append(menu);
    more.onclick=()=>menu.showModal();menu.querySelector('header button').onclick=()=>menu.close();
    [save,share].forEach(b=>b.addEventListener('click',()=>menu.close(),true));
    menu.addEventListener('close',()=>{if(!actions.hidden)more.focus();});
    menu.addEventListener('click',e=>{if(e.target===menu){const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)menu.close();}});
    toggle.onclick=function(){only.checked=!only.checked;renderVocabulary();};
    const icon=path=>'<svg class="hsm-action-icon" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
    save.dataset.hsmIconReady='1';share.dataset.hsmIconReady='1';
    save.innerHTML=icon('<path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1 0-4h13M9 3v8l3-2 3 2V3"/>')+'<span>단어장에 추가</span>';
    share.innerHTML=icon('<path d="M12 15V3m-4 4 4-4 4 4M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/>')+'<span>공유하기</span>';
    function positionActions(){
      const nav=document.getElementById('hsmMobileNav');
      const rect=nav&&nav.getBoundingClientRect();
      const bottom=rect&&rect.height&&rect.top<window.innerHeight?Math.max(0,window.innerHeight-rect.top)+8:16;
      actions.style.bottom=bottom+'px';
    }
    window.addEventListener('resize',positionActions);
    function sync(){
      const count=getCheckedWords().length;
      menu.querySelector('h2').textContent='선택한 단어 '+count+'개';
      if((!selecting||!count)&&menu.open)menu.close();
      if(!count)only.checked=false;
      screen.classList.toggle('hsm-vocab-selecting',selecting);
      entry.hidden=selecting;bar.hidden=!selecting;panel.hidden=!selecting;
      entry.setAttribute('aria-expanded',String(selecting));
      positionActions();
      filter.hidden=true;actions.hidden=!selecting||!count;
      toggle.setAttribute('aria-pressed',String(only.checked));
      entry.disabled=!vocabWords.length;
      document.getElementById('hsmVocabSelectedCount').textContent=count;
      const all=document.getElementById('hsmVocabSelectAll');
      all.disabled=!vocabWords.length||count===vocabWords.length;
      document.getElementById('hsmVocabSelectClear').disabled=!count;
      toggle.disabled=!count;
      save.setAttribute('aria-label','선택한 '+count+'개 단어장 저장');
      document.getElementById('vocabCount').textContent='전체 '+vocabWords.length+'개';
    }
    const render=window.renderVocabulary;
    window.renderVocabulary=function(){if(!getCheckedWords().length)only.checked=false;render.apply(this,arguments);sync();};
    entry.onclick=function(){selecting=true;sync();};
    document.getElementById('hsmVocabSelectCancel').onclick=function(){selecting=false;only.checked=false;renderVocabulary();};
    document.getElementById('hsmVocabSelectAll').onclick=function(){
      vocabWords.forEach(function(word){localStorage.setItem(getCheckStorageKey(word),'true');});
      renderVocabulary();
    };
    document.getElementById('hsmVocabSelectClear').onclick=function(){
      vocabWords.forEach(word=>localStorage.removeItem(getCheckStorageKey(word)));
      only.checked=false;renderVocabulary();
    };
    const load=window.loadVocabulary;
    window.loadVocabulary=function(){selecting=false;only.checked=false;vocabWords=[];sync();return load.apply(this,arguments);};
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
