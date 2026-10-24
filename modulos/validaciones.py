"""Validación de campos en servidor para todas las vistas del refugio.

Las restricciones visuales son útiles, pero NO sustituyen a este módulo:
un cliente puede enviar peticiones POST sin usar un navegador.
"""
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import re

from flask import flash, redirect, request, url_for


NOMBRE_RE = re.compile(r"^[^\W\d_]+(?:[ .'-][^\W\d_]+)*$", re.UNICODE)
CODIGO_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{2,19}$')
EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


class DatoInvalido(ValueError):
    pass


def nombre_persona(valor, etiqueta='Nombre'):
    valor = (valor or '').strip()
    if not 2 <= len(valor) <= 100 or not NOMBRE_RE.fullmatch(valor):
        raise DatoInvalido(f'{etiqueta}: escribe solamente letras, espacios, apóstrofes, puntos o guiones (2–100 caracteres).')
    return valor



def nombre_producto_o_mascota(valor):
    """Permite números (Alimento 5kg), guiones y signos comerciales habituales."""
    valor = (valor or '').strip()
    permitidos = " .()/-+'"
    if not 2 <= len(valor) <= 100 or not all(c.isalnum() or c in permitidos for c in valor):
        raise DatoInvalido('Nombre: utiliza letras, números, espacios y signos habituales (- / . + paréntesis).')
    if not any(c.isalnum() for c in valor):
        raise DatoInvalido('Nombre: debe contener letras o números.')
    return valor


def correo(valor):
    valor = (valor or '').strip()
    if len(valor) > 100 or not EMAIL_RE.fullmatch(valor):
        raise DatoInvalido('Correo: ingresa una dirección válida, por ejemplo, persona@correo.com.')
    return valor.lower()


def telefono(valor):
    valor = (valor or '').strip()
    if not re.fullmatch(r'\+?[0-9][0-9 -]{6,19}', valor):
        raise DatoInvalido('Teléfono: solo números, espacios, guiones o + al inicio.')
    numeros = re.sub(r'\D', '', valor)
    if not 8 <= len(numeros) <= 15:
        raise DatoInvalido('Teléfono: escribe entre 8 y 15 dígitos.')
    return valor


def dpi(valor):
    valor = (valor or '').strip()
    if not re.fullmatch(r'[0-9]{13}', valor):
        raise DatoInvalido('DPI/CUI: ingresa exactamente 13 dígitos, sin letras ni símbolos.')
    return valor


def entero(valor, etiqueta, minimo=0, maximo=1_000_000):
    valor = str(valor).strip()
    if not re.fullmatch(r'[0-9]+', valor):
        raise DatoInvalido(f'{etiqueta}: escribe únicamente números enteros, sin letras.')
    numero = int(valor)
    if not minimo <= numero <= maximo:
        raise DatoInvalido(f'{etiqueta}: debe estar entre {minimo} y {maximo}.')
    return numero


def decimal_positivo(valor, etiqueta, maximo='9999999.99', decimales=2):
    valor = str(valor).strip()
    # Evita NaN, Infinity, exponentes, signos y cadenas como "doscientos".
    if not re.fullmatch(r'[0-9]+(?:\.[0-9]{1,' + str(decimales) + r'})?', valor):
        raise DatoInvalido(f'{etiqueta}: usa números; máximo {decimales} decimales y punto como separador.')
    try:
        numero = Decimal(valor)
    except InvalidOperation:
        raise DatoInvalido(f'{etiqueta}: número inválido.') from None
    if not Decimal(0) <= numero <= Decimal(maximo):
        raise DatoInvalido(f'{etiqueta}: debe estar entre 0 y {maximo}.')
    return numero


def anio(valor):
    valor = (valor or '').strip()
    if not re.fullmatch(r'[0-9]{4}', valor) or not 1900 <= int(valor) <= 2100:
        raise DatoInvalido('Año: escribe cuatro dígitos entre 1900 y 2100; ejemplo: 2022.')
    return int(valor)


def fecha_valida(valor, etiqueta, permitir_hora=False):
    valor = (valor or '').strip()
    patrones = ['%Y-%m-%d', '%d/%m/%Y']
    if permitir_hora:
        patrones.extend(['%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M'])
    for patron in patrones:
        try:
            fecha = datetime.strptime(valor, patron)
            if fecha.year < 1900 or fecha.year > 2100:
                break
            if etiqueta == 'Fecha de nacimiento' and fecha.date() > date.today():
                raise DatoInvalido('Fecha de nacimiento: no puede ser una fecha futura.')
            return valor
        except DatoInvalido:
            raise
        except ValueError:
            continue
    raise DatoInvalido(f'{etiqueta}: usa una fecha válida con números (AAAA-MM-DD).')


def codigo(valor):
    valor = (valor or '').strip()
    if not CODIGO_RE.fullmatch(valor):
        raise DatoInvalido('Código: solo letras, números, guion o guion bajo (3–20 caracteres).')
    return valor


def nit(valor):
    valor = (valor or '').strip().upper()
    if valor in ('CF', 'C/F'):
        return valor
    if not re.fullmatch(r'[0-9]{1,12}-[0-9K]', valor):
        raise DatoInvalido('NIT: usa números y guion, dígito verificador o C/F (ejemplo: 123456-7).')
    return valor


