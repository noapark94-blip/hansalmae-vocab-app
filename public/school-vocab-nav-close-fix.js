(function(){
  'use strict';
  if(window.__HSM_SCHOOL_VOCAB_NAV_CLOSE_FIX__)return;
  window.__HSM_SCHOOL_VOCAB_NAV_CLOSE_FIX__=true;

  var NAV_LABELS=['테스트','단어장','내 학습','랭킹','더보기'];
  function normalize(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function schoolPage(){return document.getElementById('hsmSchoolStudentPage');}
  function isOpen(){var page=schoolPage();return !!(page && !page.hidden);}
  function closeSchoolPageForNav(){
    var page=schoolPage();
    if(!page || page.hidden)return true;
    if(typeof window.hsmRequestCloseSchoolVocabPage_==='function')return window.hsmRequestCloseSchoolVocabPage_();
    page.hidden=true;
    document.documentElement.style.overflow='';
    if(location.hash==='#school-vocab'){
      try{history.replaceState({},'',location.pathname+location.search);}catch(_){ }
    }
    return true;
  }

  document.addEventListener('click',function(event){
    if(!isOpen())return;
    var target=event.target && event.target.closest ? event.target.closest('button,a,[role="button"]') : null;
    if(!target || target.closest('#hsmSchoolStudentPage'))return;
    var text=normalize(target.textContent);
    var aria=normalize(target.getAttribute && (target.getAttribute('aria-label')||target.getAttribute('title')));
    var label=NAV_LABELS.find(function(x){return text===x || aria===x || text.endsWith(x);});
    if(!label)return;
    if(closeSchoolPageForNav()===false){
      event.preventDefault();
      event.stopPropagation();
      if(event.stopImmediatePropagation)event.stopImmediatePropagation();
    }
  },true);

  window.addEventListener('popstate',function(){
    if(location.hash!=='#school-vocab' && isOpen())closeSchoolPageForNav();
  });
})();
