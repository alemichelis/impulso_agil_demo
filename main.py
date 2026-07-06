from flask import Flask, jsonify, request, session, send_from_directory, make_response
import sqlite3
import os
import random
import string
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rrhh_parametros.db")

app = Flask(__name__, static_folder='frontend', static_url_path='')
app.secret_key = os.environ.get('SECRET_KEY', 'rrhh-dev-secret-2024')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ── RUTAS ESTÁTICAS ───────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')


# ── DISPATCHER ────────────────────────────────────────────────────────────────

@app.route('/api/<method>', methods=['POST'])
def api_dispatch(method):
    data = request.get_json(force=True, silent=True) or {}
    args = data.get('args', [])
    fn = METHODS.get(method)
    if not fn:
        return jsonify({'ok': False, 'msg': 'Método no encontrado'}), 404
    try:
        return jsonify(fn(*args))
    except Exception as e:
        return jsonify({'ok': False, 'msg': str(e)})


# ── AUTH ──────────────────────────────────────────────────────────────────────

def get_sesion():
    return {
        'usuario': session.get('usuario'),
        'rol':     session.get('rol'),
        'legajo':  session.get('legajo')
    }

def login_admin(usuario, password):
    try:
        with get_db() as conn:
            row = conn.execute(
                "SELECT id FROM admin_usuarios WHERE usuario=? AND password=?",
                (usuario, password)
            ).fetchone()
        if row:
            session['usuario'] = usuario
            session['rol']     = 'admin'
            session['legajo']  = None
            return {'ok': True}
        return {'ok': False, 'msg': 'Usuario o contraseña incorrectos'}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def login_empleado(legajo, nro_doc):
    try:
        with get_db() as conn:
            row = conn.execute(
                "SELECT legajo, apellido_nombre FROM empleados WHERE legajo=? AND nro_doc=?",
                (legajo.strip(), nro_doc.strip())
            ).fetchone()
        if row:
            session['usuario'] = row['apellido_nombre']
            session['rol']     = 'empleado'
            session['legajo']  = row['legajo']
            return {'ok': True, 'nombre': row['apellido_nombre']}
        return {'ok': False, 'msg': 'Legajo o número de documento incorrecto'}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def logout():
    session.clear()
    return {'ok': True}


# ── MÓDULO 1: PARÁMETROS ──────────────────────────────────────────────────────

_TABLAS = {
    'CARGOS':           'cargos',
    'SECTORES':         'sectores',
    'CENTROS DE COSTO': 'centros_costo',
    'LUGAR DE TRABAJO': 'lugares_trabajo'
}

def get_parametros(tabla):
    t = _TABLAS.get(tabla)
    if not t:
        return {'ok': False, 'msg': 'Tabla inválida'}
    try:
        with get_db() as conn:
            rows = conn.execute(
                f"SELECT id, codigo, nombre FROM {t} ORDER BY nombre"
            ).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def guardar_parametro(tabla, codigo, nombre, id=None):
    t = _TABLAS.get(tabla)
    if not t:
        return {'ok': False, 'msg': 'Tabla inválida'}
    try:
        with get_db() as conn:
            if id:
                conn.execute(
                    f"UPDATE {t} SET codigo=?, nombre=? WHERE id=?",
                    (codigo.strip(), nombre.strip(), id)
                )
            else:
                conn.execute(
                    f"INSERT INTO {t} (codigo, nombre) VALUES (?, ?)",
                    (codigo.strip(), nombre.strip())
                )
            conn.commit()
        return {'ok': True}
    except sqlite3.IntegrityError:
        return {'ok': False, 'msg': 'El código ya existe en esta tabla'}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def eliminar_parametro(tabla, id):
    t = _TABLAS.get(tabla)
    if not t:
        return {'ok': False, 'msg': 'Tabla inválida'}
    try:
        with get_db() as conn:
            conn.execute(f"DELETE FROM {t} WHERE id=?", (id,))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 2: EMPLEADOS ───────────────────────────────────────────────────────

def get_listas_parametros():
    try:
        with get_db() as conn:
            def lista(sql):
                return [r[0] for r in conn.execute(sql).fetchall()]
            return {
                'ok':          True,
                'lugares':     lista("SELECT nombre FROM lugares_trabajo ORDER BY nombre"),
                'cargos':      lista("SELECT nombre FROM cargos ORDER BY nombre"),
                'sectores':    lista("SELECT nombre FROM sectores ORDER BY nombre"),
                'centros_costo': lista("SELECT nombre FROM centros_costo ORDER BY nombre"),
                'jefes': ['Ninguno'] + lista(
                    "SELECT apellido_nombre FROM empleados ORDER BY apellido_nombre"
                )
            }
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

