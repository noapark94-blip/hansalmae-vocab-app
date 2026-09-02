import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = new URL('../', import.meta.url);
const teacherScript = fs.readFileSync(new URL('public/school-content-teacher.js', root), 'utf8');
const studentScript = fs.readFileSync(new URL('public/school-content-student.js', root), 'utf8');
const schoolVocabScript = fs.readFileSync(new URL('public/school-vocab-student-page.js', root), 'utf8');
const schoolVocabNavScript = fs.readFileSync(new URL('public/school-vocab-nav-close-fix.js', root), 'utf8');
const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const click = (window, element) => element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

async function verifyTeacher() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html><head></head><body><main class="app"><nav class="tabs"><button class="tab-btn active">시험 만들기</button></nav><section class="panel active"></section></main></body></html>', {
    url: 'http://localhost/teacher.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.sessionStorage.setItem('hansalmaeTeacherToken', 'teacher-test');
  window.alert = () => {};
  window.confirm = () => true;
  window.HANSALMAE_CONFIG = { apiUrl: 'https://example.supabase.co/functions/v1/api' };
  const requests = [];
  window.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    const result = request.action === 'teacherContentSetup'
      ? { books: [], students: [{ studentId: 's001', studentName: '테스트학생', grade: '고1' }] }
      : request.action === 'teacherSaveContentBook'
        ? { bookId: 'b1', sentenceCount: 1, studentCount: 1 }
        : {};
    return { ok: true, json: async () => ({ success: true, result }) };
  };
  window.eval(teacherScript);
  await wait(350);
  const tab = window.document.querySelector("button[data-tab='hsmSchoolContentTeacherPanel']");
  assert.ok(tab, '학교 내신 선생님 탭이 생성되어야 합니다.');
  click(window, tab);
  await wait(20);
  assert.ok(window.document.querySelector('#hsmSchoolContentTeacherPanel.active'));
  const bulk = window.document.querySelector('#hsmScBulk');
  bulk.value = 'Having surveyed many customers / they found the result.\t많은 고객을 조사한 후 그들은 결과를 발견했다.';
  click(window, window.document.querySelector('#hsmScBuild'));
  assert.equal(window.document.querySelectorAll('[data-sc-sentence]').length, 1);
  assert.equal(window.document.querySelectorAll('[data-sc-chunk]').length, 2);
  click(window, window.document.querySelector('[data-sc-add-morph]'));
  const set = (field, value) => {
    const input = window.document.querySelector(`[data-mf="${field}"]`);
    input.value = value;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  set('answerText', 'Having surveyed');
  set('prompt', 'survey');
  set('answers', 'After surveying');
  set('hint', '분사구문');
  const student = window.document.querySelector('[data-sc-student]');
  student.checked = true;
  student.dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.querySelector('#hsmScTitle').value = '고1 3과 본문';
  click(window, window.document.querySelector('#hsmScSave'));
  await wait(20);
  const save = requests.find((request) => request.action === 'teacherSaveContentBook');
  assert.ok(save, '본문 저장 API가 호출되어야 합니다.');
  assert.deepEqual(save.payload.studentIds, ['s001']);
  assert.equal(save.payload.sentences[0].chunks[0].morphs[0].answerText, 'Having surveyed');
  assert.equal(save.payload.sentences[0].chunks[0].morphs[0].prompt, 'survey');
  assert.deepEqual(save.payload.sentences[0].chunks[0].morphs[0].answers, ['After surveying']);
  assert.deepEqual(errors, []);
  dom.window.close();
}

