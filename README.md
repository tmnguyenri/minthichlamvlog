# Mìn Thích Làm Vlog

Trang nhật ký du lịch bằng HTML, CSS và một tệp JavaScript nhỏ. Không cần build, không dùng framework, không phải cài gì.
Giao diện tối. **Mặc định tiếng Việt**, người xem bấm nút **EN** ở góc trên để đọc bản tiếng Anh.

## Trong thư mục này có gì

```
site/                  <- mọi thứ trong thư mục này sẽ được đưa lên mạng
  index.html           trang chủ: mở đầu, bài nổi bật, danh sách bài, bản đồ
  about.html           trang giới thiệu, có mục Liên hệ
  404.html             hiện ra khi không tìm thấy trang
  posts/               mỗi chuyến đi một tệp HTML
  images/              ảnh. scene-*.svg là ảnh minh họa mẫu, flags/ là cờ các nước
  css/style.css        toàn bộ màu sắc, font và bố cục
  js/lang.js           nút chuyển tiếng Việt / tiếng Anh
  favicon.svg          biểu tượng trên thẻ trình duyệt
post-template.html     bài viết trống để sao chép khi viết bài mới (KHÔNG đưa lên mạng)
README.md              tệp này
```

## Biến nó thành của bạn

1. Tên trang là **Mìn Thích Làm Vlog**. Muốn đổi, hãy tìm tên đó trong tất cả các tệp và thay bằng tên mới.
2. Trang Giới thiệu (`site/about.html`) đã có tên Mìn Thích Làm Vlog và email minthichlamvlog@gmail.com. Muốn đổi, sửa trong tệp đó, nhớ sửa cả bản tiếng Việt lẫn bản `data-en` tiếng Anh.
3. Bốn bài viết mẫu (Oaxaca, Kyoto, Lisbon, Hà Giang) và các ảnh minh họa chỉ là chỗ giữ chỗ, đều có nhãn **Mẫu**. Khi có bài thật, hãy xóa tệp của chúng trong `site/posts/`, xóa các khối tương ứng trong `site/index.html`, và xóa các tệp `scene-*.svg` không còn dùng.
4. Màu sắc và font nằm ở đầu tệp `site/css/style.css`, trong khối `:root`. Muốn đổi màu nhấn, sửa `--peach`, `--coral`, `--pink`, `--violet`.
5. Các con số ở đầu trang chủ (số chuyến đi, quốc gia, ngày trên đường, vlog) nằm trong `<dl class="stats">` của `site/index.html`. Hãy cập nhật khi có bài mới.

## Hai ngôn ngữ hoạt động thế nào

Trang luôn được viết sẵn bằng tiếng Việt trong HTML, và đó cũng là bản mà Google đọc. Mỗi dòng chữ có thêm bản tiếng Anh nằm ngay trong thuộc tính `data-en`:

```html
<h2 data-en="Notes from the road">Ghi chép trên đường</h2>
```

- Giữa hai thẻ là **tiếng Việt**, `data-en="..."` là **tiếng Anh**. Khi sửa chữ, hãy sửa cả hai.
- Dòng nào không có `data-en` sẽ giữ nguyên tiếng Việt khi người xem chọn EN. Bài viết chỉ có tiếng Việt vẫn chạy bình thường.
- `data-en` chỉ chứa chữ thuần, và phần tử đó không được chứa thẻ con. Muốn chữ nghiêng đổ màu, tách riêng thành `<em class="grad" data-en="...">...</em>` như trong tiêu đề trang chủ.
- Còn bốn thuộc tính tương tự cho phần không phải chữ hiển thị: `data-en-alt` (mô tả ảnh), `data-en-aria-label`, `data-en-title` và `data-en-content` (thẻ `<meta>`).
- Lựa chọn của người xem được nhớ trong trình duyệt. Có thể gửi liên kết ép ngôn ngữ, ví dụ `https://minthichlamvlog.pages.dev/?lang=en`.
- Nếu người xem tắt JavaScript, trang vẫn đọc được bằng tiếng Việt và nút chuyển ngôn ngữ tự ẩn đi.

## Thêm một bài viết mới

