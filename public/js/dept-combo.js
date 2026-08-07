(function () {
  // ── Sidebar department filter (super admin dropdown) ──
  function initSidebarDeptFilter() {
    var input = document.getElementById('deptFilterInput');
    if (!input) return;
    var menu = input.closest('.dropdown-menu');
    if (!menu) return;
    var drop = input.closest('.dropdown');
    var toggle = drop ? drop.querySelector('[data-bs-toggle="dropdown"]') : null;
    var items = Array.prototype.slice.call(menu.querySelectorAll('.dept-item'));
    var noMatch = menu.querySelector('.dept-no-match');

    function apply() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (li) {
        var a = li.querySelector('a');
        var text = (a ? a.textContent : (li.textContent || '')).toLowerCase();
        var match = !q || text.indexOf(q) !== -1;
        li.classList.toggle('d-none', !match);
        if (match) shown++;
      });
      if (noMatch) noMatch.classList.toggle('d-none', q.length === 0 || shown > 0);
    }

    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var visible = items.filter(function (li) { return !li.classList.contains('d-none'); });
        var a = visible.length > 0 ? visible[0].querySelector('a') : null;
        if (a) {
          e.preventDefault();
          window.location.href = a.getAttribute('href');
        }
      }
    });

    if (toggle) {
      toggle.addEventListener('shown.bs.dropdown', function () {
        input.value = '';
        apply();
        input.focus();
      });
    }
  }

  // ── Transfer department combobox (type to filter) ──
  function initDeptCombo() {
    var select = document.getElementById('toDept');
    var optScript = document.getElementById('toDeptOptions');
    if (!select || !optScript) return;
    var input = document.getElementById('toDeptInput');
    var list = document.getElementById('toDeptList');
    if (!input || !list) return;

    var options = [];
    try { options = JSON.parse(optScript.textContent || '[]') || []; } catch (e) { options = []; }
    var noMatchMsg = input.getAttribute('data-no-match') || '';

    function selectValue(name) {
      select.value = name;
      input.value = name;
      list.classList.add('d-none');
    }

    function render(filter) {
      var q = (filter || '').trim().toLowerCase();
      var matches = q ? options.filter(function (n) { return n.toLowerCase().indexOf(q) !== -1; }) : options;
      list.innerHTML = '';
      if (matches.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'list-group-item small text-muted';
        empty.textContent = noMatchMsg;
        list.appendChild(empty);
      } else {
        matches.forEach(function (n) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'list-group-item list-group-item-action small text-start';
          btn.textContent = n;
          btn.addEventListener('click', function () { selectValue(n); });
          list.appendChild(btn);
        });
      }
      list.classList.remove('d-none');
    }

    input.addEventListener('focus', function () { render(input.value); });
    input.addEventListener('input', function () {
      if (!input.value.trim()) select.value = '';
      render(input.value);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { list.classList.add('d-none'); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var btns = list.querySelectorAll('.list-group-item');
        if (btns.length === 0) return;
        var idx = -1;
        var active = list.querySelector('.list-group-item.active');
        if (active) idx = Array.prototype.indexOf.call(btns, active);
        idx = e.key === 'ArrowDown' ? Math.min(idx + 1, btns.length - 1) : Math.max(idx - 1, 0);
        Array.prototype.forEach.call(btns, function (b) { b.classList.remove('active'); });
        btns[idx].classList.add('active');
        return;
      }
      if (e.key === 'Enter') {
        var act = list.querySelector('.list-group-item.active');
        if (act) {
          e.preventDefault();
          selectValue(act.textContent);
        }
      }
    });

    // keep input focused while clicking the list
    input.addEventListener('blur', function () {
      setTimeout(function () { list.classList.add('d-none'); }, 150);
    });
  }

  initSidebarDeptFilter();
  initDeptCombo();
})();
