async function loadCoupons() {
  const rows = await api('/coupons');
  $('#coupons-list').innerHTML = rows.length ? rows.map(c => `<article class="coupon-row"><div><strong>${esc(c.code)}</strong><small>${c.discount_type === 'percent' ? `${c.discount_value}% de desconto` : `${brl(c.discount_value)} de desconto`} · mínimo ${brl(c.min_subtotal_cents)}</small></div><label class="mini-check"><input type="checkbox" data-coupon-active="${c.id}" ${c.active ? 'checked' : ''}> Ativo</label><button class="button button-small button-danger" data-delete-coupon="${c.id}">Excluir</button></article>`).join('') : '<p class="muted">Nenhum cupom cadastrado.</p>';
  document.querySelectorAll('[data-coupon-active]').forEach(el => el.addEventListener('change', async () => {
    try {
      await api('/coupons/' + el.dataset.couponActive, { method: 'PATCH', body: JSON.stringify({ active: el.checked }) });
      say('Status do cupom atualizado.');
    }
    catch (e) {
      say(e.message);
      el.checked = !el.checked;
    }
  }));
  document.querySelectorAll('[data-delete-coupon]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Excluir este cupom?'))
      return;
    try {
      await api('/coupons/' + b.dataset.deleteCoupon, { method: 'DELETE' });
      say('Cupom excluído.');
      loadCoupons();
    }
    catch (e) {
      say(e.message);
    }
  }));
}
$('#coupon-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget, fd = new FormData(f), type = fd.get('discountType'), raw = Number(fd.get('discountValue')), minimum = Math.round(Number(fd.get('minSubtotal') || 0) * 100);
  try {
    await api('/coupons', { method: 'POST', body: JSON.stringify({ code: fd.get('code'), discountType: type, discountValue: type === 'fixed' ? Math.round(raw * 100) : Math.round(raw), minSubtotalCents: minimum }) });
    f.reset();
    f.elements.minSubtotal.value = '0';
    say('Cupom criado.');
    loadCoupons();
  }
  catch (err) {
    say(err.message);
  }
});


// Visão somente leitura dos cupons pessoais de primeira compra.
let welcomeCouponSearchTimer = null;
async function loadWelcomeCoupons() {
  const list = $('#welcome-coupons-list');
  list.innerHTML = '<p class="muted">Carregando cupons…</p>';
  const params = new URLSearchParams();
  const q = $('#welcome-coupon-search').value.trim();
  const status = $('#welcome-coupon-status').value;
  if (q) params.set('q', q);
  if (status !== 'all') params.set('status', status);
  try {
    const data = await api('/coupons/welcome' + (params.size ? '?' + params : ''));
    const s = data.summary || {};
    $('#welcome-coupon-summary').innerHTML = [
      ['Total gerado', s.total], ['Disponíveis', s.available], ['Já usados', s.used], ['Indisponíveis', s.inactive]
    ].map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${Number(value || 0)}</strong></article>`).join('');
    const labels = { available: 'Disponível', used: 'Já usado', inactive: 'Indisponível' };
    list.innerHTML = data.coupons.length ? data.coupons.map(c => `
      <article class="welcome-admin-row">
        <div class="welcome-admin-customer"><strong>${esc(c.customer.name)}</strong><small>${esc(c.customer.phone)}</small></div>
        <div><code>${esc(c.code)}</code><small>${Number(c.percent)}% de desconto</small></div>
        <span class="coupon-badge coupon-${esc(c.status)}">${labels[c.status] || 'Indisponível'}</span>
        <div class="welcome-admin-order">${c.order ? `Pedido <strong>${esc(c.order.code)}</strong><small>${esc(c.order.status)}</small>` : c.orderDeleted ? '<small>Pedido usado excluído</small>' : '<small>Sem pedido vinculado</small>'}</div>
        <small class="welcome-admin-date">Criado em ${c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—'}</small>
      </article>`).join('') : '<p class="muted">Nenhum cupom encontrado com esses filtros.</p>';
    if (data.truncated) list.insertAdjacentHTML('beforeend', '<p class="muted">Exibindo o limite de resultados. Refine a busca para localizar outros cupons.</p>');
  } catch (e) {
    list.innerHTML = `<p class="form-message">${esc(e.message)}</p>`;
  }
}
$('#welcome-coupon-search').addEventListener('input', () => {
  clearTimeout(welcomeCouponSearchTimer);
  welcomeCouponSearchTimer = setTimeout(loadWelcomeCoupons, 300);
});
$('#welcome-coupon-status').addEventListener('change', loadWelcomeCoupons);
$('#welcome-coupons-refresh').addEventListener('click', loadWelcomeCoupons);
