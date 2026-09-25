/* Friends and server-authoritative 1:1 word battles. No ranking/XP mutations. */
(function(){
 'use strict';
 let root, home=null, game=null, owner='', busy=false, pollBusy=false, lastPoll=0, signature='', offset=0, modal=null, searchResult=null, revision=0;
 const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const who=()=>typeof currentStudent!=='undefined'&&currentStudent?String(currentStudent.studentId||''):'';
 const active=()=>root&&!root.classList.contains('hidden');
 const live=()=>game&&['invited','ready','playing'].includes(game.status);
 const modes={engToKor:'영어 → 한글',korToEng:'한글 → 영어',mixed:'영한·한영 혼합'};
 const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m4 3 6 6-3 3-6-6V3Zm16 0-6 6 3 3 6-6V3ZM8 14l-5 5m13-5 5 5M3 15l6 6m6 0 6-6M9 9l10 10M15 9 5 19"/></svg>';
 const button=(label,action,id='',cls='')=>'<button type="button" class="fb-btn '+cls+'" data-action="'+action+'" data-id="'+esc(id)+'">'+label+'</button>';
 function image(p){let src=String(p?.image||'');if(!/^\.\/images\/|^https:\/\//.test(src))src='./images/emblems/title-chick.png';return '<img class="fb-avatar" src="'+esc(src)+'" alt="" loading="lazy">';}
 function person(p){return '<div class="fb-person">'+image(p)+'<div><strong>'+esc(p?.name||'친구')+'</strong><small>Lv.'+esc(p?.level||1)+' · '+esc(p?.title||'단어병아리')+'</small></div></div>';}
 function questionCount(s){return [10,20,30].includes(Number(s?.count))?Number(s.count):10;}
 function summary(s){return esc(s.title)+(s.kind==='school'?'':' · Day '+s.start+'–'+s.end)+' · '+esc(modes[s.mode]||'')+' · '+questionCount(s)+'문제';}
 function toast(msg){const el=$('fbToast');el.textContent=msg;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,3500);}
 async function api(action,payload={}){
  const account=who();if(!account)throw Error('로그인 후 이용해주세요.');
  const token=await window.hsmEnsureStudentSession_(false);
  if(account!==who())throw Error('로그인 계정이 변경됐어요.');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),15000);
  try{const res=await fetch(window.HANSALMAE_CONFIG.apiUrl.replace(/\/api\/?$/,'/word-battle'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action,payload}),signal:ctl.signal});
   const data=await res.json();if(account!==who())throw Error('로그인 계정이 변경됐어요.');if(!res.ok||!data.success)throw Error(data.message||'잠시 후 다시 시도해주세요.');return data.result;
  }finally{clearTimeout(timer);}
 }
 function stamp(g){game=g;offset=new Date(g.serverNow).getTime()-Date.now();renderGame();}
 async function refresh(force=false){
  if(pollBusy||busy||!who()||document.hidden||!$('mainApp')||$('mainApp').classList.contains('hidden'))return;
  if(!force&&Date.now()-lastPoll<(active()&&live()?1400:active()?7000:20000))return;
  pollBusy=true;lastPoll=Date.now();const version=revision,account=who(),room=game?.id;
  try{if(active()&&game){const data=await api('poll',{id:room});if(version===revision&&account===who()&&game?.id===room)stamp(data);}else {const data=await api('home');if(version===revision&&account===who()){home=data;updateBadge();if(active()&&!game)renderHome();}}const status=$('fbConnection');if(status)status.textContent='';}
  catch(e){if(active()){const status=$('fbConnection');if(status)status.textContent='연결을 확인하고 있어요. 잠시만 기다려주세요.';if(force)toast(e.message);}}
  finally{pollBusy=false;}
 }
 function updateBadge(){const requests=(home?.friends||[]).filter(f=>f&&f.status==='pending'&&f.incoming).length;const invites=(home?.battles||[]).filter(b=>b.status==='invited'&&b.guest===home.me.id).length;const notice=$('fbInviteNotice'),incoming=(home?.battles||[]).find(b=>b.status==='invited'&&b.guest===home.me.id);if(notice){const taking=['testScreen','teacherExamTakingScreen'].some(id=>$(id)&&!$(id).classList.contains('hidden'))||document.querySelector('.hsm-school-test-overlay:not([hidden])');notice.hidden=!incoming||active()||!!taking||$('mainApp').classList.contains('hidden');if(incoming){notice.textContent=(incoming.opponent?.name||'친구')+' 님의 대전 신청 · 확인하기';notice.dataset.id=incoming.id;}}const badge=$('fbShortcutCount');if(badge){badge.hidden=!(invites||requests);badge.textContent=invites?'대전 신청 '+invites+'개':requests?'친구 요청 '+requests+'개':'';}}
 async function open(){
  if(!who())return;owner=who(); if(typeof window.hsmRememberCurrentScreen_==='function')window.hsmRememberCurrentScreen_();
  if(typeof window.hsmUnmountSchoolStudy_==='function')window.hsmUnmountSchoolStudy_();
  window.hideAllStudentMainScreens_();root.classList.remove('hidden');if($('fbInviteNotice'))$('fbInviteNotice').hidden=true;window.setActiveMenu('mypage');window.scrollTo(0,0);signature='';
  if(game)renderGame();else renderHome();await refresh(true);
 }
 function renderHome(){
  const focused=document.activeElement;if(focused&&root.contains(focused)&&focused.matches('input'))return;
  const friends=(home?.friends||[]).filter(Boolean),accepted=friends.filter(f=>f.status==='accepted'),pending=friends.filter(f=>f.status==='pending');
  const rooms=(home?.battles||[]).filter(b=>['invited','ready','playing'].includes(b.status));
  const content=JSON.stringify([home,searchResult]);if(signature===content)return;signature=content;
  root.innerHTML='<div class="fb-heading"><div><span class="fb-eyebrow">함께 익히는 즐거움</span><h2>친구와 단어 대전</h2></div><span class="fb-mark">'+icon+'</span></div><p class="fb-sub">친구와 같은 문제를 풀고, 실력을 나눠보세요.</p><div id="fbConnection" class="fb-connection" role="status"></div>'+
   '<form id="fbSearch" class="fb-search"><label for="fbStudentId">친구 추가</label><div><input id="fbStudentId" maxlength="80" autocomplete="off" placeholder="친구의 정확한 학생 아이디" required minlength="2">'+button('찾기','search')+'</div></form>'+
   (searchResult?'<div class="fb-row">'+person(searchResult)+(friends.some(f=>f.id===searchResult.id)?'<span class="fb-muted">이미 요청했거나 친구예요</span>':button('친구 요청','request',searchResult.id,'fb-soft'))+'</div>':'')+
   (rooms.length?'<h3>진행 중인 대전</h3>'+rooms.map(b=>'<div class="fb-invite">'+person(b.opponent)+'<p>'+summary(b.settings)+'</p>'+button(b.status==='invited'&&b.guest===home.me.id?'대전 신청 확인':'이어서 보기','room',b.id,'fb-primary')+'</div>').join(''):'')+
   (pending.length?'<h3>친구 요청 <span>'+pending.length+'</span></h3>'+pending.map(f=>'<div class="fb-row">'+person(f)+'<div class="fb-actions">'+(f.incoming?button('수락','acceptFriend',f.id,'fb-soft')+button('거절','declineFriend',f.id,'fb-text'):button('요청 취소','declineFriend',f.id,'fb-text'))+'</div></div>').join(''):'')+
   '<div class="fb-section-head"><h3>내 친구 <span>'+accepted.length+'</span></h3>'+button('관리','manage','','fb-text')+'</div>'+
   (accepted.length?accepted.sort((a,b)=>Number(b.online)-Number(a.online)).map(f=>'<div class="fb-friend">'+person(f)+'<div class="fb-friend-bottom"><span class="fb-presence '+(f.online?'is-online':'')+'">'+(f.busy?'대전 중':f.online?'접속 중':'오프라인')+'</span>'+button('대전 신청','challenge',f.id,'fb-soft')+'</div></div>').join(''):'<div class="fb-empty"><span>'+icon+'</span><strong>첫 대전 친구를 만나보세요</strong><p>아이디로 친구를 찾고<br>서로 수락하면 대전할 수 있어요.</p></div>')+
   '<p class="fb-note">정답 수로 승부하고, 동점이면 정답을 맞힌 총 시간으로 결정해요. 대전은 월간 포인트와 경험치에 반영되지 않아요.</p>'+
   ((home?.battles||[]).some(b=>b.status==='finished')?'<h3>최근 대전</h3>'+home.battles.filter(b=>b.status==='finished').slice(0,5).map(b=>'<button class="fb-history" data-action="room" data-id="'+esc(b.id)+'"><span>'+esc(b.opponent?.name||'친구')+'</span><strong>'+(!b.winner?'무승부':b.winner===home.me.id?'승리':'다음엔 이겨봐요')+'</strong><span>›</span></button>').join(''):'');
  }
 function scoreboard(g){return '<div class="fb-scoreboard"><div>'+image(g.host)+'<strong>'+esc(g.host?.name)+'</strong><small>'+(g.host?.id===g.me?'나':'친구')+'</small></div><div class="fb-score"><b>'+g.hostScore+'</b><span>:</span><b>'+g.guestScore+'</b></div><div>'+image(g.guest)+'<strong>'+esc(g.guest?.name)+'</strong><small>'+(g.guest?.id===g.me?'나':'친구')+'</small></div></div>';}
 function renderGame(){
  if(!active()||!game)return;const g=game,content=JSON.stringify({...g,serverNow:null,deadline:g.deadline});if(content===signature){tick();return;}signature=content;
  const mine=g.host?.id===g.me,ready=mine?g.hostReady:g.guestReady;
  let html='<div class="fb-section-head"><h2>단어 대전</h2>'+button(live()?'나가기':'친구 목록','exit','','fb-text')+'</div><p class="fb-sub">'+summary(g.settings)+'</p><div id="fbConnection" class="fb-connection" role="status"></div>'+scoreboard(g);
  if(g.status==='invited')html+='<div class="fb-wait"><span class="fb-orbit">'+icon+'</span><h3>'+(mine?'친구의 수락을 기다려요':'친구가 대전을 신청했어요')+'</h3><p>한 문제에 10초 · 총 '+questionCount(g.settings)+'문제<br>서로 준비되면 함께 시작해요.</p></div>'+(mine?'<p class="fb-note">2분 안에 수락하지 않으면 신청이 종료돼요.</p>':'<div class="fb-two">'+button('다음에 할게요','decline',g.id)+button('함께 대전하기','accept',g.id,'fb-primary')+'</div>');
  else if(g.status==='ready')html+='<div class="fb-wait"><h3>준비됐나요?</h3><p>같은 문제, 각자의 실력.<br>둘 다 준비를 누르면 시작해요.</p><div class="fb-readiness"><span>'+(g.hostReady?'✓':'○')+' '+esc(g.host?.name)+'</span><span>'+(g.guestReady?'✓':'○')+' '+esc(g.guest?.name)+'</span></div></div><button class="fb-btn fb-primary fb-wide" data-action="ready" '+(ready?'disabled':'')+'>'+(ready?'친구의 준비를 기다려요':'준비 완료')+'</button>';
  else if(g.status==='playing'){
   const q=g.question;
   html+='<div class="fb-progress"><i style="width:'+(g.round/questionCount(g.settings)*100)+'%"></i></div><div class="fb-round"><span>'+String(g.round+1).padStart(2,'0')+' / '+questionCount(g.settings)+'</span><span id="fbTimer" aria-live="off"></span></div>';
   if(!q)html+='<div class="fb-countdown"><span id="fbCountdown"></span><p>곧 시작해요. 집중해보세요!</p></div>';
   else html+='<p class="fb-prompt-label">'+(q.mode==='engToKor'?'알맞은 뜻을 골라주세요':'알맞은 영어를 골라주세요')+'</p><h3 class="fb-question">'+esc(q.prompt)+'</h3><div class="fb-options">'+q.options.map((o,i)=>'<button class="fb-option '+(q.correctId===o.id?'is-correct':g.choice===o.id?(q.correctId?'is-wrong':'is-picked'):'')+'" data-action="answer" data-id="'+esc(o.id)+'" '+(g.answered||q.correctId?'disabled':'')+'><span>'+String(i+1).padStart(2,'0')+'</span><b>'+esc(o.text)+'</b>'+(q.correctId===o.id?'<em>✓</em>':'')+'</button>').join('')+'</div><p class="fb-answer-status" role="status">'+(q.correctId?(g.choice===q.correctId?'정답이에요!':'정답을 확인해보세요.') : g.answered?(g.opponentAnswered?'결과를 확인하고 있어요':'제출 완료 · 친구의 답을 기다려요'):g.opponentAnswered?'친구가 답을 제출했어요.':'정답을 고르면 바로 제출돼요.')+'</p>';
  }else if(g.status==='finished'){
   const score=mine?g.hostScore:g.guestScore,ms=mine?g.hostMs:g.guestMs,wrong=(g.review||[]).filter(w=>!w.correct);
   html+='<div class="fb-result"><span class="fb-result-badge">'+(!g.winner?'좋은 승부였어요':g.winner===g.me?'이번 대전의 주인공':'함께 한 뼘 성장했어요')+'</span><h3>'+(!g.winner?'무승부':g.winner===g.me?'멋진 승리!':'다음 판에 도전해요')+'</h3>'+(g.reason?'<p>'+esc(g.reason)+'</p>':'')+'<div class="fb-result-stats"><div><small>내 정답</small><strong>'+score+'<em> / '+questionCount(g.settings)+'</em></strong></div><div><small>정답 풀이 시간</small><strong>'+(ms/1000).toFixed(1)+'<em>초</em></strong></div></div></div><div class="fb-two">'+button('친구 목록','exit')+button('한 판 더','rematch','','fb-primary')+'</div><details class="fb-review" '+(wrong.length?'open':'')+'><summary>다시 익힐 단어 <span>'+wrong.length+'개</span></summary>'+wrong.map(w=>'<article><strong>'+esc(w.word)+'</strong><p>'+esc(w.meaning)+'</p>'+(w.example?'<div>'+esc(w.example)+(w.translation?'<small>'+esc(w.translation)+'</small>':'')+'</div>':'')+'</article>').join('')+'</details>';
  }else html+='<div class="fb-wait"><h3>대전이 종료됐어요</h3><p>'+esc(g.reason||(g.status==='declined'?'친구가 이번 신청을 사양했어요.':'다음에 다시 함께해요.'))+'</p></div>'+button('친구 목록으로','exit','','fb-primary fb-wide');
  root.innerHTML=html;tick();
 }
 function tick(){if(!active()||game?.status!=='playing')return;const now=Date.now()+offset;const timer=$('fbTimer'),count=$('fbCountdown');if(timer)timer.textContent=game.revealUntil?'정답 확인':Math.max(0,Math.ceil((new Date(game.deadline)-now)/1000))+'초';if(count)count.textContent=Math.max(1,Math.ceil((new Date(game.roundAt)-now)/1000));}
 function closeModal(){if(!modal)return;const back=modal._back;modal.remove();modal=null;document.body.style.overflow=closeModal.overflow||'';if(back?.isConnected)back.focus({preventScroll:true});}
 function sheet(title,body){closeModal();const m=document.createElement('div');m.className='fb-overlay';m.innerHTML='<section class="fb-sheet" role="dialog" aria-modal="true" aria-labelledby="fbModalTitle" tabindex="-1"><div class="fb-section-head"><h2 id="fbModalTitle">'+esc(title)+'</h2>'+button('×','close','','fb-close')+'</div>'+body+'</section>';m.querySelector('[data-action="close"]').setAttribute('aria-label','닫기');m._back=document.activeElement;closeModal.overflow=document.body.style.overflow;document.body.style.overflow='hidden';document.body.appendChild(m);modal=m;m.addEventListener('click',e=>{if(e.target===m)closeModal();else handle(e);});m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeModal();}if(e.key==='Tab'){const nodes=[...m.querySelectorAll('button:not(:disabled),input,select')];const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===m.firstElementChild)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});m.firstElementChild.focus({preventScroll:true});}
 async function challenge(id){const items=await api('catalog',{target:id});if(!items.length)throw Error('함께 이용할 수 있는 단어장이 없어요.');const p=home?.friends?.find(f=>f?.id===id)||(game&&(game.host.id===id?game.host:game.guest));sheet('대전 신청', '<p class="fb-sub">'+esc(p?.name||'친구')+' 님과 함께할 대전을 준비해요.</p><form id="fbChallenge"><label>단어장<select id="fbSource">'+items.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.title)+'</option>').join('')+'</select></label><div id="fbRange" class="fb-two"><label>시작 Day<select id="fbStart"></select></label><label>마지막 Day<select id="fbEnd"></select></label></div><label>문제 유형<select id="fbMode"><option value="mixed">영한·한영 혼합</option><option value="engToKor">영어 → 한글</option><option value="korToEng">한글 → 영어</option></select></label><fieldset class="fb-count-field"><legend>문제 수</legend><div class="fb-count-options">'+[10,20,30].map(n=>'<button type="button" class="fb-btn" data-action="count" data-id="'+n+'" aria-pressed="'+(n===10)+'">'+n+'문제</button>').join('')+'</div></fieldset><p class="fb-note">한 문제에 10초 · 정답 수 우선 · 동점이면 정답 풀이 시간 비교<br>친구가 수락하면 함께 준비할 수 있어요.</p>'+button('대전 신청 보내기','invite',id,'fb-primary fb-wide')+'</form>');
  const fill=()=>{const s=items.find(i=>i.id===$('fbSource').value);$('fbRange').hidden=s.kind==='school';const days=s.days||[];for(const key of ['fbStart','fbEnd'])$(key).innerHTML=days.map(d=>'<option value="'+Number(d)+'">Day '+Number(d)+'</option>').join('');if(days.length)$('fbEnd').value=days[days.length-1];};$('fbSource').addEventListener('change',fill);fill();}
 async function exitGame(){if(live()){if(!await HSMDialog.confirm({title:'대전을 나갈까요?',message:game.status==='playing'?'지금 나가면 이번 대전은 패배로 기록돼요.':'대전 신청이 종료돼요.',action:'나가기',cancel:'계속하기'}))return false;await api('leave',{id:game.id});}game=null;signature='';home=await api('home');renderHome();updateBadge();return true;}
 async function handle(e){const el=e.target.closest('[data-action]');if(!el)return;e.preventDefault();if(busy)return;const a=el.dataset.action,id=el.dataset.id;
  if(a==='close'){closeModal();return;}if(a==='count'){modal.querySelectorAll('[data-action="count"]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));return;}busy=true;revision++;el.disabled=true;
  try{
   if(a==='search'){const input=$('fbStudentId');if(!input.reportValidity())return;const r=await api('search',{search:input.value.trim()});searchResult=r.person;input.blur();signature='';renderHome();if(!r.person)toast('아이디를 다시 확인해주세요.');}
   else if(['request','acceptFriend','declineFriend','remove','block','unblock'].includes(a)){
    if(['remove','block'].includes(a)&&!await HSMDialog.confirm(a==='block'?'이 친구의 요청과 대전 신청을 받지 않을까요?':'친구 목록에서 삭제할까요?'))return;
    home=await api(a,{target:id});searchResult=null;closeModal();signature='';renderHome();updateBadge();toast(a==='request'?'친구 요청을 보냈어요.':a==='acceptFriend'?'이제 함께 대전할 수 있어요.':'변경했어요.');
   }else if(a==='challenge'||a==='rematch')await challenge(a==='rematch'?(game.host.id===game.me?game.guest.id:game.host.id):id);
   else if(a==='invite'){const g=await api('invite',{target:id,source:$('fbSource').value,start:Number($('fbStart').value),end:Number($('fbEnd').value),mode:$('fbMode').value,count:Number(modal.querySelector('[data-action="count"][aria-pressed="true"]').dataset.id)});closeModal();stamp(g);window.scrollTo(0,0);}
   else if(a==='room'){stamp(await api('poll',{id}));window.scrollTo(0,0);}
   else if(['accept','decline','ready','answer'].includes(a)){const room=game.id;const round=game.round;root.querySelectorAll('.fb-option').forEach(b=>b.disabled=true);stamp(await api(a,{id:room,round,choice:id}));}
   else if(a==='exit')await exitGame();
   else if(a==='manage'){sheet('친구 관리','<p class="fb-sub">친구 삭제와 차단을 관리해요.</p>'+(home?.friends||[]).filter(f=>f&&f.status==='accepted').map(f=>'<div class="fb-manage-row"><strong>'+esc(f.name)+'</strong><div>'+button('삭제','remove',f.id,'fb-text')+button('차단','block',f.id,'fb-text')+'</div></div>').join('')+'<h3>차단한 친구</h3>'+((home?.blocked||[]).filter(Boolean).map(f=>'<div class="fb-manage-row"><strong>'+esc(f.name)+'</strong>'+button('차단 해제','unblock',f.id,'fb-text')+'</div>').join('')||'<p class="fb-note">차단한 친구가 없어요.</p>'));}
  }catch(err){toast(err.name==='AbortError'?'연결이 늦어지고 있어요. 다시 시도해주세요.':err.message);signature='';if(active()&&game)renderGame();}
  finally{busy=false;if(el.isConnected)el.disabled=false;}
 }
 function init(){if(root)return;if(!$('mainApp')||!$('myPageScreen'))return;root=document.createElement('section');root.id='friendBattleScreen';root.className='card hidden fb-root';$('mainApp').appendChild(root);root.addEventListener('click',handle);root.addEventListener('submit',e=>{e.preventDefault();e.target.querySelector('[data-action="search"]')?.click();});
  const shortcut=document.createElement('button');shortcut.className='learning-shortcut';shortcut.id='fbShortcut';shortcut.type='button';shortcut.innerHTML='<span class="fb-cover-top"><span class="fb-cover-label">WORD BATTLE</span><span class="fb-cover-badge" id="fbShortcutCount" hidden></span></span><span class="fb-cover-title">친구와 단어 대전</span><span class="fb-cover-arena" aria-hidden="true"><span class="fb-cover-side fb-cover-left"><img src="./images/emblems/title-chick.png" alt="" width="512" height="512" decoding="async"></span><span class="fb-cover-vs">VS</span><span class="fb-cover-side fb-cover-right"><img src="./images/emblems/title-collector.png" alt="" width="512" height="512" decoding="async"></span></span><span class="fb-cover-footer"><span class="fb-cover-rules">10·20·30문제 · 한 문제에 10초</span><span class="fb-cover-cta">대전하러 가기 <span aria-hidden="true">↗</span></span></span>';shortcut.addEventListener('click',open);$('myPageScreen').querySelector('.learning-shortcuts').appendChild(shortcut);
  const msg=document.createElement('div');msg.id='fbToast';msg.className='fb-toast';msg.hidden=true;msg.setAttribute('role','status');document.body.appendChild(msg);const notice=document.createElement('button');notice.id='fbInviteNotice';notice.className='fb-invite-notice';notice.type='button';notice.hidden=true;notice.addEventListener('click',async()=>{const id=notice.dataset.id;try{await open();stamp(await api('poll',{id}));}catch(e){toast(e.message);}});document.body.appendChild(notice);
  let replay=false;document.addEventListener('click',async e=>{if(replay||!active()||!e.target.closest('#hsmMobileNav button,#hsmGlobalBackButton,#testMenuButton,#vocabMenuButton,#myPageMenuButton,#rankingMenuButton,#accountMenuButton,#hsmMobileMore [onclick^="hsmMobileNavigate_"]'))return;const target=e.target.closest('button');if(target.dataset.mobileMenu==='more')return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;busy=true;revision++;try{if(live()&&!await exitGame())return;root.classList.add('hidden');closeModal();replay=true;if(target.id==='hsmGlobalBackButton')window.showMyPage();else target.click();}catch(err){toast(err.message);}finally{replay=false;busy=false;}},true);
  const original=window.hideAllStudentMainScreens_;window.hideAllStudentMainScreens_=function(){root.classList.add('hidden');return original.apply(this,arguments);};
  setInterval(()=>{const account=who();if(account!==owner){owner=account;revision++;home=null;game=null;searchResult=null;signature='';closeModal();root.classList.add('hidden');lastPoll=0;updateBadge();}refresh();tick();},500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastPoll=0;refresh(true);}});
 }
 window.hsmOpenFriendBattle_=open;
 window.hsmBattleInProgress_=()=>!!(active()&&live())||busy;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
