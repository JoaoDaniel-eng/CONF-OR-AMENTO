// Configurações, preferências de entrega e notificações.
// Configurações
const settingsModal = $('#settings-modal');
let settingsReturnFocus = null;
function isSettingsOpen() { return !settingsModal.classList.contains('hidden'); }
function openSettings() { settingsReturnFocus = document.activeElement; syncSettingsUI(); settingsModal.classList.remove('hidden'); document.body.classList.add('menu-open'); setTimeout(() => $('.settings-close').focus(), 30); }
function closeSettings() {
  settingsModal.classList.add('hidden');
  document.body.classList.remove('menu-open');
  if (settingsReturnFocus && settingsReturnFocus.focus)
    settingsReturnFocus.focus();
}
settingsModal.addEventListener('click', e => {
  if (e.target.closest('[data-settings-close]'))
    closeSettings();
});
function syncSettingsUI() { const t = currentThemePref(); document.querySelectorAll('[name=theme]').forEach(r => r.checked = r.value === t); const f = currentFontScale(); document.querySelectorAll('[name=fontScale]').forEach(r => r.checked = r.value === f); fillPrefsForm(); syncNotifyUI(); syncPwaUI(); }
document.addEventListener('change', e => {
  if (e.target.name === 'theme')
    applyTheme(e.target.value, true);
  if (e.target.name === 'fontScale')
    applyFontScale(e.target.value, true);
});
$('#customer-profile-form [name=phone]').addEventListener('input', e => { const changed = e.target.value.replace(/\D/g, '') !== String($('#customer-profile-form').dataset.phone || '').replace(/\D/g, ''); $('#profile-password-label').classList.toggle('hidden', !changed); });
// Preferências de entrega (salvas neste aparelho)
function populatePrefsZones() {
  const z = $('#prefs-zone');
  if (!z || !menu?.zones)
    return;
  z.innerHTML = '<option value="">Selecione o bairro</option>' + menu.zones.map(x => `<option value="${x.id}">${esc(x.name)} — ${brl(x.fee)}</option>`).join('');
}
function fillPrefsForm() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem('acaiCustomerDetails') || 'null');
  }
  catch { }
  populatePrefsZones();
  const f = $('#delivery-prefs-form');
  f.customerName.value = saved?.customerName || f.customerName.value || '';
  f.phone.value = saved?.phone || f.phone.value || '';
  f.address.value = saved?.address || f.address.value || '';
  if (saved?.zoneId)
    f.zoneId.value = saved.zoneId;
}
$('#delivery-prefs-form').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.currentTarget, msg = $('#prefs-message');
  const data = { customerName: f.customerName.value.trim(), phone: f.phone.value.trim(), address: f.address.value.trim(), zoneId: f.zoneId.value };
  if (!data.customerName && !data.phone && !data.address && !data.zoneId) {
    msg.textContent = 'Preencha pelo menos um campo para salvar.';
    msg.classList.add('error-message');
    return;
  }
  try {
    localStorage.setItem('acaiCustomerDetails', JSON.stringify(data));
  }
  catch {
    msg.textContent = 'Não foi possível salvar neste navegador.';
    msg.classList.add('error-message');
    return;
  }
  const c = $('#checkout-form');
  if (data.customerName)
    c.customerName.value = data.customerName;
  if (data.phone)
    c.phone.value = data.phone;
  if (data.address)
    c.address.value = data.address;
  if (data.zoneId)
    $('#zone-select').value = data.zoneId;
  $('#save-customer-details').checked = true;
  msg.classList.remove('error-message');
  msg.textContent = 'Preferências salvas! Elas já aparecem no seu próximo pedido.';
});
$('#prefs-clear').addEventListener('click', () => {
  try {
    localStorage.removeItem('acaiCustomerDetails');
  }
  catch { }
  const f = $('#delivery-prefs-form');
  f.reset();
  $('#save-customer-details').checked = false;
  const msg = $('#prefs-message');
  msg.classList.remove('error-message');
  msg.textContent = 'Dados de entrega apagados deste aparelho.';
});
// Notificações de pedidos (avisos enquanto o site estiver aberto)
var notifySupported = "Notification" in window;
var orderWatchTimer = null;
function notifyEnabled() { return localStorage.getItem('acaiNotify') === '1' && notifySupported && Notification.permission === 'granted'; }
function syncNotifyUI() {
  const t = $('#notify-toggle'), help = $('#notify-help');
  if (!notifySupported) {
    t.checked = false;
    t.disabled = true;
    help.textContent = 'Este navegador não oferece suporte a notificações.';
    return;
  }
  if (Notification.permission === 'denied') {
    t.checked = false;
    t.disabled = true;
    help.textContent = 'As notificações estão bloqueadas no navegador. Libere nas configurações do site para ativar.';
    return;
  }
  t.disabled = false;
  t.checked = notifyEnabled();
}
$('#notify-toggle').addEventListener('change', async (e) => {
  const msg = $('#notify-message');
  msg.textContent = '';
  msg.classList.remove('error-message');
  if (e.target.checked) {
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm === 'granted') {
      localStorage.setItem('acaiNotify', '1');
      msg.textContent = 'Avisos de pedidos ativados.';
      restartOrderWatcher();
    }
    else {
      e.target.checked = false;
      localStorage.removeItem('acaiNotify');
      msg.textContent = 'Permissão não concedida. Ative as notificações no navegador para receber avisos.';
      msg.classList.add('error-message');
    }
  }
  else {
    localStorage.removeItem('acaiNotify');
    msg.textContent = 'Avisos de pedidos desativados.';
    stopOrderWatcher();
  }
  syncNotifyUI();
});
async function showOrderNotice(title, body) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification(title, { body, icon: '/images/icon-192.png', badge: '/images/icon-192.png', tag: 'acai-pedido' });
      return;
    }
  }
  catch { }
  try {
    new Notification(title, { body, icon: '/images/icon-192.png' });
  }
  catch { }
}
async function checkOrderStatuses() {
  if (!notifyEnabled() || !localStorage.getItem('acaiCustomerToken'))
    return;
  try {
    const r = await api('/customers/me/orders');
    let prev = {};
    try {
      prev = JSON.parse(localStorage.getItem('acaiOrderStatuses') || 'null') || {};
    }
    catch { }
    const first = !Object.keys(prev).length && !localStorage.getItem('acaiOrderStatuses');
    const next = {};
    for (const o of r.orders) {
      next[o.order_code] = o.status;
      if (!first && prev[o.order_code] && prev[o.order_code] !== o.status) {
        showOrderNotice(`Pedido ${o.order_code}`, `Status atualizado: ${statusNames[o.status] || o.status}`);
      }
    }
    localStorage.setItem('acaiOrderStatuses', JSON.stringify(next));
  }
  catch { }
}
function stopOrderWatcher() {
  if (orderWatchTimer) {
    clearInterval(orderWatchTimer);
    orderWatchTimer = null;
  }
}
function restartOrderWatcher() {
  stopOrderWatcher();
  if (!notifyEnabled())
    return;
  checkOrderStatuses();
  orderWatchTimer = setInterval(checkOrderStatuses, 60000);
}
// Aplicativo (PWA)
function syncPwaUI() { const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone; $('#pwa-status').textContent = standalone ? 'O aplicativo já está instalado e em uso neste aparelho. ✅' : 'Você pode instalar o Açaí da Roça no celular e abrir como um aplicativo.'; $('#settings-install').classList.toggle('hidden', !!standalone); $('#app-version').textContent = 'Açaí da Roça · versão da interface 20261101'; }
$('#settings-install').addEventListener('click', () => $('#install-app').click());
