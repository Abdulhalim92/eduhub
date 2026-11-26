/* Карточка счёта (боковая панель). Открывается кликом по строке реестра и из других экранов: openInvoice(id).
   Отвечает на вопросы «за что счёт», «откуда придёт или пришла оплата» и «кто и на каком основании её подтвердил»:
   - счёт ожидает оплаты → два пути: онлайн (ссылка, шлюз закроет сам) или вручную (оплата вне системы — по выписке, кассе, переводу);
   - счёт оплачен → канал, способ подтверждения (автоматически шлюзом / вручную кем и по какому документу), сумма и дата поступления;
   - история событий (выставлен → напоминание → оплата → применено). */
const invState = { id: null, inv: null };

// канал оплаты: подпись, иконка и цвет бейджа (канал приходит с сервера: online | bank | cash | card | balance)
const PAY_CHANNEL_UI = {
  online: { label: 'Онлайн-шлюз', sub: 'карта', icon: 'card', cls: 'bg-indigo-100 text-brand' },
  bank:   { label: 'Банк', sub: 'расчётный счёт', icon: 'bank', cls: 'bg-sky-100 text-sky-700' },
  cash:   { label: 'Наличные', sub: 'касса', icon: 'cash', cls: 'bg-emerald-100 text-emerald-700' },
  card:   { label: 'Перевод на карту', sub: '', icon: 'phone', cls: 'bg-violet-100 text-violet-700' },
  balance: { label: 'Баланс на платформе', sub: 'внутренний счёт', icon: 'wallet', cls: 'bg-teal-100 text-teal-700' }
};
const INVOICE_KIND = { renewal: 'Продление подписки', plan_change: 'Смена тарифа', course: 'Методика' };

// статус: «просрочен» — признак открытого счёта (как в Stripe), а не отдельный статус
function invoiceStatusBadge(i) {
  if (i.status === 'pending') return i.overdue ? badge('rose', 'Просрочен') : badge('amber', 'Ожидает оплаты');
  return ({ paid: badge('emerald', 'Оплачен'), cancelled: badge('slate', 'Отменён') })[i.status] || '';
}
const channelChip = ch => { const c = PAY_CHANNEL_UI[ch]; return c ? `<span class="inline-flex items-center justify-center w-7 h-7 rounded-lg ${c.cls} flex-shrink-0">${iconSvg(c.icon, 'w-4 h-4')}</span>` : ''; };
const dueText = i => i.daysLeft === null ? '' : i.overdue ? 'просрочен на ' + i.daysOverdue + ' ' + plural(i.daysOverdue, ['день', 'дня', 'дней']) : i.daysLeft === 0 ? 'срок — сегодня' : 'осталось ' + i.daysLeft + ' ' + plural(i.daysLeft, ['день', 'дня', 'дней']);

// Меню действий по счёту (общее для строки реестра и карточки). Каждый пункт обоснован и работает:
//  • Подробности счёта — вся история и платёжные данные (в панели не нужен);
//  • Списать с баланса на платформе — оплата внутренними средствами центра, с учётом овердрафта (доступно, только если хватает);
//  • Отправить напоминание — владелец получает уведомление о неоплаченном счёте;
//  • Скопировать ссылку на оплату — передать владельцу самому (мессенджер, звонок);
//  • Отменить счёт — только до оплаты, нужна причина (пишется в журнал).
// «Подтвердить оплату» вынесено кнопкой в строку/панель: это главное действие. Нереализованное (PDF-акты, симуляторы) в меню не показываем.
function invoiceMenuItems(inv, ctx = {}) {
  const items = [];
  if (!ctx.panel) items.push({ label: 'Подробности счёта', hint: 'История, плательщик, способы оплаты', icon: 'open', run: () => openInvoice(inv.id) });
  if (inv.status === 'pending') {
    const fb = inv.fromBalance;
    items.push({
      label: 'Списать с баланса на платформе', icon: 'wallet', disabled: !fb.possible,
      hint: fb.possible ? (fb.usesOverdraft ? 'Баланс уйдёт в минус: ' + signedMoney(fb.after) + ' (овердрафт)' : 'Баланс после списания: ' + money(fb.after)) : 'Не хватает средств: доступно ' + money(fb.available) + ' (баланс + овердрафт)',
      run: () => invPayFromBalance(inv.id)
    });
    items.push({ divider: true });
    items.push({ label: 'Отправить напоминание', hint: inv.remindedAt ? 'Последнее: ' + fmtDay(inv.remindedAt) : 'Уведомление владельцу центра', icon: 'bell', run: () => invRemind(inv.id) });
    items.push({ label: 'Скопировать ссылку на оплату', hint: 'Чтобы отправить владельцу самому', icon: 'link', run: () => invCopyLink(inv.payLink) });
    items.push({ divider: true });
    items.push({ label: 'Отменить счёт…', hint: 'Только до оплаты, нужна причина', icon: 'xcircle', danger: true, run: () => openInvoiceCancel(inv.id) });
  }
  return items;
}

