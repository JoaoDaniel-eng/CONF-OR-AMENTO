// Tema claro/escuro e tamanho da fonte.
// ===== Menu lateral, estado de login no topo e configurações =====
const THEME_COLORS = { light: '#321047', dark: '#1a0a24' };
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(pref, persist) {
  if (!['light', 'dark', 'auto'].includes(pref))
    pref = 'auto';
  const dark = pref === 'dark' || (pref === 'auto' && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themePref = pref;
  const meta = $('#meta-theme-color');
  if (meta)
    meta.content = dark ? THEME_COLORS.dark : THEME_COLORS.light;
  if (persist) {
    try {
      localStorage.setItem('acaiTheme', pref);
    }
    catch { }
  }
}
function currentThemePref() {
  try {
    return localStorage.getItem('acaiTheme') || 'auto';
  }
  catch {
    return 'auto';
  }
}
(darkQuery.addEventListener ? darkQuery.addEventListener.bind(darkQuery, 'change') : darkQuery.addListener.bind(darkQuery))(() => {
  if (currentThemePref() === 'auto')
    applyTheme('auto', false);
});
function applyFontScale(v, persist) {
  if (!['normal', 'large', 'xlarge'].includes(v))
    v = 'normal';
  if (v === 'normal')
    delete document.documentElement.dataset.fontScale;
  else
    document.documentElement.dataset.fontScale = v;
  if (persist) {
    try {
      localStorage.setItem('acaiFontScale', v === 'normal' ? '' : v);
    }
    catch { }
  }
}
function currentFontScale() {
  try {
    return localStorage.getItem('acaiFontScale') || 'normal';
  }
  catch {
    return 'normal';
  }
}
