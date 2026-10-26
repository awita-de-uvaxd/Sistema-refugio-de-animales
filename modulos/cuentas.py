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
ROLES_ALTA = ROLES_PERSONAL | frozenset({'usuario'})
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
    """Claves temporales de al menos 8 caracteres; se guardan como hash."""
    if not valor or not 8 <= len(valor) <= 128:
        raise ValueError('La contraseña debe contener entre 8 y 128 caracteres.')
    return valor


def codigo_validado(valor):
    codigo = (valor or '').strip().upper()
    if not re.fullmatch(r'[A-Z0-9][A-Z0-9_-]{0,19}', codigo):
        raise ValueError('El código debe tener de 1 a 20 caracteres: solo números, letras y números, o letras; también admite _ y -.')
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
        if rol not in ROLES_ALTA:
            raise ValueError('Rol no autorizado.')
        # Un unico identificador por cuenta: correo O codigo.
        correo_entrada = (request.form.get('correo') or '').strip()
        codigo_entrada = (request.form.get('codigo') or '').strip()
        if bool(correo_entrada) == bool(codigo_entrada):
            raise ValueError('Indica un correo o un código de acceso, pero no ambos.')
        correo = correo_validado(correo_entrada) if correo_entrada else None
        codigo = codigo_validado(codigo_entrada) if codigo_entrada else None
        clave = clave_validada(request.form.get('password'))
        if not hmac.compare_digest(clave, request.form.get('confirmar_password') or ''):
            raise ValueError('La contraseña y su confirmación deben coincidir.')
        if correo and email_ya_usado(db, Usuario, correo):
            raise ValueError('Ese correo ya está registrado.')
        if codigo and Usuario.query.filter_by(codigo_empleado=codigo).first():
            raise ValueError('Ese código ya está registrado.')
        persona = Usuario(nombre=nombre, correo=correo, codigo_empleado=codigo,
                          password=generate_password_hash(clave), rol=rol,
                          activo=True, sesion_version=0)
        db.session.add(persona)
        db.session.flush()
        auditar(db, AuditoriaCuenta, admin, persona, 'ALTA_' + rol.upper())
        db.session.commit()
        flash('Cuenta creada correctamente. Inicia sesión con el correo o código elegido y la contraseña temporal.', 'success')
    except (ValueError, IntegrityError) as error:
        db.session.rollback()
        flash(str(error) if isinstance(error, ValueError) else 'Código o correo ya utilizado.', 'error')
    return redirect(url_for('admin') + ('#usuarios' if request.form.get('rol') == 'usuario' else '#logs'))


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
            # Exigir confirmación solo cuando se establece manualmente una clave
            # para personal desde Auditoría; la generación automática se conserva.
            if persona.rol in ROLES_PERSONAL:
                confirmacion = request.form.get('confirmar_nueva_password') or ''
                if entrada:
                    if not hmac.compare_digest(entrada, confirmacion):
                        raise ValueError('La contraseña y su confirmación deben coincidir.')
                elif confirmacion:
                    raise ValueError('Escribe la nueva contraseña y su confirmación, o deja ambos campos vacíos para generar una automáticamente.')
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
            # Tras asignar correo, ese será el único identificador para iniciar sesión.
            persona.codigo_empleado = None
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

    @bp.route('/administracion/cuentas/<int:user_id>/eliminar-definitivamente', methods=['POST'])
    def eliminar_definitivamente(user_id):
        """Borrado físico de usuarios normales y datos relacionales propios.

        Una baja normal debe utilizar 'baja'. Esta operación requiere volver a
        autenticar al administrador; nunca acepta la eliminación de empleados.
        """
        from flask import current_app
        from sqlalchemy.exc import SQLAlchemyError
        from werkzeug.security import check_password_hash

        admin = exigir_admin(db, Usuario)
        validar_csrf()
        persona = db.session.get(Usuario, user_id)
        if persona is None:
            abort(404)
        if persona.id == admin.id or persona.rol != 'usuario':
            abort(403, description='La eliminación definitiva solo está habilitada para usuarios normales distintos del administrador actual.')
        if request.form.get('confirmacion', '').strip() != 'ELIMINAR':
            flash('Para borrar la cuenta escribe exactamente ELIMINAR.', 'error')
            return redireccion_cuenta(persona)
        password_admin = request.form.get('password_admin', '')
        if not password_admin or not check_password_hash(admin.password, password_admin):
            flash('La contraseña del administrador es incorrecta. No se eliminó ninguna cuenta.', 'error')
            return redireccion_cuenta(persona)

        # Las FK obligatorias de personal médico y rescates NO deben perderse:
        # si una cuenta fue anteriormente empleado, exigir resolución manual.
        relacionados_bloqueantes = (
            ('rescate', 'rescatista_id'),
            ('consulta_medica', 'veterinario_id'),
            ('cita', 'veterinario_id'),
        )
        try:
            for tabla, campo in relacionados_bloqueantes:
                existe = db.session.execute(
                    text(f'SELECT 1 FROM {tabla} WHERE {campo} = :uid LIMIT 1'),
                    {'uid': user_id}
                ).first()
                if existe:
                    flash('Este usuario tiene rescates, consultas o citas vinculados. No puede borrarse sin resolver primero esos registros.', 'error')
                    return redireccion_cuenta(persona)

            # Evita dejar huérfanas nuevas relaciones agregadas a Usuario.
            # Si otra tabla referencia usuario.id y no está contemplada, abortar
            # en lugar de borrar datos que el sistema desconoce.
            relaciones_permitidas = {
                ('perfil_adopcion', 'usuario_id'),
                ('solicitud_adopcion', 'usuario_id'),
                ('reclamo_propiedad', 'usuario_id'),
                ('solicitud_voluntariado', 'usuario_id'),
                ('pedido', 'usuario_id'),
                ('paciente', 'dueno_id'),
            }
            for tabla in db.metadata.tables.values():
                for columna in tabla.columns:
                    for fk in columna.foreign_keys:
                        if fk.column.table.name == 'usuario' and (tabla.name, columna.name) not in relaciones_permitidas and tabla.name != 'usuario':
                            raise ValueError(f'Existe una relación adicional ({tabla.name}.{columna.name}). Se requiere revisar la eliminación.')

            # Guardar referencias a fotografías para limpieza después del commit.
            fotos_candidatas = set()
            if persona.foto_perfil:
                fotos_candidatas.add(persona.foto_perfil)
            for (fotos,) in db.session.execute(text(
                'SELECT evidencia_fotos FROM reclamo_propiedad WHERE usuario_id = :uid'
            ), {'uid': user_id}).all():
                fotos_candidatas.update((fotos or '').split(','))
            for (fotos,) in db.session.execute(text(
                'SELECT fotos_espacio FROM solicitud_voluntariado WHERE usuario_id = :uid'
            ), {'uid': user_id}).all():
                fotos_candidatas.update((fotos or '').split(','))

            # Primero eliminar registros dependientes; nunca borrar mascotas o
            # historiales clínicos: solo se quita el vínculo de propietario.
            db.session.execute(text('UPDATE paciente SET dueno_id = NULL WHERE dueno_id = :uid'), {'uid': user_id})
            for tabla in ('solicitud_adopcion', 'reclamo_propiedad', 'solicitud_voluntariado',
                          'pedido', 'perfil_adopcion'):
                db.session.execute(text(f'DELETE FROM {tabla} WHERE usuario_id = :uid'), {'uid': user_id})

            # Los registros de auditoría pueden contener nombre/ID del usuario.
            db.session.execute(text('DELETE FROM auditoria_cuenta WHERE objetivo_id = :uid OR administrador_id = :uid'), {'uid': user_id})
            borradas = db.session.execute(text('DELETE FROM usuario WHERE id = :uid'), {'uid': user_id}).rowcount
            if borradas != 1:
                raise ValueError('No fue posible confirmar la eliminación de la cuenta.')

            # Dejar evidencia administrativa sin nombre, correo ni ID eliminados.
            db.session.add(AuditoriaCuenta(
                administrador_id=admin.id, administrador_nombre=admin.nombre,
                objetivo_id=0, objetivo_nombre='Cuenta eliminada definitivamente',
                accion='BORRADO_DEFINITIVO'
            ))
            db.session.commit()
        except (ValueError, SQLAlchemyError) as exc:
            db.session.rollback()
            current_app.logger.exception('Fallo al eliminar definitivamente la cuenta')
            flash('No se eliminó la cuenta. ' + (str(exc) if isinstance(exc, ValueError) else 'Revisa los registros asociados e inténtalo nuevamente.'), 'error')
            return redirect(url_for('admin') + '#usuarios')

        # Únicamente archivos locales que ya no aparecen referenciados en BD;
        # nunca borrar fotos predeterminadas ni archivos compartidos.
        _borrar_adjuntos_no_referenciados(db, current_app, fotos_candidatas)
        flash('Cuenta de usuario y registros personales vinculados eliminados definitivamente. Las mascotas y sus historiales se conservaron sin propietario asignado.', 'success')
        return redirect(url_for('admin') + '#usuarios')

    app.register_blueprint(bp)


