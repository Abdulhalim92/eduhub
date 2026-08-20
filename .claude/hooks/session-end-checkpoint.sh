#!/bin/bash

set -u

# Хук завершения сессии: записывает событие в HOOKS-блок и удаляет маркер сессии.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/_hook-common.sh"

# Сбрасываем маркер сессии, чтобы следующий старт снова показал чекпойнт.
REPO_HASH="$(echo "$(hook_repo_root)" | cksum | awk '{print $1}')"
rm -f "/tmp/.claude_hook_session_${REPO_HASH}"
