// ── MÓDULO 16: BASE DE CURRÍCULUMS ────────────────

const NIVELES_EDUCATIVOS = ['Secundario incompleto', 'Secundario completo', 'Terciario', 'Universitario', 'Posgrado'];
const ESTADOS_CANDIDATO = ['Disponible', 'En Proceso', 'Contratado', 'Descartado'];
let m16EditId = null;
let m16Curriculums = [];

function estadoCandidatoBadge(estado) {
  const cls = estado === 'Contratado' ? 'aceptado' : estado === 'Descartado' ? 'rechazado' : 'pendiente';
  return `<span class="estado-badge ${cls}">${esc(estado || 'Disponible')}</span>`;
}

async function loadCurriculums() {
  const res   = await py('get_curriculums');
  const tbody = document.getElementById('m16-tbody');
  if (!res.ok) { toast(res.msg, 'error'); return; }
  m16Curriculums = res.data;

  if (res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">
      Sin candidatos cargados.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(c => `
    <tr>
      <td>${esc(c.nombre)}</td>
      <td>${esc(c.puesto_buscado) || '-'}</td>
      <td>${esc(c.telefono) || ''}${c.telefono && c.email ? ' · ' : ''}${esc(c.email) || ''}</td>
      <td>${esc(c.nivel_educacional) || '-'}</td>
      <td>${estadoCandidatoBadge(c.estado)}</td>
      <td>${esc(c.fecha_carga) || '-'}</td>
      <td class="actions-cell">
        <button class="btn btn-secondary btn-sm" onclick="openCurriculumModal(${c.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarCurriculum(${c.id})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

function openCurriculumModal(id = null) {
  m16EditId = id;
  const d = id ? (m16Curriculums.find(c => c.id === id) || {}) : {};

  const body = `
    <div class="form-grid">
      <div class="form-group">
        <label>Nombre Completo *</label>
        <input type="text" id="cv-nombre" value="${esc(d.nombre)}">
      </div>
      <div class="form-group">
        <label>Puesto Buscado</label>
        <input type="text" id="cv-puesto" value="${esc(d.puesto_buscado)}">
      </div>
      <div class="form-group">
        <label>Teléfono</label>
        <input type="text" id="cv-telefono" value="${esc(d.telefono)}">
      </div>
      <div class="form-group">
        <label>E-mail</label>
        <input type="email" id="cv-email" value="${esc(d.email)}">
      </div>
      <div class="form-group">
        <label>Nivel Educacional</label>
        <select id="cv-nivel">
          ${NIVELES_EDUCATIVOS.map(n => `<option ${n === d.nivel_educacional ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Estado</label>
        <select id="cv-estado">
          ${ESTADOS_CANDIDATO.map(s => `<option ${s === d.estado ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Enlace al CV (opcional)</label>
        <input type="text" id="cv-enlace" value="${esc(d.enlace_cv)}" placeholder="https://...">
      </div>
      <div class="form-group full">
        <label>Experiencia</label>
        <textarea id="cv-experiencia" rows="3"
          style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;resize:vertical;outline:none;font-family:inherit">${esc(d.experiencia)}</textarea>
      </div>
      <div class="form-group full">
        <label>Comentarios</label>
        <textarea id="cv-comentarios" rows="2"
          style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;resize:vertical;outline:none;font-family:inherit">${esc(d.comentarios)}</textarea>
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarCurriculum()">💾 Guardar</button>
  `;
  openModal(id ? 'Editar Candidato' : 'Nuevo Candidato', body, footer);
  document.querySelector('#modal-overlay .modal-box').classList.add('wide');
}

async function guardarCurriculum() {
  const datos = {
    id: m16EditId,
    nombre: document.getElementById('cv-nombre').value.trim(),
    puesto_buscado: document.getElementById('cv-puesto').value.trim(),
    telefono: document.getElementById('cv-telefono').value.trim(),
    email: document.getElementById('cv-email').value.trim(),
    nivel_educacional: document.getElementById('cv-nivel').value,
    estado: document.getElementById('cv-estado').value,
    enlace_cv: document.getElementById('cv-enlace').value.trim(),
    experiencia: document.getElementById('cv-experiencia').value.trim(),
    comentarios: document.getElementById('cv-comentarios').value.trim(),
  };
  if (!datos.nombre) { toast('El nombre es obligatorio', 'error'); return; }

  const res = await py('guardar_curriculum', datos);
  if (res.ok) {
    closeModal();
    loadCurriculums();
    toast(m16EditId ? 'Candidato actualizado' : 'Candidato guardado');
  } else {
    toast(res.msg, 'error');
  }
}

async function eliminarCurriculum(id) {
  if (!confirm('¿Eliminar este candidato de la base?')) return;
  const res = await py('eliminar_curriculum', id);
  if (res.ok) { loadCurriculums(); toast('Candidato eliminado'); }
  else toast(res.msg, 'error');
}
