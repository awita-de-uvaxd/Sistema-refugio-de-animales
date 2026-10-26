  // ALMACENAMIENTO DE DATOS REALES (SISTEMA LIMPIO SIN DATOS DE PRUEBA)
  let productos = JSON.parse(localStorage.getItem('huellitas_productos')) || [];
  let historialVentas = JSON.parse(localStorage.getItem('huellitas_historial')) || [];

  let descPos = 0;
  let chartInstance = null;
  let tempImgData = "";

  window.addEventListener('storage', (e) => {
      if(e.key === 'huellitas_historial' || e.key === 'huellitas_productos') {
          productos = JSON.parse(localStorage.getItem('huellitas_productos')) || [];
          historialVentas = JSON.parse(localStorage.getItem('huellitas_historial')) || [];
          actualizarTodo();
      }
  });

  // Carga directa y automática desde SQLite al abrir la página
  document.addEventListener('DOMContentLoaded', async () => {
      await actualizarSoloInventario(); // Carga SQLite y sincroniza el inventario
      renderizarPedidos();
      cargarSelectorPos();
      renderizarMetricasYReporte();
      initChart();
  });

  function guardarDatos() {
      localStorage.setItem('huellitas_productos', JSON.stringify(productos));
      localStorage.setItem('huellitas_historial', JSON.stringify(historialVentas));
  }

  function actualizarTodo() {
      renderizarPedidos();
      renderizarInventario();
      cargarSelectorPos();
      renderizarMetricasYReporte();
      if(chartInstance) actualizarChart();
  }

  function renderizarPedidos() {
        const dom = historialVentas.filter(o => o.tipo === 'Domicilio');
        const tie = historialVentas.filter(o => o.tipo === 'Tienda');

        // Tabla de Servicio a Domicilio
        const tbodyDom = document.getElementById('tbody-domicilio');
        if (tbodyDom) {
            tbodyDom.innerHTML = dom.length === 0 ? `<tr><td colspan="5" class="p-4 text-center text-slate-400">No hay órdenes a domicilio activas</td></tr>` :
            dom.map(o => `
                <tr class="border-b">
                    <td class="p-3 font-bold text-indigo-600">${o.id}</td>
                    <td class="p-3">${o.clienteNombre}<br><span class="text-[10px] text-slate-400">${o.clienteTel || ''}</span></td>
                    <td class="p-3">${o.metodoPago}<br><span class="font-bold ${o.estadoPago === 'PAGADO' ? 'text-emerald-600' : 'text-amber-600'}">${o.estadoPago}</span></td>
                    <td class="p-3 font-bold">Q${o.total.toFixed(2)}</td>
                    <td class="p-3">
                        ${o.estadoPago.includes('PENDIENTE DE VERIFICACIÓN') ? `
                            <button onclick="confirmarPago('${o.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition">✓ Confirmar Pago</button>
                        ` : `
                            <div class="flex flex-wrap gap-1">
                                ${["1. Tomando", "2. Aceptado", "3. Procesando", "4. Empacando", "5. Finalizar"].map(st => `
                                    <button onclick="cambiarFlujo('${o.id}', '${st}')" class="px-1.5 py-0.5 text-[9px] rounded ${o.estadoOrden === st ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${st}</button>
                                `).join('')}
                            </div>
                        `}
                    </td>
                </tr>
            `).join('');
        }

        // Tabla de Recoger en Tienda
        const tbodyTie = document.getElementById('tbody-tienda');
        if (tbodyTie) {
            tbodyTie.innerHTML = tie.length === 0 ? `<tr><td colspan="5" class="p-4 text-center text-slate-400">No hay órdenes para retirar en tienda activas</td></tr>` :
            tie.map(o => `
                <tr class="border-b">
                    <td class="p-3 font-bold text-indigo-600">${o.id}</td>
                    <td class="p-3">${o.clienteNombre}<br><span class="text-[10px] text-slate-400">${o.clienteTel || ''}</span></td>
                    <td class="p-3">
                        <div class="flex flex-wrap gap-1">
                            ${["1. Tomando", "2. Aceptado", "3. Procesando", "4. Empacando", "5. Finalizar"].map(st => `
                                <button onclick="cambiarFlujo('${o.id}', '${st}')" class="px-1.5 py-0.5 text-[9px] rounded ${o.estadoOrden === st ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${st}</button>
                            `).join('')}
                        </div>
                    </td>
                    <td class="p-3 font-bold">Q${o.total.toFixed(2)}</td>
                    <td class="p-3">
                        ${o.entregado ? `
                            <span class="px-2 py-1 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full">✓ Entregado & Stock Rebajado</span>
                        ` : o.estadoOrden === '5. Finalizar' ? `
                            <button onclick="marcarEntregadoRefugio('${o.id}')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] rounded-lg shadow-sm transition flex items-center gap-1">
                                📦 Entregado
                            </button>
                        ` : `
                            <span class="px-2 py-1 bg-amber-50 text-amber-700 font-bold text-[10px] rounded-full">En Preparación</span>
                        `}
                    </td>
                </tr>
            `).join('');
        }
    }

    // Función exclusiva para confirmar la entrega presencial y descontar stock
    // 1. Confirmar entrega presencial
