/* Сайдбар SuperAdmin (секции-аккордеон) и счётчики внимания из api.platform.attention(). */
/* =====================================================================
   3. САЙДБАР (генерируется из конфига; бейджи — из api.platform.attention)
   ===================================================================== */
const NAV_ICONS = {
  grid: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5',
  plus: 'M12 4v16m8-8H4',
  pin: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  warn: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  up: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  chart: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z',
  card: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  book: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  sms: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  mega: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  cog: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
};
const SUPER_NAV = [
  { group: 'Платформа', items: [
    { tab: 'home', label: 'Главная', icon: 'grid' },
    { tab: 'centers', label: 'Все центры', icon: 'building' },
    { tab: 'center-new', label: 'Подключить центр', icon: 'plus' }
  ] },
  { group: 'Требует внимания', attention: true, items: [
    { tab: 'moderation', label: 'Модерация каталога', icon: 'pin' },
    { tab: 'expiring', label: 'Истекают подписки', icon: 'clock' },
    { tab: 'churn', label: 'Риск оттока', icon: 'warn' },
    { tab: 'limits', label: 'Центры у лимита', icon: 'up' }
  ] },
  { group: 'Монетизация', open: false, items: [
    { tab: 'plans', label: 'Тарифы и лимиты', icon: 'chart' },
    { tab: 'billing', label: 'В2В-Биллинг и счета', icon: 'card' },
    { tab: 'marketplace', label: 'Магазин методик', icon: 'book' },
    { tab: 'sms', label: 'Биллинг SMS', icon: 'sms' }
  ] },
  { group: 'Система', open: false, items: [
    { tab: 'broadcast', label: 'Рассылки (Broadcast)', icon: 'mega' },
    { tab: 'audit', label: 'Журнал аудита', icon: 'shield' },
    { tab: 'settings', label: 'Настройки платформы', icon: 'cog' }
  ] }
];

// Секции сайдбара сворачиваются; состояние запоминается, активная секция раскрывается сама
const NAV_STORE_KEY = 'liniya.navOpen';
let navOpen = {};
try { navOpen = JSON.parse(localStorage.getItem(NAV_STORE_KEY)) || {}; } catch (e) { navOpen = {}; }
const navIsOpen = g => (g.group in navOpen ? !!navOpen[g.group] : g.open !== false);
function saveNavOpen() { try { localStorage.setItem(NAV_STORE_KEY, JSON.stringify(navOpen)); } catch (e) { /* storage недоступен */ } }

function renderSuperNav() {
  $('superadminNav').innerHTML = SUPER_NAV.map((g, i) => {
    const open = navIsOpen(g);
    return `
    <button onclick="toggleNavGroup(${i})" aria-expanded="${open}" class="flex items-center justify-between w-full px-2 py-1.5 ${i ? 'mt-1' : ''} rounded-lg text-[10px] uppercase font-bold text-slate-400 tracking-wider hover:text-slate-600 hover:bg-slate-50 transition">
      <span class="flex items-center gap-2">${g.group}</span>
      <svg id="chev-${i}" class="w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
    </button>
    <div id="navgroup-${i}" class="flex flex-col gap-1 ${open ? '' : 'hidden'}">
    ${g.items.map(it => `
      <button onclick="${it.toast ? `showToast('${it.toast}', '${it.toastType || 'info'}')` : `switchTab('${it.tab}')`}" id="nav-${it.tab}" class="nav-item flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 font-medium text-left transition">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${NAV_ICONS[it.icon]}"/></svg>
        <span class="flex-1 truncate">${it.label}</span>
      </button>`).join('')}
    </div>`;
  }).join('');
  applyAttention();
}

function setNavGroupOpen(i, open) {
  navOpen[SUPER_NAV[i].group] = open;
  $('navgroup-' + i).classList.toggle('hidden', !open);
  $('chev-' + i).classList.toggle('-rotate-90', !open);
  $('chev-' + i).parentElement.setAttribute('aria-expanded', open);
  saveNavOpen();
}
function toggleNavGroup(i) { setNavGroupOpen(i, !navIsOpen(SUPER_NAV[i])); }
function revealNavFor(tab) {
  const i = SUPER_NAV.findIndex(g => g.items.some(it => it.tab === tab));
  if (i >= 0 && !navIsOpen(SUPER_NAV[i])) setNavGroupOpen(i, true);
}

/* счётчики: один запрос api.platform.attention → state.attention и карточки «Требует внимания» на главной (в сайдбаре чисел нет) */
async function refreshAttention() {
  try { state.attention = await api.platform.attention(); applyAttention(); }
  catch (e) { /* бейджи не критичны: оставляем прежние значения */ }
}
function applyAttention() {
  const a = state.attention;
  if (!a) return;
  const set = (id, v) => { const el = $(id); if (el) el.innerText = v; };
  set('att-moderation', a.moderation + ' ' + plural(a.moderation, ['новый филиал ожидает', 'новых филиала ожидают', 'новых филиалов ожидают']) + ' проверки');
  set('att-expiring', a.expiring + ' ' + plural(a.expiring, ['центр требует', 'центра требуют', 'центров требуют']) + ' продления');
  set('att-churn', a.churn + ' ' + plural(a.churn, ['центр не заходил', 'центра не заходили', 'центров не заходили']) + ' >10 дней');
  set('att-limits', a.nearLimit + ' ' + plural(a.nearLimit, ['центр подошёл', 'центра подошли', 'центров подошли']) + ' к лимиту тарифа');
  set('attTotal', a.moderation + a.expiring + a.churn + a.nearLimit);
}
