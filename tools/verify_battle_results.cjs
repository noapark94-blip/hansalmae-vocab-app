// Real page/CSS/module in Chromium; room/session data is a local fixture.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--no-zygote','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async r=>{const u=new URL(r.request().url());const f=path.join(process.cwd(),'public',u.pathname==='/'?'index.html':u.pathname);if(u.hostname!=='app.test'||!fs.existsSync(f))return r.abort();let body=fs.readFileSync(f);if(f.endsWith('index.html'))body=Buffer.from(body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));await r.fulfill({body,contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':undefined});});
 await page.goto('https://app.test/');await page.evaluate(()=>{document.querySelector('#appSplash')?.remove();document.querySelector('#loginScreen').classList.add('hidden');document.querySelector('#mainApp').classList.remove('hidden');document.querySelectorAll('#mainApp>.card').forEach(e=>e.classList.add('hidden'));window.setInterval=()=>0;window.currentStudent={studentId:'me'};window.hsmEnsureStudentSession_=async()=>'test';window.hideAllStudentMainScreens_=()=>{};window.setActiveMenu=()=>{};window.HANSALMAE_CONFIG={apiUrl:'https://app.test/api'};});
 let code=fs.readFileSync('public/battle-rooms.js','utf8').replace("if(document.readyState==='loading')","window.arenaTest={init,accept,open:()=>root.classList.remove('hidden')};if(document.readyState==='loading')");await page.addScriptTag({content:code});await page.evaluate(()=>{arenaTest.init();arenaTest.open();});

 const cases=[{count:2,role:'guest',reward:{points:0,xp:0,eligibleCount:0}},{count:8,role:'host',reward:{points:5,xp:25,eligibleCount:10}},{count:2,role:'next',tie:true,reward:{points:3,xp:15,eligibleCount:10}},{count:2,role:'guest',reward:null}];
 for(const width of [320,393,768])for(const c of cases){
  await page.setViewportSize({width,height:852});
  const state={id:'result',title:'함께하는 단어 대전',me:'p1',host:c.role==='host'?'p1':'p0',nextRoom:c.role==='next'?'new-room':null,status:'finished',syncEnabled:true,round:9,serverNow:new Date().toISOString(),members:Array.from({length:c.count},(_,i)=>({id:'p'+i,name:i===1?'박노아':'친구'+i,score:c.tie?5:Math.max(0,6-i),ms:c.tie?21000:21000+i*1000,rankMs:c.tie?21000:21000+i*1000,left:false,image:i===1?'./images/emblems/achievement-reborn.png':'./images/emblems/title-chick.png'})),settings:{count:10,seconds:10,title:'중등단어',kind:'standard',start:1,end:1},reward:c.reward,review:[{word:'earth',meaning:'지구, 땅',correct:false}],chat:[]};
  await page.evaluate(s=>arenaTest.accept(s),state);
  assert.equal(await page.locator('.br-result-row').count(),c.count);
  assert.equal(await page.locator('#brChatMount,.br-chat,.br-header').count(),0,'results omit room heading and chat entirely');
  assert.equal(await page.locator('[data-br="leave"]').count(),1);
  assert.equal(await page.locator('.br-result-avatar>img').count(),1);
  assert(await page.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(c.tie)assert((await page.locator('.br-result-hero h2').textContent()).includes('공동'));
  if(c.role==='guest')assert(await page.locator('[data-br="rematch"]').isDisabled());
  if(c.role==='host')assert(await page.locator('[data-br="rematch"]').isEnabled());
  if(c.role==='next')assert(await page.locator('[data-br="next"]').isEnabled());
  if(c.reward?.eligibleCount===0){assert((await page.locator('.br-result-reward').textContent()).includes('횟수에 도달'));assert(!(await page.locator('.br-result-reward').textContent()).includes('+0'));}
  if(!c.reward)assert((await page.locator('.br-result-reward').textContent()).includes('확인 중'));
  const actions=await page.locator('.br-result-actions .br-btn').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,right:r.right}}));assert(actions.every(a=>a.h>=44&&a.w>=44&&a.x>=0&&a.right<=width));
  if(width===393&&c.reward?.eligibleCount===0)await page.screenshot({path:'/tmp/result-refined-2.png',fullPage:true});
  if(width===393&&c.count===8)await page.screenshot({path:'/tmp/result-refined-8.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS result layouts at 320/393/768: 2/8 players, tie ranks, reward/cap/pending, host/guest/rematch, single exit, touch targets and no overflow.');
})().catch(e=>{console.error(e);process.exit(1)});
