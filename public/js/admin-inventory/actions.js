/* Painel de estoque (admin): ações (compra, contagem, retirada, consumo, tamanhos, edição, exclusão).
   Depende de $, api, esc e say (admin/core.js). Os arquivos de js/admin-inventory/ são scripts clássicos
   carregados em ordem e compartilham o escopo global; events.js vem por último. */
'use strict';
/* ---------- Ações ---------- */
const positive = (value, label) => {
  const n = toNum(value);
  if (!Number.isFinite(n) || n <= 0)
    throw new Error(`${label} precisa ser maior que zero.`);
  return n;
};
const nonNegative = (value, label) => {
  const n = toNum(value === '' ? 0 : value);
  if (!Number.isFinite(n) || n < 0)
    throw new Error(`${label} não pode ser negativo.`);
  return n;
};
async function actionPurchase(item) {
  const ok = await openDialog({
    eyebrow: 'REPOSIÇÃO DE ESTOQUE', title: 'Adicionar compra',
    description: `${item.name}. Saldo atual: ${fmt(item.quantity)} ${unitLabel(item.unit)}. A quantidade informada é somada ao saldo.`,
    fields: [
      { name: 'quantity', label: 'Quanto você comprou?', type: 'number', min: 0, required: true, suffix: unitLabel(item.unit), placeholder: 'Ex.: 2' },
      { name: 'totalPaid', label: 'Quanto pagou no total? (R$)', type: 'number', min: 0, placeholder: 'Ex.: 45,00', hint: 'Opcional. Alimenta o valor gasto em compras.' },
      { name: 'supplier', label: 'Fornecedor', type: 'text', maxLength: 160, placeholder: 'Opcional' }
    ],
    submitLabel: 'Adicionar ao estoque',
    onSubmit: async (v) => {
      const quantity = positive(v.quantity, 'A quantidade comprada');
      const totalPaid = nonNegative(v.totalPaid, 'O valor pago');
      await api('/inventory/movements', {
        method: 'POST', body: JSON.stringify({
          itemId: item.id, type: 'entrada', quantity, totalPaid, unitCost: totalPaid / quantity,
          supplier: String(v.supplier || '').trim(), reason: 'Compra/reposição de estoque'
        })
      });
    }
  });
  if (ok) {
    notify(`Compra registrada em ${item.name}.`);
    await loadInventory();
  }
}
async function actionCount(item) {
  const ok = await openDialog({
    eyebrow: 'CONFERÊNCIA DE ESTOQUE', title: 'Corrigir saldo',
    description: `${item.name}. Saldo registrado: ${fmt(item.quantity)} ${unitLabel(item.unit)}. Informe quanto existe fisicamente agora. A diferença fica no histórico e não conta como compra.`,
    fields: [{ name: 'quantity', label: 'Quantidade que você tem agora', type: 'number', min: 0, required: true, value: Number(item.quantity), suffix: unitLabel(item.unit) }],
    submitLabel: 'Salvar quantidade',
    onSubmit: async (v) => {
      const quantity = nonNegative(v.quantity, 'A quantidade');
      await api('/inventory/movements', { method: 'POST', body: JSON.stringify({ itemId: item.id, type: 'conferencia', quantity }) });
    }
  });
  if (ok) {
    notify(`Saldo de ${item.name} atualizado.`);
    await loadInventory();
  }
}
async function actionWithdraw(item) {
  const ok = await openDialog({
    eyebrow: 'SAÍDA DE ESTOQUE', title: 'Retirar do estoque',
    description: `${item.name}. Saldo atual: ${fmt(item.quantity)} ${unitLabel(item.unit)}. Use para uso fora dos pedidos, perda ou vencimento.`,
    fields: [
      { name: 'type', label: 'Motivo', type: 'select', options: [{ value: 'saida', label: 'Uso / retirada' }, { value: 'desperdicio', label: 'Perda / desperdício / vencimento' }] },
      { name: 'quantity', label: 'Quanto saiu?', type: 'number', min: 0, required: true, suffix: unitLabel(item.unit) },
      { name: 'reason', label: 'Observação', type: 'text', maxLength: 500, placeholder: 'Opcional. Ex.: venceu, caiu no chão' }
    ],
    submitLabel: 'Registrar retirada',
    onSubmit: async (v) => {
      const quantity = positive(v.quantity, 'A quantidade retirada');
      if (quantity > Number(item.quantity))
        throw new Error(`Você só tem ${fmt(item.quantity)} ${unitLabel(item.unit)} registrados.`);
      await api('/inventory/movements', { method: 'POST', body: JSON.stringify({ itemId: item.id, type: v.type, quantity, reason: String(v.reason || '').trim() }) });
    }
  });
  if (ok) {
    notify('Retirada registrada.');
    await loadInventory();
  }
}
async function actionConsumption(item) {
  const ok = await openDialog({
    eyebrow: 'BAIXA AUTOMÁTICA', title: 'Consumo por açaí',
    description: `${item.name}. Quanto é usado em cada açaí, igual para todos os tamanhos. Digite 0 para desligar a baixa automática deste produto.${sizeRecipesOf(item).length ? ' Atenção: hoje este produto varia por tamanho. Ao salvar um valor fixo maior que zero, o consumo por tamanho será removido.' : ''}`,
    fields: [
      { name: 'amount', label: 'Quantidade por açaí', type: 'number', min: 0, required: true, value: Number(item.consumption_quantity || 0), placeholder: 'Ex.: 20' },
      {
        name: 'unit', label: 'Unidade do consumo', type: 'select', value: item.consumption_unit || defaultConsumptionUnit(item.unit),
        options: [{ value: 'g', label: 'Gramas (g)' }, { value: 'ml', label: 'Mililitros (ml)' }, { value: 'un', label: 'Unidades (un.)' }]
      }
    ],
    submitLabel: 'Salvar consumo',
    onSubmit: async (v) => {
      const amount = nonNegative(v.amount, 'O consumo');
      await api('/inventory/items/' + item.id, { method: 'PATCH', body: JSON.stringify({ consumptionQuantity: amount, consumptionUnit: v.unit, clearSizeRecipes: amount > 0 }) });
    }
  });
  if (ok) {
    notify('Consumo por açaí atualizado.');
    await loadInventory();
  }
}
async function actionSizes(item) {
  const catalog = await api('/inventory/catalog');
  const sizes = Array.isArray(catalog.sizes) ? catalog.sizes : [];
  if (!sizes.length)
    throw new Error('Não há tamanhos ativos no cardápio. Cadastre os tamanhos primeiro.');
  const measure = defaultConsumptionUnit(item.unit);
  const current = new Map(sizeRecipesOf(item).map(r => [Number(r.size_id), r.quantity]));
  const fields = sizes.map(sz => ({
    name: 'size_' + sz.id, label: sz.name, type: 'number', min: 0, suffix: unitLabel(measure),
    value: current.has(Number(sz.id)) ? fromStock(current.get(Number(sz.id)), item) : undefined,
    placeholder: measure === 'ml' && guessMl(sz.name) ? `Ex.: ${guessMl(sz.name)}` : 'Em branco = não desconta'
  }));
  const ok = await openDialog({
    eyebrow: 'BAIXA AUTOMÁTICA', title: 'Consumo por tamanho',
    description: `${item.name}. Informe quanto sai do estoque em cada tamanho do açaí. Deixe em branco (ou 0) o tamanho que não deve descontar. Com isso preenchido, o consumo fixo por açaí deste produto deixa de valer.`,
    fields,
    submitLabel: 'Salvar consumo por tamanho',
    onSubmit: async (v) => {
      const list = sizes.map(sz => ({ sizeId: sz.id, quantity: nonNegative(v['size_' + sz.id], `O consumo de “${sz.name}”`) }));
      await api(`/inventory/items/${item.id}/size-recipes`, { method: 'PUT', body: JSON.stringify({ measure, sizes: list }) });
    }
  });
  if (ok) {
    notify('Consumo por tamanho salvo.');
    await loadInventory();
  }
}
async function actionEdit(item) {
  const ok = await openDialog({
    eyebrow: 'DADOS DO PRODUTO', title: 'Editar produto',
    description: 'Corrija o nome, a unidade ou os limites do medidor. O saldo e os históricos são mantidos.',
    fields: [
      { name: 'name', label: 'Nome do produto', type: 'text', required: true, maxLength: 140, value: item.name },
      {
        name: 'unit', label: 'Unidade do estoque', type: 'select', value: item.unit,
        options: [{ value: 'kg', label: 'Quilos (kg)' }, { value: 'g', label: 'Gramas (g)' }, { value: 'un', label: 'Unidades' }, { value: 'l', label: 'Litros (L)' }, { value: 'ml', label: 'Mililitros (ml)' }],
        hint: 'Trocar entre kg e g (ou L e ml) converte o saldo automaticamente. Outras trocas não são permitidas.'
      },
      { name: 'minimum', label: 'Avisar quando restar até', type: 'number', min: 0, value: Number(item.minimum_quantity || 0), hint: 'Na unidade do estoque. 0 usa só o medidor (20% da quantidade cheia).' },
      { name: 'capacity', label: 'Quantidade cheia (100% do medidor)', type: 'number', min: 0, value: Math.max(Number(item.capacity_quantity) || 0, Number(item.quantity) || 0), hint: 'Use para reiniciar o medidor depois de uma compra grande ou de uma correção.' }
    ],
    submitLabel: 'Salvar alterações',
    onSubmit: async (v) => {
      const name = String(v.name).trim();
      if (name.length < 2)
        throw new Error('Informe o nome do produto.');
      await api('/inventory/items/' + item.id, {
        method: 'PATCH', body: JSON.stringify({
          name, unit: v.unit, minimumQuantity: nonNegative(v.minimum, 'O alerta'), capacityQuantity: nonNegative(v.capacity, 'A quantidade cheia')
        })
      });
    }
  });
  if (ok) {
    notify('Produto atualizado.');
    await loadInventory();
  }
}
async function actionDelete(item) {
  const ok = await openDialog({
    eyebrow: 'EXCLUIR PRODUTO', title: `Excluir “${item.name}”?`,
    description: 'O produto sai da lista de estoque. O histórico de compras e movimentações é preservado, e o acompanhamento do cardápio com o mesmo nome (se houver) volta a ficar disponível.',
    submitLabel: 'Excluir produto', danger: true,
    onSubmit: () => api('/inventory/items/' + item.id, { method: 'DELETE' })
  });
  if (ok) {
    notify(`${item.name} foi excluído do estoque. O histórico foi mantido.`);
    await loadInventory();
  }
}
const ACTIONS = { purchase: actionPurchase, count: actionCount, withdraw: actionWithdraw, consumption: actionConsumption, sizes: actionSizes, edit: actionEdit, delete: actionDelete };
