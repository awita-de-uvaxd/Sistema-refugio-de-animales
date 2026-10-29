"""Operaciones de tienda persistidas en SQLite y validadas en el servidor."""
import hmac
import json
import re
from collections import Counter
from datetime import timezone,timedelta
from decimal import Decimal,ROUND_HALF_UP
from flask import Blueprint,abort,request,session,jsonify
from sqlalchemy import update
from sqlalchemy.exc import SQLAlchemyError

ETAPAS=['1. Tomando','2. Aceptado','3. Procesando','4. Empacando','5. Finalizar']
ENVIO=['Recibido','Confirmado','Preparando','Empacado','En camino','Entregado']

def moneda(valor):
    n=Decimal(str(valor))
    if not n.is_finite() or n<0:raise ValueError('Importe inválido')
    return n.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)

def registrar_tienda(app,db,Producto,Usuario,Orden):
    bp=Blueprint('tienda_api',__name__)
    def autorizar(admin=False):
        uid=session.get('usuario_id'); rol=session.get('rol')
        if not uid or rol not in ({'admin'} if admin else {'admin','usuario'}):abort(403)
        u=db.session.get(Usuario,uid)
        if not u or not u.activo or u.rol!=rol:abort(403)
        return u
    def csrf():
        if not session.get('_csrf_cuentas') or not hmac.compare_digest(session['_csrf_cuentas'],request.headers.get('X-CSRF-Token','')):
            abort(400,description='Token de sesión incorrecto. Recarga la página.')
    def fallo(msg,status=400):return jsonify(status='error',message=str(msg)),status
    def serial(p):
        return dict(id=f'PED-{p.id:06d}',dbId=p.id,fecha=p.fecha.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=-6))).strftime('%d/%m/%Y %H:%M'),
            clienteNombre=p.cliente_nombre,clienteTel=p.cliente_tel,clienteDir=p.cliente_dir,nit=p.nit,referenciaPago=p.referencia,
            itemsDetalle=json.loads(p.items_json),subtotal=p.subtotal,envio=p.envio,total=p.total,tipo=p.tipo,
            metodoPago=p.metodo_pago,estadoPago=p.estado_pago,estadoOrden=p.estado_orden,estadoEnvio=p.estado_envio,
            stockDescontado=p.stock_descontado,entregado=p.entregado,cancelado=p.cancelado,esPos=p.es_pos)
    def obtener_stock(items):
        if not isinstance(items,list) or not 1<=len(items)<=100:raise ValueError('Incluye entre 1 y 100 artículos.')
        cantidades=Counter()
        for item in items:
            if not isinstance(item,dict):raise ValueError('Artículo inválido.')
            match=re.fullmatch(r'(?:PROD-)?([1-9][0-9]{0,9})',str(item.get('id') or item.get('numId') or ''),re.I)
            cant=item.get('cantidad')
            if not match or isinstance(cant,bool) or not re.fullmatch(r'[1-9][0-9]{0,5}',str(cant)):raise ValueError('Código o cantidad inválida.')
            cantidades[int(match.group(1))]+=int(cant)
        detalle=[];total=Decimal('0.00')
        for pid,cant in sorted(cantidades.items()):
            p=db.session.get(Producto,pid)
            if not p or not p.visible or p.stock<cant:raise ValueError(f'Existencias insuficientes o producto no disponible: PROD-{pid}.')
            precio=moneda(p.precio)
            detalle.append(dict(id=pid,nombre=p.nombre,precio=float(precio),cantidad=cant));total+=precio*cant
        for pid,cant in sorted(cantidades.items()):
            res=db.session.execute(update(Producto).where(Producto.id==pid,Producto.stock>=cant).values(stock=Producto.stock-cant))
            if res.rowcount!=1:raise ValueError('Las existencias cambiaron. Actualiza la tienda.')
        return detalle,total
    def crear(data,u,pos=False):
        def txt(k,default='',maxlen=150):
            value=data.get(k,default)
            if not isinstance(value,str) or len(value.strip())>maxlen or any(ord(c)<32 for c in value):raise ValueError(f'{k}: valor inválido.')
            return value.strip()
        nombre=txt('clienteNombre',maxlen=100);tel=txt('clienteTel',maxlen=16);nit=txt('nit','Consumidor Final',20)
        if len(nombre)<2 or (tel and not re.fullmatch(r'[0-9+()\-\s]{8,16}',tel)) or (not pos and len(tel)<8):raise ValueError('Nombre o teléfono inválido.')
        if nit!='Consumidor Final' and not re.fullmatch(r'[0-9A-Za-z-]{3,20}',nit):raise ValueError('NIT inválido.')
        tipo='Tienda' if pos else txt('tipo');metodo=txt('metodoPago',maxlen=40)
        if tipo not in ('Tienda','Domicilio'):raise ValueError('Tipo de entrega incorrecto.')
        if metodo not in (('Efectivo','Tarjeta','Transferencia') if pos else ('Transferencia','Tarjeta por coordinar')):raise ValueError('Método de pago inválido.')
        dir=txt('clienteDir','Venta presencial' if pos else 'Recoger en refugio',180)
        if tipo=='Domicilio' and len(dir)<5:raise ValueError('Agrega la dirección de entrega.')
        ref=txt('referenciaPago',maxlen=50)
        if not pos and metodo=='Transferencia' and not re.fullmatch(r'[0-9]{4,50}',ref):raise ValueError('Referencia de transferencia inválida.')
        detalle,subtotal=obtener_stock(data.get('itemsDetalle',data.get('items')))
        envio=Decimal('35.00') if tipo=='Domicilio' else Decimal('0.00')
        orden=Orden(usuario_id=u.id,cliente_nombre=nombre,cliente_tel=tel,cliente_dir=dir,nit=nit,referencia=ref,
            tipo=tipo,metodo_pago=metodo,subtotal=float(subtotal),envio=float(envio),total=float(subtotal+envio),
            items_json=json.dumps(detalle,ensure_ascii=False),estado_pago='PAGADO (Caja)' if pos else 'PENDIENTE DE VERIFICACIÓN',
            estado_orden=ETAPAS[-1] if pos else ETAPAS[0],estado_envio='Entregado' if pos else 'Recibido',
            stock_descontado=True,entregado=pos,cancelado=False,es_pos=pos)
        db.session.add(orden);db.session.commit();return orden
    @bp.route('/api/tienda/productos')
    def productos():
        autorizar();lista=Producto.query.filter_by(visible=True).all()
        return jsonify(status='ok',productos=[dict(id=p.id,nombre=p.nombre,categoria=p.categoria,stock=p.stock,precio=p.precio,visible=True,descripcion=p.descripcion or '',foto=p.foto) for p in lista])
    @bp.route('/api/tienda/pedidos',methods=['GET','POST'])
    def pedidos():
        u=autorizar()
        if request.method=='GET':
            consulta=Orden.query if u.rol=='admin' else Orden.query.filter_by(usuario_id=u.id)
            return jsonify(status='ok',pedidos=[serial(p) for p in consulta.order_by(Orden.id.desc()).all()])
        if u.rol!='usuario':return fallo('Ruta exclusiva de clientes.',403)
        csrf();data=request.get_json(silent=True)
        if not isinstance(data,dict):return fallo('Solicitud inválida.')
        try:return jsonify(status='ok',pedido=serial(crear(data,u))),201
        except (ValueError,ArithmeticError) as e:db.session.rollback();return fallo(e)
        except SQLAlchemyError:db.session.rollback();app.logger.exception('Pedido');return fallo('No se pudo registrar el pedido.',500)
    @bp.route('/api/tienda/pedidos/<int:id>',methods=['GET','PATCH'])
    def pedido(id):
        u=autorizar(admin=request.method=='PATCH');o=db.session.get(Orden,id)
        if not o or (u.rol!='admin' and o.usuario_id!=u.id):return fallo('Pedido no encontrado.',404)
        if request.method=='GET':return jsonify(status='ok',pedido=serial(o))
        csrf();data=request.get_json(silent=True)
        if not isinstance(data,dict):return fallo('Formato inválido.')
        try:
            accion=data.get('accion')
            if accion=='confirmar_pago':
                if o.cancelado or o.entregado or o.estado_pago!='PENDIENTE DE VERIFICACIÓN':raise ValueError('El pago no se puede confirmar de nuevo.')
                o.estado_pago='PAGADO (Verificado)'
            elif accion=='etapa':
                if o.cancelado or o.entregado or not o.estado_pago.startswith('PAGADO'):raise ValueError('Confirma el pago antes de continuar.')
                paso=data.get('etapa');etapas=ENVIO if o.tipo=='Domicilio' else ETAPAS
                actual=(etapas.index(o.estado_envio if o.tipo=='Domicilio' else o.estado_orden)+1)
                if isinstance(paso,bool) or not isinstance(paso,int) or paso!=actual+1 or paso>len(etapas):raise ValueError('Debes avanzar una etapa a la vez.')
                if o.tipo=='Domicilio':o.estado_envio=ENVIO[paso-1];o.estado_orden=ETAPAS[4 if paso==6 else min(paso-1,3)]
                else:o.estado_orden=ETAPAS[paso-1]
                if paso==len(etapas):o.entregado=True
            elif accion=='cancelar':
                if o.cancelado or o.entregado or o.es_pos or o.estado_pago!='PENDIENTE DE VERIFICACIÓN':raise ValueError('No se puede cancelar un pedido pagado o finalizado.')
                if o.stock_descontado:
                    for item in json.loads(o.items_json):
                        db.session.execute(update(Producto).where(Producto.id==item['id']).values(stock=Producto.stock+item['cantidad']))
                    o.stock_descontado=False
                o.cancelado=True;o.estado_pago='CANCELADO'
            else:raise ValueError('Acción no permitida.')
            db.session.commit();return jsonify(status='ok',pedido=serial(o))
        except (ValueError,ArithmeticError) as e:db.session.rollback();return fallo(e)
        except SQLAlchemyError:db.session.rollback();app.logger.exception('Cambio de pedido');return fallo('Error guardando cambios.',500)
    @bp.route('/api/tienda/venta-directa',methods=['POST'])
    def cobrar():
        u=autorizar(admin=True);csrf();data=request.get_json(silent=True)
        if not isinstance(data,dict):return fallo('Formato inválido.')
        try:return jsonify(status='ok',pedido=serial(crear(data,u,True))),201
        except (ValueError,ArithmeticError) as e:db.session.rollback();return fallo(e)
        except SQLAlchemyError:db.session.rollback();app.logger.exception('Venta');return fallo('No se pudo registrar la venta.',500)
    app.register_blueprint(bp)
