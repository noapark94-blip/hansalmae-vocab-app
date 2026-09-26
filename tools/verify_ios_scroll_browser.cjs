const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.join(__dirname,'../public');
// Layout fixtures use the real HTML/CSS with app/network scripts disabled.
// This verifies the iOS code path in Chromium; it is not a physical iPhone test.
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,headless:true,args:['--no-sandbox']});
for(const ios of [true,false]){
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:ios?'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1':'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/143.0 Mobile Safari/537.36'});
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
 document.getElementById('wordList').innerHTML=Array.from({length:40},(_,i)=>`<article class="word-card" style="padding:30px;margin:20px 0;border:1px solid #ddd;border-radius:20px"><h2>${i+1}. vocabulary</h2><p>단어 뜻과 예문</p><p>Scroll verification example.</p></article>`).join('');
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
await page.screenshot({path:'/tmp/ios119-'+(ios?'ios':'android')+'-nav.png'});
// Rotation transfers the scroll position between root and body without losing it.
await page.setViewportSize({width:852,height:393});await page.waitForTimeout(50);
if(ios) assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('hsm-ios-body-scroll')),false);
await page.setViewportSize({width:393,height:852});await page.waitForTimeout(50);
assert((await page.evaluate(()=>hsmPageScrollY_()))>0);
// A reduced viewport (keyboard/browser controls) keeps the navigation at its edge.
await page.setViewportSize({width:393,height:530});await page.waitForTimeout(50);
assert.equal(await page.evaluate(()=>document.getElementById('hsmMobileNav').getBoundingClientRect().bottom),530);
await page.setViewportSize({width:393,height:852});
// Real launcher DOM remains viewport sized and scrollable after opening from a scrolled page.
await page.evaluate(()=>{window.scrollTo(0,700);document.body.classList.add('hsm-launcher-open');document.getElementById('hsmLauncherHome').classList.remove('hidden');});
await page.waitForTimeout(50);
const home=await page.evaluate(()=>{const h=document.getElementById('hsmLauncherHome'),r=h.getBoundingClientRect();h.scrollTop=h.scrollHeight;return {top:r.top,bottom:r.bottom,height:innerHeight,scroll:h.scrollTop,nav:getComputedStyle(document.getElementById('hsmMobileNav')).display,bodyOverflow:getComputedStyle(document.body).overflowY}});
assert.equal(home.top,0);assert.equal(home.bottom,home.height);assert.equal(home.nav,'none');assert.equal(home.bodyOverflow,'hidden');
await page.screenshot({path:'/tmp/ios119-'+(ios?'ios':'android')+'-home.png'});
console.log(ios?'iOS path (Chromium layout)':'Android path',JSON.stringify({reports,home}));
await context.close();}
await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
