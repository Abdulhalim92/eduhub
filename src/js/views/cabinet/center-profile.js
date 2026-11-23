/* Экран кабинета центра (eduhub.html): Профиль центра (CTR-PRF-010).
   Только отображение: все флаги («у лимита», статус баланса, «риск оттока») приходят из api.cabinet.profile, правила здесь не пересчитываются. */
registerView({
  tab: 'profile', path: 'profile',
  title: 'Профиль центра', nav: { label: 'Профиль центра', icon: 'profile' },
  template: `
<main id="view-profile" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-6 animate-fadeIn"></main>
`,
  render: renderProfile
});

// подписи статуса баланса: код приходит из api (financeStatus), здесь только тон и текст
const PF_FINANCE = { ok: ['emerald', 'В порядке'], overdraft: ['amber', 'В овердрафте'], critical: ['rose', 'Овердрафт почти исчерпан'] };
const PF_SOURCE = { invoice: ['indigo', 'Куплен'], bonus: ['emerald', 'Бонус'] };

const pfSkeleton = '<div class="h-64 bg-white border border-slate-200 rounded-2xl animate-pulse"></div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">' + '<div class="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>'.repeat(4) + '</div><div class="h-72 bg-white border border-slate-200 rounded-2xl animate-pulse"></div>';

async function renderProfile() {
  const root = $('view-profile'), my = begin('profile');
  root.innerHTML = pfSkeleton;
  try {
    const d = await api.cabinet.profile(selectedCenterId);
    if (stale('profile', my)) return;
    cacheCenters([d.center]);
    root.innerHTML = pfHero(d) + pfKpis(d) + '<div class="grid grid-cols-1 lg:grid-cols-12 gap-5">' + pfPlan(d) + pfBalance(d) + '</div>' + pfCourses(d);
  } catch (e) {
    if (stale('profile', my)) return;
    root.innerHTML = '<div class="bg-white border border-slate-200 rounded-2xl">' + errorBox(e) + '</div>';
  }
}

function pfHero(d) {
  const c = d.center, p = d.profile;
  const phone = c.phone ? `<span class="inline-flex items-center gap-1.5">${esc(c.phone)}</span>` : '';
  const meta = [`<span class="px-2.5 py-1 rounded-full bg-brand-light text-brand text-[11px] font-semibold">${esc(p.direction)}</span>`, `<span>${esc(c.city)}</span>`, `<span>с ${p.foundedYear} года</span>`, `<span>Владелец: ${esc(c.owner)}</span>`, phone].filter(Boolean).join('<span class="text-slate-300">·</span>');
  const blocked = c.status === 'blocked' ? '<div class="mx-6 mb-5 px-4 py-3 rounded-xl bg-rose-100 border border-rose-200 text-xs text-rose-700 font-medium">Центр заблокирован платформой: изменения недоступны, профиль открыт только для просмотра.</div>' : '';
  const pc = c.pendingChange ? `<div class="mx-6 mb-5 px-4 py-3 rounded-xl bg-amber-100 border border-amber-200 text-xs text-amber-800 font-medium">Выставлен счёт ${esc(c.pendingChange.invoiceId)} на смену тарифа на «${esc(c.pendingChange.planName)}» (${money(c.pendingChange.amount)})${c.pendingChange.overdue ? ': срок оплаты истёк' : ''}.</div>` : '';
  return `<section class="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
    <div class="h-40 bg-slate-200 bg-cover bg-center" style="background-image:url('${esc(p.banner)}')"></div>
    <div class="px-6 pb-5 flex flex-wrap gap-5">
      <img src="${esc(p.logo)}" alt="Логотип ${esc(c.name)}" class="w-24 h-24 rounded-2xl ring-4 ring-white bg-white shadow-sm -mt-12 flex-shrink-0">
      <div class="flex-1 min-w-0 pt-3">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-2xl font-extrabold text-slate-900 tracking-tight">${esc(c.name)}</h2>
          ${centerStatus(c)}
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">${meta}</div>
        ${p.description ? `<p class="mt-3 text-sm text-slate-600 max-w-3xl leading-relaxed">${esc(p.description)}</p>` : '<p class="mt-3 text-sm text-slate-400">Описание центра пока не заполнено.</p>'}
      </div>
    </div>
    ${blocked}${pc}
  </section>`;
}

function pfKpis(d) {
  const c = d.center, p = d.profile, neg = c.balance < 0 ? 'text-rose-600' : 'text-slate-900';
  return `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    ${tile('Ученики', p.students.toLocaleString('ru-RU'), 'в центре')}
    ${tile('Сотрудники', c.staff[0] + ' из ' + c.staff[1], 'лимит тарифа «' + esc(c.plan) + '»')}
    ${tile('Филиалы', c.branchesUsed + ' из ' + c.limits.branches, 'лимит тарифа «' + esc(c.plan) + '»')}
    ${tile('Баланс на платформе', money(c.balance), 'доступно к расходу ' + money(c.available), neg)}
  </div>`;
}

function pfUsageRow(u) {
  const bar = u.full ? 'bg-rose-500' : u.near ? 'bg-amber-500' : 'bg-brand';
  const tag = u.full ? badge('rose', 'Лимит исчерпан') : u.near ? badge('amber', 'У лимита') : '';
  return `<div>
    <div class="flex items-center justify-between text-xs mb-1.5"><span class="font-semibold text-slate-800">${esc(u.label)}</span><span class="flex items-center gap-2 text-slate-500">${u.used} из ${u.limit} · ${u.pct}% ${tag}</span></div>
    <div class="h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full ${bar}" style="width:${Math.min(100, u.pct)}%"></div></div>
  </div>`;
}

