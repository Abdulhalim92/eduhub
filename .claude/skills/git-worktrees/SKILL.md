---
name: git-worktrees
description: "[Git] Используй при начале крупной фичи или рефакторинга: создание изолированного worktree с baseline тестами. Вызывай явно для задач затрагивающих 3+ файла или архитектурных изменений."
---

# Изолированный worktree для фичи

## Шаг 0: Проверить — уже изолирован?

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
[ "$GIT_DIR" != "$GIT_COMMON" ] && echo "already in worktree"
```

Если уже в worktree — пропустить создание, перейти к шагу 3.

## Шаг 1: Создать worktree

```bash
# Проверить что директория git-ignored
git check-ignore -q .worktrees || echo "WARN: .worktrees не в .gitignore"

git worktree add .worktrees/<feature-name> -b <feature-branch>
cd .worktrees/<feature-name>
```

Приоритет директории: `.worktrees/` (project-local, git-ignored) > `~/.config/liniya/worktrees/` (global).

## Шаг 2: Установить зависимости

```bash
go mod download
```

## Шаг 3: Baseline тесты

```bash
go test ./... -race -count=1
```

Все тесты должны пройти до начала работы. Если падают — это не наши баги, зафиксировать.

## Завершение

После merge или discard:
```bash
cd <основной репо>
git worktree remove .worktrees/<feature-name>
git worktree prune
```

Перед удалением работы — typed confirmation: пользователь вводит `discard`.

## Запрещено
- Вложенные worktrees
- Работать на main/master напрямую для крупных изменений
- Создавать worktree директорию без проверки `.gitignore`
