#!/usr/bin/env python3
"""Хук PreCompact: перед сжатием контекста (авто или /compact) сохраняет снимок рабочего состояния в CLAUDE.local.md.

Claude Code сам подгружает CLAUDE.local.md в каждую сессию, поэтому после компакта агент видит:
  • последние запросы пользователя (что просили и что ещё не закрыто),
  • последний итоговый ответ агента,
  • файлы проекта, изменённые за последние 6 часов,
  • вручную записанные заметки (блок «Заметки» не перезаписывается).
Скрипт только читает transcript и пишет один файл; ошибки не блокируют компакт (всегда exit 0).
Вход: JSON из stdin (transcript_path, trigger, cwd...).
"""
import json, os, re, sys, time

MAX_USER, MAX_LEN, MAX_ASSISTANT = 3, 280, 900
BEGIN, END = '<!-- precompact:auto:begin -->', '<!-- precompact:auto:end -->'
NOISE = ('<system-reminder>', '<command-name>', '<local-command', 'Caveat:', '[Request interrupted', 'This session is being continued')


def texts(content):
    if isinstance(content, str):
        return [content]
    out = []
    for b in content or []:
        if isinstance(b, dict) and b.get('type') == 'text':
            out.append(b.get('text', ''))
    return out


def clean(t):
    t = re.sub(r'<system-reminder>.*?</system-reminder>', '', t, flags=re.S)
    t = re.sub(r'UserPromptSubmit hook additional context:.*', '', t, flags=re.S)
    return t.strip()


def read_transcript(path):
    users, last_assistant = [], ''
    try:
        with open(path, encoding='utf-8') as f:
            for line in f:
                try:
                    e = json.loads(line)
                except ValueError:
                    continue
                msg = e.get('message') or {}
                role = msg.get('role') or e.get('type')
                if e.get('isSidechain') or e.get('isMeta'):
                    continue
                parts = [clean(t) for t in texts(msg.get('content'))]
                parts = [p for p in parts if p and not p.startswith(NOISE)]
                if not parts:
                    continue
                if role == 'user':
                    users.append(' '.join(parts))
                elif role == 'assistant':
                    last_assistant = '\n'.join(parts)
    except OSError:
        pass
    return users[-MAX_USER:], last_assistant


def recent_files(root, hours=6):
    since, found = time.time() - hours * 3600, []
    skip = {'.claude', '.idea', 'node_modules'}
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in skip and not x.startswith('.')]
        for fn in files:
            p = os.path.join(d, fn)
            try:
                if fn != 'CLAUDE.local.md' and os.path.getmtime(p) >= since:
                    found.append((os.path.getmtime(p), os.path.relpath(p, root)))
            except OSError:
                pass
    return [p for _, p in sorted(found, reverse=True)[:12]]


def main():
    try:
        data = json.load(sys.stdin)
    except ValueError:
        data = {}
    root = data.get('cwd') or os.environ.get('CLAUDE_PROJECT_DIR') or os.getcwd()
    users, last = read_transcript(data.get('transcript_path', ''))
    snap = [BEGIN, '## Снимок перед компактом (генерируется хуком PreCompact, не править вручную)', '',
            'Время: %s · триггер: %s' % (time.strftime('%Y-%m-%d %H:%M'), data.get('trigger', '?')), '',
            '### Последние запросы пользователя']
    snap += ['%d. %s' % (i + 1, (u[:MAX_LEN] + '…') if len(u) > MAX_LEN else u) for i, u in enumerate(users)] or ['(нет данных)']
    snap += ['', '### Итог последнего ответа', (last[:MAX_ASSISTANT] + '…') if len(last) > MAX_ASSISTANT else (last or '(нет данных)'), '',
             '### Изменено за 6 часов']
    snap += ['- ' + p for p in recent_files(root)] or ['(нет)']
    snap += ['', 'После компакта: прочитать этот снимок, сверить с «Заметки» ниже, продолжить с последнего запроса; перед правками кода — `.claude/rules/no-code-without-permission.md`.', END]
    block = '\n'.join(snap)

    path = os.path.join(root, 'CLAUDE.local.md')
    try:
        old = open(path, encoding='utf-8').read()
    except OSError:
        old = ''
    if BEGIN in old and END in old:
        new = re.sub(re.escape(BEGIN) + '.*?' + re.escape(END), lambda m: block, old, flags=re.S)
    else:
        notes = old.strip() or '## Заметки\n\n(вручную: договорённости, которые нельзя терять; этот блок хук не трогает)'
        new = '# CLAUDE.local.md\n\nЛичный контекст для этого проекта (не для коммита).\n\n' + block + '\n\n' + notes + '\n'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new)


if __name__ == '__main__':
    try:
        main()
    except Exception as ex:  # хук не должен ломать компакт
        sys.stderr.write('precompact-save: %s\n' % ex)
    sys.exit(0)
