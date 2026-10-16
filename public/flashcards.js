(function(){
'use strict';
const $=id=>document.getElementById(id),PREFIX='hsmFlashcards:v1:';
let dialog,session,account='',phase='setup',revealed=false,history=[],fresh,returnFocus,quiz,index=0,correct=0,missed=[],locked=false,saveFailed=false,previousPhase='study',advanceTimer=0,lastProgress=0;
const owner=()=>typeof currentStudent!=='undefined'&&currentStudent?.studentId&&typeof currentLoginToken!=='undefined'&&currentLoginToken?String(currentStudent.studentId):'';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function normalize(words){const seen=new Set();return words.filter(w=>w&&String(w.word||'').trim()&&String(w.meaning||'').trim()).map(w=>({word:String(w.word).trim(),meaning:String(w.meaning).trim()})).filter(w=>{const k=JSON.stringify([w.word,w.meaning]);if(seen.has(k))return false;seen.add(k);return true;});}
function read(){try{const s=JSON.parse(localStorage.getItem(PREFIX+owner()));if(!s||s.v!==1||!Array.isArray(s.words)||!s.words.length||!s.words.every(w=>w&&typeof w.word==='string'&&typeof w.meaning==='string')||!Array.isArray(s.queue)||new Set(s.queue).size!==s.queue.length||!s.queue.every(i=>Number.isInteger(i)&&i>=0&&i<s.words.length)||!['eng','kor'].includes(s.direction))return null;return s;}catch(_){return null;}}
function save(){if(!session||account!==owner())return;try{localStorage.setItem(PREFIX+account,JSON.stringify(session));saveFailed=false;}catch(_){saveFailed=true;}}
function stopAudio(){window.speechSynthesis?.cancel();}
function showAnswer(show){
 if(phase!=='study'||!dialog?.open)return;
 if(account!==owner()){dialog.close();return;}
 revealed=show;const card=dialog.querySelector('.fc-card');if(!card)return;
 card.classList.toggle('is-revealed',show);card.setAttribute('aria-pressed',String(show));
 card.querySelector('.fc-front').hidden=show;card.querySelector('.fc-answer').hidden=!show;
 const speaker=dialog.querySelector('[data-fc=speak]');if(speaker&&session.direction==='kor')speaker.hidden=!show;
}
function requestExit(){clearTimeout(advanceTimer);showAnswer(false);stopAudio();if(phase==='exit')return;if(!session){dialog.close();return;}save();previousPhase=phase;phase='exit';render();}
function ensure(){if(dialog)return;dialog=document.createElement('dialog');dialog.id='hsmFlashcards';dialog.setAttribute('aria-labelledby','fcTitle');document.body.append(dialog);
 dialog.addEventListener('close',()=>{clearTimeout(advanceTimer);stopAudio();history=[];session=null;sync();if(returnFocus?.isConnected)returnFocus.focus();});
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(phase==='exit'){phase=previousPhase;render();}else requestExit();});
 dialog.addEventListener('click',handle);
 dialog.addEventListener('pointerdown',e=>{const card=e.target.closest('[data-fc=reveal]');if(!card||e.button!==0||e.isPrimary===false)return;card.setPointerCapture?.(e.pointerId);showAnswer(true);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])dialog.addEventListener(event,()=>showAnswer(false));
 dialog.addEventListener('contextmenu',e=>{if(e.target.closest('.fc-card'))e.preventDefault();});
 dialog.addEventListener('keydown',e=>{if(e.target.closest('[data-fc=reveal]')&&['Space','Enter'].includes(e.code)){e.preventDefault();showAnswer(true);}});
 dialog.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code))showAnswer(false);});
 dialog.addEventListener('focusout',e=>{if(e.target.matches('[data-fc=reveal]'))showAnswer(false);});window.addEventListener('blur',()=>showAnswer(false));document.addEventListener('visibilitychange',()=>{if(document.hidden)showAnswer(false);});
}
function button(label,action,cls='',extra=''){return '<button type="button" data-fc="'+action+'" data-hsm-icon-ready="1" class="'+cls+'" '+extra+'>'+label+'</button>';}
function shell(body,footer=''){dialog.dataset.phase=phase;dialog.innerHTML='<header class="fc-head"><div><h2 id="fcTitle" data-hsm-icon-ready="1">'+(phase==='quiz'?'확인 시험':phase==='result'?'시험 결과':'암기 카드')+'</h2>'+(phase==='study'?'<p class="fc-header-source">'+esc(session.label)+'</p>':'')+'</div>'+button('종료','close','fc-close','aria-label="암기 종료"')+'</header><main class="fc-main" tabindex="-1">'+body+'</main><footer class="fc-footer">'+footer+'</footer>';if(dialog.open)dialog.querySelector('.fc-main').focus({preventScroll:true});}
function render(){
 if(account!==owner()){dialog.close();return;}
 const notice=saveFailed?'저장 공간이 부족해 이어 하기를 저장하지 못했어요.':'진행 상황은 이 기기에 자동 저장돼요.';
 if(phase==='exit'){shell('<div class="fc-exit"><h3>암기를 종료할까요?</h3><p>'+(saveFailed?'진행 상황을 저장하지 못했어요. 종료하면 이번 진행을 잃을 수 있어요.':'지금까지의 진행 상황은 이 기기에 저장돼요.')+'</p></div>','<div class="fc-decisions">'+button('계속 학습','continue','fc-secondary')+button(saveFailed?'저장 다시 시도':'저장하고 종료','exit','fc-primary')+'</div>');return;}
 if(phase==='setup'){
 const old=read();shell((old?.queue.length?'<section class="fc-resume"><div><strong>이전 학습 이어하기</strong><p>'+esc(old.label)+' · '+old.queue.length+'개 남음</p></div>'+button('이어서','resume','fc-secondary')+'</section>':'')+(fresh?.words.length?'<section class="fc-panel"><p class="fc-kicker">학습 설정</p><h3 data-hsm-icon-ready="1">'+esc(fresh.label)+'</h3><p class="fc-selected-count">선택한 단어 <strong>'+fresh.words.length+'개</strong></p><fieldset class="fc-direction"><legend>학습 방향</legend><div class="fc-segments"><label><input type="radio" name="fcDirection" value="eng" checked><span>영어 → 뜻</span></label><label><input type="radio" name="fcDirection" value="kor"><span>뜻 → 영어</span></label></div></fieldset><label class="fc-switch-row"><span>순서 섞기</span><input type="checkbox" role="switch" id="fcShuffle" checked><span class="fc-switch" aria-hidden="true"></span></label><div class="fc-panel-actions">'+button(old?.queue.length?'새로 시작':'암기 시작','start','fc-primary')+'<p class="fc-note">'+(old?.queue.length?'새로 시작하면 이전 학습을 대체해요.':'선택한 단어를 한 장씩 확인해요.')+'</p></div></section>':'<p class="fc-empty">단어장에서 외울 단어를 선택해주세요.</p>'));return;
 }
 if(phase==='study'){
 if(!session.queue.length){phase='done';render();return;}
 const w=session.words[session.queue[0]],done=session.words.length-session.queue.length;
 const percent=done/session.words.length*100,from=lastProgress;lastProgress=percent;
 const speaker='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>';
 const undo='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/></svg>';
 shell('<div class="fc-study-progress"><span>암기 완료 <strong>'+done+' <span>/ '+session.words.length+'</span></strong></span><div class="fc-study-track" role="progressbar" aria-label="암기 진행" aria-valuemin="0" aria-valuemax="'+session.words.length+'" aria-valuenow="'+done+'"><span style="width:'+percent+'%;--fc-from:'+from+'%"></span></div></div><div class="fc-card-wrap"><button type="button" data-fc="reveal" data-hsm-icon-ready="1" class="fc-card" aria-label="누르고 있는 동안 '+(session.direction==='eng'?'뜻':'영어')+' 보기" aria-pressed="false"><strong class="fc-front">'+esc(session.direction==='eng'?w.word:w.meaning)+'</strong><strong class="fc-answer" hidden>'+esc(session.direction==='eng'?w.meaning:w.word)+'</strong><span class="fc-tap">꾹 눌러 '+(session.direction==='eng'?'뜻':'영어')+' 확인</span></button>'+button(speaker,'speak','fc-card-audio','aria-label="발음 듣기" title="발음 듣기" '+(!window.speechSynthesis?'disabled ':'')+(session.direction==='kor'?'hidden':''))+'</div><div class="fc-study-meta">'+button(undo+'<span>되돌리기</span>','undo','fc-study-undo',!history.length?'disabled':'')+'<span class="fc-save-state" '+(saveFailed?'role="status"':'title="진행 상황은 이 기기에 자동 저장돼요."')+'>'+(saveFailed?notice:'자동 저장')+'</span></div>','<div class="fc-decisions">'+button('아직 몰라요','again','fc-again')+button('외웠어요','known','fc-primary')+'</div>');return;
 }
 if(phase==='done'){const canQuiz=new Set(session.words.map(w=>session.direction==='eng'?w.meaning:w.word)).size>=2;shell('<section class="fc-panel fc-outcome"><div class="fc-panel-top"><p class="fc-kicker">암기 완료</p><span class="fc-status-dot">완료</span></div><h3 data-hsm-icon-ready="1">'+esc(session.label)+'</h3><div class="fc-metric"><strong>'+session.words.length+'</strong><span>개 단어</span></div><div class="fc-meter" aria-label="암기 완료"><span style="width:100%"></span></div><div class="fc-panel-actions">'+button('확인 시험','quiz','fc-primary',canQuiz?'':'disabled')+'<div class="fc-secondary-actions">'+button('다시 암기','restart','fc-secondary')+button('단어장','close','fc-secondary')+'</div><p class="fc-note">'+(canQuiz?'확인 시험은 점수·경험치에 반영되지 않아요.':'서로 다른 답이 2개 이상 있어야 시험을 볼 수 있어요.')+'</p></div></section>'+button('마지막 선택 되돌리기','undo','fc-undo-link',history.length?'':'disabled'));return;}
 if(phase==='quiz'){const q=quiz[index];shell('<section class="fc-exam"><div class="question-info">'+(index+1)+' / '+quiz.length+'</div><div class="progress-wrap" role="progressbar" aria-label="확인 시험 진행" aria-valuemin="0" aria-valuemax="'+quiz.length+'" aria-valuenow="'+index+'"><div class="progress-bar" style="width:'+index/quiz.length*100+'%"></div></div><span class="question-type">'+(session.direction==='eng'?'영어 → 한글':'한글 → 영어')+'</span><div class="question fc-quiz-prompt">'+esc(q.prompt)+'</div><div class="fc-options">'+q.options.map((a,i)=>button(esc(a),'answer','choice', 'data-choice="'+i+'"')).join('')+'</div><div class="feedback" id="fcFeedback" role="status"></div></section>',button(index+1===quiz.length?'결과 보기':'다음','next','fc-primary','hidden'));if(locked)paintAnswer();return;}
 shell('<section class="fc-panel fc-outcome"><div class="fc-panel-top"><p class="fc-kicker">시험 결과</p><span class="fc-status-dot">완료</span></div><h3 data-hsm-icon-ready="1">'+esc(session.label)+'</h3><div class="fc-metric" aria-label="'+quiz.length+'개 중 '+correct+'개 정답"><strong>'+correct+'</strong><span>/ '+quiz.length+' 정답</span></div><div class="fc-meter" aria-hidden="true"><span style="width:'+correct/quiz.length*100+'%"></span></div><div class="fc-result-stats"><span>정답 <b>'+correct+'</b></span><span>오답 <b>'+missed.length+'</b></span><span>정답률 <b>'+Math.round(correct/quiz.length*100)+'%</b></span></div><div class="fc-panel-actions">'+(missed.length?button('오답 '+missed.length+'개 다시 암기','retry','fc-primary'):'')+button('단어장으로','close',missed.length?'fc-secondary':'fc-primary')+'</div></section>');
}
function advance(){clearTimeout(advanceTimer);if(!dialog.open||phase!=='quiz'||!locked)return;if(account!==owner()){dialog.close();return;}index++;locked=false;if(index===quiz.length)phase='result';render();}
function paintAnswer(){const q=quiz[index];clearTimeout(advanceTimer);dialog.querySelectorAll('[data-choice]').forEach(el=>{el.disabled=true;const choice=Number(el.dataset.choice);el.classList.toggle('correct',q.valid.includes(q.options[choice]));el.classList.toggle('wrong',choice===q.selected&&!q.ok);});$('fcFeedback').textContent=q.ok?'정답':'정답: '+q.right;dialog.querySelector('[data-fc=next]').hidden=q.ok;if(q.ok)advanceTimer=setTimeout(advance,600);

}
function open(words,label){if(!owner())return;ensure();if(dialog.open)return;account=owner();fresh={words:normalize(words||[]),label:label||'선택한 단어'};returnFocus=document.activeElement;phase='setup';lastProgress=0;saveFailed=false;render();dialog.showModal();}
function begin(words,label,direction,mix){lastProgress=0;session={v:1,words,label,direction,queue:words.map((_,i)=>i)};if(mix)session.queue=shuffle(session.queue);history=[];phase='study';revealed=false;save();render();}
function handle(e){const b=e.target.closest('[data-fc]');if(!b||b.disabled)return;if(account!==owner()){dialog.close();return;}const a=b.dataset.fc;
 if(a==='close'){requestExit();return;}if(a==='continue'){phase=previousPhase;render();return;}if(a==='exit'){save();if(saveFailed){render();return;}dialog.close();return;}if(a==='start'){begin(fresh.words,fresh.label,dialog.querySelector('[name=fcDirection]:checked').value,$('fcShuffle').checked);return;}
 if(a==='resume'){session=read();if(!session)return;history=[];revealed=false;phase='study';render();return;}
 if(a==='reveal'&&phase==='study'){/* Holding, rather than clicking, reveals the answer. */return;}
 if((a==='known'||a==='again')&&phase==='study'){stopAudio();history.push(session.queue.slice());if(history.length>50)history.shift();const id=session.queue.shift();if(a==='again')session.queue.push(id);revealed=false;save();render();return;}
 if(a==='undo'&&history.length){stopAudio();session.queue=history.pop();phase='study';revealed=false;save();render();return;}
 if(a==='restart'){begin(session.words,session.label,session.direction,true);return;}
 if(a==='speak'&&phase==='study'&&window.speechSynthesis){stopAudio();const u=new SpeechSynthesisUtterance(session.words[session.queue[0]].word);u.lang='en-US';u.rate=.85;window.speechSynthesis.speak(u);return;}
 if(a==='quiz'){stopAudio();const words=session.words,answer=w=>session.direction==='eng'?w.meaning:w.word;quiz=shuffle(words).map(w=>{const right=answer(w),others=shuffle([...new Set(words.map(answer))].filter(x=>x!==right)).slice(0,3);return {word:w,prompt:session.direction==='eng'?w.word:w.meaning,right,valid:words.filter(x=>(session.direction==='eng'?x.word:x.meaning)===(session.direction==='eng'?w.word:w.meaning)).map(answer),options:shuffle([right,...others])};});index=0;correct=0;missed=[];locked=false;phase='quiz';render();return;}
 if(a==='answer'&&phase==='quiz'&&!locked){locked=true;const q=quiz[index];q.selected=Number(b.dataset.choice);q.ok=q.valid.includes(q.options[q.selected]);if(q.ok)correct++;else missed.push(q.word);paintAnswer();return;}
 if(a==='next'&&phase==='quiz'&&locked){advance();return;}
 if(a==='retry')begin(missed,session.label+' · 확인 시험 오답',session.direction,true);
}
function selected(kind){
 if(kind==='vocab')return {words:getCheckedWords(),label:$('vocabSheetName').selectedOptions[0]?.textContent+' · Day '+$('vocabDay').value};
 if(kind==='personal'){const rows=getSelectedPersonalRows_();return {words:personalVocabularyWords.filter(w=>rows.includes(Number(w.rowNumber))),label:personalVocabularyBooks.find(b=>String(b.bookId)===String(selectedPersonalBookId))?.bookName||'나만의 단어장'};}
 if(kind==='wrong'){const rows=getSelectedWrongRows_();return {words:wrongNotebookWords.filter(w=>rows.includes(Number(w.rowNumber))),label:'오답노트'};}
 const rows=[...document.querySelectorAll('#hsmSchoolPageBody .hsm-school-word-row')].filter(r=>r.querySelector('.hsm-school-word-check')?.checked);return {words:rows.map(r=>({word:r.querySelector('.hsm-school-word-eng')?.textContent,meaning:r.querySelector('.hsm-school-word-mean')?.textContent})),label:'내신 단어장'};
}
function add(host,kind){if(!host||host.querySelector('[data-flashcards]'))return;const b=document.createElement('button');b.type='button';b.className='fc-entry';b.dataset.flashcards=kind;b.dataset.hsmIconReady='1';b.textContent=kind==='vocab'?'암기 시작':'선택 단어 암기';b.onclick=()=>{const s=selected(kind);if(!s.words.length){window.HSMDialog?.alert('암기할 단어를 먼저 선택해주세요.');return;}open(s.words,s.label);};host.append(b);}
function sync(){
 if(dialog?.open&&account!==owner())dialog.close();
 add(document.querySelector('#vocabScreen .vocab-actions'),'vocab');add($('personalTestButton')?.parentElement,'personal');add($('wrongBulkToolbar'),'wrong');add(document.querySelector('#hsmSchoolPageBody .hsm-school-selectbar'),'school');
 document.querySelectorAll('[data-flashcards]').forEach(b=>{try{const n=selected(b.dataset.flashcards).words.length;b.disabled=!n;b.hidden=!n;if(b.dataset.flashcards==='vocab'){const label=n+'개 단어 암기';if(b.textContent!==label)b.textContent=label;}}catch(_){b.hidden=true;}});
 const saved=read();
 for(const id of ['vocabScreen','personalVocabularyScreen','wrongNotebookScreen','hsmSchoolPageBody']){
  const host=$(id);if(!host)continue;let resume=host.querySelector(':scope > .fc-resume-entry');
  if(!resume){
   resume=document.createElement('div');resume.className='fc-resume-entry';
   resume.innerHTML='<div class="fc-resume-copy"><span class="fc-resume-caption">이전 암기</span><span class="fc-resume-detail"></span></div><button type="button" data-hsm-icon-ready="1">이어서 하기 <span aria-hidden="true">→</span></button>';
   resume.querySelector('button').onclick=()=>{open([],'');if(read()?.queue.length){session=read();history=[];revealed=false;phase='study';render();}};
   const anchor=id==='vocabScreen'?host.querySelector('#hsmVocabSelect'):id==='personalVocabularyScreen'?host.querySelector('#personalVocabularyList'):id==='wrongNotebookScreen'?host.querySelector('#wrongNotebookList'):host.querySelector('.hsm-school-word-list');
   if(anchor&&anchor.parentElement===host)host.insertBefore(resume,anchor);else if(id==='vocabScreen'&&$('vocabDay'))$('vocabDay').closest('.row')?.after(resume);else host.append(resume);
   if(!resume.isConnected)host.append(resume);
  }
  resume.hidden=!owner()||!saved?.queue.length;
  const label=(saved?.label||'선택한 단어')+' · 남은 단어 '+(saved?.queue.length||0)+'개';
  const detail=resume.querySelector('.fc-resume-detail');if(detail.textContent!==label)detail.textContent=label;

 }

}
function boot(){sync();let pending=false;const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sync();});};document.addEventListener('change',schedule);document.addEventListener('click',schedule);new MutationObserver(records=>{if(records.some(r=>!dialog?.contains(r.target)&&[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&!n.matches?.('[data-flashcards],.fc-resume-entry'))))schedule();}).observe(document.body,{childList:true,subtree:true});window.addEventListener('storage',schedule);const main=$('mainApp');if(main)new MutationObserver(schedule).observe(main,{attributes:true,attributeFilter:['class']});}
window.HSMFlashcards={open};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
