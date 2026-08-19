(function(){
  'use strict';
  if(window.__HSM_SCHOOL_VOCAB_CUSTOM_ICON__) return;
  window.__HSM_SCHOOL_VOCAB_CUSTOM_ICON__=true;

  var svg='<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">'
    +'<rect x="7" y="18" width="34" height="22" rx="5" fill="#fff7fb" stroke="#9b1b67" stroke-width="2.6"/>'
    +'<path d="M12 18 24 9l12 9" fill="none" stroke="#9b1b67" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'
    +'<path d="M18 40V27h12v13" fill="#fff" stroke="#9b1b67" stroke-width="2.4" stroke-linejoin="round"/>'
    +'<path d="M12 24h4m16 0h4" stroke="#d45d9d" stroke-width="2.2" stroke-linecap="round"/>'
    +'<circle cx="35" cy="13" r="8" fill="#fff" stroke="#e5bfd3" stroke-width="1.8"/>'
    +'<path d="m31.5 13 2.4 2.5 4.8-5.2" fill="none" stroke="#d69620" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>'
    +'</svg>';

  function apply(){
    var button=document.getElementById('hsmSchoolVocabShortcut');
    if(!button) return false;
    var icon=button.querySelector('.section-icon,.shortcut-icon');
    if(!icon) return false;
    if(icon.dataset.hsmSchoolCustomIcon==='1') return true;
    icon.dataset.hsmSchoolCustomIcon='1';
    icon.innerHTML=svg;
    icon.style.display='inline-flex';
    icon.style.alignItems='center';
    icon.style.justifyContent='center';
    var rendered=icon.querySelector('svg');
    if(rendered){rendered.style.width='28px';rendered.style.height='28px';rendered.style.display='block';}
    return true;
  }

  if(!apply()){
    var tries=0;
    var timer=setInterval(function(){tries++;if(apply()||tries>40)clearInterval(timer);},250);
  }
  new MutationObserver(function(){apply();}).observe(document.documentElement,{childList:true,subtree:true});
})();
