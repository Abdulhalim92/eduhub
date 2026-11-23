/* Экран: Тарифы и лимиты. Каталог тарифов (цена, лимиты, модули), редактор и центры у лимита.
   Правила (лимит не ниже текущего использования, архивация тарифа с центрами, «у лимита» = ≥80%) — на сервере (api.plans.*). */
registerView({
  tab: 'plans', path: 'plans',
  title: 'Тарифы и лимиты', parent: null,
  template: `
<main id="view-plans" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Тарифы и лимиты</h1>
      <p class="text-xs text-slate-500 mt-1">Конструктор тарифных пакетов и базовых ограничений для центров</p>
    </div>
    <button onclick="planNew()" class="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      <span>Создать тариф</span>
    </button>
  </div>

  <div id="plansTiles" class="text-[11px] text-slate-500 -mt-3"></div>
  <div id="planEditor"></div>
  <div id="plansGrid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5"></div>
  <div id="plansMatrix"></div>
  <div id="plansLimitBanner"></div>

</main>
`,
  render: () => renderPlans()
});

const MODULE_LABELS = { payroll: 'Зарплаты', inventory: 'Инвентарь', crm: 'CRM-воронка', geo: 'Гео-чек-ин' };
const plansState = { items: [], meta: null, editing: null, draft: null, errors: {}, saving: false };

async function renderPlans() {
  const my = begin('plans');
  $('plansTiles').innerHTML = '&nbsp;';
  $('plansGrid').innerHTML = Array.from({ length: 4 }, () => '<div class="h-56 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>').join('');
  try {
    const [pl] = await Promise.all([api.plans.list(), refreshAttention()]);
    if (stale('plans', my)) return;
    plansState.items = pl.items; plansState.meta = pl.meta;
    renderPlansTiles();
    renderPlansLimitBanner();
    renderPlansGrid();
    renderPlansMatrix();
    renderPlanEditor();
  } catch (e) {
    if (stale('plans', my)) return;
    $('plansTiles').innerHTML = '';
    $('plansLimitBanner').innerHTML = ''; $('plansMatrix').innerHTML = '';
    $('plansGrid').innerHTML = `<div class="col-span-full bg-white border border-slate-200 rounded-2xl">${errorBox(e)}</div>`;
  }
}

function renderPlansTiles() {
  const m = plansState.meta;
  $('plansTiles').innerHTML = `Активных тарифов <strong class="text-slate-700">${m.active} из ${m.total}</strong> · центров на платных <strong class="text-slate-700">${m.paidCenters}</strong> · выручка по тарифам <strong class="text-slate-700">${money(m.mrr)}</strong> в месяц`;
}

function renderPlansLimitBanner() {
  const n = plansState.meta.nearLimit;
  $('plansLimitBanner').innerHTML = n ? `
    <div class="flex items-center justify-between gap-4 flex-wrap p-4 bg-amber-50 border border-amber-200 rounded-2xl">
      <div class="text-xs text-amber-900"><strong>${n} ${plural(n, ['центр подошёл', 'центра подошли', 'центров подошли'])} к лимиту тарифа.</strong> Откройте рабочий список: там фильтры, выбор тарифа с расчётом цены и массовые предложения.</div>
      <button onclick="switchTab('limits')" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold transition">Работать с центрами у лимита →</button>
    </div>` : '';
}

function modulesChips(modules) {
  return Object.keys(MODULE_LABELS).map(k => modules[k]
    ? `<span class="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-medium">✓ ${MODULE_LABELS[k]}</span>`
    : `<span class="px-2 py-1 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-medium line-through">${MODULE_LABELS[k]}</span>`).join('');
}

const planLimitsLine = p => ['До ' + p.limits.staff + ' ' + plural(p.limits.staff, ['сотрудник', 'сотрудника', 'сотрудников']), p.limits.storageGb + ' ГБ', p.limits.branches + ' ' + plural(p.limits.branches, ['филиал', 'филиала', 'филиалов'])]
  .map(x => '<span class="whitespace-nowrap">' + x + '</span>').join(' · ');

