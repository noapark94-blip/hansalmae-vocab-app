(function () {
  'use strict';
  const screen = document.getElementById('signupScreen');
  if (!screen) return;
  const conceal = [];
  screen.querySelectorAll('[data-password-target]').forEach(function (button) {
    const input = document.getElementById(button.dataset.passwordTarget);
    if (!input) return;
    const label = button.getAttribute('aria-label').replace(/ 보기$/, '');
    function setVisible(visible) {
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', label + (visible ? ' 숨기기' : ' 보기'));
    }
    button.addEventListener('click', function () { setVisible(input.type === 'password'); });
    conceal.push(function () { setVisible(false); });
  });
  function hidePasswords() { conceal.forEach(function (hide) { hide(); }); }
  new MutationObserver(function () { if (screen.classList.contains('hidden')) hidePasswords(); })
    .observe(screen, {attributes:true, attributeFilter:['class']});
  window.addEventListener('pagehide', hidePasswords);
})();
