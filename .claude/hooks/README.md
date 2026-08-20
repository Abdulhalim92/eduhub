# Hooks: руководство (RU)

Этот каталог содержит hook-скрипты Claude Code для EduHub.

## Какие скрипты за что отвечают

- `_hook-common.sh` — общие функции (лог, state, JSON payload).
- `session-start.sh` — `UserPromptSubmit`, инициализация сессии.
- `pre-compact-checkpoint.sh` — событие compact (auto/manual), marker + checkpoint.
- `session-end-checkpoint.sh` — `Stop`, финализация сессии, обработка незакрытого compact marker.

## Где хранится состояние

- `CLAUDE.local.md` (корень репозитория) — чекпоинт: что сделано / что осталось / следующий шаг (см. `.claude/rules/checkpoint.md`).

## Wiring (`.claude/settings.json`)

- `UserPromptSubmit` → `session-start.sh`
- `PreCompact` → `pre-compact-checkpoint.sh`
- `Stop` → `session-end-checkpoint.sh`
- `PreToolUse` (`Glob|Grep`) → инлайн-команда в `settings.json` (graphify-напоминание, без отдельного скрипта)

## Как вносить изменения

Править скрипты напрямую в `.claude/hooks/` — здесь нет отдельного sync-шага (в отличие от многоагентных репо с Cursor/Copilot).

## Не перенесено / убрано

- `pre-tool-crg-reminder.sh` + `PreToolUse`-хук на Read/Glob/Grep — завязан на CLI `code-review-graph`, который не установлен в этом проекте. Не добавлять в `settings.json`, пока инструмент не установлен явно.
- Cursor/Copilot sync (`hooks.json`, `agents:sync`) — в EduHub только Claude Code, синхронизация с другими агентами не нужна.
- `post-write-lint.sh` (убран 2026-08-17) — автоформатирование зависело от `prettier`/`shfmt`/`goimports`, ни один не установлен; реально работал только `jq` на `.json` (редкий тип правки). Для основного стека (`.ts/.tsx/.css/.md`) был no-op на каждый Write/Edit — чистый оверхед без пользы. Вернуть, когда в проект осознанно поставят `prettier` (см. `web/`).
- `hook_sync_obsidian_daily()` в `_hook-common.sh` (убран 2026-08-17) — целился в `/Users/abdulhalim/Documents/Obsidian Vault/EduHub/daily`, папки нет — всегда no-op.
