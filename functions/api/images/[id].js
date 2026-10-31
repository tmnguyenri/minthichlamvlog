// Xem và xóa một ảnh. Xem công khai CHỈ khi ảnh gắn với một bài đã đăng; ảnh của bài còn là nháp
// hoặc chưa gắn vào bài nào (mới tải lên, đang soạn) chỉ chủ trang xem được, để không lộ ảnh trước khi đăng.
// Xóa chỉ dành cho chủ trang.
import { requireAdmin } from '../../_lib/auth.js';
import { fail } from '../../_lib/http.js';

const notFound = () => fail(404, 'not_found', 'Không tìm thấy ảnh.', 'Image not found.');
const idOf = (params) => (/^\d{1,12}$/.test(params.id) ? Number(params.id) : null);

// D1 có thể trả cột BLOB dưới nhiều dạng; chuyển về mảng byte để Response luôn đọc được.
export function toBytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Uint8Array.from(value);
  if (typeof value === 'string') return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  return null;
}

export async function onRequestGet({ params, env, data }) {
  const id = idOf(params);
  const row = id && await env.DB.prepare(
    `SELECT i.mime, i.data, p.status AS post_status FROM images i LEFT JOIN posts p ON p.id = i.post_id WHERE i.id = ?`,
  ).bind(id).first();
  if (!row) return notFound();
  const isPublic = row.post_status === 'published';
  // post_status NULL (chưa gắn vào bài nào) hoặc khác 'published' (còn là nháp): chỉ chủ trang xem được.
  if (!isPublic && data.user?.role !== 'admin') return notFound();
  const bytes = toBytes(row.data);
  if (!bytes) {
    console.error('images: dữ liệu ảnh không đọc được', id, typeof row.data);
    return fail(500, 'bad_image', 'Không đọc được ảnh này.', 'This image could not be read.');
  }
  return new Response(bytes, {
    headers: {
      'content-type': row.mime,
      // Ảnh của bài chưa đăng chỉ chủ trang xem được nên không được cache công khai (bộ nhớ đệm dùng chung
      // có thể lỡ phát lại cho người khác). Ảnh của bài đã đăng mới cache công khai.
      'cache-control': isPublic ? 'public, max-age=86400' : 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function onRequestDelete({ params, env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const id = idOf(params);
  if (!id) return notFound();
  const res = await env.DB.prepare('DELETE FROM images WHERE id = ?').bind(id).run();
  if (!res.meta.changes) return notFound();
  return new Response(null, { status: 204 });
}
