/* Biểu mẫu đăng nhập, đăng ký và đặt mật khẩu mới. */
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

  // Đặt mật khẩu mới: mã nằm sau dấu # của liên kết (không gửi lên máy chủ khi mở trang).
  // Không có mã trong liên kết thì hiện ô nhập email và mã khôi phục.
  var rst = document.getElementById('reset-form');
  if (rst) {
    var code = window.location.hash.replace(/^#/, '');
    if (/^[A-Za-z0-9_-]{20,200}$/.test(code)) {
      try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { /* bỏ qua */ }
    } else code = '';
    document.getElementById('reset-extra').hidden = !!code;
    wire(rst, function (finish) {
      if (rst.password.value !== rst.password2.value) {
        M.show(note, M.t('Hai mật khẩu chưa giống nhau.', 'The two passwords do not match.'), 'error');
        finish();
        return;
      }
      var body = { token: code || rst.token.value, email: code ? '' : rst.email.value, password: rst.password.value };
      M.api('POST', '/api/auth/reset', body).then(function (res) {
        if (!res.ok) { M.show(note, M.msgOf(res), 'error'); finish(); return; }
        rst.hidden = true;
        document.getElementById('reset-done').hidden = false;
      });
    });
  }
})();
