/* Экран: Главная (обзор платформы) */
registerView({
  tab: 'home', path: 'home',
  title: 'Главная', parent: null,
  template: `
<main id="view-home" class="view-panel flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Главная</h1>
      <p class="text-xs text-slate-500 mt-1">Обзор платформы: сводная аналитика по всем подключённым учебным центрам</p>
    </div>
    <button onclick="switchTab('center-new')" class="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      <span>Подключить центр</span>
    </button>
  </div>

  <!-- 4 KPI Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-brand/40 transition">
      <div class="text-xs text-slate-500 font-medium">Всего центров</div>
      <div class="text-3xl font-extrabold text-slate-900 mt-2">142</div>
      <div class="mt-2 text-xs font-medium text-emerald-600 flex items-center gap-1">
        <span>+12 за месяц</span>
      </div>
    </div>
    <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-brand/40 transition">
      <div class="text-xs text-slate-500 font-medium">Активные подписки</div>
      <div class="text-3xl font-extrabold text-slate-900 mt-2">118</div>
      <div class="mt-2 text-xs text-slate-500">83% конверсия</div>
    </div>
    <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-brand/40 transition">
      <div class="text-xs text-slate-500 font-medium">Выручка платформы</div>
      <div class="text-3xl font-extrabold text-slate-900 mt-2">48 500 сомони</div>
      <div class="mt-2 text-xs font-medium text-emerald-600 flex items-center gap-1">
        <span>+18,4% к прошл. месяцу</span>
      </div>
    </div>
    <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-brand/40 transition">
      <div class="text-xs text-slate-500 font-medium">Отправлено SMS</div>
      <div class="text-3xl font-extrabold text-slate-900 mt-2">64 200 шт</div>
      <div class="mt-2 text-xs text-slate-400">остаток в пакетах 120 000</div>
    </div>
  </div>

  <!-- Chart + Attention -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
    <!-- Chart (8 cols) -->
    <div class="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-slate-900">Динамика подключений и выручки</h3>
        <div class="flex items-center gap-4 text-xs">
          <div class="flex items-center gap-1.5 text-slate-600">
            <span class="w-3 h-3 rounded-xs bg-brand"></span>
            <span>Метрики</span>
          </div>
          <div class="flex items-center gap-1.5 text-slate-600">
            <span class="w-3.5 h-0.5 bg-slate-800"></span>
            <span>Выручка</span>
          </div>
        </div>
      </div>

      <!-- Interactive Chart -->
      <div class="h-48 w-full relative">
        <svg class="w-full h-full" viewBox="0 0 650 160" preserveAspectRatio="none">
          <line x1="40" y1="10" x2="640" y2="10" stroke="#F1F5F9" stroke-width="1"/>
          <line x1="40" y1="45" x2="640" y2="45" stroke="#F1F5F9" stroke-width="1"/>
          <line x1="40" y1="80" x2="640" y2="80" stroke="#F1F5F9" stroke-width="1"/>
          <line x1="40" y1="115" x2="640" y2="115" stroke="#F1F5F9" stroke-width="1"/>
          <line x1="40" y1="150" x2="640" y2="150" stroke="#E2E8F0" stroke-width="1"/>

          <text x="5" y="14" fill="#94A3B8" font-size="10">8 000</text>
          <text x="5" y="49" fill="#94A3B8" font-size="10">6 000</text>
          <text x="5" y="84" fill="#94A3B8" font-size="10">4 000</text>
          <text x="17" y="119" fill="#94A3B8" font-size="10">200</text>
          <text x="25" y="152" fill="#94A3B8" font-size="10">0</text>

          <rect onclick="showToast('Январь: 2 400 подключений', 'info')" class="hover:opacity-80 cursor-pointer transition" x="75" y="90" width="22" height="60" rx="4" fill="#6F93A8"/>
          <rect onclick="showToast('Февраль: 1 800 подключений', 'info')" class="hover:opacity-80 cursor-pointer transition" x="127" y="105" width="22" height="45" rx="4" fill="#6F93A8"/>
          <rect onclick="showToast('Март: 3 100 подключений', 'info')" class="hover:opacity-80 cursor-pointer transition" x="180" y="85" width="22" height="65" rx="4" fill="#6F93A8"/>
          <rect onclick="showToast('Апрель: 2 700 подключений', 'info')" class="hover:opacity-80 cursor-pointer transition" x="232" y="98" width="22" height="52" rx="4" fill="#6F93A8"/>
          <rect onclick="showToast('Май: 4 200 подключений', 'info')" class="hover:opacity-80 cursor-pointer transition" x="285" y="70" width="22" height="80" rx="4" fill="#6F93A8"/>
          <rect onclick="showToast('Июнь: 4 900 подключений', 'info')" class="hover:opacity-80 cursor-pointer transition" x="337" y="60" width="22" height="90" rx="4" fill="#6F93A8"/>
          <rect onclick="showToast('Июль: 6 100 подключений (Пик)', 'success')" class="hover:opacity-80 cursor-pointer transition" x="390" y="45" width="22" height="105" rx="4" fill="#3C5C73"/>
          <rect onclick="showToast('Август: 4 500 подключений', 'info')" class="hover:opacity-80 cursor-pointer transition" x="442" y="65" width="22" height="85" rx="4" fill="#6F93A8"/>
          <rect onclick="showToast('Сентябрь: 4 800 подключений', 'info')" class="hover:opacity-80 cursor-pointer transition" x="495" y="58" width="22" height="92" rx="4" fill="#6F93A8"/>
          <rect onclick="showToast('Октябрь: 3 900 подключений', 'info')" class="hover:opacity-80 cursor-pointer transition" x="547" y="72" width="22" height="78" rx="4" fill="#6F93A8"/>
          <rect onclick="showToast('Ноябрь: прогноз 3 200', 'info')" class="hover:opacity-80 cursor-pointer transition" x="600" y="88" width="22" height="62" rx="4" fill="#BFD2DE"/>

          <polyline fill="none" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" points="
            86,140 138,135 191,120 243,126 296,95 348,85 401,75 453,92 506,80 558,60 611,85
          "/>
        </svg>
        <div class="flex justify-between pl-12 pr-4 text-[11px] text-slate-400 mt-1 font-medium">
          <span>Янв</span><span>Фев</span><span>Мар</span><span>Апр</span><span>Май</span><span>Июн</span><span>Июл</span><span>Авг</span><span>Сен</span><span>Окт</span><span>Ноя</span>
        </div>
      </div>
    </div>

    <!-- Attention (4 cols) -->
    <div class="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-bold text-slate-900">Требует внимания</h3>
        <span id="attTotal" class="min-w-5 h-5 px-1.5 rounded-full bg-indigo-100 text-brand text-xs font-bold flex items-center justify-center"></span>
      </div>

      <div class="flex flex-col gap-3">
        <div onclick="switchTab('moderation')" class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-brand hover:bg-slate-50/80 transition group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
            </div>
            <div>
              <div class="text-xs font-bold text-slate-900 group-hover:text-brand transition">Модерация каталога</div>
              <div id="att-moderation" class="text-[11px] text-slate-500"></div>
            </div>
          </div>
          <svg class="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>

        <div onclick="switchTab('expiring')" class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-brand hover:bg-slate-50/80 transition group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-rose-100 text-rose-500 flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div>
              <div class="text-xs font-bold text-slate-900 group-hover:text-brand transition">Истекают подписки</div>
              <div id="att-expiring" class="text-[11px] text-slate-500"></div>
            </div>
          </div>
          <svg class="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>

        <div onclick="switchTab('churn')" class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-brand hover:bg-slate-50/80 transition group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <div>
              <div class="text-xs font-bold text-slate-900 group-hover:text-brand transition">Риск оттока / Churn Risk</div>
              <div id="att-churn" class="text-[11px] text-slate-500"></div>
            </div>
          </div>
          <svg class="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>

        <div onclick="switchTab('limits')" class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-brand hover:bg-slate-50/80 transition group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-indigo-100 text-brand flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            </div>
            <div>
              <div class="text-xs font-bold text-slate-900 group-hover:text-brand transition">Центры у лимита</div>
              <div id="att-limits" class="text-[11px] text-slate-500"></div>
            </div>
          </div>
          <svg class="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>
      </div>
    </div>
  </div>

  <!-- Table Activity -->
  <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
    <div class="px-6 py-4 flex items-center justify-between gap-3 border-b border-slate-100">
      <div><h3 class="text-sm font-bold text-slate-900">Активность центров</h3><p class="text-[11px] text-slate-500 mt-0.5">Обзор для мониторинга. Работа с центрами — в разделе «Все центры»</p></div>
      <button onclick="switchTab('centers')" class="text-xs font-semibold text-brand hover:underline whitespace-nowrap">Все центры →</button>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs edge-table min-w-[44rem]">
        <thead>
          <tr class="text-slate-400">
            <th class="font-medium">Центр</th>
            <th class="font-medium">Тариф</th>
            <th class="font-medium">Последний вход</th>
            <th class="font-medium">Уроков за 7 дн.</th>
            <th class="font-medium">Статус</th>
            <th class="font-medium text-right">Действия</th>
          </tr>
        </thead>
        <tbody id="homeActivityBody" class="divide-y divide-slate-100 text-slate-700"></tbody>
      </table>
    </div>
  </div>
</main>
`,
  render: renderHome
});

