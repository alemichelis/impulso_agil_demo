// ── MÓDULO 4: REPORTES ───────────────────────────
const M4_COLS = {
  legajo: 'Legajo', apellido_nombre: 'Apellido y Nombre',
  cuil: 'CUIL', tipo_doc: 'Tipo Doc', nro_doc: 'Nro Doc',
  lugar_trabajo: 'Lugar Trabajo', jornada: 'Jornada',
  fecha_ingreso: 'F. Ingreso', fecha_antiguedad: 'F. Antigüedad',
  cargo: 'Cargo', tipo_empleado: 'Tipo Emp', sector: 'Sector',
  jefe_admin: 'Jefe Admin', centro_costo: 'Cto. Costo',
  sexo: 'Sexo', telefono: 'Teléfono', email: 'E-mail',
  f_nacimiento: 'F. Nac.', nacionalidad: 'Nacionalidad',
  estado_civil: 'Estado Civil', nivel_educacional: 'Nivel Edu', titulo: 'Título',
  calle: 'Calle', numero: 'Número', piso: 'Piso', dto: 'Dto',
  ciudad: 'Ciudad', localidad: 'Localidad', provincia: 'Provincia', cp: 'CP',
  sueldo_basico: 'Sueldo Básico', banco: 'Banco', cbu: 'CBU', tipo_cuenta: 'Tipo Cuenta',
  obra_social: 'Obra Social', plan_medico: 'Plan Médico',
  convenio_cct: 'Convenio CCT', categoria_convenio: 'Categoría Convenio',
  familiares: 'Familiares'
};

async function loadConsolidado() {
  const res = await py('get_consolidado');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  const cols = Object.keys(M4_COLS);

  document.getElementById('m4-thead').innerHTML =
    `<tr>${cols.map(c => `<th>${M4_COLS[c]}</th>`).join('')}</tr>`;

  if (res.data.length === 0) {
    document.getElementById('m4-tbody').innerHTML =
      `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--text-muted);padding:24px">Sin datos</td></tr>`;
    return;
  }

  document.getElementById('m4-tbody').innerHTML = res.data.map(r =>
    `<tr>${cols.map(c => `<td>${esc(r[c] ?? '')}</td>`).join('')}</tr>`
  ).join('');
}

function exportarXLS() {
  window.location.href = '/api/exportar_xls';
  toast('Descargando archivo...');
}
