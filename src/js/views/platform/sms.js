/* Экран: Биллинг SMS-пакетов. Каталог пакетов, история продаж и остатки SMS по центрам.
   Пакет начисляется центру одним из трёх способов (правила — в api.sms.accrue):
   1) списанием с баланса на платформе; 2) деньги получены вне системы (основание как у подтверждения оплаты счёта); 3) бесплатно, по причине (бонус). */
registerView({
  tab: 'sms', path: 'sms',
  title: 'Биллинг SMS', parent: null,
  template: `
<main id="view-sms" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Биллинг SMS-пакетов</h1>
      <p class="text-xs text-slate-500 mt-1">Управление пакетами сообщений и контроль расхода SMS учебными центрами</p>
    </div>
    <button onclick="openSmsAccrue()" class="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs transition">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      <span>Начислить пакет SMS</span>
    </button>
  </div>

  <div id="smsPackages" class="grid grid-cols-1 md:grid-cols-3 gap-5"></div>

  <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
    <div class="px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
      <div><h3 class="text-sm font-bold text-slate-900">История продаж и балансы центров</h3><p id="smsSummary" class="text-[11px] text-slate-500 mt-0.5"></p></div>
      <div class="w-64 relative">
        <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="smsSearch" oninput="setSmsQuery(this.value)" type="text" placeholder="Поиск по центру или номеру…" class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-brand focus:bg-white">
      </div>
    </div>
    <div class="px-6 py-3 flex flex-wrap items-center gap-3 border-b border-slate-100">
      <label class="flex items-center gap-2 text-xs text-slate-500">Пакет
        <select id="smsPkgSelect" onchange="setSmsFilter('pkg', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"><option value="all">Все пакеты</option></select></label>
      <div id="smsChips" class="flex flex-wrap items-center gap-2"></div>
      <button id="smsReset" onclick="resetSmsFilters()" class="hidden text-xs font-semibold text-brand hover:underline">Сбросить фильтры</button>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs edge-table min-w-[52rem]">
        <thead><tr class="text-slate-400">
          <th class="font-medium">Учебный центр</th><th class="font-medium">Пакет</th><th class="font-medium">Дата покупки</th>
          <th class="font-medium">Остаток SMS</th><th class="font-medium text-right">Сумма</th><th class="font-medium">Статус</th><th class="font-medium text-right">Действия</th>
        </tr></thead>
        <tbody id="smsBody" class="divide-y divide-slate-100 text-slate-700"></tbody>
      </table>
    </div>
    <div id="smsFooter"></div>
  </div>
</main>
`,
  render: renderSms
});

const smsState = { q: '', status: 'all', pkg: 'all', page: 1, counts: null, packages: [], center: null, packageId: null, mode: 'balance', method: '', reference: '', receivedOn: '', comment: '', reason: '', confirmed: false, centers: [], errors: {}, busy: false };
const smsPk = { id: null, price: '', description: '', reason: '', errors: {}, busy: false };
let smsQTimer;
function setSmsQuery(v) { smsState.q = v; smsState.page = 1; clearTimeout(smsQTimer); smsQTimer = setTimeout(() => renderSmsTable(), 250); }
function setSmsFilter(k, v) { smsState[k] = v; smsState.page = 1; renderSmsTable(); }
function resetSmsFilters() { Object.assign(smsState, { q: '', status: 'all', pkg: 'all', page: 1 }); const i = $('smsSearch'); if (i) i.value = ''; renderSmsTable(); }

const smsPackageCard = p => `
  <div class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col gap-3">
    <div class="flex items-start justify-between gap-3">
      <h3 class="text-base font-bold text-slate-900">Пакет ${p.sms.toLocaleString('ru-RU')} SMS</h3>
      ${menuGear(`smsPackageMenu(this, '${p.id}')`)}
    </div>
    <div class="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">${money(p.price)}</div>
    <p class="text-xs text-slate-500 leading-relaxed flex-1">${esc(p.description)}</p>
    <div class="flex items-center justify-between pt-1">
      <button onclick="openSmsAccrue('${p.id}')" class="text-xs font-semibold text-brand hover:underline">Начислить центру →</button>
      <span class="text-[11px] text-slate-400">продано ${p.sold} · ${p.centers} ${plural(p.centers, ['центр', 'центра', 'центров'])}</span>
    </div>
  </div>`;

