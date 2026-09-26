import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
const source = fs.readFileSync('public/teacher-exam-live.js','utf8');
const flush = () => new Promise(r=>setImmediate(r));
function setup(teacher) {
 const dom=new JSDOM('<div id="listPanel" class="active"></div><div id="statusModal"></div><div id="loadingOverlay"></div><div id="detailModal"></div><div id="teacherExamHomeScreen"></div>',{url:'https://test.local/'+(teacher?'teacher.html':'index.html'),runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;let tick,now=20000,hidden=false,calls=[],list=0,status=0,student=0;
 w.Date.now=()=>now;w.setInterval=fn=>{tick=fn;};Object.defineProperty(w.document,'hidden',{get:()=>hidden});
 w.eval('var currentStatusExamId="", teacherApiInflight=new Map(), currentStudent={},currentLoginToken="token",teacherExamSession=null,teacherAssignedExams=[],teacherExamCache={};');
 w.renderExamList=()=>list++;w.renderStatusModal=()=>status++;w.renderTeacherExamList_=()=>student++;
 let response={exams:[{id:'a'}]},pending;
 w.apiCall=async(...args)=>{calls.push(args);return pending?await pending:response;};
 w.google={script:{get run(){let done;return{withSuccessHandler(f){done=f;return this;},withFailureHandler(){return this;},studentGetAssignedExams(token){calls.push(['student',token]);Promise.resolve(pending||response).then(done);}};}}};
 w.eval(source);
 return {w,dom,calls,tick:async()=>{tick();await flush();},advance:n=>now+=n,hide:v=>hidden=v,response:r=>response=r,pending:p=>pending=p,counts:()=>[list,status,student]};
}
const t=setup(true);
await t.tick();assert.equal(t.calls.length,1);assert.equal(t.counts()[0],1);
t.advance(5000);await t.tick();assert.equal(t.calls.length,1);
t.advance(5000);await t.tick();assert.equal(t.calls.length,2);assert.equal(t.counts()[0],1,'unchanged list should not rerender');
t.w.currentStatusExamId='a';t.w.document.querySelector('#statusModal').classList.add('show');t.response({completedCount:0});await t.tick();assert.equal(t.counts()[1],1);
t.advance(5000);t.response({completedCount:1});await t.tick();assert.equal(t.counts()[1],2);
t.hide(true);t.advance(10000);await t.tick();assert.equal(t.calls.length,4);
t.hide(false);let release;t.pending(new Promise(r=>release=r));t.advance(5000);await t.tick();t.advance(10000);await t.tick();assert.equal(t.calls.length,5,'no overlapping polls');
t.w.currentStatusExamId='b';release({completedCount:2});await flush();assert.equal(t.counts()[1],2,'stale response must not replace another exam');
t.dom.window.close();
const s=setup(false);await s.tick();assert.equal(s.counts()[2],1);s.advance(10000);await s.tick();assert.equal(s.counts()[2],1);
s.w.teacherExamSession={questions:[{}]};s.advance(10000);await s.tick();assert.equal(s.calls.length,2,'active test must not poll');
s.w.teacherExamSession=null;s.hide(true);await s.tick();assert.equal(s.calls.length,2);
s.hide(false);s.advance(10000);s.response({exams:[]});await s.tick();assert.equal(s.counts()[2],2,'deleted exams must disappear');s.dom.window.close();
for(const name of ['teacher.html','index.html']){
 const html=fs.readFileSync('public/'+name,'utf8');const d=new JSDOM(html);
 for(const script of d.window.document.querySelectorAll('script:not([src])')) if(script.textContent.trim())new vm.Script(script.textContent);
 assert.match(html,/teacher-exam-live.js\?v=20260926-109/);d.window.close();
}
assert.match(fs.readFileSync('public/teacher.html','utf8'),/teacherListExams: 0/);
assert.match(fs.readFileSync('public/teacher.html','utf8'),/teacherGetExamStatus: 0/);
assert.match(fs.readFileSync('public/index.html','utf8'),/studentGetAssignedExams: 0/);
console.log('PASS live exam updates, no flicker, visibility, active test protection, race guard, request deduplication, syntax and cache bypass');
