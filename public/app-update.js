(function hansalmaeAppUpdateCoordinator() {
  'use strict';

  if (window.__HANSALMAE_APP_UPDATE_COORDINATOR__) return;
  window.__HANSALMAE_APP_UPDATE_COORDINATOR__ = true;

  var BUILD_VERSION = String(
    window.HANSALMAE_BUILD_VERSION || '20260902-3'
  );
  var RELOAD_GUARD_KEY = 'hsmAppUpdateReloadGuard';
  var UPDATED_TO_KEY = 'hsmAppUpdatedTo';
  var reloadGuardActive = false;
  var updatePending = false;
  var pendingTimer = 0;
  var lastUpdateCheck = 0;
  var registrationRef = null;

  try {
    reloadGuardActive =
      sessionStorage.getItem(RELOAD_GUARD_KEY) === BUILD_VERSION;
    if (reloadGuardActive) {
      window.setTimeout(function () {
        reloadGuardActive = false;
        try { sessionStorage.removeItem(RELOAD_GUARD_KEY); } catch (_error) {}
      }, 5000);
    }
  } catch (_error) {}

  function isVisible(element) {
    return Boolean(
      element &&
      !element.hidden &&
      !element.classList.contains('hidden')
    );
  }

  function isTestInProgress() {
    if (isVisible(document.getElementById('testScreen'))) return true;
    if (isVisible(document.getElementById('teacherExamTakingScreen'))) return true;

    var schoolPage = document.getElementById('hsmSchoolStudentPage');
    if (
      isVisible(schoolPage) &&
      schoolPage.querySelector('.hsm-school-test-wrap')
    ) return true;

    var schoolOverlay = document.getElementById('hsmSchoolVocabStudentOverlay');
    if (
      isVisible(schoolOverlay) &&
      schoolOverlay.querySelector('#hsmSvStudentBody .choice')
    ) return true;

    var contentPage = document.getElementById('hsmSchoolContentPage');
    if (
      isVisible(contentPage) &&
      contentPage.querySelector('.hsm-content-study')
    ) return true;

    return false;
  }

  function ensureToastStyle() {
    if (document.getElementById('hsmAppUpdateToastStyle')) return;
    var style = document.createElement('style');
    style.id = 'hsmAppUpdateToastStyle';
    style.textContent =
      '.hsm-app-update-toast{' +
        'position:fixed;left:50%;bottom:max(92px,calc(env(safe-area-inset-bottom) + 76px));' +
        'z-index:200500;max-width:calc(100vw - 32px);padding:11px 16px;' +
        'border:1px solid rgba(143,20,95,.16);border-radius:999px;' +
        'background:rgba(68,18,51,.94);color:#fff;' +
        'box-shadow:0 10px 30px rgba(50,13,38,.24);' +
        'font-size:13px;font-weight:750;line-height:1.4;text-align:center;' +
        'transform:translate(-50%,16px);opacity:0;' +
        'transition:opacity .2s ease,transform .2s ease;' +
        'pointer-events:none;white-space:nowrap' +
      '}' +
      '.hsm-app-update-toast.is-visible{opacity:1;transform:translate(-50%,0)}';
    document.head.appendChild(style);
  }

  function showToast(message, duration) {
    ensureToastStyle();
    var old = document.getElementById('hsmAppUpdateToast');
    if (old) old.remove();
    var toast = document.createElement('div');
    toast.id = 'hsmAppUpdateToast';
    toast.className = 'hsm-app-update-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    window.requestAnimationFrame(function () {
      toast.classList.add('is-visible');
    });
    if (duration > 0) {
      window.setTimeout(function () {
        toast.classList.remove('is-visible');
        window.setTimeout(function () { if (toast.parentNode) toast.remove(); }, 220);
      }, duration);
    }
  }

  function reloadWithNewController() {
    if (reloadGuardActive) return;
    reloadGuardActive = true;
    try {
      sessionStorage.setItem(RELOAD_GUARD_KEY, BUILD_VERSION);
      sessionStorage.setItem(UPDATED_TO_KEY, BUILD_VERSION);
    } catch (_error) {}
    window.location.reload();
  }

  function applyUpdateWhenSafe() {
    if (!updatePending) return;
    if (isTestInProgress()) {
      showToast('시험이 끝나면 최신 버전이 자동 적용됩니다.', 2600);
      if (!pendingTimer) {
        pendingTimer = window.setInterval(function () {
          if (!isTestInProgress()) {
            window.clearInterval(pendingTimer);
            pendingTimer = 0;
            reloadWithNewController();
          }
        }, 1500);
      }
      return;
    }
    reloadWithNewController();
  }

  function requestUpdateCheck(force) {
    if (!registrationRef || !navigator.onLine) return;
    var now = Date.now();
    if (!force && now - lastUpdateCheck < 60000) return;
    lastUpdateCheck = now;
    registrationRef.update().then(function () {
      if (registrationRef.waiting) {
        registrationRef.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }).catch(function () {});
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloadGuardActive) return;
      updatePending = true;
      applyUpdateWhenSafe();
    });

    var workerUrl = './service-worker.js?v=' + encodeURIComponent(BUILD_VERSION);
    navigator.serviceWorker.register(workerUrl, {
      updateViaCache: 'none'
    }).then(function (registration) {
      registrationRef = registration;

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', function () {
        var worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      requestUpdateCheck(true);
    }).catch(function (error) {
      console.error('서비스 워커 등록 실패:', error);
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) requestUpdateCheck(false);
    });
    window.addEventListener('focus', function () {
      requestUpdateCheck(false);
    });
    window.addEventListener('online', function () {
      requestUpdateCheck(true);
    });
  }

  function showAppliedMessage() {
    var updatedTo = '';
    try {
      updatedTo = sessionStorage.getItem(UPDATED_TO_KEY) || '';
      if (updatedTo) sessionStorage.removeItem(UPDATED_TO_KEY);
    } catch (_error) {}
    if (updatedTo) {
      showToast('최신 버전으로 업데이트되었습니다.', 2400);
    }
  }

  function start() {
    showAppliedMessage();
    registerServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
