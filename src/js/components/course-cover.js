/* Общие элементы карточек курсов: обложка и подпись источника доступа. Используются и кабинетом платформы (Магазин методик), и кабинетом центра. */
// обложка — фотография из src/assets/courses (источники и лицензии: src/assets/courses/CREDITS.md); если файл не загрузился, показываем цветную плашку со знаком направления
const MP_COVER = {
  'Языки': ['from-sky-100 to-slate-200', 'text-sky-700', 'Aa'], 'Подготовка к НЦТ': ['from-slate-100 to-indigo-100', 'text-indigo-700', '∑'],
  'IT и программирование': ['from-slate-100 to-indigo-100', 'text-indigo-700', '</>'], 'Математика': ['from-emerald-100 to-sky-100', 'text-emerald-700', '÷ +'], 'Творчество': ['from-amber-100 to-rose-100', 'text-rose-600', '✎']
};
const mpCoverFallback = d => { const c = MP_COVER[d] || MP_COVER['Языки']; return `<div class="h-full w-full bg-gradient-to-br ${c[0]} flex items-center justify-center"><span class="text-4xl font-extrabold tracking-tight ${c[1]}">${esc(c[2])}</span></div>`; };
function mpCoverFail(img) { const box = img.parentElement; box.innerHTML = box.dataset.fallback; }
const mpCover = c => `<div class="h-36 rounded-xl overflow-hidden bg-slate-100 relative" data-fallback="${esc(mpCoverFallback(c.direction))}">
  <img src="${esc(c.cover)}" alt="${esc(c.title)}" loading="lazy" onerror="mpCoverFail(this)" class="w-full h-full object-cover">
  <span class="absolute left-2.5 top-2.5 px-2 py-0.5 rounded-md bg-white/90 text-[10px] font-semibold text-slate-700">${esc(c.direction)}</span></div>`;

// источник доступа центра к курсу: куплен (оплаченный счёт) или бонус
const MP_SOURCE = { invoice: ['emerald', 'Куплен'], bonus: ['indigo', 'Бонус'] };
