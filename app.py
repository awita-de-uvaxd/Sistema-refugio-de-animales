from flask import Flask, render_template

app = Flask(__name__)

# Pantalla de inicio
@app.route('/')
def inicio():
    return render_template('inicio.html')

# Ruta para el Rescatista
@app.route('/rescatista')
def rescatista():
    # Por ahora muestra un mensaje, en el siguiente paso le pegaremos su código
    return render_template('rescatista.html')

# Ruta para el Veterinario
@app.route('/veterinario')
def veterinario():
    return render_template('veterinario.html')

# Ruta para el Usuario
@app.route('/usuario')
def usuario():
    return render_template('usuario.html')

# Ruta para el Admin
@app.route('/admin')
def admin():
    return render_template('admin.html')

if __name__ == '__main__':
    app.run(debug=True)