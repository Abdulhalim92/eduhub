-- Откат 0012: возвращаем допустимость роли «менеджер» в CHECK.
-- Данные не восстанавливаются: бывшие менеджеры остаются администраторами.
ALTER TABLE staff DROP CONSTRAINT staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('teacher', 'admin', 'manager'));
