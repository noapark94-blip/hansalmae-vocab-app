(function(){
'use strict';
const $=id=>document.getElementById(id),PREFIX='hsmFlashcards:v1:';
let dialog,session,account='',phase='setup',revealed=false,history=[],fresh,returnFocus,quiz,index=0,correct=0,missed=[],locked=false,saveFailed=false;
const owner=()=>typeof currentStudent!=='undefined'&&currentStudent?.studentId&&typeof currentLoginToken!=='undefined'&&currentLoginToken?String(currentStudent.studentId):'';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function normalize(words){const seen=new Set();return words.filter(w=>w&&String(w.word||'').trim()&&String(w.meaning||'').trim()).map(w=>({word:String(w.word).trim(),meaning:String(w.meaning).trim()})).filter(w=>{const k=JSON.stringify([w.word,w.meaning]);if(seen.has(k))return false;seen.add(k);return true;});}
function read(){try{const s=JSON.parse(localStorage.getItem(PREFIX+owner()));if(!s||s.v!==1||!Array.isArray(s.words)||!s.words.length||!s.words.every(w=>w&&typeof w.word==='string'&&typeof w.meaning==='string')||!Array.isArray(s.queue)||new Set(s.queue).size!==s.queue.length||!s.queue.every(i=>Number.isInteger(i)&&i>=0&&i<s.words.length)||!['eng','kor'].includes(s.direction))return null;return s;}catch(_){return null;}}
function save(){if(!session||account!==owner())return;try{localStorage.setItem(PREFIX+account,JSON.stringify(session));saveFailed=false;}catch(_){saveFailed=true;}}
function stopAudio(){window.speechSynthesis?.cancel();}
function ensure(){if(dialog)return;dialog=document.createElement('dialog');dialog.id='hsmFlashcards';dialog.setAttribute('aria-labelledby','fcTitle');document.body.append(dialog);dialog.addEventListener('close',()=>{stopAudio();history=[];session=null;sync();if(returnFocus?.isConnected)returnFocus.focus();});dialog.addEventListener('cancel',()=>save());dialog.addEventListener('click',handle);dialog.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;if(e.code==='Space'&&phase==='study'){e.preventDefault();if(!e.repeat&&!revealed){revealed=true;render();}}});}
function button(label,action,cls='',extra=''){return '<button type="button" data-fc="'+action+'" data-hsm-icon-ready="1" class="'+cls+'" '+extra+'>'+label+'</button>';}
function shell(body,footer=''){dialog.innerHTML='<header class="fc-head"><div><span class="fc-eyebrow">MY WORDS, ONE BY ONE</span><h2 id="fcTitle">암기 카드</h2></div>'+button('닫기','close','fc-close','aria-label="암기 카드 닫기"')+'</header><main class="fc-main" tabindex="-1">'+body+'</main><footer class="fc-footer">'+footer+'</footer>';if(dialog.open)dialog.querySelector('.fc-main').focus({preventScroll:true});}
function render(){
 if(account!==owner()){dialog.close();return;}
 const notice=saveFailed?'저장 공간이 부족해 이어 하기를 저장하지 못했어요.':'진행 상황은 이 기기에 자동 저장돼요.';
 if(phase==='setup'){
 const old=read();shell('<div class="fc-intro"><span class="fc-mark">Aa</span><h3>한 장씩, 확실하게.</h3><p>외운 단어는 덜어내고<br>헷갈리는 단어만 다시 만나세요.</p></div>'+(old?.queue.length?'<section class="fc-resume"><strong>이어서 외울 단어 '+old.queue.length+'개</strong><p>'+esc(old.label)+' · '+(old.words.length-old.queue.length)+'개 완료</p>'+button('이어서 암기','resume','fc-primary')+'</section>':'')+(fresh?.words.length?'<div class="fc-selection"><strong>'+esc(fresh.label)+'</strong><p>선택한 단어 '+fresh.words.length+'개</p><fieldset><legend>카드 앞면</legend><label><input type="radio" name="fcDirection" value="eng" checked> 영어 → 뜻</label><label><input type="radio" name="fcDirection" value="kor"> 뜻 → 영어</label></fieldset><label class="fc-shuffle"><input type="checkbox" id="fcShuffle" checked> 순서 섞기</label></div>':'<p class="fc-empty">단어장에서 외울 단어를 선택해주세요.</p>'),(fresh?.words.length?button(old?.queue.length?'선택한 단어로 새로 시작':'암기 시작','start','fc-primary'):'')+'<p class="fc-note">'+(old?.queue.length&&fresh?.words.length?'새로 시작하면 이전 암기 진행을 대체해요.':'원래 단어장에서는 단어가 삭제되지 않아요.')+'</p>');return;
 }
 if(phase==='study'){
 if(!session.queue.length){phase='done';render();return;}
 const w=session.words[session.queue[0]],done=session.words.length-session.queue.length;
 shell('<div class="fc-progress-copy"><span>완료 <b>'+done+'</b> / '+session.words.length+'</span><strong>남은 단어 '+session.queue.length+'개</strong></div><progress max="'+session.words.length+'" value="'+done+'" aria-label="암기 진행"></progress><p class="fc-source">'+esc(session.label)+'</p><button type="button" data-fc="reveal" data-hsm-icon-ready="1" class="fc-card '+(revealed?'is-revealed':'')+'" aria-label="'+(revealed?'단어와 뜻':'카드를 눌러 정답 보기')+'"><span class="fc-card-label">'+(session.direction==='eng'?'ENGLISH':'MEANING')+'</span><strong>'+esc(session.direction==='eng'?w.word:w.meaning)+'</strong>'+(revealed?'<span class="fc-divider"></span><span class="fc-answer">'+esc(session.direction==='eng'?w.meaning:w.word)+'</span>':'<span class="fc-tap">눌러서 '+(session.direction==='eng'?'뜻':'영어')+' 보기</span>')+'</button><div class="fc-tools">'+button('↶ 되돌리기','undo','',!history.length?'disabled':'')+(session.direction==='eng'||revealed?button('발음 듣기','speak','',!window.speechSynthesis?'disabled':''):'')+'</div>',revealed?'<div class="fc-decisions">'+button('아직 헷갈려요','again','fc-again')+button('외웠어요 ✓','known','fc-primary')+'</div><p class="fc-note">'+notice+'</p>':button(session.direction==='eng'?'뜻 보기':'영어 보기','reveal','fc-primary')+'<p class="fc-note">먼저 답을 떠올린 뒤 확인해보세요.</p>');return;
 }
 if(phase==='done'){shell('<div class="fc-intro fc-complete"><span class="fc-mark">✓</span><h3>'+session.words.length+'개 단어<br>암기 완료!</h3><p>한 장씩 쌓아 올린 오늘의 공부.<br>이제 얼마나 기억하는지 확인해볼까요?</p></div><div class="fc-tools">'+button('↶ 마지막 선택 되돌리기','undo','',history.length?'':'disabled')+'</div>',button('선택한 단어로 확인 시험','quiz','fc-primary',new Set(session.words.map(w=>session.direction==='eng'?w.meaning:w.word)).size<2?'disabled':'')+button('한 번 더 복습','restart','fc-secondary')+button('단어장으로 돌아가기','close','fc-text')+'<p class="fc-note">'+(new Set(session.words.map(w=>session.direction==='eng'?w.meaning:w.word)).size<2?'확인 시험은 서로 다른 답이 2개 이상일 때 가능해요.':notice)+'</p>');return;}
 if(phase==='quiz'){const q=quiz[index];shell('<div class="fc-progress-copy"><strong>암기 확인</strong><span>'+(index+1)+' / '+quiz.length+'</span></div><progress value="'+index+'" max="'+quiz.length+'" aria-label="확인 시험 진행"></progress><div class="fc-quiz-prompt">'+esc(q.prompt)+'</div><div class="fc-options">'+q.options.map((a,i)=>button(esc(a),'answer','', 'data-choice="'+i+'"')).join('')+'</div><p id="fcFeedback" role="status"></p>',button(index+1===quiz.length?'결과 보기':'다음 단어','next','fc-primary','hidden')+'<p class="fc-note">암기 확인용 시험이에요. 점수·경험치에는 반영되지 않아요.</p>');return;}
 shell('<div class="fc-intro"><span class="fc-mark">'+Math.round(correct/quiz.length*100)+'<small>점</small></span><h3>'+quiz.length+'개 중 '+correct+'개 정답</h3><p>'+(missed.length?'헷갈린 '+missed.length+'개만 다시 외워볼까요?':'선택한 단어를 모두 맞혔어요!')+'</p></div>',(missed.length?button('틀린 단어만 다시 암기','retry','fc-primary'):'')+button('단어장으로 돌아가기','close','fc-secondary'));
}
function open(words,label){if(!owner())return;ensure();if(dialog.open)return;account=owner();fresh={words:normalize(words||[]),label:label||'선택한 단어'};returnFocus=document.activeElement;phase='setup';saveFailed=false;render();dialog.showModal();}
function begin(words,label,direction,mix){session={v:1,words,label,direction,queue:words.map((_,i)=>i)};if(mix)session.queue=shuffle(session.queue);history=[];phase='study';revealed=false;save();render();}
function handle(e){const b=e.target.closest('[data-fc]');if(!b||b.disabled)return;if(account!==owner()){dialog.close();return;}const a=b.dataset.fc;
 if(a==='close'){save();dialog.close();return;}if(a==='start'){begin(fresh.words,fresh.label,dialog.querySelector('[name=fcDirection]:checked').value,$('fcShuffle').checked);return;}
 if(a==='resume'){session=read();if(!session)return;history=[];revealed=false;phase='study';render();return;}
 if(a==='reveal'&&phase==='study'){if(!revealed){revealed=true;render();}return;}
 if((a==='known'||a==='again')&&phase==='study'&&revealed){stopAudio();history.push(session.queue.slice());if(history.length>50)history.shift();const id=session.queue.shift();if(a==='again')session.queue.push(id);revealed=false;save();render();return;}
 if(a==='undo'&&history.length){stopAudio();session.queue=history.pop();phase='study';revealed=false;save();render();return;}
 if(a==='restart'){begin(session.words,session.label,session.direction,true);return;}
 if(a==='speak'&&phase==='study'&&window.speechSynthesis){stopAudio();const u=new SpeechSynthesisUtterance(session.words[session.queue[0]].word);u.lang='en-US';u.rate=.85;window.speechSynthesis.speak(u);return;}
 if(a==='quiz'){stopAudio();const words=session.words,answer=w=>session.direction==='eng'?w.meaning:w.word;quiz=shuffle(words).map(w=>{const right=answer(w),others=shuffle([...new Set(words.map(answer))].filter(x=>x!==right)).slice(0,3);return {word:w,prompt:session.direction==='eng'?w.word:w.meaning,right,valid:words.filter(x=>(session.direction==='eng'?x.word:x.meaning)===(session.direction==='eng'?w.word:w.meaning)).map(answer),options:shuffle([right,...others])};});index=0;correct=0;missed=[];locked=false;phase='quiz';render();return;}
 if(a==='answer'&&phase==='quiz'&&!locked){locked=true;const q=quiz[index],ok=q.valid.includes(q.options[Number(b.dataset.choice)]);if(ok)correct++;else missed.push(q.word);dialog.querySelectorAll('[data-choice]').forEach(el=>{el.disabled=true;el.classList.toggle('is-correct',q.valid.includes(q.options[Number(el.dataset.choice)]));if(el===b&&!ok)el.classList.add('is-wrong');});$('fcFeedback').textContent=ok?'정답이에요!':'정답: '+q.right;dialog.querySelector('[data-fc=next]').hidden=false;return;}
 if(a==='next'&&phase==='quiz'&&locked){index++;locked=false;if(index===quiz.length)phase='result';render();return;}
 if(a==='retry')begin(missed,session.label+' · 확인 시험 오답',session.direction,true);
}
function selected(kind){
 if(kind==='vocab')return {words:getCheckedWords(),label:$('vocabSheetName').selectedOptions[0]?.textContent+' · Day '+$('vocabDay').value};
 if(kind==='personal'){const rows=getSelectedPersonalRows_();return {words:personalVocabularyWords.filter(w=>rows.includes(Number(w.rowNumber))),label:personalVocabularyBooks.find(b=>String(b.bookId)===String(selectedPersonalBookId))?.bookName||'나만의 단어장'};}
 if(kind==='wrong'){const rows=getSelectedWrongRows_();return {words:wrongNotebookWords.filter(w=>rows.includes(Number(w.rowNumber))),label:'오답노트'};}
 const rows=[...document.querySelectorAll('#hsmSchoolPageBody .hsm-school-word-row')].filter(r=>r.querySelector('.hsm-school-word-check')?.checked);return {words:rows.map(r=>({word:r.querySelector('.hsm-school-word-eng')?.textContent,meaning:r.querySelector('.hsm-school-word-mean')?.textContent})),label:'내신 단어장'};
}
function add(host,kind){if(!host||host.querySelector('[data-flashcards]'))return;const b=document.createElement('button');b.type='button';b.className='fc-entry';b.dataset.flashcards=kind;b.dataset.hsmIconReady='1';b.textContent='선택 단어 암기';b.onclick=()=>{const s=selected(kind);if(!s.words.length){window.HSMDialog?.alert('암기할 단어를 먼저 선택해주세요.');return;}open(s.words,s.label);};host.append(b);}
function sync(){
 if(dialog?.open&&account!==owner())dialog.close();
 add(document.querySelector('#vocabScreen .vocab-actions'),'vocab');add($('personalTestButton')?.parentElement,'personal');add($('wrongBulkToolbar'),'wrong');add(document.querySelector('#hsmSchoolPageBody .hsm-school-selectbar'),'school');
 document.querySelectorAll('[data-flashcards]').forEach(b=>{try{const n=selected(b.dataset.flashcards).words.length;b.disabled=!n;b.hidden=!n;}catch(_){b.hidden=true;}});
 const saved=read();
 for(const id of ['vocabScreen','personalVocabularyScreen','wrongNotebookScreen','hsmSchoolPageBody']){
  const host=$(id);if(!host)continue;let resume=host.querySelector(':scope > .fc-resume-entry');
  if(!resume){resume=document.createElement('button');resume.className='fc-resume-entry';resume.type='button';resume.dataset.hsmIconReady='1';resume.onclick=()=>open([],'');host.prepend(resume);}
  resume.hidden=!owner()||!saved?.queue.length;const label='암기 이어 하기 · '+(saved?.queue.length||0)+'개 남음';if(resume.textContent!==label)resume.textContent=label;
 }

}
function boot(){sync();let pending=false;const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sync();});};document.addEventListener('change',schedule);document.addEventListener('click',schedule);new MutationObserver(records=>{if(records.some(r=>!dialog?.contains(r.target)&&[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&!n.matches?.('[data-flashcards],.fc-resume-entry'))))schedule();}).observe(document.body,{childList:true,subtree:true});window.addEventListener('storage',schedule);const main=$('mainApp');if(main)new MutationObserver(schedule).observe(main,{attributes:true,attributeFilter:['class']});}
window.HSMFlashcards={open};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
