-- Rename the existing collectible without changing ownership, equipment or criteria.
update public.emblem_settings
set name = '도감 수집가'
where id = 'achievement_vocab_trainer';
