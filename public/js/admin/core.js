const $ = s => document.querySelector(s);
const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = localStorage.getItem('acaiAdminToken') || '', currentTab = 'orders', pollHandle = null, storePaused = false;
let lastOrderId = null, audioCtx = null, flashTimer = null, soundOn = localStorage.getItem('acaiAdminSound') !== '0';
const api = async (path, opts = {}) => {
  const r = await fetch('/api/admin' + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(opts.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401)
      logout();
    throw new Error(d.error || 'Falha na solicitação.');
  }
  return d;
};
const moneyInput = c => (Number(c || 0) / 100).toFixed(2);
function say(message) {
  $('#admin-message').textContent = message;
  setTimeout(() => {
    if ($('#admin-message').textContent === message)
      $('#admin-message').textContent = '';
  }, 5000);
}
function logout() {
  lastOrderId = null;
  token = '';
  localStorage.removeItem('acaiAdminToken');
  if (pollHandle)
    clearInterval(pollHandle);
  $('#dashboard').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
}
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-message').textContent = '';
  const fd = new FormData(e.currentTarget);
  try {
    const d = await api('/login', { method: 'POST', body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }) });
    token = d.token;
    localStorage.setItem('acaiAdminToken', token);
    showDashboard();
  }
  catch (err) {
    $('#login-message').textContent = err.message;
  }
});
$('#logout').addEventListener('click', logout);