async function verifyStudent() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html><head></head><body><div class="learning-shortcuts"><button id="hsmSchoolVocabShortcut" class="learning-shortcut"><div class="shortcut-title"><span>아이콘</span><span>학교 수행평가</span></div><div class="shortcut-description">설명</div><div class="shortcut-count">0개</div></button></div></body></html>', {
    url: 'http://localhost/index.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.localStorage.setItem('hansalmaeStudentToken', 'student-test');
  window.alert = () => {};
  const confirms = [];
  window.confirm = (message) => { confirms.push(message); return false; };
  window.HANSALMAE_CONFIG = { apiUrl: 'https://example.supabase.co/functions/v1/api' };
  const sentence = {
    id: 's1',
    translation: '많은 고객을 조사한 후 그들은 결과를 발견했다.',
    chunks: [
      { id: 'c1', text: 'Having surveyed many customers', morphs: [{ id: 'm1', answerText: 'Having surveyed', prompt: 'survey', answers: ['Having surveyed'], hint: '분사구문', caseSensitive: false }] },
      { id: 'c2', text: 'they found', morphs: [] },
      { id: 'c3', text: 'the result.', morphs: [] },
    ],
  };
  const requests = [];
  window.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    let result = {};
    if (request.action === 'studentListContentBooks') result = [{ bookId: 'b1', title: '고1 3과 본문', sentenceCount: 1 }];
    if (request.action === 'studentGetContentBook') result = { bookId: 'b1', title: '고1 3과 본문', sentences: [sentence] };
    if (request.action === 'studentSaveContentResult') result = { success: true, score: 100 };
    return { ok: true, json: async () => ({ success: true, result }) };
  };
  window.eval(studentScript);
  await wait(20);
  const shortcut = window.document.querySelector('#hsmSchoolContentShortcut');
  assert.ok(shortcut, '학생 학교 내신 바로가기 카드가 생성되어야 합니다.');
  click(window, shortcut);
  await wait(20);
  click(window, window.document.querySelector('[data-content-book]'));
  await wait(20);
  click(window, window.document.querySelector('#hsmContentStart'));
  click(window, window.document.querySelector('.hsm-ct-back'));
  assert.equal(window.document.querySelector('#hsmSchoolContentPage').hidden, false, '시험 종료를 취소하면 시험 화면에 남아야 합니다.');
  assert.match(confirms[0], /현재 시험을 그만둘까요/);
  assert.match(confirms[0], /진행 내용은 삭제됩니다/);
  assert.ok(window.document.querySelector('.hsm-content-study'), '시험 종료 취소 후 진행 중인 문제가 유지되어야 합니다.');
  for (const id of ['c1', 'c2', 'c3']) {
    click(window, window.document.querySelector(`[data-pool-id="${id}"]`));
  }
  const morphInput = window.document.querySelector('[data-morph-id="m1"]');
  assert.ok(morphInput, '어형 변형 입력칸이 표시되어야 합니다.');
  morphInput.value = 'Having surveyed';
  click(window, window.document.querySelector('#hsmContentCheck'));
  assert.match(window.document.querySelector('#hsmContentFeedback').textContent, /배열 ✓ 정답/);
  assert.match(window.document.querySelector('#hsmContentFeedback').textContent, /어형 ✓ 정답/);
  click(window, window.document.querySelector('#hsmContentNext'));
  await wait(20);
  const save = requests.find((request) => request.action === 'studentSaveContentResult');
  assert.ok(save, '학생 학습 결과 저장 API가 호출되어야 합니다.');
  assert.equal(save.payload.sentenceCorrectCount, 1);
  assert.equal(save.payload.orderCorrectCount, 1);
  assert.equal(save.payload.morphCorrectCount, 1);
  assert.deepEqual(errors, []);
  dom.window.close();
}

async function verifySchoolVocabExit() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><html><head></head><body><button id="hsmSchoolVocabShortcut" class="learning-shortcut"><span class="shortcut-title"><span>학교 수행평가</span></span></button><button id="outsideNav">단어장</button></body></html>', {
    url: 'http://localhost/index.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  window.localStorage.setItem('hansalmaeStudentToken', 'student-test');
  window.alert = () => {};
  let allowExit = false;
  const confirms = [];
  window.confirm = (message) => { confirms.push(message); return allowExit; };
  window.HANSALMAE_CONFIG = { apiUrl: 'https://example.supabase.co/functions/v1/api' };
  const words = [
    { word: 'send', meaning: '보내다' },
    { word: 'life', meaning: '삶' },
    { word: 'forest', meaning: '숲' },
    { word: 'support', meaning: '지지하다' },
  ];
  window.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const result = request.action === 'studentListBooks'
      ? [{ bookId: 'b1', title: '학교 내신단어', wordCount: words.length }]
      : request.action === 'studentGetBook'
        ? { bookId: 'b1', title: '학교 내신단어', words }
        : {};
    return { ok: true, json: async () => ({ success: true, result }) };
  };
  window.eval(schoolVocabScript);
  window.eval(schoolVocabNavScript);
  await wait(20);
  click(window, window.document.querySelector('#hsmSchoolVocabShortcut'));
  await wait(20);
  click(window, window.document.querySelector('[data-book]'));
  await wait(20);
  click(window, window.document.querySelector('#hsmSchoolStartMixed'));
  click(window, window.document.querySelector('.hsm-school-back'));
  assert.equal(window.document.querySelector('#hsmSchoolStudentPage').hidden, false, '종료 취소 시 수행평가 시험이 유지되어야 합니다.');
  assert.ok(window.document.querySelector('.hsm-school-test-wrap'));
  assert.match(confirms[0], /현재 시험을 그만둘까요/);
  click(window, window.document.querySelector('#outsideNav'));
  assert.equal(window.document.querySelector('#hsmSchoolStudentPage').hidden, false, '하단 탭에서도 종료 취소 시 시험이 유지되어야 합니다.');
  allowExit = true;
  click(window, window.document.querySelector('.hsm-school-back'));
  assert.equal(window.document.querySelector('#hsmSchoolStudentPage').hidden, true, '종료 확인 시 수행평가 시험을 닫아야 합니다.');
  assert.deepEqual(errors, []);
  dom.window.close();
}

await verifyTeacher();
await verifyStudent();
await verifySchoolVocabExit();
console.log('school content UI integration: PASS');