EMPLEADO_CAMPOS_BASE = (
    'apellido_nombre', 'cuil', 'tipo_doc', 'nro_doc',
    'lugar_trabajo', 'jornada', 'fecha_ingreso', 'fecha_antiguedad',
    'cargo', 'tipo_empleado', 'sector', 'jefe_admin', 'centro_costo'
)
EMPLEADO_CAMPOS_EXTRA = (
    'sueldo_basico', 'banco', 'cbu', 'tipo_cuenta',
    'obra_social', 'plan_medico', 'convenio_cct', 'categoria_convenio'
)

def get_empleados():
    try:
        with get_db() as conn:
            rows = conn.execute(f"""
                SELECT legajo, apellido_nombre, cuil, tipo_doc, nro_doc,
                       lugar_trabajo, jornada, fecha_ingreso, fecha_antiguedad,
                       cargo, tipo_empleado, sector, jefe_admin, centro_costo,
                       estado, fecha_baja, motivo_baja,
                       {', '.join(EMPLEADO_CAMPOS_EXTRA)},
                       alta_arca_estado, alta_arca_fecha, alta_arca_tramite
                FROM empleados ORDER BY apellido_nombre
            """).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def guardar_empleado(datos):
    try:
        leg = datos['legajo'].strip()
        base_vals = tuple(datos[c] for c in EMPLEADO_CAMPOS_BASE)
        extra_vals = tuple(datos.get(c, '') for c in EMPLEADO_CAMPOS_EXTRA)
        with get_db() as conn:
            exists = conn.execute(
                "SELECT 1 FROM empleados WHERE legajo=?", (leg,)
            ).fetchone()
            if exists:
                sets = ', '.join(f'{c}=?' for c in EMPLEADO_CAMPOS_BASE + EMPLEADO_CAMPOS_EXTRA)
                conn.execute(
                    f"UPDATE empleados SET {sets} WHERE legajo=?",
                    (*base_vals, *extra_vals, leg)
                )
            else:
                cols = ('legajo',) + EMPLEADO_CAMPOS_BASE + ('estado',) + EMPLEADO_CAMPOS_EXTRA
                placeholders = (
                    '?, ' + ', '.join('?' * len(EMPLEADO_CAMPOS_BASE)) +
                    ", 'activo', " + ', '.join('?' * len(EMPLEADO_CAMPOS_EXTRA))
                )
                conn.execute(
                    f"INSERT INTO empleados ({', '.join(cols)}) VALUES ({placeholders})",
                    (leg, *base_vals, *extra_vals)
                )
            conn.commit()
        return {'ok': True}
    except sqlite3.IntegrityError:
        return {'ok': False, 'msg': 'El legajo ya existe'}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def eliminar_empleado(legajo):
    try:
        with get_db() as conn:
            conn.execute("DELETE FROM empleados WHERE legajo=?", (legajo,))
            conn.execute("DELETE FROM empleados_datos_personales WHERE legajo=?", (legajo,))
            conn.execute("DELETE FROM empleados_familiares WHERE legajo=?", (legajo,))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 3: ONBOARDING ──────────────────────────────────────────────────────

