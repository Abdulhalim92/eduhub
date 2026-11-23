/* =====================================================================
   Оболочка кабинета центра (eduhub.html): реестр экранов, hash-роутер, текущий центр, режим поддержки.
   Аналог router.js платформы. router.js и nav.js в eduhub.html НЕ подключаются (общая глобальная область, имена совпадают).

   Экран = registerView({ tab, path, title, parent, nav, template, render }):
     nav    — пункт сайдбара { label, icon } (без nav экран в меню не показывается);
     parent — [подпись, tab] для дочернего экрана (в меню подсвечивается родитель);
     render — async, сама ходит в api; центр, с которым работает экран, лежит в selectedCenterId.
   Адрес: #/<экран>?center=<id>[&support=1]. center — какой центр открыт; support=1 — вход из кабинета платформы (режим поддержки: баннер и выход).
   Без center берётся последний выбранный центр (localStorage), иначе первый в списке.
   ===================================================================== */
const VIEWS = {};
function registerView(v) { VIEWS[v.tab] = v; }
const routePath = tab => (VIEWS[tab] ? VIEWS[tab].path : tab);
const tabByPath = path => Object.keys(VIEWS).find(t => VIEWS[t].path === path);

let currentTab = 'profile';
let selectedCenterId = 0;               // центр, открытый в кабинете (экраны работают с api по этому id)
let selectedCenterName = '';
let eduCenters = [];                    // центры для переключателя
let supportMode = false;                // вход из кабинета платформы
let routeSeq = 0;
const EDU_CENTER_KEY = 'eduhub.centerId';

const EDU_ICONS = {
  profile: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5',
  pin: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  calendar: 'M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
  dashboard: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z',
  group: 'M12 4l9 4.5-9 4.5-9-4.5L12 4zm-9 9l9 4.5 9-4.5M3 17l9 4.5 9-4.5',
  award: 'M12 15a6 6 0 100-12 6 6 0 000 12zm-3.5-1.5L7 21l5-2.5 5 2.5-1.5-7.5',
  sliders: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  wallet: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'
};

function mountViews() { $('viewport').innerHTML = Object.values(VIEWS).map(v => v.template).join('\n'); }

/* ---- адрес: центр и режим поддержки сохраняются при любых переходах внутри кабинета ---- */
const hashParams = () => new URLSearchParams(location.hash.split('?')[1] || '');
const cabinetQuery = () => '?center=' + selectedCenterId + (supportMode ? '&support=1' : '');
function switchTab(tabId) {
  const target = '#/' + routePath(tabId) + cabinetQuery();
  if (location.hash === target) renderRoute(); else location.hash = target;
}
function openCenter(id) {
  try { localStorage.setItem(EDU_CENTER_KEY, String(id)); } catch (e) { /* хранилище недоступно — центр не запомнится */ }
  selectedCenterId = id;
  switchTab(currentTab);
}
function exitSupport() { location.href = 'index.html#/centers'; }

function resolveCenterId(list) {
  const ids = list.map(x => x.id);
  let saved = 0; try { saved = Number(localStorage.getItem(EDU_CENTER_KEY)); } catch (e) { /* ignore */ }
  return [Number(hashParams().get('center')), saved].find(id => ids.includes(id)) || ids[0];
}

/* ---- меню, шапка, баннер ---- */
function renderNav() {
  $('centerNav').innerHTML = Object.values(VIEWS).filter(v => v.nav).map(v => `
    <a id="nav-${v.tab}" href="#/${v.path}${cabinetQuery()}" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 font-medium text-left transition">
      <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${EDU_ICONS[v.nav.icon] || EDU_ICONS.profile}"/></svg>
      <span class="flex-1 truncate">${esc(v.nav.label)}</span>
    </a>`).join('');
}

function renderCenterChrome(list, id) {
  const c = list.find(x => x.id === id);
  $('centerSwitcher').innerHTML = list.map(x => `<option value="${x.id}"${x.id === id ? ' selected' : ''}>${esc(x.name)} · ${esc(x.city)}</option>`).join('');
  $('sideCenterLogo').src = c.logo;
  $('sideCenterName').textContent = c.name;
  $('sideCenterPlan').textContent = 'Тариф «' + c.plan + '»';
  $('userAvatar').textContent = c.owner.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  $('userName').textContent = c.owner;
  $('supportBanner').classList.toggle('hidden', !supportMode);
  $('supportCenterName').textContent = c.name;
}

async function renderRoute() {
  const path = location.hash.replace(/^#\/?/, '').split('?')[0];
  let tab = tabByPath(path);
  if (!tab) {
    if (path) showToast('Раздел «' + path + '» не найден или не загрузился. Обновите страницу (Cmd+Shift+R)', 'error');
    tab = 'profile'; history.replaceState(null, '', '#/profile');
  }
  const my = ++routeSeq;
  supportMode = hashParams().get('support') === '1';
  try {
    const list = (await api.cabinet.profileCenters()).items;
    if (my !== routeSeq) return;
    if (!list.length) throw new ApiError('NOT_FOUND', 'Нет центров с заполненным профилем');
    eduCenters = list;
    selectedCenterId = resolveCenterId(list);
    selectedCenterName = list.find(x => x.id === selectedCenterId).name;
  } catch (e) { showToast(errText(e), 'error'); return; }

  currentTab = tab;
  const view = VIEWS[tab];
  // адрес всегда содержит центр: ссылка из кабинета платформы и перезагрузка страницы ведут в один и тот же центр
  if (hashParams().get('center') !== String(selectedCenterId)) history.replaceState(null, '', '#/' + view.path + cabinetQuery());
  renderCenterChrome(eduCenters, selectedCenterId);
  renderNav();
  $('pageTitle').textContent = view.title;
  document.title = view.title + ' · ' + selectedCenterName;
  document.querySelectorAll('.view-panel').forEach(el => el.classList.add('hidden'));
  const panel = $('view-' + tab);
  if (panel) { panel.classList.remove('hidden'); panel.scrollTop = 0; }
  const navTab = $('nav-' + tab) ? tab : (view.parent && view.parent[1]);   // у дочернего экрана подсвечиваем родителя
  const active = $('nav-' + navTab);
  if (active) { active.classList.add('bg-brand-light', 'text-brand', 'font-semibold'); active.classList.remove('text-slate-600', 'font-medium'); }
  return view.render ? view.render() : undefined;   // промис экрана (для тестов)
}