function renderPlansGrid() {
  const act = plansState.items.filter(p => p.active), top = act.reduce((a, p) => (p.price > a.price ? p : a), act[0] || {});
  const popular = act.filter(p => p.price > 0).reduce((a, p) => (!a || p.centers > a.centers ? p : a), null);
  $('plansGrid').innerHTML = plansState.items.map(p => {
    const hot = popular && p.id === popular.id && p.active, edit = plansState.editing === p.id;
    return `
    <div class="relative bg-white border ${edit || hot ? 'border-brand' : 'border-slate-200/80'} ${edit ? 'ring-2 ring-brand/20' : ''} rounded-2xl p-6 shadow-xs flex flex-col gap-4 overflow-hidden ${p.active ? '' : 'opacity-60'}">
      ${hot ? '<div class="absolute left-0 right-0 top-0 h-1.5 bg-brand"></div>' : ''}
      <div class="flex items-center justify-between gap-2">
        <span class="px-3 py-1 rounded-lg text-xs font-semibold ${hot ? 'bg-indigo-100 text-brand' : 'bg-slate-100 text-slate-700'}">${esc(p.name)}</span>
        ${!p.active ? badge('slate', 'В архиве') : p.id === top.id && act.length > 1 ? '<span class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-200 text-slate-600">Premium</span>' : hot ? '<span class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-100 text-brand">Популярный</span>' : ''}
      </div>
      <div class="whitespace-nowrap"><span class="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">${money(p.price)}</span><span class="text-xs text-slate-400"> / мес</span></div>
      <div class="text-xs text-slate-600">${planLimitsLine(p)}</div>
      <div class="text-[11px] text-slate-400 flex-1">${p.centers} ${plural(p.centers, ['центр', 'центра', 'центров'])} · ${money(p.mrr)} в месяц</div>
      <div class="flex items-center gap-2">
        <button onclick="planEdit('${p.id}')" class="flex-1 px-4 py-2.5 bg-white border border-brand text-brand rounded-xl text-xs font-semibold hover:bg-brand-light/60 transition">Редактировать</button>
        ${menuGear(`planMenu(this, '${p.id}')`)}
      </div>
    </div>`;
  }).join('');
}

function planMenu(btn, id) {
  const p = plansState.items.find(x => x.id === id); if (!p) return;
  openMenu(btn, [
    { label: 'Редактировать', hint: 'Цена, лимиты, модули', icon: 'sliders', run: () => planEdit(id) },
    p.active ? { label: 'Перенести в архив', hint: p.centers ? 'Нельзя: на тарифе ' + p.centers + ' ' + plural(p.centers, ['центр', 'центра', 'центров']) : 'Исчезнет из списка для новых центров', icon: 'open', run: () => planToggleActive(id) }
      : { label: 'Вернуть из архива', hint: 'Снова доступен для выбора', icon: 'plus', run: () => planToggleActive(id) }
  ]);
}

