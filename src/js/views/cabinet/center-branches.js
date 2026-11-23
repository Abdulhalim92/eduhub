/* Экран кабинета центра: «Филиалы и каталог». СТОРОНА ЦЕНТРА — источник заявок для «Модерации каталога».
   Центр создаёт филиал (адрес, телефон, координаты, описания RU/TJ/EN) и отправляет его на публикацию в единый каталог на карте;
   модерация платформы сверяет координаты и описания и публикует, возвращает на доработку или отклоняет; статус и комментарий видны здесь.
   Открывается в режиме поддержки (SuperAdmin действует от имени центра, всё пишется в журнал аудита). Данные — api.cabinet.branches.*. */
registerView({
  tab: 'center-branches', path: 'center-branches',
  title: 'Филиалы и каталог', nav: { label: 'Филиалы и каталог', icon: 'pin' },
  template: `
<main id="view-center-branches" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="max-w-2xl">
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Филиалы и каталог</h1>
      <p class="text-xs text-slate-500 mt-1">Филиалы центра и их публикация на карте города для родителей. Каждый новый филиал проверяет модерация платформы</p>
    </div>
    <button onclick="openBranchForm()" class="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs transition">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>Добавить филиал
    </button>
  </div>

  <div id="brSteps" class="grid grid-cols-1 md:grid-cols-3 gap-4"></div>

  <div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[22rem]">
    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
      <div><h2 class="text-sm font-bold text-slate-900">Заявки на публикацию</h2><p id="brSub" class="text-[11px] text-slate-500 mt-0.5"></p></div>
    </div>
    <div class="overflow-x-auto flex-1">
      <table class="w-full text-left text-xs edge-table min-w-[58rem]">
        <thead>
          <tr class="text-slate-400">
            <th class="font-medium">Филиал</th>
            <th class="font-medium">Координаты</th>
            <th class="font-medium">Описания</th>
            <th class="font-medium">Статус</th>
            <th class="font-medium">Комментарий модерации</th>
            <th class="font-medium text-right">Действия</th>
          </tr>
        </thead>
        <tbody id="brBody" class="divide-y divide-slate-100 text-slate-700"></tbody>
      </table>
    </div>
  </div>
</main>
`,
  render: () => renderBranches()
});

const BR_STATUS = { pending: ['indigo', 'На модерации'], published: ['emerald', 'Опубликован на карте'], returned: ['amber', 'Возвращён на доработку'], rejected: ['rose', 'Отклонён'] };
const brState = { items: [], meta: null, center: null, cities: [] };

async function renderBranches() {
  const my = begin('center-branches'), body = $('brBody');
  body.innerHTML = skeletonRows(6, 3);
  $('brSteps').innerHTML = brStepsHtml();
  try {
    const res = await api.cabinet.branches.list(selectedCenterId);
    if (stale('center-branches', my)) return;
    Object.assign(brState, { items: res.items, meta: res.meta, center: res.center, cities: res.cities });
    $('brSub').textContent = `Тариф «${res.meta.plan}»: филиалов в каталоге и на модерации ${res.meta.used} из ${res.meta.limit}`;
    body.innerHTML = res.items.length ? res.items.map(r => {
      const st = BR_STATUS[r.status], lang = (k, label) => `<span class="px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${r.desc[k].trim().length >= 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}">${label}</span>`;
      return `
      <tr class="hover:bg-slate-50 transition cursor-pointer" onclick="openBranchForm(${r.id})">
        <td class="py-4" style="white-space:normal;min-width:13rem"><div class="font-semibold text-slate-900">${esc(r.branch)}</div><div class="text-[11px] text-slate-400">${esc(r.address)} · ${esc(r.city)}, ${esc(r.district)}</div></td>
        <td class="py-4 tabular-nums text-slate-600">${r.gps.lat.toFixed(4)}, ${r.gps.lng.toFixed(4)}</td>
        <td class="py-4"><div class="flex gap-1.5">${lang('ru', 'RU')}${lang('tj', 'TJ')}${lang('en', 'EN')}</div></td>
        <td class="py-4">${badge(st[0], st[1])}<div class="text-[11px] text-slate-400 mt-1">отправлено ${esc(r.submitted)}</div></td>
        <td class="py-4" style="white-space:normal;min-width:12rem">${r.reason ? `<span class="${r.status === 'returned' ? 'text-amber-700' : 'text-rose-600'}">${esc(r.reason)}</span>` : '<span class="text-slate-300">—</span>'}</td>
        <td class="py-4 text-right"><div class="flex items-center justify-end gap-2">
          ${r.status === 'returned' ? `<button onclick="event.stopPropagation(); openBranchForm(${r.id})" class="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark transition whitespace-nowrap">Исправить и отправить</button>` : ''}
          ${menuGear(`brMenu(this, ${r.id})`)}
        </div></td>
      </tr>`;
    }).join('') : `<tr><td colspan="6" class="py-14 text-center text-slate-400">Филиалов пока нет. Нажмите «Добавить филиал», чтобы отправить первую заявку</td></tr>`;
  } catch (e) { if (!stale('center-branches', my)) body.innerHTML = errorRow(6, e); }
}

