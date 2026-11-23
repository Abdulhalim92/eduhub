/* Экран: Риск оттока (Churn Risk) */
registerView({
  tab: 'churn', path: 'churn',
  title: 'Риск оттока', parent: ['Требует внимания', null],
  template: `
<main id="view-churn" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Риск оттока (Churn Risk)</h1>
      <p class="text-xs text-slate-500 mt-1">Центры, не заходившие в систему более 10 дней. Проактивная работа менеджеров до потери клиента</p>
    </div>
  </div>
  <div id="churnTiles" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"></div>
  <div class="flex flex-wrap items-center gap-3">
    <div id="churnChips" class="flex flex-wrap items-center gap-2"></div>
    <label class="flex items-center gap-2 text-xs text-slate-500">Уровень риска <select id="churnRisk" onchange="setChurnRisk(this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"><option value="all">Любой</option><option value="high">Высокий</option><option value="medium">Средний</option><option value="low">Низкий</option></select></label>
  </div>
  <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden"><div class="overflow-x-auto">
    <table class="w-full text-left text-xs edge-table">
      <thead>
        <tr class="text-slate-400 border-b border-slate-100">
          <th class="font-medium pb-2.5">Центр</th>
          <th class="font-medium pb-2.5">Последний вход</th>
          <th class="font-medium pb-2.5">Уроков за 7 дн.</th>
          <th class="font-medium pb-2.5">Уровень риска</th>
          <th class="font-medium pb-2.5">Менеджер</th>
          <th class="font-medium pb-2.5 text-right">Действия</th>
        </tr>
      </thead>
      <tbody id="churnBody" class="divide-y divide-slate-100 text-slate-700"></tbody>
    </table>
  </div><div id="churnFooter"></div></div>
</main>
`,
  render: renderChurn
});

const churnState = { filter: 'all', risk: 'all', page: 1 };
function setChurnFilter(f) { churnState.filter = f; churnState.page = 1; renderChurn(); }
function setChurnRisk(r) { churnState.risk = r; churnState.page = 1; renderChurn(); }

function riskReasons(c) {
  const r = [`${c.loginDays} ${plural(c.loginDays, ['день', 'дня', 'дней'])} без входа`];
  if (c.lessons7d === 0) r.push('0 уроков за 7 дней'); else if (c.lessons7d < 5) r.push('мало активности');
  if (c.isExpiring) r.push('подписка истекает ' + expiryLabel(c.expiresIn));
  return r.join(' · ');
}

function churnChipsHtml(meta) {
  const m = meta || { total: 0, withoutManager: 0, contacted: 0 };
  return chip(churnState.filter === 'all', `Все · ${m.total}`, "setChurnFilter('all')") +
    chip(churnState.filter === 'nomanager', `Без менеджера · ${m.withoutManager}`, "setChurnFilter('nomanager')") +
    chip(churnState.filter === 'contacted', `Связались · ${m.contacted}`, "setChurnFilter('contacted')");
}

