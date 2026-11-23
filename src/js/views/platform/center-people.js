/* Экран платформы: Состав центра (PLT-CTR-060). Группы, ученики и сотрудники выбранного центра только для просмотра: без телефонов и без денег (BR-022).
   Открывается из панели центра в реестре; id центра хранится в cpeState (после перезагрузки страницы возвращаемся к реестру). */
registerView({
  tab: 'center-people', path: 'center-people', title: 'Состав центра', parent: ['Все центры', 'centers'],
  template: `
<main id="view-center-people" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <a href="#/centers" class="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-brand w-fit">← Назад к центрам</a>
  <div id="cpeHead"></div>
  <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
    <div class="px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
      <div id="cpeChips" class="flex flex-wrap items-center gap-2"></div>
      <div class="w-64 relative"><input id="cpeSearch" oninput="setCpeQuery(this.value)" type="text" placeholder="Поиск по названию или имени…" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand focus:bg-white transition"></div>
    </div>
    <div class="overflow-x-auto"><table class="w-full text-left text-xs edge-table min-w-[40rem]"><thead id="cpeHeadRow"></thead><tbody id="cpeRows" class="divide-y divide-slate-100"></tbody></table></div>
    <div id="cpePager"></div>
  </div>
</main>
`,
  render: renderCenterPeople
});

const cpeState = { id: 0, section: 'groups', q: '', page: 1 };
let cpeTimer = null;
const CPE_COLS = {
  groups: ['Группа', 'Курс', 'Филиал', 'Преподаватель', 'Занятия', 'Учеников', 'Статус'],
  students: ['Ученик', 'Группа', 'Филиал', 'Статус'],
  staff: ['Сотрудник', 'Роль', 'Принят']
};

function openCenterPeople(id) { Object.assign(cpeState, { id, section: 'groups', q: '', page: 1 }); switchTab('center-people'); }

async function renderCenterPeople() {
  if (!cpeState.id) { switchTab('centers'); return; }
  const my = begin('center-people'), cols = CPE_COLS[cpeState.section];
  $('cpeSearch').value = cpeState.q;
  $('cpeHeadRow').innerHTML = `<tr class="text-slate-400">${cols.map(c => `<th class="font-medium">${c}</th>`).join('')}</tr>`;
  $('cpeRows').innerHTML = skeletonRows(cols.length);
  try {
    const r = await api.centers.people(cpeState.id, { section: cpeState.section, q: cpeState.q, page: cpeState.page, pageSize: PAGE_SIZE });
    if (stale('center-people', my)) return;
    $('cpeHead').innerHTML = `<div class="max-w-2xl"><h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">${esc(r.center.name)}</h1><p class="text-xs text-slate-500 mt-1">Состав центра: только просмотр. Телефоны, касса и платежи здесь не показываются.</p></div>`;
    const c = r.counts;
    $('cpeChips').innerHTML = chip(cpeState.section === 'groups', 'Группы · ' + c.groups, "setCpeSection('groups')") + chip(cpeState.section === 'students', 'Ученики · ' + c.students.toLocaleString('ru-RU'), "setCpeSection('students')") + chip(cpeState.section === 'staff', 'Сотрудники · ' + c.staff, "setCpeSection('staff')");
    const st = x => x.status === 'active' ? badge('emerald', esc(x.statusLabel)) : badge(x.status === 'archived' ? 'slate' : 'rose', esc(x.statusLabel));
    const row = { groups: x => [x.name, x.course, x.branch, x.teacher, x.schedule, x.members + ' / ' + x.capacity, st(x)], students: x => [x.name, x.group || '—', x.branch || '—', st(x)], staff: x => [x.name, x.roleLabel, fmtDay(x.hiredAt) + ' ' + new Date(x.hiredAt).getFullYear()] }[r.section];
    const html = (v, i) => i === 0 ? `<td class="py-3.5 font-semibold text-slate-900">${esc(v)}</td>` : (typeof v === 'string' && v.startsWith('<span') ? `<td class="py-3.5">${v}</td>` : `<td class="py-3.5 text-slate-600">${esc(v)}</td>`);
    $('cpeRows').innerHTML = r.items.length ? r.items.map(x => `<tr>${row(x).map(html).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="py-10 text-center text-xs text-slate-500">${cpeState.q ? 'По запросу ничего не найдено.' : 'Здесь пока пусто.'}</td></tr>`;
    $('cpePager').innerHTML = pagerHtml('cpe', { page: r.page, total: r.total }, n => { cpeState.page = n; renderCenterPeople(); });
  } catch (e) { if (!stale('center-people', my)) $('cpeRows').innerHTML = errorRow(cols.length, e); }
}

function setCpeSection(s) { Object.assign(cpeState, { section: s, q: '', page: 1 }); renderCenterPeople(); }
function setCpeQuery(v) { cpeState.q = v; cpeState.page = 1; clearTimeout(cpeTimer); cpeTimer = setTimeout(renderCenterPeople, 250); }
