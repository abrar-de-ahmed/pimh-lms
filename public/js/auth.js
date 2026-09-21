(function () {
  var boot = window.__BOOT__ || {};
  var googleBtn = document.getElementById('googleBtn');
  if (googleBtn) {
    if (!boot.googleConfigured) {
      googleBtn.disabled = true;
      googleBtn.title = 'Google sign-in is not configured on this server yet.';
    }
    googleBtn.addEventListener('click', function () {
      if (!boot.googleConfigured) {
        showError('Google sign-in is not configured yet. Ask an administrator to add Google OAuth credentials.');
        return;
      }
      window.location.href = '/api/auth/google/start';
    });
  }

  var params = new URLSearchParams(window.location.search);
  if (params.get('error') === 'google') showError('Google sign-in did not complete. Please try again or use email and password.');

  function showError(msg) {
    var el = document.getElementById('authError');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
  }

  var loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, password: password }) })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) { showError(res.data.error || 'Could not log in.'); return; }
          window.location.href = res.data.redirect || '/';
        })
        .catch(function () { showError('Something went wrong. Please try again.'); });
    });
  }

  var registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('name').value.trim();
      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, email: email, password: password }) })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) { showError(res.data.error || 'Could not create account.'); return; }
          window.location.href = res.data.redirect || '/';
        })
        .catch(function () { showError('Something went wrong. Please try again.'); });
    });
  }
})();