function smsPackageMenu(btn, id) {
  const p = smsState.packages.find(x => x.id === id); if (!p) return;
  openMenu(btn, [
    { label: 'Начислить центру…', hint: 'Выбрать центр и способ оплаты', icon: 'plus', run: () => openSmsAccrue(id) },
    { label: 'Изменить цену и описание…', hint: 'Действует на новые продажи', icon: 'sliders', run: () => openSmsPackageEdit(id) }
  ]);
}

const smsRemainCell = x => {
  const pct = Math.max(0, Math.round(x.remaining / x.sms * 100));
  return `<div class="tabular-nums ${x.low ? 'text-amber-600 font-semibold' : 'text-slate-800'}">${x.remaining.toLocaleString('ru-RU')} / ${x.sms.toLocaleString('ru-RU')}</div>
    <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5"><div class="h-full ${x.low ? 'bg-amber-500' : 'bg-brand'}" style="width:${pct}%"></div></div>
    ${x.low ? '<div class="text-[11px] text-amber-600 mt-1">Заканчиваются</div>' : ''}`;
};

function smsRowMenu(btn, centerId, name) {
  openMenu(btn, [
    { label: 'Начислить ещё пакет…', hint: name, icon: 'plus', run: () => openSmsAccrue(null, centerId) },
    { label: 'Баланс и овердрафт…', hint: 'Баланс на платформе и журнал операций', icon: 'wallet', run: () => openFinance(centerId) },
    { label: 'Найти в реестре центров', hint: 'Фильтр «Все центры» по названию', icon: 'open', run: () => { Object.assign(centersState, { q: name, plan: 'all', city: 'all', chip: 'all', page: 1 }); switchTab('centers'); } }
  ]);
}

async function renderSms() {
  const my = begin('sms');
  $('smsPackages').innerHTML = Array.from({ length: 3 }, () => '<div class="h-44 bg-white border border-slate-200/80 rounded-2xl animate-pulse"></div>').join('');
  try {
    const { items, meta } = await api.sms.packages();
    if (stale('sms', my)) return;
    smsState.packages = items;
    $('smsPackages').innerHTML = items.map(smsPackageCard).join('');
    $('smsSummary').innerText = `Остаток по всем центрам: ${meta.total.toLocaleString('ru-RU')} SMS · продано на ${money(meta.revenue)}${meta.low ? ' · заканчиваются у ' + meta.low + ' ' + plural(meta.low, ['центра', 'центров', 'центров']) : ''}`;
  } catch (e) { if (!stale('sms', my)) $('smsPackages').innerHTML = `<div class="md:col-span-3 bg-white border border-slate-200/80 rounded-2xl">${errorBox(e)}</div>`; return; }
  await renderSmsTable(my);
}

