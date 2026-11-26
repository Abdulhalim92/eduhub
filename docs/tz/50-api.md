# 50. API

Контракт API определяется требованиями спецификации (`docs/spec/src/`), а не интерфейсами клиентов: клиенты и макеты меняются, бэкенд — нет. Этот файл фиксирует соглашения и перечисляет методы по модулям; пути ниже — рекомендованные и окончательно закрепляются в OpenAPI. Расхождение между кодом и требованием решается правкой спецификации (`Q-…`), а не молча в коде. Описание публикуется как OpenAPI (`backend/api/openapi.yaml`), клиентские типы и проверка схемы генерируются из него.

## Соглашения

| Тема | Правило |
|:--|:--|
| Базовый путь | `/api/v1`; обратная совместимость внутри версии, устаревание через `Deprecation` и срок |
| Формат | JSON, UTF-8, ключи `camelCase`, деньги целыми дирамами в полях `…Dirams`, даты ISO 8601 UTC |
| Деньги | Во всех полях API и в сервисах только целые дирамы (`BR-027`); перевод в сомони делает клиент при показе |
| Аутентификация | `Authorization: Bearer <access>`; публичные: `/auth/*`, `/catalog/*`, `/webhooks/*` |
| Центр | Центр берётся из токена; в путях `/centers/{id}/…` или `/cabinet/centers/{c}/…` идентификатор обязан совпасть с токеном, кроме методов платформы |
| Идемпотентность | Заголовок `Idempotency-Key` обязателен для `POST` и `PUT` с деньгами, тарифом, балансом, баллами, доступом, SMS |
| Списки | `page`, `pageSize` (по умолчанию 10, максимум 100), в ответе `items`, `total`, `meta`; фильтры в query; сортировка `sort=field,-field` |
| Ошибки | Единый формат ниже; HTTP-статус по классу ошибки |
| Язык | Заголовок `Accept-Language: ru|tg` и язык профиля; тексты ошибок для пользователя берутся из словаря по коду |
| Версионирование схемы | Новые поля необязательны, удаление — только через `deprecated` |
| Корреляция | Заголовок `X-Request-Id` принимается и возвращается, попадает во все логи |

## Формат ошибки

