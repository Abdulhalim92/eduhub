---
description: PostgreSQL и миграции (zero-downtime)
paths:
  - "backend/**/*.sql"
  - "backend/**/repository/**"
---

## SQL (PostgreSQL)
- Только параметризованные запросы, без конкатенации строк
- Явные транзакции: BEGIN / COMMIT / ROLLBACK
- Использовать `sqlx` или `pgx`, не `database/sql` напрямую
- Закрывать rows и statements (`defer`)

## Миграции (zero-downtime)
- UP и DOWN обязательны
- Индексы: только `CREATE INDEX CONCURRENTLY`
- Запрещено: `ADD COLUMN NOT NULL` без DEFAULT, `ALTER COLUMN TYPE` на больших таблицах
- Паттерн: nullable → backfill → SET NOT NULL
