/* Экран: B2B-биллинг (мок). Реестр счетов центров: продления, смена тарифа, методики, триалы.
   Оформление по практикам зрелых биллингов (Stripe, Chargebee): номер и клиент слева, сумма справа, статус и срок рядом,
   «Просрочен» — признак открытого счёта, одно главное действие в строке и меню «⋯» для остальных, клик по строке открывает карточку,
   массовые действия — контекстной панелью. Источник оплаты (онлайн / банк / касса / перевод) виден в самой таблице.
   Счета на продление создаются на «Истекают подписки», на смену тарифа — в диалоге «Сменить тариф». */
registerView({
  tab: 'billing', path: 'billing',
  title: 'В2В-Биллинг и счета', parent: null,
  template: `
<main id="view-billing" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="max-w-2xl">
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">B2B-биллинг</h1>
      <p class="text-xs text-slate-500 mt-1">Счета учебным центрам: подписки, смена тарифа, методики, SMS-пакеты. Оплата приходит онлайн (подтверждает платёжный шлюз), списывается с баланса на платформе или подтверждается вручную SuperAdmin, когда деньги поступили вне системы</p>
    </div>
  </div>

  <div id="billTiles" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"></div>
  <div id="billExplainer"></div>

  <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[32rem]">
    <div class="px-6 pt-5 flex items-end justify-between gap-4 flex-wrap">
      <div><h2 class="text-sm font-bold text-slate-900">Реестр счетов</h2><p class="text-[11px] text-slate-500 mt-0.5">Все счета учебным центрам. Нажмите на строку, чтобы открыть счёт</p></div>
    </div>
    <div id="billTabs" role="tablist" class="flex items-end gap-5 px-6 pt-5 border-b border-slate-200 overflow-x-auto"></div>
    <div class="px-6 py-3 flex items-center justify-between gap-3 flex-wrap border-b border-slate-100">
      <div class="w-64 relative">
        <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="billSearch" oninput="billSet('q', this.value)" type="text" placeholder="Счёт, центр, назначение, документ…" class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-brand focus:bg-white">
      </div>
      <label class="flex items-center gap-2 text-xs text-slate-500">Тип счёта
      <select id="billKind" onchange="billSet('kind', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer">
        <option value="all">Все типы счетов</option>
        <option value="renewal">Продление подписки</option>
        <option value="plan_change">Смена тарифа</option>
        <option value="course">Методика</option>
        <option value="trial">Триал</option>
      </select></label>
    </div>
    <div id="billActive"></div>
    <div id="billBulk"></div>
    <div class="overflow-x-auto flex-1">
      <table class="w-full text-left text-xs edge-table min-w-[58rem]">
        <thead>
          <tr class="text-slate-400">
            <th class="w-10"><input id="billCheckAll" type="checkbox" onchange="billCheckAll(this.checked)" aria-label="Выбрать все счета, ожидающие оплаты, на странице" title="Выбрать все счета, ожидающие оплаты, на странице" class="w-4 h-4 accent-[#3C5C73]"></th>
            <th class="font-medium">Центр и счёт</th>
            <th class="font-medium">Назначение</th>
            <th class="font-medium text-right">Сумма</th>
            <th class="font-medium">Статус</th>
            <th class="font-medium">Оплата</th>
            <th class="font-medium text-right">Действия</th>
          </tr>
        </thead>
        <tbody id="billBody" class="divide-y divide-slate-100 text-slate-700"></tbody>
      </table>
    </div>
    <div id="billFooter" class="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 flex-wrap text-xs text-slate-500"></div>
  </div>
</main>
`,
  render: () => renderBilling()
});

const billState = { status: 'all', kind: 'all', q: '', meta: null, items: [], pageItems: [], checked: new Set(), page: 1, pageSize: 10 };
let billQTimer;

function billSet(key, value) {
  billState[key] = value;
  billState.page = 1;                                   // смена фильтра возвращает на первую страницу
  if (key === 'q') { clearTimeout(billQTimer); billQTimer = setTimeout(renderBilling, 250); }   // debounce поиска
  else renderBilling();
}

