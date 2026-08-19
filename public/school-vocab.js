(function hansalmaeSchoolVocabularyFeature() {
  'use strict';

  if (window.__HSM_SCHOOL_VOCAB_INSTALLED__) return;
  window.__HSM_SCHOOL_VOCAB_INSTALLED__ = true;

  var state = {
    teacher: { setup: null, editingBookId: '', selectedStudents: new Set() },
    student: { books: [], currentBook: null, test: null }
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function apiUrl() {
    var base = window.HANSALMAE_CONFIG && window.HANSALMAE_CONFIG.apiUrl;
    return String(base || '').replace(/\/api\/?$/, '/school-vocab');
  }

  async function call(action, token, payload) {
    var response = await fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, token: token, payload: payload || {} })
    });
    var body = {};
    try { body = await response.json(); } catch (_) {}
    if (!response.ok || !body.success) {
      throw new Error(body && body.message ? body.message : '수행평가 단어장 요청에 실패했습니다.');
    }
    return body.result;
  }

  function shuffle(values) {
    var out = values.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function injectStyle() {
    if (document.getElementById('hsmSchoolVocabStyle')) return;
    var style = document.createElement('style');
    style.id = 'hsmSchoolVocabStyle';
    style.textContent = [
      '.hsm-sv-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:20px;align-items:start}',
      '.hsm-sv-card{background:#fff;border:1px solid #e8e7ef;border-radius:18px;padding:20px;box-shadow:0 10px 28px rgba(43,35,91,.06)}',
      '.hsm-sv-card h2,.hsm-sv-card h3{margin:0 0 14px;text-align:left}',
      '.hsm-sv-field{margin:0 0 14px}.hsm-sv-field label{display:block;margin:0 0 7px;font-size:13px;font-weight:800}',
      '.hsm-sv-field input,.hsm-sv-field textarea,.hsm-sv-field select{width:100%;border:1px solid #dedde7;border-radius:12px;padding:11px 12px;background:#fff;color:#222;font:inherit}',
      '.hsm-sv-field textarea{min-height:155px;resize:vertical;line-height:1.55}',
      '.hsm-sv-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.hsm-sv-help{font-size:12px;line-height:1.55;color:#77778a;margin-top:6px}',
      '.hsm-sv-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
      '.hsm-sv-actions button{width:auto;margin:0;padding:10px 13px;font-size:13px;border-radius:11px}',
      '.hsm-sv-list{display:grid;gap:10px}.hsm-sv-book{border:1px solid #e6e4ee;border-radius:14px;padding:14px;background:#fff}',
      '.hsm-sv-book-title{font-weight:900;font-size:16px}.hsm-sv-meta{margin-top:5px;color:#77778a;font-size:12px;line-height:1.55}',
      '.hsm-sv-students{max-height:260px;overflow:auto;border:1px solid #e6e4ee;border-radius:12px;padding:7px}',
      '.hsm-sv-student{display:flex;align-items:center;gap:9px;padding:8px;border-radius:9px}.hsm-sv-student:hover{background:#f6f3ff}',
      '.hsm-sv-student input{width:17px;height:17px;flex:0 0 auto}',
      '.hsm-sv-empty{padding:26px 12px;text-align:center;color:#888;font-size:13px}',
      '.hsm-sv-overlay{position:fixed;inset:0;z-index:9700;background:rgba(20,18,28,.52);display:flex;align-items:flex-start;justify-content:center;padding:calc(18px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom));overflow:auto}',
      '.hsm-sv-modal{width:min(760px,100%);background:#f7f7fb;border-radius:22px;padding:18px;box-shadow:0 24px 60px rgba(0,0,0,.2)}',
      '.hsm-sv-modal-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}',
      '.hsm-sv-modal-head h2{margin:0;text-align:left;font-size:22px}.hsm-sv-close{width:auto!important;margin:0!important;padding:8px 11px!important;background:#ececf3!important;color:#333!important}',
      '.hsm-sv-word-list{max-height:48vh;overflow:auto;display:grid;gap:7px}.hsm-sv-word{display:grid;grid-template-columns:44px minmax(0,.75fr) minmax(0,1.25fr);gap:8px;padding:10px 11px;background:#fff;border:1px solid #eceaf1;border-radius:11px;align-items:start}',
      '.hsm-sv-word-num{color:#999;font-size:12px}.hsm-sv-word-eng{font-weight:850;word-break:break-word}.hsm-sv-word-mean{color:#555;word-break:keep-all}',
      '.hsm-sv-test-card{background:#fff;border:1px solid #ebe9f0;border-radius:17px;padding:20px}',
      '.hsm-sv-progress{font-size:13px;color:#777;margin-bottom:14px}.hsm-sv-prompt{text-align:center;font-size:25px;font-weight:900;padding:26px 8px;word-break:keep-all}',
      '.hsm-sv-options{display:grid;gap:9px}.hsm-sv-option{margin:0!important;text-align:left!important;background:#fff!important;color:#222!important;border:1px solid #dddbe5!important;box-shadow:none!important}',
      '.hsm-sv-result{text-align:center;padding:24px 10px}.hsm-sv-score{font-size:46px;font-weight:950;color:#8f145f}',
      '.hsm-sv-launcher-badge{display:inline-block;margin-left:7px;padding:2px 7px;border-radius:999px;background:#fff0f7;color:#8f145f;font-size:10px;font-weight:900}',
      '@media(max-width:800px){.hsm-sv-grid{grid-template-columns:1fr}.hsm-sv-row{grid-template-columns:1fr}.hsm-sv-word{grid-template-columns:34px minmax(0,.85fr) minmax(0,1.15fr)}.hsm-sv-modal{padding:14px}.hsm-sv-prompt{font-size:22px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function parseWords(text) {
    return String(text || '').split(/\r?\n/).map(function (line) {
      var raw = line.trim();
      if (!raw) return null;
      var cols = raw.indexOf('\t') >= 0 ? raw.split('\t') : raw.split(',');
      cols = cols.map(function (x) { return String(x || '').trim(); });
      if (!cols[0] || !cols[1]) return null;
      return { word: cols[0], meaning: cols[1], example: cols[2] || '', translation: cols[3] || '' };
    }).filter(Boolean);
  }

  function wordsToText(words) {
    return (words || []).map(function (w) {
      return [w.word || '', w.meaning || '', w.example || '', w.translation || ''].join('\t');
    }).join('\n');
  }

  function teacherToken() { return sessionStorage.getItem('hansalmaeTeacherToken') || ''; }
  function studentToken() { return localStorage.getItem('hansalmaeStudentToken') || ''; }

  function teacherStudentsHtml() {
    var setup = state.teacher.setup || { students: [] };
    if (!setup.students.length) return '<div class="hsm-sv-empty">등록된 학생이 없습니다.</div>';
    return setup.students.map(function (s) {
      var checked = state.teacher.selectedStudents.has(s.studentId) ? ' checked' : '';
      return '<label class="hsm-sv-student"><input type="checkbox" data-hsm-sv-student="' + esc(s.studentId) + '"' + checked + '><span><strong>' + esc(s.studentName) + '</strong><br><small>' + esc(s.grade || '') + ' · ' + esc(s.studentId) + '</small></span></label>';
    }).join('');
  }

  function teacherBooksHtml() {
    var books = (state.teacher.setup && state.teacher.setup.books) || [];
    if (!books.length) return '<div class="hsm-sv-empty">아직 만든 수행평가 단어장이 없습니다.</div>';
    return books.map(function (b) {
      return '<div class="hsm-sv-book"><div class="hsm-sv-book-title">' + esc(b.title) + '</div>' +
        '<div class="hsm-sv-meta">' + esc([b.schoolName, b.gradeLabel].filter(Boolean).join(' · ')) + '<br>단어 ' + Number(b.wordCount || 0) + '개 · 배정 학생 ' + Number(b.studentCount || 0) + '명</div>' +
        '<div class="hsm-sv-actions"><button type="button" class="outline-btn" data-hsm-sv-edit="' + esc(b.bookId) + '">수정</button>' +
        '<button type="button" class="primary-btn" data-hsm-sv-exam="' + esc(b.bookId) + '">공식시험 출제</button>' +
        '<button type="button" class="danger-btn" data-hsm-sv-delete="' + esc(b.bookId) + '">삭제</button></div></div>';
    }).join('');
  }

  function renderTeacherPanel() {
    var panel = document.getElementById('hsmSchoolVocabTeacherPanel');
    if (!panel) return;
    panel.innerHTML = '<div class="hsm-sv-grid"><div class="hsm-sv-card"><h2>학교 수행평가 단어장</h2>' +
      '<div class="hsm-sv-row"><div class="hsm-sv-field"><label>단어장 이름</label><input id="hsmSvTitle" placeholder="예: 군서고 2학기 수행평가 1차"></div>' +
      '<div class="hsm-sv-field"><label>학교명</label><input id="hsmSvSchool" placeholder="예: 군서고"></div></div>' +
      '<div class="hsm-sv-row"><div class="hsm-sv-field"><label>학년/구분</label><input id="hsmSvGrade" placeholder="예: 고2"></div>' +
      '<div class="hsm-sv-field"><label>설명</label><input id="hsmSvDescription" placeholder="선택 입력"></div></div>' +
      '<div class="hsm-sv-field"><label>단어 입력</label><textarea id="hsmSvWords" placeholder="영단어[TAB]뜻[TAB]예문[TAB]해석\n영단어[TAB]뜻"></textarea>' +
      '<div class="hsm-sv-help">엑셀에서 <strong>영단어 · 뜻 · 예문 · 해석</strong> 열을 그대로 복사해서 붙여넣을 수 있습니다. 예문/해석은 없어도 됩니다.</div></div>' +
      '<div class="hsm-sv-field"><label>배정 학생</label><div class="hsm-sv-actions"><button type="button" class="outline-btn" id="hsmSvSelectAll">전체 선택</button><button type="button" class="outline-btn" id="hsmSvClearAll">전체 해제</button></div><div id="hsmSvStudents" class="hsm-sv-students">' + teacherStudentsHtml() + '</div></div>' +
      '<div class="hsm-sv-actions"><button type="button" class="primary-btn" id="hsmSvSave">단어장 저장</button><button type="button" class="outline-btn" id="hsmSvNew">새 단어장</button></div></div>' +
      '<div class="hsm-sv-card"><h2>만든 수행평가 단어장</h2><div id="hsmSvBookList" class="hsm-sv-list">' + teacherBooksHtml() + '</div></div></div>';

    panel.querySelector('#hsmSvStudents').addEventListener('change', function (e) {
      var input = e.target.closest('[data-hsm-sv-student]');
      if (!input) return;
      var id = input.getAttribute('data-hsm-sv-student');
      if (input.checked) state.teacher.selectedStudents.add(id); else state.teacher.selectedStudents.delete(id);
    });
    panel.querySelector('#hsmSvSelectAll').onclick = function () {
      ((state.teacher.setup && state.teacher.setup.students) || []).forEach(function (s) { state.teacher.selectedStudents.add(s.studentId); });
      panel.querySelector('#hsmSvStudents').innerHTML = teacherStudentsHtml();
    };
    panel.querySelector('#hsmSvClearAll').onclick = function () {
      state.teacher.selectedStudents.clear(); panel.querySelector('#hsmSvStudents').innerHTML = teacherStudentsHtml();
    };
    panel.querySelector('#hsmSvSave').onclick = saveTeacherBook;
    panel.querySelector('#hsmSvNew').onclick = resetTeacherForm;
    panel.querySelector('#hsmSvBookList').onclick = function (e) {
      var edit = e.target.closest('[data-hsm-sv-edit]');
      var del = e.target.closest('[data-hsm-sv-delete]');
      var exam = e.target.closest('[data-hsm-sv-exam]');
      if (edit) editTeacherBook(edit.getAttribute('data-hsm-sv-edit'));
      if (del) deleteTeacherBook(del.getAttribute('data-hsm-sv-delete'));
      if (exam) openTeacherExamDialog(exam.getAttribute('data-hsm-sv-exam'));
    };
  }

  async function loadTeacherSetup() {
    var panel = document.getElementById('hsmSchoolVocabTeacherPanel');
    if (panel) panel.innerHTML = '<div class="hsm-sv-card">수행평가 단어장을 불러오는 중입니다.</div>';
    try {
      state.teacher.setup = await call('teacherSetup', teacherToken());
      renderTeacherPanel();
    } catch (e) {
      if (panel) panel.innerHTML = '<div class="hsm-sv-card"><div class="hsm-sv-empty">' + esc(e.message) + '</div></div>';
    }
  }

  function resetTeacherForm() {
    state.teacher.editingBookId = '';
    state.teacher.selectedStudents.clear();
    ['hsmSvTitle','hsmSvSchool','hsmSvGrade','hsmSvDescription','hsmSvWords'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
    var list = document.getElementById('hsmSvStudents'); if (list) list.innerHTML = teacherStudentsHtml();
  }

  async function editTeacherBook(id) {
    try {
      var data = await call('teacherGetBook', teacherToken(), { bookId: id });
      state.teacher.editingBookId = id;
      state.teacher.selectedStudents = new Set((data.students || []).map(function (s) { return s.studentId; }));
      document.getElementById('hsmSvTitle').value = data.title || '';
      document.getElementById('hsmSvSchool').value = data.schoolName || '';
      document.getElementById('hsmSvGrade').value = data.gradeLabel || '';
      document.getElementById('hsmSvDescription').value = data.description || '';
      document.getElementById('hsmSvWords').value = wordsToText(data.words || []);
      document.getElementById('hsmSvStudents').innerHTML = teacherStudentsHtml();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { alert(e.message); }
  }

  async function saveTeacherBook() {
    var words = parseWords(document.getElementById('hsmSvWords').value);
    var button = document.getElementById('hsmSvSave'); button.disabled = true;
    try {
      var result = await call('teacherSaveBook', teacherToken(), {
        bookId: state.teacher.editingBookId,
        title: document.getElementById('hsmSvTitle').value,
        schoolName: document.getElementById('hsmSvSchool').value,
        gradeLabel: document.getElementById('hsmSvGrade').value,
        description: document.getElementById('hsmSvDescription').value,
        words: words,
        studentIds: Array.from(state.teacher.selectedStudents)
      });
      alert('수행평가 단어장을 저장했습니다.\n단어 ' + result.wordCount + '개 · 학생 ' + result.studentCount + '명');
      state.teacher.editingBookId = '';
      state.teacher.selectedStudents.clear();
      await loadTeacherSetup();
    } catch (e) { alert(e.message); } finally { button.disabled = false; }
  }

  async function deleteTeacherBook(id) {
    if (!confirm('이 수행평가 단어장을 삭제할까요?\n학생에게서도 함께 사라집니다.')) return;
    try { await call('teacherDeleteBook', teacherToken(), { bookId: id }); await loadTeacherSetup(); }
    catch (e) { alert(e.message); }
  }

  async function openTeacherExamDialog(bookId) {
    try {
      var data = await call('teacherGetBook', teacherToken(), { bookId: bookId });
      if ((data.words || []).length < 4) { alert('공식 시험을 만들려면 단어가 최소 4개 필요합니다.'); return; }
      var overlay = document.createElement('div');
      overlay.className = 'hsm-sv-overlay';
      overlay.innerHTML = '<div class="hsm-sv-modal"><div class="hsm-sv-modal-head"><h2>수행평가 공식시험 출제</h2><button type="button" class="hsm-sv-close">닫기</button></div><div class="hsm-sv-card">' +
        '<div class="hsm-sv-field"><label>시험 제목</label><input id="hsmSvExamTitle" value="' + esc(data.title + ' 시험') + '"></div>' +
        '<div class="hsm-sv-row"><div class="hsm-sv-field"><label>문제 수</label><input id="hsmSvExamCount" type="number" min="4" max="' + data.words.length + '" value="' + Math.min(30, data.words.length) + '"></div>' +
        '<div class="hsm-sv-field"><label>문제 유형</label><select id="hsmSvExamMode"><option value="random">랜덤 출제</option><option value="engToKor">영어 → 한글</option><option value="korToEng">한글 → 영어</option><option value="mixed">영한·한영 혼합</option><option value="example">예문 문제</option></select></div></div>' +
        '<div class="hsm-sv-row"><div class="hsm-sv-field"><label>시작 일시</label><input id="hsmSvExamStart" type="datetime-local"></div><div class="hsm-sv-field"><label>마감 일시</label><input id="hsmSvExamEnd" type="datetime-local"></div></div>' +
        '<div class="hsm-sv-row"><div class="hsm-sv-field"><label>기준 점수</label><input id="hsmSvExamPass" type="number" min="0" max="100" value="80"></div><div class="hsm-sv-field"><label>옵션</label><label style="font-weight:600"><input id="hsmSvExamRetake" type="checkbox" style="width:auto"> 재응시 허용</label><label style="font-weight:600"><input id="hsmSvExamPoint" type="checkbox" checked style="width:auto"> 경험치/점수 지급</label></div></div>' +
        '<div class="hsm-sv-help">이 단어장을 배정받은 학생 ' + (data.students || []).length + '명에게 기존 선생님 시험 방식으로 배정됩니다.</div>' +
        '<div class="hsm-sv-actions"><button type="button" class="primary-btn" id="hsmSvExamCreate">시험 출제</button></div></div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('.hsm-sv-close').onclick = function () { overlay.remove(); };
      overlay.querySelector('#hsmSvExamCreate').onclick = async function () {
        var btn = this; btn.disabled = true;
        try {
          var result = await call('teacherCreateExam', teacherToken(), {
            bookId: bookId,
            title: overlay.querySelector('#hsmSvExamTitle').value,
            questionCount: Number(overlay.querySelector('#hsmSvExamCount').value),
            questionMode: overlay.querySelector('#hsmSvExamMode').value,
            startAt: overlay.querySelector('#hsmSvExamStart').value,
            deadlineAt: overlay.querySelector('#hsmSvExamEnd').value,
            passingScore: Number(overlay.querySelector('#hsmSvExamPass').value),
            allowRetake: overlay.querySelector('#hsmSvExamRetake').checked,
            givePoint: overlay.querySelector('#hsmSvExamPoint').checked
          });
          alert('수행평가 공식시험을 출제했습니다.\n' + result.questionCount + '문제 · ' + result.targetCount + '명');
          overlay.remove();
          if (typeof window.loadExamList === 'function') window.loadExamList();
        } catch (e) { alert(e.message); btn.disabled = false; }
      };
    } catch (e) { alert(e.message); }
  }

  function installTeacher() {
    if (!/teacher\.html/i.test(location.pathname) || !teacherToken()) return;
    var tabs = document.querySelector('.tabs');
    var app = document.querySelector('.app');
    if (!tabs || !app || document.getElementById('hsmSchoolVocabTeacherPanel')) return;
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'tab-btn'; button.textContent = '수행평가 단어장';
    tabs.appendChild(button);
    var panel = document.createElement('section'); panel.id = 'hsmSchoolVocabTeacherPanel'; panel.className = 'panel';
    app.appendChild(panel);
    button.onclick = function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      button.classList.add('active'); panel.classList.add('active'); loadTeacherSetup();
    };
  }

  function studentBookListHtml() {
    if (!state.student.books.length) return '<div class="hsm-sv-empty">아직 배정된 학교 수행평가 단어장이 없습니다.</div>';
    return state.student.books.map(function (b) {
      return '<div class="hsm-sv-book" data-hsm-sv-student-book="' + esc(b.bookId) + '"><div class="hsm-sv-book-title">' + esc(b.title) + '</div><div class="hsm-sv-meta">' + esc([b.schoolName,b.gradeLabel].filter(Boolean).join(' · ')) + '<br>단어 ' + Number(b.wordCount || 0) + '개</div><div class="hsm-sv-actions"><button type="button" class="primary-btn">단어장 열기</button></div></div>';
    }).join('');
  }

  async function openStudentRoot() {
    var old = document.getElementById('hsmSchoolVocabStudentOverlay'); if (old) old.remove();
    var overlay = document.createElement('div'); overlay.id = 'hsmSchoolVocabStudentOverlay'; overlay.className = 'hsm-sv-overlay';
    overlay.innerHTML = '<div class="hsm-sv-modal"><div class="hsm-sv-modal-head"><h2>학교 수행평가 단어장</h2><button type="button" class="hsm-sv-close">닫기</button></div><div id="hsmSvStudentBody"><div class="hsm-sv-card">불러오는 중입니다.</div></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.hsm-sv-close').onclick = function () { overlay.remove(); };
    try {
      state.student.books = await call('studentListBooks', studentToken());
      var body = overlay.querySelector('#hsmSvStudentBody');
      body.innerHTML = '<div class="hsm-sv-card"><div class="hsm-sv-help" style="margin:0 0 12px">선생님이 학교 수행평가용으로 배정한 단어장입니다. 연습시험은 월간 랭킹 포인트에는 반영되지 않습니다.</div><div class="hsm-sv-list">' + studentBookListHtml() + '</div></div>';
      body.onclick = function (e) { var card = e.target.closest('[data-hsm-sv-student-book]'); if (card) openStudentBook(card.getAttribute('data-hsm-sv-student-book')); };
    } catch (e) { overlay.querySelector('#hsmSvStudentBody').innerHTML = '<div class="hsm-sv-card"><div class="hsm-sv-empty">' + esc(e.message) + '</div></div>'; }
  }

  async function openStudentBook(bookId) {
    var overlay = document.getElementById('hsmSchoolVocabStudentOverlay'); if (!overlay) return;
    var body = overlay.querySelector('#hsmSvStudentBody'); body.innerHTML = '<div class="hsm-sv-card">단어장을 불러오는 중입니다.</div>';
    try {
      var data = await call('studentGetBook', studentToken(), { bookId: bookId }); state.student.currentBook = data;
      body.innerHTML = '<div class="hsm-sv-card"><div class="hsm-sv-actions" style="margin:0 0 12px"><button type="button" class="outline-btn" id="hsmSvBackBooks">목록으로</button></div>' +
        '<h2>' + esc(data.title) + '</h2><div class="hsm-sv-meta" style="margin-bottom:14px">' + esc([data.schoolName,data.gradeLabel].filter(Boolean).join(' · ')) + (data.description ? '<br>' + esc(data.description) : '') + '</div>' +
        '<div class="hsm-sv-row"><div class="hsm-sv-field"><label>연습시험 유형</label><select id="hsmSvSelfMode"><option value="mixed">영한·한영 혼합</option><option value="engToKor">영어 → 한글</option><option value="korToEng">한글 → 영어</option></select></div><div class="hsm-sv-field"><label>문제 수</label><input id="hsmSvSelfCount" type="number" min="4" max="' + data.words.length + '" value="' + Math.min(30, data.words.length) + '"></div></div>' +
        '<div class="hsm-sv-actions"><button type="button" class="primary-btn" id="hsmSvSelfStart"' + (data.words.length < 4 ? ' disabled' : '') + '>이 단어장으로 연습시험</button></div>' +
        '<div class="hsm-sv-help" style="margin:12px 0">연습시험은 자유롭게 여러 번 볼 수 있으며 랭킹 포인트에는 반영되지 않습니다.</div><div class="hsm-sv-word-list">' +
        data.words.map(function (w, i) { return '<div class="hsm-sv-word"><div class="hsm-sv-word-num">' + (i+1) + '</div><div class="hsm-sv-word-eng">' + esc(w.word) + '</div><div class="hsm-sv-word-mean">' + esc(w.meaning) + '</div></div>'; }).join('') + '</div></div>';
      body.querySelector('#hsmSvBackBooks').onclick = openStudentRoot;
      body.querySelector('#hsmSvSelfStart').onclick = function () { startStudentSelfTest(body.querySelector('#hsmSvSelfMode').value, Number(body.querySelector('#hsmSvSelfCount').value)); };
    } catch (e) { body.innerHTML = '<div class="hsm-sv-card"><div class="hsm-sv-empty">' + esc(e.message) + '</div></div>'; }
  }

  function startStudentSelfTest(mode, count) {
    var book = state.student.currentBook; if (!book || !book.words || book.words.length < 4) return;
    count = Math.max(4, Math.min(Number(count || book.words.length), book.words.length));
    var selected = shuffle(book.words).slice(0, count);
    var questions = selected.map(function (w, index) {
      var actualMode = mode === 'mixed' ? (index % 2 ? 'korToEng' : 'engToKor') : mode;
      var correct = actualMode === 'korToEng' ? w.word : w.meaning;
      var pool = book.words.map(function (x) { return actualMode === 'korToEng' ? x.word : x.meaning; }).filter(function (x) { return x && x !== correct; });
      return { word: w.word, meaning: w.meaning, mode: actualMode, prompt: actualMode === 'korToEng' ? w.meaning : w.word, correct: correct, options: shuffle([correct].concat(shuffle(Array.from(new Set(pool))).slice(0,3))) };
    });
    state.student.test = { mode: mode, questions: questions, index: 0, correct: 0, wrong: [] };
    renderStudentQuestion();
  }

  function renderStudentQuestion() {
    var overlay = document.getElementById('hsmSchoolVocabStudentOverlay'); var body = overlay && overlay.querySelector('#hsmSvStudentBody'); var test = state.student.test;
    if (!body || !test) return;
    if (test.index >= test.questions.length) { finishStudentSelfTest(); return; }
    var q = test.questions[test.index];
    body.innerHTML = '<div class="hsm-sv-test-card"><div class="hsm-sv-progress">' + (test.index + 1) + ' / ' + test.questions.length + ' · ' + (q.mode === 'korToEng' ? '뜻 → 영어' : '영어 → 뜻') + '</div><div class="hsm-sv-prompt">' + esc(q.prompt) + '</div><div class="hsm-sv-options">' + q.options.map(function (o) { return '<button type="button" class="hsm-sv-option" data-hsm-sv-answer="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div></div>';
    body.onclick = function (e) {
      var btn = e.target.closest('[data-hsm-sv-answer]'); if (!btn) return;
      var answer = btn.getAttribute('data-hsm-sv-answer');
      if (answer === q.correct) test.correct++; else test.wrong.push({ word: q.word, meaning: q.meaning, answer: answer, correct: q.correct });
      test.index++; renderStudentQuestion();
    };
  }

  async function finishStudentSelfTest() {
    var overlay = document.getElementById('hsmSchoolVocabStudentOverlay'); var body = overlay && overlay.querySelector('#hsmSvStudentBody'); var test = state.student.test; var book = state.student.currentBook;
    if (!body || !test || !book) return;
    var score = Math.round(test.correct / test.questions.length * 100);
    body.innerHTML = '<div class="hsm-sv-card"><div class="hsm-sv-result"><div class="hsm-sv-score">' + score + '점</div><div>정답 ' + test.correct + '개 / ' + test.questions.length + '개</div></div>' +
      (test.wrong.length ? '<h3>틀린 단어</h3><div class="hsm-sv-word-list">' + test.wrong.map(function (w) { return '<div class="hsm-sv-word"><div class="hsm-sv-word-num">×</div><div class="hsm-sv-word-eng">' + esc(w.word) + '</div><div class="hsm-sv-word-mean">' + esc(w.meaning) + '</div></div>'; }).join('') + '</div>' : '<div class="hsm-sv-empty">모두 맞았습니다.</div>') +
      '<div class="hsm-sv-actions"><button type="button" class="primary-btn" id="hsmSvSelfAgain">다시 시험보기</button><button type="button" class="outline-btn" id="hsmSvBackBook">단어장으로</button></div></div>';
    body.querySelector('#hsmSvSelfAgain').onclick = function () { startStudentSelfTest(test.mode, test.questions.length); };
    body.querySelector('#hsmSvBackBook').onclick = function () { openStudentBook(book.bookId); };
    try { await call('studentSaveSelfTestResult', studentToken(), { bookId: book.bookId, questionType: test.mode, questionCount: test.questions.length, correctCount: test.correct, wrongWords: test.wrong }); } catch (_) {}
  }

  function installStudentShortcut() {
    if (/teacher\.html/i.test(location.pathname) || !studentToken() || document.getElementById('hsmSchoolVocabShortcut')) return;
    var buttons = Array.prototype.slice.call(document.querySelectorAll('button.learning-shortcut'));
    var anchor = buttons.find(function (b) { return /나만의 단어장/.test(b.textContent || ''); });
    if (!anchor || !anchor.parentNode) return;
    var button = anchor.cloneNode(true);
    button.id = 'hsmSchoolVocabShortcut'; button.removeAttribute('onclick');
    var title = button.querySelector('.shortcut-title span:last-child'); if (title) title.innerHTML = '학교 수행평가 <span class="hsm-sv-launcher-badge">NEW</span>';
    var desc = button.querySelector('.shortcut-description'); if (desc) desc.textContent = '선생님이 배정한 학교 단어를 학습하고 연습시험을 봅니다.';
    button.onclick = openStudentRoot;
    anchor.insertAdjacentElement('afterend', button);
  }

  function start() {
    injectStyle();
    installTeacher();
    installStudentShortcut();
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++; installTeacher(); installStudentShortcut();
      if (attempts > 30 || document.getElementById('hsmSchoolVocabShortcut') || /teacher\.html/i.test(location.pathname)) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
