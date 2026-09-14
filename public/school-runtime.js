(function () {
  'use strict';
  var pending = new Map();
  var mainOwners = new Map();
  function userKey() {
    try { return JSON.parse(localStorage.getItem('hansalmaeStudentInfo') || '{}').studentId || ''; }
    catch (_) { return ''; }
  }
  function outboxKey() { return 'hsmSchoolOutbox:' + userKey(); }
  function readOutbox() {
    try { return JSON.parse(localStorage.getItem(outboxKey()) || '[]'); } catch (_) { return []; }
  }
  function writeOutbox(rows) { localStorage.setItem(outboxKey(), JSON.stringify(rows)); }
  window.hsmSchoolApi_ = async function (action, payload) {
    var owner = userKey();
    var token = window.hsmEnsureStudentSession_
      ? await window.hsmEnsureStudentSession_()
      : localStorage.getItem('hansalmaeStudentToken') || '';
    var api = String(window.HANSALMAE_CONFIG.apiUrl).replace(/\/api\/?$/, '/school-vocab');
    async function request(value) {
      if(owner !== userKey()) throw new Error("계정이 변경되었습니다. 다시 로그인해주세요.");
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 30000);
      try {
        var response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: action, token: value, payload: payload || {} }), signal: controller.signal });
        var data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || '요청을 처리하지 못했습니다. 다시 시도해주세요.');
        return data.result;
      } finally { clearTimeout(timeout); }
    }
    try { return await request(token); }
    catch (error) {
      if (/로그인.*(만료|확인)|로그인이 필요/.test(error.message) && window.hsmEnsureStudentSession_) {
        return request(await window.hsmEnsureStudentSession_(true));
      }
      throw error;
    }
  };
  function send(entry) {
    if (pending.has(entry.payload.requestId)) return pending.get(entry.payload.requestId);
    if(entry.owner && entry.owner !== userKey()) return Promise.reject(new Error("결과를 만든 계정으로 로그인해주세요."));
    var key = outboxKey();
    var job = window.hsmSchoolApi_(entry.action, entry.payload).then(function (result) {
      var rows = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(rows.filter(function (x) { return x.payload.requestId !== entry.payload.requestId; })));
      return result;
    }).finally(function () { pending.delete(entry.payload.requestId); });
    pending.set(entry.payload.requestId, job);
    return job;
  }
  window.hsmSaveSchoolResult_ = function (container, action, payload) {
    var entry = { owner: userKey(), action: action, payload: JSON.parse(JSON.stringify(payload)) };
    var rows = readOutbox();
    if (!rows.some(function (x) { return x.payload.requestId === payload.requestId; })) rows.push(entry);
    var persisted = true;
    try { writeOutbox(rows); } catch (_) { persisted = false; }
    var status = document.createElement('div');
    status.setAttribute('role', 'status'); status.dataset.hsmSavePending = '1';
    status.style.cssText = 'margin:14px 0;font-size:14px;line-height:1.5;color:#7b1653';
    container.appendChild(status);
    async function save() {
      status.textContent = '학습 결과를 저장하고 있습니다.';
      try {
        await send(entry);
        delete status.dataset.hsmSavePending;
        status.textContent = '학습 결과를 저장했습니다.';
      } catch (_) {
        status.textContent = persisted ? '저장하지 못했습니다. 결과는 이 기기에 보관되어 다음 접속 시 다시 저장됩니다. ' : '저장하지 못했습니다. 이 화면에서 다시 저장해주세요. ';
        var retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '다시 저장';
        retry.onclick = save; status.appendChild(retry);
      }
    }
    save();
  };
  function mainKey() { return 'hsmMainResultOutbox:' + userKey(); }
  function mainRows() { try { return JSON.parse(localStorage.getItem(mainKey()) || '[]'); } catch (_) { return []; } }
  window.hsmQueueMainResult_ = function (payload) {
    var rows=mainRows(), safe=JSON.parse(JSON.stringify(payload));
    delete safe.loginToken;delete safe.token;delete safe.refreshToken;
    if(!safe.requestId) return;
    mainOwners.set(safe.requestId,mainKey());
    if(!rows.some(function(x){return x.requestId===safe.requestId;}))rows.push(safe);
    try{localStorage.setItem(mainKey(),JSON.stringify(rows));}catch(_){}
  };
  window.hsmMainResultSaved_ = function(id) {
    try{var key=mainOwners.get(id)||mainKey();var rows=JSON.parse(localStorage.getItem(key)||'[]');localStorage.setItem(key,JSON.stringify(rows.filter(function(x){return x.requestId!==id;})));mainOwners.delete(id);}catch(_){}
  };
  async function flushMain() {
    if(!window.google || !window.google.script) return;
    var owner=userKey();
    for(var row of mainRows()) {
      if(owner!==userKey())return;
      var token=await window.hsmEnsureStudentSession_();
      if(owner!==userKey())return;
      try { await new Promise(function(resolve,reject){window.google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).saveTestResult(token,row);}); } catch (_) {}
    }
  }
  var flushing = false;
  async function flush() {
    if (flushing || !userKey() || !localStorage.getItem('hansalmaeStudentToken')) return;
    flushing = true;
    try { for (var entry of readOutbox()) { try { await send(entry); } catch (_) {} } await flushMain(); } catch (_) {}
    finally { flushing = false; }
  }
  window.addEventListener('hsm:student-session', function () { setTimeout(flush, 0); });
  window.addEventListener('online', flush);
})();
