(function(){
  'use strict';
  if(window.__HSM_SCHOOL_VOCAB_SELECTION_FIX__) return;
  window.__HSM_SCHOOL_VOCAB_SELECTION_FIX__=true;

  function token(){
    try{return String(typeof currentLoginToken!=='undefined'?currentLoginToken:(window.currentLoginToken||''));}catch(_){return String(window.currentLoginToken||'');}
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(s){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s];});}
  function addStyle(){
    if(document.getElementById('hsmSchoolSelectionFixStyle')) return;
    var s=document.createElement('style');
    s.id='hsmSchoolSelectionFixStyle';
    s.textContent=`
      #hsmSchoolStudentPage .hsm-school-selectbar{display:grid!important;grid-template-columns:auto auto minmax(0,1fr)!important;align-items:center!important;gap:8px!important;padding:10px 12px!important;margin:12px 0!important}
      #hsmSchoolStudentPage .hsm-school-select-count{margin:0!important;min-width:62px!important;white-space:nowrap!important;color:#78636e!important;font-size:12px!important;font-weight:800!important}
      #hsmSchoolStudentPage #hsmSchoolClearAll{display:none!important}
      #hsmSchoolStudentPage #hsmSchoolSelectAll{min-width:72px!important;white-space:nowrap!important}
      #hsmSchoolStudentPage #hsmSchoolAddPersonal{justify-self:end!important;white-space:nowrap!important;min-width:0!important}
      #hsmSchoolStudentPage .hsm-school-word-row{grid-template-columns:22px 34px minmax(0,.92fr) minmax(0,1.08fr)!important;column-gap:12px!important;row-gap:4px!important;align-items:center!important;padding:12px 14px!important}
      #hsmSchoolStudentPage .hsm-school-word-num{text-align:center!important;line-height:1!important}
      #hsmSchoolStudentPage .hsm-school-word-check{width:24px!important;height:24px!important;margin:0!important;justify-self:center!important;flex:0 0 24px!important}
      #hsmSchoolStudentPage .hsm-school-word-eng,#hsmSchoolStudentPage .hsm-school-word-mean{min-width:0!important;line-height:1.45!important}
      #hsmSchoolPersonalPicker{position:fixed;inset:0;z-index:100060;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(35,22,31,.48);backdrop-filter:blur(4px)}
      #hsmSchoolPersonalPicker[hidden]{display:none!important}
      #hsmSchoolPersonalPicker .hsm-sp-panel{width:min(430px,100%);max-height:min(72vh,640px);overflow:auto;padding:20px;border:1px solid #eadce4;border-radius:24px;background:#fff;box-shadow:0 24px 70px rgba(58,22,43,.22)}
      #hsmSchoolPersonalPicker .hsm-sp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px}
      #hsmSchoolPersonalPicker .hsm-sp-title{font-size:20px;font-weight:900;color:#65103f;letter-spacing:-.03em}
      #hsmSchoolPersonalPicker .hsm-sp-close{width:auto!important;margin:0!important;padding:8px 11px!important;border-radius:11px!important;background:#f5eff3!important;color:#66545f!important;font-size:13px!important}
      #hsmSchoolPersonalPicker .hsm-sp-desc{margin:0 0 14px;color:#7a6872;font-size:13px;line-height:1.55}
      #hsmSchoolPersonalPicker .hsm-sp-list{display:grid;gap:9px}
      #hsmSchoolPersonalPicker .hsm-sp-book{width:100%!important;margin:0!important;padding:14px 15px!important;border:1px solid #ead9e2!important;border-radius:15px!important;background:#fff!important;color:#311d29!important;text-align:left!important;box-shadow:none!important}
      #hsmSchoolPersonalPicker .hsm-sp-book:active{transform:scale(.995);background:#fff5fa!important}
      #hsmSchoolPersonalPicker .hsm-sp-name{font-size:15px;font-weight:900;color:#7d1655}
      #hsmSchoolPersonalPicker .hsm-sp-meta{margin-top:4px;color:#8b7a84;font-size:12px;font-weight:650}
      #hsmSchoolPersonalPicker .hsm-sp-loading{padding:18px 8px;text-align:center;color:#8b7a84;font-size:13px}
      @media(max-width:600px){
        #hsmSchoolStudentPage .hsm-school-selectbar{grid-template-columns:auto auto minmax(0,1fr)!important;gap:7px!important;padding:9px 10px!important}
        #hsmSchoolStudentPage .hsm-school-select-count{min-width:54px!important;font-size:11px!important}
        #hsmSchoolStudentPage .hsm-school-selectbar button{padding:9px 10px!important;font-size:11px!important}
        #hsmSchoolStudentPage #hsmSchoolSelectAll{min-width:68px!important}
        #hsmSchoolStudentPage .hsm-school-word-row{grid-template-columns:20px 34px minmax(0,.95fr) minmax(0,1.05fr)!important;column-gap:11px!important;padding:12px 11px!important}
        #hsmSchoolStudentPage .hsm-school-word-check{width:24px!important;height:24px!important}
        #hsmSchoolPersonalPicker{align-items:flex-end;padding:12px}
        #hsmSchoolPersonalPicker .hsm-sp-panel{width:100%;max-height:74vh;border-radius:24px 24px 18px 18px;padding:18px}
      }
      @media(max-width:390px){#hsmSchoolStudentPage .hsm-school-selectbar{grid-template-columns:auto auto!important}#hsmSchoolStudentPage #hsmSchoolAddPersonal{grid-column:1/-1!important;width:100%!important;justify-self:stretch!important}}
    `;
    document.head.appendChild(s);
  }

  function pageBody(){var root=document.getElementById('hsmSchoolStudentPage');return root&&!root.hidden?root.querySelector('#hsmSchoolPageBody'):null;}
  function getChecks(){var b=pageBody();return b?Array.from(b.querySelectorAll('.hsm-school-word-check')):[];}
  function syncToolbar(){var b=pageBody();if(!b)return;var checks=getChecks();if(!checks.length)return;var selected=checks.filter(function(c){return c.checked;}).length;var count=b.querySelector('#hsmSchoolSelectedCount');if(count)count.textContent=selected+'개 선택';var toggle=b.querySelector('#hsmSchoolSelectAll');if(toggle){var all=selected===checks.length;toggle.textContent=all?'전체 해제':'전체 선택';toggle.setAttribute('aria-pressed',all?'true':'false');}}
  function installToggle(){var b=pageBody();if(!b)return;var old=b.querySelector('#hsmSchoolSelectAll');if(!old||old.dataset.hsmToggleFixed==='1')return;var btn=old.cloneNode(true);btn.dataset.hsmToggleFixed='1';old.replaceWith(btn);btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var checks=getChecks();var all=checks.length>0&&checks.every(function(c){return c.checked;});checks.forEach(function(c){if(c.checked===!all)return;c.checked=!all;c.dispatchEvent(new Event('change',{bubbles:true}));});syncToolbar();});}
  function wordItemFromRow(row){var e=row.querySelector('.hsm-school-word-eng'),m=row.querySelector('.hsm-school-word-mean');return{rawSheetName:'학교 수행평가 단어장',sheetName:'학교 수행평가 단어장',day:0,word:e?e.textContent.trim():'',meaning:m?m.textContent.trim():'',example:'',translation:''};}
  function normalizeWord(v){return String(v||'').trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');}

  function ensurePicker(){
    var modal=document.getElementById('hsmSchoolPersonalPicker');
    if(modal)return modal;
    modal=document.createElement('div');modal.id='hsmSchoolPersonalPicker';modal.hidden=true;
    modal.innerHTML='<div class="hsm-sp-panel" role="dialog" aria-modal="true" aria-label="저장할 나만의 단어장 선택"><div class="hsm-sp-head"><div class="hsm-sp-title">저장할 단어장 선택</div><button type="button" class="hsm-sp-close">닫기</button></div><div class="hsm-sp-desc"></div><div class="hsm-sp-list"></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('.hsm-sp-close').onclick=function(){modal.hidden=true;};
    modal.addEventListener('click',function(e){if(e.target===modal)modal.hidden=true;});
    return modal;
  }

  function saveToBook(book,items,sourceButton,modal){
    var t=token();if(!t){alert('로그인 정보를 확인하지 못했습니다. 앱을 다시 열어주세요.');return;}
    sourceButton.disabled=true;
    var list=modal.querySelector('.hsm-sp-list');list.innerHTML='<div class="hsm-sp-loading">중복 단어를 확인하는 중입니다.</div>';
    google.script.run
      .withSuccessHandler(function(result){
        var existing=(result&&result.words)||[];
        var seen=new Set(existing.map(function(x){return normalizeWord(x.word);}));
        var addedKeys=new Set();
        var fresh=items.filter(function(item){var k=normalizeWord(item.word);if(!k||seen.has(k)||addedKeys.has(k))return false;addedKeys.add(k);return true;});
        var skipped=items.length-fresh.length;
        if(!fresh.length){sourceButton.disabled=false;modal.hidden=true;alert('선택한 단어는 이미 「'+(book.bookName||'선택한 단어장')+'」에 모두 저장되어 있습니다.\n중복 단어 '+skipped+'개는 추가하지 않았습니다.');return;}
        list.innerHTML='<div class="hsm-sp-loading">'+fresh.length+'개 단어를 저장하는 중입니다.</div>';
        google.script.run
          .withSuccessHandler(function(saveResult){sourceButton.disabled=false;modal.hidden=true;var saved=Number(saveResult&&saveResult.savedCount);if(!Number.isFinite(saved))saved=fresh.length;var duplicate=skipped+Number(saveResult&&saveResult.duplicateCount||0);alert('「'+(book.bookName||'선택한 단어장')+'」에 '+saved+'개를 추가했습니다.'+(duplicate?'\n중복 단어 '+duplicate+'개는 제외했습니다.':''));try{if(typeof loadPersonalVocabularyPreview==='function')loadPersonalVocabularyPreview();}catch(_){ }})
          .withFailureHandler(function(error){sourceButton.disabled=false;modal.hidden=true;alert('단어 저장 중 오류가 발생했습니다.\n'+(error&&error.message?error.message:error));})
          .addPersonalVocabularyBatchToBook(t,book.bookId,fresh);
      })
      .withFailureHandler(function(error){sourceButton.disabled=false;modal.hidden=true;alert('단어장 내용을 확인하지 못했습니다.\n'+(error&&error.message?error.message:error));})
      .getPersonalVocabularyByBook(t,book.bookId);
  }

  function openBookPicker(items,button){
    if(!items.length){alert('나만의 단어장에 추가할 단어를 선택해주세요.');return;}
    if(!window.google||!google.script||!google.script.run){alert('저장 기능을 불러오지 못했습니다. 앱을 다시 열고 시도해주세요.');return;}
    var t=token();if(!t){alert('로그인 정보를 확인하지 못했습니다. 앱을 다시 열어주세요.');return;}
    var modal=ensurePicker(),list=modal.querySelector('.hsm-sp-list'),desc=modal.querySelector('.hsm-sp-desc');
    desc.textContent=items.length+'개 단어를 저장할 나만의 단어장을 선택하세요. 같은 영어 단어는 자동으로 제외됩니다.';
    list.innerHTML='<div class="hsm-sp-loading">단어장 목록을 불러오는 중입니다.</div>';modal.hidden=false;
    google.script.run
      .withSuccessHandler(function(result){
        var books=(result&&result.books)||[];
        if(!books.length){list.innerHTML='<div class="hsm-sp-loading">아직 만든 나만의 단어장이 없습니다.<br>나만의 단어장에서 먼저 단어장을 만들어주세요.</div>';return;}
        list.innerHTML='';books.forEach(function(book){var b=document.createElement('button');b.type='button';b.className='hsm-sp-book';b.innerHTML='<div class="hsm-sp-name">'+esc(book.bookName||'단어장')+'</div><div class="hsm-sp-meta">'+Number(book.wordCount||0)+'개 저장됨</div>';b.onclick=function(){saveToBook(book,items,button,modal);};list.appendChild(b);});
      })
      .withFailureHandler(function(error){modal.hidden=true;alert('나만의 단어장 목록을 불러오지 못했습니다.\n'+(error&&error.message?error.message:error));})
      .getVocabularyBooks(t);
  }

  function installSave(){var b=pageBody();if(!b)return;var old=b.querySelector('#hsmSchoolAddPersonal');if(!old||old.dataset.hsmSaveFixed==='2')return;var btn=old.cloneNode(true);btn.dataset.hsmSaveFixed='2';old.replaceWith(btn);btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var rows=[];getChecks().forEach(function(c){if(c.checked){var row=c.closest('.hsm-school-word-row');if(row)rows.push(row);}});openBookPicker(rows.map(wordItemFromRow).filter(function(x){return x.word&&x.meaning;}),btn);});}
  function bindChecks(){getChecks().forEach(function(c){if(c.dataset.hsmSyncBound==='1')return;c.dataset.hsmSyncBound='1';c.addEventListener('change',syncToolbar);});}
  function enhance(){addStyle();installToggle();installSave();bindChecks();syncToolbar();}
  var queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;enhance();});}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('change',schedule,true);document.addEventListener('click',schedule,true);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
})();