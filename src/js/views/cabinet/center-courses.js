/* Экран кабинета центра: «Материалы и тесты». СТОРОНА ЦЕНТРА для магазина методик, четыре вкладки:
   • Мои методики — курсы платформы, которые центру передали (после оплаты счёта или бонусом); клик открывает страницу курса (просмотр);
   • Каталог — опубликованные курсы платформы: центр подаёт заявку; SuperAdmin выставляет счёт, после оплаты курс передаётся
     (онлайн-оплата передаёт курс автоматически, при ручном подтверждении оплаты — действием SuperAdmin);
   • Заявки — статусы заявок, оплата выставленного счёта онлайн (мок шлюза);
   • Мои курсы — собственные курсы центра: центр сам создаёт их и наполняет (модули, уроки, материалы).
   Открывается в режиме поддержки. Данные — api.cabinet.courses.*, api.cabinet.requests.*, api.courses.*. */
registerView({
  tab: 'center-courses', path: 'center-courses',
  title: 'Материалы и тесты', nav: { label: 'Материалы и тесты', icon: 'book' },
  template: `
<main id="view-center-courses" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="max-w-2xl">
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Материалы и тесты</h1>
      <p class="text-xs text-slate-500 mt-1">Методики платформы, заявки на новые курсы и собственные курсы центра</p>
    </div>
    <div id="ccAction"></div>
  </div>
  <div id="ccTabs" class="flex flex-wrap items-center gap-6 border-b border-slate-200 text-xs font-semibold"></div>
  <div id="ccBody" class="flex flex-col gap-5"></div>
</main>
`,
  render: renderCenterCourses
});

const ccState = { tab: 'mine' };
const CC_REQ = { new: ['amber', 'Ждёт счёта'], invoiced: ['indigo', 'Ожидает оплаты'], fulfilled: ['emerald', 'Курс получен'], rejected: ['rose', 'Отклонена'] };
function setCcTab(t) { ccState.tab = t; renderCenterCourses(); }

async function renderCenterCourses() {
  const my = begin('center-courses'), body = $('ccBody');
  body.innerHTML = '<div class="h-48 bg-white border border-slate-200/80 rounded-2xl animate-pulse"></div>';
  try {
    const cid = selectedCenterId;
    const [mine, cat, req] = await Promise.all([api.cabinet.courses.list(cid), api.cabinet.courses.catalog(cid), api.cabinet.requests.list(cid)]);
    if (stale('center-courses', my)) return;
    const open = req.items.filter(r => r.status === 'new' || r.status === 'invoiced').length;
    const tabs = [['mine', 'Мои методики · ' + mine.items.length], ['catalog', 'Каталог'], ['requests', 'Заявки' + (open ? ' · ' + open : '')], ['own', 'Мои курсы · ' + mine.own.length]];
    $('ccTabs').innerHTML = tabs.map(([k, l]) => `<button onclick="setCcTab('${k}')" class="pb-3 border-b-2 transition ${ccState.tab === k ? 'text-brand border-brand' : 'text-slate-600 hover:text-slate-900 border-transparent'}">${l}</button>`).join('');
    $('ccAction').innerHTML = ccState.tab === 'own' ? `<button onclick="ccCreateOwn()" class="px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">+ Создать курс</button>` : '';
    body.innerHTML = ccState.tab === 'mine' ? ccMine(mine.items) : ccState.tab === 'catalog' ? ccCatalog(cat.items) : ccState.tab === 'requests' ? ccRequests(req.items) : ccOwn(mine.own);
  } catch (e) { if (!stale('center-courses', my)) body.innerHTML = `<div class="bg-white border border-slate-200/80 rounded-2xl">${errorBox(e)}</div>`; }
}

const ccGrid = html => `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">${html}</div>`;
const ccEmpty = (title, text) => `<div class="bg-white border border-slate-200/80 rounded-2xl py-14 px-6 text-center"><div class="text-sm font-bold text-slate-900">${title}</div><div class="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">${text}</div></div>`;
const ccMeta = (c, v) => { const l = v ? v.lessons : c.lessons, t = v ? v.tests : c.tests; return `${l} ${plural(l, ['урок', 'урока', 'уроков'])}${t ? ' · ' + t + ' ' + plural(t, ['тест', 'теста', 'тестов']) : ''} · ${esc(c.note)}`; };

