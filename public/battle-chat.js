/* Battle-only conversation; sending never takes the answer-button lock. */
(function(){
 'use strict';
 const emojis=['😛','😆','😭','👏','💗'],labels=['메롱','웃음','울음','박수','하트'];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const chatIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3H3V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h6"/></svg>';
 let root,game,api,notify,room='',account='',panel=null,messages=[],sending=false,muted=false,opened=false,cooldown=0,clockOffset=0,listSignature='',generation=0;
 function reset(){generation++;room='';panel=null;messages=[];sending=false;opened=false;cooldown=0;listSignature='';}
 function controls(g){if(g.status!=='playing')return '';return '<div class="bc-tools"><button type="button" class="bc-toggle" data-chat="toggle" aria-label="이모티콘 보내기" aria-expanded="'+opened+'">'+chatIcon+'</button><div class="bc-picker" '+(opened?'':'hidden')+' role="group" aria-label="대전 이모티콘">'+emojis.map((e,i)=>'<button type="button" data-chat="emoji" data-emoji="'+e+'" aria-label="'+labels[i]+'">'+e+'</button>').join('')+'<button type="button" class="bc-mute" data-chat="mute" aria-pressed="'+muted+'">'+(muted?'표시 켜기':'상대 숨기기')+'</button></div></div>';}
 function setupPanel(){
  panel=document.createElement('section');panel.className='bc-panel';panel.setAttribute('aria-label','대기실 채팅');
  panel.innerHTML='<div class="bc-heading"><strong>'+chatIcon+'대기실 채팅</strong><button type="button" data-chat="mute" class="bc-mute"></button></div><div class="bc-log" role="log" aria-live="polite" aria-relevant="additions"></div><form class="bc-compose"><input type="text" maxlength="160" aria-label="메시지" placeholder="친구에게 한마디" autocomplete="off" enterkeyhint="send"><button type="submit" aria-label="메시지 보내기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m4 12 16-8-6 16-3-7-7-1Zm7 1 9-9"/></svg></button></form><p class="bc-hint">이 대전의 친구와만 나누는 대화예요.</p>';
  panel.querySelector('form').addEventListener('submit',e=>{e.preventDefault();const input=panel.querySelector('input');if(!e.isComposing)send('text',input.value);});
  panel.querySelector('input').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.isComposing)e.preventDefault();});
 }
 function paint(){
  if(!root||!game)return;
  const waiting=['invited','ready'].includes(game.status);
  root.querySelectorAll('[data-chat="mute"]').forEach(b=>{b.textContent=muted?'표시 켜기':'상대 숨기기';b.setAttribute('aria-pressed',String(muted));});
  const picker=root.querySelector('.bc-picker');if(picker)picker.hidden=!opened;
  root.querySelector('[data-chat="toggle"]')?.setAttribute('aria-expanded',String(opened));
  if(waiting&&panel){
   const items=messages.filter(m=>!muted||m.sender===game.me),sig=JSON.stringify(items);
   const log=panel.querySelector('.bc-log');log.classList.toggle('is-empty',!items.length);
   if(sig!==listSignature||!log.childNodes.length){
    const atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<24;const first=!listSignature;
    log.innerHTML=items.length?items.map(m=>'<div class="bc-message '+(m.sender===game.me?'is-mine':'')+'"><small>'+esc(m.sender===game.me?'나':(game.host.id===m.sender?game.host.name:game.guest.name))+'</small><span>'+esc(m.body)+'</span></div>').join(''):'<p class="bc-empty">반가운 인사로 시작해보세요 👋</p>';
    if(first||atBottom||items.at(-1)?.sender===game.me)log.scrollTop=log.scrollHeight;
    listSignature=sig;
   }
   panel.querySelector('button[type="submit"]').disabled=sending;
  }
  root.querySelectorAll('.bc-reaction').forEach(e=>e.remove());
  if(game.status==='playing')for(const side of ['host','guest']){
   const p=game[side];if(muted&&p.id!==game.me)continue;
   const m=messages.filter(m=>m.sender===p.id&&m.kind==='emoji'&&emojis.includes(m.body)).at(-1);
   if(!m||Date.now()+clockOffset-new Date(m.at).getTime()>3200)continue;
   const fighter=root.querySelector('.fb-fighter.fb-'+side);if(!fighter)continue;
   const bubble=document.createElement('span');bubble.className='bc-reaction';bubble.textContent=m.body;bubble.setAttribute('role','img');bubble.setAttribute('aria-label',p.name+' · '+labels[emojis.indexOf(m.body)]);fighter.appendChild(bubble);
  }
  root.querySelectorAll('[data-chat="emoji"]').forEach(b=>b.disabled=sending||Date.now()<cooldown);
 }
 async function send(kind,body){
  body=String(body||'').trim();if(!body||sending||!game)return;
  if(kind==='emoji'&&Date.now()<cooldown)return;
  const id=room,token=generation,me=account,oldInput=panel?.querySelector('input');sending=true;paint();
  try{
   const result=await api('chat',{id,kind,body});
   if(room!==id||generation!==token||account!==me)return;
   // Merge with any newer poll response instead of overwriting it.
   ingest(result);if(kind==='emoji'){cooldown=Date.now()+3000;opened=false;}
   else if(oldInput?.value.trim()===body)oldInput.value='';
  }catch(e){if(room===id&&generation===token)notify(e.name==='AbortError'?'전송을 확인하지 못했어요. 잠시 후 확인해주세요.':e.message);}
  finally{if(room===id&&generation===token){sending=false;paint();}}
 }
 function ingest(chat){if(!chat)return;if(chat.serverNow)clockOffset=new Date(chat.serverNow).getTime()-Date.now();if(Array.isArray(chat.messages))messages=[...new Map([...messages,...chat.messages].map(m=>[String(m.id),m])).values()].sort((a,b)=>Number(a.id)-Number(b.id)).slice(-40);}
 function mount(node,g,call,toast){
  root=node;api=call;notify=toast;if(account!==g.me){reset();account=g.me;muted=false;}
  if(room!==g.id){reset();room=g.id;}game=g;ingest(g.chat);
  if(!root.dataset.chatBound){root.dataset.chatBound='1';root.addEventListener('click',e=>{const b=e.target.closest('[data-chat]');if(!b)return;e.preventDefault();const action=b.dataset.chat;if(action==='emoji'){send('emoji',b.dataset.emoji);return;}if(action==='toggle')opened=!opened;if(action==='mute')muted=!muted;paint();});root.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){opened=false;paint();root.querySelector('.bc-toggle')?.focus();}});}
  const slot=root.querySelector('.bc-slot');if(slot){if(!panel)setupPanel();if(panel.parentNode!==slot)slot.appendChild(panel);}else{panel?.remove();panel=null;listSignature='';if(g.status!=='playing')opened=false;}
  paint();
 }
 // Keep the exact input node and selection through readiness updates (including IME).
 function capture(){const input=panel?.querySelector('input');return input&&document.activeElement===input?{input,start:input.selectionStart,end:input.selectionEnd}:null;}
 function restore(focus){if(focus?.input.isConnected){focus.input.focus({preventScroll:true});focus.input.setSelectionRange(focus.start,focus.end);}}
 setInterval(()=>{if(root&&!root.classList.contains('hidden'))paint();},400);
 document.addEventListener('click',e=>{if(opened&&root&&!e.target.closest('.bc-tools')){opened=false;paint();}});
 window.HSMBattleChat={controls,mount,capture,restore,reset};
})();
