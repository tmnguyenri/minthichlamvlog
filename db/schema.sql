-- Cơ sở dữ liệu D1 (SQLite) của Mìn Thích Làm Vlog.
-- Chạy tệp này một lần trong D1 > Console. Chạy lại cũng an toàn (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,                       -- pbkdf2-sha256$vòng$muối$băm (không bao giờ lưu mật khẩu thật)
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'blocked')),
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER                                          -- lần cuối có yêu cầu từ người này (xem "đang online" ở khu quản lý)
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,                       -- SHA-256 của mã trong cookie
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Mã mời dùng một lần (để tạo tài khoản quản trị đầu tiên). Chỉ lưu bản băm.
CREATE TABLE IF NOT EXISTS invites (
  token_hash TEXT PRIMARY KEY,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_at INTEGER NOT NULL,
  used_at    INTEGER
);

CREATE TABLE IF NOT EXISTS posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  title_en     TEXT NOT NULL DEFAULT '',
  excerpt      TEXT NOT NULL DEFAULT '',
  excerpt_en   TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',
  body_en      TEXT NOT NULL DEFAULT '',
  country      TEXT NOT NULL DEFAULT '',
  city         TEXT NOT NULL DEFAULT '',             -- thành phố / địa danh (bảng cũ được tự thêm cột này, xem functions/_lib/schema.js)
  trip_date    TEXT NOT NULL DEFAULT '',             -- YYYY-MM
  days         INTEGER,
  cover        TEXT NOT NULL DEFAULT '',             -- https://... hoặc /images/...
  video        TEXT NOT NULL DEFAULT '',             -- mã video YouTube (11 ký tự)
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  author_id    INTEGER NOT NULL REFERENCES users(id),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  published_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_posts_pub ON posts(status, published_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

-- Giới hạn số lần thử (chống đoán mật khẩu và đăng ký hàng loạt).
CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

-- Ảnh tải lên từ trang Thư viện (site/thu-vien.html). Ảnh đã nén thành JPEG, lưu trực tiếp trong bảng.
CREATE TABLE IF NOT EXISTS images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER REFERENCES posts(id) ON DELETE SET NULL,  -- bài đang dùng ảnh (NULL = chỉ nằm trong thư viện)
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  data       BLOB NOT NULL,
  caption    TEXT NOT NULL DEFAULT '',
  author_id  INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at DESC);

-- Lượt xem các trang công khai, để hiện số liệu ở tab Thống kê trong khu quản lý. Mã khách ẩn danh
-- (cookie ngẫu nhiên, không gắn với tài khoản nào) chỉ dùng để đếm khách khác nhau, không để theo dõi ai.
CREATE TABLE IF NOT EXISTS page_views (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  path       TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id);

-- Lượt xem gộp theo ngày (từ bản có tab Thống kê): mỗi ngày đúng một dòng, cộng dồn lượt xem và số
-- khách. Nhờ vậy bảng nhỏ mãi dù trang có hàng triệu lượt mỗi ngày; page_views phía trên là bảng cũ,
-- được chuyển sang đây một lần rồi không ghi vào nữa. day = Math.floor(giây / 86400).
CREATE TABLE IF NOT EXISTS stats_daily (
  day      INTEGER PRIMARY KEY,
  views    INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0
);

-- Vài thiết lập chỉnh được ngay từ khu quản lý mà không cần sửa mã nguồn (ví dụ ảnh ở đầu trang
-- chủ, tab "Trang chủ"). Dạng khóa/giá trị để sau này thêm thiết lập mới không cần đổi cấu trúc
-- bảng. Thiếu một khóa nghĩa là dùng giá trị mặc định có sẵn trong HTML.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
