/* Trang chủ: khi đã có bài viết thật (đăng trong khu quản lý), thay các bài mẫu bằng bài thật
   và cập nhật danh sách quốc gia. Chưa có bài nào thì giữ nguyên bài mẫu. */
(function () {
  'use strict';
  var M = window.MTLV, h = M.h;
  var FLAGS = {
    'việt nam': ['vn', 'Vietnam'], 'vietnam': ['vn', 'Vietnam'],
    'nhật bản': ['jp', 'Japan'], 'japan': ['jp', 'Japan'],
    'bồ đào nha': ['pt', 'Portugal'], 'portugal': ['pt', 'Portugal'],
    'mexico': ['mx', 'Mexico']
  };
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function link(p) { return '/bai/' + encodeURIComponent(p.slug); }
  function en(el, value) { if (value) el.setAttribute('data-en', value); return el; }

  function flagOf(country) { return FLAGS[(country || '').toLowerCase()] || null; }
  function flagImg(code) { return h('img', { class: 'flag', src: '/images/flags/' + code + '.svg', alt: '', width: 36, height: 24 }); }

  function countryEl(country) {
    var f = flagOf(country);
    return en(h('span', { text: country }), f && f[1]);
  }

  function meta(p, withCountry) {
    var parts = [];
    if (withCountry && p.country) {
      var f = flagOf(p.country);
      parts.push(h('span', { class: 'meta__where' }, f ? flagImg(f[0]) : null, countryEl(p.country)));
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
        h('img', { src: p.cover || '/images/cover-default.svg', alt: '', width: 1600, height: 800, loading: 'lazy' })),
      h('div', { class: 'card__body' }, meta(p, true),
        h('h3', { class: 'card-title' }, titleLink(p)),
        p.excerpt ? en(h('p', { class: 'card__text', text: p.excerpt }), p.excerpt_en) : null));
  }

  function atlas(posts) {
    var groups = {};
    posts.forEach(function (p) {
      if (!p.country) return;
      var key = p.country.toLowerCase();
      (groups[key] = groups[key] || { name: p.country, posts: [] }).posts.push(p);
    });
    return Object.keys(groups).map(function (k) {
      var g = groups[k], f = flagOf(g.name), n = g.posts.length;
      return h('a', { class: 'country', href: link(g.posts[0]) },
        f ? flagImg(f[0]) : null,
        h('span', {}, en(h('span', { class: 'country__name', text: g.name }), f && f[1]),
          en(h('span', { class: 'country__count', text: n + ' bài viết' }), n + (n === 1 ? ' post' : ' posts'))));
    });
  }

  function replaceChildren(el, nodes) { while (el.firstChild) el.removeChild(el.firstChild); nodes.forEach(function (n) { el.appendChild(n); }); }

  fetch('/api/posts?limit=50', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var posts = (d && d.posts) || [];
      if (!posts.length) return;

      var cards = document.querySelector('#nhat-ky .cards');
      if (cards) replaceChildren(cards, posts.slice(0, 12).map(card));

      var places = document.querySelector('#ban-do .atlas');
      var items = atlas(posts);
      if (places && items.length) replaceChildren(places, items);

      M.refresh();
    })
    .catch(function () { /* giữ nguyên bài mẫu */ });
})();
