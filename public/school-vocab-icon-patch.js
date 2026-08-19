(function hansalmaeSchoolVocabIconPatch(){
  'use strict';
  if(window.__HSM_SCHOOL_VOCAB_ICON_PATCH__) return;
  window.__HSM_SCHOOL_VOCAB_ICON_PATCH__=true;

  var schoolSvg='<svg viewBox="0 0 32 32" focusable="false"><path d="M5.5 11.5 16 5l10.5 6.5" fill="none" stroke="#8f145f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11.5h16v13H8z" fill="#fff" stroke="#8f145f" stroke-width="1.7"/><path d="M12 15h3v3h-3zm5 0h3v3h-3zm-5 5h3v3h-3z" fill="#f5d4e5" stroke="#c95b98" stroke-width=".9"/><path d="M18 21.3 20.2 23.5 24.8 18.9" fill="none" stroke="#d0931f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function removeDuplicateIcons(root){
    (root||document).querySelectorAll('h2,h3,button').forEach(function(el){
      var section=el.querySelector(':scope > .section-icon');
      if(!section) return;
      el.querySelectorAll(':scope > .hsm-ui-icon').forEach(function(icon){icon.remove();});
      el.dataset.hsmIconReady='1';
    });
  }

  function applySchoolIcon(){
    var shortcut=document.getElementById('hsmSchoolVocabShortcut');
    if(!shortcut) return;
    var icon=shortcut.querySelector('.shortcut-title .section-icon');
    if(!icon) return;
    if(icon.dataset.hsmSchoolIcon==='1') return;
    icon.innerHTML=schoolSvg;
    icon.dataset.hsmSchoolIcon='1';
    icon.setAttribute('aria-label','학교 수행평가');
  }

  function run(){removeDuplicateIcons(document);applySchoolIcon();}
  var queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;run();});}

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
