  function switchMainTab(tabName) {
      document.querySelectorAll('.tab-btn-main').forEach(btn => {
          if (btn.dataset.tab === tabName) {
              btn.classList.add('active', 'border-indigo-600', 'text-indigo-600', 'font-bold');
              btn.classList.remove('border-transparent', 'text-slate-500');
          } else {
              btn.classList.remove('active', 'border-indigo-600', 'text-indigo-600', 'font-bold');
              btn.classList.add('border-transparent', 'text-slate-500');
          }
      });

      document.querySelectorAll('.tab-content-main').forEach(content => {
          content.classList.add('hidden');
      });

      const target = document.getElementById(`admin-${tabName}`);
      if (target) {
          target.classList.remove('hidden');
      }

      if (tabName === 'shop') {
          // Por defecto al entrar a la tienda activa 'pedidos' si no hay otra seleccionada
          const activeSubTab = document.querySelector('.tab-btn-shop.bg-white');
          const subName = activeSubTab ? activeSubTab.dataset.subtab : 'pedidos';
          switchShopSubTab(subName);
      }
  }

  // Cambiador de Sub-Pestañas dentro de la Tienda (Shop)
  // Cambiador de Sub-Pestañas dentro de la Tienda (Shop)
function switchShopSubTab(subTabName) {
    document.querySelectorAll('.tab-btn-shop').forEach(btn => {
        if (btn.dataset.subtab === subTabName) {
            btn.classList.add('bg-white', 'text-indigo-700', 'shadow-sm', 'font-bold');
            btn.classList.remove('text-slate-600', 'hover:bg-slate-200/60');
        } else {
            btn.classList.remove('bg-white', 'text-indigo-700', 'shadow-sm', 'font-bold');
            btn.classList.add('text-slate-600', 'hover:bg-slate-200/60');
        }
    });

    document.querySelectorAll('.tab-content-shop').forEach(content => {
        content.classList.add('hidden');
    });

    const target = document.getElementById(`shop-${subTabName}`);
    if (target) {
        target.classList.remove('hidden');
    }

    if (subTabName === 'cobro') {
        renderizarPosProductos();
        actualizarPosCartUI();
    }
    if (subTabName === 'metricas') renderizarMetricasYReporte();
}
