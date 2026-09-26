import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const source=name=>fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const dom=new JSDOM('<button id="origin">열기</button>',{url:'https://example.test',runScripts:'outside-only'});
const w=dom.window,d=w.document;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.eval(source('app-dialogs.js'));
const tick=()=>new Promise(r=>setTimeout(r,0));
const cancel=()=>d.querySelector('.hsm-app-dialog [data-cancel]').click();
const accept=()=>d.querySelector('.hsm-app-dialog form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
d.querySelector('#origin').focus();
let first=w.HSMDialog.confirm('이 단어를 삭제할까요?');
assert.equal(d.activeElement.textContent,'취소');
assert.equal(await w.HSMDialog.confirm('이 단어를 삭제할까요?'),false,'duplicate click must not execute a second delete');
d.querySelector('dialog').dispatchEvent(new w.Event('click',{bubbles:true}));
assert.ok(d.querySelector('dialog').open,'backdrop must not confirm');
cancel();assert.equal(await first,false);assert.equal(d.activeElement.id,'origin');
first=w.HSMDialog.prompt('새 단어장 이름을 입력하세요.');
accept();assert.ok(d.querySelector('dialog').open);assert.equal(d.querySelector('input').getAttribute('aria-invalid'),'true');
d.querySelector('input').value='<img src=x onerror=alert(1)>';accept();assert.equal(await first,'<img src=x onerror=alert(1)>');
const a=w.HSMDialog.alert('긴이름'.repeat(100));const b=w.HSMDialog.prompt('다음 입력');
assert.equal(d.querySelectorAll('dialog').length,1);accept();await a;
d.querySelector('dialog').dispatchEvent(new w.Event('cancel',{cancelable:true}));assert.equal(await b,null);
const html=source('index.html');
function load(from,to){const start=html.indexOf(from);assert.ok(start>=0);const end=html.indexOf(to,start);assert.ok(end>start);w.eval(html.slice(start,end));}
let moved=0,stopped=0,resumed=0;
w.isNormalTestInProgress_=()=>true;w.stopNormalTestForMenuMove_=()=>stopped++;
load('    async function moveFromTestWithConfirm_', '    function showTestHome');
let pending=w.moveFromTestWithConfirm_(()=>moved++);assert.equal(moved,0);cancel();await pending;assert.equal(stopped,0);
pending=w.moveFromTestWithConfirm_(()=>moved++);accept();await pending;assert.equal(moved,1);assert.equal(stopped,1);
w.clearTestProgress=()=>assert.fail('later must preserve the saved exam');w.resumeSavedTest=()=>resumed++;
w.currentStudent={studentId:'fixture'};w.getTestProgressStorageKey=()=> 'progress:fixture';w.isNormalTestInProgress_=()=>false;
load('    let savedTestPromptOpen_', '    let signupIdChecked');
pending=w.handleSavedTestProgress_({questions:[1,2,3],currentIndex:1});assert.match(d.querySelector('dialog').textContent,/2번 문제부터 · 2문제 남음/);cancel();await pending;assert.equal(resumed,0);assert.equal(d.querySelector('dialog'),null);
pending=w.handleSavedTestProgress_({questions:[1,2,3],currentIndex:1,savedAt:'new-progress'});accept();await pending;assert.equal(resumed,1);
// Destructive teacher action must pass both independent confirmations.
const teacher=source('teacher.html');const start=teacher.indexOf('    async function deleteAllExams()');const end=teacher.indexOf('\n    async function ',start+10);
w.eval(teacher.slice(start,end));let api=0;w.setLoading=()=>{};w.showToast=()=>{};w.loadExams=async()=>{};
w.api=async()=>{api++;return {};};
// Cancellation is checked before any API or loading state is touched.
pending=w.deleteAllExams();cancel();await pending;assert.equal(api,0);
pending=w.deleteAllExams();accept();await tick();assert.ok(d.querySelector('dialog'));cancel();await pending;assert.equal(api,0);
w.close();
// No app-owned browser alerts/confirms/prompts remain (install prompt is browser-owned).
for(const name of fs.readdirSync(new URL('../public/',import.meta.url)).filter(n=>n.endsWith('.js')||['index.html','teacher.html'].includes(n))){
 const text=source(name);assert.ok(!/(?<![\w.])(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(text),name+' still uses a native dialog');
}
console.log('PASS real dialogs: cancel/accept, safe text, input validation, queue, duplicate prevention, exam exit/resume and teacher double confirmation');

// Include each real page's stylesheet cascade, not only the isolated component.
for (const page of ['index.html','teacher.html']) {
 const markup=source(page);
 const head=markup.slice(markup.indexOf('<head>')+6,markup.indexOf('</head>'))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<link\b[^>]*>/gi,tag=>{
   const href=tag.match(/href="\.\/([^"?]+)(?:\?[^" ]*)?"/);
   return /rel="stylesheet"/.test(tag)&&href?'<style>'+source(href[1])+'</style>':'';
  });
 const frame=new JSDOM('<!doctype html><html><head>'+head+'</head><body></body></html>',{url:'https://example.test',runScripts:'outside-only'});
 const win=frame.window;
 win.HTMLDialogElement.prototype.showModal=function(){this.open=true;};win.HTMLDialogElement.prototype.close=function(){this.open=false;};
 win.eval(source('app-dialogs.js'));
 const decision=win.HSMDialog.prompt({title:'매우 긴 단어장 이름을 입력해주세요',message:'긴 설명 '.repeat(40),label:'단어장 이름'});
 const dialog=win.document.querySelector('dialog');
 for(const selector of ['h2','.hsm-dialog-message','label'])assert.equal(win.getComputedStyle(dialog.querySelector(selector)).textAlign,'left',page+' '+selector);
 assert.equal(win.getComputedStyle(dialog.querySelector('label')).marginTop,'0px');
 assert.equal(win.getComputedStyle(dialog.querySelector('h2')).paddingLeft,'0px');
 assert.equal(win.getComputedStyle(dialog.querySelector('input')).boxSizing,'border-box');
 assert.equal(win.getComputedStyle(dialog.querySelector('[data-accept]')).textAlign,'center');
 dialog.querySelector('[data-cancel]').click();await decision;win.close();
}
console.log('PASS student/teacher page CSS cascade: title/body/label alignment, label spacing and input sizing');

// Destination picker must keep exactly one book icon after automatic decoration.
{
 const markup=html.slice(html.indexOf('  <div\n    id="personalBookPickerModal"'),html.indexOf('<script id="hsm-book-picker-script-v3">'));
 const frame=new JSDOM(markup,{url:'https://example.test',runScripts:'outside-only'}),win=frame.window;
 win.escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;');
 win.eval(html.match(/<script id="hsm-book-picker-script-v3">([\s\S]*?)<\/script>/)[1]);
 win.eval(source('ui-icons.js'));
 win.openPersonalBookPicker_([{bookId:'one',bookName:'아주 긴 단어장 이름 '.repeat(6),wordCount:3}],{mode:'saveBatch',payload:[{word:'test'}]});
 await new Promise(r=>setTimeout(r,20));
 const row=win.document.querySelector('.hsm-picker-book');
 assert.equal(row.querySelectorAll('.hsm-ui-icon').length,1);
 assert.equal(row.classList.contains('hsm-icon-label'),false);
 assert.equal(row.querySelector('.hsm-picker-book-meta').textContent,'3개 단어');
 let saved;win.saveBatchToPersonalBook_=(id,words)=>{saved={id,words};};
 row.click();assert.equal(saved.id,'one');assert.equal(saved.words.length,1);
 assert.ok(win.document.querySelector('#personalBookPickerModal').classList.contains('hidden'));
 win.close();
}
console.log('PASS destination picker icon decoration and selected-book save flow');
