// ── TEMA CLARO / OSCURO ───────────────────────────
// El atributo data-theme ya fue seteado en el <head> (evita el flash).
// Acá solo sincronizamos los botones y exponemos el toggle.

function syncThemeButtons(theme) {
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
  document.querySelectorAll('.theme-toggle-label').forEach(el => {
    el.textContent = theme === 'dark' ? '☀️ Modo claro' : '🌙 Modo oscuro';
  });
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  syncThemeButtons(next);
}

syncThemeButtons(document.documentElement.getAttribute('data-theme') || 'light');
