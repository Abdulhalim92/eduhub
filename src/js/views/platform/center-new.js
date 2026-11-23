/* Экран: Подключить центр (мастер onboarding) */
registerView({
  tab: 'center-new', path: 'centers/new',
  title: 'Подключить центр', parent: ['Все центры', 'centers'],
  template: `
<main id="view-center-new" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Подключить центр</h1>
      <p class="text-xs text-slate-500 mt-1">Бесплатный onboarding: данные организации → владелец и Global ID → стартовый тариф</p>
    </div>
    <button onclick="switchTab('centers')" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition">← К списку центров</button>
  </div>
  <div id="wizardRoot"></div>
</main>
`,
  render: renderWizard
});

const WZ_STEPS = ['Данные организации', 'Владелец и Global ID', 'Стартовый тариф'];
const WZ_FIELD_STEP = { name: 1, inn: 1, city: 1, address: 1, phone: 1, email: 1, ownerName: 2, ownerPhone: 2, ownerEmail: 2, terms: 3 };
let wizard;

function wizardReset() {
  wizard = {
    step: 1, done: null, credentials: null, errors: {}, checked: null, submitting: false, checking: false,
    data: { name: '', legal: 'ООО', inn: '', city: 'Душанбе', address: '', phone: '', email: '', directions: [], ownerName: '', ownerPhone: '', ownerEmail: '', lang: 'RU', invite: true, terms: false }
  };
}
wizardReset();

function wz(key, val) {
  wizard.data[key] = val;
  if (wizard.errors[key]) { delete wizard.errors[key]; const e = $('err-' + key); if (e) e.remove(); const inp = $('wz-' + key); if (inp) inp.classList.replace('border-rose-400', 'border-slate-200'); }
  if (key === 'ownerPhone') wizard.checked = null;
}
function wzToggleDirection(d) {
  const arr = wizard.data.directions, i = arr.indexOf(d);
  if (i >= 0) arr.splice(i, 1); else arr.push(d);
  renderWizard();
}

function wzInput(key, label, o = {}) {
  const err = wizard.errors[key];
  return `<label class="flex flex-col gap-1.5 ${o.span ? 'md:col-span-2' : ''}">
    <span class="text-[11px] font-semibold text-slate-600">${label}${o.required ? ' <span class="text-rose-500">*</span>' : ''}</span>
    <input id="wz-${key}" type="${o.type || 'text'}" value="${esc(wizard.data[key])}" placeholder="${esc(o.placeholder || '')}" oninput="wz('${key}', this.value)" class="px-3 py-2.5 bg-white border ${err ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand">
    ${o.hint ? `<span class="text-[11px] text-slate-400">${o.hint}</span>` : ''}
    ${err ? `<span id="err-${key}" class="text-[11px] text-rose-600">${esc(err)}</span>` : ''}
  </label>`;
}
function wzSelect(key, label, options, o = {}) {
  return `<label class="flex flex-col gap-1.5">
    <span class="text-[11px] font-semibold text-slate-600">${label}${o.required ? ' <span class="text-rose-500">*</span>' : ''}</span>
    <select id="wz-${key}" onchange="wz('${key}', this.value)" class="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand cursor-pointer">
      ${options.map(v => `<option ${wizard.data[key] === v ? 'selected' : ''}>${v}</option>`).join('')}
    </select>
  </label>`;
}

function wzStepper() {
  return `<div class="flex items-center gap-3 flex-wrap">${WZ_STEPS.map((t, i) => {
    const n = i + 1, active = wizard.step === n, passed = wizard.step > n || wizard.done;
    return `<div class="flex items-center gap-2.5">
      <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${passed ? 'bg-emerald-500 text-white' : active ? 'bg-brand text-white' : 'bg-slate-200 text-slate-500'}">${passed ? '✓' : n}</span>
      <span class="text-xs font-semibold ${active ? 'text-slate-900' : 'text-slate-400'}">${t}</span>
      ${n < 3 ? '<span class="w-8 h-px bg-slate-300 hidden sm:block"></span>' : ''}
    </div>`;
  }).join('')}</div>`;
}