async function marcarEntregadoRefugio(id) {
    const o = historialVentas.find(x => x.id === id);
    if (!o) return;

    if (!confirm(`¿Confirmas que el cliente retiró físicamente el pedido ${o.id}? Esto rebajará los productos del inventario.`)) {
        return;
    }

    try {
        const response = await fetch('/descontar_stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.HUELLITAS_ADMIN_CSRF || '' },
            body: JSON.stringify({ items: o.itemsDetalle })
        });

        if (response.ok) {
            o.entregado = true;
            o.stockDescontado = true;
            o.estadoPago = "PAGADO (Entregado en Refugio)";

            if (typeof actualizarSoloInventario === 'function') {
                await actualizarSoloInventario();
            }

            guardarDatos();
            actualizarTodo();
            mostrarNotificacionFlotante(`Pedido ${o.id} entregado con éxito. El inventario se actualizó.`, '✅');
        } else {
            mostrarNotificacionFlotante('Error de conexión con la base de datos para descontar stock.');
        }
    } catch (err) {
        console.error('Error al entregar pedido:', err);
        mostrarNotificacionFlotante('Error al procesar la entrega.');
    }
}

  function cambiarFlujo(id, st) {
      const o = historialVentas.find(x => x.id === id);
      if(o) {
          o.estadoOrden = st;
          if(o.tipo === 'Domicilio' && st === '5. Finalizar') descontarStock(o);
          guardarDatos();
          actualizarTodo();
      }
  }

  function confirmarPago(id) {
      const o = historialVentas.find(x => x.id === id);
      if(o) {
          o.estadoPago = "PAGADO";
          o.estadoOrden = "2. Aceptado";
          descontarStock(o);
          guardarDatos();
          actualizarTodo();
      }
  }

  function descontarStock(o) {
      if(o.stockDescontado) return;
      o.itemsDetalle.forEach(i => {
          const p = productos.find(x => x.id === i.id);
          if(p) p.stock = Math.max(0, p.stock - i.cantidad);
      });
      o.stockDescontado = true;
  }

  function cargarSelectorPos() {
      const list = historialVentas.filter(o => o.tipo === 'Tienda' && o.estadoOrden === '5. Finalizar' && !o.estadoPago.includes('PAGADO EN TIENDA'));
      const sel = document.getElementById('select-pos-order');
      if(!sel) return;
      sel.innerHTML = list.length === 0 ? `<option value="">-- No hay pedidos listos para cobro --</option>` :
          `<option value="">-- Selecciona pedido --</option>` + list.map(o => `<option value="${o.id}">${o.id} - ${o.clienteNombre} (Q${o.total.toFixed(2)})</option>`).join('');
      cargarDetallePos();
  }

  function cargarDetallePos() {
      const sel = document.getElementById('select-pos-order');
      if(!sel) return;
      const id = sel.value;
      const box = document.getElementById('pos-details');
      if(!id) { box.classList.add('hidden'); return; }
      const o = historialVentas.find(x => x.id === id);
      box.classList.remove('hidden');
      document.getElementById('pos-id').innerText = `#${o.id}`;
      document.getElementById('pos-cli').innerText = `Cliente: ${o.clienteNombre}`;
      document.getElementById('pos-items').innerHTML = o.itemsDetalle.map(i => `<li>${i.nombre} (x${i.cantidad}) - Q${(i.precio*i.cantidad).toFixed(2)}</li>`).join('');
      document.getElementById('pos-total').innerText = `Q${o.total.toFixed(2)}`;
      descPos = 0;
  }

  function toggleCuponPos() {
      const m = document.querySelector('input[name="pos-method"]:checked').value;
      document.getElementById('pos-cupon-box').classList.toggle('hidden', m !== 'Cupón Refugio');
  }

  function aplicarCuponPos() {
    const code = document.getElementById('pos-cupon-code').value.trim().toUpperCase();
    const id = document.getElementById('select-pos-order').value;
    const o = historialVentas.find(x => x.id === id);
    if (code === 'REFUGIO10' && o) {
        descPos = o.subtotal * 0.10;
        document.getElementById('pos-cupon-msg').innerText = `Descuento Q${descPos.toFixed(2)} aplicado`;
        document.getElementById('pos-total').innerText = `Q${(o.subtotal - descPos).toFixed(2)}`;
    } else {
        mostrarNotificacionFlotante('Cupón inválido.');
    }
}

  function descargarFacturaAdmin(orden) {
    if (!orden) return alert('No se encontró información del pedido.');

    // Elementos de la plantilla PDF
    const titleEl = document.getElementById('pdf-doc-title');
    const ordIdEl = document.getElementById('pdf-ord-id');
    const dateEl = document.getElementById('pdf-date');
    const clientBox = document.getElementById('pdf-client-box');
    const statusBadge = document.getElementById('pdf-status-badge');
    const itemsBody = document.getElementById('pdf-items-body');
    const subtotalEl = document.getElementById('pdf-subtotal');
    const shippingEl = document.getElementById('pdf-shipping');
    const totalEl = document.getElementById('pdf-total');

    // Encabezado
    if (titleEl) titleEl.innerText = "FACTURA OFICIAL DE COMPRA";
    if (ordIdEl) ordIdEl.innerText = `#${orden.id || 'PED-0000'}`;
    if (dateEl) dateEl.innerText = `Fecha: ${orden.fecha || new Date().toLocaleDateString('es-GT')}`;

    // Sello verde estilo compra en línea
    if (statusBadge) {
        statusBadge.innerText = "PAGADO / CANCELADO";
        statusBadge.style.backgroundColor = "#D1FAE5";
        statusBadge.style.color = "#065F46";
        statusBadge.style.border = "1px solid #6EE7B7";
    }

    // Datos del Cliente
    const clienteNombre = orden.clienteNombre || 'Cliente Presencial';
    const nitCliente = orden.nit || 'Consumidor Final';
    const clienteTel = orden.clienteTel || 'N/A';
    const direccionTexto = orden.clienteDir || (orden.tipo === 'Domicilio' ? 'Servicio a Domicilio' : 'Venta Presencial en Refugio');
    const metodoPago = orden.metodoPago || 'Presencial (Caja Directa)';

    if (clientBox) {
        clientBox.innerHTML = `
            <p style="margin:2px 0;"><strong>Cliente:</strong> ${clienteNombre}</p>
            <p style="margin:2px 0;"><strong>NIT:</strong> ${nitCliente}</p>
            <p style="margin:2px 0;"><strong>Dirección:</strong> ${direccionTexto}</p>
            <p style="margin:2px 0;"><strong>Teléfono:</strong> ${clienteTel}</p>
            <p style="margin:2px 0;"><strong>Estado de Cuenta:</strong> <span style="color:#047857; font-weight:bold;">Cuenta Pagada y Cancelada (${metodoPago})</span></p>
        `;
    }

    // Tabla de Productos con formato PROD-
    const items = orden.itemsDetalle || orden.items || [];
    if (itemsBody) {
        itemsBody.innerHTML = items.map(i => {
            const rawId = i.id || i.numId || 'PROD';
            const codeId = String(rawId).startsWith('PROD-') ? rawId : `PROD-${rawId}`;
            const precio = parseFloat(i.precio || 0);
            const cant = parseInt(i.cantidad || 1);
            const sub = precio * cant;
            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 8px; font-weight: 600; color: #64748b;">${codeId}</td>
                    <td style="padding: 12px 8px; font-weight: 700; color: #0f172a;">${i.nombre}</td>
                    <td style="padding: 12px 8px; text-align: center; font-weight: 600;">${cant}</td>
                    <td style="padding: 12px 8px; text-align: right; color: #475569;">Q${precio.toFixed(2)}</td>
                    <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: #0f172a;">Q${sub.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }

    // Totales exactos
    const total = parseFloat(orden.total || 0);
    const envio = parseFloat(orden.envio || 0);
    const subtotal = parseFloat(orden.subtotal || (total - envio));

    if (subtotalEl) subtotalEl.innerText = `Q${subtotal.toFixed(2)}`;
    if (shippingEl) shippingEl.innerText = `Q${envio.toFixed(2)}`;
    if (totalEl) totalEl.innerText = `Q${total.toFixed(2)}`;

    // Descarga PDF
    const element = document.getElementById('pdf-template');
    if (!element) return alert('No se encontró la plantilla de PDF.');

    const opt = {
        margin:       0,
        filename:     `Factura_${orden.id}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
        jsPDF:        { unit: 'pt', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
}
// 3. Completar cobro en refugio
function completarCobroRefugio() {
    const id = document.getElementById('select-pos-order').value;
    const o = historialVentas.find(x => x.id === id);
    if (!o) return;
    const m = document.querySelector('input[name="pos-method"]:checked').value;
    if (descPos > 0) o.total = o.subtotal - descPos;
    o.metodoPago = `Presencial (${m})`;
    o.estadoPago = "PAGADO EN TIENDA";
    descontarStock(o);
    guardarDatos();
    actualizarTodo();

    descargarFacturaAdmin(o);
    mostrarNotificacionFlotante(`Cobro finalizado con éxito para ${o.id}`, '✅');
}

  function previewImagen(event) {
      const file = event.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
              tempImgData = e.target.result;
              document.getElementById('p-img-preview').src = tempImgData;
              document.getElementById('p-img-preview-box').classList.remove('hidden');
          };
          reader.readAsDataURL(file);
      } else {
          tempImgData = "";
          document.getElementById('p-img-preview-box').classList.add('hidden');
      }
  }

 function renderizarInventario() {
    const searchInput = document.getElementById('inv-search');
    if(!searchInput) return;
    const q = searchInput.value.toLowerCase();
    const tbodyInv = document.getElementById('tbody-inventario');
    if(!tbodyInv) return;

    if (productos.length === 0) {
        tbodyInv.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">No hay productos registrados</td></tr>`;
        return;
    }

    tbodyInv.innerHTML = productos.filter(p => p.nombre.toLowerCase().includes(q)).map(p => {
        const idMostrar = String(p.id).startsWith('PROD-') ? p.id : `PROD-${p.id}`;
        const imagenUrl = p.foto ? `/static/uploads/${p.foto}` : (p.img || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=300');
        const precioNum = parseFloat(p.precio) || 0;
        
        // Validación estricta de visibilidad
        const esVis = (p.visible === true || p.visible === 1 || p.visible === '1' || p.visible === 'true');

        return `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-3 font-bold">${idMostrar}</td>
                <td class="p-3 flex items-center gap-3">
                    <img src="${imagenUrl}" class="w-10 h-10 object-cover rounded-xl border border-slate-200 shadow-sm">
                    <span class="font-bold text-slate-800">${p.nombre}</span>
                </td>
                <td class="p-3">${p.categoria}</td>
                <td class="p-3 font-bold ${p.stock <= 5 ? 'text-red-600 font-extrabold' : ''}">${p.stock}</td>
                <td class="p-3 font-semibold">Q${precioNum.toFixed(2)}</td>
                <td class="p-3">
                    <button type="button" onclick="toggleVis('${p.id}')" class="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold transition shadow-sm">
                        ${esVis ? '👁 Visible' : '🙈 Oculto'}
                    </button>
                </td>
                <td class="p-3 text-right space-x-2">
                    <button type="button" onclick="abrirModalEditar('${p.id}')" class="text-indigo-600 font-bold hover:underline">Editar</button>
                    <button type="button" onclick="eliminarProd('${p.id}')" class="text-red-500 font-bold hover:underline">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
  }

  async function toggleVis(id) {
    const numId = parseInt(String(id).replace(/\D/g, ''));
    const p = productos.find(x => parseInt(String(x.id).replace(/\D/g, '')) === numId);
    if (!p) return;

    const esVis = (p.visible === true || p.visible === 1 || p.visible === '1' || p.visible === 'true');
    const nuevoEstado = !esVis;

    try {
        const response = await fetch(`/editar_producto/${numId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.HUELLITAS_ADMIN_CSRF || '' },
            body: JSON.stringify({ visible: nuevoEstado ? 1 : 0 })
        });

        if (response.ok) {
            p.visible = nuevoEstado;
            guardarDatos();
            renderizarInventario();
        } else {
            mostrarNotificacionFlotante('Error al actualizar la visibilidad del producto.');
        }
    } catch (err) {
        console.error('Error al cambiar visibilidad:', err);
    }
}
  async function eliminarProd(id) {
    if (!confirm('¿Deseas eliminar este producto permanentemente?')) return;

    const numId = parseInt(String(id).replace(/\D/g, ''));

    try {
        const response = await fetch(`/eliminar_producto/${numId}`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': window.HUELLITAS_ADMIN_CSRF || '' }
        });

        if (response.ok) {
            // 1. Remover de la lista en memoria del script
            productos = productos.filter(x => parseInt(String(x.id).replace(/\D/g, '')) !== numId);
            
            // 2. Sincronizar memoria local para notificar a la pantalla del usuario al instante
            guardarDatos();
            
            // 3. Volver a renderizar la tabla del inventario
            renderizarInventario();
        } else {
            alert('No se pudo eliminar el producto.');
        }
    } catch (err) {
        console.error('Error al eliminar producto:', err);
    }
}
  function toggleModalProd() { document.getElementById('modal-prod').classList.toggle('hidden'); }

  function guardarNuevoProd(e) {
      e.preventDefault();
      const defaultImg = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=300";
      const imagenFinal = tempImgData || defaultImg;

      productos.push({
          id: "PROD-" + String(productos.length + 1).padStart(3, '0'),
          nombre: document.getElementById('p-nombre').value,
          categoria: document.getElementById('p-cat').value,
          precio: parseFloat(document.getElementById('p-precio').value),
          stock: parseInt(document.getElementById('p-stock').value),
          visible: true,
          img: imagenFinal
      });

      tempImgData = "";
      document.getElementById('p-img-file').value = "";
      document.getElementById('p-img-preview-box').classList.add('hidden');
      document.getElementById('p-nombre').value = "";
      document.getElementById('p-precio').value = "";
      document.getElementById('p-stock').value = "";

      guardarDatos();
      toggleModalProd();
      actualizarTodo();
  }

  function renderizarMetricasYReporte() {
      const pagosCompletados = historialVentas.filter(o => o.estadoPago.includes('PAGADO'));
      const totalIngresos = pagosCompletados.reduce((acc, curr) => acc + curr.total, 0);
      
      const elVentas = document.getElementById('kpi-total-ventas');
      const elPedidos = document.getElementById('kpi-total-pedidos');
      if(elVentas) elVentas.innerText = `Q${totalIngresos.toFixed(2)}`;
      if(elPedidos) elPedidos.innerText = pagosCompletados.length;

      const conteoProds = {};
      historialVentas.forEach(h => {
          h.itemsDetalle.forEach(i => {
              conteoProds[i.nombre] = (conteoProds[i.nombre] || 0) + i.cantidad;
          });
      });

      let topProd = "N/A";
      let maxCant = 0;
      for(const [nombre, cant] of Object.entries(conteoProds)) {
          if(cant > maxCant) {
              maxCant = cant;
              topProd = nombre;
          }
      }
      const elTop = document.getElementById('kpi-prod-estrella');
      if(elTop) elTop.innerText = topProd !== "N/A" ? `${topProd} (${maxCant})` : "N/A";

      const tbodyHist = document.getElementById('tbody-historial-metricas');
      if(tbodyHist) {
          tbodyHist.innerHTML = historialVentas.length === 0 ? `<tr><td colspan="7" class="p-4 text-center text-slate-400">Sin historial registrado</td></tr>` :
          historialVentas.map(h => `
              <tr class="border-b hover:bg-slate-50">
                  <td class="p-3 font-bold text-indigo-600">${h.id}</td>
                  <td class="p-3 font-semibold">${h.clienteNombre}</td>
                  <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${h.tipo === 'Domicilio' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}">${h.tipo}</span></td>
                  <td class="p-3 text-[11px] text-slate-600">
                      ${h.itemsDetalle.map(i => `• ${i.nombre} (x${i.cantidad})`).join('<br>')}
                  </td>
                  <td class="p-3 text-[11px]">${h.metodoPago}</td>
                  <td class="p-3 font-black text-slate-800">Q${h.total.toFixed(2)}</td>
                  <td class="p-3">
                      <span class="px-2 py-1 rounded-full text-[10px] font-bold ${h.estadoPago.includes('PAGADO') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                          ${h.estadoPago}
                      </span>
                  </td>
              </tr>
          `).join('');
      }
  }

  function initChart() {
      const canvas = document.getElementById('chartVentas');
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      chartInstance = new Chart(ctx, {
          type: 'bar',
          data: { labels: [], datasets: [{ label: 'Unidades Vendidas', data: [], backgroundColor: '#4F46E5' }] },
          options: { responsive: true, maintainAspectRatio: false }
      });
      actualizarChart();
  }

  function actualizarChart() {
      if(!chartInstance) return;
      const counts = {};
      productos.forEach(p => counts[p.nombre] = 0);
      historialVentas.forEach(h => h.itemsDetalle.forEach(i => counts[i.nombre] = (counts[i.nombre] || 0) + i.cantidad));
      chartInstance.data.labels = Object.keys(counts);
      chartInstance.data.datasets[0].data = Object.values(counts);
      chartInstance.update();
  }

// Abrir Modal
  function abrirModalAdmin(suffix) {
      const html = document.getElementById('modal-' + suffix).innerHTML;
      openModal(html);
      lucide.createIcons();
  }

  // Marcar como leído y revelar botones externamente
  function marcarComoLeido(id) {
      closeModal(); // Cierra el pop-up inmediatamente
      
      // 1. Mostrar la etiqueta "Revisado"
      const badge = document.getElementById('badge_leido_' + id);
      if(badge) badge.classList.remove('hidden');

      // 2. Apagar el botón principal para que quede gris (Indicador visual)
      const btnLeer = document.getElementById('btn_leer_' + id);
      if(btnLeer) {
          // Limpia colores anteriores
          btnLeer.classList.remove('bg-emerald-100', 'hover:bg-emerald-200', 'text-emerald-800');
          btnLeer.classList.remove('bg-red-100', 'hover:bg-red-200', 'text-red-800');
          // Lo vuelve neutral
          btnLeer.classList.add('bg-slate-100', 'hover:bg-slate-200', 'text-slate-500', 'shadow-none');
          btnLeer.innerText = "Releer Info";
      }

      // 3. Mostrar los botones de Aceptar/Rechazar por fuera
      const acciones = document.getElementById('acciones_' + id);
      if(acciones) {
          acciones.classList.remove('hidden');
          acciones.classList.add('flex');
      }

      // 4. Guardar en memoria para que no se pierda al darle F5
      let leidos = JSON.parse(localStorage.getItem('admin_solicitudes_leidas') || '[]');
      if(!leidos.includes(id)) {
          leidos.push(id);
          localStorage.setItem('admin_solicitudes_leidas', JSON.stringify(leidos));
      }
      lucide.createIcons();
  }

// Sincronizar automáticamente la base de datos con el almacenamiento local al iniciar
// Sincronización en tiempo real sin caracteres erróneos
window.addEventListener('storage', (e) => {
    if (e.key === 'huellitas_productos' || e.key === 'huellitas_historial') {
        productos = JSON.parse(localStorage.getItem('huellitas_productos')) || [];
        historialVentas = JSON.parse(localStorage.getItem('huellitas_historial')) || [];
        actualizarTodo();

        if (ordenActivaSeguimiento) {
            const act = historialVentas.find(o => o.id === ordenActivaSeguimiento.id);
            if (act) {
                ordenActivaSeguimiento = act;
                actualizarBarraProgresivaCliente(act);
            }
        }
    }
});

// 1. REBAJA Y CONSULTA DE INVENTARIO DESDE SQLITE
async function actualizarSoloInventario() {
    try {
        const response = await fetch('/obtener_productos');
        const data = await response.json();
        
        if (data.status === 'ok') {
            productos = data.productos;
            localStorage.setItem('huellitas_productos', JSON.stringify(productos));
            renderizarInventario();
        }
    } catch (err) {
        console.error('Error al consultar inventario:', err);
    }
}

// 2. TOGGLE VISIBILIDAD (OCULTO / VISIBLE) EN SQLITE
async function toggleVis(id) {
    const numId = parseInt(String(id).replace(/\D/g, ''));
    const p = productos.find(x => parseInt(String(x.id).replace(/\D/g, '')) === numId);
    if (!p) return;

    const esVis = (p.visible === true || p.visible === 1 || p.visible === '1' || p.visible === 'true');
    const nuevoEstado = !esVis;

    try {
        const response = await fetch(`/editar_producto/${numId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.HUELLITAS_ADMIN_CSRF || '' },
            body: JSON.stringify({ visible: nuevoEstado ? 1 : 0 })
        });

        if (response.ok) {
            p.visible = nuevoEstado;
            guardarDatos();
            renderizarInventario();
        } else {
            alert('Error al actualizar la visibilidad.');
        }
    } catch (err) {
        console.error('Error al cambiar visibilidad:', err);
    }
}

// 3. EDITAR PRODUCTO: comparte el diseño de Agregar Producto, incluidos imagen y descripción.
let huellitasVistaPreviaEdicionUrl = null;
function obtenerModalEdicionProducto() {
    let modal = document.getElementById('modal-edit-prod');
    if (!modal) {
        // Copia de respaldo, por si se actualiza el JS antes que la plantilla HTML.
        const contenedor = document.createElement('div');
        contenedor.innerHTML = `<div id="modal-edit-prod" class="fixed inset-0 bg-slate-900/50 hidden z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-editar-producto">
  <form id="form-edit-prod" enctype="multipart/form-data" class="bg-white rounded-3xl max-w-md w-full p-6 space-y-3 text-xs shadow-xl max-h-[92vh] overflow-y-auto">
    <input type="hidden" id="edit-p-id">
    <h3 id="titulo-editar-producto" class="font-black text-slate-800 border-b pb-2 text-sm">Editar Producto</h3>

    <div>
      <label for="edit-p-nombre" class="block font-bold text-slate-700 mb-1">Nombre *</label>
      <input id="edit-p-nombre" name="nombre" type="text" data-validar="producto" minlength="2" maxlength="100" required placeholder="Ej. Alimento Adulto 5kg" class="w-full p-2 border rounded-xl">
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <label for="edit-p-categoria" class="block font-bold text-slate-700 mb-1">Categoría</label>
        <select id="edit-p-categoria" name="categoria" class="w-full p-2 border rounded-xl bg-white">
          <option value="Comida">Comida</option>
          <option value="Medicina">Medicina</option>
          <option value="Juguetes">Juguetes</option>
          <option value="Accesorios">Accesorios</option>
        </select>
      </div>
      <div>
        <label for="edit-p-precio" class="block font-bold text-slate-700 mb-1">Precio (Q) *</label>
        <input id="edit-p-precio" name="precio" type="text" inputmode="decimal" data-validar="decimal" pattern="[0-9]+([.][0-9]{1,2})?" maxlength="12" placeholder="0.00" required class="w-full p-2 border rounded-xl">
      </div>
    </div>

    <div>
      <label for="edit-p-stock" class="block font-bold text-slate-700 mb-1">Stock *</label>
      <input id="edit-p-stock" name="stock" type="text" inputmode="numeric" data-validar="entero" pattern="[0-9]+" maxlength="7" placeholder="10" required class="w-full p-2 border rounded-xl">
    </div>

    <div>
      <label for="edit-p-descripcion" class="block font-bold text-slate-700 mb-1">Descripción</label>
      <textarea id="edit-p-descripcion" name="descripcion" maxlength="3000" placeholder="Descripción opcional..." rows="2" class="w-full p-2 border rounded-xl"></textarea>
    </div>

    <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
      <label for="edit-p-foto" class="block font-bold text-slate-700">Imagen del Producto</label>
      <div>
        <label for="edit-p-foto" class="block text-[10px] text-slate-500 mb-1">Seleccionar desde tu equipo (JPG, PNG):</label>
        <input id="edit-p-foto" type="file" name="foto" accept="image/jpeg,image/png" class="w-full text-[10px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[11px] file:font-bold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 cursor-pointer">
      </div>
      <p class="text-[10px] text-slate-500">Deja este campo vacío para conservar la imagen actual.</p>
      <div id="edit-p-img-preview-box" class="hidden pt-1 text-center">
        <span id="edit-p-img-preview-titulo" class="text-[10px] font-bold text-slate-400 block mb-1">Imagen actual:</span>
        <img id="edit-p-img-preview" alt="Vista previa del producto" class="w-16 h-16 object-cover rounded-xl border mx-auto shadow-sm">
      </div>
    </div>

    <p id="edit-p-error" role="alert" class="hidden text-red-600 text-xs font-semibold"></p>
    <div class="flex gap-2 pt-2">
      <button type="button" id="cerrar-edit-prod" class="w-1/2 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancelar</button>
      <button id="btn-guardar-edicion" type="submit" class="w-1/2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition">Guardar cambios</button>
    </div>
  </form>
</div>`;
        modal = contenedor.firstElementChild;
        if (!modal) throw new Error('No fue posible construir el formulario de edición.');
        document.body.appendChild(modal);
    }
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    if (!modal.dataset.huellitasConectado) {
        modal.querySelector('#form-edit-prod').addEventListener('submit', guardarEdicionProd);
        modal.querySelector('#cerrar-edit-prod').addEventListener('click', cerrarModalEditar);
        modal.addEventListener('click', event => {
            if (event.target === modal) cerrarModalEditar();
        });
        modal.querySelector('#edit-p-foto').addEventListener('change', mostrarVistaPreviaEditarProducto);
        modal.dataset.huellitasConectado = '1';
    }
    return modal;
}

function limpiarVistaPreviaTemporalEditar() {
    if (huellitasVistaPreviaEdicionUrl) {
        URL.revokeObjectURL(huellitasVistaPreviaEdicionUrl);
        huellitasVistaPreviaEdicionUrl = null;
    }
}
function mostrarVistaPreviaEditarProducto(event) {
    const imagen = document.getElementById('edit-p-img-preview');
    const contenedor = document.getElementById('edit-p-img-preview-box');
    const titulo = document.getElementById('edit-p-img-preview-titulo');
    if (!imagen || !contenedor) return;
    limpiarVistaPreviaTemporalEditar();
    const archivo = event.target.files && event.target.files[0];
    if (archivo) {
        if (!['image/jpeg','image/png'].includes(archivo.type) || archivo.size > 5 * 1024 * 1024) {
            event.target.value = '';
            const error = document.getElementById('edit-p-error');
            error.textContent = 'La imagen debe ser JPG o PNG y pesar como máximo 5 MB.';
            error.classList.remove('hidden');
            return;
        }
        huellitasVistaPreviaEdicionUrl = URL.createObjectURL(archivo);
        imagen.src = huellitasVistaPreviaEdicionUrl;
        titulo.textContent = 'Nueva imagen:';
        contenedor.classList.remove('hidden');
    } else {
        const actual = document.getElementById('edit-p-id').dataset.fotoActual;
        if (actual) {
            imagen.src = '/static/uploads/' + encodeURIComponent(actual);
            titulo.textContent = 'Imagen actual:';
            contenedor.classList.remove('hidden');
        } else {
            imagen.removeAttribute('src');
            contenedor.classList.add('hidden');
        }
    }
}

async function abrirModalEditar(id) {
    const textoId = String(id).trim().replace(/^PROD-/i, '');
    if (!/^[0-9]+$/.test(textoId)) {
        alert('El código del producto no es válido.'); return;
    }
    const numId = Number(textoId);
    if (!Number.isSafeInteger(numId) || numId <= 0) {
        alert('El código del producto no es válido.'); return;
    }
    let p = productos.find(x => Number(String(x.id).replace(/^PROD-/i, '')) === numId);
    try {
        const respuesta = await fetch('/obtener_productos', {cache:'no-store', credentials:'same-origin'});
        if (respuesta.ok) {
            const datos = await respuesta.json();
            if (datos.status === 'ok' && Array.isArray(datos.productos)) {
                productos = datos.productos;
                p = productos.find(x => Number(String(x.id).replace(/^PROD-/i, '')) === numId);
            }
        }
    } catch (error) {
        console.warn('Se usarán los datos de inventario cargados:', error);
    }
    if (!p) {
        alert('No se encontró el producto. Verifica la conexión con Flask.'); return;
    }
    let modal;
    try { modal = obtenerModalEdicionProducto(); }
    catch (error) {
        console.error('Error al abrir el editor:', error);
        alert('No se pudo abrir el editor. Revisa la consola del navegador.'); return;
    }
    const campos = {
        id: modal.querySelector('#edit-p-id'),
        nombre: modal.querySelector('#edit-p-nombre'),
        categoria: modal.querySelector('#edit-p-categoria'),
        precio: modal.querySelector('#edit-p-precio'),
        stock: modal.querySelector('#edit-p-stock'),
        descripcion: modal.querySelector('#edit-p-descripcion'),
        foto: modal.querySelector('#edit-p-foto')
    };
    if (Object.values(campos).some(x => !x)) {
        alert('El formulario de edición está incompleto. Sustituye también tienda_formularios.html.');
        return;
    }
    campos.id.value = numId;
    campos.id.dataset.fotoActual = p.foto || '';
    campos.nombre.value = p.nombre || '';
    // Si proviene de una categoría antigua, se permite conservarla sin perder información.
    const categoriaGuardada = p.categoria || 'Comida';
    if (![...campos.categoria.options].some(op => op.value === categoriaGuardada)) {
        const opcion = document.createElement('option');
        opcion.value = categoriaGuardada;
        opcion.textContent = categoriaGuardada;
        campos.categoria.appendChild(opcion);
    }
    campos.categoria.value = categoriaGuardada;
    campos.precio.value = Number(p.precio ?? 0).toFixed(2);
    campos.stock.value = String(p.stock ?? 0);
    campos.descripcion.value = p.descripcion || '';
    campos.foto.value = '';
    limpiarVistaPreviaTemporalEditar();
    mostrarVistaPreviaEditarProducto({target: campos.foto});
    const error = modal.querySelector('#edit-p-error');
    error.textContent = '';
    error.classList.add('hidden');
    modal.querySelectorAll('input').forEach(input => input.setCustomValidity(''));
    modal.classList.remove('hidden');
    campos.nombre.focus();
}

function cerrarModalEditar() {
    const modal = document.getElementById('modal-edit-prod');
    if (modal) modal.classList.add('hidden');
    limpiarVistaPreviaTemporalEditar();
}
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') cerrarModalEditar();
});

async function guardarEdicionProd(event) {
    event.preventDefault();
    const modal = document.getElementById('modal-edit-prod');
    const nombre = modal.querySelector('#edit-p-nombre').value.trim();
    const categoria = modal.querySelector('#edit-p-categoria').value;
    const precio = modal.querySelector('#edit-p-precio').value.trim();
    const stock = modal.querySelector('#edit-p-stock').value.trim();
    const descripcion = modal.querySelector('#edit-p-descripcion').value.trim();
    const foto = modal.querySelector('#edit-p-foto').files[0];
    const id = Number(modal.querySelector('#edit-p-id').value);
    const error = modal.querySelector('#edit-p-error');
    const boton = modal.querySelector('#btn-guardar-edicion');
    const fallar = mensaje => { error.textContent = mensaje; error.classList.remove('hidden'); };
    error.textContent = ''; error.classList.add('hidden');
    if (!Number.isSafeInteger(id) || id <= 0) return fallar('ID de producto inválido.');
    if (nombre.length < 2 || nombre.length > 100) return fallar('El nombre debe tener entre 2 y 100 caracteres.');
    if (!/^[0-9]{1,7}$/.test(stock) || Number(stock) > 1000000) return fallar('Stock: introduce un número entero de 0 a 1000000.');
    if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(precio)) return fallar('Precio: introduce un valor con máximo 2 decimales.');
    if (descripcion.length > 3000) return fallar('La descripción es demasiado larga.');
    if (foto && (!['image/jpeg','image/png'].includes(foto.type) || foto.size > 5 * 1024 * 1024)) return fallar('La imagen debe ser JPG o PNG de máximo 5 MB.');
    const datos = new FormData();
    datos.append('nombre', nombre);
    datos.append('categoria', categoria);
    datos.append('precio', precio);
    datos.append('stock', stock);
    datos.append('descripcion', descripcion);
    if (foto) datos.append('foto', foto);
    datos.append('csrf_token', window.HUELLITAS_ADMIN_CSRF || '');
    boton.disabled = true; boton.textContent = 'Guardando...';
    try {
        const response = await fetch(`/editar_producto/${id}`, {
            method:'POST', credentials:'same-origin',
            headers:{'X-CSRF-Token':window.HUELLITAS_ADMIN_CSRF || ''},
            body: datos
        });
        const respuesta = await response.json().catch(() => ({}));
        if (!response.ok || respuesta.status !== 'ok') {
            fallar(respuesta.message || `No se pudo actualizar el producto (HTTP ${response.status}).`);
            return;
        }
        await actualizarSoloInventario();
        cerrarModalEditar();
        if (typeof mostrarNotificacionFlotante === 'function') {
            mostrarNotificacionFlotante('Producto actualizado correctamente.', '✅');
        }
    } catch (e) {
        console.error('Error guardando el producto:',e);
        fallar('No se pudo conectar con Flask. Comprueba la conexión.');
    } finally {
        boton.disabled = false; boton.textContent = 'Guardar cambios';
    }
}

// 4. ELIMINAR PRODUCTO DE SQLITE
async function eliminarProd(id) {
    if (!confirm('¿Deseas eliminar este producto permanentemente?')) return;

    const numId = parseInt(String(id).replace(/\D/g, ''));

    try {
        const response = await fetch(`/eliminar_producto/${numId}`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': window.HUELLITAS_ADMIN_CSRF || '' }
        });

        if (response.ok) {
            productos = productos.filter(x => parseInt(String(x.id).replace(/\D/g, '')) !== numId);
            guardarDatos();
            renderizarInventario();
            mostrarNotificacionFlotante('Producto eliminado con éxito.', '✅');
        } else {
            mostrarNotificacionFlotante('No se pudo eliminar el producto.');
        }
    } catch (err) {
        console.error('Error al eliminar producto:', err);
    }
}

  // Cargar estados previos al iniciar la página
  document.addEventListener('DOMContentLoaded', () => {
      let leidos = JSON.parse(localStorage.getItem('admin_solicitudes_leidas') || '[]');
      leidos.forEach(id => {
          // Si el elemento sigue en la lista, aplicarle el estado "Leído"
          if(document.getElementById('badge_leido_' + id)) {
              marcarComoLeido(id);
          }
      });
  });
  
let posCart = [];

// 1. Renderizar productos en el panel de Caja Presencial
function renderizarPosProductos() {
    const grid = document.getElementById('pos-productos-grid');
    if (!grid) return;

    if (!productos || productos.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-center text-xs text-slate-400 py-6">No hay productos disponibles en el inventario.</p>`;
        return;
    }

    grid.innerHTML = productos.map(p => {
        const numId = parseInt(String(p.id).replace(/\D/g, ''));
        const enCarrito = posCart.find(i => i.numId === numId);
        const cantEnCart = enCarrito ? enCarrito.cantidad : 0;
        const stockDisponible = p.stock - cantEnCart;

        return `
            <div class="bg-white border rounded-2xl p-3 shadow-sm flex flex-col justify-between space-y-2 hover:border-indigo-300 transition">
                <div>
                    <span class="text-[9px] font-extrabold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">${p.categoria}</span>
                    <h4 class="font-bold text-xs text-slate-800 mt-1">${p.nombre}</h4>
                    <p class="text-[10px] ${stockDisponible > 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'} mt-0.5">
                        Stock: ${stockDisponible} disp.
                    </p>
                </div>

                <div class="flex justify-between items-center border-t pt-2">
                    <span class="font-black text-xs text-slate-800">Q${parseFloat(p.precio).toFixed(2)}</span>
                    <button onclick="agregarAlPosCart(${numId})" ${stockDisponible <= 0 ? 'disabled' : ''} class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] transition disabled:bg-slate-200 disabled:text-slate-400">
                        ${stockDisponible > 0 ? '+ Agregar' : 'Agotado'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function filtrarPosProductos() {
    const q = document.getElementById('pos-search')?.value.toLowerCase() || '';
    const cards = document.querySelectorAll('#pos-productos-grid > div');
    
    cards.forEach(card => {
        const txt = card.innerText.toLowerCase();
        card.style.display = txt.includes(q) ? 'flex' : 'none';
    });
}

// 2. Gestionar el Carrito POS Presencial
function agregarAlPosCart(numId) {
    const p = productos.find(x => parseInt(String(x.id).replace(/\D/g, '')) === numId);
    if (!p) return;

    const item = posCart.find(x => x.numId === numId);
    if (item) {
        if (item.cantidad < p.stock) {
            item.cantidad += 1;
        } else {
            mostrarNotificacionFlotante('Has alcanzado el límite de stock de este producto.');
            return;
        }
    } else {
        posCart.push({
            numId: numId,
            id: p.id,
            nombre: p.nombre,
            precio: parseFloat(p.precio),
            cantidad: 1
        });
    }

    actualizarPosCartUI();
    renderizarPosProductos();
}

function cambiarCantPosCart(numId, d) {
    const item = posCart.find(x => x.numId === numId);
    if (!item) return;

    const p = productos.find(x => parseInt(String(x.id).replace(/\D/g, '')) === numId);

    item.cantidad += d;
    if (item.cantidad > p.stock) item.cantidad = p.stock;
    if (item.cantidad <= 0) posCart = posCart.filter(x => x.numId !== numId);

    actualizarPosCartUI();
    renderizarPosProductos();
}

function actualizarPosCartUI() {
    const list = document.getElementById('pos-cart-items');
    const totalElem = document.getElementById('pos-total-monto');

    if (!list) return;

    if (posCart.length === 0) {
        list.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">No has agregado productos al cobro.</p>`;
        if (totalElem) totalElem.innerText = 'Q0.00';
        return;
    }

    let total = 0;
    list.innerHTML = posCart.map(i => {
        const sub = i.precio * i.cantidad;
        total += sub;
        return `
            <div class="flex justify-between items-center text-xs bg-white p-2 rounded-xl border">
                <div>
                    <h5 class="font-bold text-slate-800">${i.nombre}</h5>
                    <span class="text-[10px] text-slate-400">Q${i.precio.toFixed(2)} c/u</span>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="cambiarCantPosCart(${i.numId}, -1)" class="w-5 h-5 bg-slate-100 font-bold rounded flex items-center justify-center">-</button>
                    <span class="font-bold">${i.cantidad}</span>
                    <button onclick="cambiarCantPosCart(${i.numId}, 1)" class="w-5 h-5 bg-slate-100 font-bold rounded flex items-center justify-center">+</button>
                    <span class="font-bold text-indigo-700 ml-1">Q${sub.toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');

    if (totalElem) totalElem.innerText = `Q${total.toFixed(2)}`;
}

// 3. Procesar Cobro Presencial, Descontar SQLite y Generar Factura
// 1. Función para procesar el cobro e invocar la generación del PDF de la factura
async function procesarVentaDirectaPOS() {
    if (posCart.length === 0) {
        mostrarNotificacionFlotante('Debes agregar al menos un producto al cobro.');
        return;
    }

    // Validar también los campos POS (no están dentro de un <form>).
    for (const id of ['pos-cliente-nombre', 'pos-cliente-tel', 'pos-cliente-nit']) {
        const campo = document.getElementById(id);
        if (!campo || !campo.value.trim() && id === 'pos-cliente-nit') continue;
        const regla = campo?.dataset.validar;
        if (regla && window.HuellitasValidacion && !window.HuellitasValidacion.valido(campo, regla)) {
            campo.setCustomValidity(window.HuellitasValidacion.reglas[regla].mensaje);
            campo.reportValidity(); campo.focus();
            return;
        }
    }

    const nom = document.getElementById('pos-cliente-nombre')?.value.trim() || 'Cliente Presencial';
    const tel = document.getElementById('pos-cliente-tel')?.value.trim() || 'N/A';
    const nit = document.getElementById('pos-cliente-nit')?.value.trim().toUpperCase() || 'Consumidor Final';
    const metodo = document.getElementById('pos-metodo-pago')?.value || 'Efectivo';

    const subtotal = posCart.reduce((a, b) => a + (b.precio * b.cantidad), 0);

    const ordenVenta = {
        id: "PED-" + Math.floor(1000 + Math.random() * 9000),
        fecha: new Date().toLocaleDateString('es-GT'),
        nit: nit,
        clienteNombre: nom,
        clienteTel: tel,
        clienteDir: 'Venta Presencial en Refugio',
        items: JSON.parse(JSON.stringify(posCart)),
        itemsDetalle: JSON.parse(JSON.stringify(posCart)),
        subtotal: subtotal,
        envio: 0.00,
        total: subtotal,
        tipo: 'Tienda',
        metodoPago: metodo,
        estadoPago: 'PAGADO (Presencial en Caja)',
        estadoOrden: '5. Finalizar',
        stockDescontado: true,
        entregado: true
    };

    try {
        const response = await fetch('/venta_directa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.HUELLITAS_ADMIN_CSRF || '' },
            body: JSON.stringify(ordenVenta)
        });

        const data = await response.json();

        if (response.ok && data.status === 'ok') {
            if (typeof actualizarSoloInventario === 'function') {
                await actualizarSoloInventario();
            }

            historialVentas.unshift(ordenVenta);
            localStorage.setItem('huellitas_historial', JSON.stringify(historialVentas));

            if (typeof descargarFacturaAdmin === 'function') {
                descargarFacturaAdmin(ordenVenta);
            }

            posCart = [];
            actualizarPosCartUI();
            document.getElementById('pos-cliente-nombre').value = '';
            document.getElementById('pos-cliente-tel').value = '';
            document.getElementById('pos-cliente-nit').value = '';
            
            renderizarPosProductos();
            if (typeof renderizarInventario === 'function') renderizarInventario();

            mostrarNotificacionFlotante(`¡Venta ${ordenVenta.id} completada exitosamente! Factura emitida.`, '✅');
        } else {
            mostrarNotificacionFlotante(data.message || 'No se pudo procesar la venta en la base de datos.');
        }
    } catch (err) {
        console.error('Error en venta directa:', err);
        mostrarNotificacionFlotante('Error al comunicar con la caja registradora.');
    }
}

// 2. Función encargada de poblar la plantilla HTML y descargar el archivo PDF
function descargarFacturaAdmin(orden) {
    if (!orden) return alert('No se encontró información del pedido.');

    const titleEl = document.getElementById('pdf-doc-title');
    const ordIdEl = document.getElementById('pdf-ord-id');
    const dateEl = document.getElementById('pdf-date');
    const clientBox = document.getElementById('pdf-client-box');
    const statusBadge = document.getElementById('pdf-status-badge');
    const itemsBody = document.getElementById('pdf-items-body');
    const subtotalEl = document.getElementById('pdf-subtotal');
    const shippingEl = document.getElementById('pdf-shipping');
    const totalEl = document.getElementById('pdf-total');

    if (ordIdEl) ordIdEl.innerText = `#${orden.id || 'PED-0000'}`;
    if (dateEl) dateEl.innerText = `Fecha: ${orden.fecha || new Date().toLocaleDateString('es-GT')}`;

    const direccionTexto = orden.clienteDir || 'Venta Presencial en Refugio';
    const clienteNombre = orden.clienteNombre || 'Cliente Presencial';
    const clienteTel = orden.clienteTel || 'N/A';
    const metodoPago = orden.metodoPago || 'Presencial (Efectivo/POS)';
    const nitCliente = orden.nit || 'Consumidor Final';

    if (titleEl) titleEl.innerText = "FACTURA OFICIAL DE COMPRA";
    if (statusBadge) {
        statusBadge.innerText = "PAGADO / CANCELADO";
        statusBadge.style.backgroundColor = "#D1FAE5";
        statusBadge.style.color = "#065F46";
        statusBadge.style.border = "1px solid #6EE7B7";
    }

    if (clientBox) {
        clientBox.innerHTML = `
            <p style="margin:2px 0;"><strong>Cliente:</strong> ${clienteNombre}</p>
            <p style="margin:2px 0;"><strong>NIT:</strong> ${nitCliente}</p>
            <p style="margin:2px 0;"><strong>Dirección:</strong> ${direccionTexto}</p>
            <p style="margin:2px 0;"><strong>Teléfono:</strong> ${clienteTel}</p>
            <p style="margin:2px 0;"><strong>Estado de Cuenta:</strong> <span style="color:#047857; font-weight:bold;">Cuenta Pagada y Cancelada (${metodoPago})</span></p>
        `;
    }

    const items = orden.itemsDetalle || orden.items || [];
    if (itemsBody) {
        itemsBody.innerHTML = items.map(i => {
            const precio = parseFloat(i.precio || 0);
            const cant = parseInt(i.cantidad || 1);
            const sub = precio * cant;
            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 8px; font-weight: 600; color: #64748b;">${i.id || i.numId || 'PROD'}</td>
                    <td style="padding: 12px 8px; font-weight: 700; color: #0f172a;">${i.nombre}</td>
                    <td style="padding: 12px 8px; text-align: center; font-weight: 600;">${cant}</td>
                    <td style="padding: 12px 8px; text-align: right; color: #475569;">Q${precio.toFixed(2)}</td>
                    <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: #0f172a;">Q${sub.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }

    const subtotal = parseFloat(orden.subtotal || 0);
    const envio = parseFloat(orden.envio || 0);
    const total = parseFloat(orden.total || 0);

    if (subtotalEl) subtotalEl.innerText = `Q${subtotal.toFixed(2)}`;
    if (shippingEl) shippingEl.innerText = `Q${envio.toFixed(2)}`;
    if (totalEl) totalEl.innerText = `Q${total.toFixed(2)}`;

    const element = document.getElementById('pdf-template');

    const opt = {
        margin:       0,
        filename:     `Factura_${orden.id}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'pt', format: 'a4', orientation: 'portrait' }
    };

    // Generar y descargar automáticamente
    html2pdf().set(opt).from(element).save();
}

// Función para mostrar notificaciones flotantes en el panel de Admin
function mostrarNotificacionFlotante(mensaje, icono = '⚠️') {
    let toast = document.getElementById('notificacion-flotante');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'notificacion-flotante';
        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-md text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 transition-all duration-300 opacity-0 pointer-events-none flex items-center gap-2';
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `<span>${icono}</span> <span>${mensaje}</span>`;
    toast.classList.remove('opacity-0', 'pointer-events-none');
    toast.classList.add('opacity-100');

    setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0', 'pointer-events-none');
    }, 3500);
}
