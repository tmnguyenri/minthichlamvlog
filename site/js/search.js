/* Ô tìm kiếm ở đầu trang: gõ từ khoá rồi xem ngay các bài khớp, kèm đoạn trích đúng chỗ khớp.
   Máy chủ làm phần tìm (functions/api/search.js): tiêu đề, tóm tắt, địa điểm và toàn bộ nội dung của
   bài đã đăng, không phân biệt hoa/thường, không cần gõ dấu. Không có JavaScript thì ô này không xuất
   hiện và phần còn lại của trang vẫn nguyên vẹn như trước. */
(function () {
  'use strict';

  var header = document.querySelector('.site-header__inner');
  if (!header) return;

  var MIN = 2;
  var MAX_SHOWN = 8;
  var DEBOUNCE = 220;
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var seq = 0;
  var timer = 0;

  function lang() { return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'vi'; }
  function t(vi, en) { return lang() === 'en' ? en : vi; }

  // Dựng phần tử bằng DOM, không dùng innerHTML: chữ từ máy chủ luôn vào dưới dạng text node.
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function fold(text) {
    return String(text || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, function (c) { return c === 'đ' ? 'd' : 'D'; })
      .toLowerCase();
  }

  // Tô sáng chỗ khớp trong một đoạn chữ. Bản bỏ dấu giữ nguyên độ dài từng ký tự nên vị trí khớp dùng
  // thẳng được cho bản gốc; nếu vì lý do nào đó độ dài lệch thì thôi không tô, chỉ hiện chữ thường.
  function highlighted(text, foldedQuery) {
    var folded = fold(text);
    if (folded.length !== text.length) return [document.createTextNode(text)];
    var marks = [];
    foldedQuery.split(' ').forEach(function (term) {
      if (term.length < MIN) return;
      var at = folded.indexOf(term);
      while (at > -1) {
        marks.push([at, at + term.length]);
        at = folded.indexOf(term, at + term.length);
      }
    });
    if (!marks.length) return [document.createTextNode(text)];
    marks.sort(function (a, b) { return a[0] - b[0]; });
    var out = [];
    var pos = 0;
    marks.forEach(function (m) {
      var from = Math.max(m[0], pos);
      if (m[1] <= from) return;
      if (from > pos) out.push(document.createTextNode(text.slice(pos, from)));
      out.push(el('mark', {}, [text.slice(from, m[1])]));
      pos = m[1];
    });
    if (pos < text.length) out.push(document.createTextNode(text.slice(pos)));
    return out;
  }

  function monthLabel(value) {
    var m = /^(\d{4})-(\d{2})$/.exec(value || '');
    if (!m) return '';
    return lang() === 'en' ? MONTHS_EN[Number(m[2]) - 1] + ' ' + m[1] : 'Tháng ' + Number(m[2]) + '/' + m[1];
  }

  function icon() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'nav-search__icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', '11');
    circle.setAttribute('cy', '11');
    circle.setAttribute('r', '7');
    var stem = document.createElementNS(ns, 'path');
    stem.setAttribute('d', 'M16.4 16.4 21 21');
    svg.appendChild(circle);
    svg.appendChild(stem);
    return svg;
  }

  var input = el('input', {
    class: 'nav-search__input',
    id: 'site-search-input',
    type: 'search',
    name: 'q',
    autocomplete: 'off',
    enterkeyhint: 'search',
    'aria-label': 'Tìm bài viết, địa điểm',
    'data-en-aria-label': 'Search posts, places',
    'aria-expanded': 'false',
    'aria-controls': 'site-search-results',
    placeholder: 'Tìm bài viết, địa điểm…',
    'data-en-placeholder': 'Search posts, places…',
  });
  input.setAttribute('aria-autocomplete', 'list');

  var button = el('button', {
    class: 'nav-search__btn',
    type: 'submit',
    'aria-label': 'Tìm',
    'data-en-aria-label': 'Search',
  }, [icon()]);

  var list = el('ul', { class: 'search-results__list' });
  var status = el('p', { class: 'search-results__status', role: 'status' });
  var panel = el('div', { class: 'search-results', id: 'site-search-results', hidden: true }, [status, list]);
  var form = el('form', { class: 'nav-search', role: 'search', action: '/', method: 'get' }, [input, button, panel]);

  var langSwitch = header.querySelector('.lang-switch');
  if (langSwitch) header.insertBefore(form, langSwitch); else header.appendChild(form);
  if (window.mtlvI18n) window.mtlvI18n.refresh(); // để bản tiếng Anh (nếu đang chọn) áp lên ô vừa chèn

  function clearList() { while (list.firstChild) list.removeChild(list.firstChild); }

  function setActive(index) {
    var items = list.querySelectorAll('.search-results__item');
    Array.prototype.forEach.call(items, function (li, n) { li.classList.toggle('is-active', n === index); });
  }

  function close() {
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
  }

  function hitNode(hit, foldedQuery) {
    var title = lang() === 'en' && hit.title_en ? hit.title_en : hit.title;
    var where = [hit.city, hit.country].filter(Boolean).join(', ');
    var when = monthLabel(hit.trip_date);
    var meta = [where, when].filter(Boolean).join(' · ');
    var link = el('a', { class: 'search-results__hit', href: '/bai/' + encodeURIComponent(hit.slug) }, [
      el('span', { class: 'search-results__title' }, highlighted(title, foldedQuery)),
      hit.snippet ? el('span', { class: 'search-results__snippet' }, highlighted(hit.snippet, foldedQuery)) : null,
      meta ? el('span', { class: 'search-results__meta', text: meta }) : null,
    ]);
    return el('li', { class: 'search-results__item' }, [link]);
  }

  function run(value) {
    var query = String(value || '').replace(/\s+/g, ' ').trim();
    var foldedQuery = fold(query);
    if (foldedQuery.length < MIN) { clearList(); close(); return; }
    var mine = ++seq;
    clearList();
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    status.textContent = t('Đang tìm…', 'Searching…');
    fetch('/api/search?q=' + encodeURIComponent(query), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (mine !== seq) return;   // người xem đã gõ tiếp: bỏ kết quả cũ
        var hits = (data && data.results) || [];
        status.textContent = hits.length
          ? t(hits.length + ' bài khớp “' + query + '”', hits.length + (hits.length === 1 ? ' post matches “' : ' posts match “') + query + '”')
          : t('Không tìm thấy bài nào khớp “' + query + '”.', 'No posts match “' + query + '”.');
        hits.slice(0, MAX_SHOWN).forEach(function (hit) { list.appendChild(hitNode(hit, foldedQuery)); });
      })
      .catch(function () {
        if (mine !== seq) return;
        status.textContent = t('Không kết nối được. Hãy thử lại.', 'Could not connect. Please try again.');
      });
  }

  input.addEventListener('input', function () {
    window.clearTimeout(timer);
    var value = input.value;
    timer = window.setTimeout(function () { run(value); }, DEBOUNCE);
  });

  input.addEventListener('focus', function () {
    if (!panel.hidden) return;
    if (fold(input.value).trim().length < MIN) return;
    run(input.value);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; clearList(); close(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    var links = list.querySelectorAll('.search-results__hit');
    if (!links.length) return;
    e.preventDefault();
    var current = -1;
    Array.prototype.forEach.call(links, function (a, n) { if (a.parentNode.classList.contains('is-active')) current = n; });
    var next = e.key === 'ArrowDown'
      ? (current + 1) % links.length
      : (current <= 0 ? links.length - 1 : current - 1);
    setActive(next);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var active = list.querySelector('.search-results__item.is-active .search-results__hit') || list.querySelector('.search-results__hit');
    if (active) { window.location.href = active.getAttribute('href'); return; }
    run(input.value);
  });

  document.addEventListener('click', function (e) {
    if (!form.contains(e.target)) close();
  });

  // Mở sẵn kết quả khi trang được mở từ một liên kết có ?q= (ví dụ dán địa chỉ tìm kiếm cho người khác).
  try {
    var initial = new URLSearchParams(window.location.search).get('q');
    if (initial) { input.value = initial; run(initial); }
  } catch (e) { /* trình duyệt quá cũ: bỏ qua, ô tìm kiếm vẫn dùng bình thường */ }
})();
