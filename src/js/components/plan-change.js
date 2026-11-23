/* Диалог «Сменить тариф центра» — единая точка смены тарифа (из «Все центры», drawer и «Центров у лимита»).
   Тариф НЕ меняется напрямую: диалог выставляет счёт на новый тариф, а сам тариф сменится после оплаты —
   автоматически (онлайн-оплата владельцем, мок) или вручную, когда SuperAdmin подтвердит поступление оплаты.
   Исключение: переход на бесплатный тариф («Старт») — платить нечего, тариф меняется сразу.
   Причина обязательна, все шаги пишутся в журнал аудита. Правила (вместимость, конфликты) проверяет сервер. */
const pcState = { centerId: null, info: null, planId: null, reason: '', payMode: 'invoice', deferConfirm: false, errors: {}, busy: false };   // payMode: 'invoice' (счёт) | 'balance' (сразу списать с баланса на платформе) | 'defer' (сменить сейчас, оплата позже)
const PC_TITLE = 'Смена тарифа';

async function openPlanChange(centerId, { planId = null, reason = '' } = {}) {
  Object.assign(pcState, { centerId, info: null, planId, reason, payMode: 'invoice', deferConfirm: false, errors: {}, busy: false });
  openModal(modalLoading(PC_TITLE));
  await pcLoad();
}

async function pcLoad() {
  try {
    const info = await api.centers.planChangeInfo(pcState.centerId);
    pcState.info = info;
    cacheCenters([info.center]);
    const opts = info.options, cur = opts.find(o => o.id === pcState.planId);
    if (!cur || !cur.fits) pcState.planId = ((opts.find(o => o.recommended) || opts.find(o => o.fits)) || {}).id || null;   // нельзя выбрать тариф, в который центр не вмещается
    const sel = opts.find(o => o.id === pcState.planId);
    if (!sel || sel.price === 0 || (pcState.payMode === 'balance' && !sel.payable)) pcState.payMode = 'invoice';   // списание доступно только если хватает баланса
    renderPlanChange();
  } catch (e) { setModal(modalError(PC_TITLE, e)); }
}

const pcSigned = d => (d > 0 ? '+' : d < 0 ? '−' : '') + money(Math.abs(d));
const pcSelected = () => (pcState.info && pcState.info.options.find(o => o.id === pcState.planId)) || null;

function pcUsageRow(u) {
  const pct = Math.min(100, u.pct), bar = u.pct >= 100 ? 'bg-rose-500' : u.pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return `<div class="flex items-center gap-3 text-[11px]">
    <span class="w-28 text-slate-600">${esc(u.label)}</span>
    <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div class="h-full ${bar}" style="width:${pct}%"></div></div>
    <span class="w-24 text-right font-semibold text-slate-700">${u.used} из ${u.limit} · ${u.pct}%</span>
  </div>`;
}

function pcOption(o) {
  const on = pcState.planId === o.id, pills = o.after.map(u => {
    const cls = u.used > u.limit ? 'bg-rose-100 text-rose-700' : u.pct >= 80 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';
    return `<span class="px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${cls}">${esc(u.label.replace(', ГБ', ''))} ${u.used}/${u.limit}</span>`;
  }).join('');
  return `<button type="button" ${o.fits ? '' : 'disabled'} onclick="pcPick('${o.id}')" class="w-full text-left p-3 rounded-xl border transition ${on ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white'} ${o.fits ? (on ? '' : 'hover:border-brand/50') : 'opacity-60 cursor-not-allowed'}">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="w-4 h-4 rounded-full border-2 flex items-center justify-center ${on ? 'border-brand' : 'border-slate-300'}">${on ? '<span class="w-2 h-2 rounded-full bg-brand"></span>' : ''}</span>
        <span class="text-xs font-bold text-slate-900">${esc(o.name)}</span>
        ${o.recommended ? badge('emerald', 'Рекомендуем') : ''}
        ${o.delta < 0 ? badge('slate', 'Понижение') : ''}
        ${o.fits ? '' : badge('rose', 'Не вмещает')}
      </div>
      <div class="text-right whitespace-nowrap"><div class="text-xs font-extrabold text-slate-900">${o.price ? money(o.price) + '/мес' : 'Бесплатно'}</div><div class="text-[11px] font-semibold ${o.delta > 0 ? 'text-emerald-600' : 'text-slate-500'}">${pcSigned(o.delta)}</div>${o.price && o.fits ? `<div class="text-[10px] mt-0.5 ${o.payable ? 'text-emerald-600' : 'text-slate-400'}">${o.payable ? 'хватает баланса' : 'баланса не хватает'}</div>` : ''}</div>
    </div>
    <div class="flex flex-wrap gap-1.5 mt-2 pl-6">${pills}</div>
    ${o.fits ? '' : `<div class="mt-2 pl-6 text-[11px] text-rose-600">Превышение: ${o.exceeded.map(u => esc(u.label.replace(', ГБ', '').toLowerCase()) + ' ' + u.used + ' > ' + u.limit).join('; ')}</div>`}
  </button>`;
}

