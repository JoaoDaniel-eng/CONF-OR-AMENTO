// Favoritos.
// ===== Favoritos =====
var favorites = [], favoritesLoaded = false;
async function loadFavorites() {
  try {
    const r = await api('/customers/me/favorites');
    favorites = r.favorites || [];
    favoritesLoaded = true;
    renderFavorites();
  }
  catch {
    $('#favorites-list').innerHTML = '<p class="muted">Não foi possível carregar seus favoritos agora.</p>';
  }
}
function renderFavorites() {
  const list = $('#favorites-list');
  if (!list || !favoritesLoaded)
    return;
  if (!favorites.length) {
    list.innerHTML = '<p class="muted">Você ainda não tem favoritos. Monte um açaí no cardápio e toque em “Salvar este açaí como favorito”.</p>';
    return;
  }
  if (!menu) {
    list.innerHTML = '<p class="muted">Carregando cardápio…</p>';
    return;
  }
  list.innerHTML = favorites.map(f => { const item = buildCartItem(f.sizeId, f.optionIds, 1); const missing = !item || item.optionIds.length < (f.optionIds || []).length; return `<article class="favorite-card"><div><strong>${esc(f.name)}</strong><p class="muted">${item ? esc(item.size) + (item.options.length ? ' — ' + item.options.map(o => esc(o.name)).join(', ') : ' — sem adicionais') : 'Este tamanho não está mais disponível.'}</p>${missing && item ? '<small class="error-message">Algumas opções não estão mais disponíveis.</small>' : ''}${item ? `<b>${brl(item.unitPriceCents)}</b>` : ''}</div><div class="favorite-actions"><button type="button" class="button button-green button-small" data-fav-add="${f.id}" ${item ? '' : 'disabled'}>Adicionar ao pedido</button><button type="button" class="button button-outline button-small" data-fav-del="${f.id}" aria-label="Remover favorito ${esc(f.name)}">Remover</button></div></article>`; }).join('');
}
document.addEventListener('click', async (e) => {
  const add = e.target.closest('[data-fav-add]'), del = e.target.closest('[data-fav-del]');
  if (add) {
    const f = favorites.find(x => String(x.id) === add.dataset.favAdd);
    const item = f && buildCartItem(f.sizeId, f.optionIds, 1);
    if (!item)
      return;
    cart.push(item);
    appliedCoupon = null;
    $('#coupon-message').textContent = '';
    renderCart();
    customerMessage('#favorites-message', `“${f.name}” foi adicionado ao seu pedido.`);
    $('#pedido').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (del) {
    if (!confirm('Remover este favorito?'))
      return;
    try {
      await api('/customers/me/favorites/' + del.dataset.favDel, { method: 'DELETE' });
      favorites = favorites.filter(x => String(x.id) !== del.dataset.favDel);
      renderFavorites();
    }
    catch (err) {
      customerMessage('#favorites-message', err.message, true);
    }
  }
});
$('#favorite-open').addEventListener('click', () => {
  const m = $('#favorite-builder-message');
  m.textContent = '';
  if (!selectedSize) {
    m.textContent = 'Escolha um tamanho primeiro.';
    return;
  }
  $('#favorite-save-row').classList.remove('hidden');
  $('#favorite-open').classList.add('hidden');
  $('#favorite-name').focus();
});
function closeFavoriteRow() { $('#favorite-save-row').classList.add('hidden'); $('#favorite-open').classList.remove('hidden'); $('#favorite-name').value = ''; }
$('#favorite-cancel').addEventListener('click', closeFavoriteRow);
$('#favorite-save').addEventListener('click', async () => {
  const m = $('#favorite-builder-message'), name = $('#favorite-name').value.trim();
  m.textContent = '';
  if (name.length < 2) {
    m.textContent = 'Dê um nome ao favorito (mínimo 2 letras).';
    return;
  }
  try {
    const r = await api('/customers/me/favorites', { method: 'POST', body: JSON.stringify({ name, sizeId: selectedSize.id, optionIds: [...selected] }) });
    favorites.unshift(r.favorite);
    favoritesLoaded = true;
    renderFavorites();
    closeFavoriteRow();
    m.textContent = 'Favorito salvo! Você o encontra em Minha conta → Meus favoritos.';
  }
  catch (err) {
    m.textContent = err.message;
  }
});
$('#favorite-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    $('#favorite-save').click();
  }
});
