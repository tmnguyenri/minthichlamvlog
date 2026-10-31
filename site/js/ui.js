/* Tiện ích giao diện dùng chung cho các trang có đăng nhập: ngôn ngữ, gọi máy chủ, dựng phần tử. */
(function () {
  'use strict';
  var root = document.documentElement;

  function lang() { return root.getAttribute('data-lang') === 'en' ? 'en' : 'vi'; }
  function t(vi, en) { return lang() === 'en' ? en : vi; }

  // Gọi máy chủ, luôn trả về { ok, status, json }.
  function api(method, url, body) {
    var opt = { method: method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, json: j }; });
    }).catch(function () { return { ok: false, status: 0, json: {} }; });
  }

  // Lấy thông báo lỗi theo ngôn ngữ đang chọn (máy chủ trả sẵn cả hai).
  function msgOf(res) {
    var m = res.json && res.json.message;
    if (m) return m[lang()] || m.vi;
    return t('Không kết nối được. Hãy thử lại.', 'Could not connect. Please try again.');
  }

  // Dựng phần tử bằng DOM (không dùng innerHTML nên không thể chèn mã độc).
  // h('button', { class: 'btn', text: 'Lưu', 'data-en': 'Save', onclick: fn }, con1, con2)
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  // Phần tử chữ có sẵn hai ngôn ngữ.
  function tx(tag, vi, en, attrs) {
    var a = attrs || {};
    a.text = vi; a['data-en'] = en;
    return h(tag, a);
  }

  function show(el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
    el.className = 'notice' + (kind ? ' notice--' + kind : '');
  }

  function refresh() { if (window.mtlvI18n) window.mtlvI18n.refresh(); }

  // Ảnh đại diện của bài trên trang chủ: một ảnh ngẫu nhiên trong ảnh đã tải lên, hoặc ảnh bìa, hoặc rỗng.
  function postImage(p) {
    if (p && p.image_id) return '/api/images/' + p.image_id;
    return (p && p.cover) || '';
  }

  // Đường dẫn gọn /nhat-ky và /ban-do: cuộn tới đúng mục trên trang chủ sau khi trang tải xong.
  var SECTIONS = { '/nhat-ky': 'nhat-ky', '/ban-do': 'ban-do' };
  var target = SECTIONS[window.location.pathname.replace(/\/+$/, '')];
  if (target) {
    window.addEventListener('load', function () {
      var el = document.getElementById(target);
      if (el) el.scrollIntoView({ block: 'start' });
    });
  }

  window.MTLV = { lang: lang, t: t, api: api, msgOf: msgOf, h: h, tx: tx, show: show, refresh: refresh, postImage: postImage };
})();
