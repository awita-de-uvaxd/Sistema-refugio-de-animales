"""Administración segura de perfiles para el modelo Usuario existente.

Este módulo no depende de app.py directamente; recibe db y Usuario mediante
registrar_cuentas, evitando importaciones circulares.
"""
import hmac
import re
import secrets

from flask import Blueprint, abort, flash, redirect, render_template, request, session, url_for
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash

from modulos.validaciones import nombre_persona


ROLES_PERSONAL = frozenset({'admin', 'rescatista', 'veterinario'})
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def token_csrf():
    if '_csrf_cuentas' not in session:
        session['_csrf_cuentas'] = secrets.token_urlsafe(32)
    return session['_csrf_cuentas']


def validar_csrf():
    actual = session.get('_csrf_cuentas', '')
    enviado = request.form.get('csrf_token', '')
    if not actual or not hmac.compare_digest(actual, enviado):
        abort(400, description='Token de seguridad inválido. Actualiza la página.')


def exigir_admin(db, Usuario):
    uid = session.get('usuario_id')
    if uid is None or session.get('rol') != 'admin':
        abort(403)
    persona = db.session.get(Usuario, uid)
    if not persona or not persona.activo or persona.rol != 'admin':
        abort(403)
    return persona


def correo_validado(valor):
    email = (valor or '').strip().lower()
    if len(email) > 100 or not EMAIL_RE.fullmatch(email):
        raise ValueError('Ingresa una dirección de correo válida (máximo 100 caracteres).')
    return email


def clave_validada(valor):
    if not valor or not 12 <= len(valor) <= 128:
        raise ValueError('La contraseña debe contener entre 12 y 128 caracteres.')
    return valor


def codigo_validado(valor):
    codigo = (valor or '').strip().upper()
    if not re.fullmatch(r'[A-Z0-9][A-Z0-9_-]{2,19}', codigo):
        raise ValueError('El código debe tener de 3 a 20 caracteres: letras, números, _ o -.')
    return codigo


def email_ya_usado(db, Usuario, correo, except_id=None):
    q = Usuario.query.filter(db.func.lower(Usuario.correo) == correo.lower())
    if except_id is not None:
        q = q.filter(Usuario.id != except_id)
    return q.first() is not None


def auditar(db, AuditoriaCuenta, admin, persona, accion):
    db.session.add(AuditoriaCuenta(
        administrador_id=admin.id, administrador_nombre=admin.nombre,
        objetivo_id=persona.id, objetivo_nombre=persona.nombre, accion=accion
    ))


def crear_empleado_seguro(db, Usuario, AuditoriaCuenta):
    admin = exigir_admin(db, Usuario)
    validar_csrf()
    try:
        nombre = nombre_persona(request.form.get('nombre'))
        rol = request.form.get('rol')
        if rol not in ROLES_PERSONAL:
            raise ValueError('Rol no autorizado.')
        correo = correo_validado(request.form.get('correo'))
        codigo = codigo_validado(request.form.get('codigo'))
        clave = clave_validada(request.form.get('password'))
        if email_ya_usado(db, Usuario, correo):
            raise ValueError('Ese correo ya está registrado.')
        if Usuario.query.filter_by(codigo_empleado=codigo).first():
            raise ValueError('Ese código ya está registrado.')
        persona = Usuario(nombre=nombre, correo=correo, codigo_empleado=codigo,
                          password=generate_password_hash(clave), rol=rol,
                          activo=True, sesion_version=0)
        db.session.add(persona)
        db.session.flush()
        auditar(db, AuditoriaCuenta, admin, persona, 'ALTA_' + rol.upper())
        db.session.commit()
        flash('Perfil creado correctamente. Puede iniciar sesión con su correo o código.', 'success')
    except (ValueError, IntegrityError) as error:
        db.session.rollback()
        flash(str(error) if isinstance(error, ValueError) else 'Código o correo ya utilizado.', 'error')
    return redirect(url_for('admin') + '#logs')


