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

function getEmpleados() {
  const rows = db.prepare(`
    SELECT legajo, apellido_nombre, cuil, tipo_doc, nro_doc,
           lugar_trabajo, jornada, fecha_ingreso, fecha_antiguedad,
           cargo, tipo_empleado, sector, jefe_admin, centro_costo
    FROM empleados ORDER BY apellido_nombre
  `).all();
  return { ok: true, data: rows };
}

function guardarEmpleado(req, [datos]) {
  const leg    = datos.legajo.trim();
  const exists = db.prepare('SELECT 1 FROM empleados WHERE legajo=?').get(leg);
  try {
    if (exists) {
      db.prepare(`
        UPDATE empleados SET
          apellido_nombre=?, cuil=?, tipo_doc=?, nro_doc=?,
          lugar_trabajo=?, jornada=?, fecha_ingreso=?, fecha_antiguedad=?,
          cargo=?, tipo_empleado=?, sector=?, jefe_admin=?, centro_costo=?
        WHERE legajo=?
      `).run(
        datos.apellido_nombre, datos.cuil, datos.tipo_doc, datos.nro_doc,
        datos.lugar_trabajo, datos.jornada, datos.fecha_ingreso, datos.fecha_antiguedad,
        datos.cargo, datos.tipo_empleado, datos.sector, datos.jefe_admin, datos.centro_costo, leg
      );
    } else {
      db.prepare(`
        INSERT INTO empleados (
          legajo, apellido_nombre, cuil, tipo_doc, nro_doc,
          lugar_trabajo, jornada, fecha_ingreso, fecha_antiguedad,
          cargo, tipo_empleado, sector, jefe_admin, centro_costo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        leg, datos.apellido_nombre, datos.cuil, datos.tipo_doc, datos.nro_doc,
        datos.lugar_trabajo, datos.jornada, datos.fecha_ingreso, datos.fecha_antiguedad,
        datos.cargo, datos.tipo_empleado, datos.sector, datos.jefe_admin, datos.centro_costo
      );
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
  const fams = db.prepare('SELECT id, parentesco, cuil_familiar FROM empleados_familiares WHERE legajo=?').all(legajo);
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

function agregarFamiliar(req, [legajo, parentesco, cuil_familiar]) {
  db.prepare('INSERT INTO empleados_familiares (legajo, parentesco, cuil_familiar) VALUES (?, ?, ?)').run(legajo, parentesco, cuil_familiar);
  return { ok: true };
}

function eliminarFamiliar(req, [id]) {
  db.prepare('DELETE FROM empleados_familiares WHERE id=?').run(id);
  return { ok: true };
}

// ── MÓDULO 4: CONSOLIDADO Y EXPORTAR ─────────────────────────────────────────

function getConsolidado() {
  const empleados = db.prepare(`
    SELECT legajo, apellido_nombre, cuil, tipo_doc, nro_doc,
           lugar_trabajo, jornada, fecha_ingreso, fecha_antiguedad,
           cargo, tipo_empleado, sector, jefe_admin, centro_costo
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
  const { data } = consolidado;
  if (!data.length) return res.status(400).json({ ok: false, msg: 'No hay datos para exportar' });
  const headers = Object.keys(data[0]);
  const lines   = [headers.join('\t'), ...data.map(r => headers.map(h => r[h] ?? '').join('\t'))];
  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.setHeader('Content-Disposition', 'attachment; filename=nomina_rrhh.xls');
  res.send(Buffer.from('﻿' + lines.join('\n'), 'utf8'));
});

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
      tipo_empleado TEXT, sector TEXT, jefe_admin TEXT, centro_costo TEXT
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
      legajo TEXT, parentesco TEXT, cuil_familiar TEXT
    );
  `);
  try {
    db.prepare("INSERT INTO admin_usuarios (usuario, password) VALUES (?, ?)").run('admin', 'admin123');
  } catch { /* usuario ya existe */ }
}

initDb();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