def get_perfil_empleado(legajo):
    try:
        with get_db() as conn:
            emp = conn.execute("""
                SELECT legajo, apellido_nombre, cuil, cargo, sector,
                       lugar_trabajo, fecha_ingreso
                FROM empleados WHERE legajo=?
            """, (legajo,)).fetchone()
            if not emp:
                return {'ok': False, 'msg': 'Empleado no encontrado'}
            pers = conn.execute(
                "SELECT * FROM empleados_datos_personales WHERE legajo=?", (legajo,)
            ).fetchone()
            fams = conn.execute(
                """SELECT id, parentesco, nombre_familiar, f_nacimiento,
                          tipo_doc, nro_doc, cuil_familiar
                   FROM empleados_familiares WHERE legajo=?""",
                (legajo,)
            ).fetchall()
        return {
            'ok':        True,
            'empleado':  dict(emp),
            'personales': dict(pers) if pers else {},
            'familiares': [dict(f) for f in fams]
        }
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def guardar_datos_personales(legajo, datos):
    try:
        campos = (
            'sexo', 'calle', 'numero', 'piso', 'dto', 'ciudad', 'localidad',
            'provincia', 'cp', 'telefono', 'f_nacimiento', 'nacionalidad',
            'estado_civil', 'nivel_educacional', 'titulo', 'email'
        )
        vals = tuple(datos.get(c, '') for c in campos)
        with get_db() as conn:
            exists = conn.execute(
                "SELECT 1 FROM empleados_datos_personales WHERE legajo=?", (legajo,)
            ).fetchone()
            if exists:
                sets = ', '.join(f"{c}=?" for c in campos)
                conn.execute(
                    f"UPDATE empleados_datos_personales SET {sets} WHERE legajo=?",
                    vals + (legajo,)
                )
            else:
                cols = ', '.join(campos)
                phs  = ', '.join('?' * len(campos))
                conn.execute(
                    f"INSERT INTO empleados_datos_personales (legajo, {cols}) VALUES (?, {phs})",
                    (legajo,) + vals
                )
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def agregar_familiar(legajo, parentesco, nombre_familiar, f_nacimiento, tipo_doc, nro_doc, cuil_familiar):
    try:
        with get_db() as conn:
            conn.execute(
                """INSERT INTO empleados_familiares
                   (legajo, parentesco, nombre_familiar, f_nacimiento, tipo_doc, nro_doc, cuil_familiar)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (legajo, parentesco, nombre_familiar, f_nacimiento, tipo_doc, nro_doc, cuil_familiar)
            )
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def eliminar_familiar(id):
    try:
        with get_db() as conn:
            conn.execute("DELETE FROM empleados_familiares WHERE id=?", (id,))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 5: FICHA DE EMPLEADO ──────────────────────────────────────────────

def get_ficha_empleado(criterio, valor):
    mapeo = {
        'legajo': 'e.legajo',
        'apellido_nombre': 'e.apellido_nombre',
        'cuil': 'e.cuil',
        'nro_doc': 'e.nro_doc'
    }
    col = mapeo.get(criterio)
    if not col:
        return {'ok': False, 'msg': 'Criterio inválido'}
    try:
        with get_db() as conn:
            emp = conn.execute(f"""
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
                WHERE {col} LIKE ?
                LIMIT 1
            """, (f'%{valor}%',)).fetchone()
            if not emp:
                return {'ok': False, 'msg': 'Empleado no encontrado'}
            fams = conn.execute(
                """SELECT parentesco, nombre_familiar, cuil_familiar
                   FROM empleados_familiares WHERE legajo=?""",
                (emp['legajo'],)
            ).fetchall()
        result = dict(emp)
        result['familiares'] = [dict(f) for f in fams]
        return {'ok': True, 'data': result}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 6: BAJA DE EMPLEADOS ───────────────────────────────────────────────

def buscar_empleado_para_baja(criterio, valor):
    mapeo = {
        'legajo': 'legajo',
        'apellido_nombre': 'apellido_nombre',
        'cuil': 'cuil',
        'nro_doc': 'nro_doc'
    }
    col = mapeo.get(criterio)
    if not col:
        return {'ok': False, 'msg': 'Criterio inválido'}
    try:
        with get_db() as conn:
            row = conn.execute(
                f"SELECT legajo, apellido_nombre, estado, fecha_baja FROM empleados WHERE {col} LIKE ? LIMIT 1",
                (f'%{valor}%',)
            ).fetchone()
        if not row:
            return {'ok': False, 'msg': 'Empleado no encontrado'}
        return {'ok': True, 'data': dict(row)}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def registrar_baja(legajo, fecha_baja, motivo_baja, comentario_baja):
    try:
        with get_db() as conn:
            conn.execute("""
                UPDATE empleados
                SET fecha_baja=?, motivo_baja=?, comentario_baja=?, estado='inactivo'
                WHERE legajo=?
            """, (fecha_baja, motivo_baja, comentario_baja, legajo))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 4: CONSOLIDADO Y EXPORTAR ─────────────────────────────────────────

def get_consolidado():
    try:
        with get_db() as conn:
            empleados = conn.execute(f"""
                SELECT legajo, apellido_nombre, cuil, tipo_doc, nro_doc,
                       lugar_trabajo, jornada, fecha_ingreso, fecha_antiguedad,
                       cargo, tipo_empleado, sector, jefe_admin, centro_costo,
                       estado, fecha_baja, motivo_baja, {', '.join(EMPLEADO_CAMPOS_EXTRA)}
                FROM empleados ORDER BY apellido_nombre
            """).fetchall()
            resultado = []
            for emp in empleados:
                fila = dict(emp)
                leg  = fila['legajo']
                pers = conn.execute("""
                    SELECT sexo, calle, numero, piso, dto, ciudad, localidad,
                           provincia, cp, telefono, f_nacimiento, nacionalidad,
                           estado_civil, nivel_educacional, titulo, email
                    FROM empleados_datos_personales WHERE legajo=?
                """, (leg,)).fetchone()
                vacios = {c: '' for c in [
                    'sexo', 'calle', 'numero', 'piso', 'dto', 'ciudad', 'localidad',
                    'provincia', 'cp', 'telefono', 'f_nacimiento', 'nacionalidad',
                    'estado_civil', 'nivel_educacional', 'titulo', 'email',
                ]}
                fila.update(dict(pers) if pers else vacios)
                fams = conn.execute(
                    "SELECT parentesco, cuil_familiar FROM empleados_familiares WHERE legajo=?",
                    (leg,)
                ).fetchall()
                fila['familiares'] = (
                    ', '.join(f"{f[0]} ({f[1]})" for f in fams) if fams
                    else 'Sin familiares registrados'
                )
                resultado.append(fila)
        return {'ok': True, 'data': resultado}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

@app.route('/api/exportar_xls')
def exportar_xls():
    consolidado = get_consolidado()
    if not consolidado['ok']:
        return jsonify(consolidado), 500
    data = consolidado['data']
    if not data:
        return jsonify({'ok': False, 'msg': 'No hay datos para exportar'}), 400
    headers = list(data[0].keys())
    lines = ['\t'.join(headers)]
    for fila in data:
        lines.append('\t'.join(str(fila.get(h, '')) for h in headers))
    response = make_response('\n'.join(lines).encode('utf-8-sig'))
    response.headers['Content-Type'] = 'application/vnd.ms-excel'
    response.headers['Content-Disposition'] = 'attachment; filename=nomina_rrhh.xls'
    return response


# ── MÓDULO 7: SOLICITUDES Y PEDIDOS (EMPLEADO) ───────────────────────────────

def crear_solicitud(legajo, tipo_solicitud, detalle_licencia, fecha_inicio, dias, monto, consulta_texto):
    try:
        with get_db() as conn:
            emp = conn.execute(
                "SELECT apellido_nombre, sector FROM empleados WHERE legajo=?", (legajo,)
            ).fetchone()
            if not emp:
                return {'ok': False, 'msg': 'Empleado no encontrado'}
            conn.execute("""
                INSERT INTO solicitudes (
                    legajo, apellido_nombre, sector, tipo_solicitud,
                    detalle_licencia, fecha_inicio, dias, monto, consulta_texto, estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
            """, (
                legajo, emp['apellido_nombre'], emp['sector'], tipo_solicitud,
                detalle_licencia, fecha_inicio, dias, monto, consulta_texto
            ))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def get_mis_solicitudes(legajo):
    try:
        with get_db() as conn:
            rows = conn.execute("""
                SELECT id, tipo_solicitud, detalle_licencia, fecha_inicio,
                       dias, monto, consulta_texto, estado
                FROM solicitudes WHERE legajo=? ORDER BY id DESC
            """, (legajo,)).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 8: GESTIÓN DE SOLICITUDES (ADMIN) ─────────────────────────────────

def get_solicitudes():
    try:
        with get_db() as conn:
            rows = conn.execute("""
                SELECT id, legajo, apellido_nombre, sector, tipo_solicitud,
                       detalle_licencia, fecha_inicio, dias, monto, consulta_texto, estado
                FROM solicitudes ORDER BY id DESC
            """).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def actualizar_estado_solicitud(id, nuevo_estado):
    if nuevo_estado not in ('Aceptado', 'Rechazado'):
        return {'ok': False, 'msg': 'Estado inválido'}
    try:
        with get_db() as conn:
            conn.execute("UPDATE solicitudes SET estado=? WHERE id=?", (nuevo_estado, id))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

@app.route('/api/exportar_novedades_xls')
def exportar_novedades_xls():
    solicitudes = get_solicitudes()
    if not solicitudes['ok']:
        return jsonify(solicitudes), 500
    data = [s for s in solicitudes['data'] if s['estado'] == 'Aceptado']
    if not data:
        return jsonify({'ok': False, 'msg': 'No hay novedades aceptadas para exportar'}), 400
    headers = list(data[0].keys())
    lines = ['\t'.join(headers)]
    for fila in data:
        lines.append('\t'.join(str(fila.get(h, '')) for h in headers))
    response = make_response('\n'.join(lines).encode('utf-8-sig'))
    response.headers['Content-Type'] = 'application/vnd.ms-excel'
    response.headers['Content-Disposition'] = 'attachment; filename=novedades_a_liquidar.xls'
    return response


# ── MÓDULO 9: RECONOCIMIENTOS ─────────────────────────────────────────────────

def crear_reconocimiento(legajo_de, legajo_para, categoria, mensaje):
    try:
        with get_db() as conn:
            de = conn.execute("SELECT apellido_nombre FROM empleados WHERE legajo=?", (legajo_de,)).fetchone()
            para = conn.execute("SELECT apellido_nombre FROM empleados WHERE legajo=?", (legajo_para,)).fetchone()
            if not de or not para:
                return {'ok': False, 'msg': 'Empleado no encontrado'}
            fecha = datetime.now().strftime('%d-%m-%Y %H:%M')
            conn.execute("""
                INSERT INTO reconocimientos (legajo_de, nombre_de, legajo_para, nombre_para, categoria, mensaje, fecha)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (legajo_de, de['apellido_nombre'], legajo_para, para['apellido_nombre'], categoria, mensaje, fecha))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def get_reconocimientos():
    try:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM reconocimientos ORDER BY id DESC"
            ).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def eliminar_reconocimiento(id):
    try:
        with get_db() as conn:
            conn.execute("DELETE FROM reconocimientos WHERE id=?", (id,))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 10: BIBLIOTECA DE RECURSOS ────────────────────────────────────────

