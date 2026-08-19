(function fixTeacherSchoolVocabEdit(){
  'use strict';
  if(window.__HSM_TEACHER_SCHOOL_VOCAB_EDIT_FIX__) return;
  window.__HSM_TEACHER_SCHOOL_VOCAB_EDIT_FIX__=true;

  function apiUrl(){
    var base=window.HANSALMAE_CONFIG&&window.HANSALMAE_CONFIG.apiUrl;
    return String(base||'').replace(/\/api\/?$/,'/school-vocab');
  }
  function token(){return sessionStorage.getItem('hansalmaeTeacherToken')||'';}
  async function call(action,payload){
    var r=await fetch(apiUrl(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,token:token(),payload:payload||{}})});
    var j={};try{j=await r.json();}catch(_){ }
    if(!r.ok||!j.success) throw new Error(j&&j.message?j.message:'수행평가 단어장 요청에 실패했습니다.');
    return j.result;
  }
  function wordsToText(words){return (words||[]).map(function(w){return [w.word||'',w.meaning||'',w.example||'',w.translation||''].join('\t');}).join('\n');}
  function parseWords(text){return String(text||'').split(/\r?\n/).map(function(line){var raw=line.trim();if(!raw)return null;var cols=raw.indexOf('\t')>=0?raw.split('\t'):raw.split(',');cols=cols.map(function(x){return String(x||'').trim();});if(!cols[0]||!cols[1])return null;return{word:cols[0],meaning:cols[1],example:cols[2]||'',translation:cols[3]||''};}).filter(Boolean);}
  function panel(){return document.getElementById('hsmSchoolVocabTeacherPanel');}
  function setValue(id,value){var el=document.getElementById(id);if(el)el.value=value||'';}
  function setEditMode(bookId){
    var p=panel();if(!p)return;
    p.dataset.hsmEditingBookId=bookId||'';
    var save=document.getElementById('hsmSvSave');
    if(save) save.textContent=bookId?'수정사항 저장':'단어장 저장';
  }
  async function beginEdit(bookId){
    var p=panel();if(!p)return;
    try{
      var data=await call('teacherGetBook',{bookId:bookId});
      setEditMode(bookId);
      setValue('hsmSvTitle',data.title);
      setValue('hsmSvSchool',data.schoolName);
      setValue('hsmSvGrade',data.gradeLabel);
      setValue('hsmSvDescription',data.description);
      setValue('hsmSvWords',wordsToText(data.words||[]));
      var selected=new Set((data.students||[]).map(function(s){return String(s.studentId||'');}));
      p.querySelectorAll('input[data-hsm-sv-student]').forEach(function(input){input.checked=selected.has(String(input.getAttribute('data-hsm-sv-student')||''));});
      var title=document.getElementById('hsmSvTitle');
      if(title){title.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(function(){try{title.focus({preventScroll:true});}catch(_){title.focus();}},350);}
    }catch(e){alert(e.message);}
  }
  async function saveEdit(){
    var p=panel();if(!p)return;
    var bookId=p.dataset.hsmEditingBookId||'';if(!bookId)return;
    var save=document.getElementById('hsmSvSave');if(save)save.disabled=true;
    try{
      var result=await call('teacherSaveBook',{
        bookId:bookId,
        title:(document.getElementById('hsmSvTitle')||{}).value||'',
        schoolName:(document.getElementById('hsmSvSchool')||{}).value||'',
        gradeLabel:(document.getElementById('hsmSvGrade')||{}).value||'',
        description:(document.getElementById('hsmSvDescription')||{}).value||'',
        words:parseWords((document.getElementById('hsmSvWords')||{}).value||''),
        studentIds:Array.from(p.querySelectorAll('input[data-hsm-sv-student]:checked')).map(function(input){return input.getAttribute('data-hsm-sv-student');})
      });
      alert('수행평가 단어장을 수정했습니다.\n단어 '+Number(result.wordCount||0)+'개 · 학생 '+Number(result.studentCount||0)+'명');
      setEditMode('');
      var tab=Array.from(document.querySelectorAll('.tab-btn')).find(function(b){return /수행평가\s*단어장/.test(b.textContent||'');});
      if(tab) tab.click();
    }catch(e){alert(e.message);if(save)save.disabled=false;}
  }

  document.addEventListener('click',function(event){
    if(!/teacher\.html/i.test(location.pathname))return;
    var edit=event.target&&event.target.closest&&event.target.closest('[data-hsm-sv-edit]');
    if(edit){
      event.preventDefault();event.stopImmediatePropagation();
      beginEdit(edit.getAttribute('data-hsm-sv-edit'));
      return;
    }
    var save=event.target&&event.target.closest&&event.target.closest('#hsmSvSave');
    var p=panel();
    if(save&&p&&p.dataset.hsmEditingBookId){
      event.preventDefault();event.stopImmediatePropagation();
      saveEdit();
      return;
    }
    var fresh=event.target&&event.target.closest&&event.target.closest('#hsmSvNew');
    if(fresh&&p){setEditMode('');}
  },true);
})();
