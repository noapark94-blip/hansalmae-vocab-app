const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM}=require('jsdom');
const source=readFileSync('public/battle-rooms.js','utf8').replace("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();",'window.testScroll={beginChatKeyboard,endChatKeyboard,sheet,closeModal};');
for(const ios of [true,false]){
 const dom=new JSDOM('<html><body style="color: red"><button id="sound">Sound</button><section><form id="brChatForm"><input id="brChatInput"></form></section></body></html>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;
 w.matchMedia=()=>({matches:true});w.scrollTo=()=>{};
 if(ios)d.documentElement.classList.add('hsm-ios-body-scroll');
 w.eval(source);
 const api=w.testScroll,input=d.getElementById('brChatInput'),original=d.body.style.cssText;
 input.addEventListener('focus',api.beginChatKeyboard);
 input.focus();assert.equal(d.body.style.overflow,'hidden');
 api.sheet('설정','<button>소리</button>');
 assert(!d.documentElement.classList.contains('br-chat-keyboard'));
 assert.equal(d.body.style.overflow,'hidden','sheet still locks background');
 api.endChatKeyboard(); // Delayed focusout must not release or resurrect the sheet lock.
 assert.equal(d.body.style.overflow,'hidden');
 api.beginChatKeyboard();assert(!d.documentElement.classList.contains('br-chat-keyboard'));
 api.closeModal();assert.equal(d.body.style.overflow,'');assert.equal(d.body.style.cssText,original);
 assert.notEqual(d.activeElement,input,'closing sheet must not reopen keyboard');
 // Normal keyboard dismissal, repeated sheets and focus restoration.
 input.focus();api.endChatKeyboard();assert.equal(d.body.style.overflow,'');
 const trigger=d.getElementById('sound');trigger.focus();
 api.sheet('설정','');api.sheet('설정','');api.closeModal();
 assert.equal(d.body.style.overflow,'');assert.equal(d.activeElement,trigger);
 d.body.style.overflow='clip';api.sheet('설정','');api.closeModal();assert.equal(d.body.style.overflow,'clip','preserve unrelated overflow');
 dom.window.close();
}
console.log('PASS: iOS/body and viewport scroll locks, keyboard-to-sheet handoff, delayed blur, repeated sheets, focus and prior styles.');
