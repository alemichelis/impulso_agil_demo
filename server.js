'use strict';
const express        = require('express');
const session        = require('express-session');
const { DatabaseSync: Database } = require('node:sqlite');
const path           = require('path');

const DB_PATH = path.join(__dirname, 'rrhh_parametros.db');
const db      = new Database(DB_PATH);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(session({
  secret:            process.env.SECRET_KEY || 'rrhh-dev-secret-2024',
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 8 * 60 * 60 * 1000 }
}));

// ── HELPERS ────────────────────────────────────────────────────────────────

function randDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function fechaHora() {
  const d = new Date();
  const pad = x => String(x).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fechaHoy() {
  const d = new Date();
  const pad = x => String(x).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function enviarXls(res, filename, data) {
  if (!data.length) return res.status(400).json({ ok: false, msg: 'No hay datos para exportar' });
  const headers = Object.keys(data[0]);
  const lines   = [headers.join('\t'), ...data.map(r => headers.map(h => r[h] ?? '').join('\t'))];
  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(Buffer.from('﻿' + lines.join('\n'), 'utf8'));
}

// ── DISPATCHER ────────────────────────────────────────────────────────────────

app.post('/api/:method', (req, res) => {
  const args    = Array.isArray(req.body?.args) ? req.body.args : [];
  const handler = METHODS[req.params.method];
  if (!handler) return res.status(404).json({ ok: false, msg: 'Método no encontrado' });
  try {
    res.json(handler(req, args));
  } catch (e) {
    res.json({ ok: false, msg: e.message });
  }
});

// ── AUTH ──────────────────────────────────────────────────────────────────────

function getSesion(req) {
  return {
    usuario: req.session.usuario ?? null,
    rol:     req.session.rol     ?? null,
    legajo:  req.session.legajo  ?? null,
  };
}

function loginAdmin(req, [usuario, password]) {
  const row = db.prepare(
    'SELECT id FROM admin_usuarios WHERE usuario=? AND password=?'
  ).get(usuario, password);
  if (row) {
    req.session.usuario = usuario;
    req.session.rol     = 'admin';
    req.session.legajo  = null;
    return { ok: true };
  }
  return { ok: false, msg: 'Usuario o contraseña incorrectos' };
}

function loginEmpleado(req, [legajo, nroDoc]) {
  const row = db.prepare(
    'SELECT legajo, apellido_nombre FROM empleados WHERE legajo=? AND nro_doc=?'
  ).get(legajo.trim(), nroDoc.trim());
  if (row) {
    req.session.usuario = row.apellido_nombre;
    req.session.rol     = 'empleado';
    req.session.legajo  = row.legajo;
    return { ok: true, nombre: row.apellido_nombre };
  }
  return { ok: false, msg: 'Legajo o número de documento incorrecto' };
}

function logout(req) {
  req.session.destroy(() => {});
  return { ok: true };
}

// ── MÓDULO 1: PARÁMETROS ──────────────────────────────────────────────────────

const TABLAS = {
  'CARGOS':           'cargos',
  'SECTORES':         'sectores',
  'CENTROS DE COSTO': 'centros_costo',
  'LUGAR DE TRABAJO': 'lugares_trabajo',
};

function getParametros(req, [tabla]) {
  const t = TABLAS[tabla];
  if (!t) return { ok: false, msg: 'Tabla inválida' };
  const rows = db.prepare(`SELECT id, codigo, nombre FROM ${t} ORDER BY nombre`).all();
  return { ok: true, data: rows };
}

function guardarParametro(req, [tabla, codigo, nombre, id = null]) {
  const t = TABLAS[tabla];
  if (!t) return { ok: false, msg: 'Tabla inválida' };
  try {
    if (id) {
      db.prepare(`UPDATE ${t} SET codigo=?, nombre=? WHERE id=?`).run(codigo.trim(), nombre.trim(), id);
    } else {
      db.prepare(`INSERT INTO ${t} (codigo, nombre) VALUES (?, ?)`).run(codigo.trim(), nombre.trim());
    }
    return { ok: true };
  } catch (e) {
    if (e.message.includes('UNIQUE')) return { ok: false, msg: 'El código ya existe en esta tabla' };
    throw e;
  }
}

function eliminarParametro(req, [tabla, id]) {
  const t = TABLAS[tabla];
  if (!t) return { ok: false, msg: 'Tabla inválida' };
  db.prepare(`DELETE FROM ${t} WHERE id=?`).run(id);
  return { ok: true };
}

// ── MÓDULO 2: EMPLEADOS ───────────────────────────────────────────────────────

function getListasParametros() {
  const lista = (sql) => db.prepare(sql).all().map(r => r.nombre);
  return {
    ok:            true,
    lugares:       lista('SELECT nombre FROM lugares_trabajo ORDER BY nombre'),
    cargos:        lista('SELECT nombre FROM cargos ORDER BY nombre'),
    sectores:      lista('SELECT nombre FROM sectores ORDER BY nombre'),
    centros_costo: lista('SELECT nombre FROM centros_costo ORDER BY nombre'),
    jefes: ['Ninguno', ...lista('SELECT apellido_nombre AS nombre FROM empleados ORDER BY apellido_nombre')],
  };
}

const EMPLEADO_CAMPOS_BASE = [
  'apellido_nombre', 'cuil', 'tipo_doc', 'nro_doc',
  'lugar_trabajo', 'jornada', 'fecha_ingreso', 'fecha_antiguedad',
  'cargo', 'tipo_empleado', 'sector', 'jefe_admin', 'centro_costo'
];
const EMPLEADO_CAMPOS_EXTRA = [
  'sueldo_basico', 'banco', 'cbu', 'tipo_cuenta',
  'obra_social', 'plan_medico', 'convenio_cct', 'categoria_convenio'
];

function getEmpleados() {
  const rows = db.prepare(`
    SELECT legajo, apellido_nombre, cuil, tipo_doc, nro_doc,
           lugar_trabajo, jornada, fecha_ingreso, fecha_antiguedad,
           cargo, tipo_empleado, sector, jefe_admin, centro_costo,
           estado, fecha_baja, motivo_baja,
           ${EMPLEADO_CAMPOS_EXTRA.join(', ')},
           alta_arca_estado, alta_arca_fecha, alta_arca_tramite
    FROM empleados ORDER BY apellido_nombre
  `).all();
  return { ok: true, data: rows };
}

function guardarEmpleado(req, [datos]) {
  const leg       = datos.legajo.trim();
  const baseVals  = EMPLEADO_CAMPOS_BASE.map(c => datos[c]);
  const extraVals = EMPLEADO_CAMPOS_EXTRA.map(c => datos[c] ?? '');
  try {
    const exists = db.prepare('SELECT 1 FROM empleados WHERE legajo=?').get(leg);
    if (exists) {
      const sets = [...EMPLEADO_CAMPOS_BASE, ...EMPLEADO_CAMPOS_EXTRA].map(c => `${c}=?`).join(', ');
      db.prepare(`UPDATE empleados SET ${sets} WHERE legajo=?`).run(...baseVals, ...extraVals, leg);
    } else {
      const cols         = ['legajo', ...EMPLEADO_CAMPOS_BASE, 'estado', ...EMPLEADO_CAMPOS_EXTRA];
      const placeholders  = ['?', ...EMPLEADO_CAMPOS_BASE.map(() => '?'), "'activo'", ...EMPLEADO_CAMPOS_EXTRA.map(() => '?')];
      db.prepare(`INSERT INTO empleados (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`)
        .run(leg, ...baseVals, ...extraVals);
    }
    return { ok: true };
  } catch (e) {
    if (e.message.includes('UNIQUE')) return { ok: false, msg: 'El legajo ya existe' };
    throw e;
  }
}

function eliminarEmpleado(req, [legajo]) {
  db.prepare('DELETE FROM empleados WHERE legajo=?').run(legajo);
  db.prepare('DELETE FROM empleados_datos_personales WHERE legajo=?').run(legajo);
  db.prepare('DELETE FROM empleados_familiares WHERE legajo=?').run(legajo);
  return { ok: true };
}

// ── MÓDULO 3: ONBOARDING ──────────────────────────────────────────────────────

function getPerfilEmpleado(req, [legajo]) {
  const emp = db.prepare(`
    SELECT legajo, apellido_nombre, cuil, cargo, sector, lugar_trabajo, fecha_ingreso
    FROM empleados WHERE legajo=?
  `).get(legajo);
  if (!emp) return { ok: false, msg: 'Empleado no encontrado' };
  const pers = db.prepare('SELECT * FROM empleados_datos_personales WHERE legajo=?').get(legajo);
  const fams = db.prepare(`
    SELECT id, parentesco, nombre_familiar, f_nacimiento, tipo_doc, nro_doc, cuil_familiar
    FROM empleados_familiares WHERE legajo=?
  `).all(legajo);
  return { ok: true, empleado: emp, personales: pers || {}, familiares: fams };
}

function guardarDatosPersonales(req, [legajo, datos]) {
  const campos = [
    'sexo', 'calle', 'numero', 'piso', 'dto', 'ciudad', 'localidad',
    'provincia', 'cp', 'telefono', 'f_nacimiento', 'nacionalidad',
    'estado_civil', 'nivel_educacional', 'titulo', 'email'
  ];
  const vals   = campos.map(c => datos[c] ?? '');
  const exists = db.prepare('SELECT 1 FROM empleados_datos_personales WHERE legajo=?').get(legajo);
  if (exists) {
    const sets = campos.map(c => `${c}=?`).join(', ');
    db.prepare(`UPDATE empleados_datos_personales SET ${sets} WHERE legajo=?`).run(...vals, legajo);
  } else {
    const cols = campos.join(', ');
    const phs  = campos.map(() => '?').join(', ');
    db.prepare(`INSERT INTO empleados_datos_personales (legajo, ${cols}) VALUES (?, ${phs})`).run(legajo, ...vals);
  }
  return { ok: true };
}

function agregarFamiliar(req, [legajo, parentesco, nombre_familiar, f_nacimiento, tipo_doc, nro_doc, cuil_familiar]) {
  db.prepare(`
    INSERT INTO empleados_familiares
      (legajo, parentesco, nombre_familiar, f_nacimiento, tipo_doc, nro_doc, cuil_familiar)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(legajo, parentesco, nombre_familiar, f_nacimiento, tipo_doc, nro_doc, cuil_familiar);
  return { ok: true };
}

function eliminarFamiliar(req, [id]) {
  db.prepare('DELETE FROM empleados_familiares WHERE id=?').run(id);
  return { ok: true };
}

// ── MÓDULO 5: FICHA DE EMPLEADO ──────────────────────────────────────────────

function getFichaEmpleado(req, [criterio, valor]) {
  const mapeo = {
    legajo:           'e.legajo',
    apellido_nombre:  'e.apellido_nombre',
    cuil:             'e.cuil',
    nro_doc:          'e.nro_doc',
  };
  const col = mapeo[criterio];
  if (!col) return { ok: false, msg: 'Criterio inválido' };
  const emp = db.prepare(`
    SELECT e.legajo, e.apellido_nombre, e.cuil, e.tipo_doc, e.nro_doc,
           e.lugar_trabajo, e.jornada, e.fecha_ingreso, e.fecha_antiguedad,
           e.cargo, e.tipo_empleado, e.sector, e.jefe_admin, e.centro_costo,
           e.estado, e.fecha_baja, e.motivo_baja,
           e.sueldo_basico, e.banco, e.cbu, e.tipo_cuenta,
           e.obra_social, e.plan_medico, e.convenio_cct, e.categoria_convenio,
           p.sexo, p.f_nacimiento, p.telefono, p.email, p.nacionalidad,
           p.estado_civil, p.nivel_educacional, p.titulo,
           p.calle, p.numero, p.piso, p.dto, p.ciudad, p.localidad, p.provincia, p.cp
    FROM empleados e
    LEFT JOIN empleados_datos_personales p ON e.legajo = p.legajo
    WHERE ${col} LIKE ?
    LIMIT 1
  `).get(`%${valor}%`);
  if (!emp) return { ok: false, msg: 'Empleado no encontrado' };
  const fams = db.prepare(`
    SELECT parentesco, nombre_familiar, cuil_familiar
    FROM empleados_familiares WHERE legajo=?
  `).all(emp.legajo);
  return { ok: true, data: { ...emp, familiares: fams } };
}

// ── MÓDULO 6: BAJA DE EMPLEADOS ───────────────────────────────────────────────

function buscarEmpleadoParaBaja(req, [criterio, valor]) {
  const mapeo = { legajo: 'legajo', apellido_nombre: 'apellido_nombre', cuil: 'cuil', nro_doc: 'nro_doc' };
  const col = mapeo[criterio];
  if (!col) return { ok: false, msg: 'Criterio inválido' };
  const row = db.prepare(
    `SELECT legajo, apellido_nombre, estado, fecha_baja FROM empleados WHERE ${col} LIKE ? LIMIT 1`
  ).get(`%${valor}%`);
  if (!row) return { ok: false, msg: 'Empleado no encontrado' };
  return { ok: true, data: row };
}

function registrarBaja(req, [legajo, fecha_baja, motivo_baja, comentario_baja]) {
  db.prepare(`
    UPDATE empleados
    SET fecha_baja=?, motivo_baja=?, comentario_baja=?, estado='inactivo'
    WHERE legajo=?
  `).run(fecha_baja, motivo_baja, comentario_baja, legajo);
  return { ok: true };
}

// ── MÓDULO 4: CONSOLIDADO Y EXPORTAR ─────────────────────────────────────────

function getConsolidado() {
  const empleados = db.prepare(`
    SELECT legajo, apellido_nombre, cuil, tipo_doc, nro_doc,
           lugar_trabajo, jornada, fecha_ingreso, fecha_antiguedad,
           cargo, tipo_empleado, sector, jefe_admin, centro_costo,
           estado, fecha_baja, motivo_baja, ${EMPLEADO_CAMPOS_EXTRA.join(', ')}
    FROM empleados ORDER BY apellido_nombre
  `).all();

  return {
    ok:   true,
    data: empleados.map(emp => {
      const fila = { ...emp };
      const pers = db.prepare(`
        SELECT sexo, calle, numero, piso, dto, ciudad, localidad,
               provincia, cp, telefono, f_nacimiento, nacionalidad,
               estado_civil, nivel_educacional, titulo, email
        FROM empleados_datos_personales WHERE legajo=?
      `).get(emp.legajo);
      const vacios = { sexo:'',calle:'',numero:'',piso:'',dto:'',ciudad:'',localidad:'',
                       provincia:'',cp:'',telefono:'',f_nacimiento:'',nacionalidad:'',
                       estado_civil:'',nivel_educacional:'',titulo:'',email:'' };
      Object.assign(fila, pers || vacios);
      const fams = db.prepare('SELECT parentesco, cuil_familiar FROM empleados_familiares WHERE legajo=?').all(emp.legajo);
      fila.familiares = fams.length
        ? fams.map(f => `${f.parentesco} (${f.cuil_familiar})`).join(', ')
        : 'Sin familiares registrados';
      return fila;
    })
  };
}

app.get('/api/exportar_xls', (req, res) => {
  const consolidado = getConsolidado();
  if (!consolidado.ok) return res.status(500).json(consolidado);
  enviarXls(res, 'nomina_rrhh.xls', consolidado.data);
});

// ── MÓDULO 7: SOLICITUDES Y PEDIDOS (EMPLEADO) ───────────────────────────────

function crearSolicitud(req, [legajo, tipo_solicitud, detalle_licencia, fecha_inicio, dias, monto, consulta_texto]) {
  const emp = db.prepare('SELECT apellido_nombre, sector FROM empleados WHERE legajo=?').get(legajo);
  if (!emp) return { ok: false, msg: 'Empleado no encontrado' };
  db.prepare(`
    INSERT INTO solicitudes (
      legajo, apellido_nombre, sector, tipo_solicitud,
      detalle_licencia, fecha_inicio, dias, monto, consulta_texto, estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
  `).run(legajo, emp.apellido_nombre, emp.sector, tipo_solicitud, detalle_licencia, fecha_inicio, dias, monto, consulta_texto);
  return { ok: true };
}

function getMisSolicitudes(req, [legajo]) {
  const rows = db.prepare(`
    SELECT id, tipo_solicitud, detalle_licencia, fecha_inicio, dias, monto, consulta_texto, estado
    FROM solicitudes WHERE legajo=? ORDER BY id DESC
  `).all(legajo);
  return { ok: true, data: rows };
}

// ── MÓDULO 8: GESTIÓN DE SOLICITUDES (ADMIN) ─────────────────────────────────

function getSolicitudes() {
  const rows = db.prepare(`
    SELECT id, legajo, apellido_nombre, sector, tipo_solicitud,
           detalle_licencia, fecha_inicio, dias, monto, consulta_texto, estado
    FROM solicitudes ORDER BY id DESC
  `).all();
  return { ok: true, data: rows };
}

function actualizarEstadoSolicitud(req, [id, nuevo_estado]) {
  if (!['Aceptado', 'Rechazado'].includes(nuevo_estado)) return { ok: false, msg: 'Estado inválido' };
  db.prepare('UPDATE solicitudes SET estado=? WHERE id=?').run(nuevo_estado, id);
  return { ok: true };
}

app.get('/api/exportar_novedades_xls', (req, res) => {
  const solicitudes = getSolicitudes();
  if (!solicitudes.ok) return res.status(500).json(solicitudes);
  const data = solicitudes.data.filter(s => s.estado === 'Aceptado');
  if (!data.length) return res.status(400).json({ ok: false, msg: 'No hay novedades aceptadas para exportar' });
  enviarXls(res, 'novedades_a_liquidar.xls', data);
});

// ── MÓDULO 9: RECONOCIMIENTOS ─────────────────────────────────────────────────

function crearReconocimiento(req, [legajo_de, legajo_para, categoria, mensaje]) {
  const de   = db.prepare('SELECT apellido_nombre FROM empleados WHERE legajo=?').get(legajo_de);
  const para = db.prepare('SELECT apellido_nombre FROM empleados WHERE legajo=?').get(legajo_para);
  if (!de || !para) return { ok: false, msg: 'Empleado no encontrado' };
  db.prepare(`
    INSERT INTO reconocimientos (legajo_de, nombre_de, legajo_para, nombre_para, categoria, mensaje, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(legajo_de, de.apellido_nombre, legajo_para, para.apellido_nombre, categoria, mensaje, fechaHora());
  return { ok: true };
}

function getReconocimientos() {
  const rows = db.prepare('SELECT * FROM reconocimientos ORDER BY id DESC').all();
  return { ok: true, data: rows };
}

function eliminarReconocimiento(req, [id]) {
  db.prepare('DELETE FROM reconocimientos WHERE id=?').run(id);
  return { ok: true };
}

// ── MÓDULO 10: BIBLIOTECA DE RECURSOS ────────────────────────────────────────

function getRecursos() {
  const rows = db.prepare('SELECT * FROM recursos ORDER BY categoria, titulo').all();
  return { ok: true, data: rows };
}

function guardarRecurso(req, [datos]) {
  const id = datos.id;
  if (id) {
    db.prepare('UPDATE recursos SET titulo=?, categoria=?, descripcion=?, enlace=? WHERE id=?')
      .run(datos.titulo, datos.categoria, datos.descripcion ?? '', datos.enlace ?? '', id);
  } else {
    db.prepare('INSERT INTO recursos (titulo, categoria, descripcion, enlace) VALUES (?, ?, ?, ?)')
      .run(datos.titulo, datos.categoria, datos.descripcion ?? '', datos.enlace ?? '');
  }
  return { ok: true };
}

function eliminarRecurso(req, [id]) {
  db.prepare('DELETE FROM recursos WHERE id=?').run(id);
  return { ok: true };
}

// ── MÓDULO 11: BENEFICIOS ─────────────────────────────────────────────────────

function getBeneficios() {
  const rows = db.prepare('SELECT * FROM beneficios ORDER BY categoria, titulo').all();
  return { ok: true, data: rows };
}

function guardarBeneficio(req, [datos]) {
  const id = datos.id;
  if (id) {
    db.prepare('UPDATE beneficios SET titulo=?, categoria=?, descripcion=? WHERE id=?')
      .run(datos.titulo, datos.categoria, datos.descripcion ?? '', id);
  } else {
    db.prepare('INSERT INTO beneficios (titulo, categoria, descripcion) VALUES (?, ?, ?)')
      .run(datos.titulo, datos.categoria, datos.descripcion ?? '');
  }
  return { ok: true };
}

function eliminarBeneficio(req, [id]) {
  db.prepare('DELETE FROM beneficios WHERE id=?').run(id);
  return { ok: true };
}

// ── MÓDULO 12: ENCUESTA DE CLIMA ─────────────────────────────────────────────

function getEstadoEncuesta(req, [legajo]) {
  const row = db.prepare(
    'SELECT p1, p2, p3, p4, p5, comentario FROM encuestas_clima WHERE legajo=?'
  ).get(legajo);
  return { ok: true, respondida: !!row, respuesta: row || null };
}

function guardarRespuestaEncuesta(req, [legajo, p1, p2, p3, p4, p5, comentario]) {
  const emp = db.prepare('SELECT apellido_nombre, sector FROM empleados WHERE legajo=?').get(legajo);
  if (!emp) return { ok: false, msg: 'Empleado no encontrado' };
  const existe = db.prepare('SELECT 1 FROM encuestas_clima WHERE legajo=?').get(legajo);
  if (existe) return { ok: false, msg: 'Ya completaste la encuesta' };
  db.prepare(`
    INSERT INTO encuestas_clima (legajo, apellido_nombre, sector, p1, p2, p3, p4, p5, comentario, fecha)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(legajo, emp.apellido_nombre, emp.sector, p1, p2, p3, p4, p5, comentario, fechaHora());
  return { ok: true };
}

function getResultadosEncuesta() {
  const data = db.prepare(`
    SELECT legajo, apellido_nombre, sector, p1, p2, p3, p4, p5, comentario, fecha
    FROM encuestas_clima ORDER BY id DESC
  `).all();
  const n = data.length;
  const promedios = {};
  for (const campo of ['p1', 'p2', 'p3', 'p4', 'p5']) {
    promedios[campo] = n ? Math.round((data.reduce((s, d) => s + d[campo], 0) / n) * 10) / 10 : 0;
  }
  return { ok: true, respuestas: data, promedios, total: n };
}

// ── MÓDULO 13: NÓMINA Y PAGOS ─────────────────────────────────────────────────

function getLiquidacionSueldos() {
  const empleados = db.prepare(`
    SELECT legajo, apellido_nombre, sector, sueldo_basico, banco, cbu, tipo_cuenta
    FROM empleados WHERE estado='activo' ORDER BY apellido_nombre
  `).all();
  const resultado = empleados.map(fila => {
    const { total: anticipos } = db.prepare(`
      SELECT COALESCE(SUM(CAST(monto AS REAL)), 0) AS total FROM solicitudes
      WHERE legajo=? AND tipo_solicitud='Solicitud de anticipo' AND estado='Aceptado'
    `).get(fila.legajo);
    const basico = parseFloat(fila.sueldo_basico) || 0;
    return {
      ...fila,
      anticipos:     Math.round(anticipos * 100) / 100,
      neto_a_pagar:  Math.round((basico - anticipos) * 100) / 100,
    };
  });
  return { ok: true, data: resultado };
}

app.get('/api/exportar_liquidacion_xls', (req, res) => {
  const liquidacion = getLiquidacionSueldos();
  if (!liquidacion.ok) return res.status(500).json(liquidacion);
  if (!liquidacion.data.length) return res.status(400).json({ ok: false, msg: 'No hay empleados activos para liquidar' });
  enviarXls(res, 'liquidacion_sueldos.xls', liquidacion.data);
});

function getVencimientos() {
  const rows = db.prepare('SELECT * FROM vencimientos_pago ORDER BY fecha_vencimiento').all();
  return { ok: true, data: rows };
}

function guardarVencimiento(req, [datos]) {
  const id = datos.id;
  if (id) {
    db.prepare('UPDATE vencimientos_pago SET concepto=?, fecha_vencimiento=?, monto=? WHERE id=?')
      .run(datos.concepto, datos.fecha_vencimiento, datos.monto ?? '', id);
  } else {
    db.prepare(`INSERT INTO vencimientos_pago (concepto, fecha_vencimiento, monto, estado) VALUES (?, ?, ?, 'Pendiente')`)
      .run(datos.concepto, datos.fecha_vencimiento, datos.monto ?? '');
  }
  return { ok: true };
}

function actualizarEstadoVencimiento(req, [id, estado]) {
  if (!['Pendiente', 'Pagado'].includes(estado)) return { ok: false, msg: 'Estado inválido' };
  db.prepare('UPDATE vencimientos_pago SET estado=? WHERE id=?').run(estado, id);
  return { ok: true };
}

function eliminarVencimiento(req, [id]) {
  db.prepare('DELETE FROM vencimientos_pago WHERE id=?').run(id);
  return { ok: true };
}

// ── MÓDULO 14: ARCA (SIMULADO) ────────────────────────────────────────────────
// Nota: este módulo simula el flujo de facturación electrónica y alta temprana
// de ARCA (ex-AFIP). No se conecta a ningún webservice oficial: los números de
// CAE y trámite son generados localmente para fines de demostración.

function getFacturasArca() {
  const rows = db.prepare('SELECT * FROM facturas_arca ORDER BY id DESC').all();
  return { ok: true, data: rows };
}

function generarFacturaArca(req, [tipo_comprobante, cliente, monto]) {
  const { c: ultimo } = db.prepare('SELECT COUNT(*) AS c FROM facturas_arca').get();
  const numero = `0001-${String(ultimo + 1).padStart(8, '0')}`;
  const cae    = randDigits(14);
  db.prepare(`
    INSERT INTO facturas_arca (numero, tipo_comprobante, cliente, monto, fecha, cae, estado)
    VALUES (?, ?, ?, ?, ?, ?, 'Autorizada')
  `).run(numero, tipo_comprobante, cliente, monto, fechaHora(), cae);
  return { ok: true };
}

function getAltasArca() {
  const rows = db.prepare(`
    SELECT legajo, apellido_nombre, sector, fecha_ingreso,
           alta_arca_estado, alta_arca_fecha, alta_arca_tramite
    FROM empleados WHERE estado='activo' ORDER BY apellido_nombre
  `).all();
  return { ok: true, data: rows };
}

function registrarAltaArca(req, [legajo]) {
  const tramite = randDigits(10);
  db.prepare(`
    UPDATE empleados SET alta_arca_estado='Registrada', alta_arca_fecha=?, alta_arca_tramite=?
    WHERE legajo=?
  `).run(fechaHora(), tramite, legajo);
  return { ok: true };
}

// ── MÓDULO 15: EVALUACIÓN DE DESEMPEÑO ───────────────────────────────────────

function getEvaluaciones() {
  const rows = db.prepare('SELECT * FROM evaluaciones_desempeno ORDER BY id DESC').all();
  return { ok: true, data: rows };
}

function guardarEvaluacion(req, [datos]) {
  const legajo = datos.legajo;
  const emp = db.prepare('SELECT apellido_nombre, sector FROM empleados WHERE legajo=?').get(legajo);
  if (!emp) return { ok: false, msg: 'Empleado no encontrado' };
  const id = datos.id;
  if (id) {
    db.prepare(`
      UPDATE evaluaciones_desempeno SET
        periodo=?, objetivos=?, calificacion=?, comentarios=?
      WHERE id=?
    `).run(datos.periodo, datos.objetivos ?? '', datos.calificacion, datos.comentarios ?? '', id);
  } else {
    db.prepare(`
      INSERT INTO evaluaciones_desempeno
        (legajo, apellido_nombre, sector, periodo, objetivos, calificacion, comentarios, fecha)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(legajo, emp.apellido_nombre, emp.sector, datos.periodo, datos.objetivos ?? '', datos.calificacion, datos.comentarios ?? '', fechaHoy());
  }
  return { ok: true };
}

function eliminarEvaluacion(req, [id]) {
  db.prepare('DELETE FROM evaluaciones_desempeno WHERE id=?').run(id);
  return { ok: true };
}

// ── MÓDULO 16: BASE DE CURRÍCULUMS ───────────────────────────────────────────

const CURRICULUM_CAMPOS = [
  'nombre', 'puesto_buscado', 'telefono', 'email',
  'nivel_educacional', 'experiencia', 'enlace_cv', 'comentarios', 'estado'
];

function getCurriculums() {
  const rows = db.prepare('SELECT * FROM curriculums ORDER BY id DESC').all();
  return { ok: true, data: rows };
}

function guardarCurriculum(req, [datos]) {
  const id   = datos.id;
  const vals = CURRICULUM_CAMPOS.map(c => datos[c] ?? '');
  if (id) {
    const sets = CURRICULUM_CAMPOS.map(c => `${c}=?`).join(', ');
    db.prepare(`UPDATE curriculums SET ${sets} WHERE id=?`).run(...vals, id);
  } else {
    const cols = CURRICULUM_CAMPOS.join(', ');
    const phs  = CURRICULUM_CAMPOS.map(() => '?').join(', ');
    db.prepare(`INSERT INTO curriculums (${cols}, fecha_carga) VALUES (${phs}, ?)`).run(...vals, fechaHoy());
  }
  return { ok: true };
}

function eliminarCurriculum(req, [id]) {
  db.prepare('DELETE FROM curriculums WHERE id=?').run(id);
  return { ok: true };
}

// ── TABLA DE DISPATCH ─────────────────────────────────────────────────────────

const METHODS = {
  get_sesion:               (req)        => getSesion(req),
  login_admin:              (req, args)  => loginAdmin(req, args),
  login_empleado:           (req, args)  => loginEmpleado(req, args),
  logout:                   (req)        => logout(req),
  get_parametros:           (req, args)  => getParametros(req, args),
  guardar_parametro:        (req, args)  => guardarParametro(req, args),
  eliminar_parametro:       (req, args)  => eliminarParametro(req, args),
  get_listas_parametros:    ()           => getListasParametros(),
  get_empleados:            ()           => getEmpleados(),
  guardar_empleado:         (req, args)  => guardarEmpleado(req, args),
  eliminar_empleado:        (req, args)  => eliminarEmpleado(req, args),
  get_perfil_empleado:      (req, args)  => getPerfilEmpleado(req, args),
  guardar_datos_personales: (req, args)  => guardarDatosPersonales(req, args),
  agregar_familiar:         (req, args)  => agregarFamiliar(req, args),
  eliminar_familiar:        (req, args)  => eliminarFamiliar(req, args),
  get_consolidado:          ()           => getConsolidado(),
  get_ficha_empleado:       (req, args)  => getFichaEmpleado(req, args),
  buscar_empleado_para_baja: (req, args) => buscarEmpleadoParaBaja(req, args),
  registrar_baja:           (req, args)  => registrarBaja(req, args),
  crear_solicitud:          (req, args)  => crearSolicitud(req, args),
  get_mis_solicitudes:      (req, args)  => getMisSolicitudes(req, args),
  get_solicitudes:          ()           => getSolicitudes(),
  actualizar_estado_solicitud: (req, args) => actualizarEstadoSolicitud(req, args),
  crear_reconocimiento:     (req, args)  => crearReconocimiento(req, args),
  get_reconocimientos:      ()           => getReconocimientos(),
  eliminar_reconocimiento:  (req, args)  => eliminarReconocimiento(req, args),
  get_recursos:             ()           => getRecursos(),
  guardar_recurso:          (req, args)  => guardarRecurso(req, args),
  eliminar_recurso:         (req, args)  => eliminarRecurso(req, args),
  get_beneficios:           ()           => getBeneficios(),
  guardar_beneficio:        (req, args)  => guardarBeneficio(req, args),
  eliminar_beneficio:       (req, args)  => eliminarBeneficio(req, args),
  get_estado_encuesta:      (req, args)  => getEstadoEncuesta(req, args),
  guardar_respuesta_encuesta: (req, args) => guardarRespuestaEncuesta(req, args),
  get_resultados_encuesta:  ()           => getResultadosEncuesta(),
  get_liquidacion_sueldos:  ()           => getLiquidacionSueldos(),
  get_vencimientos:         ()           => getVencimientos(),
  guardar_vencimiento:      (req, args)  => guardarVencimiento(req, args),
  actualizar_estado_vencimiento: (req, args) => actualizarEstadoVencimiento(req, args),
  eliminar_vencimiento:     (req, args)  => eliminarVencimiento(req, args),
  get_facturas_arca:        ()           => getFacturasArca(),
  generar_factura_arca:     (req, args)  => generarFacturaArca(req, args),
  get_altas_arca:           ()           => getAltasArca(),
  registrar_alta_arca:      (req, args)  => registrarAltaArca(req, args),
  get_evaluaciones:         ()           => getEvaluaciones(),
  guardar_evaluacion:       (req, args)  => guardarEvaluacion(req, args),
  eliminar_evaluacion:      (req, args)  => eliminarEvaluacion(req, args),
  get_curriculums:          ()           => getCurriculums(),
  guardar_curriculum:       (req, args)  => guardarCurriculum(req, args),
  eliminar_curriculum:      (req, args)  => eliminarCurriculum(req, args),
};

// ── INIT DB ───────────────────────────────────────────────────────────────────

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE, password TEXT
    );
    CREATE TABLE IF NOT EXISTS cargos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE, nombre TEXT
    );
    CREATE TABLE IF NOT EXISTS sectores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE, nombre TEXT
    );
    CREATE TABLE IF NOT EXISTS centros_costo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE, nombre TEXT
    );
    CREATE TABLE IF NOT EXISTS lugares_trabajo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE, nombre TEXT
    );
    CREATE TABLE IF NOT EXISTS empleados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legajo TEXT UNIQUE, apellido_nombre TEXT, cuil TEXT,
      tipo_doc TEXT, nro_doc TEXT, lugar_trabajo TEXT, jornada TEXT,
      fecha_ingreso TEXT, fecha_antiguedad TEXT, cargo TEXT,
      tipo_empleado TEXT, sector TEXT, jefe_admin TEXT, centro_costo TEXT,
      estado TEXT DEFAULT 'activo',
      fecha_baja TEXT, motivo_baja TEXT, comentario_baja TEXT
    );
    CREATE TABLE IF NOT EXISTS empleados_datos_personales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legajo TEXT UNIQUE, sexo TEXT, calle TEXT, numero TEXT,
      piso TEXT, dto TEXT, ciudad TEXT, localidad TEXT, provincia TEXT,
      cp TEXT, telefono TEXT, f_nacimiento TEXT, nacionalidad TEXT,
      estado_civil TEXT, nivel_educacional TEXT, titulo TEXT, email TEXT
    );
    CREATE TABLE IF NOT EXISTS empleados_familiares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legajo TEXT, parentesco TEXT, nombre_familiar TEXT,
      f_nacimiento TEXT, tipo_doc TEXT, nro_doc TEXT, cuil_familiar TEXT
    );
    CREATE TABLE IF NOT EXISTS solicitudes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legajo TEXT, apellido_nombre TEXT, sector TEXT, tipo_solicitud TEXT,
      detalle_licencia TEXT, fecha_inicio TEXT, dias TEXT, monto TEXT,
      consulta_texto TEXT, estado TEXT DEFAULT 'Pendiente'
    );
    CREATE TABLE IF NOT EXISTS reconocimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legajo_de TEXT, nombre_de TEXT, legajo_para TEXT, nombre_para TEXT,
      categoria TEXT, mensaje TEXT, fecha TEXT
    );
    CREATE TABLE IF NOT EXISTS recursos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT, categoria TEXT, descripcion TEXT, enlace TEXT
    );
    CREATE TABLE IF NOT EXISTS beneficios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT, categoria TEXT, descripcion TEXT
    );
    CREATE TABLE IF NOT EXISTS encuestas_clima (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legajo TEXT UNIQUE, apellido_nombre TEXT, sector TEXT,
      p1 INTEGER, p2 INTEGER, p3 INTEGER, p4 INTEGER, p5 INTEGER,
      comentario TEXT, fecha TEXT
    );
    CREATE TABLE IF NOT EXISTS vencimientos_pago (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concepto TEXT, fecha_vencimiento TEXT, monto TEXT, estado TEXT DEFAULT 'Pendiente'
    );
    CREATE TABLE IF NOT EXISTS facturas_arca (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT, tipo_comprobante TEXT, cliente TEXT, monto TEXT,
      fecha TEXT, cae TEXT, estado TEXT DEFAULT 'Autorizada'
    );
    CREATE TABLE IF NOT EXISTS evaluaciones_desempeno (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legajo TEXT, apellido_nombre TEXT, sector TEXT, periodo TEXT,
      objetivos TEXT, calificacion TEXT, comentarios TEXT, fecha TEXT
    );
    CREATE TABLE IF NOT EXISTS curriculums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT, puesto_buscado TEXT, telefono TEXT, email TEXT,
      nivel_educacional TEXT, experiencia TEXT, enlace_cv TEXT,
      comentarios TEXT, estado TEXT DEFAULT 'Disponible', fecha_carga TEXT
    );
  `);

  // Migraciones para bases de datos ya existentes (parche de módulos agregados después)
  const migraciones = [
    "ALTER TABLE empleados ADD COLUMN estado TEXT DEFAULT 'activo'",
    "ALTER TABLE empleados ADD COLUMN fecha_baja TEXT",
    "ALTER TABLE empleados ADD COLUMN motivo_baja TEXT",
    "ALTER TABLE empleados ADD COLUMN comentario_baja TEXT",
    "ALTER TABLE empleados_familiares ADD COLUMN nombre_familiar TEXT",
    "ALTER TABLE empleados_familiares ADD COLUMN f_nacimiento TEXT",
    "ALTER TABLE empleados_familiares ADD COLUMN tipo_doc TEXT",
    "ALTER TABLE empleados_familiares ADD COLUMN nro_doc TEXT",
    "ALTER TABLE empleados ADD COLUMN sueldo_basico TEXT",
    "ALTER TABLE empleados ADD COLUMN banco TEXT",
    "ALTER TABLE empleados ADD COLUMN cbu TEXT",
    "ALTER TABLE empleados ADD COLUMN tipo_cuenta TEXT",
    "ALTER TABLE empleados ADD COLUMN obra_social TEXT",
    "ALTER TABLE empleados ADD COLUMN plan_medico TEXT",
    "ALTER TABLE empleados ADD COLUMN convenio_cct TEXT",
    "ALTER TABLE empleados ADD COLUMN categoria_convenio TEXT",
    "ALTER TABLE empleados ADD COLUMN alta_arca_estado TEXT DEFAULT 'Pendiente'",
    "ALTER TABLE empleados ADD COLUMN alta_arca_fecha TEXT",
    "ALTER TABLE empleados ADD COLUMN alta_arca_tramite TEXT",
  ];
  for (const sql of migraciones) {
    try { db.exec(sql); } catch { /* columna ya existe */ }
  }
  db.exec("UPDATE empleados SET estado='activo' WHERE estado IS NULL");
  db.exec("UPDATE empleados SET alta_arca_estado='Pendiente' WHERE alta_arca_estado IS NULL");

  try {
    db.prepare("INSERT INTO admin_usuarios (usuario, password) VALUES (?, ?)").run('admin', 'admin123');
  } catch { /* usuario ya existe */ }
}

initDb();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
