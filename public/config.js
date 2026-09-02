// index.html의 config.js?v=... 값 하나를 앱 전체 빌드 버전으로 사용합니다.
// 모든 동적 기능 파일이 같은 버전으로 로드되므로 기기별 혼합 캐시를 방지합니다.
(function initializeHansalmaeBuildVersion(){
  var script=document.currentScript;
  var version='20260902-1';
  try{
    version=new URL(script&&script.src||'',document.baseURI).searchParams.get('v')||version;
  }catch(_error){}
  window.HANSALMAE_BUILD_VERSION=version;
  window.hsmVersionedAssetUrl_=function(path){
    var clean=String(path||'').split('?')[0];
    return clean+'?v='+encodeURIComponent(version);
  };
})();

// 배포 전에 YOUR_PROJECT_REF를 Supabase 프로젝트 참조값으로 바꾸세요.
// 이 파일에는 service_role 키 또는 관리자 비밀번호를 넣지 마세요.
window.HANSALMAE_CONFIG = {
  apiUrl: "https://qlcgoqcuaenveargxcsa.supabase.co/functions/v1/api"
};

// iOS/PWA 스와이프 뒤로가기용 history/popstate 보정은 사용하지 않습니다.
// 앱 내부 이동은 각 화면의 뒤로가기 버튼과 기존 hsmGoBack_ 로직만 사용합니다.

(function loadHansalmaeSchoolVocabulary(){
  var asset=window.hsmVersionedAssetUrl_||function(path){return path;};
  if(document.querySelector('script[data-hsm-school-vocab]'))return;
  var script=document.createElement('script');script.src=asset('./school-vocab.js');script.defer=true;script.dataset.hsmSchoolVocab='1';document.head.appendChild(script);
  if(/teacher\.html/i.test(location.pathname)){
    if(!document.querySelector('script[data-hsm-school-vocab-ui]')){var ui=document.createElement('script');ui.src=asset('./school-vocab-ui-patch.js');ui.defer=true;ui.dataset.hsmSchoolVocabUi='1';document.head.appendChild(ui);}
    if(!document.querySelector('script[data-hsm-school-vocab-search-fix]')){var searchFix=document.createElement('script');searchFix.src=asset('./teacher-school-vocab-search-fix.js');searchFix.defer=true;searchFix.dataset.hsmSchoolVocabSearchFix='1';document.head.appendChild(searchFix);}
    if(!document.querySelector('script[data-hsm-school-vocab-tab-fix]')){var fix=document.createElement('script');fix.src=asset('./teacher-school-vocab-tab-fix.js');fix.defer=true;fix.dataset.hsmSchoolVocabTabFix='1';document.head.appendChild(fix);}
    if(!document.querySelector('script[data-hsm-school-vocab-edit-fix]')){var editFix=document.createElement('script');editFix.src=asset('./teacher-school-vocab-edit-fix.js');editFix.defer=true;editFix.dataset.hsmSchoolVocabEditFix='1';document.head.appendChild(editFix);}
    if(!document.querySelector('script[data-hsm-school-vocab-exam-polish]')){var examPolish=document.createElement('script');examPolish.src=asset('./teacher-school-vocab-exam-polish.js');examPolish.defer=true;examPolish.dataset.hsmSchoolVocabExamPolish='1';document.head.appendChild(examPolish);}
  }else{
    if(!document.querySelector('script[data-hsm-school-vocab-student-page]')){var page=document.createElement('script');page.src=asset('./school-vocab-student-page.js');page.defer=true;page.dataset.hsmSchoolVocabStudentPage='1';document.head.appendChild(page);}
    if(!document.querySelector('script[data-hsm-school-vocab-free-test-ui]')){var freeTestUi=document.createElement('script');freeTestUi.src=asset('./school-vocab-free-test-ui.js');freeTestUi.defer=true;freeTestUi.dataset.hsmSchoolVocabFreeTestUi='1';document.head.appendChild(freeTestUi);}
    if(!document.querySelector('script[data-hsm-school-free-test-match]')){var freeTestMatch=document.createElement('script');freeTestMatch.src=asset('./school-vocab-free-test-match.js');freeTestMatch.defer=true;freeTestMatch.dataset.hsmSchoolFreeTestMatch='1';document.head.appendChild(freeTestMatch);}
    if(!document.querySelector('script[data-hsm-school-vocab-selection-fix]')){var selectionFix=document.createElement('script');selectionFix.src=asset('./school-vocab-selection-fix.js');selectionFix.defer=true;selectionFix.dataset.hsmSchoolVocabSelectionFix='1';document.head.appendChild(selectionFix);}
    if(!document.querySelector('script[data-hsm-school-vocab-nav-close]')){var navClose=document.createElement('script');navClose.src=asset('./school-vocab-nav-close-fix.js');navClose.defer=true;navClose.dataset.hsmSchoolVocabNavClose='1';document.head.appendChild(navClose);}
    if(!document.querySelector('script[data-hsm-school-vocab-polish]')){var polish=document.createElement('script');polish.src=asset('./school-vocab-student-polish.js');polish.defer=true;polish.dataset.hsmSchoolVocabPolish='1';document.head.appendChild(polish);}
    if(!document.querySelector('script[data-hsm-school-vocab-custom-icon]')){var customIcon=document.createElement('script');customIcon.src=asset('./school-vocab-custom-icon.js');customIcon.defer=true;customIcon.dataset.hsmSchoolVocabCustomIcon='1';document.head.appendChild(customIcon);}
    if(!document.querySelector('script[data-hsm-learning-shortcut-stable]')){var stable=document.createElement('script');stable.src=asset('./learning-shortcut-stable-layout.js');stable.defer=true;stable.dataset.hsmLearningShortcutStable='1';document.head.appendChild(stable);}
    if(!document.querySelector('script[data-hsm-school-vocab-status]')){var status=document.createElement('script');status.src=asset('./school-vocab-shortcut-status.js');status.defer=true;status.dataset.hsmSchoolVocabStatus='1';document.head.appendChild(status);}
    if(!document.querySelector('script[data-hsm-word-cover]')){var cover=document.createElement('script');cover.src=asset('./word-cover.js');cover.defer=true;cover.dataset.hsmWordCover='1';document.head.appendChild(cover);}
  }
})();
