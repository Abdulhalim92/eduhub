/* Выдвижная панель «Настройка модулей» (Feature Flags): шаблон + логика.
   Монтируется в #drawerRoot (см. main.js). */
const DRAWER_TEMPLATE = `
<div id="drawerBackdrop" onclick="closeDrawer()" class="hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 transition-opacity"></div>
<aside id="moduleDrawer" class="fixed top-0 bottom-0 right-0 w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between p-6 z-40 transform translate-x-full transition-transform duration-200 ease-out">
  <div class="flex flex-col gap-6 overflow-y-auto pr-1">
    <div class="flex items-start justify-between">
      <div>
        <span class="text-[10px] font-bold text-brand uppercase tracking-wider">Панель управления</span>
        <h2 id="drawerCenterTitle" class="text-base font-bold text-slate-900 leading-snug mt-0.5">Настройка модулей:<br>Центр Перспектива</h2>
      </div>
      <button onclick="closeDrawer()" class="text-slate-400 hover:text-slate-600 text-lg leading-none p-1">✕</button>
    </div>

    <button onclick="enterImpersonationFromDrawer()" class="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
      <span>Войти как администратор центра (Impersonation)</span>
    </button>

    <button id="drawerPeopleBtn" onclick="drawerOpenPeople()" class="hidden w-full py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Состав центра: группы, ученики, сотрудники</button>

    <button id="drawerAccessBtn" onclick="drawerAdminAccess()" class="hidden w-full py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Данные для входа администратора центра</button>

    <div id="drawerPlanBlock" class="hidden p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Тариф центра</div>
        <div id="drawerPlanName" class="text-xs font-bold text-slate-900 mt-0.5"></div>
        <div id="drawerPlanSub" class="text-[11px] text-slate-500"></div>
      </div>
      <button onclick="drawerChangePlan()" class="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition whitespace-nowrap">Сменить тариф</button>
    </div>

    <!-- Feature Flags -->
    <div>
      <div class="text-xs font-bold text-slate-900 mb-4 flex items-center justify-between">
        <span>Feature Flags</span>
        <span class="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">4 активно</span>
      </div>
      
      <div class="flex flex-col gap-4 text-xs">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium text-slate-800">Расчет зарплат</div>
            <div class="text-[11px] text-slate-400">(3 договора)</div>
          </div>
          <button onclick="toggleSwitch(this)" class="w-11 h-6 bg-brand rounded-full p-0.5 cursor-pointer flex items-center justify-end transition">
            <span class="w-5 h-5 bg-white rounded-full shadow-xs"></span>
          </button>
        </div>

        <div class="flex items-center justify-between">
          <div class="font-medium text-slate-800">Учет инвентаря</div>
          <button onclick="toggleSwitch(this)" class="w-11 h-6 bg-brand rounded-full p-0.5 cursor-pointer flex items-center justify-end transition">
            <span class="w-5 h-5 bg-white rounded-full shadow-xs"></span>
          </button>
        </div>

        <div class="flex items-center justify-between">
          <div class="font-medium text-slate-800">CRM-воронка</div>
          <button onclick="toggleSwitch(this)" class="w-11 h-6 bg-brand rounded-full p-0.5 cursor-pointer flex items-center justify-end transition">
            <span class="w-5 h-5 bg-white rounded-full shadow-xs"></span>
          </button>
        </div>

        <div class="flex items-center justify-between">
          <div class="font-medium text-slate-800">Гео-чек-ин</div>
          <button onclick="toggleSwitch(this)" class="w-11 h-6 bg-brand rounded-full p-0.5 cursor-pointer flex items-center justify-end transition">
            <span class="w-5 h-5 bg-white rounded-full shadow-xs"></span>
          </button>
        </div>
      </div>
    </div>

    <!-- Limit Sliders -->
    <div class="flex flex-col gap-5 pt-2 border-t border-slate-100">
      <div>
        <div class="flex justify-between text-xs font-medium text-slate-800 mb-2">
          <span>Лимит сотрудников:</span>
          <span id="staffLimitVal" class="font-bold text-slate-900">20 чел.</span>
        </div>
        <input type="range" min="5" max="100" value="20" oninput="document.getElementById('staffLimitVal').innerText = this.value + ' чел.'" class="w-full accent-brand cursor-pointer">
      </div>

      <div>
        <div class="flex justify-between text-xs font-medium text-slate-800 mb-2">
          <span>Хранилище:</span>
          <span id="storageLimitVal" class="font-bold text-slate-900">10 ГБ</span>
        </div>
        <input type="range" min="1" max="100" value="10" oninput="document.getElementById('storageLimitVal').innerText = this.value + ' ГБ'" class="w-full accent-brand cursor-pointer">
      </div>
    </div>
  </div>

  <div class="flex items-center justify-between pt-4 border-t border-slate-100">
    <button onclick="closeDrawer()" class="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50">Отмена</button>
    <button onclick="saveDrawerSettings()" class="px-5 py-2 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold shadow-xs">Сохранить</button>
  </div>
</aside>
`;

