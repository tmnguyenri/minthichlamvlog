/* Trang quản lý: viết và sửa bài, duyệt thành viên. Chỉ dành cho tài khoản quản trị. */
(function () {
  'use strict';
  var M = window.MTLV, h = M.h, tx = M.tx, t = M.t;
  var panel = document.getElementById('admin-root');
  var note = document.getElementById('admin-msg');
  var tabs = { posts: document.getElementById('tab-posts'), users: document.getElementById('tab-users') };
  var tabBtns = document.querySelectorAll('[data-tab]');

  function slugify(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
  }
  function fmt(ts) { return ts ? new Date(ts * 1000).toLocaleDateString(M.lang() === 'en' ? 'en-GB' : 'vi-VN') : ''; }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function say(text, kind) { M.show(note, text, kind); if (text) note.scrollIntoView({ block: 'nearest' }); }

  // Nút cần bấm hai lần để chắc chắn (xóa, chặn).
  function confirmButton(label, labelEn, sure, sureEn, action, extra) {
    var b = tx('button', label, labelEn, { type: 'button', class: 'btn btn--ghost btn--xs' + (extra || '') });
    var timer = null;
    b.addEventListener('click', function () {
      if (b.getAttribute('data-armed')) { clearTimeout(timer); action(); return; }
      b.setAttribute('data-armed', '1');
      b.textContent = t(sure, sureEn);
      timer = setTimeout(function () { b.removeAttribute('data-armed'); b.textContent = t(label, labelEn); }, 4000);
    });
    return b;
  }

  function badge(vi, en, kind) { return tx('span', vi, en, { class: 'tag-pill tag-pill--' + kind }); }

  // ------------------------------------------------------------ Bài viết
  function loadPosts() {
    var list = document.getElementById('post-list');
    return M.api('GET', '/api/posts?all=1&limit=50').then(function (res) {
      if (!res.ok) { say(M.msgOf(res), 'error'); return; }
      clear(list);
      if (!res.json.posts.length) {
        list.appendChild(tx('p', 'Chưa có bài viết nào. Bấm “Viết bài mới” để bắt đầu.', 'No posts yet. Click “New post” to start.', { class: 'muted' }));
      }
      res.json.posts.forEach(function (p) {
        var published = p.status === 'published';
        list.appendChild(h('li', { class: 'row' },
          h('div', { class: 'row__main' },
            h('strong', { text: p.title }),
            h('span', { class: 'row__sub' }, published ? badge('Đã đăng', 'Published', 'ok') : badge('Nháp', 'Draft', 'draft'), ' ', fmt(p.updated_at))),
          h('div', { class: 'row__actions' },
            tx('button', 'Sửa', 'Edit', { type: 'button', class: 'btn btn--ghost btn--xs', onclick: function () { edit(p.id); } }),
            tx('a', 'Xem', 'View', { class: 'btn btn--ghost btn--xs', href: '/bai/' + encodeURIComponent(p.slug) }),
            confirmButton('Xóa', 'Delete', 'Bấm lần nữa để xóa', 'Click again to delete', function () {
              M.api('DELETE', '/api/posts/' + p.id).then(function (r) {
                if (r.ok) { say(t('Đã xóa bài viết.', 'Post deleted.'), 'success'); closeEditor(); loadPosts(); } else say(M.msgOf(r), 'error');
              });
            }))));
      });
      M.refresh();
    });
  }

  var editor = document.getElementById('post-editor');
  var form = document.getElementById('post-form');
  var editingId = null;
  var slugTouched = false;

  function closeEditor() { editor.hidden = true; editingId = null; }

  function fill(p) {
    form.reset();
    var f = form.elements;
    ['title', 'slug', 'excerpt', 'body', 'country', 'trip_date', 'days', 'cover', 'video', 'status', 'title_en', 'excerpt_en', 'body_en']
      .forEach(function (k) { f[k].value = p && p[k] !== null && p[k] !== undefined ? p[k] : (k === 'status' ? 'draft' : ''); });
    slugTouched = !!(p && p.slug);
    document.getElementById('editor-title').textContent = p ? t('Sửa bài viết', 'Edit post') : t('Bài viết mới', 'New post');
    document.getElementById('editor-title').setAttribute('data-vi', p ? 'Sửa bài viết' : 'Bài viết mới');
    document.getElementById('editor-title').setAttribute('data-en', p ? 'Edit post' : 'New post');
    editor.hidden = false;
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    f.title.focus();
  }

  function edit(id) {
    M.api('GET', '/api/posts/' + id).then(function (res) {
      if (!res.ok) { say(M.msgOf(res), 'error'); return; }
      editingId = id; say(''); fill(res.json.post);
    });
  }

  document.getElementById('new-post').addEventListener('click', function () { editingId = null; say(''); fill(null); });
  document.getElementById('cancel-post').addEventListener('click', closeEditor);
  form.elements.title.addEventListener('input', function () { if (!slugTouched) form.elements.slug.value = slugify(form.elements.title.value); });
  form.elements.slug.addEventListener('input', function () { slugTouched = true; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements, btn = form.querySelector('button[type=submit]');
    var body = {};
    ['title', 'slug', 'excerpt', 'body', 'country', 'trip_date', 'days', 'cover', 'video', 'status', 'title_en', 'excerpt_en', 'body_en']
      .forEach(function (k) { body[k] = f[k].value; });
    if (!body.slug) body.slug = slugify(body.title);
    btn.disabled = true;
    M.api(editingId ? 'PUT' : 'POST', editingId ? '/api/posts/' + editingId : '/api/posts', body).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { say(M.msgOf(res), 'error'); return; }
      editingId = res.json.id;
      say(body.status === 'published' ? t('Đã lưu và đăng bài.', 'Saved and published.') : t('Đã lưu bản nháp.', 'Draft saved.'), 'success');
      loadPosts();
    });
  });

  // ------------------------------------------------------------ Thành viên
  // Tạo liên kết đặt lại mật khẩu cho một thành viên rồi hiện ra để chủ trang sao chép gửi họ.
  function resetLink(u) {
    var box = document.getElementById('reset-result');
    M.api('POST', '/api/admin/users/' + u.id + '/reset').then(function (res) {
      if (!res.ok) { say(M.msgOf(res), 'error'); return; }
      say('');
      clear(box);
      var input = h('input', { id: 'reset-link', type: 'text', readonly: true, value: res.json.link, spellcheck: 'false' });
      var copy = tx('button', 'Sao chép liên kết', 'Copy link', { type: 'button', class: 'btn btn--primary btn--xs' });
      copy.addEventListener('click', function () {
        function done() { copy.textContent = t('Đã sao chép', 'Copied'); copy.setAttribute('data-en', 'Copied'); copy.setAttribute('data-vi', 'Đã sao chép'); }
        input.select();
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(res.json.link).then(done, function () { try { document.execCommand('copy'); done(); } catch (e) { /* người dùng tự chép */ } });
        else { try { document.execCommand('copy'); done(); } catch (e) { /* người dùng tự chép */ } }
      });
      box.appendChild(tx('p', 'Liên kết đặt lại mật khẩu cho ' + u.display_name + ' (' + u.email + ')', 'Password reset link for ' + u.display_name + ' (' + u.email + ')', { class: 'reset-box__title' }));
      box.appendChild(tx('p', 'Gửi riêng cho đúng người đó. Dùng được một lần và hết hạn sau 24 giờ. Tạo liên kết mới sẽ làm liên kết cũ hết hiệu lực.',
        'Send it privately to that person only. It works once and expires after 24 hours. Creating a new link cancels the old one.', { class: 'muted' }));
      box.appendChild(h('div', { class: 'field' }, tx('label', 'Liên kết', 'Link', { for: 'reset-link' }), input));
      box.appendChild(h('div', { class: 'row__actions' }, copy,
        tx('button', 'Đóng', 'Close', { type: 'button', class: 'btn btn--ghost btn--xs', onclick: function () { clear(box); box.hidden = true; } })));
      box.hidden = false;
      M.refresh();
      input.focus(); input.select();
      box.scrollIntoView({ block: 'nearest' });
    });
  }

  function loadUsers() {
    var list = document.getElementById('user-list');
    return M.api('GET', '/api/admin/users').then(function (res) {
      if (!res.ok) { say(M.msgOf(res), 'error'); return; }
      clear(list);
      var pending = 0;
      res.json.users.forEach(function (u) {
        if (u.status === 'pending') pending++;
        var st = u.status === 'approved' ? badge('Đã duyệt', 'Approved', 'ok') : u.status === 'pending' ? badge('Chờ duyệt', 'Pending', 'wait') : badge('Đã chặn', 'Blocked', 'bad');
        var actions = h('div', { class: 'row__actions' });
        if (u.role === 'admin') actions.appendChild(tx('span', 'Quản trị', 'Admin', { class: 'muted' }));
        else {
          function setStatus(s) { M.api('PATCH', '/api/admin/users/' + u.id, { status: s }).then(function (r) { if (r.ok) loadUsers(); else say(M.msgOf(r), 'error'); }); }
          if (u.status !== 'approved') actions.appendChild(tx('button', 'Duyệt', 'Approve', { type: 'button', class: 'btn btn--primary btn--xs', onclick: function () { setStatus('approved'); } }));
          if (u.status !== 'blocked') actions.appendChild(confirmButton('Chặn', 'Block', 'Bấm lần nữa để chặn', 'Click again to block', function () { setStatus('blocked'); }));
          actions.appendChild(tx('button', 'Đặt lại mật khẩu', 'Reset password', { type: 'button', class: 'btn btn--ghost btn--xs', onclick: function () { resetLink(u); } }));
          actions.appendChild(confirmButton('Xóa', 'Delete', 'Bấm lần nữa để xóa', 'Click again to delete', function () {
            M.api('DELETE', '/api/admin/users/' + u.id).then(function (r) { if (r.ok) loadUsers(); else say(M.msgOf(r), 'error'); });
          }));
        }
        list.appendChild(h('li', { class: 'row' },
          h('div', { class: 'row__main' }, h('strong', { text: u.display_name }),
            h('span', { class: 'row__sub' }, u.email, ' · ', st, ' · ', fmt(u.created_at))),
          actions));
      });
      if (!res.json.users.length) list.appendChild(tx('p', 'Chưa có thành viên nào.', 'No members yet.', { class: 'muted' }));
      var count = document.getElementById('pending-count');
      count.textContent = pending ? String(pending) : '';
      count.hidden = !pending;
      M.refresh();
    });
  }

  // ------------------------------------------------------------ Tab và khởi động
  function openTab(name) {
    Object.keys(tabs).forEach(function (k) { tabs[k].hidden = k !== name; });
    tabBtns.forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === name)); });
    say('');
  }
  tabBtns.forEach(function (b) { b.addEventListener('click', function () { openTab(b.getAttribute('data-tab')); }); });

  M.api('GET', '/api/auth/me').then(function (res) {
    var user = res.json && res.json.user;
    if (!user) { window.location.replace('/dang-nhap?next=/quan-ly'); return; }
    if (user.role !== 'admin') { say(t('Trang này chỉ dành cho chủ trang.', 'This page is for the site owner only.'), 'error'); return; }
    panel.hidden = false;
    openTab('posts');
    loadPosts();
    loadUsers();
  });
})();