def get_recursos():
    try:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM recursos ORDER BY categoria, titulo"
            ).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def guardar_recurso(datos):
    try:
        id = datos.get('id')
        with get_db() as conn:
            if id:
                conn.execute(
                    "UPDATE recursos SET titulo=?, categoria=?, descripcion=?, enlace=? WHERE id=?",
                    (datos['titulo'], datos['categoria'], datos.get('descripcion', ''), datos.get('enlace', ''), id)
                )
            else:
                conn.execute(
                    "INSERT INTO recursos (titulo, categoria, descripcion, enlace) VALUES (?, ?, ?, ?)",
                    (datos['titulo'], datos['categoria'], datos.get('descripcion', ''), datos.get('enlace', ''))
                )
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def eliminar_recurso(id):
    try:
        with get_db() as conn:
            conn.execute("DELETE FROM recursos WHERE id=?", (id,))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 11: BENEFICIOS ─────────────────────────────────────────────────────

def get_beneficios():
    try:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM beneficios ORDER BY categoria, titulo"
            ).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def guardar_beneficio(datos):
    try:
        id = datos.get('id')
        with get_db() as conn:
            if id:
                conn.execute(
                    "UPDATE beneficios SET titulo=?, categoria=?, descripcion=? WHERE id=?",
                    (datos['titulo'], datos['categoria'], datos.get('descripcion', ''), id)
                )
            else:
                conn.execute(
                    "INSERT INTO beneficios (titulo, categoria, descripcion) VALUES (?, ?, ?)",
                    (datos['titulo'], datos['categoria'], datos.get('descripcion', ''))
                )
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def eliminar_beneficio(id):
    try:
        with get_db() as conn:
            conn.execute("DELETE FROM beneficios WHERE id=?", (id,))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 12: ENCUESTA DE CLIMA ─────────────────────────────────────────────

