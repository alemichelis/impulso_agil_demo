// ── MÓDULO 13: NÓMINA Y PAGOS ─────────────────────

function switchM13Tab(tab, btn) {
  document.querySelectorAll('#module-m13 .tabs .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#module-m13 .tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`m13-tab-${tab}`).classList.add('active');
}

async function loadNomina() {
  await loadLiquidacion();
  await loadVencimientos();
}

// ── LIQUIDACIÓN DE SUELDOS ─────────────────────────
async function loadLiquidacion() {
  const res   = await py('get_liquidacion_sueldos');
  const tbody = document.getElementById('m13-liq-tbody');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">
      Sin empleados activos.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(e => `
    <tr>
      <td>${esc(e.legajo)}</td>
      <td>${esc(e.apellido_nombre)}</td>
      <td>${esc(e.sector) || '-'}</td>
      <td>${esc(e.banco) || '-'}</td>
      <td>${esc(e.cbu) || '-'}</td>
      <td>${e.sueldo_basico ? '$ ' + esc(e.sueldo_basico) : '-'}</td>
      <td>${e.anticipos ? '$ ' + e.anticipos : '-'}</td>
      <td><strong>$ ${e.neto_a_pagar}</strong></td>
    </tr>
  `).join('');
}

function exportarLiquidacion() {
  window.location.href = '/api/exportar_liquidacion_xls';
  toast('Descargando liquidación...');
}

// ── ALERTAS DE VENCIMIENTOS ────────────────────────
function parseFechaDDMMYYYY(str) {
  const m = String(str || '').match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

function badgeVencimiento(v, hoy) {
  if (v.estado === 'Pagado') return `<span class="estado-badge aceptado">Pagado</span>`;
  const fecha = parseFechaDDMMYYYY(v.fecha_vencimiento);
  if (!fecha) return `<span class="estado-badge pendiente">Pendiente</span>`;
  const dias = Math.round((fecha - hoy) / 86400000);
  if (dias < 0) return `<span class="estado-badge rechazado">Vencido</span>`;
  if (dias <= 7) return `<span class="estado-badge pendiente">Vence en ${dias}d</span>`;
  return `<span class="estado-badge pendiente">Pendiente</span>`;
}

async function loadVencimientos() {
  const res   = await py('get_vencimientos');
  const tbody = document.getElementById('m13-venc-tbody');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">
      Sin vencimientos cargados.
    </td></tr>`;
    return;
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  tbody.innerHTML = res.data.map(v => `
    <tr>
      <td>${esc(v.concepto)}</td>
      <td>${esc(v.fecha_vencimiento)}</td>
      <td>${v.monto ? '$ ' + esc(v.monto) : '-'}</td>
      <td>${badgeVencimiento(v, hoy)}</td>
      <td class="actions-cell">
        ${v.estado === 'Pendiente'
          ? `<button class="btn btn-success btn-sm" onclick="marcarVencimiento(${v.id}, 'Pagado')">✔ Marcar pagado</button>`
          : `<button class="btn btn-secondary btn-sm" onclick="marcarVencimiento(${v.id}, 'Pendiente')">↺ Reabrir</button>`}
        <button class="btn btn-danger btn-sm" onclick="eliminarVencimiento(${v.id})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

function openVencimientoModal() {
  const body = `
    <div class="form-grid">
      <div class="form-group full">
        <label>Concepto *</label>
        <input type="text" id="venc-concepto" placeholder="Ej: Pago de cargas sociales">
      </div>
      <div class="form-group">
        <label>Fecha de Vencimiento (dd-mm-aaaa) *</label>
        <input type="text" id="venc-fecha" placeholder="10-08-2026">
      </div>
      <div class="form-group">
        <label>Monto ($)</label>
        <input type="text" id="venc-monto" placeholder="Ej: 150000">
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarVencimiento()">💾 Guardar</button>
  `;
  openModal('Nuevo Vencimiento', body, footer);
}

async function guardarVencimiento() {
  const concepto = document.getElementById('venc-concepto').value.trim();
  const fecha    = document.getElementById('venc-fecha').value.trim();
  const monto    = document.getElementById('venc-monto').value.trim();
  if (!concepto || !fecha) { toast('Concepto y fecha son obligatorios', 'error'); return; }

  const res = await py('guardar_vencimiento', { concepto, fecha_vencimiento: fecha, monto });
  if (res.ok) {
    closeModal();
    loadVencimientos();
    toast('Vencimiento guardado');
  } else {
    toast(res.msg, 'error');
  }
}

async function marcarVencimiento(id, estado) {
  const res = await py('actualizar_estado_vencimiento', id, estado);
  if (res.ok) { loadVencimientos(); toast(`Marcado como "${estado}"`); }
  else toast(res.msg, 'error');
}

async function eliminarVencimiento(id) {
  if (!confirm('¿Eliminar este vencimiento?')) return;
  const res = await py('eliminar_vencimiento', id);
  if (res.ok) { loadVencimientos(); toast('Vencimiento eliminado'); }
  else toast(res.msg, 'error');
}
