/* Экран: Истекающие подписки */
registerView({
  tab: 'expiring', path: 'expiring',
  title: 'Истекающие подписки', parent: ['Требует внимания', null],
  template: `
<main id="view-expiring" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Истекающие подписки</h1>
      <p class="text-xs text-slate-500 mt-1">Центры, которым скоро нужно продление. Платные тарифы; стартовый бесплатный не истекает</p>
    </div>
    <button onclick="remindAllExpiring()" class="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95">Напомнить всем</button>
  </div>
  <div id="expTiles" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"></div>
  <div class="flex flex-wrap items-center gap-3">
    <div id="expChips" class="flex flex-wrap items-center gap-2"></div>
    <label class="flex items-center gap-2 text-xs text-slate-500">Тариф <select id="expPlan" onchange="setExpFilter('plan', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"><option value="all">Все тарифы</option></select></label>
    <label class="flex items-center gap-2 text-xs text-slate-500">Счёт <select id="expInv" onchange="setExpFilter('inv', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"><option value="all">Любой</option><option value="yes">Выставлен</option><option value="no">Не выставлен</option></select></label>
    <button id="expReset" onclick="resetExpFilters()" class="hidden text-xs font-semibold text-brand hover:underline">Сбросить фильтры</button>
  </div>
  <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden"><div class="overflow-x-auto">
    <table class="w-full text-left text-xs edge-table">
      <thead>
        <tr class="text-slate-400 border-b border-slate-100">
          <th class="font-medium pb-2.5">Центр</th>
          <th class="font-medium pb-2.5">Тариф</th>
          <th class="font-medium pb-2.5">Истекает</th>
          <th class="font-medium pb-2.5">К оплате</th>
          <th class="font-medium pb-2.5">Работа с клиентом</th>
          <th class="font-medium pb-2.5 text-right">Действия</th>
        </tr>
      </thead>
      <tbody id="expBody" class="divide-y divide-slate-100 text-slate-700"></tbody>
    </table>
  </div><div id="expFooter"></div></div>
</main>
`,
  render: renderExpiring
});

const expState = { window: 14, items: [], plan: 'all', inv: 'all', page: 1 };

function setExpWindow(w) { expState.window = w; expState.page = 1; renderExpiring(); }
function setExpFilter(k, v) { expState[k] = v; expState.page = 1; renderExpiring(); }
function resetExpFilters() { Object.assign(expState, { plan: 'all', inv: 'all', page: 1 }); renderExpiring(); }