def aplicar_a_campo(nombre, valor, endpoint):
    """Elige la regla SIN censurar textos libres, contraseñas ni credenciales."""
    campo = (nombre or '').lower().strip()
    if not valor or not str(valor).strip():
        return
    # Solo registrar nombres de PERSONAS: los productos admiten números y las
    # mascotas pueden llevar apodos y otros caracteres.
    if campo == 'nombre' and endpoint in {'registro', 'actualizar_perfil', 'crear_empleado'}:
        nombre_persona(valor)
    elif campo == 'nombre' and endpoint in {'crear_producto', 'editar_mascota'}:
        nombre_producto_o_mascota(valor)
    elif campo == 'nombre_paciente':
        nombre_producto_o_mascota(valor)
    elif campo in {'ref1_nombre', 'ref2_nombre', 'nombre_responde'}:
        nombre_persona(valor, nombre.replace('_', ' ').capitalize())
    elif campo == 'correo' and endpoint in {'registro', 'actualizar_perfil', 'crear_empleado'}:
        correo(valor)
    elif campo in {'telefono', 'ref1_tel', 'ref2_tel', 'celular', 'pos-cliente-tel'}:
        telefono(valor)
    elif campo == 'dpi':
        dpi(valor)
    elif campo in {'anio', 'ano', 'año', 'year', 'anio_nacimiento', 'anio_fabricacion'}:
        anio(valor)
    elif campo == 'edad':
        entero(valor, 'Edad', 0, 120)
    elif campo in {'stock', 'cantidad', 'existencias'}:
        entero(valor, campo.capitalize(), 0, 1_000_000)
    elif campo in {'precio', 'costo', 'importe', 'monto'}:
        decimal_positivo(valor, campo.capitalize())
    elif campo in {'temp', 'temperatura'}:
        decimal_positivo(valor, 'Temperatura', '60.00', 2)
    elif campo == 'peso':
        decimal_positivo(valor, 'Peso', '10000.00', 2)
    elif campo == 'logo_size':
        entero(valor, 'Tamaño del logo', 30, 150)
    elif campo == 'mosaic_size':
        entero(valor, 'Tamaño del mosaico', 50, 400)
    elif campo == 'fecha_nacimiento':
        fecha_valida(valor, 'Fecha de nacimiento')
    elif campo == 'fecha' and endpoint == 'crear_cita':
        fecha_valida(valor, 'Fecha de la cita', permitir_hora=True)
    elif campo == 'codigo' and endpoint == 'crear_empleado':
        codigo(valor)
    elif campo == 'nit':
        nit(valor)


def validar_formulario(endpoint, formulario):
    for nombre, valor in formulario.items(multi=True):
        aplicar_a_campo(nombre, valor, endpoint)


def registrar_validaciones(app):
    """Rechaza el POST inválido ANTES de que la ruta guarde registros/fotos.

    El script se carga en páginas HTML existentes de todos los roles aunque
    la plantilla `base.html` original no se incluya en esta entrega.
    """
    @app.before_request
    def validar_campos_servidor():
        if request.method != 'POST' or not request.form or not request.endpoint:
            return None
        # Módulo de cuentas ya realiza sus validaciones; excepto crear empleado
        # (ruta anterior del app) cubierta aquí también.
        if request.endpoint.startswith('cuentas.') or request.endpoint in {'login', 'cambiar_password'}:
            return None
        try:
            validar_formulario(request.endpoint, request.form)
        except DatoInvalido as error:
            flash(str(error), 'error')
            if request.endpoint in {'registro'}:
                destino = 'registro'
            elif request.endpoint in {'crear_producto', 'editar_apariencia', 'editar_donacion',
                                      'crear_empleado', 'editar_programa', 'procesar_voluntariado'}:
                destino = 'admin'
            else:
                rol = request.endpoint if request.endpoint in {'usuario', 'veterinario', 'rescatista'} else request.environ.get('huellitas_role', None)
                from flask import session
                rol = rol or session.get('rol')
                destino = rol if rol in {'admin', 'usuario', 'veterinario', 'rescatista'} else 'login'
            return redirect(url_for(destino) + ('#logs' if request.endpoint == 'crear_empleado' else ''))

    @app.after_request
    def incluir_script_de_validacion(respuesta):
        # Las plantillas de los demás roles no venían dentro del paquete.
        # Inyectar el módulo compartido evita obligar a modificar base.html;
        # solo sobre HTML finalizado, sin tocar respuestas JSON/descargas.
        if (respuesta.status_code != 200 or respuesta.direct_passthrough or
                not respuesta.mimetype == 'text/html' or
                respuesta.headers.get('Content-Encoding') or
                respuesta.headers.get('Content-Disposition') or
                len(respuesta.get_data()) > 5_000_000):
            return respuesta
        html = respuesta.get_data(as_text=True)
        marcador = '</body>'
        if marcador in html.lower() and 'js/validaciones-campos.js' not in html:
            inicio = html.lower().rfind(marcador)
            from flask import url_for
            etiqueta = f'<script defer src="{url_for("static", filename="js/validaciones-campos.js")}"></script>\n'
            respuesta.set_data(html[:inicio] + etiqueta + html[inicio:])
        return respuesta
