/* Trên mọi trang: nếu đã đăng nhập thì đổi nút "Đăng nhập" thành "Quản lý" (chủ trang) và thêm "Đăng xuất". */
(function () {
  'use strict';
  if (document.cookie.indexOf('mtlv_in=1') === -1) return; // chưa từng đăng nhập: không cần hỏi máy chủ
  var link = document.querySelector('.nav-account');
  if (!link) return;

  function refresh() { if (window.mtlvI18n) window.mtlvI18n.refresh(); }

  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || !d.user) return;
      var nav = link.parentNode;
      if (d.user.role === 'admin') {
        link.setAttribute('href', '/quan-ly');
        link.removeAttribute('data-vi');
        link.textContent = 'Quản lý';
        link.setAttribute('data-en', 'Manage');
      } else {
        link.remove();
      }
      var out = document.createElement('button');
      out.type = 'button';
      out.className = 'nav-logout';
      out.textContent = 'Đăng xuất';
      out.setAttribute('data-en', 'Log out');
      out.addEventListener('click', function () {
        fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
          .then(function () { window.location.reload(); });
      });
      nav.appendChild(out);
      refresh();
    })
    .catch(function () { /* giữ nguyên nút Đăng nhập */ });
})();
