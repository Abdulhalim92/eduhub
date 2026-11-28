-- 0012_drop_center_manager — роль «менеджер» центра не используется (ТЗ v2.5, 30-auth-rbac).
-- Существующих менеджеров переводим в администраторов, затем сужаем CHECK до teacher|admin.

UPDATE staff SET role = 'admin', updated_at = now() WHERE role = 'manager';

ALTER TABLE staff DROP CONSTRAINT staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('teacher', 'admin'));
