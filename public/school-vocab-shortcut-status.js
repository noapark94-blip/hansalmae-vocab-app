(function(){
  'use strict';
  if(window.__HSM_SCHOOL_VOCAB_SHORTCUT_STATUS__) return;
  window.__HSM_SCHOOL_VOCAB_SHORTCUT_STATUS__=true;

  function apiUrl(){var b=window.HANSALMAE_CONFIG&&window.HANSALMAE_CONFIG.apiUrl;return String(b||'').replace(/\/api\/?$/,'/school-vocab');}
  function featureStateUrl(){var b=window.HANSALMAE_CONFIG&&window.HANSALMAE_CONFIG.apiUrl;return String(b||'').replace(/\/api\/?$/,'/feature-state');}
  function token(){return localStorage.getItem('hansalmaeStudentToken')||'';}
  function card(){return document.getElementById('hsmSchoolVocabShortcut');}
  function statusNode(){var c=card();if(!c)return null;return c.querySelector('.shortcut-stat,.shortcut-status,.shortcut-meta')||Array.from(c.children).find(function(el){return /불러오는 중/.test(el.textContent||'');})||null;}
  function newBadgeNode(){var c=card();if(!c)return null;return Array.from(c.querySelectorAll('span,small,em,strong,b,div')).find(function(el){return String(el.textContent||'').trim().toUpperCase()==='NEW';})||null;}
  function setStatus(text){var node=statusNode();if(node)node.textContent=text;}
  function setNewSeen(seen){var badge=newBadgeNode();if(!badge)return;badge.hidden=!!seen;badge.style.display=seen?'none':'';}

  async function refresh(){var c=card();if(!c||!token())return;try{var r=await fetch(apiUrl(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'studentListBooks',token:token(),payload:{}})});var j={};try{j=await r.json();}catch(_){ }if(!r.ok||!j.success)throw new Error('load failed');var books=Array.isArray(j.result)?j.result:[];var total=books.reduce(function(sum,b){return sum+Number(b.wordCount||0);},0);setStatus(books.length?('배정 단어장 '+books.length+'개 · 단어 '+total+'개'):'배정된 단어장 없음');}catch(_){setStatus('수행평가 단어장 확인하기');}}

  async function refreshNewState(){if(!card()||!token())return;try{var r=await fetch(featureStateUrl(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'getSchoolAssessmentNewState',token:token()})});var j={};try{j=await r.json();}catch(_){ }if(!r.ok||!j.success)throw new Error('state load failed');setNewSeen(!!(j.result&&j.result.seen));}catch(_){}}

  async function markNewSeen(){if(!token())return;setNewSeen(true);try{await fetch(featureStateUrl(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'markSchoolAssessmentNewSeen',token:token()})});}catch(_){}}

  function bindCard(){var c=card();if(!c)return false;if(c.dataset.hsmNewSeenBound!=='1'){c.dataset.hsmNewSeenBound='1';c.addEventListener('click',markNewSeen,true);}refresh();refreshNewState();return true;}

  var tries=0,timer=setInterval(function(){tries++;if(bindCard()){clearInterval(timer);}else if(tries>40)clearInterval(timer);},250);
  document.addEventListener('visibilitychange',function(){if(!document.hidden){refresh();refreshNewState();}});
  window.addEventListener('focus',function(){refresh();refreshNewState();});
})();