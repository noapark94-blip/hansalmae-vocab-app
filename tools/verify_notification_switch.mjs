import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only' });
const w = dom.window;
const start = html.indexOf('function setPushStatus_(');
const end = html.indexOf('function refreshPushNotificationStatus_(', start);
w.eval(html.slice(start, end));
const button = w.document.getElementById('accountPushNotificationButton');
assert.equal(button.getAttribute('role'), 'switch');
assert.equal(button.disabled, true);
for (const [enabled, disabled] of [[true,false],[false,false],[false,true],[true,false]]) {
  button.setAttribute('aria-busy','true');
  w.setPushStatus_('상태 안내', enabled, disabled);
  assert.equal(button.getAttribute('aria-checked'), String(enabled));
  assert.equal(button.disabled, disabled);
  assert.equal(button.getAttribute('aria-busy'), 'false');
  assert.equal(button.textContent, '');
  assert.equal(w.document.getElementById('accountPushNotificationStatus').textContent, '상태 안내');
}
dom.window.close();
console.log('PASS notification switch confirmed on/off, unsupported and busy states');
