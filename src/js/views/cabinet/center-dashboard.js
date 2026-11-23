/* Экран кабинета центра: Дашборд (CTR-DSH-010). Показатели центра, филиалы, группы с низкой заполненностью.
   «Низкая заполненность» (меньше половины мест) считает api (lowFill). Посещаемость по дням недели — демонстрационная. */
registerView({
  tab: 'center-dashboard', path: 'center-dashboard',
  title: 'Дашборд', nav: { label: 'Дашборд', icon: 'dashboard' },
  template: `
<main id="view-center-dashboard" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div class="max-w-2xl">
    <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Дашборд</h1>
    <p class="text-xs text-slate-500 mt-1">Сводка по центру: ученики, преподаватели, группы и филиалы.</p>
  </div>
  <div id="dbBody" class="flex flex-col gap-5"></div>
</main>
`,
  render: renderCenterDashboard
});

async function renderCenterDashboard() {
  const my = begin('center-dashboard'), body = $('dbBody');
  body.innerHTML = '<div class="h-32 bg-white border border-slate-200/80 rounded-2xl animate-pulse"></div>'.repeat(3);
  try {
    const d = await api.cabinet.dashboard(selectedCenterId);
    if (stale('center-dashboard', my)) return;
    const k = d.kpis;
    body.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      ${tile('Всего учеников', k.students.toLocaleString('ru-RU'), k.studentsBlocked ? 'заблокировано: ' + k.studentsBlocked : 'все активны')}
      ${tile('Преподавателей', k.teachers, 'работают в центре')}
      ${tile('Активных групп', k.groupsActive, 'всего групп: ' + k.groupsTotal)}
      ${tile('Филиалов', k.branches, 'активных: ' + k.branchesActive)}
    </div>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">${dbWeek(d.week)}${dbLowFill(d.lowFill)}</div>
    ${dbUpcoming(d.upcoming)}
    ${dbBranches(d.branches)}`;
  } catch (e) { if (!stale('center-dashboard', my)) body.innerHTML = `<div class="bg-white border border-slate-200/80 rounded-2xl">${errorBox(e)}</div>`; }
}

function dbWeek(week) {
  const best = Math.max(...week.map(w => w.percent));
  return `<section class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
    <div class="flex items-center justify-between"><h3 class="text-sm font-bold text-slate-900">Посещаемость по дням недели</h3><span class="text-[11px] text-slate-400">демонстрационные данные</span></div>
    <div class="mt-5 flex gap-3">${week.map(w => `<div class="flex-1 flex flex-col items-center gap-2">
      <span class="text-[11px] font-semibold text-slate-600 tabular-nums">${w.percent}%</span>
      <div class="w-full h-32 flex items-end"><div class="w-full rounded-lg ${w.percent === best ? 'bg-brand' : 'bg-brand-light'}" style="height:${w.percent}%"></div></div>
      <span class="text-[11px] text-slate-500">${esc(w.day)}</span></div>`).join('')}</div>
  </section>`;
}

function dbLowFill(list) {
  return `<section class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
    <div class="flex items-center justify-between"><h3 class="text-sm font-bold text-slate-900">Группы с низкой заполненностью</h3><a href="#/center-groups${cabinetQuery()}" class="text-xs font-semibold text-brand hover:underline">Все группы →</a></div>
    ${list.length ? `<div class="mt-3 divide-y divide-slate-100">${list.map(g => `<a href="#/center-group${cabinetQuery()}&group=${g.id}" class="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
      <div class="min-w-0"><div class="text-xs font-semibold text-slate-900 truncate">${esc(g.name)}</div><div class="text-[11px] text-slate-400 mt-0.5">${esc(g.teacher)}</div></div>
      <span class="text-[11px] font-semibold text-amber-700 whitespace-nowrap">Свободно: ${g.capacity - g.members}/${g.capacity}</span></a>`).join('')}</div>`
      : '<div class="py-10 text-center text-xs text-slate-500">Все активные группы заполнены больше чем наполовину.</div>'}
  </section>`;
}

function dbUpcoming(list) {
  return `<section class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
    <div class="flex items-center justify-between"><h3 class="text-sm font-bold text-slate-900">Ближайшие занятия</h3><a href="#/center-schedule${cabinetQuery()}" class="text-xs font-semibold text-brand hover:underline">Всё расписание →</a></div>
    ${list.length ? `<div class="mt-3 divide-y divide-slate-100">${list.map(l => `<a href="#/center-group${cabinetQuery()}&group=${l.groupId}" class="py-3 flex items-center gap-4 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
      <span class="w-14 text-sm font-extrabold text-slate-900 tabular-nums">${esc(l.start)}</span>
      <div class="min-w-0 flex-1"><div class="text-xs font-semibold text-slate-900 truncate">${esc(l.group)}</div><div class="text-[11px] text-slate-400 mt-0.5">${esc(l.teacher)} · до ${esc(l.end)}</div></div>
      <span class="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-brand-light text-brand whitespace-nowrap">${esc(l.when)}</span></a>`).join('')}</div>`
      : '<div class="py-8 text-center text-xs text-slate-500">Занятий пока нет: у центра нет активных групп с расписанием.</div>'}
  </section>`;
}

function dbBranches(list) {
  const tone = { published: 'emerald', pending: 'amber', returned: 'amber', rejected: 'rose' };
  return `<section class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
    <div class="flex items-center justify-between mb-3"><h3 class="text-sm font-bold text-slate-900">Филиалы</h3><a href="#/center-branches${cabinetQuery()}" class="text-xs font-semibold text-brand hover:underline">Управлять →</a></div>
    ${list.length ? `<div class="flex flex-col gap-2">${list.map(b => `<div class="border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div class="min-w-0"><div class="text-xs font-semibold text-slate-900">${esc(b.name)}</div>${b.address ? `<div class="text-[11px] text-slate-400 mt-0.5">${esc(b.address)}</div>` : ''}</div>${badge(tone[b.status] || 'slate', esc(b.statusLabel))}</div>`).join('')}</div>`
      : '<div class="py-8 text-center text-xs text-slate-500">Филиалов пока нет. Подайте заявку в разделе «Филиалы и каталог».</div>'}
  </section>`;
}
