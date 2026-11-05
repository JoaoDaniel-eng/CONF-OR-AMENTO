async function loadErrors() {
  const p = new URLSearchParams({ limit: '150' }), kind = $('#errors-kind').value, q = $('#errors-search').value.trim();
  if (kind)
    p.set('kind', kind);
  if (q)
    p.set('q', q);
  const { rows, groups } = await api('/errors?' + p);
  const origin = k => k === 'servidor' ? 'Servidor' : 'Tela do cliente';
  const groupsHtml = groups.length > 1 || (groups.length === 1 && groups[0].occurrences > 1)
    ? `<h3>Mais frequentes</h3><table><thead><tr><th>Origem</th><th>Mensagem</th><th>Vezes</th><th>Primeira</th><th>Última</th></tr></thead><tbody>${groups.map(g => `<tr><td>${origin(g.kind)}</td><td>${esc(g.message)}</td><td><strong>${g.occurrences}</strong></td><td>${fmtDate(g.first_seen)}</td><td>${fmtDate(g.last_seen)}</td></tr>`).join('')}</tbody></table><h3>Mais recentes</h3>` : '';
  $('#errors-content').innerHTML = rows.length
    ? `${groupsHtml}<table><thead><tr><th>Quando</th><th>Origem</th><th>Mensagem</th><th>Onde</th><th>Página</th><th>Versão</th><th></th></tr></thead><tbody>${rows.map(r => `<tr data-id="${r.id}"><td>${fmtDate(r.created_at)}</td><td>${origin(r.kind)}</td><td>${esc(r.message)}</td><td>${esc(r.source ? String(r.source).replace(location.origin, '') + (r.line ? ':' + r.line : '') : '—')}</td><td>${esc(r.page || '—')}</td><td>${esc(r.build || '—')}</td><td><button type="button" class="button button-outline" data-detail="${r.id}">Detalhes</button></td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">Nenhum erro registrado. 🎉</p>';
}
async function toggleErrorDetail(id, btn) {
  const row = btn.closest('tr'), next = row.nextElementSibling;
  if (next && next.classList.contains('dev-detail-row')) {
    next.remove();
    btn.textContent = 'Detalhes';
    return;
  }
  btn.disabled = true;
  try {
    const e = await api('/errors/' + id);
    const tr = document.createElement('tr');
    tr.className = 'dev-detail-row';
    tr.innerHTML = `<td colspan="7"><div class="dev-detail"><p><strong>Aparelho:</strong> ${esc(e.user_agent || '—')}</p><p><strong>IP:</strong> ${esc(e.ip_address || '—')}</p><p><strong>Rastro (stack):</strong></p><pre>${esc(e.stack || 'Sem rastro registrado.')}</pre><button type="button" class="button button-danger" data-delete="${e.id}">Apagar este erro</button></div></td>`;
    row.after(tr);
    btn.textContent = 'Fechar';
  }
  catch (err) {
    say(err.message);
  }
  finally {
    btn.disabled = false;
  }
}
$('#errors-content').addEventListener('click', async (e) => {
  const detail = e.target.closest('[data-detail]'), del = e.target.closest('[data-delete]');
  if (detail)
    return toggleErrorDetail(detail.dataset.detail, detail);
  if (del) {
    try {
      await api('/errors/' + del.dataset.delete, { method: 'DELETE' });
      await loadErrors();
      say('Erro apagado.');
    }
    catch (err) {
      say(err.message);
    }
  }
});
$('#errors-clear').addEventListener('click', async () => {
  if (!confirm('Apagar toda a lista de erros?'))
    return;
  try {
    await api('/errors', { method: 'DELETE' });
    await loadErrors();
    say('Lista de erros apagada.');
  }
  catch (e) {
    say(e.message);
  }
});
$('#errors-refresh').addEventListener('click', () => loadErrors().catch(e => say(e.message)));
$('#errors-kind').addEventListener('change', () => loadErrors().catch(e => say(e.message)));
$('#errors-search').addEventListener('keydown', e => { if (e.key === 'Enter') loadErrors().catch(err => say(err.message)); });
