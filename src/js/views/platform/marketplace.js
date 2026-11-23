/* Экран: Магазин методик (B2B). Каталог готовых программ обучения, которые учебные центры покупают у платформы.
   Клик по карточке открывает страницу курса (`course-page.js`): управление, программа и материалы, покупатели, заявки. Центры подают заявки на курсы в кабинете;
   здесь вкладка «Заявки центров»: выставить счёт, списать с баланса, передать бесплатно или отклонить. Курс создаётся черновиком и публикуется при цене и хотя бы одном уроке. */
registerView({
  tab: 'marketplace', path: 'marketplace',
  title: 'Магазин методик', parent: null,
  template: `
<main id="view-marketplace" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Магазин методик (B2B)</h1>
      <p class="text-xs text-slate-500 mt-1">Создание и продажа готовых программ обучения, презентаций и тестов учебным центрам</p>
    </div>
    <button onclick="openCourseCreate()" class="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs transition">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      <span>Создать курс</span>
    </button>
  </div>
  <div id="mpTabs" class="flex flex-wrap items-center gap-6 border-b border-slate-200 text-xs font-semibold"></div>

  <div id="mpPanelCourses" class="flex flex-col gap-5">
  <div class="flex flex-wrap items-center gap-3">
    <div class="w-72 relative">
      <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input id="mpSearch" oninput="setMpQuery(this.value)" type="text" placeholder="Найти методический курс…" class="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-brand">
    </div>
    <div id="mpChips" class="flex flex-wrap items-center gap-2"></div>
    <label class="flex items-center gap-2 text-xs text-slate-500">Статус <select id="mpStatus" onchange="setMpStatus(this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"><option value="all">Любой</option><option value="published">Опубликованные</option><option value="draft">Черновики</option></select></label>
    <button id="mpReset" onclick="resetMpFilters()" class="hidden text-xs font-semibold text-brand hover:underline">Сбросить фильтры</button>
  </div>
  <div id="mpSummary" class="text-[11px] text-slate-500 -mt-3"></div>
  <div id="mpGrid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"></div>
  <div id="mpFooter" class="bg-white border border-slate-200/80 rounded-2xl overflow-hidden"></div>
  </div>

  <div id="mpPanelRequests" class="hidden flex flex-col gap-4">
    <div id="mpReqChips" class="flex flex-wrap items-center gap-2"></div>
    <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden"><div id="mpReqTable"></div><div id="mpReqFooter"></div></div>
  </div>
</main>
`,
  render: renderMarketplace
});

const mpState = { tab: 'courses', q: '', direction: 'all', status: 'all', page: 1, items: [], directions: [], reqStatus: 'new', reqPage: 1, reqCounts: null, requests: 0 };
function setMpTab(t) { mpState.tab = t; renderMarketplace(); }
const MP_PAGE_SIZE = 9;   // три карточки в ряд
const mpCreate = { title: '', direction: '', price: '', errors: {}, busy: false };
const mpAction = { id: null, kind: '', price: '', reason: '', errors: {}, busy: false };
let mpQTimer;
function setMpQuery(v) { mpState.q = v; mpState.page = 1; clearTimeout(mpQTimer); mpQTimer = setTimeout(renderMarketplace, 250); }
function setMpDirection(d) { mpState.direction = d; mpState.page = 1; renderMarketplace(); }
function setMpStatus(v) { mpState.status = v; mpState.page = 1; renderMarketplace(); }
function resetMpFilters() { Object.assign(mpState, { q: '', direction: 'all', status: 'all', page: 1 }); const i = $('mpSearch'); if (i) i.value = ''; renderMarketplace(); }