async function renderHome() {
  const my = begin('home'), body = $('homeActivityBody');
  body.innerHTML = skeletonRows(6, 5);
  try {
    const [{ items }] = await Promise.all([api.centers.recentActivity({ limit: 5 }), refreshAttention()]);
    if (stale('home', my)) return;
    cacheCenters(items);
    body.innerHTML = items.map(c => `
      <tr class="hover:bg-slate-50 transition cursor-pointer" onclick="openCenterInRegistry(${c.id})" title="Открыть в реестре центров">
        <td class="py-3.5"><div class="font-semibold text-slate-900">${esc(c.name)}</div><div class="text-[11px] text-slate-400">${esc(c.city)}</div></td>
        <td class="py-3.5 text-slate-600">${c.plan}</td>
        <td class="py-3.5 text-slate-600">${loginLabel(c)}</td>
        <td class="py-3.5 text-slate-600 tabular-nums">${c.lessons7d} ${plural(c.lessons7d, ['урок', 'урока', 'уроков'])}</td>
        <td class="py-3.5">${centerStatus(c)}</td>
        <td class="py-3.5 text-right">${menuGear(`homeMenu(this, ${c.id})`)}</td>
      </tr>`).join('');
  } catch (e) { if (!stale('home', my)) body.innerHTML = errorRow(6, e); }
}