const BILL_KIND_LABEL = { renewal: 'Продление подписки', plan_change: 'Смена тарифа', course: 'Методика', trial: 'Триал' };
const BILL_STATUS_LABEL = { pending: 'Ожидают оплаты', overdue: 'Просрочены', paid: 'Оплачены', trial: 'Триалы', cancelled: 'Отменены' };
const billFiltersActive = () => billState.status !== 'all' || billState.kind !== 'all' || billState.q.trim() !== '';

// Два независимых фильтра (статус и тип) пересекаются — показываем это явно: чипы применённых фильтров и «Сбросить»
function billActiveFiltersHtml() {
  const f = [];
  if (billState.status !== 'all') f.push(['Статус: ' + BILL_STATUS_LABEL[billState.status], "billSet('status','all')"]);
  if (billState.kind !== 'all') f.push(['Тип: ' + BILL_KIND_LABEL[billState.kind], "billSet('kind','all')"]);
  if (billState.q.trim()) f.push(['Поиск: «' + billState.q.trim() + '»', 'billClearSearch()']);
  if (!f.length) return '';
  return `<div class="px-6 py-2.5 flex items-center gap-2 flex-wrap bg-slate-50/70 border-b border-slate-100 text-xs">
    <span class="text-slate-500">Применены фильтры:</span>
    ${f.map(([t, c]) => `<button onclick="${c}" title="Убрать фильтр" class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-full font-medium text-slate-700 hover:border-rose-300 hover:text-rose-600 transition">${esc(t)}<span aria-hidden="true">✕</span></button>`).join('')}
    <button onclick="billResetFilters()" class="ml-auto text-brand font-semibold hover:underline">Сбросить все фильтры</button>
  </div>`;
}
function billClearSearch() { billState.q = ''; const i = $('billSearch'); if (i) i.value = ''; billState.page = 1; renderBilling(); }
function billResetFilters() { billState.status = 'all'; billState.kind = 'all'; billState.q = ''; billState.page = 1; const i = $('billSearch'); if (i) i.value = ''; renderBilling(); }

function billTabsHtml() {
  const m = billState.meta, c = (m && m.counts) || { pending: 0, overdue: 0, paid: 0, trial: 0, cancelled: 0 };
  const tab = (key, label, count) => {
    const on = billState.status === key;
    return `<button role="tab" aria-selected="${on}" onclick="billSet('status','${key}')" class="pb-3 -mb-px border-b-2 text-xs font-semibold whitespace-nowrap transition ${on ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'}">${label}<span class="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${on ? 'bg-brand-light text-brand' : 'bg-slate-100 text-slate-500'}">${count}</span></button>`;
  };
  return tab('all', 'Все статусы', m ? m.total : 0) + tab('pending', 'Ожидают оплаты', c.pending) + tab('overdue', 'Просрочены', c.overdue) + tab('paid', 'Оплачены', c.paid) + tab('trial', 'Триалы', c.trial) + tab('cancelled', 'Отменены', c.cancelled);
}

// «Как поступает оплата» — отвечает на главный вопрос реестра: откуда деньги и кто их подтверждает
function billExplainerHtml() {
  const col = (ch, title, text, tag) => `<div class="flex gap-3">${channelChip(ch)}<div><div class="text-xs font-bold text-slate-900 flex items-center gap-2">${title}${tag}</div><p class="text-[11px] text-slate-500 mt-1 leading-relaxed">${text}</p></div></div>`;
  return `<details open class="bg-white border border-slate-200/80 rounded-2xl shadow-xs">
    <summary class="px-5 py-3.5 cursor-pointer text-xs font-bold text-slate-900 select-none list-none flex items-center justify-between">Как поступает оплата<span class="text-[11px] font-medium text-slate-400">свернуть / развернуть</span></summary>
    <div class="px-5 pb-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
      ${col('online', 'Онлайн — автоматически', 'Владелец центра платит картой по ссылке из счёта. Платёжный шлюз сам сообщает серверу об оплате, счёт закрывается без участия SuperAdmin; в реестре канал — «Онлайн-шлюз».', badge('emerald', 'авто'))}
      ${col('bank', 'Вручную — SuperAdmin', 'Деньги пришли вне системы: на расчётный счёт, в кассу или переводом на карту. SuperAdmin подтверждает оплату по документу (выписка, кассовый ордер, чек), указывает дату и сумму. Действие необратимо и пишется в журнал аудита.', badge('amber', 'по документу'))}
    </div>
  </details>`;
}

const billChannelCell = i => {
  if (i.status === 'pending') { const fb = i.fromBalance; return `<div class="text-slate-500">Ожидается</div><div class="text-[11px] ${i.overdue ? 'text-rose-600 font-medium' : 'text-slate-400'}">${i.dueAt ? 'срок до ' + fmtDay(i.dueAt) : ''}</div><div class="text-[11px] mt-0.5 ${fb.possible ? 'text-emerald-600' : 'text-slate-400'}">Баланс на платформе ${money(fb.balance)} · ${fb.possible ? 'хватает' : 'не хватает'}</div>`; }
  if (i.status === 'paid' && i.payment) {
    const p = i.payment, ch = PAY_CHANNEL_UI[p.channel] || {};
    return `<div class="flex items-center gap-2.5">${channelChip(p.channel)}<div class="min-w-0">
      <div class="font-medium text-slate-800">${esc(ch.label || p.method)}${ch.sub ? ` <span class="text-slate-400 font-normal">· ${esc(ch.sub)}</span>` : ''}</div>
      <div class="text-[11px] text-slate-400">${esc(p.reference)} · ${p.via === 'online' ? 'автоматически' : p.via === 'balance' ? 'списано с баланса на платформе' : 'вручную: ' + esc(p.confirmedBy.name)}</div></div></div>`;
  }
  if (i.status === 'trial') return `<div class="flex items-center gap-2.5">${channelChip('promo')}<div><div class="font-medium text-slate-800">${esc(i.method)}</div><div class="text-[11px] text-slate-400">оплата не требуется</div></div></div>`;
  return '<span class="text-slate-300">—</span>';
};

const billStatusCell = i => {
  const sub = i.status === 'pending' ? `<div class="text-[11px] mt-1 ${i.overdue ? 'text-rose-600 font-medium' : 'text-slate-400'}">${dueText(i)}</div>${i.deferred ? '<div class="text-[11px] mt-0.5 text-amber-600">тариф уже изменён</div>' : ''}`
    : i.status === 'paid' ? `<div class="text-[11px] mt-1 text-slate-400">${fmtDay(i.paidAt)}</div>` : '';
  return invoiceStatusBadge(i) + sub;
};

async function renderBilling() {
  const my = begin('billing'), body = $('billBody');
  if (!$('billExplainer').innerHTML) $('billExplainer').innerHTML = billExplainerHtml();
  $('billTabs').innerHTML = billTabsHtml();
  $('billTiles').innerHTML = ['Оплачено за 30 дней', 'Ожидают оплаты', 'Просрочено', 'Активные триалы'].map(l => tile(l, '—', '&nbsp;')).join('');
  body.innerHTML = skeletonRows(7, 4);
  try {
    const [{ items, meta }] = await Promise.all([api.billing.list({ status: billState.status, kind: billState.kind, q: billState.q }), refreshAttention()]);
    if (stale('billing', my)) return;
    billState.meta = meta; billState.items = items;
    const pages = Math.max(1, Math.ceil(items.length / billState.pageSize));
    billState.page = Math.min(billState.page, pages);
    const from = (billState.page - 1) * billState.pageSize, pageItems = items.slice(from, from + billState.pageSize);
    billState.pageItems = pageItems;
    const ids = new Set(pageItems.filter(i => i.status === 'pending').map(i => i.id));
    billState.checked = new Set([...billState.checked].filter(id => ids.has(id)));    // отметки живут только для видимых ожидающих счетов
    const kindSel = $('billKind'); if (kindSel && kindSel.value !== billState.kind) kindSel.value = billState.kind;
    const sInp = $('billSearch'); if (sInp && sInp.value !== billState.q) sInp.value = billState.q;
    $('billTabs').innerHTML = billTabsHtml();
    $('billActive').innerHTML = billActiveFiltersHtml();
    $('billTiles').innerHTML =
      tile('Оплачено за 30 дней', money(meta.paid30), 'по подтверждённым счетам', 'text-emerald-600') +
      tile('Ожидают оплаты', money(meta.pendingSum), meta.pendingCount + ' ' + plural(meta.pendingCount, ['счёт', 'счёта', 'счетов']), meta.pendingCount ? 'text-amber-600' : 'text-slate-900') +
      tile('Просрочено', money(meta.overdueSum), meta.overdueCount ? meta.overdueCount + ' ' + plural(meta.overdueCount, ['счёт', 'счёта', 'счетов']) + ' — стоит напомнить' : 'просрочек нет', meta.overdueCount ? 'text-rose-600' : 'text-slate-900') +
      tile('Активные триалы', meta.trials + ' ' + plural(meta.trials, ['центр', 'центра', 'центров']), 'промокоды и промо-периоды');
    billRenderBulk(); billRenderFooter(items.length, from, pageItems.length, pages, meta.allTotal);
    body.innerHTML = pageItems.length ? pageItems.map(i => `
      <tr onclick="openInvoice('${i.id}')" class="hover:bg-slate-50 transition cursor-pointer">
        <td class="py-4" onclick="billCellClick(event, '${i.id}')" style="cursor:${i.status === 'pending' ? 'pointer' : 'default'}">
          <input type="checkbox" ${billState.checked.has(i.id) ? 'checked' : ''} ${i.status === 'pending' ? '' : 'disabled'} onclick="event.stopPropagation()" onchange="billCheck('${i.id}', this.checked)" aria-label="Выбрать счёт ${i.id}" title="${i.status === 'pending' ? 'Выбрать счёт' : 'Выбрать можно только счета, ожидающие оплаты'}" class="w-4 h-4 accent-[#3C5C73] ${i.status === 'pending' ? '' : 'opacity-40 cursor-not-allowed'}">
        </td>
        <td class="py-4" style="white-space:normal;min-width:9rem"><div class="font-semibold text-slate-900">${esc(i.centerName)}</div><div class="text-[11px] text-slate-400"><span class="font-medium text-slate-500">${esc(i.id)}</span> · ${esc(i.center.city)}</div></td>
        <td class="py-4" style="white-space:normal;min-width:10rem"><div class="text-slate-800">${esc(i.purpose)}</div><div class="text-[11px] text-slate-400 mt-0.5">${INVOICE_KIND[i.kind] || ''} · выставлен ${fmtDay(i.issuedAt)}${i.kind === 'plan_change' && i.reason ? ' · ' + esc(i.reason) : ''}</div></td>
        <td class="py-4 text-right font-semibold text-slate-900 tabular-nums">${money(i.amount)}</td>
        <td class="py-4">${billStatusCell(i)}</td>
        <td class="py-4" style="white-space:normal;min-width:10rem">${billChannelCell(i)}</td>
        <td class="py-4 text-right"><div class="flex items-center justify-end gap-1.5">
          ${i.status === 'pending' ? `<button onclick="event.stopPropagation(); openPaymentConfirm('${i.id}')" class="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark transition whitespace-nowrap">Подтвердить оплату</button>` : ''}
          ${menuGear(`billMenu(this, '${i.id}')`)}
        </div></td>
      </tr>`).join('') : `<tr><td colspan="7" class="py-14 text-center"><div class="text-slate-500 text-xs">${billFiltersActive() ? 'Нет счетов, подходящих под выбранные фильтры' : 'Счетов пока нет'}</div>${billFiltersActive() ? '<button onclick="billResetFilters()" class="mt-3 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Сбросить все фильтры</button>' : ''}</td></tr>`;
  } catch (e) { if (!stale('billing', my)) { body.innerHTML = errorRow(7, e); $('billTiles').innerHTML = ''; } }
}

/* ---------- подвал таблицы: счётчик и пагинация ---------- */
function billRenderFooter(total, from, shown, pages, allTotal) {
  const pager = (label, delta, disabled, aria) => `<button onclick="billPage(${delta})" ${disabled ? 'disabled' : ''} aria-label="${aria}" class="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed">${label}</button>`;
  $('billFooter').innerHTML = `
    <span>${total ? `Показано <strong class="text-slate-700">${from + 1}–${from + shown}</strong> из <strong class="text-slate-700">${total}</strong>${billFiltersActive() && allTotal !== total ? ` <span class="text-slate-400">(всего счетов: ${allTotal})</span>` : ''}` : 'Нет счетов'}</span>
    <div class="flex items-center gap-4">
      <label class="flex items-center gap-2">Строк на странице
        <select onchange="billPageSize(Number(this.value))" class="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none cursor-pointer">${[5, 10, 25, 50].map(n => `<option ${n === billState.pageSize ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      <div class="flex items-center gap-2">
        ${pager('←', -1, billState.page <= 1, 'Предыдущая страница')}
        <span class="px-1 tabular-nums">Стр. ${billState.page} из ${pages}</span>
        ${pager('→', 1, billState.page >= pages, 'Следующая страница')}
      </div>
    </div>`;
}
function billPage(delta) { billState.page += delta; renderBilling(); }
function billPageSize(n) { billState.pageSize = n; billState.page = 1; renderBilling(); }

/* ---------- действия ---------- */
function billMenu(btn, id) {
  const inv = billState.items.find(i => i.id === id);
  if (inv) openMenu(btn, invoiceMenuItems(inv));
}

function billRenderBulk() {
  const n = billState.checked.size, pendingIds = billState.pageItems.filter(i => i.status === 'pending').map(i => i.id);
  const all = $('billCheckAll'); if (all) { all.checked = pendingIds.length > 0 && n === pendingIds.length; all.indeterminate = n > 0 && n < pendingIds.length; all.disabled = !pendingIds.length; }
  $('billBulk').innerHTML = n ? `
    <div class="px-6 py-2.5 bg-brand-light/60 border-b border-indigo-100 flex items-center justify-between gap-3 flex-wrap">
      <span class="text-xs text-slate-700">Выбрано счетов: <strong>${n}</strong></span>
      <div class="flex items-center gap-2">
        <button onclick="billBulkRemind()" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition">${iconSvg('bell', 'w-3.5 h-3.5')}Отправить напоминание</button>
        <button onclick="billCheckAll(false)" class="px-3 py-1.5 text-slate-500 rounded-lg text-xs font-medium hover:bg-white/70 transition">Снять выбор</button>
      </div>
    </div>` : '';
}
// клик по ячейке вокруг галочки переключает её (и не открывает карточку счёта); у неоплачиваемых счетов ничего не происходит
function billCellClick(ev, id) {
  ev.stopPropagation();
  if (ev.target && ev.target.tagName === 'INPUT') return;
  const inv = billState.items.find(i => i.id === id);
  if (inv && inv.status === 'pending') billCheck(id, !billState.checked.has(id));
}
function billCheck(id, on) { if (on) billState.checked.add(id); else billState.checked.delete(id); billRenderBulk(); renderBillRowsChecked(); }
function billCheckAll(on) { billState.checked = on ? new Set(billState.pageItems.filter(i => i.status === 'pending').map(i => i.id)) : new Set(); billRenderBulk(); renderBillRowsChecked(); }
// отметки в строках обновляем точечно, без перезапроса данных
function renderBillRowsChecked() { document.querySelectorAll('#billBody input[type="checkbox"]').forEach(cb => { const m = /billCheck\('([^']+)'/.exec(cb.getAttribute('onchange') || ''); if (m) cb.checked = billState.checked.has(m[1]); }); }

async function billBulkRemind() {
  const ids = [...billState.checked];
  if (!ids.length) return;
  const r = await mutate(() => api.billing.remind({ ids }), res => 'Напоминаний отправлено: ' + res.sent + (res.skipped ? ' (пропущено: ' + res.skipped + ')' : ''));
  if (r) { billState.checked.clear(); await renderBilling(); }
}
