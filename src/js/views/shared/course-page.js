/* Страница курса — один исполнитель для двух экранов:
   • `course` (SuperAdmin, из «Магазина методик»): данные курса, публикация и цена, программа «модули → уроки → материалы» с редактированием,
     покупатели (выдача и отзыв доступа) и заявки центров на этот курс;
   • `center-course` (кабинет центра): купленный курс — только просмотр программы и материалов; собственный курс центра — полное редактирование.
   Права проверяет api (courses.*: SuperAdmin правит платформенные курсы, центр — только свои). */
const cpTpl = (p, tab) => `<main id="view-${tab}" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn"><div id="${p}Head"></div><div id="${p}Tabs" class="flex flex-wrap items-center gap-6 border-b border-slate-200 text-xs font-semibold"></div><div id="${p}Body" class="flex flex-col gap-5"></div></main>`;
registerView({ tab: 'course', path: 'course', title: 'Страница курса', parent: ['Магазин методик', 'marketplace'], template: cpTpl('cp', 'course'), render: () => renderCoursePage('admin') });
registerView({ tab: 'center-course', path: 'center-course', title: 'Курс', parent: ['Материалы и тесты', 'center-courses'], template: cpTpl('cpc', 'center-course'), render: () => renderCoursePage('center') });

const CP = { admin: { p: 'cp', view: 'course', back: 'marketplace', backLabel: 'Магазин методик' }, center: { p: 'cpc', view: 'center-course', back: 'center-courses', backLabel: 'Материалы и тесты' } };
const cpData = { admin: null, center: null };          // последняя загрузка страницы: { course, content, stats, canEdit, kind, access }
const cpExtra = { admin: { buyers: null, requests: null } };
const cpState = { admin: { id: null, tab: 'overview', open: null }, center: { id: null, tab: 'overview', open: null } };
const CP_MAT = { plan: ['bg-sky-100 text-sky-800', 'План'], video: ['bg-indigo-100 text-indigo-800', 'Видео'], pdf: ['bg-rose-100 text-rose-700', 'PDF'], slides: ['bg-amber-100 text-amber-800', 'Слайды'], test: ['bg-emerald-100 text-emerald-800', 'Тест'] };
const CP_STATUS = { published: ['emerald', 'Опубликован'], draft: ['slate', 'Черновик'], private: ['indigo', 'Собственный курс'] };

function openCourse(id, tab = 'overview') { Object.assign(cpState.admin, { id, tab, open: null }); switchTab('course'); }
function openCenterCourse(id, tab = 'overview') { Object.assign(cpState.center, { id, tab, open: null }); switchTab('center-course'); }
const cpCtx = mode => (mode === 'center' ? { centerId: selectedCenterId } : {});

async function renderCoursePage(mode) {
  const C = CP[mode], st = cpState[mode], my = begin(C.view);
  if (!st.id) { switchTab(C.back); return; }
  $(C.p + 'Body').innerHTML = '<div class="h-48 bg-white border border-slate-200/80 rounded-2xl animate-pulse"></div>';
  try {
    const d = await api.courses.get(st.id, cpCtx(mode));
    if (mode === 'admin') { const [b, r] = await Promise.all([api.marketplace.buyers(st.id), api.marketplace.requests.list({ courseId: st.id })]); if (stale(C.view, my)) return; cpExtra.admin = { buyers: b, requests: r }; }
    if (stale(C.view, my)) return;
    cpData[mode] = d; cpPaint(mode);
  } catch (e) {
    if (stale(C.view, my)) return;
    $(C.p + 'Head').innerHTML = '';
    $(C.p + 'Body').innerHTML = `<div class="bg-white border border-slate-200/80 rounded-2xl">${errorBox(e)}<div class="pb-6 text-center"><button onclick="switchTab('${C.back}')" class="text-xs font-semibold text-brand hover:underline">← ${C.backLabel}</button></div></div>`;
  }
}

