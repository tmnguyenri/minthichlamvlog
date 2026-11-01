// Thiết lập trang chủ và trang giới thiệu chỉnh được từ khu quản lý (tab "Trang chủ", tab "Giới
// thiệu") mà không cần sửa mã nguồn — lưu trong bảng settings dạng khóa/giá trị. Thêm thiết lập mới
// chỉ cần thêm khóa vào đây, không cần đổi cấu trúc bảng.
export const HERO_PHOTO_KEYS = ['hero_photo_1', 'hero_photo_2', 'hero_photo_3'];

// Trang giới thiệu (/about): ảnh chân dung, phần giới thiệu bản thân (Markdown rút gọn, tự dịch
// sang tiếng Anh giống bài viết) và các liên kết liên hệ.
export const ABOUT_KEYS = ['about_photo', 'about_body', 'about_body_en', 'about_email', 'about_youtube', 'about_instagram'];

// Khóa nào lưu đường dẫn một ảnh (dùng để mở rộng quyền xem công khai trong images/[id].js, và áp
// dụng cùng một kiểu kiểm tra định dạng https://... hoặc /đường-dẫn khi ghi).
export const IMAGE_SETTING_KEYS = [...HERO_PHOTO_KEYS, 'about_photo'];

export const ALL_SETTINGS_KEYS = [...HERO_PHOTO_KEYS, ...ABOUT_KEYS];

export const ABOUT_BODY_MAX = 8000;

export async function readSettings(env, keys) {
  if (!keys.length) return {};
  const placeholders = keys.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    .bind(...keys).all();
  const out = {};
  for (const row of results) out[row.key] = row.value;
  return out;
}
