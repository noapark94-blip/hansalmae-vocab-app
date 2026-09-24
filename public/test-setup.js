(function () {
  'use strict';
  var owner = null, picked = {}, activeDay = '', returnFocus = null;
  var $ = function (id) { return document.getElementById(id); };
  function recommended(grade, options) {
    var g = String(grade || '').replace(/\s/g, '');
    var kind = /^고(?:등학교)?3/.test(g) ? '수능' : /^고/.test(g) ? '고등' : '중등';
    return options.find(function (v) { return v.indexOf(kind) >= 0; }) || options[0] || '';
  }
  window.hsmSetupApplyStudentDefaults_ = function (student) {
    if (!student || !student.studentId) return;
    var key = String(student.studentId) + ':' + String(student.grade || '');
    if (owner !== key) {
      owner = key; picked = {};
      $('questionCount').hidden = true;
      $('questionMode').value = 'engToKor'; $('questionCount').value = '30';
    }
    ['sheetName', 'vocabSheetName'].forEach(function (id) {
      var select = $(id); if (!select) return;
      var values = Array.from(select.options).map(function (o) { return o.value; }).filter(Boolean);
      select.value = values.indexOf(picked[id]) >= 0 ? picked[id] : recommended(student.grade, values);
      picked[id] = select.value;
    });
    var profile = $('hsmSetupStudent');
    if (profile) profile.textContent = [student.studentName, student.grade].filter(Boolean).join(' · ');
    sync();
  };
  function button(text, fn) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = fn; return b;
  }
  function choices(select, id, names) {
    var group = document.createElement('div'); group.id = id; group.className = 'hsm-setup-choices';
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', id === 'hsmSetupSheets' || id === 'hsmVocabSheets' || id === 'hsmWrongSheets' ? '단어 종류' : '문제 유형');
    select.insertAdjacentElement('afterend', group); select.hidden = true;
    function render() {
      group.replaceChildren();
      Array.from(select.options).filter(function (o) { return o.value; }).sort(function(a,b){return (id === 'hsmSetupModes' || id === 'hsmWrongModes') ? ['engToKor','korToEng','mixed','random','example'].indexOf(a.value)-['engToKor','korToEng','mixed','random','example'].indexOf(b.value) : 0;}).forEach(function (o) {
        var b = button(names && names[o.value] || o.textContent.trim().replace(/DB(?=\s*\(|$)/i, ''), function () {
          select.value = o.value; select.dispatchEvent(new Event('change', {bubbles:true})); sync();
        });
        b.dataset.value = o.value; group.appendChild(b);
      });
      sync();
    }
    new MutationObserver(render).observe(select, {childList:true}); render();
  }
  function sync() {
    [['hsmWrongSheets','wrongTestSheetName'],['hsmWrongModes','wrongTestQuestionMode'],['hsmSetupSheets','sheetName'],['hsmVocabSheets','vocabSheetName'],['hsmSetupModes','questionMode'],['hsmSetupCounts','questionCount']].forEach(function (pair) {
      var group = $(pair[0]), select = $(pair[1]); if (!group || !select) return;
      group.querySelectorAll('button').forEach(function (b) {
        var selected = b.dataset.value === select.value || (b.dataset.value === 'custom' && !['10','20','30'].includes(select.value));
        b.setAttribute('aria-pressed', String(selected));
      });
    });
    ['startDay','endDay','vocabDay'].forEach(function (id) {
      var trigger = $('hsmPick' + id), select = $(id); if (!trigger) return;
      trigger.textContent = select.value ? 'Day ' + select.value + ' ⌄' : '불러오는 중…';
      trigger.disabled = select.disabled || !select.options.length;
    });
  }
  function closeDays() { $('hsmDayPicker').close(); }
  function renderDays() {
    var select = $(activeDay), grid = $('hsmDayGrid'); grid.replaceChildren();
    var vocabulary = activeDay === 'vocabDay';
    $('hsmDayTitle').textContent = vocabulary ? '학습할 Day 선택' : activeDay === 'startDay' ? '시작 Day 선택' : '마지막 Day 선택';
    $('hsmDayHint').textContent = vocabulary ? '원하는 Day를 누르면 해당 단어장이 열립니다.' : '시작일과 마지막 날을 포함해 출제합니다.';
    $('hsmDayAll').hidden = vocabulary;
    Array.from(select.options).forEach(function (option) {
      var b = button(option.value, function () {
        select.value = option.value;
        if (!vocabulary && Number($('startDay').value) > Number($('endDay').value)) {
          $(activeDay === 'startDay' ? 'endDay' : 'startDay').value = option.value;
        }
        select.dispatchEvent(new Event('change', {bubbles:true})); sync(); closeDays();
      });
      b.setAttribute('aria-label', 'Day ' + option.value); b.setAttribute('aria-pressed', String(option.value === select.value));
      grid.appendChild(b);
    });
  }
  function boot() {
    var screen = $('startScreen'); if (!screen || $('hsmSetupStudent')) return;
    screen.classList.add('hsm-test-setup');
    var profile = document.createElement('div'); profile.id = 'hsmSetupStudent'; profile.className = 'hsm-setup-student';
    screen.querySelector('.subtitle').insertAdjacentElement('afterend', profile);
    $('studentName').hidden = true; screen.querySelector('label[for="studentName"]').hidden = true;
    choices($('sheetName'), 'hsmSetupSheets');
    choices($('vocabSheetName'), 'hsmVocabSheets');
    choices($('questionMode'), 'hsmSetupModes', {engToKor:'영어 → 한글',korToEng:'한글 → 영어',mixed:'영한·한영 혼합',random:'랜덤 출제',example:'예문 문제'});
    if ($('wrongTestSheetName')) {
      choices($('wrongTestSheetName'), 'hsmWrongSheets');
      choices($('wrongTestQuestionMode'), 'hsmWrongModes', {engToKor:'영어 → 한글',korToEng:'한글 → 영어',mixed:'영한·한영 혼합',random:'랜덤 출제',example:'예문 문제'});
      ['wrongTestSheetName','wrongTestQuestionMode'].forEach(function(id){$(id).addEventListener('change',sync);});
      var wrongCount = $('wrongTestQuestionCount'), quick = document.createElement('div');
      quick.className = 'hsm-wrong-counts'; quick.setAttribute('role','group'); quick.setAttribute('aria-label','문제 수 빠른 선택');
      wrongCount.insertAdjacentElement('beforebegin',quick);
      function syncWrongCount(){
        var limit = Number(wrongCount.max) || 0;
        quick.replaceChildren();
        ['10','20','30'].filter(function(v){return Number(v)<limit;}).concat(limit>0?[String(limit)]:[]).forEach(function(value){
          var all = Number(value)===limit;
          var b=button(all?'전체 '+value+'개':value+'개',function(){wrongCount.value=value;wrongCount.dispatchEvent(new Event('input',{bubbles:true}));});
          b.dataset.value=value;b.setAttribute('aria-pressed',String(value===wrongCount.value));quick.appendChild(b);
        });
      }
      wrongCount.addEventListener('input',function(){
        var limit=Number(wrongCount.max);
        if(Number(wrongCount.value)>limit)wrongCount.value=String(limit);
        syncWrongCount();
      });
      window.addEventListener('hsm:wrong-count',syncWrongCount); syncWrongCount();
    }
    var counts = document.createElement('div'); counts.id = 'hsmSetupCounts'; counts.className = 'hsm-setup-choices'; counts.setAttribute('role','group'); counts.setAttribute('aria-label','문제 수');
    var count = $('questionCount'); count.insertAdjacentElement('beforebegin',counts); count.hidden = true;
    ['10','20','30','custom'].forEach(function (value) {
      var b = button(value === 'custom' ? '직접 입력' : value + '개', function () {
        count.hidden = value !== 'custom';
        if (value !== 'custom') { count.value = value; count.dispatchEvent(new Event('input',{bubbles:true})); }
        else { count.focus(); count.select(); }
        sync(); if(value==='custom'){counts.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});}
      }); b.dataset.value = value; counts.appendChild(b);
    });
    count.addEventListener('input',sync);
    ['sheetName','vocabSheetName'].forEach(function(id){$(id).addEventListener('change',function(){picked[id]=this.value;sync();});});
    $('questionMode').addEventListener('change',sync);
    var dialog = document.createElement('dialog'); dialog.id = 'hsmDayPicker'; dialog.setAttribute('aria-labelledby','hsmDayTitle');
    dialog.innerHTML = '<div class="hsm-day-head"><h2 id="hsmDayTitle"></h2><button type="button" id="hsmDayClose">닫기</button></div><p id="hsmDayHint">시작일과 마지막 날을 포함해 출제합니다.</p><div id="hsmDayGrid"></div><button type="button" id="hsmDayAll">전체 범위 선택</button>';
    document.body.appendChild(dialog); $('hsmDayClose').onclick = closeDays;
    dialog.addEventListener('close',function(){if(returnFocus)returnFocus.focus();});
    dialog.addEventListener('click',function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDays();}});
    $('hsmDayAll').onclick=function(){var start=$('startDay'),end=$('endDay');start.selectedIndex=0;end.selectedIndex=end.options.length-1;sync();closeDays();};
    ['startDay','endDay','vocabDay'].forEach(function(id){var select=$(id);if(!select)return;select.hidden=true;var b=button('',function(){activeDay=id;returnFocus=b;renderDays();dialog.showModal();var selected=$('hsmDayGrid').querySelector('[aria-pressed="true"]');if(selected)selected.focus();});b.id='hsmPick'+id;b.className='hsm-day-trigger';b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','hsmDayPicker');b.setAttribute('aria-label',id==='vocabDay'?'학습할 Day 선택':id==='startDay'?'시작 Day 선택':'마지막 Day 선택');select.insertAdjacentElement('afterend',b);document.querySelector('label[for="'+id+'"]').htmlFor=b.id;select.addEventListener('change',sync);new MutationObserver(sync).observe(select,{childList:true,attributes:true,attributeFilter:['disabled']});});
    $('startDay').closest('.row').classList.add('hsm-setup-range');
    window.addEventListener('hsm:test-days',sync);
    var student = typeof currentStudent !== 'undefined' ? currentStudent : null;
    if(student) {
      var previousSheet = $('sheetName').value, previousVocab = $('vocabSheetName').value;
      window.hsmSetupApplyStudentDefaults_(student);
      if(previousSheet !== $('sheetName').value && typeof loadTestDays === 'function')loadTestDays();
      if(previousVocab !== $('vocabSheetName').value && typeof loadVocabDays === 'function')loadVocabDays();
    } else sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
