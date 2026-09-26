(function () {
  'use strict';
  const input = document.getElementById('studentPassword');
  const button = document.getElementById('hsmPasswordVisibility');
  const login = document.getElementById('loginScreen');
  if (!input || !button || !login) return;
  function setVisible(visible) {
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', visible ? '비밀번호 숨기기' : '비밀번호 보기');
  }
  button.addEventListener('click', function () { setVisible(input.type === 'password'); });
  // Each visit to sign-in starts with the password concealed.
  new MutationObserver(function () { if (login.classList.contains('hidden')) setVisible(false); })
    .observe(login, {attributes:true, attributeFilter:['class']});
  window.addEventListener('pagehide', function () { setVisible(false); });
})();
