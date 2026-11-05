// ===== Aviso sonoro de novo pedido =====
function paintSound() { const b = $('#sound-toggle'); b.textContent = soundOn ? '🔔 Som: ligado' : '🔕 Som: desligado'; b.setAttribute('aria-pressed', String(soundOn)); }
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended')
      audioCtx.resume();
  }
  catch { }
}
function playAlert() {
  unlockAudio();
  if (!audioCtx || audioCtx.state !== 'running')
    return false;
  const t0 = audioCtx.currentTime;
  [[880, 0], [1175, .24], [880, .55], [1175, .79]].forEach(([freq, delay]) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(.0001, t0 + delay); g.gain.exponentialRampToValueAtTime(.35, t0 + delay + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + delay + .2); o.connect(g); g.connect(audioCtx.destination); o.start(t0 + delay); o.stop(t0 + delay + .22); });
  return true;
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio));
$('#sound-toggle').addEventListener('click', () => {
  soundOn = !soundOn;
  localStorage.setItem('acaiAdminSound', soundOn ? '1' : '0');
  paintSound();
  if (soundOn) {
    unlockAudio();
    setTimeout(() => { playAlert(); say('Som de novos pedidos ligado.'); }, 60);
  }
  else
    say('Som de novos pedidos desligado.');
});
function flashTitle(text) {
  const base = document.title.replace(/^🔔 Novo pedido! · /, '');
  if (flashTimer)
    clearInterval(flashTimer);
  let on = true;
  document.title = `${text} · ${base}`;
  flashTimer = setInterval(() => { document.title = on ? base : `${text} · ${base}`; on = !on; }, 1000);
  const stop = () => {
    if (document.hidden)
      return;
    clearInterval(flashTimer);
    flashTimer = null;
    document.title = base;
    document.removeEventListener('visibilitychange', stop);
    window.removeEventListener('focus', stop);
  };
  document.addEventListener('visibilitychange', stop);
  window.addEventListener('focus', stop);
}
function detectNewOrder(s) {
  if (typeof s.latestOrderId !== 'number')
    return;
  if (lastOrderId !== null && s.latestOrderId > lastOrderId) {
    if (typeof autoPrintNewOrders === 'function')
      autoPrintNewOrders(lastOrderId).catch(() => { });
    const played = soundOn ? playAlert() : true;
    say(soundOn && !played ? '🔔 Novo pedido recebido! Clique em qualquer lugar da página para liberar o som.' : '🔔 Novo pedido recebido!');
    if (document.hidden)
      flashTitle('🔔 Novo pedido!');
    if (currentTab === 'orders')
      loadOrders(true).catch(() => { });
  }
  lastOrderId = s.latestOrderId;
}
paintSound();
