/* Экран: Все центры. Реестр организаций: тариф, использование, активность, БАЛАНС и ОВЕРДРАФТ.
   Баланс на платформе — предоплаченные средства центра (с него оплачиваются счета); овердрафт — лимит, на который баланс может уйти в минус.
   В строке одно главное действие («Войти в кабинет») и меню «Действия» (шестерёнка): финансы, пополнение, смена тарифа, модули. */
registerView({
  tab: 'centers', path: 'centers',
  title: 'Все центры', parent: null,
  template: `
<main id="view-centers" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Регистрация и управление учебными центрами</h1>
      <p class="text-xs text-slate-500 mt-1">Организации, их тарифы, баланс на платформе и овердрафт, активность. Вход в режим поддержки и управление модулями</p>
    </div>
    <button onclick="switchTab('center-new')" class="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs transition">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      <span>Зарегистрировать центр</span>
    </button>
  </div>

  <div id="centersTiles" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"></div>

  <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[30rem]">
    <div class="px-6 py-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
      <div class="w-72 relative">
        <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="centersFilterInput" oninput="setCentersFilter('q', this.value)" type="text" placeholder="Поиск по названию, городу или владельцу…" class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-brand focus:bg-white">
      </div>
      <label class="flex items-center gap-2 text-xs text-slate-500">Тариф
        <select id="centersPlanSelect" onchange="setCentersFilter('plan', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer">
          <option value="all">Все тарифы</option>
          <option>Бизнес</option>
          <option>Про</option>
          <option>Базовый</option>
          <option>Старт</option>
        </select>
      </label>
      <label class="flex items-center gap-2 text-xs text-slate-500">Город
        <select id="centersCitySelect" onchange="setCentersFilter('city', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"><option value="all">Все города</option></select>
      </label>
      <div id="centersChips" class="flex flex-wrap items-center gap-2"></div>
      <button id="centersReset" onclick="resetCentersFilters()" class="hidden text-xs font-semibold text-brand hover:underline">Сбросить фильтры</button>
    </div>
    <div class="overflow-x-auto flex-1">
      <table class="w-full text-left text-xs edge-table min-w-[48rem]">
        <thead>
          <tr class="text-slate-400">
            <th class="font-medium">Название центра</th>
            <th class="font-medium">Тариф</th>
            <th class="font-medium" style="white-space:normal">Сотрудники / лимит</th>
            <th class="font-medium text-right" style="white-space:normal">SMS-баланс</th>
            <th class="font-medium text-right" style="white-space:normal">Баланс на платформе</th>
            <th class="font-medium">Овердрафт</th>
            <th class="font-medium">Статус</th>
            <th class="font-medium text-right">Действия</th>
          </tr>
        </thead>
        <tbody id="centersTableBody" class="divide-y divide-slate-100 text-slate-700"></tbody>
      </table>
    </div>
    <div id="centersFooter"></div>
  </div>
</main>
`,
  render: renderCenters
});

const centersState = { q: '', plan: 'all', city: 'all', chip: 'all', page: 1 };
let centersQTimer;

function setCentersFilter(key, value) {
  centersState[key] = value; centersState.page = 1;   // смена фильтра возвращает на первую страницу
  if (key === 'q') { clearTimeout(centersQTimer); centersQTimer = setTimeout(renderCenters, 250); }   // debounce поиска
  else renderCenters();
}

function centersChipsHtml() {
  const a = state.attention || { expiring: 0, churn: 0, blocked: 0, overdraft: 0 };
  return chip(centersState.chip === 'all', 'Все', "setCentersFilter('chip','all')") +
    chip(centersState.chip === 'overdraft', `В овердрафте · ${a.overdraft || 0}`, "setCentersFilter('chip','overdraft')") +
    chip(centersState.chip === 'expiring', `Истекают · ${a.expiring}`, "setCentersFilter('chip','expiring')") +
    chip(centersState.chip === 'churn', `Риск оттока · ${a.churn}`, "setCentersFilter('chip','churn')") +
    chip(centersState.chip === 'blocked', `Заблокированы · ${a.blocked}`, "setCentersFilter('chip','blocked')");
}

