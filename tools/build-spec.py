#!/usr/bin/env python3
"""Сборка функциональной спецификации: Markdown-исходники (docs/spec/src) → один .docx.

Что делает:
  1. Собирает файлы исходников в порядке имён (числовые префиксы задают порядок разделов).
  2. Проверяет документ: уникальность идентификаторов, битые ссылки на ID, обязательные поля требований.
     Ошибки останавливают сборку; предупреждения (прототип без критериев приёмки) выводятся списком.
  3. Превращает идентификаторы в якоря и ссылки, добавляет приложения «Сводка» и «Трассировка».
  4. Вызывает pandoc (из PATH либо из пакета pypandoc_binary) и оформляет таблицы в .docx.

Запуск:  python3 tools/build-spec.py            сборка docs/spec/Specifikaciya_Liniya_v<версия>.docx
         python3 tools/build-spec.py --check    только проверка, без сборки
Зависимости: python-docx; pandoc (или `pip install pypandoc_binary`).
"""
import os, re, subprocess, sys, shutil, collections

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'docs', 'spec', 'src')
OUT_DIR = os.path.join(ROOT, 'docs', 'spec')
BUILD = os.path.join(OUT_DIR, 'build')
REFERENCE = os.path.join(OUT_DIR, 'reference.docx')

ID = r'[A-Z]{3}-[A-Z]{3}-\d{3}'
ANY_ID = re.compile(r'(?<![\w-])(%s|BR-\d{3}|Q-\d{3})(?![\w-])' % ID)
REQ_AREAS = ('PLT', 'CTR', 'LRN', 'SYS')                        # области, где обязательны поля шаблона
IMPL_OK = ('прототип', 'частично', 'план', 'мок')
APPROVAL_OK = ('согласовано', 'допущение')


def read_sources():
    files = []
    for d, dirs, fs in os.walk(SRC):
        dirs.sort()
        for f in sorted(fs):
            if f.endswith('.md'):
                files.append(os.path.join(d, f))
    files.sort(key=lambda p: os.path.relpath(p, SRC))
    return files


def parse(files):
    """Возвращает список требований и множество определённых идентификаторов."""
    reqs, defined, errors = [], {}, []
    head = re.compile(r'^(#{2,3}) (%s|BR-\d{3}) (.+?)\s*$' % ID)
    for path in files:
        rel = os.path.relpath(path, SRC)
        lines = open(path, encoding='utf-8').read().split('\n')
        for i, line in enumerate(lines):
            m = head.match(line)
            if m:
                rid, title = m.group(2), m.group(3)
                if rid in defined:
                    errors.append(f'{rel}:{i + 1}: идентификатор {rid} уже определён в {defined[rid]}')
                defined[rid] = f'{rel}:{i + 1}'
                body = []
                for l2 in lines[i + 1:]:
                    if l2.startswith('#'):
                        break
                    body.append(l2)
                reqs.append({'id': rid, 'title': title, 'file': rel, 'line': i + 1, 'body': '\n'.join(body)})
            qm = re.match(r'^\| (Q-\d{3}) \|', line)
            if qm:
                if qm.group(1) in defined:
                    errors.append(f'{rel}:{i + 1}: вопрос {qm.group(1)} уже определён')
                defined[qm.group(1)] = f'{rel}:{i + 1}'
    return reqs, defined, errors


def fields_of(body):
    """Поля из строки «**Роль:** … · **Согласование:** …»."""
    out = {}
    for line in body.split('\n'):
        if line.startswith('**Роль:**') or line.startswith('**Согласование:**'):
            for part in re.split(r' · (?=\*\*)', line):
                m = re.match(r'\*\*(.+?):\*\*\s*(.*)', part.strip())
                if m:
                    out[m.group(1)] = m.group(2).strip()
            break
    return out


def validate(files, reqs, defined):
    errors, warnings = [], []
    for path in files:
        rel = os.path.relpath(path, SRC)
        for n, line in enumerate(open(path, encoding='utf-8').read().split('\n'), 1):
            for m in ANY_ID.finditer(line):
                if m.group(1) not in defined:
                    errors.append(f'{rel}:{n}: ссылка на неизвестный идентификатор {m.group(1)}')
    for r in reqs:
        area = r['id'][:3]
        if area not in REQ_AREAS:
            continue
        f = fields_of(r['body'])
        for key in ('Роль', 'Согласование', 'Реализация'):
            if key not in f:
                errors.append(f"{r['file']}:{r['line']}: {r['id']}: нет поля «{key}»")
        impl = f.get('Реализация', '').lower().split(' ')[0] if f.get('Реализация') else ''
        if f.get('Реализация') and impl not in IMPL_OK:
            errors.append(f"{r['file']}:{r['line']}: {r['id']}: «Реализация» должна быть одной из {IMPL_OK}")
        ap = f.get('Согласование', '').lower()
        if f.get('Согласование') and not ap.startswith(APPROVAL_OK):
            errors.append(f"{r['file']}:{r['line']}: {r['id']}: «Согласование» должно начинаться с «согласовано» или «допущение»")
        if impl == 'прототип' and 'Критерии приёмки' not in r['body']:
            warnings.append(f"{r['id']} {r['title']}: прототип без критериев приёмки")
    return errors, warnings


