/* Экран кабинета центра: Поощрения (CTR-RWD-010). Каталог наград, которые ученики получают за coin. Цена в coin, статус «Активен / В архиве». */
registerView({
  tab: 'center-rewards', path: 'center-rewards',
  title: 'Поощрения', nav: { label: 'Поощрения', icon: 'award' },
  template: `
<main id="view-center-rewards" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div id="rwdHead"></div>
  <div class="flex flex-wrap items-center gap-3">
    <div id="rwdFilters"></div>
    <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-500">Цена, coin
      <input id="rwdFrom" type="number" min="0" placeholder="От" oninput="setRwdPrice()" class="w-20 bg-transparent font-semibold text-slate-800 py-1 focus:outline-none">—
      <input id="rwdTo" type="number" min="0" placeholder="До" oninput="setRwdPrice()" class="w-20 bg-transparent font-semibold text-slate-800 py-1 focus:outline-none"></div>
    ${cabResetLink('rwdReset', 'resetRwdFilters()')}
  </div>
  ${cabTable('rwd', ['Название', 'Категория', 'Цена, coin', 'Статус', 'Действия|r'], '40rem')}
</main>
`,
  render: renderRewards
});

const rwdState = { center: 0, status: '', priceFrom: '', priceTo: '', page: 1 };
let rwdItems = [], rwdCategories = [], rwdCanEdit = true, rwdTimer = null;

async function renderRewards() {
  if (rwdState.center !== selectedCenterId) Object.assign(rwdState, { center: selectedCenterId, status: '', priceFrom: '', priceTo: '', page: 1 });
  $('rwdFrom').value = rwdState.priceFrom; $('rwdTo').value = rwdState.priceTo;
  const my = begin('center-rewards');
  $('rwdRows').innerHTML = skeletonRows(5);
  try {
    const r = await api.cabinet.rewards.list(selectedCenterId, { ...rwdState, pageSize: PAGE_SIZE });
    if (stale('center-rewards', my)) return;
    rwdItems = r.items; rwdCategories = r.categories; rwdCanEdit = r.center.status === 'active';
    $('rwdHead').innerHTML = cabHead('Поощрения', 'Награды, которые ученики получают за накопленные coin.', rwdCanEdit ? cabAddButton('Добавить поощрение', 'openRwdForm()') : cabBlockedNote());
    $('rwdFilters').innerHTML = cabSelect('Статус', [{ value: '', label: 'Все' }, { value: 'active', label: 'Активен' }, { value: 'archived', label: 'В архиве' }], rwdState.status, 'setRwdStatus(this.value)');
    $('rwdReset').classList.toggle('hidden', !(rwdState.status || rwdState.priceFrom !== '' || rwdState.priceTo !== ''));
    $('rwdRows').innerHTML = r.items.length ? r.items.map(x => `<tr>
      <td class="py-3.5 font-semibold text-slate-900">${esc(x.name)}</td><td class="py-3.5 text-slate-600">${esc(x.category)}</td>
      <td class="py-3.5 tabular-nums text-slate-800">${x.price.toLocaleString('ru-RU')}</td>
      <td class="py-3.5">${x.status === 'active' ? badge('emerald', 'Активен') : badge('slate', 'В архиве')}</td>
      <td class="py-3.5 text-right">${rwdCanEdit ? menuGear(`rwdMenu(this, ${x.id})`) : ''}</td></tr>`).join('')
      : cabEmptyRow(5, rwdState.status || rwdState.priceFrom !== '' || rwdState.priceTo !== '' ? 'По этим условиям поощрений нет.' : 'Поощрений пока нет.');
    $('rwdPager').innerHTML = pagerHtml('rwd', { page: r.page, total: r.total }, n => { rwdState.page = n; renderRewards(); });
  } catch (e) { if (!stale('center-rewards', my)) $('rwdRows').innerHTML = errorRow(5, e); }
}

function setRwdStatus(v) { Object.assign(rwdState, { status: v, page: 1 }); renderRewards(); }
function setRwdPrice() { rwdState.priceFrom = $('rwdFrom').value; rwdState.priceTo = $('rwdTo').value; rwdState.page = 1; clearTimeout(rwdTimer); rwdTimer = setTimeout(renderRewards, 300); }
function resetRwdFilters() { Object.assign(rwdState, { status: '', priceFrom: '', priceTo: '', page: 1 }); renderRewards(); }

function rwdMenu(anchor, id) {
  const x = rwdItems.find(i => i.id === id);
  openMenu(anchor, [{ label: 'Изменить…', icon: 'sliders', run: () => openRwdForm(id) },
    x.status === 'active' ? { label: 'Убрать в архив', hint: 'Скрыть из каталога наград', icon: 'xcircle', run: () => rwdSetStatus(id, 'archived') } : { label: 'Вернуть в каталог', icon: 'check', run: () => rwdSetStatus(id, 'active') }]);
}
async function rwdSetStatus(id, status) {
  try { await api.cabinet.rewards.update(selectedCenterId, id, { status }); showToast(status === 'archived' ? 'Поощрение в архиве' : 'Поощрение снова в каталоге', 'success'); await renderRewards(); } catch (e) { showToast(errText(e), 'error'); }
}

function openRwdForm(id) {
  const x = id ? rwdItems.find(i => i.id === id) : null;
  openForm({
    title: x ? 'Изменить поощрение' : 'Добавить поощрение', sub: x ? x.name : 'Награда, которую ученик получает за coin',
    fields: [
      { key: 'name', label: 'Название', type: 'text', value: x ? x.name : '', placeholder: 'Например, Скидка 10% на курс', required: true },
      { key: 'category', label: 'Категория', type: 'select', value: x ? x.category : rwdCategories[0], options: rwdCategories.map(v => ({ value: v, label: v })), required: true },
      { key: 'price', label: 'Цена, coin', type: 'number', value: x ? x.price : '', placeholder: '500', required: true }
    ],
    submitLabel: x ? 'Сохранить' : 'Добавить',
    onSubmit: async v => {
      if (x) await api.cabinet.rewards.update(selectedCenterId, id, v); else await api.cabinet.rewards.create(selectedCenterId, v);
      showToast(x ? 'Поощрение сохранено' : 'Поощрение добавлено', 'success'); await renderRewards();
    }
  });
}
