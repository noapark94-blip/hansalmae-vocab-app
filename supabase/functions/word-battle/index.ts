import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {buildQuestions} from './questions.mts';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const str=(v:unknown)=>String(v??'').trim();
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function student(token:string){
 if(!token)throw new Error('로그인이 필요합니다.');
 const {data,error}=await admin.auth.getUser(token);if(error||!data.user)throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
 const {data:session,error:se}=await admin.from('student_active_sessions').select('token_hash,expires_at').eq('user_id',data.user.id).maybeSingle();
 if(se||!session||session.token_hash!==await hash(token)||new Date(session.expires_at).getTime()<=Date.now())throw new Error('현재 기기의 로그인 정보를 확인해주세요.');
 const {data:profile,error:pe}=await admin.from('profiles').select('id,role,enabled').eq('id',data.user.id).single();
 if(pe||!profile.enabled||profile.role!=='student')throw new Error('사용할 수 없는 학생 계정입니다.');
 return profile.id;
}
async function rpc(name:string,args:any){const {data,error}=await admin.rpc(name,args);if(error)throw new Error(error.message);return data;}
async function source(actor:string,target:string,p:any,room=false){
 const count=p.count===undefined?10:Number(p.count);
 if(![10,20,30].includes(count))throw new Error('문제 수는 10·20·30문제 중 선택해주세요.');
 const seconds=p.seconds===undefined?10:Number(p.seconds);
 if(![10,15,20].includes(seconds))throw new Error('제한 시간은 10·15·20초 중 선택해주세요.');
 const catalog=room?await rpc('battle_room_catalog',{p_actor:actor}):await rpc('battle_catalog',{p_actor:actor,p_target:target});
 const selected=catalog.find((x:any)=>x.id===str(p.source));if(!selected)throw new Error('두 학생이 이용할 수 있는 단어장을 선택해주세요.');
 let start=Number(p.start),end=Number(p.end);
 if(selected.kind==='school'){start=1;end=1;}
 else if(!Number.isInteger(start)||!Number.isInteger(end)||start>end||!selected.days.includes(start)||!selected.days.includes(end))throw new Error('Day 범위를 확인해주세요.');
 let rows:any[]=[];
 for(let offset=0;offset<20000;offset+=1000){
  let q=admin.from(selected.kind==='school'?'school_vocab_words':'words').select('word,meaning,example,translation').eq(selected.kind==='school'?'book_id':'word_set_id',selected.id).order('id').range(offset,offset+999);
  if(selected.kind!=='school')q=q.gte('day',start).lte('day',end);
  const {data,error}=await q;if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break;
 }
 return {questions:buildQuestions(rows,str(p.mode),count),settings:{source:selected.id,kind:selected.kind,title:selected.title,start,end,mode:str(p.mode),count,seconds}};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({success:false,message:'잘못된 요청입니다.'},405);
 try{
  const raw=await req.text();if(raw.length>12000)throw new Error('요청이 너무 큽니다.');
  const body=JSON.parse(raw);const actor=await student(str(body.token));const action=str(body.action),p=body.payload||{};let result;
  if(action==='roomCatalog')result=await rpc('battle_room_catalog',{p_actor:actor});
  else if(action==='roomCreate'){
   if(str(p.title).length>40||str(p.password).length>32)throw new Error('방 이름은 40자, 비밀번호는 32자까지 입력해주세요.');
   const built=await source(actor,'',p,true);
   result=await rpc('battle_room_play',{p_actor:actor,p_action:'create',p_payload:{title:str(p.title),capacity:Number(p.capacity),password:str(p.password),settings:built.settings}});
  }else if(action==='roomStart'){
   const settings=await rpc('battle_room_play',{p_actor:actor,p_action:'settings',p_id:str(p.id)});
   const built=await source(actor,'',settings,true);
   result=await rpc('battle_room_play',{p_actor:actor,p_action:'start',p_id:str(p.id),p_payload:{questions:built.questions}});
  }else if(['roomLobby','roomJoin','roomPoll','roomReady','roomAnswer','roomLeave','roomChat','roomRematch'].includes(action)){
   result=await rpc('battle_room_play',{p_actor:actor,p_action:action.slice(4).toLowerCase(),p_id:str(p.id)||null,p_payload:{password:str(p.password),ready:p.ready,round:p.round,choice:str(p.choice),kind:str(p.kind),body:str(p.body)}});
   if(result?.error)throw new Error(result.error);
  }else if(['home','search','request','acceptFriend','remove','declineFriend','block','unblock'].includes(action)){
   const mapped=action==='acceptFriend'?'accept':action==='declineFriend'?'decline':action;
   result=await rpc('battle_social',{p_actor:actor,p_action:mapped,p_target:p.target||null,p_search:str(p.search)});
  }else if(action==='rewardPreview')result=await rpc('battle_reward_allowance',{p_actor:actor,p_target:str(p.target)||null});
  else if(action==='chat')result=await rpc('battle_chat',{p_actor:actor,p_battle:str(p.id),p_kind:str(p.kind),p_body:str(p.body)});
  else if(action==='catalog')result=await rpc('battle_catalog',{p_actor:actor,p_target:str(p.target)});
  else if(action==='invite'){
   const built=await source(actor,str(p.target),p);
   result=await rpc('battle_play',{p_actor:actor,p_action:'invite',p_payload:{...built,target:str(p.target)}});
  }else if(['poll','accept','decline','ready','answer','leave'].includes(action)){
   result=await rpc('battle_play',{p_actor:actor,p_action:action,p_id:str(p.id),p_payload:{round:p.round,choice:str(p.choice)}});
  }else throw new Error('지원하지 않는 요청입니다.');
  if(result?.id&&['invite','poll','accept','decline','ready','answer','leave'].includes(action)){
   // Chat availability must never interrupt answering or starting the game.
   try{result.chat=await rpc('battle_chat',{p_actor:actor,p_battle:result.id});}catch(_){result.chat=null;}
  }
  return reply({success:true,result});
 }catch(e){return reply({success:false,message:e instanceof Error?e.message:'요청을 처리하지 못했어요.'},400);}
});