async function openInvoice(id) {
  invState.id = id; invState.inv = null;
  openPanel(`${panelHeader('Счёт ' + esc(id), '')}<div class="p-6 flex flex-col gap-3">${Array.from({ length: 4 }, () => '<div class="h-16 bg-slate-100 rounded-xl animate-pulse"></div>').join('')}</div>`, 'invoice');
  await invReload();
}

async function invReload() {
  if (!invState.id) return;
  try { invState.inv = await api.billing.get(invState.id); renderInvoicePanel(); }
  catch (e) { setPanel(`${panelHeader('Счёт ' + esc(invState.id), '')}<div class="p-6">${errorBox(e)}</div>`); }
}
function refreshOpenInvoice() { return panelIsOpen() && panelKind === 'invoice' ? invReload() : undefined; }

const dl = (rows) => `<dl class="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2.5 text-xs">${rows.filter(Boolean).map(([k, v]) => `<dt class="text-slate-400">${k}</dt><dd class="text-slate-800 font-medium min-w-0 break-words">${v}</dd>`).join('')}</dl>`;
const section = (title, inner) => `<section class="flex flex-col gap-3"><h3 class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">${title}</h3>${inner}</section>`;

function invPaymentBlock(i) {
  if (i.status === 'pending') {
    const fb = i.fromBalance;
    return `<div class="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      <div class="p-4 flex gap-3">
        ${channelChip('online')}
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold text-slate-900">Онлайн — автоматически</div>
          <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Владелец центра платит картой по ссылке. Платёжный шлюз сам сообщает об оплате, счёт закрывается без участия SuperAdmin.</p>
          <div class="flex items-center gap-2 mt-2.5">
            <input readonly value="${esc(i.payLink)}" onclick="this.select()" class="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 focus:outline-none">
            <button onclick="invCopyLink('${esc(i.payLink)}')" class="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition">Копировать</button>
          </div>
          <div class="mt-2.5 flex items-center gap-2 flex-wrap">
            <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold tracking-wide">ДЕМО</span>
            <button onclick="payOnline('${i.id}')" class="px-3 py-1.5 bg-white border border-dashed border-slate-300 text-slate-500 rounded-lg text-[11px] font-medium hover:bg-slate-50 transition">Симулировать: владелец оплатил картой</button>
          </div>
        </div>
      </div>
      <div class="p-4 flex gap-3">
        ${channelChip('balance')}
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold text-slate-900">С баланса на платформе</div>
          <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Баланс на платформе <strong class="${fb.balance < 0 ? 'text-rose-600' : 'text-slate-700'}">${money(fb.balance)}</strong> · овердрафт до ${money(fb.overdraftLimit)} · доступно <strong class="text-slate-700">${money(fb.available)}</strong>.
            ${fb.possible ? (fb.usesOverdraft ? 'После списания баланс уйдёт в минус: <strong class="text-amber-700">' + signedMoney(fb.after) + '</strong> (использует овердрафт).' : 'После списания останется ' + money(fb.after) + '.') : '<span class="text-rose-600">Не хватает средств даже с учётом овердрафта.</span>'}</p>
          <button onclick="invPayFromBalance('${i.id}')" ${fb.possible ? '' : 'disabled'} class="mt-2.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed">Списать с баланса</button>
        </div>
      </div>
      <div class="p-4 flex gap-3">
        ${channelChip('bank')}
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold text-slate-900">Вручную — оплата вне системы</div>
          <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Если деньги уже поступили на расчётный счёт, в кассу или переводом на карту, подтвердите оплату по документу: банковской выписке, кассовому ордеру или чеку перевода. Действие необратимо и записывается в журнал аудита.</p>
          <button onclick="openPaymentConfirm('${i.id}')" class="mt-2.5 px-4 py-2 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">Подтвердить оплату…</button>
        </div>
      </div>
    </div>`;
  }
  if (i.status === 'paid' && i.payment) {
    const p = i.payment, ch = PAY_CHANNEL_UI[p.channel] || {}, pm = (dict().payMethods || []).find(m => m.method === p.method);
    const manual = p.via === 'manual';
    return `<div class="rounded-xl border border-slate-200 p-4 flex flex-col gap-4">
      <div class="flex items-center gap-3">${channelChip(p.channel)}<div><div class="text-xs font-bold text-slate-900">${esc(p.method)}</div><div class="text-[11px] text-slate-500">${esc(ch.label || '')}${ch.sub ? ' · ' + esc(ch.sub) : ''}</div></div></div>
      ${dl([
        ['Как подтверждена', p.via === 'balance'
          ? `Списано с баланса на платформе <span class="text-slate-400 font-normal">· инициировал ${esc(p.confirmedBy.name)}, ${esc(p.confirmedBy.role)}</span>`
          : manual ? `Вручную: ${esc(p.confirmedBy.name)} <span class="text-slate-400 font-normal">· ${esc(p.confirmedBy.role)}</span>`
          : 'Автоматически, платёжным шлюзом'],
        manual && pm ? ['Основание', esc(pm.evidence)] : null,
        [manual && pm ? esc(pm.docLabel) : p.via === 'balance' ? 'Операция по балансу' : 'Номер операции', esc(p.reference)],
        p.txId ? ['ID транзакции', `<span class="font-mono text-[11px]">${esc(p.txId)}</span>`] : null,
        p.cardMask ? ['Карта плательщика', esc(p.cardMask)] : null,
        ['Сумма поступления', money(p.receivedAmount)],
        ['Дата поступления', fmtDay(p.receivedOn + 'T12:00:00')],
        ['Зафиксировано', fmtDateTime(i.paidAt)],
        p.comment ? ['Комментарий', esc(p.comment)] : null
      ])}
    </div>`;
  }
  if (i.status === 'cancelled') return `<div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">Счёт отменён, оплата не ожидается.${i.reason ? '<div class="mt-1 text-slate-500">' + esc(i.reason) + '</div>' : ''}</div>`;
  return '';
}

