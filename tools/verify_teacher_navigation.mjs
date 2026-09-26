import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const source=n=>fs.readFileSync(new URL('../public/'+n,import.meta.url),'utf8');
const html=source('index.html');
const dom=new JSDOM(`<div id="mainApp"><div class="topbar"><button id="desktop">메뉴</button></div><section id="teacherExamTakingScreen" class="hidden"><h2 id="teacherExamTakingTitle"></h2><div id="teacherExamTakingMeta"></div><button id="answer">답</button><button id="stop">그만두기</button></section></div><nav id="hsmMobileNav"><button id="home">홈</button><button id="more">더보기</button></nav><div id="hsmMobileMore"></div><dialog class="hsm-app-dialog"><button id="confirm">확인</button></dialog>`,{url:'https://example.test',runScripts:'outside-only'});
const w=dom.window,d=w.document;
w.eval('var teacherExamSession=null,teacherExamAnswers={},teacherExamQuestionIndex=0,currentStudent={studentId:"s"},currentLoginToken="token",teacherExamSubmitting_=false,teacherExamSaveTimer=null;');
let apiSuccess,apiFailure,confirm=true,prompts=0,ended=0,answers=0,navigations=0;
w.HSMDialog={confirm:async()=>{prompts++;return confirm},alert:()=>{}};
w.closeHsmMobileMore_=()=>d.getElementById('hsmMobileMore').classList.add('hidden');
w.hideAllStudentMainScreens_=()=>{};w.renderTeacherExamQuestion_=()=>{};w.showTeacherExamHome=()=>ended++;
const api={withSuccessHandler(fn){apiSuccess=fn;return this},withFailureHandler(fn){apiFailure=fn;return this},studentStartTeacherExam(){},studentStopTeacherExam(){}};
w.google={script:{run:api}};
w.eval(source('teacher-exam-navigation.js'));
function load(a,b){w.eval(html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a))))}
load('    async function startAssignedTeacherExam(', '    function renderTeacherExamQuestion_');
load('    async function stopAssignedTeacherExam_(', '    function saveAssignedTeacherExamProgress_');
for(const id of ['home','more','desktop'])d.getElementById(id).onclick=()=>navigations++;
d.getElementById('answer').onclick=()=>answers++;
d.getElementById('confirm').onclick=()=>answers++;
d.getElementById('home').click();assert.equal(navigations,1);
await w.startAssignedTeacherExam('exam',false);
apiSuccess({success:true,exam:{examId:'exam'},questions:[{word:'fun'}]});
const tick=()=>new Promise(r=>setTimeout(r,0));
assert.equal(w.isTeacherExamNavigationLocked_(),true);
confirm=false;
for(const id of ['home','more','desktop']) {
 d.getElementById(id).click();await tick();
 assert.equal(navigations,1,'cancel stays in exam');
 assert.equal(w.isTeacherExamNavigationLocked_(),true);
}
assert.equal(prompts,3);
d.getElementById('answer').click();d.getElementById('confirm').click();assert.equal(answers,2,'exam and dialog buttons remain usable');
confirm=true;d.getElementById('home').click();d.getElementById('more').click();await tick();
assert.equal(prompts,4,'one pending navigation at a time');
assert.equal(navigations,1,'waits for server stop');
apiFailure(Error('offline'));await tick();assert.equal(w.isTeacherExamNavigationLocked_(),true);assert.equal(navigations,1);
d.getElementById('desktop').click();await tick();apiSuccess();await tick();
assert.equal(w.isTeacherExamNavigationLocked_(),false);assert.equal(ended,1);assert.equal(navigations,2,'successful stop replays requested destination');
d.getElementById('home').click();assert.equal(navigations,3);assert.equal(prompts,5);
// Submission in flight must not stop or navigate away.
w.teacherExamSession={exam:{examId:'exam'},questions:[{}]};w.teacherExamSubmitting_=true;
d.getElementById('home').click();await tick();assert.equal(prompts,5);assert.equal(navigations,3);
w.close();console.log('PASS teacher navigation confirmation: cancel preserves exam, repeated clicks deduplicate, failure stays, success opens requested menu, submit in flight protected');
