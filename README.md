# Mìn Thích Làm Vlog

Trang nhật ký du lịch bằng HTML, CSS và JavaScript thuần. Không cần build, không dùng framework. Phần đăng nhập, đăng ký, bài viết và bình luận chạy bằng Cloudflare Pages Functions và cơ sở dữ liệu D1 (xem mục "Tài khoản, cơ sở dữ liệu và khu quản lý").
Giao diện sáng. **Mặc định tiếng Việt**, người xem bấm nút **EN** ở góc trên để đọc bản tiếng Anh.

## Trong thư mục này có gì

```
site/                  <- mọi thứ trong thư mục này sẽ được đưa lên mạng
  index.html           trang chủ: dải ảnh chạy, phần mở đầu, danh sách bài, bản đồ
  about.html           trang giới thiệu, có mục Liên hệ
  404.html             hiện ra khi không tìm thấy trang
  posts/               mỗi chuyến đi một tệp HTML
  images/              ảnh. scene-*.svg là ảnh minh họa mẫu, flags/ là cờ các nước
  css/style.css        toàn bộ màu sắc, font và bố cục
  js/lang.js           nút chuyển tiếng Việt / tiếng Anh
  js/ui.js, session.js, auth.js, admin.js, comments.js, posts.js, slider.js   đăng nhập, khu quản lý, bình luận, bài viết và dải ảnh chạy ở trang chủ
  dang-nhap.html, dang-ky.html, quan-ly.html, rieng-tu.html        các trang tài khoản
  quen-mat-khau.html, dat-lai-mat-khau.html   quên mật khẩu và đặt mật khẩu mới
  images/logo-96.png, logo-240.png   logo tròn ở góc trên bên trái mọi trang (cắt từ ảnh đại diện kênh)
  favicon-48.png, favicon-32.png, favicon.ico   biểu tượng trên thẻ trình duyệt
  apple-touch-icon.png biểu tượng khi lưu trang ra màn hình chính điện thoại
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
4. Màu sắc và font nằm ở đầu tệp `site/css/style.css`, trong khối `:root` — dựng lại đúng theo hệ thống thiết kế thật của Wanderlust (đọc từ mã nguồn, không chỉ đoán qua ảnh chụp màn hình). Nền trang là kem ấm (`--bg`) với lưới chấm mờ phủ nhẹ phía sau (`body::before`), chữ tím than đậm (`--ink`). Font chính là Outfit, font tiêu đề lớn là Bricolage Grotesque (đổi ở biến `--font` / `--font-display`, nhớ sửa cả dòng `<link>` Google Fonts trong `<head>` mỗi trang và trong `functions/_lib/layout.js`). Màu nhấn gồm `--gold`, `--pink`, `--violet` cho mảng gradient thương hiệu (`--grad-brand`, dùng ở banner bài nổi bật, dải lời mời cuối trang...) và các màu phụ `--amber`, `--mint` (chấm "đang hoạt động"), `--sky` (viền khi focus ô nhập); nút hành động chính dùng gradient `--grad-cta` (hồng sang cam). Bo góc lớn dùng chung một biến `--radius` (26px), đổ bóng dùng chung `--shadow`, và các chuyển động mượt dùng chung đường cong `--ease`. Các mảng trang trí đặc trưng của Wanderlust — khối gradient mờ trôi nhẹ phía sau tiêu đề (`.aurora`), ảnh xếp lớp nghiêng ở đầu trang (`.stack`), dải tên địa danh chạy ngang (`.ticker`), nhãn viên thuốc có chấm màu (`.eyebrow`) và chữ cái đầu đoạn mở bài vuốt to (drop cap, chỉ ở bài viết và trang giới thiệu, không ở các trang tiện ích như 404/quyền riêng tư) — đều nằm trong `site/css/style.css`, tìm theo tên lớp CSS tương ứng để chỉnh hoặc tắt.
5. Trang chủ tự lấy bài thật từ cơ sở dữ liệu. Khi đã có bài đăng trong khu quản lý (`/quan-ly`), các thẻ mẫu và danh sách quốc gia tự được thay bằng bài thật, không phải sửa tay.
6. Dải ảnh chạy ở đầu trang chủ lấy **ảnh bìa** của các bài đã đăng (nhập ở ô "Ảnh bìa" trong khu quản lý), xáo ngẫu nhiên mỗi lần mở trang và lấy tối đa 8 ảnh. Bấm vào ảnh sẽ mở bài viết có ảnh đó. Bài nháp hoặc bài chưa có ảnh bìa không xuất hiện ở đây; nếu chưa bài nào có ảnh bìa thì cả dải ảnh tự ẩn. Muốn đổi tốc độ hay số ảnh, sửa `INTERVAL` (mili giây) và `MAX` ở đầu `site/js/slider.js`. Dải ảnh tự dừng khi rê chuột vào hoặc khi người xem bật "giảm chuyển động" trong thiết bị.

## Hai ngôn ngữ hoạt động thế nào

Trang luôn được viết sẵn bằng tiếng Việt trong HTML, và đó cũng là bản mà Google đọc. Mỗi dòng chữ có thêm bản tiếng Anh nằm ngay trong thuộc tính `data-en`:

```html
<h2 data-en="Notes from the road">Ghi chép trên đường</h2>
```

- Giữa hai thẻ là **tiếng Việt**, `data-en="..."` là **tiếng Anh**. Khi sửa chữ, hãy sửa cả hai.
- Dòng nào không có `data-en` sẽ giữ nguyên tiếng Việt khi người xem chọn EN. Bài viết chỉ có tiếng Việt vẫn chạy bình thường.
- `data-en` chỉ chứa chữ thuần, và phần tử đó không được chứa thẻ con.
- Còn bốn thuộc tính tương tự cho phần không phải chữ hiển thị: `data-en-alt` (mô tả ảnh), `data-en-aria-label`, `data-en-title` và `data-en-content` (thẻ `<meta>`).
- Lựa chọn của người xem được nhớ trong trình duyệt. Có thể gửi liên kết ép ngôn ngữ, ví dụ `https://minthichlamvlog.pages.dev/?lang=en`.
- Nếu người xem tắt JavaScript, trang vẫn đọc được bằng tiếng Việt và nút chuyển ngôn ngữ tự ẩn đi.

