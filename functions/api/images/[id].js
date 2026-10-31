// Xem và xóa một ảnh. Xem công khai để ảnh hiện được trong bài; xóa chỉ dành cho chủ trang.
import { requireAdmin } from '../../_lib/auth.js';
import { fail } from '../../_lib/http.js';

const notFound = () => fail(404, 'not_found', 'Không tìm thấy ảnh.', 'Image not found.');
const idOf = (params) => (/^\d{1,12}$/.test(params.id) ? Number(params.id) : null);

export async function onRequestGet({ params, env }) {
  const id = idOf(params);
  const row = id && await env.DB.prepare('SELECT mime, data FROM images WHERE id = ?').bind(id).first();
  if (!row) return notFound();
  return new Response(row.data, {
    headers: {
      'content-type': row.mime,
      'cache-control': 'public, max-age=86400',
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
