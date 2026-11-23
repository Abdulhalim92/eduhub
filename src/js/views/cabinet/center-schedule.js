/* Экран кабинета центра: Расписание занятий (CTR-SCH-010). Недельная сетка занятий активных групп; время и дни задаются в группе.
   Пересечения занятий одного преподавателя api не допускает при сохранении группы (BR-024), экран их не пересчитывает. */
registerView({
  tab: 'center-schedule', path: 'center-schedule',
  title: 'Расписание', nav: { label: 'Расписание', icon: 'calendar' },
  template: `
<main id="view-center-schedule" class="view-panel hidden flex-1 p-8 overflow-y-auto flex flex-col gap-5 animate-fadeIn">
  <div id="schHead"></div>
  <div class="flex flex-wrap items-center gap-3"><div id="schFilters" class="flex flex-wrap items-center gap-3"></div>${cabResetLink('schReset', 'resetSchFilters()')}</div>
  <div id="schBody"></div>
</main>
`,
  render: renderSchedule
});

const schState = { center: 0, branch: '', teacherId: '' };

async function renderSchedule() {
  if (schState.center !== selectedCenterId) Object.assign(schState, { center: selectedCenterId, branch: '', teacherId: '' });
  const my = begin('center-schedule'), body = $('schBody');
  body.innerHTML = '<div class="h-64 bg-white border border-slate-200/80 rounded-2xl animate-pulse"></div>';
  try {
    const r = await api.cabinet.schedule(selectedCenterId, schState);
    if (stale('center-schedule', my)) return;
    $('schHead').innerHTML = cabHead('Расписание', 'Занятия активных групп по дням недели. Дни и время меняются в карточке группы.', `<span class="text-xs text-slate-500">Занятий в неделю: <strong class="text-slate-800">${r.totals.lessons}</strong> · групп: <strong class="text-slate-800">${r.totals.groups}</strong></span>`);
    const all = { value: '', label: 'Все' };
    $('schFilters').innerHTML = cabSelect('Филиал', [all, ...r.options.branches.map(v => ({ value: v, label: v }))], schState.branch, "setSchFilter('branch', this.value)")
      + cabSelect('Преподаватель', [all, ...r.options.teachers.map(t => ({ value: t.id, label: t.name }))], schState.teacherId, "setSchFilter('teacherId', this.value)");
    $('schReset').classList.toggle('hidden', !schState.branch && !schState.teacherId);
    const today = (new Date().getDay() + 6) % 7;   // Пн = 0
    body.innerHTML = r.totals.lessons ? `<div class="overflow-x-auto"><div class="grid grid-cols-7 gap-3 min-w-[70rem]">${r.days.map(d => `<section class="bg-white border ${d.index === today ? 'border-brand' : 'border-slate-200/80'} rounded-2xl shadow-xs overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between ${d.index === today ? 'bg-brand-light' : ''}"><span class="text-xs font-bold text-slate-900">${esc(d.day)}</span><span class="text-[11px] text-slate-500">${d.lessons.length ? d.lessons.length + ' ' + plural(d.lessons.length, ['занятие', 'занятия', 'занятий']) : ''}</span></div>
      <div class="p-2 flex flex-col gap-2">${d.lessons.length ? d.lessons.map(l => `<a href="#/center-group${cabinetQuery()}&group=${l.groupId}" class="block border border-slate-200 hover:border-brand rounded-xl px-3 py-2.5 transition">
        <div class="text-[11px] font-bold text-brand tabular-nums">${esc(l.start)}–${esc(l.end)}</div>
        <div class="text-xs font-semibold text-slate-900 mt-0.5 leading-snug">${esc(l.group)}</div>
        <div class="text-[11px] text-slate-500 mt-1">${esc(l.teacher)}</div><div class="text-[11px] text-slate-400">${esc(l.branch)} · ${l.members}/${l.capacity}</div></a>`).join('') : '<div class="py-6 text-center text-[11px] text-slate-400">Нет занятий</div>'}</div></section>`).join('')}</div></div>`
      : `<div class="bg-white border border-slate-200/80 rounded-2xl py-14 text-center text-xs text-slate-500">${schState.branch || schState.teacherId ? 'По этим условиям занятий нет.' : 'У центра пока нет активных групп с расписанием.'}</div>`;
  } catch (e) { if (!stale('center-schedule', my)) body.innerHTML = `<div class="bg-white border border-slate-200/80 rounded-2xl">${errorBox(e)}</div>`; }
}

function setSchFilter(k, v) { schState[k] = v; renderSchedule(); }
function resetSchFilters() { Object.assign(schState, { branch: '', teacherId: '' }); renderSchedule(); }
