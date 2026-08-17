#!/bin/bash

set -u

# PreCompact hook: срабатывает перед /compact (ручным) и авто-compact (контекст заполнен).
# Записывает событие в HOOKS-блок, инжектирует инструкцию обновить CLAUDE.local.md.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_hook-common.sh"

INPUT="$(hook_read_stdin)"
MODE="$(hook_compact_mode "$INPUT")"
TARGET="$(hook_checkpoint_target)"

case "$MODE" in
  auto)
    MSG="Контекст заполнен — запущен авто-compact.

Перед сжатием ОБЯЗАТЕЛЬНО обнови ${TARGET}:
- Current focus: одна строка над чем работаем
- Decisions made: принятые решения этой сессии
- Open questions: что не закрыто
- Checkpoint: дата, что сделано, что осталось, следующий шаг

Замени старые данные актуальными. Затем compact продолжит."
    ;;
  manual)
    MSG="Ручной /compact.

Если состояние изменилось — обнови ${TARGET} (Current focus, решения, следующий шаг) перед сжатием."
    ;;
  *)
    MSG="Compact. Обнови ${TARGET} при необходимости перед сжатием."
    ;;
esac

hook_emit_user_message "$MSG"
