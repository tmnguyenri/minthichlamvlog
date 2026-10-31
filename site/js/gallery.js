/* Thư viện ảnh (trang thu-vien.html).
 * Chỉ chủ trang mới thấy phần tải lên và danh sách. Ảnh được thu nhỏ và nén thành JPEG trong trình duyệt
 * trước khi gửi, để nằm dưới giới hạn 400 KB của máy chủ.
 */
(function () {
  'use strict';

  var compress = window.mtlvPhoto.compress;
  var EN = document.documentElement.getAttribute('data-lang') === 'en';
  function t(vi, en) { return EN ? en : vi; }

  var root = document.getElementById('gallery-root');
  var msg = document.getElementById('gallery-msg');
  var form = document.getElementById('upload-form');
  var fileInput = document.getElementById('file-input');
  var dropzone = document.getElementById('dropzone');
  var uploadBtn = document.getElementById('upload-btn');
  var preview = document.getElementById('preview');
  var previewImg = document.getElementById('preview-img');
  var previewInfo = document.getElementById('preview-info');
  var captionInput = document.getElementById('caption');
  var grid = document.getElementById('image-grid');
  var empty = document.getElementById('empty');
  var count = document.getElementById('count');

  var pending = null; // { blob, name } sau khi nén

  function say(text, kind) {
    msg.textContent = text;
    msg.className = 'notice gallery-notice' + (kind ? ' notice--' + kind : '');
    msg.hidden = !text;
  }

  function bytesText(n) { return (n / 1024).toFixed(0) + ' KB'; }

  function chooseFile(file) {
    pending = null;
    uploadBtn.disabled = true;
    preview.hidden = true;
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      say(t('Chỉ nhận ảnh JPEG, PNG hoặc WebP.', 'Only JPEG, PNG or WebP images are accepted.'), 'error');
      fileInput.value = '';
      return;
    }
    say(t('Đang nén ảnh…', 'Compressing image…'), 'info');
    compress(file).then(function (blob) {
      pending = { blob: blob, name: file.name };
      previewImg.src = URL.createObjectURL(blob);
      previewInfo.textContent = t('Sau khi nén: ', 'After compression: ') + bytesText(blob.size) + ' · JPEG';
      preview.hidden = false;
      uploadBtn.disabled = false;
      say('', null);
    }).catch(function () {
      say(t('Không đọc được ảnh này. Thử ảnh khác.', 'Could not read this image. Try another one.'), 'error');
    });
  }

  fileInput.addEventListener('change', function () { chooseFile(fileInput.files[0]); });

  ['dragenter', 'dragover'].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('is-over'); });
  });
  dropzone.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) chooseFile(f);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!pending) return;
    uploadBtn.disabled = true;
    say(t('Đang tải lên…', 'Uploading…'), 'info');
    var url = '/api/images?caption=' + encodeURIComponent(captionInput.value.trim());
    fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'image/jpeg' },
      body: pending.blob,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (res) {
      if (!res.ok) {
        var m = res.d && res.d.message;
        say(m ? (EN ? m.en : m.vi) : t('Tải lên thất bại.', 'Upload failed.'), 'error');
        uploadBtn.disabled = false;
        return;
      }
      say(t('Đã tải lên ảnh.', 'Photo uploaded.'), 'success');
      pending = null;
      preview.hidden = true;
      form.reset();
      loadImages();
    }).catch(function () {
      say(t('Lỗi mạng, thử lại sau.', 'Network error, try again later.'), 'error');
      uploadBtn.disabled = false;
    });
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error('no clipboard'));
  }

  function render(images) {
    grid.textContent = '';
    count.textContent = images.length ? images.length + t(' ảnh', ' photos') : '';
    empty.hidden = images.length > 0;
    images.forEach(function (img) {
      var li = document.createElement('li');
      li.className = 'image-card';

      var pic = document.createElement('img');
      pic.src = '/api/images/' + img.id;
      pic.alt = img.caption || '';
      pic.loading = 'lazy';
      pic.width = 400;
      pic.height = 300;
      li.appendChild(pic);

      var cap = document.createElement('p');
      cap.className = 'image-card__caption';
      cap.textContent = img.caption || t('(không có chú thích)', '(no caption)');
      li.appendChild(cap);

      var meta = document.createElement('p');
      meta.className = 'image-card__meta';
      meta.textContent = '#' + img.id + ' · ' + bytesText(img.size);
      li.appendChild(meta);

      var actions = document.createElement('div');
      actions.className = 'image-card__actions';

      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'btn btn--ghost btn--xs';
      copy.textContent = t('Sao chép liên kết', 'Copy link');
      copy.addEventListener('click', function () {
        var md = '![' + (img.caption || '') + '](/api/images/' + img.id + ')';
        copyText(md).then(function () {
          say(t('Đã sao chép: ', 'Copied: ') + md, 'success');
        }).catch(function () {
          say(md, 'info');
        });
      });
      actions.appendChild(copy);

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn--ghost btn--xs image-card__delete';
      del.textContent = t('Xóa', 'Delete');
      del.addEventListener('click', function () {
        if (!window.confirm(t('Xóa ảnh này? Bài viết đang dùng ảnh sẽ bị hỏng.', 'Delete this photo? Posts using it will break.'))) return;
        fetch('/api/images/' + img.id, { method: 'DELETE', credentials: 'same-origin' })
          .then(function (r) {
            if (r.status === 204) { loadImages(); return; }
            say(t('Không xóa được ảnh.', 'Could not delete the photo.'), 'error');
          });
      });
      actions.appendChild(del);

      li.appendChild(actions);
      grid.appendChild(li);
    });
  }

  function loadImages() {
    fetch('/api/images', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) { render((d && d.images) || []); })
      .catch(function () { say(t('Không tải được danh sách ảnh.', 'Could not load the photo list.'), 'error'); });
  }

  function showLocked() {
    say(t('Khu này chỉ dành cho chủ trang. ', 'This area is for the site owner only. '), 'info');
    var a = document.createElement('a');
    a.href = 'dang-nhap.html';
    a.textContent = t('Đăng nhập', 'Log in');
    msg.appendChild(a);
  }

  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.user && d.user.role === 'admin') {
        root.hidden = false;
        loadImages();
      } else {
        showLocked();
      }
    })
    .catch(function () { showLocked(); });
})();
