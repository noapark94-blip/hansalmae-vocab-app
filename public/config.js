// 배포 전에 YOUR_PROJECT_REF를 Supabase 프로젝트 참조값으로 바꾸세요.
// 이 파일에는 service_role 키 또는 관리자 비밀번호를 넣지 마세요.
window.HANSALMAE_CONFIG = {
  apiUrl: "https://qlcgoqcuaenveargxcsa.supabase.co/functions/v1/api"
};

// 모바일/PWA 브라우저의 뒤로가기 동작을 앱 내부 화면 이동과 연결합니다.
// index.html의 기존 hsmBackStack_ / hsmGoBack_ 로직은 그대로 사용합니다.
(function installHansalmaeNativeBackNavigation() {
  var installed = false;
  var handlingPopState = false;
  var navigationNames = ['showTestHome','showVocabHome','showMyPage','showAccountInformation_','showRankingHome','showWrongNotebook','showWrongTestSetup','showPersonalVocabulary','showPersonalTestSetup','showSmartReview','showTeacherExamHome','showStudentNotifications'];
  function isLoggedInAppVisible(){var mainApp=document.getElementById('mainApp');return Boolean(mainApp&&!mainApp.classList.contains('hidden'));}
  function visibleScreenId(){if(typeof window.hsmGetVisibleScreenId_==='function')return window.hsmGetVisibleScreenId_();return '';}
  function pushNavigationState(fromScreen,toScreen){if(handlingPopState||!isLoggedInAppVisible()||!fromScreen||!toScreen||fromScreen===toScreen)return;try{history.pushState({hansalmaeAppNavigation:true,screenId:toScreen,createdAt:Date.now()},'',window.location.href);}catch(error){console.warn('한살매 앱 뒤로가기 기록 생성 실패',error);}}
  function install(){if(installed)return;if(typeof window.hsmGoBack_!=='function'||typeof window.hsmGetVisibleScreenId_!=='function'){window.setTimeout(install,100);return;}installed=true;navigationNames.forEach(function(name){var original=window[name];if(typeof original!=='function'||original.__hsmNativeBackWrapped)return;var wrapped=function(){var fromScreen=visibleScreenId();var result=original.apply(this,arguments);window.setTimeout(function(){pushNavigationState(fromScreen,visibleScreenId());},0);return result;};Object.keys(original).forEach(function(key){try{wrapped[key]=original[key];}catch(_){}});wrapped.__hsmNativeBackWrapped=true;window[name]=wrapped;});var originalGoBack=window.hsmGoBack_;window.hsmGoBack_=function(){var stack=window.hsmBackStack_;var hasInternalBack=Array.isArray(stack)&&stack.length>0;if(!handlingPopState&&hasInternalBack&&history.state&&history.state.hansalmaeAppNavigation===true){history.back();return;}return originalGoBack.apply(this,arguments);};window.addEventListener('popstate',function(){var stack=window.hsmBackStack_;if(!Array.isArray(stack)||stack.length<1||!isLoggedInAppVisible())return;handlingPopState=true;try{originalGoBack();}finally{handlingPopState=false;}});}
  if(document.readyState==='complete')window.setTimeout(install,150);else window.addEventListener('load',function(){window.setTimeout(install,150);},{once:true});
})();

(function loadLearningShortcutPcFix(){
  if(document.querySelector('link[data-hsm-learning-shortcut-fix]')) return;
  var link=document.createElement('link');link.rel='stylesheet';link.href='./learning-shortcut-pc-fix.css?v=1';link.dataset.hsmLearningShortcutFix='1';document.head.appendChild(link);
})();

(function loadHansalmaeSchoolVocabulary(){
  if(document.querySelector('script[data-hsm-school-vocab]'))return;
  var script=document.createElement('script');script.src='./school-vocab.js?v=2';script.defer=true;script.dataset.hsmSchoolVocab='1';document.head.appendChild(script);
  if(!document.querySelector('script[data-hsm-school-vocab-ui]')){var ui=document.createElement('script');ui.src='./school-vocab-ui-patch.js?v=5';ui.defer=true;ui.dataset.hsmSchoolVocabUi='1';document.head.appendChild(ui);}
  if(!document.querySelector('script[data-hsm-school-vocab-icon]')){var icon=document.createElement('script');icon.src='./school-vocab-icon-patch.js?v=1';icon.defer=true;icon.dataset.hsmSchoolVocabIcon='1';document.head.appendChild(icon);}
  if(/teacher\.html/i.test(location.pathname)&&!document.querySelector('script[data-hsm-school-vocab-tab-fix]')){var fix=document.createElement('script');fix.src='./teacher-school-vocab-tab-fix.js?v=1';fix.defer=true;fix.dataset.hsmSchoolVocabTabFix='1';document.head.appendChild(fix);}
})();
