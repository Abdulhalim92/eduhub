-- Откат 0006_cabinet. Сначала зависимые таблицы.
DROP TABLE IF EXISTS access_credentials;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS center_profiles;
