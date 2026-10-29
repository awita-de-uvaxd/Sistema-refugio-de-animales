function switchMainTab(nombre){
 document.querySelectorAll('.tab-btn-main').forEach(b=>{let x=b.dataset.tab===nombre;b.classList.toggle('border-indigo-600',x);b.classList.toggle('text-indigo-600',x);b.classList.toggle('font-bold',x);b.classList.toggle('text-slate-500',!x);b.classList.toggle('border-transparent',!x)});
 document.querySelectorAll('.tab-content-main').forEach(e=>e.classList.add('hidden'));
 document.getElementById('admin-'+nombre)?.classList.remove('hidden');
 if(nombre==='shop')switchShopSubTab(window.shopSubtab||'pedidos');
}
function switchShopSubTab(nombre){
 if(!['pedidos','inventario','cobro','metricas'].includes(nombre))nombre='pedidos';window.shopSubtab=nombre;
 document.querySelectorAll('.tab-btn-shop').forEach(b=>{const a=b.dataset.subtab===nombre;b.classList.toggle('bg-indigo-600',a);b.classList.toggle('text-white',a);b.classList.toggle('text-slate-600',!a)});
 document.querySelectorAll('.tab-content-shop').forEach(e=>e.classList.add('hidden'));
 document.getElementById('shop-'+nombre)?.classList.remove('hidden');
}
