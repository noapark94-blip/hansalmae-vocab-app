import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync('public/mobile-nav-viewport.js','utf8');
for(const visual of [true,false]){
 const dom=new JSDOM('<body class="hsm-student-app-open"><nav id="hsmMobileNav"></nav></body>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,nav=w.document.querySelector('nav'),mql=new w.EventTarget();mql.matches=true;w.matchMedia=()=>mql;
 const vv=new w.EventTarget();vv.height=844;vv.offsetTop=0;
 Object.defineProperty(w,'visualViewport',{value:visual?vv:null});Object.defineProperty(w,'innerHeight',{value:844,writable:true});
 let height=104,frame=null,scheduled=0,resize;nav.getBoundingClientRect=()=>({height});
 w.requestAnimationFrame=fn=>{frame=fn;scheduled++;return scheduled;};w.ResizeObserver=class{constructor(fn){resize=fn;}observe(){}};
 w.eval(source);const flush=()=>{const fn=frame;frame=null;if(fn)fn();};flush();
 const top=()=>parseFloat(nav.style.getPropertyValue('--hsm-mobile-nav-top'));
 assert.equal(top(),740,'safe area height counted once');
 if(visual){vv.height=500;vv.offsetTop=42;vv.dispatchEvent(new w.Event('resize'));flush();assert.equal(top(),438);vv.height=844;vv.offsetTop=0;vv.dispatchEvent(new w.Event('resize'));flush();assert.equal(top(),740,'restores bottom after keyboard closes');
  for(const h of [915,840,360,840,393,915,844]){vv.height=h;vv.dispatchEvent(new w.Event('resize'));flush();assert.equal(top(),h-104,'Android address bar, keyboard and orientation viewport: '+h);}}
 else{w.innerHeight=780;w.dispatchEvent(new w.Event('resize'));flush();assert.equal(top(),676);}
 const before=scheduled;for(let i=0;i<20;i++)w.dispatchEvent(new w.Event('scroll'));assert.equal(scheduled,before+1,'scroll updates coalesced');flush();
 height=80;resize();flush();assert.equal(top(),(visual?844:780)-80,'height changes');
 mql.matches=false;mql.dispatchEvent(new w.Event('change'));flush();assert.equal(nav.style.getPropertyValue('--hsm-mobile-nav-top'),'','desktop positioning unaffected');
 mql.matches=true;height=0;resize();flush();assert.equal(nav.style.getPropertyValue('--hsm-mobile-nav-top'),'','hidden dock not positioned');height=104;resize();flush();assert.ok(Number.isFinite(top()));
 dom.window.close();
}
console.log('PASS visible viewport anchoring, keyboard restore, safe area, resize, scroll throttling, hidden and desktop states');
