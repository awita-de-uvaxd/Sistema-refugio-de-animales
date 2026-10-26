"""Reglas exclusivamente para escrituras del panel de Administración.

Las comprobaciones del navegador ayudan al usuario, pero estas validaciones
se ejecutan también al enviar peticiones POST directamente al servidor.
No modifica los formularios de veterinario, rescatista ni adoptante.
"""
import re

from flask import flash, jsonify, redirect, request, url_for
from modulos.validaciones import (
    DatoInvalido, anio, codigo, correo, decimal_positivo, entero,
    nombre_persona, nombre_producto_o_mascota, telefono, nit,
)

ADMIN_FORM_ROUTES = frozenset({
    'crear_empleado', 'crear_producto', 'editar_apariencia',
    'editar_donacion', 'editar_programa',
})
ADMIN_JSON_ROUTES = frozenset({'editar_producto', 'venta_directa', 'descontar_stock'})


def texto_corto(valor, etiqueta, limite=100, obligatorio=False):
    """No prohíbe signos útiles de textos libres; sí caracteres de control."""
    valor = (valor or '').strip()
    if obligatorio and not valor:
        raise DatoInvalido(f'{etiqueta}: este campo es obligatorio.')
    if len(valor) > limite or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', valor):
        raise DatoInvalido(f'{etiqueta}: máximo {limite} caracteres y sin caracteres de control.')
    return valor


def validar_ambos_identificadores(form):
    """Una cuenta usa código o correo; no exige correo cuando existe código."""
    codigo_ingresado = (form.get('codigo') or '').strip()
    correo_ingresado = (form.get('correo') or '').strip()
    if bool(codigo_ingresado) == bool(correo_ingresado):
        raise DatoInvalido('Indica solo código o solo correo electrónico para la cuenta.')
    if codigo_ingresado:
        codigo(codigo_ingresado)  # acepta 001234 y RES2026 como TEXTO
    else:
        correo(correo_ingresado)
    nombre_persona(form.get('nombre'))
    clave = form.get('password') or ''
    if not 8 <= len(clave) <= 128:
        raise DatoInvalido('Contraseña temporal: entre 8 y 128 caracteres.')
    if form.get('rol') not in {'admin', 'rescatista', 'veterinario', 'usuario'}:
        raise DatoInvalido('Selecciona un rol válido.')


def validar_formulario_admin(endpoint, data):
    # También cubre campos de año que el administrador añada en el futuro.
    for campo, valor in data.items():
        etiqueta = str(campo).lower().strip()
        if etiqueta in {'anio', 'año', 'ano', 'year', 'anio_nacimiento', 'anio_fabricacion'} or re.fullmatch(r'(?:anio|ano|year)[_-][a-z_]+', etiqueta):
            if str(valor).strip():
                anio(str(valor))
    if endpoint == 'crear_empleado':
        validar_ambos_identificadores(data)
    elif endpoint == 'crear_producto':
        nombre_producto_o_mascota(data.get('nombre'))
        decimal_positivo(data.get('precio'), 'Precio')
        entero(data.get('stock'), 'Stock', 0, 1_000_000)
        texto_corto(data.get('descripcion'), 'Descripción', 10000)
        if data.get('categoria') not in {'Comida', 'Medicina', 'Juguetes', 'Accesorios'}:
            raise DatoInvalido('Categoría de producto no válida.')
    elif endpoint == 'editar_apariencia':
        if data.get('rol_destino', 'global') not in {'global', 'inicio', 'usuario', 'rescatista', 'veterinario', 'admin'}:
            raise DatoInvalido('Destinatario de diseño no válido.')
        texto_corto(data.get('titulo'), 'Nombre de la plataforma', 100, True)
        texto_corto(data.get('eslogan'), 'Eslogan', 100, True)
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', data.get('color_fondo') or ''):
            raise DatoInvalido('Color: debe ser un código hexadecimal como #1e1b4b.')
        entero(data.get('logo_size', '45'), 'Tamaño de logo', 30, 150)
        entero(data.get('mosaic_size', '150'), 'Tamaño del mosaico', 50, 400)
        if data.get('banner_style', 'slideshow') not in {'static', 'slideshow', 'mosaic'}:
            raise DatoInvalido('Tipo de banner no válido.')
    elif endpoint == 'editar_donacion':
        for campo, etiqueta, maximo in [
            ('titulo', 'Título', 100), ('subtitulo', 'Subtítulo', 10000),
            ('info_bancaria', 'Información bancaria', 200),
            ('nombre_de', 'Nombre', 100), ('sede_fisica', 'Sede física', 200),
        ]:
            texto_corto(data.get(campo), etiqueta, maximo)
    elif endpoint == 'editar_programa':
        entero(data.get('programa_id'), 'ID del programa', 1, 1_000_000)
        texto_corto(data.get('descripcion'), 'Descripción del programa', 5000, obligatorio=True)
    elif endpoint == 'editar_producto':
        if 'nombre' in data and data.get('nombre'):
            nombre_producto_o_mascota(data.get('nombre'))
        if 'stock' in data:
            entero(data.get('stock'), 'Stock', 0, 1_000_000)
        if 'precio' in data:
            decimal_positivo(data.get('precio'), 'Precio')
        if 'visible' in data and str(data.get('visible')).lower() not in {'1', '0', 'true', 'false', 'yes', 'no'}:
            raise DatoInvalido('Visibilidad: valor no válido.')
    elif endpoint in {'venta_directa', 'descontar_stock'}:
        items = data.get('items') or (data.get('itemsDetalle') if endpoint == 'venta_directa' else None) or []
        if not isinstance(items, list) or not items:
            raise DatoInvalido('La venta debe contener uno o más productos.')
        if len(items) > 200:
            raise DatoInvalido('La venta excede el máximo de 200 artículos.')
        for indice, item in enumerate(items, start=1):
            if not isinstance(item, dict):
                raise DatoInvalido(f'Artículo {indice}: datos inválidos.')
            identificador = str(item.get('id') or item.get('numId') or '')
            if not re.fullmatch(r'(?:PROD-)?[0-9]{1,12}', identificador, re.IGNORECASE):
                raise DatoInvalido(f'Artículo {indice}: identificador inválido.')
            entero(item.get('cantidad', 1), f'Cantidad del artículo {indice}', 1, 1_000_000)


def registrar_validaciones_admin(app):
    @app.before_request
    def validar_entradas_solo_admin():
        if request.method != 'POST' or request.endpoint not in (ADMIN_FORM_ROUTES | ADMIN_JSON_ROUTES):
            return None
        # Las propias rutas comprueban la sesión y los permisos.
        if request.endpoint in ADMIN_JSON_ROUTES:
            datos = request.get_json(silent=True) or request.form
            if not isinstance(datos, dict) and not hasattr(datos, 'get'):
                return jsonify(status='error', message='Formato de datos inválido.'), 400
        else:
            datos = request.form
        try:
            validar_formulario_admin(request.endpoint, datos)
        except (DatoInvalido, ValueError, TypeError) as error:
            if request.endpoint in ADMIN_JSON_ROUTES:
                return jsonify(status='error', message=str(error)), 400
            flash(str(error), 'error')
            apartado = '#logs' if request.endpoint == 'crear_empleado' else (
                '#shop' if request.endpoint == 'crear_producto' else (
                '#apariencia' if request.endpoint == 'editar_apariencia' else (
                '#donaciones' if request.endpoint == 'editar_donacion' or (request.endpoint == 'editar_programa' and request.form.get('volver') == 'donaciones') else '#voluntariado')))
            return redirect(url_for('admin') + apartado)
        return None
