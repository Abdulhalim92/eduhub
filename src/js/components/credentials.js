/* Общее для обеих страниц: окно с данными для входа (пароль показывается один раз, BR-025). */
// копирование значения из элемента на странице (логин, пароль)
async function cabCopy(id) {
  try { await navigator.clipboard.writeText($(id).textContent); showToast('Скопировано', 'success'); } catch (e) { showToast('Не удалось скопировать: выделите текст вручную', 'error'); }
}

// данные для входа, выданные человеку: пароль показывается один раз (BR-025)
function openCredentials(title, name, creds) {
  openModal(`${modalHeader(esc(title), esc(name))}<div class="p-6 flex flex-col gap-4">
    <dl class="grid grid-cols-[5rem_1fr_auto] items-center gap-x-3 gap-y-3 text-xs bg-slate-50 border border-slate-200 rounded-xl p-4">
      <dt class="text-slate-500">Логин</dt><dd id="crLogin" class="font-mono font-semibold text-slate-900 break-all">${esc(creds.login)}</dd><dd><button onclick="cabCopy('crLogin')" class="text-[11px] font-semibold text-brand hover:underline">Копировать</button></dd>
      <dt class="text-slate-500">Пароль</dt><dd id="crPassword" class="font-mono font-semibold text-slate-900">${esc(creds.password)}</dd><dd><button onclick="cabCopy('crPassword')" class="text-[11px] font-semibold text-brand hover:underline">Копировать</button></dd>
    </dl>
    <p class="text-[11px] text-amber-700">Пароль показан один раз и нигде не хранится в открытом виде: передайте его сейчас. При первом входе пароль нужно сменить.</p>
    <div class="flex justify-end"><button onclick="closeModal()" class="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-semibold transition">Готово, я передал данные</button></div></div>`);
}

const LOGIN_HINT = 'Придумайте логин: 4–32 символа, латиница, цифры, точка, дефис, подчёркивание. Пароль будет создан автоматически.';
