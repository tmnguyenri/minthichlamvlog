import { requireAdmin } from '../../../_lib/auth.js';
import { badRequest, fail, json, readJson } from '../../../_lib/http.js';

async function target(params, env, data) {
  const id = /^\d{1,12}$/.test(params.id) ? Number(params.id) : null;
  const u = id && await env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(id).first();
  if (!u) return { res: fail(404, 'not_found', 'Không tìm thấy thành viên.', 'Member not found.') };
  if (u.role === 'admin' || u.id === data.user.id) {
    return { res: fail(403, 'forbidden', 'Không thể thay đổi tài khoản quản trị.', 'Admin accounts cannot be changed here.') };
  }
  return { id };
}

export async function onRequestPatch({ request, params, env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body || !['approved', 'pending', 'blocked'].includes(body.status)) return badRequest();
  const { id, res } = await target(params, env, data);
  if (res) return res;
  await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(body.status, id).run();
  if (body.status !== 'approved') await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  return json({ ok: true });
}

export async function onRequestDelete({ params, env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const { id, res } = await target(params, env, data);
  if (res) return res;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}
