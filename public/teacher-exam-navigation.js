/* Ask before leaving an assigned exam, then navigate only after a successful stop. */
(function () {
  'use strict';
  let pending = false;
  window.isTeacherExamNavigationLocked_ = function () {
    return typeof teacherExamSession !== 'undefined' && !!teacherExamSession;
  };
  window.requestTeacherExamNavigation_ = async function (navigate) {
    if (pending) return;
    if (!window.isTeacherExamNavigationLocked_()) { navigate(); return; }
    pending = true;
    try {
      if (await stopAssignedTeacherExam_()) navigate();
    } finally { pending = false; }
  };
  // Runs before inline handlers, covering mobile menus, desktop menus and app back.
  document.addEventListener('click', function (event) {
    if (!window.isTeacherExamNavigationLocked_()) return;
    const el = event.target instanceof Element ? event.target : event.target.parentElement;
    const button = el && el.closest('button, a, [role="button"]');
    if (!button || !button.closest('#hsmMobileNav, #hsmMobileMore, #mainApp .topbar')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.requestTeacherExamNavigation_(function () { button.click(); });
  }, true);
})();
