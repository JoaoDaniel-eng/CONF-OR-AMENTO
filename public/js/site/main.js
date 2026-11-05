// Inicialização do site.
// Roda por último: aqui tudo já foi definido pelos outros arquivos.
if (localStorage.getItem('acaiCustomerToken'))
  loadCustomerAccount();
else {
  setAccountView(false);
  applyAuthUI(null);
}
$('#year').textContent = new Date().getFullYear();
load();
applyTheme(currentThemePref(), false);
applyFontScale(currentFontScale(), false);

// Seções recolhíveis da conta: cada painel mantém seu próprio estado.
document.addEventListener('click', e => {
  const trigger = e.target.closest('.accordion-trigger');
  if (!trigger) return;
  const content = document.getElementById(trigger.getAttribute('aria-controls'));
  const expanded = trigger.getAttribute('aria-expanded') === 'true';
  window.clearTimeout(content._accordionTimer);
  trigger.setAttribute('aria-expanded', String(!expanded));
  const panel = trigger.closest('.account-accordion');
  panel?.classList.toggle('is-expanded', !expanded);
  if (expanded) {
    content.style.maxHeight = `${content.scrollHeight}px`;
    requestAnimationFrame(() => { content.style.maxHeight = '0px'; });
    content._accordionTimer = window.setTimeout(() => { content.hidden = true; }, 240);
  } else {
    content.hidden = false;
    content.style.maxHeight = '0px';
    requestAnimationFrame(() => { content.style.maxHeight = `${content.scrollHeight}px`; });
    content.addEventListener('transitionend', function finishOpen(ev) { if (ev.propertyName === 'max-height' && trigger.getAttribute('aria-expanded') === 'true') content.style.maxHeight = 'none'; content.removeEventListener('transitionend', finishOpen); });
  }
});
