(function(){
  'use strict';
  if(window.__HSM_SCHOOL_VOCAB_NAV_CLOSE_FIX__)return;
  window.__HSM_SCHOOL_VOCAB_NAV_CLOSE_FIX__=true;


  var embeddedSnapshot=null;
  window.hsmMountSchoolStudy_=function(page){
    var main=document.getElementById('mainApp');
    if(!main)return;
    if(!embeddedSnapshot){
      embeddedSnapshot=Array.from(main.children).filter(function(el){return el.id&&/Screen$/.test(el.id)&&!el.classList.contains('hidden');});
    }
    if(typeof window.hideAllStudentMainScreens_==='function')window.hideAllStudentMainScreens_();
    embeddedSnapshot.forEach(function(el){el.classList.add('hidden');});
    main.appendChild(page);
    page.classList.add('card','hsm-embedded-study');
    document.body.classList.add('hsm-school-study-open');
    document.documentElement.style.overflow='';
    var back=document.getElementById('hsmGlobalBackButton');
    if(back)back.classList.remove('hidden');
    window.scrollTo(0,0);
  };
  window.hsmUnmountSchoolStudy_=function(){
    document.body.classList.remove('hsm-school-study-open');
    if(embeddedSnapshot)embeddedSnapshot.forEach(function(el){el.classList.remove('hidden');});
    embeddedSnapshot=null;
    if(typeof window.hsmUpdateBackButton_==='function')window.hsmUpdateBackButton_();
    window.scrollTo(0,0);
  };

  var NAV_LABELS=['테스트','단어장','내 학습','랭킹','더보기'];
  function normalize(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function schoolPage(){return document.getElementById('hsmSchoolStudentPage');}
  function isOpen(){return ['hsmSchoolStudentPage','hsmSchoolContentPage'].some(function(id){var page=document.getElementById(id);return page&&!page.hidden;});}
  var navigating=false;
  async function closeSchoolPageForNav(){
    var content=document.getElementById('hsmSchoolContentPage');
    if(content&&!content.hidden){
      if(typeof window.hsmRequestCloseSchoolContentPage_!=='function')return false;
      if(!(await window.hsmRequestCloseSchoolContentPage_()))return false;
    }
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

  document.addEventListener('click',async function(event){
    if(!isOpen())return;
    var target=event.target && event.target.closest ? event.target.closest('button,a,[role="button"]') : null;
    if(!target || target.closest('#hsmSchoolStudentPage,#hsmSchoolContentPage'))return;
    var text=normalize(target.textContent);
    var aria=normalize(target.getAttribute && (target.getAttribute('aria-label')||target.getAttribute('title')));
    var label=NAV_LABELS.find(function(x){return text===x || aria===x || text.endsWith(x);});
    if(!label && !target.matches('[data-mobile-menu],#hsmGlobalBackButton'))return;
    event.preventDefault();
    event.stopPropagation();
    if(event.stopImmediatePropagation)event.stopImmediatePropagation();
    if(navigating)return;
    navigating=true;
    try{if(await closeSchoolPageForNav()){if(target.id!=='hsmGlobalBackButton')target.click();}}finally{navigating=false;}
  },true);


})();

