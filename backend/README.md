# Бэкенд «Линия»

Go-бэкенд платформы «Линия» (Multi-Tenant SaaS для учебных центров). Модульный монолит,
Clean Architecture (handler → service → repository). Реализует контракт из шапки
`../src/js/core/api.js`. Прототип в корне репозитория не трогаем.

Этот инкремент покрывает фундамент платформы SuperAdmin: вход и смена пароля, справочники,
тарифы и центры. Денежное ядро (счета, баланс, овердрафт), SMS, маркетплейс, модерация и
кабинет центра — следующими итерациями.

## Стек

- Go 1.26 · Gin (HTTP) · GORM + PostgreSQL 16 · JWT (golang-jwt) · bcrypt
- Миграции — версионированные SQL (`internal/migrate/migrations`, golang-migrate в режиме
  библиотеки, встроены через `embed.FS`; CLI не нужен)
- Деньги — `int64` в дирамах (1 сомони = 100 дирам), в JSON отдаются целыми сомони

## Быстрый старт

```sh
cp .env.example .env                 # при необходимости поправьте
docker compose up -d                 # Postgres на 127.0.0.1:5433
go run ./cmd/seed                    # миграции + демо-данные (тарифы, 29 центров, суперадмин)
go run ./cmd/api                     # сервер на :8080
```

Сидер печатает логин/пароль суперадмина (по умолчанию `admin` / `admin12345`).

> Порт Postgres — **5433** на хосте (5432 часто занят локально установленным PostgreSQL;
> на Windows `localhost` резолвится в IPv6 и уводит на локальный сервер — используйте `127.0.0.1`).

### Проверки

```sh
go build ./...
go vet ./...
TEST_DATABASE_URL="postgres://eduhub:eduhub@127.0.0.1:5433/eduhub_test?sslmode=disable" \
  go test ./... -count=1          # +интеграционные (иначе пропускаются)
golangci-lint run
govulncheck ./...
```

Создать тестовую БД один раз: `docker exec eduhub-db psql -U eduhub -d eduhub -c "CREATE DATABASE eduhub_test OWNER eduhub;"`

## Структура

```
cmd/api            точка входа (миграции на старте, graceful shutdown)
cmd/seed           dev-сидер (идемпотентный), данные повторяют mock api.js
internal/
  config           конфиг из env
  database         пул GORM+Postgres
  migrate          запуск SQL-миграций из embed.FS
  middleware       request_id, slog, recover, CORS
  server           сборка роутера из модулей
  auth             вход, смена пароля, JWT, RBAC, блокировка подбора
  audit            неизменяемый журнал (BR-010)
  ledger           единственное место списаний/пополнений баланса (FOR UPDATE, BR-005)
  idempotency      Idempotency-Key: безопасный повтор денежных мутаций
  modules/
    dictionaries   GET /dictionaries
    plans          GET/POST/PATCH /plans  (эталонный срез)
    centers        GET /centers, name-available, manager, contact
    billing        счета, оплата (ручная/с баланса/онлайн), отмена, смена тарифа, продление
    finance        баланс, пополнение, лимит овердрафта
    marketplace    магазин методик: курсы, программа, передача центрам, заявки, собственные курсы
    sms            биллинг SMS-пакетов: каталог, начисление, история продаж
    moderation     каталог филиалов: очередь модерации и решения, заявки центров, геокодер (мок)
    cabinet        кабинет центра: профиль, сотрудники, ученики, группы, расписание, дашборд, доступ,
                   награды, автоправила coin, аналитика coin
    journal        электронный журнал (LRN-TCH): занятия, посещаемость, смены, баллы за успехи, тесты
    cashier        касса центра (CTR-FIN) и зарплаты (CTR-PAY): оплаты/чеки, смены с Z-отчётом,
                   возвраты (сторно), скидка за баллы, схемы и автоначисление зарплаты при «Проведён»
    identity       мобильный контур (ТЗ v2.5): аккаунт по телефону, членства, вход по OTP, /me
    catalog        публичный каталог филиалов на карте (LRN-CAT) и заявки на пробный урок (CTR-CRM)
    student        кабинет ученика (LRN-PRN-030): расписание, материалы, тесты, баллы, финансы/чеки
  credentials      выдача логина/пароля сотрудникам и ученикам (BR-025)
  integration      интеграционные тесты против реального Postgres (деньги, маркетплейс, SMS, модерация, кабинет, журнал, касса, identity, каталог, ученик)
pkg/
  apierr           ApiError {code, message, fields} — зеркало фронтового контракта
  money            тип Diram (int64) + JSON в сомони
  httpx            ответы об ошибках, пагинация
```

