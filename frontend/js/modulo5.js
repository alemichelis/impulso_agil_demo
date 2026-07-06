// ── MÓDULO 5: FICHA DE EMPLEADO ──────────────────
function openFichaModal() {
  const body = `
    <div class="ficha-search-bar">
      <select id="ficha-criterio" class="select-control" style="width:auto;min-width:160px">
        <option value="legajo">Legajo</option>
        <option value="apellido_nombre">Apellido y Nombre</option>
        <option value="cuil">CUIL</option>
        <option value="nro_doc">Nro Doc</option>
      </select>
      <input type="text" id="ficha-valor" placeholder="Ingrese término de búsqueda...">
      <button class="btn btn-primary" onclick="buscarFicha()">🔍 Buscar</button>
      <button class="btn btn-secondary" onclick="limpiarFicha()">↺</button>
    </div>
    <div id="ficha-contenido"></div>
  `;

  openModal('Ficha de Empleado', body, '');
  document.querySelector('#modal-overlay .modal-box').classList.add('wide');

  setTimeout(() => {
    const inp = document.getElementById('ficha-valor');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') buscarFicha(); });
  }, 0);
}

async function buscarFicha() {
  const criterio = document.getElementById('ficha-criterio').value;
  const valor    = document.getElementById('ficha-valor').value.trim();
  if (!valor) { toast('Ingrese un término de búsqueda', 'error'); return; }

  const res       = await py('get_ficha_empleado', criterio, valor);
  const contenido = document.getElementById('ficha-contenido');

  if (!res.ok) {
    contenido.innerHTML = `<p style="color:var(--danger);text-align:center;padding:24px">${esc(res.msg)}</p>`;
    return;
  }

  const d      = res.data;
  const estado = d.estado || 'activo';
  const estadoBadge = estado === 'inactivo'
    ? '<span class="estado-badge inactivo">INACTIVO</span>'
    : '<span class="estado-badge activo">ACTIVO</span>';

  const domicilio = [
    d.calle && (d.calle + (d.numero ? ' ' + d.numero : '')),
    d.piso  && 'Piso ' + d.piso,
    d.dto   && 'Dto. ' + d.dto,
    d.ciudad,
    d.localidad,
    d.provincia,
    d.cp
  ].filter(Boolean).join(', ') || '-';

  contenido.innerHTML = `
    <div class="ficha-card">
      <div class="ficha-header">
        <div>
          <h3>${esc(d.apellido_nombre)} ${estadoBadge}</h3>
          <div class="ficha-sub">Legajo: <strong>${esc(d.legajo)}</strong>
            &nbsp;·&nbsp; CUIL: ${esc(d.cuil || '-')}
            &nbsp;·&nbsp; Doc: ${esc(d.tipo_doc || '')} ${esc(d.nro_doc || '-')}
          </div>
        </div>
      </div>

      <div class="ficha-grid">
        ${fichaField('Cargo', d.cargo)}
        ${fichaField('Sector', d.sector)}
        ${fichaField('Lugar de Trabajo', d.lugar_trabajo)}
        ${fichaField('Tipo de Empleado', d.tipo_empleado)}
        ${fichaField('Jornada', d.jornada ? d.jornada + ' hs/sem' : '-')}
        ${fichaField('Centro de Costo', d.centro_costo)}
        ${fichaField('Jefe Administrativo', d.jefe_admin)}
        ${fichaField('Fecha de Ingreso', d.fecha_ingreso)}
        ${fichaField('Antigüedad Reconocida', d.fecha_antiguedad)}
        ${fichaField('Sexo', d.sexo)}
        ${fichaField('Fecha de Nacimiento', d.f_nacimiento)}
        ${fichaField('Nacionalidad', d.nacionalidad)}
        ${fichaField('Estado Civil', d.estado_civil)}
        ${fichaField('Nivel Educacional', d.nivel_educacional)}
        ${fichaField('Título', d.titulo)}
        ${fichaField('Teléfono', d.telefono)}
        ${fichaField('E-mail', d.email)}
        ${fichaField('Domicilio', domicilio)}
      </div>

      <div class="ficha-section-title">Datos Bancarios y Previsionales</div>
      <div class="ficha-grid">
        ${fichaField('Sueldo Básico', d.sueldo_basico ? '$ ' + d.sueldo_basico : '-')}
        ${fichaField('Banco', d.banco)}
        ${fichaField('CBU / CVU', d.cbu)}
        ${fichaField('Tipo de Cuenta', d.tipo_cuenta)}
        ${fichaField('Obra Social', d.obra_social)}
        ${fichaField('Plan Médico', d.plan_medico)}
        ${fichaField('Convenio Colectivo', d.convenio_cct)}
        ${fichaField('Categoría del Convenio', d.categoria_convenio)}
      </div>

      ${estado === 'inactivo' ? `
        <div class="ficha-baja-info">
          <strong>Fecha de Baja:</strong> ${esc(d.fecha_baja || '-')}
          &nbsp;·&nbsp;
          <strong>Motivo:</strong> ${esc(d.motivo_baja || '-')}
        </div>
      ` : ''}

      ${d.familiares && d.familiares.length > 0 ? `
        <div class="ficha-section-title">Grupo Familiar</div>
        <table class="data-table" style="margin-top:8px">
          <thead>
            <tr>
              <th>Parentesco</th><th>Nombre</th><th>CUIL</th>
            </tr>
          </thead>
          <tbody>
            ${d.familiares.map(f => `
              <tr>
                <td>${esc(f.parentesco)}</td>
                <td>${esc(f.nombre_familiar || '-')}</td>
                <td>${esc(f.cuil_familiar || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>
  `;
}

function fichaField(label, value) {
  return `
    <div class="ficha-field">
      <div class="ficha-label">${label}</div>
      <div class="ficha-value">${esc(value || '-')}</div>
    </div>
  `;
}

function limpiarFicha() {
  const inp = document.getElementById('ficha-valor');
  if (inp) inp.value = '';
  const contenido = document.getElementById('ficha-contenido');
  if (contenido) contenido.innerHTML = '';
}
