/* Экран: Центры у лимита. Рабочее место менеджера по допродажам: слева список с фильтрами и массовыми действиями,
   справа карточка выбранного центра (три лимита, выбор тарифа с расчётом цены, перевод или предложение).
   Тариф НЕ меняется кнопкой: «Сменить тариф…» открывает диалог со счётом (компонент plan-change), тариф сменится после оплаты.
   Правила (порог «у лимита», рекомендуемый тариф, проверка вместимости) — на сервере: api.plans.nearLimit / centers.requestPlanChange / centers.sendOffer. */
registerView({
  tab: 'limits', path: 'plans/limits',
  title: 'Центры у лимита', parent: ['Тарифы и лимиты', 'plans'],
  template: `
<main id="view-limits" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Центры у лимита</h1>
      <p class="text-xs text-slate-500 mt-1">Центры, подошедшие к лимиту сотрудников, хранилища или филиалов. Переведите на тариф выше или отправьте предложение владельцу</p>
    </div>
    <div class="flex flex-col items-end gap-1">
      <span class="text-[11px] font-semibold text-slate-500">Считать «у лимита» от</span>
      <div id="limThreshold" class="flex gap-1.5"></div>
    </div>
  </div>

  <div id="limTiles" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"></div>

  <div class="flex flex-wrap items-center gap-3">
    <div class="w-64 relative">
      <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input id="limSearch" oninput="limSet('q', this.value)" type="text" placeholder="Центр, город или владелец…" class="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-brand">
    </div>
    <select id="limMetric" onchange="limSet('metric', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer">
      <option value="any">Любой лимит</option>
      <option value="staff">Сотрудники</option>
      <option value="storage">Хранилище</option>
      <option value="branches">Филиалы</option>
    </select>
    <select id="limPlan" onchange="limSet('plan', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer">
      <option value="all">Все тарифы</option>
    </select>
    <select id="limSort" onchange="limSet('sort', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer">
      <option value="usage">Сначала самые загруженные</option>
      <option value="potential">Сначала с большим потенциалом</option>
      <option value="name">По названию</option>
    </select>
    <div id="limChips" class="flex flex-wrap items-center gap-2"></div>
  </div>

  <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
    <div class="xl:col-span-7 bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
      <div id="limBulk" class="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap bg-slate-50/60"></div>
      <div id="limList" class="flex flex-col divide-y divide-slate-100"></div>
      <div id="limFooter"></div>
    </div>
    <div id="limDetail" class="xl:col-span-5 xl:sticky xl:top-0"></div>
  </div>
</main>
`,
  render: () => renderLimits()
});

const limState = {
  threshold: 0.8, q: '', metric: 'any', plan: 'all', status: 'all', sort: 'usage',
  items: [], meta: null, sel: null, page: 1,
  picked: {},            // centerId → выбранный в карточке тариф
  checked: new Set()     // отмеченные для массового предложения
};
let limQTimer;

function limSet(key, value) {
  limState[key] = value; limState.page = 1;
  if (key === 'threshold' || key === 'metric') { limState.checked.clear(); }
  if (key === 'q') { clearTimeout(limQTimer); limQTimer = setTimeout(renderLimits, 250); }   // debounce поиска
  else renderLimits();
}

const LIM_LEVEL = pct => (pct >= 100 ? 'full' : pct >= 90 ? 'critical' : 'warning');
const LIM_TONE = {
  full:     { bar: 'bg-rose-500',   pill: 'bg-rose-100 text-rose-700',     text: 'text-rose-600',   label: 'Исчерпан' },
  critical: { bar: 'bg-amber-500',  pill: 'bg-amber-100 text-amber-800',   text: 'text-amber-600',  label: 'Почти исчерпан' },
  warning:  { bar: 'bg-yellow-400', pill: 'bg-yellow-100 text-yellow-800', text: 'text-yellow-600', label: 'Подходит к лимиту' },
  ok:       { bar: 'bg-emerald-500', pill: 'bg-slate-100 text-slate-500',  text: 'text-slate-500',  label: 'В норме' }
};
const limTone = pct => LIM_TONE[pct >= Math.round(limState.threshold * 100) ? LIM_LEVEL(pct) : 'ok'];
const LIM_SHORT = { staff: 'Сотр.', storage: 'ГБ', branches: 'Фил.' };

