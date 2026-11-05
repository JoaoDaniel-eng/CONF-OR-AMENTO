async function loadAudit() {
  const p = new URLSearchParams({ limit: '200' }), actor = $('#audit-actor').value, q = $('#audit-search').value.trim();
  if (actor)
    p.set('actor', actor);
  if (q)
    p.set('q', q);
  const rows = await api('/audit-logs?' + p);
  $('#audit-content').innerHTML = rows.length
    ? `<table><thead><tr><th>Data</th><th>Painel</th><th>Usuário</th><th>Ação</th><th>Rota</th><th>Resultado</th><th>IP</th></tr></thead><tbody>${rows.map(r => `<tr><td>${fmtDate(r.created_at)}</td><td><span class="dev-pill ${r.actor === 'dev' ? 'dev' : 'neutral'}">${r.actor === 'dev' ? 'Desenvolvedor' : 'Loja'}</span></td><td>${esc(r.admin_email)}</td><td>${esc(r.action)}</td><td class="dev-mono">${esc(r.route)}</td><td>${r.status_code}</td><td>${esc(r.ip_address || '—')}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">Nenhuma ação registrada para esse filtro.</p>';
}
$('#audit-refresh').addEventListener('click', () => loadAudit().catch(e => say(e.message)));
$('#audit-actor').addEventListener('change', () => loadAudit().catch(e => say(e.message)));
$('#audit-search').addEventListener('keydown', e => { if (e.key === 'Enter') loadAudit().catch(err => say(err.message)); });
