// Instalação do aplicativo (PWA) e service worker.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; $('#install-app').classList.remove('hidden'); });
$('#install-app').addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('#install-app').classList.add('hidden');
  }
  else {
    alert('No iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”. No Android, use o menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”.');
  }
});
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches) {
  $('#install-app').classList.remove('hidden');
  $('#install-app').textContent = 'Como instalar';
}
if (window.matchMedia('(display-mode: standalone)').matches)
  $('#install-app').classList.add('hidden');
window.addEventListener('appinstalled', () => $('#install-app').classList.add('hidden'));
if ('serviceWorker' in navigator)
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(err => console.warn('PWA indisponível:', err)));
