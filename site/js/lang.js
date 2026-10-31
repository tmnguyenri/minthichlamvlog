/* Chuyển ngôn ngữ Việt / Anh.
 *
 * Trang luôn được viết sẵn bằng tiếng Việt trong HTML (mặc định, và là bản công cụ tìm kiếm đọc).
 * Mọi phần tử có thuộc tính data-en="..." sẽ được thay bằng bản tiếng Anh khi người xem bấm EN.
 * Phần tử không có data-en giữ nguyên tiếng Việt.
 *
 * Thuộc tính được hỗ trợ:
 *   data-en                   thay nội dung chữ của phần tử (chỉ chữ thuần, không chứa thẻ con)
 *   data-en-aria-label        thay aria-label
 *   data-en-alt               thay alt của ảnh
 *   data-en-title             thay thuộc tính title
 *   data-en-content           thay content của thẻ <meta>
 *
 * Lựa chọn của người xem được nhớ trong trình duyệt. Có thể ép ngôn ngữ bằng ?lang=en hoặc ?lang=vi.
 */
(function () {
  'use strict';

  var KEY = 'mtlv-lang';
  var ATTRS = ['aria-label', 'alt', 'title', 'content'];
  var root = document.documentElement;

  function valid(l) { return l === 'vi' || l === 'en'; }

  function readChoice() {
    try {
      var q = new URLSearchParams(window.location.search).get('lang');
      if (valid(q)) { save(q); return q; }
    } catch (e) { /* bỏ qua */ }
    try {
      var s = window.localStorage.getItem(KEY);
      if (valid(s)) return s;
    } catch (e) { /* bỏ qua */ }
    return 'vi';
  }

  function save(l) {
    try { window.localStorage.setItem(KEY, l); } catch (e) { /* bỏ qua */ }
  }

  function reveal() { root.classList.remove('i18n-pending'); }

  var current = readChoice();
  root.classList.add('js');
  root.setAttribute('data-lang', current);
  if (current === 'en') {
    root.classList.add('i18n-pending');
    window.setTimeout(reveal, 2500); // phòng khi có lỗi, trang vẫn hiện ra
  }

  function swapText(l) {
    var nodes = document.querySelectorAll('[data-en]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el.hasAttribute('data-vi')) el.setAttribute('data-vi', el.textContent);
      el.textContent = el.getAttribute(l === 'en' ? 'data-en' : 'data-vi');
      if (el.tagName === 'TITLE') continue;
      if (l === 'en') el.setAttribute('lang', 'en'); else el.removeAttribute('lang');
    }
  }

  function swapAttrs(l) {
    ATTRS.forEach(function (a) {
      var nodes = document.querySelectorAll('[data-en-' + a + ']');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (!el.hasAttribute('data-vi-' + a)) el.setAttribute('data-vi-' + a, el.getAttribute(a) || '');
        el.setAttribute(a, el.getAttribute(l === 'en' ? 'data-en-' + a : 'data-vi-' + a));
      }
    });
  }

  function markButtons(l) {
    var btns = document.querySelectorAll('[data-set-lang]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', String(btns[i].getAttribute('data-set-lang') === l));
    }
  }

  function apply(l) {
    try {
      swapText(l);
      swapAttrs(l);
      root.setAttribute('data-lang', l);
      markButtons(l);
    } finally {
      reveal();
    }
  }

  // Cho các tệp js khác gọi sau khi thêm nội dung mới vào trang.
  window.mtlvI18n = { refresh: function () { if (current === 'en') apply('en'); } };

  function init() {
    if (current === 'en') apply('en'); else markButtons('vi');
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-set-lang]') : null;
      if (!b) return;
      var l = b.getAttribute('data-set-lang');
      if (!valid(l) || l === current) return;
      current = l;
      save(l);
      apply(l);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
