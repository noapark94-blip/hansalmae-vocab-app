-- Run as the database owner. All fixture data and XP are rolled back.
begin;
do $$
declare uid uuid; eid uuid:=gen_random_uuid(); tid uuid:=gen_random_uuid(); r jsonb; payload jsonb; denied boolean;
begin
 select id into uid from public.profiles where role='student' and enabled limit 1;
 insert into public.teacher_exams(id,title,source_type,question_count,question_type,target_type,created_by,status)
 values(eid,'__audit_rollback_exam__','database',1,'engToKor','students',uid,'active');
 insert into public.exam_assignments(exam_id,user_id) values(eid,uid);
 payload:=jsonb_build_object('test_kind','teacher','teacher_exam_id',eid,'question_count',1,'correct_count',1,'score',100,'attempt',1);
 r:=public.submit_teacher_exam_atomic(uid,eid,tid,payload,'[]',1);
 if (r->>'attempt')::int<>1 then raise exception 'first attempt failed'; end if;
 r:=public.submit_teacher_exam_atomic(uid,eid,tid,payload,'[]',1);
 if not (r->>'duplicated')::boolean or (r->>'awarded_xp')::int<>0 then raise exception 'duplicate failed'; end if;
 if (select attempt from public.exam_assignments where exam_id=eid and user_id=uid)<>1 then raise exception 'duplicate incremented attempt'; end if;
 denied:=false;
 begin perform public.submit_teacher_exam_atomic(uid,eid,gen_random_uuid(),payload,'[]',1); exception when others then denied:=SQLERRM like '%이미 응시%'; end;
 if not denied then raise exception 'retake restriction failed'; end if;
 update public.teacher_exams set allow_retake=true where id=eid;
 denied:=false;
 begin perform public.submit_teacher_exam_atomic(uid,eid,gen_random_uuid(),payload,'[]',1); exception when others then denied:=SQLERRM like '%이미 제출%'; end;
 if not denied then raise exception 'stale attempt restriction failed'; end if;
 payload:=jsonb_set(payload,'{attempt}','2');
 update public.teacher_exams set ends_at=now()-interval '1 minute' where id=eid;
 denied:=false;
 begin perform public.submit_teacher_exam_atomic(uid,eid,gen_random_uuid(),payload,'[]',1); exception when others then denied:=SQLERRM like '%기간이 끝%'; end;
 if not denied then raise exception 'deadline restriction failed'; end if;
 update public.teacher_exams set ends_at=null,status='cancelled' where id=eid;
 denied:=false;
 begin perform public.submit_teacher_exam_atomic(uid,eid,gen_random_uuid(),payload,'[]',1); exception when others then denied:=SQLERRM like '%취소된%'; end;
 if not denied then raise exception 'cancel restriction failed'; end if;
end $$;
rollback;
