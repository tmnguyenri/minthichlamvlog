/* Trang chủ: khi đã có bài viết thật (đăng trong khu quản lý), thay các bài mẫu bằng bài thật
   và cập nhật danh sách quốc gia. Chưa có bài nào thì giữ nguyên bài mẫu. */
(function () {
  'use strict';
  var M = window.MTLV, h = M.h;
  // Danh sách quốc gia/cờ đầy đủ (gần 250 nước) nằm ở js/countries.js, nạp trước tệp này.
  var FLAGS = M.FLAGS || {};
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function link(p) { return '/bai/' + encodeURIComponent(p.slug); }
  function en(el, value) { if (value) el.setAttribute('data-en', value); return el; }

  function flagOf(country) { return FLAGS[(country || '').toLowerCase()] || null; }
  // Cờ hiện bằng ký tự emoji cờ Unicode (hai ký tự "chữ cái chỉ vùng") suy thẳng từ mã ISO hai chữ của
  // nước đó — không cần tải ảnh, nên nước nào trong js/countries.js cũng có cờ sẵn, không riêng vài nước.
  function flagChars(code) {
    return String(code).toUpperCase().replace(/./g, function (c) { return String.fromCodePoint(127397 + c.charCodeAt(0)); });
  }
  function flagEmoji(code) { return h('span', { class: 'flag', 'aria-hidden': 'true', text: flagChars(code) }); }

  // "Thành phố, Quốc gia" (chỉ có một trong hai thì hiện một). Bản tiếng Anh dùng tên nước tiếng Anh nếu biết.
  function countryEl(country, city) {
    var f = flagOf(country);
    var vi = [city, country].filter(Boolean).join(', ');
    return en(h('span', { text: vi }), [city, f ? f[1] : country].filter(Boolean).join(', '));
  }

  function meta(p, withCountry) {
    var parts = [];
    if (withCountry && (p.country || p.city)) {
      var f = flagOf(p.country);
      parts.push(h('span', { class: 'meta__where' }, f ? flagEmoji(f[0]) : null, countryEl(p.country, p.city)));
    }
    var m = /^(\d{4})-(\d{2})$/.exec(p.trip_date || '');
    if (m) parts.push(en(h('time', { datetime: p.trip_date, text: 'Tháng ' + Number(m[2]) + '/' + m[1] }), MONTHS_EN[Number(m[2]) - 1] + ' ' + m[1]));
    if (p.days) parts.push(en(h('span', { text: p.days + ' ngày' }), p.days + (p.days === 1 ? ' day' : ' days')));
    var el = h('p', { class: 'meta' });
    parts.forEach(function (x, i) { if (i) el.appendChild(h('span', { class: 'meta__sep', 'aria-hidden': 'true' })); el.appendChild(x); });
    return el;
  }

  function titleLink(p) { return en(h('a', { class: 'stretch', href: link(p), text: p.title }), p.title_en); }

  function card(p) {
    return h('article', { class: 'card' },
      h('div', { class: 'card__media' },
        h('img', { src: M.postImage(p) || '/images/cover-default.svg', alt: '', width: 1600, height: 800, loading: 'lazy' })),
      h('div', { class: 'card__body' }, meta(p, true),
        h('h3', { class: 'card-title' }, titleLink(p)),
        p.excerpt ? en(h('p', { class: 'card__text', text: p.excerpt }), p.excerpt_en) : null));
  }

  // Dòng thời gian: xếp theo tháng đến địa danh (trip_date), mới nhất trên cùng, nhóm theo năm.
  function yearOf(p) {
    var m = /^(\d{4})-/.exec(p.trip_date || '');
    if (m) return m[1];
    return p.published_at ? String(new Date(p.published_at * 1000).getFullYear()) : '';
  }

  function arrivalLabel(p) {
    var m = /^(\d{4})-(\d{2})$/.exec(p.trip_date || '');
    if (!m) return null;
    var mm = Number(m[2]);
    return en(h('time', { class: 'tl-item__date', datetime: p.trip_date, text: 'Tháng ' + mm + '/' + m[1] }), MONTHS_EN[mm - 1] + ' ' + m[1]);
  }

  // Thẻ trong nhật ký: trước hết là địa điểm, tiêu đề và tóm tắt, sau đó là ảnh thu nhỏ vuông (tối đa 10 ảnh của bài).
  function photoIds(p) {
    var ids = [];
    try { ids = JSON.parse(p.image_ids || '[]'); } catch (e) { ids = []; }
    return ids.slice(0, 10).map(function (id) { return '/api/images/' + id; });
  }

  function flagPill(p) {
    var f = flagOf(p.country);
    if (!f && !p.country) return null;
    return h('span', { class: 'tl-card__flag' }, f ? flagEmoji(f[0]) : null, countryEl(p.country, p.city));
  }

  function timelineCard(p) {
    var srcs = photoIds(p);
    if (!srcs.length) srcs = [M.postImage(p) || '/images/cover-default.svg'];
    return h('article', { class: 'tl-card' },
      h('div', { class: 'tl-card__body' }, flagPill(p), meta(p, false),
        h('h3', { class: 'card-title' }, titleLink(p)),
        p.excerpt ? en(h('p', { class: 'card__text', text: p.excerpt }), p.excerpt_en) : null,
        en(h('a', { class: 'card-foot', href: link(p), text: 'Đọc tiếp' }), 'Continue reading')),
      h('a', { class: 'tl-card__photos', href: link(p), tabindex: '-1', 'aria-hidden': 'true' },
        srcs.map(function (src) { return h('img', { src: src, alt: '', width: 240, height: 240, loading: 'lazy' }); })));
  }

  function timeline(posts) {
    var out = [], lastYear = null, list = null;
    posts.forEach(function (p) {
      var y = yearOf(p);
      if (y !== lastYear) {
        out.push(h('h3', { class: 'timeline__year', text: y || '—' }));
        list = h('ol', { class: 'timeline__list' });
        out.push(list);
        lastYear = y;
      }
      list.appendChild(h('li', { class: 'tl-item' }, arrivalLabel(p), timelineCard(p)));
    });
    return out;
  }

  // Mỗi quốc gia một thẻ: tên, số bài và các thành phố đã đi (mới nhất trước, không lặp, tối đa 8).
  var MAX_CITIES = 8;
  function atlas(posts) {
    var groups = {};
    posts.forEach(function (p) {
      if (!p.country) return;
      var key = p.country.toLowerCase();
      var g = groups[key] = groups[key] || { name: p.country, posts: [], cities: [] };
      g.posts.push(p);
      var c = (p.city || '').trim();
      if (c && !g.cities.some(function (x) { return x.toLowerCase() === c.toLowerCase(); })) g.cities.push(c);
    });
    return Object.keys(groups).map(function (k) {
      var g = groups[k], f = flagOf(g.name), n = g.posts.length;
      var more = g.cities.length - MAX_CITIES;
      var cities = g.cities.length
        ? h('span', { class: 'country__cities', text: g.cities.slice(0, MAX_CITIES).join(', ') + (more > 0 ? ' +' + more : '') })
        : null;
      return h('a', { class: 'country', href: link(g.posts[0]) },
        f ? h('span', { class: 'atlas-flag' }, flagEmoji(f[0])) : null,
        h('span', {}, en(h('span', { class: 'country__name', text: g.name }), f && f[1]),
          en(h('span', { class: 'country__count', text: n + ' bài viết' }), n + (n === 1 ? ' post' : ' posts')),
          cities));
    });
  }

  // Bài mới nhất được tách riêng thành banner "nổi bật" ở đầu mục Nhật ký (khung #featured-post
  // trong index.html); các bài còn lại xếp vào dòng thời gian như trước.
  function featured(p) {
    return h('a', { class: 'featured', href: link(p) },
      h('img', { src: M.postImage(p) || '/images/cover-default.svg', alt: '' }),
      h('div', { class: 'featured__inner' }, meta(p, true),
        en(h('h3', { class: 'featured__title', text: p.title }), p.title_en),
        p.excerpt ? en(h('p', { class: 'featured__text', text: p.excerpt }), p.excerpt_en) : null));
  }

  // Cho js/slider.js dùng lại các hàm dựng cờ, tên nước và liên kết bài.
  M.kit = { link: link, flagOf: flagOf, flagEmoji: flagEmoji, countryEl: countryEl };

  function replaceChildren(el, nodes) { while (el.firstChild) el.removeChild(el.firstChild); nodes.forEach(function (n) { el.appendChild(n); }); }

  // Tên không lặp lại, giữ nguyên chữ hoa/thường của lần gặp đầu tiên (so khớp không phân biệt hoa thường).
  function distinctBy(posts, key) {
    var seen = {}, out = [];
    posts.forEach(function (p) {
      var v = (p[key] || '').trim();
      if (!v || seen[v.toLowerCase()]) return;
      seen[v.toLowerCase()] = true;
      out.push(v);
    });
    return out;
  }

  // "5 Bài viết · 4 Điểm đến" ở đầu trang: số bài và số thành phố/địa danh khác nhau đã đi qua
  // (khớp với nhãn tiếng Anh "Cities" — không phải số quốc gia, mục đó là nhóm theo quốc gia ở Bản đồ bên dưới).
  function updateStats(postCount, placeCount) {
    var nums = document.querySelectorAll('.hero__stats .hero__stat strong');
    if (nums[0]) nums[0].textContent = String(postCount);
    if (nums[1]) nums[1].textContent = String(placeCount);
  }

  // Dải chữ chạy trang trí: tên các quốc gia rồi thành phố đã có bài, lặp hai lần để chạy liền mạch
  // (xem @keyframes mtlv-marquee trong style.css: translateX(-50%) cần đúng hai bản giống hệt nhau).
  // Chưa có địa danh nào (bài chưa điền quốc gia/thành phố) thì ẩn cả dải thay vì để trống trơ.
  function updateTicker(labels) {
    var track = document.querySelector('.ticker__track');
    var section = track ? track.closest('.ticker') : null;
    if (!track || !section) return;
    section.hidden = !labels.length;
    if (!labels.length) return;
    replaceChildren(track, labels.concat(labels).map(function (t) { return h('span', { text: t }); }));
  }

  fetch('/api/posts?limit=50', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var posts = (d && d.posts) || [];
      if (!posts.length) return;

      var slot = document.getElementById('featured-post');
      if (slot) replaceChildren(slot, [featured(posts[0])]);

      var cards = document.querySelector('#nhat-ky .cards');
      if (cards) {
        cards.classList.add('is-timeline');
        replaceChildren(cards, timeline(posts.slice(1, 13)));
      }

      var countries = distinctBy(posts, 'country');
      var cities = distinctBy(posts, 'city');
      var places = document.querySelector('#ban-do .atlas');
      var items = atlas(posts);
      if (places && items.length) replaceChildren(places, items);

      updateStats(posts.length, cities.length);
      updateTicker(countries.concat(cities));

      M.refresh();
      // Báo cho dải ảnh ở đầu trang biết đã có bài thật để lấy ảnh bìa.
      document.dispatchEvent(new CustomEvent('mtlv:posts', { detail: { posts: posts } }));
    })
    .catch(function () { /* giữ nguyên bài mẫu */ });
})();
