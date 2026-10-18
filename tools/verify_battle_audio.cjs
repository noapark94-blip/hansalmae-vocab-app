const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
const events={},windowEvents={},storage=new Map(),sources=[],fetches=[];let resume=0;
const context={state:'running',destination:{},resume(){resume++;return Promise.resolve();},decodeAudioData:async()=>({}),createGain(){return {gain:{},connect(){},disconnect(){}}},createBufferSource(){const s={connect(){},disconnect(){},start(){s.started=true},stop(){s.stopped=true;s.onended?.()}};sources.push(s);return s;}};
const document={hidden:false,addEventListener:(n,f)=>events[n]=f};
const window={navigator:{audioSession:{type:'auto'}},AudioContext:function(){return context},addEventListener:(n,f)=>windowEvents[n]=f};
const sandbox={window,document,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},caches:{open:async()=>({match:async()=>null,put:async()=>{}})},fetch:async u=>{fetches.push(u);return {ok:true,clone(){return this},arrayBuffer:async()=>new ArrayBuffer(1)}},Date,console};
vm.runInNewContext(fs.readFileSync('public/battle-audio.js','utf8'),sandbox);const a=window.HSMBattleAudio,flush=()=>new Promise(r=>setImmediate(r));
let r={id:'room',round:0,status:'waiting',me:'me',members:[{id:'me'}]};a.update(r,true);assert.equal(fetches.length,0);a.unlock();assert.equal(window.navigator.audioSession.type,'playback','iOS playback category set in gesture');await flush();assert.equal(fetches.length,3);assert.equal(sources.length,0);
r.status='playing';a.update(r,true);await flush();assert.equal(sources.filter(s=>s.loop).length,1);a.update(r,true);await flush();assert.equal(sources.length,1);
r.revealUntil='future';r.choice='a';r.question={correctId:'a'};a.update(r,true);assert.equal(sources.length,2);a.update(r,true);assert.equal(sources.length,2,'no repeated poll sound');
r={...r,round:1,revealUntil:null};a.update(r,true);r.revealUntil='future';r.choice='b';a.update(r,true);assert.equal(sources.length,3);
a.toggle('bgm');await flush();assert(sources[0].stopped);assert.equal(a.settings().bgm,false);
a.toggle('sfx');await flush();r={...r,round:2,revealUntil:null};a.update(r,true);r.revealUntil='future';a.update(r,true);assert.equal(sources.length,3);
a.toggle('bgm');await flush();assert.equal(sources.length,4);document.hidden=true;events.visibilitychange();assert(sources.at(-1).stopped);
document.hidden=false;events.visibilitychange();a.update(r,true);await flush();assert.equal(sources.length,5,'resume music only, not old result');
r.status='finished';a.update(r,true);assert(sources.at(-1).stopped);assert.equal(sources.length,5,'no finish effect');
// Simulate iOS interruption and resumption without a document visibility event.
r={...r,status:'playing',revealUntil:null,round:3};a.update(r,true);await flush();const interrupted=sources.at(-1);context.state='interrupted';context.onstatechange();assert(interrupted.stopped);
context.state='running';context.onstatechange();await flush();assert.notEqual(sources.at(-1),interrupted);assert(sources.at(-1).loop);
const before=resume;events.touchend({isTrusted:true,target:{closest:()=>true}});await flush();assert(resume>before);
a.stop();delete window.navigator.audioSession;a.unlock();await flush();assert(resume>before,'unsupported audioSession does not block Android');
assert(storage.has('hsmBattleAudio:v1'));assert(resume>0);console.log('PASS battle audio: gesture unlock, one loop, correct/wrong once, independent settings, visibility, finish stop, persistence');
})().catch(e=>{console.error(e);process.exit(1)});
