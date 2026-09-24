(function () {
  'use strict';
  let dialog, returnFocus;
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'personalBookDialog';
    dialog.setAttribute('aria-labelledby', 'personalBookDialogTitle');
    dialog.innerHTML = '<form novalidate><div class="book-dialog-header"><h2 id="personalBookDialogTitle"></h2><button type="button" class="book-dialog-close" data-close data-hsm-icon-ready="1" aria-label="닫기" hidden>×</button></div><p class="book-dialog-description"></p><div class="book-dialog-body"></div><p class="book-dialog-error" role="alert" hidden></p><div class="book-dialog-actions"><button type="button" data-cancel data-hsm-icon-ready="1">취소</button><button type="submit" data-submit data-hsm-icon-ready="1">확인</button></div></form>';
    document.body.appendChild(dialog);
    dialog.querySelector('[data-cancel]').onclick = close;
    dialog.querySelector('[data-close]').onclick = close;
    dialog.addEventListener('cancel', function (event) {
      if (dialog.dataset.busy === 'true') event.preventDefault();
    });
    dialog.addEventListener('close', function () {
      if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    });
    dialog.addEventListener('click', function (event) {
      if (event.target !== dialog || dialog.dataset.busy === 'true') return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
    });
    return dialog;
  }
  function close() { if (dialog && dialog.dataset.busy !== 'true') dialog.close(); }
  function open(options) {
    const d = ensureDialog();
    if (d.open) return null;
    const management = document.querySelector('#personalVocabularyScreen .book-management');
    if (management) management.open = false;
    returnFocus = options.returnFocus || document.getElementById('personalBookPickerButton');
    d.dataset.busy = 'false';
    d.querySelector('h2').textContent = options.title;
    d.querySelector('.book-dialog-description').textContent = options.description || '';
    d.querySelector('.book-dialog-error').hidden = true;
    const body = d.querySelector('.book-dialog-body');
    body.replaceChildren();
    const submit = d.querySelector('[data-submit]');
    submit.textContent = options.action || '확인';
    submit.hidden = !!options.list;
    d.querySelector('[data-close]').hidden = !options.list;
    d.querySelector('.book-dialog-actions').hidden = !!options.list;
    submit.classList.toggle('is-danger', !!options.danger);
    d.querySelectorAll('button').forEach(b => { b.disabled = false; });
    d.querySelector('form').onsubmit = async function (event) {
      event.preventDefault();
      if (d.dataset.busy === 'true' || !options.onSubmit) return;
      const error = d.querySelector('.book-dialog-error');
      error.hidden = true;
      const input = body.querySelector('input');
      const value = input ? input.value.trim() : '';
      if (input && !value) {
        error.textContent = '단어장 이름을 입력해주세요.';
        error.hidden = false;
        input.focus();
        return;
      }
      d.dataset.busy = 'true';
      d.querySelectorAll('button').forEach(b => { b.disabled = true; });
      if (input) input.disabled = true;
      submit.textContent = '처리 중…';
      try {
        await options.onSubmit(value);
        d.dataset.busy = 'false';
        d.close();
      } catch (err) {
        error.textContent = String(err && err.message || err || '다시 시도해주세요.');
        error.hidden = false;
      } finally {
        d.dataset.busy = 'false';
        d.querySelectorAll('button').forEach(b => { b.disabled = false; });
        if (input) input.disabled = false;
        submit.textContent = options.action || '확인';
      }
    };
    if (options.input) {
      const label = document.createElement('label');
      label.htmlFor = 'personalBookNameInput';
      label.textContent = '단어장 이름';
      const input = document.createElement('input');
      input.id = 'personalBookNameInput';
      input.type = 'text';
      input.value = options.value || '';
      input.placeholder = '예: 시험 대비 단어';
      input.autocomplete = 'off';
      input.enterKeyHint = 'done';
      body.append(label, input);
    }
    return { d, body, show: function () {
      d.showModal();
      const input = body.querySelector('input');
      if (input) { input.focus(); input.select(); }
    } };
  }
  function request(method, args) {
    return new Promise(function (resolve, reject) {
      const runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);
      runner[method].apply(runner, args);
    });
  }
  const originalRender = window.renderPersonalBookSelect;
  window.renderPersonalBookSelect = function () {
    originalRender.apply(this, arguments);
    const select = document.getElementById('personalBookSelect');
    const button = document.getElementById('personalBookPickerButton');
    if (button && select) button.querySelector('span').textContent = select.selectedOptions[0]?.textContent || '단어장 선택';
  };
  window.openPersonalBookChoice = function () {
    const view = open({ title: '단어장 선택', description: '공부할 단어장을 골라주세요.', list: true });
    if (!view) return;
    if (!personalVocabularyBooks.length) {
      const empty = document.createElement('p');
      empty.textContent = '아직 만든 단어장이 없어요. 관리에서 새 단어장을 만들어주세요.';
      view.body.appendChild(empty);
    }
    personalVocabularyBooks.forEach(function (book) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.hsmIconReady = '1';
      button.className = 'book-dialog-option';
      const selected = String(book.bookId) === String(selectedPersonalBookId);
      button.setAttribute('aria-pressed', String(selected));
      const name = document.createElement('span');
      name.textContent = book.bookName;
      const count = document.createElement('small');
      count.textContent = Number(book.wordCount || 0) + '개';
      const check = document.createElement('span');
      check.className = 'book-dialog-check';
      check.textContent = selected ? '✓' : '';
      check.setAttribute('aria-hidden', 'true');
      button.append(name, count, check);
      button.onclick = function () {
        close();
        if (selected) return;
        document.getElementById('personalBookSelect').value = book.bookId;
        changePersonalBook();
        window.renderPersonalBookSelect();
      };
      view.body.appendChild(button);
    });
    view.show();
  };
  window.createNewPersonalBook = function (callback) {
    const view = open({ title: '새 단어장', description: '나만의 단어장에 이름을 붙여주세요.', input: true, action: '만들기', onSubmit: async function (name) {
      const result = await request('createVocabularyBook', [currentLoginToken, name]);
      selectedPersonalBookId = result && result.book ? result.book.bookId : '';
      loadPersonalBooks(function () {
        loadSelectedPersonalBookWords();
        if (typeof callback === 'function') callback(selectedPersonalBookId);
      });
    } });
    if (view) view.show();
  };
  window.renameCurrentPersonalBook = function () {
    const bookId = selectedPersonalBookId;
    if (!bookId) return window.createNewPersonalBook();
    const current = personalVocabularyBooks.find(b => String(b.bookId) === String(bookId));
    const view = open({ title: '이름 변경', description: '단어장의 새 이름을 입력해주세요.', input: true, value: current?.bookName || '', action: '저장', onSubmit: async function (name) {
      await request('renameVocabularyBook', [currentLoginToken, bookId, name]);
      loadPersonalBooks(loadSelectedPersonalBookWords);
    } });
    if (view) view.show();
  };
  window.deleteCurrentPersonalBook = function () {
    const bookId = selectedPersonalBookId;
    if (!bookId) return;
    const current = personalVocabularyBooks.find(b => String(b.bookId) === String(bookId));
    const view = open({ title: '단어장을 삭제할까요?', description: '「' + (current?.bookName || '이 단어장') + '」 안의 단어 ' + Number(current?.wordCount || 0) + '개도 함께 삭제됩니다.', action: '삭제', danger: true, onSubmit: async function () {
      await request('deleteVocabularyBook', [currentLoginToken, bookId]);
      selectedPersonalBookId = '';
      loadPersonalBooks(loadSelectedPersonalBookWords);
      loadPersonalVocabularyPreview();
    } });
    if (view) view.show();
  };
})();
