#!/bin/bash

set -u

# Хук после правки файла: автоформатирование по расширению.
# Не пишет в чекпойнт — слишком частое событие.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_hook-common.sh"

INPUT="$(hook_read_stdin)"
FILE_PATH="$(hook_json_field "$INPUT" \
  '.file_path // .path // .tool_input.file_path // .tool_input.path // .tool_input.target_file // .target_file')"

[ -z "$FILE_PATH" ] && exit 0
[ ! -f "$FILE_PATH" ] && exit 0

FORMAT_STATUS=0

case "$FILE_PATH" in
  *.go)
    if command -v goimports >/dev/null 2>&1; then
      goimports -w "$FILE_PATH" || FORMAT_STATUS=$?
    elif command -v gofmt >/dev/null 2>&1; then
      gofmt -w "$FILE_PATH" || FORMAT_STATUS=$?
    fi
    ;;
  *.ts|*.tsx|*.js|*.jsx|*.css|*.scss|*.md|*.mdx|*.html)
    if command -v prettier >/dev/null 2>&1; then
      prettier --write "$FILE_PATH" >/dev/null 2>&1 || FORMAT_STATUS=$?
    fi
    ;;
  *.sh|*.bash|*.zsh)
    if command -v shfmt >/dev/null 2>&1; then
      shfmt -w "$FILE_PATH" || FORMAT_STATUS=$?
    fi
    ;;
  *.json)
    if command -v jq >/dev/null 2>&1; then
      TMP_FILE="$(mktemp)"
      if jq . "$FILE_PATH" > "$TMP_FILE"; then
        mv "$TMP_FILE" "$FILE_PATH"
      else
        rm -f "$TMP_FILE"
        FORMAT_STATUS=1
      fi
    fi
    ;;
esac

hook_log "info" "formatted: $FILE_PATH (status=$FORMAT_STATUS)"
exit 0
