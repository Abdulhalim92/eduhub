/* Экран: Модерация каталога (split-screen) */
registerView({
  tab: 'moderation', path: 'moderation',
  title: 'Модерация каталога', parent: ['Требует внимания', null],
  template: `
<main id="view-moderation" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Модерация каталога на карте</h1>
      <p class="text-xs text-slate-500 mt-1">Проверка координат филиалов, описаний и публикация центров для родителей</p>
    </div>
  </div>
  <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
    <div class="xl:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
      <h3 id="modListTitle" class="text-base font-bold text-slate-900">Заявки на публикацию</h3>
      <div id="modTabs" class="flex items-center gap-2"></div>
      <div id="modList" class="flex flex-col gap-2"></div>
      <div id="modFooter" class="-mx-5 -mb-5 mt-1 rounded-b-2xl overflow-hidden"></div>
    </div>
    <div id="modDetail" class="xl:col-span-7 flex flex-col gap-4"></div>
  </div>
</main>
`,
  render: renderModeration
});

const modState = { page: 1, tab: 'pending', sel: null, panel: null, lang: 'ru', items: [], meta: { pending: 0, processed: 0 }, drafts: {} };
const MOD_STATUS = { pending: ['amber', 'На проверке'], published: ['emerald', 'Опубликован'], returned: ['amber', 'На доработке'], rejected: ['rose', 'Отклонён'] };

