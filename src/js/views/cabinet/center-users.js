/* Экран кабинета центра: Пользователи (CTR-USR-010). Сотрудники и ученики одним списком.
   Ученика можно добавить и заблокировать (с причиной, запись в журнал); сотрудников ведут в разделе «Сотрудники» — лимит тарифа (BR-023). */
registerView({
  tab: 'center-users', path: 'center-users',
  title: 'Пользователи', nav: { label: 'Пользователи', icon: 'users' },
  template: `
<main id="view-center-users" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div id="usrHead"></div>
  <div class="flex flex-wrap items-center gap-3">
    <div id="usrFilters" class="flex flex-wrap items-center gap-3"></div>
    <div class="w-64 relative"><svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input id="usrSearch" oninput="setUsrQuery(this.value)" type="text" placeholder="Поиск по имени или телефону…" class="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-brand transition"></div>
    <button id="usrReset" onclick="resetUsrFilters()" class="hidden text-xs font-semibold text-brand hover:underline">Сбросить фильтры</button>
  </div>
  ${cabTable('usr', ['ФИО', 'Телефон', 'Роль', 'Филиал', 'Статус', 'Действия|r'], '46rem')}
</main>
`,
  render: renderUsers
});

const usrState = { center: 0, role: '', branch: '', q: '', page: 1 };
let usrGroups = [], usrTimer = null, usrCanAdd = true;

async function renderUsers() {
  if (usrState.center !== selectedCenterId) Object.assign(usrState, { center: selectedCenterId, role: '', branch: '', q: '', page: 1 });
  $('usrSearch').value = usrState.q;
  const my = begin('center-users');
  $('usrRows').innerHTML = skeletonRows(6);
  try {
    const r = await api.cabinet.users.list(selectedCenterId, { role: usrState.role, branch: usrState.branch, q: usrState.q, page: usrState.page, pageSize: PAGE_SIZE });
    if (stale('center-users', my)) return;
    usrGroups = r.groups; usrCanAdd = r.center.status === 'active';
    $('usrHead').innerHTML = cabHead('Пользователи', 'Ученики, преподаватели, администраторы и менеджеры центра.', usrCanAdd ? cabAddButton('Добавить ученика', 'openUsrAdd()') : cabBlockedNote());
    $('usrFilters').innerHTML = cabSelect('Роль', [{ value: '', label: 'Все' }, ...Object.entries(r.roles).map(([value, label]) => ({ value, label }))], usrState.role, 'setUsrRole(this.value)')
      + cabSelect('Филиал', [{ value: '', label: 'Все' }, ...r.branches.map(b => ({ value: b, label: b }))], usrState.branch, 'setUsrBranch(this.value)');
    $('usrReset').classList.toggle('hidden', !usrState.role && !usrState.branch && !usrState.q);
    $('usrRows').innerHTML = r.items.length ? r.items.map(u => `<tr>
      <td class="py-3.5"><div class="flex items-center gap-3"><span class="w-8 h-8 rounded-full bg-brand-light text-brand font-bold text-[11px] flex items-center justify-center flex-shrink-0">${esc(cabInitials(u.name))}</span><span class="font-semibold text-slate-900">${esc(u.name)}</span></div></td>
      <td class="py-3.5 text-slate-600 tabular-nums">${esc(u.phone)}</td>
      <td class="py-3.5 text-slate-700">${esc(u.roleLabel)}</td>
      <td class="py-3.5 text-slate-500">${esc(u.branch || '—')}</td>
      <td class="py-3.5">${u.status === 'active' ? badge('emerald', 'Активен') : badge('rose', 'Заблокирован')}</td>
      <td class="py-3.5 text-right">${u.kind === 'student' && usrCanAdd ? menuGear(`usrMenu(this, ${u.id}, '${esc(u.name).replace(/'/g, '')}', '${u.status}', ${u.hasAccess})`) : ''}</td></tr>`).join('')
      : cabEmptyRow(6, usrState.role || usrState.branch || usrState.q ? 'По этим условиям пользователей нет.' : 'В центре пока нет пользователей.');
    $('usrPager').innerHTML = pagerHtml('usr', { page: r.page, total: r.total }, n => { usrState.page = n; renderUsers(); });
  } catch (e) { if (!stale('center-users', my)) $('usrRows').innerHTML = errorRow(6, e); }
}

function setUsrRole(v) { Object.assign(usrState, { role: v, page: 1 }); renderUsers(); }
function setUsrBranch(v) { Object.assign(usrState, { branch: v, page: 1 }); renderUsers(); }
function setUsrQuery(v) { usrState.q = v; usrState.page = 1; clearTimeout(usrTimer); usrTimer = setTimeout(renderUsers, 250); }
function resetUsrFilters() { Object.assign(usrState, { role: '', branch: '', q: '', page: 1 }); renderUsers(); }

function usrMenu(anchor, id, name, status, hasAccess) {
  openMenu(anchor, [{ label: hasAccess ? 'Сбросить пароль…' : 'Выдать доступ…', hint: hasAccess ? 'Новый временный пароль' : 'Логин и временный пароль', icon: 'bolt', run: () => openAccessForm('student', id, name, hasAccess, renderUsers) }, { divider: true }, status === 'active'
    ? { label: 'Заблокировать…', hint: 'Ученик потеряет доступ', icon: 'xcircle', danger: true, run: () => openUsrStatus(id, name, 'blocked') }
    : { label: 'Вернуть доступ…', hint: 'Ученик снова активен', icon: 'check', run: () => openUsrStatus(id, name, 'active') }]);
}

function openUsrAdd() {
  openForm({
    title: 'Добавить ученика', sub: 'Ученик попадёт в список и в выбранную группу',
    fields: [
      { key: 'name', label: 'ФИО', type: 'text', placeholder: 'Например, Амира Рахимова', required: true },
      { key: 'phone', label: 'Телефон', type: 'text', placeholder: '+992 90 000 00 00', required: true },
      { key: 'login', label: 'Логин для входа', type: 'text', placeholder: 'amira.rahimova', hint: LOGIN_HINT, required: true },
      { key: 'groupId', label: 'Группа', type: 'select', value: '', options: [{ value: '', label: 'Без группы' }, ...usrGroups.map(g => ({ value: g.id, label: g.name }))] }
    ],
    submitLabel: 'Добавить',
    onSubmit: async v => { const s = await api.cabinet.users.add(selectedCenterId, v); showToast('Ученик «' + s.name + '» добавлен', 'success'); await renderUsers(); return () => openCredentials('Данные для входа', s.name, s.credentials); }
  });
}

function openUsrStatus(id, name, status) {
  const block = status === 'blocked';
  openForm({
    title: block ? 'Заблокировать ученика' : 'Вернуть доступ ученику', sub: name, danger: block,
    note: block ? 'Ученик не сможет входить и получать coin. Действие записывается в журнал аудита.' : 'Ученик снова сможет входить и получать coin. Действие записывается в журнал аудита.',
    fields: [{ key: 'reason', label: 'Причина', type: 'textarea', rows: 2, placeholder: block ? 'Например, долгое отсутствие без связи' : 'Например, вопрос урегулирован', required: true }],
    submitLabel: block ? 'Заблокировать' : 'Вернуть доступ',
    onSubmit: async v => { await api.cabinet.users.setStatus(selectedCenterId, id, { status, reason: v.reason }); showToast(block ? 'Ученик заблокирован' : 'Доступ возвращён', 'success'); await renderUsers(); }
  });
}
