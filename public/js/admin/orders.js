const statusLabel = { new: 'Novo', preparing: 'Preparando', out_for_delivery: 'Saiu para entrega', delivered: 'Entregue', cancelled: 'Cancelado' };
// Pedido "Novo" há mais de 10 min: o cliente pode não ter enviado a mensagem no WhatsApp, ou ninguém atendeu ainda.
const LATE_NEW_MIN = 10;
const orderAgeMin = o => Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
const isLateNew = o => o.status === 'new' && !(o.scheduled_for && new Date(o.scheduled_for).getTime() > Date.now()) && orderAgeMin(o) >= LATE_NEW_MIN;
const waLink = phone => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length < 10)
    return '';
  if (d.length <= 11)
    d = '55' + d;
  return 'https://wa.me/' + d;
};
const lateBadge = o => {
  if (!isLateNew(o))
    return '';
  const link = waLink(o.customer_phone);
  return `<small class="order-late-badge">⏰ Novo há ${orderAgeMin(o)} min${link ? ` · <a href="${link}" target="_blank" rel="noopener noreferrer">Chamar no WhatsApp</a>` : ''}</small>`;
};
// Linha de item na tabela: mostra o produto (ex.: trufado ou açaí tradicional), o tamanho e os complementos.
// Trufado tem receita fechada (sem adicionais), então não escreve "sem adicionais" para ele.
const itemLine = i => {
  const product = String(i.product || '').trim() || 'Açaí tradicional';
  const opts = (i.options || []).map(x => esc(x.name) + (Number(x.layers) > 1 ? ` (${Number(x.layers)} camadas)` : '')).join(', ');
  const isTraditional = /tradicional/i.test(product);
  const detail = opts || (isTraditional ? 'sem adicionais' : '');
  return `<small><strong>${esc(i.quantity)}× ${esc(product)}</strong> — ${esc(i.size)}${detail ? ' — ' + detail : ''}</small>`;
};
async function loadOrders(silent = false) {
  const all = await api('/orders?' + orderQuery({ limit: ordersLimit + 1 })), hasMore = all.length > ordersLimit, rows = all.slice(0, ordersLimit);
  const host = $('#orders-table');
  window.adminOrdersById = new Map(rows.map(o => [o.id, o]));
  const lateCount = rows.filter(isLateNew).length;
  const lateBanner = lateCount ? `<p class="order-late-banner" role="alert">⏰ ${lateCount} pedido${lateCount > 1 ? 's' : ''} novo${lateCount > 1 ? 's' : ''} sem atendimento há ${LATE_NEW_MIN} min ou mais. Confira o WhatsApp ou chame o cliente.</p>` : '';
  host.innerHTML = rows.length ? lateBanner + `<table><thead><tr><th>Pedido</th><th>Cliente / entrega</th><th>Itens</th><th>Pagamento</th><th>Total</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rows.map(o => `<tr${isLateNew(o) ? ' class="order-late-row"' : ''}><td><strong>${esc(o.order_code)}</strong><small>${new Date(o.created_at).toLocaleString('pt-BR')}</small>${o.scheduled_for ? `<small>Agendado: ${new Date(o.scheduled_for).toLocaleString('pt-BR')}</small>` : ''}</td><td>${esc(o.customer_name)}<small>${esc(o.customer_phone)}</small><small>${esc(o.address)} — ${esc(o.neighborhood)}</small>${o.notes ? `<small>Obs.: ${esc(o.notes)}</small>` : ''}</td><td>${(o.items || []).map(itemLine).join('')}${Number(o.spoon_quantity) > 0 ? `<small class="order-spoon yes">🥄 ${Number(o.spoon_quantity) === 1 ? 'COLHER' : 'COLHERES'}: ${Number(o.spoon_quantity)}</small>` : '<small class="order-spoon">Sem colher</small>'}</td><td>${esc(o.payment_method || 'A combinar')}${o.change_for ? `<small>Troco para R$ ${esc(o.change_for)}</small>` : ''}${o.coupon_code ? `<small>Cupom ${esc(o.coupon_code)} · -${brl(o.discount_cents)}</small>` : ''}</td><td><strong>${brl(o.total_cents)}</strong><small>Itens ${brl(o.subtotal_cents)}${Number(o.combo_discount_cents) > 0 ? ` − combo ${brl(o.combo_discount_cents)}` : ''}${Number(o.discount_cents) > 0 ? ` − cupom ${brl(o.discount_cents)}` : ''} + entrega ${brl(o.delivery_fee_cents)}${Number(o.spoon_quantity) > 0 ? ` + ${Number(o.spoon_quantity) === 1 ? 'colher' : 'colheres'} ${brl(o.spoon_cents)}` : ''}</small></td><td><span class="status status-${o.status}">${statusLabel[o.status]}</span>${lateBadge(o)}</td><td><select data-status-id="${o.id}" aria-label="Alterar status de ${esc(o.order_code)}">${Object.entries(statusLabel).map(([v, l]) => `<option value="${v}" ${v === o.status ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="button button-small button-outline" type="button" data-print-order="${o.id}">🖨️ Imprimir</button><button class="button button-small button-danger" type="button" data-delete-order="${o.id}">Excluir</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nenhum pedido encontrado.</p>';
  if (rows.length) {
    host.insertAdjacentHTML('beforeend', `<div class="orders-footer"><span class="muted">Mostrando ${rows.length} pedido${rows.length > 1 ? 's' : ''}${hasMore ? ' (há mais antigos)' : ''}.</span>${hasMore ? '<button type="button" class="button button-outline" id="orders-more">Carregar mais</button>' : ''}</div>`);
    const more = $('#orders-more');
    if (more)
      more.addEventListener('click', () => { ordersLimit += ORDERS_PAGE; loadOrders(true); });
  }
  host.querySelectorAll('[data-status-id]').forEach(el => el.addEventListener('change', async () => {
    try {
      await api(`/orders/${el.dataset.statusId}/status`, { method: 'PATCH', body: JSON.stringify({ status: el.value }) });
      say('Status atualizado.');
      await loadStats();
      await loadOrders();
    }
    catch (e) {
      say(e.message);
    }
  }));
  host.querySelectorAll('[data-delete-order]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Excluir permanentemente este pedido? Essa ação não pode ser desfeita. Faça um backup antes, se necessário.'))
      return;
    try {
      await api('/orders/' + b.dataset.deleteOrder, { method: 'DELETE' });
      say('Pedido excluído.');
      await loadOrders();
      await loadStats();
    }
    catch (e) {
      say(e.message);
    }
  }));
  if (!silent)
    host.scrollTop = 0;
}
const ORDERS_PAGE = 50;
let ordersLimit = ORDERS_PAGE, searchTimer = null;
function orderQuery(extra = {}) {
  const p = new URLSearchParams({ status: $('#order-filter').value, ...extra });
  const q = $('#order-search').value.trim(), from = $('#order-from').value, to = $('#order-to').value;
  if (q)
    p.set('q', q);
  if (from)
    p.set('from', from);
  if (to)
    p.set('to', to);
  return p.toString();
}
const resetOrders = () => { ordersLimit = ORDERS_PAGE; return loadOrders().catch(e => say(e.message)); };
['#order-filter', '#order-from', '#order-to'].forEach(sel => $(sel).addEventListener('change', resetOrders));
$('#order-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(resetOrders, 400); });
$('#orders-clear').addEventListener('click', () => { $('#order-search').value = ''; $('#order-from').value = ''; $('#order-to').value = ''; $('#order-filter').value = 'all'; resetOrders(); });
$('#orders-export').addEventListener('click', async () => {
  try {
    const r = await fetch('/api/admin/orders/export.csv?' + orderQuery(), { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 401)
      return logout();
    if (!r.ok)
      throw new Error((await r.json().catch(() => ({}))).error || 'Não foi possível baixar a planilha.');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await r.blob());
    a.download = 'pedidos-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say('Planilha baixada (respeita os filtros atuais).');
  }
  catch (e) {
    say(e.message);
  }
});