// «Как это работает»: источник заявок для модерации и зачем она нужна
function brStepsHtml() {
  const step = (n, title, text) => `<div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex gap-3"><span class="w-7 h-7 rounded-full bg-brand-light text-brand text-xs font-extrabold flex items-center justify-center flex-shrink-0">${n}</span><div><div class="text-xs font-bold text-slate-900">${title}</div><p class="text-[11px] text-slate-500 mt-1 leading-relaxed">${text}</p></div></div>`;
  return step(1, 'Центр заполняет карточку', 'Адрес, телефон, точка на карте и описания: русский обязателен, таджикский и английский повышают находимость в поиске родителей.')
    + step(2, 'Модерация проверяет', 'Платформа сверяет координаты с адресом и проверяет описания RU и TJ, чтобы родители не приходили по неверному адресу и видели понятный текст.')
    + step(3, 'Публикация на карте', 'После публикации филиал виден в публичном каталоге. Если нужны правки, заявка вернётся сюда с комментарием, а вы исправите и отправите повторно.');
}

function brMenu(btn, id) {
  const r = brState.items.find(x => x.id === id); if (!r) return;
  openMenu(btn, [
    { label: r.status === 'returned' ? 'Исправить и отправить повторно' : 'Открыть заявку', hint: r.status === 'returned' ? 'Учтите комментарий модерации' : 'Просмотр данных, отправленных на модерацию', icon: r.status === 'returned' ? 'check' : 'open', run: () => openBranchForm(id) }
  ]);
}

/* ---------- форма заявки (боковая панель) ---------- */
const brForm = { id: null, readOnly: false, data: {}, errors: {}, busy: false, geoBusy: false, status: null, reason: '' };
const emptyBranchData = () => ({ branch: '', city: (brState.center && brState.center.city) || 'Душанбе', district: '', address: '', phone: (brState.center && brState.center.phone) || '', lat: '', lng: '', ru: '', tj: '', en: '' });

function openBranchForm(id = null) {
  const r = id ? brState.items.find(x => x.id === id) : null;
  Object.assign(brForm, { id, errors: {}, busy: false, geoBusy: false, status: r ? r.status : null, reason: r ? r.reason : '', readOnly: !!r && r.status !== 'returned' });
  brForm.data = r ? { branch: r.branch, city: r.city, district: r.district, address: r.address, phone: r.phone, lat: String(r.gps.lat), lng: String(r.gps.lng), ru: r.desc.ru, tj: r.desc.tj, en: r.desc.en } : emptyBranchData();
  openPanel('', 'branch');
  renderBranchForm();
}

function brField(key, value) {
  brForm.data[key] = value;
  const map = { lat: 'gps', lng: 'gps', ru: 'descRu' }, ek = map[key] || key;
  if (brForm.errors[ek]) { delete brForm.errors[ek]; const e = $('err-br-' + ek); if (e) e.remove(); }
}