async function renderChurn() {
  const my = begin('churn'), body = $('churnBody');
  $('churnChips').innerHTML = churnChipsHtml();
  $('churnTiles').innerHTML = ['Центров в зоне риска', 'Высокий риск', 'Выручка под угрозой', 'Без менеджера'].map(l => tile(l, '—', '&nbsp;')).join('');
  body.innerHTML = skeletonRows(6, 5);
  try {
    const [{ items, meta }] = await Promise.all([api.centers.churn({ filter: churnState.filter }), refreshAttention()]);
    if (stale('churn', my)) return;
    cacheCenters(items);
    $('churnTiles').innerHTML =
      tile('Центров в зоне риска', meta.total, `${Math.round(meta.total / meta.activeCenters * 100)}% от активных (в выборке)`, 'text-amber-600') +
      tile('Высокий риск', meta.high, 'нужен звонок сегодня', meta.high ? 'text-rose-600' : 'text-slate-900') +
      tile('Выручка под угрозой', money(meta.mrrAtRisk), 'в месяц по тарифам') +
      tile('Без менеджера', meta.withoutManager, meta.withoutManager ? 'назначьте ответственного' : 'все назначены', meta.withoutManager ? 'text-rose-600' : 'text-emerald-600');
    $('churnChips').innerHTML = churnChipsHtml(meta);
    $('churnRisk').value = churnState.risk;
    const filtered = items.filter(c => churnState.risk === 'all' || c.riskLevel === churnState.risk);
    const pg = paginate(filtered, churnState.page); churnState.page = pg.page;
    $('churnFooter').innerHTML = pagerHtml('churn', { page: pg.page, total: pg.total, note: pg.total !== items.length ? 'по фильтру «чипов» всего: ' + items.length : '' }, n => { churnState.page = n; renderChurn(); });
    body.innerHTML = pg.items.length ? pg.items.map(c => {
      const lv = RISK_UI[c.riskLevel];
      return `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-3">
          <div class="font-semibold text-slate-900">${esc(c.name)}</div>
          <div class="text-[11px] text-slate-400">${esc(c.owner)} · ${esc(c.phone)}</div>
          <div class="text-[11px] text-slate-500 mt-0.5">${riskReasons(c)}</div>
        </td>
        <td class="py-3"><span class="inline-block px-2 py-0.5 border border-amber-300 rounded text-amber-700 bg-amber-50 text-[11px] font-medium">${loginLabel(c)}</span></td>
        <td class="py-3 text-slate-600">${c.lessons7d}</td>
        <td class="py-3 w-40">
          <div class="flex items-center justify-between text-[11px] mb-1"><span class="font-semibold ${lv.text}">${lv.label}</span><span class="text-slate-400">${c.riskScore}/100</span></div>
          <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden"><div class="h-full ${lv.bar}" style="width:${c.riskScore}%"></div></div>
        </td>
        <td class="py-3">
          <select onchange="setManager(${c.id}, this.value)" class="px-2 py-1.5 bg-white border ${c.manager ? 'border-slate-200' : 'border-rose-300'} rounded-lg text-xs text-slate-700 focus:outline-none cursor-pointer">
            <option value="" ${c.manager ? '' : 'selected'}>Не назначен</option>
            ${dict().managers.map(m => `<option ${c.manager === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          ${c.contacted ? `<div class="mt-1">${badge('emerald', 'Контакт сегодня')}</div>` : ''}
        </td>
        <td class="py-3 text-right"><div class="flex items-center justify-end gap-2">
          <button onclick="markContacted(${c.id})" ${c.contacted ? 'disabled' : ''} class="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark transition disabled:opacity-40 disabled:cursor-default whitespace-nowrap">${c.contacted ? 'Контакт есть' : 'Связались'}</button>
          ${menuGear(`churnMenu(this, ${c.id})`)}
        </div></td>
      </tr>`;
    }).join('') : `<tr><td colspan="6" class="py-10 text-center text-slate-400">Нет центров по выбранному фильтру</td></tr>`;
  } catch (e) { if (!stale('churn', my)) { body.innerHTML = errorRow(6, e); $('churnTiles').innerHTML = ''; } }
}

async function setManager(id, name) {
  const c = await mutate(() => api.centers.setManager(id, { manager: name || null }),
    r => (name ? `Менеджер ${name} назначен: ${r.name}` : 'Менеджер снят: ' + r.name), name ? 'success' : 'info');
  await renderChurn();                                   // при ошибке вернёт select к серверному значению
  return c;
}
async function markContacted(id) {
  const c = await mutate(() => api.centers.markContacted(id), r => 'Контакт с центром «' + r.name + '» зафиксирован');
  if (c) await renderChurn();
}

// Действия по центру в зоне риска. Главное — зафиксировать контакт менеджера. В меню:
//  • Войти в кабинет — посмотреть глазами владельца, почему не пользуются; • Настройка модулей — включить нужное;
//  • Баланс и овердрафт — нет ли долга как причины; • Сменить тариф — предложить более подходящий.
function churnMenuItems(c) {
  return [
    { label: 'Войти в кабинет', hint: 'Режим поддержки: посмотреть, что мешает пользоваться', icon: 'enter', run: () => enterImpersonationById(c.id) },
    { label: 'Настройка модулей', hint: 'Feature Flags и лимиты центра', icon: 'sliders', run: () => openDrawerById(c.id) },
    { divider: true },
    { label: 'Баланс и овердрафт…', hint: 'Баланс на платформе ' + money(c.balance) + (c.overdraftUsed ? ' · овердрафт использован' : ''), icon: 'wallet', run: () => openFinance(c.id) },
    { label: 'Сменить тариф…', hint: 'Сейчас «' + c.plan + '»', icon: 'swap', run: () => openPlanChange(c.id) }
  ];
}
function churnMenu(btn, id) { const c = centerCache.get(id); if (c) openMenu(btn, churnMenuItems(c)); }
