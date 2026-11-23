/* =====================================================================
   Роутер (hash), реестр экранов и режим поддержки (Impersonation).

   Экран = один файл в js/views/ и вызов
     registerView({ tab, path, title, parent, template, render })
       tab       — внутренний id (view-<tab>, nav-<tab>, switchTab('<tab>'))
       path      — адрес после «#/» (например 'centers/new')
       title     — заголовок в крошках и <title>
       parent    — [подпись, tab|null] для крошек (необязательно)
       template  — HTML-разметка <main id="view-<tab>" class="view-panel ...">
       render    — функция экрана (async, сама ходит в api) или null
   Шаблоны всех экранов монтируются в #viewport при старте (mountViews).
   ===================================================================== */
const VIEWS = {};
function registerView(v) { VIEWS[v.tab] = v; }
const routePath = tab => (VIEWS[tab] ? VIEWS[tab].path : tab);
const tabByPath = path => Object.keys(VIEWS).find(t => VIEWS[t].path === path);
const TAB_ALIASES = { dashboard: 'home' };

let currentTab = 'home';

function mountViews() {
  $('viewport').innerHTML = Object.values(VIEWS).map(v => v.template).join('\n');
}

function switchTab(tabId) {
  tabId = TAB_ALIASES[tabId] || tabId;
  const target = '#/' + routePath(tabId);
  if (location.hash === target) renderRoute(); else location.hash = target;
}

function renderBreadcrumbs(tab) {
  const v = VIEWS[tab], parent = v && v.parent;
  const sep = '<span class="text-slate-300">/</span>';
  let html = `<span>Платформа</span>${sep}`;
  if (parent) {
    html += parent[1] ? `<a href="#/${routePath(parent[1])}" class="hover:text-brand transition">${parent[0]}</a>` : `<span>${parent[0]}</span>`;
    html += sep;
  }
  html += `<span id="currentSectionTitle" class="text-slate-900 font-semibold">${v ? v.title : 'Раздел'}</span>`;
  $('breadcrumbs').innerHTML = html;
}

function renderRoute() {
  const path = location.hash.replace(/^#\/?/, '').split('?')[0];
  let tab = tabByPath(path);
  if (!tab) {
    // не молчим: чаще всего это экран, чей скрипт не загрузился (кеш браузера) или неверная ссылка
    if (path) showToast('Раздел «' + path + '» не найден или не загрузился. Обновите страницу (Cmd+Shift+R)', 'error');
    tab = 'home'; history.replaceState(null, '', '#/home');
  }

  currentTab = tab;
  const view = VIEWS[tab];
  renderBreadcrumbs(tab);
  document.title = view.title + ' · ЛИНИЯ';

  document.querySelectorAll('.view-panel').forEach(el => el.classList.add('hidden'));
  const panel = $('view-' + tab);
  if (panel) { panel.classList.remove('hidden'); panel.scrollTop = 0; }

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('bg-brand-light', 'text-brand', 'font-semibold');
    el.classList.add('text-slate-600', 'font-medium');
  });
  const navTab = $('nav-' + tab) || !view.parent ? tab : view.parent[1];   // у дочернего экрана без своего пункта подсвечиваем родителя
  const activeNav = $('nav-' + navTab);
  if (activeNav) {
    activeNav.classList.add('bg-brand-light', 'text-brand', 'font-semibold');
    activeNav.classList.remove('text-slate-600', 'font-medium');
  }
  revealNavFor(navTab);
  const jumper = $('screenJumper');
  if (jumper) jumper.value = tab;

  return view.render ? view.render() : undefined;   // промис экрана (для тестов)
}

/* ---- Вход в кабинет центра (режим поддержки) ----
   Кабинет центра — отдельная страница (eduhub.html): вход записывается в журнал аудита и открывает нужный центр.
   Баннер режима поддержки и выход обратно в платформу живут на странице кабинета. */
async function enterImpersonationById(id) {
  try { await api.support.enter({ centerId: id }); } catch (e) { /* журнал недоступен — вход не блокируем, но на проде запись обязательна */ }
  location.href = 'eduhub.html#/profile?center=' + id + '&support=1';
}