// Меню действий центра. Каждый пункт — отдельная задача SuperAdmin:
//  • Баланс и овердрафт — посмотреть финансы, журнал операций, изменить лимит;
//  • Пополнить баланс — зафиксировать поступление денег вне системы;
//  • Сменить тариф — выставить счёт на новый тариф (тариф сменится после оплаты);
//  • Настройка модулей — Feature Flags и лимиты центра.
function centerMenuItems(c) {
  const items = [
    { label: 'Баланс и овердрафт…', hint: 'Баланс на платформе ' + money(c.balance) + ' · лимит овердрафта ' + money(c.overdraftLimit), icon: 'wallet', run: () => openFinance(c.id) },
    { label: 'Пополнить баланс…', hint: 'Деньги уже поступили вне системы', icon: 'plus', run: () => openTopUp(c.id) },
    { label: 'Начислить пакет SMS…', hint: 'SMS-баланс ' + (c.smsBalance ? c.smsBalance.toLocaleString('ru-RU') + ' шт' : 'нет пакета'), icon: 'plus', run: () => openSmsAccrue(null, c.id) },
    { divider: true }
  ];
  if (c.status !== 'blocked') items.push({ label: 'Сменить тариф…', hint: 'Сейчас «' + c.plan + '»; смена — через счёт', icon: 'swap', run: () => openPlanChange(c.id) });
  items.push({ label: 'Настройка модулей', hint: 'Feature Flags и лимиты центра', icon: 'sliders', run: () => openDrawerById(c.id) });
  return items;
}
function centerMenu(btn, id) { const c = centerCache.get(id); if (c) openMenu(btn, centerMenuItems(c)); }

const balanceCell = c => `<div class="font-semibold tabular-nums ${c.balance < 0 ? 'text-rose-600' : 'text-slate-900'}">${money(c.balance)}</div><div class="text-[11px] text-slate-400">доступно ${money(c.available)}</div>`;
function overdraftCell(c) {
  if (!c.overdraftLimit) return '<div class="text-slate-400">не предусмотрен</div>';
  const pct = c.overdraftPct || 0, bar = pct >= 80 ? 'bg-rose-500' : 'bg-amber-500';
  if (!c.overdraftUsed) return `<div class="text-[11px] text-slate-500">лимит ${money(c.overdraftLimit)}</div><div class="text-[11px] text-slate-400">не используется</div>`;
  return `<div class="text-[11px] ${pct >= 80 ? 'text-rose-600' : 'text-amber-600'} font-semibold">использовано ${money(c.overdraftUsed)}</div><div class="text-[11px] text-slate-400">из ${money(c.overdraftLimit)}</div>
    <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5"><div class="h-full ${bar}" style="width:${Math.min(100, pct)}%"></div></div>`;
}

