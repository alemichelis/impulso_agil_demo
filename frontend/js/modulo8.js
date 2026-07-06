// ── MÓDULO 8: GESTIÓN DE SOLICITUDES (ADMIN) ─────

async function loadSolicitudesAdmin() {
  const res   = await py('get_solicitudes');
  const tbody = document.getElementById('m8-tbody');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:24px">
      Sin solicitudes registradas.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = res.data.map(s => `
    <tr>
      <td>${esc(s.id)}</td>
      <td>${esc(s.legajo)}</td>
      <td>${esc(s.apellido_nombre)}</td>
      <td>${esc(s.sector) || '-'}</td>
      <td>${esc(s.tipo_solicitud)}</td>
      <td>${esc(detalleSolicitud(s)) || '-'}</td>
      <td>${esc(s.fecha_inicio) || '-'}</td>
      <td>${esc(s.dias) || '-'}</td>
      <td>${esc(s.monto) || '-'}</td>
      <td>${estadoBadgeSolicitud(s.estado)}</td>
      <td class="actions-cell">
        ${s.estado === 'Pendiente' ? `
          <button class="btn btn-success btn-sm" onclick="resolverSolicitud(${s.id}, 'Aceptado')">✔ Aceptar</button>
          <button class="btn btn-danger btn-sm" onclick="resolverSolicitud(${s.id}, 'Rechazado')">✕ Rechazar</button>
        ` : `<span style="color:var(--text-muted)">Resuelta</span>`}
      </td>
    </tr>
  `).join('');
}

async function resolverSolicitud(id, nuevoEstado) {
  if (!confirm(`¿Marcar esta solicitud como "${nuevoEstado}"?`)) return;
  const res = await py('actualizar_estado_solicitud', id, nuevoEstado);
  if (res.ok) {
    loadSolicitudesAdmin();
    toast(`Solicitud marcada como "${nuevoEstado}"`);
  } else {
    toast(res.msg, 'error');
  }
}

function exportarNovedades() {
  window.location.href = '/api/exportar_novedades_xls';
  toast('Descargando novedades a liquidar...');
}
