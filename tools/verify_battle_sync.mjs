import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dom=new JSDOM('<div id="mainApp"></div>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://app.test'}),w=dom.window,d=w.document;
let clock=100000,frame,request,reply;w.Date.now=()=>clock;w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};w.currentStudent={studentId:'me'};w.HANSALMAE_CONFIG={apiUrl:'https://app.test/api'};w.hsmEnsureStudentSession_=async()=>'test';w.hideAllStudentMainScreens_=()=>{};w.setInterval=()=>0;w.setTimeout=()=>0;w.requestAnimationFrame=fn=>{frame=fn;return 1;};w.Element.prototype.animate=()=>({cancel(){}});w.fetch=(_,opts)=>{request=JSON.parse(opts.body);return new Promise(r=>reply=data=>r({ok:true,json:async()=>({success:true,result:data})}));};
let code=readFileSync('public/battle-rooms.js','utf8').replace("if(document.readyState==='loading')","window.testSync={init,accept,api,refresh,tickClock,clockSample,syncPayload,acknowledgePrepared,reset,open:()=>root.classList.remove('hidden')};if(document.readyState==='loading')");w.eval(code);const t=w.testSync;t.init();t.open();
assert.equal(t.clockSample(new Date(10100).toISOString(),9000,9200),1000,'half RTT midpoint');assert.equal(t.clockSample(new Date(14000).toISOString(),10000,13000),1000,'slow sample must not replace best offset');t.reset();t.open();
// Empty lobby and catalog/create requests must work before a room exists.
assert.equal(t.syncPayload({}).protocol,2);
assert.equal(t.syncPayload({id:'new-room'}).readyRound,undefined);
const lobbyRequest=t.refresh(true);await new Promise(r=>setImmediate(r));
assert.equal(request.action,'roomLobby');reply({rooms:[],me:{id:'me'}});await lobbyRequest;
assert(d.body.textContent.includes('아직 열린 대전방이 없어요'));
for(const action of ['Catalog','Create']){
 const call=t.api(action,action==='Create'?{title:'테스트 방'}:{});await new Promise(r=>setImmediate(r));
 assert.equal(request.action,'room'+action);reply(action==='Catalog'?[]:{id:'created'});await call;
}
t.reset();t.open();assert.equal(t.syncPayload({}).protocol,2,'safe after leaving/reset');
const q={prompt:'story',mode:'engToKor',correctId:null,options:[{id:'a',text:'이야기'},{id:'b',text:'일'}]};
let state={id:'r',me:'me',host:'me',title:'대전',status:'playing',syncEnabled:true,preparing:true,syncToken:'token1',round:0,roundAt:null,deadline:null,serverNow:new Date(clock).toISOString(),members:[{id:'me',name:'나',score:0,ms:0,loaded:false},{id:'other',name:'친구',score:0,ms:0,loaded:false}],settings:{count:10,seconds:10,title:'중등'},question:null,preparedQuestion:q,chat:[]};
const accept=()=>{state.serverNow=new Date(clock).toISOString();t.accept(structuredClone(state));};accept();assert.equal(d.querySelectorAll('[data-br="answer"]').length,0);assert.equal(d.querySelector('#brTimer').textContent,'준비 중');assert(!d.body.textContent.includes('story'),'cached question is not visible');
const pending=t.acknowledgePrepared();await new Promise(r=>setImmediate(r));assert.equal(request.payload.protocol,2);assert.equal(request.payload.readyRound,0);assert.equal(request.payload.syncToken,'token1');
state.syncToken=null;state.preparing=false;state.roundAt=new Date(clock+2000).toISOString();state.deadline=new Date(clock+12000).toISOString();reply(structuredClone(state));await pending;
assert.equal(d.querySelectorAll('[data-br="answer"]').length,0);clock+=1999;t.tickClock();assert.equal(d.querySelectorAll('[data-br="answer"]').length,0);
clock++;t.tickClock();assert.equal(d.querySelector('.br-prompt').textContent,'story','release cached question without another fetch');assert.equal(d.querySelectorAll('[data-br="answer"]:not(:disabled)').length,2);
state.round=1;state.roundAt=null;state.deadline=null;state.preparing=true;state.syncToken='token2';state.preparedQuestion={...q,prompt:'again'};accept();assert(!d.querySelector('[data-br="answer"]:not(:disabled)'));assert(d.querySelector('.br-question-card').classList.contains('is-round-wait'));assert(!d.querySelector('.br-prompt').textContent.includes('again'));
Object.defineProperty(d,'hidden',{value:true,configurable:true});assert.equal(t.syncPayload({id:'r'}).readyRound,undefined,'background tab cannot acknowledge readiness');
state.roundAt=new Date(clock+2000).toISOString();state.deadline=new Date(clock+12000).toISOString();state.preparing=false;state.syncToken=null;accept();clock+=2000;Object.defineProperty(d,'hidden',{value:false});t.tickClock();assert.equal(d.querySelector('.br-prompt').textContent,'again');
t.reset();dom.window.close();console.log('PASS midpoint/min-RTT clock, readiness ACK, hidden-tab guard, no early question, local scheduled release, next-round barrier.');
