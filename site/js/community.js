/* Góc cộng đồng ở trang chủ: ai đang online và 5 người hoạt động nhiều nhất.
   Lấy từ /api/community (công khai, không cần đăng nhập, chỉ tên hiển thị) rồi điền vào hai danh sách.
   Không lấy được (chưa có JS, lỗi mạng…) thì giữ nguyên hai dòng thông báo trống đã có sẵn trong HTML. */
(function () {
  'use strict';
  var M = window.MTLV, h = M.h, tx = M.tx;

  function initial(name) { return (String(name || '').trim().charAt(0) || '?').toUpperCase(); }

  function onlineItem(u) {
    return h('li', { class: 'online-list__item' },
      h('span', { class: 'online-list__avatar', 'aria-hidden': 'true', text: initial(u.display_name) }),
      h('span', { class: 'online-list__name', text: u.display_name }));
  }

  function topItem(u) {
    var posts = u.posts || 0, comments = u.comments || 0;
    var en = posts + (posts === 1 ? ' post' : ' posts') + ' · ' + comments + (comments === 1 ? ' comment' : ' comments');
    return h('li', { class: 'top-list__item' },
      h('span', { class: 'top-list__rank', 'aria-hidden': 'true' }),
      h('div', { class: 'top-list__body' },
        h('span', { class: 'top-list__name', text: u.display_name }),
        tx('span', posts + ' bài · ' + comments + ' bình luận', en, { class: 'top-list__meta' })));
  }

  function replaceChildren(el, nodes) { while (el.firstChild) el.removeChild(el.firstChild); nodes.forEach(function (n) { el.appendChild(n); }); }

  // Số lớn hiện gọn hơn với dấu chấm ngăn nghìn kiểu Việt Nam (vd. 12.345), không đổi theo ngôn ngữ trang.
  function formatCount(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  var onlineList = document.getElementById('online-list');
  var topList = document.getElementById('top-list');
  if (!onlineList || !topList) return;

  fetch('/api/community', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var online = (d && d.online) || [];
      var top = (d && d.top_active) || [];
      var viewsTotal = (d && d.views_total) || 0;

      replaceChildren(onlineList, online.map(onlineItem));
      document.getElementById('online-empty').hidden = online.length > 0;

      replaceChildren(topList, top.map(topItem));
      document.getElementById('top-empty').hidden = top.length > 0;

      var views = document.getElementById('community-views');
      if (views && viewsTotal > 0) {
        document.getElementById('community-views-count').textContent = formatCount(viewsTotal);
        views.hidden = false;
      }

      M.refresh();
    })
    .catch(function () { /* giữ nguyên hai thông báo trống mặc định, không hiện dòng lượt xem */ });
})();
