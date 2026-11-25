/* Оформление таблиц-реестров (docs/design/ui-principles.md → «Таблицы»; прототип — src/css/app.css):
   тонированная шапка со скруглёнными краями, вертикальные линии между столбцами, отступы у крайних столбцов (таблица на всю ширину карточки). */
export const dataTableClass = [
  'w-full text-left text-xs',
  '[&_td]:px-3 [&_th]:px-3 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap',
  '[&_thead_th]:bg-slate-100 [&_thead_th]:py-[0.7rem] [&_thead_th]:font-semibold [&_thead_th]:text-table-head-text',
  '[&_thead_th:first-child]:rounded-l-xl [&_thead_th:last-child]:rounded-r-xl',
  '[&_td:not(:last-child)]:border-r [&_td]:border-table-divider [&_th:not(:last-child)]:border-r [&_th]:border-table-divider-head',
  '[&_td:first-child]:pl-6 [&_th:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:last-child]:pr-6',
].join(' ')