## Thêm một bài viết mới

Cách nhanh nhất: đăng nhập tài khoản quản trị và đăng bài ở `/quan-ly`. Phần dưới đây là cách làm thủ công bằng tệp HTML, dùng khi cần một trang bài hoàn toàn tự chọn.

1. Sao chép `post-template.html` vào `site/posts/` và đổi tên, ví dụ `bangkok.html`.
2. Mở tệp và thay mọi chỗ ghi Tên địa điểm, Quốc gia, Tháng 1/2026, X ngày. Sửa cả tiếng Việt lẫn `data-en`.
3. Đổi ảnh bìa ở đầu bài (thẻ `<img class="post-hero__img" ...>`) sang ảnh của bạn.
4. Mở `site/index.html`, sao chép một khối `<article class="card">` rồi dán lên **đầu** danh sách `.cards`. Sửa nội dung và liên kết của nó trỏ tới tệp bài mới.
5. Mục **Bản đồ** của trang chủ: thêm một khối `<a class="country">` cho nước mới, hoặc đổi "1 bài viết" thành "2 bài viết" nếu nước đó đã có. Cờ là tệp 36×24 trong `site/images/flags/` (ví dụ `th.svg`).
6. Ở cuối bài mới, sửa các liên kết "Chuyến đi trước" và "Chuyến đi sau". Xóa một liên kết nếu không có bài kề bên. Làm tương tự với bài kề bên để liên kết sang bài mới hiện ra ở đó.
7. Xóa nhãn **Mẫu** (thẻ `<span class="badge">`) và khung ghi chú `sample-note` khi bài đã là bài thật.

