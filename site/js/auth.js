/* Biểu mẫu đăng nhập và đăng ký. */
(function () {
  'use strict';
  var M = window.MTLV;
  var note = document.getElementById('form-msg');

  function safeNext() {
    var n = new URLSearchParams(window.location.search).get('next');
    return n && /^\/(?!\/)[^\s]*$/.test(n) ? n : null;
  }

  function wire(form, run) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      M.show(note, '');
      run(function (done) { btn.disabled = false; if (done) done(); });
    });
  }

  var login = document.getElementById('login-form');
  if (login) {
    wire(login, function (finish) {
      M.api('POST', '/api/auth/login', { email: login.email.value, password: login.password.value }).then(function (res) {
        if (res.ok) { window.location.href = safeNext() || (res.json.role === 'admin' ? '/quan-ly' : '/'); return; }
        M.show(note, M.msgOf(res), 'error');
        finish();
      });
    });
  }

  var reg = document.getElementById('register-form');
  if (reg) {
    wire(reg, function (finish) {
      if (reg.password.value !== reg.password2.value) {
        M.show(note, M.t('Hai mật khẩu chưa giống nhau.', 'The two passwords do not match.'), 'error');
        finish();
        return;
      }
      var body = { email: reg.email.value, name: reg.name.value, password: reg.password.value, invite: reg.invite ? reg.invite.value : '' };
      M.api('POST', '/api/auth/register', body).then(function (res) {
        if (!res.ok) { M.show(note, M.msgOf(res), 'error'); finish(); return; }
        if (res.json.status === 'approved') { window.location.href = '/quan-ly'; return; }
        reg.hidden = true;
        var done = document.getElementById('register-done');
        if (done) done.hidden = false;
      });
    });
  }
})();
