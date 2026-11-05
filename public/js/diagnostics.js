// Carregado antes de tudo, na loja e no painel:
// 1) envia ao servidor os erros de JavaScript que acontecem no aparelho;
// 2) avisa quando existe uma versão nova do site (deploy) e atualiza.
(function () {
  const build = (document.querySelector('meta[name="build"]') || {}).content || '';
  const isAdmin = location.pathname.startsWith('/admin');
  const seen = new Set();
  let sentCount = 0;
  const NOISE = /ResizeObserver|failed to fetch|load failed|networkerror|aborted|script error/i;
  function report(message, source, line, col, stack) {
    try {
      message = String(message || '').trim();
      if (!message || NOISE.test(message) || sentCount >= 5)
        return;
      if (source && source.indexOf(location.origin) !== 0)
        return;
      const key = message + '|' + source + '|' + line;
      if (seen.has(key))
        return;
      seen.add(key);
      sentCount++;
      fetch('/api/client-errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ message, source, line, col, stack, page: location.pathname, build }) }).catch(function () { });
    }
    catch (e) { /* registrar o erro nunca pode causar outro erro */ }
  }
  window.addEventListener('error', function (e) {
    if (e.target && e.target !== window && (e.target.src || e.target.href)) {
      const url = String(e.target.src || e.target.href);
      // Só interessa arquivo do próprio site. Scripts de fora (ex.: navegador do Instagram/Facebook injetando pcm.js) são barrados de propósito pela CSP e não são bug.
      if (url.indexOf(location.origin) !== 0)
        return;
      return report('Arquivo não carregou: ' + url, location.origin, null, null, null);
    }
    report(e.message, e.filename, e.lineno, e.colno, e.error && e.error.stack);
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    const r = e.reason;
    report((r && r.message) || String(r), location.origin, null, null, r && r.stack);
  });

  // Aviso de versão nova.
  if (!build)
    return;
  let shown = false, pendingReload = false;
  async function reload() {
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg)
        await reg.update();
    }
    catch (e) { /* segue para o reload */ }
    location.reload();
  }
  function showBanner() {
    if (shown)
      return;
    shown = true;
    const bar = document.createElement('div');
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#321047;color:#fff;padding:12px 14px;border-radius:12px;display:flex;gap:12px;align-items:center;justify-content:space-between;box-shadow:0 6px 24px rgba(0,0,0,.35);font:600 14px Poppins,system-ui,sans-serif';
    const text = document.createElement('span');
    text.textContent = 'Nova versão disponível.';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Atualizar agora';
    btn.style.cssText = 'background:#8cc63f;color:#1d0a2b;border:0;border-radius:999px;padding:8px 14px;font:700 14px Poppins,system-ui,sans-serif;cursor:pointer';
    btn.addEventListener('click', reload);
    bar.append(text, btn);
    document.body.appendChild(bar);
  }
  async function check() {
    try {
      const r = await fetch('/api/version', { cache: 'no-store' });
      if (!r.ok)
        return;
      const d = await r.json();
      if (!d.build || d.build === build)
        return;
      // Na loja, se o cliente está com a tela em segundo plano, atualiza quando ele voltar (o carrinho fica salvo no aparelho).
      // Só tenta uma vez por versão, para nunca entrar em looping de recarregamento.
      if (!isAdmin && document.hidden && sessionStorage.getItem('acaiAutoReloaded') !== d.build)
        pendingReload = d.build;
      else
        showBanner();
    }
    catch (e) { /* sem internet: tenta de novo depois */ }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden)
      return;
    if (pendingReload) {
      try { sessionStorage.setItem('acaiAutoReloaded', pendingReload); } catch (e) { /* ignora */ }
      return reload();
    }
    check();
  });
  setInterval(check, 5 * 60 * 1000);
  setTimeout(check, 20000);
})();
