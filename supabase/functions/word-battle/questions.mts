export function shuffle<T>(items:T[]):T[]{
 const out=items.slice();for(let i=out.length-1;i>0;i--){const r=new Uint32Array(1);crypto.getRandomValues(r);const j=r[0]%(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;
}
export function buildQuestions(rows:any[],mode:string,count=10){
 if(!['engToKor','korToEng','mixed'].includes(mode))throw new Error('문제 유형을 선택해주세요.');
 if(![10,20,30].includes(count))throw new Error('문제 수는 10·20·30문제 중 선택해주세요.');
 const clean=rows.filter(w=>String(w.word||'').trim()&&String(w.meaning||'').trim());
 const normalized=(s:any)=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
 const seen=new Set<string>();
 const pool=shuffle(clean).filter(w=>{const k=normalized(w.word);if(seen.has(k))return false;seen.add(k);return true;});
 const questions:any[]=[];
 for(const row of pool){
  const direction=mode==='mixed'?(questions.length%2?'korToEng':'engToKor'):mode;
  const promptKey=direction==='engToKor'?'word':'meaning',answerKey=direction==='engToKor'?'meaning':'word';
  // Exclude ambiguous prompts and any equivalent distractor.
  const valid=new Set(clean.filter(w=>normalized(w[promptKey])===normalized(row[promptKey])).map(w=>normalized(w[answerKey])));
  if(valid.size!==1)continue;
  const used=new Set(valid);
  const distractors=shuffle(clean).filter(w=>{const k=normalized(w[answerKey]);if(used.has(k))return false;used.add(k);return true;}).slice(0,3);
  if(distractors.length!==3)continue;
  const correctId=crypto.randomUUID();
  questions.push({prompt:String(row[promptKey]),options:shuffle([{id:correctId,text:String(row[answerKey])},...distractors.map(w=>({id:crypto.randomUUID(),text:String(w[answerKey])}))]),correctId,mode:direction,word:row.word,meaning:row.meaning,example:row.example||'',translation:row.translation||''});
  if(questions.length===count)break;
 }
 if(questions.length<count)throw new Error(count+'문제를 만들기에는 단어가 부족해요. 범위를 넓히거나 문제 수를 줄여주세요.');
 return questions;
}
