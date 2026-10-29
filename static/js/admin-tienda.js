/* Administración de tienda · datos de SQLite (no localStorage) */
(() => {
 'use strict';
 const el=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dinero=n=>'Q'+Number(n||0).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});
 let productos=[],pedidos=[],carrito=[],ocupado=false;
 const v=p=>p.visible===true||p.visible===1;
 const pagado=p=>String(p.estadoPago).startsWith('PAGADO');
 const btn=(accion,id,texto,clase='bg-indigo-50 text-indigo-700')=>`<button type="button" data-shop-accion="${accion}" data-shop-id="${esc(id)}" class="rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${clase}">${esc(texto)}</button>`;
 function aviso(texto,error=false){const x=el('shop-alerta');if(!x)return;x.textContent=texto;x.className='rounded-xl border p-3 text-xs font-bold '+(error?'border-rose-200 bg-rose-50 text-rose-800':'border-emerald-200 bg-emerald-50 text-emerald-800');}
 window.mostrarNotificacionFlotante=aviso;
 async function api(url,method='GET',body,formulario=false){
  const headers={'Accept':'application/json'};
  if(method!=='GET')headers['X-CSRF-Token']=window.HUELLITAS_ADMIN_CSRF||'';
  if(body&&!formulario)headers['Content-Type']='application/json';
  const r=await fetch(url,{method,credentials:'same-origin',headers,body:body?(formulario?body:JSON.stringify(body)):undefined});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.status==='error'){
   const ruta=new URL(url,window.location.href).pathname;
   if(r.status===404)throw Error(`La ruta ${ruta} no existe en este servidor (HTTP 404). Verifica que hayas copiado app.py y modulos/tienda.py de la misma actualización y reinicia Flask.`);
   if(r.status===401||r.status===403)throw Error(`Acceso no autorizado a ${ruta} (HTTP ${r.status}). Comprueba tu sesión de administrador e inicia sesión otra vez.`);
   throw Error(`${ruta}: ${j.message||`Error HTTP ${r.status}`}`);
  }
  return j;
 }
 async function refrescar(){
  const resultados=await Promise.allSettled([api('/obtener_productos'),api('/api/tienda/pedidos')]);
  const errores=[];
  if(resultados[0].status==='fulfilled')productos=resultados[0].value.productos||[];
  else errores.push('Inventario: '+resultados[0].reason.message);
  if(resultados[1].status==='fulfilled')pedidos=resultados[1].value.pedidos||[];
  else errores.push('Pedidos: '+resultados[1].reason.message);
  pintar();
  if(errores.length)aviso(errores.join(' | '),true);
  else el('shop-alerta')?.classList.add('hidden');
  return errores.length===0;
 }
 window.actualizarSoloInventario=refrescar;
 function pintar(){
  const ventas=pedidos.filter(p=>pagado(p)&&!p.cancelado);
  el('shop-kpi-ingresos').textContent=dinero(ventas.reduce((a,b)=>a+b.total,0));
  el('shop-kpi-pendientes').textContent=pedidos.filter(p=>!p.entregado&&!p.cancelado).length;
  el('shop-kpi-productos').textContent=productos.filter(v).length;
  const bajos=productos.filter(p=>p.stock<=5);
  el('shop-kpi-bajo').textContent=bajos.length;
  el('shop-stock-aviso').classList.toggle('hidden',!bajos.length);
  el('shop-stock-aviso').textContent=`⚠️ ${bajos.length} productos con menos de seis unidades. Repón inventario.`;
  inventario();ordenes();posProductos();posCarrito();reporte();
 }
 function inventario(){
  const q=(el('inv-search')?.value||'').toLowerCase(),f=el('inv-filtro')?.value;
  const lista=productos.filter(p=>`${p.nombre} ${p.categoria} PROD-${p.id}`.toLowerCase().includes(q)&&(f==='todos'||f==='bajo'&&p.stock<=5||f==='agotados'&&p.stock===0||f==='ocultos'&&!v(p)));
  el('tbody-inventario').innerHTML=lista.length?lista.map(p=>`<tr class="border-b hover:bg-slate-50"><td class="p-3"><div class="flex items-center gap-3"><div class="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-indigo-50 flex items-center justify-center">${p.foto?`<img src="/static/uploads/${encodeURIComponent(p.foto)}" alt="" class="h-full w-full object-cover">`:'🐾'}</div><div><strong>${esc(p.nombre)}</strong><p class="text-[10px] text-slate-400">PROD-${p.id}</p></div></div></td><td class="p-3">${esc(p.categoria)}</td><td class="p-3 font-black">${dinero(p.precio)}</td><td class="p-3"><span class="rounded-lg px-2 py-1 font-bold ${p.stock<=5?'bg-amber-100 text-amber-800':'bg-emerald-50 text-emerald-700'}">${p.stock} uds.</span></td><td class="p-3 font-bold ${v(p)?'text-emerald-700':'text-slate-400'}">${v(p)?'● Visible':'● Oculto'}</td><td class="p-3"><div class="flex justify-end gap-1">${btn('editar',p.id,'Editar')}${btn('vis',p.id,v(p)?'Ocultar':'Mostrar')}${btn('borrar',p.id,'Eliminar','bg-rose-50 text-rose-700')}</div></td></tr>`).join(''):'<tr><td colspan="6" class="p-10 text-center text-slate-400">Sin productos coincidentes</td></tr>';
 }
 function paso(p){return p.tipo==='Domicilio'?Math.max(1,['Recibido','Confirmado','Preparando','Empacado','En camino','Entregado'].indexOf(p.estadoEnvio)+1):Math.max(1,parseInt(p.estadoOrden)||1);}
 function ordenes(){
  const q=(el('shop-buscar-pedido')?.value||'').toLowerCase(),f=el('shop-filtro-pedido')?.value;
  const lista=pedidos.filter(p=>`${p.id} ${p.clienteNombre} ${p.clienteTel}`.toLowerCase().includes(q)&&(f==='todos'||f==='pendientes'&&!p.entregado&&!p.cancelado||f==='domicilio'&&p.tipo==='Domicilio'||f==='tienda'&&p.tipo==='Tienda'||f==='finalizados'&&p.entregado||f==='cancelados'&&p.cancelado));
  el('shop-cantidad-pedidos').textContent=`${lista.length} de ${pedidos.length} órdenes`;
  el('tbody-pedidos-admin').innerHTML=lista.length?lista.map(p=>{
   const n=paso(p),max=p.tipo==='Domicilio'?6:5,progreso=p.cancelado?0:Math.round(n/max*100);
   let acciones=btn('ticket',p.dbId,'Comprobante','bg-slate-100 text-slate-700');
   if(!p.entregado&&!p.cancelado){
    if(!pagado(p))acciones=btn('pago',p.dbId,'✓ Confirmar pago','bg-emerald-600 text-white')+acciones;
    else if(n<max)acciones=btn('avance',p.dbId,n+1===max?'✓ Entregar':'→ Avanzar etapa')+acciones;
    if(!pagado(p))acciones+=btn('cancelar',p.dbId,'Cancelar','bg-rose-50 text-rose-700');
   }
   const fase=p.cancelado?'Cancelado':p.entregado?'Entregado':p.tipo==='Domicilio'?p.estadoEnvio:p.estadoOrden;
   return `<tr class="border-b align-top hover:bg-slate-50"><td class="p-3"><strong class="text-indigo-700">${esc(p.id)}</strong><p class="font-bold">${esc(p.clienteNombre)}</p><p class="text-[10px] text-slate-400">${esc(p.clienteTel)} · ${esc(p.fecha)}</p><p class="max-w-[220px] text-[10px] text-slate-500">${(p.itemsDetalle||[]).map(i=>`${esc(i.nombre)} ×${i.cantidad}`).join(' · ')}</p></td><td class="p-3"><span class="rounded-full bg-indigo-50 p-1 text-indigo-700">${esc(p.tipo)}</span><p class="mt-2 max-w-[160px] text-[10px]">${esc(p.clienteDir)}</p></td><td class="p-3 font-bold ${pagado(p)?'text-emerald-700':'text-amber-700'}">${p.cancelado?'Cancelado':pagado(p)?'Confirmado':'Por verificar'}<p class="text-[10px] font-normal text-slate-500">${esc(p.metodoPago)}</p>${p.referenciaPago?`<p class="text-[10px]">Ref. ${esc(p.referenciaPago)}</p>`:''}</td><td class="p-3 font-black">${dinero(p.total)}</td><td class="p-3"><strong>${esc(fase)}</strong><div class="mt-2 h-2 min-w-24 overflow-hidden rounded-full bg-slate-100"><div class="h-2 rounded-full bg-indigo-600" style="width:${progreso}%"></div></div><p class="text-[10px] text-slate-400">${progreso}%</p></td><td class="p-3"><div class="flex max-w-48 flex-wrap justify-end gap-1">${acciones}</div></td></tr>`;
  }).join(''):'<tr><td colspan="6" class="p-10 text-center text-slate-400">No hay pedidos para este filtro.</td></tr>';
 }
 function posProductos(){const q=(el('pos-search')?.value||'').toLowerCase();const lista=productos.filter(p=>v(p)&&p.nombre.toLowerCase().includes(q));el('pos-productos-grid').innerHTML=lista.length?lista.map(p=>{const reservado=carrito.find(i=>i.id===p.id)?.cantidad||0;return `<div class="rounded-xl border p-3 hover:border-indigo-300"><p class="text-[10px] text-indigo-600">${esc(p.categoria)}</p><h4 class="my-2 text-xs font-black">${esc(p.nombre)}</h4><div class="flex items-center justify-between"><div><strong>${dinero(p.precio)}</strong><p class="text-[10px] text-slate-500">${p.stock-reservado} disponibles</p></div><button data-shop-accion="mas" data-shop-id="${p.id}" ${p.stock-reservado<1?'disabled':''} class="rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white disabled:bg-slate-300">+ Agregar</button></div></div>`}).join(''):'<p class="p-6 text-xs text-slate-400">Sin productos disponibles.</p>';}
 function posCarrito(){el('pos-carrito').innerHTML=carrito.length?carrito.map(i=>`<div class="flex items-center justify-between rounded-xl border p-2 text-xs"><div><strong>${esc(i.nombre)}</strong><p>${dinero(i.precio)} c/u</p></div><div class="flex items-center gap-2">${btn('menos',i.id,'−','bg-slate-100')}<strong>${i.cantidad}</strong>${btn('mas',i.id,'+','bg-slate-100')}</div></div>`).join(''):'<p class="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-400">Agrega productos para cobrar.</p>';el('pos-total').textContent=dinero(carrito.reduce((a,i)=>a+i.precio*i.cantidad,0));el('pos-cobrar').disabled=ocupado||carrito.length===0;}
 function reporte(){const val=pedidos.filter(p=>pagado(p)&&!p.cancelado),cuentas={};for(const p of val)for(const i of p.itemsDetalle||[])cuentas[i.nombre]=(cuentas[i.nombre]||0)+i.cantidad;
 const top=Object.entries(cuentas).sort((a,b)=>b[1]-a[1]).slice(0,6),max=top[0]?.[1]||1;el('shop-top').innerHTML=top.length?top.map(([nombre,n])=>`<div><div class="flex justify-between text-xs"><strong>${esc(nombre)}</strong><span>${n} uds.</span></div><div class="mt-1 h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full bg-indigo-600" style="width:${n/max*100}%"></div></div></div>`).join(''):'<p class="text-xs text-slate-400">Sin ventas confirmadas</p>';
 const cifras=[['Pedidos',pedidos.length],['Pagados',val.length],['Entregados',pedidos.filter(p=>p.entregado).length],['Cancelados',pedidos.filter(p=>p.cancelado).length],['Ventas presenciales',pedidos.filter(p=>p.esPos).length]];
 el('shop-resumen').innerHTML=cifras.map(([label,n])=>`<div class="flex justify-between border-b pb-2"><span>${label}</span><strong>${n}</strong></div>`).join('');
 el('tbody-historial-metricas').innerHTML=pedidos.length?pedidos.map(p=>`<tr class="border-b"><td class="p-3 font-black text-indigo-700">${esc(p.id)}</td><td class="p-3">${esc(p.fecha)}</td><td class="p-3">${esc(p.clienteNombre)}</td><td class="p-3">${p.esPos?'Caja':esc(p.tipo)}</td><td class="p-3 font-bold">${dinero(p.total)}</td><td class="p-3">${p.cancelado?'Cancelado':pagado(p)?'Pagado':'Pendiente'}</td></tr>`).join(''):'<tr><td colspan="6" class="p-8 text-center text-slate-400">Sin ventas registradas</td></tr>';}
 async function manejarPedido(accion,id){const p=pedidos.find(x=>x.dbId===Number(id));if(!p)return;if(accion==='ticket'){ticket(p);return;}
 let data={};if(accion==='pago'){if(!confirm(`¿Verificaste realmente el pago de ${p.id}?`))return;data.accion='confirmar_pago';}
 if(accion==='cancelar'){if(!confirm(`¿Cancelar ${p.id} y restaurar las unidades reservadas?`))return;data.accion='cancelar';}
 if(accion==='avance'){const final=p.tipo==='Domicilio'?6:5;data={accion:'etapa',etapa:paso(p)+1};if(data.etapa===final&&!confirm(`¿Confirmas la entrega de ${p.id}?`))return;}
 try{await api(`/api/tienda/pedidos/${p.dbId}`,'PATCH',data);await refrescar();aviso('Pedido actualizado correctamente.');}catch(e){aviso(e.message,true);}}
 function editar(id){const p=productos.find(x=>x.id===Number(id));if(!p)return;['id','nombre','stock','precio','categoria','descripcion'].forEach(k=>{const input=el(`edit-p-${k}`);if(input)input.value=k==='id'?p.id:(p[k]??'');});el('edit-p-foto').value='';el('edit-p-img-preview-box').classList.toggle('hidden',!p.foto);if(p.foto)el('edit-p-img-preview').src='/static/uploads/'+encodeURIComponent(p.foto);el('edit-p-error').classList.add('hidden');el('modal-edit-prod').classList.remove('hidden');}
 window.abrirModalEditar=editar;window.cerrarModalEditar=()=>el('modal-edit-prod').classList.add('hidden');
 window.toggleModalProd=(abrir)=>{const x=el('modal-prod');x.classList.toggle('hidden',typeof abrir==='boolean'?!abrir:!x.classList.contains('hidden'));};
 window.previewImagen=event=>{const f=event.target.files[0],x=el('p-img-preview-box');if(!f){x.classList.add('hidden');return;}if(!['image/jpeg','image/png'].includes(f.type)||f.size>5*1024*1024){aviso('Imagen JPG o PNG, máximo 5MB.',true);event.target.value='';return;}el('p-img-preview').src=URL.createObjectURL(f);x.classList.remove('hidden');};
 async function guardarEdicion(event){event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;const boton=el('btn-guardar-edicion');boton.disabled=true;try{await api('/editar_producto/'+el('edit-p-id').value,'POST',new FormData(form),true);window.cerrarModalEditar();await refrescar();aviso('Producto guardado correctamente.');}catch(e){el('edit-p-error').textContent=e.message;el('edit-p-error').classList.remove('hidden');}finally{boton.disabled=false;}}
 async function accionProducto(accion,id){const p=productos.find(x=>x.id===Number(id));if(!p)return;try{if(accion==='editar'){editar(id);return;}if(accion==='vis')await api(`/editar_producto/${id}`,'POST',{visible:!v(p)});if(accion==='borrar'){if(!confirm('¿Eliminar permanentemente el producto? Si ya tiene ventas, debes ocultarlo.'))return;await api(`/eliminar_producto/${id}`,'POST',{});}await refrescar();aviso('Inventario actualizado.');}catch(e){aviso(e.message,true);}}
 function cambiarCarrito(id,cambio){const p=productos.find(x=>x.id===Number(id));if(!p)return;let i=carrito.find(x=>x.id===p.id);if(!i&&cambio>0){i={id:p.id,nombre:p.nombre,precio:Number(p.precio),cantidad:0};carrito.push(i);}if(!i)return;if(cambio>0&&i.cantidad>=p.stock){aviso('Stock insuficiente.',true);return;}i.cantidad+=cambio;if(i.cantidad<=0)carrito=carrito.filter(x=>x.id!==i.id);posProductos();posCarrito();}
 async function cobrar(){if(ocupado||!carrito.length)return;const nombre=el('pos-cliente-nombre').value.trim();if(nombre.length<2){aviso('Escribe el nombre del comprador.',true);return;}if(!confirm('¿Confirmas el cobro y descuento de existencias?'))return;
 ocupado=true;posCarrito();try{const data={clienteNombre:nombre,clienteTel:el('pos-cliente-tel').value.trim(),nit:el('pos-cliente-nit').value.trim()||'Consumidor Final',clienteDir:'Venta presencial en refugio',metodoPago:el('pos-metodo-pago').value,itemsDetalle:carrito.map(i=>({id:i.id,cantidad:i.cantidad}))};const r=await api('/api/tienda/venta-directa','POST',data);carrito=[];['pos-cliente-nombre','pos-cliente-tel','pos-cliente-nit'].forEach(x=>el(x).value='');await refrescar();switchShopSubTab('pedidos');aviso(`Venta ${r.pedido.id} registrada. Imprime el comprobante desde Pedidos.`);}catch(e){aviso(e.message,true);}finally{ocupado=false;posCarrito();}}
 function ticket(p){const rows=p.itemsDetalle.map(i=>`<tr><td>${esc(i.nombre)}</td><td>${i.cantidad}</td><td>${dinero(i.precio)}</td><td>${dinero(i.cantidad*i.precio)}</td></tr>`).join('');const html=`<!doctype html><html lang="es"><meta charset="utf-8"><title>${esc(p.id)}</title><style>body{font:14px Arial;padding:35px;max-width:800px;margin:auto;color:#1e293b}h1{color:#3730a3}table{width:100%;border-collapse:collapse;margin:25px 0}td,th{padding:12px;border-bottom:1px solid #ddd;text-align:left}.tot{text-align:right;font-size:20px;font-weight:900}.nota{font-size:12px;color:#64748b}</style><h1>🐾 Huellitas de Amor</h1><h3>COMPROBANTE DE COMPRA · ${esc(p.id)}</h3><p>${esc(p.fecha)}<br>Cliente: ${esc(p.clienteNombre)}<br>NIT: ${esc(p.nit)}<br>Entrega: ${esc(p.clienteDir)}<br>Pago: ${esc(p.estadoPago)}</p><table><thead><tr><th>Artículo</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table><p class="tot">Envío ${dinero(p.envio)} · TOTAL ${dinero(p.total)}</p><p class="nota">Comprobante interno. No es factura electrónica FEL autorizada por SAT.</p><button onclick="print()">Imprimir / Guardar como PDF</button></html>`;const win=window.open('','_blank');if(!win){aviso('Autoriza las ventanas emergentes para imprimir.',true);return;}win.document.write(html);win.document.close();}
 function csv(){const filas=[['Folio','Fecha','Cliente','Teléfono','Entrega','Método','Pago','Total Q'],...pedidos.map(p=>[p.id,p.fecha,p.clienteNombre,p.clienteTel,p.tipo,p.metodoPago,p.estadoPago,p.total])];const str='\ufeff'+filas.map(f=>f.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([str],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='huellitas_ventas.csv';a.click();URL.revokeObjectURL(url);}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-shop-accion]');if(!b||b.disabled)return;const {shopAccion:a,shopId:id}=b.dataset;if(['pago','avance','cancelar','ticket'].includes(a))manejarPedido(a,id);if(['editar','vis','borrar'].includes(a))accionProducto(a,id);if(a==='mas'||a==='menos')cambiarCarrito(id,a==='mas'?1:-1);});
 // Funciones reutilizadas por Solicitudes y Voluntariado del administrador.
 window.abrirModalAdmin=s=>{const m=el('modal-'+s);if(m){openModal(m.innerHTML);window.lucide?.createIcons();}};
 window.marcarComoLeido=id=>{closeModal();el('badge_leido_'+id)?.classList.remove('hidden');const b=el('btn_leer_'+id);if(b){b.textContent='Releer Info';b.classList.add('text-slate-500','bg-slate-100');}const a=el('acciones_'+id);a?.classList.remove('hidden');a?.classList.add('flex');let list=[];try{list=JSON.parse(localStorage.getItem('admin_solicitudes_leidas')||'[]');}catch{}if(!list.includes(id)){list.push(id);localStorage.setItem('admin_solicitudes_leidas',JSON.stringify(list));}};
 document.addEventListener('DOMContentLoaded',()=>{['inv-search','inv-filtro'].forEach(id=>el(id)?.addEventListener('input',inventario));['shop-buscar-pedido','shop-filtro-pedido'].forEach(id=>el(id)?.addEventListener('input',ordenes));el('pos-search')?.addEventListener('input',posProductos);el('shop-refresh')?.addEventListener('click',refrescar);el('pos-cobrar')?.addEventListener('click',cobrar);el('shop-csv')?.addEventListener('click',csv);el('cerrar-edit-prod')?.addEventListener('click',window.cerrarModalEditar);el('form-edit-prod')?.addEventListener('submit',guardarEdicion);try{for(const id of JSON.parse(localStorage.getItem('admin_solicitudes_leidas')||'[]')){el('badge_leido_'+id)?.classList.remove('hidden');el('acciones_'+id)?.classList.remove('hidden');}}catch{}refrescar();});
})();
