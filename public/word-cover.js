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
    document.querySelectorAll('.hsm-cover-companion').forEach(function (node) {
      node.classList.remove('hsm-cover-companion', 'hsm-cover-companion-revealed');
    });
    sync();
  }

  function addStyle() {
    if (document.getElementById('hsmWordCoverStyle')) return;
    var style = document.createElement('style');
    style.id = 'hsmWordCoverStyle';
    style.textContent = `
      .hsm-cover-toolbar{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:9px;margin:12px 0 14px;padding:8px 9px;border:1px solid #eadce4;border-radius:14px;background:linear-gradient(135deg,#fff 0%,#fcf7fa 100%);box-shadow:0 5px 16px rgba(94,33,70,.05)}
      .hsm-cover-label{display:flex;align-items:center;gap:8px;min-width:0;color:#5d2947;font-size:13px;font-weight:850;white-space:nowrap}.hsm-cover-label svg{width:19px;height:19px;flex:none}
      .hsm-cover-segments{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;width:100%;padding:3px;border-radius:11px;background:#f1e7ed;min-width:0}
      .hsm-cover-segments button{width:auto!important;min-width:0!important;min-height:32px!important;margin:0!important;padding:6px 7px!important;border:0!important;border-radius:8px!important;background:transparent!important;box-shadow:none!important;color:#795e6d!important;font-family:inherit!important;font-size:11.5px!important;font-weight:800!important;line-height:1.2!important;white-space:nowrap;transition:background .18s ease,color .18s ease,box-shadow .18s ease,transform .12s ease}
      .hsm-cover-segments button:active{transform:scale(.97)}.hsm-cover-segments button.is-active{background:#fff!important;color:#8f145f!important;box-shadow:0 2px 8px rgba(86,25,62,.12)!important}
      .hsm-cover-target{position:relative!important;isolation:isolate;display:flex!important;align-items:center;min-width:0;min-height:42px;cursor:pointer;border-radius:10px;outline:none;-webkit-tap-highlight-color:transparent}
      .word-English.hsm-cover-target,.personal-word.hsm-cover-target,.wrong-note-word.hsm-cover-target{flex:1 1 160px!important;width:auto!important;align-self:stretch}
      .word-meaning.hsm-cover-target,.wrong-note-meaning.hsm-cover-target,.hsm-school-word-eng.hsm-cover-target,.hsm-school-word-mean.hsm-cover-target{width:100%!important}
      #wrongNotebookList .wrong-note-top>.wrong-note-word{width:100%;min-width:0}
      #wrongNotebookList .wrong-note-top>.wrong-note-word.hsm-cover-target{flex:0 1 auto!important;align-self:flex-start!important;width:fit-content!important;min-width:min(160px,100%)!important;max-width:100%!important;min-height:46px}
      #wrongNotebookList .wrong-note-meta.hsm-wrong-meta-row{display:flex!important;align-items:center;flex-wrap:wrap;gap:7px;margin:9px 0 0!important;color:#8b7b84!important;text-align:left!important;font-size:12px!important;line-height:1.35!important}
      #wrongNotebookList .hsm-wrong-count{display:inline-flex;align-items:center;min-height:25px;padding:4px 9px;border:1px solid #ead2df;border-radius:999px;background:#f9edf3;color:#8f145f;font-weight:850;white-space:nowrap}
      #wrongNotebookList .hsm-wrong-date{color:#8b7b84;font-weight:650;white-space:nowrap}
      .hsm-cover-target::after{content:'눌러서 확인';position:absolute;z-index:3;inset:0;display:flex;align-items:center;justify-content:center;padding:5px 8px;border:1px solid rgba(143,20,95,.12);border-radius:10px;background:linear-gradient(135deg,#f5e9f0 0%,#ead6e2 100%);color:#8d6178;font-size:11px;font-weight:850;line-height:1.2;white-space:nowrap;letter-spacing:-.02em;box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 3px 9px rgba(84,27,61,.08);opacity:1;transform:translateX(0);transition:opacity .2s ease,transform .24s cubic-bezier(.22,.8,.28,1),visibility .2s ease;visibility:visible}
      .hsm-cover-target.hsm-cover-revealed::after{opacity:0;transform:translateX(10px);visibility:hidden;pointer-events:none}
      .hsm-cover-target:focus-visible{box-shadow:0 0 0 3px rgba(143,20,95,.2)}
      .hsm-cover-companion{filter:blur(7px);opacity:.22!important;user-select:none;pointer-events:none;transition:filter .2s ease,opacity .2s ease}
      .hsm-cover-companion.hsm-cover-companion-revealed{filter:none;opacity:1!important;user-select:auto;pointer-events:auto}
      #vocabLoading:empty,#personalVocabularyLoading:empty,#wrongNotebookLoading:empty{display:none!important}
      @media(max-width:560px){.hsm-cover-toolbar{grid-template-columns:22px minmax(0,1fr);gap:6px;padding:7px 8px}.hsm-cover-label{justify-content:center}.hsm-cover-label span{display:none}.hsm-cover-label svg{width:18px;height:18px}.hsm-cover-segments button{padding:7px 3px!important;font-size:11px!important}.hsm-cover-target::after{font-size:10.5px}}
      @media(prefers-reduced-motion:reduce){.hsm-cover-target::after,.hsm-cover-segments button,.hsm-cover-companion{transition:none!important}}
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

  function ensureToolbar(list, marker, beforeNode) {
    if (!list || !list.parentElement) return;
    var parent = list.parentElement;
    var existing = parent.querySelector('[data-hsm-cover-for="' + marker + '"]');
    if (!existing) {
      existing = toolbar();
      existing.dataset.hsmCoverFor = marker;
    }
    var reference = beforeNode && beforeNode.parentElement === parent ? beforeNode : list;
    if (existing.nextSibling !== reference) parent.insertBefore(existing, reference);
  }

  function schoolBookIsOpen() {
    var page = document.getElementById('hsmSchoolPageBody');
    return Boolean(page && page.querySelector('.hsm-school-word-list') &&
      (page.querySelector('#hsmSchoolTestButton') || page.querySelector('#hsmSchoolSelectBar') || page.querySelector('#hsmSchoolStartMixed')) &&
      !page.querySelector('.hsm-school-test-wrap,.hsm-school-free-card'));
  }

  function ensureToolbars() {
    var regular = document.getElementById('wordList');
    if (regular) ensureToolbar(regular, 'regular', document.getElementById('vocabLoading'));
    var personal = document.getElementById('personalVocabularyList');
    if (personal) ensureToolbar(personal, 'personal', document.getElementById('personalVocabularyLoading'));
    var wrong = document.getElementById('wrongNotebookList');
    if (wrong) ensureToolbar(wrong, 'wrong', document.getElementById('wrongNotebookLoading'));
    if (schoolBookIsOpen()) {
      var schoolList = document.querySelector('#hsmSchoolPageBody .hsm-school-word-list');
      ensureToolbar(schoolList, 'school', document.getElementById('hsmSchoolSelectBar'));
    }
  }

  function wantedTargets() {
    var mode = getMode();
    if (mode === 'off') return [];
    var selectors = [];
    if (mode === 'meaning') {
      selectors.push('#vocabScreen:not(.hidden) #wordList .word-meaning');
      selectors.push('#personalVocabularyScreen:not(.hidden) #personalVocabularyList .wrong-note-meaning');
      selectors.push('#wrongNotebookScreen:not(.hidden) #wrongNotebookList .wrong-note-meaning');
      if (schoolBookIsOpen()) selectors.push('#hsmSchoolPageBody .hsm-school-word-list .hsm-school-word-mean');
    } else {
      selectors.push('#vocabScreen:not(.hidden) #wordList .word-English');
      selectors.push('#personalVocabularyScreen:not(.hidden) #personalVocabularyList .personal-word');
      selectors.push('#wrongNotebookScreen:not(.hidden) #wrongNotebookList .wrong-note-word');
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

  function companionsFor(node) {
    var mode = getMode();
    var card = node.closest('.word-card,.personal-item,.wrong-note-item');
    if (!card) return [];
    var selector = mode === 'meaning'
      ? '.word-translation,.wrong-note-translation'
      : '.word-example,.wrong-note-example';
    return Array.prototype.slice.call(card.querySelectorAll(selector));
  }

  function reveal(node, force) {
    var revealed = force ? true : !node.classList.contains('hsm-cover-revealed');
    node.classList.toggle('hsm-cover-revealed', revealed);
    node.setAttribute('aria-pressed', String(revealed));
    node.setAttribute('aria-label', revealed ? '내용 다시 가리기' : '가려진 내용을 확인');
    companionsFor(node).forEach(function (companion) {
      companion.classList.toggle('hsm-cover-companion-revealed', revealed);
    });
  }

  function seoulDateParts(date) {
    var parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(date);
    var values = {};
    parts.forEach(function (part) {
      if (part.type !== 'literal') values[part.type] = Number(part.value);
    });
    return values;
  }

  function formatWrongNoteDate(raw) {
    var date = new Date(String(raw || '').trim());
    if (Number.isNaN(date.getTime())) return '최근 기록';
    var value = seoulDateParts(date);
    var today = seoulDateParts(new Date());
    return value.year === today.year
      ? '최근 ' + value.month + '월 ' + value.day + '일'
      : '최근 ' + value.year + '. ' + value.month + '. ' + value.day + '.';
  }

  function polishWrongNoteMeta() {
    document.querySelectorAll('#wrongNotebookList .wrong-note-item .wrong-note-meta').forEach(function (meta) {
      if (meta.dataset.hsmWrongMetaPolished === '1') return;
      var text = meta.textContent.replace(/\s+/g, ' ').trim();
      var countMatch = text.match(/틀린\s*횟수\s*(\d+)\s*회/);
      var recentMatch = text.match(/최근\s+(.+)$/);
      var count = countMatch ? countMatch[1] : '0';
      var countBadge = document.createElement('span');
      var dateLabel = document.createElement('span');
      countBadge.className = 'hsm-wrong-count';
      dateLabel.className = 'hsm-wrong-date';
      countBadge.textContent = count + '회 오답';
      dateLabel.textContent = formatWrongNoteDate(recentMatch ? recentMatch[1] : '');
      meta.textContent = '';
      meta.appendChild(countBadge);
      meta.appendChild(dateLabel);
      meta.classList.add('hsm-wrong-meta-row');
      meta.dataset.hsmWrongMetaPolished = '1';
      var card = meta.closest('.wrong-note-item');
      var meaning = card && card.querySelector('.wrong-note-meaning');
      if (meaning && meaning.nextElementSibling !== meta) meaning.insertAdjacentElement('afterend', meta);
    });
  }

  function sync() {
    scheduled = false;
    addStyle();
    ensureToolbars();
    polishWrongNoteMeta();
    var mode = getMode();
    document.querySelectorAll('[data-cover-mode]').forEach(function (button) {
      var active = button.dataset.coverMode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    var wanted = wantedTargets();
    var wantedSet = new Set(wanted);
    var desiredCompanions = new Set();
    wanted.forEach(function (node) {
      companionsFor(node).forEach(function (companion) {
        desiredCompanions.add(companion);
      });
    });
    document.querySelectorAll('.hsm-cover-companion').forEach(function (node) {
      if (!desiredCompanions.has(node)) {
        node.classList.remove('hsm-cover-companion', 'hsm-cover-companion-revealed');
      }
    });
    document.querySelectorAll('.hsm-cover-target').forEach(function (node) {
      if (!wantedSet.has(node)) {
        node.classList.remove('hsm-cover-target', 'hsm-cover-revealed');
        node.removeAttribute('aria-pressed');
      }
    });
    wanted.forEach(function (node) {
      prepareTarget(node);
      node.classList.add('hsm-cover-target');
      companionsFor(node).forEach(function (companion) {
        companion.classList.add('hsm-cover-companion');
        companion.classList.toggle('hsm-cover-companion-revealed', node.classList.contains('hsm-cover-revealed'));
      });
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
