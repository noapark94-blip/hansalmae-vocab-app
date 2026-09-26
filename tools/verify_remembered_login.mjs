import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const rememberScript=html.slice(html.indexOf('function hsmSaveRememberedId_(){'),html.indexOf('</script>',html.indexOf('function hsmSaveRememberedId_(){')));
const clearScript=html.slice(html.indexOf('    function clearLoginState() {'),html.indexOf('    function logout() {'));
const key='hsmRememberedStudentId';
function open(saved){
 const d=new JSDOM(html,{url:'https://app.test',runScripts:'outside-only'}),w=d.window;
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};
 if(saved!==null)w.localStorage.setItem(key,saved);
 w.eval(rememberScript);
 w.eval(`var currentLoginToken='token',currentRefreshToken='refresh',currentTokenExpiresAt=123,currentStudent={studentId:'student-one'};
 const HSM_STUDENT_TOKEN_KEY_='hansalmaeStudentToken',HSM_STUDENT_INFO_KEY_='hansalmaeStudentInfo',HSM_STUDENT_REFRESH_KEY_='hansalmaeStudentRefreshToken',HSM_STUDENT_EXPIRES_KEY_='hansalmaeStudentTokenExpiresAt';
 function stopStudentSessionMonitor_(){} function stopStudentNotificationPoll_(){}`+clearScript);
 return w;
}
let w=open(null),id=w.document.getElementById('studentId'),check=w.document.getElementById('rememberStudentId');
id.value=' student-one ';check.checked=true;check.dispatchEvent(new w.Event('change'));
assert.equal(w.localStorage.getItem(key),'student-one');
w.document.getElementById('studentPassword').value='test-only-password';
w.localStorage.setItem('hansalmaeStudentToken','test-token');
w.clearLoginState();
assert.equal(id.value,'student-one','logout/session expiry must restore remembered ID');
assert.equal(check.checked,true);assert.equal(w.document.getElementById('studentPassword').value,'');
assert.equal(w.localStorage.getItem('hansalmaeStudentToken'),null);
const saved=w.localStorage.getItem(key);w.close();
w=open(saved);id=w.document.getElementById('studentId');check=w.document.getElementById('rememberStudentId');
assert.equal(id.value,'student-one','new app load restores ID');assert.equal(check.checked,true);
// Replacing the ID and unchecking must persist the user's latest choice.
id.value='student-two';id.dispatchEvent(new w.Event('input'));
assert.equal(w.localStorage.getItem(key),'student-two');w.clearLoginState();assert.equal(id.value,'student-two');
check.checked=false;check.dispatchEvent(new w.Event('change'));assert.equal(w.localStorage.getItem(key),null);
w.clearLoginState();assert.equal(id.value,'');assert.equal(check.checked,false);w.close();
w=open(null);assert.equal(w.document.getElementById('studentId').value,'');assert.equal(w.document.getElementById('rememberStudentId').checked,false);w.close();
console.log('PASS remembered ID across logout, session expiry, reload, replacement and opt-out; password/session cleared');
