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
 *
 * Trang bài viết có hai địa chỉ riêng (/bai/... tiếng Việt và /en/bai/... tiếng Anh) nối với nhau bằng
 * <link rel="alternate" hreflang="...">. Ở các trang đó, nút VI / EN chuyển sang địa chỉ của ngôn ngữ kia
 * thay vì đổi chữ tại chỗ, và ai đang chọn EN mở địa chỉ tiếng Việt sẽ được đưa sang bản tiếng Anh.
 * Trang tiếng Anh riêng đặt data-fixed-lang="en" trên <html>: chữ đã là tiếng Anh từ máy chủ nên không đổi gì tại chỗ.
 */
(function () {
  'use strict';

  var KEY = 'mtlv-lang';
  var ATTRS = ['aria-label', 'alt', 'title', 'content'];
  var root = document.documentElement;

  function valid(l) { return l === 'vi' || l === 'en'; }

  var fixed = root.getAttribute('data-fixed-lang');
  if (!valid(fixed)) fixed = '';

  // Đường dẫn của bản ngôn ngữ khác của trang này (nếu có), lấy từ <link rel="alternate" hreflang>.
  // Chỉ lấy phần đường dẫn để vẫn đúng khi mở bằng bản xem trước hay chạy thử trên máy.
  function alternate(l) {
    var link = document.querySelector('link[rel="alternate"][hreflang="' + l + '"]');
    if (!link) return '';
    try {
      var path = new URL(link.getAttribute('href'), window.location.href).pathname;
      return path !== window.location.pathname ? path : '';
    } catch (e) { return ''; }
  }

  function readChoice() {
    if (fixed) { save(fixed); return fixed; }
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
  // Đang chọn EN mà mở địa chỉ tiếng Việt của một bài đã có bản tiếng Anh riêng: sang thẳng bản tiếng Anh.
  if (!fixed && current === 'en') {
    var toEn = alternate('en');
    if (toEn) {
      window.mtlvI18n = { refresh: function () {} };
      window.location.replace(toEn);
      return;
    }
  }
  root.classList.add('js');
  root.setAttribute('data-lang', current);
  if (current === 'en' && !fixed) {
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
    if (fixed) markButtons(fixed);
    else if (current === 'en') apply('en');
    else markButtons('vi');
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-set-lang]') : null;
      if (!b) return;
      var l = b.getAttribute('data-set-lang');
      if (!valid(l) || l === current) return;
      var target = alternate(l);
      current = l;
      save(l);
      if (target) { window.location.assign(target); return; }
      apply(l);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
