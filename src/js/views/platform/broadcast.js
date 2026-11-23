/* Экран: Системные рассылки */
registerView({
  tab: 'broadcast', path: 'broadcast',
  title: 'Рассылки (Broadcast)', parent: null,
  template: `
<main id="view-broadcast" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">Системные рассылки и баннеры</h1>
      <p class="text-xs text-slate-500 mt-1">Отправка уведомлений об обновлениях и технических работах в кабинеты центров</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
    <!-- Left Form -->
    <div class="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
      <h2 class="text-base font-bold text-slate-900">Создание рассылки</h2>

      <div>
        <label class="text-xs font-semibold text-slate-700 block mb-1">Заголовок сообщения *</label>
        <input id="broadcastTitle" type="text" value="Обновление: Экспорт ведомости зарплат в Excel" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-medium focus:outline-none focus:border-brand">
      </div>

      <div>
        <label class="text-xs font-semibold text-slate-700 block mb-1">Текст уведомления *</label>
        <textarea id="broadcastText" rows="4" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs leading-relaxed focus:outline-none focus:border-brand resize-none">Уважаемые партнеры! Теперь в разделе финансовой аналитики доступен экспорт зарплатных ведомостей в формат Excel для всех филиалов...</textarea>
      </div>

      <div>
        <label class="text-xs font-semibold text-slate-700 block mb-1">Аудитория (Таргетинг) *</label>
        <select id="broadcastAudience" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none cursor-pointer">
          <option>Все учебные центры • Душанбе и Худжанд (142)</option>
          <option>Только Душанбе (86 центров)</option>
          <option>Только Худжанд (32 центра)</option>
        </select>
      </div>

      <div>
        <label class="text-xs font-semibold text-slate-700 block mb-2">Роли получателей *</label>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked class="w-4 h-4 text-brand rounded border-slate-300">
            <span class="font-medium text-slate-800">Владельцы / Админы</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked class="w-4 h-4 text-brand rounded border-slate-300">
            <span class="font-medium text-slate-800">Преподаватели</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="w-4 h-4 text-brand rounded border-slate-300">
            <span class="font-medium text-slate-800">Кассиры</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="w-4 h-4 text-brand rounded border-slate-300">
            <span class="font-medium text-slate-800">Ученики</span>
          </label>
        </div>
      </div>

      <div>
        <label class="text-xs font-semibold text-slate-700 block mb-1">Формат отображения *</label>
        <select class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none">
          <option>Баннер вверху экрана + Push</option>
          <option>Модальное окно при входе</option>
          <option>Только в колокольчик</option>
        </select>
      </div>

      <div class="flex items-center justify-between pt-3 border-t border-slate-100">
        <span class="text-xs text-slate-500">Уведомление увидят <strong class="text-slate-800">142 организации</strong></span>
        <button onclick="sendBroadcast()" class="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold transition active:scale-95 shadow-xs">
          Отправить сейчас
        </button>
      </div>
    </div>

    <!-- Right History -->
    <div class="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-900">История рассылок</h2>
        <span class="text-xs font-semibold text-brand">Всего 4</span>
      </div>

      <div id="broadcastHistoryList" class="flex flex-col gap-3">
        <div class="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="font-bold text-xs text-slate-900">Обновление v1.2: Расчет ФОТ</div>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Отправлено
            </span>
          </div>
          <div class="text-[11px] text-slate-400">Вчера, 14:20</div>
          <div class="flex items-center justify-between text-[11px] text-slate-600 pt-1">
            <span>142 центра · Прочитали: 89%</span>
            <span>Охват: Владельцы</span>
          </div>
          <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div class="w-[89%] h-full bg-brand"></div>
          </div>
        </div>

        <div class="p-4 bg-slate-50 border-l-4 border-l-amber-500 border border-slate-200 rounded-xl flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="font-bold text-xs text-slate-900">Техработы в воскресенье 02:00</div>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Запланировано
            </span>
          </div>
          <div class="text-[11px] text-slate-400">22 ноября</div>
          <div class="flex items-center justify-between text-[11px] text-slate-600 pt-1">
            <span>Все центры (142)</span>
            <span class="text-slate-400">Баннер при входе</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</main>
`,
  render: null
});

// Broadcast Actions
function sendBroadcast() {
  const title = document.getElementById('broadcastTitle').value;
  if (!title) {
    showToast('Пожалуйста, укажите заголовок рассылки', 'error');
    return;
  }

  const list = document.getElementById('broadcastHistoryList');
  const item = document.createElement('div');
  item.className = 'p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2 animate-fadeIn';
  item.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="font-bold text-xs text-slate-900">${title}</div>
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Отправлено
      </span>
    </div>
    <div class="text-[11px] text-slate-400">Только что</div>
    <div class="flex items-center justify-between text-[11px] text-slate-600 pt-1">
      <span>142 центра · Доставлено 100%</span>
      <span>Охват: Все роли</span>
    </div>
    <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
      <div class="w-[100%] h-full bg-emerald-500"></div>
    </div>
  `;
  list.insertBefore(item, list.firstChild);
  showToast('Рассылка "' + title + '" успешно отправлена!', 'success');
}
