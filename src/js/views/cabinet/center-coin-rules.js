/* Экран кабинета центра: Автоправила баллов (CTR-CIN-010). Условия автоматического начисления баллов по среднему проценту.
   В прототипе правила хранятся и включаются, но начисление по ним не выполняется (Q-019). */
registerView({
  tab: 'center-coin-rules', path: 'center-coin-rules',
  title: 'Автоправила баллов', nav: { label: 'Автоправила баллов', icon: 'sliders' },
  template: `
<main id="view-center-coin-rules" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div id="crlHead"></div>
  <div class="flex flex-wrap items-center gap-3"><div id="crlFilters"></div>${cabResetLink('crlReset', 'resetCrlFilters()')}</div>
  ${cabTable('crl', ['Название', 'Область', 'Условие', 'Награда, баллы', 'Статус', 'Действия|r'], '44rem')}
</main>
`,
  render: renderCoinRules
});

const crlState = { center: 0, scope: '', page: 1 };
let crlItems = [], crlScopes = {}, crlCanEdit = true;

async function renderCoinRules() {
  if (crlState.center !== selectedCenterId) Object.assign(crlState, { center: selectedCenterId, scope: '', page: 1 });
  const my = begin('center-coin-rules');
  $('crlRows').innerHTML = skeletonRows(6);
  try {
    const r = await api.cabinet.coinRules.list(selectedCenterId, { scope: crlState.scope, page: crlState.page, pageSize: PAGE_SIZE });
    if (stale('center-coin-rules', my)) return;
    crlItems = r.items; crlScopes = r.scopes; crlCanEdit = r.center.status === 'active';
    $('crlHead').innerHTML = cabHead('Автоправила баллов', 'Условия, при которых ученик получает баллы за посещаемость и успеваемость.', crlCanEdit ? cabAddButton('Добавить правило', 'openCrlForm()') : cabBlockedNote());
    $('crlFilters').innerHTML = cabSelect('Область', [{ value: '', label: 'Все' }, ...Object.entries(r.scopes).map(([value, label]) => ({ value, label }))], crlState.scope, 'setCrlScope(this.value)');
    $('crlReset').classList.toggle('hidden', !crlState.scope);
    $('crlRows').innerHTML = r.items.length ? r.items.map(x => `<tr>
      <td class="py-3.5 font-semibold text-slate-900">${esc(x.name)}</td><td class="py-3.5 text-slate-600">${esc(x.scopeLabel)}</td><td class="py-3.5 text-slate-600">${esc(x.condition)}</td>
      <td class="py-3.5 tabular-nums text-slate-800">${x.coin}</td><td class="py-3.5">${x.active ? badge('emerald', 'Активно') : badge('slate', 'Выключено')}</td>
      <td class="py-3.5 text-right">${crlCanEdit ? menuGear(`crlMenu(this, ${x.id})`) : ''}</td></tr>`).join('')
      : cabEmptyRow(6, crlState.scope ? 'В этой области правил нет.' : 'Правил пока нет.');
    $('crlPager').innerHTML = pagerHtml('crl', { page: r.page, total: r.total }, n => { crlState.page = n; renderCoinRules(); });
  } catch (e) { if (!stale('center-coin-rules', my)) $('crlRows').innerHTML = errorRow(6, e); }
}

function setCrlScope(v) { Object.assign(crlState, { scope: v, page: 1 }); renderCoinRules(); }
function resetCrlFilters() { Object.assign(crlState, { scope: '', page: 1 }); renderCoinRules(); }

function crlMenu(anchor, id) {
  const x = crlItems.find(i => i.id === id);
  openMenu(anchor, [{ label: 'Изменить…', icon: 'sliders', run: () => openCrlForm(id) },
    { label: x.active ? 'Выключить' : 'Включить', icon: x.active ? 'xcircle' : 'check', run: () => crlToggle(id, !x.active) }]);
}
async function crlToggle(id, active) {
  try { await api.cabinet.coinRules.update(selectedCenterId, id, { active }); showToast(active ? 'Правило включено' : 'Правило выключено', 'success'); await renderCoinRules(); } catch (e) { showToast(errText(e), 'error'); }
}

function openCrlForm(id) {
  const x = id ? crlItems.find(i => i.id === id) : null;
  openForm({
    title: x ? 'Изменить правило' : 'Добавить правило', sub: 'Ученик получает баллы, когда его средний процент не ниже порога',
    fields: [
      { key: 'name', label: 'Название', type: 'text', value: x ? x.name : '', placeholder: 'Например, Отличная посещаемость', required: true },
      { key: 'scope', label: 'Область', type: 'select', value: x ? x.scope : 'academy', options: Object.entries(crlScopes).map(([value, label]) => ({ value, label })), required: true },
      { key: 'threshold', label: 'Средний процент не ниже', type: 'number', value: x ? x.threshold : 90, required: true },
      { key: 'coin', label: 'Награда, баллы', type: 'number', value: x ? x.coin : 30, required: true }
    ],
    submitLabel: x ? 'Сохранить' : 'Добавить',
    onSubmit: async v => {
      if (x) await api.cabinet.coinRules.update(selectedCenterId, id, v); else await api.cabinet.coinRules.create(selectedCenterId, v);
      showToast(x ? 'Правило сохранено' : 'Правило добавлено', 'success'); await renderCoinRules();
    }
  });
}
