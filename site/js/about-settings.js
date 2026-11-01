/* Trang Giới thiệu: ảnh chân dung, phần giới thiệu bản thân và các liên kết liên hệ đổi được từ khu
   quản lý (tab "Giới thiệu"). Nếu chủ trang chưa chỉnh gì thì cứ giữ nguyên chữ/ảnh có sẵn trong
   HTML — không gọi máy chủ thêm lần nào nữa sau khi đã có kết quả. Nội dung giới thiệu bản thân do
   máy chủ dựng sẵn thành HTML an toàn (xem _lib/md.js), nên chèn thẳng được bằng innerHTML. */
(function () {
  'use strict';
  var photo = document.querySelector('[data-about-photo]');
  var bio = document.getElementById('about-bio');
  var emailLink = document.getElementById('about-email-link');
  var youtubeLink = document.getElementById('about-youtube-link');
  var instagramLink = document.getElementById('about-instagram-link');
  if (!photo && !bio && !emailLink && !youtubeLink && !instagramLink) return;

  fetch('/api/settings', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var s = (d && d.settings) || {};
      if (photo && s.about_photo) photo.src = s.about_photo;
      if (bio && d && d.about_body_html) {
        bio.innerHTML = d.about_body_en_html
          ? '<div data-only="vi">' + d.about_body_html + '</div><div data-only="en">' + d.about_body_en_html + '</div>'
          : d.about_body_html;
      }
      if (emailLink && s.about_email) { emailLink.href = 'mailto:' + s.about_email; emailLink.textContent = s.about_email; }
      if (youtubeLink && s.about_youtube) youtubeLink.href = s.about_youtube;
      if (instagramLink && s.about_instagram) instagramLink.href = s.about_instagram;
    })
    .catch(function () { /* giữ nội dung mặc định */ });
})();
