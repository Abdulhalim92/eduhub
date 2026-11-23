# Линия — прототип панели SuperAdmin и кабинета центра

Кликабельный HTML-прототип Multi-Tenant SaaS для учебных центров (модуль 2.1 спецификации). Сборки нет: откройте `index.html` в браузере (двойной клик, работает по `file://`). Данные отдаёт mock-слой `api` в памяти страницы.

## Структура

```
index.html                  точка входа (оболочка, порядок подключения скриптов)
src/
  css/                      app.css
  js/
    core/                   api.js (mock-бэкенд), ui, state, nav, router
    components/             модалки, меню, пагинация, формы, оплата, финансы
    views/platform/         экраны SuperAdmin
    views/cabinet/          экраны кабинета центра
    views/shared/           страница курса (общая для SuperAdmin и центра)
    main.js, tailwind-config.js
  assets/courses/           обложки курсов + CREDITS.md (лицензии)
docs/
  spec/src/                 спецификация в Markdown: области A–D, модули, требования с ID, правила BR, статусы, вопросы Q
  spec/                     Specifikaciya_Liniya_v2_0.docx (выгрузка), reference.docx (стили), archive/ — прежние версии
  design/mockups/           макеты модуля 2.1
  design/references/        референсы оформления отдельных экранов
tests/                      регрессионный набор (suite.js) и запуск (run.sh)
tools/                      bump-version.sh, build-spec.py (сборка и проверка спецификации), style_spec.py
.claude/                    настройки агента: settings.json, rules/ (no-code-without-permission, workflow, debugging), skills/ (в т.ч. subagent-review), hooks/ (PreCompact-снимок, обновление графов)
.mcp.json                   MCP-сервер code-review-graph; graphify-out/ и .code-review-graph/ — графы знаний (в .gitignore)
CLAUDE.md                   инструкции для Claude Code; CLAUDE.local.md — личный контекст (в .gitignore)
```

## Команды

- Тесты: `sh tests/run.sh` (нужен Chrome; путь — переменная `CHROME`).
- После правок в `src/`: `sh tools/bump-version.sh` (сбрасывает кеш браузера).
- Спецификация: `python3 tools/build-spec.py` (проверка + выгрузка в `.docx`), `--check` — только проверка. Нужны pandoc (`pip install pypandoc_binary`) и python-docx.
- Графы знаний: `graphify update .` (AST, без LLM) и `code-review-graph build`; поиск — `graphify query "…"`, `code-review-graph search …`. Исключения — `.graphifyignore`, `.code-review-graphignore`.

## Правила работы с Claude Code

Правила лежат в `.claude/rules/` и подключаются автоматически; сводка — в `CLAUDE.md`.

| Файл | О чём |
|:--|:--|
| `no-code-without-permission.md` | Код не пишется и не меняется без явного «делай». Вопрос, анализ и ревью — не разрешение; сначала план правок, потом согласование. Разрешение действует на одну задачу |
| `workflow.md` | Порядок: анализ → план → одобрение → реализация → проверка. Чек-листы по типу задачи (новый экран, правило или метод `api`, решение владельца, экран со списком, только документация). Критерии готовности: без свежего вывода проверки «готово» не говорится. Работа с субагентами и приём ревью |
| `debugging.md` | Нет фикса без первопричины: четыре фазы, типичные источники ошибок проекта (кеш, глобальная область, `stale`, U+202F), как писать падающую проверку в `tests/suite.js`. Три неудачные попытки — перепланировать |

Навык `subagent-review` (`.claude/skills/`) — двухэтапная приёмка работы субагента: сначала соответствие требованиям (`docs/spec/src/`), затем качество кода по проектным критериям.

Что проверять после правок:

| Что менялось | Проверка |
|:--|:--|
| `src/` (js, css) | `sh tools/bump-version.sh`, затем `sh tests/run.sh`; для вёрстки — скриншот |
| `docs/spec/src/` | `python3 tools/build-spec.py` (`--check` — без сборки) |
| Согласованное решение владельца | Markdown спецификации + строка в `95-changelog.md`, затем сборка |
