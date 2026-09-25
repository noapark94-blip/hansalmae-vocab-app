create or replace function public.battle_play(p_actor uuid,p_action text,p_id uuid default null,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path=public as $$
declare b word_battles;t uuid;lo uuid;hi uuid;q jsonb;answer_key text;h jsonb;g jsonb;reveal boolean;review jsonb;fresh timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from profiles where id=p_actor and enabled and role='student') then raise exception '학생 로그인이 필요합니다.';end if;
 insert into battle_presence(user_id) values(p_actor) on conflict(user_id) do update set seen_at=now();
 if p_action='invite' then
  t:=(p_payload->>'target')::uuid;lo:=least(p_actor,t);hi:=greatest(p_actor,t);
  if t is null or t=p_actor then raise exception '친구를 확인해주세요.';end if;
  perform pg_advisory_xact_lock(hashtextextended(lo::text,91));perform pg_advisory_xact_lock(hashtextextended(hi::text,91));
  if not exists(select 1 from battle_friends where low_id=lo and high_id=hi and status='accepted') or exists(select 1 from battle_blocks where (actor=lo and target=hi) or(actor=hi and target=lo)) then raise exception '수락한 친구에게만 대전을 신청할 수 있어요.';end if;
  if not exists(select 1 from profiles where id=t and enabled and role='student') then raise exception '친구 계정을 확인해주세요.';end if;
  update word_battles set status='expired',reason='대기 시간이 지났어요.' where status in('invited','ready','playing') and updated_at<fresh-interval '2 minutes' and (host in(lo,hi) or guest in(lo,hi));
  if exists(select 1 from word_battles where status in('invited','ready','playing') and(host in(lo,hi) or guest in(lo,hi))) then raise exception '진행 중인 대전을 먼저 마쳐주세요.';end if;
  if (select count(*) from word_battles where host=p_actor and created_at>fresh-interval '1 minute')>=3 then raise exception '대전 신청은 잠시 후 다시 보내주세요.';end if;
  insert into word_battles(host,guest,settings,questions) values(p_actor,t,p_payload->'settings',p_payload->'questions') returning * into b;
 else
  select * into b from word_battles where id=p_id and p_actor in(host,guest) for update;
  if b.id is null then raise exception '대전에 참여할 수 없습니다.';end if;
 end if;
 if b.status in('invited','ready') and b.created_at<fresh-interval '2 minutes' then b.status:='expired';b.reason:='대기 시간이 지났어요.';end if;
 if b.status in('invited','ready','playing') and (not exists(select 1 from battle_friends where low_id=least(b.host,b.guest) and high_id=greatest(b.host,b.guest) and status='accepted') or exists(select 1 from battle_blocks where (actor=b.host and target=b.guest) or(actor=b.guest and target=b.host))) then b.status:='cancelled';b.reason:='친구 관계가 변경되어 대전이 종료됐어요.';end if;
 if p_action='accept' and b.status='invited' then
  if p_actor<>b.guest then raise exception '상대의 수락을 기다려주세요.';end if;b.status:='ready';
 elsif p_action='decline' and b.status='invited' then
  b.status:=case when p_actor=b.guest then 'declined' else 'cancelled' end;
 elsif p_action='leave' and b.status in('invited','ready','playing') then
  b.reason:='상대가 대전을 종료했어요.';
  if b.status='playing' then b.status:='finished';b.winner:=case when p_actor=b.host then b.guest else b.host end;else b.status:='cancelled';end if;
 elsif p_action='ready' and b.status='ready' then
  if p_actor=b.host then b.host_ready:=true;else b.guest_ready:=true;end if;
  if b.host_ready and b.guest_ready then b.status:='playing';b.round_at:=fresh+interval '3 seconds';end if;
 end if;
 if b.status='playing' then
  if b.updated_at<fresh-interval '2 minutes' then b.status:='expired';b.reason:='연결이 끊겨 대전을 종료했어요.';
  else
   if b.reveal_until is not null and fresh>=b.reveal_until then
    if b.round=9 then
     b.status:='finished';
     b.winner:=case when b.host_score>b.guest_score or(b.host_score=b.guest_score and b.host_ms<b.guest_ms) then b.host when b.guest_score>b.host_score or(b.host_score=b.guest_score and b.guest_ms<b.host_ms) then b.guest else null end;
    else b.round:=b.round+1;b.round_at:=fresh+interval '1 second';b.reveal_until:=null;end if;
   end if;
   if b.status='playing' and b.reveal_until is null then
    q:=b.questions->b.round;answer_key:=b.round::text||':'||p_actor::text;
    if p_action='answer' and (p_payload->>'round')::integer=b.round and fresh>=b.round_at and fresh<b.round_at+interval '10 seconds' and not(b.answers?answer_key) then
     if not exists(select 1 from jsonb_array_elements(q->'options')o where o->>'id'=p_payload->>'choice') then raise exception '보기를 확인해주세요.';end if;
     b.answers:=b.answers||jsonb_build_object(answer_key,jsonb_build_object('choice',p_payload->>'choice','ms',greatest(0,floor(extract(epoch from(fresh-b.round_at))*1000)::integer)));
    end if;
    h:=b.answers->(b.round::text||':'||b.host::text);g:=b.answers->(b.round::text||':'||b.guest::text);
    if (h is not null and g is not null) or fresh>=b.round_at+interval '10 seconds' then
     if h->>'choice'=q->>'correctId' then b.host_score:=b.host_score+1;b.host_ms:=b.host_ms+(h->>'ms')::integer;end if;
     if g->>'choice'=q->>'correctId' then b.guest_score:=b.guest_score+1;b.guest_ms:=b.guest_ms+(g->>'ms')::integer;end if;
     b.reveal_until:=fresh+interval '2 seconds';
    end if;
   end if;
  end if;
 end if;
 update word_battles set status=b.status,host_ready=b.host_ready,guest_ready=b.guest_ready,round=b.round,round_at=b.round_at,reveal_until=b.reveal_until,answers=b.answers,host_score=b.host_score,guest_score=b.guest_score,host_ms=b.host_ms,guest_ms=b.guest_ms,winner=b.winner,reason=b.reason,updated_at=case when b.status in('invited','ready') then updated_at else fresh end where id=b.id;
 q:=b.questions->b.round;reveal:=b.reveal_until is not null;
 if b.status='finished' then
  select coalesce(jsonb_agg(jsonb_build_object('word',v->>'word','meaning',v->>'meaning','example',v->>'example','translation',v->>'translation','correct',coalesce((b.answers->((ord-1)::text||':'||p_actor::text)->>'choice')=v->>'correctId',false)) order by ord),'[]'::jsonb) into review from jsonb_array_elements(b.questions) with ordinality as a(v,ord);
 end if;
 return jsonb_build_object('id',b.id,'status',b.status,'settings',b.settings,'me',p_actor,'host',battle_person(b.host),'guest',battle_person(b.guest),'hostReady',b.host_ready,'guestReady',b.guest_ready,'round',b.round,'roundAt',b.round_at,'deadline',b.round_at+interval '10 seconds','revealUntil',b.reveal_until,'serverNow',fresh,'hostScore',b.host_score,'guestScore',b.guest_score,'hostMs',b.host_ms,'guestMs',b.guest_ms,'winner',b.winner,'reason',b.reason,
 'answered',b.answers?(b.round::text||':'||p_actor::text),'opponentAnswered',b.answers?(b.round::text||':'||(case when p_actor=b.host then b.guest else b.host end)::text),
 'choice',b.answers->(b.round::text||':'||p_actor::text)->>'choice',
 'question',case when b.status='playing' and fresh>=b.round_at then jsonb_build_object('prompt',q->>'prompt','options',case when p_actor=b.host then q->'options' else (select jsonb_agg(value order by ord desc) from jsonb_array_elements(q->'options') with ordinality as a(value,ord)) end,'mode',q->>'mode','correctId',case when reveal then q->>'correctId' else null end) else null end,'review',review);
end; $$;
