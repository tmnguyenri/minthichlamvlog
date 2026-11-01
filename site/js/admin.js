/* Trang quản lý: viết và sửa bài, duyệt thành viên. Chỉ dành cho tài khoản quản trị. */
(function () {
  'use strict';
  var M = window.MTLV, h = M.h, tx = M.tx, t = M.t;
  var panel = document.getElementById('admin-root');
  var note = document.getElementById('admin-msg');
  var tabs = { posts: document.getElementById('tab-posts'), home: document.getElementById('tab-home'), media: document.getElementById('tab-media'), users: document.getElementById('tab-users'), stats: document.getElementById('tab-stats') };
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
    ['title', 'slug', 'excerpt', 'body', 'city', 'country', 'trip_date', 'days', 'cover', 'video', 'status']
      .forEach(function (k) { f[k].value = p &&p[k] !== null && p[k] !== undefined ? p[k] : (k === 'status' ? 'draft' : ''); });
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
      editingId = id; say(''); fill(res.json.post); renderPostPhotos(id, res.json.images);
    });
  }

  document.getElementById('new-post').addEventListener('click', function () { editingId = null; say(''); fill(null); renderPostPhotos(null, []); });
  document.getElementById('cancel-post').addEventListener('click', closeEditor);
  form.elements.title.addEventListener('input', function () { if (!slugTouched) form.elements.slug.value = slugify(form.elements.title.value); });
  form.elements.slug.addEventListener('input', function () { slugTouched = true; });

  function collect() {
    var f = form.elements, body = {};
    ['title', 'slug', 'excerpt', 'body', 'city', 'country', 'trip_date', 'days', 'cover', 'video', 'status']
      .forEach(function (k) { body[k] = f[k].value; });
    if (!body.slug) body.slug = slugify(body.title);
    return body;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements, btn = form.querySelector('button[type=submit]');
    var body = collect();
    btn.disabled = true;
    M.api(editingId ? 'PUT' : 'POST', editingId ? '/api/posts/' + editingId : '/api/posts', body).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { say(M.msgOf(res), 'error'); return; }
      editingId = res.json.id;
      say(body.status === 'published' ? t('Đã lưu và đăng bài.', 'Saved and published.') : t('Đã lưu bản nháp.', 'Draft saved.'), 'success');
      loadPosts();
      loadPostPhotos(editingId);
    });
  });

  // ------------------------------------------------------------ Ảnh của bài
  // Mỗi bài có nhiều ảnh. Khi mở trang, máy chủ chọn ngẫu nhiên một ảnh để hiển thị.
  var pp = {
    body: document.getElementById('pp-body'), hint: document.getElementById('pp-hint'), file: document.getElementById('pp-file'),
    status: document.getElementById('pp-status'), list: document.getElementById('pp-list'), empty: document.getElementById('pp-empty'),
  };

  function ppStatus(text) { pp.status.textContent = text || ''; pp.status.hidden = !text; }

  function insertIntoBody(md) {
    var ta = form.elements.body, v = ta.value;
    ta.value = v + (v && !/\n$/.test(v) ? '\n\n' : '') + md + '\n\n';
    ta.focus();
    say(t('Đã chèn ảnh vào nội dung. Bấm Lưu để giữ thay đổi.', 'Photo inserted into the content. Click Save to keep the change.'), 'success');
  }

  function renderPostPhotos(postId, images) {
    clear(pp.list);
    images = images || [];
    pp.empty.hidden = images.length > 0;
    images.forEach(function (img) {
      var md = '![' + (img.caption || '') + '](/api/images/' + img.id + ')';
      var insert = tx('button', 'Chèn vào nội dung', 'Insert into content', { type: 'button', class: 'btn btn--ghost btn--xs' });
      insert.addEventListener('click', function () { insertIntoBody(md); });
      var del = confirmButton('Xóa', 'Delete', 'Bấm lần nữa', 'Click again', function () {
        M.api('DELETE', '/api/images/' + img.id).then(function (r) {
          if (r.ok) loadPostPhotos(postId); else say(M.msgOf(r), 'error');
        });
      });
      pp.list.appendChild(h('li', { class: 'post-photos__item' },
        h('img', { src: '/api/images/' + img.id, alt: img.caption || '', width: 160, height: 120, loading: 'lazy' }),
        h('div', { class: 'post-photos__actions' }, insert, del)));
    });
  }

  function loadPostPhotos(postId) {
    if (!postId) { renderPostPhotos(null, []); return; }
    return M.api('GET', '/api/posts/' + postId).then(function (res) {
      if (res.ok && editingId === postId) renderPostPhotos(postId, res.json.images);
    });
  }

  // Ảnh được tải ngay trong lúc viết bài. Nếu bài chưa được lưu lần nào, tự lưu thành nháp trước để có mã bài.
  function ensurePost() {
    if (editingId) return Promise.resolve(editingId);
    var body = collect();
    if (!body.title.trim()) {
      say(t('Nhập tiêu đề bài trước khi thêm ảnh.', 'Enter a title before adding photos.'), 'error');
      return Promise.resolve(null);
    }
    body.status = 'draft';
    return M.api('POST', '/api/posts', body).then(function (res) {
      if (!res.ok) { say(M.msgOf(res), 'error'); return null; }
      editingId = res.json.id;
      form.elements.status.value = 'draft';
      say(t('Đã tự lưu bản nháp để gắn ảnh.', 'Draft saved automatically so the photos can be attached.'), 'success');
      loadPosts();
      return editingId;
    });
  }

  pp.file.addEventListener('change', function () {
    var files = Array.prototype.slice.call(pp.file.files || []);
    pp.file.value = '';
    if (!files.length) return;
    ensurePost().then(function (postId) {
      if (postId) uploadFiles(postId, files);
    });
  });

  function uploadFiles(postId, files) {
    var i = 0, failed = 0;
    function next() {
      if (i >= files.length) {
        ppStatus(failed
          ? t(failed + ' ảnh không tải được.', failed + ' photo(s) could not be uploaded.')
          : t('Đã tải lên ' + files.length + ' ảnh.', 'Uploaded ' + files.length + ' photo(s).'));
        loadPostPhotos(postId);
        return;
      }
      var f = files[i++];
      ppStatus(t('Đang xử lý ' + i + '/' + files.length + '…', 'Processing ' + i + ' of ' + files.length + '…'));
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { failed++; return next(); }
      window.mtlvPhoto.compress(f).then(function (blob) {
        // Tên tệp ảnh điện thoại/máy ảnh thường rất dài; rút ngắn lại để chú thích gọn, dễ quản lý
        // mà vẫn biết là tệp nào.
        var caption = encodeURIComponent(M.shortenName(f.name, 40));
        return fetch('/api/images?post_id=' + postId + '&caption=' + caption, {
          method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'image/jpeg' }, body: blob,
        });
      }).then(function (r) { if (!r.ok) failed++; }).catch(function () { failed++; }).then(next);
    }
    next();
  }

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

  // ------------------------------------------------------------ Ảnh ở đầu trang chủ
  // Ba ảnh xếp chồng trong khối .stack ở đầu trang chủ (xem site/css/style.css). Chưa chỉnh gì thì
  // trang chủ dùng ảnh mặc định có sẵn trong HTML (fallback dưới đây), không gọi /api/settings đổi gì.
  var HERO_SLOTS = [
    { key: 'hero_photo_1', label: 'Ảnh thứ nhất (to nhất, bên trái)', labelEn: 'First photo (largest, on the left)', fallback: '/images/min.jpg' },
    { key: 'hero_photo_2', label: 'Ảnh thứ hai (trên, bên phải)', labelEn: 'Second photo (top right)', fallback: '/images/scene-dalat-wide.svg' },
    { key: 'hero_photo_3', label: 'Ảnh thứ ba (dưới, bên phải)', labelEn: 'Third photo (bottom right)', fallback: '/images/scene-kyoto-wide.svg' },
  ];

  function uploadHeroPhoto(slot, file, status) {
    status.textContent = t('Đang tải lên…', 'Uploading…');
    status.hidden = false;
    return window.mtlvPhoto.compress(file).then(function (blob) {
      return fetch('/api/images', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'image/jpeg' }, body: blob });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, json: j }; });
    }).then(function (res) {
      if (!res.ok) { status.textContent = t('Tải ảnh lỗi.', 'Upload failed.'); return; }
      var body = {}; body[slot.key] = res.json.url;
      return M.api('PUT', '/api/settings', body).then(function (r2) {
        if (!r2.ok) { status.textContent = M.msgOf(r2); return; }
        say(t('Đã cập nhật ảnh trang chủ.', 'Homepage photo updated.'), 'success');
        loadHeroPhotos();
      });
    }).catch(function () { status.textContent = t('Tải ảnh lỗi.', 'Upload failed.'); });
  }

  function revertHeroPhoto(slot) {
    var body = {}; body[slot.key] = '';
    M.api('PUT', '/api/settings', body).then(function (res) {
      if (!res.ok) { say(M.msgOf(res), 'error'); return; }
      say(t('Đã quay lại ảnh mặc định.', 'Reverted to the default photo.'), 'success');
      loadHeroPhotos();
    });
  }

  function renderHeroPhotos(settings) {
    var list = document.getElementById('hero-photos');
    clear(list);
    HERO_SLOTS.forEach(function (slot) {
      var custom = settings[slot.key];
      var fileId = 'hero-file-' + slot.key;
      var status = h('p', { class: 'muted', role: 'status', hidden: true });
      var file = h('input', { id: fileId, type: 'file', accept: 'image/jpeg,image/png,image/webp' });
      var revert = tx('button', 'Dùng ảnh mặc định', 'Use the default photo', { type: 'button', class: 'btn btn--ghost btn--xs' });
      if (!custom) revert.disabled = true;
      revert.addEventListener('click', function () { revertHeroPhoto(slot); });
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        file.value = '';
        if (f) uploadHeroPhoto(slot, f, status);
      });
      list.appendChild(h('li', { class: 'media-card' },
        h('img', { src: custom || slot.fallback, alt: '', width: 240, height: 180, loading: 'lazy' }),
        h('div', { class: 'media-card__body' },
          tx('p', slot.label, slot.labelEn, { class: 'media-card__caption' }),
          custom ? tx('span', 'Ảnh riêng', 'Custom photo', { class: 'media-card__post' })
            : tx('span', 'Ảnh mặc định', 'Default photo', { class: 'media-card__post media-card__post--none' }),
          h('div', { class: 'field' }, tx('label', 'Đổi ảnh', 'Change photo', { for: fileId }), file),
          status,
          h('div', { class: 'media-card__actions' }, revert))));
    });
    M.refresh();
  }

  function loadHeroPhotos() {
    return M.api('GET', '/api/settings').then(function (res) {
      if (!res.ok) { say(M.msgOf(res), 'error'); return; }
      renderHeroPhotos(res.json.settings || {});
    });
  }

  // ------------------------------------------------------------ Tất cả ảnh
  function loadMedia() {
    var list = document.getElementById('media-list');
    return M.api('GET', '/api/images').then(function (res) {
      if (!res.ok) { say(M.msgOf(res), 'error'); return; }
      var images = res.json.images || [];
      clear(list);
      document.getElementById('media-count').textContent = images.length ? images.length + t(' ảnh', ' photos') : '';
      document.getElementById('media-empty').hidden = images.length > 0;
      images.forEach(function (img) {
        var where = img.post_id
          ? h('span', { class: 'media-card__post', text: img.post_title || ('Bài #' + img.post_id) })
          : tx('span', 'Chưa gắn bài', 'Not attached to a post', { class: 'media-card__post media-card__post--none' });
        var md = '![' + (img.caption || '') + '](/api/images/' + img.id + ')';
        var copy = tx('button', 'Sao chép liên kết', 'Copy link', { type: 'button', class: 'btn btn--ghost btn--xs' });
        copy.addEventListener('click', function () {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(md).then(function () { say(t('Đã sao chép: ', 'Copied: ') + md, 'success'); }, function () { say(md, 'info'); });
          else say(md, 'info');
        });
        var del = confirmButton('Xóa', 'Delete', 'Bấm lần nữa', 'Click again', function () {
          M.api('DELETE', '/api/images/' + img.id).then(function (r) {
            if (r.ok) { say(t('Đã xóa ảnh.', 'Photo deleted.'), 'success'); loadMedia(); } else say(M.msgOf(r), 'error');
          });
        });
        list.appendChild(h('li', { class: 'media-card' },
          h('img', { src: '/api/images/' + img.id, alt: img.caption || '', width: 240, height: 180, loading: 'lazy' }),
          h('div', { class: 'media-card__body' },
            h('p', { class: 'media-card__caption', text: img.caption || t('(không có chú thích)', '(no caption)') }),
            where,
            h('p', { class: 'media-card__meta', text: Math.round(img.size / 1024) + ' KB' }),
            h('div', { class: 'media-card__actions' }, copy, del))));
      });
      M.refresh();
    });
  }

  // ------------------------------------------------------------ Thống kê
  function fmtAgo(ts) {
    var s = Math.max(0, Math.floor(Date.now() / 1000) - (ts || 0));
    if (s < 60) return t('vừa xong', 'just now');
    var m = Math.floor(s / 60);
    if (m < 60) return t(m + ' phút trước', m + ' min ago');
    return t(Math.floor(m / 60) + ' giờ trước', Math.floor(m / 60) + ' h ago');
  }

  function tile(n, vi, en) { return h('li', { class: 'stat-tile' }, h('strong', { text: String(n) }), tx('span', vi, en)); }

  function renderStatsGrid(s) {
    var grid = document.getElementById('stats-grid');
    clear(grid);
    [
      tile(s.visits.total, 'Lượt xem', 'Page views'),
      tile(s.visits.today, 'Lượt xem hôm nay', 'Views today'),
      tile(s.visits.unique_total, 'Khách khác nhau', 'Unique visitors'),
      tile(s.members.total, 'Thành viên', 'Members'),
      tile(s.online.count, 'Đang online', 'Online now'),
      tile(s.posts.total, 'Bài viết', 'Posts'),
      tile(s.comments.total, 'Bình luận', 'Comments'),
      tile(s.images.total, 'Hình ảnh', 'Photos'),
    ].forEach(function (li) { grid.appendChild(li); });
  }

  function renderOnline(list) {
    var ul = document.getElementById('stats-online');
    clear(ul);
    document.getElementById('stats-online-empty').hidden = list.length > 0;
    list.forEach(function (u) {
      ul.appendChild(h('li', { class: 'row' },
        h('div', { class: 'row__main' }, h('strong', { text: u.display_name }),
          h('span', { class: 'row__sub', text: fmtAgo(u.last_seen_at) }))));
    });
  }

  function renderTopActive(list) {
    var ol = document.getElementById('stats-top');
    clear(ol);
    document.getElementById('stats-top-empty').hidden = list.length > 0;
    list.forEach(function (u) {
      ol.appendChild(h('li', {},
        h('span', { class: 'stats-top__name', text: u.display_name }),
        h('span', {
          class: 'stats-top__meta',
          text: ' — ' + t(u.posts + ' bài · ' + u.comments + ' bình luận', u.posts + ' posts · ' + u.comments + ' comments'),
        })));
    });
  }

  function loadStats() {
    return M.api('GET', '/api/admin/stats').then(function (res) {
      if (!res.ok) { say(M.msgOf(res), 'error'); return; }
      renderStatsGrid(res.json);
      renderOnline(res.json.online.users);
      renderTopActive(res.json.top_active);
      M.refresh();
    });
  }

  // ------------------------------------------------------------ Tab và khởi động
  function openTab(name) {
    Object.keys(tabs).forEach(function (k) { tabs[k].hidden = k !== name; });
    tabBtns.forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === name)); });
    say('');
    if (name === 'home') loadHeroPhotos();
    if (name === 'media') loadMedia();
    if (name === 'stats') loadStats();
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