function wzStep1() {
  const d = wizard.data;
  return `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    ${wzInput('name', 'Название учебного центра', { required: true, placeholder: 'Например, Центр «Перспектива»', span: true })}
    ${wzSelect('legal', 'Форма организации', ['ООО', 'ИП', 'Физическое лицо'])}
    ${wzInput('inn', 'ИНН', { placeholder: '9 цифр', hint: 'Необязательно. Нужен для актов в B2B-биллинге' })}
    ${wzSelect('city', 'Город', dict().cities.length ? dict().cities : [d.city], { required: true })}
    ${wzInput('address', 'Адрес главного филиала', { required: true, placeholder: 'ул. Рудаки, 98' })}
    ${wzInput('phone', 'Телефон центра', { required: true, placeholder: '+992 90 000 00 00', type: 'tel' })}
    ${wzInput('email', 'Email центра', { placeholder: 'info@center.tj', type: 'email' })}
    <div class="md:col-span-2 flex flex-col gap-2">
      <span class="text-[11px] font-semibold text-slate-600">Направления обучения</span>
      <div class="flex flex-wrap gap-2">${dict().directions.map(x => `<button type="button" onclick="wzToggleDirection('${x}')" class="px-3 py-1.5 rounded-xl text-xs font-medium border transition ${d.directions.includes(x) ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">${x}</button>`).join('')}</div>
    </div>
  </div>`;
}

function wzStep2() {
  const d = wizard.data;
  return `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    ${wzInput('ownerName', 'ФИО владельца', { required: true, placeholder: 'Фамилия Имя', span: true })}
    <div class="flex flex-col gap-1.5">
      ${wzInput('ownerPhone', 'Телефон (он же Global ID)', { required: true, placeholder: '+992 90 000 00 00', type: 'tel', hint: 'Один аккаунт по номеру телефона объединяет все центры и роли человека' })}
      <button type="button" onclick="wzCheckGlobalId()" class="self-start px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition">Проверить Global ID</button>
      <div id="wzGidResult">${wzGidHtml()}</div>
    </div>
    ${wzInput('ownerEmail', 'Email владельца', { placeholder: 'owner@center.tj', type: 'email' })}
    <div class="flex flex-col gap-2">
      <span class="text-[11px] font-semibold text-slate-600">Язык интерфейса владельца</span>
      <div class="flex gap-2">${['RU', 'TJ', 'EN'].map(l => `<button type="button" onclick="wizard.data.lang='${l}'; renderWizard()" class="px-4 py-2 rounded-xl text-xs font-semibold border transition ${d.lang === l ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">${l}</button>`).join('')}</div>
    </div>
    <label class="md:col-span-2 flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
      <input type="checkbox" ${d.invite ? 'checked' : ''} onchange="wizard.data.invite=this.checked" class="w-4 h-4 accent-[#3C5C73]">
      Отправить владельцу SMS-приглашение со ссылкой для входа
    </label>
  </div>`;
}

function wzGidHtml() {
  const c = wizard.checked;
  if (!c) return '';
  if (c.loading) return `<div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 animate-pulse">Проверяем номер…</div>`;
  return c.found
    ? `<div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800">Найден существующий Global ID: <strong>${esc(c.info)}</strong>. Центр будет привязан к нему, история сохранится.</div>`
    : c.error
      ? `<div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700">${esc(c.error)}</div>`
      : `<div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">Global ID с таким номером не найден — будет создан новый профиль владельца.</div>`;
}
async function wzCheckGlobalId() {
  const phone = wizard.data.ownerPhone;
  wizard.checked = { loading: true };
  $('wzGidResult').innerHTML = wzGidHtml();
  try {
    const r = await api.globalId.lookup({ phone });
    if (wizard.data.ownerPhone !== phone) return;      // номер уже изменили — ответ неактуален
    wizard.checked = r;
  } catch (e) {
    if (wizard.data.ownerPhone !== phone) return;
    wizard.checked = { error: errText(e) };
  }
  const box = $('wzGidResult'); if (box) box.innerHTML = wzGidHtml();
}

