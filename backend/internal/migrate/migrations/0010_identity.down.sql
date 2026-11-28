-- Откат 0010_identity.
DROP TABLE IF EXISTS otp_codes;
DROP INDEX IF EXISTS idx_students_account;
ALTER TABLE students DROP COLUMN IF EXISTS account_id;
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS accounts;
