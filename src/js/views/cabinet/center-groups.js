/* Экраны кабинета центра: Группы (CTR-GRP-010) — список с фильтрами и страница группы (center-group).
   Группа = курс + филиал + преподаватель + расписание + система оценивания + состав. Места и «мало учеников» считает api. */
registerView({
  tab: 'center-groups', path: 'center-groups',
  title: 'Группы', nav: { label: 'Группы', icon: 'group' },
  template: `
<main id="view-center-groups" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div id="grpHead"></div>
  <div class="flex flex-wrap items-center gap-3"><div id="grpFilters" class="flex flex-wrap items-center gap-3"></div>${cabResetLink('grpReset', 'resetGrpFilters()')}</div>
  ${cabTable('grp', ['Группа', 'Курс', 'Филиал', 'Преподаватель', 'Занятия', 'Учеников', 'Статус', 'Действия|r'], '58rem')}
</main>
`,
  render: renderGroups
});

registerView({
  tab: 'center-group', path: 'center-group', title: 'Группа', parent: ['Группы', 'center-groups'],
  template: `
<main id="view-center-group" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <a href="#/center-groups" onclick="this.href='#/center-groups'+cabinetQuery()" class="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-brand w-fit">← Назад к группам</a>
  <div id="gdBody" class="flex flex-col gap-5"></div>
</main>
`,
  render: renderGroupPage
});

const grpState = { center: 0, course: '', branch: '', teacherId: '', status: '', page: 1 };
let grpOptions = { courses: [], branches: [], teachers: [], schedules: [], days: [] }, grpCanEdit = true, gdData = null;

async function renderGroups() {
  if (grpState.center !== selectedCenterId) Object.assign(grpState, { center: selectedCenterId, course: '', branch: '', teacherId: '', status: '', page: 1 });
  const my = begin('center-groups');
  $('grpRows').innerHTML = skeletonRows(8);
  try {
    const r = await api.cabinet.groups.list(selectedCenterId, { ...grpState, pageSize: PAGE_SIZE });
    if (stale('center-groups', my)) return;
    grpOptions = r.options; grpCanEdit = r.center.status === 'active';
    $('grpHead').innerHTML = cabHead('Группы', 'Учебные группы центра: курс, филиал, преподаватель и состав.', grpCanEdit ? cabAddButton('Добавить группу', 'openGrpForm()') : cabBlockedNote());
    const all = { value: '', label: 'Все' };
    $('grpFilters').innerHTML = cabSelect('Курс', [all, ...r.options.courses.map(v => ({ value: v, label: v }))], grpState.course, "setGrpFilter('course', this.value)")
      + cabSelect('Филиал', [all, ...r.options.branches.map(v => ({ value: v, label: v }))], grpState.branch, "setGrpFilter('branch', this.value)")
      + cabSelect('Преподаватель', [all, ...r.options.teachers.map(t => ({ value: t.id, label: t.name }))], grpState.teacherId, "setGrpFilter('teacherId', this.value)")
      + cabSelect('Статус', [all, { value: 'active', label: 'Активна' }, { value: 'archived', label: 'В архиве' }], grpState.status, "setGrpFilter('status', this.value)");
    $('grpReset').classList.toggle('hidden', !(grpState.course || grpState.branch || grpState.teacherId || grpState.status));
    $('grpRows').innerHTML = r.items.length ? r.items.map(g => `<tr>
      <td class="py-3.5"><a href="#/center-group${cabinetQuery()}&group=${g.id}" class="font-semibold text-slate-900 hover:text-brand">${esc(g.name)}</a></td>
      <td class="py-3.5 text-slate-600">${esc(g.course)}</td><td class="py-3.5 text-slate-600">${esc(g.branch)}</td><td class="py-3.5 text-slate-600">${esc(g.teacher)}</td><td class="py-3.5 text-slate-600 whitespace-nowrap">${esc(g.schedule)}<div class="text-[11px] text-slate-400">${esc(g.startTime)}–${esc(g.endTime)}</div></td>
      <td class="py-3.5 tabular-nums text-slate-700">${g.members} / ${g.capacity}${g.lowFill ? ' ' + badge('amber', 'Мало') : ''}</td>
      <td class="py-3.5">${g.status === 'active' ? badge('emerald', 'Активна') : badge('slate', 'В архиве')}</td>
      <td class="py-3.5 text-right">${menuGear(`grpMenu(this, ${g.id})`)}</td></tr>`).join('')
      : cabEmptyRow(8, grpState.course || grpState.branch || grpState.teacherId || grpState.status ? 'По этим условиям групп нет.' : 'В центре пока нет групп.');
    $('grpPager').innerHTML = pagerHtml('grp', { page: r.page, total: r.total }, n => { grpState.page = n; renderGroups(); });
  } catch (e) { if (!stale('center-groups', my)) $('grpRows').innerHTML = errorRow(8, e); }
}

function setGrpFilter(k, v) { grpState[k] = v; grpState.page = 1; renderGroups(); }
function resetGrpFilters() { Object.assign(grpState, { course: '', branch: '', teacherId: '', status: '', page: 1 }); renderGroups(); }
function openGroup(id) { location.hash = '#/center-group' + cabinetQuery() + '&group=' + id; }

