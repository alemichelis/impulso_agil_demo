// ── MÓDULO 12: ENCUESTA DE CLIMA ─────────────────

const ENCUESTA_PREGUNTAS = [
  { id: 'p1', texto: 'Me siento cómodo/a con el ambiente de trabajo' },
  { id: 'p2', texto: 'Mi jefe/a directo/a me brinda el apoyo que necesito' },
  { id: 'p3', texto: 'Tengo las herramientas necesarias para hacer mi trabajo' },
  { id: 'p4', texto: 'Siento que mi trabajo es valorado' },
  { id: 'p5', texto: 'Recomendaría esta empresa como un buen lugar para trabajar' },
];
let m12Respuestas = {};

async function loadEncuestaClima() {
  const cont = document.getElementById('m12-content');
  if (state.role === 'admin') await renderResultadosEncuesta(cont);
  else await renderFormularioEncuesta(cont);
}

function barraPregunta(texto, valor) {
  return `
    <div class="survey-result-row">
      <span class="survey-result-label">${esc(texto)}</span>
      <div class="survey-bar-track"><div class="survey-bar-fill" style="width:${(valor / 5) * 100}%"></div></div>
      <span class="survey-result-score">${valor} / 5</span>
    </div>
  `;
}

async function renderResultadosEncuesta(cont) {
  const res = await py('get_resultados_encuesta');
  if (!res.ok) { toast(res.msg, 'error'); return; }

  if (res.total === 0) {
    cont.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">
      Todavía nadie respondió la encuesta.
    </div>`;
    return;
  }

  cont.innerHTML = `
    <div class="card card-body">
      <h3 style="margin-bottom:16px">Resultados promedio (${res.total} respuesta${res.total === 1 ? '' : 's'})</h3>
      ${ENCUESTA_PREGUNTAS.map(p => barraPregunta(p.texto, res.promedios[p.id])).join('')}
    </div>
    <div class="card table-scroll" style="margin-top:16px">
      <table class="data-table compact">
        <thead>
          <tr>
            <th>Legajo</th><th>Empleado</th><th>Sector</th>
            ${ENCUESTA_PREGUNTAS.map((p, i) => `<th>P${i + 1}</th>`).join('')}
            <th>Comentario</th><th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          ${res.respuestas.map(r => `
            <tr>
              <td>${esc(r.legajo)}</td><td>${esc(r.apellido_nombre)}</td><td>${esc(r.sector) || '-'}</td>
              ${ENCUESTA_PREGUNTAS.map(p => `<td>${esc(r[p.id])}</td>`).join('')}
              <td>${esc(r.comentario) || '-'}</td><td>${esc(r.fecha)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderFormularioEncuesta(cont) {
  const estado = await py('get_estado_encuesta', state.legajo);
  if (!estado.ok) { toast(estado.msg, 'error'); return; }

  if (estado.respondida) {
    const r = estado.respuesta;
    cont.innerHTML = `
      <div class="card card-body" style="text-align:center">
        <div style="font-size:34px;margin-bottom:10px">🙏</div>
        <h3>¡Gracias por completar la encuesta!</h3>
        <p style="color:var(--text-muted);margin-top:6px">Tus respuestas ayudan a mejorar el ambiente de trabajo.</p>
      </div>
      <div class="card card-body" style="margin-top:16px">
        ${ENCUESTA_PREGUNTAS.map(p => barraPregunta(p.texto, r[p.id])).join('')}
        ${r.comentario ? `<p style="margin-top:14px;color:var(--text-muted)"><em>"${esc(r.comentario)}"</em></p>` : ''}
      </div>
    `;
    return;
  }

  m12Respuestas = {};
  cont.innerHTML = `
    <div class="card card-body">
      <p style="color:var(--text-muted);margin-bottom:18px">
        Tu respuesta es visible para RR. HH. para poder actuar sobre tu opinión. Respondé con sinceridad.
      </p>
      ${ENCUESTA_PREGUNTAS.map(p => `
        <div class="survey-question">
          <label>${esc(p.texto)}</label>
          <div class="survey-scale" data-field="${p.id}">
            ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="survey-scale-btn" onclick="seleccionarPuntaje('${p.id}', ${n}, this)">${n}</button>`).join('')}
          </div>
        </div>
      `).join('')}
      <div class="form-group full" style="margin-top:10px">
        <label>Comentario (opcional)</label>
        <textarea id="encuesta-comentario" rows="3"
          style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;resize:vertical;outline:none;font-family:inherit"></textarea>
      </div>
      <div class="form-actions" style="background:none;border:none;padding:14px 0 0;text-align:right">
        <button class="btn btn-primary" onclick="enviarEncuesta()">📈 Enviar Encuesta</button>
      </div>
    </div>
  `;
}

function seleccionarPuntaje(campo, valor, btn) {
  m12Respuestas[campo] = valor;
  btn.parentElement.querySelectorAll('.survey-scale-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function enviarEncuesta() {
  const faltantes = ENCUESTA_PREGUNTAS.filter(p => !m12Respuestas[p.id]);
  if (faltantes.length > 0) { toast('Respondé todas las preguntas antes de enviar', 'error'); return; }

  const comentario = document.getElementById('encuesta-comentario').value.trim();
  const r = m12Respuestas;
  const res = await py('guardar_respuesta_encuesta', state.legajo, r.p1, r.p2, r.p3, r.p4, r.p5, comentario);
  if (res.ok) {
    toast('¡Gracias por tu respuesta!');
    loadEncuestaClima();
  } else {
    toast(res.msg, 'error');
  }
}
