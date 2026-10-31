import { requireUser } from '../../_lib/auth.js';
import { fail, json } from '../../_lib/http.js';

export async function onRequestDelete({ params, env, data }) {
  const denied = requireUser(data);
  if (denied) return denied;
  const id = /^\d{1,12}$/.test(params.id) ? Number(params.id) : null;
  const c = id && await env.DB.prepare('SELECT user_id FROM comments WHERE id = ?').bind(id).first();
  if (!c) return fail(404, 'not_found', 'Không tìm thấy bình luận.', 'Comment not found.');
  if (data.user.role !== 'admin' && c.user_id !== data.user.id) {
    return fail(403, 'forbidden', 'Bạn không có quyền xóa bình luận này.', 'You cannot delete this comment.');
  }
  await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
