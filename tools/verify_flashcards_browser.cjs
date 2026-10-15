// Real page/CSS/module in Chromium; room/session data is a local fixture.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--no-zygote','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async r=>{const u=new URL(r.request().url());const f=path.join(process.cwd(),'public',u.pathname==='/'?'index.html':u.pathname);if(u.hostname!=='app.test'||!fs.existsSync(f))return r.abort();let body=fs.readFileSync(f);if(f.endsWith('index.html'))body=Buffer.from(body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));await r.fulfill({body,contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.svg')?'image/svg+xml':undefined});});
 await page.goto('https://app.test/');await page.evaluate(()=>{document.querySelector('#appSplash')?.remove();document.querySelector('#loginScreen').classList.add('hidden');document.querySelector('#mainApp').classList.remove('hidden');document.querySelectorAll('#mainApp>.card').forEach(e=>e.classList.add('hidden'));window.setInterval=()=>0;window.currentStudent={studentId:'me'};window.hsmEnsureStudentSession_=async()=>'test';window.hideAllStudentMainScreens_=()=>{};window.setActiveMenu=()=>{};window.HANSALMAE_CONFIG={apiUrl:'https://app.test/api'};});

 await page.evaluate(()=>{window.currentLoginToken='test';window.getCheckedWords=()=>[{word:'remember',meaning:'기억하다; 잊지 않고 마음에 간직하다'},{word:'discover',meaning:'발견하다'}];window.getSelectedPersonalRows_=()=>[];window.getSelectedWrongRows_=()=>[];window.personalVocabularyWords=[];window.wrongNotebookWords=[];});
 await page.addScriptTag({content:fs.readFileSync('public/flashcards.js','utf8')});
 for(const width of [320,393,768,1280]){
 await page.setViewportSize({width,height:width===320?568:852});
 await page.evaluate(()=>HSMFlashcards.open(getCheckedWords(),'중등 단어 · Day 1'));
 await page.locator('#fcShuffle').uncheck();await page.locator('[data-fc=start]').click();await page.locator('.fc-card').hover();await page.mouse.down();assert(await page.locator('.fc-answer').isVisible());await page.mouse.up();assert(!(await page.locator('.fc-answer').isVisible()));
 const rect=await page.locator('.fc-decisions').boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width);assert(rect.y+rect.height<=(width===320?568:852));
 assert.equal(await page.locator('.fc-answer').textContent(),'기억하다; 잊지 않고 마음에 간직하다');
 assert(await page.locator('#hsmFlashcards').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await page.waitForTimeout(240);if(width===393)await page.screenshot({path:'/tmp/flashcards-study.png'});
 await page.locator('[data-fc=known]').click();await page.locator('[data-fc=close]').click();await page.locator('[data-fc=continue]').click();assert(await page.locator('.fc-card').isVisible());await page.locator('[data-fc=close]').click();await page.locator('[data-fc=exit]').click();
 }
 for(const width of [320,393,768]){
 await page.setViewportSize({width,height:width===320?568:852});await page.evaluate(()=>HSMFlashcards.open(getCheckedWords(),'중등 단어 · Day 1'));await page.locator('[data-fc=start]').click();await page.locator('[data-fc=known]').click();await page.locator('[data-fc=known]').click();
 assert(!(await page.locator('#hsmFlashcards').textContent()).includes('쌓아'));if(width===393)await page.screenshot({path:'/tmp/fc-done.png'});
 await page.locator('[data-fc=quiz]').click();assert.equal(await page.locator('#fcTitle').textContent(),'확인 시험');
 assert(await page.locator('#hsmFlashcards').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 if(width===393)await page.screenshot({path:'/tmp/fc-quiz.png'});
 const prompt=await page.locator('.fc-quiz-prompt').textContent();const right=prompt==='remember'?'기억하다; 잊지 않고 마음에 간직하다':'발견하다';await page.getByRole('button',{name:right,exact:true}).click();await page.waitForTimeout(750);assert.notEqual(await page.locator('.fc-quiz-prompt').textContent(),prompt);
 await page.locator('[data-fc=close]').click();await page.locator('[data-fc=exit]').click();
 }
 await page.setViewportSize({width:320,height:568});await page.evaluate(()=>HSMFlashcards.open([{word:'one',meaning:'첫 번째 뜻'},{word:'two',meaning:'두 번째 뜻'},{word:'three',meaning:'세 번째 뜻'},{word:'four',meaning:'네 번째 뜻'}],'4개 선택'));
 await page.locator('[data-fc=start]').click();for(let n=0;n<4;n++)await page.locator('[data-fc=known]').click();await page.locator('[data-fc=quiz]').click();assert.equal(await page.locator('[data-choice]').count(),4);
 await page.locator('[data-choice]').last().scrollIntoViewIfNeeded();assert(await page.locator('[data-choice]').last().isVisible());assert(await page.locator('#hsmFlashcards').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.locator('[data-fc=close]').click();await page.locator('[data-fc=exit]').click();
 await page.setViewportSize({width:320,height:568});await page.evaluate(()=>HSMFlashcards.open([{word:'longword'.repeat(20),meaning:'아주 긴 뜻을 보여줄 때에도 모든 내용을 읽을 수 있어야 합니다. '.repeat(20)}],'긴 단어'));await page.locator('[data-fc=start]').click();await page.locator('[data-fc=reveal]').dispatchEvent('pointerdown',{button:0,pointerId:1});
 assert(await page.locator('#hsmFlashcards').evaluate(e=>e.scrollWidth<=e.clientWidth+1));const foot=await page.locator('.fc-decisions').boundingBox();assert(foot.y+foot.height<=568);assert(await page.locator('.fc-main').evaluate(e=>e.scrollHeight>e.clientHeight));
 await browser.close();console.log('PASS browser: 320/393/768/1280, fixed controls, long text scrolling, no horizontal overflow');
})().catch(e=>{console.error(e);process.exit(1)});