async function renderSmsTable(my) {
  const body = $('smsBody'); if (!body) return;
  const token = my || begin('sms');
  body.innerHTML = skeletonRows(7, 5);
  try {
    const { items, total, allTotal, counts } = await api.sms.sales({ q: smsState.q, status: smsState.status, packageId: smsState.pkg, page: smsState.page, pageSize: PAGE_SIZE });
    if (stale('sms', token)) return;
    if (!items.length && total && smsState.page > 1) { smsState.page = Math.ceil(total / PAGE_SIZE); return renderSmsTable(token); }
    smsState.counts = counts; renderSmsFilters();
    $('smsFooter').innerHTML = pagerHtml('sms', { page: smsState.page, total, note: total !== allTotal ? 'всего продаж: ' + allTotal : '' }, n => { smsState.page = n; renderSmsTable(); });
    body.innerHTML = items.length ? items.map(x => `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-3.5" style="white-space:normal;min-width:11rem"><div class="font-semibold text-slate-900">${esc(x.center)}</div><div class="text-[11px] text-slate-400">${esc(x.id)} · ${esc(x.method)}</div></td>
        <td class="py-3.5 text-slate-700 tabular-nums">${x.sms.toLocaleString('ru-RU')} SMS</td>
        <td class="py-3.5 text-slate-600">${new Date(x.boughtAt).toLocaleDateString('ru-RU')}</td>
        <td class="py-3.5" style="min-width:11rem">${smsRemainCell(x)}</td>
        <td class="py-3.5 text-right tabular-nums text-slate-800">${x.status === 'bonus' ? '—' : money(x.price)}</td>
        <td class="py-3.5">${x.status === 'bonus' ? badge('indigo', 'Бонус') : badge('emerald', 'Оплачено')}</td>
        <td class="py-3.5 text-right">${menuGear(`smsRowMenu(this, ${x.centerId}, '${esc(x.center).replace(/'/g, '')}')`)}</td>
      </tr>`).join('') : '<tr><td colspan="7" class="py-12 text-center text-slate-400">Ничего не найдено. <button onclick="resetSmsFilters()" class="text-brand font-semibold hover:underline">Сбросить фильтры</button></td></tr>';
  } catch (e) { if (!stale('sms', token)) body.innerHTML = errorRow(7, e); }
}

/* ---- диалог «Начислить пакет SMS» ---- */
async function openSmsAccrue(packageId = null, centerId = null) {
  openModal(modalLoading('Начислить пакет SMS'));
  try {
    const [{ items: packs }, { items: centers }] = await Promise.all([api.sms.packages(), api.centers.list({ limit: 500 })]);
    smsState.packages = packs; smsState.centers = centers.filter(c => c.status === 'active');
    const pm = (dict().payMethods || [])[0];
    Object.assign(smsState, { center: centerId || null, packageId: packageId || (packs.find(p => p.sms === 1000) || packs[0]).id, mode: 'balance', method: pm ? pm.method : '', reference: '', receivedOn: todayStr(), comment: '', reason: '', confirmed: false, errors: {}, busy: false });
    renderSmsAccrue();
  } catch (e) { setModal(modalError('Начислить пакет SMS', e)); }
}

function smsSelPack() { return smsState.packages.find(p => p.id === smsState.packageId); }
function smsSelCenter() { return smsState.centers.find(c => c.id === smsState.center) || null; }
function smsPick(key, v) { smsState[key] = v; smsState.errors = {}; renderSmsAccrue(); }
function smsField(key, v) { smsState[key] = v; if (smsState.errors[key]) { delete smsState.errors[key]; const e = $('err-sms-' + key); if (e) e.remove(); } }

function renderSmsAccrue() {
  const s = smsState, er = s.errors, pk = smsSelPack(), c = smsSelCenter(), methods = dict().payMethods || [];
  const pm = methods.find(m => m.method === s.method) || methods[0] || { docLabel: 'Номер документа', docHint: '' };
  const err = k => (er[k] ? `<span id="err-sms-${k}" class="text-[11px] text-rose-600">${esc(er[k])}</span>` : '');
  const cls = k => `px-3 py-2.5 bg-white border ${er[k] ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand`;
  const canBalance = !!c && c.balance + c.overdraftLimit >= pk.price;
  const modeCard = (mode, title, text, disabled) => {
    const on = s.mode === mode;
    return `<button type="button" ${disabled ? 'disabled' : ''} onclick="smsPick('mode','${mode}')" class="w-full text-left p-3 rounded-xl border transition ${on ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white'} ${disabled ? 'opacity-60 cursor-not-allowed' : (on ? '' : 'hover:border-brand/50')}">
      <div class="flex items-center gap-2"><span class="w-4 h-4 rounded-full border-2 flex items-center justify-center ${on ? 'border-brand' : 'border-slate-300'}">${on ? '<span class="w-2 h-2 rounded-full bg-brand"></span>' : ''}</span><span class="text-xs font-bold text-slate-900">${title}</span></div>
      <div class="text-[11px] text-slate-500 mt-1.5 pl-6 leading-relaxed">${text}</div></button>`;
  };
  const balText = !c ? 'Сначала выберите центр.' : canBalance
    ? `Баланс ${money(c.balance)} · доступно ${money(c.available)}. После списания: <strong class="${c.balance - pk.price < 0 ? 'text-amber-700' : 'text-slate-700'}">${money(c.balance - pk.price)}</strong>${c.balance - pk.price < 0 ? ' (использует овердрафт)' : ''}.`
    : `<span class="text-rose-600">Не хватает: доступно ${money(c.available)}, нужно ${money(pk.price)}.</span>`;
  const manual = s.mode === 'manual' ? `
    <div class="flex flex-col gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">${methods.map(m => `<button type="button" onclick="smsPick('method','${esc(m.method)}')" class="text-left p-2.5 rounded-lg border text-[11px] font-semibold ${s.method === m.method ? 'border-brand bg-white ring-2 ring-brand/20 text-brand' : 'border-slate-200 bg-white text-slate-600'}">${esc(m.method)}<div class="font-normal text-slate-400 mt-0.5">${esc(m.evidence)}</div></button>`).join('')}</div>
      ${err('method')}
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">${esc(pm.docLabel)} <span class="text-rose-500">*</span></span>
        <input id="sms-reference" type="text" value="${esc(s.reference)}" placeholder="${esc(pm.docHint)}" oninput="smsField('reference', this.value)" class="${cls('reference')}">${err('reference')}</label>
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Дата поступления <span class="text-rose-500">*</span></span>
        <input id="sms-receivedOn" type="date" max="${todayStr()}" value="${esc(s.receivedOn)}" oninput="smsField('receivedOn', this.value)" class="${cls('receivedOn')}">${err('receivedOn')}</label>
      ${err('receivedAmount')}
      <label class="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer"><input id="sms-confirmed" type="checkbox" ${s.confirmed ? 'checked' : ''} onchange="smsField('confirmed', this.checked)" class="w-4 h-4 mt-0.5 accent-[#3C5C73]"><span>Подтверждаю: деньги (${pk ? money(pk.price) : ''}) действительно поступили</span></label>${err('confirmed')}
    </div>` : '';
  const bonus = s.mode === 'bonus' ? `<label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Причина бесплатного начисления <span class="text-rose-500">*</span></span>
      <textarea id="sms-reason" rows="2" oninput="smsField('reason', this.value)" placeholder="Например, компенсация за сбой шлюза" class="${cls('reason')}">${esc(s.reason)}</textarea>${err('reason')}</label>` : '';
  setModal(`
    ${modalHeader('Начислить пакет SMS', 'Выберите центр, пакет и способ оплаты')}
    <div class="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Центр <span class="text-rose-500">*</span></span>
        <select id="sms-center" onchange="smsPick('center', Number(this.value) || null)" class="${cls('centerId')}">
          <option value="">Выберите центр…</option>
          ${s.centers.map(x => `<option value="${x.id}" ${x.id === s.center ? 'selected' : ''}>${esc(x.name)} · ${esc(x.city)}</option>`).join('')}
        </select>${err('centerId')}</label>
      <div class="flex flex-col gap-2"><span class="text-[11px] font-semibold text-slate-600">Пакет <span class="text-rose-500">*</span></span>
        <div class="grid grid-cols-3 gap-2">${s.packages.map(p => `<button type="button" onclick="smsPick('packageId','${p.id}')" class="p-3 rounded-xl border text-left transition ${p.id === s.packageId ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white hover:border-brand/50'}"><div class="text-xs font-bold text-slate-900">${p.sms.toLocaleString('ru-RU')} SMS</div><div class="text-[11px] text-slate-500 mt-0.5">${money(p.price)}</div></button>`).join('')}</div>${err('packageId')}</div>
      <div class="flex flex-col gap-2"><span class="text-[11px] font-semibold text-slate-600">Как оплачен пакет</span>
        ${modeCard('balance', 'Списать с баланса на платформе', balText, !!c && !canBalance)}
        ${modeCard('manual', 'Деньги получены вне системы', 'Банковский перевод, касса или перевод на карту. Нужны документ, дата и подтверждение.', false)}
        ${modeCard('bonus', 'Начислить бесплатно', 'Бонус или компенсация. Причина обязательна, запись попадёт в журнал аудита.', false)}
        ${err('mode')}${manual}${bonus}</div>
      <div class="flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Отмена</button>
        <button onclick="smsSubmit()" ${s.busy ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">${s.busy ? 'Начисляем…' : 'Начислить ' + (pk ? pk.sms.toLocaleString('ru-RU') + ' SMS' : '')}</button>
      </div>
    </div>`);
}

async function smsSubmit() {
  const s = smsState; if (s.busy) return;
  if (!s.center) { s.errors = { centerId: 'Выберите центр' }; renderSmsAccrue(); return; }
  s.busy = true; renderSmsAccrue();
  try {
    const pk = smsSelPack();
    const sale = await api.sms.accrue({ centerId: s.center, packageId: s.packageId, mode: s.mode, method: s.method, reference: s.reference, receivedOn: s.receivedOn, receivedAmount: pk.price, confirmed: s.confirmed, reason: s.reason });
    showToast(`Начислено ${sale.sms.toLocaleString('ru-RU')} SMS · ${sale.center}`, 'success');
    closeModal(); await refreshCurrentView();
  } catch (e) {
    s.busy = false;
    if (e instanceof ApiError && e.fields && Object.keys(e.fields).length) { s.errors = e.fields; renderSmsAccrue(); const first = document.querySelector('[id^="err-sms-"]'); if (first) first.scrollIntoView({ block: 'center' }); }
    else { showToast(errText(e), 'error'); renderSmsAccrue(); }
  }
}

/* ---- диалог «Изменить пакет» ---- */
function openSmsPackageEdit(id) {
  const p = smsState.packages.find(x => x.id === id); if (!p) return;
  Object.assign(smsPk, { id, price: String(p.price), description: p.description, reason: '', errors: {}, busy: false });
  renderSmsPackageEdit();
}
function smsPkField(k, v) { smsPk[k] = v; if (smsPk.errors[k]) { delete smsPk.errors[k]; const e = $('err-spk-' + k); if (e) e.remove(); } }
function renderSmsPackageEdit() {
  const p = smsState.packages.find(x => x.id === smsPk.id), er = smsPk.errors;
  const err = k => (er[k] ? `<span id="err-spk-${k}" class="text-[11px] text-rose-600">${esc(er[k])}</span>` : '');
  const cls = k => `px-3 py-2.5 bg-white border ${er[k] ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand`;
  openModal(`
    ${modalHeader('Пакет ' + p.sms.toLocaleString('ru-RU') + ' SMS', 'Изменения действуют на новые продажи, уже начисленные пакеты не меняются')}
    <div class="p-6 flex flex-col gap-4">
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Цена, сомони</span><input type="number" min="1" value="${esc(smsPk.price)}" oninput="smsPkField('price', this.value)" class="${cls('price')} tabular-nums">${err('price')}</label>
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Описание</span><input type="text" value="${esc(smsPk.description)}" oninput="smsPkField('description', this.value)" class="${cls('description')}">${err('description')}</label>
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Причина изменения <span class="text-rose-500">*</span></span><textarea rows="2" oninput="smsPkField('reason', this.value)" class="${cls('reason')}">${esc(smsPk.reason)}</textarea>${err('reason')}<span class="text-[11px] text-slate-400">Попадёт в журнал аудита</span></label>
      <div class="flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Отмена</button>
        <button onclick="smsPackageSave()" ${smsPk.busy ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">Сохранить</button>
      </div>
    </div>`);
}
async function smsPackageSave() {
  if (smsPk.busy) return; smsPk.busy = true;
  try {
    await api.sms.updatePackage(smsPk.id, { price: smsPk.price, description: smsPk.description, reason: smsPk.reason });
    showToast('Пакет обновлён', 'success'); closeModal(); await refreshCurrentView();
  } catch (e) {
    smsPk.busy = false;
    if (e instanceof ApiError && e.fields) { smsPk.errors = e.fields; renderSmsPackageEdit(); } else showToast(errText(e), 'error');
  }
}

function renderSmsFilters() {
  const c = smsState.counts || { paid: 0, bonus: 0, low: 0 }, sel = $('smsPkgSelect');
  $('smsChips').innerHTML = chip(smsState.status === 'all', 'Все', "setSmsFilter('status','all')") + chip(smsState.status === 'paid', `Оплачено · ${c.paid}`, "setSmsFilter('status','paid')") + chip(smsState.status === 'bonus', `Бонус · ${c.bonus}`, "setSmsFilter('status','bonus')") + chip(smsState.status === 'low', `Заканчиваются · ${c.low}`, "setSmsFilter('status','low')");
  if (sel && sel.options.length !== smsState.packages.length + 1) sel.innerHTML = '<option value="all">Все пакеты</option>' + smsState.packages.map(p => `<option value="${p.id}">${p.sms.toLocaleString('ru-RU')} SMS</option>`).join('');
  if (sel) sel.value = smsState.pkg;
  $('smsReset').classList.toggle('hidden', !(smsState.q || smsState.status !== 'all' || smsState.pkg !== 'all'));
}
