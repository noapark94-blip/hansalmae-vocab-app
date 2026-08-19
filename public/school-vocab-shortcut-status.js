(function(){
  'use strict';
  if(window.__HSM_SCHOOL_VOCAB_SHORTCUT_STATUS__) return;
  window.__HSM_SCHOOL_VOCAB_SHORTCUT_STATUS__=true;

  function apiUrl(){var b=window.HANSALMAE_CONFIG&&window.HANSALMAE_CONFIG.apiUrl;return String(b||'').replace(/\/api\/?$/,'/school-vocab');}
  function token(){return localStorage.getItem('hansalmaeStudentToken')||'';}
  function statusNode(){var card=document.getElementById('hsmSchoolVocabShortcut');if(!card)return null;return card.querySelector('.shortcut-stat,.shortcut-status,.shortcut-meta')||Array.from(card.children).find(function(el){return /불러오는 중/.test(el.textContent||'');})||null;}
  function setStatus(text){var node=statusNode();if(node)node.textContent=text;}
  async function refresh(){var card=document.getElementById('hsmSchoolVocabShortcut');if(!card||!token())return;try{var r=await fetch(apiUrl(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'studentListBooks',token:token(),payload:{}})});var j={};try{j=await r.json();}catch(_){ }if(!r.ok||!j.success)throw new Error('load failed');var books=Array.isArray(j.result)?j.result:[];var total=books.reduce(function(sum,b){return sum+Number(b.wordCount||0);},0);setStatus(books.length?('배정 단어장 '+books.length+'개 · 단어 '+total+'개'):'배정된 단어장 없음');}catch(_){setStatus('수행평가 단어장 확인하기');}}
  var tries=0,timer=setInterval(function(){tries++;if(document.getElementById('hsmSchoolVocabShortcut')){clearInterval(timer);refresh();}else if(tries>40)clearInterval(timer);},250);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh();});
  window.addEventListener('focus',refresh);
})();