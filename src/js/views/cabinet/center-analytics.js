/* Экран кабинета центра: Аналитика (CTR-COI-010). Баллы учеников: итоги, рейтинг, фильтры по группе и диапазону баллов.
   Баллы начисляют преподаватели и автоправила, вручную администратор их не начисляет (BR-030). */
registerView({
  tab: 'center-analytics', path: 'center-analytics',
  title: 'Аналитика', nav: { label: 'Аналитика', icon: 'chart' },
  template: `
<main id="view-center-analytics" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div id="anlHead"></div>
  <div id="anlTiles"></div>
  <div class="flex flex-wrap items-center gap-3">
    <div id="anlFilters" class="flex flex-wrap items-center gap-3"></div>
    <div class="w-56 relative"><svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input id="anlSearch" oninput="setAnlQuery(this.value)" type="text" placeholder="Поиск по имени…" class="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-brand transition"></div>
    <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-500">Баллы
      <input id="anlFrom" type="number" min="0" placeholder="От" oninput="setAnlCoin()" class="w-16 bg-transparent font-semibold text-slate-800 py-1 focus:outline-none">—
      <input id="anlTo" type="number" min="0" placeholder="До" oninput="setAnlCoin()" class="w-16 bg-transparent font-semibold text-slate-800 py-1 focus:outline-none"></div>
    ${cabResetLink('anlReset', 'resetAnlFilters()')}
  </div>
  ${cabTable('anl', ['#', 'Ученик', 'Группа', 'Филиал', 'Баллы|r', 'Статус'], '44rem')}
</main>
`,
  render: renderAnalytics
});

const anlState = { center: 0, groupId: '', q: '', coinFrom: '', coinTo: '', page: 1 };
let anlGroups = [], anlCanEdit = true, anlTimer = null;

async function renderAnalytics() {
  if (anlState.center !== selectedCenterId) Object.assign(anlState, { center: selectedCenterId, groupId: '', q: '', coinFrom: '', coinTo: '', page: 1 });
  $('anlSearch').value = anlState.q; $('anlFrom').value = anlState.coinFrom; $('anlTo').value = anlState.coinTo;
  const my = begin('center-analytics');
  $('anlRows').innerHTML = skeletonRows(6);
  try {
    const r = await api.cabinet.analytics.list(selectedCenterId, { ...anlState, pageSize: PAGE_SIZE });
    if (stale('center-analytics', my)) return;
    anlGroups = r.groups; anlCanEdit = r.center.status === 'active';
    $('anlHead').innerHTML = cabHead('Аналитика', 'Баллы учеников: кто сколько накопил. Баллы начисляют преподаватели за успехи и автоправила.', '');
    $('anlTiles').innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">${tile('Учеников', r.totals.students.toLocaleString('ru-RU'), 'участвуют в начислении баллов')}${tile('Баллов выдано', r.totals.coin.toLocaleString('ru-RU'), 'за всё время')}${tile('В среднем на ученика', r.totals.avg.toLocaleString('ru-RU'), 'баллов')}</div>`;
    $('anlFilters').innerHTML = cabSelect('Группа', [{ value: '', label: 'Все' }, ...r.groups.map(g => ({ value: g.id, label: g.name }))], anlState.groupId, 'setAnlGroup(this.value)');
    const filtered = anlState.groupId || anlState.q || anlState.coinFrom !== '' || anlState.coinTo !== '';
    $('anlReset').classList.toggle('hidden', !filtered);
    const base = (r.page - 1) * r.pageSize;
    $('anlRows').innerHTML = r.items.length ? r.items.map((s, i) => `<tr>
      <td class="py-3.5 text-slate-400 tabular-nums">${base + i + 1}</td>
      <td class="py-3.5"><div class="flex items-center gap-3"><span class="w-8 h-8 rounded-full bg-brand-light text-brand font-bold text-[11px] flex items-center justify-center flex-shrink-0">${esc(cabInitials(s.name))}</span><span class="font-semibold text-slate-900">${esc(s.name)}</span></div></td>
      <td class="py-3.5 text-slate-600">${esc(s.group || '—')}</td><td class="py-3.5 text-slate-500">${esc(s.branch || '—')}</td>
      <td class="py-3.5 text-right font-bold tabular-nums text-slate-900">${s.coin.toLocaleString('ru-RU')}</td>
      <td class="py-3.5">${s.status === 'active' ? badge('emerald', 'Активен') : badge('rose', 'Заблокирован')}</td></tr>`).join('')
      : cabEmptyRow(6, filtered ? 'По этим условиям учеников нет.' : 'В центре пока нет учеников.');
    $('anlPager').innerHTML = pagerHtml('anl', { page: r.page, total: r.total }, n => { anlState.page = n; renderAnalytics(); });
  } catch (e) { if (!stale('center-analytics', my)) $('anlRows').innerHTML = errorRow(6, e); }
}

function setAnlGroup(v) { Object.assign(anlState, { groupId: v, page: 1 }); renderAnalytics(); }
function setAnlQuery(v) { anlState.q = v; anlState.page = 1; clearTimeout(anlTimer); anlTimer = setTimeout(renderAnalytics, 250); }
function setAnlCoin() { anlState.coinFrom = $('anlFrom').value; anlState.coinTo = $('anlTo').value; anlState.page = 1; clearTimeout(anlTimer); anlTimer = setTimeout(renderAnalytics, 300); }
function resetAnlFilters() { Object.assign(anlState, { groupId: '', q: '', coinFrom: '', coinTo: '', page: 1 }); renderAnalytics(); }

