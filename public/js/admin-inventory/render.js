/* Painel de estoque (admin): renderização e carga dos dados.
   Depende de $, api, esc e say (admin/core.js). Os arquivos de js/admin-inventory/ são scripts clássicos
   carregados em ordem e compartilham o escopo global; events.js vem por último. */
'use strict';
/* ---------- Renderização ---------- */
function renderSummary() {
  const st = items.map(statusOf);
  const low = st.filter(s => s.key === 'low').length;
  const empty = st.filter(s => s.key === 'empty').length;
  const spent = items.reduce((sum, i) => sum + Number(i.purchase_total || 0), 0);
  $('#inventory-summary').innerHTML =
    `<article class="stat-card"><span>Produtos cadastrados</span><strong>${items.length}</strong></article>` +
    `<article class="stat-card"><span>Estoque acabando</span><strong>${low}</strong></article>` +
    `<article class="stat-card"><span>Esgotados</span><strong>${empty}</strong></article>` +
    `<article class="stat-card"><span>Gasto em compras</span><strong>${money(spent)}</strong></article>`;
}
function itemCard(item) {
  const s = statusOf(item);
  const bySize = sizeRecipesOf(item);
  const measureLabel = unitLabel(defaultConsumptionUnit(item.unit));
  const consumption = bySize.length
    ? 'varia por tamanho'
    : item.consumption_quantity
      ? `${fmt(item.consumption_quantity)} ${unitLabel(item.consumption_unit || defaultConsumptionUnit(item.unit))} por açaí`
      : 'não configurado';
  const sizeFacts = bySize.length
    ? `<li class="stock-size-facts">${bySize.map(r => `${esc(r.size_name || 'Tamanho')}: <strong>${fmt(fromStock(r.quantity, item))} ${esc(measureLabel)}</strong>`).join(' · ')}</li>`
    : '';
  const min = Number(item.minimum_quantity) > 0 ? `<li>Avisar com <strong>${fmt(item.minimum_quantity)} ${unitLabel(item.unit)}</strong></li>` : '';
  return `<article class="stock-card is-${s.key}" data-item="${item.id}">
      <div class="stock-card-head">
        <div><h4>${esc(item.name)}</h4>${item.option_name ? `<small>Ligado ao cardápio: ${esc(item.option_name)}</small>` : ''}</div>
        <span class="stock-badge ${s.key}">${s.label}</span>
      </div>
      <div class="stock-qty">${fmt(item.quantity)}<span>${esc(unitLabel(item.unit))}</span></div>
      <div class="stock-meter"><div class="stock-meter-track"><i class="${s.key}" style="width:${s.percent}%"></i></div><small>${Math.round(s.percent)}% da quantidade cheia</small></div>
      <ul class="stock-facts"><li>Consumo: <strong>${esc(consumption)}</strong></li>${sizeFacts}<li>Gasto em compras: <strong>${money(item.purchase_total)}</strong></li>${min}</ul>
      <div class="stock-actions">
        <button type="button" class="button button-small button-primary" data-act="purchase" data-id="${item.id}">＋ Adicionar compra</button>
        <button type="button" class="button button-small button-outline" data-act="count" data-id="${item.id}">Corrigir saldo</button>
        <button type="button" class="button button-small button-outline" data-act="withdraw" data-id="${item.id}">Retirar / perda</button>
        <button type="button" class="button button-small button-outline" data-act="consumption" data-id="${item.id}">Consumo fixo</button>
        <button type="button" class="button button-small button-outline" data-act="sizes" data-id="${item.id}">Consumo por tamanho</button>
        <button type="button" class="button button-small button-outline" data-act="edit" data-id="${item.id}">Editar</button>
        <button type="button" class="button button-small button-danger" data-act="delete" data-id="${item.id}">Excluir</button>
      </div>
    </article>`;
}
function renderItems() {
  const text = filters.text.trim().toLowerCase();
  const list = items.filter(i => {
    if (text && !String(i.name).toLowerCase().includes(text))
      return false;
    return filters.status === 'all' || statusOf(i).key === filters.status;
  });
  if (!items.length) {
    $('#inventory-items').innerHTML = '<p class="stock-empty">Nenhum produto cadastrado. Use o formulário acima para começar.</p>';
    return;
  }
  $('#inventory-items').innerHTML = list.length ? `<div class="stock-list">${list.map(itemCard).join('')}</div>` : '<p class="stock-empty">Nenhum produto encontrado com esse filtro.</p>';
}
function renderMovements(movements) {
  $('#inventory-movements').innerHTML = movements.length
    ? `<table><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Detalhe</th></tr></thead><tbody>${movements.slice(0, 40).map(m => {
        const sign = MOVEMENT_SIGN[m.movement_type] || '';
        return `<tr><td>${new Date(m.created_at).toLocaleString('pt-BR')}</td><td>${esc(m.item_name)}</td><td>${esc(MOVEMENT_LABEL[m.movement_type] || m.movement_type)}</td><td>${sign}${fmt(m.quantity)} ${esc(unitLabel(m.item_unit))}</td><td>${esc(m.reason || '—')}</td></tr>`;
      }).join('')}</tbody></table>`
    : '<p class="stock-empty">As movimentações aparecerão aqui.</p>';
}
async function loadInventory() {
  const data = await api('/inventory');
  items = Array.isArray(data.items) ? data.items : [];
  recipes = Array.isArray(data.recipes) ? data.recipes : [];
  renderSummary();
  renderItems();
  renderMovements(Array.isArray(data.movements) ? data.movements : []);
}
window.loadInventory = loadInventory;
