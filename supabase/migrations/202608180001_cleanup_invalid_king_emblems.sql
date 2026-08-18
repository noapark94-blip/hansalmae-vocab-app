-- 과거 월간 랭킹 엠블럼 판정 버그로 잘못 지급된 '왕의 무게'를 정리합니다.
-- 정상 조건: 확정(finalized=true)된 월간 1위이면서 당시 학년군에 맞는 부문이어야 합니다.
-- middle 학생은 middle 부문만, high 학생은 high/csat 부문만 인정합니다.

-- 장착 중인 잘못된 왕의 무게가 있으면 삭제와 함께 자연스럽게 장착 해제됩니다.
delete from public.student_emblems se
where se.emblem_id = 'achievement_king'
  and not exists (
    select 1
    from public.monthly_ranking_history mrh
    where mrh.user_id = se.user_id
      and mrh.rank = 1
      and mrh.finalized = true
      and (
        (mrh.winner_grade_group = 'middle' and mrh.category = 'middle')
        or
        (mrh.winner_grade_group = 'high' and mrh.category in ('high', 'csat'))
      )
  );

-- 참고: 과거 오지급 당시 지급된 XP는 레벨/누적 경험치 연쇄 변동을 막기 위해
-- 자동 차감하지 않습니다. 엠블럼 소유 상태만 정확한 조건에 맞게 복구합니다.
