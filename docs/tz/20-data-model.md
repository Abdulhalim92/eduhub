# 20. Модель данных

Уровень идеи: таблицы, ключи, индексы, правила. Точные типы и имена уточняются при проектировании миграций (`db-migration`). Общие правила:

- Идентификаторы — UUID (v7, если доступен, для упорядоченности индексов).
- Деньги — `BIGINT` в дирамах, имя колонки с суффиксом `_dirams`. Баллы — `BIGINT` в целых баллах.
- Время — `TIMESTAMPTZ` в UTC. Календарный месяц начисления — `DATE` (первое число).
- Таблицы центра имеют `tenant_id UUID NOT NULL`, первичные и внешние ключи составные (`tenant_id`, `id`), чтобы строку нельзя было связать с чужим центром.
- Мягкое удаление не используется для денег. Для людей и групп — статусы.
- Все миграции с UP и DOWN, индексы `CREATE INDEX CONCURRENTLY`, нет `ADD COLUMN NOT NULL` без значения по умолчанию (`migrations.md`).

## Изоляция центров (RLS)

1. Приложение подключается ролью без права обхода RLS (`BYPASSRLS` нет). Миграции и служебные задачи выполняет отдельная роль.
2. В начале каждой транзакции: `SET LOCAL app.tenant_id = '<uuid>'` и `SET LOCAL app.actor_id`. Политика на каждой таблице центра: `USING (tenant_id = current_setting('app.tenant_id')::uuid)` и `WITH CHECK` тем же условием.
3. Запросы платформы, которым нужны данные многих центров (реестр, дашборд, режим поддержки), идут через отдельные представления или функции, которые отдают только разрешённые поля (`BR-022`): без платежей, кассы, расходов, зарплат и телефонов.
4. Обязательный тест: запрос от имени центра A никогда не возвращает и не меняет строки центра B ни по одной таблице (список таблиц собирается автоматически из системного каталога, новая таблица без политики роняет тест).

## Сущности

### Идентификация и доступ (`identity`)

| Таблица | Ключевые поля |
|:--|:--|
| `accounts` | `id`, `phone` (уникален, нормализован E.164), `display_name`, `locale` (`ru`, `tg`), `status`, `created_at` |
| `credentials` | `account_id`, `login` (уникален без учёта регистра), `password_hash` (argon2id), `must_change`, `failed_attempts`, `locked_until` (`BR-025`) |
| `otp_codes` | `phone`, `code_hash`, `expires_at`, `attempts`, `used_at`, `ip` |
| `sessions` | `id`, `account_id`, `refresh_hash`, `device`, `ip`, `expires_at`, `revoked_at` |
| `memberships` | `account_id`, `tenant_id`, `role`, `status`, `branch_id` (обязательно для `admin` и `cashier`, `BR-038`), `created_by`; уникальна пара (`account_id`, `tenant_id`, `role`); у человека может быть несколько строк, по одной на роль (`BR-040`) |
| `guardians` | `tenant_id`, `student_id`, `parent_account_id`, `relation` (`BR-036`) |
| `platform_staff` | `account_id`, `role` (`owner`, `manager`, `finance`, `moderator`, `support`) |

### Центры и тарифы (`tenancy`, `plans`)

| Таблица | Ключевые поля |
|:--|:--|
| `tenants` | `id`, `name` (уникально), `status` (`active`, `blocked`), `plan_id`, `subscription_state`, `paid_until`, `grace_until`, `created_at` |
| `tenant_profile` | `tenant_id`, направление, описание ru и tg, логотип |
| `branches` | `tenant_id`, `id`, адрес, координаты, `catalog_status` |
| `plans` | `id`, название, `price_somoni`, лимиты `max_staff`, `max_storage_mb`, `max_branches`, `archived`, `features jsonb` |
| `tenant_flags` | `tenant_id`, `flag`, значение (`PLT-CTR-040`) |
| `plan_changes` | `tenant_id`, `from_plan`, `to_plan`, `invoice_id`, `deferred`, `reason` |

### Платформа: деньги центра перед платформой (`billing`, `balance`, `sms`, `marketplace`)

