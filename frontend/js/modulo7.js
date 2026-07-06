// ── MÓDULO 7: SOLICITUDES Y PEDIDOS (EMPLEADO) ───

const SOL_TIPOS = ['Solicitud de licencia', 'Solicitud de vacaciones', 'Solicitud de anticipo', 'Consulta a RRHH'];

function estadoBadgeSolicitud(estado) {
  const cls = estado === 'Aceptado' ? 'aceptado' : estado === 'Rechazado' ? 'rechazado' : 'pendiente';
  return `<span class="estado-badge ${cls}">${esc(estado)}</span>`;
}

function detalleSolicitud(s) {
  if (s.tipo_solicitud === 'Solicitud de licencia') return s.detalle_licencia;
  if (s.tipo_solicitud === 'Consulta a RRHH') return s.consulta_texto;
  return '-';
}

async function loadMisSolicitudes() {
  const res   = await py('get_mis_solicitudes', state.legajo);
  const tbody = document.getElementById('m7-tbody');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">
      Todavía no realizó ninguna solicitud.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(s => `
    <tr>
      <td>${esc(s.tipo_solicitud)}</td>
      <td>${esc(detalleSolicitud(s)) || '-'}</td>
      <td>${esc(s.fecha_inicio) || '-'}</td>
      <td>${esc(s.dias) || '-'}</td>
      <td>${esc(s.monto) || '-'}</td>
      <td>${estadoBadgeSolicitud(s.estado)}</td>
    </tr>
  `).join('');
}

function openSolicitudModal() {
  const body = `
    <div class="form-grid">
      <div class="form-group full">
        <label>Tipo de Solicitud *</label>
        <select id="sol-tipo" onchange="cambiarFormularioSolicitud()">
          ${SOL_TIPOS.map(t => `<option>${esc(t)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="sol-dinamico"></div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarSolicitud()">💾 Enviar Solicitud</button>
  `;
  openModal('Nueva Solicitud', body, footer);
  document.querySelector('#modal-overlay .modal-box').classList.add('wide');
  cambiarFormularioSolicitud();
}

function cambiarFormularioSolicitud() {
  const tipo = document.getElementById('sol-tipo').value;
  const cont = document.getElementById('sol-dinamico');

  if (tipo === 'Solicitud de licencia') {
    const motivos = ['Matrimonio', 'Nacimiento de hijo', 'Enfermedad', 'Ausencia', 'Fallecimiento de familiar', 'Día de estudio/examen'];
    cont.innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label>Motivo de Licencia</label>
          <select id="sol-motivo">${motivos.map(m => `<option>${esc(m)}</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label>Fecha de Inicio (dd-mm-aaaa)</label>
          <input type="text" id="sol-fecha" placeholder="01-01-2025">
        </div>
        <div class="form-group">
          <label>Cantidad de Días</label>
          <input type="text" id="sol-dias" placeholder="Ej: 3">
        </div>
      </div>
    `;
  } else if (tipo === 'Solicitud de vacaciones') {
    cont.innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label>Fecha de Inicio (dd-mm-aaaa)</label>
          <input type="text" id="sol-fecha" placeholder="01-01-2025">
        </div>
        <div class="form-group">
          <label>Cantidad de Días</label>
          <input type="text" id="sol-dias" placeholder="Ej: 14">
        </div>
      </div>
    `;
  } else if (tipo === 'Solicitud de anticipo') {
    cont.innerHTML = `
      <div class="form-grid">
        <div class="form-group">
          <label>Monto Solicitado ($)</label>
          <input type="text" id="sol-monto" placeholder="Ej: 50000">
        </div>
      </div>
    `;
  } else {
    cont.innerHTML = `
      <div class="form-group">
        <label>Escriba su consulta</label>
        <textarea id="sol-consulta" rows="5"
          style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;resize:vertical;outline:none;font-family:inherit"></textarea>
      </div>
    `;
  }
}

async function guardarSolicitud() {
  const tipo = document.getElementById('sol-tipo').value;
  let detalle_licencia = '', fecha_inicio = '', dias = '', monto = '', consulta_texto = '';

  if (tipo === 'Solicitud de licencia') {
    detalle_licencia = document.getElementById('sol-motivo').value;
    fecha_inicio      = document.getElementById('sol-fecha').value.trim();
    dias              = document.getElementById('sol-dias').value.trim();
    if (!fecha_inicio || !dias) { toast('Debe completar la fecha de inicio y los días', 'error'); return; }
  } else if (tipo === 'Solicitud de vacaciones') {
    fecha_inicio = document.getElementById('sol-fecha').value.trim();
    dias         = document.getElementById('sol-dias').value.trim();
    if (!fecha_inicio || !dias) { toast('Debe completar la fecha de inicio y los días', 'error'); return; }
  } else if (tipo === 'Solicitud de anticipo') {
    monto = document.getElementById('sol-monto').value.trim();
    if (!monto) { toast('Debe especificar el monto solicitado', 'error'); return; }
  } else {
    consulta_texto = document.getElementById('sol-consulta').value.trim();
    if (!consulta_texto) { toast('La consulta no puede estar vacía', 'error'); return; }
  }

  const res = await py('crear_solicitud', state.legajo, tipo, detalle_licencia, fecha_inicio, dias, monto, consulta_texto);
  if (res.ok) {
    closeModal();
    loadMisSolicitudes();
    toast(`La '${tipo}' se ha registrado con éxito`);
  } else {
    toast(res.msg, 'error');
  }
}
