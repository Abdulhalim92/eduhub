#!/bin/bash

set -u

# Общие утилиты для всех hook-скриптов.
# Ключевые функции: hook_write_event (пишет в HOOKS-блок с ротацией),
# hook_ensure_markers (инициализирует файл чекпойнта).

MAX_EVENTS="${MAX_EVENTS:-5}"

hook_now() { date '+%Y-%m-%d %H:%M'; }

hook_log() {
  [ "${HOOK_DEBUG:-0}" = "1" ] || return 0
  printf '[%s] [%s] %s\n' "$(hook_now)" "${1:-info}" "${2:-}" >&2
}

hook_read_stdin() {
  if [ -t 0 ]; then echo ""; return; fi
  cat
}

hook_json_field() {
  local input="${1:-}" query="${2:-}"
  if [ -z "$input" ] || [ -z "$query" ] || ! command -v jq >/dev/null 2>&1; then
    echo ""; return
  fi
  echo "$input" | jq -r "$query // empty" 2>/dev/null || echo ""
}

hook_emit_user_message() {
  local message="${1:-}"
  if command -v jq >/dev/null 2>&1; then
    jq -cn --arg msg "$message" '{user_message:$msg}'
    return
  fi
  local escaped
  escaped="$(printf '%s' "$message" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  printf '{"user_message":"%s"}\n' "$escaped"
}

# Возвращает первый существующий файл чекпойнта (для сообщений и session-start).
hook_checkpoint_target() {
  for f in "CLAUDE.local.md" "AGENTS.local.md" "CURSOR.local.md"; do
    [ -f "$f" ] && echo "$f" && return
  done
  echo "CLAUDE.local.md"
}

# Возвращает все существующие файлы чекпойнта (по одному на строку).
# Если ни один не найден — возвращает CLAUDE.local.md как дефолт.
hook_checkpoint_targets() {
  local found=0
  for f in "CLAUDE.local.md" "AGENTS.local.md" "CURSOR.local.md"; do
    if [ -f "$f" ]; then
      echo "$f"
      found=1
    fi
  done
  [ "$found" -eq 0 ] && echo "CLAUDE.local.md"
}

hook_compact_mode() {
  local input="${1:-}"
  local mode
  mode="$(hook_json_field "$input" '.reason // .trigger // .source // .mode // .compact_mode')"
  mode="$(printf '%s' "$mode" | tr '[:upper:]' '[:lower:]')"
  case "$mode" in
    *manual*|*user*) echo "manual" ;;
    *auto*|*context*|*token*) echo "auto" ;;
    *) echo "unknown" ;;
  esac
}

hook_repo_root() {
  if command -v git >/dev/null 2>&1; then
    local root
    root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    [ -n "$root" ] && echo "$root" && return
  fi
  pwd
}

hook_changed_files() {
  if ! command -v git >/dev/null 2>&1; then echo "нет"; return; fi
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then echo "нет"; return; fi

  local all count list
  all="$(git status --porcelain 2>/dev/null | awk '{print $2}')"
  count="$(printf '%s\n' "$all" | grep -c . 2>/dev/null || echo 0)"
  list="$(printf '%s\n' "$all" | head -10 | tr '\n' ',' | sed 's/,$//')"

  if [ "$count" -gt 10 ]; then
    echo "${list} (+$((count - 10)) ещё)"
  else
    echo "${list:-нет}"
  fi
}

# Гарантирует наличие USER:BEGIN/END и HOOKS:BEGIN/END маркеров.
# Если файл не существует — создаёт с полным шаблоном.
# Если существует без маркеров — добавляет HOOKS-блок в конец.
hook_ensure_markers() {
  local file="${1:-}"
  [ -z "$file" ] && return 1

  if [ ! -f "$file" ]; then
    cat > "$file" << TMPL
<!-- USER:BEGIN — не редактировать хукам -->
# Checkpoint

## Фокус
—

## Что сделано
—

## Проблемы / вопросы
—

## Решения
—

## Следующий шаг
—

## Источники данных
—
<!-- USER:END -->

<!-- HOOKS:BEGIN — управляется автоматически, не редактировать вручную -->
## События (последние ${MAX_EVENTS})
<!-- HOOKS:END -->
TMPL
    hook_log "info" "создан checkpoint файл: $file"
    return 0
  fi

  if ! grep -q '<!-- HOOKS:BEGIN' "$file" 2>/dev/null; then
    printf '\n<!-- HOOKS:BEGIN — управляется автоматически, не редактировать вручную -->\n## События (последние %d)\n<!-- HOOKS:END -->\n' \
      "$MAX_EVENTS" >> "$file"
    hook_log "info" "добавлен HOOKS-блок в: $file"
  fi
}

