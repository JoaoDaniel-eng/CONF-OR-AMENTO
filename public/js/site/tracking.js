// Acompanhamento, edição e cancelamento do pedido.
const statusNames = { new: 'Recebido', preparing: 'Em preparo', out_for_delivery: 'Saiu para entrega', delivered: 'Entregue', cancelled: 'Cancelado' };
let trackedOrder = null;
// Mesmo texto no site, na mensagem do pedido e na mensagem de edição.
const PIX_NOTICE = '⚠️ Pedido só será preparado após o envio do comprovante do Pix.';
function whatsapp(text, number) {
  const n = String(number || '').replace(/\D/g, '');
  if (n.length < 10) {
    throw new Error('O WhatsApp da loja não está configurado corretamente. Entre em contato com a loja por outro canal.');
  }
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}
// Depois que a loja começa o preparo o pedido trava no site: mudanças e cancelamento passam a ser combinados pelo WhatsApp.
function lockedOrderNote(o) {
  if (o.canEdit || ['delivered', 'cancelled'].includes(o.status))
    return '';
  const n = String(store?.whatsappNumber || '').replace(/\D/g, '');
  const text = `Olá! Sobre o pedido ${o.orderCode} no Açaí da Roça: preciso combinar uma alteração.`;
  const reason = o.status === 'out_for_delivery' ? 'já saiu para entrega' : 'já está sendo preparado';
  return `<div class="order-locked-note" role="alert"><p><strong>Não é possível editar um pedido que ${reason}.</strong> Se precisar de algum ajuste agora, fale direto com a loja pelo WhatsApp.</p>${n.length >= 10 ? `<a class="button button-green" href="https://wa.me/${n}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener noreferrer">Falar com a loja no WhatsApp</a>` : ''}</div>`;
}
// Mensagem para a loja quando o cliente edita: mostra o que tinha antes, o que ficou e as outras mudanças.
function itemLines(items) {
  return (items || []).map(i => `• ${i.quantity}x ${i.product} (${i.size}) — ${brl(i.lineTotalCents)}\n  ${(i.options || []).map(x => x.name + layersText(x.layers)).join(', ') || 'Sem adicionais'}`).join('\n');
}
function editSummary(before, after) {
  const changes = [];
  const diff = (label, a, b) => { if (String(a || '').trim() !== String(b || '').trim()) changes.push(`${label}: ${String(a || '—').trim() || '—'} → ${String(b || '—').trim() || '—'}`); };
  diff('Nome', before.customerName, after.customerName);
  diff('Endereço', before.address, after.address);
  diff('Bairro', before.neighborhood, after.neighborhood);
  diff('Observações', before.notes, after.notes);
  diff('Colher', spoonText(before.spoonQuantity, before.spoonCents), spoonText(after.spoonQuantity, after.spoonCents));
  const pix = after.paymentMethod === 'Pix' ? `\n\nPagamento: Pix${after.totalCents !== before.totalCents ? ` (o valor mudou, o Pix novo é de ${brl(after.totalCents)})` : ''}\n${PIX_NOTICE}` : `\n\nPagamento: ${after.paymentMethod || 'A combinar'}${after.changeFor ? ` — troco para R$ ${after.changeFor}` : ''}`;
  return `✏️ EDIÇÃO do pedido ${after.orderCode} — Açaí da Roça\n\nO cliente alterou o pedido pelo site (ele ainda estava como "Recebido").\n\nANTES:\n${itemLines(before.items)}\nTotal: ${brl(before.totalCents)}\n\nDEPOIS:\n${itemLines(after.items)}\nSubtotal: ${brl(after.subtotalCents)}${after.comboDiscountCents ? `\nDesconto combo: -${brl(after.comboDiscountCents)}` : ''}${after.discountCents ? `\nCupom ${after.couponCode}: -${brl(after.discountCents)}` : ''}\nEntrega (${after.neighborhood}): ${brl(after.deliveryFeeCents)}\nColher: ${spoonText(after.spoonQuantity, after.spoonCents)}\nTOTAL: ${brl(after.totalCents)}${changes.length ? '\n\nOutras mudanças:\n' + changes.map(c => '• ' + c).join('\n') : ''}\n\nNome: ${after.customerName}\nTelefone: ${after.phone}\nEndereço: ${after.address}${pix}`;
}
// Botão fixo para enviar a edição (o navegador pode bloquear a janela do WhatsApp depois de uma espera).
function showEditWhatsappStep(updated, text) {
  const n = String(updated.whatsappNumber || '').replace(/\D/g, '');
  const card = $('#tracking-result .tracking-card');
  if (!card || n.length < 10)
    return null;
  const url = `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
  const box = document.createElement('div');
  box.className = 'order-whatsapp-box';
  box.setAttribute('role', 'status');
  box.innerHTML = '<strong>Alteração salva! Falta avisar a loja</strong><p>Envie a mensagem no WhatsApp para a loja ver o que mudou no seu pedido.</p>';
  const a = document.createElement('a');
  a.className = 'button button-primary button-full';
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = 'Enviar alteração no WhatsApp';
  box.append(a);
  card.prepend(box);
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return url;
}
function renderTracking(o) {
  trackedOrder = o;
  trackDirty = false;
  const result = $('#tracking-result');
  const rawSizes = (menu?.products?.flatMap(p => p.sizes) || []).slice().sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || Number(a.id) - Number(b.id));
  const seenSizeNames = new Set();
  const allSizes = rawSizes.filter(sz => {
    const key = String(sz.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
    if (!key || seenSizeNames.has(key))
      return false;
    seenSizeNames.add(key);
    return true;
  });
  const items = o.items.map((i, index) => {
    const sizeOptions = allSizes.map(sz => `<option value="${sz.id}" ${Number(sz.id) === Number(i.sizeId) ? 'selected' : ''}>${esc(sz.name)} — ${brl(sz.price)}</option>`).join('');
    const optionGroups = [['topping', 'Acompanhamentos'], ['syrup', 'Calda (escolha só 1)'], ['extra', 'Adicionais'], ['mousse', 'Mousses']].map(([category, label]) => {
      const opts = (menu?.options || []).filter(x => x.category === category);
      if (!opts.length)
        return '';
      return `<fieldset class="edit-option-group"><legend>${label}</legend><div class="edit-option-list">${opts.map(opt => { const current = i.options.find(x => Number(x.id) === Number(opt.id)); const box = `<label><input type="checkbox" data-edit-option="${opt.id}" data-edit-category="${category}" data-edit-index="${index}" ${current ? 'checked' : ''}> ${esc(opt.name)}${Number(opt.price) > 0 ? ` (+ ${brl(opt.price)})` : ''}</label>`; return isLayered(opt) ? `<div class="edit-option-row">${box}<label class="layers-field" data-edit-layers-wrap="${opt.id}" data-edit-index="${index}" ${current ? '' : 'hidden'}>Camadas<input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" data-edit-layers="${opt.id}" data-edit-index="${index}" value="${Math.max(1, Number(current?.layers) || 1)}" aria-label="Quantas camadas de ${esc(opt.name)}"></label></div>` : box; }).join('')}</div></fieldset>`;
    }).join('');
    const currentOptions = i.options.map(x => esc(x.name) + layersText(x.layers)).join(', ') || 'Sem acompanhamentos';
    return `<div class="tracking-item tracking-item-edit"><div class="tracking-item-heading"><strong>Item ${index + 1}</strong>${o.canEdit ? `<label class="tracking-qty">Quantidade<input type="number" min="0" max="20" value="${i.quantity}" data-track-qty="${index}"></label>` : `<span>Quantidade: ${i.quantity}</span>`}</div>${o.canEdit ? `<label class="edit-size-label">Tamanho do açaí<select data-edit-size="${index}">${sizeOptions}</select></label>${optionGroups}<p class="muted">Quantidade 0 remove este item do pedido.</p>` : `<p><strong>${esc(i.size)}</strong></p><p>${currentOptions}</p>`}</div>`;
  }).join('');
  result.innerHTML = `<div class="tracking-card"><div class="tracking-top"><div><small>Pedido</small><h3>${esc(o.orderCode)}</h3></div><span class="status status-${o.status}">${statusNames[o.status] || o.status}</span></div><p><strong>Cliente:</strong> ${esc(o.customerName)}</p><p><strong>Entrega:</strong> ${esc(o.address)} — ${esc(o.neighborhood)}</p><p><strong>Pagamento:</strong> ${esc(o.paymentMethod || 'A combinar')}${o.changeFor ? ` — Troco para R$ ${esc(o.changeFor)}` : ''}</p><p><strong>Colher:</strong> ${spoonText(o.spoonQuantity, o.spoonCents)}</p><p class="estimate-note"><strong>Previsão estimada:</strong> ${o.estimatedMinutesMin || 35} a ${o.estimatedMinutesMax || 55} minutos após confirmação.</p><p class="loyalty-note">💜 Programa de fidelidade: ${o.loyaltyBalance || 0} ponto(s) acumulado(s) neste telefone.${o.earnedPoints ? ` Este pedido rendeu ${o.earnedPoints} ponto(s)!` : ''} A cada R$ 1 em pedidos entregues, você ganha 1 ponto.</p><div class="tracking-progress"><span class="${o.status !== 'cancelled' ? 'done' : ''}">Recebido</span><span class="${['preparing', 'out_for_delivery', 'delivered'].includes(o.status) ? 'done' : ''}">Em preparo</span><span class="${['out_for_delivery', 'delivered'].includes(o.status) ? 'done' : ''}">Saiu para entrega</span><span class="${o.status === 'delivered' ? 'done' : ''}">Entregue</span></div>${lockedOrderNote(o)}<h4>Itens do pedido</h4>${o.canEdit ? `<p class="muted">Altere tamanho, calda, acompanhamentos, adicionais, mousses e quantidade. Quantidade 0 remove o item.</p>` : ''}<div class="tracking-items">${items}</div><div class="tracking-total"><span>Total${o.comboDiscountCents ? ` · combo (-${brl(o.comboDiscountCents)})` : ''}${o.discountCents ? ` · cupom ${esc(o.couponCode)} (-${brl(o.discountCents)})` : ''}</span><strong>${brl(o.totalCents)}</strong></div><button class="button button-outline" id="repeat-tracked-order" type="button">Repetir este pedido</button><p id="repeat-order-message" class="form-message" role="status"></p>${o.canEdit ? `<form id="customer-edit-form" class="customer-edit"><h4>Editar dados da entrega</h4><label>Nome<input name="customerName" required value="${esc(o.customerName)}"></label><label>Endereço<input name="address" required value="${esc(o.address)}"></label><label>Bairro<select name="zoneId"><option value="">Manter bairro atual (${esc(o.neighborhood)})</option>${(menu?.zones || []).map(z => `<option value="${z.id}" ${z.name === o.neighborhood ? 'selected' : ''}>${esc(z.name)} — ${brl(z.fee)}</option>`).join('')}</select></label><label>Quantas colheres? (${brl(spoonPriceCents())} cada)<input type="number" name="spoonQuantity" min="0" max="${maxSpoons()}" step="1" value="${Number(o.spoonQuantity) || 0}"></label><label>Observações<textarea name="notes" rows="2">${esc(o.notes || '')}</textarea></label><button class="button button-primary" type="submit">Salvar alterações</button><p class="form-message error-message" id="edit-order-message" role="alert"></p></form><button class="button button-danger" id="cancel-customer-order" type="button">Cancelar pedido</button>` : ''}<p class="form-message error-message" id="tracking-action-message" role="alert"></p></div>`;
  result.classList.remove('hidden');
}
$('#tracking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget), msg = $('#tracking-message');
  msg.textContent = 'Consultando pedido…';
  $('#tracking-result').classList.add('hidden');
  try {
    const o = await api(`/orders/track?code=${encodeURIComponent(fd.get('code'))}&phone=${encodeURIComponent(fd.get('phone'))}`);
    o.lookupPhone = fd.get('phone');
    renderTracking(o);
    msg.textContent = '';
    startLiveTracking();
  }
  catch (err) {
    msg.textContent = err.message;
  }
});
document.addEventListener('input', e => {
  if (!e.target.matches('[data-edit-layers]'))
    return;
  const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
  e.target.value = Number(digits) > MAX_LAYERS ? String(MAX_LAYERS) : digits;
});
document.addEventListener('focusout', e => {
  if (e.target.matches?.('[data-edit-layers]'))
    e.target.value = String(Math.min(MAX_LAYERS, Math.max(1, Number(e.target.value) || 1)));
});
document.addEventListener('change', e => {
  if (e.target.matches('[data-edit-option]')) {
    const wrap = document.querySelector(`[data-edit-layers-wrap="${e.target.dataset.editOption}"][data-edit-index="${e.target.dataset.editIndex}"]`);
    if (wrap)
      wrap.hidden = !e.target.checked;
  }
  if (!e.target.matches('[data-edit-option]'))
    return;
  const checkbox = e.target;
  // Calda: só uma por açaí. Escolher outra desmarca a anterior (igual ao pedido novo).
  if (checkbox.dataset.editCategory === 'syrup' && checkbox.checked) {
    document.querySelectorAll(`[data-edit-index="${checkbox.dataset.editIndex}"][data-edit-category="syrup"]`).forEach(other => {
      if (other !== checkbox)
        other.checked = false;
    });
    return;
  }
  if (checkbox.dataset.editCategory !== 'topping' || !checkbox.checked)
    return;
  const index = checkbox.dataset.editIndex;
  const checked = document.querySelectorAll(`[data-edit-index="${index}"][data-edit-category="topping"]:checked`).length;
  const limit = Number(store?.maxFreeToppings || 5);
  if (checked > limit) {
    checkbox.checked = false;
    const msg = $('#edit-order-message') || $('#tracking-action-message');
    if (msg) {
      msg.textContent = `Você pode escolher no máximo ${limit} acompanhamentos por açaí.`;
      msg.classList.add('error-message');
    }
  }
});
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'customer-edit-form')
    return;
  e.preventDefault();
  if (!trackedOrder)
    return;
  const fd = new FormData(e.target), msg = $('#edit-order-message');
  msg.textContent = 'Salvando alterações…';
  const quantities = [...document.querySelectorAll('[data-track-qty]')].map(el => ({ index: Number(el.dataset.trackQty), quantity: Number(el.value), sizeId: Number(document.querySelector(`[data-edit-size="${el.dataset.trackQty}"]`)?.value), optionIds: [...document.querySelectorAll(`[data-edit-index="${el.dataset.trackQty}"][data-edit-option]:checked`)].map(x => Number(x.dataset.editOption)), optionLayers: Object.fromEntries([...document.querySelectorAll(`[data-edit-index="${el.dataset.trackQty}"][data-edit-option]:checked`)].map(x => [Number(x.dataset.editOption), Math.min(MAX_LAYERS, Math.max(1, Number(document.querySelector(`[data-edit-layers="${x.dataset.editOption}"][data-edit-index="${el.dataset.trackQty}"]`)?.value) || 1))]).filter(([, n]) => n > 1)) })).filter(x => x.quantity > 0);
  if (!quantities.length) {
    msg.textContent = 'O pedido precisa ter pelo menos um item.';
    return;
  }
  const before = trackedOrder;
  try {
    const updated = await api(`/orders/${trackedOrder.orderCode}/customer`, { method: 'PATCH', body: JSON.stringify({ phone: trackedOrder.lookupPhone, customerName: fd.get('customerName'), address: fd.get('address'), zoneId: fd.get('zoneId') ? Number(fd.get('zoneId')) : undefined, notes: fd.get('notes'), spoonQuantity: Math.min(maxSpoons(), Math.max(0, Math.floor(Number(fd.get('spoonQuantity')) || 0))), items: quantities }) });
    updated.lookupPhone = trackedOrder.lookupPhone;
    renderTracking(updated);
    if (updated.pix) {
      const card = $('#tracking-result .tracking-card');
      const note = document.createElement('p');
      note.className = 'estimate-note';
      note.textContent = 'O valor do pedido mudou: use o Pix abaixo (o código anterior ficou com o valor antigo).';
      card.append(note, pixBlock(updated.pix));
    }
    const editText = editSummary(before, updated);
    const waUrl = showEditWhatsappStep(updated, editText);
    if (waUrl)
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    $('#tracking-action-message').textContent = 'Alteração registrada! Envie a mensagem no WhatsApp para avisar a loja.';
  }
  catch (err) {
    msg.textContent = err.message;
    // Se a loja começou o preparo enquanto o cliente editava, a tela passa a mostrar o pedido travado.
    try {
      const fresh = await api(`/orders/track?code=${encodeURIComponent(before.orderCode)}&phone=${encodeURIComponent(before.lookupPhone)}`);
      if (!fresh.canEdit) {
        fresh.lookupPhone = before.lookupPhone;
        renderTracking(fresh);
        $('#tracking-action-message').textContent = err.message;
      }
    }
    catch { }
  }
});
document.addEventListener('click', async (e) => {
  if (e.target.id === 'repeat-tracked-order' && trackedOrder) {
    const message = $('#repeat-order-message');
    const repeated = [];
    for (const item of trackedOrder.items || []) {
      const size = menu?.products?.flatMap(p => p.sizes || []).find(s => Number(s.id) === Number(item.sizeId));
      if (!size)
        continue;
      const options = (item.options || []).map(old => menu.options.find(o => Number(o.id) === Number(old.id) && o.active !== false)).filter(Boolean);
      const optionLayers = Object.fromEntries(options.filter(isLayered).map(o => [o.id, Math.min(MAX_LAYERS, Math.max(1, Number((item.options || []).find(old => Number(old.id) === Number(o.id))?.layers) || 1))]).filter(([, n]) => n > 1));
      const unit = Number(size.price) + cartOptionsTotal(options, optionLayers);
      repeated.push({ sizeId: size.id, size: size.name, quantity: item.quantity, optionIds: options.map(o => o.id), optionLayers, options, unitPriceCents: unit, lineTotalCents: unit * item.quantity });
    }
    if (!repeated.length) {
      message.textContent = 'Os itens deste pedido não estão mais disponíveis no cardápio.';
      return;
    }
    cart.push(...repeated);
    appliedCoupon = null;
    $('#coupon-code').value = '';
    $('#coupon-message').textContent = '';
    renderCart();
    message.textContent = repeated.length < (trackedOrder.items || []).length ? 'Alguns itens não estão mais disponíveis e não foram adicionados.' : 'Itens adicionados novamente ao carrinho!';
    $('#pedido').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (e.target.id !== 'cancel-customer-order' || !trackedOrder)
    return;
  if (!confirm('Tem certeza de que deseja cancelar este pedido?'))
    return;
  const msg = $('#tracking-action-message');
  msg.textContent = 'Cancelando pedido…';
  try {
    const r = await api(`/orders/${trackedOrder.orderCode}/cancel`, { method: 'POST', body: JSON.stringify({ phone: trackedOrder.lookupPhone }) });
    trackedOrder.status = 'cancelled';
    trackedOrder.canEdit = false;
    trackedOrder.canCancel = false;
    renderTracking(trackedOrder);
    whatsapp(`Olá! Solicito o CANCELAMENTO do pedido ${r.order_code} no Açaí da Roça. O pedido foi cancelado pelo site.`, r.whatsappNumber);
    $('#tracking-action-message').textContent = 'Pedido cancelado no site. Envie a mensagem no WhatsApp para avisar a loja.';
    loadCustomerOrdersIfSignedIn();
  }
  catch (err) {
    msg.textContent = err.message;
  }
});
