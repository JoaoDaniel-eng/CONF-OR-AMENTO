// Carregamento do cardápio, carrinho, cupom, envio do pedido, passo do WhatsApp e Pix.
async function load() {
  try {
    [store, menu] = await Promise.all([api('/store'), api('/menu')]);
    $('#store-status').textContent = store.openNow ? '🟢 Aberto para pedidos imediatos · ' + store.openingTime + ' às ' + store.closingTime : '🟣 No momento estamos fechados para pedidos imediatos. Você pode agendar.';
    paintStoreBanner();
    $('#delivery-estimate').textContent = `Previsão estimada: ${store.estimatedMinutesMin} a ${store.estimatedMinutesMax} minutos após a confirmação.`;
    if (!menu.products.length)
      throw new Error('O cardápio está indisponível.');
    const traditional = traditionalProduct();
    const truffled = menu.products.filter(p => p.type === 'truffled');
    const hasTraditional = Boolean(traditional && Array.isArray(traditional.sizes) && traditional.sizes.length);
    const hasTruffled = truffled.some(p => Array.isArray(p.sizes) && p.sizes.length);
    if (!hasTraditional && !hasTruffled)
      throw new Error('Nenhum produto com tamanho disponível foi encontrado.');
    selectedSize = hasTraditional ? traditional.sizes.find(size => !size.soldOut) || traditional.sizes[0] : null;
    $('#menu-status').classList.add('hidden');
    $('#builder').classList.remove('hidden');
    renderBuilder();
    renderTruffledMenu();
    const traditionalTab = $('[data-menu-category="traditional"]');
    const truffledTab = $('[data-menu-category="truffled"]');
    traditionalTab.classList.toggle('hidden', !hasTraditional);
    truffledTab.classList.toggle('hidden', !hasTruffled);
    $('#menu-category-tabs').classList.toggle('hidden', !(hasTraditional && hasTruffled));
    $('.builder-main').classList.toggle('hidden', !hasTraditional);
    $('#truffled-menu').classList.toggle('hidden', hasTraditional || !hasTruffled);
    if (!hasTraditional && hasTruffled) {
      truffledTab.classList.add('button-primary');
      truffledTab.classList.remove('button-outline');
      truffledTab.setAttribute('aria-selected', 'true');
      traditionalTab.setAttribute('aria-selected', 'false');
    }
    updateZones();
    restoreSavedDetails();
    restoreCart();
    renderCart();
    renderFavorites();
  }
  catch (e) {
    $('#menu-status').textContent = e.message + ' Confira a configuração do banco de dados e tente novamente.';
    $('#menu-status').classList.add('error-message');
  }
  await loadReviews();
}
function renderTruffledMenu() {
  const products = menu.products.filter(p => p.type === 'truffled' && Array.isArray(p.sizes) && p.sizes.length);
  $('#truffled-flavors').innerHTML = products.map(p => `<button type="button" class="truffled-flavor-card ${selectedTruffleProduct?.id === p.id ? 'chosen' : ''}" data-truffle-flavor="${p.id}">${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : ''}<strong>${esc(p.name)}</strong><span>Escolher tamanho →</span></button>`).join('');
  if (!products.length) $('#truffled-flavors').innerHTML = '<p class="muted">Nenhum sabor trufado disponível no momento.</p>';
}
function renderTruffledSizes() {
  const panel = $('#truffled-sizes');
  if (!selectedTruffleProduct || !Array.isArray(selectedTruffleProduct.sizes) || !selectedTruffleProduct.sizes.length) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  panel.innerHTML = `<h3>${esc(selectedTruffleProduct.name)}</h3><p class="muted">Agora escolha o tamanho:</p><div class="size-grid">${selectedTruffleProduct.sizes.map(size => `<button type="button" class="size-card ${size.soldOut ? 'sold-out' : ''}" data-truffle-size="${size.id}" ${size.soldOut ? 'disabled' : ''}><span>${esc(size.name)}</span><strong>${size.soldOut ? 'Esgotado' : brl(size.price)}</strong></button>`).join('')}</div>`;
}
document.addEventListener('click', e => {
  const category = e.target.closest('[data-menu-category]');
  if (category) {
    const traditional = category.dataset.menuCategory === 'traditional';
    document.querySelectorAll('[data-menu-category]').forEach(b => {
      const active = b === category;
      b.classList.toggle('button-primary', active);
      b.classList.toggle('button-outline', !active);
      b.setAttribute('aria-selected', String(active));
    });
    $('.builder-main').classList.toggle('hidden', !traditional);
    $('#truffled-menu').classList.toggle('hidden', traditional);
    if (!traditional) renderTruffledMenu();
    return;
  }
  const flavor = e.target.closest('[data-truffle-flavor]');
  if (flavor) {
    selectedTruffleProduct = menu.products.find(p => p.id === Number(flavor.dataset.truffleFlavor));
    renderTruffledMenu(); renderTruffledSizes(); return;
  }
  const truffleSize = e.target.closest('[data-truffle-size]');
  if (truffleSize && selectedTruffleProduct) {
    const size = selectedTruffleProduct.sizes.find(x => x.id === Number(truffleSize.dataset.truffleSize));
    if (!size || size.soldOut) return;
    const quantity = Number($('#builder-quantity')?.value || 1);
    cart.push({ sizeId: size.id, product: selectedTruffleProduct.name, size: size.name, quantity, optionIds: [], options: [], unitPriceCents: Number(size.price), lineTotalCents: Number(size.price) * quantity });
    appliedCoupon = null; $('#coupon-message').textContent = ''; renderCart();
    $('#pedido').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
document.addEventListener('change', e => {
  if (e.target.matches('[data-size]')) {
    selectedSize = traditionalProduct().sizes.find(s => s.id === Number(e.target.dataset.size));
    renderBuilder();
  }
  if (e.target.matches('[data-option]')) {
    builderMessage('');
    const id = Number(e.target.dataset.option), opt = menu.options.find(o => o.id === id);
    if (e.target.checked) {
      if (opt.category === 'syrup') {
        menu.options.filter(o => o.category === 'syrup').forEach(o => selected.delete(o.id));
      }
      if (opt.category === 'topping' && [...selected].filter(i => menu.options.find(o => o.id === i)?.category === 'topping').length >= store.maxFreeToppings) {
        e.target.checked = false;
        builderMessage(`Você pode escolher até ${store.maxFreeToppings} acompanhamentos grátis.`);
        return;
      }
      selected.add(id);
      if (isLayered(opt))
        selectedLayers.set(id, 1);
    }
    else {
      selected.delete(id);
      selectedLayers.delete(id);
    }
    renderBuilder();
  }
});
// Campo de camadas (só números). Enquanto digita, atualiza os preços sem redesenhar a tela (para não perder o foco).
document.addEventListener('input', e => {
  if (!e.target.matches('[data-layers]'))
    return;
  const id = Number(e.target.dataset.layers), opt = menu.options.find(o => o.id === id);
  const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
  if (digits !== e.target.value)
    e.target.value = digits;
  let n = Number(digits);
  if (n > MAX_LAYERS) {
    n = MAX_LAYERS;
    e.target.value = String(n);
    builderMessage(`O máximo é ${MAX_LAYERS} camadas por adicional.`);
  }
  else
    builderMessage('');
  // Campo vazio ou 0 conta como 1 camada até o cliente sair do campo.
  selectedLayers.set(id, Math.max(1, n));
  const total = document.querySelector(`[data-layers-total="${id}"]`);
  if (total && opt)
    total.textContent = brl(layerPrice(opt.price, layerCountOf(id)));
  $('#unit-price').textContent = brl(priceForBuilder());
});
document.addEventListener('focusout', e => {
  if (e.target.matches?.('[data-layers]'))
    e.target.value = String(layerCountOf(Number(e.target.dataset.layers)));
});
document.addEventListener('click', e => {
  const remove = e.target.closest('[data-remove]');
  if (remove) {
    cart.splice(Number(remove.dataset.remove), 1);
    appliedCoupon = null;
    $('#coupon-message').textContent = '';
    renderCart();
  }
});
$('#add-cart').addEventListener('click', () => {
  if (!selectedSize) {
    builderMessage('Escolha um tamanho antes de adicionar ao pedido.');
    return;
  }
  builderMessage('');
  const opts = [...selected].map(id => menu.options.find(o => o.id === id)).filter(Boolean);
  const unit = priceForBuilder(), quantity = Number($('#builder-quantity').value || 1);
  const optionLayers = layersObject(opts.filter(isLayered).map(o => o.id), layerCountOf);
  cart.push({ sizeId: selectedSize.id, product: traditionalProduct().name, size: selectedSize.name, quantity, optionIds: opts.map(o => o.id), optionLayers, options: opts, unitPriceCents: unit, lineTotalCents: unit * quantity });
  appliedCoupon = null;
  $('#coupon-message').textContent = '';
  selected.clear();
  selectedLayers.clear();
  renderBuilder();
  renderCart();
  $('#pedido').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#zone-select').addEventListener('change', renderCart);
// Colheres: botões − / + e campo numérico (de 0 até store.maxSpoons), R$ 0,10 cada.
const setSpoons = n => { $('#spoon-quantity').value = String(Math.min(maxSpoons(), Math.max(0, n))); renderCart(); };
$('#spoon-minus').addEventListener('click', () => setSpoons(spoonCount() - 1));
$('#spoon-plus').addEventListener('click', () => setSpoons(spoonCount() + 1));
$('#spoon-quantity').addEventListener('input', renderCart);
$('#spoon-quantity').addEventListener('change', () => setSpoons(spoonCount()));
$('#payment-method').addEventListener('change', e => {
  const cash = e.target.value === 'Dinheiro';
  $('#cash-change-fields').classList.toggle('hidden', !cash);
  $('#needs-change').required = cash;
  if (!cash) {
    $('#needs-change').value = '';
    $('#change-for').value = '';
    $('#change-for-label').classList.add('hidden');
    $('#change-for').required = false;
  }
});
$('#needs-change').addEventListener('change', e => {
  const needs = e.target.value === 'yes';
  $('#change-for-label').classList.toggle('hidden', !needs);
  $('#change-for').required = needs;
  if (!needs)
    $('#change-for').value = '';
});
// Agendamento: o servidor entrega só os dias e horários em que a loja abre (aba Funcionamento do painel).
let scheduleDays = [];
function paintScheduleTimes() {
  const day = scheduleDays.find(d => d.date === $('#schedule-day').value), time = $('#schedule-time');
  time.innerHTML = (day ? day.slots : []).map(s => `<option value="${esc(s.value)}">${esc(s.time)}</option>`).join('');
  $('#scheduled-for').value = time.value || '';
}
async function loadScheduleSlots() {
  const dayEl = $('#schedule-day'), timeEl = $('#schedule-time'), hint = $('#schedule-hint');
  hint.textContent = 'Carregando horários…';
  dayEl.disabled = timeEl.disabled = true;
  dayEl.required = timeEl.required = false;
  $('#scheduled-for').value = '';
  try {
    const data = await api('/schedule-slots');
    scheduleDays = data.days || [];
    dayEl.innerHTML = scheduleDays.map(d => `<option value="${esc(d.date)}">${esc(d.label)}</option>`).join('');
    if (!scheduleDays.length) {
      timeEl.innerHTML = '';
      hint.textContent = 'Não há horários disponíveis para agendar no momento. Fale com a loja pelo WhatsApp.';
      return;
    }
    hint.textContent = `Horários disponíveis dentro do funcionamento da loja (${data.openingTime} às ${data.closingTime}).`;
    dayEl.disabled = timeEl.disabled = false;
    dayEl.required = timeEl.required = true;
    paintScheduleTimes();
  }
  catch (err) {
    scheduleDays = [];
    dayEl.innerHTML = timeEl.innerHTML = '';
    hint.textContent = 'Não foi possível carregar os horários. Verifique a conexão e tente novamente.';
  }
}
$('#schedule-day').addEventListener('change', paintScheduleTimes);
$('#schedule-time').addEventListener('change', () => { $('#scheduled-for').value = $('#schedule-time').value || ''; });
$('#order-time').addEventListener('change', e => {
  const scheduled = e.target.value === 'scheduled';
  $('#schedule-label').classList.toggle('hidden', !scheduled);
  if (scheduled)
    loadScheduleSlots();
  else
    $('#scheduled-for').value = '';
});
$('#apply-coupon').addEventListener('click', async () => {
  const code = $('#coupon-code').value.trim().toUpperCase(), msg = $('#coupon-message'), subtotal = cart.reduce((sum, i) => sum + i.lineTotalCents, 0), itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  msg.textContent = '';
  if (!code) {
    msg.textContent = 'Digite o código do cupom.';
    return;
  }
  if (!cart.length) {
    msg.textContent = 'Adicione itens ao carrinho antes de aplicar o cupom.';
    return;
  }
  try {
    const c = await api(`/coupons/validate?code=${encodeURIComponent(code)}&subtotalCents=${subtotal}&itemCount=${itemCount}`);
    appliedCoupon = c;
    msg.textContent = `Cupom aplicado! Desconto de ${brl(c.discountCents)}.`;
    msg.classList.remove('error-message');
    msg.classList.add('is-success');
    renderCart();
  }
  catch (err) {
    appliedCoupon = null;
    msg.textContent = err.message;
    msg.classList.remove('is-success');
    msg.classList.add('error-message');
  }
});
$('#coupon-code').addEventListener('input', () => { appliedCoupon = null; $('#coupon-message').textContent = ''; renderCart(); });
$('#checkout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const msg = $('#checkout-message');
  msg.textContent = '';
  document.getElementById('order-whatsapp-box')?.remove();
  if (!cart.length) {
    msg.textContent = 'Adicione pelo menos um açaí ao pedido.';
    return;
  }
  if ($('#order-time').value === 'scheduled' && !$('#scheduled-for').value) {
    msg.textContent = scheduleDays.length ? 'Escolha o dia e o horário do agendamento.' : 'Não há horários disponíveis para agendar agora. Escolha outra opção ou fale com a loja pelo WhatsApp.';
    return;
  }
  const fd = new FormData(form);
  const payload = { customerName: fd.get('customerName'), phone: fd.get('phone'), address: fd.get('address'), zoneId: Number(fd.get('zoneId')), notes: fd.get('notes'), paymentMethod: fd.get('paymentMethod'), needsChange: fd.get('needsChange') || 'no', changeFor: fd.get('changeFor') || '', spoonQuantity: spoonCount(), scheduledFor: fd.get('orderTime') === 'scheduled' ? fd.get('scheduledFor') : null, couponCode: appliedCoupon?.code || '', items: cart.map(i => ({ sizeId: i.sizeId, quantity: i.quantity, optionIds: i.optionIds, optionLayers: i.optionLayers || {} })) };
  const button = $('#submit-order');
  button.disabled = true;
  button.textContent = 'Registrando pedido…';
  try {
    const order = await api('/orders', { method: 'POST', body: JSON.stringify(payload) });
    const lines = order.items.map(i => `• ${i.quantity}x ${i.product} (${i.size})\n  ${i.options.map(o => o.name + layersText(o.layers)).join(', ') || 'Sem adicionais'} — ${brl(i.lineTotalCents)}`).join('\n');
    const scheduled = order.scheduledFor ? `\nAgendamento: ${new Date(order.scheduledFor).toLocaleString('pt-BR')}` : '\nEntrega: assim que possível';
    const text = `Olá! Quero confirmar o pedido ${order.orderCode} no Açaí da Roça.\n\n${lines}\n\nSubtotal: ${brl(order.subtotalCents)}${order.comboDiscountCents ? `\nDesconto combo: -${brl(order.comboDiscountCents)}` : ''}${order.discountCents ? `\nCupom ${order.couponCode}: -${brl(order.discountCents)}` : ''}\nEntrega (${order.neighborhood}): ${brl(order.deliveryFeeCents)}\nColher: ${spoonText(order.spoonQuantity, order.spoonCents)}\nTOTAL: ${brl(order.totalCents)}\nPrevisão estimada: ${order.estimatedMinutesMin} a ${order.estimatedMinutesMax} minutos\n\nNome: ${order.customerName}\nTelefone: ${order.phone}\nEndereço: ${order.address}
Forma de pagamento: ${order.paymentMethod}${order.pix ? '\nValor do Pix: ' + brl(order.pix.amountCents) : ''}${order.changeFor ? `\nTroco para: R$ ${order.changeFor}` : ''}${scheduled}${order.notes ? '\nObservações: ' + order.notes : ''}\n\nO pedido foi registrado pelo site.${order.pix ? '\nO código Pix está disponível no site, na tela do pedido. Após pagar, envie o comprovante nesta conversa.\n' + PIX_NOTICE : ''}`;
    msg.textContent = `Pedido ${order.orderCode} registrado! Agora envie no WhatsApp para a loja confirmar (botão abaixo). Guarde esse código para acompanhar, editar ou cancelar seu pedido na seção “Acompanhe seu pedido”.`;
    $('#tracking-form [name=code]').value = order.orderCode;
    $('#tracking-form [name=phone]').value = order.phone;
    if ($('#save-customer-details').checked) {
      localStorage.setItem('acaiCustomerDetails', JSON.stringify({ customerName: order.customerName, phone: order.phone, address: order.address, zoneId: fd.get('zoneId') }));
    }
    else {
      localStorage.removeItem('acaiCustomerDetails');
    }
    if (localStorage.getItem('acaiCustomerToken'))
      loadCustomerAccount();
    cart = [];
    appliedCoupon = null;
    $('#coupon-code').value = '';
    $('#coupon-message').textContent = '';
    renderCart();
    const waUrl = `https://wa.me/${String(order.whatsappNumber || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
    showWhatsappStep(msg, order, waUrl);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    form.reset();
    renderCart();
    $('#schedule-label').classList.add('hidden');
  }
  catch (err) {
    msg.textContent = err.message;
  }
  finally {
    button.disabled = false;
    button.textContent = 'Fazer pedido';
  }
});
// O navegador costuma bloquear janelas abertas depois de uma espera (iPhone principalmente). Por isso o botão fica na tela
// até o cliente enviar a mensagem: o pedido só é confirmado pela loja depois disso.
function showWhatsappStep(anchor, order, url) {
  document.getElementById('order-whatsapp-box')?.remove();
  const box = document.createElement('div');
  box.id = 'order-whatsapp-box';
  box.className = 'order-whatsapp-box';
  box.setAttribute('role', 'status');
  const t = document.createElement('strong');
  t.textContent = `Falta só um passo: envie o pedido ${order.orderCode} no WhatsApp`;
  const p = document.createElement('p');
  p.textContent = order.pix ? 'O código Pix copia e cola está nesta página, logo abaixo. Use o botão para copiar, pague pelo app do seu banco e envie o comprovante nesta conversa do WhatsApp. ' + PIX_NOTICE : 'O pedido só é confirmado pela loja depois que você enviar a mensagem. Se o WhatsApp não abriu sozinho, toque no botão abaixo.';
  const a = document.createElement('a');
  a.className = 'button button-primary button-full';
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = 'Enviar pedido no WhatsApp';
  box.append(t, p);
  if (order.pix) box.append(pixBlock(order.pix));
  box.append(a);
  anchor.insertAdjacentElement('afterend', box);
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
// Bloco "Pague com Pix": valor, código copia e cola e botão de copiar.
function pixBlock(pix) {
  const wrap = document.createElement('div');
  wrap.className = 'pix-block';
  const h = document.createElement('strong');
  h.textContent = `Pague com Pix: ${brl(pix.amountCents)}`;
  const hint = document.createElement('small');
  hint.textContent = `Recebedor: ${pix.name} · Chave: ${pix.key}`;
  const code = document.createElement('textarea');
  code.readOnly = true;
  code.rows = 3;
  code.value = pix.payload;
  code.setAttribute('aria-label', 'Código Pix copia e cola');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'button button-outline button-full';
  btn.textContent = 'Copiar código Pix';
  btn.addEventListener('click', async () => {
    const payload = String(pix.payload || '').trim();
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(payload);
        copied = true;
      }
    } catch { /* tenta alternativa compatível */ }
    if (!copied) {
      code.focus();
      code.select();
      code.setSelectionRange(0, code.value.length);
      try { copied = document.execCommand('copy'); } catch { copied = false; }
    }
    btn.textContent = copied ? '✓ Código copiado! Cole no app do banco' : 'Selecione e copie o código acima';
    setTimeout(() => { btn.textContent = 'Copiar código Pix'; }, 4000);
  });
  wrap.append(h, hint, code, btn);
  return wrap;
}

// "Quero esse" na galeria: leva ao cardápio e anota o sabor escolhido nas observações do pedido.
document.addEventListener('click', e => {
  const btn = e.target.closest?.('.gallery-order');
  if (!btn)
    return;
  const flavor = btn.dataset.flavor || '';
  const notes = document.querySelector('#checkout-form [name=notes]');
  if (notes && flavor) {
    const rest = notes.value.split('\n').filter(l => !l.startsWith('Sabor escolhido:')).join('\n').trim();
    notes.value = `Sabor escolhido: ${flavor}${rest ? '\n' + rest : ''}`;
  }
  const hint = document.getElementById('builder-message');
  if (hint && flavor) {
    hint.textContent = `Anotamos que você quer o ${flavor}. Escolha o tamanho e os acompanhamentos abaixo.`;
    hint.classList.remove('error-message');
  }
});
