/* Пагинация таблиц и списков. Размер страницы по умолчанию — PAGE_SIZE (10).
   Экран держит у себя `page` и вызывает pagerHtml(key, {...}): компонент рисует «Показано a–b из N» и кнопки страниц,
   а по клику вызывает переданную функцию go(номер). Для клиентской нарезки полного списка есть paginate(). */
let PAGE_SIZE = 10;
const PAGER_HANDLERS = {};

// клиентская нарезка: возвращает { items, page, pages, from, total } с поправкой страницы, если она вышла за пределы
function paginate(list, page, size = PAGE_SIZE) {
  const total = list.length, pages = Math.max(1, Math.ceil(total / size)), p = Math.min(Math.max(1, page), pages), from = (p - 1) * size;
  return { items: list.slice(from, from + size), page: p, pages, from, total };
}

// компактный набор номеров: 1 … 4 5 [6] 7 8 … 20
function pagerNumbers(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, pages - 1, pages, page - 1, page, page + 1]), out = [];
  [...set].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b).forEach((n, i, arr) => { if (i && n - arr[i - 1] > 1) out.push(0); out.push(n); });
  return out;
}

/* key — уникальное имя пейджера; total — всего записей по текущим фильтрам; note — приписка справа от счётчика (например, «всего на платформе: 142») */
function pagerHtml(key, { page, size = PAGE_SIZE, total, note = '' }, go) {
  PAGER_HANDLERS[key] = go;
  const pages = Math.max(1, Math.ceil(total / size)), p = Math.min(page, pages), from = (p - 1) * size, to = Math.min(total, from + size);
  const btn = (label, target, { on = false, disabled = false, aria = '' } = {}) => `<button type="button" onclick="pagerGo('${key}', ${target})" ${disabled ? 'disabled' : ''} ${aria ? `aria-label="${aria}"` : ''} ${on ? 'aria-current="page"' : ''}
    class="min-w-[2rem] h-8 px-2 rounded-lg border text-xs font-semibold tabular-nums transition ${on ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} disabled:opacity-40 disabled:cursor-not-allowed">${label}</button>`;
  const summary = total ? `Показано <strong class="text-slate-700">${from + 1}–${to}</strong> из <strong class="text-slate-700">${total}</strong>${note ? ' · ' + note : ''}` : 'Нет записей' + (note ? ' · ' + note : '');
  return `<div class="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500" data-pager="${key}">
    <span>${summary}</span>
    ${pages > 1 ? `<nav class="flex items-center gap-1.5" aria-label="Страницы">
      ${btn('←', p - 1, { disabled: p <= 1, aria: 'Предыдущая страница' })}
      ${pagerNumbers(p, pages).map(n => n ? btn(n, n, { on: n === p, aria: 'Страница ' + n }) : '<span class="px-1 text-slate-400">…</span>').join('')}
      ${btn('→', p + 1, { disabled: p >= pages, aria: 'Следующая страница' })}
    </nav>` : ''}
  </div>`;
}
function pagerGo(key, n) { const h = PAGER_HANDLERS[key]; if (h) h(n); }
