// Run from repo root with Playwright installed. OS install events are simulated; no real credentials or installation.
const fs=require('fs'),assert=require('assert/strict'),path=require('path');const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox']});const html=fs.readFileSync('public/index.html','utf8');
for(const platform of ['iPhone','Android','Android-Kakao']){
const page=await browser.newPage({viewport:{width:393,height:852},userAgent:platform.startsWith('Android')?'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/143.0 Mobile Safari/537.36'+(platform==='Android-Kakao'?' KAKAOTALK/26.0':''):'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15',isMobile:true,hasTouch:true});
await page.route('**/*',async r=>{const u=new URL(r.request().url()),p=path.join(process.cwd(),'public',u.pathname==='/'?'index.html':u.pathname);if(u.hostname!=='app.test'||!fs.existsSync(p))return r.abort();let data=fs.readFileSync(p);if(p.endsWith('index.html'))data=Buffer.from(data.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));await r.fulfill({body:data,contentType:p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':p.endsWith('.js')?'text/javascript':undefined});});
await page.goto('https://app.test/');await page.evaluate(()=>{document.getElementById('appSplash').remove();window.HSMDialog={alert(){}};});
await page.addScriptTag({content:html.slice(html.indexOf('function hsmSaveRememberedId_(){'),html.indexOf('</script>',html.indexOf('function hsmSaveRememberedId_(){')))});
await page.addScriptTag({content:html.slice(html.indexOf('    let deferredInstallPrompt = null;'),html.indexOf('    function removeAppSplash()'))});
await page.addScriptTag({content:fs.readFileSync('public/login-polish.js','utf8')});
await page.evaluate(()=>document.fonts.ready);
await page.locator('#studentPassword').fill('fixture-only');await page.locator('#hsmPasswordVisibility').click();assert.equal(await page.locator('#studentPassword').getAttribute('type'),'text');await page.locator('#hsmPasswordVisibility').click();assert.equal(await page.locator('#studentPassword').getAttribute('type'),'password');await page.locator('#studentPassword').fill('');
for(const width of [320,393,900]){await page.setViewportSize({width,height:852});await page.waitForTimeout(60);const r=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth,card:document.getElementById('loginScreen').getBoundingClientRect().toJSON(),options:[...document.querySelector('.hsm-login-options').children].map(x=>x.getBoundingClientRect().toJSON())}));assert(r.scroll<=r.inner);assert(r.options[0].right<=r.options[1].left+1);if(width===393)await page.screenshot({path:'/tmp/login124-'+platform+'.png',fullPage:true});console.log(platform,width,r.card.height);}
await page.setViewportSize({width:393,height:852});await page.locator('#installAppButton').click();assert(await page.locator('#hsmInstallModal').isVisible());assert((await page.locator('#hsmInstallTitle').textContent()).includes(platform.startsWith('Android')?'안드로이드':'아이폰'));assert(!await page.locator('#hsmInstallNow').isVisible());
await page.evaluate(()=>closeHansalmaeInstall_());
if(platform.startsWith('Android')){
 await page.evaluate(()=>{window.promptCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=()=>{window.promptCalls++};event.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(event);});
 await page.locator('#installAppButton').click();assert.equal(await page.evaluate(()=>promptCalls),1);assert(!await page.locator('#hsmInstallModal').isVisible());
 // A pending prompt is consumed once even for rapid taps; dismissing does not open a guide.
 await page.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=()=>{window.promptCalls++};e.userChoice=new Promise(resolve=>window.dismissInstall=()=>resolve({outcome:'dismissed'}));dispatchEvent(e);installHansalmaeApp();installHansalmaeApp();});
 assert.equal(await page.evaluate(()=>promptCalls),2);assert(!await page.locator('#hsmInstallModal').isVisible());await page.evaluate(()=>dismissInstall());
 // Unsupported or rejected prompts fall back to the guide without an unhandled rejection.
 await page.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=()=>Promise.reject(new Error('fixture unsupported'));dispatchEvent(e);return installHansalmaeApp();});assert(await page.locator('#hsmInstallModal').isVisible());
 await page.evaluate(()=>dispatchEvent(new Event('appinstalled')));assert(!await page.locator('#installAppButton').isVisible());assert(!await page.locator('#hsmInstallModal').isVisible());
}
await page.close();}
await browser.close();console.log('PASS responsive login, password toggle, iOS guidance, Android fallback/native prompt and installed hide (simulated events)');})().catch(e=>{console.error(e);process.exit(1)});
