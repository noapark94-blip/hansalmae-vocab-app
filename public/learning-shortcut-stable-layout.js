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

  function run(){addStyle();markHost();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
  var attempts=0,timer=setInterval(function(){attempts++;run();if(markHost()||attempts>40) clearInterval(timer);},250);
  new MutationObserver(function(){markHost();}).observe(document.documentElement,{childList:true,subtree:true});
})();