def registrar_cuentas(app, db, Usuario, AuditoriaCuenta):
    """Instala las rutas del módulo de cuentas. Requiere modelos del app original."""
    app.jinja_env.globals['csrf_token'] = token_csrf
    bp = Blueprint('cuentas', __name__)

    def redireccion_cuenta(persona):
        return redirect(url_for('admin') + ('#usuarios' if persona.rol == 'usuario' else '#logs'))

    @bp.route('/administracion/cuentas/<int:user_id>/clave', methods=['POST'])
    def restablecer_clave(user_id):
        admin = exigir_admin(db, Usuario)
        validar_csrf()
        persona = db.session.get(Usuario, user_id)
        if not persona:
            abort(404)
        if persona.id == admin.id:
            flash('Cambia tu propia contraseña desde Mi Perfil.', 'error')
            return redireccion_cuenta(persona)
        try:
            entrada = (request.form.get('nueva_password') or '')
            nueva = clave_validada(entrada) if entrada else secrets.token_urlsafe(18)
            persona.password = generate_password_hash(nueva)
            persona.sesion_version = (persona.sesion_version or 0) + 1
            auditar(db, AuditoriaCuenta, admin, persona, 'RESTABLECER_CLAVE')
            db.session.commit()
        except ValueError as error:
            db.session.rollback()
            flash(str(error), 'error')
            return redireccion_cuenta(persona)
        response = render_template('admin/clave_temporal.html', cuenta=persona, nueva_clave=nueva)
        from flask import make_response
        output = make_response(response)
        output.headers['Cache-Control'] = 'no-store, max-age=0, private'
        output.headers['Pragma'] = 'no-cache'
        return output

    @bp.route('/administracion/cuentas/<int:user_id>/correo', methods=['POST'])
    def actualizar_correo(user_id):
        admin = exigir_admin(db, Usuario)
        validar_csrf()
        persona = db.session.get(Usuario, user_id)
        if not persona:
            abort(404)
        try:
            correo = correo_validado(request.form.get('correo'))
            if email_ya_usado(db, Usuario, correo, except_id=user_id):
                raise ValueError('Ese correo ya pertenece a otra cuenta.')
            persona.correo = correo
            persona.sesion_version = (persona.sesion_version or 0) + 1
            auditar(db, AuditoriaCuenta, admin, persona, 'CAMBIAR_CORREO')
            db.session.commit()
            flash('Correo actualizado. La cuenta debe iniciar sesión de nuevo.', 'success')
        except (ValueError, IntegrityError) as error:
            db.session.rollback()
            flash(str(error) if isinstance(error, ValueError) else 'El correo ya está en uso.', 'error')
        return redireccion_cuenta(persona)

    @bp.route('/administracion/cuentas/<int:user_id>/baja', methods=['POST'])
    def baja(user_id):
        admin = exigir_admin(db, Usuario)
        validar_csrf()
        persona = db.session.get(Usuario, user_id)
        if not persona:
            abort(404)
        if persona.id == admin.id:
            flash('No puedes eliminar tu propio acceso.', 'error')
            return redireccion_cuenta(persona)
        if persona.rol == 'admin' and Usuario.query.filter_by(rol='admin', activo=True).count() <= 1:
            flash('Debe quedar al menos un administrador activo.', 'error')
            return redireccion_cuenta(persona)
        if not persona.activo:
            flash('La cuenta ya estaba dada de baja.', 'error')
            return redireccion_cuenta(persona)
        persona.activo = False  # Baja lógica: conservar referencias de rescates y consultas
        persona.sesion_version = (persona.sesion_version or 0) + 1
        auditar(db, AuditoriaCuenta, admin, persona, 'BAJA_CUENTA')
        db.session.commit()
        flash('Cuenta eliminada del personal activo y acceso revocado.', 'success')
        return redireccion_cuenta(persona)

    @bp.route('/administracion/cuentas/<int:user_id>/rol', methods=['POST'])
    def cambiar_rol(user_id):
        admin = exigir_admin(db, Usuario)
        validar_csrf()
        persona = db.session.get(Usuario, user_id)
        if not persona:
            abort(404)
        if persona.id == admin.id:
            flash('No puedes cambiar tu propio rol.', 'error')
            return redireccion_cuenta(persona)
        nuevo_rol = request.form.get('rol')
        if nuevo_rol not in ROLES_PERSONAL:
            abort(400)
        if persona.rol == 'admin' and nuevo_rol != 'admin' and Usuario.query.filter_by(rol='admin', activo=True).count() <= 1:
            flash('Debe quedar al menos un administrador activo.', 'error')
            return redireccion_cuenta(persona)
        if persona.rol != nuevo_rol:
            anterior = persona.rol
            persona.rol = nuevo_rol
            persona.sesion_version = (persona.sesion_version or 0) + 1
            auditar(db, AuditoriaCuenta, admin, persona, 'ROL_' + anterior.upper() + '_A_' + nuevo_rol.upper())
            db.session.commit()
            flash('Rol actualizado y sesiones anteriores revocadas.', 'success')
        return redireccion_cuenta(persona)

    @bp.route('/administracion/cuentas/<int:user_id>/reactivar', methods=['POST'])
    def reactivar(user_id):
        admin = exigir_admin(db, Usuario)
        validar_csrf()
        persona = db.session.get(Usuario, user_id)
        if not persona:
            abort(404)
        if not persona.activo:
            persona.activo = True
            persona.sesion_version = (persona.sesion_version or 0) + 1
            auditar(db, AuditoriaCuenta, admin, persona, 'REACTIVAR_CUENTA')
            db.session.commit()
            flash('Cuenta reactivada.', 'success')
        return redireccion_cuenta(persona)

    app.register_blueprint(bp)


def asegurar_columnas_existentes(db):
    """Migración pequeña, no destructiva, para bases SQLite de versiones anteriores.

    Ejecutar después de db.create_all() y antes de la primera consulta del modelo.
    """
    dialect = db.engine.dialect.name
    if dialect != 'sqlite':
        raise RuntimeError('Este upgrade automático admite solo SQLite: usa Alembic en otro motor.')
    with db.engine.begin() as conn:
        columnas = {row[1] for row in conn.execute(text('PRAGMA table_info(usuario)'))}
        if not columnas:
            raise RuntimeError('No existe la tabla usuario; ejecuta db.create_all() primero.')
        if 'activo' not in columnas:
            conn.execute(text('ALTER TABLE usuario ADD COLUMN activo BOOLEAN NOT NULL DEFAULT 1'))
        if 'sesion_version' not in columnas:
            conn.execute(text('ALTER TABLE usuario ADD COLUMN sesion_version INTEGER NOT NULL DEFAULT 0'))
