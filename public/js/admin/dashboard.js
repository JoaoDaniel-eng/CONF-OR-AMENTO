function switchTab(tab) { currentTab = tab; document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab)); document.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('hidden', p.id !== `panel-${tab}`)); loadTab(tab); }
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
async function showDashboard() {
  try {
    await loadStats();
    loadAlerts();
    $('#login-view').classList.add('hidden');
    $('#dashboard').classList.remove('hidden');
    await loadPauseState();
    switchTab(currentTab);
    if (pollHandle)
      clearInterval(pollHandle);
    pollHandle = setInterval(async () => {
      if (!token)
        return;
      try {
        await loadStats();
        await loadAlerts();
        if (!document.hidden && currentTab === 'orders')
          await loadOrders(true);
      }
      catch (e) {
        console.warn('Atualização automática:', e.message);
      }
    }, 12000);
  }
  catch (e) {
    say(e.message);
  }
}
async function loadStats() { const s = await api('/stats'); $('#stats').innerHTML = `<article class="stat-card"><span>Faturamento total*</span><strong>${brl(s.all.revenue)}</strong><small>${s.all.count} pedidos não cancelados</small></article><article class="stat-card"><span>Hoje*</span><strong>${brl(s.today.revenue)}</strong><small>${s.today.count} pedidos hoje</small></article><article class="stat-card"><span>Pedidos em andamento</span><strong>${s.openOrders}</strong><small>Novos, preparando ou em entrega</small></article><article class="stat-card"><span>Avaliações pendentes</span><strong>${s.pendingReviews}</strong><small>Aguardando moderação</small></article>`; detectNewOrder(s); return s; }
async function loadPauseState() { const s = await api('/settings'); storePaused = s.manual_closed === 'true'; const b = $('#pause-orders'); b.textContent = storePaused ? '▶ Reabrir pedidos imediatos' : 'Ⅱ Pausar pedidos imediatos'; b.classList.toggle('button-danger', !storePaused); b.classList.toggle('button-primary', storePaused); b.setAttribute('aria-pressed', String(storePaused)); }
$('#pause-orders').addEventListener('click', async () => {
  const next = !storePaused;
  try {
    await api('/settings', { method: 'PATCH', body: JSON.stringify({ manual_closed: String(next) }) });
    storePaused = next;
    await loadPauseState();
    say(next ? 'Pedidos imediatos pausados. Pedidos agendados continuam disponíveis.' : 'Loja reaberta para pedidos imediatos.');
  }
  catch (e) {
    say(e.message);
  }
});
async function loadTab(tab) {
  try {
    if (tab === 'orders')
      await loadOrders();
    if (tab === 'menu')
      await loadMenu();
    if (tab === 'zones')
      await loadZones();
    if (tab === 'inventory')
      await loadInventory();
    if (tab === 'reviews')
      await loadReviews();
    if (tab === 'settings')
      await loadSettings();
    if (tab === 'reports')
      await loadReports();
    if (tab === 'coupons') {
      await loadCoupons();
      await loadWelcomeCoupons();
    }
    if (tab === 'customers')
      await loadCustomers();
  }
  catch (e) {
    say(e.message);
  }
}
