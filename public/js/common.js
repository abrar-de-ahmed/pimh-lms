(function () {
  window.PIMH = window.PIMH || {};

  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('overlay');
  var menuToggle = document.getElementById('menuToggle');
  var sbClose = document.getElementById('sbClose');
  if (menuToggle) menuToggle.addEventListener('click', function () { sidebar.classList.add('open'); overlay.classList.add('show'); });
  if (sbClose) sbClose.addEventListener('click', function () { sidebar.classList.remove('open'); overlay.classList.remove('show'); });
  if (overlay) overlay.addEventListener('click', function () { sidebar.classList.remove('open'); overlay.classList.remove('show'); });

  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      fetch('/api/auth/logout', { method: 'POST' }).then(function () { window.location.href = '/login'; });
    });
  }

  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function showToast(msg, isError) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.toggle('error', !!isError);
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function api(path, opts) {
    opts = opts || {};
    var fetchOpts = { method: opts.method || 'GET', headers: {} };
    if (opts.body !== undefined) {
      fetchOpts.headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(opts.body);
    }
    return fetch(path, fetchOpts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var err = new Error(data.error || 'Request failed');
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var d = new Date(iso.replace(' ', 'T') + 'Z');
    var diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 86400 * 2) return 'yesterday';
    if (diff < 86400 * 30) return Math.floor(diff / 86400) + ' days ago';
    return d.toLocaleDateString();
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Generic view switcher: elements with [data-view] switch #view-<name> visibility
  // and toggle .sb-link active state + pageTitle text.
  function initViewSwitching(titles, onShow) {
    function showView(name, opts) {
      document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
      var el = document.getElementById('view-' + name);
      if (el) el.classList.add('active');
      document.querySelectorAll('.sb-link').forEach(function (l) { l.classList.remove('active'); });
      document.querySelectorAll('.sb-link[data-view="' + name + '"]').forEach(function (l) { l.classList.add('active'); });
      var pt = document.getElementById('pageTitle');
      if (pt && titles[name]) pt.textContent = titles[name];
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('show');
      window.scrollTo(0, 0);
      if (onShow) onShow(name, opts);
      window.location.hash = name;
    }
    document.body.addEventListener('click', function (e) {
      var el = e.target.closest('[data-view]');
      if (!el) return;
      e.preventDefault();
      showView(el.getAttribute('data-view'), { el: el });
    });
    window.PIMH.showView = showView;
    var initial = (window.location.hash || '').replace('#', '') || 'dashboard';
    showView(titles[initial] ? initial : 'dashboard');
  }

  function tabber(container, tabSelector, panelAttr) {
    container.querySelectorAll(tabSelector).forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-' + panelAttr) || tab.dataset[panelAttr];
        container.querySelectorAll(tabSelector).forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        container.querySelectorAll('[data-' + panelAttr + '-panel]').forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-' + panelAttr + '-panel') === key);
        });
      });
    });
  }

  window.PIMH.showToast = showToast;
  window.PIMH.esc = esc;
  window.PIMH.api = api;
  window.PIMH.timeAgo = timeAgo;
  window.PIMH.fmtDate = fmtDate;
  window.PIMH.initViewSwitching = initViewSwitching;
  window.PIMH.tabber = tabber;
})();