## Реализованные эндпоинты

| Контракт (api.js)        | Метод и путь                       | Права       |
|:--|:--|:--|
| `auth.login`             | `POST /auth/login`                 | публичный   |
| `auth.changePassword`    | `POST /auth/password`              | публичный   |
| `dictionaries.get`       | `GET /dictionaries`                | авторизован |
| `plans.list`             | `GET /plans`                       | авторизован |
| `plans.create`           | `POST /plans`                      | SuperAdmin  |
| `plans.update`           | `PATCH /plans/{id}`                | SuperAdmin  |
| `centers.list`           | `GET /centers?q=&plan=&city=&filter=&page=&pageSize=` | SuperAdmin |
| `centers.nameAvailable`  | `GET /centers/name-available?name=`| SuperAdmin  |
| `centers.setManager`     | `PUT /centers/{id}/manager`        | SuperAdmin  |
| `centers.markContacted`  | `POST /centers/{id}/contact`       | SuperAdmin  |
| `billing.list`           | `GET /billing/invoices?status=&kind=&q=` | SuperAdmin |
| `billing.get`            | `GET /billing/invoices/{id}`       | SuperAdmin  |
| `billing.remind`         | `POST /billing/invoices/remind`    | SuperAdmin  |
| `billing.confirmPayment` | `POST /billing/invoices/{id}/confirm` | SuperAdmin |
| `billing.payFromBalance` | `POST /billing/invoices/{id}/pay-from-balance` | SuperAdmin |
| `billing.simulateOnlinePayment` | `POST /billing/invoices/{id}/pay-online` | SuperAdmin (мок шлюза) |
| `billing.cancel`         | `POST /billing/invoices/{id}/cancel` | SuperAdmin |
| `centers.planChangeInfo` | `GET /centers/{id}/plan-change`    | SuperAdmin  |
| `centers.requestPlanChange` | `POST /centers/{id}/plan-change` | SuperAdmin  |
| `centers.invoice`        | `POST /centers/{id}/invoice`       | SuperAdmin  |
| `finance.get`            | `GET /centers/{id}/finance`        | SuperAdmin  |
| `finance.topUp`          | `POST /centers/{id}/balance/top-up` | SuperAdmin |
| `finance.setOverdraft`   | `PUT /centers/{id}/overdraft`      | SuperAdmin  |
| `marketplace.list`       | `GET /marketplace/courses?q=&direction=&status=` | SuperAdmin |
| `marketplace.create`     | `POST /marketplace/courses`        | SuperAdmin  |
| `marketplace.setPrice`   | `PUT /marketplace/courses/{id}/price` | SuperAdmin |
| `marketplace.publish/unpublish` | `POST /marketplace/courses/{id}/publish\|unpublish` | SuperAdmin |
| `marketplace.sell`       | `POST /marketplace/courses/{id}/grants` (mode invoice\|balance\|bonus) | SuperAdmin |
| `marketplace.buyers`     | `GET /marketplace/courses/{id}/buyers` | SuperAdmin |
| `marketplace.revoke`     | `POST /marketplace/access/{id}/revoke` | SuperAdmin |
| `marketplace.requests.*` | `GET /marketplace/requests`, `POST /marketplace/requests/{id}/process` | SuperAdmin |
| `courses.get/update`     | `GET\|PATCH /courses/{id}`         | SuperAdmin / админ центра (свой) |
| `courses.*` программа    | `POST\|PATCH\|DELETE /courses/{id}/modules\|lessons\|materials` | SuperAdmin / админ центра (свой) |
| `cabinet.courses.*`      | `GET /centers/{id}/courses`, `.../courses/catalog`, `POST .../courses` | админ центра / SuperAdmin (поддержка) |
| `cabinet.requests.*`     | `GET\|POST /centers/{id}/course-requests`, `DELETE\|POST .../{rid}[/pay-online]` | админ центра / SuperAdmin (поддержка) |
| `sms.packages`           | `GET /sms/packages`                | SuperAdmin  |
| `sms.sales`              | `GET /sms/sales?q=&status=&packageId=&page=&pageSize=` | SuperAdmin |
| `sms.accrue`             | `POST /sms/sales` (mode balance\|manual\|bonus) | SuperAdmin |
| `sms.updatePackage`      | `PUT /sms/packages/{id}`           | SuperAdmin  |
| `moderation.list`        | `GET /moderation?status=pending\|processed` | SuperAdmin |
| `moderation.decide`      | `POST /moderation/{id}/decision` (published\|returned\|rejected) | SuperAdmin |
| `moderation.requeue`     | `POST /moderation/{id}/requeue`    | SuperAdmin  |
| `cabinet.branches.list`  | `GET /centers/{id}/branches`       | админ центра / SuperAdmin (поддержка) |
| `cabinet.branches.geocode` | `GET /geocode?city=&address=`    | админ центра / SuperAdmin |
| `cabinet.branches.submit/resubmit` | `POST\|PUT /centers/{id}/branches[/{bid}]` | админ центра / SuperAdmin (поддержка) |
| `cabinet.profileCenters`  | `GET /cabinet/centers`            | админ центра / SuperAdmin |
| `cabinet.profile`         | `GET /centers/{id}/profile`       | админ центра / SuperAdmin (поддержка) |
| `cabinet.dashboard`       | `GET /centers/{id}/dashboard`     | админ центра / SuperAdmin (поддержка) |
| `cabinet.staff.*`         | `GET\|POST /centers/{id}/staff`, `DELETE .../staff/{sid}` | админ центра / SuperAdmin |
| `cabinet.users.*`         | `GET /centers/{id}/users`, `POST /centers/{id}/students`, `PATCH .../students/{sid}/status` | админ центра / SuperAdmin |
| `cabinet.groups.*`        | `GET\|POST /centers/{id}/groups`, `GET\|PATCH .../groups/{gid}`, `POST\|DELETE .../groups/{gid}/students[/{sid}]` | админ центра / SuperAdmin |
| `cabinet.schedule`        | `GET /centers/{id}/schedule`      | админ центра / SuperAdmin |
| `cabinet.access.reset`    | `POST /centers/{id}/access`       | админ центра / SuperAdmin |
| `cabinet.rewards.*`       | `GET\|POST /centers/{id}/rewards`, `PATCH .../rewards/{rid}` | админ центра / SuperAdmin |
| `cabinet.coinRules.*`     | `GET\|POST /centers/{id}/coin-rules`, `PATCH .../coin-rules/{crid}` | админ центра / SuperAdmin |
| `cabinet.analytics.list`  | `GET /centers/{id}/analytics`     | админ центра / SuperAdmin |
| `cabinet.analytics.grant` | `POST /centers/{id}/students/{sid}/coin` | админ центра / SuperAdmin |
| журнал: занятия        | `GET\|POST /centers/{id}/groups/{gid}/lessons`, `GET\|PATCH /centers/{id}/lessons/{lid}` | админ центра / SuperAdmin |
| журнал: посещаемость   | `PUT /centers/{id}/lessons/{lid}/attendance` | админ центра / SuperAdmin |
| журнал: смены          | `POST /centers/{id}/shifts/start`, `POST /centers/{id}/shifts/{sid}/end` | админ центра / SuperAdmin |
| журнал: баллы          | `GET\|PUT /centers/{id}/groups/{gid}/point-budget`, `POST /centers/{id}/groups/{gid}/points` | админ центра / SuperAdmin |
| журнал: тесты          | `POST /centers/{id}/tests`, `GET /centers/{id}/tests/{tid}`, `POST .../tests/{tid}/submit` | админ центра / SuperAdmin |
| касса: настройки        | `GET\|PUT /centers/{id}/cash/settings` | админ центра / SuperAdmin |
| касса: смены            | `POST /centers/{id}/cash/shifts`, `POST .../cash/shifts/{sid}/close`, `GET .../cash/shifts/{sid}` | админ центра / SuperAdmin |
| касса: оплаты/чеки      | `POST\|GET /centers/{id}/payments`, `POST /centers/{id}/payments/{pid}/refund` | админ центра / SuperAdmin |
| зарплаты: схемы/ведомость | `GET\|PUT /centers/{id}/salary/schemes`, `GET /centers/{id}/salary/accruals` | админ центра / SuperAdmin |
| вход по OTP             | `POST /auth/otp/request`, `POST /auth/otp/verify` | публичный |
| выбор членства / профиль | `POST /auth/membership`, `GET /me` | токен аккаунта |
| каталог: филиалы/фильтры | `GET /catalog/branches`, `GET /catalog/filters` | публичный |
| каталог: заявка          | `POST /catalog/leads` | публичный |
| заявки центра            | `GET /centers/{id}/leads`, `POST /centers/{id}/leads/{lid}/{trial\|enroll\|decline}` | админ центра / SuperAdmin |
| кабинет ученика          | `GET /me/schedule\|materials\|tests\|tests/{id}\|points\|finance`, `POST /me/tests/{id}/submit` | ученик |

