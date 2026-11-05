async function loadAccounts() {
  const rows = await api('/admins');
  $('#accounts-list').innerHTML = rows.length
    ? `<table><thead><tr><th>E-mail</th><th>Criada em</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.email)}</td><td>${fmtDate(r.created_at)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted">Nenhuma conta da loja cadastrada.</p>';
  $('#account-select').innerHTML = rows.map(r => `<option value="${r.id}">${esc(r.email)}</option>`).join('');
}
$('#account-create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget, fd = new FormData(f);
  try {
    await api('/admins', { method: 'POST', body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }) });
    f.reset();
    await loadAccounts();
    say('Conta da loja criada.');
  }
  catch (err) {
    say(err.message);
  }
});
$('#account-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget, fd = new FormData(f), label = f.elements.id.selectedOptions[0]?.textContent || 'a conta';
  if (!confirm(`Trocar a senha de ${label}?`))
    return;
  try {
    await api(`/admins/${encodeURIComponent(fd.get('id'))}/password`, { method: 'POST', body: JSON.stringify({ password: fd.get('password') }) });
    f.elements.password.value = '';
    say('Senha alterada e sessões antigas encerradas. Avise a pessoa da loja.');
  }
  catch (err) {
    say(err.message);
  }
});
