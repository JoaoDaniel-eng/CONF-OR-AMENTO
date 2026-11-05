// Utilitários, chamada de API, montador do açaí e carrinho.
const $ = s => document.querySelector(s);
const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let store = null, menu = null, cart = [], selectedSize = null, appliedCoupon = null, selectedTruffleProduct = null;
const selected = new Set();
const selectedLayers = new Map();
async function api(path, opts = {}) {
  const token = localStorage.getItem('acaiCustomerToken');
  const r = await fetch('/api' + path, { headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) }, ...opts });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(data.error || 'Não foi possível concluir.');
  return data;
}
// Aviso do montador (limite de acompanhamentos, tamanho não escolhido): aparece junto dos botões, não lá no fim do formulário.
function builderMessage(text) {
  const m = $('#builder-message');
  if (!m)
    return;
  m.textContent = text || '';
  m.classList.toggle('error-message', !!text);
}
// Taxa de entrega do bairro escolhido (centavos) ou null enquanto nenhum bairro foi selecionado.
function selectedZoneFee() { const id = Number($('#zone-select')?.value || 0); const z = id && menu?.zones?.find(x => Number(x.id) === id); return z ? Number(z.fee) : null; }
// Camadas de adicional pago (extras e mousses): 1ª camada = preço normal; cada camada a mais = preço normal − R$ 1,00.
// Ex.: adicional de R$ 4,00 → 1 camada R$ 4,00 · 2 camadas R$ 7,00 · 3 camadas R$ 10,00. O servidor refaz essa conta ao receber o pedido.
const LAYER_DISCOUNT_CENTS = 100, MAX_LAYERS = 20;
const isLayered = o => !!o && (o.category === 'extra' || o.category === 'mousse') && Number(o.price) > 0;
const layerPrice = (price, layers) => { const base = Math.max(0, Number(price) || 0), n = Math.max(1, Math.trunc(Number(layers) || 1)); return base + (n - 1) * Math.max(0, base - LAYER_DISCOUNT_CENTS); };
const layerCountOf = id => Math.min(MAX_LAYERS, Math.max(1, Math.trunc(Number(selectedLayers.get(id)) || 1)));
const layersText = n => Number(n) > 1 ? ` (${n} camadas)` : '';
// Objeto { idDoAdicional: camadas } só com o que tem mais de 1 camada (formato enviado ao servidor e guardado no carrinho).
const layersObject = (ids, source) => Object.fromEntries(ids.map(id => [id, Math.min(MAX_LAYERS, Math.max(1, Math.trunc(Number(source(id)) || 1)))]).filter(([, n]) => n > 1));
// Valor de um adicional dentro do carrinho: opts = lista de adicionais do cardápio, layers = { id: camadas }.
const cartOptionsTotal = (opts, layers = {}) => (opts || []).reduce((n, o) => n + layerPrice(o.price, layers?.[o.id] || 1), 0);
function priceForBuilder() {
  if (!selectedSize)
    return 0;
  return Number(selectedSize.price) + [...selected].reduce((sum, id) => { const o = menu.options.find(x => x.id === id); return sum + (o ? (isLayered(o) ? layerPrice(o.price, layerCountOf(id)) : Number(o.price || 0)) : 0); }, 0);
}
function layersField(o) {
  const n = layerCountOf(o.id);
  return `<label class="layers-field">Camadas<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" data-layers="${o.id}" value="${n}" aria-label="Quantas camadas de ${esc(o.name)}"></label><small class="layers-total" data-layers-total="${o.id}">${brl(layerPrice(o.price, n))}</small>`;
}
function renderOptions(category, target) {
  const opts = menu.options.filter(o => o.category === category);
  $(target).innerHTML = opts.map(o => {
    const pill = `<label class="option-pill ${selected.has(o.id) ? 'chosen' : ''}"><input type="checkbox" data-option="${o.id}" ${selected.has(o.id) ? 'checked' : ''}><span>${esc(o.name)}</span>${Number(o.price) > 0 ? `<small>+ ${brl(o.price)}</small>` : '<small>Grátis</small>'}</label>`;
    return isLayered(o) && selected.has(o.id) ? `<div class="option-row has-layers">${pill}${layersField(o)}</div>` : pill;
  }).join('') || '<p class="muted">Nenhuma opção disponível.</p>';
}
function traditionalProduct() { return menu.products.find(p => p.type !== 'truffled'); }
function renderBuilder() {
  const product = traditionalProduct();
  if (!product) {
    selectedSize = null;
    $('#sizes').innerHTML = '<p class="muted">A categoria de açaís tradicionais não está disponível no momento.</p>';
    ['#toppings', '#syrups', '#extras', '#mousses'].forEach(target => { $(target).innerHTML = '<p class="muted">Opção indisponível.</p>'; });
    $('#topping-counter').textContent = `0/${store.maxFreeToppings}`;
    $('#unit-price').textContent = brl(0);
    return;
  }
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  if (selectedSize && sizes.find(x => x.id === selectedSize.id)?.soldOut)
    selectedSize = null;
  $('#sizes').innerHTML = sizes.length ? sizes.map(s => `<label class="size-card ${selectedSize?.id === s.id ? 'chosen' : ''}${s.soldOut ? ' sold-out' : ''}"><input type="radio" name="size" data-size="${s.id}" ${selectedSize?.id === s.id ? 'checked' : ''}${s.soldOut ? ' disabled' : ''}><span>${esc(s.name)}</span><strong>${s.soldOut ? 'Esgotado' : brl(s.price)}</strong></label>`).join('') : '<p class="muted">Nenhum tamanho tradicional disponível no momento.</p>';
  renderOptions('topping', '#toppings');
  renderOptions('syrup', '#syrups');
  renderOptions('extra', '#extras');
  renderOptions('mousse', '#mousses');
  $('#topping-counter').textContent = `${[...selected].filter(id => menu.options.find(o => o.id === id)?.category === 'topping').length}/${store.maxFreeToppings}`;
  $('#unit-price').textContent = brl(priceForBuilder());
}
// Colher: taxa única por pedido. O valor vem do servidor (/store); 10 centavos é só o padrão antes de carregar.
const spoonPriceCents = () => Number((typeof store !== 'undefined' && store?.spoonPriceCents) ?? 10);
const maxSpoons = () => Number((typeof store !== 'undefined' && store?.maxSpoons) || 10);
const spoonCount = () => { const n = Math.floor(Number($('#spoon-quantity')?.value || 0)); return Number.isFinite(n) ? Math.min(maxSpoons(), Math.max(0, n)) : 0; };
const spoonText = (qty, cents) => Number(qty) > 0 ? `${qty} ${Number(qty) === 1 ? 'colher' : 'colheres'} (${brl(cents)})` : 'Não';
function renderCart() { const count = cart.reduce((n, i) => n + i.quantity, 0), subtotal = cart.reduce((n, i) => n + i.lineTotalCents, 0), comboDiscount = store && count >= store.comboMinItems ? Math.floor(subtotal * store.comboDiscountPercent / 100) : 0, couponDiscount = appliedCoupon?.discountCents || 0; $('#cart-count').textContent = count; $('#cart-count-side').textContent = `${count} ${count === 1 ? 'item' : 'itens'}`; $('#cart-subtotal').textContent = brl(subtotal); const fee = selectedZoneFee(), spoons = cart.length ? spoonCount() : 0, spoon = spoons * spoonPriceCents(), grand = Math.max(0, subtotal - comboDiscount - couponDiscount) + (fee || 0) + spoon; $('#spoon-row').classList.toggle('hidden', spoon <= 0); $('#spoon-fee').textContent = brl(spoon); $('#spoon-price-label').textContent = `(${brl(spoonPriceCents())} cada)`; $('#spoon-label').textContent = spoons > 1 ? `Colheres (${spoons}×)` : 'Colher'; $('#spoon-hint').textContent = spoonCount() > 0 ? `${spoonCount()} ${spoonCount() === 1 ? 'colher' : 'colheres'} · ${brl(spoonCount() * spoonPriceCents())}` : 'Nenhuma colher'; $('#delivery-fee-row').classList.toggle('hidden', fee === null || !cart.length); $('#delivery-fee').textContent = brl(fee || 0); $('#cart-final-label').textContent = fee === null ? 'Total (sem entrega)' : 'Total com entrega'; $('#cart-final-total').textContent = brl(grand); $('#combo-discount-row').classList.toggle('hidden', comboDiscount <= 0); $('#combo-discount').textContent = '- ' + brl(comboDiscount); $('#coupon-discount-row').classList.toggle('hidden', couponDiscount <= 0); $('#coupon-discount').textContent = '- ' + brl(couponDiscount); $('#cart-items').innerHTML = cart.length ? cart.map((item, index) => `<article class="cart-item"><div><strong>${item.quantity}× ${esc(item.product || 'Açaí tradicional')} — ${esc(item.size)}</strong><p>${item.options.length ? item.options.map(o => esc(o.name) + layersText(item.optionLayers?.[o.id])).join(', ') : 'Sem adicionais'}</p><b>${brl(item.lineTotalCents)}</b></div><button class="remove-item" data-remove="${index}" aria-label="Remover item">×</button></article>`).join('') : '<p class="muted">Seu carrinho ainda está vazio.</p>'; $('#mobile-cart-bar').classList.toggle('hidden', count === 0); $('#mobile-cart-count').textContent = `${count} ${count === 1 ? 'item' : 'itens'}`; $('#mobile-cart-total').textContent = brl(grand); saveCart(); }
function updateZones() {
  const z = $('#zone-select');
  z.innerHTML = '<option value="">Selecione seu bairro</option>' + menu.zones.map(x => `<option value="${x.id}">${esc(x.name)} — ${brl(x.fee)}</option>`).join('');
  if (!menu.zones.length)
    z.innerHTML = '<option value="">Nenhum bairro cadastrado</option>';
}
