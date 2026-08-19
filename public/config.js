// 배포 전에 YOUR_PROJECT_REF를 Supabase 프로젝트 참조값으로 바꾸세요.
// 이 파일에는 service_role 키 또는 관리자 비밀번호를 넣지 마세요.
window.HANSALMAE_CONFIG = {
  apiUrl: "https://qlcgoqcuaenveargxcsa.supabase.co/functions/v1/api"
};

/*
 * iOS/PWA 뒤로가기 안정화
 *
 * 앱은 실제 페이지 이동이 아니라 한 문서 안에서 화면을 전환합니다.
 * 화면마다 history.pushState()를 쌓으면 iOS 가장자리 스와이프가
 * 앱 내부 스택과 브라우저 스택을 서로 다르게 소비해 빈 화면이나
 * 엉뚱한 이전 문서로 빠질 수 있습니다.
 *
 * 따라서 브라우저 history에는 같은 URL의 안전판 1개만 유지하고,
 * 스와이프(popstate)는 앱 내부 뒤로가기 한 단계로만 변환합니다.
 */
(function installHansalmaeStableBackNavigation(){
  if (window.__HSM_STABLE_BACK_NAV__) return;
  window.__HSM_STABLE_BACK_NAV__ = true;

  var installed = false;
  var handlingPopState = false;
  var guardInstalled = false;

  function isLoggedInAppVisible(){
    var mainApp = document.getElementById('mainApp');
    return Boolean(mainApp && !mainApp.classList.contains('hidden'));
  }

  function installHistoryGuard(){
    if (guardInstalled) return;
    guardInstalled = true;
    try {
      history.replaceState({hansalmaeGuardBase:true}, '', window.location.href);
      history.pushState({hansalmaeGuardTop:true}, '', window.location.href);
    } catch (error) {
      console.warn('한살매 뒤로가기 안전판 생성 실패', error);
    }
  }

  function restoreHistoryGuard(){
    try {
      history.pushState({hansalmaeGuardTop:true}, '', window.location.href);
    } catch (error) {
      console.warn('한살매 뒤로가기 안전판 복구 실패', error);
    }
  }

  function closeSchoolVocabularyPageIfOpen(){
    var page = document.getElementById('hsmSchoolStudentPage');
    if (!page || page.hidden || page.classList.contains('hidden')) return false;

    var back = page.querySelector('.hsm-school-back');
    if (back && typeof back.click === 'function') {
      back.click();
      return true;
    }

    page.hidden = true;
    page.classList.add('hidden');
    return true;
  }

  function install(){
    if (installed) return;
    if (typeof window.hsmGoBack_ !== 'function') {
      window.setTimeout(install, 100);
      return;
    }

    installed = true;
    installHistoryGuard();

    var originalGoBack = window.hsmGoBack_;

    /*
     * 화면의 일반 뒤로가기 버튼은 브라우저 history를 타지 않고
     * 기존 앱 내부 스택을 그대로 사용합니다.
     */
    window.hsmGoBack_ = function(){
      return originalGoBack.apply(this, arguments);
    };
    window.hsmGoBack_.__hsmStableBackWrapped = true;

    window.addEventListener('popstate', function(){
      if (handlingPopState) return;
      handlingPopState = true;

      try {
        /* 같은 URL의 안전판을 즉시 복구해 외부/빈 페이지 이탈 방지 */
        restoreHistoryGuard();

        if (!isLoggedInAppVisible()) return;

        /* 수행평가 전체화면이 열려 있으면 그것부터 닫기 */
        if (closeSchoolVocabularyPageIfOpen()) return;

        var stack = window.hsmBackStack_;
        if (Array.isArray(stack) && stack.length > 0) {
          originalGoBack();
        }
      } catch (error) {
        console.error('한살매 스와이프 뒤로가기 처리 실패', error);
        /* 오류가 나도 현재 앱 문서 밖으로 빠지지 않게 안전판 유지 */
        restoreHistoryGuard();
      } finally {
        handlingPopState = false;
      }
    });
  }

  if (document.readyState === 'complete') {
    window.setTimeout(install, 150);
  } else {
    window.addEventListener('load', function(){
      window.setTimeout(install, 150);
    }, {once:true});
  }
})();

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