function pcPendingBlock(inv) {
  return `<div class="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-xs font-bold text-amber-900">Счёт ${esc(inv.id)} ожидает оплаты${inv.deferred ? ' · тариф уже изменён' : ''}</div>
        <div class="text-[11px] text-amber-800 mt-0.5">${esc(inv.purpose)} · выставлен ${fmtDateTime(inv.issuedAt)}</div>
        ${inv.reason ? `<div class="text-[11px] text-amber-800/80 mt-0.5">Причина: ${esc(inv.reason)}</div>` : ''}
      </div>
      <div class="text-base font-extrabold text-amber-900 whitespace-nowrap">${money(inv.amount)}</div>
    </div>
    <div class="text-[11px] text-amber-900 leading-relaxed">${inv.deferred ? 'Тариф изменён по решению SuperAdmin до поступления оплаты. Если оплата не поступит, отмените счёт: тариф вернётся на «' + esc(inv.plan.fromName) + '».' : 'Тариф сменится после оплаты: автоматически, когда владелец оплатит онлайн, или после того, как вы подтвердите поступление оплаты вручную.'}</div>
    <div class="flex flex-wrap gap-2">
      <button onclick="pcConfirmPayment('${inv.id}')" class="px-4 py-2 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">Подтвердить оплату…</button>
      <button onclick="pcPayFromBalance('${inv.id}')" ${inv.fromBalance && inv.fromBalance.possible ? '' : 'disabled'} title="${inv.fromBalance && inv.fromBalance.possible ? 'Баланс на платформе ' + money(inv.fromBalance.balance) + ' → ' + money(inv.fromBalance.after) : 'Не хватает средств на балансе на платформе (с учётом овердрафта)'}" class="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed">Списать с баланса на платформе</button>
      <button onclick="closeModal(); openInvoice('${inv.id}')" class="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition">Открыть счёт</button>
      <button onclick="pcMockOnline('${inv.id}')" class="px-3 py-2 bg-white border border-dashed border-slate-300 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 transition">Демо: владелец оплатил онлайн</button>
      <button onclick="pcCancelInvoice('${inv.id}')" class="px-3 py-2 bg-white border border-slate-200 text-rose-600 rounded-xl text-xs font-medium hover:bg-rose-50 transition">${inv.deferred ? 'Отменить счёт и вернуть тариф' : 'Отменить счёт'}</button>
    </div>
  </div>`;
}

function pcHistory(list) {
  if (!list.length) return '';
  return `<div class="flex flex-col gap-2">
    <div class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">История</div>
    ${list.map(h => `<div class="flex items-start justify-between gap-3 text-[11px]"><span class="text-slate-700"><strong>${AUDIT_LABELS[h.action] || esc(h.action)}</strong>${h.reason ? ' · ' + esc(h.reason) : ''}</span><span class="text-slate-400 whitespace-nowrap">${fmtDateTime(h.at)}</span></div>`).join('')}
  </div>`;
}

