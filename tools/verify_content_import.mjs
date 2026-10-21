import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="hsmSchoolContentTeacherPanel"></div>',{url:'https://example.test/teacher.html',runScripts:'outside-only'});
const w=dom.window,d=w.document;
const source=fs.readFileSync('public/school-content-teacher.js','utf8');
w.eval(source.replace("  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,250);},{once:true});else setTimeout(install,250);",'window.importTest={parseBulkSentences,renderPanel,state};'));
const api=w.importTest,parse=api.parseBulkSentences;
const sample=`1. People in Western cultures are beginning to tell and act from a new earth story.
서구 문화권 사람들이 새로운 지구 이야기에서 비롯된 말과 행동을 하기 시작하고 있다.
2. This story is about all living things being connected.
이 이야기는 모든 생명체가 연결되어 있다는 것에 관한 것이다.
3. In The Hidden Life of Trees, author and botanist Peter Wohlleben explains how a forest is a single living entity in which microbial, plant, and animal life communicate with each other to support the whole.
『The Hidden Life of Trees』에서 저자이자 식물학자인 Peter Wohlleben은 숲이 하나의 살아 있는 존재여서 그 속에서 미생물, 식물, 동물 생명체가 서로 소통하며 전체를 지탱하는 방식을 설명한다.
4. When some trees are threatened by disease, nearby trees emit chemicals through their roots to support the infested trees.
일부 나무가 질병으로 위협을 받으면 주변의 나무가 뿌리를 통해 화학 물질을 방출하여 감염된 나무를 지원한다.
5. A vast underground network of roots and friendly fungi supports forest life.
뿌리와 우호적인 균류로 이루어진 거대 지하 네트워크가 숲의 생명을 지탱한다.
6. When plants need to be pollinated, they emit hormones and scents to attract pollinators.
식물은 수분이 필요할 때 호르몬과 향기를 발산하여 수분 매개자를 유인한다.
7. Every year, various plants and trees coordinate their blooming and fruiting, which benefits the entire system.
매년 다양한 식물과 나무가 개화와 결실을 조율하는데, 이는 전체 시스템에 혜택을 준다.
8. Orchards will fruit heavily one year and lightly the next, as if they need a rest every other year.
과수원은 마치 격년으로 휴식이 필요한 것처럼 한 해에는 열매가 많이 맺히고 다음 해에는 열매가 적게 맺힐 것이다.
9. We are still learning how forest systems work.
우리는 여전히 숲 시스템이 어떻게 작동하는지 배우고 있다.`;
const rows=parse(sample);assert.equal(rows.length,9);
const lines=sample.split('\n');rows.forEach((row,i)=>{assert.equal(row.chunks.map(c=>c.text).join(' '),lines[i*2].replace(/^\d+\. /,''));assert.equal(row.translation,lines[i*2+1]);});
assert.equal(parse(sample.replace(/^\d+\. /gm,'').replace(/\n/g,'\r\n\r\n')).length,9);
const tab=parse('People / learn.\t사람들은 배운다.');assert.equal(tab[0].chunks.length,2);assert.equal(tab[0].translation,'사람들은 배운다.');
assert.equal(parse('1) People learn.\n사람들은\n배운다.')[0].translation,'사람들은 배운다.');
assert.equal(parse('1440 was a year.')[0].chunks.map(c=>c.text).join(' '),'1440 was a year.');
assert.equal(parse('Hello.\nWorld.').length,2);assert.throws(()=>parse('해석만 있습니다.'),/영어 문장/);
api.renderPanel();d.querySelector('#hsmScBulk').value=sample;d.querySelector('#hsmScBuild').click();assert.equal(d.querySelectorAll('[data-sc-sentence]').length,9);assert.match(d.querySelector('#hsmScImportStatus').textContent,/9개 문장 추가/);assert.equal(d.querySelector('#hsmScBulk').value,'');
d.querySelector('#hsmScBulk').value='해석만 있습니다.';d.querySelector('#hsmScBuild').click();assert.equal(d.querySelectorAll('[data-sc-sentence]').length,9);assert.equal(d.querySelector('#hsmScBulk').value,'해석만 있습니다.');
dom.window.close();console.log('PASS exact nine sentence import, numbering, blank lines, TSV, slash chunks, orphan errors and editor preservation');