def appendices(reqs):
    """Приложения: сводка по областям и реализации, трассировка «требование → экран»."""
    rows, counter, by_area = [], collections.Counter(), collections.Counter()
    for r in reqs:
        if r['id'][:3] not in REQ_AREAS:
            continue
        f = fields_of(r['body'])
        impl = (f.get('Реализация') or '—').split(' ')[0]
        counter[impl] += 1; by_area[r['id'][:3]] += 1
        cell = lambda v: (v or '—').replace('|', '\\|')
        rows.append(f"| {r['id'].replace('-', '\u2011')} | {r['title']} | {cell(f.get('Роль'))} | {impl} | {cell(f.get('Экран'))} |")
    names = {'PLT': 'Платформа (часть A)', 'CTR': 'Центр (часть B)', 'LRN': 'Обучение (часть C)', 'SYS': 'Сквозные (часть D)'}
    out = ['# Приложение А. Сводка', '',
           '| Область | Требований |', '|:--|--:|']
    out += [f'| {names[a]} | {by_area[a]} |' for a in REQ_AREAS]
    out += ['', '| Реализация | Требований |', '|:--|--:|']
    out += [f'| {k} | {counter[k]} |' for k in ('прототип', 'частично', 'план') if counter[k]]
    out += ['', '# Приложение Б. Трассировка', '',
            'Таблица строится автоматически из полей «Роль», «Реализация» и «Экран» каждого требования.', '',
            '| ID | Требование | Роль | Реализация | Экран |', '|:--|:--|:--|:--|:--|'] + rows
    return '\n'.join(out) + '\n'


def transform(text):
    """Якоря у заголовков с ID и ссылки на ID в тексте."""
    out = []
    for line in text.split('\n'):
        m = re.match(r'^(#{1,6}) (%s|BR-\d{3}|[A-Z]{3}-[A-Z]{3}\b)(.*)$' % ID, line)
        if m and not line.rstrip().endswith('}'):
            out.append(f'{line.rstrip()} {{#{m.group(2)}}}')
            continue
        if line.startswith('#'):
            out.append(line); continue
        qm = re.match(r'^\| (Q-\d{3}) \|(.*)$', line)
        if qm:
            out.append(f'| [{qm.group(1)}]{{#{qm.group(1)}}} |{qm.group(2)}'); continue
        line = re.sub(r'`(%s|BR-\d{3}|Q-\d{3})`' % ID, lambda x: f'[`{x.group(1)}`](#{x.group(1)})', line)
        out.append(line)
    return '\n'.join(out)


def find_pandoc():
    p = shutil.which('pandoc')
    if p:
        return p
    try:
        import pypandoc
        return pypandoc.get_pandoc_path()
    except Exception:
        sys.exit('pandoc не найден: установите pandoc или `pip install pypandoc_binary`')


def meta_value(key, default=''):
    m = re.search(r'^%s:\s*"?(.*?)"?\s*$' % key, open(os.path.join(SRC, 'meta.yaml'), encoding='utf-8').read(), re.M)
    return m.group(1) if m else default


def ensure_reference(pandoc):
    if os.path.exists(REFERENCE):
        return
    data = subprocess.run([pandoc, '--print-default-data-file', 'reference.docx'], capture_output=True, check=True).stdout
    open(REFERENCE, 'wb').write(data)
    import style_spec
    style_spec.style_reference(REFERENCE)


def main():
    check_only = '--check' in sys.argv
    files = read_sources()
    reqs, defined, errors = parse(files)
    verr, warnings = validate(files, reqs, defined)
    errors += verr
    n_req = len([r for r in reqs if r['id'][:3] in REQ_AREAS])
    print(f'Файлов: {len(files)} · требований: {n_req} · правил BR: {len([r for r in reqs if r["id"].startswith("BR-")])} · вопросов Q: {len([d for d in defined if d.startswith("Q-")])}')
    for w in warnings:
        print('  предупреждение:', w)
    if errors:
        print('ОШИБКИ:'); [print('  ' + e) for e in errors]; sys.exit(1)
    if check_only:
        print('Проверка пройдена.'); return
    sys.path.insert(0, os.path.dirname(__file__))
    pandoc = find_pandoc()
    os.makedirs(BUILD, exist_ok=True)
    ensure_reference(pandoc)
    body = '\n\n'.join(open(p, encoding='utf-8').read().strip() for p in files) + '\n\n' + appendices(reqs)
    md = os.path.join(BUILD, 'spec.md')
    open(md, 'w', encoding='utf-8').write(transform(body))
    version = (meta_value('author', 'Версия 2.0').split()[-1] or '2.0').replace('.', '_')
    out = os.path.join(OUT_DIR, f'Specifikaciya_Liniya_v{version}.docx')
    subprocess.run([pandoc, md, '-f', 'markdown+pipe_tables+bracketed_spans+header_attributes-smart', '-t', 'docx', '--toc', '--toc-depth=2',
                    '--reference-doc', REFERENCE, '--metadata-file', os.path.join(SRC, 'meta.yaml'), '-o', out], check=True)
    import style_spec
    style_spec.postprocess(out)
    print('Собрано:', os.path.relpath(out, ROOT))


if __name__ == '__main__':
    main()