function renderPlanChange() {
  const { center: c, options, pending, history } = pcState.info, er = pcState.errors, sel = pcSelected();
  const body = pending ? pcPendingBlock(pending) : `
      <div class="flex flex-col gap-2">
        <div class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Новый тариф</div>
        ${options.length ? options.map(pcOption).join('') : '<div class="text-xs text-slate-500">Других активных тарифов нет.</div>'}
        ${er.plan ? `<div id="err-pcPlan" class="text-[11px] text-rose-600">${esc(er.plan)}</div>` : ''}
      </div>
      ${formField('pcReason', 'Причина смены <span class="text-rose-500">*</span>',
        `<textarea id="pc-reason" rows="2" oninput="pcState.reason = this.value; pcClearError('reason')" placeholder="Например, центр упёрся в лимит филиалов" class="${inputCls(er.reason)}">${esc(pcState.reason)}</textarea>`, er.reason, 'Попадёт в журнал аудита вместе с вашим именем и временем')}
      ${sel && sel.price > 0 ? pcPayModes(c, sel) : ''}
      ${sel ? `<div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">${sel.price > 0 ? (pcState.payMode === 'defer' ? `Тариф сменится <strong>сразу</strong>, счёт на <strong>${money(sel.price)}</strong> останется открытым на 7 дней. Если оплата не поступит, отмените счёт — тариф вернётся на прежний.` : pcState.payMode === 'balance' ? `С баланса на платформе будет списано <strong>${money(sel.price)}</strong> за 1 месяц нового тарифа; тариф сменится <strong>сразу</strong>.` : `Будет выставлен счёт на <strong>${money(sel.price)}</strong> за 1 месяц нового тарифа${sel.delta < 0 ? ' (понижение: новый период оплачивается по новой цене)' : ''}. Тариф сменится <strong>после оплаты</strong>.`) : 'Тариф «' + esc(sel.name) + '» бесплатный: счёт не нужен, тариф сменится <strong>сразу</strong>. Платная подписка будет закрыта.'}</div>` : ''}
            <div class="flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Отмена</button>
        <button onclick="pcSubmit()" ${!sel || pcState.busy ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed">${pcState.busy ? 'Выполняем…' : sel ? (sel.price > 0 ? (pcState.payMode === 'defer' ? 'Сменить тариф сейчас, оплата позже' : pcState.payMode === 'balance' ? 'Сменить тариф и списать ' + money(sel.price) : 'Выставить счёт на ' + money(sel.price)) : 'Перевести на «' + esc(sel.name) + '»') : 'Выберите тариф'}</button>
      </div>`;
  setModal(`
    ${modalHeader(PC_TITLE + ' · ' + esc(c.name), esc(c.city) + ' · ' + esc(c.owner) + ' · ' + esc(c.phone))}
    <div class="p-6 flex flex-col gap-5">
      <div class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between"><div class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Сейчас</div>${badge('slate', 'Тариф «' + esc(c.plan) + '»' + (c.monthlyPrice ? ' · ' + money(c.monthlyPrice) + '/мес' : ' · бесплатно'))}</div>
        ${c.usage.map(pcUsageRow).join('')}
      </div>
      ${body}
      ${pcHistory(history)}
    </div>`);
}

// как оплатить смену: выставить счёт (оплатит владелец/подтвердит SuperAdmin), сразу списать с баланса на платформе
// или — по решению SuperAdmin — сменить сейчас, а оплату получить позже (счёт остаётся открытым, при отмене тариф возвращается)
function pcPayModes(c, sel) {
  const card = (mode, title, text, disabled) => {
    const on = pcState.payMode === mode;
    return `<button type="button" ${disabled ? 'disabled' : ''} onclick="pcSetPayMode('${mode}')" class="w-full text-left p-3 rounded-xl border transition ${on ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white'} ${disabled ? 'opacity-60 cursor-not-allowed' : (on ? '' : 'hover:border-brand/50')}">
      <div class="flex items-center gap-2"><span class="w-4 h-4 rounded-full border-2 flex items-center justify-center ${on ? 'border-brand' : 'border-slate-300'}">${on ? '<span class="w-2 h-2 rounded-full bg-brand"></span>' : ''}</span><span class="text-xs font-bold text-slate-900">${title}</span></div>
      <div class="text-[11px] text-slate-500 mt-1.5 pl-6 leading-relaxed">${text}</div></button>`;
  };
  const balText = sel.payable
    ? `Баланс ${money(c.balance)} · доступно ${money(c.available)}. После списания: <strong class="${sel.balanceAfter < 0 ? 'text-amber-700' : 'text-slate-700'}">${money(sel.balanceAfter)}</strong>${sel.balanceAfter < 0 ? ' (использует овердрафт)' : ''}.`
    : `<span class="text-rose-600">Не хватает: доступно ${money(c.available)} (баланс + овердрафт), нужно ${money(sel.price)}.</span>`;
  const defer = pcState.payMode === 'defer';
  return `<div class="flex flex-col gap-2">
    <span class="text-[11px] font-semibold text-slate-600">Как оплатить</span>
    ${card('invoice', 'Выставить счёт', 'Тариф сменится после оплаты: владелец оплатит онлайн, либо вы подтвердите оплату вручную по документу.', false)}
    ${card('balance', 'Списать с баланса на платформе', balText, !sel.payable)}
    ${card('defer', 'Сменить сейчас, оплата позже', 'Если оплата не поступила или не хватает баланса, а центру нужен тариф сразу: тариф изменится немедленно, счёт останется открытым на 7 дней. Не оплатят — отмените счёт, и тариф вернётся на прежний.', false)}
    ${defer ? `<label class="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer p-3 bg-amber-50 border border-amber-200 rounded-xl"><input type="checkbox" ${pcState.deferConfirm ? 'checked' : ''} onchange="pcState.deferConfirm = this.checked; pcClearPayError()" class="w-4 h-4 mt-0.5 accent-[#3C5C73]"><span>Понимаю, что тариф будет изменён до поступления оплаты, и беру решение на себя (запись попадёт в журнал аудита).</span></label>` : ''}
    ${pcState.errors.payment ? `<div id="err-pcPayment" class="text-[11px] text-rose-600">${esc(pcState.errors.payment)}</div>` : ''}
  </div>`;
}
function pcClearPayError() { if (pcState.errors.payment) { delete pcState.errors.payment; const e = $('err-pcPayment'); if (e) e.remove(); } }
function pcSetPayMode(mode) { pcState.payMode = mode; if (mode !== 'defer') pcState.deferConfirm = false; delete pcState.errors.payment; renderPlanChange(); }

function pcPick(id) {
  pcState.planId = id; pcState.errors = {};
  const o = pcSelected(); if (!o || o.price === 0 || (pcState.payMode === 'balance' && !o.payable)) { pcState.payMode = 'invoice'; pcState.deferConfirm = false; }
  renderPlanChange();
}
function pcClearError(key) { if (pcState.errors[key]) { delete pcState.errors[key]; const e = $('err-pcReason'); if (e) e.remove(); const t = $('pc-reason'); if (t) t.classList.replace('border-rose-400', 'border-slate-200'); } }

async function pcSubmit() {
  const sel = pcSelected();
  if (pcState.busy || !sel) return;
  if (pcState.reason.trim().length < 5) { pcState.errors = { reason: 'Укажите причину (минимум 5 символов)' }; renderPlanChange(); const t = $('pc-reason'); if (t) t.focus(); return; }
  pcState.busy = true; renderPlanChange();
  try {
    const r = await api.centers.requestPlanChange(pcState.centerId, { planId: sel.id, reason: pcState.reason, payFromBalance: pcState.payMode === 'balance' && sel.price > 0, deferPayment: pcState.payMode === 'defer' && sel.price > 0, deferConfirmed: pcState.deferConfirm });
    pcState.busy = false;
    await refreshAttention();
    if (r.mode === 'deferred') {
      showToast('Тариф «' + r.center.name + '» изменён на «' + r.center.plan + '» с отсрочкой оплаты: счёт ' + r.invoice.id + ' открыт до ' + fmtDay(r.invoice.dueAt), 'success');
      closeModal(); await refreshCurrentView();
    } else if (r.mode === 'applied' || r.mode === 'paid') {
      showToast('Центр «' + r.center.name + '» переведён на тариф «' + r.center.plan + '»' + (r.mode === 'paid' ? ': с баланса на платформе списано ' + money(r.invoice.amount) : ''), 'success');
      closeModal(); await refreshCurrentView();
    } else {
      showToast('Счёт ' + r.invoice.id + ' выставлен на ' + money(r.invoice.amount) + '. Тариф сменится после оплаты', 'success');
      await pcLoad();                  // остаёмся в окне: теперь видно счёт и действия оплаты
      refreshCurrentView();
    }
  } catch (e) {
    pcState.busy = false;
    if (e instanceof ApiError && e.code === 'VALIDATION' && Object.keys(e.fields).length) { pcState.errors = e.fields; renderPlanChange(); }
    else { showToast(errText(e), 'error'); if (e instanceof ApiError && e.code === 'CONFLICT') await pcLoad(); else renderPlanChange(); }
  }
}

const pcBack = () => openPlanChange(pcState.centerId);                  // вернуться из диалога оплаты/отмены
function pcConfirmPayment(invoiceId) { openPaymentConfirm(invoiceId, { back: pcBack }); }
function pcCancelInvoice(invoiceId) { openInvoiceCancel(invoiceId, { back: pcBack }); }
async function pcMockOnline(invoiceId) { if (!pcState.busy) await payOnline(invoiceId); }
async function pcPayFromBalance(invoiceId) {
  const r = await mutate(() => api.billing.payFromBalance(invoiceId), inv => paidToast(inv));
  if (r) { closeModal(); await refreshAttention(); await refreshCurrentView(); await refreshOpenInvoice(); await refreshOpenFinance(); }
}