## Ảnh của bài viết

- **Tải ảnh khi viết:** trong `/quan-ly`, mục **Ảnh của bài** nằm ngay dưới ô ảnh bìa. Chọn nhiều ảnh cùng lúc, ảnh sẽ được nén trong trình duyệt thành JPEG dưới 400 KB và lưu trong bảng `images` của D1. Nếu bài chưa được lưu, bài sẽ tự lưu thành nháp trước khi tải ảnh (cần có tiêu đề).
- **Tên ảnh:** chú thích của ảnh (hiện ở tab **Ảnh** và dùng làm `alt`) lấy từ tên tệp gốc, nhưng được tự rút ngắn còn khoảng 40 ký tự (cắt ở khoảng trắng gần cuối nếu có) thay vì giữ nguyên tên dài của điện thoại/máy ảnh — vẫn đủ để biết là ảnh nào mà không chiếm quá nhiều chỗ khi quản lý.
- **Hiển thị:** mỗi lần mở trang, bài hiện ngẫu nhiên một ảnh trong số ảnh của bài. Bài chưa có ảnh nào thì dùng ảnh bìa (nếu có) hoặc ảnh mặc định.
- **Quyền xem ảnh:** `GET /api/images/:id` chỉ công khai khi ảnh đang gắn với một bài **đã đăng**. Ảnh mới tải lên (chưa gắn vào bài nào) hoặc gắn với bài còn là **nháp** chỉ chủ trang xem được (404 với người khác), để không lộ ảnh trước khi bài được đăng.
- **Cập nhật cơ sở dữ liệu:** bảng `images` được tạo bằng `db/schema.sql`. Nếu bảng đã có nhưng thiếu cột `post_id`, chạy một lần: `ALTER TABLE images ADD COLUMN post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL;`
- **Kiểm thử:** `node --no-warnings dev/test-images.mjs`.

## Thành phố và quốc gia đã đi

- Trong `/quan-ly`, mỗi bài có ô **Thành phố** (ví dụ Đà Nẵng) bên cạnh ô **Quốc gia**. Thẻ bài và trang bài hiện "Đà Nẵng, Việt Nam"; mục **Những nơi mình đã đi** ở trang chủ liệt kê các thành phố đã đi dưới từng quốc gia (mới nhất trước, không lặp, tối đa 8 thành phố mỗi nước).
- **Cơ sở dữ liệu cũ tự được nâng cấp:** cột `city` của bảng `posts` được thêm tự động ở lần truy cập đầu tiên (`functions/_lib/schema.js`), bạn không cần chạy SQL. Muốn tự chạy cũng được: `ALTER TABLE posts ADD COLUMN city TEXT NOT NULL DEFAULT '';`
- **Kiểm thử:** `node --no-warnings dev/test-home.mjs` và mục 5c, 9b2 của `dev/test-api.mjs`.

## Tự dịch bài viết sang tiếng Anh

- Khi lưu bài, các phần tiếng Anh còn trống (tiêu đề, tóm tắt, nội dung) được tự dịch từ tiếng Việt bằng **Workers AI** (mô hình `m2m100`). Phần đã có chữ tiếng Anh thì giữ nguyên, không bị ghi đè.
- Muốn dịch lại một bài: xóa phần tiếng Anh của bài đó rồi lưu.
- Bản dịch máy có thể chưa chuẩn. Nên đọc lại và sửa trực tiếp trong ô tiếng Anh; sau khi sửa, lần lưu sau sẽ không dịch đè.
- Cần bật Workers AI trong tài khoản Cloudflare (binding `AI` đã có trong `wrangler.jsonc`). Nếu chưa bật, bài vẫn lưu bình thường, chỉ phần tiếng Anh để trống.
- Mỗi lần lưu tối đa khoảng 60 lượt gọi mô hình. Bài rất dài có thể cần sửa tay phần còn lại.
- Kiểm thử: `node --no-warnings dev/test-translate.mjs`.

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

