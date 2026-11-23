/* Экран: Журнал аудита (спека, модуль 2.7). Неизменяемый журнал критичных действий SuperAdmin и системы:
   платежи, смена тарифов, изменение тарифов, вход в режим поддержки. Запись: время до секунды, кто и в какой роли,
   IP / устройство, тип действия, объект, «Было → Стало», причина. Править и удалять записи нельзя. */
registerView({
  tab: 'audit', path: 'audit',
  title: 'Журнал аудита', parent: null,
  template: `
<main id="view-audit" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn">
  <div>
    <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Журнал аудита</h1>
    <p class="text-xs text-slate-500 mt-1">Критичные действия на платформе: оплаты, смена тарифов, изменения тарифов и входы в режим поддержки. Записи нельзя изменить или удалить</p>
  </div>

  <div class="flex flex-wrap items-center gap-3">
    <div class="w-72 relative">
      <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input id="auditSearch" oninput="auditSet('q', this.value)" type="text" placeholder="Центр, сотрудник или причина…" class="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-brand">
    </div>
    <select id="auditAction" onchange="auditSet('action', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer">
      <option value="all">Все действия</option>
    </select>
    <select id="auditEntity" onchange="auditSet('entityType', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer">
      <option value="all">Все объекты</option><option value="center">Центры</option><option value="plan">Тарифы</option><option value="course">Курсы</option><option value="sms-package">Пакеты SMS</option>
    </select>
    <select id="auditPeriod" onchange="auditSet('days', Number(this.value))" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer">
      <option value="0">За всё время</option><option value="1">Последние сутки</option><option value="7">Последние 7 дней</option><option value="30">Последние 30 дней</option>
    </select>
    <button id="auditReset" onclick="auditResetFilters()" class="hidden text-xs font-semibold text-brand hover:underline">Сбросить фильтры</button>
  </div>

  <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden"><div class="overflow-x-auto">
    <table class="w-full text-left text-xs edge-table">
      <thead>
        <tr class="text-slate-400">
          <th class="font-medium">Время</th>
          <th class="font-medium">Кто</th>
          <th class="font-medium">IP / устройство</th>
          <th class="font-medium">Действие</th>
          <th class="font-medium">Объект</th>
          <th class="font-medium">Было → Стало</th>
          <th class="font-medium">Причина</th>
        </tr>
      </thead>
      <tbody id="auditBody" class="divide-y divide-slate-100 text-slate-700"></tbody>
    </table>
  </div><div id="auditFooter"></div></div>
</main>
`,
  render: () => renderAudit()
});

const auditState = { q: '', action: 'all', entityType: 'all', days: 0, page: 1 };
let auditQTimer;

function auditSet(key, value) {
  auditState[key] = value; auditState.page = 1;
  if (key === 'q') { clearTimeout(auditQTimer); auditQTimer = setTimeout(renderAudit, 250); }   // debounce поиска
  else renderAudit();
}

// подписи полей «Было → Стало» (вложенные ключи склеиваются через точку)
const AUDIT_FIELDS = {
  plan: 'Тариф', expiresIn: 'Дней до конца подписки', status: 'Статус', method: 'Способ оплаты', reference: 'Документ', amount: 'Сумма', id: 'Счёт', kind: 'Тип', to: 'Новый тариф',
  price: 'Цена, сомони', active: 'Активен', balance: 'Баланс на платформе, сомони', overdraftLimit: 'Лимит овердрафта, сомони', 'limits.staff': 'Лимит сотрудников', 'limits.storageGb': 'Хранилище, ГБ', 'limits.branches': 'Лимит филиалов',
  'modules.payroll': 'Модуль «Зарплаты»', 'modules.inventory': 'Модуль «Инвентарь»', 'modules.crm': 'Модуль «CRM-воронка»', 'modules.geo': 'Модуль «Гео-чек-ин»'
};
function auditFlatten(obj, prefix = '', out = {}) {
  Object.keys(obj || {}).forEach(k => {
    const v = obj[k], key = prefix + k;
    if (v && typeof v === 'object') auditFlatten(v, key + '.', out); else out[key] = v;
  });
  return out;
}
const auditVal = v => (v === true ? 'да' : v === false ? 'нет' : v === null || v === undefined ? '—' : String(v));
function auditChange(before, after) {
  const b = auditFlatten(before), a = auditFlatten(after), keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const rows = keys.filter(k => b[k] !== a[k]).map(k => {
    const label = AUDIT_FIELDS[k] || k;
    return `<div><span class="text-slate-400">${esc(label)}:</span> ${k in b ? `<span class="text-slate-400 line-through">${esc(auditVal(b[k]))}</span> → ` : ''}<strong class="text-slate-800">${esc(auditVal(a[k]))}</strong></div>`;
  });
  return rows.length ? rows.join('') : '<span class="text-slate-300">—</span>';
}

