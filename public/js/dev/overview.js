function fmtUptime(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}
const pill = (ok, yes = 'OK', no = 'Atenção') => `<span class="dev-pill ${ok ? 'ok' : 'bad'}">${ok ? yes : no}</span>`;
async function loadOverview() {
  const o = await api('/overview'), db = o.database, s = o.server, c = o.counts;
  const latencyClass = db.latencyMs > 1500 ? 'bad' : db.latencyMs > 400 ? 'warn' : 'ok';
  $('#overview-content').innerHTML = `
    <div class="stats-grid">
      <article class="stat-card"><span>Banco de dados</span><strong>${pill(db.ok, 'Conectado', 'Fora do ar')}</strong><small>Resposta em <b class="dev-${latencyClass}">${db.latencyMs} ms</b>${db.size ? ' · ' + esc(db.size) : ''}</small></article>
      <article class="stat-card"><span>Servidor</span><strong>${fmtUptime(s.uptimeSeconds)}</strong><small>no ar · memória ${s.rssMb} MB</small></article>
      <article class="stat-card"><span>Versão publicada</span><strong class="dev-mono">${esc(s.build)}</strong><small>Node ${esc(s.node)} · ${esc(s.env)}</small></article>
      <article class="stat-card"><span>Erros nas últimas 24 h</span><strong class="${c.errors_24h ? 'dev-bad' : ''}">${c.errors_24h}</strong><small>${c.errors_24h_server} do servidor · ${c.errors_total} no total${c.errors_24h ? ' · <a href="#" data-go-errors>ver erros</a>' : ''}</small></article>
    </div>
    <h3>Dados no banco</h3>
    <div class="dev-counts"><span><b>${c.orders}</b> pedidos</span><span><b>${c.customers}</b> clientes</span><span><b>${c.reviews}</b> avaliações</span><span><b>${c.products}</b> produtos</span><span><b>${c.admins}</b> conta(s) da loja</span><span><b>${c.audit_total}</b> registros de auditoria</span></div>
    <h3>Conexões do banco</h3>
    <p class="muted">Em uso: ${db.pool.total - db.pool.idle} · ociosas: ${db.pool.idle} · esperando: ${db.pool.waiting}${db.version ? ' · ' + esc(db.version) : ''}</p>
    <h3>Configuração do servidor</h3>
    <p class="muted">Só mostra se a variável existe; os valores secretos nunca saem do servidor.</p>
    <div class="table-wrap"><table><thead><tr><th>Variável</th><th>Situação</th><th>Observação</th></tr></thead><tbody>${o.config.map(x => `<tr><td class="dev-mono">${esc(x.name)}</td><td>${pill(x.ok, 'OK', 'Pendente')}</td><td>${esc(x.note || '')}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted">Atualizado às ${new Date(s.now).toLocaleTimeString('pt-BR')}.</p>`;
  const go = $('#overview-content').querySelector('[data-go-errors]');
  if (go)
    go.addEventListener('click', e => { e.preventDefault(); switchTab('errors'); });
}
$('#overview-refresh').addEventListener('click', () => loadOverview().then(() => say('Visão geral atualizada.')).catch(e => say(e.message)));