# Записывает событие в HOOKS-блок всех checkpoint-файлов с ротацией (хранит последние MAX_EVENTS).
# USER-блок не трогает никогда.
hook_write_event() {
  local event="${1:-generic}"
  local details="${2:-}"

  local new_entry
  new_entry="### $(hook_now) | ${event}"
  [ -n "$details" ] && new_entry="${new_entry}
${details}"

  while IFS= read -r file; do
    hook_ensure_markers "$file"
    hook_log "info" "пишем событие в: $file"
    _hook_write_event_to_file "$file" "$new_entry"
  done < <(hook_checkpoint_targets)
}

# Внутренняя функция: пишет new_entry в конкретный файл.
_hook_write_event_to_file() {
  local file="${1:-}"
  local new_entry="${2:-}"
  [ -z "$file" ] && return 1

  if ! command -v python3 >/dev/null 2>&1; then
    # Fallback без ротации: вставляем перед HOOKS:END
    local tmp
    tmp="$(mktemp)"
    awk -v entry="$new_entry" '
      /<!-- HOOKS:END/ { print entry; print "" }
      { print }
    ' "$file" > "$tmp" && mv "$tmp" "$file"
    hook_log "warn" "python3 не найден — ротация недоступна"
    return
  fi

  HOOK_NEW_ENTRY="$new_entry" \
  HOOK_MAX_EVENTS="$MAX_EVENTS" \
  python3 - "$file" << 'PYEOF'
import sys, re, os

filepath = sys.argv[1]
new_entry = os.environ['HOOK_NEW_ENTRY']
max_events = int(os.environ['HOOK_MAX_EVENTS'])

HOOKS_START = '<!-- HOOKS:BEGIN'
HOOKS_END = '<!-- HOOKS:END -->'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

hs = content.find(HOOKS_START)
he = content.find(HOOKS_END)
if hs == -1 or he == -1:
    sys.exit(0)

before = content[:hs]
after = content[he + len(HOOKS_END):]
hooks_body = content[hs:he]

lines = hooks_body.split('\n')
header = next(
    (l for l in lines[1:] if l.startswith('## ')),
    f'## События (последние {max_events})'
)

inner = '\n'.join(l for l in lines[1:] if not l.startswith('## '))
blocks = [b.strip() for b in re.split(r'\n(?=###)', inner.strip()) if b.strip()]

all_blocks = [new_entry] + blocks
all_blocks = all_blocks[:max_events]

hooks_new = (
    '<!-- HOOKS:BEGIN — управляется автоматически, не редактировать вручную -->\n'
    + header + '\n\n'
    + '\n\n'.join(all_blocks) + '\n'
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(before + hooks_new + HOOKS_END + after)
PYEOF
}

# Создаёт/дополняет ежедневную заметку в Obsidian vault EduHub/daily/YYYY-MM-DD.md.
# Если файла нет — создаёт по шаблону. Затем дописывает блок агента в конец.
hook_sync_obsidian_daily() {
  local event="${1:-session-end}"
  local details="${2:-}"
  local vault="${OBSIDIAN_VAULT:-/Users/abdulhalim/Documents/Obsidian Vault}"
  local daily_dir="${vault}/EduHub/daily"
  local today
  today="$(date '+%Y-%m-%d')"
  local daily_file="${daily_dir}/${today}.md"

  [ -d "$daily_dir" ] || return 0

  if [ ! -f "$daily_file" ]; then
    cat > "$daily_file" << TMPL
# ${today}

## Что сделано
-

## Проблемы / вопросы
-

## Решения
-

## Завтра
-
TMPL
    hook_log "info" "создана daily note: $daily_file"
  fi

  local timestamp
  timestamp="$(date '+%H:%M')"
  printf '\n---\n### Агент %s | %s\n%s\n' "$timestamp" "$event" "${details:-нет}" >> "$daily_file"
  hook_log "info" "обновлена daily note: $daily_file"
}
