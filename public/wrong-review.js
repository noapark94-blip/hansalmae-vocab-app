(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  let selectedScope=null, busy=false;
  const source=w=>String(w.rawSheetName||w.sheetName||'').trim();
  const call=(method,...args)=>new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[method](...args));
  function scopeWords(){return selectedScope===null?wrongNotebookWords.filter(w=>!w.mastered):wrongNotebookWords.filter(w=>selectedScope.includes(Number(w.rowNumber)));}
  window.getSelectedWrongTestWords=function(){
    const category=$('wrongTestSheetName').value;
    const seen=new Set();
    return scopeWords().filter(w=>category==='all'||source(w)===category).filter(w=>{
      const key=source(w)+'|'+w.day+'|'+w.word;if(seen.has(key))return false;seen.add(key);return true;
    }).map(w=>({...w,sheetName:source(w),exampleAnswer:w.word}));
  };
  window.getWrongTestQuestionLimit=function(){const words=getSelectedWrongTestWords();return $('wrongTestQuestionMode').value==='example'?words.filter(w=>w.example).length:words.length;};
  window.updateWrongTestAvailableCount=function(){
    const limit=getWrongTestQuestionLimit(),input=$('wrongTestQuestionCount');input.max=String(limit);
    if(!Number(input.value)||Number(input.value)>limit)input.value=Math.min(30,limit);
    $('wrongTestAvailableText').textContent=limit?'최대 '+limit+'문제 · 같은 단어는 한 번씩 출제돼요.':'이 범위에 출제 가능한 단어가 없어요.';
    const start=$('wrongTestSetupScreen').querySelector('.wrong-test-button-row button');start.disabled=busy||!limit;
    start.textContent=busy?'보기를 준비하고 있어요…':Number(input.value)===limit?'전체 '+limit+'개 시험 시작':input.value+'개 시험 시작';
    window.dispatchEvent(new Event('hsm:wrong-count'));
  };
  window.showWrongTestSetup=function(refreshOnly){
    if(refreshOnly!==true)selectedScope=null;
    const select=$('wrongTestSheetName'),previous=refreshOnly===true?select.value:'all',words=scopeWords();
    select.replaceChildren();
    const add=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o);};
    add('all',(selectedScope===null?'전체 오답':'선택한 단어')+' '+words.length+'개');
    const groups=new Map();words.forEach(w=>groups.set(source(w),(groups.get(source(w))||0)+1));
    groups.forEach((count,name)=>add(name||'unknown',name.replace(/DB$/,'')+' '+count+'개'));
    select.value=Array.from(select.options).some(o=>o.value===previous)?previous:'all';
    $('wrongNotebookScreen').classList.add('hidden');$('wrongTestSetupScreen').classList.remove('hidden');
    if(refreshOnly!==true)$('wrongTestQuestionCount').value=Math.min(30,getWrongTestQuestionLimit());
    updateWrongTestAvailableCount();if(refreshOnly!==true)window.scrollTo(0,0);
  };
  window.hsmTestSelectedWrong_=function(){const rows=getSelectedWrongRows_();if(!rows.length)return;selectedScope=rows.slice();$('wrongTestSheetName').value='all';$('wrongTestQuestionCount').value='30';showWrongTestSetup(true);window.scrollTo(0,0);};
  window.startWrongAnswerTest=async function(){
    if(busy)return;
    const token=currentLoginToken,words=getSelectedWrongTestWords(),mode=$('wrongTestQuestionMode').value,count=Number($('wrongTestQuestionCount').value),limit=getWrongTestQuestionLimit();
    if(!Number.isInteger(count)||count<1||count>limit){updateWrongTestAvailableCount();alert('문제 수는 1~'+limit+'개로 선택해주세요.');return;}
    busy=true;updateWrongTestAvailableCount();
    try{
      const names=[...new Set(words.map(w=>w.sheetName))];
      const pools=await Promise.all(names.map(async name=>{
        const data=await call('getWords',name,1,9999);
        if(!Array.isArray(data))throw Error('원래 단어장의 보기를 불러오지 못했습니다.');
        return data.map(w=>({...w,sheetName:name}));
      }));
      if(token!==currentLoginToken||$('wrongTestSetupScreen').classList.contains('hidden'))return;
      const distractors=pools.flat().concat(words);
      for(const w of words.filter(w=>mode!=='example'||w.example)){
        const pool=distractors.filter(p=>p.sheetName===w.sheetName);
        const fields=mode==='engToKor'?['meaning']:mode==='korToEng'?['word']:mode==='example'?['exampleAnswer']:['meaning','word'];
        if(fields.some(field=>new Set(pool.map(p=>String(p[field]||p.word||'').trim()).filter(Boolean)).size<4))throw Error(w.sheetName+'의 객관식 보기가 부족합니다.');
      }
      currentTestContext={source:'wrong',sheetName:names.length===1?names[0]:'전체 오답',startDay:Math.min(...words.map(w=>Number(w.day)||1)),endDay:Math.max(...words.map(w=>Number(w.day)||1)),questionMode:mode};
      createQuestions(words,{requestedCount:count,questionMode:mode,noRepeat:true,distractorWords:distractors});
    }catch(error){$('wrongTestAvailableText').textContent='시험 준비에 실패했어요. '+(error.message||error);}
    finally{busy=false;if(!$('wrongTestSetupScreen').classList.contains('hidden')){$('wrongTestSetupScreen').querySelector('.wrong-test-button-row button').disabled=false;$('wrongTestSetupScreen').querySelector('.wrong-test-button-row button').textContent='시험 시작';}}
  };
  function boot(){
    const screen=$('wrongNotebookScreen');
    $('wrongTestSetupScreen').querySelector('.wrong-test-guide').textContent='전체 오답을 섞어서 복습하거나, 필요한 종류만 골라보세요. 한 단어부터 시험 볼 수 있어요.';
    $('wrongTestSetupScreen').querySelector('label[for="wrongTestSheetName"]').textContent='출제 범위';
    $('wrongTestQuestionCount').addEventListener('input',updateWrongTestAvailableCount);
    const entry=screen.querySelector('.wrong-selection-entry');screen.querySelector('.wrong-note-header').appendChild(entry);
    $('wrongSelectionModeButton').onclick=()=>{if(wrongSelectionMode_)exitWrongSelectionMode_();else toggleWrongSelectionMode_();};
    $('wrongBulkToolbar').innerHTML='<div class="hsm-selection-line"><button type="button" id="wrongSelectAllButton">전체 선택</button><span><strong id="wrongSelectedCount">0</strong>개 선택</span><button type="button" id="hsmSelectionCancel">취소</button></div>';
    const dock=document.createElement('div');dock.id='hsmReviewDock';dock.className='hsm-review-dock';dock.hidden=true;
    dock.innerHTML='<button type="button" id="hsmSelectedExam">선택한 단어 시험보기</button><button type="button" id="hsmReviewMore" aria-label="선택한 단어 작업" aria-haspopup="dialog" aria-controls="hsmReviewActions">⋯</button>';
    document.body.appendChild(dock);
    const menu=document.createElement('dialog');menu.id='hsmReviewActions';menu.setAttribute('aria-labelledby','hsmReviewActionsTitle');
    menu.innerHTML='<div class="hsm-review-sheet-head"><h2 id="hsmReviewActionsTitle">선택한 단어</h2><button type="button" id="hsmReviewClose" aria-label="작업 메뉴 닫기">닫기</button></div><div class="hsm-review-menu"><button type="button" id="hsmSelectedSave">단어장에 저장</button><button type="button" id="hsmSelectedMaster">복습 완료</button><button type="button" id="wrongDeleteSelectedButton">삭제</button></div>';
    document.body.appendChild(menu);
    $('hsmSelectionCancel').onclick=exitWrongSelectionMode_;
    $('hsmReviewMore').onclick=()=>{if(getSelectedWrongRows_().length)menu.showModal();};
    $('hsmReviewClose').onclick=closeMenu;
    menu.addEventListener('click',e=>{if(e.target===menu){const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeMenu();}});
    menu.addEventListener('close',()=>{if(!dock.hidden)$('hsmReviewMore').focus();});
    function syncDock(){
      const show=wrongSelectionMode_&&getSelectedWrongRows_().length>0&&!screen.classList.contains('hidden')&&!$('mainApp')?.classList.contains('hidden');
      dock.hidden=!show;if(!show)closeMenu();
    }
    new MutationObserver(syncDock).observe(screen,{attributes:true,attributeFilter:['class']});
    if($('mainApp'))new MutationObserver(syncDock).observe($('mainApp'),{attributes:true,attributeFilter:['class']});
    $('wrongSelectAllButton').onclick=toggleSmartWrongSelectAll_;
    $('hsmSelectedExam').onclick=hsmTestSelectedWrong_;
    $('hsmSelectedSave').onclick=()=>{batchSaveCheckedWrongWords_();closeMenu();};
    $('wrongDeleteSelectedButton').onclick=()=>{deleteSelectedMasteredWrongWords_();closeMenu();};
    $('hsmSelectedMaster').onclick=async()=>{
      const rows=getSelectedWrongRows_();if(!rows.length)return;
      const token=currentLoginToken;const button=$('hsmSelectedMaster');button.disabled=true;
      try{for(const row of rows){const result=await call('setWrongWordMastered',token,row,wrongNotebookFilter!=='mastered');if(!result||!result.success)throw Error(result?.message||'상태 변경 실패');}if(token===currentLoginToken){exitWrongSelectionMode_();hsmRefreshWrongNotebookImmediately_();}}
      catch(error){alert(error.message||error);if(token===currentLoginToken)hsmRefreshWrongNotebookImmediately_();}finally{button.disabled=false;closeMenu();}
    };
    function closeMenu(){if(menu.open)menu.close();}
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
    const oldUpdate=window.updateWrongBulkToolbar_;
    window.updateWrongBulkToolbar_=function(){
      oldUpdate();const rows=getSelectedWrongRows_(),checks=[...screen.querySelectorAll('.wrong-batch-check')],all=checks.length&&checks.every(c=>c.checked);
      $('wrongSelectAllButton').disabled=!checks.length;$('wrongSelectAllButton').textContent=all?'전체 해제':'전체 선택';
      $('wrongSelectionModeButton').textContent='선택';
      $('wrongSelectionModeButton').hidden=wrongSelectionMode_;
      $('hsmSelectedExam').textContent=rows.length?rows.length+'개 시험보기':'단어를 선택해주세요';
      ['hsmSelectedExam','hsmSelectedSave','hsmSelectedMaster'].forEach(id=>$(id).disabled=!rows.length);
      $('hsmSelectedMaster').textContent=wrongNotebookFilter==='mastered'?'복습할 오답으로':'복습 완료';
      $('wrongDeleteSelectedButton').disabled=!rows.length||wrongNotebookFilter!=='mastered';
      screen.classList.toggle('hsm-selecting',wrongSelectionMode_);
      $('wrongDeleteSelectedButton').hidden=wrongNotebookFilter!=='mastered';
      $('hsmReviewActionsTitle').textContent='선택한 단어 '+rows.length+'개';
      syncDock();
    };
    const originalRender=window.renderWrongNotebook;
    window.renderWrongNotebook=function(){const rows=getSelectedWrongRows_();originalRender();screen.querySelectorAll('.wrong-batch-check').forEach(c=>{c.checked=rows.includes(Number(c.value));c.setAttribute('aria-label','단어 선택');});screen.querySelectorAll('.wrong-note-item').forEach(card=>{const example=card.querySelector('.wrong-note-example'),translation=card.querySelector('.wrong-note-translation');if(example||translation){const details=document.createElement('details');details.className='hsm-review-example';const summary=document.createElement('summary');summary.textContent='예문 보기';details.appendChild(summary);(example||translation).before(details);if(example)details.appendChild(example);if(translation)details.appendChild(translation);}});updateWrongBulkToolbar_();};
    updateWrongBulkToolbar_();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
