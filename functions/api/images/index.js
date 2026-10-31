// Thư viện ảnh: liệt kê (chủ trang) và tải ảnh lên (chủ trang).
import { requireAdmin, now } from '../../_lib/auth.js';
import { fail, json } from '../../_lib/http.js';

export const MAX_BYTES = 400 * 1024;
const CAPTION_MAX = 200;

// Nhận diện định dạng theo chữ ký tệp, không tin vào Content-Type do người gửi khai.
export function sniffImage(bytes) {
  const b = new Uint8Array(bytes);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

export async function onRequestGet({ env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const { results } = await env.DB.prepare(
    `SELECT i.id, i.mime, i.size, i.caption, i.created_at, i.post_id, p.title AS post_title
       FROM images i LEFT JOIN posts p ON p.id = i.post_id
      ORDER BY i.id DESC LIMIT 500`,
  ).all();
  return json({ images: results });
}

export async function onRequestPost({ request, env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;

  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BYTES) {
    return fail(413, 'too_large', 'Ảnh quá lớn (tối đa 400 KB). Hãy nén hoặc thu nhỏ ảnh trước khi tải.', 'Image is too large (max 400 KB). Compress or resize it first.');
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) {
    return fail(400, 'empty', 'Chưa có ảnh nào.', 'No image received.');
  }
  if (bytes.byteLength > MAX_BYTES) {
    return fail(413, 'too_large', 'Ảnh quá lớn (tối đa 400 KB). Hãy nén hoặc thu nhỏ ảnh trước khi tải.', 'Image is too large (max 400 KB). Compress or resize it first.');
  }
  const mime = sniffImage(bytes);
  if (!mime) {
    return fail(415, 'bad_type', 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.', 'Only JPEG, PNG or WebP images are accepted.');
  }

  const query = new URL(request.url).searchParams;
  let caption = query.get('caption') || '';
  // eslint-disable-next-line no-control-regex
  caption = caption.normalize('NFC').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, CAPTION_MAX);

  let postId = null;
  const rawPost = query.get('post_id');
  if (rawPost) {
    if (!/^\d{1,12}$/.test(rawPost)) return fail(400, 'bad_post', 'Bài viết không hợp lệ.', 'Invalid post.');
    postId = Number(rawPost);
    const exists = await env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(postId).first();
    if (!exists) return fail(404, 'post_not_found', 'Không tìm thấy bài viết.', 'Post not found.');
  }

  const res = await env.DB.prepare(
    'INSERT INTO images (post_id, mime, size, data, caption, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(postId, mime, bytes.byteLength, bytes, caption, data.user.id, now()).run();

  const id = res.meta.last_row_id;
  return json({ ok: true, id, url: `/api/images/${id}` }, 201);
}
