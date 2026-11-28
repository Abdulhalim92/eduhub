/* Состояние запроса для экрана поверх RTK Query. При смене параметров (фильтр, страница) RTK Query оставляет в data прежнюю выдачу,
   а currentData пуст, пока не придёт новая: экран показывает прежнюю выдачу приглушённой, а не пустую таблицу. */

/** На экране прежняя выдача, новая ещё грузится. */
export const isShowingPrevious = (q: { isFetching: boolean; currentData?: unknown; data?: unknown }) =>
  q.isFetching && q.currentData === undefined && q.data !== undefined
