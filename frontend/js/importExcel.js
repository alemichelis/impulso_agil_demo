// ── IMPORTAR / EXPORTAR PLANTILLAS EXCEL ─────────
// Helpers genéricos usados por Parámetros (m1) y Empleados (m2) para
// descargar una plantilla .xlsx con las columnas esperadas y para leer
// un .xlsx ya completado y devolver sus filas como objetos.

function descargarPlantillaExcel(filename, columnas, ejemplo = {}) {
  const ws = XLSX.utils.json_to_sheet([ejemplo], { header: columnas });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  XLSX.writeFile(wb, filename);
}

function leerFilasExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function celda(fila, campo) {
  return String(fila[campo] ?? '').trim();
}

function mostrarResumenImportacion(titulo, exitos, errores) {
  let msg = `${exitos} registro(s) importado(s) correctamente.`;
  if (errores.length) {
    const detalle = errores.slice(0, 15).map(e => `Fila ${e.fila}: ${e.msg}`).join('\n');
    msg += `\n\n${errores.length} fila(s) con error:\n${detalle}`;
    if (errores.length > 15) msg += `\n... y ${errores.length - 15} más.`;
  }
  alert(`${titulo}\n\n${msg}`);
}
