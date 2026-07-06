// ── LANDING: NAV MEGA MENU ────────────────────────
function lpToggleMenu(name) {
  document.querySelectorAll('.lp-nav-item').forEach(item => {
    if (item.dataset.menu === name) item.classList.toggle('open');
    else item.classList.remove('open');
  });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.lp-nav-item')) {
    document.querySelectorAll('.lp-nav-item.open').forEach(i => i.classList.remove('open'));
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.lp-nav-item.open').forEach(i => i.classList.remove('open'));
  }
});

// ── LANDING: MOBILE NAV ───────────────────────────
function lpToggleMobileNav() {
  document.getElementById('lp-nav-links').classList.toggle('mobile-open');
}

// Cerrar el menú mobile al navegar a una sección
document.querySelectorAll('.lp-nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('lp-nav-links').classList.remove('mobile-open');
  });
});

// ── LANDING: TABS DE MÓDULOS ──────────────────────
function lpSwitchTab(tab, btn) {
  document.querySelectorAll('.lp-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.lp-tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
}

// ── LANDING: SOMBRA DE NAV AL SCROLLEAR ───────────
const lpNavEl = document.querySelector('.lp-nav');
function lpUpdateNavShadow() {
  lpNavEl.classList.toggle('scrolled', window.scrollY > 8);
}
window.addEventListener('scroll', lpUpdateNavShadow, { passive: true });
lpUpdateNavShadow();

// ── LANDING: RESALTAR SECCIÓN ACTIVA EN EL NAV ────
const lpSectionLinks = [...document.querySelectorAll('.lp-nav-links > a[href^="#"]')];
const lpObservedSections = lpSectionLinks
  .map(a => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

if (lpObservedSections.length) {
  const lpNavObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      lpSectionLinks.forEach(l => l.classList.remove('active'));
      const activeLink = lpSectionLinks.find(l => l.getAttribute('href') === `#${entry.target.id}`);
      if (activeLink) activeLink.classList.add('active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  lpObservedSections.forEach(section => lpNavObserver.observe(section));
}