1. Sao chép `post-template.html` vào `site/posts/` và đổi tên, ví dụ `bangkok.html`.
2. Mở tệp và thay mọi chỗ ghi Tên địa điểm, Quốc gia, Tháng 1/2026, X ngày. Sửa cả tiếng Việt lẫn `data-en`.
3. Đổi ảnh bìa ở đầu bài (thẻ `<img class="post-hero__img" ...>`) sang ảnh của bạn.
4. Mở `site/index.html`, sao chép một khối `<article class="card">` rồi dán lên **đầu** danh sách `.cards`. Sửa nội dung và liên kết của nó trỏ tới tệp bài mới. Muốn bài mới là bài nổi bật to nhất, sửa khối `<article class="feature">`, và chuyển nội dung nổi bật cũ thành một thẻ `card`.
5. Mục **Bản đồ** của trang chủ: thêm một khối `<a class="country">` cho nước mới, hoặc đổi "1 bài viết" thành "2 bài viết" nếu nước đó đã có. Cờ là tệp 36×24 trong `site/images/flags/` (ví dụ `th.svg`).
6. Ở cuối bài mới, sửa các liên kết "Chuyến đi trước" và "Chuyến đi sau". Xóa một liên kết nếu không có bài kề bên. Làm tương tự với bài kề bên để liên kết sang bài mới hiện ra ở đó.
7. Xóa nhãn **Mẫu** (thẻ `<span class="badge">`) và khung ghi chú `sample-note` khi bài đã là bài thật.

## Thêm ảnh

1. Đổi kích thước ảnh còn khoảng 1600 px chiều ngang và lưu dạng JPG dưới 400 KB. Ảnh nhỏ tải nhanh hơn trên điện thoại.
2. Đặt ảnh vào `site/images/`.
3. Trong bài viết, thay khung nét đứt `<div class="photo__frame">...</div>` bằng:

```html
<img src="../images/anh-cua-ban.jpg" alt="Mô tả nội dung bức ảnh" width="1500" height="1000" loading="lazy">
```

4. Ảnh trên thẻ bài viết, ảnh nổi bật và ảnh bìa đều là thẻ `<img>` trỏ tới `images/scene-*.svg`. Chỉ cần đổi `src` sang ảnh JPG của bạn. Ảnh sẽ tự được cắt cho vừa khung.

Cloudflare Pages cho phép mỗi tệp tối đa 25 MiB, và mỗi lần tải lên bằng kéo thả nhận tối đa 1.000 tệp.

## Thêm video

Cloudflare Pages không chứa được tệp lớn (mỗi tệp tối đa 25 MiB), nên hãy đăng vlog lên YouTube rồi nhúng vào bài viết. `VIDEO_ID` là phần đứng sau `v=` trong liên kết YouTube. Thay khối `<div class="video video--empty">` trong bài bằng:

```html
<div class="video">
  <iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" title="Mô tả video" loading="lazy" allowfullscreen></iframe>
</div>
```

## Xem thử trên máy của bạn

Mở `site/index.html` bằng trình duyệt vẫn chạy được. Để thấy đúng như khi đưa lên mạng, chạy lệnh sau bên trong thư mục `site` rồi mở http://localhost:8000:

```
python3 -m http.server 8000
```

## Đưa lên mạng (Cloudflare Pages, miễn phí)

Trang này được triển khai từ GitHub: mỗi lần có thay đổi mới trên nhánh `main`, Cloudflare tự dựng lại và cập nhật trang sau chừng một phút.

Tệp `wrangler.jsonc` ở thư mục gốc cho Cloudflare biết tên dự án (`minthichlamvlog`) và thư mục chứa trang (`site`). Nếu đổi tên dự án trên Cloudflare, phải đổi `name` trong tệp này cho khớp. Với dự án Workers, vào **Settings** rồi **Builds** và bấm **Connect** để nối kho GitHub, để trống ô Build command và giữ nguyên Deploy command mặc định.

Nếu thay vào đó tạo dự án **Pages** từ kho Git, dùng các thiết lập sau:

- **Production branch**: `main`
- **Framework preset**: None
- **Build command**: để trống
- **Build output directory**: `site`

Dự án tạo bằng kéo thả sẽ không chuyển sang Git được về sau. Nếu muốn kéo thả thay vì dùng Git, vào **Workers & Pages**, chọn **Create application**, rồi **Pages**, rồi **Upload assets**, và kéo thư mục **site** vào.

### Thêm tên miền riêng sau này

Trong dự án Pages, mở **Custom domains**, chọn **Set up a domain** và nhập tên miền. Hãy làm bước này trong trang quản lý Pages trước, đừng chỉnh bản ghi DNS trước. Tên miền mua qua Cloudflare Registrar sẽ tự kết nối.

## Font chữ

Tiêu đề và bài viết dùng Newsreader, phần còn lại dùng Plus Jakarta Sans. Cả hai tải từ Google Fonts và đều hỗ trợ đầy đủ tiếng Việt. Nếu trình duyệt của người xem không tải được Google Fonts, trang sẽ dùng font hệ thống và vẫn đọc được. Muốn tự lưu font, hãy tải hai họ font từ fonts.google.com, đặt vào `site/fonts/`, và thay các thẻ `<link>` Google Fonts bằng các quy tắc `@font-face`. Cả hai font đều miễn phí theo giấy phép SIL Open Font License.