function cpPaint(mode) {
  const C = CP[mode], d = cpData[mode], c = d.course, st = cpState[mode], pub = c.status === 'published';
  const sts = CP_STATUS[c.status] || CP_STATUS.draft;
  const price = mode === 'admin' ? `<span class="text-sm font-bold text-slate-900 tabular-nums">${c.price ? money(c.price) : 'Цена не задана'}</span><span class="text-[11px] text-slate-400">· купили ${c.buyers} ${plural(c.buyers, ['центр', 'центра', 'центров'])}</span>` : '';
  const owner = mode === 'center' ? (d.kind === 'own' ? badge('indigo', 'Собственный курс') : badge('emerald', 'Куплен') + (d.access ? `<span class="text-[11px] text-slate-400">получен ${new Date(d.access.grantedAt).toLocaleDateString('ru-RU')}</span>` : '')) : badge(sts[0], sts[1]);
  const actions = mode === 'admin' ? `
    ${pub ? `<button onclick="openCourseAction(${c.id}, 'unpublish')" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Снять с публикации…</button>`
          : `<button onclick="mpPublish(${c.id})" class="px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">Опубликовать</button>`}
    ${menuGear(`cpAdminMenu(this)`)}` : '';
  $(C.p + 'Head').innerHTML = `
    <button onclick="switchTab('${C.back}')" class="text-xs font-semibold text-slate-500 hover:text-brand transition mb-3">← ${C.backLabel}</button>
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div class="flex items-center gap-4 min-w-0">
        <div class="w-32 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0" data-fallback="${esc(mpCoverFallback(c.direction))}"><img src="${esc(c.cover)}" alt="" onerror="mpCoverFail(this)" class="w-full h-full object-cover"></div>
        <div class="min-w-0"><div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">${esc(c.direction)}</div>
          <h1 class="text-2xl font-extrabold tracking-tight leading-tight">${esc(c.title)}</h1>
          <div class="flex flex-wrap items-center gap-2 mt-1.5">${owner}${price}</div></div>
      </div>
      <div class="flex items-center gap-2">${actions}</div>
    </div>`;
  const tabs = [['overview', 'Обзор'], ['program', 'Программа и материалы · ' + d.stats.lessons]];
  if (mode === 'admin') { tabs.push(['buyers', 'Покупатели · ' + cpExtra.admin.buyers.items.filter(a => a.status === 'active').length]); tabs.push(['requests', 'Заявки · ' + cpExtra.admin.requests.counts.new]); }
  if (!tabs.some(t => t[0] === st.tab)) st.tab = 'overview';
  $(C.p + 'Tabs').innerHTML = tabs.map(([k, l]) => `<button onclick="cpTab('${mode}','${k}')" class="pb-3 border-b-2 transition ${st.tab === k ? 'text-brand border-brand' : 'text-slate-600 hover:text-slate-900 border-transparent'}">${l}</button>`).join('');
  $(C.p + 'Body').innerHTML = st.tab === 'overview' ? cpOverview(mode) : st.tab === 'program' ? cpProgram(mode) : st.tab === 'buyers' ? cpBuyers() : cpRequests();
}
function cpTab(mode, k) { cpState[mode].tab = k; cpPaint(mode); }

function cpAdminMenu(btn) {
  const c = cpData.admin.course;
  openMenu(btn, [
    { label: 'Изменить цену…', hint: 'Сейчас ' + (c.price ? money(c.price) : 'не задана'), icon: 'swap', run: () => openCourseAction(c.id, 'price') },
    c.status === 'published' ? { label: 'Передать центру…', hint: 'Счёт, списание с баланса или бесплатно', icon: 'plus', run: () => openCourseSell(c.id) } : { label: 'Передать центру…', hint: 'Сначала опубликуйте курс', icon: 'plus', disabled: true, run: () => {} },
    { label: 'Изменить данные курса…', hint: 'Название, направление, описание', icon: 'sliders', run: () => cpEditDetails('admin') }
  ]);
}

