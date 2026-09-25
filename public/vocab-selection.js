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
    bar.innerHTML='<span aria-live="polite"><strong id="hsmVocabSelectedCount">0</strong>개 선택</span><button type="button" id="hsmVocabSelectAll" data-hsm-icon-ready="1">전체 선택</button><button type="button" id="hsmVocabSelectCancel" data-hsm-icon-ready="1">선택 종료</button>';
    filter.before(entry,bar);
    const panel=document.createElement('div');panel.id='hsmVocabSelectionPanel';
    bar.before(panel);panel.append(bar,filter,actions);
    filter.hidden=true;
    const toggle=document.createElement('button');toggle.type='button';toggle.id='hsmVocabOnlySelected';
    toggle.dataset.hsmIconReady='1';toggle.textContent='선택만 보기';
    toggle.setAttribute('aria-pressed','false');
    actions.prepend(toggle);
    toggle.onclick=function(){only.checked=!only.checked;renderVocabulary();};
    save.dataset.hsmIconReady='1';share.dataset.hsmIconReady='1';share.textContent='공유';
    function positionActions(){
      const nav=document.getElementById('hsmMobileNav');
      const rect=nav&&nav.getBoundingClientRect();
      const bottom=rect&&rect.height&&rect.top<window.innerHeight?Math.max(0,window.innerHeight-rect.top)+8:16;
      actions.style.bottom=bottom+'px';
    }
    window.addEventListener('resize',positionActions);
    function sync(){
      const count=getCheckedWords().length;
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
      all.textContent=count&&count===vocabWords.length?'전체 해제':'전체 선택';
      all.disabled=!vocabWords.length;
      save.textContent='단어장 저장';
      save.setAttribute('aria-label','선택한 '+count+'개 단어장 저장');
      document.getElementById('vocabCount').textContent='전체 '+vocabWords.length+'개';
    }
    const render=window.renderVocabulary;
    window.renderVocabulary=function(){if(!getCheckedWords().length)only.checked=false;render.apply(this,arguments);sync();};
    entry.onclick=function(){selecting=true;sync();};
    document.getElementById('hsmVocabSelectCancel').onclick=function(){selecting=false;only.checked=false;renderVocabulary();};
    document.getElementById('hsmVocabSelectAll').onclick=function(){
      const clear=getCheckedWords().length===vocabWords.length;
      vocabWords.forEach(function(word){const key=getCheckStorageKey(word);if(clear)localStorage.removeItem(key);else localStorage.setItem(key,'true');});
      renderVocabulary();
    };
    const load=window.loadVocabulary;
    window.loadVocabulary=function(){selecting=false;only.checked=false;vocabWords=[];sync();return load.apply(this,arguments);};
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
