// ── ESTADO GLOBAL ─────────────────────────────────
const state = { user: null, role: null, legajo: null };

// ── INIT ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  setupMobileLayout();
  window.addEventListener('resize', setupMobileLayout);
  const sesion = await py('get_sesion');
  if (sesion && sesion.usuario) applySession(sesion);
});

// ── MOBILE LAYOUT ─────────────────────────────────
function setupMobileLayout() {
  const isMobile = window.innerWidth <= 680;
  const topbar   = document.getElementById('mobile-topbar');
  const sidebar  = document.getElementById('main-sidebar');
  if (topbar)  topbar.style.display  = isMobile ? 'flex' : 'none';
  if (sidebar) {
    sidebar.style.display = 'flex';
    if (!isMobile) {
      sidebar.classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('active');
    }
  }
}

function toggleSidebar() {
  const sidebar  = document.getElementById('main-sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const isOpen   = sidebar.classList.toggle('open');
  overlay.classList.toggle('active', isOpen);
}

// ── HELPER API ────────────────────────────────────
async function py(method, ...args) {
  const res = await fetch(`/api/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ args })
  });
  return res.json();
}

// ── TOAST ─────────────────────────────────────────
let _toastTimer = null;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// ── LOGIN TABS ────────────────────────────────────
function switchLoginTab(tab) {
  document.querySelectorAll('.login-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.login-tabs [onclick="switchLoginTab('${tab}')"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById('login-error').classList.add('hidden');
}

// ── AUTH ──────────────────────────────────────────
async function loginAdmin() {
  const usuario  = document.getElementById('admin-usuario').value.trim();
  const password = document.getElementById('admin-password').value;
  if (!usuario || !password) { showLoginError('Complete todos los campos'); return; }
  const res = await py('login_admin', usuario, password);
  if (res.ok) {
    applySession({ usuario, rol: 'admin', legajo: null });
  } else {
    showLoginError(res.msg);
  }
}

async function loginEmpleado() {
  const legajo = document.getElementById('emp-legajo').value.trim();
  const doc    = document.getElementById('emp-documento').value.trim();
  if (!legajo || !doc) { showLoginError('Complete todos los campos'); return; }
  const res = await py('login_empleado', legajo, doc);
  if (res.ok) {
    applySession({ usuario: res.nombre, rol: 'empleado', legajo });
  } else {
    showLoginError(res.msg);
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function applySession(sesion) {
  state.user   = sesion.usuario;
  state.role   = sesion.rol;
  state.legajo = sesion.legajo;

  document.getElementById('sidebar-username').textContent = sesion.usuario;
  document.getElementById('sidebar-role').textContent =
    sesion.rol === 'admin' ? 'Administrador' : 'Empleado';

  document.getElementById('admin-nav').classList.toggle('hidden', sesion.rol !== 'admin');
  document.getElementById('empleado-nav').classList.toggle('hidden', sesion.rol !== 'empleado');

  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');

  if (sesion.rol === 'admin') {
    showModule('m1');
  } else {
    showModule('m3');
    loadPerfil(sesion.legajo);
  }
}

async function logout() {
  await py('logout');
  location.reload();
}

// ── LANDING ───────────────────────────────────────
function verLanding() {
  window.open('index.html', 'landing', 'width=1280,height=850,noopener');
}

// ── NAVEGACIÓN ────────────────────────────────────
function showModule(mod) {
  document.querySelectorAll('.module-section').forEach(s => {
    s.classList.add('hidden');
    s.style.display = '';
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById(`module-${mod}`);
  if (section) {
    section.classList.remove('hidden');
    section.style.display = 'block';
  }
  const navItem = document.querySelector(`[data-module="${mod}"]`);
  if (navItem) navItem.classList.add('active');

  if (mod === 'm1') loadParametros();
  if (mod === 'm2') loadEmpleados();
  if (mod === 'm4') loadConsolidado();
  if (mod === 'm7') loadMisSolicitudes();
  if (mod === 'm8') loadSolicitudesAdmin();
  if (mod === 'm9') loadReconocimientos();
  if (mod === 'm10') loadRecursos();
  if (mod === 'm11') loadBeneficios();
  if (mod === 'm12') loadEncuestaClima();
  if (mod === 'm13') loadNomina();
  if (mod === 'm14') loadArca();
  if (mod === 'm15') loadEvaluaciones();
  if (mod === 'm16') loadCurriculums();

  // Cerrar sidebar en mobile al navegar
  if (window.innerWidth <= 680) {
    document.getElementById('main-sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }
}

// ── MODAL GENÉRICO ────────────────────────────────
function openModal(title, bodyHTML, footerHTML) {
  document.getElementById('modal-title').textContent   = title;
  document.getElementById('modal-body').innerHTML      = bodyHTML;
  document.getElementById('modal-footer').innerHTML    = footerHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal(event) {
  if (!event || event.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
}

// ── ESCAPE HTML ───────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
