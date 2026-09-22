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

class Paciente(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    especie = db.Column(db.String(50), nullable=False)
    sexo = db.Column(db.String(20), nullable=False)
    foto = db.Column(db.Text, nullable=True)
    disponible_adopcion = db.Column(db.String(20), default="En Observación")
    dueno_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=True)
    rescate_id = db.Column(db.Integer, db.ForeignKey('rescate.id'), nullable=True) # ¡El enlace que pediste!
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

class SolicitudAdopcion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    dpi = db.Column(db.String(20), nullable=False)
    ocupacion = db.Column(db.String(100))
    tipo_vivienda = db.Column(db.String(50))
    horas_solo = db.Column(db.String(50))
    mascotas_actuales = db.Column(db.Text)
    estado = db.Column(db.String(20), default="En Revisión")
    paciente_id = db.Column(db.Integer, db.ForeignKey('paciente.id'), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)

class ReclamoPropiedad(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre_responde = db.Column(db.String(100))
    marcas_unicas = db.Column(db.Text)
    estado = db.Column(db.String(20), default="En Revisión")
    paciente_id = db.Column(db.Integer, db.ForeignKey('paciente.id'), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)

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
    disponibles = Paciente.query.filter_by(disponible_adopcion="Sí").all()
    return render_template('usuario.html', adopciones=disponibles)

@app.route('/admin')
def admin(): 
    if 'usuario_id' not in session or session['rol'] != 'admin': return redirect(url_for('login'))
    empleados_db = Usuario.query.filter(Usuario.rol.in_(['veterinario', 'rescatista'])).all()
    return render_template('admin.html', empleados=empleados_db)

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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        if not Usuario.query.filter_by(rol='admin').first():
            db.session.add(Usuario(nombre="Admin", codigo_empleado="ADMIN-001", password=generate_password_hash("123"), rol="admin"))
            db.session.commit()
    app.run(debug=True)