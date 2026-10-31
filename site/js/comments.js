/* Gửi và xóa bình luận trên trang bài viết. */
(function () {
  'use strict';
  var M = window.MTLV;

  function reload() { window.location.hash = 'binh-luan'; window.location.reload(); }

  var form = document.getElementById('comment-form');
  if (form) {
    var note = document.getElementById('comment-msg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      var text = form.body.value.trim();
      if (!text) { M.show(note, M.t('Hãy viết gì đó trước khi gửi.', 'Please write something first.'), 'error'); return; }
      btn.disabled = true;
      M.api('POST', '/api/comments', { post_id: Number(form.getAttribute('data-post-id')), body: text }).then(function (res) {
        if (res.ok) { reload(); return; }
        M.show(note, M.msgOf(res), 'error');
        btn.disabled = false;
      });
    });
  }

  // Nút xóa: bấm lần một để xác nhận, bấm lần hai để xóa.
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-del-comment]') : null;
    if (!b) return;
    if (!b.getAttribute('data-armed')) {
      b.setAttribute('data-armed', '1');
      b.textContent = M.t('Bấm lần nữa để xóa', 'Click again to delete');
      window.setTimeout(function () { b.removeAttribute('data-armed'); b.textContent = M.t('Xóa', 'Delete'); }, 4000);
      return;
    }
    M.api('DELETE', '/api/comments/' + b.getAttribute('data-del-comment')).then(function (res) {
      if (res.ok) reload();
    });
  });
})();
