const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => new Date(d).toLocaleString('pt-BR');
let token = localStorage.getItem('acaiDevToken') || '', currentTab = 'overview', refreshHandle = null;
const api = async (path, opts = {}) => {
  const r = await fetch('/api/dev' + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(opts.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && token)
      logout();
    throw new Error(d.error || 'Falha na solicitação.');
  }
  return d;
};
function say(message) {
  const el = $('#admin-message');
  el.textContent = message;
  setTimeout(() => {
    if (el.textContent === message)
      el.textContent = '';
  }, 5000);
}
function logout() {
  token = '';
  localStorage.removeItem('acaiDevToken');
  if (refreshHandle)
    clearInterval(refreshHandle);
  $('#dashboard').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
}
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-message').textContent = '';
  const form = e.currentTarget, fd = new FormData(form);
  try {
    const d = await api('/login', { method: 'POST', body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }) });
    token = d.token;
    localStorage.setItem('acaiDevToken', token);
    form.reset();
    showDashboard();
  }
  catch (err) {
    $('#login-message').textContent = err.message;
  }
});
$('#logout').addEventListener('click', logout);
// ===== Tema (compartilha a escolha com a loja e o painel da loja) =====
const devThemeQuery = window.matchMedia('(prefers-color-scheme: dark)'), themeOrder = ['auto', 'light', 'dark'], themeLabels = { auto: '🌓 Tema: automático', light: '☀️ Tema: claro', dark: '🌙 Tema: escuro' };
function devThemePref() {
  try {
    const t = localStorage.getItem('acaiTheme');
    return themeOrder.includes(t) ? t : 'auto';
  }
  catch {
    return 'auto';
  }
}
function applyDevTheme(pref, persist) {
  document.documentElement.dataset.theme = (pref === 'dark' || (pref === 'auto' && devThemeQuery.matches)) ? 'dark' : 'light';
  $('#dev-theme').textContent = themeLabels[pref];
  if (persist) {
    try {
      localStorage.setItem('acaiTheme', pref);
    }
    catch { }
  }
}
$('#dev-theme').addEventListener('click', () => applyDevTheme(themeOrder[(themeOrder.indexOf(devThemePref()) + 1) % 3], true));
devThemeQuery.addEventListener('change', () => {
  if (devThemePref() === 'auto')
    applyDevTheme('auto', false);
});
applyDevTheme(devThemePref(), false);
// ===== Abas =====
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('hidden', p.id !== `panel-${tab}`));
  loadTab(tab);
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
async function loadTab(tab) {
  try {
    if (tab === 'overview')
      await loadOverview();
    if (tab === 'errors')
      await loadErrors();
    if (tab === 'audit')
      await loadAudit();
    if (tab === 'backup')
      $('#backup-message').textContent = 'Os backups contêm dados pessoais e hashes de senha dos clientes. Mantenha-os protegidos.';
    if (tab === 'accounts')
      await loadAccounts();
  }
  catch (e) {
    say(e.message);
  }
}
async function showDashboard() {
  try {
    const me = await api('/me');
    $('#dev-who').textContent = 'Conectado como ' + me.email;
    $('#login-view').classList.add('hidden');
    $('#dashboard').classList.remove('hidden');
    switchTab(currentTab);
    if (refreshHandle)
      clearInterval(refreshHandle);
    refreshHandle = setInterval(() => {
      if (token && !document.hidden && currentTab === 'overview')
        loadOverview().catch(e => console.warn('Atualização automática:', e.message));
    }, 20000);
  }
  catch (e) {
    $('#login-message').textContent = e.message;
  }
}
