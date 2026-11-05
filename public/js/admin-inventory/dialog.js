/* Painel de estoque (admin): situação do medidor, aviso na tela e diálogo único.
   Depende de $, api, esc e say (admin/core.js). Os arquivos de js/admin-inventory/ são scripts clássicos
   carregados em ordem e compartilham o escopo global; events.js vem por último. */
'use strict';
/* ---------- Situação do medidor (mesma regra do servidor em services/inventory.js) ---------- */
function statusOf(item) {
  const q = Number(item.quantity) || 0;
  const cap = Math.max(Number(item.capacity_quantity) || 0, q);
  const min = Number(item.minimum_quantity) || 0;
  const percent = cap > 0 ? Math.max(0, Math.min(100, (q / cap) * 100)) : 0;
  if (q <= 0)
    return { key: 'empty', label: 'Esgotado', percent: 0 };
  if ((min > 0 && q <= min) || percent <= 20)
    return { key: 'low', label: 'Está acabando', percent };
  return { key: 'good', label: 'Estoque bom', percent };
}
/* ---------- Aviso na tela (visível mesmo com a página rolada) ---------- */
let toastTimer = null;
function notify(message, type = 'ok') {
  let el = document.getElementById('stock-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'stock-toast';
    el.className = 'stock-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.toggle('error', type === 'error');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, type === 'error' ? 8000 : 4500);
}
/* ---------- Diálogo único para todas as ações ---------- */
function buildField(spec) {
  const label = document.createElement('label');
  label.className = 'stock-field';
  label.append(document.createTextNode(spec.label));
  let control;
  if (spec.type === 'select') {
    control = document.createElement('select');
    for (const o of spec.options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      control.append(opt);
    }
  }
  else {
    control = document.createElement('input');
    control.type = spec.type === 'number' ? 'number' : 'text';
    if (spec.type === 'number') {
      control.step = 'any';
      control.inputMode = 'decimal';
      if (spec.min !== undefined)
        control.min = spec.min;
    }
    if (spec.placeholder)
      control.placeholder = spec.placeholder;
    if (spec.maxLength)
      control.maxLength = spec.maxLength;
  }
  control.name = spec.name;
  control.required = !!spec.required;
  if (spec.value !== undefined && spec.value !== null)
    control.value = String(spec.value);
  if (spec.suffix) {
    const row = document.createElement('div');
    row.className = 'stock-field-row';
    const tag = document.createElement('strong');
    tag.className = 'stock-unit-tag';
    tag.textContent = spec.suffix;
    row.append(control, tag);
    label.append(row);
  }
  else {
    label.append(control);
  }
  if (spec.hint) {
    const small = document.createElement('small');
    small.textContent = spec.hint;
    label.append(small);
  }
  return label;
}
/* Abre o diálogo. `onSubmit(values)` pode lançar Error: a mensagem aparece no próprio diálogo
   e o que a pessoa digitou é mantido. Resolve true se concluiu, false se cancelou. */
function openDialog({ eyebrow, title, description, fields = [], submitLabel = 'Salvar', danger = false, onSubmit }) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'stock-dialog';
    const form = document.createElement('form');
    form.className = 'stock-dialog-form';
    const head = document.createElement('div');
    const eb = document.createElement('span');
    eb.className = 'eyebrow';
    eb.textContent = eyebrow;
    const h = document.createElement('h3');
    h.textContent = title;
    head.append(eb, h);
    form.append(head);
    if (description) {
      const p = document.createElement('p');
      p.className = 'stock-dialog-desc';
      p.textContent = description;
      form.append(p);
    }
    for (const f of fields)
      form.append(buildField(f));
    const error = document.createElement('p');
    error.className = 'stock-dialog-error';
    error.setAttribute('role', 'alert');
    form.append(error);
    const actions = document.createElement('div');
    actions.className = 'stock-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button button-outline';
    cancel.textContent = 'Cancelar';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = `button ${danger ? 'button-danger' : 'button-primary'}`;
    submit.textContent = submitLabel;
    actions.append(cancel, submit);
    form.append(actions);
    dialog.append(form);
    document.body.append(dialog);
    let done = false;
    const finish = value => {
      if (done)
        return;
      done = true;
      if (dialog.open)
        dialog.close();
      dialog.remove();
      resolve(value);
    };
    cancel.addEventListener('click', () => finish(false));
    dialog.addEventListener('cancel', e => { e.preventDefault(); finish(false); });
    dialog.addEventListener('click', e => {
      if (e.target === dialog)
        finish(false);
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.textContent = '';
      const values = {};
      for (const f of fields)
        values[f.name] = form.elements[f.name].value;
      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = 'Salvando…';
      try {
        await onSubmit(values);
        finish(true);
      }
      catch (err) {
        error.textContent = err.message || 'Não foi possível concluir. Tente novamente.';
        submit.disabled = false;
        submit.textContent = original;
      }
    });
    dialog.showModal();
    const first = form.querySelector('input,select');
    if (first && !danger) {
      first.focus();
      if (first.select)
        first.select();
    }
    else
      cancel.focus();
  });
}
