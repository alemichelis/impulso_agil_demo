// ── MÓDULO 2: EMPLEADOS ──────────────────────────
let m2EditLegajo = null;

async function loadEmpleados() {
  const res   = await py('get_empleados');
  const tbody = document.getElementById('m2-tbody');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px">
      Sin empleados registrados.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(e => {
    const estado = e.estado || 'activo';
    const estadoBadge = estado === 'inactivo'
      ? '<span class="estado-badge inactivo">Inactivo</span>'
      : '<span class="estado-badge activo">Activo</span>';
    return `
    <tr style="${estado === 'inactivo' ? 'opacity:.65' : ''}">
      <td><strong>${esc(e.legajo)}</strong></td>
      <td>${esc(e.apellido_nombre)}</td>
      <td class="hide-mobile" style="color:var(--text-muted)">${esc(e.cuil) || '-'}</td>
      <td class="hide-mobile">${esc(e.cargo) || '-'}</td>
      <td class="hide-mobile">${esc(e.sector) || '-'}</td>
      <td class="hide-mobile">${esc(e.lugar_trabajo) || '-'}</td>
      <td class="hide-mobile"><span class="tipo-badge">${esc(e.tipo_empleado) || '-'}</span></td>
      <td>${estadoBadge}</td>
      <td class="actions-cell">
        <button class="btn btn-secondary btn-sm"
          onclick="openEmpleadoModal('${esc(e.legajo)}')">Editar</button>
        <button class="btn btn-danger btn-sm"
          onclick="eliminarEmpleado('${esc(e.legajo)}')">Eliminar</button>
      </td>
    </tr>
  `;
  }).join('');
}