function distM(a, b) {
  const R = 6371000, rad = x => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function modDraft(r) { return modState.drafts[r.id] || (modState.drafts[r.id] = { desc: { ...r.desc }, gps: { ...r.gps }, gpsOk: false }); }
const modRaw = () => modState.items.find(x => x.id === modState.sel) || null;
function modView(r) { const d = modDraft(r); return { ...r, desc: d.desc, gps: d.gps, gpsOk: d.gpsOk }; }
const modReq = () => { const r = modRaw(); return r ? modView(r) : null; };
// UX-дубль серверного правила: нужен, чтобы заранее отключить кнопку и объяснить причину
const modGate = r => {
  const blockers = [];
  if (r.desc.ru.trim().length < 20) blockers.push('описание RU обязательно (от 20 символов)');
  if (r.desc.tj.trim().length < 20) blockers.push('описание TJ обязательно (от 20 символов)');
  if (!r.gpsOk) blockers.push('подтвердите координаты на карте');
  return blockers;
};

async function renderModeration() {
  const my = begin('moderation');
  if (!modState.items.length) {
    $('modList').innerHTML = Array.from({ length: 3 }, () => '<div class="h-16 bg-slate-100 rounded-xl animate-pulse"></div>').join('');
    $('modDetail').innerHTML = '';
  }
  try {
    const [res] = await Promise.all([api.moderation.list({ status: modState.tab }), refreshAttention()]);
    if (stale('moderation', my)) return;
    modState.items = res.items; modState.meta = res.meta;
    renderModerationView();
  } catch (e) { if (!stale('moderation', my)) { $('modList').innerHTML = errorBox(e); $('modDetail').innerHTML = ''; } }
}

// синхронная перерисовка из уже загруженного состояния (без запроса)
function renderModerationView() {
  const list = modState.items;
  $('modTabs').innerHTML =
    chip(modState.tab === 'pending', `Ожидают · ${modState.meta.pending}`, "setModTab('pending')") +
    chip(modState.tab === 'processed', `Обработаны · ${modState.meta.processed}`, "setModTab('processed')");
  if (!list.some(r => r.id === modState.sel)) modState.sel = list.length ? list[0].id : null;

  $('modListTitle').innerText = 'Заявки на публикацию (' + (modState.tab === 'pending' ? modState.meta.pending : modState.meta.processed) + ')';
  const pg = paginate(list, modState.page); modState.page = pg.page;
  $('modFooter').innerHTML = pg.pages > 1 ? pagerHtml('moderation', { page: pg.page, total: pg.total }, n => { modState.page = n; renderModerationView(); }) : '';
  $('modList').innerHTML = list.length ? pg.items.map(raw => {
    const r = modView(raw), warn = distM(r.gps, r.geo) > 150, noTj = r.desc.tj.trim().length < 20, st = MOD_STATUS[r.status];
    return `<div onclick="selectMod(${r.id})" class="p-4 border rounded-xl cursor-pointer transition ${r.id === modState.sel ? 'border-brand bg-brand-light/50 ring-2 ring-brand/15' : 'border-slate-200 bg-white hover:border-brand/50'}">
      <div class="text-sm font-bold text-slate-900 leading-snug">${esc(r.centerName)} — ${esc(r.branch)}</div>
      <div class="text-xs text-slate-600 mt-1">${esc(r.address)}, ${esc(r.city)}</div>
      <div class="text-xs text-slate-500 mt-0.5">Направления: ${r.directions.map(esc).join(', ')}</div>
      <div class="flex flex-wrap items-center gap-1.5 mt-2.5">${badge(st[0], st[1])}${r.status === 'pending' && warn ? badge('amber', 'GPS расходится') : ''}${r.status === 'pending' && noTj ? badge('rose', 'Нет TJ') : ''}<span class="text-[11px] text-slate-400 ml-auto">${esc(r.submitted)}</span></div>
    </div>`;
  }).join('') : `<div class="py-10 text-center text-xs text-slate-400">${modState.tab === 'pending' ? 'Все заявки обработаны' : 'Пока ничего не обработано'}</div>`;

  renderModDetail();
}

function setModTab(t) { modState.page = 1; modState.tab = t; modState.panel = null; modState.sel = null; modState.items = []; renderModeration(); }
function selectMod(id) { modState.sel = id; modState.panel = null; renderModerationView(); }
function setModLang(l) { modState.lang = l; renderModDetail(); }

const shortTxt = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;
function modMapSvg(r) {
  const S = 0.45, mx = (p) => { const dx = (p.lng - r.geo.lng) * 111320 * Math.cos(r.geo.lat * Math.PI / 180), dy = (p.lat - r.geo.lat) * 110540; return [Math.max(24, Math.min(576, 300 + dx * S)), Math.max(24, Math.min(336, 180 - dy * S))]; };
  const g = mx(r.geo), d = mx(r.gps), dist = Math.round(distM(r.gps, r.geo)), R = 100 * S;
  return `<svg viewBox="0 0 600 360" class="w-full h-64 rounded-xl border border-slate-200 bg-[#eef1ee]">
    <rect width="600" height="360" fill="#eef1ee"/>
    <path d="M-10 300 C 120 250, 220 330, 330 290 S 520 230, 620 270 L620 330 C 520 290, 420 350, 330 340 S 100 300, -10 350Z" fill="#cfe3f2"/>
    <rect x="30" y="30" width="110" height="70" rx="8" fill="#dcebd5"/><rect x="440" y="40" width="120" height="90" rx="8" fill="#dcebd5"/>
    <g fill="#e2e6e2"><rect x="170" y="40" width="70" height="50" rx="4"/><rect x="260" y="40" width="60" height="50" rx="4"/><rect x="350" y="150" width="70" height="60" rx="4"/><rect x="60" y="140" width="80" height="60" rx="4"/><rect x="450" y="160" width="90" height="60" rx="4"/><rect x="160" y="150" width="90" height="60" rx="4"/></g>
    <g stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"><path d="M0 120 H600"/><path d="M0 225 H600"/><path d="M150 0 V360"/><path d="M335 0 V360"/><path d="M0 40 L600 205" stroke-width="6"/></g>
    <circle cx="${d[0]}" cy="${d[1]}" r="${R}" fill="#3C5C73" fill-opacity=".10" stroke="#3C5C73" stroke-dasharray="4 3"/>
    ${dist > 5 ? `<line x1="${g[0]}" y1="${g[1]}" x2="${d[0]}" y2="${d[1]}" stroke="#94a3b8" stroke-dasharray="3 3"/>` : ''}
    <g><circle cx="${g[0]}" cy="${g[1]}" r="7" fill="#10b981" stroke="#fff" stroke-width="2.5"/></g>
    <g><circle cx="${d[0]}" cy="${d[1]}" r="9" fill="#3C5C73" stroke="#fff" stroke-width="3"/></g>
    <g font-family="Inter, sans-serif"><rect x="${Math.max(8, Math.min(322, d[0] - 135))}" y="${Math.max(8, d[1] - 62)}" width="270" height="46" rx="9" fill="#fff" stroke="#cbd5e1"/>
      <text x="${Math.max(8, Math.min(322, d[0] - 135)) + 10}" y="${Math.max(8, d[1] - 62) + 19}" font-size="11" font-weight="700" fill="#0f172a">${esc(shortTxt(r.centerName + ' — ' + r.branch, 42))}</text>
      <text x="${Math.max(8, Math.min(322, d[0] - 135)) + 10}" y="${Math.max(8, d[1] - 62) + 35}" font-size="10" fill="#64748b">${esc(shortTxt(r.address, 48))}</text></g>
    <g font-family="Inter, sans-serif" font-size="11" font-weight="600"><rect x="12" y="332" width="210" height="18" rx="6" fill="#fff" fill-opacity=".9"/><text x="20" y="345" fill="#334155"><tspan fill="#3C5C73">●</tspan> указано центром   <tspan fill="#10b981">●</tspan> адрес по геокодеру</text></g>
    <g><rect x="500" y="332" width="${100 * S + 20}" height="18" rx="6" fill="#fff" fill-opacity=".9"/><line x1="510" y1="346" x2="${510 + 100 * S}" y2="346" stroke="#334155" stroke-width="2"/><text x="${512 + 100 * S}" y="344" font-size="9" fill="#334155" font-family="Inter, sans-serif">100 м</text></g>
  </svg>`;
}

const fmtCoord = (v, pos, neg) => Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? pos : neg);
function modChecksHtml(r) {
  const dist = Math.round(distM(r.gps, r.geo));
  const ico = ok => `<span class="mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${ok === true ? 'bg-emerald-100 text-emerald-600' : ok === false ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}">${ok === true ? '✓' : ok === false ? '✕' : '!'}</span>`;
  const editable = r.status === 'pending';
  const descRow = (l, label, required) => {
    const v = r.desc[l], ok = v.trim().length >= 20 ? true : (required ? false : null);
    return `<div class="flex items-start gap-2.5">${ico(ok)}<div class="flex-1 min-w-0"><div class="text-xs font-semibold text-slate-800 mb-1">${label}${required ? '' : ' <span class="font-normal text-slate-400">(необязательно)</span>'}</div>
      ${editable ? `<textarea rows="2" oninput="modSetDescLang('${l}', this.value)" placeholder="Описание на ${l.toUpperCase()} ещё не заполнено" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs leading-relaxed focus:outline-none focus:border-brand">${esc(v)}</textarea>`
        : `<div class="text-xs text-slate-600 leading-relaxed">${esc(v) || '<span class="text-slate-400">не заполнено</span>'}</div>`}</div></div>`;
  };
  return `<div class="flex flex-col gap-3">
    <div class="flex items-start gap-2.5">${ico(dist <= 150 ? true : null)}<div class="text-xs text-slate-700"><span class="font-semibold text-slate-800">Адрес</span> ${dist <= 150 ? `<span class="ml-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-brand text-[11px] font-medium">Проверено по базе · расхождение ${dist} м</span>` : `<span class="ml-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[11px] font-medium">Расхождение с геокодером ${dist} м (порог 150 м)</span>`}</div></div>
    ${descRow('ru', 'Описание RU', true)}
    ${descRow('tj', 'Описание TJ', true)}
    ${descRow('en', 'Описание EN', false)}
    <div class="flex items-start gap-2.5">${ico(!!r.phone)}<div class="text-xs text-slate-700"><span class="font-semibold text-slate-800">Контактный телефон</span> <span class="text-slate-500 ml-1.5">${esc(r.phone) || 'не указан'}</span></div></div>
  </div>`;
}

function modActionsHtml(r) {
  if (r.status !== 'pending') {
    const st = MOD_STATUS[r.status];
    return `<div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex flex-col gap-1">${badge(st[0], st[1])}${r.reason ? `<div class="text-[11px] text-slate-500">Причина: ${esc(r.reason)}</div>` : ''}</div>
      <button onclick="modRequeue(${r.id})" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Вернуть в очередь</button>
    </div>`;
  }
  const blockers = modGate(r), ok = !blockers.length;
  return `
    <label class="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer mb-3">
      <input type="checkbox" ${r.gpsOk ? 'checked' : ''} onchange="modToggleGps(this.checked)" class="w-4 h-4 accent-[#3C5C73]">
      Я проверил(а) координаты на карте: пин стоит на нужном здании
    </label>
    ${modState.panel ? `<div class="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-3">
      <div class="text-xs font-semibold text-slate-800 mb-2">${modState.panel === 'return' ? 'Что нужно исправить' : 'Причина отклонения'}</div>
      <textarea id="modReason" rows="2" placeholder="Опишите причину — её увидит владелец центра" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand"></textarea>
      <div class="flex justify-end gap-2 mt-2">
        <button onclick="modState.panel=null; renderModDetail()" class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">Отмена</button>
        <button onclick="modDecideWithReason('${modState.panel === 'return' ? 'returned' : 'rejected'}')" class="px-3 py-1.5 ${modState.panel === 'return' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-600 hover:bg-rose-700'} text-white rounded-lg text-xs font-semibold">${modState.panel === 'return' ? 'Вернуть на доработку' : 'Отклонить'}</button>
      </div></div>` : ''}
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="text-[11px] ${ok ? 'text-emerald-600' : 'text-slate-500'}">${ok ? 'Все условия публикации выполнены' : 'Для публикации: ' + blockers.join('; ')}</div>
      <div class="flex gap-2">
        <button onclick="modOpenPanel('reject')" class="px-4 py-2.5 bg-white border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold hover:bg-rose-50 transition">Отклонить с комментарием</button>
        <button onclick="modOpenPanel('return')" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Вернуть на доработку</button>
        <button onclick="modPublish()" ${ok ? '' : 'disabled'} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-40 disabled:cursor-not-allowed">Одобрить и опубликовать</button>
      </div>
    </div>`;
}

function renderModDetail() {
  const box = $('modDetail'), r = modReq();
  if (!r) { box.innerHTML = `<div class="bg-white border border-slate-200/80 rounded-2xl p-10 shadow-xs text-center text-xs text-slate-400">Выберите заявку слева</div>`; return; }
  const st = MOD_STATUS[r.status], editable = r.status === 'pending';
  box.innerHTML = `
    <div class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
      <div class="flex items-start justify-between gap-3">
        <div><h3 class="text-base font-bold text-slate-900">Предпросмотр карточки и GPS-точки</h3>
        <div class="text-[11px] text-slate-400 mt-1">Заявка центра · отправил(а) ${esc(r.submittedBy)} · ${esc(r.submitted)}${r.decidedAt ? ' · решение ' + fmtDay(r.decidedAt) : ''} · ${esc(r.phone)}</div></div>
        ${badge(st[0], st[1])}
      </div>
      ${modMapSvg(r)}
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
        <div class="text-xs text-slate-700">Координаты: <span class="font-semibold tabular-nums">${fmtCoord(r.gps.lat, 'N', 'S')}, ${fmtCoord(r.gps.lng, 'E', 'W')}</span></div>
        <button onclick="modCopyCoords()" title="Скопировать координаты" aria-label="Скопировать координаты" class="p-1.5 rounded-lg text-slate-500 hover:text-brand hover:bg-white transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button>
      </div>
      ${editable ? `<div class="grid grid-cols-2 gap-3 max-w-sm">
        <label class="flex flex-col gap-1"><span class="text-[11px] font-semibold text-slate-600">Широта</span><input type="number" step="0.0001" value="${r.gps.lat}" onchange="modSetCoord('lat', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand tabular-nums"></label>
        <label class="flex flex-col gap-1"><span class="text-[11px] font-semibold text-slate-600">Долгота</span><input type="number" step="0.0001" value="${r.gps.lng}" onchange="modSetCoord('lng', this.value)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand tabular-nums"></label>
      </div>` : ''}
      <div id="modChecks">${modChecksHtml(r)}</div>
      <div id="modActions" class="pt-3 border-t border-slate-100">${modActionsHtml(r)}</div>
    </div>`;
}
function modSetDescLang(l, v) { modState.lang = l; modSetDesc(v); }
async function modCopyCoords() {
  const r = modReq(); if (!r) return;
  const t = r.gps.lat.toFixed(4) + ', ' + r.gps.lng.toFixed(4);
  try { await navigator.clipboard.writeText(t); showToast('Координаты скопированы: ' + t, 'success'); } catch (e) { showToast('Координаты: ' + t + ' (скопируйте вручную)', 'info'); }
}

function modRefreshGate() {
  const r = modReq(); if (!r) return;
  const active = document.activeElement; if (!(active && active.tagName === 'TEXTAREA' && $('modChecks').contains(active))) $('modChecks').innerHTML = modChecksHtml(r);   // не пересобираем поле, в которое сейчас печатают
  const reason = $('modReason'), keep = reason ? reason.value : '';
  $('modActions').innerHTML = modActionsHtml(r);
  const r2 = $('modReason'); if (r2) r2.value = keep;
}
function modSetDesc(v) { const raw = modRaw(); if (!raw) return; modDraft(raw).desc[modState.lang] = v; modRefreshGate(); }
function modToggleGps(v) { const raw = modRaw(); if (!raw) return; modDraft(raw).gpsOk = v; modRefreshGate(); }
function modSetCoord(k, v) {
  const n = parseFloat(v), raw = modRaw(); if (isNaN(n) || !raw) return;
  const d = modDraft(raw); d.gps[k] = n; d.gpsOk = false; renderModerationView();
}
function modOpenPanel(p) { modState.panel = p; renderModDetail(); const t = $('modReason'); if (t) t.focus(); }

async function modDecide(decision, reason = '') {
  const raw = modRaw(); if (!raw) return;
  const d = modDraft(raw), label = raw.branch + ' (' + raw.centerName + ')';
  const toasts = { published: [label + ' опубликован в каталоге', 'success'], returned: ['Заявка возвращена на доработку', 'info'], rejected: ['Заявка отклонена', 'error'] };
  const ok = await mutate(() => api.moderation.decide(raw.id, { decision, reason, desc: d.desc, gps: d.gps, gpsConfirmed: d.gpsOk }), toasts[decision][0], toasts[decision][1]);
  if (ok) { delete modState.drafts[raw.id]; modState.panel = null; modState.sel = null; await renderModeration(); }
}
function modPublish() { const r = modReq(); if (!r || modGate(r).length) return; return modDecide('published'); }
function modDecideWithReason(decision) {
  const reason = ($('modReason').value || '').trim();
  if (reason.length < 5) { showToast('Укажите причину (минимум 5 символов)', 'error'); return; }
  return modDecide(decision, reason);
}
async function modRequeue(id) {
  const ok = await mutate(() => api.moderation.requeue(id), 'Заявка возвращена в очередь модерации', 'info');
  if (!ok) return;
  delete modState.drafts[id];
  modState.tab = 'pending'; modState.sel = id; modState.items = [];
  await renderModeration();
}
