import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {JSDOM, VirtualConsole} from 'jsdom';
const source = name => fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
const wait = ms => new Promise(r=>setTimeout(r,ms));
function fixture(html, logged=true) {
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<!doctype html><html><head></head><body>'+html+'</body></html>',{url:'https://example.test/index.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;w.alert=()=>{};w.confirm=()=>false;
 // Dispose observers and animation callbacks before tearing down the DOM.
 const observers=[],frames=new Set(),Observer=w.MutationObserver,raf=w.requestAnimationFrame.bind(w),close=w.close.bind(w);
 w.MutationObserver=class extends Observer{constructor(cb){super(cb);observers.push(this);}};
 w.requestAnimationFrame=cb=>{const id=raf(time=>{frames.delete(id);cb(time);});frames.add(id);return id;};
 w.close=()=>{observers.forEach(o=>o.disconnect());frames.forEach(id=>w.cancelAnimationFrame(id));frames.clear();close();};

 if(logged){w.localStorage.setItem('hansalmaeStudentToken','fixture-token');w.localStorage.setItem('hansalmaeStudentInfo',JSON.stringify({studentId:'fixture'}));}
 w.HANSALMAE_CONFIG={apiUrl:'https://example.test/api'};
 return {dom,w,errors,load:name=>w.eval(source(name)),click:sel=>{const el=w.document.querySelector(sel);assert.ok(el,sel);el.click();}};
}
const anchor='<button class="learning-shortcut" id="personal"><span class="shortcut-title"><span>아이콘</span><span>나만의 단어장</span></span><span class="shortcut-description">설명</span><span class="shortcut-count">0</span></button>';
// Login after bootstrap has finished must install both school launchers.
{
 const f=fixture(anchor,false);const {w}=f;
 w.fetch=async()=>({ok:true,json:async()=>({success:true,result:[]})});
 f.load('school-vocab.js');f.load('school-content-student.js');await wait(20);
 assert.equal(w.document.querySelector('#hsmSchoolContentShortcut'),null);
 w.localStorage.setItem('hansalmaeStudentToken','fixture-token');w.dispatchEvent(new w.Event('hsm:student-session'));await wait(30);
 assert.ok(w.document.querySelector('#hsmSchoolVocabShortcut'));assert.ok(w.document.querySelector('#hsmSchoolContentShortcut'));
 f.dom.window.close();console.log('PASS login-after-bootstrap menu installation');
}
// Actual replacement exam, not just original markup: exit guard, save, retry and same request ID.
{
 const f=fixture('<button id="hsmSchoolVocabShortcut">학교 수행평가</button>');const {w}=f;const calls=[];let fail=true;
 const words=['one','two','three','four'].map((word,i)=>({word,meaning:String(i+1)}));
 w.fetch=async(_,opts)=>{const req=JSON.parse(opts.body);calls.push(req);if(req.action==='studentSaveSelfTestResult'&&fail)throw Error('offline');return{ok:true,json:async()=>({success:true,result:req.action==='studentListBooks'?[{bookId:'b',title:'단어장',wordCount:4}]:req.action==='studentGetBook'?{bookId:'b',title:'단어장',words}:{success:true}})};};
 for(const file of ['school-runtime.js','school-vocab-student-page.js','school-vocab-free-test-ui.js','school-vocab-nav-close-fix.js'])f.load(file);
 await wait(20);f.click('#hsmSchoolVocabShortcut');await wait(20);f.click('[data-book]');await wait(50);f.click('#hsmSchoolTestButton');
 w.document.querySelector('#hsmSchoolTestCount').value='1';
 const timer=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>timer(fn,ms===1900?5:ms,...args);
 f.click('#hsmSchoolStartNow');let confirms=0;w.confirm=()=>{confirms++;return false;};f.click('.hsm-school-back');
 assert.equal(confirms,1);assert.equal(w.document.querySelector('#hsmSchoolStudentPage').hidden,false);
 f.click('#hsmSchoolFreeChoices [data-answer]');await wait(60);
 assert.ok(w.document.querySelector('.hsm-school-result-score'));assert.match(w.document.querySelector('[role=status]').textContent,/저장하지 못/);
 assert.equal(calls.filter(x=>x.action==='studentSaveSelfTestResult').length,1);
 const requestId=calls.at(-1).payload.requestId;assert.ok(requestId);
 fail=false;f.click('[role=status] button');await wait(20);
 assert.equal(calls.at(-1).payload.requestId,requestId);assert.match(w.document.querySelector('[role=status]').textContent,/저장했습니다/);
 assert.deepEqual(JSON.parse(w.localStorage.getItem('hsmSchoolOutbox:fixture')),[]);
 f.click('#hsmSchoolFreeDone');await wait(50);assert.ok(w.document.querySelector('.hsm-school-word-list'));assert.equal(w.document.querySelector('#hsmSchoolStudentPage').hidden,false);
 f.dom.window.close();console.log('PASS actual school exam exit, save failure/retry, idempotency and navigation');
}
// Chunk input remains intact when adding or removing another chunk.
{
 const f=fixture('<button id="hsmSchoolVocabShortcut" class="learning-shortcut"><span class="shortcut-title"><span>x</span><span>学校</span></span><span class="shortcut-description"></span><span class="shortcut-count"></span></button>');const {w}=f;
 w.fetch=async(_,opts)=>{const req=JSON.parse(opts.body);return{ok:true,json:async()=>({success:true,result:req.action==='studentListContentBooks'?[{bookId:'b',title:'본문',sentenceCount:1}]:{bookId:'b',title:'본문',sentences:[{id:'s',chunks:[{id:'a',text:'Having learned',morphs:[{id:'m',answerText:'Having learned',prompt:'learn',answers:['Having learned']}]},{id:'b',text:'English',morphs:[]}]}]}})};};
 f.load('school-runtime.js');f.load('school-content-student.js');await wait(20);f.click('#hsmSchoolContentShortcut');await wait(20);f.click('[data-content-book]');await wait(20);f.click('#hsmContentStart');f.click('[data-pool-id=a]');
 w.document.querySelector('[data-morph-id=m]').value='Having learned';f.click('[data-pool-id=b]');assert.equal(w.document.querySelector('[data-morph-id=m]').value,'Having learned');
 const chip=w.document.querySelector('[data-answer-id=b]');chip.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.ok(w.document.querySelector('[data-pool-id=b]'));assert.equal(w.document.querySelector('[data-morph-id=m]').value,'Having learned');
 f.dom.window.close();console.log('PASS chunk input preservation and keyboard removal');
}
// Update coordinator defers reload while replacement test is visible.
{
 const f=fixture('<section id="hsmSchoolStudentPage"><div class="hsm-school-free-card"></div></section>');const {w}=f;let controllerChange;
 Object.defineProperty(w.navigator,'serviceWorker',{value:{addEventListener:(name,cb)=>{controllerChange=cb;},register:()=>Promise.resolve({update:()=>Promise.resolve(),addEventListener:()=>{}})}});
 f.load('app-update.js');await wait(20);controllerChange();await wait(20);assert.match(w.document.querySelector('#hsmAppUpdateToast').textContent,/작업을 마치면/);assert.equal(f.errors.length,0);
 f.dom.window.close();console.log('PASS update waits during actual school test');
}
// Parse inline scripts too; main app is not covered by the older feature-only suite.
for(const file of ['index.html','teacher.html'])for(const m of source(file).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1],{filename:file});
console.log('PASS all inline scripts parse');
