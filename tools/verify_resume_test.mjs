import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const dom=new JSDOM('<body class="hsm-launcher-open"><section id="hsmLauncherHome"></section><section id="testScreen" class="hidden"></section><section id="teacherExamTakingScreen" class="hidden"></section>'+['feedback','questionNumber','scoreText','progressBar','questionType','questionText','choices'].map(id=>`<div id="${id}"></div>`).join(''),{url:'https://example.test',runScripts:'outside-only'});
const w=dom.window;
w.scrollTo=()=>{};
w.eval(`var currentStudent={studentId:'student'}, currentLoginToken='token', freeTestStopped=true, allWords=[],questions=[],currentIndex=0,score=0,wrongAnswers=[],currentTestContext={},answered=true;
var TEST_PROGRESS_STORAGE_PREFIX='progress:';
function launcher_(){return document.getElementById('hsmLauncherHome')}
function hideTeacherExamScreens_(){}
function setStudentMenuActive_(){}
function shuffleArray(items){return items}
function isNormalTestInProgress_(){return !document.getElementById('testScreen').classList.contains('hidden')}
function getSavedTestProgress(){return null}
`);
w.eval(between('function getTestProgressStorageKey()','    /**\n     * 현재 시험'));
w.eval(between('function hideAllStudentMainScreens_()','    function setStudentMenuActive_'));
w.eval(between('window.hideHsmLauncher_ = function ()','  window.hsmOpenHomeFromMenu_'));
w.eval(between('function showQuestion()','    function selectAnswer('));
w.eval(between('function resumeSavedTest(savedData)','    let signupIdChecked'));
const saved={studentId:'student',savedAt:'2026-09-26',currentIndex:2,score:2,questions:Array.from({length:30},(_,i)=>({type:'engToKor',data:{word:'word'+i,meaning:'뜻'+i}})),allWords:[{word:'word2',meaning:'뜻2'}]};
let prompts=0,resolve;
w.HSMDialog={confirm:()=>{prompts++;return new Promise(r=>resolve=r)}};
const pending=w.handleSavedTestProgress_(saved);
await w.handleSavedTestProgress_(saved);assert.equal(prompts,1);
resolve(true);await pending;
assert.equal(w.document.body.classList.contains('hsm-launcher-open'),false);
assert.equal(w.document.getElementById('hsmLauncherHome').classList.contains('hidden'),true);
assert.equal(w.document.getElementById('testScreen').classList.contains('hidden'),false);
assert.equal(w.document.getElementById('questionNumber').textContent,'3 / 30');
assert.equal(w.document.getElementById('questionText').textContent,'word2');
assert.equal(w.freeTestStopped,false);assert.equal(w.answered,false);
assert.equal(w.questions.length,30);assert.equal(w.score,2);
await w.handleSavedTestProgress_(saved);assert.equal(prompts,1);
w.document.getElementById('testScreen').classList.add('hidden');
const later=w.handleSavedTestProgress_(saved);resolve(false);await later;
await w.handleSavedTestProgress_(saved);assert.equal(prompts,2);
assert.ok(w.localStorage.getItem('progress:student'),'later preserves saved work');
const changed={...saved,savedAt:'new',currentIndex:3};
const change=w.handleSavedTestProgress_(changed);assert.equal(prompts,3);
w.currentStudent={studentId:'other'};resolve(true);await change;
assert.equal(w.currentIndex,2,'account change must not resume prior account work');
assert.equal(w.resumeSavedTest({...saved,currentIndex:30}),false);
assert.equal(w.resumeSavedTest(saved),false);
dom.window.close();
console.log('PASS resume reveals test, renders saved question, clears stop flag, deduplicates prompt, preserves progress and guards account changes');
