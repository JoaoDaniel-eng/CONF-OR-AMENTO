/* Painel de estoque (admin): eventos, registrados uma única vez. Carregado depois dos demais arquivos de js/admin-inventory/. */
(function() {
  'use strict';
  /* ---------- Eventos (registrados uma única vez) ---------- */
  $('#inventory-items').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn)
      return;
    const item = items.find(i => String(i.id) === btn.dataset.id);
    const action = ACTIONS[btn.dataset.act];
    if (!item || !action) {
      notify('Produto não encontrado. Atualize a página.', 'error');
      return;
    }
    btn.disabled = true;
    try {
      await action(item);
    }
    catch (err) {
      notify(err.message || 'Não foi possível concluir a ação.', 'error');
    }
    finally {
      btn.disabled = false;
    }
  });
  const search = $('#inventory-search'), statusFilter = $('#inventory-status-filter');
  if (search)
    search.addEventListener('input', () => { filters.text = search.value; renderItems(); });
  if (statusFilter)
    statusFilter.addEventListener('change', () => { filters.status = statusFilter.value; renderItems(); });
  const form = $('#inventory-item-form');
  // Mantém a unidade de consumo coerente com a unidade do estoque (kg→g, L→ml, un→un).
  form.elements.unit.addEventListener('change', () => { form.elements.consumptionUnit.value = defaultConsumptionUnit(form.elements.unit.value); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = new FormData(form), submit = form.querySelector('button[type=submit],button:not([type])');
    try {
      const quantity = toNum(d.get('quantity')), purchaseTotal = nonNegative(d.get('purchaseTotal'), 'O valor gasto');
      if (!Number.isFinite(quantity) || quantity < 0)
        throw new Error('Informe a quantidade que você tem agora.');
      if (submit)
        submit.disabled = true;
      const result = await api('/inventory/items', {
        method: 'POST', body: JSON.stringify({
          name: String(d.get('name') || '').trim(), unit: d.get('unit'), quantity,
          minimumQuantity: nonNegative(d.get('minimumQuantity'), 'O alerta'), purchaseTotal,
          consumptionQuantity: nonNegative(d.get('consumptionQuantity'), 'O consumo'), consumptionUnit: d.get('consumptionUnit')
        })
      });
      form.reset();
      form.elements.consumptionUnit.value = defaultConsumptionUnit(form.elements.unit.value);
      notify(result.matchedOption
        ? 'Produto cadastrado e ligado ao acompanhamento do mesmo nome.'
        : 'Produto cadastrado. Sem acompanhamento com o mesmo nome, o consumo vale por açaí.');
      await loadInventory();
    }
    catch (err) {
      notify(err.message, 'error');
    }
    finally {
      if (submit)
        submit.disabled = false;
    }
  });
})();
