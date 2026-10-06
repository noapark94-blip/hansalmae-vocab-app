// Real collection UI and assets, fixture API; no live student changes.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--no-zygote']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync('public/index.html','utf8'),plugin=html.match(/<script id="hsmEmblemPlugin">([\s\S]*?)<\/script>/)[1];
 await page.route('**/*',async r=>{const u=new URL(r.request().url()),f=path.join(process.cwd(),'public',u.pathname==='/'?'index.html':u.pathname);if(u.hostname!=='app.test'||!fs.existsSync(f))return r.abort();let body=fs.readFileSync(f);if(f.endsWith('index.html'))body=Buffer.from(body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));await r.fulfill({body,contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':undefined});});
 await page.goto('https://app.test/');
 await page.evaluate(()=>{
  document.querySelector('#appSplash')?.remove();window.currentLoginToken='fixture';window.HSMDialog={alert(){}};let form='A';
  window.google={script:{run:{withSuccessHandler:ok=>({withFailureHandler:()=>({
   getStudentEmblems(){const e={emblemId:'title_dictionary',emblemName:'WALKING DICTIONARY',owned:true,equipped:true,form,imagePath:'./images/emblems/title-dictionary'+(form==='B'?'-b':'')+'.png',conditionText:'Lv.30 달성'};ok({success:true,emblems:[e],equippedEmblem:e,acquiredCount:1,totalCount:1});},
   equipStudentEmblem(token,id,next){form=next;ok({success:true});}
  })})}}};
 });
 await page.addScriptTag({content:plugin});
 await page.addScriptTag({content:fs.readFileSync('public/ui-icons.js','utf8')});
 await page.evaluate(async()=>{await HSMEmblems.load(true);HSMEmblems.open();HSMEmblems.showDetail('title_dictionary');});
 for(const width of [320,393,768]){
  await page.setViewportSize({width,height:700});
  await page.locator('[data-form="B"]').click();
  await page.locator('.collection-detail-image').evaluate(img=>img.decode());
  const box=await page.locator('#hsmCollectionDetail').boundingBox();assert(box.x>=0&&box.x+box.width<=width);
  assert.equal(await page.locator('[data-form="B"]').getAttribute('aria-pressed'),'true');
  if(width===393)await page.screenshot({path:'/tmp/dictionary-form-preview.png'});
 }
 await page.locator('.collection-detail-action').click();
 await page.waitForFunction(()=>document.querySelector('.collection-detail-message').textContent==='B폼을 적용했어요.');
 await page.locator('.collection-detail-close').click();
 await page.evaluate(()=>HSMEmblems.showDetail('title_dictionary'));
 assert.equal(await page.locator('[data-form="B"]').getAttribute('aria-pressed'),'true');
 assert(await page.locator('.collection-detail-action').isDisabled());
 await page.locator('#hsmCollectionDetailTitle').evaluate(el=>{el.textContent='오답 사냥꾼';});
 await page.waitForTimeout(50);
 assert.equal(await page.locator('#hsmCollectionDetailTitle .hsm-ui-icon').count(),0,'emblem title must not receive keyword action icons');
 assert.equal(await page.locator('#hsmCollectionDetailTitle').evaluate(el=>getComputedStyle(el).textAlign),'center');
 assert.equal(await page.locator('#hsmCollectionDetailTitle').evaluate(el=>el.classList.contains('hsm-icon-label')),false);
 assert.deepEqual(errors,[]);console.log('PASS real collection: preview/apply/reopen B form, 320/393/768px bounds, artwork loads, no JS errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
