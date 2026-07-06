// ── MÓDULO 15: EVALUACIÓN DE DESEMPEÑO ────────────

const CALIFICACIONES = ['Excelente', 'Muy Bueno', 'Bueno', 'Regular', 'Insuficiente'];
let m15Evaluaciones = [];

function calificacionBadge(cal) {
  const cls = (cal === 'Excelente' || cal === 'Muy Bueno') ? 'aceptado'
    : (cal === 'Insuficiente' ? 'rechazado' : 'pendiente');
  return `<span class="estado-badge ${cls}">${esc(cal)}</span>`;
}

async function loadEvaluaciones() {
  const res   = await py('get_evaluaciones');
  const tbody = document.getElementById('m15-tbody');
  if (!res.ok) { toast(res.msg, 'error'); return; }
  m15Evaluaciones = res.data;

  if (res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">
      Sin evaluaciones cargadas.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(ev => `
    <tr>
      <td>${esc(ev.legajo)}</td>
      <td>${esc(ev.apellido_nombre)}</td>
      <td>${esc(ev.sector) || '-'}</td>
      <td>${esc(ev.periodo)}</td>
      <td>${calificacionBadge(ev.calificacion)}</td>
      <td>${esc(ev.fecha)}</td>
      <td class="actions-cell">
        <button class="btn btn-secondary btn-sm" onclick="verEvaluacion(${ev.id})">Ver</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarEvaluacion(${ev.id})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

async function openEvaluacionModal() {
  const res = await py('get_empleados');
  if (!res.ok) { toast(res.msg, 'error'); return; }
  const activos = (res.data || []).filter(e => (e.estado || 'activo') === 'activo');
  if (activos.length === 0) { toast('No hay empleados activos para evaluar', 'error'); return; }

  const body = `
    <div class="form-grid">
      <div class="form-group full">
        <label>Empleado *</label>
        <select id="ev-legajo">
          ${activos.map(e => `<option value="${esc(e.legajo)}">${esc(e.apellido_nombre)} — Leg. ${esc(e.legajo)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Período *</label>
        <input type="text" id="ev-periodo" placeholder="Ej: 2026 - Semestre 1">
      </div>
      <div class="form-group">
        <label>Calificación *</label>
        <select id="ev-calificacion">
          ${CALIFICACIONES.map(c => `<option>${esc(c)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Objetivos</label>
        <textarea id="ev-objetivos" rows="3"
          style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;resize:vertical;outline:none;font-family:inherit"></textarea>
      </div>
      <div class="form-group full">
        <label>Comentarios</label>
        <textarea id="ev-comentarios" rows="3"
          style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;resize:vertical;outline:none;font-family:inherit"></textarea>
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarEvaluacion()">💾 Guardar</button>
  `;
  openModal('Nueva Evaluación', body, footer);
  document.querySelector('#modal-overlay .modal-box').classList.add('wide');
}

async function guardarEvaluacion() {
  const datos = {
    legajo: document.getElementById('ev-legajo').value,
    periodo: document.getElementById('ev-periodo').value.trim(),
    calificacion: document.getElementById('ev-calificacion').value,
    objetivos: document.getElementById('ev-objetivos').value.trim(),
    comentarios: document.getElementById('ev-comentarios').value.trim(),
  };
  if (!datos.periodo) { toast('El período es obligatorio', 'error'); return; }

  const res = await py('guardar_evaluacion', datos);
  if (res.ok) {
    closeModal();
    loadEvaluaciones();
    toast('Evaluación guardada');
  } else {
    toast(res.msg, 'error');
  }
}

function verEvaluacion(id) {
  const ev = m15Evaluaciones.find(e => e.id === id);
  if (!ev) return;
  const body = `
    <div class="ficha-grid">
      ${fichaField('Empleado', ev.apellido_nombre)}
      ${fichaField('Legajo', ev.legajo)}
      ${fichaField('Sector', ev.sector)}
      ${fichaField('Período', ev.periodo)}
      ${fichaField('Calificación', ev.calificacion)}
      ${fichaField('Fecha', ev.fecha)}
    </div>
    <div class="ficha-section-title">Objetivos</div>
    <p style="font-size:13px;color:var(--text)">${esc(ev.objetivos) || '-'}</p>
    <div class="ficha-section-title" style="margin-top:14px">Comentarios</div>
    <p style="font-size:13px;color:var(--text)">${esc(ev.comentarios) || '-'}</p>
  `;
  openModal('Evaluación de Desempeño', body, `<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`);
  document.querySelector('#modal-overlay .modal-box').classList.add('wide');
}

async function eliminarEvaluacion(id) {
  if (!confirm('¿Eliminar esta evaluación?')) return;
  const res = await py('eliminar_evaluacion', id);
  if (res.ok) { loadEvaluaciones(); toast('Evaluación eliminada'); }
  else toast(res.msg, 'error');
}
