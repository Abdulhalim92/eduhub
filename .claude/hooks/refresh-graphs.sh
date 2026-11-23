#!/bin/sh
# Обновляет графы знаний после правок файлов (хук PostToolUse, Edit|Write). Всегда завершается успешно.
#  • graphify: AST-обновление без LLM, работает без git (~0,4 с);
#  • code-review-graph: в git-репозитории — инкрементальное обновление, без git — быстрая полная пересборка (~1 с),
#    потому что инкрементальный режим берёт список изменённых файлов из `git diff`.
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
cat >/dev/null 2>&1                                   # хук получает JSON на stdin
command -v graphify >/dev/null 2>&1 && graphify update . >/dev/null 2>&1
if command -v code-review-graph >/dev/null 2>&1; then
  if git rev-parse --git-dir >/dev/null 2>&1; then
    code-review-graph update --skip-flows --repo "$PWD" >/dev/null 2>&1
  else
    code-review-graph build --skip-flows -q --repo "$PWD" >/dev/null 2>&1
  fi
fi
exit 0
