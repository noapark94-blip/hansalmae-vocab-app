(function(){
  'use strict';
  if(window.__HSM_SCHOOL_VOCAB_LIVE_REFRESH__)return;
  window.__HSM_SCHOOL_VOCAB_LIVE_REFRESH__=true;

  var refreshing=false;
  var lastRefresh=0;

  function apiUrl(){
    var base=window.HANSALMAE_CONFIG&&window.HANSALMAE_CONFIG.apiUrl;
    return String(base||'').replace(/\/api\/?$/,'/school-vocab');
  }
  function token(){return localStorage.getItem('hansalmaeStudentToken')||'';}
  async function call(action,payload){
    var r=await fetch(apiUrl(),{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},body:JSON.stringify({action:action,token:token(),payload:payload||{}})});
    var j={};try{j=await r.json();}catch(_){ }
    if(!r.ok||!j.success)throw new Error(j&&j.message?j.message:'수행평가 단어장 새로고침에 실패했습니다.');
    return j.result;
  }
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function visiblePage(){var p=document.getElementById('hsmSchoolStudentPage');return p&&!p.hidden?p:null;}

  async function refreshList(page){
    var body=page.querySelector('#hsmSchoolPageBody');
    if(!body||!body.querySelector('.hsm-school-book'))return false;
    var books=await call('studentListBooks');
    var note=body.querySelector('.hsm-school-note');
    var card=note&&note.closest('.hsm-school-card');
    if(!card)return false;
    var html='';
    if(books&&books.length){
      html=books.map(function(x){
        return '<div class="hsm-school-book" data-book="'+esc(x.bookId)+'"><div><h3>'+esc(x.title)+'</h3><div class="hsm-school-meta">'+esc([x.schoolName,x.gradeLabel].filter(Boolean).join(' · '))+'<br>단어 '+Number(x.wordCount||0)+'개</div></div><button class="hsm-school-open" type="button">단어장 열기</button></div>';
      }).join('<div style="height:10px"></div>');
    }else{
      html='<div class="hsm-school-empty">아직 배정된 수행평가 단어장이 없습니다.</div>';
    }
    Array.from(card.children).forEach(function(ch){if(ch!==note)ch.remove();});
    note.insertAdjacentHTML('afterend',html);
    return true;
  }

  async function refreshNow(force){
    var page=visiblePage();
    if(!page||refreshing)return;
    var now=Date.now();
    if(!force&&now-lastRefresh<1500)return;
    refreshing=true;
    try{
      await refreshList(page);
      lastRefresh=Date.now();
    }catch(e){console.warn('수행평가 최신 정보 갱신 실패',e);}
    finally{refreshing=false;}
  }

  document.addEventListener('visibilitychange',function(){if(!document.hidden)refreshNow(true);});
  window.addEventListener('focus',function(){refreshNow(false);});
  window.addEventListener('pageshow',function(){refreshNow(true);});
  document.addEventListener('click',function(e){
    if(e.target.closest('#hsmSchoolVocabShortcut'))setTimeout(function(){refreshNow(true);},500);
  },true);

  setInterval(function(){if(visiblePage()&&!document.hidden)refreshNow(false);},10000);
})();
