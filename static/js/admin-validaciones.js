/* Huellitas — validaciones exclusivas del panel ADMINISTRADOR.
   No se carga en rescatista, veterinario, registro ni usuario.
   El servidor vuelve a validar todos los datos; HTML no es seguridad. */
(() => {
  'use strict';
  const R = {
    persona: {max:100, mensaje:'Escribe entre 2 y 100 caracteres: letras, espacios, puntos, apóstrofes o guiones.'},
    producto: {max:100, mensaje:'Nombre de producto: usa letras, números, espacios y signos - / . + ( ).'},
    codigo: {max:20, mensaje:'Código de 1 a 20 caracteres: letras, números, guion o guion bajo.'},
    correo: {max:100, mensaje:'Ingresa una dirección de correo válida.'},
    telefono: {max:20, mensaje:'Teléfono válido: de 8 a 15 dígitos; permite espacios, guiones y + al inicio.'},
    dpi: {max:13, mensaje:'El DPI debe contener exactamente 13 números.'},
    anio: {max:4, mensaje:'El año debe tener 4 números, entre 1900 y 2100. Ejemplo: 2022.'},
    edad: {max:3, mensaje:'Escribe la edad solo con números, de 0 a 120.'},
    entero: {max:7, mensaje:'Escribe un número entero de 0 a 1000000; no se aceptan letras ni negativos.'},
    decimal: {max:12, mensaje:'Escribe una cantidad entre 0 y 9999999.99, con máximo dos decimales.'},
    nit: {max:14, mensaje:'NIT: 123456-7, 123456-K o C/F.'},
    texto: {max:100, mensaje:'Este campo admite texto, pero no caracteres de control.'}
  };
  const LETRAS = /^[\p{L}]+(?:[ .'-][\p{L}]+)*$/u;
  const PRODUCTO = /^[\p{L}\p{N} .()\/+'-]+$/u;
  const TEXTO_CAMPOS = new Set(['titulo','eslogan','nombre_de','info_bancaria','sede_fisica']);
  function reglaPara(el) {
    const explicit = el.getAttribute('data-admin-regla');
    if (explicit && R[explicit]) return explicit;
    if (el.matches('[type="password"], [type="hidden"], [type="file"], [type="radio"], [type="checkbox"], [type="color"], [type="range"]')) return null;
    const campo = (el.name || el.id || '').toLowerCase().replace(/\[\]$/, '');
    if (el.type === 'email' || campo === 'correo') return 'correo';
    if (['nombre', 'nombre_completo'].includes(campo)) {
      const accion = (el.closest('form')?.getAttribute('action') || '').toLowerCase();
      return accion.includes('crear_producto') ? 'producto' : accion.includes('crear_empleado') ? 'persona' : null;
    }
    if (campo === 'pos-cliente-nombre') return 'persona';
    if (['codigo','codigo_empleado','codigo_acceso'].includes(campo)) return 'codigo';
    if (['telefono','tel','celular','pos-cliente-tel'].includes(campo)) return 'telefono';
    if (['dpi','cui'].includes(campo)) return 'dpi';
    if (['anio','año','ano','year','anio_nacimiento','anio_fabricacion'].includes(campo) || /(?:^|[_-])(?:anio|ano|year)(?:$|[_-])/.test(campo)) return 'anio';
    if (campo === 'edad') return 'edad';
    if (['stock','cantidad','existencias','edit-p-stock','logo_size','mosaic_size'].includes(campo)) return 'entero';
    if (['precio','costo','monto','importe','edit-p-precio'].includes(campo)) return 'decimal';
    if (['nit','pos-cliente-nit'].includes(campo)) return 'nit';
    if (TEXTO_CAMPOS.has(campo)) return 'texto';
    return null; // descripciones, fechas, contraseñas, HTML libre: no cortar arbitrariamente
  }
  function limpiar(v,regla) {
    switch(regla) {
      case 'persona': return [...v].filter(c => /[\p{L} .'-]/u.test(c)).join('');
      case 'producto': return [...v].filter(c => /[\p{L}\p{N} .()\/+'-]/u.test(c)).join('');
      case 'codigo': return v.toUpperCase().replace(/[^A-Z0-9_-]/g,'');
      case 'anio': case 'entero': case 'edad': case 'dpi': return v.replace(/\D/g,'');
      case 'decimal': {
        const reemplazado = v.replace(',', '.');
        const filtrado = reemplazado.replace(/[^0-9.]/g,'');
        const trozos = filtrado.split('.');
        return trozos.length===1 ? filtrado : `${trozos[0]}.${trozos.slice(1).join('').slice(0,2)}`;
      }
      case 'telefono': { const v2=v.replace(/[^0-9+ -]/g,'');return v2[0]==='+' ? '+'+v2.slice(1).replace(/\+/g,'') : v2.replace(/\+/g,''); }
      case 'nit': return v.toUpperCase().replace(/[^0-9KCF/-]/g,'');
      case 'correo': return v.replace(/\s/g,'');
      case 'texto': return v.replace(/[\u0000-\u001F\u007F]/g,'');
      default: return v;
    }
  }
  function correcto(el,regla) {
    const v=el.value.trim();
    if (!v) return !el.required;
    switch(regla) {
      case 'persona': return v.length>=2 && v.length<=100 && LETRAS.test(v);
      case 'producto': return v.length>=2 && v.length<=100 && PRODUCTO.test(v) && /[\p{L}\p{N}]/u.test(v);
      case 'codigo': return /^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(v);
      case 'correo': return v.length<=100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      case 'telefono': return /^\+?[0-9][0-9 -]{6,19}$/.test(v) && v.replace(/\D/g,'').length>=8 && v.replace(/\D/g,'').length<=15;
      case 'dpi': return /^\d{13}$/.test(v);
      case 'anio': return /^\d{4}$/.test(v) && +v>=1900 && +v<=2100;
      case 'edad': return /^\d+$/.test(v) && +v<=120;
      case 'entero': {
        const c=(el.name||el.id||'').toLowerCase();
        const min=c==='logo_size'?30:c==='mosaic_size'?50:0;
        const max=c==='logo_size'?150:c==='mosaic_size'?400:1000000;
        return /^\d+$/.test(v) && Number(v)>=min && Number(v)<=max;
      }
      case 'decimal': return /^\d+(?:\.\d{1,2})?$/.test(v) && +v<=9999999.99;
      case 'nit': return /^(?:[0-9]{1,12}-[0-9K]|C\/?F)$/i.test(v);
      case 'texto': return v.length<=((el.name==='info_bancaria'||el.name==='sede_fisica')?200:100) && !/[\u0000-\u001F\u007F]/.test(v);
      default: return true;
    }
  }
  function activar(el) {
    if (!(el instanceof HTMLInputElement) || el.dataset.adminValidado) return;
    const regla=reglaPara(el);
    if (!regla) return;
    el.dataset.adminValidado='1';
    el.dataset.adminRegla=regla;
    const maximo = (regla==='texto' && ['info_bancaria','sede_fisica'].includes((el.name||'').toLowerCase())) ? 200 : R[regla].max;
    el.maxLength=Math.min(el.maxLength>0?el.maxLength:9999,maximo);
    if (['anio','edad','dpi','entero'].includes(regla)) el.inputMode='numeric';
    if (regla==='decimal') el.inputMode='decimal';
    // type=number acepta 'e', '+', '-'; type=text + inputMode impide esa ambigüedad.
    if (el.type==='number') el.type='text';
    if (regla==='codigo') el.autocapitalize='characters';
    el.addEventListener('input',ev=>{
      if(ev.isComposing)return;
      const actualizado=limpiar(el.value,regla);
      if (actualizado!==el.value) el.value=actualizado;
      el.setCustomValidity('');
    });
    el.addEventListener('blur',()=>el.setCustomValidity(correcto(el,regla)?'':R[regla].mensaje));
  }
  function revisarFormulario(form) {
    for(const el of form.querySelectorAll('input[data-admin-validado]')){
      const regla=el.dataset.adminRegla;
      if (el.disabled || el.readOnly || !R[regla])continue;
      el.setCustomValidity(correcto(el,regla)?'':R[regla].mensaje);
    }
    return form.reportValidity();
  }
  function iniciar() {
    document.querySelectorAll('input').forEach(activar);
    const observer=new MutationObserver(changes=>{
      for(const c of changes)for(const n of c.addedNodes){
        if(n.nodeType!==1)continue;
        if(n.matches?.('input'))activar(n);
        n.querySelectorAll?.('input').forEach(activar);
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('submit',e=>{
      if(e.target instanceof HTMLFormElement && !revisarFormulario(e.target)){
        e.preventDefault();e.stopImmediatePropagation();
      }
    },true);
    window.HuellitasValidacionAdmin={revisarFormulario,reglaPara,correcto,reglas:R};
    // Compatibilidad con la validación previa de la caja presencial del admin.
    window.HuellitasValidacion = window.HuellitasValidacion || {valido:correcto, reglas:R};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);
  else iniciar();
})();
