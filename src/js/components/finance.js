/* Финансы центра: баланс и овердрафт (боковая панель + диалоги пополнения и лимита).
   Баланс на платформе — предоплаченные средства центра: с него можно оплатить счёт (подписка, смена тарифа, методики, SMS).
   Овердрафт — лимит, на который баланс может уйти в минус: счёт оплачивается, даже если средств не хватает; долг гасится пополнением.
   Доступно к расходу = баланс + лимит овердрафта. Лимит нельзя опустить ниже уже использованного овердрафта.
   Пополнение — деньги УЖЕ поступили вне системы (р/с, касса, перевод на карту); основания те же, что при подтверждении оплаты счёта.
   Все операции пишутся в журнал операций центра и в журнал аудита; правила проверяет сервер (api.finance.*, api.billing.payFromBalance). */
const finState = { id: null, data: null };

async function openFinance(centerId) {
  finState.id = centerId; finState.data = null;
  openPanel(`${panelHeader('Финансы центра', '')}<div class="p-6 flex flex-col gap-3">${Array.from({ length: 4 }, () => '<div class="h-16 bg-slate-100 rounded-xl animate-pulse"></div>').join('')}</div>`, 'finance');
  await finReload();
}
async function finReload() {
  if (!finState.id) return;
  try { finState.data = await api.finance.get(finState.id); cacheCenters([finState.data.center]); renderFinance(); }
  catch (e) { setPanel(`${panelHeader('Финансы центра', '')}<div class="p-6">${errorBox(e)}</div>`); }
}
const refreshOpenFinance = () => (panelIsOpen() && panelKind === 'finance' ? finReload() : undefined);

const LEDGER_TYPE = { topup: ['Пополнение', 'text-emerald-700'], charge: ['Списание', 'text-slate-700'] };
const signedMoney = n => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));

// статус овердрафта центра: бейдж для таблиц и панели
function financeBadge(c) {
  if (c.financeStatus === 'critical') return badge('rose', 'Овердрафт почти исчерпан');
  if (c.financeStatus === 'overdraft') return badge('amber', 'В овердрафте');
  return '';
}

