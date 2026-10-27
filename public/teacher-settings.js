(function () {
  'use strict';
  var opener = document.getElementById('signupSettingsBtn');
  if (!opener) return;
  opener.addEventListener('click', function () {
    if (document.getElementById('signupSettings')) return;
    var dialog = document.createElement('dialog');
    dialog.id = 'signupSettings';
    dialog.setAttribute('aria-labelledby', 'signupSettingsTitle');
    dialog.innerHTML = '<header><div><small>관리자 설정</small><h2 id="signupSettingsTitle">가입코드 관리</h2></div><button type="button" data-close aria-label="설정 닫기">×</button></header><p class="signup-help">학생이 새로 가입할 때 사용하는 코드입니다.</p><form><section><label for="signupCurrent">현재 가입코드</label><div class="signup-code-row"><input id="signupCurrent" type="password" readonly autocomplete="off"><button type="button" data-show>보기</button><button type="button" data-copy>복사</button></div><p data-date></p></section><section><label for="signupNew">새 가입코드</label><div class="signup-code-row"><input id="signupNew" maxlength="8" minlength="6" pattern="[A-Za-z0-9]{6,8}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="영문·숫자 6~8자" required><button type="button" data-generate>자동 생성</button></div><p>변경하면 이전 코드로는 가입할 수 없습니다.<br>기존 학생의 로그인은 그대로 유지됩니다.</p></section><p data-status role="status" aria-live="polite"></p><button type="submit" class="signup-save">코드 변경</button></form>';
    document.body.appendChild(dialog);
    var form = dialog.querySelector('form'), current = dialog.querySelector('#signupCurrent'), next = dialog.querySelector('#signupNew');
    var status = dialog.querySelector('[data-status]'), revision = null, busy = true, loaded = false;
    function lock(value) { busy = value; form.querySelectorAll('button,input').forEach(function (el) { el.disabled = value; }); }
    function render(data) {
      current.value = data.code || ''; current.type = 'password';
      dialog.querySelector('[data-show]').textContent = '보기';
      revision = data.revision;
      dialog.querySelector('[data-date]').textContent = data.updatedAt ? '최근 변경 · ' + new Date(data.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '기존 가입코드 사용 중';
      loaded = true;
    }
    function close() { if (busy) return; dialog.close(); }
    dialog.querySelector('[data-close]').onclick = close;
    dialog.addEventListener('cancel', function (event) { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', function () { current.value = ''; next.value = ''; dialog.remove(); opener.focus(); });
    dialog.querySelector('[data-show]').onclick = function () {
      current.type = current.type === 'password' ? 'text' : 'password';
      this.textContent = current.type === 'password' ? '보기' : '숨기기';
    };
    dialog.querySelector('[data-copy]').onclick = async function () {
      try { await navigator.clipboard.writeText(current.value); status.textContent = '가입코드를 복사했습니다.'; }
      catch (_) { current.type = 'text'; dialog.querySelector('[data-show]').textContent = '숨기기'; current.focus(); current.select(); status.textContent = '코드를 길게 눌러 복사해주세요.'; }
    };
    dialog.querySelector('[data-generate]').onclick = function () {
      var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', result = '';
      while (result.length < 8) { var value = crypto.getRandomValues(new Uint8Array(1))[0]; if (value < Math.floor(256 / alphabet.length) * alphabet.length) result += alphabet[value % alphabet.length]; }
      next.value = result;
    };
    next.addEventListener('input', function () { next.value = next.value.toUpperCase(); });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (busy || !loaded || !form.reportValidity()) return;
      var code = next.value.trim().toUpperCase();
      if (code === current.value) { status.textContent = '현재 코드와 다른 코드를 입력해주세요.'; return; }
      lock(true);
      try {
        var confirmed = await window.HSMDialog.confirm({ title: '가입코드를 변경할까요?', message: '이전 코드로는 새로 가입할 수 없습니다. 학생들에게 새 코드를 안내해주세요.', action: '변경하기' });
        if (!confirmed) return;
        status.textContent = '변경 중…';
        render(await apiCall('teacherUpdateSignupCode', { code: code, revision: revision }));
        next.value = ''; status.textContent = '가입코드를 변경했습니다.';
      } catch (error) { status.textContent = error.message || '변경하지 못했습니다. 설정을 다시 열어 확인해주세요.'; }
      finally { if (dialog.isConnected) lock(false); }
    });
    dialog.showModal(); lock(true); status.textContent = '설정을 불러오는 중…';
    apiCall('teacherGetSignupCode').then(function (data) {
      if (!dialog.isConnected) return; render(data); status.textContent = ''; lock(false);
    }).catch(function (error) { busy = false; status.textContent = error.message || '설정을 불러오지 못했습니다.'; });
  });
})();
