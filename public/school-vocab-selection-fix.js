(function(){
  'use strict';
  if(window.__HSM_SCHOOL_VOCAB_SELECTION_FIX__) return;
  window.__HSM_SCHOOL_VOCAB_SELECTION_FIX__=true;

  function addStyle(){
    if(document.getElementById('hsmSchoolSelectionFixStyle')) return;
    var s=document.createElement('style');
    s.id='hsmSchoolSelectionFixStyle';
    s.textContent=`
      #hsmSchoolStudentPage .hsm-school-selectbar{
        display:grid!important;
        grid-template-columns:auto auto minmax(0,1fr)!important;
        align-items:center!important;
        gap:8px!important;
        padding:10px 12px!important;
        margin:12px 0!important;
      }
      #hsmSchoolStudentPage .hsm-school-select-count{
        margin:0!important;
        min-width:62px!important;
        white-space:nowrap!important;
        color:#78636e!important;
        font-size:12px!important;
        font-weight:800!important;
      }
      #hsmSchoolStudentPage #hsmSchoolClearAll{display:none!important}
      #hsmSchoolStudentPage #hsmSchoolSelectAll{
        min-width:72px!important;
        white-space:nowrap!important;
      }
      #hsmSchoolStudentPage #hsmSchoolAddPersonal{
        justify-self:end!important;
        white-space:nowrap!important;
        min-width:0!important;
      }
      #hsmSchoolStudentPage .hsm-school-word-row{
        grid-template-columns:22px 34px minmax(0,.92fr) minmax(0,1.08fr)!important;
        column-gap:12px!important;
        row-gap:4px!important;
        align-items:center!important;
        padding:12px 14px!important;
      }
      #hsmSchoolStudentPage .hsm-school-word-num{
        text-align:center!important;
        line-height:1!important;
      }
      #hsmSchoolStudentPage .hsm-school-word-check{
        width:24px!important;
        height:24px!important;
        margin:0!important;
        justify-self:center!important;
        flex:0 0 24px!important;
      }
      #hsmSchoolStudentPage .hsm-school-word-eng,
      #hsmSchoolStudentPage .hsm-school-word-mean{
        min-width:0!important;
        line-height:1.45!important;
      }
      @media(max-width:600px){
        #hsmSchoolStudentPage .hsm-school-selectbar{
          grid-template-columns:auto auto minmax(0,1fr)!important;
          gap:7px!important;
          padding:9px 10px!important;
        }
        #hsmSchoolStudentPage .hsm-school-select-count{min-width:54px!important;font-size:11px!important}
        #hsmSchoolStudentPage .hsm-school-selectbar button{padding:9px 10px!important;font-size:11px!important}
        #hsmSchoolStudentPage #hsmSchoolSelectAll{min-width:68px!important}
        #hsmSchoolStudentPage .hsm-school-word-row{
          grid-template-columns:20px 34px minmax(0,.95fr) minmax(0,1.05fr)!important;
          column-gap:11px!important;
          padding:12px 11px!important;
        }
        #hsmSchoolStudentPage .hsm-school-word-check{width:24px!important;height:24px!important}
      }
      @media(max-width:390px){
        #hsmSchoolStudentPage .hsm-school-selectbar{
          grid-template-columns:auto auto!important;
        }
        #hsmSchoolStudentPage #hsmSchoolAddPersonal{
          grid-column:1 / -1!important;
          width:100%!important;
          justify-self:stretch!important;
        }
      }
    `;
    document.head.appendChild(s);
  }

  function pageBody(){
    var root=document.getElementById('hsmSchoolStudentPage');
    return root && !root.hidden ? root.querySelector('#hsmSchoolPageBody') : null;
  }

  function getChecks(){
    var b=pageBody();
    return b ? Array.from(b.querySelectorAll('.hsm-school-word-check')) : [];
  }

  function syncToolbar(){
    var b=pageBody();
    if(!b) return;
    var checks=getChecks();
    if(!checks.length) return;
    var selected=checks.filter(function(c){return c.checked;}).length;
    var count=b.querySelector('#hsmSchoolSelectedCount');
    if(count) count.textContent=selected+'개 선택';
    var toggle=b.querySelector('#hsmSchoolSelectAll');
    if(toggle){
      var all=selected===checks.length;
      toggle.textContent=all?'전체 해제':'전체 선택';
      toggle.setAttribute('aria-pressed',all?'true':'false');
    }
  }

  function installToggle(){
    var b=pageBody();
    if(!b) return;
    var old=b.querySelector('#hsmSchoolSelectAll');
    if(!old || old.dataset.hsmToggleFixed==='1') return;
    var btn=old.cloneNode(true);
    btn.dataset.hsmToggleFixed='1';
    old.replaceWith(btn);
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      var checks=getChecks();
      var all=checks.length>0 && checks.every(function(c){return c.checked;});
      checks.forEach(function(c){
        if(c.checked===!all) return;
        c.checked=!all;
        c.dispatchEvent(new Event('change',{bubbles:true}));
      });
      syncToolbar();
    });
  }

  function wordItemFromRow(row){
    var e=row.querySelector('.hsm-school-word-eng');
    var m=row.querySelector('.hsm-school-word-mean');
    return {
      rawSheetName:'학교 수행평가',
      sheetName:'학교 수행평가',
      day:0,
      word:e?e.textContent.trim():'',
      meaning:m?m.textContent.trim():'',
      example:'',
      translation:''
    };
  }

  function saveItems(items,button){
    if(!items.length){alert('나만의 단어장에 추가할 단어를 선택해주세요.');return;}
    if(!window.google || !google.script || !google.script.run){alert('저장 기능을 불러오지 못했습니다. 앱을 다시 열고 시도해주세요.');return;}
    button.disabled=true;
    var done=0,failed=0,lastError='';
    function finishOne(ok,error){
      done++;
      if(!ok){failed++;lastError=error&&error.message?error.message:String(error||'');}
      if(done<items.length) return;
      button.disabled=false;
      if(failed){alert((items.length-failed)+'개 저장 완료 · '+failed+'개 저장 실패'+(lastError?'\n'+lastError:''));}
      else alert(items.length+'개 단어를 나만의 단어장에 추가했습니다.');
      try{if(typeof window.loadPersonalVocabularyPreview==='function') window.loadPersonalVocabularyPreview();}catch(_){ }
    }
    items.forEach(function(item){
      try{
        google.script.run
          .withSuccessHandler(function(result){
            if(result && result.success===false) finishOne(false,new Error(result.message||'저장 실패'));
            else finishOne(true);
          })
          .withFailureHandler(function(error){finishOne(false,error);})
          .addPersonalVocabulary(window.currentLoginToken || (typeof currentLoginToken!=='undefined'?currentLoginToken:''),item);
      }catch(error){finishOne(false,error);}
    });
  }

  function installSave(){
    var b=pageBody();
    if(!b) return;
    var old=b.querySelector('#hsmSchoolAddPersonal');
    if(!old || old.dataset.hsmSaveFixed==='1') return;
    var btn=old.cloneNode(true);
    btn.dataset.hsmSaveFixed='1';
    old.replaceWith(btn);
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      var rows=[];
      getChecks().forEach(function(c){if(c.checked){var row=c.closest('.hsm-school-word-row');if(row)rows.push(row);}});
      saveItems(rows.map(wordItemFromRow).filter(function(x){return x.word&&x.meaning;}),btn);
    });
  }

  function bindChecks(){
    getChecks().forEach(function(c){
      if(c.dataset.hsmSyncBound==='1') return;
      c.dataset.hsmSyncBound='1';
      c.addEventListener('change',syncToolbar);
    });
  }

  function enhance(){
    addStyle();
    installToggle();
    installSave();
    bindChecks();
    syncToolbar();
  }

  var queued=false;
  function schedule(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(function(){queued=false;enhance();});
  }
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('change',schedule,true);
  document.addEventListener('click',schedule,true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule); else schedule();
})();