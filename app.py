from flask import Flask, render_template, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///huellitas.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ==========================================
# 1. TABLA DE USUARIOS
# ==========================================
class Usuario(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    correo = db.Column(db.String(100), unique=True, nullable=True)
    codigo_empleado = db.Column(db.String(20), unique=True, nullable=True)
    password = db.Column(db.String(200), nullable=False)
    rol = db.Column(db.String(20), nullable=False, default='usuario') 
    mascotas = db.relationship('Paciente', backref='dueno', lazy=True)

class Paciente(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    especie = db.Column(db.String(50), nullable=False)
    sexo = db.Column(db.String(20), nullable=False)
    foto = db.Column(db.Text, nullable=True)
    disponible_adopcion = db.Column(db.String(2), default="No")
    dueno_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=True)
    consultas = db.relationship('ConsultaMedica', backref='paciente', lazy=True)

class ConsultaMedica(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    temp = db.Column(db.String(10))
    peso = db.Column(db.String(10))
    diagnostico = db.Column(db.Text, nullable=False)
    tratamiento = db.Column(db.Text, nullable=False)
    paciente_id = db.Column(db.Integer, db.ForeignKey('paciente.id'), nullable=False)
    veterinario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)

# ==========================================
# 4. TABLA DE RESCATES (Actualizada)
# ==========================================
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

# ==========================================
# RUTAS DE NAVEGACIÓN
# ==========================================
@app.route('/')
def inicio(): return render_template('inicio.html')

@app.route('/rescatista')
def rescatista():
    # 1. Le decimos a Python: "Ve a la tabla Rescate y tráeme TODOS los registros"
    rescates_db = Rescate.query.all()
    
    # 2. Le pasamos esa variable al HTML usando Jinja2
    return render_template('rescatista.html', mis_rescates=rescates_db)

@app.route('/veterinario')
def veterinario(): return render_template('veterinario.html')

@app.route('/usuario')
def usuario(): return render_template('usuario.html')

@app.route('/admin')
def admin(): return render_template('admin.html')

# ==========================================
# NUEVA RUTA: RECIBIR DATOS DEL HTML A PYTHON
# ==========================================
@app.route('/crear_rescate', methods=['POST'])
def crear_rescate():
    # 1. Atrapamos los datos del formulario gracias al "name" de cada input
    direccion_html = request.form.get('direccion')
    especie_html = request.form.get('especie')
    sexo_html = request.form.get('sexo')
    gravedad_html = request.form.get('gravedad')
    color_html = request.form.get('color')
    descripcion_html = request.form.get('descripcion')
    
    # 2. Como aún no programamos el Login, buscamos al Admin por defecto para simular que él lo creó
    admin = Usuario.query.filter_by(rol='admin').first()

    # 3. Empaquetamos todo en el Modelo de la base de datos
    nuevo_rescate = Rescate(
        direccion=direccion_html,
        especie=especie_html,
        sexo=sexo_html,
        gravedad=gravedad_html,
        color=color_html,
        descripcion=descripcion_html,
        estado="Pendiente",
        rescatista_id=admin.id
    )

    # 4. Insertamos en SQLite de manera permanente
    db.session.add(nuevo_rescate)
    db.session.commit()

    # 5. Redirigimos de vuelta a la página del rescatista
    return redirect(url_for('rescatista'))


if __name__ == '__main__':
    with app.app_context():
        # IMPORTANTE: Si cambiamos columnas de la base de datos, SQLite a veces requiere borrarlas y recrearlas
        db.drop_all() 
        db.create_all()
        
        # MAGIA: Si no existe ningún usuario en la tabla, crea uno inicial.
        if not Usuario.query.first():
            admin = Usuario(nombre="Admin Sys", codigo_empleado="ADMIN-001", password="123", rol="admin")
            db.session.add(admin)
            db.session.commit()
            
    app.run(debug=True)