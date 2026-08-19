(function hansalmaeUnifiedIcons() {
  'use strict';

  const paths = {
    trophy: '<path d="M8 4h8v4a4 4 0 0 1-8 0V4Zm0 2H4v1a4 4 0 0 0 4 4m8-5h4v1a4 4 0 0 1-4 4m-4 1v5m-4 3h8m-6-3h4"/>',
    bookmark: '<path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.8L6 21V4.8Z"/>',
    vocabAdd: '<path d="M5.5 5.5h10.8a1.7 1.7 0 0 1 1.7 1.7v11.3H7.2a1.7 1.7 0 0 1-1.7-1.7V5.5Z"/><path d="M10.8 5.5v6.2l2-1.35 2 1.35V5.5"/><circle cx="18.2" cy="17.8" r="4.1"/><path d="M18.2 15.8v4m-2-2h4"/>',
    test: '<path d="M7 4h10a2 2 0 0 1 2 2v14H5V6a2 2 0 0 1 2-2Zm3-1h4v4h-4V3Zm-1 9 2 2 4-4m-6 8h6"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm16 0A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m7 7 10 10M17 7 7 17"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8.2A7 7 0 0 1 18.7 7L20 12M4 12l1.3 5a7 7 0 0 0 12.6-1.2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7Zm4 11h4"/>',
    repeat: '<path d="m17 2 3 3-3 3M4 11V9a4 4 0 0 1 4-4h12m-13 17-3-3 3-3m13-3v2a4 4 0 0 1-4 4H4"/>',
    file: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h5M9 12h6m-6 4h6"/>',
    users: '<path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m6.5-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-1a3 3 0 0 0 0-6m4.5 17v-2a4 4 0 0 0-3-3.8"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11m6-11v11"/>',
    logout: '<path d="M10 4H5v16h5m5-4 4-4-4-4m4 4H9"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    shield: '<path d="M12 3 5 6v5c0 4.8 2.9 8 7 10 4.1-2 7-5.2 7-10V6l-7-3Zm-3 9 2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18m-13 4h3m2 0h3m-8 3h3"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>'
  };

  const emojiPrefix = /^[\s\uFE0F]*(?:[🏆⭐📝📚📖🔒✅❌✨🔥💡🎯📊📢🔔👤⚙️🎉🥇🥈🥉]+[\uFE0F\u200D]*)+\s*/u;

  function iconForText(text) {
    const value = String(text || '').replace(emojiPrefix, '').replace(/\s+/g, ' ').trim();
    if (!value) return '';
    if (/전체 안전 백업/.test(value)) return 'download';
    if (/CSV/.test(value)) return 'table';
    if (/로그아웃|나가기/.test(value)) return 'logout';
    if (/전체 삭제|삭제/.test(value)) return 'trash';
    if (/새로고침/.test(value)) return 'refresh';
    if (/미완료 알림|알림/.test(value)) return 'bell';
    if (/재응시|재시험/.test(value)) return 'repeat';
    if (/응시 현황|시험 대상|학생/.test(value)) return 'users';
    if (/시험 내용/.test(value)) return 'file';
    if (/시험 목록|생성한 시험/.test(value)) return 'list';
    if (/시험 만들기|시험 생성/.test(value)) return 'plus';
    if (/단어장.*(?:저장|추가)|단어장 저장|일괄 저장/.test(value)) return 'vocabAdd';
    if (/오답.*시험|시험보기|시험 보기|추천 단어 시험|단어 테스트|선생님 시험/.test(value)) return 'test';
    if (/단어장/.test(value)) return 'book';
    if (/단어천재|랭킹|업적|엠블럼 획득/.test(value)) return 'trophy';
    if (/비밀번호 초기화|내 정보/.test(value)) return 'user';
    if (/잠금/.test(value)) return 'lock';
    if (/정답/.test(value)) return 'check';
    if (/오답|취소/.test(value)) return 'close';
    return '';
  }

  function stripLeadingEmoji(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !emojiPrefix.test(node.nodeValue)) continue;
      node.nodeValue = node.nodeValue.replace(emojiPrefix, '');
      return;
    }
  }

  function buildIcon(name) {
    if (!paths[name]) return null;
    const span = document.createElement('span');
    span.className = 'hsm-ui-icon';
    span.setAttribute('aria-hidden', 'true');
    span.dataset.icon = name;
    span.innerHTML = '<svg viewBox="0 0 24 24" focusable="false">' + paths[name] + '</svg>';
    return span;
  }

  function decorateElement(element) {
    if (!element || element.nodeType !== 1 || element.dataset.hsmIconReady === '1') return;
    if (element.closest('.hsm-mobile-nav')) {
      element.dataset.hsmIconReady = '1';
      return;
    }
    /* 자체 section-icon 또는 이미 삽입된 공통 아이콘이 있으면 절대 하나 더 붙이지 않습니다. */
    if (element.querySelector(':scope > .section-icon, :scope > .hsm-ui-icon')) {
      element.dataset.hsmIconReady = '1';
      return;
    }
    const classIcon = element.classList.contains('hsm-picker-book-icon') ? 'book' : '';
    const name = element.dataset.hsmIcon || classIcon || iconForText(element.textContent);
    stripLeadingEmoji(element);
    if (!name || !paths[name]) {
      element.dataset.hsmIconReady = '1';
      return;
    }
    const icon = buildIcon(name);
    if (!icon) return;
    element.prepend(icon);
    element.classList.add('hsm-icon-label');
    element.dataset.hsmIconReady = '1';
  }

  function decorateRoot(root) {
    if (!root || root.nodeType !== 1) return;
    const selector = 'button, h2, h3, .hsm-picker-book-icon, .hsm-emblem-status, [data-hsm-icon]';
    if (root.matches(selector)) decorateElement(root);
    root.querySelectorAll(selector).forEach(decorateElement);
  }

  function start() {
    decorateRoot(document.body);
    if (typeof MutationObserver === 'undefined') return;
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(decorateRoot);
        const target = mutation.target && mutation.target.nodeType === 1
          ? mutation.target.closest('button, h2, h3, [data-hsm-icon]')
          : null;
        const hasDirectIcon = target && Array.prototype.some.call(target.children, function (child) {
          return child.classList && (child.classList.contains('hsm-ui-icon') || child.classList.contains('section-icon'));
        });
        if (target && !hasDirectIcon) {
          delete target.dataset.hsmIconReady;
          decorateElement(target);
        }
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  window.HSMIcons = { decorate: decorateRoot, create: buildIcon };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
