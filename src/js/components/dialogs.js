/* Универсальный диалог-форма в модальном окне: поля, подсказки, ошибки сервера под полями, защита от двойной отправки.
   openForm({ title, sub, fields, submitLabel, danger, note, onSubmit(values) }) — onSubmit вызывает api и бросает ApiError;
   ошибки полей (ApiError.fields) показываются под полями, остальные — в баннере; при успехе окно закрывается (если onSubmit вернул функцию, её вызывают после закрытия).
   Поле: { key, label, type: 'text'|'textarea'|'number'|'select', options: [{value,label}], value, placeholder, hint, required, rows, rerender, showIf(values) } */
const formState = { cfg: null, values: {}, errors: {}, error: '', busy: false };

function openForm(cfg) {
  const values = {};
  cfg.fields.forEach(f => { values[f.key] = f.value !== undefined ? f.value : ''; });
  Object.assign(formState, { cfg, values, errors: {}, error: '', busy: false });
  openModal('');   // показать оверлей; содержимое рисует renderForm
  renderForm();
}
function formSet(key, v, rerender = false) {
  formState.values[key] = v;
  if (formState.errors[key]) { delete formState.errors[key]; const e = $('err-form-' + key); if (e) e.remove(); }
  if (rerender) renderForm();
}
function renderForm() {
  const { cfg, values, errors, error, busy } = formState;
  const cls = k => `px-3 py-2.5 bg-white border ${errors[k] ? 'border-rose-400' : 'border-slate-200'} rounded-xl text-xs focus:outline-none focus:border-brand`;
  const field = f => {
    if (f.showIf && !f.showIf(values)) return '';
    const v = values[f.key], id = 'form-' + f.key;
    const input = f.type === 'textarea' ? `<textarea id="${id}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}" oninput="formSet('${f.key}', this.value)" class="${cls(f.key)}">${esc(v)}</textarea>`
      : f.type === 'select' ? `<select id="${id}" onchange="formSet('${f.key}', this.value, ${!!f.rerender})" class="${cls(f.key)}">${f.options.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`
      : `<input id="${id}" type="${f.type === 'number' ? 'number' : 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" oninput="formSet('${f.key}', this.value)" class="${cls(f.key)}">`;
    return `<label class="flex flex-col gap-1.5"><span class="text-[11px] font-semibold text-slate-600">${esc(f.label)}${f.required ? ' <span class="text-rose-500">*</span>' : ''}</span>${input}
      ${f.hint ? `<span class="text-[11px] text-slate-400">${esc(f.hint)}</span>` : ''}${errors[f.key] ? `<span id="err-form-${f.key}" class="text-[11px] text-rose-600">${esc(errors[f.key])}</span>` : ''}</label>`;
  };
  setModal(`
    ${modalHeader(esc(cfg.title), cfg.sub ? esc(cfg.sub) : '')}
    <div class="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
      ${cfg.note ? `<div class="p-3 ${cfg.danger ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-600'} border rounded-xl text-[11px] leading-relaxed">${cfg.note}</div>` : ''}
      ${error ? `<div class="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700">${esc(error)}</div>` : ''}
      ${cfg.fields.map(field).join('')}
      <div class="flex justify-end gap-2">
        <button onclick="closeModal()" class="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition">Отмена</button>
        <button onclick="formSubmit()" ${busy ? 'disabled' : ''} class="px-5 py-2.5 ${cfg.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand hover:bg-brand-dark'} text-white rounded-xl text-xs font-semibold transition disabled:opacity-60">${esc(cfg.submitLabel || 'Сохранить')}</button>
      </div>
    </div>`);
  const first = document.querySelector('#modalBox input, #modalBox textarea'); if (first && !busy && !error && !Object.keys(errors).length) first.focus();
}
async function formSubmit() {
  if (formState.busy) return;
  formState.busy = true; formState.error = '';
  try { const next = await formState.cfg.onSubmit({ ...formState.values }); closeModal(); if (typeof next === 'function') next(); }   // onSubmit может вернуть функцию — её вызовут после закрытия формы (например, показ пароля)
  catch (e) {
    formState.busy = false;
    if (e instanceof ApiError && e.fields && Object.keys(e.fields).length) formState.errors = e.fields; else formState.error = errText(e);
    renderForm();
  }
}