def _borrar_adjuntos_no_referenciados(db, app, nombres):
    """Limpieza conservadora de archivos no compartidos en static/uploads."""
    from pathlib import Path
    from sqlalchemy import String, Text

    carpeta = (Path(app.root_path) / app.config.get('UPLOAD_FOLDER', 'static/uploads')).resolve()
    ignorar = {'', 'default_user.png', 'default.png', 'none', 'null'}
    for candidato in nombres:
        nombre = (candidato or '').strip()
        if not nombre or nombre.lower() in ignorar or Path(nombre).name != nombre or '/' in nombre or '\\' in nombre:
            continue
        destino = carpeta / nombre
        # No permitir salir de uploads ni seguir enlaces simbólicos.
        if not destino.is_file() or destino.is_symlink() or destino.resolve().parent != carpeta:
            continue
        # Revisar todas las columnas de texto de los modelos conocidos.
        # Una coincidencia exacta o como elemento de lista CSV conserva el archivo.
        en_uso = False
        for tabla in db.metadata.tables.values():
            if en_uso:
                break
            for columna in tabla.columns:
                if not isinstance(columna.type, (String, Text)):
                    continue
                quote = db.engine.dialect.identifier_preparer.quote
                sql = f'SELECT {quote(columna.name)} FROM {quote(tabla.name)} WHERE {quote(columna.name)} LIKE :valor'
                for (valor,) in db.session.execute(text(sql), {'valor': '%' + nombre + '%'}).all():
                    partes = [x.strip() for x in (valor or '').split(',')]
                    if nombre in partes:
                        en_uso = True
                        break
                if en_uso:
                    break
        if not en_uso:
            try:
                destino.unlink()
            except OSError:
                app.logger.warning('No fue posible limpiar un adjunto no referenciado: %s', nombre)


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
