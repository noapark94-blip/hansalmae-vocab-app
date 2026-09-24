import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, {runScripts:'outside-only'});
const w = dom.window;
for (const s of w.document.querySelectorAll('script:not([src])')) {
  if (s.textContent.trim()) new vm.Script(s.textContent);
}
const start = html.indexOf('    function renderRanking(rankings)');
const end = html.indexOf('    function openRankingEmblemShowcase_', start);
w.eval('var currentStudent={studentId:"me"}; function escapeHtml(s){return String(s).replaceAll("<","&lt;");} var clicks=0; function openRankingEmblemShowcase_(){clicks++;}' + html.slice(start,end));
w.renderRanking([
  {rank:1,studentId:'other',name:'김예빈',points:69,level:7,title:'단어수집가',testCount:3,perfectCount:0},
  {rank:2,studentId:'me',name:'긴이름학생',points:30000,level:30,title:'WALKING DICTIONARY',testCount:22,perfectCount:12}
]);
assert.equal(w.document.querySelectorAll('.ranking-first').length,1);
assert.equal(w.document.querySelectorAll('.ranking-self').length,1);
assert.equal(w.document.querySelector('.ranking-self .ranking-me').textContent,'나');
assert.equal(w.document.querySelectorAll('.ranking-item [role=button]').length,0);
const first = w.document.querySelector('.ranking-item');
first.click();
first.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
assert.equal(w.clicks,2);
assert.equal(w.document.querySelector('.ranking-rule').open,false);
assert.match(w.document.querySelector('.ranking-rule').textContent,/100문제 이상/);
w.renderRanking([]);
assert.ok(w.document.querySelector('.ranking-empty'));
console.log('PASS: ranking identity, champion, emblem mouse/keyboard, collapsed rules, empty state, script syntax');
dom.window.close();