/* ---- Обзор ---- */
function cpOverview(mode) {
  const d = cpData[mode], c = d.course, s = d.stats, edit = d.canEdit;
  const row = (l, v) => `<div class="flex items-center justify-between py-2.5 text-xs"><span class="text-slate-500">${l}</span><span class="font-semibold text-slate-900 tabular-nums">${v}</span></div>`;
  const checks = mode === 'admin' && c.status !== 'published' ? `<div class="mt-4 pt-4 border-t border-slate-100"><div class="text-xs font-bold text-slate-900 mb-2">Готовность к публикации</div>
    ${[[c.price > 0, 'Задана цена'], [s.lessons >= 1, 'Есть хотя бы один урок']].map(([ok, t]) => `<div class="flex items-center gap-2 text-xs py-1 ${ok ? 'text-emerald-700' : 'text-slate-500'}"><span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${ok ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}">${ok ? '✓' : '·'}</span>${t}</div>`).join('')}</div>` : '';
  return `<div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
    <div class="xl:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3"><h3 class="text-sm font-bold text-slate-900">О курсе</h3>
        ${edit ? `<button onclick="cpEditDetails('${mode}')" class="text-xs font-semibold text-brand hover:underline">Изменить…</button>` : ''}</div>
      <p class="text-xs text-slate-600 leading-relaxed">${c.description ? esc(c.description) : '<span class="text-slate-400">Описание не заполнено</span>'}</p>
      ${mode === 'center' && d.kind === 'purchased' && d.access ? `<div class="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">Версия курса на дату получения: ${d.access.version.lessons} ${plural(d.access.version.lessons, ['урок', 'урока', 'уроков'])}${d.access.version.tests ? ', ' + d.access.version.tests + ' ' + plural(d.access.version.tests, ['тест', 'теста', 'тестов']) : ''}. Новые версии приобретаются отдельно.</div>` : ''}
    </div>
    <div class="xl:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col">
      <h3 class="text-sm font-bold text-slate-900 mb-1">Состав</h3>
      <div class="divide-y divide-slate-100">${row('Модулей', s.modules)}${row('Уроков', s.lessons)}${row('Материалов', s.materials)}${row('Тестов', s.tests)}${mode === 'admin' ? row('Выручка с продаж', money(c.buyers * c.price)) : ''}</div>
      ${checks}
    </div>
  </div>`;
}
function cpEditDetails(mode) {
  const c = cpData[mode].course;
  openForm({ title: 'Данные курса', sub: c.title, submitLabel: 'Сохранить',
    fields: [{ key: 'title', label: 'Название', type: 'text', value: c.title, required: true }, { key: 'direction', label: 'Направление', type: 'select', value: c.direction, options: api.marketplace.directions.map(x => ({ value: x, label: x })) },
      { key: 'description', label: 'Описание', type: 'textarea', value: c.description, rows: 4, hint: 'До 600 символов. Видно центрам в каталоге' }],
    onSubmit: async v => { await api.courses.update(c.id, v, cpCtx(mode)); showToast('Данные курса сохранены', 'success'); await refreshCurrentView(); } });
}