def get_estado_encuesta(legajo):
    try:
        with get_db() as conn:
            row = conn.execute(
                "SELECT p1, p2, p3, p4, p5, comentario FROM encuestas_clima WHERE legajo=?", (legajo,)
            ).fetchone()
        return {'ok': True, 'respondida': bool(row), 'respuesta': dict(row) if row else None}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def guardar_respuesta_encuesta(legajo, p1, p2, p3, p4, p5, comentario):
    try:
        with get_db() as conn:
            emp = conn.execute(
                "SELECT apellido_nombre, sector FROM empleados WHERE legajo=?", (legajo,)
            ).fetchone()
            if not emp:
                return {'ok': False, 'msg': 'Empleado no encontrado'}
            existe = conn.execute("SELECT 1 FROM encuestas_clima WHERE legajo=?", (legajo,)).fetchone()
            if existe:
                return {'ok': False, 'msg': 'Ya completaste la encuesta'}
            fecha = datetime.now().strftime('%d-%m-%Y %H:%M')
            conn.execute("""
                INSERT INTO encuestas_clima (legajo, apellido_nombre, sector, p1, p2, p3, p4, p5, comentario, fecha)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (legajo, emp['apellido_nombre'], emp['sector'], p1, p2, p3, p4, p5, comentario, fecha))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def get_resultados_encuesta():
    try:
        with get_db() as conn:
            rows = conn.execute("""
                SELECT legajo, apellido_nombre, sector, p1, p2, p3, p4, p5, comentario, fecha
                FROM encuestas_clima ORDER BY id DESC
            """).fetchall()
        data = [dict(r) for r in rows]
        n = len(data)
        promedios = {
            campo: (round(sum(d[campo] for d in data) / n, 1) if n else 0)
            for campo in ('p1', 'p2', 'p3', 'p4', 'p5')
        }
        return {'ok': True, 'respuestas': data, 'promedios': promedios, 'total': n}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 13: NÓMINA Y PAGOS ─────────────────────────────────────────────────

def get_liquidacion_sueldos():
    try:
        with get_db() as conn:
            empleados = conn.execute("""
                SELECT legajo, apellido_nombre, sector, sueldo_basico, banco, cbu, tipo_cuenta
                FROM empleados WHERE estado='activo' ORDER BY apellido_nombre
            """).fetchall()
            resultado = []
            for emp in empleados:
                fila = dict(emp)
                anticipos = conn.execute("""
                    SELECT COALESCE(SUM(CAST(monto AS REAL)), 0) FROM solicitudes
                    WHERE legajo=? AND tipo_solicitud='Solicitud de anticipo' AND estado='Aceptado'
                """, (fila['legajo'],)).fetchone()[0]
                try:
                    basico = float(fila['sueldo_basico'] or 0)
                except ValueError:
                    basico = 0
                fila['anticipos'] = round(anticipos, 2)
                fila['neto_a_pagar'] = round(basico - anticipos, 2)
                resultado.append(fila)
        return {'ok': True, 'data': resultado}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

@app.route('/api/exportar_liquidacion_xls')
def exportar_liquidacion_xls():
    liquidacion = get_liquidacion_sueldos()
    if not liquidacion['ok']:
        return jsonify(liquidacion), 500
    data = liquidacion['data']
    if not data:
        return jsonify({'ok': False, 'msg': 'No hay empleados activos para liquidar'}), 400
    headers = list(data[0].keys())
    lines = ['\t'.join(headers)]
    for fila in data:
        lines.append('\t'.join(str(fila.get(h, '')) for h in headers))
    response = make_response('\n'.join(lines).encode('utf-8-sig'))
    response.headers['Content-Type'] = 'application/vnd.ms-excel'
    response.headers['Content-Disposition'] = 'attachment; filename=liquidacion_sueldos.xls'
    return response

def get_vencimientos():
    try:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM vencimientos_pago ORDER BY fecha_vencimiento"
            ).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def guardar_vencimiento(datos):
    try:
        id = datos.get('id')
        with get_db() as conn:
            if id:
                conn.execute(
                    "UPDATE vencimientos_pago SET concepto=?, fecha_vencimiento=?, monto=? WHERE id=?",
                    (datos['concepto'], datos['fecha_vencimiento'], datos.get('monto', ''), id)
                )
            else:
                conn.execute(
                    "INSERT INTO vencimientos_pago (concepto, fecha_vencimiento, monto, estado) VALUES (?, ?, ?, 'Pendiente')",
                    (datos['concepto'], datos['fecha_vencimiento'], datos.get('monto', ''))
                )
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def actualizar_estado_vencimiento(id, estado):
    if estado not in ('Pendiente', 'Pagado'):
        return {'ok': False, 'msg': 'Estado inválido'}
    try:
        with get_db() as conn:
            conn.execute("UPDATE vencimientos_pago SET estado=? WHERE id=?", (estado, id))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def eliminar_vencimiento(id):
    try:
        with get_db() as conn:
            conn.execute("DELETE FROM vencimientos_pago WHERE id=?", (id,))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 14: ARCA (SIMULADO) ────────────────────────────────────────────────
# Nota: este módulo simula el flujo de facturación electrónica y alta temprana
# de ARCA (ex-AFIP). No se conecta a ningún webservice oficial: los números de
# CAE y trámite son generados localmente para fines de demostración.

def get_facturas_arca():
    try:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM facturas_arca ORDER BY id DESC"
            ).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def generar_factura_arca(tipo_comprobante, cliente, monto):
    try:
        with get_db() as conn:
            ultimo = conn.execute("SELECT COUNT(*) FROM facturas_arca").fetchone()[0]
            numero = f"0001-{ultimo + 1:08d}"
            cae = ''.join(random.choices(string.digits, k=14))
            fecha = datetime.now().strftime('%d-%m-%Y %H:%M')
            conn.execute("""
                INSERT INTO facturas_arca (numero, tipo_comprobante, cliente, monto, fecha, cae, estado)
                VALUES (?, ?, ?, ?, ?, ?, 'Autorizada')
            """, (numero, tipo_comprobante, cliente, monto, fecha, cae))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def get_altas_arca():
    try:
        with get_db() as conn:
            rows = conn.execute("""
                SELECT legajo, apellido_nombre, sector, fecha_ingreso,
                       alta_arca_estado, alta_arca_fecha, alta_arca_tramite
                FROM empleados WHERE estado='activo' ORDER BY apellido_nombre
            """).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def registrar_alta_arca(legajo):
    try:
        tramite = ''.join(random.choices(string.digits, k=10))
        fecha = datetime.now().strftime('%d-%m-%Y %H:%M')
        with get_db() as conn:
            conn.execute("""
                UPDATE empleados SET alta_arca_estado='Registrada', alta_arca_fecha=?, alta_arca_tramite=?
                WHERE legajo=?
            """, (fecha, tramite, legajo))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 15: EVALUACIÓN DE DESEMPEÑO ───────────────────────────────────────

def get_evaluaciones():
    try:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM evaluaciones_desempeno ORDER BY id DESC"
            ).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def guardar_evaluacion(datos):
    try:
        legajo = datos['legajo']
        with get_db() as conn:
            emp = conn.execute(
                "SELECT apellido_nombre, sector FROM empleados WHERE legajo=?", (legajo,)
            ).fetchone()
            if not emp:
                return {'ok': False, 'msg': 'Empleado no encontrado'}
            id = datos.get('id')
            if id:
                conn.execute("""
                    UPDATE evaluaciones_desempeno SET
                        periodo=?, objetivos=?, calificacion=?, comentarios=?
                    WHERE id=?
                """, (datos['periodo'], datos.get('objetivos', ''), datos['calificacion'],
                      datos.get('comentarios', ''), id))
            else:
                fecha = datetime.now().strftime('%d-%m-%Y')
                conn.execute("""
                    INSERT INTO evaluaciones_desempeno
                        (legajo, apellido_nombre, sector, periodo, objetivos, calificacion, comentarios, fecha)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (legajo, emp['apellido_nombre'], emp['sector'], datos['periodo'],
                      datos.get('objetivos', ''), datos['calificacion'], datos.get('comentarios', ''), fecha))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def eliminar_evaluacion(id):
    try:
        with get_db() as conn:
            conn.execute("DELETE FROM evaluaciones_desempeno WHERE id=?", (id,))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── MÓDULO 16: BASE DE CURRÍCULUMS ───────────────────────────────────────────