function grpMenu(anchor, id) {
  const items = [{ label: 'Открыть группу', icon: 'open', run: () => openGroup(id) }];
  if (grpCanEdit) items.push({ label: 'Изменить…', icon: 'sliders', run: () => openGrpForm(id) });
  openMenu(anchor, items);
}

// форма создания и правки группы; для правки данные берём из api (в списке нет баллов и дат)
async function openGrpForm(id) {
  let g = null;
  if (id) { try { const r = await api.cabinet.groups.get(selectedCenterId, id); g = r.group; grpOptions = r.options; } catch (e) { showToast(errText(e), 'error'); return; } }
  const o = grpOptions, opt = list => list.map(v => ({ value: v, label: v }));
  openForm({
    title: g ? 'Изменить группу' : 'Добавить группу', sub: g ? g.name : 'Курс, филиал и преподаватель обязательны',
    fields: [
      { key: 'name', label: 'Название', type: 'text', value: g ? g.name : '', placeholder: 'Например, Backend Sep–Oct', required: true },
      { key: 'course', label: 'Курс', type: 'text', value: g ? g.course : '', placeholder: 'Например, Golang', required: true },
      { key: 'branch', label: 'Филиал', type: 'select', value: g ? g.branch : o.branches[0], options: opt(o.branches), required: true },
      { key: 'teacherId', label: 'Преподаватель', type: 'select', value: g ? g.teacherId : '', options: [{ value: '', label: 'Выберите…' }, ...o.teachers.map(t => ({ value: t.id, label: t.name }))], required: true },
      { key: 'schedule', label: 'Дни занятий', type: 'select', value: g ? g.schedule : o.schedules[0], options: opt(o.schedules), required: true },
      { key: 'startTime', label: 'Время начала (ЧЧ:ММ)', type: 'text', value: g ? g.startTime : '10:00', placeholder: '18:00', required: true },
      { key: 'durationMin', label: 'Длительность занятия, мин', type: 'number', value: g ? g.durationMin : 90, required: true },
      { key: 'hwPoints', label: 'Баллы за ДЗ в день', type: 'number', value: g ? g.hwPoints : 10 },
      { key: 'visitPoints', label: 'Баллы за посещение в день', type: 'number', value: g ? g.visitPoints : 1 },
      { key: 'examDay', label: 'День экзамена (еженедельно)', type: 'select', value: g ? g.examDay : 0, options: o.days.map((d, i) => ({ value: i, label: d })) },
      { key: 'examPoints', label: 'Баллы за экзамен', type: 'number', value: g ? g.examPoints : 100 },
      { key: 'capacity', label: 'Мест в группе', type: 'number', value: g ? g.capacity : 20 },
      { key: 'startsAt', label: 'Начало (ГГГГ-ММ-ДД)', type: 'text', value: g ? g.startsAt : new Date().toISOString().slice(0, 10), required: true },
      { key: 'endsAt', label: 'Окончание (ГГГГ-ММ-ДД)', type: 'text', value: g ? g.endsAt : new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), required: true },
      ...(g ? [{ key: 'status', label: 'Статус', type: 'select', value: g.status, options: [{ value: 'active', label: 'Активна' }, { value: 'archived', label: 'В архиве' }] }] : [])
    ],
    submitLabel: g ? 'Сохранить' : 'Добавить',
    onSubmit: async v => {
      if (g) await api.cabinet.groups.update(selectedCenterId, id, v); else await api.cabinet.groups.create(selectedCenterId, v);
      showToast(g ? 'Группа сохранена' : 'Группа добавлена', 'success'); await renderRoute();
    }
  });
}

