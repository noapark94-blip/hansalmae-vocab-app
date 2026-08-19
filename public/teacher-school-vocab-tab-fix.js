(function fixTeacherSchoolVocabTabConflict(){
  'use strict';
  if(window.__HSM_TEACHER_SCHOOL_VOCAB_TAB_FIX__) return;
  window.__HSM_TEACHER_SCHOOL_VOCAB_TAB_FIX__=true;

  // teacher.html은 DOMContentLoaded 시점에 모든 .tab-btn에 openTab(data-tab)을 연결한다.
  // 수행평가 탭은 동적으로 추가되어 data-tab이 없으므로 기존 핸들러까지 실행되면
  // openTab(undefined)가 방금 연 수행평가 패널을 다시 숨기는 충돌이 생긴다.
  document.addEventListener('click',function(event){
    var button=event.target&&event.target.closest&&event.target.closest('.tab-btn');
    if(!button||!/수행평가\s*단어장/.test(button.textContent||'')) return;
    var panel=document.getElementById('hsmSchoolVocabTeacherPanel');
    if(!panel) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');});
    document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('active');});
    button.classList.add('active');
    panel.classList.add('active');

    // school-vocab.js가 등록한 원래 탭 동작(데이터 로드 포함)을 직접 실행한다.
    if(typeof button.onclick==='function') button.onclick.call(button);
  },true);
})();