**Cách hoạt động.** Dữ liệu nằm trong D1 (SQLite của Cloudflare, miễn phí) tên `minthichlamvlog-db`, nối vào các hàm trong `functions/` bằng tên `DB` (khai báo ở `wrangler.jsonc`). Mật khẩu được băm bằng PBKDF2-SHA256 với 100.000 vòng (mức tối đa Cloudflare cho phép; đã đo trên gói miễn phí và chạy ổn), không bao giờ lưu mật khẩu thật. Nếu sau này thấy lỗi "Worker exceeded resource limits" khi đăng ký hay đăng nhập, đặt biến `PBKDF2_ITERATIONS` (10000 đến 100000) trong **Settings → Variables** của dự án Pages để giảm số vòng. Phiên đăng nhập là một cookie HttpOnly 30 ngày, trong cơ sở dữ liệu chỉ lưu bản băm của nó. Các yêu cầu ghi dữ liệu đều kiểm tra tiêu đề `Origin`, có giới hạn số lần thử, và nội dung do người dùng nhập luôn được thoát ký tự trước khi hiển thị.

**Tạo lại cơ sở dữ liệu (nếu cần).**

1. Trong Cloudflare: **Storage & databases → D1 → Create Database**, đặt tên, rồi chép `database_id` vào `wrangler.jsonc`.
2. Mở **Console** của cơ sở dữ liệu, dán nội dung `db/schema.sql` (bỏ các dòng chú thích) và chạy. Chạy lại nhiều lần vẫn an toàn.
3. Tạo tài khoản chủ trang: sinh một mã ngẫu nhiên dài, lưu **SHA-256 của mã** vào bảng `invites` (`INSERT INTO invites (token_hash, role, created_at) VALUES ('<sha256 hex>', 'admin', strftime('%s','now'));`), rồi mở `/dang-ky`, bấm "Mình có mã mời", dán **mã gốc** và tự chọn mật khẩu. Mã chỉ dùng được một lần.

**Quên mật khẩu.** Mật khẩu chỉ lưu dạng băm nên không ai xem lại được; chỉ có thể đặt mật khẩu mới. Trang chưa gửi được email tự động nên việc này làm thủ công, không cần cài thêm gì:

- **Thành viên quên mật khẩu:** họ nhắn cho chủ trang (qua mục Liên hệ). Chủ trang vào `/quan-ly` → tab **Thành viên** → bấm **Đặt lại mật khẩu** ở dòng của người đó → sao chép liên kết và gửi riêng cho họ. Liên kết dùng được một lần, hết hạn sau 24 giờ; tạo liên kết mới thì liên kết cũ hết hiệu lực. Khi họ đặt xong, mọi phiên đăng nhập cũ bị đăng xuất. Mã nằm sau dấu `#` của liên kết nên không đi vào nhật ký máy chủ.
- **Chủ trang quên mật khẩu của chính mình:** nút trên không dùng được cho tài khoản quản trị, nên dùng mã khẩn cấp qua D1 Console:
  1. Tự nghĩ một mã dài và ngẫu nhiên (từ 30 ký tự), rồi tính SHA-256 của mã. Cách nhanh: mở một thẻ trình duyệt bất kỳ, bấm F12 → **Console**, dán `crypto.subtle.digest('SHA-256', new TextEncoder().encode('MÃ-CỦA-BẠN')).then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')))`.
  2. Trong Cloudflare → D1 → `minthichlamvlog-db` → **Console**, chạy `INSERT INTO invites (token_hash, role, created_at) VALUES ('<sha256 vừa tính>', 'reset', strftime('%s','now'));`
  3. Mở `/dat-lai-mat-khau`, nhập email của bạn, **mã gốc** (không phải bản băm) và mật khẩu mới. Mã dùng được một lần và hết hạn sau 24 giờ.

**Chạy thử trên máy** (cần Node 22 trở lên, không cần cài gói nào):

