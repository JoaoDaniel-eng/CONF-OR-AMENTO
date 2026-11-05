// Impressão do pedido em impressora térmica de 58 mm (usa o diálogo de impressão do navegador).
// Para sair sozinho, sem janela de confirmação, o Chrome da loja deve abrir com --kiosk-printing (ver IMPRESSORA.md).
const AUTO_PRINT_KEY = 'acaiAutoPrint';
const autoPrintOn = () => localStorage.getItem(AUTO_PRINT_KEY) === '1';
const pad2 = n => String(n).padStart(2, '0');
const fmtDateTime = d => { const x = new Date(d); return Number.isNaN(x.getTime()) ? '' : `${pad2(x.getDate())}/${pad2(x.getMonth() + 1)}/${x.getFullYear()} ${pad2(x.getHours())}:${pad2(x.getMinutes())}`; };
function receiptHtml(o) {
  const items = (o.items || []).map(i => {
    const product = i.product && !/tradicional/i.test(i.product) ? `<div class="r-opt">${esc(i.product)}</div>` : '';
    const opts = (i.options || []).map(x => esc(x.name) + (Number(x.layers) > 1 ? ` (${Number(x.layers)} camadas)` : '')).join(', ') || 'sem adicionais';
    return `<div class="r-item r-row"><span>${esc(i.quantity)}x ${esc(i.size)}</span><span>${brl(i.lineTotalCents)}</span></div>${product}<div class="r-opt">${opts}</div>`;
  }).join('');
  const when = o.scheduled_for ? `<div class="r-box">AGENDADO: ${esc(fmtDateTime(o.scheduled_for))}</div>` : '<div class="r-center r-small">Entrega assim que possível</div>';
  const pay = o.payment_method === 'Pix' ? 'PIX (conferir comprovante)' : esc(o.payment_method || 'A combinar');
  const change = o.change_for ? `<div class="r-block">Troco para R$ ${esc(o.change_for)}</div>` : '';
  const lines = [['Subtotal', brl(o.subtotal_cents)]];
  if (Number(o.combo_discount_cents) > 0)
    lines.push(['Desconto combo', `-${brl(o.combo_discount_cents)}`]);
  if (Number(o.discount_cents) > 0)
    lines.push([`Cupom ${o.coupon_code || ''}`.trim(), `-${brl(o.discount_cents)}`]);
  lines.push([`Entrega${o.neighborhood ? ' (' + o.neighborhood + ')' : ''}`, brl(o.delivery_fee_cents)]);
  if (Number(o.spoon_quantity) > 0)
    lines.push([`Colher${Number(o.spoon_quantity) > 1 ? 'es' : ''} (${Number(o.spoon_quantity)}x)`, brl(o.spoon_cents)]);
  const totals = lines.map(([a, b]) => `<div class="r-row"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
  return `<div class="r-title">AÇAÍ DA ROÇA</div><div class="r-code">${esc(o.order_code)}</div><div class="r-center r-small">${esc(fmtDateTime(o.created_at))}</div><hr class="r-line">${when}<hr class="r-line">`
    + `<div class="r-label">Cliente</div><div class="r-block">${esc(o.customer_name)}<br>${esc(o.customer_phone)}</div>`
    + `<div class="r-label">Endereço</div><div class="r-block">${esc(o.address)}${o.neighborhood ? '<br>' + esc(o.neighborhood) : ''}</div>`
    + `<hr class="r-line"><div class="r-label">Pedido</div>${items}<hr class="r-line">`
    + (Number(o.spoon_quantity) > 0 ? `<div class="r-box">${Number(o.spoon_quantity) === 1 ? 'COLHER' : 'COLHERES'}: ${Number(o.spoon_quantity)}</div>` : '<div class="r-center r-small">Sem colher</div>')
    + (o.notes ? `<div class="r-label">Observações</div><div class="r-block">${esc(o.notes)}</div><hr class="r-line">` : '')
    + `${totals}<div class="r-row r-total"><span>TOTAL</span><span>${brl(o.total_cents)}</span></div><hr class="r-line">`
    + `<div class="r-label">Pagamento</div><div class="r-block">${pay}</div>${change}<div class="r-center r-small">Obrigado pela preferência!</div>`;
}
function printArea() {
  let el = document.getElementById('print-area');
  if (!el) {
    el = document.createElement('div');
    el.id = 'print-area';
    document.body.append(el);
  }
  return el;
}
let printQueue = Promise.resolve();
// Imprime um pedido por vez (vários pedidos novos ao mesmo tempo saem em sequência).
function printOrder(order) {
  printQueue = printQueue.then(() => new Promise(resolve => {
    printArea().innerHTML = receiptHtml(order);
    const done = () => { window.removeEventListener('afterprint', done); setTimeout(resolve, 800); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.removeEventListener('afterprint', done); resolve(); }, 20000);
    setTimeout(() => window.print(), 150);
  }));
  return printQueue;
}
const printedIds = new Set(JSON.parse(sessionStorage.getItem('acaiPrintedIds') || '[]'));
function rememberPrinted(id) { printedIds.add(id); sessionStorage.setItem('acaiPrintedIds', JSON.stringify([...printedIds].slice(-100))); }
// Chamado quando o painel percebe pedido novo: imprime os pedidos mais novos que o último já visto.
async function autoPrintNewOrders(previousId) {
  if (!autoPrintOn() || typeof previousId !== 'number')
    return;
  const rows = await api('/orders?limit=10');
  const fresh = rows.filter(o => o.id > previousId && o.status !== 'cancelled' && !printedIds.has(o.id)).sort((a, b) => a.id - b.id);
  for (const o of fresh) {
    rememberPrinted(o.id);
    await printOrder(o);
  }
}
const TEST_ORDER = { order_code: 'AR-TESTE', created_at: new Date().toISOString(), customer_name: 'Cliente de Teste', customer_phone: '(21) 99999-9999', address: 'Rua Exemplo, 123', neighborhood: 'Centro', items: [{ quantity: 1, size: '500 ml', product: 'Açaí tradicional', options: [{ name: 'Granola' }, { name: 'Leite em pó' }], lineTotalCents: 1900 }], notes: 'Teste de impressão', payment_method: 'Pix', subtotal_cents: 1900, delivery_fee_cents: 500, needs_spoon: true, spoon_quantity: 2, spoon_cents: 20, total_cents: 2420 };
document.addEventListener('click', e => {
  const btn = e.target.closest?.('[data-print-order]');
  if (btn) {
    const order = window.adminOrdersById?.get(Number(btn.dataset.printOrder));
    if (order)
      printOrder(order);
    return;
  }
  if (e.target.id === 'print-test')
    printOrder({ ...TEST_ORDER, created_at: new Date().toISOString() });
});
document.addEventListener('change', e => {
  if (e.target.id === 'auto-print') {
    localStorage.setItem(AUTO_PRINT_KEY, e.target.checked ? '1' : '0');
    say(e.target.checked ? 'Impressão automática ligada neste aparelho.' : 'Impressão automática desligada.');
  }
});
(function initAutoPrintToggle() {
  const box = document.getElementById('auto-print');
  if (box)
    box.checked = autoPrintOn();
})();
