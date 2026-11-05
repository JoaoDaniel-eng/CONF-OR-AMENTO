// ===== Tema do painel (compartilha a escolha com o site) =====
const adminThemeQuery = window.matchMedia('(prefers-color-scheme: dark)'), themeOrder = ['auto', 'light', 'dark'], themeLabels = { auto: '🌓 Tema: automático', light: '☀️ Tema: claro', dark: '🌙 Tema: escuro' };
function adminThemePref() {
  try {
    const t = localStorage.getItem('acaiTheme');
    return themeOrder.includes(t) ? t : 'auto';
  }
  catch {
    return 'auto';
  }
}
function applyAdminTheme(pref, persist) {
  document.documentElement.dataset.theme = (pref === 'dark' || (pref === 'auto' && adminThemeQuery.matches)) ? 'dark' : 'light';
  $('#admin-theme').textContent = themeLabels[pref];
  if (persist) {
    try {
      localStorage.setItem('acaiTheme', pref);
    }
    catch { }
  }
}
$('#admin-theme').addEventListener('click', () => applyAdminTheme(themeOrder[(themeOrder.indexOf(adminThemePref()) + 1) % 3], true));
(adminThemeQuery.addEventListener ? adminThemeQuery.addEventListener.bind(adminThemeQuery, 'change') : adminThemeQuery.addListener.bind(adminThemeQuery))(() => {
  if (adminThemePref() === 'auto')
    applyAdminTheme('auto', false);
});
applyAdminTheme(adminThemePref(), false);