| Таблица | Ключевые поля |
|:--|:--|
| `invoices` | `id`, `tenant_id`, `kind` (`renewal`, `plan_change`, `course`, `sms`), `amount_dirams`, `status` (`pending`, `paid`, `cancelled`), `due_at`, `action jsonb`, `idempotency_key` |
| `invoice_events` | `invoice_id`, тип, время, актор, данные (только добавление) |
| `balance_entries` | `id`, `tenant_id`, `delta_dirams`, `kind`, `invoice_id` null, `reason`, `actor_id`, `idempotency_key`; только добавление |
| `balance_accounts` | `tenant_id`, `overdraft_limit_dirams`, кэш `balance_dirams` (проверяемый, `BR-006`) |
| `sms_packages`, `sms_sales`, `sms_balances` | `PLT-SMS-*`; цена пакета на момент продажи фиксируется (`BR-020`) |
| `courses`, `modules`, `lessons`, `materials`, `course_access`, `course_requests` | `PLT-MKT-*`, `BR-013`–`BR-016`; у курса центра `owner_tenant_id` |

### Люди и обучение (`people`, `learning`)

| Таблица | Ключевые поля |
|:--|:--|
| `students` | `tenant_id`, `id`, `account_id` null (теневой профиль), `full_name`, `birth_date`, `status`, `blocked_reason` |
| `staff` | `tenant_id`, `id`, `membership_id`, `hired_at`, `fired_at`, `fire_reason` |
| `groups` | `tenant_id`, `id`, курс, филиал, `teacher_id`, `capacity`, период, `price_dirams`, `status`, `scale` (шкала оценок) |
| `group_members` | `tenant_id`, `group_id`, `student_id`, `joined_at`, `left_at`, `status`; ученик в любом числе групп |
| `rooms` | `tenant_id`, `branch_id`, название, вместимость |
| `lessons_schedule` | правило: группа, день недели, время, длительность, аудитория; `schedule_exceptions` — перенос, замена, каникулы (`CTR-SCH-010`, `CTR-SCH-020`) |
| `sessions_held` | конкретное занятие: дата, группа, `status` (`planned`, `held`, `cancelled`), преподаватель факта |
| `attendance` | `session_id`, `student_id`, `status` (`present`, `late`, `absent`, `excused`), минуты, оценка, тег |
| `homework`, `tests`, `test_attempts` | ДЗ с файлом и сроком, тест с автопроверкой выбора ответа (`LRN-TCH-030`) |
| `leads` | заявка и пробный урок без аккаунтов: имя ребёнка, телефон родителя, группа, дата пробного, статус (`new`, `trial_done`, `enrolled`, `declined`) (`CTR-CRM-010`) |
| `courses_center`, `materials`, `tests` | курсы, материалы и тесты центра принадлежат центру, `author_id` указывает автора и не даёт права владения |

Ограничение расписания `BR-024` проверяется в сервисе в транзакции с блокировкой преподавателя; дополнительно `EXCLUDE USING gist` по `tstzrange` как защита от гонок, если расписание хранится в виде конкретных интервалов.

### Финансы центра (`finance`, `points`, `payroll`)