function wzStep3() {
  const d = wizard.data, err = wizard.errors.terms;
  const start = dict().plans.find(p => p.name === 'Старт') || { limits: { staff: 5, storageGb: 2, branches: 2 } };   // лимиты берём из справочника тарифов
  return `<div class="flex flex-col gap-4">
    <div class="p-5 border-2 border-brand rounded-2xl bg-brand-light/40">
      <div class="flex items-center justify-between">
        <div><div class="text-sm font-extrabold text-slate-900">Тариф «Старт»</div><div class="text-[11px] text-slate-500 mt-0.5">Бесплатный стартовый тариф для нового центра</div></div>
        ${badge('emerald', 'Бесплатно')}
      </div>
      <div class="grid grid-cols-3 gap-3 mt-4 text-center">
        <div class="bg-white rounded-xl p-3 border border-slate-200"><div class="text-xl font-extrabold text-slate-900">${start.limits.staff}</div><div class="text-[11px] text-slate-500">учителей</div></div>
        <div class="bg-white rounded-xl p-3 border border-slate-200"><div class="text-xl font-extrabold text-slate-900">${start.limits.storageGb} ГБ</div><div class="text-[11px] text-slate-500">хранилище</div></div>
        <div class="bg-white rounded-xl p-3 border border-slate-200"><div class="text-xl font-extrabold text-slate-900">${start.limits.branches}</div><div class="text-[11px] text-slate-500">филиала</div></div>
      </div>
      <div class="text-[11px] text-slate-500 mt-3">Модули зарплат, инвентаря, CRM и гео-чек-ина включаются позже в «Настройке модулей». Платные тарифы подключаются через B2B-биллинг.</div>
    </div>
    <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex flex-col gap-1.5">
      <div class="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-1">Проверьте данные</div>
      <div><span class="text-slate-400">Центр:</span> <strong>${esc(d.name)}</strong>, ${esc(d.legal)}, ${esc(d.city)}, ${esc(d.address)}</div>
      <div><span class="text-slate-400">Контакты центра:</span> ${esc(d.phone)}${d.email ? ', ' + esc(d.email) : ''}</div>
      <div><span class="text-slate-400">Направления:</span> ${d.directions.length ? esc(d.directions.join(', ')) : '—'}</div>
      <div><span class="text-slate-400">Владелец:</span> <strong>${esc(d.ownerName)}</strong>, ${esc(d.ownerPhone)} · язык ${d.lang}</div>
    </div>
    <label class="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
      <input id="wz-terms" type="checkbox" ${d.terms ? 'checked' : ''} onchange="wz('terms', this.checked)" class="w-4 h-4 accent-[#3C5C73]">
      Подтверждаю, что владелец принял условия оферты платформы
    </label>
    ${err ? `<span id="err-terms" class="text-[11px] text-rose-600">${esc(err)}</span>` : ''}
  </div>`;
}

async function wzCopy(id) {
  try { await navigator.clipboard.writeText($(id).textContent); showToast('Скопировано', 'success'); } catch (e) { showToast('Не удалось скопировать: выделите текст вручную', 'error'); }
}

function wzDone() {
  const c = wizard.done, d = wizard.data;
  return `<div class="bg-white border border-slate-200/80 rounded-2xl p-10 shadow-xs flex flex-col items-center text-center gap-3">
    <div class="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl font-bold">✓</div>
    <h2 class="text-xl font-extrabold text-slate-900">Центр «${esc(c.name)}» подключён</h2>
    <p class="text-xs text-slate-500 max-w-md">Активирован тариф «Старт». ${d.invite ? 'Владельцу ' + esc(d.ownerName) + ' отправлено SMS-приглашение на ' + esc(d.ownerPhone) + '.' : 'SMS-приглашение не отправлялось.'}</p>
    <div class="w-full max-w-md mt-2 text-left bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div class="text-xs font-bold text-slate-900">Данные для входа администратора центра</div>
      <dl class="mt-3 grid grid-cols-[6rem_1fr_auto] items-center gap-x-3 gap-y-2 text-xs">
        <dt class="text-slate-500">Логин</dt><dd id="wzLogin" class="font-mono font-semibold text-slate-900 break-all">${esc(wizard.credentials.login)}</dd><dd><button onclick="wzCopy('wzLogin')" class="text-[11px] font-semibold text-brand hover:underline">Копировать</button></dd>
        <dt class="text-slate-500">Пароль</dt><dd id="wzPassword" class="font-mono font-semibold text-slate-900">${esc(wizard.credentials.password)}</dd><dd><button onclick="wzCopy('wzPassword')" class="text-[11px] font-semibold text-brand hover:underline">Копировать</button></dd>
      </dl>
      <p class="mt-3 text-[11px] text-amber-700">Пароль показан один раз и нигде не хранится в открытом виде: передайте его владельцу сейчас. При первом входе пароль нужно сменить.</p>
    </div>
    <div class="flex flex-wrap justify-center gap-2 pt-3">
      <button onclick="openDrawerById(${c.id})" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Настроить модули</button>
      <button onclick="enterImpersonationById(${c.id})" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Войти в кабинет</button>
      <button onclick="wizardReset(); renderWizard()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Подключить ещё один</button>
      <button onclick="switchTab('centers')" class="px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition">К списку центров</button>
    </div>
  </div>`;
}

