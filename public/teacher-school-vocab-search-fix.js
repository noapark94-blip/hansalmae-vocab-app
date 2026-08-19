(function fixSchoolVocabStudentSearch(){
  'use strict';
  if(window.__HSM_SV_SEARCH_FIX__) return;
  window.__HSM_SV_SEARCH_FIX__=true;

  var style=document.createElement('style');
  style.id='hsmSvSearchFixStyle';
  style.textContent='#hsmSvStudents .hsm-sv-student.hsm-sv-filter-hidden{display:none!important;}';
  document.head.appendChild(style);

  function applyFilter(input){
    var panel=input&&input.closest('#hsmSchoolVocabTeacherPanel');
    if(!panel) return;
    var q=String(input.value||'').trim().toLowerCase();
    panel.querySelectorAll('#hsmSvStudents .hsm-sv-student').forEach(function(row){
      var text=String(row.textContent||'').toLowerCase();
      row.classList.toggle('hsm-sv-filter-hidden',Boolean(q)&&text.indexOf(q)===-1);
    });
  }

  document.addEventListener('input',function(event){
    if(event.target&&event.target.id==='hsmSvStudentSearch') applyFilter(event.target);
  },true);

  document.addEventListener('search',function(event){
    if(event.target&&event.target.id==='hsmSvStudentSearch') applyFilter(event.target);
  },true);
})();