Ошибки — JSON `{code, message, fields}` с HTTP-статусом (400/401/403/404/409/429), совместимо с
фронтовым `ApiError`. Вход возвращает `sessionDto` + `token`/`refreshToken` (расширение контракта).
Денежные мутации (`confirm`, `pay-from-balance`, `pay-online`, `top-up`, `plan-change`) принимают
заголовок `Idempotency-Key`: повтор с тем же ключом возвращает прежний результат, а не дублирует операцию.

## Бизнес-правила (источник истины — сервер)

- **PLT-TRF-010** — правила тарифов: уникальное имя, платный ≥ 1 сомони, бесплатный остаётся
  бесплатным, лимиты ≥ 1 и не ниже использования активных центров (ошибка называет центр),
  запрет архивации бесплатного тарифа и тарифа с центрами.
- **BR-025** — вход: логин `^[a-z0-9][a-z0-9._-]{3,31}$` (регистр не различается), пароль bcrypt
  (в открытом виде не хранится/не логируется), 5 неудач → блок на 15 мин, `mustChange`.
- **BR-010 / NFR-SEC-020** — `audit_log` и `ledger` неизменяемы: UPDATE/DELETE блокирует триггер БД
  (отмена — сторно/новая проводка, не правка).
- Расчётные признаки центра (`isChurn`, `isExpiring`, `nearLimit`, `riskScore/Level`, финансы)
  считаются на сервере (`internal/modules/centers/rules.go`), не в UI.

