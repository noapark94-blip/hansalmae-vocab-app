-- Replace school data and assignments in one transaction. Only the Edge service may invoke this.
create or replace function public.save_school_book_atomic(p_kind text, p_book_id uuid, p_values jsonb, p_items jsonb, p_student_ids text[], p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_book_id uuid := coalesce(p_book_id,gen_random_uuid());
  old_updated timestamptz;
  new_updated timestamptz := clock_timestamp();
  student_ids uuid[];
  requested integer;
  item_count integer;
begin
  if p_kind not in ('vocab','content') then raise exception '지원하지 않는 자료입니다.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception '학습 자료를 입력해주세요.'; end if;
  select count(distinct x) into requested from unnest(p_student_ids) x;
  select array_agg(id) into student_ids from profiles where role='student' and enabled and student_id=any(p_student_ids);
  if requested=0 or coalesce(array_length(student_ids,1),0)<>requested then raise exception '선택한 학생 계정을 다시 확인해주세요.'; end if;
  item_count := jsonb_array_length(p_items);
  if p_kind='vocab' then
    if p_book_id is not null then
      select updated_at into old_updated from school_vocab_books where id=v_book_id for update;
      if not found then raise exception '단어장을 찾을 수 없습니다.'; end if;
      if p_expected_updated_at is not null and old_updated<>p_expected_updated_at then raise exception '다른 선생님이 먼저 수정했습니다. 최신 내용을 다시 열어 확인해주세요.'; end if;
      update school_vocab_books set title=p_values->>'title',school_name=coalesce(p_values->>'school_name',''),grade_label=coalesce(p_values->>'grade_label',''),description=coalesce(p_values->>'description',''),enabled=coalesce((p_values->>'enabled')::boolean,true),updated_at=new_updated where id=v_book_id;
    else
      insert into school_vocab_books(id,title,school_name,grade_label,description,enabled,updated_at) values(v_book_id,p_values->>'title',coalesce(p_values->>'school_name',''),coalesce(p_values->>'grade_label',''),coalesce(p_values->>'description',''),true,new_updated);
    end if;
    delete from school_vocab_words w where w.book_id=v_book_id;
    insert into school_vocab_words(book_id,position,word,meaning,example,translation)
      select v_book_id,ordinality::integer,item->>'word',item->>'meaning',coalesce(item->>'example',''),coalesce(item->>'translation','') from jsonb_array_elements(p_items) with ordinality as x(item,ordinality);
    delete from school_vocab_assignments a where a.book_id=v_book_id and not(a.user_id=any(student_ids));
    insert into school_vocab_assignments(book_id,user_id) select v_book_id,x from unnest(student_ids) x on conflict do nothing;
  else
    if p_book_id is not null then
      select updated_at into old_updated from school_content_books where id=v_book_id for update;
      if not found then raise exception '본문을 찾을 수 없습니다.'; end if;
      if p_expected_updated_at is not null and old_updated<>p_expected_updated_at then raise exception '다른 선생님이 먼저 수정했습니다. 최신 내용을 다시 열어 확인해주세요.'; end if;
      update school_content_books set title=p_values->>'title',school_name=coalesce(p_values->>'school_name',''),grade_label=coalesce(p_values->>'grade_label',''),textbook=coalesce(p_values->>'textbook',''),unit_label=coalesce(p_values->>'unit_label',''),description=coalesce(p_values->>'description',''),sentences=p_items,sentence_count=item_count,enabled=coalesce((p_values->>'enabled')::boolean,true),updated_at=new_updated where id=v_book_id;
    else
      insert into school_content_books(id,title,school_name,grade_label,textbook,unit_label,description,sentences,sentence_count,updated_at)
      values(v_book_id,p_values->>'title',coalesce(p_values->>'school_name',''),coalesce(p_values->>'grade_label',''),coalesce(p_values->>'textbook',''),coalesce(p_values->>'unit_label',''),coalesce(p_values->>'description',''),p_items,item_count,new_updated);
    end if;
    delete from school_content_assignments a where a.book_id=v_book_id and not(a.user_id=any(student_ids));
    insert into school_content_assignments(book_id,user_id) select v_book_id,x from unnest(student_ids) x on conflict do nothing;
  end if;
  return jsonb_build_object('success',true,'bookId',v_book_id,'wordCount',item_count,'sentenceCount',item_count,'studentCount',requested,'updatedAt',new_updated);
end $$;
revoke all on function public.save_school_book_atomic(text,uuid,jsonb,jsonb,text[],timestamptz) from public,anon,authenticated;
grant execute on function public.save_school_book_atomic(text,uuid,jsonb,jsonb,text[],timestamptz) to service_role;

alter table public.school_vocab_test_results add column if not exists request_id uuid;
alter table public.school_content_results add column if not exists request_id uuid;
create unique index if not exists school_vocab_result_request_idx on public.school_vocab_test_results(user_id,request_id);
create unique index if not exists school_content_result_request_idx on public.school_content_results(user_id,request_id);
