(function () {
  'use strict';

  if (window.__HSM_WORD_COVER__) return;
  window.__HSM_WORD_COVER__ = true;

  var MODES = ['meaning', 'english', 'off'];
  var observer = null;
  var scheduled = false;

  function studentKey() {
    var token = localStorage.getItem('hansalmaeStudentToken') || '';
    try {
      var payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4) payload += '=';
      var parsed = JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(payload), function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')));
      return 'hsm_word_cover_mode_' + String(parsed.sub || 'student');
    } catch (_) {
      return 'hsm_word_cover_mode_student';
    }
  }

  function getMode() {
    var mode = localStorage.getItem(studentKey()) || 'off';
    return MODES.indexOf(mode) >= 0 ? mode : 'off';
  }

  function setMode(mode) {
    if (MODES.indexOf(mode) < 0) return;
    localStorage.setItem(studentKey(), mode);
    document.querySelectorAll('.hsm-cover-revealed').forEach(function (node) {
      node.classList.remove('hsm-cover-revealed');
      node.setAttribute('aria-pressed', 'false');
    });
    sync();
  }

  function addStyle() {
    if (document.getElementById('hsmWordCoverStyle')) return;
    var style = document.createElement('style');
    style.id = 'hsmWordCoverStyle';
    style.textContent = `
      .hsm-cover-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0 16px;padding:10px 11px;border:1px solid #eadce4;border-radius:16px;background:linear-gradient(135deg,#fff 0%,#fcf7fa 100%);box-shadow:0 7px 20px rgba(94,33,70,.055)}
      .hsm-cover-label{display:flex;align-items:center;gap:8px;min-width:0;color:#5d2947;font-size:13px;font-weight:850;white-space:nowrap}.hsm-cover-label svg{width:19px;height:19px;flex:none}
      .hsm-cover-segments{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:3px;border-radius:12px;background:#f1e7ed;min-width:0}
      .hsm-cover-segments button{width:auto!important;min-height:34px!important;margin:0!important;padding:7px 10px!important;border:0!important;border-radius:9px!important;background:transparent!important;box-shadow:none!important;color:#795e6d!important;font-family:inherit!important;font-size:12px!important;font-weight:800!important;line-height:1.2!important;white-space:nowrap;transition:background .18s ease,color .18s ease,box-shadow .18s ease,transform .12s ease}
      .hsm-cover-segments button:active{transform:scale(.97)}.hsm-cover-segments button.is-active{background:#fff!important;color:#8f145f!important;box-shadow:0 2px 8px rgba(86,25,62,.12)!important}
      .hsm-cover-target{position:relative!important;isolation:isolate;min-height:30px;cursor:pointer;border-radius:9px;outline:none;-webkit-tap-highlight-color:transparent}
      .hsm-cover-target::after{content:'눌러서 확인';position:absolute;z-index:3;inset:-3px -5px;display:flex;align-items:center;justify-content:center;padding:5px 8px;border:1px solid rgba(143,20,95,.12);border-radius:9px;background:linear-gradient(135deg,#f5e9f0 0%,#ead6e2 100%);color:#8d6178;font-size:11px;font-weight:850;letter-spacing:-.02em;box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 3px 9px rgba(84,27,61,.08);opacity:1;transform:translateX(0);transition:opacity .2s ease,transform .24s cubic-bezier(.22,.8,.28,1),visibility .2s ease;visibility:visible}
      .hsm-cover-target.hsm-cover-revealed::after{opacity:0;transform:translateX(10px);visibility:hidden;pointer-events:none}
      .hsm-cover-target:focus-visible{box-shadow:0 0 0 3px rgba(143,20,95,.2)}
      .hsm-school-word-eng.hsm-cover-target::after,.hsm-school-word-mean.hsm-cover-target::after{inset:-4px -4px}
      @media(max-width:560px){.hsm-cover-toolbar{align-items:stretch;flex-direction:column;gap:8px;padding:10px}.hsm-cover-label{padding:0 2px}.hsm-cover-segments{width:100%}.hsm-cover-segments button{padding:8px 5px!important}.hsm-cover-target::after{font-size:10px}}
      @media(prefers-reduced-motion:reduce){.hsm-cover-target::after,.hsm-cover-segments button{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function toolbar() {
    var bar = document.createElement('div');
    bar.className = 'hsm-cover-toolbar';
    bar.dataset.hsmCoverToolbar = '1';
    bar.innerHTML = '<div class="hsm-cover-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/></svg><span>암기 가림막</span></div><div class="hsm-cover-segments" role="group" aria-label="가림막 방향"><button type="button" data-cover-mode="meaning">뜻 가리기</button><button type="button" data-cover-mode="english">영어 가리기</button><button type="button" data-cover-mode="off">끄기</button></div>';
    bar.addEventListener('click', function (event) {
      var button = event.target.closest('[data-cover-mode]');
      if (button) setMode(button.dataset.coverMode);
    });
    return bar;
  }

  function ensureToolbar(list, marker) {
    if (!list || !list.parentElement) return;
    var parent = list.parentElement;
    var existing = parent.querySelector('[data-hsm-cover-for="' + marker + '"]');
    if (!existing) {
      existing = toolbar();
      existing.dataset.hsmCoverFor = marker;
      parent.insertBefore(existing, list);
    }
  }

  function schoolBookIsOpen() {
    var page = document.getElementById('hsmSchoolPageBody');
    return Boolean(page && page.querySelector('#hsmSchoolStartMixed') && page.querySelector('.hsm-school-word-list'));
  }

  function ensureToolbars() {
    var regular = document.getElementById('wordList');
    if (regular) ensureToolbar(regular, 'regular');
    var personal = document.getElementById('personalVocabularyList');
    if (personal) ensureToolbar(personal, 'personal');
    if (schoolBookIsOpen()) ensureToolbar(document.querySelector('#hsmSchoolPageBody .hsm-school-word-list'), 'school');
  }

  function wantedTargets() {
    var mode = getMode();
    if (mode === 'off') return [];
    var selectors = [];
    if (mode === 'meaning') {
      selectors.push('#vocabScreen:not(.hidden) #wordList .word-meaning');
      selectors.push('#personalVocabularyScreen:not(.hidden) #personalVocabularyList .wrong-note-meaning');
      if (schoolBookIsOpen()) selectors.push('#hsmSchoolPageBody .hsm-school-word-list .hsm-school-word-mean');
    } else {
      selectors.push('#vocabScreen:not(.hidden) #wordList .word-English');
      selectors.push('#personalVocabularyScreen:not(.hidden) #personalVocabularyList .personal-word');
      if (schoolBookIsOpen()) selectors.push('#hsmSchoolPageBody .hsm-school-word-list .hsm-school-word-eng');
    }
    return selectors.length ? Array.prototype.slice.call(document.querySelectorAll(selectors.join(','))) : [];
  }

  function prepareTarget(node) {
    if (node.dataset.hsmCoverReady === '1') return;
    node.dataset.hsmCoverReady = '1';
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-label', '가려진 내용을 확인');
    node.setAttribute('aria-pressed', 'false');
    var startX = 0;
    var suppressClick = false;
    node.addEventListener('pointerdown', function (event) { startX = event.clientX; });
    node.addEventListener('pointerup', function (event) {
      if (Math.abs(event.clientX - startX) < 80) return;
      suppressClick = true;
      reveal(node, true);
      window.setTimeout(function () { suppressClick = false; }, 0);
    });
    node.addEventListener('click', function () {
      if (suppressClick) return;
      reveal(node);
    });
    node.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        reveal(node);
      }
    });
  }

  function reveal(node, force) {
    var revealed = force ? true : !node.classList.contains('hsm-cover-revealed');
    node.classList.toggle('hsm-cover-revealed', revealed);
    node.setAttribute('aria-pressed', String(revealed));
    node.setAttribute('aria-label', revealed ? '내용 다시 가리기' : '가려진 내용을 확인');
  }

  function sync() {
    scheduled = false;
    addStyle();
    ensureToolbars();
    var mode = getMode();
    document.querySelectorAll('[data-cover-mode]').forEach(function (button) {
      var active = button.dataset.coverMode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    var wanted = wantedTargets();
    var wantedSet = new Set(wanted);
    document.querySelectorAll('.hsm-cover-target').forEach(function (node) {
      if (!wantedSet.has(node)) {
        node.classList.remove('hsm-cover-target', 'hsm-cover-revealed');
        node.removeAttribute('aria-pressed');
      }
    });
    wanted.forEach(function (node) {
      prepareTarget(node);
      node.classList.add('hsm-cover-target');
    });
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(sync);
  }

  function boot() {
    sync();
    observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    window.addEventListener('storage', scheduleSync);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