### Денежное ядро (money.md)

- **Атомарность:** изменение баланса + проводка + смена статуса счёта + аудит — в одной транзакции
  GORM; ошибка откатывает всё (нет «половинчатых» проводок).
- **BR-005** — списание под `SELECT … FOR UPDATE` по строке центра, в пределах «баланс + овердрафт»;
  конкурентные списания не уводят баланс ниже допустимого (`internal/ledger`).
- **Баланс — проверяемый кэш:** источник истины — сумма проводок `ledger`; тест сверяет кэш и сумму.
- **Идемпотентность** денежных мутаций по `Idempotency-Key` (`internal/idempotency`, таблица `idempotency_keys`).
- **BR-001** — тариф меняется только после оплаты счёта (кроме перехода на бесплатный и отсрочки по
  решению SuperAdmin, `PLT-TRF-030`); **BR-002** — ручное подтверждение/пополнение требует основания
  (способ, документ, дата, сумма, подтверждение); **BR-004** — отменить можно только неоплаченный счёт;
  **BR-006** — лимит овердрафта не ниже использованного; **BR-007** — один открытый счёт на смену тарифа;
  **BR-008** — тариф недоступен при превышении лимитов; **BR-009** — платный период 30 дней.
- Платёжные данные без PII: только маска карты (`•••• 4242`) и tx id.

### Маркетплейс методик (PLT-MKT)