```
node dev/server.mjs 8788                  # trang + API + cơ sở dữ liệu trong bộ nhớ, mở http://127.0.0.1:8788
node --no-warnings dev/test-api.mjs       # hơn 200 kiểm tra cho API
node --no-warnings dev/test-home.mjs      # trang chủ: bài thật thay bài mẫu, thành phố và quốc gia (cần Playwright)
node --no-warnings dev/test-images.mjs    # thư viện ảnh, quyền xem ảnh theo trạng thái bài
node --no-warnings dev/test-security.mjs  # bảo mật: tự thử CSRF, IDOR, XSS, SQL injection, dò mật khẩu... (xem bên dưới)
node --no-warnings dev/test-ui.mjs        # kiểm tra giao diện bằng trình duyệt (cần Playwright)
```

## Thống kê

Tab **Thống kê** trong `/quan-ly` cho chủ trang xem nhanh: tổng lượt xem (và lượt xem hôm nay), số khách khác nhau, số thành viên, ai đang online (hoạt động trong 5 phút gần nhất) kèm danh sách, top 5 thành viên hoạt động nhiều nhất (tính theo số bài viết + bình luận), số bài viết, số bình luận và số hình ảnh. Số liệu nạp lại mỗi khi mở tab, không tự làm mới.

- **Lượt xem** đếm các trang công khai (GET, trả về HTML) — không tính lời gọi API, tệp XML, hay chính trang `/quan-ly`. Khách được gắn một mã ẩn danh trong cookie `vid` (không gắn với tài khoản nào, chỉ để đếm khách khác nhau) để không đếm trùng khi họ xem nhiều trang.
- **Đang online** dựa trên cột `users.last_seen_at`, được cập nhật mỗi khi có yêu cầu kèm phiên đăng nhập hợp lệ.
- **Cơ sở dữ liệu cũ tự được nâng cấp:** bảng `page_views` và cột `users.last_seen_at` được tự tạo/thêm ở lần truy cập đầu tiên (`functions/_lib/schema.js`), bạn không cần vào D1 Console chạy tay.
- **Kiểm thử:** mục 9d của `dev/test-api.mjs`.

### Góc cộng đồng ở trang chủ

Ở cuối trang chủ (mục `#cong-dong`, sau phần "Bản đồ", ngay trước chân trang) là một góc nhỏ **công khai cho mọi khách**, không cần đăng nhập: ai đang online ngay lúc này, và top 5 thành viên hoạt động nhiều nhất. Mỗi người online hiện như một thẻ bo tròn với chữ cái đầu tên làm "ảnh đại diện"; top hoạt động hiện như những con dấu tròn lệch kiểu tem hộ chiếu, đánh số 1-5.

- Lấy dữ liệu từ **`/api/community`** — một điểm cuối riêng, khác `/api/admin/stats` của khu quản lý — chỉ trả **tên hiển thị** (và số bài/bình luận cho top hoạt động), không email, không vai trò, không ID: vì đây là điểm công khai, không yêu cầu đăng nhập.
- Hai hàm `onlineMembers()`/`topActiveMembers()` trong `functions/_lib/stats.js` dùng chung cho cả tab Thống kê (đầy đủ) và góc cộng đồng (rút gọn), để không lặp lại cùng một câu SQL ở hai nơi.
- Không có JavaScript hoặc gọi API lỗi: giữ nguyên hai dòng thông báo trống có sẵn trong `site/index.html` ("Hiện chưa có ai online." / "Chưa có hoạt động nào.").
- **Kiểm thử:** mục 9e của `dev/test-api.mjs` — xác nhận dữ liệu khớp với tab Thống kê và không lộ email/vai trò/ID.

## Ảnh ở đầu trang chủ

