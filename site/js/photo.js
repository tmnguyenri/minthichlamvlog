/* Nén ảnh trong trình duyệt trước khi tải lên: thu còn tối đa 1600 px chiều ngang,
 * xuất JPEG và giảm chất lượng cho tới khi dưới 400 KB (giới hạn của máy chủ).
 * Dùng chung cho thư viện ảnh và khu quản lý bài viết: window.mtlvPhoto.compress(file) -> Promise<Blob>.
 */
(function () {
  'use strict';

  var MAX_BYTES = 400 * 1024;
  var MAX_WIDTH = 1600;

  function compress(file) {
    return createImageBitmap(file).then(function (bmp) {
      var scale = Math.min(1, MAX_WIDTH / bmp.width);
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // ảnh PNG trong suốt sẽ có nền trắng thay vì đen
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      if (bmp.close) bmp.close();

      var quality = 0.9;
      function attempt() {
        return new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', quality); })
          .then(function (blob) {
            if (!blob) throw new Error('encode');
            if (blob.size <= MAX_BYTES || quality <= 0.5) return blob;
            quality = Math.round((quality - 0.1) * 10) / 10;
            return attempt();
          });
      }
      return attempt();
    });
  }

  window.mtlvPhoto = { compress: compress, MAX_BYTES: MAX_BYTES };
})();