- **BR-013** публикация только при заданной цене и ≥1 уроке; **BR-014** доступ к курсу создаётся
  только оплатой/списанием/бонусом, владеть дважды нельзя, второй открытый счёт на курс запрещён
  (частичный уникальный индекс на активный доступ); **BR-015** версия (число уроков/тестов)
  фиксируется в момент передачи; **BR-016** собственный курс центра изолирован (не в каталоге/заявках
  платформы, правит только владелец, купленный — только просмотр); **BR-011** причина обязательна для
  смены цены, снятия с публикации, отклонения заявки, отзыва доступа и бонуса.
- Передача курса при оплате счёта подключена к биллингу через интерфейс `billing.CourseGranter`
  (реализует marketplace, внедряется в сервере) — курс-счета больше не заглушка. Отмена курс-счёта
  возвращает заявку в статус «Новая».
- Программа курса (модули→уроки→материалы) хранится JSONB-документом в `courses.content`; счётчики
  уроков/тестов кэшируются и пересчитываются из дерева. Загрузка файлов имитируется (тип/имя/размер).
- Кабинетные эндпоинты доступны администратору своего центра или SuperAdmin в режиме поддержки
  (`NFR-SEC-030`); сидер создаёт демо-`center_admin` (`center1` / `center12345`, центр 1).

### SMS-пакеты (PLT-SMS)

- Начисление пакета: `balance` (списание с баланса под FOR UPDATE, BR-005), `manual` (деньги вне
  системы — основание `billing.ValidateEvidence`, сумма = цене пакета, BR-002), `bonus` (бесплатно,
  причина обязательна, BR-011). Заблокированному центру нельзя (BR-012). Начисление идемпотентно по
  `Idempotency-Key`. Счёт (invoice) при SMS не создаётся — продажа фиксируется сразу.
- **BR-020**: смена цены пакета действует только на новые продажи — цена хранится в строке продажи,
  прошлые сохраняют свою. `updatePackage` требует причину и пишет аудит.
- SMS-баланс центра (`centerDto.smsBalance`) = сумма остатков по его продажам (раньше была заглушка 0).

### Модерация каталога филиалов (PLT-MOD)

- **BR-017**: публикация только при подтверждённых координатах и заполненных RU и TJ (≥20 символов);
  расхождение точки центра с геокодером > 150 м помечается (`gpsMismatch`, haversine); «Вернуть» и
  «Отклонить» требуют причину. Ручная правка координат при решении сбрасывает подтверждение.
- **BR-018**: число заявок на модерации + опубликованных ≤ лимиту филиалов тарифа центра; подача
  сверх лимита отклоняется. Валидация подачи: название/город/адрес/телефон/координаты (в границах
  Таджикистана)/RU; запрет дубля адреса в городе (кроме отклонённых).
- Геокодер — мок (`internal/modules/moderation/geocode.go`): детерминированные координаты по адресу.
- Направления филиала вычисляются в DTO по `center_id` (как в прототипе). Кабинетные эндпоинты —
  администратор своего центра или SuperAdmin (режим поддержки).

### Кабинет центра — операционное ядро (CTR-STF/USR/GRP/SCH/DSH/PRF)

- **BR-023**: активных сотрудников ≤ лимиту тарифа; `centers.staff_used` — кэш, обновляется при
  приёме/увольнении в транзакции; увольнение освобождает место и логин.
- **BR-024**: у преподавателя нет двух занятий активных групп в один день недели с пересечением
  времени (проверка при создании/правке группы, haversine не нужен — сравнение интервалов).
- **BR-025**: данные для входа сотрудников и учеников — таблица `access_credentials` (логин уникален
  на платформе, пароль bcrypt, show-once, must_change); веб-логин (`auth.users`) — только
  center_admin/superadmin. Телефон сотрудника/ученика уникален в центре.
- **BR-012**: заблокированный центр — мутации кабинета запрещены (`writable`-guard).
- Блокировка/разблокировка ученика и увольнение — причина ≥5 (BR-011), запись в аудит.
- Доступ к кабинету: администратор своего центра (`center_admin`, `tenant_id`) или SuperAdmin в
  режиме поддержки. Демо-`center_admin`: `center1` / `center12345` (центр 1).
