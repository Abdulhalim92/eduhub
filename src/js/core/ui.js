/* Хелперы представления (форматирование, бейджи, плитки, скелетоны, тосты). Бизнес-правил здесь нет. */

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, f) => { const m = Math.abs(n) % 100, d = m % 10; return (m > 10 && m < 20) ? f[2] : d === 1 ? f[0] : (d >= 2 && d <= 4) ? f[1] : f[2]; };
const money = n => n.toLocaleString('ru-RU') + ' сомони';
const loginLabel = c => c.neverLogged ? 'Ещё не входили' : c.loginDays === 0 ? 'Сегодня' : c.loginDays === 1 ? 'Вчера' : c.loginDays + ' ' + plural(c.loginDays, ['день', 'дня', 'дней']) + ' назад';
const fmtDate = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); };
const expiryLabel = d => d < 0 ? 'просрочено ' + (-d) + ' ' + plural(-d, ['день', 'дня', 'дней']) : d === 0 ? 'сегодня' : 'через ' + d + ' ' + plural(d, ['день', 'дня', 'дней']);
const fmtDateTime = iso => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDay = iso => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
// подписи кодов действий журнала аудита (коды приходят с сервера)
const AUDIT_LABELS = {
  'invoice.created': 'Выставлен счёт', 'invoice.paid': 'Оплата подтверждена', 'invoice.cancelled': 'Счёт отменён',
  'plan.changed': 'Смена тарифа центра', 'subscription.extended': 'Подписка продлена',
  'plan.created': 'Создан тариф', 'plan.updated': 'Изменён тариф', 'plan.archived': 'Тариф перенесён в архив', 'plan.restored': 'Тариф возвращён из архива',
  'support.entered': 'Вход в режим поддержки', 'staff.added': 'Добавлен сотрудник центра', 'staff.removed': 'Сотрудник уволен', 'center.credentials': 'Выданы данные для входа', 'access.reset': 'Выдан или сброшен доступ', 'auth.password_changed': 'Пароль изменён', 'student.added': 'Добавлен ученик', 'student.blocked': 'Ученик заблокирован', 'student.unblocked': 'Доступ ученика возвращён', 'coin.granted': 'Начислены coin',
  'branch.submitted': 'Филиал отправлен на модерацию', 'branch.resubmitted': 'Филиал отправлен повторно',
  'moderation.published': 'Филиал опубликован в каталоге', 'moderation.returned': 'Филиал возвращён на доработку', 'moderation.rejected': 'Заявка филиала отклонена',
  'balance.topup': 'Пополнение баланса на платформе', 'balance.charge': 'Списание с баланса на платформе', 'overdraft.changed': 'Изменён лимит овердрафта',
  'sms.accrued': 'Начислен пакет SMS', 'sms.package.updated': 'Изменён пакет SMS',
  'course.created': 'Создан курс (черновик)', 'course.published': 'Курс опубликован', 'course.unpublished': 'Курс снят с публикации', 'course.price': 'Изменена цена курса', 'course.granted': 'Курс передан центру', 'course.requested': 'Заявка центра на курс', 'course.request.rejected': 'Заявка на курс отклонена', 'course.content': 'Изменена программа курса', 'course.updated': 'Изменены данные курса', 'course.revoked': 'Доступ к курсу отозван'
};
const ICON_GEAR = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';

const TONES = {
  emerald: ['bg-emerald-100 text-emerald-800 border-emerald-200', 'bg-emerald-500'],
  amber:   ['bg-amber-100 text-amber-800 border-amber-200', 'bg-amber-500'],
  rose:    ['bg-rose-100 text-rose-700 border-rose-200', 'bg-rose-500'],
  slate:   ['bg-slate-100 text-slate-600 border-slate-200', 'bg-slate-400'],
  indigo:  ['bg-indigo-100 text-brand border-indigo-200', 'bg-brand']
};
const badge = (tone, text) => `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap ${TONES[tone][0]}"><span class="w-1.5 h-1.5 rounded-full ${TONES[tone][1]}"></span> ${text}</span>`;
const chip = (active, label, onclick) => `<button onclick="${onclick}" class="px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${active ? 'bg-brand text-white border-brand' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">${label}</button>`;
const tile = (label, value, sub, tone = 'text-slate-900') => `<div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs"><div class="text-xs text-slate-500 font-medium">${label}</div><div class="text-3xl font-extrabold ${tone} mt-2">${value}</div><div class="mt-2 text-xs text-slate-500">${sub}</div></div>`;
const centerStatus = c => c.status === 'blocked' ? badge('rose', 'Заблокирован') : c.isChurn ? badge('amber', 'Риск оттока') : badge('emerald', 'Активен');
const centerStatusExtra = c => c.isExpiring ? `<div class="mt-1 text-[11px] ${c.expiresIn <= 3 ? 'text-rose-600' : 'text-amber-600'}">Подписка: ${expiryLabel(c.expiresIn)}</div>` : '';
const RISK_UI = {
  high:   { label: 'Высокий', bar: 'bg-rose-500',   text: 'text-rose-600' },
  medium: { label: 'Средний', bar: 'bg-amber-500',  text: 'text-amber-600' },
  low:    { label: 'Низкий',  bar: 'bg-yellow-400', text: 'text-yellow-600' }
};

/* ---- состояния загрузки и ошибок ---- */
const errText = e => (e instanceof ApiError ? e.message : 'Не удалось загрузить данные. Проверьте соединение и повторите.');
const skeletonRows = (cols, n = 4) => Array.from({ length: n }, () => `<tr>${'<td class="py-4"><div class="h-3 bg-slate-100 rounded animate-pulse"></div></td>'.repeat(cols)}</tr>`).join('');
const retryBtn = '<button onclick="renderRoute()" class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition">Повторить</button>';
const errorRow = (cols, e) => `<tr><td colspan="${cols}" class="py-10 text-center"><div class="text-xs text-rose-600 mb-2">${esc(errText(e))}</div>${retryBtn}</td></tr>`;
const errorBox = e => `<div class="py-10 text-center"><div class="text-xs text-rose-600 mb-2">${esc(errText(e))}</div>${retryBtn}</div>`;

// Сброс демо-данных: общее состояние mock (localStorage) очищается во всех открытых вкладках; доступно только при включённой синхронизации
function resetDemo() {
  if (!api.sync.enabled()) return;
  if (!confirm('Сбросить демо-данные? Все изменения (балансы, счета, тарифы, курсы) вернутся к начальным во всех открытых вкладках.')) return;
  api.sync.reset();
  location.reload();
}

// Interactive Switch Toggles
function toggleSwitch(btn) {
  const isChecked = btn.classList.contains('bg-brand');
  if (isChecked) {
    btn.classList.remove('bg-brand', 'justify-end');
    btn.classList.add('bg-slate-300', 'justify-start');
  } else {
    btn.classList.remove('bg-slate-300', 'justify-start');
    btn.classList.add('bg-brand', 'justify-end');
  }
}

/* Тосты. Текст вставляется как textContent: в сообщения попадают названия центров (пользовательский ввод). */
function showToast(message, type = 'info') {
  const container = $('toastContainer');
  const toast = document.createElement('div');

  let bg = 'bg-slate-900 text-white';
  if (type === 'success') bg = 'bg-emerald-600 text-white';
  if (type === 'error') bg = 'bg-rose-600 text-white';
  if (type === 'info') bg = 'bg-brand text-white';

  toast.className = `${bg} px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 pointer-events-auto transition transform translate-y-2 opacity-0 animate-fadeIn`;
  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}
