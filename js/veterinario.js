 /*Huellitas de Amor | Modulo de Veterinario 
 *Funciones de interaccion de la interfaz veterinario.html
 *Los datos que dependen de Flask se reciben desde el veterinario.html
 */
 
 let sintomas = [];

   // Aviso con el diseño del sistema (reemplaza a alert). tipo: 'error' | 'info'
  function mostrarAviso(titulo, mensaje, tipo = 'error') {
    const color = tipo === 'error'
      ? { fondo: 'bg-amber-50', icono: 'text-amber-500', nombre: 'alert-triangle' }
      : { fondo: 'bg-indigo-50', icono: 'text-indigo-500', nombre: 'info' };

    openModal(`
      <div class="text-center p-4 max-w-md mx-auto">
        <div class="w-20 h-20 ${color.fondo} rounded-full flex items-center justify-center mx-auto mb-4">
          <i data-lucide="${color.nombre}" class="w-10 h-10 ${color.icono}"></i>
        </div>
        <h2 class="text-2xl font-black text-indigo-950 mb-2">${titulo}</h2>
        <p class="text-sm text-slate-500 mb-8 leading-relaxed">${mensaje}</p>
        <button type="button" onclick="closeModal()" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition">Entendido</button>
      </div>
    `);
    lucide.createIcons();
  }


  let vacunas = [];
  const MAX_VACUNAS = 2;   // la vacuna múltiple (Séxtuple) cuenta como UNA
  const MAX_DIAS_PERSONALIZADO = 365;

  function addVacuna() {
    const nombre = document.getElementById('input-vacuna').value.trim();
    let freq = document.getElementById('select-frecuencia').value;
    if (!nombre) return;

        if (vacunas.length >= MAX_VACUNAS) {
      mostrarAviso('Límite de vacunas alcanzado',
        'Solo puedes aplicar <b>' + MAX_VACUNAS + ' vacunas</b> por consulta. La vacuna múltiple (Séxtuple) cuenta como una sola.');
      return;
    }
    if (vacunas.some(v => v.nombre.toLowerCase() === nombre.toLowerCase())) {
      mostrarAviso('Vacuna repetida', 'La vacuna <b>' + nombre + '</b> ya está en esta consulta.');
      return;
    }
    if (nombre.length > 40) {
      mostrarAviso('Nombre demasiado largo', 'El nombre de la vacuna no puede pasar de 40 caracteres.');
      return;
    }
    if (!/^[\p{L}\p{N} \-]+$/u.test(nombre)) {
      mostrarAviso('Caracteres no permitidos', 'Usa solo letras, números, espacios y guiones en el nombre de la vacuna.');
      return;
    }

    if (freq === 'Personalizado') {
      const dias = parseInt(document.getElementById('input-personalizado-dias').value, 10);
            if (!dias || dias < 1 || dias > MAX_DIAS_PERSONALIZADO) {
        mostrarAviso('Días no válidos', 'Los días personalizados deben ser de <b>1 a ' + MAX_DIAS_PERSONALIZADO + '</b>.');
        return;
      }
      freq = 'Cada ' + dias + ' días';
    }

    vacunas.push({ nombre: nombre, frecuencia: freq, fecha: fechaHoy });
    document.getElementById('input-vacuna').value = '';
    document.getElementById('input-personalizado-dias').value = '';
    renderVacunas();
  }
  
  function removeVacuna(index) { vacunas.splice(index, 1); renderVacunas(); }
  
  function renderVacunas() {
    document.getElementById('lista-vacunas').innerHTML = vacunas.map((v, i) => `<div class="flex justify-between items-center bg-white border border-emerald-100 p-3 rounded-lg text-sm shadow-sm"><div class="flex items-center gap-2"><i data-lucide="syringe" class="w-4 h-4 text-emerald-600"></i><span class="font-bold text-emerald-800">` + v.nombre + `</span><span class="text-xs text-slate-500 ml-2">Freq: ` + v.frecuencia + `</span></div><div class="flex gap-3 items-center"><span class="text-xs font-mono bg-slate-100 px-2 py-1 rounded">Aplicación: ` + v.fecha + `</span><button type="button" onclick="removeVacuna(` + i + `)" class="text-red-500 hover:bg-red-50 p-1 rounded"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>`).join('');
    lucide.createIcons();
  }
  let evidenciaFiles = new DataTransfer(); 
  
  const fechaHoy = document.getElementById('veterinario-config').dataset.fechaHoy;

  // --- VISOR DE FOTO PERFIL ---
  function previewImage(event, imgId, containerId) {
    const img = document.getElementById(imgId);
    const container = document.getElementById(containerId);
    if(event.target.files.length > 0){
      img.src = URL.createObjectURL(event.target.files[0]);
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
    }
  }

  // --- CONTROL DE FOTOS MULTIPLES DE EVIDENCIA CON BORRADO ---
  function handleEvidencia(event) {
    for (let i = 0; i < event.target.files.length; i++) {
      evidenciaFiles.items.add(event.target.files[i]);
    }
    actualizarInputEvidencia();
  }

  function removeEvidencia(index) {
    let dt = new DataTransfer();
    for (let i = 0; i < evidenciaFiles.files.length; i++) {
      if (i !== index) dt.items.add(evidenciaFiles.files[i]);
    }
    evidenciaFiles = dt;
    actualizarInputEvidencia();
  }

  function actualizarInputEvidencia() {
    const input = document.getElementById('input-evidencia');
    input.files = evidenciaFiles.files; 
    
    const container = document.getElementById('preview-evidencia-container');
    container.innerHTML = '';
    
    Array.from(evidenciaFiles.files).forEach((file, index) => {
      const url = URL.createObjectURL(file);
      container.innerHTML += `
        <div class="relative w-24 h-24 flex-shrink-0 border-2 border-indigo-100 rounded-xl shadow-sm group">
          <img src="` + url + `" class="w-full h-full object-cover rounded-lg">
          <button type="button" onclick="removeEvidencia(` + index + `)" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-lg hover:bg-red-600 z-10">
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
        </div>
      `;
    });
    lucide.createIcons();
  }
  // Dibuja las miniaturas con su X. Funciona igual que renderSintomas().
  function renderEvidencia(containerId) {
    document.getElementById(containerId).innerHTML = Array.from(evidenciaDT.files).map((f, i) => `
      <div class="relative w-20 h-20 flex-shrink-0 border-2 border-indigo-100 rounded-lg overflow-hidden shadow-sm">
        <img src="${URL.createObjectURL(f)}" class="w-full h-full object-cover">
        <button type="button" onclick="removeEvidencia(${i}, '${containerId}')" class="absolute top-1 right-1 bg-indigo-100 text-indigo-800 rounded-full p-1 shadow-sm hover:bg-red-100 hover:text-red-500">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
      </div>`).join('');
    lucide.createIcons();
  }
