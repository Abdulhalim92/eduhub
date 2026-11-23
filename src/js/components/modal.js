/* Модальное окно: единая оболочка для диалогов (оплата, смена тарифа, отмена счёта).
   Монтируется в #modalRoot, вне экранов: у .animate-fadeIn после анимации остаётся transform, из-за него position: fixed внутри экрана ломается. */
function mountModal() {
  $('modalRoot').innerHTML = `
    <div id="panelOverlay" class="hidden fixed inset-0 z-[42]">
      <div class="absolute inset-0 bg-slate-900/35" onclick="closePanel()"></div>
      <aside id="panelBox" role="dialog" aria-modal="true" class="absolute right-0 top-0 bottom-0 w-full max-w-[34rem] bg-white shadow-2xl flex flex-col"></aside>
    </div>
    <div id="modalOverlay" class="hidden fixed inset-0 z-[45] bg-slate-900/45 overflow-y-auto" onclick="if (event.target === this) closeModal()">
      <div class="min-h-full flex items-start justify-center p-4" onclick="if (event.target === this) closeModal()">
        <div id="modalBox" role="dialog" aria-modal="true" class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6"></div>
      </div>
    </div>`;
  // Esc закрывает верхний слой: сначала модалку, затем боковую панель (меню закрывает себя само)
  document.addEventListener('keydown', e => { if (e.key !== 'Escape' || (typeof menuIsOpen === 'function' && menuIsOpen())) return; if (modalIsOpen()) closeModal(); else if (panelIsOpen()) closePanel(); });
}

/* Боковая панель (slide-over): карточки сущностей, которые открываются из таблиц (счёт и т.п.) */
let panelKind = null;                                  // что показано в панели: 'invoice' | 'finance' — обновляем только свою
const panelIsOpen = () => { const o = $('panelOverlay'); return !!o && !o.classList.contains('hidden'); };
function openPanel(html, kind = null) { panelKind = kind; $('panelBox').innerHTML = html; $('panelOverlay').classList.remove('hidden'); }
function setPanel(html) { $('panelBox').innerHTML = html; }
function closePanel() { const o = $('panelOverlay'); if (!o) return; o.classList.add('hidden'); $('panelBox').innerHTML = ''; panelKind = null; }

// шапка боковой панели (общая для панелей платформы и кабинета центра)
const panelHeader = (title, badges) => `
  <div class="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 flex-shrink-0">
    <div class="flex items-center gap-3 min-w-0"><h2 class="text-base font-extrabold text-slate-900 truncate">${title}</h2>${badges || ''}</div>
    <button onclick="closePanel()" class="text-slate-400 hover:text-slate-600 text-lg leading-none p-1" title="Закрыть (Esc)">✕</button>
  </div>`;

const modalIsOpen = () => { const o = $('modalOverlay'); return !!o && !o.classList.contains('hidden'); };
function openModal(html) { $('modalBox').innerHTML = html; $('modalOverlay').classList.remove('hidden'); }
function setModal(html) { $('modalBox').innerHTML = html; }
function closeModal() { const o = $('modalOverlay'); if (!o) return; o.classList.add('hidden'); $('modalBox').innerHTML = ''; }

const modalHeader = (title, sub) => `
  <div class="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
    <div class="min-w-0">
      <h2 class="text-base font-extrabold text-slate-900">${title}</h2>
      ${sub ? `<p class="text-[11px] text-slate-500 mt-0.5">${sub}</p>` : ''}
    </div>
    <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 text-lg leading-none p-1" title="Закрыть (Esc)">✕</button>
  </div>`;
const modalLoading = title => `${modalHeader(title, '')}<div class="p-6 flex flex-col gap-3">${Array.from({ length: 3 }, () => '<div class="h-14 bg-slate-100 rounded-xl animate-pulse"></div>').join('')}</div>`;
const modalError = (title, e) => `${modalHeader(title, '')}<div class="p-6">${errorBox(e)}</div>`;

// после действий в модалке обновляем экран под ней (он мог показывать устаревшие статусы)
function refreshCurrentView() { const v = VIEWS[currentTab]; return v && v.render ? v.render() : undefined; }

// поле «причина / комментарий» и прочие однотипные элементы форм
function formField(id, label, inner, error, hint) {
  return `<label class="flex flex-col gap-1.5">
    <span class="text-[11px] font-semibold text-slate-600">${label}</span>
    ${inner}
    ${hint ? `<span class="text-[11px] text-slate-400">${hint}</span>` : ''}
    ${error ? `<span id="err-${id}" class="text-[11px] text-rose-600">${esc(error)}</span>` : ''}
  </label>`;
}
const inputCls = err => `px-3 py-2.5 bg-white border ${err ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand`;