async function renderLimits() {
  const my = begin('limits');
  limRenderControls();
  if (!limState.items.length) {
    $('limList').innerHTML = Array.from({ length: 5 }, () => '<div class="p-4"><div class="h-10 bg-slate-100 rounded-xl animate-pulse"></div></div>').join('');
    $('limDetail').innerHTML = '';
  }
  try {
    const [res] = await Promise.all([
      api.plans.nearLimit({ threshold: limState.threshold, metric: limState.metric, q: limState.q, plan: limState.plan, status: limState.status, sort: limState.sort }),
      refreshAttention()
    ]);
    if (stale('limits', my)) return;
    limState.items = res.items; limState.meta = res.meta;
    cacheCenters(res.items.map(e => e.center));
    // отметки живут только для центров, которые остались в выдаче
    const ids = new Set(res.items.map(e => e.center.id));
    limState.checked = new Set([...limState.checked].filter(id => ids.has(id)));
    if (!ids.has(limState.sel)) { limState.sel = res.items.length ? res.items[0].center.id : null; }
    limRenderControls();
    limRenderTiles();
    limRenderList();
    limRenderDetail();
  } catch (e) {
    if (stale('limits', my)) return;
    limState.items = [];
    $('limTiles').innerHTML = '';
    $('limBulk').innerHTML = '';
    $('limList').innerHTML = errorBox(e);
    $('limDetail').innerHTML = '';
  }
}

/* ---------- панель фильтров и сводка ---------- */
function limFillPlans() {
  const sel = $('limPlan'), plans = dict().plans;
  if (!sel || sel.options.length === plans.length + 1) return;
  const keep = limState.plan;
  sel.innerHTML = '<option value="all">Все тарифы</option>' + plans.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
  sel.value = plans.some(p => p.name === keep) ? keep : 'all';
}

function limRenderControls() {
  limFillPlans();
  $('limThreshold').innerHTML = [0.7, 0.8, 0.9, 1].map(t => chip(limState.threshold === t, Math.round(t * 100) + '%', `limSet('threshold', ${t})`)).join('');
  const m = limState.meta;
  const cnt = (v) => (m ? ` · ${v}` : '');
  $('limChips').innerHTML =
    chip(limState.status === 'all', 'Все', "limSet('status','all')") +
    chip(limState.status === 'nooffer', 'Без предложения' + cnt(m && m.withoutOffer), "limSet('status','nooffer')") +
    chip(limState.status === 'offered', 'Предложено' + cnt(m && m.offered), "limSet('status','offered')") +
    chip(limState.status === 'pending', 'Ожидает оплаты' + cnt(m && m.pending), "limSet('status','pending')") +
    chip(limState.status === 'full', 'Исчерпан' + cnt(m && m.full), "limSet('status','full')");
  ['limMetric:metric', 'limPlan:plan', 'limSort:sort'].forEach(pair => { const [id, key] = pair.split(':'); const el = $(id); if (el && el.value !== limState[key]) el.value = limState[key]; });
  const sInp = $('limSearch'); if (sInp && sInp.value !== limState.q) sInp.value = limState.q;
}

function limRenderTiles() {
  const m = limState.meta;
  $('limTiles').innerHTML =
    tile('У лимита', m.total, `порог ${m.threshold}% и выше`, m.total ? 'text-amber-600' : 'text-emerald-600') +
    tile('Лимит исчерпан', m.full, 'новые сотрудники, файлы или филиалы уже не добавить', m.full ? 'text-rose-600' : 'text-slate-900') +
    tile('Предложение отправлено', `${m.offered} из ${m.total}`, m.withoutOffer ? `без предложения: ${m.withoutOffer}` : 'всем отправлено') +
    tile('Потенциал допродаж', money(m.potential), 'в месяц, по рекомендуемым тарифам', 'text-emerald-600');
}