function renderWizard() {
  const root = $('wizardRoot');
  if (wizard.done) { root.innerHTML = wzStepper() + '<div class="mt-6">' + wzDone() + '</div>'; return; }
  const body = wizard.step === 1 ? wzStep1() : wizard.step === 2 ? wzStep2() : wzStep3();
  const loading = wizard.submitting || wizard.checking;
  root.innerHTML = `
    ${wzStepper()}
    <div class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs mt-6 max-w-3xl">
      <h2 class="text-sm font-bold text-slate-900 mb-4">Шаг ${wizard.step} из 3 · ${WZ_STEPS[wizard.step - 1]}</h2>
      ${body}
      <div class="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
        <button onclick="wzBack()" ${loading ? 'disabled' : ''} class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition ${wizard.step === 1 ? 'invisible' : ''}">← Назад</button>
        ${wizard.step < 3
          ? `<button onclick="wzNext()" ${loading ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">${wizard.checking ? 'Проверяем…' : 'Далее →'}</button>`
          : `<button onclick="wzFinish()" ${loading ? 'disabled' : ''} class="px-5 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition disabled:opacity-60">${wizard.submitting ? 'Создаём…' : 'Создать центр'}</button>`}
      </div>
    </div>`;
}

// клиентская проверка — только для удобства; итоговая валидация (в т.ч. уникальность названия) — на сервере
function wzValidate(step) {
  const d = wizard.data, e = {};
  const mail = v => !v || /^\S+@\S+\.\S+$/.test(v.trim());
  if (step === 1) {
    if (d.name.trim().length < 3) e.name = 'Укажите название (минимум 3 символа)';
    if (d.inn && !/^\d{9}$/.test(d.inn.trim())) e.inn = 'ИНН состоит из 9 цифр';
    if (d.address.trim().length < 5) e.address = 'Укажите адрес филиала';
    if (digits(d.phone).length < 9) e.phone = 'Введите корректный номер телефона';
    if (!mail(d.email)) e.email = 'Некорректный email';
  }
  if (step === 2) {
    if (d.ownerName.trim().length < 3) e.ownerName = 'Укажите ФИО владельца';
    if (digits(d.ownerPhone).length < 9) e.ownerPhone = 'Введите корректный номер телефона';
    if (!mail(d.ownerEmail)) e.ownerEmail = 'Некорректный email';
  }
  if (step === 3 && !d.terms) e.terms = 'Нужно подтвердить принятие оферты';
  return e;
}
function wzFocusFirstError() { const k = Object.keys(wizard.errors)[0]; const el = k && $('wz-' + k); if (el) el.focus(); }

async function wzNext() {
  if (wizard.checking) return;
  wizard.errors = wzValidate(wizard.step);
  if (!Object.keys(wizard.errors).length && wizard.step === 1) {
    wizard.checking = true; renderWizard();
    try {
      const { available } = await api.centers.nameAvailable({ name: wizard.data.name });
      if (!available) wizard.errors.name = 'Центр с таким названием уже подключён';
    } catch (e) { showToast(errText(e), 'error'); wizard.errors.name = 'Не удалось проверить название. Повторите'; }
    wizard.checking = false;
  }
  if (Object.keys(wizard.errors).length) { renderWizard(); wzFocusFirstError(); return; }
  wizard.step++; renderWizard();
}
function wzBack() { wizard.errors = {}; wizard.step = Math.max(1, wizard.step - 1); renderWizard(); }

async function wzFinish() {
  if (wizard.submitting) return;
  wizard.errors = wzValidate(3);
  if (Object.keys(wizard.errors).length) { renderWizard(); return; }
  wizard.submitting = true; renderWizard();
  try {
    const { credentials, ...c } = await api.centers.create({ ...wizard.data });   // пароль показываем один раз и в кеш не кладём
    cacheCenters([c]);
    wizard.submitting = false; wizard.done = c; wizard.credentials = credentials;
    renderWizard();
    refreshAttention();
    showToast('Центр «' + c.name + '» подключён на тарифе «Старт»', 'success');
  } catch (e) {
    wizard.submitting = false;
    if (e instanceof ApiError && e.code === 'VALIDATION' && Object.keys(e.fields).length) {
      wizard.errors = e.fields;                                          // ошибки сервера → к нужному шагу и полю
      wizard.step = Math.min(...Object.keys(e.fields).map(k => WZ_FIELD_STEP[k] || 3));
      renderWizard(); wzFocusFirstError();
    } else { renderWizard(); showToast(errText(e), 'error'); }
  }
}
