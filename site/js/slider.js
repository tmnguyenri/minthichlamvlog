/* Trang chủ: dải ảnh chạy ở đầu trang.
   - Thứ tự ảnh được xáo ngẫu nhiên mỗi lần mở trang, tự chuyển sau vài giây.
   - Bấm vào ảnh sẽ mở bài viết có ảnh đó (mỗi ảnh là một liên kết).
   - Có nút trước / sau / tạm dừng, phím mũi tên, và vuốt ngang trên điện thoại.
   - Dừng khi rê chuột vào, khi đang tập trung bàn phím trong dải, khi tab bị ẩn,
     và không tự chạy nếu người xem chọn "giảm chuyển động" trong hệ điều hành.
   - Ban đầu dùng các ảnh mẫu có sẵn trong HTML. Khi posts.js nạp được bài thật,
     nó bắn sự kiện "mtlv:posts" và dải ảnh chuyển sang dùng ảnh bìa của các bài đó. */
(function () {
  'use strict';
  var M = window.MTLV;
  var root = document.getElementById('showcase');
  if (!M || !root) return;

  var h = M.h;
  var stage = root.querySelector('.showcase__stage');
  var box = root.querySelector('.showcase__slides');
  var controls = root.querySelector('.showcase__controls');
  var toggle = root.querySelector('.showcase__toggle');
  var INTERVAL = 5500;   // mili giây giữa hai ảnh
  var MAX = 8;           // số ảnh tối đa trong dải
  var SWIPE = 45;        // quãng vuốt tối thiểu (px)

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var slides = [], index = 0, timer = 0;
  var userPaused = reduce, hovering = false, focusing = false;
  var startX = null, swipedAt = 0;

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function imgOf(slide) { return slide.querySelector('.slide__img'); }
  // Ảnh lười tải: gọi trước ảnh kế tiếp để lúc chuyển không bị trống.
  function warm(i) {
    var img = slides.length ? imgOf(slides[(i + slides.length) % slides.length]) : null;
    if (img && img.getAttribute('loading') === 'lazy') img.setAttribute('loading', 'eager');
  }

  function canPlay() { return slides.length > 1 && !userPaused && !hovering && !focusing && !document.hidden; }

  function schedule() {
    window.clearTimeout(timer);
    stage.setAttribute('aria-live', canPlay() ? 'off' : 'polite');
    if (!canPlay()) return;
    timer = window.setTimeout(function () { show(index + 1); schedule(); }, INTERVAL);
  }

  function show(n) {
    if (!slides.length) return;
    n = (n + slides.length) % slides.length;
    if (n === index && slides[n].classList.contains('is-active')) return;
    slides[index].classList.remove('is-active');
    slides[n].classList.add('is-active');
    index = n;
    warm(n + 1);
  }

  function go(n) { show(n); schedule(); }

  function syncToggle() {
    toggle.setAttribute('aria-pressed', String(!userPaused));
    toggle.setAttribute('data-state', userPaused ? 'paused' : 'playing');
  }

  // Nhận một danh sách phần tử .slide đã nằm trong (hoặc sắp đưa vào) dải, xáo ngẫu nhiên rồi chạy.
  function setup(list) {
    slides = shuffle(list);
    slides.forEach(function (s, i) {
      box.appendChild(s);
      s.classList.toggle('is-active', i === 0);
      s.setAttribute('aria-label', (i + 1) + ' / ' + slides.length);
    });
    index = 0;
    warm(0); warm(1);
    controls.hidden = slides.length < 2;
    syncToggle();
    root.hidden = !slides.length;
    root.classList.add('is-ready');
    M.refresh();
    schedule();
  }

  // ---- Dựng ảnh từ bài thật ----
  function en(el, value) { if (value) el.setAttribute('data-en', value); return el; }

  function slideFor(p, kit) {
    var f = kit.flagOf(p.country);
    return h('div', { class: 'slide', role: 'group', 'aria-roledescription': 'slide' },
      h('a', { class: 'slide__link', href: kit.link(p) },
        h('img', { class: 'slide__img', src: M.postImage(p), alt: '', width: 1600, height: 800, loading: 'lazy' }),
        h('span', { class: 'slide__caption' },
          p.country ? h('span', { class: 'slide__where' }, f ? kit.flagImg(f[0]) : null, kit.countryEl(p.country)) : null,
          en(h('span', { class: 'slide__title', text: p.title }), p.title_en))));
  }

  document.addEventListener('mtlv:posts', function (ev) {
    var kit = M.kit, posts = (ev.detail && ev.detail.posts) || [];
    if (!kit) return;
    var picked = shuffle(posts.filter(function (p) { return p && M.postImage(p); })).slice(0, MAX);
    while (box.firstChild) box.removeChild(box.firstChild);
    setup(picked.map(function (p) { return slideFor(p, kit); }));
  });

  // ---- Điều khiển ----
  root.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-slide]') : null;
    if (!b) return;
    go(index + (b.getAttribute('data-slide') === 'next' ? 1 : -1));
  });

  toggle.addEventListener('click', function () { userPaused = !userPaused; syncToggle(); schedule(); });

  stage.addEventListener('mouseenter', function () { hovering = true; schedule(); });
  stage.addEventListener('mouseleave', function () { hovering = false; schedule(); });
  // Chỉ dừng khi đang dùng bàn phím trong dải; bấm chuột vào nút không làm dải dừng mãi.
  root.addEventListener('focusin', function (e) {
    focusing = !!(e.target.matches && e.target.matches(':focus-visible'));
    schedule();
  });
  root.addEventListener('focusout', function (e) {
    if (!e.relatedTarget || !root.contains(e.relatedTarget)) { focusing = false; schedule(); }
  });
  document.addEventListener('visibilitychange', schedule);

  root.addEventListener('keydown', function (e) {
    if (slides.length < 2) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  });

  // Vuốt ngang trên màn hình cảm ứng (chuột dùng nút bấm).
  stage.addEventListener('pointerdown', function (e) { startX = e.pointerType === 'mouse' ? null : e.clientX; });
  stage.addEventListener('pointercancel', function () { startX = null; });
  stage.addEventListener('pointerup', function (e) {
    if (startX === null) return;
    var dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) < SWIPE || slides.length < 2) return;
    swipedAt = Date.now();
    go(index + (dx < 0 ? 1 : -1));
  });
  // Một cú vuốt không được tính là bấm vào ảnh.
  stage.addEventListener('click', function (e) {
    if (Date.now() - swipedAt < 400) { e.preventDefault(); swipedAt = 0; }
  }, true);

  setup([].slice.call(box.children));
})();