/* ---------- список (слева) ---------- */
const limPill = u => {
  const t = limTone(u.pct);
  return `<span title="${esc(u.label)}: ${u.used} из ${u.limit} (${u.pct}%)" class="px-1.5 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${t.pill}">${LIM_SHORT[u.key]} ${u.used}/${u.limit}</span>`;
};

function limRenderBulk() {
  const n = limState.checked.size, total = limState.items.length;
  const all = total > 0 && n === total;
  $('limBulk').innerHTML = `
    <label class="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
      <input type="checkbox" ${all ? 'checked' : ''} ${total ? '' : 'disabled'} onchange="limCheckAll(this.checked)" class="w-4 h-4 accent-[#3C5C73]">
      <span>${n ? `Выбрано: <strong>${n}</strong> из ${total}` : `Найдено центров: <strong>${total}</strong>`}</span>
    </label>
    ${n ? `<div class="flex items-center gap-2">
      <button onclick="limCheckAll(false)" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition">Снять выбор</button>
      <button onclick="limBulkOffer()" class="px-3.5 py-1.5 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-dark transition">Отправить предложение (${n})</button>
    </div>` : `<span class="text-[11px] text-slate-400">Отметьте центры, чтобы отправить предложение сразу нескольким</span>`}`;
}

function limRenderList() {
  limRenderBulk();
  const pg = paginate(limState.items, limState.page); limState.page = pg.page;   // страница нарезает только показ; отметки и «выбрать все» работают по всей выдаче
  $('limFooter').innerHTML = pagerHtml('limits', { page: pg.page, total: pg.total }, n => { limState.page = n; limRenderList(); });
  const items = pg.items;
  $('limList').innerHTML = items.length ? items.map(e => {
    const c = e.center, sel = c.id === limState.sel, t = limTone(e.metricPct);
    return `
    <div onclick="limSelect(${c.id})" class="px-4 py-3 flex items-center gap-3 cursor-pointer transition ${sel ? 'bg-brand-light/60 border-l-4 border-brand pl-3' : 'hover:bg-slate-50 border-l-4 border-transparent pl-3'}">
      <input type="checkbox" ${limState.checked.has(c.id) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="limCheck(${c.id}, this.checked)" class="w-4 h-4 accent-[#3C5C73] flex-shrink-0">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-slate-900 truncate">${esc(c.name)}</span>
          <span class="text-[11px] text-slate-400 whitespace-nowrap">${c.plan}</span>
        </div>
        <div class="text-[11px] text-slate-400 truncate">${esc(c.city)} · ${esc(c.owner)}</div>
        <div class="flex flex-wrap gap-1.5 mt-1.5">${c.usage.map(limPill).join('')}</div>
      </div>
      <div class="text-right flex-shrink-0 flex flex-col items-end gap-1">
        <span class="text-sm font-extrabold ${t.text}">${e.metricPct}%</span>
        ${c.pendingChange ? badge('amber', 'Ожидает оплаты') : c.offer ? badge('indigo', 'Предложено') : (e.suggestion ? `<span class="text-[11px] text-slate-500">→ ${esc(e.suggestion.name)}</span>` : `<span class="text-[11px] text-slate-400">высший тариф</span>`)}
      </div>
    </div>`;
  }).join('') : `<div class="py-12 text-center text-xs text-slate-400">Нет центров по выбранным условиям.<br>Снизьте порог или сбросьте фильтры.</div>`;
}

function limSelect(id) { limState.sel = id; limRenderList(); limRenderDetail(); }
function limCheck(id, on) { if (on) limState.checked.add(id); else limState.checked.delete(id); limRenderBulk(); }
function limCheckAll(on) { limState.checked = on ? new Set(limState.items.map(e => e.center.id)) : new Set(); limRenderList(); }

