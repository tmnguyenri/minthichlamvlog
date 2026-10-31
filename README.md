# Mìn Thích Làm Vlog

Trang nhật ký du lịch bằng HTML, CSS và JavaScript thuần. Không cần build, không dùng framework. Phần đăng nhập, đăng ký, bài viết và bình luận chạy bằng Cloudflare Pages Functions và cơ sở dữ liệu D1 (xem mục "Tài khoản, cơ sở dữ liệu và khu quản lý").
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
  js/ui.js, session.js, auth.js, admin.js, comments.js, posts.js   đăng nhập, khu quản lý, bình luận, bài viết từ cơ sở dữ liệu
  dang-nhap.html, dang-ky.html, quan-ly.html, rieng-tu.html        các trang tài khoản
  favicon.svg          biểu tượng trên thẻ trình duyệt
functions/             mã chạy trên máy chủ Cloudflare (API, trang bài viết /bai/<tên>)
db/schema.sql          cấu trúc cơ sở dữ liệu
dev/                   chạy thử trên máy và bộ kiểm tra tự động
wrangler.jsonc         nối cơ sở dữ liệu D1 (tên DB) vào dự án Pages
post-template.html     bài viết trống để sao chép khi viết bài mới (KHÔNG đưa lên mạng)
README.md              tệp này
```

## Biến nó thành của bạn

1. Tên trang là **Mìn Thích Làm Vlog**. Muốn đổi, hãy tìm tên đó trong tất cả các tệp và thay bằng tên mới.
2. Trang Giới thiệu (`site/about.html`) đã có phần giới thiệu của Mìn, ảnh chân dung và email minthichlamvlog@gmail.com. Muốn đổi chữ, sửa trong tệp đó, nhớ sửa cả bản tiếng Việt lẫn bản `data-en` tiếng Anh. Muốn đổi ảnh, thay tệp `site/images/min.jpg` (ảnh dọc tỉ lệ 4:5, khoảng 800×1000 px, dưới 400 KB).
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

Trang này được triển khai từ GitHub: mỗi lần có thay đổi mới trên nhánh `main`, Cloudflare Pages tự dựng lại và cập nhật trang sau chừng một phút. Khi tạo dự án Pages từ kho Git, dùng các thiết lập sau:

- **Production branch**: `main`
- **Framework preset**: None
- **Build command**: để trống
- **Build output directory**: `site`

Dự án tạo bằng kéo thả sẽ không chuyển sang Git được về sau. Nếu muốn kéo thả thay vì dùng Git, vào **Workers & Pages**, chọn **Create application**, rồi **Pages**, rồi **Upload assets**, và kéo thư mục **site** vào.

### Thêm tên miền riêng sau này

Trong dự án Pages, mở **Custom domains**, chọn **Set up a domain** và nhập tên miền. Hãy làm bước này trong trang quản lý Pages trước, đừng chỉnh bản ghi DNS trước. Tên miền mua qua Cloudflare Registrar sẽ tự kết nối.

## Tài khoản, cơ sở dữ liệu và khu quản lý

Chủ trang đăng nhập tại `/dang-nhap` rồi vào `/quan-ly` để viết bài (chữ + video YouTube, có bản tiếng Anh tùy chọn) và duyệt thành viên. Người khác đăng ký tại `/dang-ky`; tài khoản mới ở trạng thái **chờ duyệt** cho đến khi chủ trang bấm Duyệt. Thành viên đã duyệt bình luận được dưới mỗi bài. Chỉ chủ trang đăng bài.

**Cách hoạt động.** Dữ liệu nằm trong D1 (SQLite của Cloudflare, miễn phí) tên `minthichlamvlog-db`, nối vào các hàm trong `functions/` bằng tên `DB` (khai báo ở `wrangler.jsonc`). Mật khẩu được băm bằng PBKDF2-SHA256, không bao giờ lưu mật khẩu thật. Phiên đăng nhập là một cookie HttpOnly 30 ngày, trong cơ sở dữ liệu chỉ lưu bản băm của nó. Các yêu cầu ghi dữ liệu đều kiểm tra tiêu đề `Origin`, có giới hạn số lần thử, và nội dung do người dùng nhập luôn được thoát ký tự trước khi hiển thị.

**Tạo lại cơ sở dữ liệu (nếu cần).**

1. Trong Cloudflare: **Storage & databases → D1 → Create Database**, đặt tên, rồi chép `database_id` vào `wrangler.jsonc`.
2. Mở **Console** của cơ sở dữ liệu, dán nội dung `db/schema.sql` (bỏ các dòng chú thích) và chạy. Chạy lại nhiều lần vẫn an toàn.
3. Tạo tài khoản chủ trang: sinh một mã ngẫu nhiên dài, lưu **SHA-256 của mã** vào bảng `invites` (`INSERT INTO invites (token_hash, role, created_at) VALUES ('<sha256 hex>', 'admin', strftime('%s','now'));`), rồi mở `/dang-ky`, bấm "Mình có mã mời", dán **mã gốc** và tự chọn mật khẩu. Mã chỉ dùng được một lần.

**Chạy thử trên máy** (cần Node 22 trở lên, không cần cài gói nào):

```
node dev/server.mjs 8788                  # trang + API + cơ sở dữ liệu trong bộ nhớ, mở http://127.0.0.1:8788
node --no-warnings dev/test-api.mjs       # 104 kiểm tra cho API
node --no-warnings dev/test-ui.mjs        # kiểm tra giao diện bằng trình duyệt (cần Playwright)
```

**Chưa có (làm sau):** tải ảnh lên (cần bật R2 trong Cloudflare, có thẻ thanh toán dù vẫn trong hạn mức miễn phí), và xác nhận email (cần gói Workers trả phí để gửi thư tới người lạ). Hiện ảnh bìa và ảnh trong bài được chèn bằng đường dẫn `/images/...` hoặc liên kết https.

## Font chữ

Tiêu đề và bài viết dùng Newsreader, phần còn lại dùng Plus Jakarta Sans. Cả hai tải từ Google Fonts và đều hỗ trợ đầy đủ tiếng Việt. Nếu trình duyệt của người xem không tải được Google Fonts, trang sẽ dùng font hệ thống và vẫn đọc được. Muốn tự lưu font, hãy tải hai họ font từ fonts.google.com, đặt vào `site/fonts/`, và thay các thẻ `<link>` Google Fonts bằng các quy tắc `@font-face`. Cả hai font đều miễn phí theo giấy phép SIL Open Font License.
