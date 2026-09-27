import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dom=new JSDOM('<div id="mainApp"></div>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://app.test'});
const w=dom.window,d=w.document;let frame,clock=100000,animations=0,apiResolve;
w.Date.now=()=>clock;w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};w.currentStudent={studentId:'me'};w.HANSALMAE_CONFIG={apiUrl:'https://app.test/api'};w.hsmEnsureStudentSession_=async()=>'test';w.hideAllStudentMainScreens_=()=>{};w.setInterval=()=>0;w.requestAnimationFrame=fn=>{frame=fn;return 1;};w.Element.prototype.animate=function(){animations++;return {cancel(){}};};
w.fetch=()=>new Promise(resolve=>{apiResolve=data=>resolve({ok:true,json:async()=>({success:true,result:data})});});
let code=readFileSync('public/battle-rooms.js','utf8');code=code.replace("if(document.readyState==='loading')", "window.arenaTest={init,accept,tickClock,render,handle,reset,open:()=>{root.classList.remove('hidden');},getRoom:()=>room};if(document.readyState==='loading')");w.eval(code);w.arenaTest.init();w.arenaTest.open();
const members=Array.from({length:8},(_,i)=>({id:i?'p'+i:'me',name:i?'친구'+i:'나',score:0,answered:false,seat:i,left:false,online:true,image:'./images/emblems/title-chick.png'}));
const state={id:'r1',me:'me',host:'me',title:'단어 대전',status:'playing',members,settings:{count:10,seconds:10,title:'중등',kind:'standard',start:1,end:1},round:0,roundAt:new Date(clock-100).toISOString(),deadline:new Date(clock+9900).toISOString(),serverNow:new Date(clock).toISOString(),question:{prompt:'together',mode:'engToKor',correctId:null,options:[{id:'a',text:'함께'},{id:'b',text:'언제나'},{id:'c',text:'천천히'},{id:'d',text:'바로'}]},chat:[]};
const accept=s=>{s.serverNow=new Date(clock).toISOString();w.arenaTest.accept(structuredClone(s));};
accept(state);
assert.equal(d.querySelectorAll('[data-br="emoji"]').length,5);assert(d.querySelector('[data-br="reactionsToggle"]'));assert(d.querySelector('#brReactionPanel').hidden);d.querySelector('[data-br="reactionsToggle"]').click();assert(!d.querySelector('#brReactionPanel').hidden);assert.equal(d.querySelectorAll('[data-player]').length,8);
assert.equal(d.querySelectorAll('.br-leader:not([hidden])').length,0,'zero scores have no leader');
for(const emoji of ['👏','😄','😭','🔥','😛'])assert(d.querySelector('[data-emoji="'+emoji+'"] .br-sticker'),'all five reactions use artwork');
w.eval(readFileSync('public/ui-icons.js','utf8'));w.HSMIcons.decorate(d.body);
assert(d.querySelector('[data-emoji="🔥"] .br-sticker-fire'),'common icon processing must preserve flame artwork');

