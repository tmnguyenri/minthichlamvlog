// Thông tin chung của trang, dùng cho sitemap, RSS, thẻ chia sẻ và dữ liệu có cấu trúc.
// Đổi tên miền: đặt biến SITE_URL trong wrangler.jsonc (hoặc sửa hằng số bên dưới), và đổi chuỗi
// https://minthichlamvlog.pages.dev trong các tệp site/*.html, site/robots.txt.
export const SITE_URL = 'https://minthichlamvlog.pages.dev';
export const SITE_NAME = 'Mìn Thích Làm Vlog';
export const SITE_DESC = 'Nhật ký du lịch cá nhân: ảnh, vlog và những chuyện kể từ mỗi chuyến đi.';
export const SOCIALS = ['https://www.youtube.com/@MinThichLamVlog', 'https://www.instagram.com/minthichlamvlog/'];
export const DEFAULT_IMAGE = '/images/og-cover.jpg';

export const siteUrl = (env) => String(env?.SITE_URL || SITE_URL).replace(/\/+$/, '');

// Đường dẫn bắt đầu bằng / -> địa chỉ đầy đủ. Địa chỉ https giữ nguyên.
export function absolute(base, value) {
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : base + (value.startsWith('/') ? value : '/' + value);
}

// Ảnh dùng khi chia sẻ: ảnh bìa nếu là ảnh thường; SVG hoặc không có ảnh thì dùng ảnh mặc định
// (Facebook, Zalo, X... không hiển thị được SVG).
export function shareImage(base, cover) {
  if (!cover || /\.svg(\?|#|$)/i.test(cover)) return base + DEFAULT_IMAGE;
  return absolute(base, cover);
}

// Giây (Unix) -> chuỗi ISO. Rỗng nếu không hợp lệ.
export function isoDate(sec) {
  const n = Number(sec);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : '';
}

// JSON an toàn để đặt trong thẻ <script type="application/ld+json">.
export function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

// Mô tả ngắn cho thẻ meta: tóm tắt nếu có, không thì lấy đầu nội dung.
export function describe(post) {
  if (post.excerpt) return post.excerpt;
  return String(post.body || '').replace(/[#>*_`\[\]()!]|https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}
