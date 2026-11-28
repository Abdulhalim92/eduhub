-- Откат 0008_journal. Сначала зависимые таблицы.
DROP TABLE IF EXISTS test_submissions;
DROP TABLE IF EXISTS tests;
DROP TABLE IF EXISTS point_grants;
DROP TABLE IF EXISTS group_point_budgets;
DROP TABLE IF EXISTS teacher_shifts;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS lessons;
