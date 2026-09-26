/* Keep iOS document scrolling from moving the viewport's fixed navigation.
   The existing body scrolls; no app nodes or fixed overlays are reparented. */
(function () {
  'use strict';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let active = false;
  window.hsmPageScrollY_ = function () {
    return active ? document.body.scrollTop : window.scrollY;
  };
  if (!ios) return;
  const mobile = window.matchMedia('(max-width: 650px), (min-width: 651px) and (max-width: 1400px) and (min-height: 600px) and (pointer: coarse)');
  const root = document.documentElement;
  const body = document.body;
  const nativeScrollTo = window.scrollTo.bind(window);
  window.hsmResetChatViewportPan_ = function () {
    if (active && root.classList.contains('br-chat-keyboard') && (window.scrollX || window.scrollY || window.visualViewport?.offsetTop)) nativeScrollTo({left:0,top:0,behavior:'instant'});
  };
  window.scrollTo = function () {
    if (active) return body.scrollTo.apply(body, arguments);
    return nativeScrollTo.apply(window, arguments);
  };
  function sync() {
    const next = mobile.matches && body.classList.contains('hsm-student-app-open');
    if (next === active) return;
    const top = window.hsmPageScrollY_();
    active = next;
    root.classList.toggle('hsm-ios-body-scroll', active);
    if (active) {
      nativeScrollTo(0, 0);
      body.scrollTop = top;
    } else {
      body.scrollTop = 0;
      nativeScrollTo(0, top);
    }
  }
  new MutationObserver(sync).observe(body, {attributes: true, attributeFilter: ['class']});
  mobile.addEventListener('change', sync);
  sync();
})();
