-- Откат 0009_finance. Сначала зависимые таблицы.
DROP TABLE IF EXISTS salary_accruals;
DROP TABLE IF EXISTS salary_schemes;
DROP TABLE IF EXISTS lesson_balances;
DROP TABLE IF EXISTS payments;
DROP SEQUENCE IF EXISTS receipt_no_seq;
DROP TABLE IF EXISTS cash_shifts;
DROP TABLE IF EXISTS cash_settings;
