// Run from repo root with Playwright installed. OS install events are simulated; no real credentials or installation.
const fs=require('fs'),assert=require('assert/strict'),path=require('path');const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox']});const html=fs.readFileSync('public/index.html','utf8');
for(const platform of ['iPhone','Android']){
const page=await browser.newPage({viewport:{width:393,height:852},userAgent:platform==='Android'?'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/143.0 Mobile Safari/537.36':'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15',isMobile:true,hasTouch:true});
await page.route('**/*',async r=>{const u=new URL(r.request().url()),p=path.join(process.cwd(),'public',u.pathname==='/'?'index.html':u.pathname);if(u.hostname!=='app.test'||!fs.existsSync(p))return r.abort();let data=fs.readFileSync(p);if(p.endsWith('index.html'))data=Buffer.from(data.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));await r.fulfill({body:data,contentType:p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':p.endsWith('.js')?'text/javascript':undefined});});
await page.goto('https://app.test/');await page.evaluate(()=>{document.getElementById('appSplash').remove();window.HSMDialog={alert(){}};});
await page.evaluate(()=>{document.getElementById('loginScreen').classList.add('hidden');document.getElementById('signupScreen').classList.remove('hidden');window.checkSignupId=()=>window.checked=true;window.submitSignup=()=>window.submitted=true;window.showLoginScreen=()=>window.returned=true;window.resetIdCheckState=()=>{};});
await page.addScriptTag({content:fs.readFileSync('public/signup-polish.js','utf8')});
await page.evaluate(()=>document.fonts.ready);
for(const width of [320,393,900]){
await page.setViewportSize({width,height:852});
const r=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth,card:document.getElementById('signupScreen').getBoundingClientRect().toJSON(),row:[...document.querySelector('.signup-id-row').children].map(x=>x.getBoundingClientRect().toJSON())}));
assert(r.scroll<=r.inner);assert(r.row[0].right<=r.row[1].left);assert.equal(r.row[0].top,r.row[1].top);assert(r.row[0].width>130);console.log(platform,width,r.card.height);
if(width===393)await page.screenshot({path:'/tmp/signup125-'+platform+'.png',fullPage:true});
}
await page.setViewportSize({width:393,height:852});
for(const id of ['signupPassword','signupPasswordConfirm']){
await page.locator('#'+id).fill('fixture-only');await page.locator('[data-password-target="'+id+'"]').click();assert.equal(await page.locator('#'+id).getAttribute('type'),'text');
}
await page.locator('#idCheckButton').click();assert(await page.evaluate(()=>checked));await page.locator('#signupButton').click();assert(await page.evaluate(()=>submitted));await page.locator('.hsm-signup-login button').click();assert(await page.evaluate(()=>returned));
await page.evaluate(()=>document.getElementById('signupScreen').classList.add('hidden'));
for(const id of ['signupPassword','signupPasswordConfirm'])assert.equal(await page.locator('#'+id).getAttribute('type'),'password');
await page.close();}
await browser.close();console.log('PASS signup responsive layout, independent password toggles, conceal on leave and existing action bindings (mocked callbacks)');})().catch(e=>{console.error(e);process.exit(1)});