| Таблица | Ключевые поля |
|:--|:--|
| `charges` | `tenant_id`, `id`, `student_id`, `group_id`, `period` (первое число месяца), `amount_dirams`, `status` (`open`, `paid`), уникальна (`tenant_id`, `student_id`, `group_id`, `period`) |
| `charge_lines` | `charge_id`, `kind` (`base`, `discount`), `amount_dirams` со знаком, `discount_assignment_id` null; к оплате — сумма строк (`BR-037`) |
| `charge_adjustments` | `charge_id`, `before_dirams`, `after_dirams`, `reason` (не пусто), `actor_id`; только добавление (`BR-032`) |
| `payments` | `tenant_id`, `id`, `student_id`, `group_id`, `period`, `amount_dirams` > 0, `method` (`cash`, `acquiring`, `p2p`), `status` (`accepted`, `reconciled`, `reversed`), `self_reconciled`, `cashier_id`, `shift_id`, `tx_no`, `card_last4`, `proof_file_id`, `received_at`, `reconciled_by`, `reconciled_at`, `receipt_no`, `idempotency_key` |
| `payment_allocations` | `payment_id`, `charge_id` null, `amount_dirams`; запись без `charge_id` — лишний остаток (`BR-029`) |
| `payment_reversals` | `payment_id`, `amount_dirams`, `reason`, `actor_id`; частичное и полное сторно (`BR-031`) |
| `points_payments` | оплата баллами: `student_id`, `charge_id`, `points`, `rate_dirams_per_point`, `amount_dirams` |
| `point_lots` | `tenant_id`, `student_id`, `issued_at`, `expires_at`, `initial_points`, `source` (`teacher`, `rule`), `source_ref` |
| `point_movements` | `lot_id`, `delta_points`, `kind` (`issue`, `spend`, `expire`, `restore`), `ref`; остаток лота — сумма движений (кэш с проверкой) |
| `discount_rules` | `tenant_id`, название, вид (`percent`, `fixed`), значение, `valid_from`, `valid_to`, `status` (`CTR-FIN-100`) |
| `discount_assignments` | `student_id`, `rule_id`, `reason` (не пусто), `assigned_by`, `valid_to`; назначение и снятие пишутся в аудит (`BR-037`) |
| `center_settings` | `tenant_id`, `branch_id` null, ключ, значение; изменения пишутся в аудит «было → стало» (`CTR-SET-010`) |
| `cash_shifts` | `cashier_id`, `opened_at`, `closed_at`, итоги по способам |
| `expense_categories`, `expenses` | категории расширяемы центром; `amount_dirams`, `recurrence`, `status` (`active`, `reversed`), `reason` при сторно (`CTR-FIN-080`) |
| `payroll_schemes`, `payroll_accruals`, `payroll_manual` | схемы, начисления после «Проведён», аванс, штраф, премия с причиной (`CTR-PAY-*`) |
| `acquiring_settings` | ключи провайдера в зашифрованном виде (`NFR-SEC-040`) |
| `webhook_events` | `provider`, `event_id` (уникален по провайдеру), `received_at`, `status` — дедупликация |

Долг по связке и месяцу: `Σ charge_lines(charge) − Σ allocations(charge) − Σ points_payments(charge)`. Остаток хранится как проверяемый кэш или вычисляется представлением; при расхождении кэша и суммы сработает контрольная задача сверки.

### Журналы и очереди (`audit`, `notify`)

| Таблица | Ключевые поля |
|:--|:--|
| `audit_log` | `id`, `scope` (`platform`, `tenant`), `tenant_id` null, `occurred_at`, `actor_id`, `actor_role`, `ip`, `device`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `reason`, `prev_hash`, `hash`; только добавление (`BR-010`) |
| `outbox` | `id`, `topic`, `payload`, `tenant_id`, `created_at`, `attempts`, `next_at`, `status` (`new`, `done`, `dead`) |
| `notifications` | `tenant_id`, адресат, канал, шаблон, язык, статус, ссылка на SMS-списание |

`audit_log` и все таблицы «только добавление» защищены триггером, который запрещает `UPDATE` и `DELETE`, и отсутствием соответствующих прав у роли приложения. Цепочка хэшей (`hash = H(prev_hash || запись)`) проверяется отдельной задачей.

## Индексы (минимум)

- `payments (tenant_id, student_id, period)`, `payments (tenant_id, status, received_at)` для сверки и отчётов.
- Уникальные: `payments (tenant_id, method, tx_no) WHERE method = 'p2p'` (`BR-033`); `webhook_events (provider, event_id)`; `charges (tenant_id, student_id, group_id, period)`; идемпотентность — уникальность (`tenant_id`, `idempotency_key`).
- `point_lots (tenant_id, student_id, expires_at)` для списания «сначала ранний срок» и задачи сгорания.
- `audit_log (scope, tenant_id, occurred_at DESC)`, `audit_log (entity_type, entity_id)`.
- `outbox (status, next_at)` частичный по `status = 'new'`.
- `attendance (session_id)`, `group_members (tenant_id, student_id)`, `sessions_held (tenant_id, group_id, date)`.

## Миграции

- Последовательность: создать схему и роли, `identity`, `tenancy`, платформа, центр, финансы, служебные таблицы.
- Новые политики RLS и триггеры «только добавление» — в тех же миграциях, что и таблицы.
- Для демонстрации: `cmd/seed` создаёт центры, сотрудников, учеников, группы и платежи; повторный запуск не дублирует данные.