/* ---- Программа и материалы ---- */
function cpMatChip(m, mode, edit) {
  const t = CP_MAT[m.type];
  return `<span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium ${t[0]}"><b class="font-bold">${t[1]}</b><span class="max-w-[16rem] truncate">${esc(m.name)}</span><span class="opacity-70">· ${esc(m.size)}</span>${edit ? `<button onclick="cpRemoveMaterial('${mode}', ${m.id})" title="Удалить материал" aria-label="Удалить материал" class="ml-0.5 opacity-60 hover:opacity-100">✕</button>` : ''}</span>`;
}
function cpProgram(mode) {
  const d = cpData[mode], edit = d.canEdit, mods = d.content.modules, st = cpState[mode];
  if (!st.open) st.open = new Set(mods.length ? [mods[0].id] : []);
  const head = `<div class="flex items-center justify-between gap-3 flex-wrap"><div class="text-xs text-slate-500">Модулей: <strong class="text-slate-800">${d.stats.modules}</strong> · уроков: <strong class="text-slate-800">${d.stats.lessons}</strong> · материалов: <strong class="text-slate-800">${d.stats.materials}</strong></div>
    ${edit ? `<button onclick="cpAddModule('${mode}')" class="px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">+ Добавить модуль</button>` : ''}</div>`;
  if (!mods.length) return head + `<div class="bg-white border border-slate-200/80 rounded-2xl py-14 px-6 text-center"><div class="text-sm font-bold text-slate-900">Программа пока пуста</div><div class="text-xs text-slate-500 mt-1.5">${edit ? 'Добавьте первый модуль, затем уроки и материалы к ним.' : 'В курсе ещё нет уроков.'}</div></div>`;
  return head + mods.map(m => `
    <details ${st.open.has(m.id) ? 'open' : ''} ontoggle="cpToggle('${mode}', ${m.id}, this.open)" class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
      <summary class="px-5 py-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50 transition">
        <div class="min-w-0"><div class="text-sm font-bold text-slate-900 truncate">${esc(m.title)}</div><div class="text-[11px] text-slate-400">${m.lessons.length} ${plural(m.lessons.length, ['урок', 'урока', 'уроков'])} · ${m.lessons.reduce((a, l) => a + l.materials.length, 0)} материалов</div></div>
        ${edit ? `<span onclick="event.preventDefault(); event.stopPropagation()">${menuGear(`cpModuleMenu(this, '${mode}', ${m.id})`)}</span>` : ''}
      </summary>
      <div class="border-t border-slate-100 divide-y divide-slate-100">
        ${m.lessons.map(l => `<div class="px-5 py-3.5 flex flex-col gap-2">
          <div class="flex items-center justify-between gap-3"><div class="text-xs font-semibold text-slate-900">${esc(l.title)}</div>${edit ? menuGear(`cpLessonMenu(this, '${mode}', ${l.id})`) : ''}</div>
          <div class="flex flex-wrap gap-1.5">${l.materials.length ? l.materials.map(x => cpMatChip(x, mode, edit)).join('') : '<span class="text-[11px] text-slate-400">Материалов пока нет</span>'}</div></div>`).join('') || '<div class="px-5 py-5 text-xs text-slate-400">В модуле пока нет уроков</div>'}
        ${edit ? `<div class="px-5 py-3"><button onclick="cpAddLesson('${mode}', ${m.id})" class="text-xs font-semibold text-brand hover:underline">+ Добавить урок</button></div>` : ''}
      </div>
    </details>`).join('');
}
function cpToggle(mode, id, open) { const s = cpState[mode].open; if (s) { open ? s.add(id) : s.delete(id); } }