function pfStaff(d) {
  const roles = d.profile.staffRoles, total = roles.reduce((a, r) => a + r.count, 0), tones = ['bg-brand', 'bg-indigo-400', 'bg-slate-300'];
  if (!total) return '<div class="text-xs text-slate-500">Сотрудников пока нет.</div>';
  const bar = roles.map((r, i) => r.count ? `<div class="h-full ${tones[i]}" style="width:${r.count / total * 100}%"></div>` : '').join('');
  const legend = roles.map((r, i) => `<div class="flex items-center gap-2 text-xs text-slate-600"><span class="w-2.5 h-2.5 rounded-full ${tones[i]}"></span>${esc(r.label)}<span class="font-semibold text-slate-900">${r.count}</span></div>`).join('');
  return `<div class="h-2.5 rounded-full bg-slate-100 overflow-hidden flex">${bar}</div><div class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">${legend}</div>`;
}

function pfPlan(d) {
  const c = d.center;
  const price = c.monthlyPrice > 0 ? money(c.monthlyPrice) + ' в месяц' : 'бесплатно';
  const until = c.expiresIn === null ? 'Подписка не ограничена по сроку' : 'Подписка: ' + expiryLabel(c.expiresIn);
  const untilCls = c.expiresIn !== null && c.isExpiring ? (c.expiresIn <= 3 ? 'text-rose-600' : 'text-amber-600') : 'text-slate-500';
  return `<section class="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div><h3 class="text-sm font-bold text-slate-900">Тариф и лимиты</h3><div class="mt-1 text-xs text-slate-500">Тариф «${esc(c.plan)}» · ${price}</div><div class="mt-0.5 text-xs font-medium ${untilCls}">${until}</div></div>
      ${c.nearLimit ? badge('amber', 'Центр у лимита') : ''}
    </div>
    <div class="flex flex-col gap-4">${d.usage.map(pfUsageRow).join('')}</div>
    <div class="pt-4 border-t border-slate-100"><h4 class="text-xs font-bold text-slate-900 mb-3">Сотрудники по ролям</h4>${pfStaff(d)}</div>
  </section>`;
}

function pfLedgerRow(e) {
  const plus = e.amount > 0;
  return `<div class="py-2.5 flex items-start justify-between gap-3">
    <div class="min-w-0"><div class="text-xs font-semibold text-slate-800 truncate">${esc(plus ? 'Пополнение' : e.reference || 'Списание')}</div><div class="text-[11px] text-slate-400 truncate">${esc(fmtDay(e.at))} · ${esc(e.method || '')}</div></div>
    <div class="text-xs font-bold whitespace-nowrap ${plus ? 'text-emerald-700' : 'text-slate-800'}">${plus ? '+' : ''}${money(e.amount)}</div>
  </div>`;
}

function pfBalance(d) {
  const c = d.center, st = PF_FINANCE[c.financeStatus] || PF_FINANCE.ok;
  const mini = (label, v, cls = 'text-slate-900') => `<div class="bg-slate-50 rounded-xl px-3 py-2.5"><div class="text-[11px] text-slate-500">${label}</div><div class="text-sm font-extrabold ${cls} mt-0.5">${v}</div></div>`;
  return `<section class="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3"><h3 class="text-sm font-bold text-slate-900">Баланс на платформе</h3>${badge(st[0], st[1])}</div>
    <div class="grid grid-cols-3 gap-2">${mini('Баланс', money(c.balance), c.balance < 0 ? 'text-rose-600' : 'text-slate-900')}${mini('Овердрафт', money(c.overdraftLimit))}${mini('Доступно', money(c.available))}</div>
    <div><h4 class="text-xs font-bold text-slate-900 mb-1">Последние операции</h4>
      <div class="divide-y divide-slate-100">${d.ledger.length ? d.ledger.map(pfLedgerRow).join('') : '<div class="py-4 text-xs text-slate-500">Операций пока нет.</div>'}</div>
    </div>
    <div class="text-[11px] text-slate-400">Взаиморасчёты с платформой. Касса и платежи учеников здесь не показываются.</div>
  </section>`;
}

function pfCourseCard(title, direction, cover, lessons, tests, tag) {
  return `<div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
    <div class="h-28 bg-slate-200 bg-cover bg-center" style="background-image:url('${esc(cover)}')"></div>
    <div class="p-3.5"><div class="flex items-center justify-between gap-2 mb-1.5"><span class="text-[11px] text-slate-500 truncate">${esc(direction)}</span>${tag}</div>
      <div class="text-xs font-bold text-slate-900 leading-snug">${esc(title)}</div>
      <div class="mt-1.5 text-[11px] text-slate-500">${lessons} ${plural(lessons, ['урок', 'урока', 'уроков'])} · ${tests} ${plural(tests, ['тест', 'теста', 'тестов'])}</div></div>
  </div>`;
}

function pfCourses(d) {
  const bought = d.courses.items.map(a => { const c = a.course, t = PF_SOURCE[a.source] || PF_SOURCE.invoice; return pfCourseCard(c.title, c.direction, c.cover, a.version.lessons, a.version.tests, badge(t[0], t[1])); });
  const own = d.courses.own.map(c => pfCourseCard(c.title, c.direction, c.cover, c.lessons, c.tests, badge('slate', 'Собственный')));
  const all = bought.concat(own);
  return `<section class="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
    <div class="flex items-center justify-between mb-4"><h3 class="text-sm font-bold text-slate-900">Курсы центра</h3><span class="text-xs text-slate-500">${all.length} ${plural(all.length, ['курс', 'курса', 'курсов'])}</span></div>
    ${all.length ? '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">' + all.join('') + '</div>' : '<div class="py-8 text-center text-xs text-slate-500">У центра пока нет курсов. Методики покупаются в магазине платформы.</div>'}
  </section>`;
}