function mpCard(c) {
  const pub = c.status === 'published';
  return `
  <div onclick="openCourse(${c.id})" title="Открыть страницу курса" class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-3 cursor-pointer hover:border-brand/40 hover:shadow-md transition">
    ${mpCover(c)}
    <div class="flex-1 flex flex-col gap-2">
      <h3 class="text-base font-bold text-slate-900 leading-snug">${esc(c.title)}</h3>
      <div class="text-xs text-slate-500">${c.lessons} ${plural(c.lessons, ['урок', 'урока', 'уроков'])}${c.tests ? ' · ' + c.tests + ' ' + plural(c.tests, ['тест', 'теста', 'тестов']) : ''} · ${esc(c.note)}</div>
      <div class="h-7 flex items-center">${pub ? badge('emerald', 'Опубликован') : badge('slate', 'Черновик')}</div>
    </div>
    <div class="flex items-end justify-between pt-1">
      <div><div class="text-xl font-extrabold text-slate-900 tabular-nums">${c.price ? money(c.price) : 'Цена не задана'}</div><div class="text-[11px] text-slate-400">Купили: ${c.buyers} ${plural(c.buyers, ['центр', 'центра', 'центров'])}</div></div>
    </div>
    <div class="flex items-center gap-2" onclick="event.stopPropagation()">
      ${pub
        ? `<button onclick="openCourse(${c.id})" class="flex-1 px-4 py-2.5 bg-white border border-brand text-brand rounded-xl text-xs font-semibold hover:bg-brand-light/60 transition">Управлять</button>`
        : `<button onclick="mpPublish(${c.id})" class="flex-1 px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">Опубликовать</button>`}
      ${menuGear(`mpMenu(this, ${c.id})`)}
    </div>
  </div>`;
}

function mpMenu(btn, id) {
  const c = mpState.items.find(x => x.id === id); if (!c) return;
  const items = [{ label: 'Страница курса', hint: 'Управление, программа, материалы, покупатели', icon: 'sliders', run: () => openCourse(id) }, { label: 'Изменить цену…', hint: 'Сейчас ' + (c.price ? money(c.price) : 'не задана'), icon: 'swap', run: () => openCourseAction(id, 'price') }];
  if (c.status === 'published') items.push({ label: 'Передать центру…', hint: 'Счёт, списание с баланса или бесплатно', icon: 'plus', run: () => openCourseSell(id) });
  items.push({ label: 'Кто купил…', hint: c.buyers + ' ' + plural(c.buyers, ['центр', 'центра', 'центров']) + ' · отзыв доступа', icon: 'wallet', run: () => openCourseBuyers(id) });
  items.push(c.status === 'published'
    ? { label: 'Снять с публикации…', hint: c.buyers ? 'Купившие центры сохранят доступ' : 'Центры больше не смогут купить', icon: 'open', run: () => openCourseAction(id, 'unpublish') }
    : { label: 'Опубликовать', hint: c.publishBlockers.length ? 'Нужно: ' + c.publishBlockers.join(', ') : 'Станет доступен центрам', icon: 'plus', run: () => mpPublish(id) });
  openMenu(btn, items);
}

async function renderMarketplace() {
  const my = begin('marketplace'), grid = $('mpGrid');
  grid.innerHTML = Array.from({ length: 3 }, () => '<div class="h-80 bg-white border border-slate-200/80 rounded-2xl animate-pulse"></div>').join('');
  try {
    const { items, directions, meta, total, allTotal } = await api.marketplace.list({ q: mpState.q, direction: mpState.direction, status: mpState.status, page: mpState.page, pageSize: MP_PAGE_SIZE });
    if (stale('marketplace', my)) return;
    if (!items.length && total && mpState.page > 1) { mpState.page = Math.ceil(total / MP_PAGE_SIZE); return renderMarketplace(); }
    $('mpStatus').value = mpState.status; $('mpReset').classList.toggle('hidden', !(mpState.q || mpState.direction !== 'all' || mpState.status !== 'all'));
    $('mpFooter').innerHTML = pagerHtml('marketplace', { page: mpState.page, size: MP_PAGE_SIZE, total, note: total !== allTotal ? 'всего курсов: ' + allTotal : '' }, n => { mpState.page = n; renderMarketplace(); });
    mpState.items = items; mpState.directions = directions; mpState.requests = meta.requests;
    $('mpTabs').innerHTML = [['courses', 'Курсы'], ['requests', 'Заявки центров' + (meta.requests ? ' · ' + meta.requests : '')]].map(([k, l]) => `<button onclick="setMpTab('${k}')" class="pb-3 border-b-2 transition ${mpState.tab === k ? 'text-brand border-brand' : 'text-slate-600 hover:text-slate-900 border-transparent'}">${l}</button>`).join('');
    $('mpPanelCourses').classList.toggle('hidden', mpState.tab !== 'courses'); $('mpPanelRequests').classList.toggle('hidden', mpState.tab !== 'requests');
    if (mpState.tab === 'requests') return renderMpRequests();
    $('mpChips').innerHTML = chip(mpState.direction === 'all', 'Все направления', "setMpDirection('all')") + directions.map(d => chip(mpState.direction === d, esc(d), `setMpDirection('${esc(d)}')`)).join('');
    $('mpSummary').innerText = `Опубликовано ${meta.published} · черновиков ${meta.draft} · покупок ${meta.buyers} на ${money(meta.revenue)}`;
    grid.innerHTML = items.length ? items.map(mpCard).join('') : '<div class="md:col-span-2 xl:col-span-3 bg-white border border-slate-200/80 rounded-2xl py-14 text-center text-xs text-slate-400">Курсы не найдены. Измените направление или поиск.</div>';
  } catch (e) { if (!stale('marketplace', my)) grid.innerHTML = `<div class="md:col-span-2 xl:col-span-3 bg-white border border-slate-200/80 rounded-2xl">${errorBox(e)}</div>`; }
}


