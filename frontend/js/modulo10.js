// ── MÓDULO 10: BIBLIOTECA DE RECURSOS ────────────

const RECURSO_CATEGORIAS = ['Políticas Internas', 'Manuales', 'Beneficios', 'Formularios', 'Institucional', 'Otro'];
let m10EditId = null;

async function loadRecursos() {
  document.getElementById('m10-btn-nuevo').classList.toggle('hidden', state.role !== 'admin');

  const res  = await py('get_recursos');
  const grid = document.getElementById('m10-grid');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.data.length === 0) {
    grid.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">
      Todavía no hay recursos cargados.
    </div>`;
    return;
  }

  grid.innerHTML = res.data.map(r => `
    <div class="resource-card">
      <span class="tipo-badge">${esc(r.categoria)}</span>
      <h3>${esc(r.titulo)}</h3>
      <p>${esc(r.descripcion) || ''}</p>
      <div class="resource-card-actions">
        ${r.enlace ? `<a class="btn btn-secondary btn-sm" href="${esc(r.enlace)}" target="_blank" rel="noopener">🔗 Abrir</a>` : ''}
        ${state.role === 'admin' ? `
          <button class="btn btn-secondary btn-sm" onclick="openRecursoModal(${r.id})">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarRecurso(${r.id})">Eliminar</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function openRecursoModal(id = null) {
  m10EditId = id;
  let d = {};
  if (id) {
    const res = await py('get_recursos');
    d = (res.data || []).find(r => r.id === id) || {};
  }

  const body = `
    <div class="form-grid">
      <div class="form-group full">
        <label>Título *</label>
        <input type="text" id="rec-titulo" value="${esc(d.titulo)}">
      </div>
      <div class="form-group full">
        <label>Categoría</label>
        <select id="rec-categoria">
          ${RECURSO_CATEGORIAS.map(c => `<option ${c === d.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Descripción</label>
        <textarea id="rec-descripcion" rows="3"
          style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;resize:vertical;outline:none;font-family:inherit">${esc(d.descripcion)}</textarea>
      </div>
      <div class="form-group full">
        <label>Enlace (opcional)</label>
        <input type="text" id="rec-enlace" value="${esc(d.enlace)}" placeholder="https://...">
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarRecurso()">💾 Guardar</button>
  `;
  openModal(id ? 'Editar Recurso' : 'Nuevo Recurso', body, footer);
}

async function guardarRecurso() {
  const datos = {
    id: m10EditId,
    titulo: document.getElementById('rec-titulo').value.trim(),
    categoria: document.getElementById('rec-categoria').value,
    descripcion: document.getElementById('rec-descripcion').value.trim(),
    enlace: document.getElementById('rec-enlace').value.trim(),
  };
  if (!datos.titulo) { toast('El título es obligatorio', 'error'); return; }

  const res = await py('guardar_recurso', datos);
  if (res.ok) {
    closeModal();
    loadRecursos();
    toast(m10EditId ? 'Recurso actualizado' : 'Recurso guardado');
  } else {
    toast(res.msg, 'error');
  }
}

async function eliminarRecurso(id) {
  if (!confirm('¿Eliminar este recurso?')) return;
  const res = await py('eliminar_recurso', id);
  if (res.ok) { loadRecursos(); toast('Recurso eliminado'); }
  else toast(res.msg, 'error');
}
