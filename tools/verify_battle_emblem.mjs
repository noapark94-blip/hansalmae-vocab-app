import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../supabase/functions/api/index.ts',import.meta.url),'utf8');
// Strip TypeScript using the same runtime as the existing API regression tests.
const {stripTypeScriptTypes}=await import('node:module');
const body=source.split('case "getStudentEmblems": {')[1].split('case "equipStudentEmblem":')[0].trim().slice(0,-1);
const fn=new (Object.getPrototypeOf(async function(){}).constructor)('admin','profileFromToken','experienceView','args','attendanceStreak','perfectTestStreak','eligibleFinalRankingWin','consecutiveMonthlyWins','num','str','grantXp','emblemImage',stripTypeScriptTypes('async function fixture(){'+body+'}').replace(/^async function fixture\(\)\s*\{/, '').replace(/\}\s*$/, ''));
let count=0,owned=[],grants=0;
const setting={id:'achievement_battle_chick',name:'쌈닭',image_path:'./images/emblems/achievement-battle-chick.png',condition_type:'BATTLE_COMPLETE_COUNT',condition_value:3};
const admin={rpc:async name=>({data:name==='battle_completed_count'?count:null}),from(table){
 let insert=null;
 const q={select(){return q;},eq(){return q;},gte(){return q;},order(){return q;},limit(){return q;},upsert(rows){insert=rows;return q;},then(resolve,reject){try{if(insert)for(const row of insert)if(!owned.some(x=>x.emblem_id===row.emblem_id))owned.push({...row,equipped:false,form:'A'});return Promise.resolve({data:table==='emblem_settings'?[setting]:table==='student_emblems'?owned.map(x=>({...x})):[],count:0}).then(resolve,reject);}catch(e){return Promise.reject(e).then(resolve,reject);}}};return q;
}};
const run=()=>fn(admin,async()=>({id:'fixture'}),async()=>({level:1}),['token'],()=>0,()=>0,()=>false,()=>0,Number,String,async()=>{grants++;},e=>e.image_path);
for(count=0;count<3;count++){const r=await run();assert.equal(r.emblems[0].owned,false);assert.equal(r.emblems[0].progressValue,count);assert.equal(r.emblems[0].progressLabel,`대전 완료 ${count} / 3회`);}
count=3;let r=await run();assert.equal(r.emblems[0].owned,true);assert.equal(r.newlyGrantedEmblems[0].emblemName,'쌈닭');assert.equal(grants,1);assert.equal(r.emblems[0].description,'작지만 물러서지 않는 승부사');
r=await run();assert.equal(grants,1);assert.equal(r.newlyGrantedEmblems.length,0);
console.log('PASS actual emblem API: progress 0/1/2, unlock at 3, description, repeat read does not regrant');