// Виджет — обзор, а не рабочая таблица, поэтому главной кнопки нет: клик по строке ведёт в реестр центров, а меню даёт только быстрые переходы:
//  • Открыть в реестре — полная карточка и действия; • Войти в кабинет — диагностика от лица центра; • Баланс и овердрафт — финансы центра.
function homeMenuItems(c) {
  return [
    { label: 'Открыть в реестре центров', hint: 'Все действия по центру', icon: 'open', run: () => openCenterInRegistry(c.id) },
    c.status === 'blocked' ? null : { label: 'Войти в кабинет', hint: 'Режим поддержки', icon: 'enter', run: () => enterImpersonationById(c.id) },
    { label: 'Баланс и овердрафт…', hint: 'Баланс на платформе ' + money(c.balance), icon: 'wallet', run: () => openFinance(c.id) }
  ].filter(Boolean);
}
function homeMenu(btn, id) { const c = centerCache.get(id); if (c) openMenu(btn, homeMenuItems(c)); }
function openCenterInRegistry(id) {
  const c = centerCache.get(id); if (!c) return;
  Object.assign(centersState, { q: c.name, plan: 'all', city: 'all', chip: 'all', page: 1 });
  const inp = $('centersFilterInput'), sel = $('centersPlanSelect'); if (inp) inp.value = c.name; if (sel) sel.value = 'all';
  switchTab('centers');
}
