# Mìn Thích Làm Vlog

Một trang web HTML và CSS thuần. Không cần build, không dùng framework, không phải cài gì.
Mỗi chuyến đi là một điểm dừng trên hành trình, chuyến mới nhất ở trên cùng.

## Trong thư mục này có gì

```
site/                  <- mọi thứ trong thư mục này sẽ được đưa lên mạng
  index.html           trang chủ: hành trình với các điểm dừng
  about.html           trang giới thiệu
  404.html             hiện ra khi không tìm thấy trang
  posts/               mỗi chuyến đi một tệp HTML
  images/              ảnh của bạn đặt ở đây
  css/style.css        toàn bộ màu sắc, font và bố cục
post-template.html     bài viết trống để sao chép khi viết bài mới (KHÔNG đưa lên mạng)
README.md              tệp này
```

## Biến nó thành của bạn

1. Tên trang là **Mìn Thích Làm Vlog**. Muốn đổi, hãy tìm tên đó trong tất cả các tệp và thay bằng tên mới.
2. Tìm **Tên của bạn** và thay bằng tên bạn. Cụm này xuất hiện ở chân trang và trang Giới thiệu.
3. Sửa `site/about.html`. Thay `ban@example.com` bằng email thật của bạn, hoặc xóa dòng đó.
4. Màu sắc và font nằm ở đầu tệp `site/css/style.css`, trong khối `:root`.

## Thêm một bài viết mới

1. Sao chép `post-template.html` vào `site/posts/` và đổi tên, ví dụ `bangkok.html`.
2. Mở tệp và thay mọi chỗ ghi Tên địa điểm, Quốc gia, Tháng 1/2026 và những chỗ tương tự.
3. Chọn họa tiết phần đầu bài bằng `post-head--a`, `--b` hoặc `--c`.
4. Mở `site/index.html`, sao chép một khối `<li class="stop">` lên **đầu** danh sách rồi sửa nội dung. Cho liên kết của nó trỏ tới tệp bài mới.
5. Ở cuối bài mới, sửa các liên kết "Điểm dừng trước" và "Điểm dừng sau". Xóa một liên kết nếu không có bài kề bên.
6. Làm tương tự với bài kề bên, để liên kết sang điểm dừng mới hiện ra ở đó.

Ba điểm dừng mẫu (Oaxaca, Kyoto, Lisbon) chỉ là chỗ giữ chỗ. Khi đã có bài thật, hãy xóa các tệp của chúng trong `site/posts/` và các khối `<li>` tương ứng trong `site/index.html`.

## Thêm ảnh

1. Đổi kích thước ảnh còn khoảng 1600 px chiều ngang và lưu dạng JPG dưới 400 KB. Ảnh nhỏ tải nhanh hơn trên điện thoại.
2. Đặt ảnh vào `site/images/`.
3. Trong bài viết, thay khung nét đứt `<div class="photo__frame">...</div>` bằng:

```html
<img src="../images/anh-cua-ban.jpg" alt="Mô tả nội dung bức ảnh" width="1500" height="1000" loading="lazy">
```

Cloudflare Pages cho phép mỗi tệp tối đa 25 MiB, và mỗi lần tải lên bằng kéo thả nhận tối đa 1.000 tệp.

## Thêm video

Cloudflare Pages không chứa được tệp lớn (mỗi tệp tối đa 25 MiB), nên hãy đăng vlog lên YouTube rồi nhúng vào bài viết. `VIDEO_ID` là phần đứng sau `v=` trong liên kết YouTube.

```html
<div class="video">
  <iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" title="Mô tả video" loading="lazy" allowfullscreen></iframe>
</div>
```

## Xem thử trên máy của bạn

Mở `site/index.html` bằng trình duyệt vẫn chạy được, chỉ có họa tiết đường đồng mức phía sau tiêu đề bị trình duyệt chặn với tệp trên máy. Để thấy đầy đủ, chạy lệnh sau bên trong thư mục `site` rồi mở http://localhost:8000:

```
python3 -m http.server 8000
```

## Đưa lên mạng (Cloudflare Pages, miễn phí)

1. Đăng nhập tại dash.cloudflare.com.
2. Vào **Workers & Pages**, chọn **Create application**, rồi **Pages**, rồi **Upload assets** (cũng có thể ghi là **Drag and drop your files**).
3. Đặt tên dự án. Tên này sẽ thành địa chỉ của bạn, `tenban.pages.dev`.
4. Kéo thư mục **site** từ máy của bạn vào và chọn **Deploy site**.

Muốn cập nhật trang sau này, tải thư mục lên lại như một lần triển khai mới.

Nếu bạn muốn tự động triển khai từ GitHub, hãy tạo dự án Pages từ một kho Git, đặt **build output directory** là `site` và để trống lệnh build. Dự án bắt đầu bằng kéo thả sẽ không chuyển sang Git được về sau.

### Thêm tên miền riêng sau này

Trong dự án Pages, mở **Custom domains**, chọn **Set up a domain** và nhập tên miền. Hãy làm bước này trong trang quản lý Pages trước, đừng chỉnh bản ghi DNS trước. Tên miền mua qua Cloudflare Registrar sẽ tự kết nối.

## Font chữ

Tiêu đề dùng Archivo và nội dung dùng Literata, cả hai tải từ Google Fonts. Nếu trình duyệt của người xem không tải được Google Fonts, trang sẽ dùng font hệ thống và vẫn đọc được. Muốn tự lưu font, hãy tải cả hai họ font từ fonts.google.com, đặt vào `site/fonts/`, và thay các thẻ `<link>` Google Fonts bằng các quy tắc `@font-face`. Cả hai font đều miễn phí theo giấy phép SIL Open Font License.
