import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const code=readFileSync('public/friend-battle.js','utf8');
let clock=100000,calls=0,visible=false,hidden=false,hold;
const ctx=vm.createContext({
 Date:{now:()=>clock},document:{get hidden(){return hidden;}},
 active:()=>visible,who:()=>'me',live:()=>ctx.game&&['invited','ready','playing'].includes(ctx.game.status),
 $:id=>id==='mainApp'?{classList:{contains:()=>false}}:null,
 api:async()=>{calls++;if(hold)await hold;return {battles:[]};},
 stamp:()=>{},updateBadge:()=>{},renderHome:()=>{},toast:()=>{},
 busy:false,pollBusy:false,lastPoll:0,revision:0,game:null,home:null,
});
vm.runInContext(code.slice(code.indexOf(' function pollInterval()'),code.indexOf(' function updateBadge()')),ctx);
await ctx.refresh();assert.equal(calls,1);
clock+=20000;await ctx.refresh();assert.equal(calls,1,'idle app does not poll every 20 seconds');
clock+=40000;await ctx.refresh();assert.equal(calls,2,'idle invites are still checked each minute');
ctx.home={battles:[{status:'invited'}]};clock+=20000;await ctx.refresh();assert.equal(calls,3,'known invitations keep the faster interval');
visible=true;clock+=7000;await ctx.refresh();assert.equal(calls,4,'friend screen remains responsive');
ctx.game={id:'g',status:'playing'};clock+=1400;await ctx.refresh();assert.equal(calls,5,'active match cadence unchanged');
ctx.game.status='ready';clock+=500;await ctx.refresh();assert.equal(calls,6,'ready cadence unchanged');
ctx.game.status='finished';clock+=7000;await ctx.refresh();assert.equal(calls,6,'finished match avoids frequent polling');
clock+=23000;await ctx.refresh();assert.equal(calls,7,'finished result still refreshes');
hidden=true;clock+=60000;await ctx.refresh(true);assert.equal(calls,7,'background tabs never poll');
hidden=false;await ctx.refresh(true);assert.equal(calls,8,'returning to the app can immediately refresh');
let release;hold=new Promise(r=>release=r);const pending=ctx.refresh(true);await ctx.refresh(true);assert.equal(calls,9,'concurrent polls are suppressed');release();await pending;
console.log('PASS idle/pending/active/results polling, hidden tabs, forced refresh and concurrent request suppression');
