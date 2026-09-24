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
    entry.id='hsmVocabSelect';entry.type='button';entry.textContent='단어 선택하기';
    entry.dataset.hsmIconReady='1';
    const bar=document.createElement('div');bar.id='hsmVocabSelectionBar';
    bar.innerHTML='<span aria-live="polite"><strong id="hsmVocabSelectedCount">0</strong>개 선택</span><button type="button" id="hsmVocabSelectAll" data-hsm-icon-ready="1">전체 선택</button><button type="button" id="hsmVocabSelectCancel" data-hsm-icon-ready="1">취소</button>';
    filter.before(entry,bar);
    filter.querySelector('span').textContent='선택한 단어만';
    save.dataset.hsmIconReady='1';share.dataset.hsmIconReady='1';share.textContent='공유';
    function sync(){
      const count=getCheckedWords().length;
      if(!count)only.checked=false;
      screen.classList.toggle('hsm-vocab-selecting',selecting);
      entry.hidden=selecting;bar.hidden=!selecting;
      filter.hidden=!selecting||!count;actions.hidden=!selecting||!count;
      entry.disabled=!vocabWords.length;
      document.getElementById('hsmVocabSelectedCount').textContent=count;
      const all=document.getElementById('hsmVocabSelectAll');
      all.textContent=count&&count===vocabWords.length?'전체 해제':'전체 선택';
      all.disabled=!vocabWords.length;
      save.textContent='선택한 '+count+'개 저장';
      document.getElementById('vocabCount').textContent='전체 '+vocabWords.length+'개 · 선택한 단어 '+count+'개';
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
