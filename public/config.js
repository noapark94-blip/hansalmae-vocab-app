// 배포 전에 YOUR_PROJECT_REF를 Supabase 프로젝트 참조값으로 바꾸세요.
// 이 파일에는 service_role 키 또는 관리자 비밀번호를 넣지 마세요.
window.HANSALMAE_CONFIG = {
  apiUrl: "https://qlcgoqcuaenveargxcsa.supabase.co/functions/v1/api"
};

// iOS/PWA 스와이프 뒤로가기용 history/popstate 보정은 사용하지 않습니다.
// 앱 내부 이동은 각 화면의 뒤로가기 버튼과 기존 hsmGoBack_ 로직만 사용합니다.

(function loadHansalmaeSchoolVocabulary(){
  if(document.querySelector('script[data-hsm-school-vocab]'))return;
  var script=document.createElement('script');script.src='./school-vocab.js?v=2';script.defer=true;script.dataset.hsmSchoolVocab='1';document.head.appendChild(script);
  if(/teacher\.html/i.test(location.pathname)){
    if(!document.querySelector('script[data-hsm-school-vocab-ui]')){var ui=document.createElement('script');ui.src='./school-vocab-ui-patch.js?v=6';ui.defer=true;ui.dataset.hsmSchoolVocabUi='1';document.head.appendChild(ui);}
    if(!document.querySelector('script[data-hsm-school-vocab-search-fix]')){var searchFix=document.createElement('script');searchFix.src='./teacher-school-vocab-search-fix.js?v=1';searchFix.defer=true;searchFix.dataset.hsmSchoolVocabSearchFix='1';document.head.appendChild(searchFix);}
    if(!document.querySelector('script[data-hsm-school-vocab-tab-fix]')){var fix=document.createElement('script');fix.src='./teacher-school-vocab-tab-fix.js?v=1';fix.defer=true;fix.dataset.hsmSchoolVocabTabFix='1';document.head.appendChild(fix);}
    if(!document.querySelector('script[data-hsm-school-vocab-edit-fix]')){var editFix=document.createElement('script');editFix.src='./teacher-school-vocab-edit-fix.js?v=1';editFix.defer=true;editFix.dataset.hsmSchoolVocabEditFix='1';document.head.appendChild(editFix);}
  }else{
    if(!document.querySelector('script[data-hsm-school-vocab-student-page]')){var page=document.createElement('script');page.src='./school-vocab-student-page.js?v=1';page.defer=true;page.dataset.hsmSchoolVocabStudentPage='1';document.head.appendChild(page);}
    if(!document.querySelector('script[data-hsm-school-vocab-free-test-ui]')){var freeTestUi=document.createElement('script');freeTestUi.src='./school-vocab-free-test-ui.js?v=2';freeTestUi.defer=true;freeTestUi.dataset.hsmSchoolVocabFreeTestUi='1';document.head.appendChild(freeTestUi);}
    if(!document.querySelector('script[data-hsm-school-free-test-match]')){var freeTestMatch=document.createElement('script');freeTestMatch.src='./school-vocab-free-test-match.js?v=1';freeTestMatch.defer=true;freeTestMatch.dataset.hsmSchoolFreeTestMatch='1';document.head.appendChild(freeTestMatch);}
    if(!document.querySelector('script[data-hsm-school-vocab-selection-fix]')){var selectionFix=document.createElement('script');selectionFix.src='./school-vocab-selection-fix.js?v=2';selectionFix.defer=true;selectionFix.dataset.hsmSchoolVocabSelectionFix='1';document.head.appendChild(selectionFix);}
    if(!document.querySelector('script[data-hsm-school-vocab-nav-close]')){var navClose=document.createElement('script');navClose.src='./school-vocab-nav-close-fix.js?v=1';navClose.defer=true;navClose.dataset.hsmSchoolVocabNavClose='1';document.head.appendChild(navClose);}
    if(!document.querySelector('script[data-hsm-school-vocab-polish]')){var polish=document.createElement('script');polish.src='./school-vocab-student-polish.js?v=1';polish.defer=true;polish.dataset.hsmSchoolVocabPolish='1';document.head.appendChild(polish);}
    if(!document.querySelector('script[data-hsm-school-vocab-custom-icon]')){var customIcon=document.createElement('script');customIcon.src='./school-vocab-custom-icon.js?v=1';customIcon.defer=true;customIcon.dataset.hsmSchoolVocabCustomIcon='1';document.head.appendChild(customIcon);}
    if(!document.querySelector('script[data-hsm-learning-shortcut-stable]')){var stable=document.createElement('script');stable.src='./learning-shortcut-stable-layout.js?v=1';stable.defer=true;stable.dataset.hsmLearningShortcutStable='1';document.head.appendChild(stable);}
    if(!document.querySelector('script[data-hsm-school-vocab-status]')){var status=document.createElement('script');status.src='./school-vocab-shortcut-status.js?v=1';status.defer=true;status.dataset.hsmSchoolVocabStatus='1';document.head.appendChild(status);}
  }
})();