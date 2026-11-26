/* Экран кабинета центра: Сотрудники (CTR-STF-010).
   Число активных сотрудников ограничено тарифом (BR-023): лимит, «у лимита» и возможность добавить приходят из api (meta),
   в экране не пересчитываются. Увольнение освобождает место и требует причину. */
registerView({
  tab: 'center-staff', path: 'center-staff',
  title: 'Сотрудники', nav: { label: 'Сотрудники', icon: 'users' },
  template: `
<main id="view-center-staff" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="max-w-2xl">
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Сотрудники</h1>
      <p class="text-xs text-slate-500 mt-1">Преподаватели и администраторы центра. Количество сотрудников ограничено тарифом.</p>
    </div>
    <div id="stfAction"></div>
  </div>
  <div id="stfLimit"></div>
  <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
    <div class="px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
      <div id="stfChips" class="flex flex-wrap items-center gap-2"></div>
      <div class="flex items-center gap-3">
        <button id="stfReset" onclick="resetStaffFilters()" class="hidden text-xs font-semibold text-brand hover:underline">Сбросить фильтры</button>
        <div class="w-64 relative">
          <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input id="stfSearch" oninput="setStaffQuery(this.value)" type="text" placeholder="Поиск по имени или телефону…" class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-brand focus:bg-white transition">
        </div>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs edge-table min-w-[44rem]">
        <thead><tr class="text-slate-400">
          <th class="font-medium">Сотрудник</th><th class="font-medium">Роль</th><th class="font-medium">Телефон</th><th class="font-medium">Принят</th><th class="font-medium text-right">Действия</th>
        </tr></thead>
        <tbody id="stfRows" class="divide-y divide-slate-100"></tbody>
      </table>
    </div>
    <div id="stfPager"></div>
  </div>
</main>
`,
  render: renderStaff
});

const stfState = { center: 0, q: '', role: '', page: 1 };
const STF_TONES = { teacher: 'indigo', admin: 'slate' };
let stfRoles = {};                                  // роли из ответа api: { teacher: 'Преподаватель', … }
let stfTimer = null;

async function renderStaff() {
  if (stfState.center !== selectedCenterId) Object.assign(stfState, { center: selectedCenterId, q: '', role: '', page: 1 });
  $('stfSearch').value = stfState.q;
  const my = begin('center-staff');
  $('stfRows').innerHTML = skeletonRows(5);
  try {
    const r = await api.cabinet.staff.list(selectedCenterId, { role: stfState.role, q: stfState.q, page: stfState.page, pageSize: PAGE_SIZE });
    if (stale('center-staff', my)) return;
    stfRoles = r.roles;
    stfPaint(r);
  } catch (e) { if (!stale('center-staff', my)) $('stfRows').innerHTML = errorRow(5, e); }
}

