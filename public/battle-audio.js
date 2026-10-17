/* Battle-only audio. No score or network synchronization changes. */
(function(){
'use strict';
const key='hsmBattleAudio:v1',urls={bgm:'./audio/fluffing-a-duck.mp3',correct:'https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3',wrong:'https://assets.mixkit.co/active_storage/sfx/1110/1110-preview.mp3'};
let prefs={bgm:true,sfx:true};try{const p=JSON.parse(localStorage.getItem(key));for(const k of ['bgm','sfx'])if(typeof p?.[k]==='boolean')prefs[k]=p[k];}catch(_){}
let ctx,playing=null,active=false,roomId='',round=-1,seen='',generation=0;
const buffers={},pending={},failed={},effects=new Set();
async function load(name){if(Date.now()<(failed[name]||0))return null;if(buffers[name])return buffers[name];if(pending[name])return pending[name];pending[name]=(async()=>{
 let cache,response;try{cache=await caches.open('hsm-battle-audio-v1');response=await cache.match(urls[name]);}catch(_){}
 if(!response){response=await fetch(urls[name]);if(!response.ok)throw Error('audio unavailable');try{await cache?.put(urls[name],response.clone());}catch(_){}}
 const data=await response.arrayBuffer();return buffers[name]=await ctx.decodeAudioData(data);
})().catch(()=>{failed[name]=Date.now()+30000;return null;}).finally(()=>delete pending[name]);return pending[name];}
function stop(){generation++;if(playing){try{playing.stop();}catch(_){}playing=null;}for(const s of effects){try{s.stop();}catch(_){}}effects.clear();}
function source(buffer,volume,loop){const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buffer;s.loop=loop;g.gain.value=volume;s.connect(g);g.connect(ctx.destination);s.onended=()=>{s.disconnect();g.disconnect();effects.delete(s);};s.start();return s;}
async function music(){if(!active||document.hidden||!prefs.bgm||!ctx||ctx.state!=='running'||playing)return;const token=generation,buffer=await load('bgm');if(buffer&&token===generation&&active&&!document.hidden&&prefs.bgm&&!playing)playing=source(buffer,.16,true);}
function unlock(){try{if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();const resumed=ctx.resume(); // Called synchronously from a user gesture, before API awaits.
 Promise.resolve(resumed).then(()=>{if(prefs.sfx){load('correct');load('wrong');}if(prefs.bgm)load('bgm');music();}).catch(()=>{});
}catch(_){}}
function update(r,visible){const next=!!(visible&&!document.hidden&&r?.status==='playing'&&r.members?.some(m=>m.id===r.me&&!m.left));if(active!==next){active=next;if(!active)stop();}music();
 const same=roomId===r?.id&&round===r?.round;roomId=r?.id||'';round=r?.round??-1;
 if(!r?.revealUntil||!r.question?.correctId)return;
 const event=r.id+':'+r.round;if(seen===event)return;seen=event;
 // Do not replay old feedback when joining/resuming or when muted/hidden.
 if(!same||!active||!prefs.sfx||!ctx||ctx.state!=='running')return;
 const buffer=buffers[r.choice===r.question.correctId?'correct':'wrong'];if(buffer)effects.add(source(buffer,r.choice===r.question.correctId ? .55 : .35,false));
}
function toggle(name){if(!['bgm','sfx'].includes(name))return;prefs[name]=!prefs[name];try{localStorage.setItem(key,JSON.stringify(prefs));}catch(_){}if(name==='bgm'&&!prefs.bgm){generation++;if(playing){try{playing.stop();}catch(_){}playing=null;}}if(name==='sfx'&&!prefs.sfx){for(const s of effects){try{s.stop();}catch(_){}}effects.clear();}unlock();}
document.addEventListener('visibilitychange',()=>{if(document.hidden){active=false;round=-1;stop();}else if(ctx)unlock();});window.addEventListener('pagehide',()=>{active=false;stop();});
window.HSMBattleAudio={unlock,update,stop,toggle,settings:()=>({...prefs})};
})();