Ba tấm ảnh xếp chồng nghiêng ở đầu trang chủ (lớp CSS `.stack`) đổi được ngay từ tab **Trang chủ** trong `/quan-ly`, không cần sửa mã nguồn: chọn một ảnh mới cho từng vị trí (to nhất/bên trái, trên/bên phải, dưới/bên phải), hoặc bấm "Dùng ảnh mặc định" để quay lại ảnh có sẵn (`site/images/min.jpg`, `scene-dalat-wide.svg`, `scene-kyoto-wide.svg`). Ảnh tải lên được nén nhỏ lại ngay trên trình duyệt trước khi gửi, giống cách nén ảnh bìa bài viết.

- Lưu trong bảng **`settings`** dạng khóa/giá trị (`hero_photo_1`, `hero_photo_2`, `hero_photo_3`) — thiếu khóa nào thì dùng ảnh mặc định có sẵn trong HTML cho vị trí đó. Đọc công khai qua **`GET /api/settings`**, ghi (chỉ chủ trang) qua **`PUT /api/settings`**.
- Ảnh tải lên lưu trong cùng bảng `images` như ảnh bài viết, nhưng không gắn vào bài nào (`post_id` rỗng) — đúng khái niệm ảnh "thư viện" đã có ở tab **Ảnh**. Vì vậy `functions/api/images/[id].js` xem một ảnh là công khai khi nó gắn với bài đã đăng **hoặc** đang được một thiết lập trang chủ dùng tới.
- Trang chủ (`site/js/hero-settings.js`) gọi `/api/settings` một lần khi tải trang; nếu chủ trang chưa đổi gì thì giữ nguyên ảnh có sẵn trong HTML, không gọi thêm.
- **Kiểm thử:** mục 9f của `dev/test-api.mjs` (đọc/ghi thiết lập, phân quyền, dữ liệu không hợp lệ, tự nâng cấp cơ sở dữ liệu cũ) và mục 3 của `dev/test-images.mjs` (ảnh không gắn bài nào vẫn công khai khi đang dùng ở thiết lập trang chủ, hết công khai khi bỏ dùng).

## Bảo mật

`dev/test-security.mjs` đóng vai kẻ tấn công trên bản chạy thử (không bao giờ đụng tới trang thật) và thử nhiều kiểu tấn công phổ biến, mỗi lần đều kiểm tra là bị chặn:

- **CSRF:** yêu cầu thay đổi dữ liệu không đến từ chính trang (tiêu đề `Origin` sai, thiếu, hoặc `null`) bị từ chối.
- **Phân quyền và IDOR:** thành viên thường không gọi được API của chủ trang; không ai đọc/sửa/xóa được dữ liệu của người khác hay bài còn là nháp của người khác qua URL hoặc API.
- **XSS:** `<script>`, `javascript:`, thẻ HTML được gõ vào tiêu đề, tóm tắt, thành phố, nội dung, tên hiển thị, bình luận... đều bị thoát ký tự khi hiển thị, không chạy được.
- **Tải ảnh:** tệp giả dạng ảnh (chữ ký tệp sai), SVG có thể chứa JS, và ảnh quá 400 KB đều bị từ chối; chỉ chủ trang tải được.
- **SQL injection:** ký tự đặc biệt (`'`, `;`, `--`) trong mọi trường không làm hỏng truy vấn hay xóa được dữ liệu (mọi câu lệnh đều dùng tham số, không nối chuỗi).
- **Dò mật khẩu:** đăng nhập sai liên tục bị khóa theo IP và theo tài khoản.
- **Phiên đăng nhập:** cookie có `HttpOnly` (JavaScript không đọc được) và `SameSite=Lax`.
- **Đặt lại mật khẩu:** mã đoán bừa không dùng được; mã thật chỉ dùng được một lần.
- **Ảnh chưa công khai:** ảnh mới tải lên hoặc gắn với bài còn là nháp không xem được bằng cách đoán số ID; chỉ công khai khi bài đã đăng (xem mục "Ảnh của bài viết" ở trên).
- **Tiêu đề bảo mật:** mọi trang đều có CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

