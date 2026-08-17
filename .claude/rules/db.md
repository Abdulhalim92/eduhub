---
description: PostgreSQL и миграции (zero-downtime)
---

## SQL (PostgreSQL + PostGIS)
- Только параметризованные запросы, без конкатенации строк
- Явные транзакции: BEGIN / COMMIT / ROLLBACK
- Использовать `sqlx` или `pgx`, не `database/sql` напрямую
- Закрывать rows и statements (`defer`)
- PostGIS: гео-поиск «рядом со мной» через `GEOGRAPHY(Point)` + `ST_DWithin`/`ST_Distance`, индекс `GIST` на гео-колонке

## Миграции (zero-downtime)
- UP и DOWN обязательны
- Индексы: только `CREATE INDEX CONCURRENTLY`
- Запрещено: `ADD COLUMN NOT NULL` без DEFAULT, `ALTER COLUMN TYPE` на больших таблицах
- Паттерн: nullable → backfill → SET NOT NULL