async function renderAudit() {
  const my = begin('audit'), body = $('auditBody');
  body.innerHTML = skeletonRows(7, 5);
  try {
    const { items, total, allTotal, actions } = await api.audit.list({ q: auditState.q, action: auditState.action, entityType: auditState.entityType, days: auditState.days, page: auditState.page, pageSize: PAGE_SIZE });
    if (stale('audit', my)) return;
    if (!items.length && total && auditState.page > 1) { auditState.page = Math.ceil(total / PAGE_SIZE); return renderAudit(); }
    const sel = $('auditAction');
    if (sel && sel.options.length !== actions.length + 1) {                      // список действий берём из данных журнала
      sel.innerHTML = '<option value="all">Все действия</option>' + actions.map(a => `<option value="${esc(a)}">${esc(AUDIT_LABELS[a] || a)}</option>`).join('');
    }
    if (sel && sel.value !== auditState.action) sel.value = auditState.action;
    $('auditEntity').value = auditState.entityType; $('auditPeriod').value = String(auditState.days);
    $('auditReset').classList.toggle('hidden', !(auditState.q || auditState.action !== 'all' || auditState.entityType !== 'all' || auditState.days));
    $('auditFooter').innerHTML = pagerHtml('audit', { page: auditState.page, total, note: total !== allTotal ? 'всего записей: ' + allTotal : '' }, n => { auditState.page = n; renderAudit(); });
    body.innerHTML = items.length ? items.map(e => `
      <tr class="hover:bg-slate-50 transition align-top">
        <td class="py-3 whitespace-nowrap text-slate-600">${fmtDateTime(e.at)}</td>
        <td class="py-3"><div class="font-semibold text-slate-900">${esc(e.actor.name)}</div><div class="text-[11px] text-slate-400">${esc(e.actor.role)}</div></td>
        <td class="py-3 text-slate-500"><div>${esc(e.ip)}</div><div class="text-[11px] text-slate-400">${esc(e.device)}</div></td>
        <td class="py-3 font-medium text-slate-800">${AUDIT_LABELS[e.action] || esc(e.action)}</td>
        <td class="py-3"><div class="text-slate-800">${esc(e.entity.name)}</div><div class="text-[11px] text-slate-400">${({ plan: 'тариф', course: 'курс', 'sms-package': 'пакет SMS' })[e.entity.type] || 'центр'}</div></td>
        <td class="py-3 text-[11px] leading-relaxed" style="white-space:normal;min-width:16rem">${auditChange(e.before, e.after)}</td>
        <td class="py-3 text-slate-600" style="white-space:normal;min-width:12rem">${e.reason ? esc(e.reason) : '<span class="text-slate-300">—</span>'}</td>
      </tr>`).join('') : `<tr><td colspan="7" class="py-10 text-center text-slate-400">Записей по выбранным условиям нет</td></tr>`;
  } catch (e) { if (!stale('audit', my)) body.innerHTML = errorRow(7, e); }
}

function auditResetFilters() {
  Object.assign(auditState, { q: '', action: 'all', entityType: 'all', days: 0, page: 1 });
  const i = $('auditSearch'); if (i) i.value = ''; const a = $('auditAction'); if (a) a.value = 'all';
  renderAudit();
}