async function openEmpleadoModal(legajoEditar = null) {
  m2EditLegajo = legajoEditar;
  const listas = await py('get_listas_parametros');
  if (!listas.ok) { toast(listas.msg, 'error'); return; }

  let d = {};
  if (legajoEditar) {
    const res = await py('get_empleados');
    d = (res.data || []).find(e => e.legajo === legajoEditar) || {};
  }

  const opt = (arr, val) =>
    (arr || []).map(v => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(v)}</option>`).join('');

  const tiposEmp = ['grado I','grado II (supervisor)','grado III (jefe)','grado IV (director)'];

  const body = `
    <div class="form-grid">
      <div class="form-group">
        <label>Legajo *</label>
        <input type="text" id="e-legajo" value="${esc(d.legajo)}" ${legajoEditar ? 'readonly' : ''}>
      </div>
      <div class="form-group">
        <label>Apellido y Nombre *</label>
        <input type="text" id="e-nombre" value="${esc(d.apellido_nombre)}">
      </div>
      <div class="form-group">
        <label>CUIL</label>
        <input type="text" id="e-cuil" value="${esc(d.cuil)}" placeholder="20-XXXXXXXX-X">
      </div>
      <div class="form-group">
        <label>Tipo Documento</label>
        <select id="e-tipo-doc">
          <option ${d.tipo_doc === 'DNI' ? 'selected' : ''}>DNI</option>
          <option ${d.tipo_doc === 'Pasaporte' ? 'selected' : ''}>Pasaporte</option>
        </select>
      </div>
      <div class="form-group">
        <label>Nro. Documento</label>
        <input type="text" id="e-nro-doc" value="${esc(d.nro_doc)}">
      </div>
      <div class="form-group">
        <label>Lugar de Trabajo</label>
        <select id="e-lugar">${opt(listas.lugares, d.lugar_trabajo)}</select>
      </div>
      <div class="form-group">
        <label>Jornada (hs/sem)</label>
        <input type="text" id="e-jornada" value="${esc(d.jornada)}">
      </div>
      <div class="form-group">
        <label>Fecha de Ingreso (dd-mm-aaaa)</label>
        <input type="text" id="e-f-ingreso" value="${esc(d.fecha_ingreso)}" placeholder="01-01-2024">
      </div>
      <div class="form-group">
        <label>Antigüedad Reconocida (dd-mm-aaaa)</label>
        <input type="text" id="e-f-antiguedad" value="${esc(d.fecha_antiguedad)}" placeholder="01-01-2020">
      </div>
      <div class="form-group">
        <label>Cargo</label>
        <select id="e-cargo">${opt(listas.cargos, d.cargo)}</select>
      </div>
      <div class="form-group">
        <label>Tipo de Empleado</label>
        <select id="e-tipo-emp">
          ${tiposEmp.map(v => `<option ${d.tipo_empleado === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Sector</label>
        <select id="e-sector">${opt(listas.sectores, d.sector)}</select>
      </div>
      <div class="form-group">
        <label>Jefe Admin</label>
        <select id="e-jefe">${opt(listas.jefes, d.jefe_admin)}</select>
      </div>
      <div class="form-group">
        <label>Centro de Costo</label>
        <select id="e-cc">${opt(listas.centros_costo, d.centro_costo)}</select>
      </div>

      <div class="form-group full" style="grid-column:1/-1;padding-top:4px;border-top:1px solid var(--border);margin-top:4px">
        <label style="font-size:12px;color:var(--primary)">Datos Bancarios y Previsionales</label>
      </div>
      <div class="form-group">
        <label>Sueldo Básico ($)</label>
        <input type="text" id="e-sueldo" value="${esc(d.sueldo_basico)}" placeholder="Ej: 850000">
      </div>
      <div class="form-group">
        <label>Banco</label>
        <input type="text" id="e-banco" value="${esc(d.banco)}" placeholder="Ej: Banco Nación">
      </div>
      <div class="form-group">
        <label>CBU / CVU</label>
        <input type="text" id="e-cbu" value="${esc(d.cbu)}" placeholder="22 dígitos">
      </div>
      <div class="form-group">
        <label>Tipo de Cuenta</label>
        <select id="e-tipo-cuenta">
          <option ${d.tipo_cuenta === 'Caja de Ahorro' ? 'selected' : ''}>Caja de Ahorro</option>
          <option ${d.tipo_cuenta === 'Cuenta Corriente' ? 'selected' : ''}>Cuenta Corriente</option>
        </select>
      </div>
      <div class="form-group">
        <label>Obra Social</label>
        <select id="e-obra-social">
          ${['OSDE','Swiss Medical','Galeno','Medifé','Accord Salud','IOMA','PAMI','Otra']
            .map(v => `<option ${d.obra_social === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Plan Médico</label>
        <input type="text" id="e-plan-medico" value="${esc(d.plan_medico)}" placeholder="Ej: Plan 210">
      </div>
      <div class="form-group">
        <label>Convenio Colectivo (CCT)</label>
        <input type="text" id="e-convenio" value="${esc(d.convenio_cct)}" placeholder="Ej: CCT 130/75">
      </div>
      <div class="form-group">
        <label>Categoría del Convenio</label>
        <input type="text" id="e-categoria-convenio" value="${esc(d.categoria_convenio)}" placeholder="Ej: Administrativo A">
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarEmpleado()">💾 Guardar</button>
  `;

  // Widen modal for the employee form
  openModal(legajoEditar ? 'Editar Empleado' : 'Nuevo Empleado', body, footer);
  document.querySelector('#modal-overlay .modal-box').classList.add('wide');
}

async function guardarEmpleado() {
  const datos = {
    legajo:          document.getElementById('e-legajo').value.trim(),
    apellido_nombre: document.getElementById('e-nombre').value.trim(),
    cuil:            document.getElementById('e-cuil').value.trim(),
    tipo_doc:        document.getElementById('e-tipo-doc').value,
    nro_doc:         document.getElementById('e-nro-doc').value.trim(),
    lugar_trabajo:   document.getElementById('e-lugar').value,
    jornada:         document.getElementById('e-jornada').value.trim(),
    fecha_ingreso:   document.getElementById('e-f-ingreso').value.trim(),
    fecha_antiguedad:document.getElementById('e-f-antiguedad').value.trim(),
    cargo:           document.getElementById('e-cargo').value,
    tipo_empleado:   document.getElementById('e-tipo-emp').value,
    sector:          document.getElementById('e-sector').value,
    jefe_admin:      document.getElementById('e-jefe').value,
    centro_costo:    document.getElementById('e-cc').value,
    sueldo_basico:   document.getElementById('e-sueldo').value.trim(),
    banco:           document.getElementById('e-banco').value.trim(),
    cbu:             document.getElementById('e-cbu').value.trim(),
    tipo_cuenta:     document.getElementById('e-tipo-cuenta').value,
    obra_social:     document.getElementById('e-obra-social').value,
    plan_medico:     document.getElementById('e-plan-medico').value.trim(),
    convenio_cct:    document.getElementById('e-convenio').value.trim(),
    categoria_convenio: document.getElementById('e-categoria-convenio').value.trim(),
  };

  if (!datos.legajo || !datos.apellido_nombre) {
    toast('Legajo y Nombre son obligatorios', 'error');
    return;
  }

  const res = await py('guardar_empleado', datos);
  if (res.ok) {
    closeModal();
    loadEmpleados();
    toast(m2EditLegajo ? 'Empleado actualizado' : 'Empleado guardado');
  } else {
    toast(res.msg, 'error');
  }
}

async function eliminarEmpleado(legajo) {
  if (!confirm(`¿Eliminar definitivamente al legajo ${legajo}?\nTambién se borrarán sus datos personales y familiares.`)) return;
  const res = await py('eliminar_empleado', legajo);
  if (res.ok) { loadEmpleados(); toast('Empleado eliminado'); }
  else toast(res.msg, 'error');
}

// ── ORGANIGRAMA ───────────────────────────────────
async function showOrgChart() {
  const res = await py('get_empleados');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  const content = document.getElementById('orgchart-content');
  if (res.data.length === 0) {
    content.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:40px">Sin empleados registrados.</p>`;
  } else {
    content.innerHTML = `<div class="org-scroll">${buildOrgTree(res.data)}</div>`;
  }
  document.getElementById('orgchart-overlay').classList.remove('hidden');
}

function buildOrgTree(empleados) {
  const nombresSet = new Set(empleados.map(e => e.apellido_nombre));

  function getChildren(jefeName) {
    return empleados.filter(e => e.jefe_admin === jefeName);
  }

  function nodeHtml(e, level) {
    const cls = level === 0 ? 'root' : level === 1 ? 'mid' : 'leaf';
    return `<div class="org-node ${cls}">
      <div class="org-node-role">${esc(e.cargo || e.tipo_empleado || '')}</div>
      <div class="org-node-name">${esc(e.apellido_nombre)}</div>
      <div class="org-node-leg">Leg. ${esc(e.legajo)}</div>
    </div>`;
  }

  function renderItem(e, level) {
    const children = getChildren(e.apellido_nombre);
    let html = `<div class="org-child-wrap" style="${level === 0 ? 'align-items:center' : ''}">
      ${nodeHtml(e, level)}`;

    if (children.length > 0) {
      html += `<div class="org-connector"></div>
        <div class="org-children-row">
          ${children.map(c => renderItem(c, level + 1)).join('')}
        </div>`;
    }

    html += `</div>`;
    return html;
  }

  const roots = empleados.filter(
    e => e.jefe_admin === 'Ninguno' || !nombresSet.has(e.jefe_admin)
  );

  return `<div class="org-tree">
    <div class="org-children-row" style="border:none;padding-top:0">
      ${roots.map(r => renderItem(r, 0)).join('')}
    </div>
  </div>`;
}

function closeOrgChart(event) {
  if (!event || event.target === document.getElementById('orgchart-overlay')) {
    document.getElementById('orgchart-overlay').classList.add('hidden');
  }
}

// ── MÓDULO 6: BAJA DE EMPLEADOS ───────────────────
let m6Legajo = null;

function openBajaModal() {
  m6Legajo = null;
  const motivos = [
    'Renuncia del trabajador (Art. 240 LCT)',
    'Despido directo con causa (Art. 242 LCT)',
    'Despido sin causa / Indemnización (Art. 245 LCT)',
    'Voluntad concurrente de las partes (Art. 241 LCT)',
    'Abandono de trabajo (Art. 244 LCT)',
    'Fallecimiento del trabajador',
    'Cesión del personal (Art. 229 LCT)',
    'Transferencia del contrato de trabajo (Art. 225 y 226 LCT)'
  ];

  const body = `
    <div class="form-group">
      <label>Buscar empleado</label>
      <div style="display:flex;gap:8px">
        <select id="baja-criterio" class="select-control" style="width:auto;min-width:160px">
          <option value="legajo">Legajo</option>
          <option value="apellido_nombre">Apellido y Nombre</option>
          <option value="cuil">CUIL</option>
          <option value="nro_doc">Nro Doc</option>
        </select>
        <input type="text" id="baja-busqueda" placeholder="Ingrese término..."
          style="flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;outline:none">
        <button class="btn btn-secondary" onclick="buscarParaBaja()">🔍</button>
      </div>
    </div>
    <div id="baja-emp-info" class="baja-emp-info">Ningún empleado seleccionado.</div>
    <div class="form-group">
      <label>Fecha de Baja (dd-mm-aaaa) *</label>
      <input type="text" id="baja-fecha" placeholder="01-01-2025">
    </div>
    <div class="form-group">
      <label>Motivo de la Baja *</label>
      <select id="baja-motivo">
        <option value="">-- Seleccione motivo --</option>
        ${motivos.map(m => `<option>${esc(m)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Comentarios (opcional)</label>
      <textarea id="baja-comentario" rows="3"
        style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;resize:vertical;outline:none;font-family:inherit"></textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-danger" onclick="confirmarBaja()">🚫 Registrar Baja</button>
  `;

  openModal('Registrar Baja de Empleado', body, footer);
  setTimeout(() => {
    const inp = document.getElementById('baja-busqueda');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') buscarParaBaja(); });
  }, 0);
}

async function buscarParaBaja() {
  const criterio = document.getElementById('baja-criterio').value;
  const valor    = document.getElementById('baja-busqueda').value.trim();
  if (!valor) { toast('Ingrese un término de búsqueda', 'error'); return; }

  const res  = await py('buscar_empleado_para_baja', criterio, valor);
  const info = document.getElementById('baja-emp-info');

  if (!res.ok) {
    info.innerHTML = `<span style="color:var(--danger)">${esc(res.msg)}</span>`;
    m6Legajo = null;
    return;
  }

  const d = res.data;
  m6Legajo = d.legajo;
  const estadoHtml = d.estado === 'inactivo'
    ? `<span class="estado-badge inactivo">YA DE BAJA</span> — puede sobrescribir los datos.`
    : `<span class="estado-badge activo">ACTIVO</span>`;
  info.innerHTML = `<strong>${esc(d.apellido_nombre)}</strong> (Leg. ${esc(d.legajo)}) — ${estadoHtml}`;
  info.style.fontStyle = 'normal';
  info.style.color = 'var(--text)';
}

async function confirmarBaja() {
  if (!m6Legajo) { toast('Primero busque y seleccione un empleado', 'error'); return; }
  const fecha      = document.getElementById('baja-fecha').value.trim();
  const motivo     = document.getElementById('baja-motivo').value;
  const comentario = document.getElementById('baja-comentario').value.trim();

  if (!fecha || !motivo) { toast('Fecha y motivo son obligatorios', 'error'); return; }

  const res = await py('registrar_baja', m6Legajo, fecha, motivo, comentario);
  if (res.ok) {
    closeModal();
    loadEmpleados();
    toast('Baja registrada correctamente');
  } else {
    toast(res.msg, 'error');
  }
}
