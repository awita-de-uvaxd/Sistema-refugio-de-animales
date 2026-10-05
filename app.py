import os
from flask import Flask, render_template, request, redirect, url_for, session, flash
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime
import json

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///huellitas.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'huellitas_secreto_2026'

# NUEVO: Configuración para guardar imágenes
app.config['UPLOAD_FOLDER'] = 'static/uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True) # Crea la carpeta automáticamente si no existe

db = SQLAlchemy(app)

# ==========================================
# 1. MODELOS DE BASE DE DATOS
# ==========================================
class Usuario(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    correo = db.Column(db.String(100), unique=True, nullable=True)
    codigo_empleado = db.Column(db.String(20), unique=True, nullable=True)
    password = db.Column(db.String(200), nullable=False)
    rol = db.Column(db.String(20), nullable=False, default='usuario')
    # Relación: Un usuario tiene un único CV de adopción
    perfil_cv = db.relationship('PerfilAdopcion', backref='usuario', uselist=False, lazy=True)

class PerfilAdopcion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    dpi = db.Column(db.String(20))
    fecha_nacimiento = db.Column(db.String(20))
    telefono = db.Column(db.String(20))
    direccion = db.Column(db.Text)
    ocupacion = db.Column(db.String(100))
    redes_sociales = db.Column(db.String(100))
    tipo_vivienda = db.Column(db.String(50))
    tenencia = db.Column(db.String(50))
    permiso_arrendador = db.Column(db.String(50))
    cerramiento = db.Column(db.String(50))
    integrantes = db.Column(db.Text)
    acuerdo_familiar = db.Column(db.String(50))
    alergias_familia = db.Column(db.String(50))
    mascotas_actuales = db.Column(db.Text)
    mascotas_anteriores = db.Column(db.Text)
    motivo_adopcion = db.Column(db.Text)
    lugar_estancia = db.Column(db.String(200))
    horas_solo = db.Column(db.String(50))
    presupuesto = db.Column(db.String(50))
    plan_viaje = db.Column(db.String(200))
    plan_mudanza = db.Column(db.String(200))
    problema_conducta = db.Column(db.String(50))
    gastos_emergencia = db.Column(db.String(20))
    seguimiento = db.Column(db.String(20))
    contrato = db.Column(db.String(20))
    ref1_nombre = db.Column(db.String(100))
    ref1_tel = db.Column(db.String(100))
    ref2_nombre = db.Column(db.String(100))
    ref2_tel = db.Column(db.String(100))

class SolicitudAdopcion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    estado = db.Column(db.String(20), default="En Revisión")
    dpi = db.Column(db.String(20))
    ocupacion = db.Column(db.String(100))
    tipo_vivienda = db.Column(db.String(50))
    horas_solo = db.Column(db.String(50))
    paciente_id = db.Column(db.Integer, db.ForeignKey('paciente.id'), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    paciente_obj = db.relationship('Paciente', backref='solicitudes_recibidas', lazy=True)
    usuario_obj = db.relationship('Usuario', backref='solicitudes_enviadas', lazy=True)

class ReclamoPropiedad(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    nombre_responde = db.Column(db.String(100))
    marcas_unicas = db.Column(db.Text)
    evidencia_fotos = db.Column(db.Text)
    estado = db.Column(db.String(20), default="En Revisión")
    paciente_id = db.Column(db.Integer, db.ForeignKey('paciente.id'), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    paciente_obj = db.relationship('Paciente', backref='reclamos_recibidos', lazy=True)
    usuario_obj = db.relationship('Usuario', backref='reclamos_enviados', lazy=True)

class ProgramaVoluntariado(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(50), nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    fotos = db.Column(db.Text, nullable=True)

class SolicitudVoluntariado(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    tipo_voluntariado = db.Column(db.String(50), nullable=False)
    estado = db.Column(db.String(20), default="Pendiente")
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    usuario_obj = db.relationship('Usuario', backref='solicitudes_voluntariado', lazy=True)

    # --- CAMPOS COMPARTIDOS ---
    contacto_emergencia = db.Column(db.String(200))
    turnos_disponibles = db.Column(db.String(200))

    # --- 1. CAMPOS: VOLUNTARIADO OPERATIVO ---
    tarea_popo = db.Column(db.String(20))
    tarea_bano = db.Column(db.String(20))
    tarea_peinar = db.Column(db.String(20))
    tarea_corte = db.Column(db.String(20))
    tarea_paseo = db.Column(db.String(20))
    tarea_lavado = db.Column(db.String(20))
    exp_peluqueria = db.Column(db.String(50))
    fuerza_fisica = db.Column(db.String(50))
    tetanos = db.Column(db.String(20))

    # --- 2. CAMPOS: APTITUD Y CONVIVENCIA ---
    alergias = db.Column(db.String(50))
    reaccion_previa = db.Column(db.String(20))
    limitaciones_fisicas = db.Column(db.String(50))
    motivacion = db.Column(db.Text)
    reaccion_miedo = db.Column(db.String(50))
    accidente_actitud = db.Column(db.String(50))
    disciplina = db.Column(db.String(50))
    cumple_reglas = db.Column(db.String(20))
    expectativa = db.Column(db.Text)

    # --- 3. CAMPOS: APOYO TEMPORAL ---
    horas_disponibles = db.Column(db.String(100))
    vivienda = db.Column(db.String(50))
    permiso = db.Column(db.String(50))
    fotos_espacio = db.Column(db.Text) # Guardará los nombres de las 5 fotos
    habitantes = db.Column(db.String(100))
    edades_ninos = db.Column(db.String(100))
    mascotas_actuales = db.Column(db.Text)
    experiencia = db.Column(db.String(50))
    energia_preferida = db.Column(db.String(50))
    conductas = db.Column(db.String(50))
    accidentes = db.Column(db.String(20))
    lugar_dormir = db.Column(db.String(100))
    tiempo_solo = db.Column(db.String(50))
    transporte = db.Column(db.String(20))
    moviliza_refugio = db.Column(db.String(20))

class Paciente(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    especie = db.Column(db.String(50), nullable=False)
    sexo = db.Column(db.String(20), nullable=False)
    foto = db.Column(db.Text, nullable=True)
    disponible_adopcion = db.Column(db.String(20), default="En Observación")
    dueno_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=True)
    rescate_id = db.Column(db.Integer, db.ForeignKey('rescate.id'), nullable=True)
    rescate_obj = db.relationship('Rescate', backref='paciente_asociado', lazy=True)
    consultas = db.relationship('ConsultaMedica', backref='paciente_obj', lazy=True, order_by='ConsultaMedica.id.desc()')
    citas = db.relationship('Cita', backref='paciente_obj', lazy=True)

class ConsultaMedica(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    tipo_consulta = db.Column(db.String(50))
    temperatura = db.Column(db.String(10))
    peso = db.Column(db.String(10))
    sintomas = db.Column(db.Text)
    diagnostico = db.Column(db.Text)
    tratamiento = db.Column(db.Text)
    evidencia_fotos = db.Column(db.Text)
    paciente_id = db.Column(db.Integer, db.ForeignKey('paciente.id'), nullable=False)
    veterinario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    veterinario_obj = db.relationship('Usuario', backref='consultas_dadas', lazy=True)
    vacunas = db.relationship('Vacuna', backref='consulta_obj', lazy=True)

class Vacuna(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    frecuencia = db.Column(db.String(50), nullable=False)
    fecha_aplicacion = db.Column(db.DateTime, default=datetime.utcnow)
    paciente_id = db.Column(db.Integer, db.ForeignKey('paciente.id'), nullable=False)
    consulta_id = db.Column(db.Integer, db.ForeignKey('consulta_medica.id'), nullable=True)

class Cita(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.String(20), nullable=False) # Formato YYYY-MM-DD
    motivo = db.Column(db.String(200), nullable=False)
    estado = db.Column(db.String(20), default="Pendiente")
    paciente_id = db.Column(db.Integer, db.ForeignKey('paciente.id'), nullable=False)
    veterinario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)

class Alerta(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    urgencia = db.Column(db.String(50), nullable=False)
    especie_cantidad = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    direccion = db.Column(db.String(200), nullable=False)
    indicaciones = db.Column(db.Text)
    entorno = db.Column(db.String(50))
    nombre_reporta = db.Column(db.String(100), nullable=False)
    telefono_reporta = db.Column(db.String(20), nullable=False)
    estado = db.Column(db.String(20), default="Pendiente")
    foto = db.Column(db.String(200)) 

class Rescate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    direccion = db.Column(db.String(200), nullable=False)
    especie = db.Column(db.String(50), nullable=False)
    sexo = db.Column(db.String(20), nullable=False)
    gravedad = db.Column(db.String(20), nullable=False)
    color = db.Column(db.String(50), nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    estado = db.Column(db.String(20), default="Pendiente")
    rescatista_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    alerta_id = db.Column(db.Integer, db.ForeignKey('alerta.id'), nullable=True)
    alerta_obj = db.relationship('Alerta', backref='rescate_asociado', lazy=True)

class ProductoShop(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    precio = db.Column(db.Float, nullable=False)
    descripcion = db.Column(db.Text)
    foto = db.Column(db.Text)

class Pedido(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    estado = db.Column(db.String(20), default="Pagado")
    producto_id = db.Column(db.Integer, db.ForeignKey('producto_shop.id'), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)

# ==========================================
# 2. RUTAS DE AUTENTICACIÓN
# ==========================================
@app.route('/registro', methods=['GET', 'POST'])
def registro():
    if request.method == 'POST':
        nombre = request.form.get('nombre')
        correo = request.form.get('correo')
        password = request.form.get('password')
        
        password_encriptada = generate_password_hash(password)
        nuevo_usuario = Usuario(nombre=nombre, correo=correo, password=password_encriptada, rol='usuario')
        db.session.add(nuevo_usuario)
        db.session.commit()
        
        flash('Registro exitoso. Ahora puedes iniciar sesión.', 'success')
        return redirect(url_for('login'))
    return render_template('registro.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        correo_o_codigo = request.form.get('credencial')
        password = request.form.get('password')
        
        usuario = Usuario.query.filter((Usuario.correo == correo_o_codigo) | (Usuario.codigo_empleado == correo_o_codigo)).first()
        
        if usuario and check_password_hash(usuario.password, password):
            session['usuario_id'] = usuario.id
            session['rol'] = usuario.rol
            session['nombre'] = usuario.nombre
            
            if usuario.rol == 'admin': return redirect(url_for('admin'))
            elif usuario.rol == 'veterinario': return redirect(url_for('veterinario'))
            elif usuario.rol == 'rescatista': return redirect(url_for('rescatista'))
            else: return redirect(url_for('usuario'))
        else:
            flash('Credenciales incorrectas. Intenta de nuevo.', 'error')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('inicio'))

# ==========================================
# 3. RUTAS DE VISUALIZACIÓN
# ==========================================
@app.route('/')
def inicio(): return render_template('inicio.html')

@app.route('/rescatista')
def rescatista(): 
    if 'usuario_id' not in session or session['rol'] != 'rescatista': return redirect(url_for('login'))
    rescates_db = Rescate.query.filter_by(rescatista_id=session['usuario_id']).all()
    alertas_db = Alerta.query.filter_by(estado='Pendiente').order_by(Alerta.id.desc()).all()
    return render_template('rescatista.html', mis_rescates=rescates_db, alertas=alertas_db)

@app.route('/veterinario')
def veterinario(): 
    if 'usuario_id' not in session or session['rol'] != 'veterinario': return redirect(url_for('login'))
    
    rescates_pendientes = Rescate.query.filter_by(estado='Pendiente').all()
    # Cargamos todos los pacientes y todas las citas pendientes
    todos_pacientes = Paciente.query.all()
    citas_pendientes = Cita.query.filter_by(estado='Pendiente').order_by(Cita.fecha.asc()).all()
    
    hoy = datetime.utcnow().strftime('%Y-%m-%d')
    return render_template('veterinario.html', rescates=rescates_pendientes, pacientes=todos_pacientes, citas=citas_pendientes, hoy=hoy)

@app.route('/usuario')
def usuario(): 
    if 'usuario_id' not in session or session['rol'] != 'usuario': return redirect(url_for('login'))
    # Buscamos el CV en la nueva tabla
    cv_actual = PerfilAdopcion.query.filter_by(usuario_id=session['usuario_id']).first()
    disponibles = Paciente.query.filter_by(disponible_adopcion="Listo para Adopción").all()
    # NUEVO: Traemos los programas de voluntariado de la base de datos
    programas_db = ProgramaVoluntariado.query.all()
    
    return render_template('usuario.html', adopciones=disponibles, mi_cv=cv_actual, programas=programas_db)

@app.route('/enviar_voluntariado', methods=['POST'])
def enviar_voluntariado():
    if 'usuario_id' not in session or session['rol'] != 'usuario': return redirect(url_for('login'))
    
    # Procesar arrays de checkboxes (turnos, disponibilidad, habitantes)
    turnos = request.form.getlist('turnos[]') or request.form.getlist('disponibilidad[]')
    turnos_str = ", ".join(turnos) if turnos else None
    habitantes_str = ", ".join(request.form.getlist('habitantes[]')) if request.form.getlist('habitantes[]') else None

    # Procesar múltiples fotos (solo para Hogar Temporal)
    nombres_fotos = []
    if 'fotos[]' in request.files:
        for archivo in request.files.getlist('fotos[]'):
            if archivo.filename != '':
                nom_arch = secure_filename(archivo.filename)
                archivo.save(os.path.join(app.config['UPLOAD_FOLDER'], nom_arch))
                nombres_fotos.append(nom_arch)
    fotos_str = ",".join(nombres_fotos) if nombres_fotos else None

    nueva_solicitud = SolicitudVoluntariado(
        tipo_voluntariado=request.form.get('tipo_voluntariado'),
        usuario_id=session['usuario_id'],
        contacto_emergencia=request.form.get('contacto_emergencia'),
        turnos_disponibles=turnos_str,
        
        # Operativo
        tarea_popo=request.form.get('tarea_popo'),
        tarea_bano=request.form.get('tarea_bano'),
        tarea_peinar=request.form.get('tarea_peinar'),
        tarea_corte=request.form.get('tarea_corte'),
        tarea_paseo=request.form.get('tarea_paseo'),
        tarea_lavado=request.form.get('tarea_lavado'),
        exp_peluqueria=request.form.get('exp_peluqueria'),
        fuerza_fisica=request.form.get('fuerza_fisica'),
        tetanos=request.form.get('tetanos'),
        
        # Convivencia
        alergias=request.form.get('alergias'),
        reaccion_previa=request.form.get('reaccion_previa'),
        limitaciones_fisicas=request.form.get('limitaciones_fisicas'),
        motivacion=request.form.get('motivacion'),
        reaccion_miedo=request.form.get('reaccion_miedo'),
        accidente_actitud=request.form.get('accidente_actitud'),
        disciplina=request.form.get('disciplina'),
        cumple_reglas=request.form.get('cumple_reglas'),
        expectativa=request.form.get('expectativa'),
        
        # Temporal
        horas_disponibles=request.form.get('horas_disponibles'),
        vivienda=request.form.get('vivienda'),
        permiso=request.form.get('permiso'),
        fotos_espacio=fotos_str,
        habitantes=habitantes_str,
        edades_ninos=request.form.get('edades_ninos'),
        mascotas_actuales=request.form.get('mascotas_actuales'),
        experiencia=request.form.get('experiencia'),
        energia_preferida=request.form.get('energia_preferida'),
        conductas=request.form.get('conductas'),
        accidentes=request.form.get('accidentes'),
        lugar_dormir=request.form.get('lugar_dormir'),
        tiempo_solo=request.form.get('tiempo_solo'),
        transporte=request.form.get('transporte'),
        moviliza_refugio=request.form.get('moviliza_refugio')
    )
    
    db.session.add(nueva_solicitud)
    db.session.commit()
    flash("¡Gracias! Tu solicitud de voluntariado ha sido enviada con éxito.", "success")
    return redirect(url_for('usuario'))

@app.route('/admin')
def admin(): 
    if 'usuario_id' not in session or session['rol'] != 'admin': return redirect(url_for('login'))
    empleados_db = Usuario.query.filter(Usuario.rol.in_(['veterinario', 'rescatista'])).all()
    
    pacientes_con_solicitudes = Paciente.query.filter(
        Paciente.solicitudes_recibidas.any(estado='En Revisión') | 
        Paciente.reclamos_recibidos.any(estado='En Revisión')
    ).all()
    
    # NUEVO: Traemos datos para la pestaña de Voluntariado
    programas_db = ProgramaVoluntariado.query.all()
    solicitudes_vol = SolicitudVoluntariado.query.filter_by(estado='Pendiente').all()
    
    return render_template('admin.html', empleados=empleados_db, pacientes=pacientes_con_solicitudes, programas=programas_db, voluntariados=solicitudes_vol)

@app.route('/editar_programa', methods=['POST'])
def editar_programa():
    if 'usuario_id' not in session or session['rol'] != 'admin': return redirect(url_for('login'))
    
    prog_id = request.form.get('programa_id')
    programa = ProgramaVoluntariado.query.get(prog_id)
    
    if programa:
        programa.descripcion = request.form.get('descripcion')
        
        # Procesar fotos nuevas y sumarlas a las existentes
        nombres_fotos = []
        if 'fotos_nuevas' in request.files:
            for archivo in request.files.getlist('fotos_nuevas'):
                if archivo.filename != '':
                    nom_arch = secure_filename(archivo.filename)
                    archivo.save(os.path.join(app.config['UPLOAD_FOLDER'], nom_arch))
                    nombres_fotos.append(nom_arch)
        
        if nombres_fotos:
            nuevas_fotos_str = ",".join(nombres_fotos)
            if programa.fotos:
                programa.fotos = f"{programa.fotos},{nuevas_fotos_str}"
            else:
                programa.fotos = nuevas_fotos_str
                
        db.session.commit()
        flash("Sección de voluntariado actualizada con éxito.", "success")
        
    return redirect(url_for('admin'))

@app.route('/procesar_voluntariado/<int:sol_id>/<accion>', methods=['POST'])
def procesar_voluntariado(sol_id, accion):
    if 'usuario_id' not in session or session['rol'] != 'admin': return redirect(url_for('login'))
    
    solicitud = SolicitudVoluntariado.query.get(sol_id)
    if solicitud:
        if accion == 'aceptar':
            solicitud.estado = "Aprobado"
            flash("Voluntario aprobado y notificado.", "success")
        elif accion == 'rechazar':
            db.session.delete(solicitud)
            flash("Solicitud de voluntariado rechazada.", "success")
        db.session.commit()
        
    return redirect(url_for('admin'))

@app.route('/procesar_adopcion/<int:solicitud_id>/<accion>', methods=['POST'])
def procesar_adopcion(solicitud_id, accion):
    if 'usuario_id' not in session or session['rol'] != 'admin': return redirect(url_for('login'))
    solicitud = SolicitudAdopcion.query.get(solicitud_id)
    if solicitud:
        if accion == 'aceptar':
            paciente = Paciente.query.get(solicitud.paciente_id)
            paciente.disponible_adopcion = "Adoptado"
            paciente.dueno_id = solicitud.usuario_id # Se transfiere el perro a "Mis Mascotas"
            solicitud.estado = "Aprobada"
            # Opcional: Borramos las demás solicitudes de este perrito para limpiar bandeja
            otras = SolicitudAdopcion.query.filter_by(paciente_id=paciente.id, estado='En Revisión').all()
            for o in otras:
                if o.id != solicitud.id: db.session.delete(o)
            flash("Adopción aprobada. La mascota ahora está en el perfil del usuario.", "success")
        elif accion == 'rechazar':
            db.session.delete(solicitud) # Se elimina si es rechazada
            flash("Solicitud de adopción rechazada y eliminada.", "success")
        db.session.commit()
    return redirect(url_for('admin'))

@app.route('/procesar_reclamo/<int:reclamo_id>/<accion>', methods=['POST'])
def procesar_reclamo(reclamo_id, accion):
    if 'usuario_id' not in session or session['rol'] != 'admin': return redirect(url_for('login'))
    reclamo = ReclamoPropiedad.query.get(reclamo_id)
    if reclamo:
        if accion == 'aceptar':
            paciente = Paciente.query.get(reclamo.paciente_id)
            paciente.disponible_adopcion = "Reclamado Oficialmente"
            paciente.dueno_id = reclamo.usuario_id
            reclamo.estado = "Aprobado"
            # Si alguien más quería adoptarlo, borramos esas adopciones porque el perro tiene dueño
            adopciones_pendientes = SolicitudAdopcion.query.filter_by(paciente_id=paciente.id, estado='En Revisión').all()
            for a in adopciones_pendientes: db.session.delete(a)
            flash("Reclamo aprobado. La mascota ha sido devuelta a su dueño original.", "success")
        elif accion == 'rechazar':
            db.session.delete(reclamo)
            flash("Reclamo de propiedad rechazado y eliminado.", "success")
        db.session.commit()
    return redirect(url_for('admin'))

# ==========================================
# 4. RUTAS POST (CONEXIONES Y LÓGICA)
# ==========================================
@app.route('/crear_empleado', methods=['POST'])
def crear_empleado():
    if 'usuario_id' not in session or session['rol'] != 'admin': return redirect(url_for('login'))
    password_encriptada = generate_password_hash(request.form.get('password'))
    nuevo_empleado = Usuario(nombre=request.form.get('nombre'), codigo_empleado=request.form.get('codigo'), password=password_encriptada, rol=request.form.get('rol'))
    db.session.add(nuevo_empleado)
    db.session.commit()
    return redirect(url_for('admin'))

@app.route('/crear_alerta', methods=['POST'])
def crear_alerta():
    if 'usuario_id' not in session or session['rol'] != 'usuario': 
        return redirect(url_for('login'))
    
    # Procesamiento de la fotografía
    nombre_foto = None
    if 'foto' in request.files:
        archivo = request.files['foto']
        if archivo.filename != '':
            nombre_foto = secure_filename(archivo.filename)
            archivo.save(os.path.join(app.config['UPLOAD_FOLDER'], nombre_foto))
            
    nueva_alerta = Alerta(
        urgencia=request.form.get('urgencia'), 
        especie_cantidad=request.form.get('especie_cantidad'), 
        descripcion=request.form.get('descripcion'), 
        direccion=request.form.get('direccion'), 
        indicaciones=request.form.get('indicaciones', ''),
        entorno=request.form.get('entorno', ''),
        nombre_reporta=request.form.get('nombre_reporta'), 
        telefono_reporta=request.form.get('telefono_reporta'), 
        estado="Pendiente",
        foto=nombre_foto # Guardamos la imagen en la base de datos
    )
    
    db.session.add(nueva_alerta)
    db.session.commit()
    return redirect(url_for('usuario'))

@app.route('/falsa_alarma/<int:alerta_id>')
def falsa_alarma(alerta_id):
    if 'usuario_id' not in session or session['rol'] != 'rescatista': return redirect(url_for('login'))
    alerta = Alerta.query.get(alerta_id)
    if alerta:
        db.session.delete(alerta)
        db.session.commit()
    return redirect(url_for('rescatista'))

@app.route('/crear_rescate', methods=['POST'])
def crear_rescate():
    if 'usuario_id' not in session or session['rol'] != 'rescatista': return redirect(url_for('login'))
    alerta_id = request.form.get('alerta_id')
    if alerta_id == '': alerta_id = None
    
    nuevo_rescate = Rescate(
        direccion=request.form.get('direccion'), especie=request.form.get('especie'),
        sexo=request.form.get('sexo'), gravedad=request.form.get('gravedad'),
        color=request.form.get('color'), descripcion=request.form.get('descripcion'),
        estado="Pendiente", rescatista_id=session['usuario_id'], alerta_id=alerta_id
    )
    if alerta_id:
        alerta = Alerta.query.get(alerta_id)
        if alerta: alerta.estado = "Atendida"
            
    db.session.add(nuevo_rescate)
    db.session.commit()
    return redirect(url_for('rescatista'))

@app.route('/crear_cita', methods=['POST'])
def crear_cita():
    if 'usuario_id' not in session or session['rol'] != 'veterinario': return redirect(url_for('login'))
    nueva_cita = Cita(
        fecha=request.form.get('fecha'),
        motivo=request.form.get('motivo'),
        paciente_id=request.form.get('paciente_id'),
        veterinario_id=session['usuario_id']
    )
    db.session.add(nueva_cita)
    db.session.commit()
    return redirect(url_for('veterinario'))


@app.route('/crear_consulta', methods=['POST'])
def crear_consulta():
    if 'usuario_id' not in session or session['rol'] != 'veterinario': return redirect(url_for('login'))
    
    paciente_id = request.form.get('paciente_existente_id')
    rescate_id = request.form.get('rescate_id') or None
    
    # 1. Atrapar la foto de perfil (si subieron una)
    foto_perfil = None
    if 'foto_perfil' in request.files and request.files['foto_perfil'].filename != '':
        archivo = request.files['foto_perfil']
        foto_perfil = secure_filename(archivo.filename)
        archivo.save(os.path.join(app.config['UPLOAD_FOLDER'], foto_perfil))

    # 2. Paciente (Crear nuevo o Actualizar en seguimiento)
    if not paciente_id:
        nuevo_paciente = Paciente(
            nombre=request.form.get('nombre_paciente'), 
            especie=request.form.get('especie'), 
            sexo=request.form.get('sexo'), 
            disponible_adopcion=request.form.get('adopcion_status', 'No Aplica'),
            foto=foto_perfil,
            rescate_id=rescate_id
        )
        db.session.add(nuevo_paciente)
        db.session.commit()
        paciente_id = nuevo_paciente.id
    else:
        paciente_existente = Paciente.query.get(paciente_id)
        if paciente_existente:
            # Permite cambiar de "En Observación" a "Listo para Adopción"
            if request.form.get('adopcion_status'):
                paciente_existente.disponible_adopcion = request.form.get('adopcion_status')
            if foto_perfil:
                paciente_existente.foto = foto_perfil
        db.session.commit()

    # 3. Atrapar las fotos de Evidencia Clínica
    nombres_evidencia = []
    if 'evidencia_fotos' in request.files:
        for archivo in request.files.getlist('evidencia_fotos'):
            if archivo.filename != '':
                nom_arch = secure_filename(archivo.filename)
                archivo.save(os.path.join(app.config['UPLOAD_FOLDER'], nom_arch))
                nombres_evidencia.append(nom_arch)
    evidencia_str = ",".join(nombres_evidencia) if nombres_evidencia else None

    # 4. Guardar la Consulta y limpiamos agenda
    nueva_consulta = ConsultaMedica(
        tipo_consulta=request.form.get('tipo_ingreso'), temperatura=request.form.get('temp'), 
        peso=request.form.get('peso'), sintomas=request.form.get('sintomas_ocultos'), 
        diagnostico=request.form.get('diagnostico'), tratamiento=request.form.get('tratamiento'), 
        evidencia_fotos=evidencia_str, paciente_id=paciente_id, veterinario_id=session['usuario_id']
    )
    db.session.add(nueva_consulta)
    db.session.commit() 
    
    # 5. Vacunas
    vacunas_json = request.form.get('vacunas_ocultas')
    if vacunas_json:
        lista_vacunas = json.loads(vacunas_json)
        for v in lista_vacunas:
            db.session.add(Vacuna(nombre=v['nombre'], frecuencia=v['frecuencia'], paciente_id=paciente_id, consulta_id=nueva_consulta.id))

    if rescate_id:
        rescate = Rescate.query.get(rescate_id)
        if rescate: rescate.estado = "Atendido"
    cita_id = request.form.get('cita_id')
    if cita_id:
        cita = Cita.query.get(cita_id)
        if cita: cita.estado = "Atendida"

    db.session.commit()
    return redirect(url_for('veterinario'))

# === RUTAS DEL USUARIO ===
@app.route('/actualizar_cv', methods=['POST'])
def actualizar_cv():
    if 'usuario_id' not in session or session['rol'] != 'usuario': return redirect(url_for('login'))
    
    # Si no tiene CV creado en la nueva tabla, se lo creamos
    cv = PerfilAdopcion.query.filter_by(usuario_id=session['usuario_id']).first()
    if not cv:
        cv = PerfilAdopcion(usuario_id=session['usuario_id'])
        db.session.add(cv)

    cv.dpi = request.form.get('dpi')
    cv.fecha_nacimiento = request.form.get('fecha_nacimiento')
    cv.telefono = request.form.get('telefono')
    cv.direccion = request.form.get('direccion')
    cv.ocupacion = request.form.get('ocupacion')
    cv.redes_sociales = request.form.get('redes_sociales')
    cv.tipo_vivienda = request.form.get('tipo_vivienda')
    cv.tenencia = request.form.get('tenencia')
    cv.permiso_arrendador = request.form.get('permiso_arrendador')
    cv.cerramiento = request.form.get('cerramiento')
    cv.integrantes = request.form.get('integrantes')
    cv.acuerdo_familiar = request.form.get('acuerdo_familiar')
    cv.alergias_familia = request.form.get('alergias_familia')
    cv.mascotas_actuales = request.form.get('mascotas_actuales')
    cv.mascotas_anteriores = request.form.get('mascotas_anteriores')
    cv.motivo_adopcion = request.form.get('motivo_adopcion')
    cv.lugar_estancia = request.form.get('lugar_estancia')
    cv.horas_solo = request.form.get('horas_solo')
    cv.presupuesto = request.form.get('presupuesto')
    cv.plan_viaje = request.form.get('plan_viaje')
    cv.plan_mudanza = request.form.get('plan_mudanza')
    cv.problema_conducta = request.form.get('problema_conducta')
    cv.gastos_emergencia = request.form.get('gastos_emergencia')
    cv.seguimiento = request.form.get('seguimiento')
    cv.contrato = request.form.get('contrato')
    cv.ref1_nombre = request.form.get('ref1_nombre')
    cv.ref1_tel = request.form.get('ref1_tel')
    cv.ref2_nombre = request.form.get('ref2_nombre')
    cv.ref2_tel = request.form.get('ref2_tel')
    
    db.session.commit()
    flash("Tu Formulario de Adopción se ha guardado con éxito.", "success")
    return redirect(url_for('usuario'))

@app.route('/crear_solicitud/<int:paciente_id>', methods=['POST'])
def crear_solicitud(paciente_id):
    if 'usuario_id' not in session or session['rol'] != 'usuario': return redirect(url_for('login'))
    cv = PerfilAdopcion.query.filter_by(usuario_id=session['usuario_id']).first()
    
    nueva_solicitud = SolicitudAdopcion(
        dpi=cv.dpi, ocupacion=cv.ocupacion, tipo_vivienda=cv.tipo_vivienda,
        horas_solo=cv.horas_solo, paciente_id=paciente_id, usuario_id=session['usuario_id']
    )
    db.session.add(nueva_solicitud)
    db.session.commit()
    flash("Solicitud de adopción enviada con éxito.", "success")
    return redirect(url_for('usuario'))

@app.route('/crear_reclamo/<int:paciente_id>', methods=['POST'])
def crear_reclamo(paciente_id):
    if 'usuario_id' not in session or session['rol'] != 'usuario': return redirect(url_for('login'))
    nombres_evidencia = []
    if 'evidencia_dueno' in request.files:
        for archivo in request.files.getlist('evidencia_dueno'):
            if archivo.filename != '':
                nom_arch = secure_filename(archivo.filename)
                archivo.save(os.path.join(app.config['UPLOAD_FOLDER'], nom_arch))
                nombres_evidencia.append(nom_arch)
    evidencia_str = ",".join(nombres_evidencia) if nombres_evidencia else None

    nuevo_reclamo = ReclamoPropiedad(
        nombre_responde=request.form.get('nombre_responde'),
        marcas_unicas=request.form.get('marcas'), evidencia_fotos=evidencia_str,
        paciente_id=paciente_id, usuario_id=session['usuario_id']
    )
    db.session.add(nuevo_reclamo)
    db.session.commit()
    flash("Reclamo de propiedad enviado con éxito.", "success")
    return redirect(url_for('usuario'))

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        if not Usuario.query.filter_by(rol='admin').first():
            db.session.add(Usuario(nombre="Admin", codigo_empleado="ADMIN-001", password=generate_password_hash("123"), rol="admin"))

        # NUEVO: Crear los 3 programas base si no existen
        if not ProgramaVoluntariado.query.first():
            db.session.add(ProgramaVoluntariado(tipo='Coexistencia', descripcion='Ven a pasar un rato agradable con nuestros animales. Ayúdalos a socializar, dales cariño y acompáñalos. ¡Ideal para relajarte y dar amor sin llevarlos a casa!'))
            db.session.add(ProgramaVoluntariado(tipo='Hogar Temporal', descripcion='Abre las puertas de tu casa temporalmente (3 a 7 días). Dale a un perrito o gatito la oportunidad de dormir en un hogar calientito mientras le encontramos su familia definitiva.'))
            db.session.add(ProgramaVoluntariado(tipo='Apoyo Operativo', descripcion='Únete al equipo del refugio. Ayúdanos a bañar, alimentar, pasear y mantener limpias las áreas. Trabajo físico, pero con la mejor recompensa del mundo.'))
            
            db.session.commit()
    app.run(debug=True)