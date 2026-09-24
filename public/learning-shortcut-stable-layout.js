(function hsmStableLearningShortcutLayout(){
  'use strict';
  if(window.__HSM_STABLE_LEARNING_SHORTCUT_LAYOUT__) return;
  window.__HSM_STABLE_LEARNING_SHORTCUT_LAYOUT__=true;

  function addStyle(){
    if(document.getElementById('hsmStableLearningShortcutStyle')) return;
    var s=document.createElement('style');
    s.id='hsmStableLearningShortcutStyle';
    s.textContent=[
      '#hsmSchoolVocabShortcut{position:relative!important;display:block!important;width:100%!important;min-width:0!important;padding-right:48px!important;text-align:left!important}',
      '#hsmSchoolVocabShortcut .shortcut-title{position:static!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;width:auto!important;min-width:0!important;margin:0 0 12px!important;padding:0!important;white-space:normal!important;writing-mode:horizontal-tb!important;word-break:keep-all!important;line-height:1.25!important}',
      '#hsmSchoolVocabShortcut .shortcut-title span{writing-mode:horizontal-tb!important;word-break:keep-all!important;overflow-wrap:normal!important}',
      '#hsmSchoolVocabShortcut .shortcut-title .section-icon,#hsmSchoolVocabShortcut .shortcut-title .shortcut-icon{position:static!important;display:inline-flex!important;flex:0 0 auto!important;margin:0!important}',
      '#hsmSchoolVocabShortcut>.section-icon,#hsmSchoolVocabShortcut>.shortcut-icon{position:static!important;display:inline-flex!important;float:none!important;margin:0 10px 0 0!important;vertical-align:middle!important}',
      '#hsmSchoolVocabShortcut .shortcut-description{position:static!important;display:block!important;width:auto!important;min-width:0!important;margin:0 0 12px!important;padding:0!important;line-height:1.55!important;writing-mode:horizontal-tb!important;word-break:keep-all!important;text-align:left!important}',
      '#hsmSchoolVocabShortcut .shortcut-count,#hsmSchoolVocabShortcut .shortcut-stat,#hsmSchoolVocabShortcut .shortcut-status,#hsmSchoolVocabShortcut .shortcut-meta{position:static!important;display:block!important;width:auto!important;min-width:0!important;margin:0!important;padding:0!important;line-height:1.4!important;writing-mode:horizontal-tb!important;word-break:keep-all!important;white-space:normal!important;text-align:left!important}',
      '#hsmSchoolVocabShortcut .shortcut-arrow,#hsmSchoolVocabShortcut>.arrow{position:absolute!important;right:18px!important;top:50%!important;transform:translateY(-50%)!important;margin:0!important;float:none!important}',
      '#hsmSchoolVocabShortcut>*{grid-column:auto!important;grid-row:auto!important;align-self:auto!important;justify-self:auto!important}',
      '#hsmSchoolVocabShortcut .hsm-sv-launcher-badge{display:none!important}',
      '@media(max-width:600px){#hsmSchoolVocabShortcut{padding-right:42px!important}#hsmSchoolVocabShortcut .shortcut-title{margin-bottom:10px!important;gap:9px!important}#hsmSchoolVocabShortcut .shortcut-description{margin-bottom:10px!important}#hsmSchoolVocabShortcut .shortcut-arrow,#hsmSchoolVocabShortcut>.arrow{right:14px!important}}'
    ].join('');
    document.head.appendChild(s);
  }

  function markHost(){
    var school=document.getElementById('hsmSchoolVocabShortcut');
    if(!school||!school.parentElement) return false;
    school.parentElement.classList.add('hsm-school-shortcut-host');
    return true;
  }

  function polishCards(){
    var icons={
      '오답노트':['<path d="M5 4h14v17l-7-4-7 4z"/><path d="m9 10 2 2 4-4"/>','틀린 단어를 다시 익혀요.'],
      '나만의 단어장':['<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18m4-18v7l2-1 2 1V3"/>','저장한 단어를 모아 학습해요.'],
      '학교 수행평가':['<path d="m3 10 9-7 9 7v11H3zM9 21v-7h6v7M6 11h1m10 0h1"/>','학교 단어를 익히고 시험을 연습해요.'],
      '학교 내신 본문':['<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7"/>','본문 순서와 어형을 연습해요.'],
      '스마트 복습':['<path d="M20 8a8 8 0 0 0-14-2L3 9m0-6v6h6M4 16a8 8 0 0 0 14 2l3-3m0 6v-6h-6"/>','자주 틀린 단어부터 복습해요.']
    };
    document.querySelectorAll('#myPageScreen .learning-shortcut').forEach(function(card){
      var title=card.querySelector('.shortcut-title'),icon=card.querySelector('.section-icon,.shortcut-icon');
      if(!title||!icon)return;
      var label=title.textContent.trim(),spec=icons[label];if(!spec)return;
      if(!icon.querySelector('[data-learning-icon="'+label+'"]')){
        icon.innerHTML='<svg data-learning-icon="'+label+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+spec[0]+'</svg>';
      }
      var description=card.querySelector('.shortcut-description');
      if(description&&description.textContent!==spec[1])description.textContent=spec[1];
    });
  }
  function run(){addStyle();markHost();polishCards();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
  var attempts=0,timer=setInterval(function(){attempts++;run();if(markHost()||attempts>40) clearInterval(timer);},250);
  new MutationObserver(function(){markHost();polishCards();}).observe(document.documentElement,{childList:true,subtree:true});
})();
