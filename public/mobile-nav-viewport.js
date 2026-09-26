/* Anchor the mobile dock to the visible viewport after iOS keyboard/viewport changes. */
(function () {
  'use strict';
  var nav = document.getElementById('hsmMobileNav');
  if (!nav) return;
  var viewport = window.visualViewport;
  var mobile = window.matchMedia('(max-width: 650px)');
  var frame = 0, settleTimer = 0;
  function update() {
    frame = 0;
    if (!mobile.matches) {
      nav.style.removeProperty('--hsm-mobile-nav-top');
      return;
    }
    var height = nav.getBoundingClientRect().height;
    if (!height) return;
    // CSS includes the bottom safe area in this measured height exactly once.
    var visibleHeight = viewport ? viewport.height : window.innerHeight;
    var offsetTop = viewport ? viewport.offsetTop : 0;
    if (!(visibleHeight > 0)) return;
    var top = Math.max(0, offsetTop + visibleHeight - height);
    var value = Math.round(top * 100) / 100 + 'px';
    if (nav.style.getPropertyValue('--hsm-mobile-nav-top') !== value) {
      nav.style.setProperty('--hsm-mobile-nav-top', value);
    }
  }
  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(update);
  }
  function settle() {
    schedule();
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(schedule, 350);
  }
  if (viewport) {
    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);
  }
  window.addEventListener('resize', settle);
  window.addEventListener('orientationchange', settle);
  window.addEventListener('pageshow', settle);
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('focusout', settle);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) settle(); });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(schedule).observe(nav);
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (mobile.addEventListener) mobile.addEventListener('change', schedule);
  schedule();
})();
