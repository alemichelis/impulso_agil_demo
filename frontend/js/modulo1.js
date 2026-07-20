// ── MÓDULO 1: PARÁMETROS ─────────────────────────
let m1EditId = null;

async function loadParametros() {
  const tabla = document.getElementById('m1-selector').value;
  const res   = await py('get_parametros', tabla);
  const tbody = document.getElementById('m1-tbody');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">
      Sin registros. Agregue el primero con "+ Nuevo registro".
    </td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(r => `
    <tr>
      <td style="color:var(--text-muted)">${esc(r.id)}</td>
      <td><strong>${esc(r.codigo)}</strong></td>
      <td>${esc(r.nombre)}</td>
      <td class="actions-cell">
        <button class="btn btn-secondary btn-sm"
          onclick="openParamModal(${r.id}, '${esc(r.codigo)}', '${esc(r.nombre)}')">
          Editar
        </button>
        <button class="btn btn-danger btn-sm" onclick="eliminarParametro(${r.id})">
          Eliminar
        </button>
      </td>
    </tr>
  `).join('');
}

function openParamModal(id = null, codigo = '', nombre = '') {
  m1EditId = id;
  const body = `
    <div class="form-group">
      <label>Código</label>
      <input type="text" id="param-codigo" value="${esc(codigo)}" placeholder="Ej: 001" autofocus>
    </div>
    <div class="form-group">
      <label>Nombre</label>
      <input type="text" id="param-nombre" value="${esc(nombre)}" placeholder="Nombre descriptivo">
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarParametro()">💾 Guardar</button>
  `;
  openModal(id ? 'Editar Parámetro' : 'Nuevo Parámetro', body, footer);
}

async function guardarParametro() {
  const tabla  = document.getElementById('m1-selector').value;
  const codigo = document.getElementById('param-codigo').value.trim();
  const nombre = document.getElementById('param-nombre').value.trim();
  if (!codigo || !nombre) { toast('Complete código y nombre', 'error'); return; }

  const res = await py('guardar_parametro', tabla, codigo, nombre, m1EditId);
  if (res.ok) {
    closeModal();
    loadParametros();
    toast(m1EditId ? 'Parámetro actualizado' : 'Parámetro guardado');
    m1EditId = null;
  } else {
    toast(res.msg, 'error');
  }
}

async function eliminarParametro(id) {
  if (!confirm('¿Eliminar este registro?')) return;
  const tabla = document.getElementById('m1-selector').value;
  const res   = await py('eliminar_parametro', tabla, id);
  if (res.ok) { loadParametros(); toast('Registro eliminado'); }
  else toast(res.msg, 'error');
}

// ── IMPORTAR / EXPORTAR EXCEL ─────────────────────
function descargarPlantillaParametros() {
  const tabla = document.getElementById('m1-selector').value;
  const nombreArchivo = `plantilla_${tabla.toLowerCase().replace(/\s+/g, '_')}.xlsx`;
  descargarPlantillaExcel(nombreArchivo, ['codigo', 'nombre'], { codigo: '001', nombre: 'Ejemplo' });
}

async function importarParametrosExcel(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const tabla = document.getElementById('m1-selector').value;

  let filas;
  try {
    filas = await leerFilasExcel(file);
  } catch (e) {
    toast('No se pudo leer el archivo: ' + e.message, 'error');
    inputEl.value = '';
    return;
  }

  let exitos = 0;
  const errores = [];
  for (let i = 0; i < filas.length; i++) {
    const codigo = celda(filas[i], 'codigo');
    const nombre = celda(filas[i], 'nombre');
    if (!codigo || !nombre) {
      errores.push({ fila: i + 2, msg: 'Código y Nombre son obligatorios' });
      continue;
    }
    const res = await py('guardar_parametro', tabla, codigo, nombre, null);
    if (res.ok) exitos++;
    else errores.push({ fila: i + 2, msg: res.msg });
  }

  inputEl.value = '';
  mostrarResumenImportacion(`Importación — ${tabla}`, exitos, errores);
  loadParametros();
}
