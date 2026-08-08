-- 3차: 운영 데이터가 증가해도 주요 화면이 느려지지 않도록 합니다.
create index if not exists test_results_user_status_taken_idx
on public.test_results(user_id,status,taken_at desc);

create index if not exists test_results_monthly_ranking_idx
on public.test_results(word_set_id,taken_at,user_id)
include(points,score,status)
where points>0;

create index if not exists test_results_teacher_count_idx
on public.test_results(user_id,test_kind)
where test_kind='teacher';

create index if not exists wrong_words_user_word_idx
on public.wrong_words(user_id,mastered,last_wrong_at desc);

create index if not exists experience_logs_user_created_idx
on public.experience_logs(user_id,created_at desc);

create index if not exists vocabulary_books_user_created_idx
on public.vocabulary_books(user_id,is_default,created_at desc);

create index if not exists exam_assignments_user_status_idx
on public.exam_assignments(user_id,status,assigned_at desc);

create index if not exists teacher_exams_status_ends_idx
on public.teacher_exams(status,ends_at desc,created_at desc);

create index if not exists notifications_user_unread_idx
on public.notifications(user_id,created_at desc)
where read_at is null;

create index if not exists daily_activity_user_date_idx
on public.student_daily_activity(user_id,activity_date desc);