function renderBranchForm() {
  const d = brForm.data, er = brForm.errors, ro = brForm.readOnly, cities = brState.cities.length ? brState.cities : [d.city];
  const err = k => (er[k] ? `<span id="err-br-${k}" class="text-[11px] text-rose-600">${esc(er[k])}</span>` : '');
  const cls = k => `px-3 py-2.5 bg-white border ${er[k] ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand disabled:bg-slate-50 disabled:text-slate-500`;
  const dis = ro ? 'disabled' : '';
  const field = (id, label, input, k, hint) => `<label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">${label}</span>${input}${hint ? `<span class="text-[11px] text-slate-400">${hint}</span>` : ''}${err(k)}</label>`;
  const st = brForm.status ? BR_STATUS[brForm.status] : null;
  setPanel(`
    ${panelHeader(brForm.id ? 'Заявка филиала' : 'Новый филиал', st ? badge(st[0], st[1]) : '')}
    <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
      ${brForm.status === 'returned' ? `<div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed"><strong>Модерация вернула заявку на доработку.</strong><br>${esc(brForm.reason)}</div>` : ''}
      ${brForm.status === 'rejected' ? `<div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 leading-relaxed"><strong>Заявка отклонена.</strong><br>${esc(brForm.reason)}</div>` : ''}
      ${brForm.status === 'pending' ? '<div class="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-900">Заявка на модерации: изменить её нельзя, пока модератор не вынесет решение.</div>' : ''}
      ${brForm.status === 'published' ? '<div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900">Филиал опубликован в каталоге и виден родителям.</div>' : ''}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">${field('branch', 'Название филиала <span class="text-rose-500">*</span>', `<input id="br-branch" type="text" ${dis} value="${esc(d.branch)}" placeholder="Например, Филиал «Сино»" oninput="brField('branch', this.value)" class="${cls('branch')}">`, 'branch')}</div>
        ${field('city', 'Город <span class="text-rose-500">*</span>', `<select id="br-city" ${dis} onchange="brField('city', this.value)" class="${cls('city')} cursor-pointer">${cities.map(c => `<option ${c === d.city ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`, 'city')}
        ${field('district', 'Район', `<input id="br-district" type="text" ${dis} value="${esc(d.district)}" placeholder="Например, Сино" oninput="brField('district', this.value)" class="${cls('district')}">`, 'district')}
        <div class="md:col-span-2">${field('address', 'Адрес <span class="text-rose-500">*</span>', `<input id="br-address" type="text" ${dis} value="${esc(d.address)}" placeholder="ул. Рудаки, 98" oninput="brField('address', this.value)" class="${cls('address')}">`, 'address')}</div>
        <div class="md:col-span-2">${field('phone', 'Телефон филиала <span class="text-rose-500">*</span>', `<input id="br-phone" type="tel" ${dis} value="${esc(d.phone)}" placeholder="+992 90 000 00 00" oninput="brField('phone', this.value)" class="${cls('phone')}">`, 'phone')}</div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between"><span class="text-[11px] font-semibold text-slate-600">Точка на карте <span class="text-rose-500">*</span></span>
          ${ro ? '' : `<button type="button" onclick="brGeocode()" ${brForm.geoBusy ? 'disabled' : ''} class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition disabled:opacity-60">${brForm.geoBusy ? 'Определяем…' : 'Определить по адресу'}</button>`}</div>
        <div class="grid grid-cols-2 gap-3">
          <input id="br-lat" type="number" step="0.0001" ${dis} value="${esc(d.lat)}" placeholder="Широта 38.5601" oninput="brField('lat', this.value)" class="${cls('gps')} tabular-nums">
          <input id="br-lng" type="number" step="0.0001" ${dis} value="${esc(d.lng)}" placeholder="Долгота 68.7794" oninput="brField('lng', this.value)" class="${cls('gps')} tabular-nums">
        </div>
        <span class="text-[11px] text-slate-400">Координаты определяются по адресу (в прототипе — мок геокодера). Их можно поправить: модерация сверит точку с картой.</span>
        ${err('gps')}
      </div>

      <div class="flex flex-col gap-3">
        <span class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Описание карточки в каталоге</span>
        ${field('ru', 'Русский <span class="text-rose-500">*</span>', `<textarea id="br-ru" rows="3" ${dis} oninput="brField('ru', this.value)" class="${cls('descRu')} leading-relaxed">${esc(d.ru)}</textarea>`, 'descRu', 'От 20 символов')}
        ${field('tj', 'Таджикский <span class="text-slate-400 font-normal">(нужен для публикации)</span>', `<textarea id="br-tj" rows="3" ${dis} oninput="brField('tj', this.value)" class="${cls('tj')} leading-relaxed">${esc(d.tj)}</textarea>`, 'tj', 'Модерация не опубликует карточку без таджикского описания')}
        ${field('en', 'Английский <span class="text-slate-400 font-normal">(необязательно)</span>', `<textarea id="br-en" rows="2" ${dis} oninput="brField('en', this.value)" class="${cls('en')} leading-relaxed">${esc(d.en)}</textarea>`, 'en')}
      </div>
    </div>
    <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
      <button onclick="closePanel()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">${ro ? 'Закрыть' : 'Отмена'}</button>
      ${ro ? '' : `<button onclick="brSubmit()" ${brForm.busy ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">${brForm.busy ? 'Отправляем…' : (brForm.id ? 'Отправить повторно' : 'Отправить на модерацию')}</button>`}
    </div>`);
}

async function brGeocode() {
  if (brForm.geoBusy) return;
  brForm.geoBusy = true; renderBranchForm();
  try {
    const g = await api.cabinet.branches.geocode({ city: brForm.data.city, address: brForm.data.address });
    brForm.data.lat = String(g.lat); brForm.data.lng = String(g.lng); delete brForm.errors.gps;
  } catch (e) {
    if (e instanceof ApiError && e.fields.address) brForm.errors.address = e.fields.address; else showToast(errText(e), 'error');
  }
  brForm.geoBusy = false; renderBranchForm();
}

async function brSubmit() {
  if (brForm.busy) return;
  const d = brForm.data, payload = { branch: d.branch, city: d.city, district: d.district, address: d.address, phone: d.phone, gps: { lat: d.lat, lng: d.lng }, desc: { ru: d.ru, tj: d.tj, en: d.en } };
  brForm.busy = true; renderBranchForm();
  try {
    const r = brForm.id ? await api.cabinet.branches.resubmit(selectedCenterId, brForm.id, payload) : await api.cabinet.branches.submit(selectedCenterId, payload);
    brForm.busy = false;
    showToast('Заявка «' + r.branch + '» отправлена на модерацию платформы', 'success');
    closePanel(); await renderBranches();
  } catch (e) {
    brForm.busy = false;
    if (e instanceof ApiError && e.code === 'VALIDATION' && Object.keys(e.fields).length) {
      brForm.errors = e.fields; renderBranchForm();
      const k = ['branch', 'city', 'address', 'phone', 'gps', 'descRu'].find(x => e.fields[x]), idMap = { gps: 'br-lat', descRu: 'br-ru' }, el = k && $(idMap[k] || 'br-' + k); if (el) el.focus();
    } else { renderBranchForm(); showToast(errText(e), 'error'); }
  }
}
