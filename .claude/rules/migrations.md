---
description: Миграции PostgreSQL (EduHub, zero-downtime)
---

## Правила
- UP и DOWN обязательны
- Все изменения схемы планировать как zero-downtime (NFR: uptime ≥ 99.5%)

## Запрещено (даунтайм/локи)
- `ALTER TABLE ADD COLUMN NOT NULL` без DEFAULT
- `ALTER COLUMN TYPE` на больших таблицах (полная перезапись)
- `CREATE INDEX` без `CONCURRENTLY`
- `LOCK TABLE`
- `DROP COLUMN` без миграционного окна (сначала убрать из кода → деплой → потом дроп)

## Безопасные паттерны
- nullable → backfill батчами → `SET NOT NULL`
- `CREATE INDEX CONCURRENTLY` (часто вне транзакции)
- rename: новая колонка → копия данных → переключение кода → удаление старой

## Типы данных EduHub
- IDs: UUID
- Time: `TIMESTAMPTZ`
- Координаты институций: `GEOGRAPHY(Point, 4326)`, GIST-индекс
- Двуязычные поля (ru/tg): JSONB `{ru, tg}` (паттерн уже используется в `web/lib/i18n.tsx` на фронте — при появлении своей БД сохранить симметрию)

## Чеклист
- [ ] Нет блокирующих операций
- [ ] Индексы CONCURRENTLY
- [ ] Обратимость (DOWN) продумана
- [ ] Прогнано на «больших» данных/стейдже
