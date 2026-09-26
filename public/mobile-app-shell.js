/* Keep document scrolling out of the mobile app: content and navigation occupy
   separate grid rows, so the navigation does not need viewport positioning. */
(function () {
  'use strict';
  const content = document.querySelector('body > .container');
  const nav = document.getElementById('hsmMobileNav');
  if (!content || !nav || document.getElementById('hsmMobileAppShell')) return;
  const shell = document.createElement('div');
  shell.id = 'hsmMobileAppShell';
  const scroll = document.createElement('div');
  scroll.id = 'hsmMobileAppScroll';
  content.before(shell);
  shell.append(scroll, nav);
  scroll.append(content);
  const mobile = window.matchMedia('(max-width:650px)');
  const nativeScrollTo = window.scrollTo.bind(window);
  let enabled = false;
  window.hsmGetPageScrollY_ = function () { return enabled ? scroll.scrollTop : window.scrollY; };
  window.scrollTo = function (x, y) {
    if (!enabled) return nativeScrollTo.apply(null, arguments);
    if (typeof x === 'object') scroll.scrollTo(x);
    else scroll.scrollTo(Number(x) || 0, Number(y) || 0);
  };
  function sync() {
    const next = mobile.matches && document.body.classList.contains('hsm-student-app-open');
    if (next === enabled) return;
    const top = enabled ? scroll.scrollTop : window.scrollY;
    enabled = next;
    document.documentElement.classList.toggle('hsm-mobile-shell-active', enabled);
    if (enabled) {
      nativeScrollTo(0, 0);
      scroll.scrollTop = top;
    } else nativeScrollTo(0, top);
  }
  new MutationObserver(sync).observe(document.body, { attributes:true, attributeFilter:['class'] });
  mobile.addEventListener('change', sync);
  sync();
})();