/* ---------- карточка центра (справа) ---------- */
const limEntry = () => limState.items.find(e => e.center.id === limState.sel) || null;
const limPicked = e => {
  const id = limState.picked[e.center.id];
  return e.options.find(o => o.id === id) || e.options.find(o => o.recommended) || e.options[0] || null;
};

function limUsageBar(u) {
  const t = limTone(u.pct), width = Math.min(100, u.pct), isWorst = limEntry() && limEntry().center.worst.key === u.key;
  return `<div>
    <div class="flex items-center justify-between text-xs mb-1">
      <span class="font-medium text-slate-700">${esc(u.label)}${isWorst && u.pct >= Math.round(limState.threshold * 100) ? ' <span class="text-[10px] font-bold text-rose-600 uppercase tracking-wide">ограничивает</span>' : ''}</span>
      <span class="font-semibold ${t.text}">${u.used} из ${u.limit} · ${u.pct}%</span>
    </div>
    <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden"><div class="h-full ${t.bar}" style="width:${width}%"></div></div>
  </div>`;
}

function limOptionCard(e, o, picked) {
  const on = picked && picked.id === o.id;
  return `<button type="button" onclick="limPick(${e.center.id}, '${o.id}')" class="w-full text-left p-3 rounded-xl border transition ${on ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white hover:border-brand/50'} ${o.fits ? '' : 'opacity-60'}">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="w-4 h-4 rounded-full border-2 flex items-center justify-center ${on ? 'border-brand' : 'border-slate-300'}">${on ? '<span class="w-2 h-2 rounded-full bg-brand"></span>' : ''}</span>
        <span class="text-xs font-bold text-slate-900">${esc(o.name)}</span>
        ${o.recommended ? badge('emerald', 'Рекомендуем') : ''}
        ${o.fits ? '' : badge('rose', 'Не вмещает')}
      </div>
      <div class="text-right"><div class="text-xs font-extrabold text-slate-900">${money(o.price)}/мес</div><div class="text-[11px] text-emerald-600 font-semibold">+${money(o.delta)}</div></div>
    </div>
    <div class="flex flex-wrap gap-1.5 mt-2 pl-6">${o.after.map(u => { const t = u.pct >= Math.round(NEAR_LIMIT_UI * 100) ? LIM_TONE[LIM_LEVEL(u.pct)] : LIM_TONE.ok; return `<span class="px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${t.pill}">${LIM_SHORT[u.key]} ${u.used}/${u.limit}</span>`; }).join('')}</div>
  </button>`;
}
const NEAR_LIMIT_UI = 0.8;   // только окраска «после перехода»; решение «рекомендуем» принимает сервер

function limPendingBlock(c) {
  const pc = c.pendingChange;
  return `<div class="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-3">
    <div class="text-xs font-bold text-amber-900">Счёт ${esc(pc.invoiceId)} на тариф «${esc(pc.planName)}» ожидает оплаты · ${money(pc.amount)}</div>
    <div class="text-[11px] text-amber-900 leading-relaxed">Тариф сменится после оплаты: автоматически, когда владелец оплатит онлайн, или после того, как вы подтвердите поступление оплаты вручную.</div>
    <div class="flex flex-wrap gap-2">
      <button onclick="openPaymentConfirm('${pc.invoiceId}')" class="px-4 py-2 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">Подтвердить оплату…</button>
      <button onclick="openInvoiceCancel('${pc.invoiceId}')" class="px-3 py-2 bg-white border border-slate-200 text-rose-600 rounded-xl text-xs font-medium hover:bg-rose-50 transition">Отменить счёт</button>
      <button onclick="openInvoice('${pc.invoiceId}')" class="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 transition">Открыть счёт</button>
    </div>
  </div>`;
}

