#!/bin/sh
# Обновляет графы знаний после правок файлов (хук PostToolUse: Edit|Write|Bash). Всегда завершается успешно.
#  • Edit|Write — обновление безусловно;
#  • Bash — только если с прошлого обновления изменились файлы кода (sed, go mod tidy, go generate, npm install, git checkout);
#  • graphify: AST-обновление без LLM (новые документы подхватывает только `/graphify --update`);
#  • code-review-graph: в git — инкрементальное обновление, без git — быстрая пересборка.
# Ошибки пишутся в .code-review-graph/refresh.log (раньше уходили в /dev/null).
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
INPUT=$(cat 2>/dev/null)
mkdir -p .code-review-graph
LOG=.code-review-graph/refresh.log
STAMP=.code-review-graph/.refresh-stamp
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$LOG"; }

# Лог не растёт бесконечно: оставляем последние 500 строк.
if [ -f "$LOG" ] && [ "$(wc -c <"$LOG")" -gt 204800 ]; then
  tail -n 500 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

case "$INPUT" in *'"tool_name":"Bash"'*|*'"tool_name": "Bash"'*) TOOL=Bash ;; *) TOOL=EditWrite ;; esac

if [ "$TOOL" = Bash ]; then
  # Без штампа считаем, что менялось всё; со штампом ищем файлы кода новее него.
  if [ -f "$STAMP" ]; then
    CHANGED=$(find backend frontend/src frontend/e2e frontend/package.json .claude/hooks \
      \( -name node_modules -o -name dist -o -name bin \) -prune -o \
      -type f \( -name '*.go' -o -name '*.sql' -o -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.sh' -o -name 'go.mod' -o -name 'package.json' \) \
      -newer "$STAMP" -print 2>/dev/null | head -1)
    [ -z "$CHANGED" ] && exit 0
  fi
fi

run() { # run <имя> <команда...>
  NAME=$1; shift
  OUT=$("$@" 2>&1); RC=$?
  if [ $RC -ne 0 ]; then
    log "FAIL $NAME rc=$RC ($TOOL): $(printf '%s' "$OUT" | tail -n 5 | tr '\n' ' ')"
  fi
}

if command -v graphify >/dev/null 2>&1; then
  run graphify graphify update .
else
  log "SKIP graphify: not in PATH"
fi
if command -v code-review-graph >/dev/null 2>&1; then
  if git rev-parse --git-dir >/dev/null 2>&1; then
    run code-review-graph code-review-graph update --skip-flows --repo "$PWD"
  else
    run code-review-graph code-review-graph build --skip-flows -q --repo "$PWD"
  fi
else
  log "SKIP code-review-graph: not in PATH"
fi
touch "$STAMP"
exit 0