async function renderCenters() {
  const my = begin('centers'), body = $('centersTableBody');
  $('centersChips').innerHTML = centersChipsHtml();
  body.innerHTML = skeletonRows(8, 6);
  try {
    const [{ items, total, platformTotal, meta }] = await Promise.all([
      api.centers.list({ q: centersState.q, plan: centersState.plan, city: centersState.city, filter: centersState.chip, page: centersState.page, pageSize: PAGE_SIZE }),
      refreshAttention()
    ]);
    if (stale('centers', my)) return;
    cacheCenters(items);
    $('centersTiles').innerHTML = tile('Всего центров', platformTotal, 'на платформе') + tile('Активные подписки', meta.activeSubs, 'платные и бесплатные') + tile('Новые за месяц', '+' + meta.newMonth, 'подключено за 30 дней', 'text-emerald-600') + tile('В овердрафте', meta.overdraft, meta.overdraft ? 'баланс на платформе ушёл в минус' : 'нет центров с долгом', meta.overdraft ? 'text-rose-600' : 'text-emerald-600');
    $('centersChips').innerHTML = centersChipsHtml();
    body.innerHTML = items.length ? items.map(c => {
      const br = (c.usage || []).find(u => u.label === 'Филиалы');
      return `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-4" style="white-space:normal;min-width:11rem">
          <div class="font-semibold text-slate-900">${esc(c.name)}</div>
          <div class="text-[11px] text-slate-400">${esc(c.city)} · ${esc(c.owner)}</div>
          <div class="text-[11px] text-slate-400">Вход: ${loginLabel(c)}</div>
          ${c.pendingChange ? (c.pendingChange.deferred ? `<div class="text-[11px] mt-0.5 ${c.pendingChange.overdue ? 'text-rose-600 font-medium' : 'text-amber-600'}">оплата тарифа ${c.pendingChange.overdue ? 'просрочена' : 'ожидается до ' + fmtDay(c.pendingChange.dueAt)}</div>` : `<div class="text-[11px] text-amber-600 mt-0.5">→ ${esc(c.pendingChange.planName)} · ждёт оплаты</div>`) : ''}
        </td>
        <td class="py-4"><div class="font-medium text-slate-800">${esc(c.plan)}${c.monthlyPrice ? '' : ' <span class="text-slate-400 font-normal">(бесплатно)</span>'}</div>${br ? `<div class="text-[11px] text-slate-400 tabular-nums">Филиалы ${br.used}/${br.limit}</div>` : ''}</td>
        <td class="py-4"><div class="tabular-nums font-medium ${c.staff[0] >= c.staff[1] ? 'text-amber-600' : 'text-slate-800'}">${c.staff[0]}/${c.staff[1]}</div><div class="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5"><div class="h-full ${c.staffPct >= 100 ? 'bg-rose-500' : c.staffPct >= 80 ? 'bg-amber-500' : 'bg-brand'}" style="width:${Math.min(100, c.staffPct)}%"></div></div></td>
        <td class="py-4 text-right tabular-nums ${c.smsBalance ? 'text-slate-800' : 'text-slate-400'}">${c.smsBalance ? c.smsBalance.toLocaleString('ru-RU') + ' шт' : 'нет пакета'}</td>
        <td class="py-4 text-right">${balanceCell(c)}</td>
        <td class="py-4" style="white-space:normal">${overdraftCell(c)}${c.financeStatus !== 'ok' ? `<div class="mt-1.5">${financeBadge(c)}</div>` : ''}</td>
        <td class="py-4" style="white-space:normal;max-width:7.5rem">${centerStatus(c)}${centerStatusExtra(c)}</td>
        <td class="py-4 text-right">
          <div class="flex items-center justify-end gap-2">
            ${c.status === 'blocked' ? '' : `<button onclick="enterImpersonationById(${c.id})" title="Войти в кабинет центра (режим поддержки)" class="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark transition whitespace-nowrap">Войти</button>`}
            ${menuGear(`centerMenu(this, ${c.id})`)}
          </div>
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="8" class="py-14 text-center text-slate-400">Ничего не найдено. Измените фильтры или поиск.</td></tr>`;
    if (!items.length && total && centersState.page > 1) { centersState.page = Math.ceil(total / PAGE_SIZE); return renderCenters(); }   // страница опустела (например, после смены статуса)
    $('centersFooter').innerHTML = pagerHtml('centers', { page: centersState.page, total, note: 'всего на платформе: ' + platformTotal }, n => { centersState.page = n; renderCenters(); });
    fillCentersCities(); $('centersReset').classList.toggle('hidden', !centersFiltered());
  } catch (e) { if (!stale('centers', my)) body.innerHTML = errorRow(8, e); }
}

const centersFiltered = () => !!(centersState.q || centersState.plan !== 'all' || centersState.city !== 'all' || centersState.chip !== 'all');
function resetCentersFilters() {
  Object.assign(centersState, { q: '', plan: 'all', city: 'all', chip: 'all', page: 1 });
  const i = $('centersFilterInput'), p = $('centersPlanSelect'), c = $('centersCitySelect'); if (i) i.value = ''; if (p) p.value = 'all'; if (c) c.value = 'all';
  renderCenters();
}
function fillCentersCities() {
  const sel = $('centersCitySelect'), cities = (dict().cities || []); if (!sel) return;
  if (sel.options.length !== cities.length + 1) sel.innerHTML = '<option value="all">Все города</option>' + cities.map(c => `<option>${esc(c)}</option>`).join('');
  sel.value = centersState.city;
}
