import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://example.com'});
const w=dom.window,d=w.document,requests=[],timers=[],errors=[];
w.addEventListener('error',e=>errors.push(e.error));
w.setTimeout=f=>timers.push(f);w.console.error=()=>{};
w.google={script:{get run(){return {
 withSuccessHandler(f){this.ok=f;return this},withFailureHandler(f){this.fail=f;return this},
 getSheetNames(){requests.push({type:'sheets',...this})},getDays(sheet){requests.push({type:'days',sheet,...this})}
}}}};
w.eval('var currentStudent={studentId:"test",studentName:"테스트",grade:"고3"},sheetNamesCache=[],testDaysRequestId=0;function loadVocabulary(){}');
w.eval(html.slice(html.indexOf('    let sheetNamesLoading_'),html.indexOf('    function hideExtraStudyScreens')));
w.eval(html.slice(html.indexOf('    function setDayLoading_'),html.indexOf('    function loadVocabulary()')));
w.eval(readFileSync(new URL('../public/test-setup.js',import.meta.url),'utf8'));
d.dispatchEvent(new w.Event('DOMContentLoaded'));
w.loadSheetNames();
assert.equal(d.getElementById('hsmSetupStudent').textContent,'테스트 · 고3');
w.loadSheetNames();assert.equal(requests.length,1);
requests.shift().fail(new Error('offline'));timers.shift()();requests.shift().fail(new Error('offline'));
assert.equal(d.getElementById('hsmPickstartDay').textContent,'불러오기 실패');
d.querySelector('#loadingText button').click();
requests.shift().ok(['중등단어DB','고등단어DB','수능단어DB']);
assert.equal(requests.length,2);assert.ok(requests.every(r=>r.sheet==='수능단어DB'));
requests.shift().ok([1,2,3]);requests.shift().ok([1,2,3]);
assert.equal(d.getElementById('startButton').disabled,false);
assert.equal(d.getElementById('hsmPickvocabDay').textContent,'Day 1 ⌄');
w.loadVocabDays();requests.shift().fail(new Error('timeout'));
assert.equal(d.getElementById('hsmPickvocabDay').textContent,'불러오기 실패');
d.querySelector('#vocabLoading button').click();requests.shift().ok([1,2]);
assert.equal(d.getElementById('vocabDay').disabled,false);
w.loadVocabDays();const stale=requests.shift();
w.loadVocabDays();requests.shift().ok([4,5]);stale.ok([1,2]);
assert.equal(d.getElementById('vocabDay').value,'4');
w.loadTestDays();requests.shift().ok([]);
assert.equal(d.getElementById('hsmPickstartDay').textContent,'Day 없음');
assert.equal(d.getElementById('startButton').disabled,true);
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(d.querySelectorAll('#hsmSetupSheets button').length,3);
assert.deepEqual(errors,[]);
dom.window.close();
console.log('PASS: catalog failure/retry, immediate profile, recovery, stale Day responses, empty state');

// A new notification must not access its deduplication key before initialization.
const notices=new JSDOM('',{url:'https://example.com',runScripts:'outside-only'});
const n=notices.window;let handler,prompts=0;
n.google={script:{run:{withSuccessHandler(f){handler=f;return this},withFailureHandler(){return this},studentGetNotifications(){}}}};
n.HSMDialog={confirm:async()=>{prompts++;return false;}};
n.eval('var currentStudent={studentId:"test"},currentLoginToken="test";');
n.eval(html.slice(html.indexOf('    function showLoginNotificationPopup_()'),html.indexOf('    function startStudentSessionMonitor_()')));
n.showLoginNotificationPopup_();
await handler({unreadCount:1,notifications:[{notificationId:'one',title:'새 알림',read:false}]});
await handler({unreadCount:1,notifications:[{notificationId:'one',title:'새 알림',read:false}]});
assert.equal(prompts,1);
notices.window.close();
console.log('PASS: new notification renders once without initialization errors');
