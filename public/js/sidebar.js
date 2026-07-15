(function() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const toggleBtn = document.getElementById('sidebarToggle');
  const mobileToggle = document.getElementById('mobileSidebarToggle');
  const overlay = document.getElementById('sidebarOverlay');

  const isMobile = () => window.innerWidth < 768;

  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (!isMobile() && isCollapsed) {
    sidebar.classList.add('collapsed');
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      if (isMobile()) return;
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });
  }

  if (mobileToggle) {
    mobileToggle.addEventListener('click', function() {
      sidebar.classList.toggle('show');
      if (overlay) overlay.classList.toggle('show');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', function() {
      sidebar.classList.remove('show');
      overlay.classList.remove('show');
    });
  }

  window.addEventListener('resize', function() {
    if (!isMobile()) {
      sidebar.classList.remove('show');
      if (overlay) overlay.classList.remove('show');
      const wasCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
      sidebar.classList.toggle('collapsed', wasCollapsed);
    } else {
      sidebar.classList.remove('collapsed');
    }
  });
})();