const cpDone = (mode, msg) => { showToast(msg, 'success'); return refreshCurrentView(); };
function cpAddModule(mode) {
  const c = cpData[mode].course;
  openForm({ title: 'Новый модуль', sub: c.title, submitLabel: 'Добавить', fields: [{ key: 'title', label: 'Название модуля', type: 'text', required: true, placeholder: 'Например, Алгебра и уравнения' }],
    onSubmit: async v => { const m = await api.courses.addModule(c.id, v, cpCtx(mode)); cpState[mode].open.add(m.id); await cpDone(mode, 'Модуль добавлен'); } });
}
function cpModuleMenu(btn, mode, id) {
  const m = cpData[mode].content.modules.find(x => x.id === id), c = cpData[mode].course;
  openMenu(btn, [
    { label: 'Добавить урок…', hint: m.title, icon: 'plus', run: () => cpAddLesson(mode, id) },
    { label: 'Переименовать…', icon: 'sliders', run: () => openForm({ title: 'Переименовать модуль', sub: m.title, fields: [{ key: 'title', label: 'Название', type: 'text', value: m.title, required: true }], onSubmit: async v => { await api.courses.renameModule(c.id, id, v, cpCtx(mode)); await cpDone(mode, 'Модуль переименован'); } }) },
    { divider: true },
    { label: 'Удалить модуль…', hint: m.lessons.length ? 'Вместе с уроками: ' + m.lessons.length : 'Модуль пуст', icon: 'open', run: () => openForm({ title: 'Удалить модуль?', sub: m.title, danger: true, submitLabel: 'Удалить', note: m.lessons.length ? 'Будут удалены все уроки модуля (' + m.lessons.length + ') и их материалы. Действие необратимо.' : 'Модуль пуст. Действие необратимо.', fields: [], onSubmit: async () => { await api.courses.removeModule(c.id, id, cpCtx(mode)); await cpDone(mode, 'Модуль удалён'); } }) }
  ]);
}
function cpAddLesson(mode, moduleId) {
  const c = cpData[mode].course;
  openForm({ title: 'Новый урок', sub: c.title, submitLabel: 'Добавить', fields: [{ key: 'title', label: 'Название урока', type: 'text', required: true, placeholder: 'Например, Урок 1.4: Графический метод' }],
    onSubmit: async v => { await api.courses.addLesson(c.id, moduleId, v, cpCtx(mode)); cpState[mode].open.add(moduleId); await cpDone(mode, 'Урок добавлен'); } });
}
function cpLessonMenu(btn, mode, id) {
  const c = cpData[mode].course, l = cpData[mode].content.modules.flatMap(m => m.lessons).find(x => x.id === id);
  openMenu(btn, [
    { label: 'Добавить материал…', hint: 'План, видео, PDF, презентация, тест', icon: 'plus', run: () => cpAddMaterial(mode, id) },
    { label: 'Переименовать…', icon: 'sliders', run: () => openForm({ title: 'Переименовать урок', sub: l.title, fields: [{ key: 'title', label: 'Название', type: 'text', value: l.title, required: true }], onSubmit: async v => { await api.courses.renameLesson(c.id, id, v, cpCtx(mode)); await cpDone(mode, 'Урок переименован'); } }) },
    { divider: true },
    { label: 'Удалить урок…', hint: l.materials.length ? 'Вместе с материалами: ' + l.materials.length : '', icon: 'open', run: () => openForm({ title: 'Удалить урок?', sub: l.title, danger: true, submitLabel: 'Удалить', note: 'Урок и его материалы будут удалены. Действие необратимо.', fields: [], onSubmit: async () => { await api.courses.removeLesson(c.id, id, cpCtx(mode)); await cpDone(mode, 'Урок удалён'); } }) }
  ]);
}
// файлы в прототипе загружаются мок-образом: сохраняются название и размер
function cpAddMaterial(mode, lessonId) {
  const c = cpData[mode].course, l = cpData[mode].content.modules.flatMap(m => m.lessons).find(x => x.id === lessonId);
  openForm({ title: 'Новый материал', sub: l.title, submitLabel: 'Добавить', note: 'В прототипе файл не загружается на сервер: сохраняются тип и название материала.',
    fields: [{ key: 'type', label: 'Тип материала', type: 'select', value: 'plan', rerender: true, options: Object.entries(CP_MAT).map(([k, t]) => ({ value: k, label: ({ plan: 'Методический план (PDF)', video: 'Видео', pdf: 'Документ PDF', slides: 'Презентация', test: 'Тест с автопроверкой' })[k] })) },
      { key: 'name', label: 'Название', type: 'text', required: true, placeholder: 'Например, Конспект_урока_1.pdf' },
      { key: 'questions', label: 'Число вопросов', type: 'number', value: 10, showIf: v => v.type === 'test' }],
    onSubmit: async v => { await api.courses.addMaterial(c.id, lessonId, v, cpCtx(mode)); await cpDone(mode, 'Материал добавлен'); } });
}
function cpRemoveMaterial(mode, id) {
  const c = cpData[mode].course, m = cpData[mode].content.modules.flatMap(x => x.lessons).flatMap(l => l.materials).find(x => x.id === id);
  openForm({ title: 'Удалить материал?', sub: m.name, danger: true, submitLabel: 'Удалить', fields: [], onSubmit: async () => { await api.courses.removeMaterial(c.id, id, cpCtx(mode)); await cpDone(mode, 'Материал удалён'); } });
}

