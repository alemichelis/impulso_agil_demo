// ── MÓDULO 3: ONBOARDING ─────────────────────────
let m3Legajo = null;

function switchM3Tab(tab) {
  document.querySelectorAll('#module-m3 .tabs .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#module-m3 .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`#module-m3 [onclick="switchM3Tab('${tab}')"]`).classList.add('active');
  document.getElementById(`m3-tab-${tab}`).classList.add('active');
}

async function loadPerfil(legajo) {
  m3Legajo = legajo;
  const res = await py('get_perfil_empleado', legajo);
  if (!res.ok) { toast(res.msg, 'error'); return; }

  const { empleado: e, personales: p, familiares: f } = res;

  // Avatar con iniciales
  const initials = e.apellido_nombre
    .split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  document.getElementById('m3-profile-header').innerHTML = `
    <div class="profile-avatar">${initials}</div>
    <div class="profile-info">
      <h3>${esc(e.apellido_nombre)}</h3>
      <div class="profile-meta">
        <span>Legajo ${esc(e.legajo)}</span>
        <span>${esc(e.cargo) || 'Sin cargo'}</span>
        <span>${esc(e.sector) || 'Sin sector'}</span>
        <span>${esc(e.lugar_trabajo) || ''}</span>
        <span>Ingreso: ${esc(e.fecha_ingreso) || '-'}</span>
      </div>
    </div>
  `;

  // Formulario de datos personales
  document.getElementById('form-personales').innerHTML = buildPersonalesForm(p);

  // Familiares
  renderFamiliares(f);
}

function fld(label, id, val, type = 'text', placeholder = '') {
  return `
    <div class="form-group">
      <label>${label}</label>
      <input type="${type}" id="p-${id}" value="${esc(val)}" placeholder="${placeholder}">
    </div>
  `;
}

function sel(label, id, opts, val) {
  const options = opts.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('');
  return `
    <div class="form-group">
      <label>${label}</label>
      <select id="p-${id}">${options}</select>
    </div>
  `;
}

function sectionHeader(text) {
  return `<div class="form-group full" style="grid-column:1/-1;padding-top:4px;border-top:1px solid var(--border);margin-top:4px">
    <label style="font-size:12px;color:var(--primary)">${text}</label>
  </div>`;
}

function buildPersonalesForm(d) {
  const v = (key) => d[key] ?? '';
  return `
    ${sectionHeader('Datos personales')}
    ${sel('Sexo', 'sexo', ['Masculino','Femenino','No binario'], v('sexo'))}
    ${fld('Fecha de Nacimiento (dd-mm-aaaa)', 'f_nacimiento', v('f_nacimiento'), 'text', '01-01-1990')}
    ${fld('Teléfono', 'telefono', v('telefono'), 'text', 'Ej: 11-4444-5555')}
    ${fld('E-mail personal', 'email', v('email'), 'email', 'nombre@email.com')}
    ${sel('Nacionalidad', 'nacionalidad', ['Argentina','Boliviana','Brasileña','Chilena','Paraguaya','Uruguaya','Otra'], v('nacionalidad'))}
    ${sel('Estado Civil', 'estado_civil', ['Soltero/a','Casado/a','Divorciado/a','Viudo/a','Unión convivencial'], v('estado_civil'))}

    ${sectionHeader('Educación')}
    ${sel('Nivel Educacional', 'nivel_educacional', ['Primario incompleto','Primario completo','Secundario incompleto','Secundario completo','Terciario','Universitario','Posgrado'], v('nivel_educacional'))}
    ${fld('Título obtenido', 'titulo', v('titulo'), 'text', 'Ej: Lic. en Administración')}

    ${sectionHeader('Domicilio')}
    ${fld('Calle', 'calle', v('calle'))}
    ${fld('Número', 'numero', v('numero'))}
    ${fld('Piso', 'piso', v('piso'))}
    ${fld('Departamento', 'dto', v('dto'))}
    ${fld('Ciudad', 'ciudad', v('ciudad'))}
    ${fld('Localidad', 'localidad', v('localidad'))}
    ${fld('Provincia', 'provincia', v('provincia'))}
    ${fld('Código Postal', 'cp', v('cp'))}
  `;
}

async function guardarPersonales() {
  const ids = [
    'sexo','f_nacimiento','telefono','email','nacionalidad','estado_civil',
    'nivel_educacional','titulo','calle','numero','piso','dto',
    'ciudad','localidad','provincia','cp'
  ];
  const datos = {};
  ids.forEach(id => {
    const el = document.getElementById(`p-${id}`);
    if (el) datos[id] = el.value;
  });

  const res = await py('guardar_datos_personales', m3Legajo, datos);
  if (res.ok) toast('Datos guardados correctamente');
  else toast(res.msg, 'error');
}

// ── FAMILIARES ────────────────────────────────────
function renderFamiliares(familiares) {
  const tbody = document.getElementById('m3-familiares-tbody');
  if (!familiares || familiares.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">
      Sin familiares registrados.
    </td></tr>`;
    return;
  }
  tbody.innerHTML = familiares.map(f => `
    <tr>
      <td>${esc(f.parentesco)}</td>
      <td>${esc(f.nombre_familiar) || '-'}</td>
      <td>${esc(f.f_nacimiento) || '-'}</td>
      <td>${f.tipo_doc ? esc(f.tipo_doc) + ' ' + esc(f.nro_doc || '') : '-'}</td>
      <td>${esc(f.cuil_familiar) || '-'}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="eliminarFamiliar(${f.id})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

function openFamiliarModal() {
  const tiposDoc = ['DNI','Pasaporte','LC','LE'];
  const body = `
    <div class="form-grid">
      <div class="form-group">
        <label>Parentesco *</label>
        <select id="fam-parentesco">
          ${['Cónyuge','Concubino/a','Hijo/a','Hijo/a adoptivo/a','Padre','Madre','Hermano/a','Otro']
            .map(v => `<option>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Nombre completo</label>
        <input type="text" id="fam-nombre" placeholder="Apellido y Nombre">
      </div>
      <div class="form-group">
        <label>Fecha de Nacimiento (dd-mm-aaaa)</label>
        <input type="text" id="fam-fnac" placeholder="01-01-1990">
      </div>
      <div class="form-group">
        <label>Tipo Documento</label>
        <select id="fam-tipodoc">
          ${tiposDoc.map(v => `<option>${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Nro. Documento</label>
        <input type="text" id="fam-nrodoc" placeholder="Sin puntos">
      </div>
      <div class="form-group">
        <label>CUIL</label>
        <input type="text" id="fam-cuil" placeholder="XX-XXXXXXXX-X">
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="agregarFamiliar()">Agregar</button>
  `;
  openModal('Agregar Familiar', body, footer);
  document.querySelector('#modal-overlay .modal-box').classList.add('wide');
}

async function agregarFamiliar() {
  const parentesco     = document.getElementById('fam-parentesco').value;
  const nombre         = document.getElementById('fam-nombre').value.trim();
  const fNac           = document.getElementById('fam-fnac').value.trim();
  const tipoDoc        = document.getElementById('fam-tipodoc').value;
  const nroDoc         = document.getElementById('fam-nrodoc').value.trim();
  const cuil           = document.getElementById('fam-cuil').value.trim();

  const res = await py('agregar_familiar', m3Legajo, parentesco, nombre, fNac, tipoDoc, nroDoc, cuil);
  if (res.ok) {
    closeModal();
    const perfil = await py('get_perfil_empleado', m3Legajo);
    if (perfil.ok) renderFamiliares(perfil.familiares);
    toast('Familiar agregado');
  } else {
    toast(res.msg, 'error');
  }
}

async function eliminarFamiliar(id) {
  if (!confirm('¿Eliminar este familiar del grupo?')) return;
  const res = await py('eliminar_familiar', id);
  if (res.ok) {
    const perfil = await py('get_perfil_empleado', m3Legajo);
    if (perfil.ok) renderFamiliares(perfil.familiares);
    toast('Familiar eliminado');
  } else {
    toast(res.msg, 'error');
  }
}
