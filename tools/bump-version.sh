#!/bin/sh
# Прототип открывается без сборки, а браузер (и предпросмотр IDE) кеширует js/css из src/: после правок можно увидеть СТАРУЮ версию.
# Скрипт ставит ?v=<время> у всех локальных скриптов и стилей во всех страницах-входах (index.html, eduhub.html), чтобы файлы подгружались заново.
# Запускать после любых правок в src/:  sh tools/bump-version.sh
cd "$(dirname "$0")/.." || exit 1
V=$(date +%Y%m%d%H%M%S)
for f in index.html eduhub.html login.html; do
  perl -pi -e "s#((?:src|href)=\"src/(?:js|css)/[^\"?]+)(?:\?v=\d+)?\"#\$1?v=$V\"#g" "$f"
  echo "$f: версия ресурсов $V"
done
