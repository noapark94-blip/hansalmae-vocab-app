(function () {
  'use strict';
  if (window.HSMDialog) return;
  var queue = [], active = null, sequence = 0;
  function messageText(value) { return String(value == null ? '' : value.message || value); }
  function settings(kind, value, initial) {
    if (value && typeof value === 'object' && value.title) return Object.assign({ kind: kind }, value);
    var text = messageText(value);
    var options = { kind: kind, title: kind === 'prompt' ? '내용 입력' : kind === 'confirm' ? '확인해주세요' : '안내', message: text, value: initial || '' };
    if (kind === 'confirm') {
      options.action = /삭제/.test(text) ? '삭제하기' : /로그아웃/.test(text) ? '로그아웃' : /제출/.test(text) ? '제출하기' : '진행하기';
      options.danger = /삭제|초기화/.test(text);
      if (/그만둘|다른 메뉴로 이동/.test(text)) Object.assign(options, { title: '시험을 그만둘까요?', message: '지금 나가면 진행 중인 시험 기록이 삭제돼요.', action: '나가기', cancel: '계속 풀기', danger: true });
    }
    if (kind === 'prompt') { options.title = text.split('\n')[0]; options.message = text.split('\n').slice(1).join('\n'); options.label = '입력 내용'; options.action = '확인'; }
    if (kind === 'alert' && /오류|실패|Load failed|Failed to fetch/.test(text)) {
      options.title = '잠시 문제가 생겼어요';
      options.message = /Load failed|Failed to fetch/.test(text) ? '서버에 연결하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해주세요.' : text;
    }
    return options;
  }
  function showNext() {
    if (active || !queue.length || !document.body) return;
    var item = active = queue.shift(), o = item.options;
    var d = document.createElement('dialog'), id = 'hsm-dialog-' + (++sequence);
    d.className = 'hsm-app-dialog';
    d.setAttribute('aria-labelledby', id + '-title');
    d.setAttribute('aria-describedby', id + '-message');
    d.innerHTML = '<form novalidate><div class="hsm-dialog-mark" aria-hidden="true"></div><h2></h2><p class="hsm-dialog-message"></p><div class="hsm-dialog-field" hidden><label></label><input autocomplete="off"><p class="hsm-dialog-validation" role="alert" hidden></p></div><div class="hsm-dialog-actions"><button type="button" data-cancel data-hsm-icon-ready="1"></button><button type="submit" data-accept data-hsm-icon-ready="1"></button></div></form>';
    d.querySelector('.hsm-dialog-mark').textContent = o.kind === 'prompt' ? '＋' : o.danger ? '!' : '✓';
    d.querySelector('h2').id = id + '-title';d.querySelector('h2').textContent = o.title;
    var message = d.querySelector('.hsm-dialog-message'); message.id = id + '-message'; message.textContent = o.message || '';message.hidden = !o.message;
    var cancel = d.querySelector('[data-cancel]'), accept = d.querySelector('[data-accept]'), input = d.querySelector('input');
    cancel.textContent = o.cancel || '취소'; cancel.hidden = o.kind === 'alert';
    accept.textContent = o.action || '확인';accept.classList.toggle('is-danger', !!o.danger);
    if (o.kind === 'alert') d.querySelector('.hsm-dialog-actions').classList.add('is-single');
    if (o.kind === 'prompt') {
      d.querySelector('.hsm-dialog-field').hidden = false;
      input.id = id + '-input';input.value = String(o.value || '');input.type = o.type || 'text';input.enterKeyHint = 'done';
      var label = d.querySelector('label');label.htmlFor = input.id;label.textContent = o.label || '입력 내용';
    }
    var previous = document.activeElement, settled = false;
    function finish(value) {
      if (settled) return;settled = true;
      d.close();d.remove();active = null;
      if (previous && previous.isConnected) previous.focus({preventScroll:true});
      item.resolve(value);showNext();
    }
    cancel.onclick = function () { finish(o.kind === 'prompt' ? null : false); };
    d.addEventListener('cancel', function (event) { event.preventDefault();finish(o.kind === 'prompt' ? null : false); });
    // Backdrop taps deliberately leave the decision open.
    d.querySelector('form').onsubmit = function (event) {
      event.preventDefault();
      if (o.kind === 'prompt' && !input.value.trim()) {
        var error = d.querySelector('.hsm-dialog-validation');error.textContent = '내용을 입력해주세요.';error.hidden = false;input.setAttribute('aria-invalid', 'true');input.focus();return;
      }
      finish(o.kind === 'prompt' ? input.value : true);
    };
    document.body.appendChild(d);d.showModal();
    if (o.kind === 'prompt') { input.focus();input.select(); }
    else (o.kind === 'confirm' ? cancel : accept).focus();
  }
  function request(kind, value, initial) {
    var options = settings(kind, value, initial), key = JSON.stringify(options);
    var existing = [active].concat(queue).find(function (item) { return item && item.key === key; });
    if (existing) return kind === 'alert' ? existing.promise : Promise.resolve(kind === 'prompt' ? null : false);
    var resolve, promise = new Promise(function (done) { resolve = done; });
    queue.push({ options: options, key: key, promise: promise, resolve: resolve });showNext();return promise;
  }
  window.HSMDialog = {
    alert: function (value) { return request('alert', value); },
    confirm: function (value) { return request('confirm', value); },
    prompt: function (value, initial) { return request('prompt', value, initial); }
  };
  document.addEventListener('DOMContentLoaded', showNext, {once:true});
})();
