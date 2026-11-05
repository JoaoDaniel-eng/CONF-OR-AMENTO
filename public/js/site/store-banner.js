// Aviso de funcionamento da loja.
// ===== Aviso de funcionamento da loja =====
function storeClock() {
  const tz = store.timezone || 'America/Sao_Paulo';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const g = t => parts.find(p => p.type === t)?.value;
  let h = Number(g('hour'));
  if (h === 24)
    h = 0;
  return { dow: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[g('weekday')], minutes: h * 60 + Number(g('minute')) };
}
function toMinutes(t) { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); }
function nextOpeningText() {
  const days = store.openingDays || [], { dow, minutes } = storeClock(), names = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  if (days.includes(dow) && minutes < toMinutes(store.openingTime))
    return `hoje às ${store.openingTime}`;
  for (let i = 1; i <= 7; i++) {
    const d = (dow + i) % 7;
    if (days.includes(d))
      return i === 1 ? `amanhã às ${store.openingTime}` : `${names[d]} às ${store.openingTime}`;
  }
  return '';
}
function paintStoreBanner() {
  const el = $('#store-banner');
  if (!store || !el)
    return;
  let text, mode;
  try {
    if (store.openNow) {
      mode = 'open';
      text = `🟢 Aberto agora — recebemos pedidos até às ${store.closingTime}. Quer para mais tarde? Também dá para agendar.`;
    }
    else if (store.manualClosed) {
      mode = 'closed';
      text = '🟣 Pedidos imediatos pausados no momento. Você pode agendar seu pedido para mais tarde.';
    }
    else {
      mode = 'closed';
      const next = nextOpeningText();
      text = `🟣 Estamos fechados agora${next ? ` — abrimos ${next}` : ''} (horário: ${store.openingTime} às ${store.closingTime}). Você pode agendar seu pedido!`;
    }
  }
  catch {
    return;
  }
  $('#store-banner-text').textContent = text;
  el.classList.toggle('is-open', mode === 'open');
  el.classList.toggle('is-closed', mode === 'closed');
  el.classList.remove('hidden');
  $('#store-banner-schedule').classList.remove('hidden');
  $('#store-status').textContent = store.openNow ? '🟢 Aberto para pedidos imediatos · ' + store.openingTime + ' às ' + store.closingTime : '🟣 No momento estamos fechados para pedidos imediatos. Você pode agendar.';
}
$('#store-banner-schedule').addEventListener('click', () => { const t = $('#order-time'); t.value = 'scheduled'; t.dispatchEvent(new Event('change')); $('#pedido').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
setInterval(async () => {
  if (document.hidden || !store)
    return;
  try {
    store = await api('/store');
    paintStoreBanner();
  }
  catch { }
}, 120000);
