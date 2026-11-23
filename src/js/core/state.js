/* Клиентское состояние: справочники, кэш центров, защита от гонок и двойных кликов. */
/* ---- клиентское состояние: то, что получено из api ---- */
const state = { dict: null, attention: null };
const dict = () => state.dict || { cities: [], directions: [], managers: [], payMethods: [], plans: [] };
const centerCache = new Map();                       // id → последний полученный DTO (для действий по id)
const cacheCenters = items => items.forEach(c => centerCache.set(c.id, c));
const cname = id => (centerCache.get(id) || {}).name || 'центр';

// защита от гонок: ответ устаревшего запроса не должен перерисовать экран
const seq = {};
const begin = key => (seq[key] = (seq[key] || 0) + 1);
const stale = (key, n) => seq[key] !== n || currentTab !== key;

// защита от двойного клика по действиям, меняющим данные
let busy = false;
async function mutate(fn, okMsg, okType = 'success') {
  if (busy) return false;
  busy = true;
  try {
    const r = await fn();
    if (okMsg) showToast(typeof okMsg === 'function' ? okMsg(r) : okMsg, okType);
    return r === undefined ? true : r;
  } catch (e) {
    showToast(errText(e), 'error');
    return false;
  } finally { busy = false; }
}
