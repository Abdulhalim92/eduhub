/* Экран: Настройки платформы (справочники) */
registerView({
  tab: 'settings', path: 'settings',
  title: 'Настройки платформы', parent: null,
  template: `
<main id="view-settings" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Глобальные справочники и настройки</h1>
      <p class="text-xs text-slate-500 mt-1">Управление городами, направлениями обучения и SMS-шлюзами</p>
    </div>
    <button onclick="showToast('Все глобальные настройки успешно сохранены', 'success')" class="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs transition">
      Сохранить настройки
    </button>
  </div>

  <!-- Tabs Navigation -->
  <div class="flex items-center gap-8 border-b border-slate-200 text-xs font-semibold">
    <button onclick="switchSettingsTab('cities')" id="stab-cities" class="pb-3 text-brand border-b-2 border-brand transition">Города и районы</button>
    <button onclick="switchSettingsTab('directions')" id="stab-directions" class="pb-3 text-slate-600 hover:text-slate-900 border-b-2 border-transparent transition">Предметные направления</button>
    <button onclick="switchSettingsTab('sms')" id="stab-sms" class="pb-3 text-slate-600 hover:text-slate-900 border-b-2 border-transparent transition">SMS-шлюзы и провайдеры</button>
      </div>

  <!-- Settings Tab Content -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
    
    <!-- Tab: Cities (6 cols) -->
    <div id="settings-pane-cities" data-pane="cities" class="lg:col-span-8 xl:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
      <h2 class="text-base font-bold text-slate-900">Справочник городов (Каталог на карте)</h2>

      <div id="citiesList" class="flex flex-col divide-y divide-slate-100">
        <div class="py-3 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-slate-900">Душанбе</div>
            <div class="text-[11px] text-slate-400">4 района · 86 центров</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Активен
            </span>
            <button onclick="toggleSwitch(this)" class="w-10 h-5 bg-brand rounded-full p-0.5 cursor-pointer flex items-center justify-end transition">
              <span class="w-4 h-4 bg-white rounded-full shadow-xs"></span>
            </button>
          </div>
        </div>

        <div class="py-3 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-slate-900">Худжанд</div>
            <div class="text-[11px] text-slate-400">32 центра</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Активен
            </span>
            <button onclick="toggleSwitch(this)" class="w-10 h-5 bg-brand rounded-full p-0.5 cursor-pointer flex items-center justify-end transition">
              <span class="w-4 h-4 bg-white rounded-full shadow-xs"></span>
            </button>
          </div>
        </div>

        <div class="py-3 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-slate-900">Бохтар</div>
            <div class="text-[11px] text-slate-400">14 центров</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Активен
            </span>
            <button onclick="toggleSwitch(this)" class="w-10 h-5 bg-brand rounded-full p-0.5 cursor-pointer flex items-center justify-end transition">
              <span class="w-4 h-4 bg-white rounded-full shadow-xs"></span>
            </button>
          </div>
        </div>

        <div class="py-3 flex items-center justify-between">
          <div>
            <div class="text-xs font-bold text-slate-900">Куляб</div>
            <div class="text-[11px] text-slate-400">10 центров</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Активен
            </span>
            <button onclick="toggleSwitch(this)" class="w-10 h-5 bg-brand rounded-full p-0.5 cursor-pointer flex items-center justify-end transition">
              <span class="w-4 h-4 bg-white rounded-full shadow-xs"></span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-2">
        <input id="newCityInput" type="text" placeholder="Название города..." class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none">
        <button onclick="addCity()" class="px-4 py-1.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold">
          + Добавить город
        </button>
      </div>
    </div>

    <!-- Tab: Directions (6 cols) -->
    <div id="settings-pane-directions" class="lg:col-span-12 flex flex-col gap-5 max-w-3xl">
      <div data-pane="directions" class="hidden bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
        <h2 class="text-base font-bold text-slate-900">Предметные направления (Фильтры)</h2>

        <div id="tagsList" class="flex flex-wrap gap-2 text-xs">
          <span class="px-3 py-1.5 bg-slate-100 text-slate-800 font-medium rounded-xl flex items-center gap-1.5">
            <span>Английский язык</span>
            <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 text-[10px]">✕</button>
          </span>
          <span class="px-3 py-1.5 bg-slate-100 text-slate-800 font-medium rounded-xl flex items-center gap-1.5">
            <span>Подготовка к НЦТ</span>
            <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 text-[10px]">✕</button>
          </span>
          <span class="px-3 py-1.5 bg-slate-100 text-slate-800 font-medium rounded-xl flex items-center gap-1.5">
            <span>Математика</span>
            <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 text-[10px]">✕</button>
          </span>
          <span class="px-3 py-1.5 bg-slate-100 text-slate-800 font-medium rounded-xl flex items-center gap-1.5">
            <span>Программирование / IT</span>
            <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 text-[10px]">✕</button>
          </span>
          <span class="px-3 py-1.5 bg-slate-100 text-slate-800 font-medium rounded-xl flex items-center gap-1.5">
            <span>Ментальная арифметика</span>
            <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 text-[10px]">✕</button>
          </span>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <input id="newTagInput" type="text" placeholder="Например, Физика или Химия" class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-brand">
          <button onclick="addNewTag()" class="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold">
            + Добавить
          </button>
        </div>
      </div>

      <!-- SMS Gateways Card -->
      <div data-pane="sms" class="hidden bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-3">
        <h2 class="text-base font-bold text-slate-900">SMS-шлюзы и провайдеры</h2>
        <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2 text-xs">
          <div class="flex items-center justify-between">
            <div class="font-bold text-sm text-slate-900">Шлюз TJ-SMS</div>
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Подключен
            </span>
          </div>
          <div class="text-slate-700 font-semibold pt-1">Баланс шлюза: 120 000 SMS</div>
          <div class="text-[11px] text-slate-500 leading-relaxed">
            Провайдер: Babilon-M / Tcell. Скорость отправки: ~50 SMS/сек.<br>
            Последний пинг: 1 мин. назад (Задержка 12 мс)
          </div>
        </div>
      </div>
    </div>

  </div>
</main>
`,
  render: null
});

