/* Диалоги оплаты счетов (мок связи с биллингом).
   Счёт закрывается двумя путями, результат одинаков (тариф сменяется / подписка продлевается):
   1) автоматически — владелец платит онлайн, платёжный шлюз сообщает серверу (webhook). В прототипе это имитирует пункт меню «Имитировать онлайн-оплату (мок)»;
   2) вручную — SuperAdmin подтверждает, что оплата УЖЕ поступила вне системы (расчётный счёт, касса, перевод на карту).
      Основание: способ, номер документа (выписка / ордер / чек), дата и сумма поступления. Действие необратимо (как «paid out of band» в Stripe)
      и пишется в журнал аудита. Частичные оплаты не поддерживаются: сумма должна совпасть со счётом. */
const payState = { invoice: null, method: '', reference: '', receivedAmount: '', receivedOn: '', comment: '', confirmed: false, errors: {}, busy: false, back: null };

const INVOICE_EFFECT = {
  renewal: 'Подписка центра будет продлена на 30 дней.',
  plan_change: 'Тариф центра изменится сразу после подтверждения оплаты.',
  course: 'Курс будет передан центру: он появится в кабинете, раздел «Материалы и тесты».'
};
const todayStr = () => new Date().toISOString().slice(0, 10);   // сервер сверяет даты в UTC, поэтому и здесь UTC

async function openPaymentConfirm(invoiceId, { back = null } = {}) {
  Object.assign(payState, { invoice: null, method: (dict().payMethods || [])[0] ? dict().payMethods[0].method : '', reference: '', receivedAmount: '', receivedOn: todayStr(), comment: '', confirmed: false, errors: {}, busy: false, back });
  openModal(modalLoading('Подтверждение оплаты'));
  try {
    payState.invoice = await api.billing.get(invoiceId);
    payState.receivedAmount = String(payState.invoice.amount);
    renderPaymentConfirm();
  } catch (e) { setModal(modalError('Подтверждение оплаты', e)); }
}

function payField(key, value) {
  payState[key] = value;
  if (payState.errors[key]) {
    delete payState.errors[key];
    const e = $('err-pay-' + key); if (e) e.remove();
    const el = $('pay-' + key); if (el && el.classList) el.classList.replace('border-rose-400', 'border-slate-200');
  }
}

