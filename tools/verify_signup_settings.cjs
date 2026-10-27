const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { JSDOM } = require('jsdom');
(async () => {
  const source = fs.readFileSync('supabase/functions/api/index.ts','utf8');
  const code = source.slice(source.indexOf('async function readSignupCode()'),source.indexOf('async function signupStudent('));
  let authorized = false, reads = 0, row = null;
  const ctx = { str: x => String(x ?? '').trim(), Deno:{env:{get:()=> 'legacy-test'}}, crypto:require('node:crypto').webcrypto,
    requireStaff:async()=>{if(!authorized)throw Error('unauthorized');},
    admin:{from:()=>{ reads++; let candidate, expected, insert=false; const q={select:()=>q,eq:(k,v)=>{if(k==='revision')expected=v;return q;},insert:v=>{candidate=v;insert=true;return q;},update:v=>{candidate=v;return q;},maybeSingle:async()=>{
      if(candidate){if((insert&&row)||(!insert&&row?.revision!==expected))return {data:null,error:Error('conflict')};row=candidate;}
      return {data:row,error:null};}};return q;}} };
  vm.createContext(ctx); vm.runInContext(stripTypeScriptTypes(code),ctx);
  await assert.rejects(ctx.signupCodeSettings(['bad'],false), /unauthorized/);assert.equal(reads,0);
  authorized=true; assert.equal((await ctx.signupCodeSettings(['ok'],false)).code,'legacy-test');
  await assert.rejects(ctx.signupCodeSettings(['ok',{code:'short'}],true),/6~8/);
  const saved=await ctx.signupCodeSettings(['ok',{code:'abc23456',revision:null}],true);assert.equal(saved.code,'ABC23456');
  await assert.rejects(ctx.signupCodeSettings(['ok',{code:'DEF23456',revision:null}],true),/설정을 다시/);
  await assert.rejects(ctx.signupCodeSettings(['ok',{code:'DEF23456',revision:'00000000-0000-0000-0000-000000000000'}],true),/설정을 다시/);
  assert.equal((await ctx.signupCodeSettings(['ok',{code:'DEF23456',revision:saved.revision}],true)).code,'DEF23456');
  const dom=new JSDOM('<button id="signupSettingsBtn">설정</button>',{runScripts:'outside-only',url:'https://example.com'}),w=dom.window;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.dispatchEvent(new w.Event('close'));};
  let updates=0,confirm=false;w.HSMDialog={confirm:async()=>confirm};
  w.apiCall=async(name,input)=>{if(name==='teacherUpdateSignupCode'){updates++;return {code:input.code,revision:'new',updatedAt:new Date().toISOString()};}return {code:'ABC23456',revision:'old'};};
  w.eval(fs.readFileSync('public/teacher-settings.js','utf8'));w.document.querySelector('button').click();await new Promise(r=>setTimeout(r,0));
  const d=w.document.querySelector('dialog');assert.equal(d.querySelector('#signupCurrent').type,'password');
  d.querySelector('[data-generate]').click();assert.match(d.querySelector('#signupNew').value,/^[A-HJ-NP-Z2-9]{8}$/);
  d.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(updates,0);
  confirm=true;d.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(updates,1);assert.equal(d.querySelector('#signupNew').value,'');
  d.querySelector('[data-close]').click();assert.equal(w.document.querySelector('dialog'),null);dom.window.close();
  console.log('Signup settings: authorization, validation, concurrent updates, masking, generation, cancel and save passed.');
})().catch(e=>{console.error(e);process.exit(1);});