- Профиль/дашборд считают число учеников по таблице `students`. Собственные данные центра (ученики,
  группы) засеяны для демо-центров 1–9; профили и сотрудники — для всех центров (= `staff_used`).

### Награды и коины (CTR-RWD/CIN/COI)

- **Награды** (`rewards`): каталог за coin — имя 3–80, категория из набора, цена 1..100000 coin,
  статус active|archived; фильтр по статусу и диапазону цены. Выдача награды со списанием coin не
  реализуется (`Q-019`), как в прототипе.
- **Автоправила** (`coin_rules`, CTR-CIN): имя, область (academy|course|group), порог 1..100 %,
  награда 1..10000 coin, вкл/выкл. Автоначисление по правилам не исполняется (`Q-019`) — только хранение.
- **Аналитика/начисление** (CTR-COI): рейтинг учеников по coin + итоги (students/coin/avg); ручное
  начисление — количество 1..10000, основание ≥5 (BR-011), только активному ученику, в активном
  центре (BR-012); `students.coin += amount` атомарно (`UPDATE … RETURNING`), запись в аудит
  `coin.granted` (необратимо). coin — внутренние баллы (INT), не деньги.
- Награды/правила засеяны для демо-центров 1–9 (только на чистой БД — seed идемпотентен).
- Касса, чеки и зарплаты (CTR-FIN/CTR-PAY) реализованы отдельным модулем `cashier` (см. ниже).

### Электронный журнал (LRN-TCH) — greenfield (в прототипе/контракте отсутствует, статус спеки «план»)

- Поведение спроектировано от текста спеки; спорные решения — кандидаты в `Q-NNN`.
- **Занятия** — гибрид: `GET .../lessons` отдаёт слоты из расписания группы + сохранённые занятия;
  `POST .../lessons` «открывает» занятие на дату (upsert по группе+дате); дата вне расписания требует `adHoc`.
- **Посещаемость (LRN-TCH-020):** статусы `present|late|absent|excused`; «Опоздал» требует минут ≥1;
  оценки/теги; отметка только для учеников группы; заблокированный центр — нельзя (BR-012).
- **«Проведён»** идемпотентно фиксирует `conducted_at`. Побочки по спеке (списание оплаченного урока
  у присутствовавших и начисление зарплаты CTR-PAY) выполняются в той же транзакции через интерфейс
  `journal.ConductHook`, который реализует модуль `cashier` (внедряется в `server.go`; `journal` не
  импортирует `cashier` — без цикла).
- **Гео-смена (LRN-TCH-010):** старт смены в радиусе 100 м от координат филиала (haversine,
  `branch_submissions.gps`); нет координат — проверка пропускается (`geoChecked=false`). Аудит `shift.started`.
- **Баллы за успехи (LRN-TCH-040):** бюджет на группу (week|month + сумма); начисление в пределах
  остатка за период → `students.coin += amount`, аудит `coin.granted`; сверх бюджета — отказ с остатком.
- **Тесты (LRN-TCH-030):** вопрос = `{text, options[], correct}`; `submit` автоматически считает
  `score_pct`; пересдача — апсерт. Файловая база знаний (PDF/видео) не реализуется — только тесты.
- Доступ — админ своего центра или SuperAdmin (поддержка), `teacherId` в теле (вход преподавателя —
  мобильный, вне скоупа). Журнал стартует пустым (seed не засевается).

### Касса (CTR-FIN) и зарплаты (CTR-PAY) — greenfield (в прототипе/контракте отсутствует, статус спеки «план»)

- **Реальные деньги центра, изолированы от платформы (BR-022):** отдельный модуль `cashier`, не трогает
  `centers.balance_diram` (платформенный баланс). Суммы — дирамы `int64`; транзакции + аудит + сторно
  вместо удаления + идемпотентность (`money.md`). Миграция `0009_finance`.
- **Настройки (CTR-FIN-030):** `GET|PUT /centers/{id}/cash/settings` — `coinRate` (баллов за 1 сомони,
  по умолчанию 10) и `maxDiscountPct` (потолок скидки, по умолчанию 25%).
