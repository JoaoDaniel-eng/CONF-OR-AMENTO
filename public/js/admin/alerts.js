// Aviso do topo do painel: loja aberta e sem pedidos há muito tempo.
// (Erros técnicos, auditoria e backup agora ficam no painel do desenvolvedor, em /dev.)
async function loadAlerts() {
  try {
    const a = await api('/alerts'), items = [];
    if (a.noOrders)
      items.push(`<div class="alert-item alert-warn">⏳ Loja aberta e sem pedidos há mais de ${a.noOrders.hours} h. Se isso não é normal, abra o site e faça um pedido de teste.</div>`);
    $('#alerts-bar').innerHTML = items.join('');
  }
  catch (e) {
    console.warn('Avisos:', e.message);
  }
}
