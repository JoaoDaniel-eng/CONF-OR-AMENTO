// ===== Clientes e redefinição de senha =====
async function loadCustomers() { const q = $('#customer-search').value.trim(); const rows = await api('/customers' + (q ? '?q=' + encodeURIComponent(q) : '')); $('#customers-list').innerHTML = rows.length ? rows.map(c => `<div class="customer-admin-row"><div><strong>${esc(c.name)}</strong><small>${esc(c.phone)} · cliente desde ${new Date(c.created_at).toLocaleDateString('pt-BR')}${c.must_change_password ? ' · aguardando nova senha' : ''}</small></div><button class="button button-small button-outline" type="button" data-reset-customer="${c.id}" data-name="${esc(c.name)}" data-phone="${esc(c.phone)}">Redefinir senha</button></div>`).join('') : '<p class="muted">Nenhum cliente encontrado.</p>'; document.querySelectorAll('[data-reset-customer]').forEach(b => b.addEventListener('click', () => resetCustomerPassword(b.dataset.resetCustomer, b.dataset.name, b.dataset.phone))); }
$('#customer-search-form').addEventListener('submit', e => { e.preventDefault(); $('#temp-password-area').innerHTML = ''; loadCustomers().catch(err => say(err.message)); });
async function resetCustomerPassword(id, name, phone) {
  if (!confirm(`Gerar uma senha temporária para ${name}? A senha atual dessa conta deixará de funcionar.`))
    return;
  try {
    const r = await api(`/customers/${id}/reset-password`, { method: 'POST' });
    const digits = String(r.phone || phone).replace(/\D/g, '');
    const wa = `https://wa.me/${digits.length <= 11 ? '55' + digits : digits}?text=${encodeURIComponent(`Olá, ${r.name}! Sua senha temporária no site do Açaí da Roça é: ${r.temporaryPassword}\nAo entrar, o site vai pedir para você criar uma nova senha.`)}`;
    $('#temp-password-area').innerHTML = `<div class="temp-password-box"><strong>Senha temporária de ${esc(r.name)}</strong><br><code>${esc(r.temporaryPassword)}</code><p class="muted">Anote ou envie agora: esta senha não será mostrada novamente. O cliente criará uma nova senha ao entrar.</p><div class="temp-password-actions"><button class="button button-small button-primary" type="button" id="copy-temp-password">Copiar senha</button><a class="button button-small button-green" target="_blank" rel="noopener noreferrer" href="${wa}">Enviar pelo WhatsApp</a></div></div>`;
    $('#copy-temp-password').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(r.temporaryPassword);
        say('Senha copiada.');
      }
      catch {
        say('Não foi possível copiar automaticamente. Selecione e copie a senha manualmente.');
      }
    });
    $('#temp-password-area').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    loadCustomers().catch(() => { });
  }
  catch (err) {
    say(err.message);
  }
}
