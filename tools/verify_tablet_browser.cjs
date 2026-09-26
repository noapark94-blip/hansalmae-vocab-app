const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.join(__dirname,'../public');
// Layout fixtures use the real HTML/CSS with app/network scripts disabled.
// This verifies the iOS code path in Chromium; it is not a physical iPhone test.
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,headless:true,args:['--no-sandbox']});
for(const ios of [true,false]){
const context=await browser.newContext({viewport:{width:820,height:1180},isMobile:true,hasTouch:true,userAgent:ios?'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1':'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/143.0 Mobile Safari/537.36'});
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.hostname!=='app.test')return route.abort();
 const file=path.join(root,url.pathname==='/'?'index.html':url.pathname);
 if(!fs.existsSync(file))return route.abort();
 let data=fs.readFileSync(file);
 if(file.endsWith('index.html')) data=Buffer.from(data.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</body>','<script src="/ios-page-scroll.js"></script></body>'));
 await route.fulfill({body:data,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':undefined});
});
const page=await context.newPage();await page.goto('https://app.test/');
await page.evaluate(()=>{
 document.getElementById('appSplash')?.remove();
 document.querySelectorAll('body > .container > *').forEach(x=>x.classList.add('hidden'));
 document.getElementById('mainApp').classList.remove('hidden');
 document.querySelectorAll('#mainApp > *').forEach(x=>x.classList.add('hidden'));
 document.getElementById('vocabScreen').classList.remove('hidden');
 document.getElementById('wordList').innerHTML=Array.from({length:40},(_,i)=>`<article class="word-card hsm-unified-word"><div class="word-content"><div class="hsm-word-meta"><span class="hsm-word-source">수능단어 · Day 1</span></div><div class="word-title hsm-word-heading"><span class="word-number hsm-word-number">${i+1}</span><span class="word-English">${i%2?'transformation':'vocabulary'}</span></div><div class="word-meaning">변화, 변형 / 단어, 어휘</div><div class="word-example">A small change can make a meaningful difference in our daily lives.</div><div class="word-translation">작은 변화가 우리의 일상에 의미 있는 차이를 만들 수 있다.</div></div></article>`).join('');
 document.body.classList.add('hsm-student-app-open');
});
await page.waitForTimeout(50);
const reports=[];
for(const y of [0,700,1800,650,99999,0]){
 await page.evaluate(y=>window.scrollTo(0,y),y);await page.waitForTimeout(50);
 const r=await page.evaluate(()=>{const n=document.getElementById('hsmMobileNav').getBoundingClientRect();return{bottom:n.bottom,viewport:innerHeight,root:scrollY,body:document.body.scrollTop,helper:hsmPageScrollY_(),last:document.querySelector('#wordList > :last-child').getBoundingClientRect().bottom,navTop:n.top}});
 assert(Math.abs(r.bottom-r.viewport)<1,JSON.stringify(r));
 if(ios)assert.equal(r.root,0);
 if(y>0)assert(r.helper>0);
 if(y===99999)assert(r.last<=r.navTop, 'last card must be reachable above nav');
 reports.push(r);
}
await page.evaluate(()=>window.scrollTo(0,1800));
await page.screenshot({path:'/tmp/tablet128-'+(ios?'ios':'android')+'-nav.png'});
// Rotation transfers the scroll position between root and body without losing it.
await page.setViewportSize({width:1180,height:820});await page.waitForTimeout(50);
if(ios) assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('hsm-ios-body-scroll')),true);
await page.setViewportSize({width:820,height:1180});await page.waitForTimeout(50);
assert((await page.evaluate(()=>hsmPageScrollY_()))>0);
// Real launcher DOM remains viewport sized and scrollable after opening from a scrolled page.
await page.evaluate(()=>{window.scrollTo(0,700);document.body.classList.add('hsm-launcher-open');document.getElementById('hsmLauncherHome').classList.remove('hidden');});
await page.waitForTimeout(50);
const home=await page.evaluate(()=>{const h=document.getElementById('hsmLauncherHome'),r=h.getBoundingClientRect();h.scrollTop=h.scrollHeight;return {top:r.top,bottom:r.bottom,height:innerHeight,scroll:h.scrollTop,nav:getComputedStyle(document.getElementById('hsmMobileNav')).display,bodyOverflow:getComputedStyle(document.body).overflowY}});
assert.equal(home.top,0);assert.equal(home.bottom,home.height);assert.equal(home.nav,'grid');assert.equal(home.bodyOverflow,'hidden');
await page.screenshot({path:'/tmp/tablet128-'+(ios?'ios':'android')+'-home.png'});
// Portrait and landscape retain two-column cards and bounded exam width.
for(const size of [{width:768,height:1024},{width:1180,height:820},{width:1366,height:1024}]){
 await page.setViewportSize(size);
 const r=await page.evaluate(()=>({columns:getComputedStyle(document.querySelector('.hsm-launcher-study-grid')).gridTemplateColumns.split(' ').length,overflow:document.documentElement.scrollWidth>innerWidth,nav:document.getElementById('hsmMobileNav').getBoundingClientRect().bottom}));
 assert.equal(r.columns,2);assert(!r.overflow);assert.equal(r.nav,size.height);
}
// Exam stays centered, and the More sheet remains accessible on tablet.
await page.evaluate(()=>{document.body.classList.remove('hsm-launcher-open');document.getElementById('hsmLauncherHome').classList.add('hidden');document.getElementById('vocabScreen').classList.add('hidden');document.getElementById('teacherExamTakingScreen').classList.remove('hidden');document.getElementById('teacherExamQuestionArea').innerHTML='<h2>vocabulary</h2><button>어휘</button><button>변화</button>';});
const exam=await page.locator('#teacherExamTakingScreen').boundingBox();assert(exam.width<=760);assert(Math.abs(exam.x-(1366-exam.width)/2)<2);
await page.evaluate(()=>{document.getElementById('hsmMobileMore').classList.remove('hidden');document.body.classList.add('hsm-mobile-more-open');});assert(await page.locator('.hsm-mobile-more-sheet').isVisible());const sheet=await page.locator('.hsm-mobile-more-sheet').boundingBox();assert(sheet.width<=640);
await page.evaluate(()=>{document.getElementById('hsmMobileMore').classList.add('hidden');document.body.classList.remove('hsm-mobile-more-open');document.body.classList.add('hsm-launcher-open');document.getElementById('hsmLauncherHome').classList.remove('hidden');});
// Phone portrait, phone landscape and narrow split view: new CSS has no effect.
for(const size of [{width:393,height:852},{width:852,height:393},{width:600,height:900}]){
 await page.setViewportSize(size);
 const snapshot=()=>page.evaluate(()=>[...document.querySelectorAll('#hsmLauncherHome,#hsmLauncherHome *,#hsmMobileNav,#hsmMobileNav *')].map(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return[r.x,r.y,r.width,r.height,s.display,s.padding,s.fontSize,s.gridTemplateColumns]}));
 const before=await snapshot();await page.evaluate(()=>document.querySelector('link[href*="tablet-layout.css"]').disabled=true);const after=await snapshot();assert.deepEqual(before,after);await page.evaluate(()=>document.querySelector('link[href*="tablet-layout.css"]').disabled=false);
}
console.log(ios?'iOS path (Chromium layout)':'Android path',JSON.stringify({reports,home}));
await context.close();}
await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