async function renderExpiring() {
  const my = begin('expiring'), body = $('expBody');
  $('expChips').innerHTML = [7, 14, 30].map(w => chip(expState.window === w, `≤ ${w} дней`, `setExpWindow(${w})`)).join('');
  $('expTiles').innerHTML = ['Истекают в ближайшие 7 дней', 'Всего в выбранном окне', 'К получению за продления', 'Счета выставлены'].map(l => tile(l, '—', '&nbsp;')).join('');
  body.innerHTML = skeletonRows(6, 5);
  try {
    const [{ items, meta }] = await Promise.all([api.centers.expiring({ withinDays: expState.window }), refreshAttention()]);
    if (stale('expiring', my)) return;
    cacheCenters(items); expState.items = items;
    $('expTiles').innerHTML =
      tile('Истекают в ближайшие 7 дней', meta.within7, 'приоритет для менеджеров', meta.within7 ? 'text-rose-600' : 'text-slate-900') +
      tile('Всего в выбранном окне', meta.count, `окно: ${expState.window} дн.`) +
      tile('К получению за продления', money(meta.amount), 'сумма месячных тарифов') +
      tile('Счета выставлены', `${meta.invoiced} из ${meta.count}`, meta.expired ? `просрочено: ${meta.expired}` : 'просрочек нет');
    const planSel = $('expPlan');
    if (planSel.options.length === 1) planSel.innerHTML = '<option value="all">Все тарифы</option>' + [...new Set(items.map(c => c.plan))].map(p => `<option>${esc(p)}</option>`).join('');
    planSel.value = expState.plan; $('expInv').value = expState.inv;
    $('expReset').classList.toggle('hidden', expState.plan === 'all' && expState.inv === 'all');
    const filtered = items.filter(c => (expState.plan === 'all' || c.plan === expState.plan) && (expState.inv === 'all' || (expState.inv === 'yes' ? !!c.invoice : !c.invoice)));
    const pg = paginate(filtered, expState.page); expState.page = pg.page;
    $('expFooter').innerHTML = pagerHtml('expiring', { page: pg.page, total: pg.total, note: pg.total !== items.length ? 'в окне всего: ' + items.length : '' }, n => { expState.page = n; renderExpiring(); });
    body.innerHTML = pg.items.length ? pg.items.map(c => {
      const tone = c.expiresIn < 0 ? 'text-rose-600' : c.expiresIn <= 7 ? 'text-amber-600' : 'text-slate-700';
      return `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-3"><div class="font-semibold text-slate-900">${esc(c.name)}</div><div class="text-[11px] text-slate-400">${esc(c.city)} · ${esc(c.owner)}</div></td>
        <td class="py-3 text-slate-600">${c.plan}</td>
        <td class="py-3"><div class="font-semibold ${tone}">${expiryLabel(c.expiresIn)}</div><div class="text-[11px] text-slate-400">${fmtDate(c.expiresIn)}</div></td>
        <td class="py-3 text-slate-700 font-medium">${money(c.monthlyPrice)}</td>
        <td class="py-3"><div class="flex flex-wrap gap-1.5">
          ${c.reminded ? badge('indigo', 'Напоминание отправлено') : badge('slate', 'Не напоминали')}
          ${c.invoice ? `<button onclick="openInvoice('${c.invoice}')" title="Открыть счёт" class="focus:outline-none">${badge('emerald', 'Счёт ' + c.invoice)}</button>` : ''}
        </div></td>
        <td class="py-3 text-right"><div class="flex items-center justify-end gap-2">
          ${c.invoice
            ? `<button onclick="openPaymentConfirm('${c.invoice}')" class="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark transition whitespace-nowrap">Подтвердить оплату</button>`
            : `<button onclick="invoiceCenter(${c.id})" class="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark transition whitespace-nowrap">Выставить счёт</button>`}
          ${menuGear(`expMenu(this, ${c.id})`)}
        </div></td>
      </tr>`;
    }).join('') : `<tr><td colspan="6" class="py-10 text-center text-slate-400">${items.length ? 'Нет центров по выбранным фильтрам' : 'В выбранном окне нет истекающих подписок'}</td></tr>`;
  } catch (e) { if (!stale('expiring', my)) { body.innerHTML = errorRow(6, e); $('expTiles').innerHTML = ''; } }
}

async function remindCenter(id) {
  const ok = await mutate(() => api.centers.remind({ ids: [id] }), () => 'Напоминание о продлении отправлено: ' + cname(id));
  if (ok) await renderExpiring();
}
async function remindAllExpiring() {
  const ids = expState.items.filter(c => !c.reminded).map(c => c.id);
  if (!ids.length) { showToast('Всем центрам в списке уже отправлено напоминание', 'info'); return; }
  const ok = await mutate(() => api.centers.remind({ ids }), () => 'Напоминания отправлены: ' + ids.length + ' ' + plural(ids.length, ['центр', 'центра', 'центров']));
  if (ok) await renderExpiring();
}
async function invoiceCenter(id) {
  const c = await mutate(() => api.centers.invoice(id), r => 'Счёт ' + r.invoice + ' выставлен: ' + r.name + ' (' + money(r.monthlyPrice) + ')');
  if (c) await renderExpiring();
}

// Действия по строке. Главное (в строке): «Выставить счёт» → затем «Подтвердить оплату». Остальное — в меню:
//  • Напомнить — уведомление владельцу об окончании подписки; • Подробности счёта — если счёт уже выставлен;
//  • Баланс и овердрафт — чем центр может заплатить; • Сменить тариф — например, понижение вместо ухода.
function expMenuItems(c) {
  return [
    { label: 'Отправить напоминание', hint: c.reminded ? 'Уже отправлено' : 'Уведомление владельцу об окончании подписки', icon: 'bell', disabled: c.reminded, run: () => remindCenter(c.id) },
    c.invoice ? { label: 'Подробности счёта', hint: c.invoice, icon: 'open', run: () => openInvoice(c.invoice) } : null,
    { divider: true },
    { label: 'Баланс и овердрафт…', hint: 'Баланс на платформе ' + money(c.balance) + ' · доступно ' + money(c.available), icon: 'wallet', run: () => openFinance(c.id) },
    { label: 'Сменить тариф…', hint: 'Сейчас «' + c.plan + '»', icon: 'swap', run: () => openPlanChange(c.id) }
  ].filter(Boolean);
}
function expMenu(btn, id) { const c = centerCache.get(id); if (c) openMenu(btn, expMenuItems(c)); }