function stfPaint(r) {
  const m = r.meta, pct = Math.min(100, Math.round(m.used / m.limit * 100));
  const bar = m.used >= m.limit ? 'bg-rose-500' : m.nearLimit ? 'bg-amber-500' : 'bg-brand';
  const tag = m.used >= m.limit ? badge('rose', 'Лимит исчерпан') : m.nearLimit ? badge('amber', 'У лимита') : '';
  $('stfLimit').innerHTML = `<div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-wrap items-center gap-6">
    <div class="min-w-[14rem]"><div class="text-xs text-slate-500 font-medium">Сотрудники по тарифу «${esc(m.planName)}»</div><div class="text-2xl font-extrabold text-slate-900 mt-1">${m.used} из ${m.limit} ${tag}</div></div>
    <div class="flex-1 min-w-[14rem]"><div class="h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full ${bar}" style="width:${pct}%"></div></div>
      <div class="mt-2 text-[11px] text-slate-500">${Object.entries(r.roles).map(([k, label]) => esc(label) + 'ей: <strong class="text-slate-700">' + r.counts[k] + '</strong>').join(' · ')}</div></div>
  </div>`;
  $('stfAction').innerHTML = m.canAdd
    ? `<button onclick="openStaffAdd()" class="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg><span>Добавить сотрудника</span></button>`
    : `<div class="max-w-xs text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">${r.center.status === 'blocked' ? 'Центр заблокирован: добавлять сотрудников нельзя.' : 'Лимит тарифа исчерпан. Чтобы добавить сотрудника, смените тариф на платформе или уволите кого-то из текущих.'}</div>`;
  $('stfChips').innerHTML = chip(!stfState.role, 'Все', "setStaffRole('')") + Object.entries(r.roles).map(([k, label]) => chip(stfState.role === k, esc(label) + 'и · ' + r.counts[k], `setStaffRole('${k}')`)).join('');
  $('stfReset').classList.toggle('hidden', !stfState.role && !stfState.q);
  $('stfRows').innerHTML = r.items.length ? r.items.map(s => `<tr>
    <td class="py-3.5"><div class="flex items-center gap-3"><span class="w-8 h-8 rounded-full bg-brand-light text-brand font-bold text-[11px] flex items-center justify-center flex-shrink-0">${esc(s.name.split(' ').map(w => w[0]).join('').slice(0, 2))}</span><span class="font-semibold text-slate-900">${esc(s.name)}</span></div></td>
    <td class="py-3.5">${badge(STF_TONES[s.role] || 'slate', esc(s.roleLabel))}</td>
    <td class="py-3.5 text-slate-600 tabular-nums">${esc(s.phone)}</td>
    <td class="py-3.5 text-slate-500">${esc(fmtDay(s.hiredAt))}, ${new Date(s.hiredAt).getFullYear()}</td>
    <td class="py-3.5 text-right">${menuGear(`stfMenu(this, ${s.id}, '${esc(s.name).replace(/'/g, '')}', ${s.hasAccess})`)}</td>
  </tr>`).join('') : `<tr><td colspan="5" class="py-10 text-center text-xs text-slate-500">${stfState.q || stfState.role ? 'По этим условиям сотрудников нет.' : 'В центре пока нет сотрудников.'}</td></tr>`;
  $('stfPager').innerHTML = pagerHtml('stf', { page: r.page, total: r.total }, n => { stfState.page = n; renderStaff(); });
}

function setStaffRole(role) { Object.assign(stfState, { role, page: 1 }); renderStaff(); }
function setStaffQuery(v) { stfState.q = v; stfState.page = 1; clearTimeout(stfTimer); stfTimer = setTimeout(renderStaff, 250); }
function resetStaffFilters() { Object.assign(stfState, { q: '', role: '', page: 1 }); renderStaff(); }

function stfMenu(anchor, id, name, hasAccess) {
  openMenu(anchor, [{ label: hasAccess ? 'Сбросить пароль…' : 'Выдать доступ…', hint: hasAccess ? 'Новый временный пароль' : 'Логин и временный пароль', icon: 'bolt', run: () => openAccessForm('staff', id, name, hasAccess, renderStaff) }, { divider: true }, { label: 'Уволить…', hint: 'Освободит место по лимиту тарифа', icon: 'xcircle', danger: true, run: () => openStaffRemove(id, name) }]);
}

function openStaffAdd() {
  openForm({
    title: 'Добавить сотрудника', sub: 'Сотрудник занимает одно место по лимиту тарифа',
    fields: [
      { key: 'name', label: 'ФИО', type: 'text', placeholder: 'Например, Рустам Каримов', required: true },
      { key: 'role', label: 'Роль', type: 'select', value: 'teacher', options: Object.entries(stfRoles).map(([value, label]) => ({ value, label })), required: true },
      { key: 'phone', label: 'Телефон', type: 'text', placeholder: '+992 90 000 00 00', required: true },
      { key: 'login', label: 'Логин для входа', type: 'text', placeholder: 'rustam.karimov', hint: LOGIN_HINT, required: true }
    ],
    submitLabel: 'Добавить',
    onSubmit: async v => { const s = await api.cabinet.staff.add(selectedCenterId, v); showToast('Сотрудник «' + s.name + '» добавлен', 'success'); await renderStaff(); return () => openCredentials('Данные для входа', s.name, s.credentials); }
  });
}

function openStaffRemove(id, name) {
  openForm({
    title: 'Уволить сотрудника', sub: name, danger: true,
    note: 'Сотрудник перестанет учитываться в лимите тарифа, место освободится. Действие записывается в журнал аудита и не отменяется.',
    fields: [{ key: 'reason', label: 'Причина', type: 'textarea', rows: 2, placeholder: 'Например, переход в другой центр', required: true }],
    submitLabel: 'Уволить',
    onSubmit: async v => { await api.cabinet.staff.remove(selectedCenterId, id, { reason: v.reason }); showToast('Сотрудник уволен, место освобождено', 'success'); await renderStaff(); }
  });
}