def get_curriculums():
    try:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM curriculums ORDER BY id DESC"
            ).fetchall()
        return {'ok': True, 'data': [dict(r) for r in rows]}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def guardar_curriculum(datos):
    try:
        id = datos.get('id')
        campos = ('nombre', 'puesto_buscado', 'telefono', 'email',
                  'nivel_educacional', 'experiencia', 'enlace_cv', 'comentarios', 'estado')
        vals = tuple(datos.get(c, '') for c in campos)
        with get_db() as conn:
            if id:
                sets = ', '.join(f'{c}=?' for c in campos)
                conn.execute(f"UPDATE curriculums SET {sets} WHERE id=?", (*vals, id))
            else:
                fecha = datetime.now().strftime('%d-%m-%Y')
                cols = ', '.join(campos)
                phs = ', '.join('?' * len(campos))
                conn.execute(
                    f"INSERT INTO curriculums ({cols}, fecha_carga) VALUES ({phs}, ?)",
                    (*vals, fecha)
                )
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}

def eliminar_curriculum(id):
    try:
        with get_db() as conn:
            conn.execute("DELETE FROM curriculums WHERE id=?", (id,))
            conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'msg': str(e)}


# ── TABLA DE DISPATCH ─────────────────────────────────────────────────────────

METHODS = {
    'get_sesion':               get_sesion,
    'login_admin':              login_admin,
    'login_empleado':           login_empleado,
    'logout':                   logout,
    'get_parametros':           get_parametros,
    'guardar_parametro':        guardar_parametro,
    'eliminar_parametro':       eliminar_parametro,
    'get_listas_parametros':    get_listas_parametros,
    'get_empleados':            get_empleados,
    'guardar_empleado':         guardar_empleado,
    'eliminar_empleado':        eliminar_empleado,
    'get_perfil_empleado':      get_perfil_empleado,
    'guardar_datos_personales': guardar_datos_personales,
    'agregar_familiar':         agregar_familiar,
    'eliminar_familiar':        eliminar_familiar,
    'get_consolidado':          get_consolidado,
    'get_ficha_empleado':       get_ficha_empleado,
    'buscar_empleado_para_baja': buscar_empleado_para_baja,
    'registrar_baja':           registrar_baja,
    'crear_solicitud':          crear_solicitud,
    'get_mis_solicitudes':      get_mis_solicitudes,
    'get_solicitudes':          get_solicitudes,
    'actualizar_estado_solicitud': actualizar_estado_solicitud,
    'crear_reconocimiento':     crear_reconocimiento,
    'get_reconocimientos':      get_reconocimientos,
    'eliminar_reconocimiento':  eliminar_reconocimiento,
    'get_recursos':             get_recursos,
    'guardar_recurso':          guardar_recurso,
    'eliminar_recurso':         eliminar_recurso,
    'get_beneficios':           get_beneficios,
    'guardar_beneficio':        guardar_beneficio,
    'eliminar_beneficio':       eliminar_beneficio,
    'get_estado_encuesta':      get_estado_encuesta,
    'guardar_respuesta_encuesta': guardar_respuesta_encuesta,
    'get_resultados_encuesta':  get_resultados_encuesta,
    'get_liquidacion_sueldos':  get_liquidacion_sueldos,
    'get_vencimientos':         get_vencimientos,
    'guardar_vencimiento':      guardar_vencimiento,
    'actualizar_estado_vencimiento': actualizar_estado_vencimiento,
    'eliminar_vencimiento':     eliminar_vencimiento,
    'get_facturas_arca':        get_facturas_arca,
    'generar_factura_arca':     generar_factura_arca,
    'get_altas_arca':           get_altas_arca,
    'registrar_alta_arca':      registrar_alta_arca,
    'get_evaluaciones':         get_evaluaciones,
    'guardar_evaluacion':       guardar_evaluacion,
    'eliminar_evaluacion':      eliminar_evaluacion,
    'get_curriculums':          get_curriculums,
    'guardar_curriculum':       guardar_curriculum,
    'eliminar_curriculum':      eliminar_curriculum,
}


# ── INIT DB ───────────────────────────────────────────────────────────────────

def init_db():
    with get_db() as conn:
        conn.executescript("""
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
        """)
        # Migrations for existing databases
        migrations = [
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
        ]
        for sql in migrations:
            try:
                conn.execute(sql)
            except sqlite3.OperationalError:
                pass
        conn.execute("UPDATE empleados SET estado='activo' WHERE estado IS NULL")
        conn.execute("UPDATE empleados SET alta_arca_estado='Pendiente' WHERE alta_arca_estado IS NULL")
        conn.commit()
        try:
            conn.execute(
                "INSERT INTO admin_usuarios (usuario, password) VALUES (?, ?)",
                ('admin', 'admin123')
            )
            conn.commit()
        except sqlite3.IntegrityError:
            pass


if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(debug=debug, host='0.0.0.0', port=port)
