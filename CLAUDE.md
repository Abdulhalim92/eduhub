# CLAUDE.md

Руководство для Claude Code по этому репозиторию. Детали — в `docs/` и в самом коде.

## Проект

Кликабельный HTML-прототип панели SuperAdmin платформы «Линия» (Multi-Tenant SaaS для учебных центров) и кабинета центра (две страницы: `index.html` и `eduhub.html`). Бэкенда нет: данные отдаёт mock-слой `api` в памяти страницы. Язык интерфейса — русский, валюта — сомони.

Где что лежит:
- **Требования** — `docs/spec/src/` (Markdown, источник правды); выгрузка `docs/spec/Specifikaciya_Liniya_v2_4.docx`, прежние версии в `docs/spec/archive/`.
- **ТЗ на бэкенд** — `docs/tz/` (индекс `README.md`, трассировка `85-traceability.md`); анализ конкурентов — `docs/analysis/competitors.md`. При изменении спецификации обновлять ТЗ и трассировку.
- **Оформление экранов** — `docs/design/ui-principles.md`; референсы — `docs/design/references/`, макеты — `docs/design/mockups/`.
- **Контракт методов данных** — шапка `src/js/core/api.js` (таблица «метод → REST»).
- **Бэкенд на Go** — `backend/` (свой `go.mod`, модульный монолит, Clean Architecture); правила — `.claude/rules/go.md`, `db.md`, `migrations.md`, `security.md`, `architecture.md`, `money.md`; агенты — `.claude/agents/go-*`, `db-*`, `sec-auditor`, `arch-sysdesign`.

## Команды

- Тесты: `sh tests/run.sh` (Chrome headless, два набора: кабинет платформы — `tests/suite.js` поверх `index.html`, кабинет центра — `tests/suite-center.js` поверх `eduhub.html`, вход — `tests/suite-login.js` поверх `login.html`; печатает только упавшие и общий итог).
- После правок js/css: `sh tools/bump-version.sh` (ставит `?v=` в `index.html`, `eduhub.html` и `login.html`, иначе браузер показывает кеш).
- Бэкенд (из `backend/`, когда появится код): `go build ./...`, `go vet ./...`, `go test ./... -race -count=1`, `golangci-lint run`, `govulncheck ./...`.
- Спецификация: `python3 tools/build-spec.py` (проверка ID, ссылок, полей + сборка `.docx`; `--check` — только проверка). Нужны pandoc (`pip install pypandoc_binary`) и python-docx.
- Скриншот: `chrome --headless=new --window-size=1440,900 --virtual-time-budget=8000 --screenshot=out.png "file://$PWD/index.html#/<экран>"`.
- В тестах: `apiConfig.latencyMs = 0`, `PAGE_SIZE = 100` (пагинацию проверяет отдельный блок), после `await go(...)` давать `await sleep(...)`.
- Сборки нет: Tailwind и шрифты идут с CDN, `index.html` (платформа) и `eduhub.html` (кабинет центра) открываются двойным кликом.

## Процесс работы

- **Код без явной просьбы не писать** (`.claude/rules/no-code-without-permission.md`). Вопрос, анализ, ревью — это не разрешение; сначала описать, что и в каких файлах изменится, и дождаться «да». Разрешение действует на одну задачу.
- Порядок и критерии готовности — `.claude/rules/workflow.md`; отладка (root cause до фикса) — `.claude/rules/debugging.md`; делегирование реализации субагентам — навык `subagent-review`.
- Не завершать задачу без свежего вывода проверки (`sh tests/run.sh`, `build-spec.py --check` для спецификации). Если что-то не проверено — сказать об этом.
- **Никогда:** commit/push без явной просьбы; добавлять новые hex-литералы в шаблоны (в коде есть старые — не трогать без задачи); вставлять непроэкранированный ввод в `innerHTML`.
- Хук `PreCompact` (`.claude/hooks/precompact-save.py`) перед компактом сохраняет снимок в `CLAUDE.local.md`; после компакта прочитать снимок и раздел «Заметки».

## Графы знаний

- **graphify** (`graphify-out/`): перед вопросами об архитектуре читать `GRAPH_REPORT.md` (god nodes, сообщества); если есть `graphify-out/wiki/index.md` — идти через него, а не по сырым файлам. После правок кода — `graphify update .` (AST, без затрат на API).
- **code-review-graph** (MCP, `.mcp.json`): сначала сузить область (`semantic_search_nodes_tool`, `query_graph_tool` — callers_of/callees_of/tests_for, `get_impact_radius_tool`, `get_architecture_overview_tool`), потом читать исходники; при расхождении прав исходник. Пустой ответ графа — «не проиндексировано», а не «не существует».
- Обновляет хук `.claude/hooks/refresh-graphs.sh` после каждой правки. Проект пока без коммитов, поэтому `detect_changes_tool` и инкрементальное обновление требуют git; не переустанавливать через `code-review-graph install` (вернёт git-зависимые хуки).

## Compact Instructions

При сжатии контекста сохранять по приоритету:
1. Принятые решения владельца и архитектурные решения (не сокращать).
2. Изменённые файлы и суть правок.
3. Статус проверок: какие команды прошли или упали.
4. Открытые вопросы `Q-NNN`, TODO, что не проверено.
5. Вывод инструментов — выбрасывать, оставлять только итог.
