(function hsmStableLearningShortcutLayout(){
  'use strict';
  if(window.__HSM_STABLE_LEARNING_SHORTCUT_LAYOUT__) return;
  window.__HSM_STABLE_LEARNING_SHORTCUT_LAYOUT__=true;

  function addStyle(){
    if(document.getElementById('hsmStableLearningShortcutStyle')) return;
    var s=document.createElement('style');
    s.id='hsmStableLearningShortcutStyle';
    s.textContent=[
      /* Scope only to the four cards that live beside the school-vocab shortcut. */
      '.hsm-school-shortcut-host>.learning-shortcut{position:relative!important;display:block!important;width:100%!important;min-width:0!important;padding-right:48px!important;text-align:left!important}',
      '.hsm-school-shortcut-host>.learning-shortcut .shortcut-title{position:static!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;width:auto!important;min-width:0!important;margin:0 0 12px!important;padding:0!important;white-space:normal!important;writing-mode:horizontal-tb!important;word-break:keep-all!important;line-height:1.25!important}',
      '.hsm-school-shortcut-host>.learning-shortcut .shortcut-title span{writing-mode:horizontal-tb!important;word-break:keep-all!important;overflow-wrap:normal!important}',
      '.hsm-school-shortcut-host>.learning-shortcut .shortcut-title .section-icon,.hsm-school-shortcut-host>.learning-shortcut .shortcut-title .shortcut-icon{position:static!important;display:inline-flex!important;flex:0 0 auto!important;margin:0!important}',
      '.hsm-school-shortcut-host>.learning-shortcut>.section-icon,.hsm-school-shortcut-host>.learning-shortcut>.shortcut-icon{position:static!important;display:inline-flex!important;float:none!important;margin:0 10px 0 0!important;vertical-align:middle!important}',
      '.hsm-school-shortcut-host>.learning-shortcut .shortcut-description{position:static!important;display:block!important;width:auto!important;min-width:0!important;margin:0 0 12px!important;padding:0!important;line-height:1.55!important;writing-mode:horizontal-tb!important;word-break:keep-all!important}',
      '.hsm-school-shortcut-host>.learning-shortcut .shortcut-stat,.hsm-school-shortcut-host>.learning-shortcut .shortcut-status,.hsm-school-shortcut-host>.learning-shortcut .shortcut-meta{position:static!important;display:block!important;width:auto!important;min-width:0!important;margin:0!important;padding:0!important;line-height:1.4!important;writing-mode:horizontal-tb!important;word-break:keep-all!important}',
      '.hsm-school-shortcut-host>.learning-shortcut .shortcut-arrow,.hsm-school-shortcut-host>.learning-shortcut>.arrow{position:absolute!important;right:18px!important;top:50%!important;transform:translateY(-50%)!important;margin:0!important;float:none!important}',
      '.hsm-school-shortcut-host>.learning-shortcut>*{grid-column:auto!important;grid-row:auto!important}',
      '@media(max-width:600px){.hsm-school-shortcut-host>.learning-shortcut{padding-right:42px!important}.hsm-school-shortcut-host>.learning-shortcut .shortcut-title{margin-bottom:10px!important;gap:9px!important}.hsm-school-shortcut-host>.learning-shortcut .shortcut-description{margin-bottom:10px!important}.hsm-school-shortcut-host>.learning-shortcut .shortcut-arrow,.hsm-school-shortcut-host>.learning-shortcut>.arrow{right:14px!important}}'
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
