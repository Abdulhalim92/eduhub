#!/bin/bash

set -u

# Хук UserPromptSubmit: инжектирует чекпойнт в контекст агента один раз за сессию.
# Повторные сообщения пользователя хук молча пропускает.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_hook-common.sh"

# Маркер активной сессии: уникален по пути репозитория.
REPO_HASH="$(echo "$(hook_repo_root)" | cksum | awk '{print $1}')"
SESSION_MARKER="/tmp/.claude_hook_session_${REPO_HASH}"

# Уже показывали в этой сессии — выходим молча.
[ -f "$SESSION_MARKER" ] && exit 0

TARGET="$(hook_checkpoint_target)"

# Нет файла чекпойнта — создаём шаблон, выходим без сообщения.
if [ ! -f "$TARGET" ]; then
  hook_ensure_markers "$TARGET"
  touch "$SESSION_MARKER"
  exit 0
fi

CONTENT="$(cat "$TARGET")"
if [ -z "$CONTENT" ]; then
  touch "$SESSION_MARKER"
  exit 0
fi

touch "$SESSION_MARKER"

hook_emit_user_message "$(printf 'Контекст предыдущей сессии (%s):\n\n%s' "$TARGET" "$CONTENT")"
