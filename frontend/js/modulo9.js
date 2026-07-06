// ── MÓDULO 9: RECONOCIMIENTOS ────────────────────

const RECOG_CATEGORIAS = ['Trabajo en Equipo', 'Innovación', 'Compromiso', 'Liderazgo', 'Excelencia', 'Ayuda a un Compañero'];

async function loadReconocimientos() {
  document.getElementById('m9-btn-nuevo').classList.toggle('hidden', state.role !== 'empleado');

  const res  = await py('get_reconocimientos');
  const wall = document.getElementById('m9-wall');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.data.length === 0) {
    wall.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">
      Todavía no hay reconocimientos. ¡Sé el primero en destacar a un compañero!
    </div>`;
    return;
  }

  wall.innerHTML = res.data.map(r => `
    <div class="recog-card">
      <div class="recog-card-top">
        <span class="tipo-badge">${esc(r.categoria)}</span>
        <span class="recog-fecha">${esc(r.fecha)}</span>
      </div>
      <p class="recog-msg">"${esc(r.mensaje)}"</p>
      <div class="recog-from-to">
        <strong>${esc(r.nombre_de)}</strong> → <strong>${esc(r.nombre_para)}</strong>
      </div>
      ${state.role === 'admin' ? `<button class="btn btn-danger btn-sm recog-delete" onclick="eliminarReconocimiento(${r.id})">Eliminar</button>` : ''}
    </div>
  `).join('');
}

async function openReconocimientoModal() {
  const res = await py('get_empleados');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  const colegas = (res.data || []).filter(e => e.legajo !== state.legajo && (e.estado || 'activo') === 'activo');
  if (colegas.length === 0) { toast('No hay compañeros disponibles para reconocer', 'error'); return; }

  const body = `
    <div class="form-grid">
      <div class="form-group full">
        <label>¿A quién querés reconocer? *</label>
        <select id="recog-legajo">
          ${colegas.map(e => `<option value="${esc(e.legajo)}">${esc(e.apellido_nombre)} — Leg. ${esc(e.legajo)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Categoría</label>
        <select id="recog-categoria">
          ${RECOG_CATEGORIAS.map(c => `<option>${esc(c)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Mensaje *</label>
        <textarea id="recog-mensaje" rows="4"
          style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;resize:vertical;outline:none;font-family:inherit"
          placeholder="Contá por qué querés reconocerlo/a..."></textarea>
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarReconocimiento()">🏆 Enviar Reconocimiento</button>
  `;
  openModal('Dar un Reconocimiento', body, footer);
}

async function guardarReconocimiento() {
  const legajoPara = document.getElementById('recog-legajo').value;
  const categoria  = document.getElementById('recog-categoria').value;
  const mensaje    = document.getElementById('recog-mensaje').value.trim();
  if (!mensaje) { toast('Escribí un mensaje para tu compañero/a', 'error'); return; }

  const res = await py('crear_reconocimiento', state.legajo, legajoPara, categoria, mensaje);
  if (res.ok) {
    closeModal();
    loadReconocimientos();
    toast('¡Reconocimiento enviado!');
  } else {
    toast(res.msg, 'error');
  }
}

async function eliminarReconocimiento(id) {
  if (!confirm('¿Eliminar este reconocimiento del muro?')) return;
  const res = await py('eliminar_reconocimiento', id);
  if (res.ok) { loadReconocimientos(); toast('Reconocimiento eliminado'); }
  else toast(res.msg, 'error');
}