// матрица функций: строки — лимиты и модули, столбцы — активные тарифы
function renderPlansMatrix() {
  const act = plansState.items.filter(p => p.active);
  const yes = '<svg class="w-5 h-5 mx-auto text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';
  const no = '<span class="text-slate-500">Нет</span>';
  const rows = [
    ['Сотрудников', p => p.limits.staff], ['Хранилище', p => p.limits.storageGb + ' ГБ'], ['Филиалов', p => p.limits.branches],
    ...Object.keys(MODULE_LABELS).map(k => [MODULE_LABELS[k], p => (p.modules[k] ? yes : no)])
  ];
  $('plansMatrix').innerHTML = `
    <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100"><h3 class="text-base font-bold text-slate-900">Матрица доступных функций (Feature Flags)</h3></div>
      <div class="overflow-x-auto"><table class="w-full text-left text-xs edge-table min-w-[36rem]">
        <thead><tr class="text-slate-400"><th class="font-medium">Функция / Лимит</th>${act.map(p => `<th class="font-medium text-center">${esc(p.name)}</th>`).join('')}</tr></thead>
        <tbody class="divide-y divide-slate-100">${rows.map(([label, f], i) => `<tr><td class="py-3 text-slate-800">${i + 1}. ${label}</td>${act.map(p => `<td class="py-3 text-center font-semibold text-slate-800">${f(p)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}

/* ---------- редактор тарифа ---------- */
function planDraftFrom(p) {
  return p
    ? { name: p.name, price: String(p.price), staff: String(p.limits.staff), storageGb: String(p.limits.storageGb), branches: String(p.limits.branches), modules: { ...p.modules }, isFree: p.isFree }
    : { name: '', price: '', staff: '', storageGb: '', branches: '', modules: { payroll: false, inventory: false, crm: false, geo: true }, isFree: false };
}
function planNew() { plansState.editing = 'new'; plansState.draft = planDraftFrom(null); plansState.errors = {}; renderPlansGrid(); renderPlanEditor(true); }
function planEdit(id) {
  const p = plansState.items.find(x => x.id === id); if (!p) return;
  plansState.editing = id; plansState.draft = planDraftFrom(p); plansState.errors = {};
  renderPlansGrid(); renderPlanEditor(true);
}
function planCancel() { plansState.editing = null; plansState.draft = null; plansState.errors = {}; renderPlansGrid(); renderPlanEditor(); }
function planDraft(key, val) {
  plansState.draft[key] = val;
  if (plansState.errors[key]) {
    delete plansState.errors[key];
    const e = $('perr-' + key); if (e) e.remove();
    const inp = $('pf-' + key); if (inp) inp.classList.replace('border-rose-400', 'border-slate-200');
  }
}
function planToggleModule(k) { plansState.draft.modules[k] = !plansState.draft.modules[k]; renderPlanEditor(); }

function planField(key, label, o = {}) {
  const d = plansState.draft, err = plansState.errors[key];
  return `<label class="flex flex-col gap-1.5">
    <span class="text-[11px] font-semibold text-slate-600">${label}</span>
    <input id="pf-${key}" type="${o.type || 'text'}" ${o.disabled ? 'disabled' : ''} value="${esc(d[key])}" placeholder="${esc(o.placeholder || '')}" oninput="planDraft('${key}', this.value)"
      class="px-3 py-2.5 bg-white border ${err ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand disabled:bg-slate-50 disabled:text-slate-400">
    ${o.hint ? `<span class="text-[11px] text-slate-400">${o.hint}</span>` : ''}
    ${err ? `<span id="perr-${key}" class="text-[11px] text-rose-600">${esc(err)}</span>` : ''}
  </label>`;
}

function renderPlanEditor(scroll) {
  const box = $('planEditor'), s = plansState;
  box.classList.toggle('hidden', !s.editing);   // пустой контейнер не должен давать лишний отступ
  if (!s.editing) { box.innerHTML = ''; return; }
  const d = s.draft, isNew = s.editing === 'new';
  box.innerHTML = `
    <div class="bg-white border border-brand/40 rounded-2xl p-6 shadow-xs">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-slate-900">${isNew ? 'Новый тариф' : 'Тариф «' + esc(d.name) + '»'}</h3>
        <button onclick="planCancel()" class="text-slate-400 hover:text-slate-600 text-lg leading-none p-1" title="Закрыть">✕</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        ${planField('name', 'Название', { disabled: !isNew, placeholder: 'Например, Премиум', hint: isNew ? '' : 'Название тарифа не меняется: оно закреплено за центрами' })}
        ${planField('price', 'Цена, сомони / мес', { type: 'number', disabled: d.isFree, placeholder: '0', hint: d.isFree ? 'Стартовый тариф бесплатный' : '' })}
        ${planField('staff', 'Лимит сотрудников', { type: 'number', placeholder: '10' })}
        ${planField('storageGb', 'Хранилище, ГБ', { type: 'number', placeholder: '10' })}
        ${planField('branches', 'Лимит филиалов', { type: 'number', placeholder: '3' })}
      </div>
      <div class="mt-5">
        <div class="text-[11px] font-semibold text-slate-600 mb-2">Модули в тарифе (Feature Flags по умолчанию)</div>
        <div class="flex flex-wrap gap-2">
          ${Object.keys(MODULE_LABELS).map(k => `<button type="button" onclick="planToggleModule('${k}')" class="px-3 py-2 rounded-xl text-xs font-semibold border transition ${d.modules[k] ? 'bg-brand text-white border-brand' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}">${d.modules[k] ? '✓ ' : ''}${MODULE_LABELS[k]}</button>`).join('')}
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
        <button onclick="planCancel()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Отмена</button>
        <button onclick="planSave()" ${s.saving ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">${s.saving ? 'Сохраняем…' : 'Сохранить тариф'}</button>
      </div>
    </div>`;
  if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function planSave() {
  const s = plansState;
  if (s.saving || !s.editing) return;
  const d = s.draft;
  const payload = { price: d.isFree ? 0 : Number(d.price), limits: { staff: Number(d.staff), storageGb: Number(d.storageGb), branches: Number(d.branches) }, modules: { ...d.modules } };
  s.saving = true; renderPlanEditor();
  try {
    if (s.editing === 'new') await api.plans.create({ name: d.name, ...payload });
    else await api.plans.update(s.editing, payload);
    s.saving = false; s.editing = null; s.draft = null; s.errors = {};
    try { state.dict = await api.dictionaries.get(); } catch (e) { /* справочник обновится при следующем заходе */ }
    showToast('Тариф сохранён', 'success');
    await renderPlans();
  } catch (e) {
    s.saving = false;
    if (e instanceof ApiError && e.code === 'VALIDATION') { s.errors = e.fields; renderPlanEditor(); const k = Object.keys(e.fields)[0], el = k && $('pf-' + k); if (el) el.focus(); }
    else { renderPlanEditor(); showToast(errText(e), 'error'); }
  }
}

async function planToggleActive(id) {
  const p = plansState.items.find(x => x.id === id); if (!p) return;
  const ok = await mutate(() => api.plans.update(id, { active: !p.active }), () => (p.active ? 'Тариф «' + p.name + '» перенесён в архив' : 'Тариф «' + p.name + '» снова доступен'), 'info');
  if (ok) { try { state.dict = await api.dictionaries.get(); } catch (e) { /* не критично */ } await renderPlans(); }
}
