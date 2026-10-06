begin;
set local statement_timeout='15s';
set local lock_timeout='2s';
do $test$
declare u uuid; count_before integer;
begin
 select id into u from profiles where role='student' and enabled limit 1;
 if u is null then raise exception 'No student fixture'; end if;
 insert into student_emblems(user_id,emblem_id) values(u,'title_dictionary') on conflict do nothing;
 select count(*) into count_before from student_emblems where user_id=u;
 perform equip_student_emblem_form_atomic(u,'title_dictionary','B');
 if battle_person(u)->>'image'<>'./images/emblems/title-dictionary-b.png' then raise exception 'B battle appearance'; end if;
 perform equip_student_emblem_form_atomic(u,'title_dictionary');
 if (select form from student_emblems where user_id=u and emblem_id='title_dictionary')<>'B' then raise exception 'Legacy equip must preserve form'; end if;
 perform equip_student_emblem_form_atomic(u,'title_dictionary','A');
 if battle_person(u)->>'image'<>'./images/emblems/title-dictionary.png' then raise exception 'A battle appearance'; end if;
 begin
  perform equip_student_emblem_form_atomic(u,'title_dictionary','C');
  raise exception 'invalid accepted';
 exception when raise_exception then if sqlerrm='invalid accepted' then raise; end if; end;
 begin
  perform equip_student_emblem_form_atomic(u,'title_chick','B');
  raise exception 'invalid accepted';
 exception when raise_exception then if sqlerrm='invalid accepted' then raise; end if; end;
 if count_before<>(select count(*) from student_emblems where user_id=u) then raise exception 'Extra collectible created'; end if;
 if 1<>(select count(*) from student_emblems where user_id=u and equipped) then raise exception 'Equipment uniqueness'; end if;
 delete from student_emblems where user_id=u and emblem_id='title_dictionary';
 begin
  perform equip_student_emblem_form_atomic(u,'title_dictionary','B');
  raise exception 'unowned accepted';
 exception when raise_exception then if sqlerrm='unowned accepted' then raise; end if; end;
 if has_function_privilege('anon','public.equip_student_emblem_form_atomic(uuid,text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.equip_student_emblem_form_atomic(uuid,text,text)','EXECUTE') then raise exception 'Public equip access'; end if;
end $test$;
select 'PASS forms A/B, battle appearance, legacy preservation, ownership, validation, collection count, uniqueness, server-only permissions; rollback' as verification;
rollback;
