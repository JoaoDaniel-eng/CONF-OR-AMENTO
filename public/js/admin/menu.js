async function loadMenu() {
  const d = await api('/menu');
  $('#menu-admin').innerHTML = `<h3>Produtos</h3><div class="admin-option-list">${d.products.map(p => `<form class="product-active-row" data-id="${p.id}"><strong>${esc(p.name)} <small>${p.product_type === 'truffled' ? 'Trufado' : 'Tradicional'}</small></strong><label>Imagem (URL)<input type="url" name="imageUrl" maxlength="1000" value="${esc(p.image_url || '')}" placeholder="https://… ou /images/…"></label><label class="mini-check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Disponível</label><button class="button button-small button-primary">Salvar</button><button type="button" class="button button-small button-danger" data-delete-product="${p.id}">Excluir</button></form>`).join('')}</div><h3>Tamanhos</h3><p class="muted">Desative um tamanho para ocultá-lo temporariamente do cardápio, sem apagar seu preço.</p><div class="admin-option-list">${d.sizes.map(s => `<form class="price-row" data-kind="size" data-id="${s.id}"><span><strong>${esc(s.product_name)} — ${esc(s.name)}</strong></span><label>Preço (R$)<input type="number" min="0" step="0.01" value="${moneyInput(s.price_cents)}" name="price"></label><label class="mini-check"><input type="checkbox" name="active" ${s.active ? 'checked' : ''}> Disponível</label><button class="button button-small button-primary">Salvar</button></form>`).join('')}</div><h3>Acompanhamentos, caldas e adicionais</h3><p class="muted">Desmarque “Disponível” para retirar uma opção do site até que volte ao estoque.</p><div class="admin-option-list">${d.options.map(o => `<form class="price-row" data-kind="option" data-id="${o.id}"><span><strong>${esc(o.name)}</strong><small>${esc(o.category)}</small></span><label>Preço (R$)<input type="number" min="0" step="0.01" value="${moneyInput(o.price_cents)}" name="price"></label><label class="mini-check"><input type="checkbox" name="active" ${o.active ? 'checked' : ''}> Disponível</label><button class="button button-small button-primary">Salvar</button></form>`).join('')}</div>`;
  document.querySelectorAll('.product-active-row').forEach(form => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/menu/products/' + form.dataset.id, { method: 'PATCH', body: JSON.stringify({ active: form.elements.active.checked, imageUrl: form.elements.imageUrl.value.trim() }) });
      say('Disponibilidade do produto atualizada.');
      await loadMenu();
    }
    catch (err) {
      say(err.message);
    }
  }));
  document.querySelectorAll('[data-delete-product]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Excluir permanentemente este produto e seus tamanhos? Pedidos antigos manterão seus registros.'))
      return;
    try {
      await api('/menu/products/' + b.dataset.deleteProduct, { method: 'DELETE' });
      say('Produto excluído.');
      await loadMenu();
    }
    catch (e) {
      say(e.message);
    }
  }));
  document.querySelectorAll('.price-row').forEach(form => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form), price = Math.round(Number(fd.get('price')) * 100);
    try {
      await api(`/menu/${form.dataset.kind === 'size' ? 'sizes' : 'options'}/${form.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ priceCents: price, active: fd.get('active') === 'on' }) });
      say('Preço e disponibilidade salvos.');
      await loadMenu();
    }
    catch (err) {
      say(err.message);
    }
  }));
}
