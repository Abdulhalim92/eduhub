/* Выпадающее меню действий («⋯» в строке таблицы, «Ещё ▾» в панелях).
   Почему не ряд кнопок: 3+ действий в строке засоряют таблицу; одно меню оставляет в строке только главное действие.
   Меню рисуется в #menuRoot с position: fixed и позиционируется по якорю — иначе его обрежет `overflow-x: auto` таблицы.
   Поведение: открывается под якорем (или над ним, если снизу нет места), закрывается по клику вне, Esc, Tab, прокрутке и ресайзу;
   стрелки ↑/↓/Home/End двигают фокус, Enter/Space выполняют пункт (role="menu" / "menuitem", aria-expanded на якоре).

   Пункты: { label, hint?, icon?, run, danger?, disabled? } | { divider: true } | { heading: 'Текст' }; run — функция. */
const menuState = { items: [], anchor: null, anchorPos: null };

// небольшой набор иконок (heroicons outline) для меню и бейджей каналов оплаты
const ICON = {
  card: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  bank: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z',
  cash: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  phone: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  tag: 'M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  check: 'M5 13l4 4L19 7',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  download: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  open: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
  xcircle: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  cog: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  wallet: 'M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5m0 0h-4a2 2 0 100 4h4v-4z',
  plus: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
  swap: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  enter: 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1',
  sliders: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
};
const iconSvg = (name, cls = 'w-4 h-4') => `<svg class="${cls}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${ICON[name]}"/></svg>`;

function mountMenu() {
  $('menuRoot').innerHTML = '<div id="menuPopover" role="menu" tabindex="-1" class="hidden fixed z-[60] min-w-[15rem] max-w-[21rem] bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 text-xs" onkeydown="menuKey(event)"></div>';
  document.addEventListener('mousedown', e => { if (menuIsOpen() && !e.target.closest('#menuPopover') && !e.target.closest('[data-menu-trigger]')) closeMenu(); });
  window.addEventListener('resize', () => closeMenu());
  // закрываем только если якорь реально сместился (прокрутка таблицы/страницы); ложные scroll-события меню не ломают
  document.addEventListener('scroll', e => {
    if (!menuIsOpen() || !menuState.anchor || (e.target instanceof Element && e.target.closest('#menuPopover'))) return;
    const r = menuState.anchor.getBoundingClientRect(), p = menuState.anchorPos;
    if (!p || Math.abs(r.top - p.top) > 1 || Math.abs(r.left - p.left) > 1) closeMenu();
  }, true);
}

const menuIsOpen = () => { const p = $('menuPopover'); return !!p && !p.classList.contains('hidden'); };
const menuButtons = () => [...document.querySelectorAll('#menuPopover [role="menuitem"]:not([disabled])')];

function openMenu(anchor, items) {
  if (menuIsOpen() && menuState.anchor === anchor) { closeMenu(); return; }   // повторный клик по якорю закрывает
  closeMenu();
  menuState.items = items; menuState.anchor = anchor;
  const pop = $('menuPopover');
  pop.innerHTML = items.map((it, i) => {
    if (it.divider) return '<div class="my-1.5 border-t border-slate-100" role="separator"></div>';
    if (it.heading) return `<div class="px-3 pt-2 pb-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">${esc(it.heading)}</div>`;
    const tone = it.disabled ? 'text-slate-300 cursor-not-allowed' : it.danger ? 'text-rose-600 hover:bg-rose-50 focus:bg-rose-50' : 'text-slate-700 hover:bg-slate-50 focus:bg-slate-50';
    return `<button type="button" role="menuitem" tabindex="-1" ${it.disabled ? 'disabled aria-disabled="true"' : ''} onclick="menuPick(${i})" class="w-full text-left px-3 py-2 flex items-start gap-2.5 transition focus:outline-none ${tone}">
      ${it.icon ? `<span class="mt-0.5 flex-shrink-0 ${it.danger ? 'text-rose-500' : 'text-slate-400'}">${iconSvg(it.icon)}</span>` : '<span class="w-4 flex-shrink-0"></span>'}
      <span class="flex-1"><span class="block font-medium">${esc(it.label)}</span>${it.hint ? `<span class="block text-[11px] text-slate-400 font-normal mt-0.5 leading-snug">${esc(it.hint)}</span>` : ''}</span>
    </button>`;
  }).join('');
  pop.classList.remove('hidden');
  pop.style.visibility = 'hidden';
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);       // не помещается снизу — открываем над якорем
  pop.style.left = left + 'px'; pop.style.top = top + 'px'; pop.style.visibility = '';
  menuState.anchorPos = { top: r.top, left: r.left };
  anchor.setAttribute('aria-expanded', 'true');
  const first = menuButtons()[0]; if (first) first.focus({ preventScroll: true });
}

function closeMenu(restoreFocus = false) {
  const pop = $('menuPopover');
  if (!pop || pop.classList.contains('hidden')) return;
  pop.classList.add('hidden');
  const a = menuState.anchor;
  if (a) { a.setAttribute('aria-expanded', 'false'); if (restoreFocus) a.focus(); }
  menuState.anchor = null;
}

function menuPick(i) {
  const it = menuState.items[i];
  if (!it || it.disabled || !it.run) return;
  closeMenu();
  it.run();
}

function menuKey(e) {
  const btns = menuButtons(), i = btns.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); (btns[(i + 1) % btns.length] || btns[0]).focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); (btns[(i - 1 + btns.length) % btns.length] || btns[0]).focus(); }
  else if (e.key === 'Home') { e.preventDefault(); btns[0].focus(); }
  else if (e.key === 'End') { e.preventDefault(); btns[btns.length - 1].focus(); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
  else if (e.key === 'Tab') { closeMenu(); }
}

// якорь меню строки таблицы: шестерёнка со стрелкой — заметная кнопка «Действия» (рамка, подсветка при наведении)
const menuGear = (call, label = 'Действия') => `<button type="button" data-menu-trigger aria-haspopup="menu" aria-expanded="false" aria-label="${label}" title="${label}" onclick="event.stopPropagation(); ${call}" class="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 hover:text-brand hover:border-brand/50 hover:bg-brand-light/40 shadow-xs transition focus:outline-none focus:ring-2 focus:ring-brand/30">${iconSvg('cog', 'w-4 h-4')}<svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"/></svg></button>`;
// якорь меню: «⋯» (устар., оставлен для совместимости) или «Ещё ▾» (панели). onclick-выражение получает кнопку как this
const menuKebab = (call, label = 'Действия') => `<button type="button" data-menu-trigger aria-haspopup="menu" aria-expanded="false" aria-label="${label}" title="${label}" onclick="event.stopPropagation(); ${call}" class="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition focus:outline-none focus:ring-2 focus:ring-brand/30">${iconSvg('dots', 'w-5 h-5')}</button>`;
const menuDropdownBtn = (call, label = 'Ещё') => `<button type="button" data-menu-trigger aria-haspopup="menu" aria-expanded="false" onclick="event.stopPropagation(); ${call}" class="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-brand/30">${label}<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg></button>`;