function ccMine(items) {
  if (!items.length) return ccEmpty('Методик пока нет', 'Курсы платформы появляются здесь после покупки. Выберите курс во вкладке «Каталог» и подайте заявку.');
  return ccGrid(items.map(a => { const c = a.course, src = MP_SOURCE[a.source]; return `
    <div onclick="openCenterCourse(${c.id})" title="Открыть курс" class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-3 cursor-pointer hover:border-brand/40 hover:shadow-md transition">
      ${mpCover(c)}<h3 class="text-base font-bold text-slate-900 leading-snug">${esc(c.title)}</h3>
      <div class="text-xs text-slate-500">${ccMeta(c, a.version)}</div>
      <div class="flex items-center gap-2 flex-wrap">${badge(src[0], src[1])}<span class="text-[11px] text-slate-400">получен ${new Date(a.grantedAt).toLocaleDateString('ru-RU')}</span></div>
      ${c.lessons > a.version.lessons ? `<div class="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">В курсе уже ${c.lessons} уроков. У вас версия на дату получения: новые версии приобретаются отдельно.</div>` : ''}
    </div>`; }).join(''));
}

function ccCatalog(items) {
  if (!items.length) return ccEmpty('Каталог пуст', 'Платформа пока не опубликовала курсы.');
  return ccGrid(items.map(c => {
    const action = c.state === 'owned' ? badge('emerald', 'Уже у вас')
      : c.state === 'requested' ? `${badge('amber', 'Заявка подана')}<button onclick="ccCancelRequest(${c.requestId})" class="text-xs font-semibold text-slate-500 hover:text-rose-600 hover:underline">Отменить</button>`
      : c.state === 'invoiced' ? badge('indigo', 'Ожидает оплаты') + `<button onclick="setCcTab('requests')" class="text-xs font-semibold text-brand hover:underline">К оплате →</button>`
      : `<button onclick="ccRequest(${c.id})" class="px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">Подать заявку</button>`;
    return `<div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-3">
      ${mpCover(c)}<h3 class="text-base font-bold text-slate-900 leading-snug">${esc(c.title)}</h3>
      <div class="text-xs text-slate-500">${ccMeta(c)}</div>
      ${c.description ? `<p class="text-xs text-slate-500 leading-relaxed flex-1">${esc(c.description)}</p>` : '<div class="flex-1"></div>'}
      <div class="text-xl font-extrabold text-slate-900 tabular-nums">${money(c.price)}</div>
      <div class="flex items-center gap-3 flex-wrap">${action}</div></div>`;
  }).join(''));
}

