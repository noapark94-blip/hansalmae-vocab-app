-- New matches opt in; old completed/in-flight matches are never paid retroactively.
alter table public.word_battles add column rewards_enabled boolean not null default false;
alter table public.word_battles alter column rewards_enabled set default true;
create table public.battle_rewards (
 battle_id uuid not null references public.word_battles(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 opponent_id uuid not null references public.profiles(id) on delete cascade,
 reward_day date not null,
 eligible_count integer not null default 0 check(eligible_count between 0 and 30),
 correct_count integer not null default 0 check(correct_count between 0 and eligible_count),
 points integer not null default 0 check(points>=0),
 xp integer not null default 0 check(xp>=0),
 total_before integer not null default 0,
 total_after integer not null default 0,
 reason text not null,
 test_id uuid references public.test_results(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(battle_id,user_id)
);
create index battle_rewards_daily on public.battle_rewards(user_id,reward_day,opponent_id);
create index battle_rewards_opponent on public.battle_rewards(opponent_id);
create index battle_rewards_test on public.battle_rewards(test_id) where test_id is not null;
alter table public.battle_rewards enable row level security;
revoke all on public.battle_rewards from public,anon,authenticated;
grant all on public.battle_rewards to service_role;

create or replace function public.battle_reward_allowance(p_actor uuid,p_target uuid default null) returns jsonb
language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('remaining',greatest(0,100-coalesce(sum(eligible_count),0)),
 'pairRemaining',greatest(0,3-count(*) filter(where opponent_id=p_target)), 'dailyLimit',100,'pairLimit',3)
 from battle_rewards where user_id=p_actor and reward_day=(now() at time zone 'Asia/Seoul')::date;
$$;
revoke all on function public.battle_reward_allowance(uuid,uuid) from public,anon,authenticated;
grant execute on function public.battle_reward_allowance(uuid,uuid) to service_role;

create or replace function public.battle_settle_rewards(p_battle uuid) returns void
language plpgsql security invoker set search_path=public as $$
declare b word_battles;u uuid;other_id uuid;day_value date:=(now() at time zone 'Asia/Seoul')::date;
 n integer;graded integer;allowed integer;correct integer;points_value integer;xp_value integer;
 allowance jsonb;reason_value text;before_xp integer;after_xp integer;test_uuid uuid;set_uuid uuid;
 grade_group text;score_value numeric;natural_finish boolean;
begin
 select * into b from word_battles where id=p_battle for update;
 if b.id is null or b.status<>'finished' or not b.rewards_enabled then return;end if;
 -- Serialize daily caps for both participants; normal XP writes use the existing atomic row lock.
 for u in select id from (values(b.host),(b.guest)) users(id) order by id loop
  insert into student_experience(user_id) values(u) on conflict do nothing;
  perform pg_advisory_xact_lock(hashtextextended(u::text,192));
 end loop;
 n:=jsonb_array_length(b.questions);
 natural_finish:=b.reason is null and b.round=n-1 and b.reveal_until is not null;
 graded:=case when natural_finish then n else least(n,b.round+case when b.reveal_until is not null then 1 else 0 end) end;
 for u in select id from (values(b.host),(b.guest)) users(id) order by id loop
  if exists(select 1 from battle_rewards where battle_id=b.id and user_id=u) then continue;end if;
  other_id:=case when u=b.host then b.guest else b.host end;
  allowance:=battle_reward_allowance(u,other_id);
  allowed:=least(graded,(allowance->>'remaining')::integer);
  reason_value:='awarded';points_value:=0;xp_value:=0;test_uuid:=null;set_uuid:=null;
  if not natural_finish and b.winner is distinct from u then allowed:=0;reason_value:='forfeit';
  elsif (allowance->>'pairRemaining')::integer=0 then allowed:=0;reason_value:='pair_limit';
  elsif allowed=0 then reason_value:=case when graded=0 then 'no_rounds' else 'daily_limit' end;
  elsif not natural_finish then reason_value:='opponent_left';
  elsif allowed<n then reason_value:='partial';end if;
  select count(*)::integer into correct from jsonb_array_elements(b.questions) with ordinality q(v,ord)
   where ord<=allowed and b.answers->((ord-1)::text||':'||u::text)->>'choice'=v->>'correctId';
  xp_value:=correct*2;
  if natural_finish and allowed>0 then
   points_value:=floor((case when b.winner is null then 3 when b.winner=u then 5 else 1 end)*allowed/10.0)::integer;
   xp_value:=xp_value+floor(5*allowed/10.0)::integer;
  end if;
  select total_xp into before_xp from student_experience where user_id=u;
  after_xp:=before_xp;
  if points_value>0 or xp_value>0 then
   if b.settings->>'kind'='standard' then
    select id into set_uuid from word_sets where id=(b.settings->>'source')::uuid;
   else
    select ranking_grade_group(base_grade,base_year,date_trunc('month',now() at time zone 'Asia/Seoul')::date) into grade_group from profiles where id=u;
    select id into set_uuid from word_sets where enabled and ranking_category_from_name(name)=coalesce(grade_group,'middle') order by name,id limit 1;
   end if;
   if points_value>0 and set_uuid is null then raise exception '포인트를 합산할 단어장을 확인해주세요.';end if;
   test_uuid:=gen_random_uuid();
   score_value:=case when allowed>0 then round(correct*100.0/allowed) else 0 end;
   perform save_student_test_result_atomic(u,test_uuid,jsonb_build_object(
    'test_kind','battle','word_set_id',set_uuid,'question_type',b.settings->>'mode',
    'start_day',case when b.settings->>'kind'='standard' then b.settings->'start' else null end,
    'end_day',case when b.settings->>'kind'='standard' then b.settings->'end' else null end,
    'question_count',allowed,'correct_count',correct,'score',score_value,
    'grade',case when b.winner is null then 'DRAW' when b.winner=u then 'WIN' else 'LOSE' end,
    'points',points_value,'raw_result',jsonb_build_object('source','battle','battleId',b.id,'title',b.settings->>'title','rewardReason',reason_value)
   ),'[]',xp_value,'battle:'||b.id::text||':'||u::text);
   select total_xp into after_xp from student_experience where user_id=u;
   before_xp:=after_xp-xp_value;
  end if;
  insert into battle_rewards(battle_id,user_id,opponent_id,reward_day,eligible_count,correct_count,points,xp,total_before,total_after,reason,test_id)
   values(b.id,u,other_id,day_value,allowed,correct,points_value,xp_value,before_xp,after_xp,reason_value,test_uuid);
 end loop;
end;$$;
revoke all on function public.battle_settle_rewards(uuid) from public,anon,authenticated;
grant execute on function public.battle_settle_rewards(uuid) to service_role;

create or replace function public.battle_rewards_on_finish() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 perform battle_settle_rewards(new.id);
 return new;
end;$$;
revoke all on function public.battle_rewards_on_finish() from public,anon,authenticated;
grant execute on function public.battle_rewards_on_finish() to service_role;
create trigger word_battle_reward_finish after update of status on public.word_battles
 for each row when (old.status is distinct from new.status and new.status='finished') execute function public.battle_rewards_on_finish();

create or replace function public.battle_reward_view(p_battle uuid,p_actor uuid) returns jsonb
language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('points',r.points,'xp',r.xp,'eligibleCount',r.eligible_count,'reason',r.reason,
 'totalBefore',r.total_before,'totalXp',r.total_after,'level',coalesce(l.level,1),'title',coalesce(l.title,'단어병아리'),
 'previousLevel',coalesce(prev.level,1),'currentLevelXp',coalesce(l.required_xp,0),'nextLevelXp',n.required_xp,
 'progress',case when n.required_xp is null then 100 else greatest(0,least(100,round((r.total_after-coalesce(l.required_xp,0))*100.0/greatest(1,n.required_xp-coalesce(l.required_xp,0))))) end)
 from battle_rewards r
 left join lateral(select level,title,required_xp from level_settings where required_xp<=r.total_after order by required_xp desc limit 1) l on true
 left join lateral(select level from level_settings where required_xp<=r.total_before order by required_xp desc limit 1) prev on true
 left join lateral(select required_xp from level_settings where required_xp>r.total_after order by required_xp limit 1) n on true
 where r.battle_id=p_battle and r.user_id=p_actor;
$$;
revoke all on function public.battle_reward_view(uuid,uuid) from public,anon,authenticated;
grant execute on function public.battle_reward_view(uuid,uuid) to service_role;

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
    if b.round>=jsonb_array_length(b.questions)-1 then
     b.status:='finished';
     b.winner:=case when b.host_score>b.guest_score or(b.host_score=b.guest_score and b.host_ms<b.guest_ms) then b.host when b.guest_score>b.host_score or(b.host_score=b.guest_score and b.guest_ms<b.host_ms) then b.guest else null end;
    else b.round:=b.round+1;b.round_at:=fresh+interval '1 second';b.reveal_until:=null;end if;
   end if;
   if b.status='playing' and b.reveal_until is null then
    q:=b.questions->b.round;answer_key:=b.round::text||':'||p_actor::text;
    if p_action='answer' and (p_payload->>'round')::integer=b.round and fresh>=b.round_at and fresh<b.round_at+make_interval(secs => coalesce((b.settings->>'seconds')::integer,10)) and not(b.answers?answer_key) then
     if not exists(select 1 from jsonb_array_elements(q->'options')o where o->>'id'=p_payload->>'choice') then raise exception '보기를 확인해주세요.';end if;
     b.answers:=b.answers||jsonb_build_object(answer_key,jsonb_build_object('choice',p_payload->>'choice','ms',greatest(0,floor(extract(epoch from(fresh-b.round_at))*1000)::integer)));
    end if;
    h:=b.answers->(b.round::text||':'||b.host::text);g:=b.answers->(b.round::text||':'||b.guest::text);
    if (h is not null and g is not null) or fresh>=b.round_at+make_interval(secs => coalesce((b.settings->>'seconds')::integer,10)) then
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
 return jsonb_build_object('id',b.id,'status',b.status,'settings',b.settings,'me',p_actor,'host',battle_person(b.host),'guest',battle_person(b.guest),'hostReady',b.host_ready,'guestReady',b.guest_ready,'round',b.round,'roundAt',b.round_at,'deadline',b.round_at+make_interval(secs => coalesce((b.settings->>'seconds')::integer,10)),'revealUntil',b.reveal_until,'serverNow',fresh,'hostScore',b.host_score,'guestScore',b.guest_score,'hostMs',b.host_ms,'guestMs',b.guest_ms,'winner',b.winner,'reason',b.reason,
 'answered',b.answers?(b.round::text||':'||p_actor::text),'opponentAnswered',b.answers?(b.round::text||':'||(case when p_actor=b.host then b.guest else b.host end)::text),
 'choice',b.answers->(b.round::text||':'||p_actor::text)->>'choice',
 'question',case when b.status='playing' and fresh>=b.round_at then jsonb_build_object('prompt',q->>'prompt','options',case when p_actor=b.host then q->'options' else (select jsonb_agg(value order by ord desc) from jsonb_array_elements(q->'options') with ordinality as a(value,ord)) end,'mode',q->>'mode','correctId',case when reveal then q->>'correctId' else null end) else null end,'review',review,'rewardsEnabled',b.rewards_enabled,'reward',battle_reward_view(b.id,p_actor));
end; $$;
