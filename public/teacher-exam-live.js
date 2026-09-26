/* Refresh only visible exam dashboards; never replace an active test. */
(function () {
  'use strict';
  var busy = false, lastKey = '', lastAt = 0;
  var teacher = /teacher\.html/i.test(location.pathname);
  var signatures = { list: '', status: '' };
  function shown(id, className) {
    var el = document.getElementById(id);
    return !!el && el.classList.contains(className);
  }
  function studentListVisible() {
    var el = document.getElementById('teacherExamHomeScreen');
    return el && !el.classList.contains('hidden') &&
      typeof currentStudent !== 'undefined' && currentStudent &&
      typeof currentLoginToken !== 'undefined' && currentLoginToken &&
      !(typeof teacherExamSession !== 'undefined' && teacherExamSession &&
        teacherExamSession.questions && teacherExamSession.questions.length);
  }
  function target() {
    if (document.hidden) return '';
    if (!teacher) return studentListVisible() ? 'student' : '';
    if (shown('loadingOverlay', 'show') || shown('detailModal', 'show')) return '';
    if (shown('statusModal', 'show') && currentStatusExamId) return 'status:' + currentStatusExamId;
    return shown('listPanel', 'active') ? 'list' : '';
  }
  function wrapRenderer(name, key) {
    var original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function (data) {
      original.apply(this, arguments);
      signatures[key] = JSON.stringify(data);
    };
  }
  if (teacher) {
    wrapRenderer('renderExamList', 'list');
    wrapRenderer('renderStatusModal', 'status');
  }
  async function refresh(force) {
    var key = target();
    var delay = key.indexOf('status:') === 0 ? 5000 : 10000;
    if (!key || busy || (key === lastKey && Date.now() - lastAt < (force ? 1000 : delay))) return;
    if (teacher && teacherApiInflight.size) return;
    busy = true; lastKey = key; lastAt = Date.now();
    try {
      if (teacher) {
        var result = key === 'list'
          ? await apiCall('teacherListExams')
          : await apiCall('teacherGetExamStatus', key.slice(7));
        if (target() !== key) return;
        // Preserve open menus and text selections during background refreshes.
        if (document.querySelector('.retake-menu-wrap.open, details[open]') || String(window.getSelection() || '')) return;
        var data = key === 'list' ? result.exams || [] : result;
        var signatureKey = key === 'list' ? 'list' : 'status';
        if (JSON.stringify(data) !== signatures[signatureKey]) {
          if (key === 'list') renderExamList(data);
          else renderStatusModal(data);
        }
      } else {
        var token = currentLoginToken;
        var assigned = await new Promise(function (resolve, reject) {
          google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)
            .studentGetAssignedExams(token);
        });
        if (target() !== key || currentLoginToken !== token) return;
        var exams = assigned && assigned.exams || [];
        var changed = JSON.stringify(exams) !== JSON.stringify(teacherAssignedExams);
        teacherAssignedExams = exams;
        teacherExamCache.exams = exams;
        teacherExamCache.examsAt = Date.now();
        if (changed) renderTeacherExamList_();
      }
    } catch (error) {
      // Keep the last successful view on transient network failures.
      console.warn('시험 현황 자동 갱신 실패', error);
    } finally {
      busy = false;
    }
  }
  window.setInterval(function () { refresh(false); }, 5000);
  window.addEventListener('focus', function () { refresh(true); });
  window.addEventListener('online', function () { refresh(true); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(true); });
})();
