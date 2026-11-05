// Atualização automática do acompanhamento e da conta.
// ===== Atualização automática: acompanhamento do pedido e conta =====
var trackTimer = null, trackDirty = false, accountTimer = null;
function showLiveNote(text) { const n = $('#live-note'); n.textContent = text; n.classList.remove('hidden'); }
function startLiveTracking() {
  stopLiveTracking();
  if (!trackedOrder || ['delivered', 'cancelled'].includes(trackedOrder.status)) {
    return;
  }
  trackTimer = setInterval(refreshTracked, 20000);
  showLiveNote('🔄 Este pedido atualiza sozinho — você não precisa consultar de novo.');
}
function stopLiveTracking() {
  if (trackTimer) {
    clearInterval(trackTimer);
    trackTimer = null;
  }
}
function paintStatus(o) {
  const r = $('#tracking-result');
  const badge = r.querySelector('.tracking-top .status');
  if (badge) {
    badge.className = `status status-${o.status}`;
    badge.textContent = statusNames[o.status] || o.status;
  }
  const spans = r.querySelectorAll('.tracking-progress span');
  const done = [o.status !== 'cancelled', ['preparing', 'out_for_delivery', 'delivered'].includes(o.status), ['out_for_delivery', 'delivered'].includes(o.status), o.status === 'delivered'];
  spans.forEach((sp, i) => sp.classList.toggle('done', !!done[i]));
}
async function refreshTracked() {
  if (!trackedOrder || document.hidden || $('#tracking-result').classList.contains('hidden'))
    return;
  try {
    const o = await api(`/orders/track?code=${encodeURIComponent(trackedOrder.orderCode)}&phone=${encodeURIComponent(trackedOrder.lookupPhone)}`);
    o.lookupPhone = trackedOrder.lookupPhone;
    if (o.status !== trackedOrder.status) {
      const finished = ['delivered', 'cancelled'].includes(o.status);
      if (trackDirty && o.canEdit) {
        trackedOrder.status = o.status;
        trackedOrder.canEdit = o.canEdit;
        paintStatus(o);
        showLiveNote(`✅ Status atualizado: ${statusNames[o.status] || o.status}. Suas edições em andamento foram mantidas.`);
      }
      else {
        renderTracking(o);
        showLiveNote(`✅ Status atualizado: ${statusNames[o.status] || o.status}`);
      }
      if (finished)
        stopLiveTracking();
      loadCustomerOrdersIfSignedIn();
    }
    else {
      showLiveNote(`🔄 Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — atualiza sozinho.`);
    }
  }
  catch { }
}
$('#tracking-result').addEventListener('input', () => { trackDirty = true; });
$('#tracking-result').addEventListener('change', () => { trackDirty = true; });
function loadCustomerOrdersIfSignedIn() {
  if (localStorage.getItem('acaiCustomerToken')) {
    loadCustomerOrders();
    loadCustomerCoupons();
  }
}
function startAccountLive() {
  stopAccountLive();
  accountTimer = setInterval(async () => {
    if (document.hidden || !localStorage.getItem('acaiCustomerToken'))
      return;
    loadCustomerOrders();
    loadCustomerCoupons();
    try {
      const d = await api('/customers/me');
      setPoints(d.loyaltyBalance);
    }
    catch { }
  }, 30000);
}
function stopAccountLive() {
  if (accountTimer) {
    clearInterval(accountTimer);
    accountTimer = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden)
    return;
  refreshTracked();
  loadCustomerOrdersIfSignedIn();
});