const card=d.querySelector('.br-question-card'),player=d.querySelector('[data-player]'),img=player.querySelector('img'),answer=d.querySelector('[data-br="answer"]'),reaction=d.querySelector('[data-br="emoji"]'),fill=d.querySelector('#brTimeFill');
const samples=[];for(let i=0;i<6;i++){clock+=16;frame();samples.push(fill.style.transform);}assert.equal(new Set(samples).size,6,'timer must move between 500ms ticks');
state.members[1].answered=true;accept(state);assert.equal(d.querySelector('.br-question-card'),card);assert.equal(d.querySelector('[data-player]'),player);assert.equal(player.querySelector('img'),img);assert.equal(d.querySelector('[data-br="answer"]'),answer);assert.equal(d.querySelector('[data-br="emoji"]'),reaction);
// Network answer: immediate selection and locking, server acknowledgement must keep lock.
answer.click();assert(answer.classList.contains('is-selected'));assert([...d.querySelectorAll('[data-br="answer"]')].every(x=>x.disabled));await new Promise(r=>setTimeout(r,0));state.answered=true;state.choice='a';state.members[0].answered=true;apiResolve(structuredClone(state));await new Promise(r=>setTimeout(r,0));assert(answer.disabled);
state.revealUntil=new Date(clock+1000).toISOString();state.question.correctId='a';state.members[0].score=1;accept(state);assert.equal(player.querySelector('.br-score-pop').textContent,'+1');assert.equal(d.querySelector('[data-player="p1"] .br-score-pop').textContent,'×');assert(answer.classList.contains('is-correct'));assert.equal(d.querySelectorAll('.br-leader:not([hidden])').length,1);assert(player.querySelector('.br-leader .br-sticker-crown'));const count=animations;clock+=20;accept(state);assert.equal(animations,count,'same server state must not restart feedback');assert.equal(player.querySelector('img'),img);
state.round=1;state.question=null;state.revealUntil=null;state.answered=false;state.choice=null;state.deadline=new Date(clock+11000).toISOString();state.roundAt=new Date(clock+1000).toISOString();accept(state);assert.equal(d.querySelector('.br-question-card'),card);assert(d.querySelector('.br-next-overlay'));assert.equal(player.querySelector('.br-score-pop').textContent,'');
clock+=1100;state.question={prompt:'again',mode:'engToKor',correctId:null,options:[{id:'a',text:'다시'},{id:'b',text:'함께'},{id:'c',text:'곧'},{id:'d',text:'오래'}]};accept(state);assert.equal(d.querySelector('.br-next-overlay'),null);assert.equal(d.querySelector('.br-question-card'),card);assert.equal(d.querySelector('.br-prompt').textContent,'again');assert([...d.querySelectorAll('[data-br="answer"]')].every(x=>!x.disabled));assert.equal(player.querySelector('img'),img);
// Reactions display immediately and do not lock answers.
d.querySelector('[data-emoji="😛"]').click();assert(player.querySelector('.br-bubble .br-sticker-tongue'));assert.equal(player.querySelector('.br-bubble').getAttribute('aria-label'),'메롱');assert(d.querySelector('#brReactionPanel').hidden,'sending closes picker');d.querySelector('[data-br="reactionsToggle"]').click();d.querySelector('[data-br="reactionsToggle"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(d.querySelector('#brReactionPanel').hidden,'Escape closes picker');assert(!d.querySelector('[data-br="answer"]').disabled);
state.members[1].score=1;accept(state);assert.equal(d.querySelectorAll('.br-leader:not([hidden])').length,0,'tied leaders must have no crowns');
state.members[1].left=true;accept(state);assert.equal(d.querySelectorAll('.br-leader:not([hidden])').length,1,'departed players do not compete for crown');
// Every supported roster size updates layout without replacing the question.
for(let n=2;n<=8;n++){
 const snapshot=structuredClone(state);snapshot.members=members.slice(0,n);accept(snapshot);
 const grid=d.querySelector('.br-player-grid');
 assert.equal(grid.dataset.playerCount,String(n));
 assert.equal(grid.dataset.density,n<=2?'duo':n<=4?'small':'group');
 assert.equal(grid.style.getPropertyValue('--player-cols'),String(Math.min(n,4)));
 assert.equal(grid.children.length,n);assert.equal(d.querySelector('.br-question-card'),card);
}
const css=readFileSync('public/battle-rooms.css','utf8');assert(css.includes('transform-origin:left center'));assert(css.includes('.br-game-layout .br-game-chat{order:1'));assert(css.includes('prefers-reduced-motion'));
w.arenaTest.reset();frame();dom.window.close();console.log('PASS custom artwork, flame survives icon processing, zero/tie/solo/departed leader rules; arena: eight players, collapsible five reactions, continuous frame timer, stable DOM on polls/answers, authoritative +1/miss once, locked acknowledged answer, stable round transition, immediate reaction.');
