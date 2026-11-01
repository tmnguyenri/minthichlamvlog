/* Trang chủ: ba ảnh xếp chồng ở đầu trang có thể đổi từ khu quản lý (tab "Trang chủ"). Nếu chủ
   trang chưa chỉnh gì thì cứ giữ nguyên ảnh có sẵn trong HTML — không gọi máy chủ thêm lần nào
   nữa sau khi đã có kết quả. */
(function () {
  'use strict';
  var slots = document.querySelectorAll('[data-hero-slot]');
  if (!slots.length) return;
  fetch('/api/settings', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var s = (d && d.settings) || {};
      slots.forEach(function (img) {
        var value = s['hero_photo_' + img.getAttribute('data-hero-slot')];
        if (value) img.src = value;
      });
    })
    .catch(function () { /* giữ ảnh mặc định */ });
})();