//-------------------------------------------------------------------------------------

  // --- SÍNTOMAS ---
  function addSintoma() {
    const input = document.getElementById('input-sintoma');
    const valor = input.value.trim();
    if(valor && !sintomas.includes(valor)) {
      sintomas.push(valor);
      input.value = '';
      renderSintomas();
    }
  }
  
  function removeSintoma(index) { sintomas.splice(index, 1); renderSintomas(); }
  
  function renderSintomas() {
    setTimeout(actualizarBotonGuardar, 0);
    document.getElementById('contenedor-sintomas').innerHTML = sintomas.map((s, i) => `<span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">` + s + ` <i data-lucide="x" class="w-3 h-3 cursor-pointer hover:text-red-500" onclick="removeSintoma(` + i + `)"></i></span>`).join('');
    lucide.createIcons();
  }

  // --- VACUNAS Y FRECUENCIAS PERSONALIZADAS ---
  function togglePersonalizado() {
      const val = document.getElementById('select-frecuencia').value;
      const caja = document.getElementById('caja-personalizado');
      if(val === 'Personalizado') caja.classList.remove('hidden');
      else caja.classList.add('hidden');
  }

  

    // --- REFUERZO CON CONFIRMACIÓN (ventana del sistema: Aceptar / Cancelar) ---
  let refuerzoPendiente = null;

  function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  function confirmarRefuerzo(boton) {
    refuerzoPendiente = { nombre: boton.dataset.nombre, frecuencia: boton.dataset.frecuencia, boton: boton };
    openModal(`
      <div class="text-center p-4 max-w-md mx-auto">
        <div class="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <i data-lucide="syringe" class="w-10 h-10 text-indigo-500"></i>
        </div>
        <h2 class="text-2xl font-black text-indigo-950 mb-2">¿Aplicar refuerzo?</h2>
        <p class="text-sm text-slate-500 mb-8 leading-relaxed">Se agregará un refuerzo de <b>` + escaparHtml(refuerzoPendiente.nombre) + `</b> (` + escaparHtml(refuerzoPendiente.frecuencia) + `) a esta consulta con la fecha de hoy.</p>
        <div class="flex gap-4">
          <button type="button" onclick="cancelarRefuerzo()" class="w-1/2 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition">Cancelar</button>
          <button type="button" onclick="aceptarRefuerzo()" class="w-1/2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition">Aceptar</button>
        </div>
      </div>
    `);
    lucide.createIcons();
  }

  function cancelarRefuerzo() {
    refuerzoPendiente = null;
    closeModal();
  }

  function aceptarRefuerzo() {
    if (!refuerzoPendiente) return;
    const r = refuerzoPendiente;
    refuerzoPendiente = null;
    closeModal();
    aplicarRefuerzo(r.nombre, r.frecuencia);

    // Si entró a la consulta, el botón queda marcado para no repetirlo
    if (vacunas.some(v => v.nombre.toLowerCase() === r.nombre.toLowerCase())) {
      r.boton.disabled = true;
      r.boton.className = 'flex-shrink-0 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-2 rounded-lg border border-emerald-200 flex items-center gap-1 cursor-default';
      r.boton.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i> Refuerzo agregado';
      lucide.createIcons();
    }
  }

  
  function aplicarRefuerzo(nombre, frecuencia) {
    document.getElementById('input-vacuna').value = nombre;
    
    const select = document.getElementById('select-frecuencia');
    const options = Array.from(select.options).map(o => o.value);
    
    if (options.includes(frecuencia)) {
        select.value = frecuencia;
        togglePersonalizado(); 
    } else if (frecuencia.includes("Cada") && frecuencia.includes("días")) {
        select.value = 'Personalizado';
        togglePersonalizado();
        document.getElementById('input-personalizado-dias').value = frecuencia.replace(/[^0-9]/g, '');
    }
    
    addVacuna();
  }

  
  // --- BLOQUEO DEL BOTÓN "GUARDAR EXPEDIENTE" HASTA QUE TODO ESTÉ COMPLETO Y CORRECTO ---
  const CAMPOS_AUXILIARES = ['input-sintoma', 'input-vacuna', 'input-personalizado-dias'];

  // Devuelve la lista de lo que falta o está mal (vacía = se puede guardar)
  function camposFaltantes() {
    const faltan = [];
    document.querySelectorAll('#form-consulta-vet [data-regla]').forEach(campo => {
      if (campo.readOnly || CAMPOS_AUXILIARES.includes(campo.id)) return;
      if (revisarCampo(campo)) faltan.push((campo.dataset.etiqueta || 'Un campo').replace(/^(El|La|Los|Las) /, ''));
    });
    if (sintomas.length === 0 && !document.getElementById('input-sintoma').value.trim()) faltan.push('Síntomas');
    return faltan;
  }

  function actualizarBotonGuardar() {
    const boton = document.getElementById('btn-guardar-expediente');
    const msg = document.getElementById('msg-guardar');
    if (!boton) return;
    const faltan = camposFaltantes();
    boton.disabled = faltan.length > 0;
    msg.textContent = faltan.length ? 'Falta completar o corregir: ' + faltan.join(', ') + '.' : '';
  }
  document.addEventListener('input', (e) => { if (e.target.closest && e.target.closest('#form-consulta-vet')) actualizarBotonGuardar(); });
  window.addEventListener('DOMContentLoaded', actualizarBotonGuardar);



  // --- BLOQUEO Y AUTO-GUARDADO DEL FORMULARIO ---
  function prepararEnvio() {
    const s = document.getElementById('input-sintoma').value.trim();
    if (s && !sintomas.includes(s)) sintomas.push(s);
    
    const v = document.getElementById('input-vacuna').value.trim();
    if (v) {
        let freq = document.getElementById('select-frecuencia').value;
        if (freq === 'Personalizado') {
            const dias = document.getElementById('input-personalizado-dias').value;
            freq = 'Cada ' + (dias || 0) + ' días';
        }
        vacunas.push({ nombre: v, frecuencia: freq, fecha: fechaHoy });
    }

    document.getElementById('sintomas-hidden').value = sintomas.join(', ');
    document.getElementById('vacunas-hidden').value = JSON.stringify(vacunas);
  }

  function validarYEnviarConsulta() {
      const tipo = document.getElementById('form-tipo-ingreso').value;
      const isNew = document.getElementById('form-paciente-id').value === '';
      const codeGenerado = document.getElementById('hidden-codigo-acceso').value;

      prepararEnvio(); 

      if (tipo === 'Externo' && isNew && !codeGenerado) {
          
          const code = 'EXT-' + Math.floor(1000 + Math.random() * 9000);
          const pin = Math.floor(1000 + Math.random() * 9000).toString();

          document.getElementById('select-adopcion').value = "Mascota Externa";

          openModal(`
              <div class="text-center p-4">
                  <i data-lucide="shield-check" class="w-16 h-16 text-emerald-500 mx-auto mb-4"></i>
                  <h2 class="text-2xl font-black text-slate-800 mb-2">Credenciales Generadas</h2>
                  <p class="text-sm text-slate-500 mb-6">Entrega estas credenciales al dueño para que pueda vincular su mascota desde su perfil en la plataforma.</p>
                  <div class="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-8 space-y-4">
                      <div>
                          <p class="text-xs text-slate-400 font-bold uppercase tracking-widest">Código de Paciente</p>
                          <p class="text-3xl font-mono font-black text-indigo-900 tracking-wider">` + code + `</p>
                      </div>
                      <div class="border-t border-slate-200 pt-4">
                          <p class="text-xs text-slate-400 font-bold uppercase tracking-widest">Contraseña Temporal</p>
                          <p class="text-3xl font-mono font-black text-indigo-900 tracking-wider">` + pin + `</p>
                      </div>
                  </div>
                  <div class="flex gap-4">
                      <button type="button" onclick="closeModal();" class="w-1/2 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition">Cancelar</button>
                      <button type="button" onclick="document.getElementById('hidden-codigo-acceso').value='` + code + `'; document.getElementById('hidden-password-acceso').value='` + pin + `'; document.getElementById('form-consulta-vet').submit();" class="w-1/2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition">Confirmar y Generar Expediente</button>
                  </div>
              </div>
          `);
          lucide.createIcons();
      } else {
          document.getElementById('form-consulta-vet').submit();
      }
  }

  function aplicarRuta(tipo) {
    document.getElementById('form-tipo-ingreso').value = tipo;
    document.getElementById('selector-ruta').value = tipo; 
    const cajaAdopcion = document.getElementById('caja-adopcion');
    const subtitulo = document.getElementById('subtitulo-consulta');
    const selectAdopcion = document.getElementById('select-adopcion');
    
    if(tipo === 'Rescate') {
      subtitulo.textContent = "Expediente de animal rescatado (Propiedad del refugio).";
      cajaAdopcion.classList.remove('hidden'); 
      selectAdopcion.value = 'En Observación';
    } else if (tipo === 'Seguimiento') {
      subtitulo.textContent = "Actualizando datos y dosis de una ficha existente.";
      cajaAdopcion.classList.remove('hidden'); 
    } else {
      subtitulo.textContent = "Creando expediente en blanco para nuevo ingreso (Con dueño).";
      cajaAdopcion.classList.add('hidden');
      selectAdopcion.value = 'Mascota Externa';
    }
  }

  function prepararConsulta(tipo, rescateId, especie, sexo, pacienteId = null, pacienteNombre = null, citaId = null, adopcionStatus = 'En Observación', fotoPerfil = '') {
    switchTab('veterinario', 'nueva');
    aplicarRuta(tipo);
    
    document.getElementById('form-rescate-id').value = '';
    document.getElementById('form-paciente-id').value = '';
    document.getElementById('form-cita-id').value = '';
    
    sintomas = [];
    vacunas = [];
    evidenciaFiles = new DataTransfer();
    actualizarInputEvidencia();
    renderSintomas();
    renderVacunas();
    
    const contenedorPrevias = document.getElementById('historial-vacunas-previas');
    contenedorPrevias.innerHTML = '';
    
    const fotoContainer = document.getElementById('preview-perfil-container');
    const fotoImg = document.getElementById('preview-perfil');
    if (fotoPerfil && fotoPerfil.trim() !== '' && fotoPerfil !== 'None') {
      fotoImg.src = window.VETERINARIO_CONFIG.uploadsUrl + fotoPerfil;fotoContainer.classList.remove('hidden');
    } else {
        fotoContainer.classList.add('hidden');
        fotoImg.src = '';
    }
    
    if(tipo === 'Rescate') {
      document.getElementById('lbl-id').textContent = rescateId;
      document.getElementById('form-rescate-id').value = rescateId;
      document.getElementById('form-nombre').value = "Rescatado #" + rescateId;
      document.getElementById('form-nombre').readOnly = false;
      document.getElementById('form-especie').readOnly = false;
      document.getElementById('select-adopcion').value = 'En Observación';
    } else if (tipo === 'Seguimiento') {
      document.getElementById('lbl-id').textContent = pacienteId;
      document.getElementById('form-paciente-id').value = pacienteId;
      document.getElementById('form-nombre').value = pacienteNombre;
      document.getElementById('form-nombre').readOnly = true; 
      document.getElementById('form-especie').readOnly = true;
      document.getElementById('select-adopcion').value = adopcionStatus;
      if (citaId) document.getElementById('form-cita-id').value = citaId; 
      
      const previas = document.getElementById('vacunas-previas-' + pacienteId);
      if (previas && previas.innerHTML.trim() !== '') {
        contenedorPrevias.innerHTML = '<div class="bg-slate-100 p-4 rounded-xl border border-slate-200 mb-4"><h5 class="text-xs font-black text-slate-500 mb-3 uppercase flex items-center gap-2"><i data-lucide="history" class="w-4 h-4"></i> Dosis Aplicadas Anteriormente</h5>' + previas.innerHTML + '</div>';
        lucide.createIcons();
      }
    }
    document.getElementById('form-especie').value = especie;
    document.getElementById('form-sexo').value = sexo;
    actualizarBotonGuardar();
  }

  function buscarPacientes() {
    const input = document.getElementById('buscador-paciente').value.toLowerCase();
    const cards = document.querySelectorAll('.paciente-card');
    cards.forEach(card => {
      const texto = card.querySelector('.paciente-nombre').innerText.toLowerCase();
      card.style.display = texto.includes(input) ? '' : 'none';
    });
  }

  function filtrarCitas() {
    const filtro = document.getElementById('filtro-citas').value;
    const items = document.querySelectorAll('.cita-item');
    const hoy = new Date(fechaHoy);
      items.forEach(item => {
      const fechaCita = new Date(item.getAttribute('data-fecha'));
      const diffTime = fechaCita - hoy;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      let mostrar = false;
      if (filtro === 'todas') mostrar = true;
      else if (filtro === 'hoy' && diffDays === 0) mostrar = true;
      else if (filtro === 'semana' && diffDays >= 0 && diffDays <= 7) mostrar = true;
      else if (filtro === 'quincena' && diffDays >= 0 && diffDays <= 14) mostrar = true;
      else if (filtro === 'mes' && diffDays >= 0 && diffDays <= 30) mostrar = true;
      item.style.display = mostrar ? 'flex' : 'none';
    });
  }
  window.addEventListener('DOMContentLoaded', filtrarCitas);

  function abrirExpediente(pacienteId) {
    const contenidoHTML = document.getElementById('historial-paciente-' + pacienteId).innerHTML;
    openModal(contenidoHTML);
    lucide.createIcons();
  }

  function abrirAgendarCita(pacienteId, pacienteNombre) {
    openModal(`
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-indigo-900 flex items-center gap-2"><i data-lucide="calendar-plus"></i> Agendar Cita (Paciente #${pacienteId})</h2>
      </div>
      <form action="${window.VETERINARIO_CONFIG.crearCitaUrl}" method="POST" class="space-y-4">
        <input type="hidden" name="paciente_id" value="${pacienteId}">
        <div><label class="block text-sm font-bold mb-1 text-slate-800">Fecha de la cita</label><input type="date" name="fecha" required class="w-full border rounded-lg p-3 outline-none text-slate-600 bg-slate-50"></div>
        <div><label class="block text-sm font-bold mb-1 text-slate-800">Motivo de la visita</label><input type="text" name="motivo" required placeholder="Ej. Retiro de puntos..." class="w-full border rounded-lg p-3 outline-none"></div>
        <button type="submit" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl shadow-md transition mt-4">Confirmar y Programar Cita</button>
      </form>
    `);
    lucide.createIcons();
  }