- **Смены (CTR-FIN-040):** `POST /centers/{id}/cash/shifts` (открыть; одновременно одна открытая),
  `POST .../cash/shifts/{sid}/close` (Z-отчёт, повторное закрытие — не ошибка), `GET .../cash/shifts/{sid}`.
  Z-отчёт — валовая выручка по способам `cash|pos|card`, сумма возвратов и итог (`net = gross − refunds`).
- **Оплаты и чеки (CTR-FIN-020/030):** `POST /centers/{id}/payments` (студент, группа?, сумма, способ,
  уроки, `discountCoin`) — считает скидку за баллы (в пределах баллов ученика и `maxDiscountPct`), печатает
  чек (номер из последовательности), начисляет оплаченные уроки на `(ученик, группа)`, привязывает к открытой
  смене; идемпотентно по `Idempotency-Key`; аудит `payment.created`. `GET /centers/{id}/payments?status=`.
- **Возврат (CTR-FIN-040):** `POST /centers/{id}/payments/{pid}/refund` (причина обязательна) — сторно:
  статус `refunded` (запись не удаляется/не правится), откат оплаченных уроков и возврат списанных баллов,
  уменьшение Z-отчёта; повторный возврат — конфликт; аудит `payment.refunded`.
- **Зарплаты (CTR-PAY):** `GET|PUT /centers/{id}/salary/schemes` (апсерт по `teacher`+`group`; `group=null`
  — схема по умолчанию) типов `fixed` (за занятие), `perhead` (× присутствовавших), `revshare`
  (`percent`% × цена урока × присутствовавших); `GET /centers/{id}/salary/accruals?teacherId=&from=&to=`.
  Начисление — в хуке «Проведён» в одной транзакции, идемпотентно по `lesson_id`; аудит `salary.accrued`.
- Доступ — админ своего центра или SuperAdmin (поддержка); `cashierName` в теле (отдельный вход кассира не
  заводится). Касса и зарплаты стартуют пустыми (seed не засевается).

### Мобильный контур по схеме ТЗ v2.5 (identity + каталог + кабинет ученика) — на текущем стеке

Контракт и модель данных — по ТЗ `docs/tz/` (аккаунт по телефону + членства, вход по OTP, `/catalog/branches`,
`/me*`), но технологии как в проекте (GORM/Gin/PostgreSQL/golang-migrate/bcrypt). Охват — мобильный контур
(ученик); веб-вход (`users`: superadmin/center_admin) не затронут. Миграции `0010_identity`, `0011_catalog`.

- **Единый аккаунт и членства (BR-035/BR-040):** `accounts` (по телефону E.164), `memberships`
  (роль в центре), `students.account_id` (NULL — теневой профиль). Роль задаётся членством, не аккаунтом.
- **Вход по OTP (SYS-ACC-030):** `POST /auth/otp/request` (код 6 цифр, хэш, TTL 5 мин, не чаще 1/мин;
  отправка — заглушка `LogSender`, реальный шлюз позже), `POST /auth/otp/verify` (гашение кода, блокировка
  после 5 неверных на 15 мин — BR-025; **авто-привязка**: ученик с совпавшим телефоном получает
  `account_id` и членство `student`); одно членство → сразу сессия, иначе `selectToken` + `POST /auth/membership`.
  Учёт попыток пишется вне общей транзакции успеха (иначе откат при ошибке обнулял бы счётчик).
- **Профиль:** `GET /me` — аккаунт и его членства, текущее членство и `studentId` из токена.
- **Каталог (LRN-CAT-010):** `GET /catalog/branches?lat=&lng=&q=&direction=&city=` — опубликованные филиалы
  (`branch_submissions.status='published'`, BR-017) активных центров; haversine-дистанция и сортировка при
  координатах; `GET /catalog/filters`. Публично, без токена.
- **Заявка на пробный (CTR-CRM-010):** `POST /catalog/leads` — публично, без аккаунта (проверка: центр
  опубликован и активен, имя/телефон); центр ведёт заявки: `GET /centers/{id}/leads`,
  `POST /centers/{id}/leads/{lid}/{trial|enroll|decline}` (аудит `lead.*`).