async function mpPublish(id) {
  const r = await mutate(() => api.marketplace.publish(id), c => 'Курс «' + c.title + '» опубликован: центры могут его купить');
  if (r) refreshCurrentView();
}

/* ---- создание курса ---- */
function openCourseCreate() { Object.assign(mpCreate, { title: '', direction: '', price: '', errors: {}, busy: false }); renderCourseCreate(); }
function mpField(k, v) { mpCreate[k] = v; if (mpCreate.errors[k]) { delete mpCreate.errors[k]; const e = $('err-mp-' + k); if (e) e.remove(); } }
function renderCourseCreate() {
  const er = mpCreate.errors, err = k => (er[k] ? `<span id="err-mp-${k}" class="text-[11px] text-rose-600">${esc(er[k])}</span>` : '');
  const cls = k => `px-3 py-2.5 bg-white border ${er[k] ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand`;
  openModal(`
    ${modalHeader('Новый курс', 'Курс создаётся как черновик. Наполните его в конструкторе и опубликуйте')}
    <div class="p-6 flex flex-col gap-4">
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Название <span class="text-rose-500">*</span></span><input id="mp-title" type="text" value="${esc(mpCreate.title)}" placeholder="Например, Английский язык · Уровень A2" oninput="mpField('title', this.value)" class="${cls('title')}">${err('title')}</label>
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Направление <span class="text-rose-500">*</span></span>
        <select onchange="mpField('direction', this.value)" class="${cls('direction')}"><option value="">Выберите…</option>${mpState.directions.map(d => `<option ${mpCreate.direction === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>${err('direction')}</label>
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Цена, сомони</span><input type="number" min="0" value="${esc(mpCreate.price)}" placeholder="1200" oninput="mpField('price', this.value)" class="${cls('price')} tabular-nums">${err('price')}<span class="text-[11px] text-slate-400">Можно задать позже; без цены курс не опубликовать</span></label>
      <div class="flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Отмена</button>
        <button onclick="mpCreateSubmit()" ${mpCreate.busy ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">Создать и открыть</button>
      </div>
    </div>`);
}
async function mpCreateSubmit() {
  if (mpCreate.busy) return; mpCreate.busy = true;
  try {
    const c = await api.marketplace.create({ title: mpCreate.title, direction: mpCreate.direction, price: mpCreate.price === '' ? 0 : mpCreate.price });
    closeModal(); showToast('Черновик «' + c.title + '» создан', 'success'); openCourse(c.id);
  } catch (e) {
    mpCreate.busy = false;
    if (e instanceof ApiError && e.fields && Object.keys(e.fields).length) { mpCreate.errors = e.fields; renderCourseCreate(); } else { showToast(errText(e), 'error'); renderCourseCreate(); }
  }
}

/* ---- изменить цену / снять с публикации (оба требуют причину) ---- */
const mpCourseOf = id => mpState.items.find(x => x.id === id) || (cpData.admin && cpData.admin.course.id === id ? cpData.admin.course : null);
function openCourseAction(id, kind) {
  const c = mpCourseOf(id); if (!c) return;
  Object.assign(mpAction, { id, kind, price: String(c.price || ''), reason: '', errors: {}, busy: false });
  renderCourseAction();
}
function mpActField(k, v) { mpAction[k] = v; if (mpAction.errors[k]) { delete mpAction.errors[k]; const e = $('err-mpa-' + k); if (e) e.remove(); } }
function renderCourseAction() {
  const c = mpCourseOf(mpAction.id), er = mpAction.errors, price = mpAction.kind === 'price';
  const err = k => (er[k] ? `<span id="err-mpa-${k}" class="text-[11px] text-rose-600">${esc(er[k])}</span>` : '');
  const cls = k => `px-3 py-2.5 bg-white border ${er[k] ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand`;
  openModal(`
    ${modalHeader(price ? 'Изменить цену' : 'Снять с публикации', esc(c.title))}
    <div class="p-6 flex flex-col gap-4">
      ${price ? `<label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Новая цена, сомони</span><input type="number" min="1" value="${esc(mpAction.price)}" oninput="mpActField('price', this.value)" class="${cls('price')} tabular-nums">${err('price')}<span class="text-[11px] text-slate-400">Уже купившие центры доплачивать не будут</span></label>`
        : `<div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">Курс станет черновиком и пропадёт из магазина. ${c.buyers ? 'Центры, которые уже купили его (' + c.buyers + '), сохранят доступ.' : 'Покупок пока не было.'}</div>`}
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Причина <span class="text-rose-500">*</span></span><textarea rows="2" oninput="mpActField('reason', this.value)" class="${cls('reason')}">${esc(mpAction.reason)}</textarea>${err('reason')}<span class="text-[11px] text-slate-400">Попадёт в журнал аудита</span></label>
      <div class="flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Отмена</button>
        <button onclick="mpActionSubmit()" ${mpAction.busy ? 'disabled' : ''} class="px-5 py-2.5 ${price ? 'bg-brand hover:bg-brand-dark' : 'bg-rose-600 hover:bg-rose-700'} text-white rounded-xl text-xs font-semibold transition disabled:opacity-60">${price ? 'Сохранить цену' : 'Снять с публикации'}</button>
      </div>
    </div>`);
}
async function mpActionSubmit() {
  if (mpAction.busy) return; mpAction.busy = true;
  try {
    if (mpAction.kind === 'price') await api.marketplace.setPrice(mpAction.id, { price: mpAction.price, reason: mpAction.reason });
    else await api.marketplace.unpublish(mpAction.id, { reason: mpAction.reason });
    showToast(mpAction.kind === 'price' ? 'Цена обновлена' : 'Курс снят с публикации', 'success'); closeModal(); await refreshCurrentView();
  } catch (e) {
    mpAction.busy = false;
    if (e instanceof ApiError && e.fields && Object.keys(e.fields).length) { mpAction.errors = e.fields; renderCourseAction(); } else { showToast(errText(e), 'error'); renderCourseAction(); }
  }
}

/* ---- передача курса центру ----
   Три способа: счёт (доступ появится после оплаты — онлайн, с баланса или вручную по документу), списать с баланса на платформе сразу,
   бесплатно по причине. Сам доступ создаёт api при оплате (grantCourse); покупка даёт текущую версию курса. */
const mpSell = { course: null, center: null, mode: 'invoice', reason: '', centers: [], errors: {}, formError: '', busy: false };
async function openCourseSell(id, centerId = null) {
  const c = mpCourseOf(id); if (!c) return;
  openModal(modalLoading('Передать курс центру'));
  try {
    const { items } = await api.centers.list({ limit: 500 });
    Object.assign(mpSell, { course: c, center: centerId, mode: 'invoice', reason: '', centers: items.filter(x => x.status === 'active'), errors: {}, formError: '', busy: false });
    renderCourseSell();
  } catch (e) { setModal(modalError('Передать курс центру', e)); }
}
function mpSellPick(k, v) { mpSell[k] = v; mpSell.errors = {}; mpSell.formError = ''; renderCourseSell(); }
function mpSellField(k, v) { mpSell[k] = v; if (mpSell.errors[k]) { delete mpSell.errors[k]; const e = $('err-mps-' + k); if (e) e.remove(); } }
function renderCourseSell() {
  const s = mpSell, c = s.course, er = s.errors, ce = s.centers.find(x => x.id === s.center) || null;
  const err = k => (er[k] ? `<span id="err-mps-${k}" class="text-[11px] text-rose-600">${esc(er[k])}</span>` : '');
  const cls = k => `px-3 py-2.5 bg-white border ${er[k] ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand`;
  const canBal = !!ce && ce.balance + ce.overdraftLimit >= c.price;
  const card = (mode, title, text, disabled) => { const on = s.mode === mode; return `<button type="button" ${disabled ? 'disabled' : ''} onclick="mpSellPick('mode','${mode}')" class="w-full text-left p-3 rounded-xl border transition ${on ? 'border-brand bg-brand-light/50 ring-2 ring-brand/20' : 'border-slate-200 bg-white'} ${disabled ? 'opacity-60 cursor-not-allowed' : (on ? '' : 'hover:border-brand/50')}">
    <div class="flex items-center gap-2"><span class="w-4 h-4 rounded-full border-2 flex items-center justify-center ${on ? 'border-brand' : 'border-slate-300'}">${on ? '<span class="w-2 h-2 rounded-full bg-brand"></span>' : ''}</span><span class="text-xs font-bold text-slate-900">${title}</span></div>
    <div class="text-[11px] text-slate-500 mt-1.5 pl-6 leading-relaxed">${text}</div></button>`; };
  const balText = !ce ? 'Сначала выберите центр.' : canBal ? `Баланс ${money(ce.balance)} · доступно ${money(ce.available)}. После списания: <strong>${money(ce.balance - c.price)}</strong>${ce.balance - c.price < 0 ? ' (использует овердрафт)' : ''}. Курс откроется сразу.` : `<span class="text-rose-600">Не хватает: доступно ${money(ce.available)}, нужно ${money(c.price)}.</span>`;
  setModal(`
    ${modalHeader('Передать курс центру', esc(c.title) + ' · ' + money(c.price))}
    <div class="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">Центр получит <strong>текущую версию</strong> курса (${c.lessons} ${plural(c.lessons, ['урок', 'урока', 'уроков'])}${c.tests ? ', ' + c.tests + ' ' + plural(c.tests, ['тест', 'теста', 'тестов']) : ''}). Он появится в его кабинете, раздел «Материалы и тесты». Новые версии курса продаются отдельно.</div>
      ${s.formError ? `<div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700">${esc(s.formError)}</div>` : ''}
      <label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Центр <span class="text-rose-500">*</span></span>
        <select onchange="mpSellPick('center', Number(this.value) || null)" class="${cls('centerId')}"><option value="">Выберите центр…</option>${s.centers.map(x => `<option value="${x.id}" ${x.id === s.center ? 'selected' : ''}>${esc(x.name)} · ${esc(x.city)}</option>`).join('')}</select>${err('centerId')}</label>
      <div class="flex flex-col gap-2"><span class="text-[11px] font-semibold text-slate-600">Как передать</span>
        ${card('invoice', 'Выставить счёт', 'Доступ откроется после оплаты: владелец оплатит онлайн, либо вы подтвердите оплату вручную по документу.', false)}
        ${card('balance', 'Списать с баланса на платформе', balText, !!ce && !canBal)}
        ${card('bonus', 'Передать бесплатно', 'Акция, бонус или компенсация. Причина обязательна, запись попадёт в журнал аудита.', false)}
        ${err('mode')}
        ${s.mode === 'bonus' ? `<label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">Причина <span class="text-rose-500">*</span></span><textarea rows="2" oninput="mpSellField('reason', this.value)" class="${cls('reason')}">${esc(s.reason)}</textarea>${err('reason')}</label>` : ''}</div>
      <div class="flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Отмена</button>
        <button onclick="mpSellSubmit()" ${s.busy ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">${s.mode === 'invoice' ? 'Выставить счёт' : s.mode === 'balance' ? 'Списать и передать' : 'Передать курс'}</button>
      </div>
    </div>`);
}
async function mpSellSubmit() {
  const s = mpSell; if (s.busy) return;
  if (!s.center) { s.errors = { centerId: 'Выберите центр' }; renderCourseSell(); return; }
  s.busy = true; renderCourseSell();
  try {
    const r = await api.marketplace.sell({ centerId: s.center, courseId: s.course.id, mode: s.mode, reason: s.reason });
    const cn = (s.centers.find(x => x.id === s.center) || {}).name || 'центр';
    showToast(r.mode === 'invoice' ? `Счёт ${r.invoice.id} выставлен: ${cn}. Курс откроется после оплаты` : `Курс «${s.course.title}» передан: ${cn}`, 'success');
    closeModal(); await refreshCurrentView();
  } catch (e) {
    s.busy = false;
    if (e instanceof ApiError && e.fields && Object.keys(e.fields).length) s.errors = e.fields; else s.formError = errText(e);
    renderCourseSell();
  }
}

/* ---- «Кто купил»: владельцы курса и отзыв доступа ---- */
const mpBuy = { courseId: null, data: null, revokeId: null, reason: '', error: '', busy: false };
async function openCourseBuyers(id) {
  mpBuy.courseId = id; mpBuy.revokeId = null; mpBuy.reason = ''; mpBuy.error = '';
  openModal(modalLoading('Кто купил курс'));
  await mpBuyLoad();
}
async function mpBuyLoad() {
  try { mpBuy.data = await api.marketplace.buyers(mpBuy.courseId); renderCourseBuyers(); }
  catch (e) { setModal(modalError('Кто купил курс', e)); }
}
function renderCourseBuyers() {
  const { course, items, other } = mpBuy.data;
  setModal(`
    ${modalHeader('Кто купил курс', esc(course.title))}
    <div class="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
      <div class="text-xs text-slate-600">Центров с доступом: <strong class="text-slate-900">${items.filter(a => a.status === 'active').length}</strong>${other ? ` · ещё ${other} ${plural(other, ['центр', 'центра', 'центров'])} вне демо-данных` : ''}</div>
      ${mpBuy.revokeId ? `<div class="p-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-col gap-2">
        <div class="text-xs font-semibold text-rose-800">Отозвать доступ: ${esc((items.find(a => a.id === mpBuy.revokeId) || {}).centerName)}</div>
        <textarea id="mp-revoke-reason" rows="2" oninput="mpBuy.reason = this.value; mpBuy.error = ''" placeholder="Причина (например, возврат денег). Центр потеряет доступ к курсу" class="px-3 py-2 bg-white border ${mpBuy.error ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none">${esc(mpBuy.reason)}</textarea>
        ${mpBuy.error ? `<span class="text-[11px] text-rose-600">${esc(mpBuy.error)}</span>` : ''}
        <div class="flex justify-end gap-2"><button onclick="mpBuy.revokeId = null; renderCourseBuyers()" class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">Отмена</button>
        <button onclick="mpRevokeSubmit()" ${mpBuy.busy ? 'disabled' : ''} class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold">Отозвать доступ</button></div></div>` : ''}
      <div class="border border-slate-200 rounded-xl overflow-hidden"><table class="w-full text-left text-xs"><thead><tr class="text-slate-400"><th class="font-medium">Центр</th><th class="font-medium">Получен</th><th class="font-medium">Основание</th><th class="font-medium text-right">Доступ</th></tr></thead>
        <tbody class="divide-y divide-slate-100">${items.length ? items.map(a => `<tr>
          <td class="py-3"><div class="font-semibold text-slate-900">${esc(a.centerName)}</div><div class="text-[11px] text-slate-400">${esc(a.city)}</div></td>
          <td class="py-3 text-slate-600">${new Date(a.grantedAt).toLocaleDateString('ru-RU')}<div class="text-[11px] text-slate-400">${a.version.lessons} ${plural(a.version.lessons, ['урок', 'урока', 'уроков'])}</div></td>
          <td class="py-3">${badge(MP_SOURCE[a.source][0], MP_SOURCE[a.source][1])}<div class="text-[11px] text-slate-400 mt-1">${esc(a.invoiceId || a.reason)}</div></td>
          <td class="py-3 text-right">${a.status === 'active' ? `<button onclick="mpBuy.revokeId = ${a.id}; mpBuy.reason = ''; mpBuy.error = ''; renderCourseBuyers()" class="text-xs font-semibold text-rose-600 hover:underline">Отозвать…</button>` : `<span class="text-[11px] text-slate-400">отозван ${new Date(a.revokedAt).toLocaleDateString('ru-RU')}</span><div class="text-[11px] text-slate-400">${esc(a.revokeReason)}</div>`}</td></tr>`).join('') : '<tr><td colspan="4" class="py-8 text-center text-slate-400">Среди центров демо-данных курс пока никто не получил</td></tr>'}</tbody></table></div>
      <div class="flex justify-end"><button onclick="closeModal()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Закрыть</button></div>
    </div>`);
}
async function mpRevokeSubmit() {
  if (mpBuy.busy) return; mpBuy.busy = true;
  try { await api.marketplace.revoke(mpBuy.revokeId, { reason: mpBuy.reason }); showToast('Доступ к курсу отозван', 'success'); mpBuy.revokeId = null; mpBuy.busy = false; await mpBuyLoad(); refreshCurrentView(); }
  catch (e) { mpBuy.busy = false; mpBuy.error = e instanceof ApiError && e.fields && e.fields.reason ? e.fields.reason : errText(e); renderCourseBuyers(); }
}

/* ---- заявки центров на получение курса ---- */
const MP_REQ_STATUS = { new: ['amber', 'Новая'], invoiced: ['indigo', 'Счёт выставлен'], fulfilled: ['emerald', 'Выполнена'], rejected: ['rose', 'Отклонена'] };
const mpReqCache = new Map();
function mpRequestsTable(items) {
  items.forEach(r => mpReqCache.set(r.id, r));
  return `<div class="overflow-x-auto"><table class="w-full text-left text-xs edge-table min-w-[52rem]">
    <thead><tr class="text-slate-400"><th class="font-medium">Центр</th><th class="font-medium">Курс</th><th class="font-medium">Заявка</th><th class="font-medium">Статус</th><th class="font-medium text-right">Действия</th></tr></thead>
    <tbody class="divide-y divide-slate-100 text-slate-700">${items.length ? items.map(r => {
      const st = MP_REQ_STATUS[r.status], c = r.course;
      const primary = r.status === 'new' ? `<button onclick="mpReqProcess(${r.id}, 'invoice')" class="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark transition whitespace-nowrap">Выставить счёт</button>`
        : r.status === 'invoiced' && r.invoice ? `<button onclick="openPaymentConfirm('${r.invoice.id}')" class="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark transition whitespace-nowrap">Подтвердить оплату</button>` : '';
      return `<tr class="hover:bg-slate-50 transition">
        <td class="py-3.5" style="white-space:normal;min-width:11rem"><div class="font-semibold text-slate-900">${esc(r.centerName)}</div><div class="text-[11px] text-slate-400">${esc(r.city)}</div></td>
        <td class="py-3.5" style="white-space:normal;min-width:12rem"><button onclick="openCourse(${c.id})" class="font-semibold text-slate-900 hover:text-brand hover:underline text-left">${esc(c.title)}</button><div class="text-[11px] text-slate-400">${money(c.price)}</div></td>
        <td class="py-3.5" style="white-space:normal;min-width:12rem"><div class="text-slate-600">${new Date(r.createdAt).toLocaleDateString('ru-RU')}</div>${r.note ? `<div class="text-[11px] text-slate-500 mt-0.5">«${esc(r.note)}»</div>` : ''}</td>
        <td class="py-3.5" style="white-space:normal">${badge(st[0], st[1])}${r.invoice ? `<div class="text-[11px] text-slate-400 mt-1">${esc(r.invoice.id)}${r.invoice.status === 'paid' ? ' · оплачен' : ' · ждёт оплаты'}</div>` : ''}${r.status === 'rejected' ? `<div class="text-[11px] text-slate-500 mt-1">${esc(r.reason)}</div>` : ''}</td>
        <td class="py-3.5 text-right"><div class="flex items-center justify-end gap-2">${primary}${menuGear(`mpReqMenu(this, ${r.id})`)}</div></td></tr>`;
    }).join('') : '<tr><td colspan="5" class="py-12 text-center text-slate-400">Заявок нет</td></tr>'}</tbody></table></div>`;
}
function mpReqMenu(btn, id) {
  const r = mpReqCache.get(id); if (!r) return;
  const items = [];
  if (r.status === 'new') items.push(
    { label: 'Списать с баланса на платформе', hint: 'Курс откроется сразу, если хватает средств', icon: 'wallet', run: () => mpReqProcess(id, 'balance') },
    { label: 'Передать бесплатно…', hint: 'Бонус или компенсация, нужна причина', icon: 'plus', run: () => mpReqProcess(id, 'bonus') },
    { label: 'Отклонить…', hint: 'Причину увидит центр', icon: 'open', run: () => mpReqProcess(id, 'reject') }, { divider: true });
  if (r.invoice) items.push({ label: 'Подробности счёта', hint: r.invoice.id, icon: 'open', run: () => openInvoice(r.invoice.id) });
  items.push({ label: 'Страница курса', hint: r.course.title, icon: 'sliders', run: () => openCourse(r.course.id) });
  openMenu(btn, items);
}
function mpReqProcess(id, action) {
  const r = mpReqCache.get(id); if (!r) return;
  if (action === 'invoice' || action === 'balance') {
    return mutate(() => api.marketplace.requests.process(id, { action }), x => action === 'invoice' ? `Счёт ${x.invoice.id} выставлен: ${x.centerName}. Курс откроется после оплаты` : `Курс «${x.course.title}» передан: ${x.centerName}`).then(ok => { if (ok) refreshCurrentView(); });
  }
  const bonus = action === 'bonus';
  openForm({ title: bonus ? 'Передать курс бесплатно' : 'Отклонить заявку', sub: r.centerName + ' · ' + r.course.title, danger: !bonus, submitLabel: bonus ? 'Передать курс' : 'Отклонить',
    note: bonus ? 'Курс откроется у центра сразу. Причина попадёт в журнал аудита.' : 'Центр увидит причину в своём кабинете.',
    fields: [{ key: 'reason', label: 'Причина', type: 'textarea', rows: 2, required: true, placeholder: bonus ? 'Например, акция к Новрузу' : 'Например, центр заблокирован' }],
    onSubmit: async v => { await api.marketplace.requests.process(id, { action, reason: v.reason }); showToast(bonus ? 'Курс передан центру' : 'Заявка отклонена', 'success'); await refreshCurrentView(); } });
}
async function renderMpRequests() {
  const my = begin('marketplace');
  try {
    const res = await api.marketplace.requests.list({ status: mpState.reqStatus, page: mpState.reqPage, pageSize: PAGE_SIZE });
    if (stale('marketplace', my)) return;
    if (!res.items.length && res.total && mpState.reqPage > 1) { mpState.reqPage = Math.ceil(res.total / PAGE_SIZE); return renderMpRequests(); }
    const c = res.counts; mpState.reqCounts = c;
    $('mpReqChips').innerHTML = chip(mpState.reqStatus === 'new', `Новые · ${c.new}`, "setMpReqStatus('new')") + chip(mpState.reqStatus === 'invoiced', `Счёт выставлен · ${c.invoiced}`, "setMpReqStatus('invoiced')") + chip(mpState.reqStatus === 'fulfilled', `Выполнены · ${c.fulfilled}`, "setMpReqStatus('fulfilled')") + chip(mpState.reqStatus === 'rejected', `Отклонены · ${c.rejected}`, "setMpReqStatus('rejected')") + chip(mpState.reqStatus === 'all', 'Все', "setMpReqStatus('all')");
    $('mpReqTable').innerHTML = mpRequestsTable(res.items);
    $('mpReqFooter').innerHTML = pagerHtml('mp-requests', { page: mpState.reqPage, total: res.total }, n => { mpState.reqPage = n; renderMpRequests(); });
  } catch (e) { if (!stale('marketplace', my)) $('mpReqTable').innerHTML = errorBox(e); }
}
function setMpReqStatus(v) { mpState.reqStatus = v; mpState.reqPage = 1; renderMpRequests(); }
