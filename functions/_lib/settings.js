// Thiết lập trang chủ chỉnh được từ khu quản lý (tab "Trang chủ") mà không cần sửa mã nguồn —
// lưu trong bảng settings dạng khóa/giá trị. Hiện chỉ có ba ảnh ở đầu trang chủ; sau này thêm
// thiết lập mới chỉ cần thêm khóa vào đây, không cần đổi cấu trúc bảng.
export const HERO_PHOTO_KEYS = ['hero_photo_1', 'hero_photo_2', 'hero_photo_3'];

export async function readSettings(env, keys) {
  if (!keys.length) return {};
  const placeholders = keys.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    .bind(...keys).all();
  const out = {};
  for (const row of results) out[row.key] = row.value;
  return out;
}
