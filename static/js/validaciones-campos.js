/* Reglas generales de Huellitas — interfaz.
   No sustituyen las validaciones de Flask en modulos/validaciones.py. */
(() => {
  'use strict';
  const hoy = new Date();
  const FECHA_MAX_NACIMIENTO = [hoy.getFullYear(), String(hoy.getMonth()+1).padStart(2,'0'), String(hoy.getDate()).padStart(2,'0')].join('-');
  const LETRA = /\p{L}/u;
  const reglas = {
    persona: { max: 100, mensaje: 'Solo letras (incluidas tildes y ñ), espacios, apóstrofes, puntos y guiones.' },
    producto: { max: 100, mensaje: 'Solo letras, números, espacios y signos normales (- / . + paréntesis).' },
    telefono: { max: 20, mensaje: 'Escribe de 8 a 15 dígitos. Puedes usar +, guion y espacios.' },
    dpi: { max: 13, mensaje: 'El DPI/CUI debe tener exactamente 13 números.' },
    anio: { max: 4, mensaje: 'Ingresa un año de cuatro dígitos entre 1900 y 2100 (ej.: 2022).' },
    edad: { max: 3, mensaje: 'La edad debe ser un número entero entre 0 y 120.' },
    entero: { max: 7, mensaje: 'Únicamente números enteros de 0 a 1000000.' },
    decimal: { max: 12, mensaje: 'Únicamente números positivos, con máximo dos decimales (ej.: 125.50).' },
    codigo: { max: 20, mensaje: 'De 1 a 20 caracteres: números, letras o ambos; también puedes usar - y _.' },
    nit: { max: 14, mensaje: 'Escribe un NIT (123456-7) o C/F.' },
    correo: { max: 100, mensaje: 'Introduce un correo electrónico válido.' },
    fecha: { max: 10, mensaje: 'Utiliza una fecha real: AAAA-MM-DD o DD/MM/AAAA.' }
  };

  function obtenerRegla(el) {
    const establecida = el.dataset.validar;
    if (establecida && reglas[establecida]) return establecida;
    if (el.type === 'password' || el.type === 'hidden' || el.type === 'file' || el.disabled || el.readOnly) return null;
    if (el.type === 'email') return 'correo';
    const campo = (el.name || el.id || '').toLowerCase().replace(/\[\]$/, '');
    if (['nombre','nombre_completo'].includes(campo)) {
      const form = el.closest('form');
      const action = (form?.getAttribute('action') || '').toLowerCase();
      if (action.includes('registro') || action.includes('actualizar_perfil') || action.includes('crear_empleado')) return 'persona';
      if (action.includes('crear_producto') || action.includes('editar_mascota')) return 'producto';
      return null;
    }
    if (['ref1_nombre','ref2_nombre','nombre_responde','pos-cliente-nombre'].includes(campo)) return 'persona';
    if (campo === 'nombre_paciente') return 'producto';
    if (['telefono','tel','celular','ref1_tel','ref2_tel','pos-cliente-tel'].includes(campo)) return 'telefono';
    if (campo === 'dpi' || campo === 'cui') return 'dpi';
    if (['anio','ano','año','year','anio_nacimiento','anio_fabricacion'].includes(campo)) return 'anio';
    if (campo === 'edad') return 'edad';
    if (['stock','cantidad','existencias','edit-p-stock','logo_size','mosaic_size'].includes(campo)) return 'entero';
    if (['precio','costo','monto','importe','edit-p-precio','temp','temperatura','peso'].includes(campo)) return 'decimal';
    if (['codigo_empleado','codigo_acceso'].includes(campo)) return 'codigo';
    if (campo === 'codigo' && (el.closest('form')?.getAttribute('action') || '').includes('crear_empleado')) return 'codigo';
    if (['nit','pos-cliente-nit'].includes(campo)) return 'nit';
    if (campo === 'fecha_nacimiento') return 'fecha';
    return null;
  }

  function limpiar(valor, regla) {
    if (regla === 'persona') return Array.from(valor).filter(c => LETRA.test(c) || /[\s'.-]/.test(c)).join('');
    if (regla === 'producto') return Array.from(valor).filter(c => /[\p{L}\p{N} .()\/+'-]/u.test(c)).join('');
    if (regla === 'dpi' || regla === 'entero' || regla === 'anio' || regla === 'edad') return valor.replace(/\D/g, '');
    if (regla === 'decimal') {
      const original = valor.replace(',', '.').replace(/[^0-9.]/g, '');
      const [enteros, ...resto] = original.split('.');
      return resto.length ? enteros + '.' + resto.join('').slice(0,2) : enteros;
    }
    if (regla === 'telefono') {
      const filtrado = valor.replace(/[^0-9 +\-]/g, '');
      return filtrado.startsWith('+') ? '+' + filtrado.slice(1).replace(/\+/g, '') : filtrado.replace(/\+/g, '');
    }
    if (regla === 'codigo') return valor.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (regla === 'nit') return valor.toUpperCase().replace(/[^0-9A-Z/\-]/g, '');
    if (regla === 'correo') return valor.replace(/\s/g, '');
    if (regla === 'fecha') return valor.replace(/[^0-9/\-]/g, '');
    return valor;
  }

  function valido(el, regla) {
    const v = el.value.trim();
    if (!v) return !el.required;
    if (regla === 'persona') return v.length >= 2 && v.length <= 100 && /^[\p{L}]+(?:[ .'-][\p{L}]+)*$/u.test(v);
    if (regla === 'producto') return v.length >= 2 && v.length <= 100 && /[\p{L}\p{N}]/u.test(v) && /^[\p{L}\p{N} .()\/+'-]+$/u.test(v);
    if (regla === 'telefono') return /^\+?[0-9][0-9 \-]{6,19}$/.test(v) && /^\d{8,15}$/.test(v.replace(/\D/g,''));
    if (regla === 'dpi') return /^\d{13}$/.test(v);
    if (regla === 'anio') return /^\d{4}$/.test(v) && +v >= 1900 && +v <= 2100;
    if (regla === 'edad') return /^\d+$/.test(v) && +v <= 120;
    if (regla === 'entero') {
      const campo = (el.name || el.id).toLowerCase();
      const min = campo === 'logo_size' ? 30 : campo === 'mosaic_size' ? 50 : 0;
      const max = campo === 'logo_size' ? 150 : campo === 'mosaic_size' ? 400 : 1000000;
      return /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max;
    }
    if (regla === 'decimal') {
      const campo = (el.name || el.id).toLowerCase();
      const max = ['temp','temperatura'].includes(campo) ? 60 : campo === 'peso' ? 10000 : 9999999.99;
      return /^\d+(?:\.\d{1,2})?$/.test(v) && Number(v) <= max;
    }
    if (regla === 'codigo') return /^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(v);
    if (regla === 'nit') return /^(?:[0-9]{1,12}-[0-9K]|C\/?F)$/i.test(v);
    if (regla === 'correo') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 100;
    if (regla === 'fecha') {
      let a, m, d;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) [a,m,d] = v.split('-').map(Number);
      else if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) [d,m,a] = v.split('/').map(Number);
      else return false;
      const f = new Date(Date.UTC(a,m-1,d));
      return a >= 1900 && a <= 2100 && f.getUTCFullYear() === a && f.getUTCMonth() === m-1 && f.getUTCDate() === d &&
        (el.name !== 'fecha_nacimiento' || f.getTime() <= Date.now());
    }
    return true;
  }

  function preparar(el) {
    if (!(el instanceof HTMLInputElement) || el.dataset.validadorInstalado) return;
    const regla = obtenerRegla(el);
    if (!regla) return;
    el.dataset.validadorInstalado = '1';
    el.dataset.validar = regla;
    if (reglas[regla].max && (el.maxLength < 0 || el.maxLength > reglas[regla].max)) el.maxLength = reglas[regla].max;
    if (['dpi','anio','edad','entero','telefono'].includes(regla)) el.setAttribute('inputmode','numeric');
    if (regla === 'decimal') el.setAttribute('inputmode','decimal');
    if (regla === 'correo' && !el.autocomplete) el.autocomplete = 'email';
    if (regla === 'fecha' && (el.type === 'date' || el.type === 'datetime-local')) {
      el.min = '1900-01-01' + (el.type === 'datetime-local' ? 'T00:00' : '');
      el.max = (el.name === 'fecha_nacimiento' ? FECHA_MAX_NACIMIENTO : '2100-12-31') + (el.type === 'datetime-local' ? 'T23:59' : '');
      el.addEventListener('change', () => { el.setCustomValidity(''); });
      return;
    }
    // type=number permite la "e" exponencial; pasar a text la evita.
    if (el.type === 'number') el.type = 'text';
    el.title = reglas[regla].mensaje;
    el.addEventListener('input', evt => {
      if (evt.isComposing) return;
      if (['entero','decimal','edad','anio','dpi'].includes(regla) && /^\s*-/.test(el.value)) {
        el.value = '';
        el.setCustomValidity('No se permiten valores negativos.');
        return;
      }
      const value = limpiar(el.value, regla).slice(0, el.maxLength > 0 ? el.maxLength : 10000);
      if (el.value !== value) el.value = value;
      el.setCustomValidity('');
    });
    el.addEventListener('blur', () => {
      el.setCustomValidity(valido(el, regla) ? '' : reglas[regla].mensaje);
    });
  }

  function comprobarFormulario(form) {
    for (const el of form.querySelectorAll('input[data-validar]')) {
      const regla = el.dataset.validar;
      if (!reglas[regla] || el.disabled || el.readOnly) continue;
      if (regla === 'fecha' && ['date', 'datetime-local'].includes(el.type)) continue;
      el.setCustomValidity(valido(el, regla) ? '' : reglas[regla].mensaje);
    }
    if (!form.reportValidity()) return false;
    return true;
  }

  function iniciar() {
    document.querySelectorAll('input').forEach(preparar);
    // Si otro script crea inputs con JS, también se les aplican las reglas.
    const observer = new MutationObserver(cambios => cambios.forEach(cambio => cambio.addedNodes.forEach(nodo => {
      if (nodo.nodeType !== 1) return;
      if (nodo.matches?.('input')) preparar(nodo);
      nodo.querySelectorAll?.('input').forEach(preparar);
    })));
    observer.observe(document.documentElement, {childList:true, subtree:true});
    document.addEventListener('submit', e => {
      const form = e.target;
      if (form instanceof HTMLFormElement && !comprobarFormulario(form)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
  }

  window.HuellitasValidacion = { preparar, comprobarFormulario, valido, reglas };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
