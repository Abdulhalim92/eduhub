/* Экран кабинета центра: Баланс и счета (CTR-STL-010).
   Взаиморасчёты центра с платформой: баланс и овердрафт, открытые счета (оплата онлайн — мок шлюза), журнал операций.
   Пополняет баланс только платформа (с основанием), центр это видит в журнале. Касса и платежи учеников сюда не попадают (BR-022). */
registerView({
  tab: 'center-balance', path: 'center-balance',
  title: 'Баланс и счета', nav: { label: 'Баланс и счета', icon: 'wallet' },
  template: `
<main id="view-center-balance" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div class="max-w-2xl">
    <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Баланс и счета</h1>
    <p class="text-xs text-slate-500 mt-1">Взаиморасчёты с платформой: подписка, смена тарифа, методики и SMS-пакеты. Касса и платежи учеников здесь не показываются.</p>
  </div>
  <div id="cbBody" class="flex flex-col gap-5"></div>
</main>
`,
  render: renderCenterBalance
});

const CB_KIND = { renewal: 'Продление подписки', plan_change: 'Смена тарифа', course: 'Покупка курса' };
const CB_EFFECT = { renewal: 'Подписка будет продлена на 30 дней.', plan_change: 'Тариф сменится сразу после оплаты.', course: 'Курс будет передан центру автоматически.' };
let cbData = null;

async function renderCenterBalance() {
  const my = begin('center-balance'), body = $('cbBody');
  body.innerHTML = '<div class="h-40 bg-white border border-slate-200/80 rounded-2xl animate-pulse"></div>'.repeat(2);
  try {
    const d = await api.finance.get(selectedCenterId);
    if (stale('center-balance', my)) return;
    cbData = d; cacheCenters([d.center]);
    body.innerHTML = cbTiles(d.center) + cbInvoices(d.invoices) + cbLedger(d.ledger);
  } catch (e) { if (!stale('center-balance', my)) body.innerHTML = `<div class="bg-white border border-slate-200/80 rounded-2xl">${errorBox(e)}</div>`; }
}

function cbTiles(c) {
  const st = c.financeStatus === 'ok' ? badge('emerald', 'В порядке') : c.financeStatus === 'critical' ? badge('rose', 'Овердрафт почти исчерпан') : badge('amber', 'В овердрафте');
  return `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    ${tile('Баланс на платформе', money(c.balance), st, c.balance < 0 ? 'text-rose-600' : 'text-slate-900')}
    ${tile('Доступно к расходу', money(c.available), 'баланс плюс лимит овердрафта')}
    ${tile('Овердрафт', money(c.overdraftLimit), c.overdraftLimit ? 'использовано ' + money(c.overdraftUsed) : 'для тарифа не предусмотрен')}
    ${tile('Остаток SMS', c.smsBalance.toLocaleString('ru-RU'), 'сообщений в пакетах')}
  </div>`;
}

function cbInvoices(list) {
  const rows = list.map(i => {
    const due = i.dueAt ? (i.overdue ? badge('rose', 'Просрочен на ' + i.daysOverdue + ' ' + plural(i.daysOverdue, ['день', 'дня', 'дней'])) : badge('slate', 'Оплатить до ' + fmtDay(i.dueAt))) : '';
    return `<div class="py-3.5 flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0"><div class="text-xs font-bold text-slate-900">${esc(i.purpose)}</div><div class="text-[11px] text-slate-400 mt-0.5">${esc(i.id)} · ${esc(CB_KIND[i.kind] || 'Счёт')} · выставлен ${esc(fmtDay(i.issuedAt))}</div></div>
      <div class="flex items-center gap-4">${due}<span class="text-sm font-extrabold text-slate-900 tabular-nums">${money(i.amount)}</span>
        <button onclick="openCbPay('${esc(i.id)}')" class="px-3.5 py-2 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold transition">Оплатить онлайн</button></div>
    </div>`;
  }).join('');
  return `<section class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
    <div class="flex items-center justify-between mb-1"><h3 class="text-sm font-bold text-slate-900">Открытые счета</h3><span class="text-xs text-slate-500">${list.length}</span></div>
    ${list.length ? `<div class="divide-y divide-slate-100">${rows}</div>` : '<div class="py-8 text-center text-xs text-slate-500">Открытых счетов нет. Всё оплачено.</div>'}
    <div class="mt-3 text-[11px] text-slate-400">Баланс пополняет платформа после получения денег (расчётный счёт, касса, перевод). Оплатить счёт можно онлайн картой.</div>
  </section>`;
}

function cbLedger(list) {
  const rows = list.map(e => { const plus = e.amount > 0; return `<tr>
    <td class="py-3 text-slate-500">${esc(fmtDateTime(e.at))}</td>
    <td class="py-3 font-semibold text-slate-800">${esc(plus ? 'Пополнение' : e.reference || 'Списание')}</td>
    <td class="py-3 text-slate-600">${esc(e.method || '')}</td>
    <td class="py-3 text-right font-bold tabular-nums ${plus ? 'text-emerald-700' : 'text-slate-800'}">${plus ? '+' : ''}${money(e.amount)}</td>
    <td class="py-3 text-right text-slate-500 tabular-nums">${money(e.balanceAfter)}</td>
  </tr>`; }).join('');
  return `<section class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-100"><h3 class="text-sm font-bold text-slate-900">Журнал операций по балансу</h3><p class="text-[11px] text-slate-500 mt-0.5">Последние 15 операций</p></div>
    <div class="overflow-x-auto"><table class="w-full text-left text-xs edge-table min-w-[42rem]">
      <thead><tr class="text-slate-400"><th class="font-medium">Дата</th><th class="font-medium">Операция</th><th class="font-medium">Способ</th><th class="font-medium text-right">Сумма</th><th class="font-medium text-right">Баланс после</th></tr></thead>
      <tbody class="divide-y divide-slate-100">${rows || '<tr><td colspan="5" class="py-10 text-center text-xs text-slate-500">Операций пока нет.</td></tr>'}</tbody>
    </table></div>
  </section>`;
}

// оплата счёта: последствия показываем до подтверждения (деньги и тариф — необратимо)
function openCbPay(id) {
  const inv = cbData && cbData.invoices.find(i => i.id === id); if (!inv) return;
  openForm({
    title: 'Оплатить счёт ' + inv.id, sub: inv.purpose,
    note: 'Сумма к оплате: <strong>' + money(inv.amount) + '</strong> картой (в прототипе — имитация платёжного шлюза). ' + esc(CB_EFFECT[inv.kind] || '') + ' Операция записывается в журнал аудита и не отменяется.',
    fields: [], submitLabel: 'Оплатить ' + money(inv.amount),
    onSubmit: async () => { await api.cabinet.invoices.payOnline(selectedCenterId, id); showToast('Оплата прошла: ' + inv.purpose, 'success'); await renderRoute(); }
  });
}