function mountDrawer() { $('drawerRoot').innerHTML = DRAWER_TEMPLATE; }

let drawerCenterId = null;                       // id центра, для которого открыт drawer (если открыт по id)
let selectedCenterName = '';                     // имя центра, для которого открыт drawer

function openDrawerById(id) { const c = centerCache.get(id); if (c) openDrawer(c.name, id); }

function enterImpersonationFromDrawer() {
  if (drawerCenterId) enterImpersonationById(drawerCenterId);
}

function drawerOpenPeople() {
  if (!drawerCenterId) return;
  const id = drawerCenterId;
  closeDrawer();
  openCenterPeople(id);
}

function drawerAdminAccess() {
  if (!drawerCenterId) return;
  const id = drawerCenterId, name = selectedCenterName;
  closeDrawer();
  openForm({
    title: 'Данные для входа администратора', sub: name, danger: true,
    note: 'Будет создан новый временный пароль, прежний (если он был) перестанет работать. Логин — номер телефона владельца. Действие записывается в журнал аудита.',
    fields: [{ key: 'reason', label: 'Основание', type: 'textarea', rows: 2, placeholder: 'Например, владелец потерял пароль', required: true }],
    submitLabel: 'Создать пароль',
    onSubmit: async v => { const r = await api.centers.adminAccess(id, { reason: v.reason }); return () => openCredentials('Данные для входа', r.name + ' · ' + name, r); }
  });
}

function drawerChangePlan() {
  if (!drawerCenterId) return;
  const id = drawerCenterId;
  closeDrawer();
  openPlanChange(id);
}

// Drawer Management
function openDrawer(centerName = 'Центр «Перспектива»', centerId = null) {
  selectedCenterName = centerName;
  drawerCenterId = centerId;
  const c = centerId ? centerCache.get(centerId) : null;
  $('drawerPlanBlock').classList.toggle('hidden', !c);
  $('drawerPeopleBtn').classList.toggle('hidden', !c);
  $('drawerAccessBtn').classList.toggle('hidden', !c);          // блок тарифа — только когда известен центр
  if (c) {
    $('drawerPlanName').textContent = c.plan + (c.monthlyPrice ? ' · ' + money(c.monthlyPrice) + '/мес' : ' · бесплатно');
    $('drawerPlanSub').textContent = c.pendingChange ? 'Ожидает оплаты: тариф «' + c.pendingChange.planName + '» (' + c.pendingChange.invoiceId + ')' : 'Сотрудники ' + c.staff[0] + ' из ' + c.staff[1];
  }
  const title = $('drawerCenterTitle');
  title.textContent = '';
  title.append('Настройка модулей:', document.createElement('br'), centerName);   // имя центра — пользовательский ввод, не innerHTML
  document.getElementById('drawerBackdrop').classList.remove('hidden');
  document.getElementById('moduleDrawer').classList.remove('translate-x-full');
}

function closeDrawer() {
  document.getElementById('drawerBackdrop').classList.add('hidden');
  document.getElementById('moduleDrawer').classList.add('translate-x-full');
}

function saveDrawerSettings() {
  closeDrawer();
  showToast('Модули и лимиты для ' + selectedCenterName + ' сохранены', 'success');
}