function renderFinance() {
  const { center: c, ledger, invoices } = finState.data;
  const used = c.overdraftUsed, pct = c.overdraftPct, barCls = pct >= 80 ? 'bg-rose-500' : 'bg-amber-500';
  setPanel(`
    ${panelHeader('Финансы центра', '')}
    <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
      <div>
        <div class="text-sm font-extrabold text-slate-900">${esc(c.name)}</div>
        <div class="text-[11px] text-slate-500 mt-0.5">${esc(c.city)} · ${esc(c.owner)} · тариф «${esc(c.plan)}» ${c.status === 'blocked' ? '· ' + badge('rose', 'Заблокирован') : ''}</div>
      </div>

      <div class="rounded-2xl border border-slate-200 p-5 flex flex-col gap-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Баланс на платформе</div>
            <div class="text-3xl font-extrabold tabular-nums mt-1 ${c.balance < 0 ? 'text-rose-600' : 'text-slate-900'}">${signedMoney(c.balance).replace('+', '')}</div>
            <div class="mt-2">${financeBadge(c) || badge('emerald', 'Баланс положительный')}</div>
          </div>
          <div class="text-right">
            <div class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Доступно к расходу</div>
            <div class="text-xl font-extrabold tabular-nums text-slate-900 mt-1">${money(c.available)}</div>
            <div class="text-[11px] text-slate-400 mt-1">баланс + лимит овердрафта</div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="font-medium text-slate-700">Овердрафт</span>
            <span class="font-semibold tabular-nums ${used ? (pct >= 80 ? 'text-rose-600' : 'text-amber-600') : 'text-slate-500'}">${c.overdraftLimit ? `использовано ${money(used)} из ${money(c.overdraftLimit)}${pct !== null ? ' · ' + pct + '%' : ''}` : 'не предусмотрен'}</span>
          </div>
          <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden"><div class="h-full ${barCls}" style="width:${c.overdraftLimit ? Math.min(100, pct) : 0}%"></div></div>
          ${c.overdraftLimit ? '' : '<div class="text-[11px] text-slate-400 mt-1.5">Центр не может уйти в минус: счета оплачиваются только в пределах баланса.</div>'}
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="openTopUp(${c.id})" class="px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">Пополнить баланс…</button>
          <button onclick="openOverdraft(${c.id})" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Изменить лимит овердрафта…</button>
        </div>
      </div>

      <details class="rounded-xl border border-slate-200 bg-slate-50/60">
        <summary class="px-4 py-3 text-xs font-semibold text-slate-700 cursor-pointer select-none">Как работают баланс и овердрафт</summary>
        <div class="px-4 pb-4 text-[11px] text-slate-500 leading-relaxed flex flex-col gap-1.5">
          <p><strong class="text-slate-700">Баланс на платформе</strong> — предоплаченные средства центра. С него списываются счета: подписка, смена тарифа, методики, SMS-пакеты.</p>
          <p><strong class="text-slate-700">Овердрафт</strong> — «кредитная линия»: на сколько баланс может уйти в минус. Если средств не хватает, счёт всё равно оплачивается, а центр остаётся должен платформе.</p>
          <p>Долг гасится пополнением баланса. Лимит овердрафта задаёт SuperAdmin; нельзя поставить лимит ниже уже использованной суммы.</p>
        </div>
      </details>

      ${invoices.length ? `<section class="flex flex-col gap-3">
        <h3 class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Открытые счета</h3>
        ${invoices.map(i => `<div class="rounded-xl border ${i.overdue ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200'} p-3 flex items-center justify-between gap-3">
          <div class="min-w-0"><div class="text-xs font-bold text-slate-900 truncate">${esc(i.purpose)}</div><div class="text-[11px] ${i.overdue ? 'text-rose-600 font-medium' : 'text-slate-400'}">${esc(i.id)} · ${dueText(i) || 'без срока'}</div></div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="text-xs font-extrabold tabular-nums text-slate-900">${money(i.amount)}</span>
            <button onclick="finPayFromBalance('${i.id}')" ${i.fromBalance.possible ? '' : 'disabled'} title="${i.fromBalance.possible ? (i.fromBalance.usesOverdraft ? 'Баланс уйдёт в минус: ' + signedMoney(i.fromBalance.after) : 'После списания: ' + money(i.fromBalance.after)) : 'Недостаточно средств (с учётом овердрафта)'}" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed">Списать с баланса</button>
          </div>
        </div>`).join('')}
      </section>` : ''}

      <section class="flex flex-col gap-3">
        <h3 class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Журнал операций</h3>
        <div class="rounded-xl border border-slate-200 overflow-hidden">
          <table class="w-full text-left text-[11px]">
            <thead><tr class="bg-slate-50 text-slate-400"><th class="font-medium px-3 py-2">Дата</th><th class="font-medium px-3 py-2">Операция</th><th class="font-medium px-3 py-2 text-right">Сумма</th><th class="font-medium px-3 py-2 text-right">Баланс после</th></tr></thead>
            <tbody class="divide-y divide-slate-100">${ledger.map(e => `<tr>
              <td class="px-3 py-2 text-slate-500 whitespace-nowrap">${fmtDay(e.at)}</td>
              <td class="px-3 py-2" style="white-space:normal"><div class="font-medium ${LEDGER_TYPE[e.type][1]}">${LEDGER_TYPE[e.type][0]}</div><div class="text-slate-400">${esc(e.method)}${e.reference ? ' · ' + esc(e.reference) : ''}</div></td>
              <td class="px-3 py-2 text-right font-semibold tabular-nums ${e.amount > 0 ? 'text-emerald-600' : 'text-slate-700'}">${signedMoney(e.amount)}</td>
              <td class="px-3 py-2 text-right tabular-nums ${e.balanceAfter < 0 ? 'text-rose-600' : 'text-slate-600'}">${money(e.balanceAfter)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </section>
    </div>
    <div class="flex items-center justify-end px-6 py-4 border-t border-slate-100 flex-shrink-0"><button onclick="closePanel()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Закрыть</button></div>`);
}

async function finPayFromBalance(invoiceId) {
  const r = await mutate(() => api.billing.payFromBalance(invoiceId), inv => paidToast(inv));
  if (r) { await refreshAttention(); await finReload(); refreshCurrentView(); }
}

/* ---------- пополнение баланса ---------- */
const topState = { center: null, method: '', reference: '', receivedAmount: '', receivedOn: '', comment: '', confirmed: false, errors: {}, busy: false };

async function openTopUp(centerId) {
  const c = centerCache.get(centerId) || (finState.data && finState.data.center);
  if (!c) return;
  Object.assign(topState, { center: c, method: (dict().payMethods || [])[0] ? dict().payMethods[0].method : '', reference: '', receivedAmount: '', receivedOn: todayStr(), comment: '', confirmed: false, errors: {}, busy: false });
  openModal('');
  renderTopUp();
}

function topField(key, value) {
  topState[key] = value;
  if (topState.errors[key]) { delete topState.errors[key]; const e = $('err-top-' + key); if (e) e.remove(); const el = $('top-' + key); if (el && el.classList) el.classList.replace('border-rose-400', 'border-slate-200'); }
  if (key === 'receivedAmount') { const p = $('topPreview'); if (p) p.innerHTML = topPreviewHtml(); }
}
function topPreviewHtml() {
  const c = topState.center, n = Number(topState.receivedAmount);
  if (!Number.isInteger(n) || n < 1) return 'Введите сумму, чтобы увидеть баланс после пополнения.';
  const after = c.balance + n, repaid = Math.min(n, c.overdraftUsed);
  return `Баланс на платформе: <strong>${money(c.balance)}</strong> → <strong class="${after < 0 ? 'text-rose-600' : 'text-emerald-700'}">${money(after)}</strong>${repaid ? `. Из них ${money(repaid)} погасят использованный овердрафт.` : ''}`;
}
function topPickMethod(method) { topState.method = method; delete topState.errors.method; delete topState.errors.reference; renderTopUp(); }

function renderTopUp() {
  const c = topState.center, er = topState.errors, methods = dict().payMethods || [];
  const pm = methods.find(m => m.method === topState.method) || methods[0] || { docLabel: 'Номер документа', docHint: '', evidence: '' };
  const err = k => (er[k] ? `<span id="err-top-${k}" class="text-[11px] text-rose-600">${esc(er[k])}</span>` : '');
  const cls = k => `px-3 py-2.5 bg-white border ${er[k] ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand`;
  const html = `
    ${modalHeader('Пополнить баланс на платформе', esc(c.name))}
    <div class="p-6 flex flex-col gap-5">
      <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed"><strong>Пополняйте, только если деньги уже поступили.</strong> Операция записывается в журнал баланса и журнал аудита с вашим именем и основанием.</div>
      <div class="flex flex-col gap-2">
        <span class="text-[11px] font-semibold text-slate-600">Как поступили деньги <span class="text-rose-500">*</span></span>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">${methods.map(m => {
          const on = topState.method === m.method;
          return `<button type="button" onclick="topPickMethod('${esc(m.method)}')" class="text-left p-3 rounded-xl border transition ${on ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white hover:border-brand/50'}"><div class="flex items-center gap-2">${channelChip(m.channel)}<span class="text-xs font-bold text-slate-900">${esc(m.method)}</span></div><div class="text-[11px] text-slate-500 mt-1.5">${esc(m.evidence)}</div></button>`;
        }).join('')}</div>
        ${err('method')}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="flex flex-col gap-1.5 md:col-span-2"><span class="text-[11px] font-semibold text-slate-600">${esc(pm.docLabel)} <span class="text-rose-500">*</span></span>
          <input id="top-reference" type="text" value="${esc(topState.reference)}" placeholder="${esc(pm.docHint)}" oninput="topField('reference', this.value)" class="${cls('reference')}">${err('reference')}</label>
        <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Дата поступления <span class="text-rose-500">*</span></span>
          <input id="top-receivedOn" type="date" max="${todayStr()}" value="${esc(topState.receivedOn)}" oninput="topField('receivedOn', this.value)" class="${cls('receivedOn')}">${err('receivedOn')}</label>
        <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Сумма, сомони <span class="text-rose-500">*</span></span>
          <input id="top-receivedAmount" type="number" min="1" value="${esc(topState.receivedAmount)}" placeholder="500" oninput="topField('receivedAmount', this.value)" class="${cls('receivedAmount')} tabular-nums">${err('receivedAmount')}</label>
        <label class="flex flex-col gap-1.5 md:col-span-2"><span class="text-[11px] font-semibold text-slate-600">Комментарий <span class="text-slate-400 font-normal">(необязательно)</span></span>
          <textarea id="top-comment" rows="2" oninput="topField('comment', this.value)" class="${cls('comment')}">${esc(topState.comment)}</textarea></label>
      </div>
      <div id="topPreview" class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">${topPreviewHtml()}</div>
      <div class="flex flex-col gap-1.5">
        <label class="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer"><input id="top-confirmed" type="checkbox" ${topState.confirmed ? 'checked' : ''} onchange="topField('confirmed', this.checked)" class="w-4 h-4 mt-0.5 accent-[#3C5C73]"><span>Я проверил(а) документ: деньги фактически поступили</span></label>
        ${err('confirmed')}
      </div>
      <div class="flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Отмена</button>
        <button onclick="topSubmit()" ${topState.busy ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">${topState.busy ? 'Пополняем…' : 'Пополнить баланс'}</button>
      </div>
    </div>`;
  if ($('modalBox')) $('modalBox').innerHTML = html;
}

async function topSubmit() {
  if (topState.busy) return;
  topState.busy = true; renderTopUp();
  try {
    const c = await api.finance.topUp(topState.center.id, { method: topState.method, reference: topState.reference, receivedAmount: topState.receivedAmount === '' ? null : Number(topState.receivedAmount), receivedOn: topState.receivedOn, comment: topState.comment, confirmed: topState.confirmed });
    topState.busy = false;
    showToast('Баланс на платформе «' + c.name + '» пополнен: ' + money(c.balance), 'success');
    closeModal(); await refreshAttention(); await refreshCurrentView(); await refreshOpenFinance();
  } catch (e) {
    topState.busy = false;
    if (e instanceof ApiError && e.code === 'VALIDATION' && Object.keys(e.fields).length) {
      topState.errors = e.fields; renderTopUp();
      const k = ['reference', 'receivedOn', 'receivedAmount', 'confirmed'].find(x => e.fields[x]); const el = k && $('top-' + k); if (el) el.focus();
    } else { renderTopUp(); showToast(errText(e), 'error'); }
  }
}

/* ---------- лимит овердрафта ---------- */
const odState = { center: null, limit: '', reason: '', errors: {}, busy: false };
const OD_PRESETS = [0, 300, 500, 1000, 2000, 5000];

function openOverdraft(centerId) {
  const c = centerCache.get(centerId) || (finState.data && finState.data.center);
  if (!c) return;
  Object.assign(odState, { center: c, limit: String(c.overdraftLimit), reason: '', errors: {}, busy: false });
  openModal(modalLoading('Лимит овердрафта'));
  renderOverdraft();
}
function odField(key, value) {
  odState[key] = value;
  if (odState.errors[key]) { delete odState.errors[key]; const e = $('err-od-' + key); if (e) e.remove(); const el = $('od-' + key); if (el && el.classList) el.classList.replace('border-rose-400', 'border-slate-200'); }
  if (key === 'limit') { const p = $('odPreview'); if (p) p.innerHTML = odPreviewHtml(); }
}
function odPick(n) { odState.limit = String(n); delete odState.errors.limit; renderOverdraft(); }
function odPreviewHtml() {
  const c = odState.center, n = Number(odState.limit);
  if (odState.limit === '' || !Number.isInteger(n) || n < 0) return 'Введите лимит — целое число сомони.';
  const avail = c.balance + n, diff = n - c.overdraftLimit;
  return `Доступно к расходу: <strong>${money(c.available)}</strong> → <strong>${money(avail)}</strong>${diff ? ` (${diff > 0 ? 'лимит вырастет' : 'лимит снизится'} на ${money(Math.abs(diff))})` : ' — лимит не меняется'}.`;
}
function renderOverdraft() {
  const c = odState.center, er = odState.errors;
  const err = k => (er[k] ? `<span id="err-od-${k}" class="text-[11px] text-rose-600">${esc(er[k])}</span>` : '');
  const cls = k => `px-3 py-2.5 bg-white border ${er[k] ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand`;
  $('modalBox').innerHTML = `
    ${modalHeader('Лимит овердрафта', esc(c.name))}
    <div class="p-6 flex flex-col gap-5">
      <div class="grid grid-cols-3 gap-3 text-center">
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl"><div class="text-[11px] text-slate-500">Баланс на платформе</div><div class="text-sm font-extrabold tabular-nums ${c.balance < 0 ? 'text-rose-600' : 'text-slate-900'}">${money(c.balance)}</div></div>
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl"><div class="text-[11px] text-slate-500">Текущий лимит</div><div class="text-sm font-extrabold tabular-nums text-slate-900">${money(c.overdraftLimit)}</div></div>
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl"><div class="text-[11px] text-slate-500">Использовано</div><div class="text-sm font-extrabold tabular-nums ${c.overdraftUsed ? 'text-amber-600' : 'text-slate-900'}">${money(c.overdraftUsed)}</div></div>
      </div>
      <div class="flex flex-col gap-2">
        <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Новый лимит, сомони <span class="text-rose-500">*</span></span>
          <input id="od-limit" type="number" min="0" value="${esc(odState.limit)}" oninput="odField('limit', this.value)" class="${cls('limit')} tabular-nums">
          <span class="text-[11px] text-slate-400">${c.overdraftUsed ? 'Не ниже уже использованных ' + money(c.overdraftUsed) + '. ' : ''}0 — овердрафт не предусмотрен</span>${err('limit')}</label>
        <div class="flex flex-wrap gap-1.5">${OD_PRESETS.map(n => `<button type="button" onclick="odPick(${n})" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${String(n) === odState.limit ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">${n}</button>`).join('')}</div>
      </div>
      <div id="odPreview" class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">${odPreviewHtml()}</div>
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Причина изменения <span class="text-rose-500">*</span></span>
        <textarea id="od-reason" rows="2" oninput="odField('reason', this.value)" placeholder="Например, надёжный клиент, оплата по графику" class="${cls('reason')}">${esc(odState.reason)}</textarea>
        <span class="text-[11px] text-slate-400">Попадёт в журнал аудита вместе с вашим именем и временем</span>${err('reason')}</label>
      <div class="flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Отмена</button>
        <button onclick="odSubmit()" ${odState.busy ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">${odState.busy ? 'Сохраняем…' : 'Сохранить лимит'}</button>
      </div>
    </div>`;
}

async function odSubmit() {
  if (odState.busy) return;
  odState.busy = true; renderOverdraft();
  try {
    const c = await api.finance.setOverdraft(odState.center.id, { limit: odState.limit === '' ? null : Number(odState.limit), reason: odState.reason });
    odState.busy = false;
    showToast('Лимит овердрафта «' + c.name + '»: ' + money(c.overdraftLimit), 'success');
    closeModal(); await refreshAttention(); await refreshCurrentView(); await refreshOpenFinance();
  } catch (e) {
    odState.busy = false;
    if (e instanceof ApiError && e.code === 'VALIDATION' && Object.keys(e.fields).length) { odState.errors = e.fields; renderOverdraft(); const k = ['limit', 'reason'].find(x => e.fields[x]); const el = k && $('od-' + k); if (el) el.focus(); }
    else { renderOverdraft(); showToast(errText(e), 'error'); }
  }
}