function renderPaymentConfirm() {
  const i = payState.invoice, er = payState.errors, methods = dict().payMethods || [];
  const pm = methods.find(m => m.method === payState.method) || methods[0] || { docLabel: 'Номер документа', docHint: '', evidence: '' };
  const err = k => (er[k] ? `<span id="err-pay-${k}" class="text-[11px] text-rose-600">${esc(er[k])}</span>` : '');
  const cls = k => `px-3 py-2.5 bg-white border ${er[k] ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand`;
  setModal(`
    ${modalHeader('Подтвердить поступление оплаты', esc(i.id) + ' · ' + esc(i.centerName))}
    <div class="p-6 flex flex-col gap-5">
      <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
        <div class="min-w-0">
          <div class="text-xs font-bold text-slate-900">${esc(i.purpose)}</div>
          <div class="text-[11px] text-slate-500 mt-0.5">Выставлен ${fmtDay(i.issuedAt)}${i.dueAt ? ' · срок оплаты ' + fmtDay(i.dueAt) : ''}</div>
        </div>
        <div class="text-lg font-extrabold text-slate-900 whitespace-nowrap tabular-nums">${money(i.amount)}</div>
      </div>

      <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
        <strong>Подтверждайте, только если деньги уже получены.</strong> Действие нельзя отменить, оно записывается в журнал аудита с вашим именем и основанием.
        ${INVOICE_EFFECT[i.kind] ? '<br>' + INVOICE_EFFECT[i.kind] : ''}
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[11px] font-semibold text-slate-600">Как поступила оплата <span class="text-rose-500">*</span></span>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          ${methods.map(m => {
            const on = payState.method === m.method, ch = PAY_CHANNEL_UI[m.channel] || {};
            return `<button type="button" onclick="payPickMethod('${esc(m.method)}')" class="text-left p-3 rounded-xl border transition ${on ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white hover:border-brand/50'}">
              <div class="flex items-center gap-2">${channelChip(m.channel)}<span class="text-xs font-bold text-slate-900">${esc(m.method)}</span></div>
              <div class="text-[11px] text-slate-500 mt-1.5">${esc(m.evidence)}</div>
            </button>`;
          }).join('')}
        </div>
        ${err('method')}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="flex flex-col gap-1.5 md:col-span-2">
          <span class="text-[11px] font-semibold text-slate-600">${esc(pm.docLabel)} <span class="text-rose-500">*</span></span>
          <input id="pay-reference" type="text" value="${esc(payState.reference)}" placeholder="${esc(pm.docHint)}" oninput="payField('reference', this.value)" class="${cls('reference')}">
          <span class="text-[11px] text-slate-400">Основание подтверждения: ${esc(pm.evidence.toLowerCase())}</span>
          ${err('reference')}
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-[11px] font-semibold text-slate-600">Дата поступления <span class="text-rose-500">*</span></span>
          <input id="pay-receivedOn" type="date" max="${todayStr()}" value="${esc(payState.receivedOn)}" oninput="payField('receivedOn', this.value)" class="${cls('receivedOn')}">
          ${err('receivedOn')}
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-[11px] font-semibold text-slate-600">Сумма поступления, сомони <span class="text-rose-500">*</span></span>
          <input id="pay-receivedAmount" type="number" min="0" value="${esc(payState.receivedAmount)}" oninput="payField('receivedAmount', this.value)" class="${cls('receivedAmount')} tabular-nums">
          <span class="text-[11px] text-slate-400">По счёту: ${money(i.amount)}. Должна совпадать полностью</span>
          ${err('receivedAmount')}
        </label>
        <label class="flex flex-col gap-1.5 md:col-span-2">
          <span class="text-[11px] font-semibold text-slate-600">Комментарий <span class="text-slate-400 font-normal">(необязательно)</span></span>
          <textarea id="pay-comment" rows="2" oninput="payField('comment', this.value)" placeholder="Например, оплатил бухгалтер центра" class="${cls('comment')}">${esc(payState.comment)}</textarea>
        </label>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
          <input id="pay-confirmed" type="checkbox" ${payState.confirmed ? 'checked' : ''} onchange="payField('confirmed', this.checked)" class="w-4 h-4 mt-0.5 accent-[#3C5C73]">
          <span>Я проверил(а) документ: деньги фактически поступили на ${payState.method === 'Наличные' ? 'кассу' : payState.method === 'Перевод на карту' ? 'карту' : 'расчётный счёт'}</span>
        </label>
        ${err('confirmed')}
      </div>

      <div class="flex justify-end gap-2 pt-1">
        <button onclick="payCancelDialog()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">${payState.back ? '← Назад' : 'Отмена'}</button>
        <button onclick="payConfirm()" ${payState.busy ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">${payState.busy ? 'Подтверждаем…' : 'Подтвердить оплату'}</button>
      </div>
    </div>`);
}

function payPickMethod(method) { payState.method = method; delete payState.errors.method; delete payState.errors.reference; renderPaymentConfirm(); }
function payCancelDialog() { const back = payState.back; closeModal(); if (back) back(); }

// сообщение об итоге оплаты зависит от того, что именно оплатили
function paidToast(inv) {
  if (inv.kind === 'plan_change' && inv.plan) return 'Оплата по ' + inv.id + ' получена: тариф центра «' + inv.centerName + '» изменён на «' + inv.plan.toName + '»';
  if (inv.kind === 'renewal') return 'Оплата по ' + inv.id + ' получена: подписка «' + inv.centerName + '» продлена на 30 дней';
  return 'Оплата по счёту ' + inv.id + ' подтверждена';
}

async function payFinish(inv) {
  showToast(paidToast(inv), 'success');
  closeModal();
  await refreshAttention();
  await refreshCurrentView();
  await refreshOpenInvoice();
  await refreshOpenFinance();
}