/* ---------- страница группы ---------- */
async function renderGroupPage() {
  const my = begin('center-group'), body = $('gdBody'), id = Number(hashParams().get('group'));
  body.innerHTML = '<div class="h-32 bg-white border border-slate-200/80 rounded-2xl animate-pulse"></div>'.repeat(3);
  try {
    const d = await api.cabinet.groups.get(selectedCenterId, id);
    if (stale('center-group', my)) return;
    gdData = d; grpCanEdit = d.center.status === 'active';
    const g = d.group;
    const info = (label, value) => `<div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs"><div class="text-[11px] text-slate-500 font-medium">${label}</div><div class="text-lg font-extrabold text-slate-900 mt-1.5 leading-snug">${esc(value)}</div></div>`;
    const stat = (label, value, sub) => `<div class="border border-slate-200 rounded-xl p-4"><div class="text-[11px] text-slate-500">${label}</div><div class="text-2xl font-extrabold text-slate-900 mt-1">${esc(value)}</div><div class="text-[11px] text-slate-400 mt-0.5">${sub}</div></div>`;
    body.innerHTML = `
    <section class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
      <div><div class="flex items-center gap-3 flex-wrap"><h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">${esc(g.name)}</h1>${g.status === 'active' ? badge('emerald', 'Активна') : badge('slate', 'В архиве')}${g.lowFill ? badge('amber', 'Мало учеников') : ''}</div>
        <div class="text-xs text-slate-500 mt-2">${esc(g.course)} · ${esc(g.branch)} · ${esc(g.teacher)}</div></div>
      ${grpCanEdit ? `<button onclick="openGrpForm(${g.id})" class="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition">Изменить группу</button>` : ''}
    </section>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">${info('Курс', g.course)}${info('Филиал', g.branch)}${info('Преподаватель', g.teacher)}${info('Период', fmtDay(g.startsAt) + ' — ' + fmtDay(g.endsAt) + ' ' + new Date(g.endsAt).getFullYear() + ' г.')}</div>
    <section class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
      <h3 class="text-sm font-bold text-slate-900">Система оценивания</h3><p class="text-[11px] text-slate-500 mt-0.5">Правила начисления баллов для этой группы</p>
      <div class="mt-4 text-[11px] font-semibold text-slate-500 tracking-wide">ДНИ И ВРЕМЯ ЗАНЯТИЙ</div>
      <div class="mt-2 flex gap-2 flex-wrap">${g.days.map(i => `<span class="px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">${esc(gdDay(i))}</span>`).join('')}<span class="px-2.5 py-1 rounded-full bg-brand-light text-[11px] font-semibold text-brand">${esc(g.startTime)}–${esc(g.endTime)}</span></div>
      <div class="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">${stat('ДЗ / день', g.hwPoints, 'баллов')}${stat('Посещение / день', g.visitPoints, 'баллов')}${stat('День экзамена', g.examDayLabel, 'еженедельно')}${stat('За экзамен', g.examPoints, 'баллов')}</div>
    </section>
    <section class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
      <div class="px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
        <div><h3 class="text-sm font-bold text-slate-900">Ученики</h3><p class="text-[11px] text-slate-500 mt-0.5">Состоят в этой группе: ${g.members} из ${g.capacity} мест</p></div>
        ${grpCanEdit && g.status === 'active' ? cabAddButton('Добавить ученика', 'openGdAdd()') : ''}
      </div>
      <div class="overflow-x-auto"><table class="w-full text-left text-xs edge-table min-w-[36rem]"><thead><tr class="text-slate-400"><th class="font-medium">ФИО</th><th class="font-medium">Телефон</th><th class="font-medium">Дата вступления</th><th class="font-medium">Статус</th><th class="font-medium text-right">Действия</th></tr></thead>
      <tbody class="divide-y divide-slate-100">${d.students.length ? d.students.map(s => `<tr>
        <td class="py-3.5 font-semibold text-slate-900">${esc(s.name)}</td><td class="py-3.5 text-slate-600 tabular-nums">${esc(s.phone)}</td><td class="py-3.5 text-slate-500">${esc(fmtDay(s.joinedAt))} ${new Date(s.joinedAt).getFullYear()} г.</td>
        <td class="py-3.5">${s.status === 'active' ? badge('emerald', 'Активен') : badge('rose', 'Заблокирован')}</td>
        <td class="py-3.5 text-right">${grpCanEdit && g.status === 'active' ? menuGear(`gdMenu(this, ${s.id}, '${esc(s.name).replace(/'/g, '')}')`) : ''}</td></tr>`).join('') : cabEmptyRow(5, 'В группе пока нет учеников.')}</tbody></table></div>
    </section>`;
  } catch (e) { if (!stale('center-group', my)) body.innerHTML = `<div class="bg-white border border-slate-200/80 rounded-2xl">${errorBox(e)}</div>`; }
}

const gdDay = i => ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i];

function gdMenu(anchor, sid, name) {
  openMenu(anchor, [{ label: 'Убрать из группы…', hint: 'Ученик останется в центре без группы', icon: 'xcircle', danger: true, run: () => openGdRemove(sid, name) }]);
}

function openGdAdd() {
  const d = gdData;
  if (!d.available.length) { showToast('Нет активных учеников, которых можно добавить', 'error'); return; }
  openForm({
    title: 'Добавить ученика в группу', sub: d.group.name,
    note: 'Если ученик уже состоит в другой группе, он будет переведён в эту. Свободных мест: ' + (d.group.capacity - d.group.members) + '.',
    fields: [{ key: 'studentId', label: 'Ученик', type: 'select', value: d.available[0].id, options: d.available.map(s => ({ value: s.id, label: s.name + ' · ' + s.phone })), required: true }],
    submitLabel: 'Добавить',
    onSubmit: async v => { await api.cabinet.groups.addStudent(selectedCenterId, d.group.id, Number(v.studentId)); showToast('Ученик добавлен в группу', 'success'); await renderGroupPage(); }
  });
}

function openGdRemove(sid, name) {
  openForm({
    title: 'Убрать ученика из группы', sub: name, danger: true,
    note: 'Ученик останется в центре без группы; место в группе освободится.',
    fields: [], submitLabel: 'Убрать',
    onSubmit: async () => { await api.cabinet.groups.removeStudent(selectedCenterId, gdData.group.id, sid); showToast('Ученик убран из группы', 'success'); await renderGroupPage(); }
  });
}
