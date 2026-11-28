-- Откат 0001_init. Порядок обратный созданию (сначала зависимые объекты).
DROP TRIGGER IF EXISTS trg_audit_log_no_update ON audit_log;
DROP FUNCTION IF EXISTS audit_log_immutable();
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS centers;
DROP TABLE IF EXISTS managers;
DROP TABLE IF EXISTS plans;
