/* Общие кусочки экранов кабинета центра: заголовок с кнопкой, выпадающий фильтр, инициалы, статус-метки. */
const cabInitials = name => String(name).split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

// выпадающий фильтр: opts — [{ value, label }], первое значение '' = «Все»
function cabSelect(label, opts, value, onchange) {
  return `<label class="flex items-center gap-2 bg-white border border-slate-200 rounded-xl pl-3 pr-1 py-1 text-xs text-slate-500">${esc(label)}
    <select onchange="${onchange}" class="bg-transparent font-semibold text-slate-800 py-1.5 pr-2 focus:outline-none max-w-[11rem]">${opts.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
}

function cabAddButton(label, onclick) {
  return `<button onclick="${onclick}" class="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg><span>${esc(label)}</span></button>`;
}

function cabHead(title, sub, actionHtml = '') {
  return `<div class="flex items-start justify-between gap-4 flex-wrap"><div class="max-w-2xl"><h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">${esc(title)}</h1><p class="text-xs text-slate-500 mt-1">${esc(sub)}</p></div><div>${actionHtml}</div></div>`;
}

// заблокированный центр: действия-создатели скрыты, вместо них пояснение (BR-012)
const cabBlockedNote = () => '<div class="max-w-xs text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Центр заблокирован: данные доступны только для просмотра.</div>';

const cabEmptyRow = (cols, text) => `<tr><td colspan="${cols}" class="py-10 text-center text-xs text-slate-500">${esc(text)}</td></tr>`;

const cabResetLink = (id, onclick) => `<button id="${id}" onclick="${onclick}" class="hidden text-xs font-semibold text-brand hover:underline">Сбросить фильтры</button>`;

// карточка-таблица: шапка колонок + тело, пейджер внутри
function cabTable(prefix, heads, minW = '40rem') {
  return `<div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-left text-xs edge-table" style="min-width:${minW}">
    <thead><tr class="text-slate-400">${heads.map(h => `<th class="font-medium${h.endsWith('|r') ? ' text-right' : ''}">${h.replace('|r', '')}</th>`).join('')}</tr></thead>
    <tbody id="${prefix}Rows" class="divide-y divide-slate-100"></tbody></table></div><div id="${prefix}Pager"></div></div>`;
}


// выдача или сброс данных для входа сотруднику/ученику: у кого доступа ещё нет — спрашиваем логин; всегда с основанием (BR-025)
function openAccessForm(kind, id, name, hasAccess, reload) {
  openForm({
    title: hasAccess ? 'Сбросить пароль' : 'Выдать доступ', sub: name, danger: hasAccess,
    note: hasAccess ? 'Прежний пароль перестанет работать, будет создан новый временный. Действие записывается в журнал аудита.' : 'Человек получит логин и временный пароль для входа. Действие записывается в журнал аудита.',
    fields: [
      ...(hasAccess ? [] : [{ key: 'login', label: 'Логин для входа', type: 'text', placeholder: 'ivan.petrov', hint: LOGIN_HINT, required: true }]),
      { key: 'reason', label: 'Основание', type: 'textarea', rows: 2, placeholder: hasAccess ? 'Например, пароль потерян' : 'Например, первый вход в систему', required: true }
    ],
    submitLabel: hasAccess ? 'Сбросить пароль' : 'Выдать доступ',
    onSubmit: async v => { const r = await api.cabinet.access.reset(selectedCenterId, { kind, id, login: v.login, reason: v.reason }); await reload(); return () => openCredentials(r.hadAccess ? 'Новый пароль' : 'Данные для входа', r.name, r); }
  });
}
