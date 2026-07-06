// ── MÓDULO 11: BENEFICIOS ────────────────────────

const BENEFICIO_CATEGORIAS = ['Salud', 'Descuentos y Convenios', 'Capacitación', 'Flexibilidad Laboral', 'Otro'];
let m11EditId = null;

async function loadBeneficios() {
  document.getElementById('m11-btn-nuevo').classList.toggle('hidden', state.role !== 'admin');

  const res  = await py('get_beneficios');
  const grid = document.getElementById('m11-grid');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.data.length === 0) {
    grid.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">
      Todavía no hay beneficios cargados.
    </div>`;
    return;
  }

  grid.innerHTML = res.data.map(b => `
    <div class="resource-card">
      <span class="tipo-badge">${esc(b.categoria)}</span>
      <h3>${esc(b.titulo)}</h3>
      <p>${esc(b.descripcion) || ''}</p>
      ${state.role === 'admin' ? `
        <div class="resource-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="openBeneficioModal(${b.id})">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarBeneficio(${b.id})">Eliminar</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

async function openBeneficioModal(id = null) {
  m11EditId = id;
  let d = {};
  if (id) {
    const res = await py('get_beneficios');
    d = (res.data || []).find(b => b.id === id) || {};
  }

  const body = `
    <div class="form-grid">
      <div class="form-group full">
        <label>Título *</label>
        <input type="text" id="ben-titulo" value="${esc(d.titulo)}">
      </div>
      <div class="form-group full">
        <label>Categoría</label>
        <select id="ben-categoria">
          ${BENEFICIO_CATEGORIAS.map(c => `<option ${c === d.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Descripción</label>
        <textarea id="ben-descripcion" rows="3"
          style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;resize:vertical;outline:none;font-family:inherit">${esc(d.descripcion)}</textarea>
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarBeneficio()">💾 Guardar</button>
  `;
  openModal(id ? 'Editar Beneficio' : 'Nuevo Beneficio', body, footer);
}

async function guardarBeneficio() {
  const datos = {
    id: m11EditId,
    titulo: document.getElementById('ben-titulo').value.trim(),
    categoria: document.getElementById('ben-categoria').value,
    descripcion: document.getElementById('ben-descripcion').value.trim(),
  };
  if (!datos.titulo) { toast('El título es obligatorio', 'error'); return; }

  const res = await py('guardar_beneficio', datos);
  if (res.ok) {
    closeModal();
    loadBeneficios();
    toast(m11EditId ? 'Beneficio actualizado' : 'Beneficio guardado');
  } else {
    toast(res.msg, 'error');
  }
}

async function eliminarBeneficio(id) {
  if (!confirm('¿Eliminar este beneficio?')) return;
  const res = await py('eliminar_beneficio', id);
  if (res.ok) { loadBeneficios(); toast('Beneficio eliminado'); }
  else toast(res.msg, 'error');
}
