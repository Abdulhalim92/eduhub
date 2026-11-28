# Deployment

> **Назначение:** как локально поднять проект, какие есть окружения, как работает CI/CD и деплой в продакшен.
> **Обновлено:** YYYY-MM

---

## Окружения

| Окружение | Назначение | URL | Доступ |
|-----------|-----------|-----|--------|
| `local` | Локальная разработка | `http://localhost:3000` | разработчик |
| `dev` | Общий dev-стенд | `https://api-dev.example.com` | команда |
| `staging` | Pre-prod, идентичен prod | `https://api-staging.example.com` | команда + QA |
| `production` | Боевая среда | `https://api.example.com` | публично |

---

## Локальный запуск

### Требования
- [Node.js / Go / Python / ...] версии `[X.Y.Z]` (см. `.nvmrc` / `go.mod` / `pyproject.toml`)
- Docker и Docker Compose
- [Дополнительные тулзы]

### Шаги

```bash
# 1. Клонировать репозиторий
git clone <repo-url>
cd <project>

# 2. Скопировать переменные окружения
cp .env.example .env
# Затем заполнить значения в .env (см. раздел "Переменные окружения" ниже)

# 3. Установить зависимости
[npm install / go mod download / poetry install]

# 4. Поднять зависимости (БД, Redis, очереди)
docker-compose up -d

# 5. Применить миграции
[команда миграций]

# 6. Накатить сиды (опционально, для dev-данных)
[команда сидов]

# 7. Запустить приложение в watch-режиме
[команда запуска]
```

После запуска:
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Health-check: `http://localhost:3000/health`

### Частые проблемы

- **Порт занят** → проверь `docker ps` и `lsof -i :3000`.
- **Миграции не применяются** → проверь `DATABASE_URL` в `.env`.
- **[Другая частая проблема]**

---

## Переменные окружения

| Переменная | Обязательно | Пример | Описание |
|------------|-------------|--------|----------|
| `NODE_ENV` | ✅ | `development` | окружение |
| `PORT` | ✅ | `3000` | HTTP-порт |
| `DATABASE_URL` | ✅ | `postgresql://...` | строка подключения к БД |
| `REDIS_URL` | ✅ | `redis://localhost:6379` | Redis |
| `JWT_SECRET` | ✅ | — | секрет для подписи JWT |
| `JWT_ACCESS_TTL` | ⚪ | `15m` | время жизни access-токена |
| `LOG_LEVEL` | ⚪ | `info` | уровень логирования |
| `SENTRY_DSN` | ⚪ | — | мониторинг ошибок |

Полный шаблон — в `.env.example`. **Никогда не коммитим `.env` с реальными значениями.**

Секреты в prod/staging хранятся в [Vault / AWS Secrets Manager / GitHub Secrets].

---

## CI/CD

### Пайплайн

```
PR open  →  lint  →  unit tests  →  integration tests  →  build
                                                          ↓
                                                    [merge в main]
                                                          ↓
                                              build Docker image
                                                          ↓
                                              push в registry
                                                          ↓
                                         auto-deploy на dev и staging
                                                          ↓
                                         manual approve → production
```

### Что блокирует мерж
- Падающие тесты.
- Покрытие < [X]%.
- Линтер ошибки.
- Не пройденный security scan.
- Нет approve от ревьюера.

---

## Деплой в production

- **Триггер:** ручной апрув в CI после успешного staging-релиза.
- **Стратегия:** rolling update (или blue-green / canary — указать).
- **Окно деплоя:** [рабочие часы / любое время / только вторник-четверг].
- **Откат:** автоматически при провале health-check, вручную — через `[команда]`.

### Чек-лист перед prod-релизом

- [ ] Миграции протестированы на staging
- [ ] Breaking changes задокументированы в changelog
- [ ] Feature flags настроены (если применимо)
- [ ] Команда оповещена в `#releases`
- [ ] Мониторинг и алерты не сигналят

---

## Мониторинг и алерты

- **Метрики:** [Prometheus / Datadog] — `https://...`
- **Логи:** [Grafana Loki / Kibana / Datadog Logs] — `https://...`
- **APM/трассировка:** [Jaeger / Datadog APM] — `https://...`
- **Ошибки:** [Sentry] — `https://...`
- **Алерты:** Slack-канал `#alerts-<service>`.

---

## On-call

- Дежурство по графику в [PagerDuty / OpsGenie].
- Эскалация: on-call → tech lead → CTO.
- Runbook'и по типовым инцидентам: [ссылка].