Единый формат: код, сообщение, ошибки по полям:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Достигнут лимит сотрудников тарифа",
    "fields": { "phone": "Телефон уже используется" },
    "requestId": "..."
  }
}
```

| Код | HTTP | Когда |
|:--|:--|:--|
| `VALIDATION` | 422 | Поле не прошло проверку (поле в `fields`) |
| `UNAUTHENTICATED` | 401 | Нет или истёк токен |
| `FORBIDDEN` | 403 | Роль не даёт права, режим поддержки, подписка `read_only` |
| `NOT_FOUND` | 404 | Нет объекта или он принадлежит другому центру (без раскрытия) |
| `CONFLICT` | 409 | Нарушено бизнес-правило: лимит, неверный статус, занятый логин |
| `IDEMPOTENCY_MISMATCH` | 422 | Тот же ключ с другим телом |
| `RATE_LIMITED` | 429 | Превышен лимит запросов |
| `INTERNAL` | 500 | Внутренняя ошибка без деталей (`requestId` для поиска) |

Коды предметных ошибок (`CENTER_BLOCKED`, `LIMIT_STAFF`, `BALANCE_INSUFFICIENT`, `CHARGE_NOT_FOUND`, `TX_DUPLICATE`, `SELF_RECONCILE`, `REASON_REQUIRED`, `POINTS_INSUFFICIENT`, …) входят в поле `code` вместе с общим HTTP-классом; полный список ведётся в `openapi.yaml`.

## Методы платформы и центра по требованиям

Источник — требования `PLT-…` и `CTR-…` спецификации. Сгруппировано по модулям; пути рекомендованные.

| Модуль | Методы (REST) |
|:--|:--|
| `tenancy`, `analytics` | `GET /centers`, `POST /centers`, `GET /centers/activity`, `/centers/expiring`, `/centers/churn`, `/centers/name-available`, `GET /centers/{id}/profile`, `/centers/{id}/people`, `PUT /centers/{id}/manager`, `POST /centers/{id}/contact`, `POST /centers/remind`, `GET /platform/attention`, `GET /dictionaries`, `GET /global-ids/lookup` |
| `plans` | `GET /plans`, `POST /plans`, `PATCH /plans/{id}`, `GET /plans/near-limit`, `GET /centers/{id}/plan-change`, `POST /centers/{id}/plan-change`, `POST /centers/offers` |
| `billing`, `balance` | `GET /billing/invoices`, `GET /billing/invoices/{id}`, `POST /billing/invoices/remind`, `.../pay-from-balance`, `.../confirm`, `.../cancel`, `POST /centers/{id}/invoice`, `GET /centers/{id}/finance`, `POST /centers/{id}/balance/top-up`, `PUT /centers/{id}/overdraft`, `POST /centers/{id}/invoices/{id}/pay-online` |
| `sms` | `GET /sms/packages`, `GET /sms/sales`, `POST /sms/sales`, `PUT /sms/packages/{id}` |
| `marketplace` | `/marketplace/courses` (список, создание, цена, публикация, снятие, `grants`, `buyers`), `/marketplace/requests`, `/marketplace/access/{id}/revoke`, `/courses/{id}` и вложенные модули, уроки, материалы, `/centers/{id}/courses`, `/centers/{id}/courses/catalog`, `/centers/{id}/course-requests` |
| `moderation` | `GET /moderation`, `POST /moderation/{id}/decision`, `POST /moderation/{id}/requeue`, `/centers/{id}/branches`, `GET /geocode` |
| `audit`, `support` | `GET /audit`, `POST /support/sessions` |
| `identity` | `POST /auth/login`, `POST /auth/password`, `POST /centers/{id}/admin-access`, `POST /cabinet/centers/{c}/access` |
| `people`, `learning`, `points` | `/cabinet/centers/{c}/dashboard`, `/schedule`, `/users`, `/students`, `/students/{id}/status`, `/groups` и состав, `/points/rules` (автоправила), `/analytics`, `/students/{id}/points`, `/centers/{id}/staff` |

Онлайн-оплата счетов закрывается вебхуками шлюза, а не вызовом клиента.

## Новые методы (спецификация 2.4)

Префикс `/cabinet/centers/{c}`, если не указано иное.

### Вход

| Метод | REST | Требование |
|:--|:--|:--|
| `auth.otpRequest` | `POST /auth/otp/request` | `SYS-ACC-030` |
| `auth.otpVerify` | `POST /auth/otp/verify` | `SYS-ACC-030` |
| `auth.refresh` / `auth.logout` | `POST /auth/refresh` · `POST /auth/logout` | `SYS-ACC-030` |
| `auth.sessions` | `GET /auth/sessions` · `DELETE /auth/sessions/{id}` | `Q-023` |
| `auth.selectMembership` | `POST /auth/membership {tenantId, role}` | `BR-035` |
| `people.changePhone` | `POST /students/{id}/phone` (причина, подтверждение личности) | `BR-036` |

### Начисления и платежи

| Метод | REST | Примечание |
|:--|:--|:--|
| `finance.charges.list` | `GET /charges?studentId=&groupId=&period=&status=` | Фильтры, пагинация |
| `finance.charges.create` | `POST /charges {studentId, groupId, period, amountDirams}` | `CTR-FIN-050` |
| `finance.charges.adjust` | `POST /charges/{id}/adjustments {amountDirams, reason}` | `BR-032`, причина обязательна |
| `finance.payments.record` | `POST /payments` | `Idempotency-Key`; тело: связка, месяц, сумма, способ, p2p-поля |
| `finance.payments.list` | `GET /payments?status=&method=&from=&to=&cashierId=` | Сверка и отчёты |
| `finance.payments.reconcile` | `POST /payments/{id}/reconcile {selfConfirm?}` | Свой платёж только с `selfConfirm`, отметка `selfReconciled` (`BR-040`) |
| `finance.payments.reverse` | `POST /payments/{id}/reversals {amountDirams, reason}` | Сторно, `BR-031` |
| `finance.receipts.get` | `GET /payments/{id}/receipt` | PDF |
| `finance.shifts.open/close` | `POST /shifts` · `POST /shifts/{id}/close` | Z-отчёт |
| `finance.acquiring.settings` | `PUT /finance/acquiring` | Ключи шифруются |
| `finance.refunds` | `POST /payments/{id}/refunds {amountDirams, reason}` | `CTR-FIN-090` |
| `finance.balance` | `GET /students/{id}/finance` | Долги по связкам, переплата, баллы |
| `webhooks.acquiring` | `POST /webhooks/acquiring/{provider}` | Публичный, подпись |
| `webhooks.billing` | `POST /webhooks/billing/{provider}` | Онлайн-оплата счетов платформы |

### Баллы, расходы, зарплата

| Метод | REST |
|:--|:--|
| `points.balance` | `GET /students/{id}/points` (лоты, сроки, остатки) |
| `points.grant` | `POST /students/{id}/points {points, source, ref}` (преподаватель в пределах бюджета) |
| `points.spend` | `POST /charges/{id}/points {points}` (`Idempotency-Key`) |
| `points.settings` | `GET/PUT /points/settings` (срок жизни, курс обмена) |
| `expenses.list/create/reverse` | `GET /expenses` · `POST /expenses` · `POST /expenses/{id}/reversals` |
| `expenses.categories` | `GET/POST /expense-categories` |
| `reports.profit` | `GET /reports/profit?from=&to=` |
| `reports.payments` | `GET /reports/payments?from=&to=` (отчёт владельцу) |
| `payroll.statement` | `GET /payroll/{period}` · `POST /payroll/{period}/entries {kind, amountDirams, reason}` · `POST /payroll/{period}/close` |

### Обучение

| Метод | REST |
|:--|:--|
| `learning.sessions.list/mark` | `GET /sessions` · `PUT /sessions/{id}/attendance` · `POST /sessions/{id}/held` |
| `learning.schedule.exception` | `POST /schedule/exceptions` (перенос, замена, каникулы) |
| `learning.rooms` | `GET/POST /rooms` |
| `learning.homework`, `tests` | `/homework`, `/tests`, `/tests/{id}/attempts` |
| `leads` | `GET/POST /leads`, `POST /leads/{id}/trial` (запись на пробный), `POST /leads/{id}/enroll`, `POST /leads/{id}/decline` |
| `discounts` | `GET/POST /discount-rules`, `PATCH /discount-rules/{id}` (владелец), `POST /students/{id}/discounts {ruleId, reason}`, `DELETE /students/{id}/discounts/{aid}` |
| `settings` | `GET /settings`, `PUT /settings/{key}` (владелец, «было → стало» в аудите) |
| `ownership` | `POST /centers/{id}/ownership-transfer {newOwnerPhone, reason}` (платформа, `BR-039`) |

### Родитель и ученик

| Метод | REST |
|:--|:--|
| `me.memberships` | `GET /me` |
| `me.children` | `GET /me/children` |
| `me.finance` | `GET /me/children/{id}/finance` |
| `me.schedule` | `GET /me/schedule` |
| `catalog.search` | `GET /catalog/branches?lat=&lng=&q=` (публично, без входа) |

### Платформа

| Метод | REST |
|:--|:--|
| `platform.staff` | `GET/POST /platform/staff`, смена роли с причиной |
| `support.end` | `DELETE /support/sessions/{id}` |
| `audit.verify` | `POST /audit/verify` (проверка цепочки хэшей) |
| `subscriptions.state` | `GET /centers/{id}/subscription` |

## Таблица соответствия методов и требований

Полная трассировка «требование → модуль → этап» — `85-traceability.md`. Для новых методов правило такое: метод без ссылки на требование или `BR-…` в OpenAPI не принимается в ревью.