function ccRequests(items) {
  if (!items.length) return ccEmpty('Заявок пока нет', 'Во вкладке «Каталог» выберите курс и подайте заявку: платформа выставит счёт, после оплаты курс появится в «Моих методиках».');
  return `<div class="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-left text-xs edge-table min-w-[44rem]">
    <thead><tr class="text-slate-400"><th class="font-medium">Курс</th><th class="font-medium">Заявка</th><th class="font-medium">Статус</th><th class="font-medium text-right">Действия</th></tr></thead>
    <tbody class="divide-y divide-slate-100 text-slate-700">${items.map(r => { const st = CC_REQ[r.status]; return `<tr>
      <td class="py-3.5" style="white-space:normal;min-width:13rem"><div class="font-semibold text-slate-900">${esc(r.course.title)}</div><div class="text-[11px] text-slate-400">${money(r.course.price)}</div></td>
      <td class="py-3.5 text-slate-600" style="white-space:normal;min-width:10rem">${new Date(r.createdAt).toLocaleDateString('ru-RU')}${r.note ? `<div class="text-[11px] text-slate-500">«${esc(r.note)}»</div>` : ''}</td>
      <td class="py-3.5" style="white-space:normal">${badge(st[0], st[1])}${r.invoice && r.status === 'invoiced' ? `<div class="text-[11px] text-slate-400 mt-1">Счёт ${esc(r.invoice.id)} на ${money(r.invoice.amount)}</div>` : ''}${r.status === 'rejected' ? `<div class="text-[11px] text-slate-500 mt-1">${esc(r.reason)}</div>` : ''}</td>
      <td class="py-3.5 text-right">${r.status === 'invoiced' ? `<button onclick="ccPayOnline(${r.id})" title="Демо: имитация оплаты картой через платёжный шлюз" class="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark transition whitespace-nowrap">Оплатить онлайн</button><div class="text-[10px] text-slate-400 mt-1">демо-оплата картой</div>`
        : r.status === 'new' ? `<button onclick="ccCancelRequest(${r.id})" class="text-xs font-semibold text-slate-500 hover:text-rose-600 hover:underline">Отменить заявку</button>`
        : r.status === 'fulfilled' ? `<button onclick="openCenterCourse(${r.course.id})" class="text-xs font-semibold text-brand hover:underline">Открыть курс →</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
}

function ccOwn(items) {
  if (!items.length) return ccEmpty('Своих курсов пока нет', 'Создайте собственный курс: добавьте модули, уроки и материалы (планы, видео, тесты) для ваших преподавателей.');
  return ccGrid(items.map(c => `
    <div onclick="openCenterCourse(${c.id})" title="Открыть курс" class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-3 cursor-pointer hover:border-brand/40 hover:shadow-md transition">
      ${mpCover(c)}<h3 class="text-base font-bold text-slate-900 leading-snug">${esc(c.title)}</h3>
      <div class="text-xs text-slate-500">${c.lessons ? ccMeta(c) : 'Программа пока пуста'}</div>
      <div>${badge('indigo', 'Собственный курс')}</div></div>`).join(''));
}

/* ---- действия центра ---- */
function ccRequest(courseId) {
  openForm({ title: 'Заявка на курс', sub: 'Платформа выставит счёт, после оплаты курс появится в «Моих методиках»', submitLabel: 'Подать заявку',
    fields: [{ key: 'note', label: 'Комментарий', type: 'textarea', rows: 2, hint: 'Необязательно: для какой группы нужен курс' }],
    onSubmit: async v => { await api.cabinet.requests.create(selectedCenterId, { courseId, note: v.note }); showToast('Заявка подана. Платформа выставит счёт', 'success'); ccState.tab = 'requests'; await renderCenterCourses(); } });
}
function ccCancelRequest(id) {
  openForm({ title: 'Отменить заявку?', danger: true, submitLabel: 'Отменить заявку', note: 'Заявку можно подать снова в любой момент.', fields: [],
    onSubmit: async () => { await api.cabinet.requests.cancel(selectedCenterId, id); showToast('Заявка отменена', 'info'); await renderCenterCourses(); } });
}
async function ccPayOnline(id) {
  const r = await mutate(() => api.cabinet.requests.payOnline(selectedCenterId, id), x => `Оплата прошла, курс «${x.course.title}» передан центру автоматически`);
  if (r) { ccState.tab = 'mine'; renderCenterCourses(); }
}
function ccCreateOwn() {
  openForm({ title: 'Новый курс', sub: 'Собственный курс виден только вашему центру', submitLabel: 'Создать и открыть',
    fields: [{ key: 'title', label: 'Название', type: 'text', required: true, placeholder: 'Например, Разговорный английский для детей' },
      { key: 'direction', label: 'Направление', type: 'select', value: api.marketplace.directions[0], options: api.marketplace.directions.map(x => ({ value: x, label: x })) },
      { key: 'description', label: 'Описание', type: 'textarea', rows: 3, hint: 'До 600 символов' }],
    onSubmit: async v => { const c = await api.cabinet.courses.create(selectedCenterId, v); showToast('Курс «' + c.title + '» создан', 'success'); openCenterCourse(c.id, 'program'); } });
}