function limRenderDetail() {
  const box = $('limDetail'), e = limEntry();
  if (!e) { box.innerHTML = `<div class="bg-white border border-slate-200/80 rounded-2xl p-10 shadow-xs text-center text-xs text-slate-400">Выберите центр слева</div>`; return; }
  const c = e.center, p = limPicked(e), lv = LIM_TONE[LIM_LEVEL(c.worst.pct)];
  box.innerHTML = `
    <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-extrabold text-slate-900 truncate">${esc(c.name)}</div>
          <div class="text-[11px] text-slate-500 mt-0.5">${esc(c.city)} · ${esc(c.owner)} · ${esc(c.phone)}</div>
        </div>
        <div class="flex flex-col items-end gap-1">${badge('slate', 'Сейчас: ' + c.plan)}<span class="text-[11px] font-semibold ${lv.text}">${lv.label}</span></div>
      </div>

      <div class="flex flex-col gap-3">
        <div class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Использование лимитов</div>
        ${c.usage.map(limUsageBar).join('')}
      </div>

      ${c.pendingChange ? limPendingBlock(c) : `
      ${c.offer ? `<div class="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-900">Владельцу уже отправлено предложение: тариф «<strong>${esc(c.offer.planName || '')}</strong>». Когда он согласится, выставьте счёт.</div>` : ''}
      ${e.options.length ? `
      <div class="flex flex-col gap-2">
        <div class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Куда перевести</div>
        ${e.options.map(o => limOptionCard(e, o, p)).join('')}
      </div>
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">
        ${p.fits
          ? `Будет выставлен счёт на <strong>${money(p.price)}</strong> (на ${money(p.delta)} больше текущего тарифа). Тариф сменится <strong>после оплаты</strong>: автоматически или после вашего подтверждения.`
          : `Тариф «${esc(p.name)}» не вмещает текущую нагрузку центра — выберите другой.`}
      </div>
      <div class="flex flex-wrap gap-2">
        <button onclick="limChangePlan()" ${p && p.fits ? '' : 'disabled'} class="flex-1 min-w-[10rem] px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed">Выставить счёт на «${esc(p.name)}»…</button>
        <button onclick="limOffer()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">${c.offer ? 'Отправить заново' : 'Отправить предложение'}</button>
      </div>
      ` : `<div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">У центра высший тариф. Повысить некуда — обсудите с владельцем индивидуальные условия или отдельный тариф. Сменить тариф на другой можно кнопкой ниже.</div>
      <button onclick="openPlanChange(${c.id})" class="self-start px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Сменить тариф…</button>`}
      `}

      <div class="flex items-center gap-2 pt-3 border-t border-slate-100">
        <button onclick="enterImpersonationById(${c.id})" class="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition">Войти в кабинет</button>
        <button onclick="openDrawerById(${c.id})" class="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition">Настройка модулей</button>
      </div>
    </div>`;
}

function limPick(centerId, planId) { limState.picked[centerId] = planId; limRenderDetail(); }

/* ---------- действия ---------- */
// открывает диалог: выбранный тариф и причина (по самому загруженному лимиту) подставлены, их можно поправить
function limChangePlan() {
  const e = limEntry(); if (!e) return;
  const p = limPicked(e); if (!p || !p.fits) return;
  const w = e.center.worst;
  openPlanChange(e.center.id, { planId: p.id, reason: 'Лимит «' + w.label.replace(', ГБ', '') + '» исчерпан: ' + w.used + ' из ' + w.limit + ' (' + w.pct + '%)' });
}

async function limOffer() {
  const e = limEntry(); if (!e) return;
  const p = limPicked(e); if (!p) return;
  const r = await mutate(() => api.centers.sendOffer({ ids: [e.center.id], planId: p.id }), () => 'Предложение отправлено: ' + e.center.name + ' → «' + p.name + '»');
  if (r) await renderLimits();
}

async function limBulkOffer() {
  const ids = [...limState.checked];
  if (!ids.length) return;
  const r = await mutate(() => api.centers.sendOffer({ ids }), res => 'Предложений отправлено: ' + res.sent + (res.skipped ? ' (пропущено: ' + res.skipped + ' — нет подходящего тарифа)' : ''));
  if (r) { limState.checked.clear(); await renderLimits(); }
}