const TL_DOT = { issued: 'bg-slate-400', reminded: 'bg-amber-500', deferred: 'bg-amber-500', paid: 'bg-emerald-500', applied: 'bg-emerald-500', cancelled: 'bg-rose-500' };
function invTimeline(events) {
  return `<ol class="flex flex-col">${events.map((e, idx) => `
    <li class="flex gap-3">
      <div class="flex flex-col items-center"><span class="w-2.5 h-2.5 rounded-full mt-1 ${TL_DOT[e.type] || 'bg-slate-400'}"></span>${idx < events.length - 1 ? '<span class="w-px flex-1 bg-slate-200 my-1"></span>' : ''}</div>
      <div class="pb-4 min-w-0"><div class="text-xs text-slate-800">${esc(e.text)}</div><div class="text-[11px] text-slate-400">${fmtDateTime(e.at)} · ${esc(e.actor.name)}${e.actor.role ? ', ' + esc(e.actor.role) : ''}</div></div>
    </li>`).join('')}</ol>`;
}

function renderInvoicePanel() {
  const i = invState.inv, c = i.center;
  const effect = i.status === 'pending' ? ({
    renewal: 'Подписка центра будет продлена на 30 дней.',
    plan_change: i.deferred ? 'Тариф «' + esc(i.plan.toName) + '» уже действует; после оплаты счёт будет закрыт.' : 'Тариф центра изменится: «' + esc(i.plan ? i.plan.fromName : '') + '» → «' + esc(i.plan ? i.plan.toName : '') + '».',
    course: 'Курс будет передан центру: он появится в кабинете, раздел «Материалы и тесты».'
  })[i.kind] : '';
  setPanel(`
    ${panelHeader('Счёт ' + esc(i.id), invoiceStatusBadge(i))}
    <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
      <div>
        <div class="text-3xl font-extrabold text-slate-900 tabular-nums">${money(i.amount)}</div>
        <div class="text-xs text-slate-600 mt-1">${esc(i.purpose)}</div>
      </div>
      ${section('Счёт', dl([
        ['Тип', INVOICE_KIND[i.kind] || ''],
        ['Центр', `<strong>${esc(c.name)}</strong> <span class="text-slate-400 font-normal">· ${esc(c.city)}</span>`],
        ['Плательщик', `${esc(c.owner)} <span class="text-slate-400 font-normal">· ${esc(c.phone)}</span>`],
        ['Текущий тариф', esc(c.plan)],
        ['Выставлен', fmtDateTime(i.issuedAt)],
        i.dueAt ? ['Срок оплаты', fmtDay(i.dueAt) + (i.status === 'pending' ? ` <span class="${i.overdue ? 'text-rose-600' : 'text-slate-400'} font-normal">· ${dueText(i)}</span>` : '')] : null,
        i.reason && i.status !== 'cancelled' ? ['Причина', esc(i.reason)] : null
      ]))}
      ${i.deferred && i.status === 'pending' ? `<div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed"><strong>Тариф «${esc(i.plan.toName)}» уже действует — оплата отсрочена до ${fmtDay(i.dueAt)}.</strong> Если оплата не поступит, отмените счёт: тариф вернётся на «${esc(i.plan.fromName)}».</div>` : ''}
      ${section('Оплата', invPaymentBlock(i))}
      ${effect ? section('Что произойдёт после оплаты', `<div class="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-900 leading-relaxed">${effect}</div>`) : ''}
      ${section('История', invTimeline(i.events))}
    </div>
    <div class="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-white">
      <button onclick="closePanel()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Закрыть</button>
      <div class="flex items-center gap-2">
        ${i.status === 'pending' ? `<button onclick="openPaymentConfirm('${i.id}')" class="px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">Подтвердить оплату…</button>` : ''}
        ${invoiceMenuItems(i, { panel: true }).length ? menuDropdownBtn('invPanelMenu(this)', 'Ещё') : ''}
      </div>
    </div>`);
}

function invPanelMenu(btn) { if (invState.inv) openMenu(btn, invoiceMenuItems(invState.inv, { panel: true })); }

async function invCopyLink(url) {
  try { await navigator.clipboard.writeText(url); showToast('Ссылка на оплату скопирована', 'success'); }
  catch (e) { showToast('Ссылка на оплату: ' + url, 'info'); }          // clipboard недоступен (например, file://)
}

async function invRemind(id) {
  const r = await mutate(() => api.billing.remind({ ids: [id] }), () => 'Напоминание об оплате отправлено владельцу', 'success');
  if (r) { await refreshCurrentView(); await refreshOpenInvoice(); }
}

async function invPayFromBalance(id) {
  const r = await mutate(() => api.billing.payFromBalance(id), inv => paidToast(inv));
  if (r) { await refreshAttention(); await refreshCurrentView(); await refreshOpenInvoice(); await refreshOpenFinance(); }
}
