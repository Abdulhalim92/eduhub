---
description: Миграции PostgreSQL (zero-downtime)
paths:
  - "backend/**/*.sql"
  - "backend/**/migrations/**"
---

## Правила
- UP и DOWN обязательны
- Все изменения схемы планировать как zero-downtime

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

## Типы данных
- Money: `BIGINT` в дирамах (1 сомони = 100 дирам), см. `money.md`
- Time: `TIMESTAMPTZ`
- IDs: UUID/Bigint (по стандарту проекта)

## Чеклист
- [ ] Нет блокирующих операций
- [ ] Индексы CONCURRENTLY
- [ ] Обратимость (DOWN) продумана
- [ ] Прогнано на “больших” данных/стейдже