/* ---- Покупатели и заявки (SuperAdmin) ---- */
function cpBuyers() {
  const { items, other } = cpExtra.admin.buyers, c = cpData.admin.course;
  return `<div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap"><div><h3 class="text-sm font-bold text-slate-900">Кто купил курс</h3><p class="text-[11px] text-slate-500 mt-0.5">Центров с доступом: ${items.filter(a => a.status === 'active').length}${other ? ' · ещё ' + other + ' вне демо-данных' : ''}</p></div>
      ${c.status === 'published' ? `<button onclick="openCourseSell(${c.id})" class="px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">Передать центру…</button>` : ''}</div>
    <div class="overflow-x-auto"><table class="w-full text-left text-xs edge-table min-w-[40rem]"><thead><tr class="text-slate-400"><th class="font-medium">Центр</th><th class="font-medium">Получен</th><th class="font-medium">Основание</th><th class="font-medium text-right">Доступ</th></tr></thead>
    <tbody class="divide-y divide-slate-100">${items.length ? items.map(a => `<tr>
      <td class="py-3.5"><div class="font-semibold text-slate-900">${esc(a.centerName)}</div><div class="text-[11px] text-slate-400">${esc(a.city)}</div></td>
      <td class="py-3.5 text-slate-600">${new Date(a.grantedAt).toLocaleDateString('ru-RU')}<div class="text-[11px] text-slate-400">${a.version.lessons} ${plural(a.version.lessons, ['урок', 'урока', 'уроков'])}</div></td>
      <td class="py-3.5">${badge(MP_SOURCE[a.source][0], MP_SOURCE[a.source][1])}<div class="text-[11px] text-slate-400 mt-1">${esc(a.invoiceId || a.reason)}</div></td>
      <td class="py-3.5 text-right">${a.status === 'active' ? `<button onclick="cpRevoke(${a.id})" class="text-xs font-semibold text-rose-600 hover:underline">Отозвать…</button>` : `<span class="text-[11px] text-slate-400">отозван ${new Date(a.revokedAt).toLocaleDateString('ru-RU')}</span><div class="text-[11px] text-slate-400">${esc(a.revokeReason)}</div>`}</td></tr>`).join('') : '<tr><td colspan="4" class="py-10 text-center text-slate-400">Среди центров демо-данных курс пока никто не получил</td></tr>'}</tbody></table></div></div>`;
}
function cpRevoke(accessId) {
  const a = cpExtra.admin.buyers.items.find(x => x.id === accessId);
  openForm({ title: 'Отозвать доступ?', sub: a.centerName, danger: true, submitLabel: 'Отозвать доступ', note: 'Центр потеряет доступ к курсу. Запись попадёт в журнал аудита.',
    fields: [{ key: 'reason', label: 'Причина', type: 'textarea', rows: 2, required: true, placeholder: 'Например, возврат денег по заявлению' }],
    onSubmit: async v => { await api.marketplace.revoke(accessId, v); await cpDone('admin', 'Доступ к курсу отозван'); } });
}
function cpRequests() {
  const { items } = cpExtra.admin.requests;
  return `<div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden"><div class="px-6 py-4 border-b border-slate-100"><h3 class="text-sm font-bold text-slate-900">Заявки центров на этот курс</h3></div>${mpRequestsTable(items)}</div>`;
}
