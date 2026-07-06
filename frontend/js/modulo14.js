// ── MÓDULO 14: ARCA (SIMULADO) ────────────────────
// Facturación electrónica y alta temprana de empleados.
// No conecta a los webservices oficiales de ARCA — CAE y número
// de trámite se generan en el backend solo para esta demo.

const TIPOS_COMPROBANTE = ['Factura A', 'Factura B', 'Factura C', 'Nota de Crédito B'];

function switchM14Tab(tab, btn) {
  document.querySelectorAll('#module-m14 .tabs .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#module-m14 .tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`m14-tab-${tab}`).classList.add('active');
}

async function loadArca() {
  await loadFacturasArca();
  await loadAltasArca();
}

// ── FACTURACIÓN ELECTRÓNICA ────────────────────────
async function loadFacturasArca() {
  const res   = await py('get_facturas_arca');
  const tbody = document.getElementById('m14-fact-tbody');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">
      Sin facturas generadas.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(f => `
    <tr>
      <td>${esc(f.numero)}</td>
      <td>${esc(f.tipo_comprobante)}</td>
      <td>${esc(f.cliente)}</td>
      <td>$ ${esc(f.monto)}</td>
      <td>${esc(f.fecha)}</td>
      <td>${esc(f.cae)}</td>
      <td><span class="estado-badge aceptado">${esc(f.estado)}</span></td>
    </tr>
  `).join('');
}

function openFacturaModal() {
  const body = `
    <div class="form-grid">
      <div class="form-group full">
        <label>Tipo de Comprobante</label>
        <select id="fact-tipo">
          ${TIPOS_COMPROBANTE.map(t => `<option>${esc(t)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group full">
        <label>Cliente *</label>
        <input type="text" id="fact-cliente" placeholder="Razón social o nombre">
      </div>
      <div class="form-group full">
        <label>Monto ($) *</label>
        <input type="text" id="fact-monto" placeholder="Ej: 45000">
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="guardarFactura()">🧾 Generar (simulado)</button>
  `;
  openModal('Generar Factura', body, footer);
}

async function guardarFactura() {
  const tipo    = document.getElementById('fact-tipo').value;
  const cliente = document.getElementById('fact-cliente').value.trim();
  const monto   = document.getElementById('fact-monto').value.trim();
  if (!cliente || !monto) { toast('Cliente y monto son obligatorios', 'error'); return; }

  const res = await py('generar_factura_arca', tipo, cliente, monto);
  if (res.ok) {
    closeModal();
    loadFacturasArca();
    toast('Factura generada (simulada)');
  } else {
    toast(res.msg, 'error');
  }
}

// ── ALTA TEMPRANA DE EMPLEADOS ─────────────────────
async function loadAltasArca() {
  const res   = await py('get_altas_arca');
  const tbody = document.getElementById('m14-altas-tbody');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">
      Sin empleados activos.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(e => {
    const registrada = e.alta_arca_estado === 'Registrada';
    const badge = registrada
      ? `<span class="estado-badge aceptado">Registrada</span>`
      : `<span class="estado-badge pendiente">Pendiente</span>`;
    return `
      <tr>
        <td>${esc(e.legajo)}</td>
        <td>${esc(e.apellido_nombre)}</td>
        <td>${esc(e.sector) || '-'}</td>
        <td>${esc(e.fecha_ingreso) || '-'}</td>
        <td>${badge}</td>
        <td>${esc(e.alta_arca_tramite) || '-'}</td>
        <td>${registrada
          ? '<span style="color:var(--text-muted)">Completa</span>'
          : `<button class="btn btn-primary btn-sm" onclick="registrarAlta('${esc(e.legajo)}')">Registrar Alta</button>`}</td>
      </tr>
    `;
  }).join('');
}

async function registrarAlta(legajo) {
  if (!confirm('¿Registrar el alta temprana (simulada) de este empleado?')) return;
  const res = await py('registrar_alta_arca', legajo);
  if (res.ok) { loadAltasArca(); toast('Alta registrada (simulada)'); }
  else toast(res.msg, 'error');
}