Không có giới hạn này thay được việc tự rà soát khi thêm tính năng mới: trường dữ liệu mới nào hiển thị ra trang cũng cần thoát ký tự, API mới nào thay đổi dữ liệu cũng cần `requireAdmin`/`requireUser` và nằm sau `_middleware.js`.

**Chưa có (làm sau):** tải ảnh lên (cần bật R2 trong Cloudflare, có thẻ thanh toán dù vẫn trong hạn mức miễn phí), và xác nhận email hoặc tự động gửi liên kết quên mật khẩu (cần gói Workers trả phí để gửi thư tới người lạ). Hiện ảnh bìa và ảnh trong bài được chèn bằng đường dẫn `/images/...` hoặc liên kết https.

## Công cụ tìm kiếm và chia sẻ

Trang đã có sẵn những thứ công cụ tìm kiếm và mạng xã hội cần:

- `site/robots.txt` cho phép mọi bot, kèm địa chỉ sơ đồ trang.
- `/sitemap.xml` (hàm `functions/sitemap.xml.js`) liệt kê trang chủ, Giới thiệu, Quyền riêng tư và mọi bài đã đăng. Bài nháp, bài mẫu và trang tài khoản không có trong đó.
- `/rss.xml` là nguồn cấp 30 bài mới nhất, dùng cho trình đọc tin và công cụ tự động đăng lên mạng xã hội.
- Mỗi trang có địa chỉ chuẩn (`canonical`), thẻ Open Graph và Twitter Card để chia sẻ link ra đẹp, cùng dữ liệu có cấu trúc schema.org (WebSite, Person, ProfilePage, BlogPosting). Ảnh xem trước mặc định là `site/images/og-cover.jpg` (1200×630); bài nào có ảnh bìa JPG hoặc PNG thì dùng ảnh bìa đó.
- Bài mẫu (`site/posts/*.html`) và các trang đăng nhập, đăng ký, quản lý mang thẻ `noindex` nên không lên Google. Bài thật đăng trong `/quan-ly` thì được lập chỉ mục.
- **IndexNow:** khi bạn đăng, sửa hoặc xóa một bài công khai, máy chủ tự báo cho Bing, Yandex, Naver, Seznam, Yep. Khóa nằm ở `INDEXNOW_KEY` trong `wrangler.jsonc` và ở tệp `site/<khóa>.txt`; hai nơi phải khớp nhau. Google không dùng IndexNow, hãy gửi sơ đồ trang trong Google Search Console.

**Xác minh quyền sở hữu** (Google Search Console, Bing Webmaster Tools): dán thẻ `<meta name="google-site-verification" ...>` hoặc `<meta name="msvalidate.01" ...>` vào `<head>` của `site/index.html`, hoặc đặt tệp xác minh họ đưa (ví dụ `googleXXXX.html`, `BingSiteAuth.xml`) vào thư mục `site/`.

**Đổi sang tên miền riêng:** đặt biến `SITE_URL` trong `wrangler.jsonc` (cho sitemap, RSS, bài viết), rồi thay chuỗi `https://minthichlamvlog.pages.dev` trong `site/index.html`, `site/about.html`, `site/rieng-tu.html` và `site/robots.txt`, và đổi `host` tương ứng khi khai báo IndexNow.

## Font chữ

Trang dùng hai họ font từ Google Fonts: **Outfit** cho chữ thường và **Bricolage Grotesque** cho tiêu đề lớn (biến `--font` / `--font-display` trong `site/css/style.css`). Nếu trình duyệt của người xem không tải được Google Fonts, trang sẽ dùng font hệ thống và vẫn đọc được. Muốn tự lưu font, hãy tải cả hai họ font từ fonts.google.com, đặt vào `site/fonts/`, và thay thẻ `<link>` Google Fonts trong `<head>` mỗi trang (và trong `functions/_lib/layout.js`) bằng quy tắc `@font-face` (nhớ giữ `style-src` và `font-src` trong `site/_headers` khớp). Cả hai font đều miễn phí theo giấy phép SIL Open Font License.
