(function () {
  var modal = document.getElementById('transferModal');
  var form = document.getElementById('transferForm');
  if (!modal || !form) return;

  var variant = modal.getAttribute('data-variant') || 'page';
  var returnToInput = document.getElementById('transferReturnTo');
  var searchInput = document.getElementById('assetSearch');
  var resultsBox = document.getElementById('assetResults');
  var selectedList = document.getElementById('selectedAssets');
  var hiddenContainer = document.getElementById('hiddenAssets');
  var selectedEmpty = document.getElementById('selectedEmpty');
  var toDept = document.getElementById('toDept');
  var toDeptInput = document.getElementById('toDeptInput');
  var submitBtn = document.getElementById('transferSubmit');
  var countText = document.getElementById('selectedCountText');
  var stringsEl = document.getElementById('transferStrings');

  var strings = {};
  try { strings = JSON.parse((stringsEl && stringsEl.textContent) || '{}') || {}; } catch (e) { strings = {}; }

  // id -> source department name (shown as a badge so the origin is visible)
  var state = {};

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function fill(str, value) {
    return String(str == null ? '' : str).replace('%s', value).replace('%d', value);
  }

  function clearSelection() {
    state = {};
    render();
    if (toDeptInput) toDeptInput.value = '';
    if (toDept) toDept.value = '';
  }

  function setSelection(items) {
    state = {};
    (items || []).forEach(function (it) {
      if (!it || !it.id) return;
      state[String(it.id)] = it.dept == null ? '' : String(it.dept);
    });
    render();
  }

  function render() {
    if (!selectedList) return;
    selectedList.innerHTML = '';
    if (hiddenContainer) hiddenContainer.innerHTML = '';
    var keys = Object.keys(state);
    if (selectedEmpty) selectedEmpty.classList.toggle('d-none', keys.length > 0);

    keys.forEach(function (id) {
      var dept = state[id];
      var li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center py-1 gap-2';

      var wrap = document.createElement('div');
      wrap.className = 'd-flex align-items-center gap-2 min-w-0';
      var idSpan = document.createElement('span');
      idSpan.className = 'small fw-bold text-truncate';
      idSpan.textContent = id;
      wrap.appendChild(idSpan);

      var badge = document.createElement('span');
      badge.className = 'badge text-truncate';
      var trimmed = (dept || '').trim();
      if (trimmed) {
        badge.classList.add('bg-secondary');
        badge.textContent = trimmed;
        badge.title = trimmed;
      } else {
        badge.classList.add('bg-light', 'text-muted', 'border');
        badge.textContent = strings.no_dept_badge || '-';
      }
      wrap.appendChild(badge);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-outline-danger ms-auto';
      btn.innerHTML = '<i class="bi bi-x-lg"></i>';
      btn.addEventListener('click', function () { delete state[id]; render(); });

      li.appendChild(wrap);
      li.appendChild(btn);
      selectedList.appendChild(li);

      var inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = 'asset_ids';
      inp.value = id;
      hiddenContainer.appendChild(inp);
    });

    if (submitBtn) submitBtn.disabled = keys.length === 0;
    if (countText) countText.textContent = fill(strings.selected, keys.length);
  }

  // ── Search + add (only used on the /transfer page) ──
  if (variant === 'page' && searchInput && resultsBox) {
    var timer;
    searchInput.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = searchInput.value.trim();
        if (q.length < 1) { resultsBox.innerHTML = ''; return; }
        fetch('/transfer/search?q=' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (items) {
            if (!items || !items.length) {
              resultsBox.innerHTML = '<div class="list-group-item small text-muted">' + escapeHtml(strings.no_result || '') + '</div>';
              return;
            }
            resultsBox.innerHTML = items.map(function (it) {
              return '<button type="button" class="list-group-item list-group-item-action" data-id="' + escapeHtml(it.asset_id) + '" data-dept="' + escapeHtml(it.dept_name || '') + '">'
                + '<div class="fw-bold small">' + escapeHtml(it.asset_id) + '</div>'
                + '<div class="small text-muted">' + escapeHtml(it.descr || '') + (it.dept_name ? ' &middot; ' + escapeHtml(it.dept_name) : '') + '</div>'
                + '</button>';
            }).join('');
          })
          .catch(function () { resultsBox.innerHTML = ''; });
      }, 250);
    });

    resultsBox.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-id]');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      if (id) {
        state[id] = btn.getAttribute('data-dept') || '';
        render();
      }
      resultsBox.innerHTML = '';
      searchInput.value = '';
      searchInput.focus();
    });
  }

  // ── Open from the dashboard with rows preselected ──
  var opener = document.getElementById('btnTransferSelected');
  if (opener) {
    opener.addEventListener('click', function () {
      var items = [];
      Array.prototype.forEach.call(document.querySelectorAll('.row-check'), function (c) {
        if (!c.checked) return;
        var tr = c.closest('tr');
        if (!tr) return;
        items.push({
          id: tr.getAttribute('data-asset_id'),
          dept: tr.getAttribute('data-dept_name') || ''
        });
      });
      if (!items.length) return;
      setSelection(items);
      bootstrap.Modal.getOrCreateInstance(modal).show();
    });
  }

  // Reset when the modal is dismissed so a stale selection never leaks into the next open.
  modal.addEventListener('hidden.bs.modal', function () {
    if (variant === 'dashboard') clearSelection();
  });

  form.addEventListener('submit', function (e) {
    var count = Object.keys(state).length;
    var dept = toDept ? toDept.value : (toDeptInput ? toDeptInput.value : '');
    if (count === 0) {
      e.preventDefault();
      Swal.fire({ icon: 'warning', text: strings.no_selection || '' });
      return;
    }
    if (!dept) {
      e.preventDefault();
      Swal.fire({ icon: 'warning', text: strings.no_dept || '' });
      return;
    }
    // The global confirm handler in footer.ejs reads these two data attributes.
    this.dataset.confirmTitle = strings.confirm_title || '';
    this.dataset.confirm = fill(fill(strings.confirm || '', count), dept);
  });

  window.TransferModal = {
    open: function (items) {
      setSelection(items);
      bootstrap.Modal.getOrCreateInstance(modal).show();
    },
    setSelection: setSelection,
    clear: clearSelection
  };
})();
