/* Страница входа (AUTH-010): логин и пароль → при временном пароле обязательная смена → переход в кабинет центра.
   Веб-кабинет есть у владельца и администратора центра; остальным ролям показываем пояснение. Сессия — в sessionStorage (mock). */
const lg = { step: 'login', login: '', password: '', error: '', fields: {}, busy: false, user: null };

const lgField = (id, label, type, value, err, extra = '') => `<label class="flex flex-col gap-1.5 text-xs font-medium text-slate-700">${label}
  <input id="${id}" type="${type}" value="${esc(value)}" ${extra} oninput="lg.${id} = this.value" class="px-3 py-2.5 bg-white border ${err ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-sm focus:outline-none focus:border-brand">
  ${err ? `<span class="text-[11px] text-rose-600 font-normal">${esc(err)}</span>` : ''}</label>`;

function lgRender() {
  const root = $('loginRoot'), err = lg.error ? `<div class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">${esc(lg.error)}</div>` : '';
  const btn = label => `<button type="submit" ${lg.busy ? 'disabled' : ''} class="w-full py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-sm font-semibold transition disabled:opacity-60">${lg.busy ? 'Проверяем…' : label}</button>`;
  if (lg.step === 'login') {
    root.innerHTML = `<form onsubmit="lgSubmit(event)" class="flex flex-col gap-4">${err}
      ${lgField('login', 'Логин', 'text', lg.login, '', 'autocomplete="username" autofocus')}
      ${lgField('password', 'Пароль', 'password', lg.password, '', 'autocomplete="current-password"')}
      ${btn('Войти')}
      <p class="text-[11px] text-slate-500">Логин и временный пароль выдаёт администратор центра. Если пароль потерян, попросите сбросить его.</p></form>`;
  } else if (lg.step === 'change') {
    root.innerHTML = `<form onsubmit="lgChange(event)" class="flex flex-col gap-4">
      <div><div class="text-sm font-bold text-slate-900">Смените временный пароль</div><p class="text-[11px] text-slate-500 mt-1">Пароль выдан администратором и известен ему. Придумайте свой: не короче 8 символов, с буквой и цифрой.</p></div>${err}
      ${lgField('newPassword', 'Новый пароль', 'password', '', lg.fields.newPassword, 'autocomplete="new-password" autofocus')}
      ${lgField('repeat', 'Повторите пароль', 'password', '', lg.fields.repeat, 'autocomplete="new-password"')}
      ${btn('Сохранить и войти')}</form>`;
  } else {
    root.innerHTML = `<div class="flex flex-col gap-3 text-center py-2"><div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 text-xl font-bold flex items-center justify-center mx-auto">✓</div>
      <div class="text-sm font-bold text-slate-900">${esc(lg.user.name)}, вход выполнен</div>
      <p class="text-xs text-slate-500">Роль «${esc(lg.user.roleLabel)}» работает в мобильном приложении, веб-кабинет для неё не предусмотрен. Пароль сохранён.</p>
      <button onclick="lgLogout()" class="mt-2 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700">Выйти</button></div>`;
  }
}

function lgEnter(user) {
  try { sessionStorage.setItem('liniya.session', JSON.stringify({ login: user.login, role: user.role, name: user.name, centerId: user.centerId })); } catch (e) { /* без хранилища сессия не запомнится */ }
  if (user.cabinet) { location.href = 'eduhub.html#/profile?center=' + user.centerId; return; }
  lg.user = user; lg.step = 'done'; lgRender();
}

async function lgSubmit(ev) {
  ev.preventDefault(); if (lg.busy) return;
  lg.login = $('login').value; lg.password = $('password').value; lg.error = ''; lg.busy = true; lgRender();
  try {
    const u = await api.auth.login({ login: lg.login, password: lg.password });
    lg.busy = false;
    if (u.mustChange) { lg.step = 'change'; lgRender(); } else lgEnter(u);
  } catch (e) { lg.busy = false; lg.password = ''; lg.error = errText(e); lgRender(); }
}

async function lgChange(ev) {
  ev.preventDefault(); if (lg.busy) return;
  const np = $('newPassword').value, rp = $('repeat').value; lg.fields = {}; lg.error = '';
  if (np !== rp) { lg.fields.repeat = 'Пароли не совпадают'; lgRender(); return; }
  lg.busy = true; lgRender();
  try { lgEnter(await api.auth.changePassword({ login: lg.login, password: lg.password, newPassword: np })); }
  catch (e) { lg.busy = false; if (e instanceof ApiError && e.fields) lg.fields = e.fields; else lg.error = errText(e); lgRender(); }
}

function lgLogout() { try { sessionStorage.removeItem('liniya.session'); } catch (e) { /* ignore */ } Object.assign(lg, { step: 'login', login: '', password: '', error: '', user: null }); lgRender(); }

lgRender();