async function payConfirm() {
  if (payState.busy) return;
  payState.busy = true; renderPaymentConfirm();
  try {
    const inv = await api.billing.confirmPayment(payState.invoice.id, {
      method: payState.method, reference: payState.reference, receivedAmount: payState.receivedAmount === '' ? null : Number(payState.receivedAmount),
      receivedOn: payState.receivedOn, comment: payState.comment, confirmed: payState.confirmed
    });
    payState.busy = false;
    await payFinish(inv);
  } catch (e) {
    payState.busy = false;
    if (e instanceof ApiError && e.code === 'VALIDATION' && Object.keys(e.fields).length) {
      payState.errors = e.fields; renderPaymentConfirm();
      const order = ['reference', 'receivedOn', 'receivedAmount', 'confirmed'], k = order.find(x => e.fields[x]);
      const el = k && $('pay-' + k); if (el) el.focus();
    } else { renderPaymentConfirm(); showToast(errText(e), 'error'); if (e instanceof ApiError && e.code === 'CONFLICT') { closeModal(); refreshCurrentView(); refreshOpenInvoice(); } }
  }
}

// мок: владелец оплатил онлайн, шлюз сообщил серверу
async function payOnline(invoiceId) {
  try { const inv = await api.billing.simulateOnlinePayment(invoiceId); await payFinish(inv); return true; }
  catch (e) { showToast(errText(e), 'error'); if (e instanceof ApiError && e.code === 'CONFLICT') { closeModal(); refreshCurrentView(); refreshOpenInvoice(); } return false; }
}

/* ---------- отмена счёта ---------- */
const cancelState = { invoice: null, reason: '', error: '', busy: false, back: null };

async function openInvoiceCancel(invoiceId, { back = null } = {}) {
  Object.assign(cancelState, { invoice: null, reason: '', error: '', busy: false, back });
  openModal(modalLoading('Отмена счёта'));
  try { cancelState.invoice = await api.billing.get(invoiceId); renderInvoiceCancel(); }
  catch (e) { setModal(modalError('Отмена счёта', e)); }
}

function renderInvoiceCancel() {
  const i = cancelState.invoice;
  setModal(`
    ${modalHeader('Отмена счёта · ' + esc(i.id), esc(i.centerName))}
    <div class="p-6 flex flex-col gap-4">
      <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
        <div class="text-xs font-bold text-slate-900">${esc(i.purpose)}</div>
        <div class="text-sm font-extrabold text-slate-900 whitespace-nowrap tabular-nums">${money(i.amount)}</div>
      </div>
      ${i.deferred ? `<div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed"><strong>Тариф центра вернётся на «${esc(i.plan.fromName)}».</strong> Счёт отсрочен: тариф «${esc(i.plan.toName)}» уже действует. Откат возможен, если центр вмещается в прежний тариф.</div>` : ''}
      ${formField('cancelReason', 'Причина отмены <span class="text-rose-500">*</span>',
        `<textarea id="cancel-reason" rows="3" oninput="cancelState.reason = this.value; cancelState.error = ''; const e = $('err-cancelReason'); if (e) e.remove()" placeholder="Например, владелец передумал менять тариф" class="${inputCls(cancelState.error)}">${esc(cancelState.reason)}</textarea>`, cancelState.error)}
      <div class="flex justify-end gap-2">
        <button onclick="cancelDialogBack()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">${cancelState.back ? '← Назад' : 'Не отменять'}</button>
        <button onclick="cancelInvoiceSubmit()" ${cancelState.busy ? 'disabled' : ''} class="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition disabled:opacity-60">${cancelState.busy ? 'Отменяем…' : 'Отменить счёт'}</button>
      </div>
    </div>`);
}
function cancelDialogBack() { const back = cancelState.back; closeModal(); if (back) back(); }

async function cancelInvoiceSubmit() {
  if (cancelState.busy) return;
  if (cancelState.reason.trim().length < 5) { cancelState.error = 'Укажите причину (минимум 5 символов)'; renderInvoiceCancel(); const el = $('cancel-reason'); if (el) el.focus(); return; }
  cancelState.busy = true; renderInvoiceCancel();
  try {
    const inv = await api.billing.cancel(cancelState.invoice.id, { reason: cancelState.reason });
    cancelState.busy = false;
    showToast('Счёт ' + inv.id + ' отменён', 'info');
    closeModal(); await refreshAttention(); await refreshCurrentView(); await refreshOpenInvoice();
  } catch (e) {
    cancelState.busy = false;
    if (e instanceof ApiError && e.code === 'VALIDATION') { cancelState.error = (e.fields && e.fields.reason) || e.message; renderInvoiceCancel(); }
    else { renderInvoiceCancel(); showToast(errText(e), 'error'); }
  }
}