// Settings actions
// вкладки показывают по одному разделу; «Локализация» убрана, пока нет рабочего экрана (см. спецификацию, раздел 6)
function switchSettingsTab(tabKey) {
  document.querySelectorAll('#view-settings [data-pane]').forEach(el => el.classList.toggle('hidden', el.dataset.pane !== tabKey));
  document.querySelectorAll('#view-settings [id^="stab-"]').forEach(b => {
    const on = b.id === 'stab-' + tabKey;
    b.className = 'pb-3 border-b-2 transition ' + (on ? 'text-brand border-brand' : 'text-slate-600 hover:text-slate-900 border-transparent');
  });
}

function addCity() {
  const input = document.getElementById('newCityInput');
  const val = input.value.trim();
  if (!val) return;
  const list = document.getElementById('citiesList');
  const row = document.createElement('div');
  row.className = 'py-3 flex items-center justify-between animate-fadeIn';
  row.innerHTML = `
    <div>
      <div class="text-xs font-bold text-slate-900">${val}</div>
      <div class="text-[11px] text-slate-400">1 филиал · Новый</div>
    </div>
    <div class="flex items-center gap-3">
      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Активен
      </span>
      <button onclick="toggleSwitch(this)" class="w-10 h-5 bg-brand rounded-full p-0.5 cursor-pointer flex items-center justify-end transition">
        <span class="w-4 h-4 bg-white rounded-full shadow-xs"></span>
      </button>
    </div>
  `;
  list.appendChild(row);
  input.value = '';
  showToast('Город ' + val + ' добавлен в справочник', 'success');
}

function addNewTag() {
  const input = document.getElementById('newTagInput');
  const val = input.value.trim();
  if (!val) return;
  const container = document.getElementById('tagsList');
  const tag = document.createElement('span');
  tag.className = 'px-3 py-1.5 bg-slate-100 text-slate-800 font-medium rounded-xl flex items-center gap-1.5 animate-fadeIn';
  tag.innerHTML = `
    <span>${val}</span>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 text-[10px]">✕</button>
  `;
  container.appendChild(tag);
  input.value = '';
  showToast('Направление "' + val + '" добавлено', 'success');
}