- **Кабинет ученика (LRN-PRN-030, role=student, «себя» из токена):** `GET /me/schedule` (через
  `journal.LessonsRange`), `GET /me/materials` (дерево программы курса группы по названию, без скачивания),
  `GET /me/tests` и `GET /me/tests/{id}` (**без правильных ответов**), `POST /me/tests/{id}/submit`
  (оценивание через `journal.SubmitTest`), `GET /me/points` (баллы + достижения), `GET /me/finance`
  (остаток оплаченных уроков + электронные чеки). Заблокированный ученик доступа не имеет (BR-025).

## Зафиксированные решения и расхождения (кандидаты в Q-NNN спецификации)

- **GORM vs `db.md`.** Правило требует pgx/sqlx; владелец выбрал GORM (ORM поверх `database/sql`).
  Запросы параметризованы; для будущих денежных путей — явные транзакции + `clause.Locking`/raw SQL.
- **Деньги.** Контракт оперирует целыми сомони, хранение — дирамы `int64` (`money.md`); конвертация
  на границе transport (`pkg/money`).
- **loginDays/expiresIn.** Храним абсолютные `last_login_at`/`expires_at` (как советует шапка
  `api.js`), «дней назад/до» считаем в DTO.
- **Вьюшные тоталы.** Платформенные «vanity»-числа mock (`platformTotal=142`, `activeSubs=118`)
  заменены реальными агрегатами по БД.
- **`pendingChange`** и **`smsBalance`** в `centerDto` теперь заполняются (открытый счёт на смену
  тарифа; сумма остатков SMS). `offer` (адресные предложения near-limit) пока null — появится со своим модулем.
- **Course-счета** (`kind = course`) теперь применяются модулем маркетплейса: оплата передаёт курс
  центру (заглушка снята). Демо-счёт INV-1043 остаётся открытым для показа реестра.
- **Касса/зарплаты (greenfield).** Решения-кандидаты в `Q-NNN`: (1) чек — только номер и данные, без
  PDF/термопечати; прайс-листа нет, сумму вводит кассир. (2) Списание оплаченного урока не уходит в
  минус (`GREATEST(paid−1, 0)`) — овердрафт уроков не разрешён. (3) `revshare` считается от настраиваемой
  в схеме цены урока (`lessonPrice`), а не от фактических касс-оплат ученика (в проде — из оплат).
  (4) Скидка за баллы ограничена потолком `maxDiscountPct`; при упоре в потолок списываются только
  фактически потраченные баллы (остаток не сгорает). (5) Отдельный вход кассира/преподавателя не
  заводится — операции ведёт админ центра/SuperAdmin.
- **Мобильный контур по ТЗ v2.5 на текущем стеке.** Контракт/модель — по `docs/tz/`, но технологии не
  меняются (GORM/Gin/golang-migrate/bcrypt), тогда как ТЗ предполагает sqlc/pgx/RLS/goose/argon2id и
  Ed25519-токены с таблицей `sessions` — расхождение стека фиксируется как `Q-NNN`. (1) OTP — основной
  вход; логин/пароль для детей без телефона отложен. (2) Токены stateless JWT (HS256), без `sessions` и
  мгновенного отзыва — отложено. (3) Rate-limit OTP минимальный (1/мин на номер); лимиты по часу и по IP —
  позже. (4) Отправка SMS — заглушка `LogSender` (код в лог только в dev), реальный шлюз — `Q-NNN`.
  (5) Материалы ученика — join группа→курс по названию (`groups.course`), т.к. явной связи `course_id` нет;
  файлы не отдаются (имитация). (6) Финансы ученика — остаток уроков и чеки из кассы; помесячные
  `charges`/`point_lots` (Этап 3 ТЗ) не строятся. (7) Кабинет родителя (`/me/children`), NPS, карта и
  геокодер — следующие инкременты.

## Известные пробелы проверки

- **`-race` не прогонялся:** детектор гонок на Windows требует cgo и C-компилятора (gcc), которого
  в окружении нет. Тесты проходят без `-race`; конкурентный тест списаний
  (`TestConcurrentChargesRespectAvailable`) проверяет инвариант баланса фактически (ровно столько
  успешных списаний, сколько влезает; баланс не ниже допустимого). Для гарантий по гонкам прогнать
  `-race` в CI/Linux или установив mingw/TDM-GCC.
