#!/bin/sh
# Прогон регрессионных наборов в headless Chrome: кабинет платформы (index.html + tests/suite.js) и кабинет центра (eduhub.html + tests/suite-center.js) и страница входа (login.html + tests/suite-login.js).
# Печатает только упавшие проверки и общий итог; код возврата 1 при падениях. Chrome: переменная CHROME (по умолчанию macOS). Запуск из любой папки:  sh tests/run.sh
cd "$(dirname "$0")/.." || exit 1
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT=$(mktemp -d)
trap 'rm -rf "$OUT" _run_platform.html _run_center.html _run_login.html' EXIT
# флаг общего состояния (localStorage) в тестах выключен: наборы требуют чистого seed
run_suite() {   # $1 — страница, $2 — набор, $3 — метка, $4 — временный файл
  perl -0pe 's#<script>window\.LINIYA_SYNC = true;</script>##; s#</body>#<script src="tests/'"$2"'"></script></body>#' "$1" > "$4"
  "$CHROME" --headless=new --disable-gpu --virtual-time-budget="${BUDGET:-200000}" --dump-dom "file://$PWD/$4#/${5:-home}" 2>/dev/null > "$OUT/$3.dom"
}
run_suite index.html suite.js platform _run_platform.html home
run_suite eduhub.html suite-center.js center _run_center.html profile
run_suite login.html suite-login.js login _run_login.html login
python3 - "$OUT" <<'PY'
import sys, re, html
tot = {'PASS': 0, 'FAIL': 0, 'EXC': 0}; bad_all = []; missing = False
for label in ('platform', 'center', 'login'):
    d = open(f'{sys.argv[1]}/{label}.dom', encoding='utf-8', errors='replace').read()
    m = re.search(r'<pre id="TESTOUT">(.*?)</pre>', d, re.S)
    if not m:
        print(f'NO OUTPUT [{label}]: набор не завершился (проверьте путь к Chrome и BUDGET)'); missing = True; continue
    t = html.unescape(m.group(1)); lines = t.split('\n')
    bad_all += [f'[{label}] {l}' for l in lines if not l.startswith('PASS')]
    for k in tot: tot[k] += sum(1 for l in lines if l.startswith(k))
print('\n'.join(bad_all) if bad_all else '(нет падений)')
print('PASS:', tot['PASS'], 'FAIL:', tot['FAIL'], 'EXC:', tot['EXC'])
sys.exit(2 if missing else (1 if tot['FAIL'] or tot['EXC'] else 0))
PY
