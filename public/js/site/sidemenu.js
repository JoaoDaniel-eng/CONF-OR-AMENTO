// Menu lateral e estado de login no cabeçalho.
// Menu lateral
const sideMenu = $('#side-menu'), menuToggle = $('#menu-toggle'), menuOverlay = $('#menu-overlay');
function isMenuOpen() { return sideMenu.classList.contains('open'); }
function openMenu() { sideMenu.classList.add('open'); sideMenu.setAttribute('aria-hidden', 'false'); menuOverlay.classList.remove('hidden'); document.body.classList.add('menu-open'); menuToggle.setAttribute('aria-expanded', 'true'); menuToggle.setAttribute('aria-label', 'Fechar menu'); menuToggle.classList.add('is-open'); }
function closeMenu() {
  sideMenu.classList.remove('open');
  sideMenu.setAttribute('aria-hidden', 'true');
  menuOverlay.classList.add('hidden');
  if (!isSettingsOpen())
    document.body.classList.remove('menu-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Abrir menu');
  menuToggle.classList.remove('is-open');
}
menuToggle.addEventListener('click', () => isMenuOpen() ? closeMenu() : openMenu());
menuOverlay.addEventListener('click', closeMenu);
document.addEventListener('click', e => {
  if (isMenuOpen() && !e.target.closest('#side-menu') && !e.target.closest('#menu-toggle'))
    closeMenu();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape')
    return;
  if (isSettingsOpen())
    closeSettings();
  else if (isMenuOpen()) {
    closeMenu();
    menuToggle.focus();
  }
});
function goTo(selector, focusSel) {
  setTimeout(() => {
    const el = $(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (focusSel) {
        const f = $(focusSel);
        if (f)
          setTimeout(() => f.focus({ preventScroll: true }), 450);
      }
    }
  }, 60);
}
sideMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-menu-action]');
  if (!b)
    return;
  const a = b.dataset.menuAction;
  closeMenu();
  if (a === 'account')
    goTo('#minha-conta');
  else if (a === 'orders')
    goTo('#meus-pedidos');
  else if (a === 'coupons')
    goTo('#meus-cupons');
  else if (a === 'favorites')
    goTo('#meus-favoritos');
  else if (a === 'settings')
    openSettings();
  else if (a === 'logout')
    doLogout();
  else if (a === 'login')
    goTo('#customer-login-form', '#customer-login-form [name=phone]');
  else if (a === 'register')
    goTo('#customer-register-form', '#customer-register-form [name=name]');
  else if (a === 'track')
    goTo('#acompanhar');
});
// Estado de login no cabeçalho e no menu
function setPoints(n) { const has = typeof n === 'number'; const txt = has ? `💜 ${n} ${n === 1 ? 'ponto' : 'pontos'} no Clube da Roça` : ''; $('#menu-points').textContent = txt; $('#menu-points').classList.toggle('hidden', !has); $('#customer-points').textContent = has ? `${txt} · cada R$ 1 em pedidos entregues vale 1 ponto` : ''; $('#customer-points').classList.toggle('hidden', !has); }
function applyAuthUI(customer, points) {
  const signedIn = !!customer;
  document.body.dataset.auth = signedIn ? 'in' : 'out';
  const first = signedIn ? String(customer.name || '').trim().split(/\s+/)[0] : '';
  $('#header-greeting').textContent = signedIn ? `Olá, ${first}! 👋` : '';
  $('#header-greeting').classList.toggle('hidden', !signedIn);
  $('#header-login').classList.toggle('hidden', signedIn);
  $('#header-register').classList.toggle('hidden', signedIn);
  $('#login-promo')?.classList.toggle('hidden', signedIn);
  $('#menu-signed-in').classList.toggle('hidden', !signedIn);
  $('#menu-signed-out').classList.toggle('hidden', signedIn);
  $('#side-menu-hello').textContent = signedIn ? `Olá, ${first}! 👋` : 'Olá! 👋';
  $('#side-menu-sub').textContent = signedIn ? customer.phone : 'Entre para ver seus pedidos';
  setPoints(signedIn && typeof points === 'number' ? points : null);
  if (signedIn) {
    restartOrderWatcher();
    startAccountLive();
  }
  else {
    stopOrderWatcher();
    stopAccountLive();
    favorites = [];
    favoritesLoaded = false;
  }
}
