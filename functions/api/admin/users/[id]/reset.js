// Chủ trang tạo liên kết đặt lại mật khẩu cho một thành viên (gửi cho họ qua Zalo, Messenger...).
// Mã nằm sau dấu # nên không bao giờ gửi lên máy chủ hay lưu trong nhật ký truy cập.
import { RESET_SECONDS, allow, now, randomToken, requireAdmin, sha256Hex, tooMany } from '../../../../_lib/auth.js';
import { fail, json } from '../../../../_lib/http.js';

export async function onRequestPost({ request, params, env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;

  const id = /^\d{1,12}$/.test(params.id) ? Number(params.id) : null;
  const u = id && await env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(id).first();
  if (!u) return fail(404, 'not_found', 'Không tìm thấy thành viên.', 'Member not found.');
  if (u.role === 'admin') {
    return fail(403, 'forbidden', 'Không tạo liên kết cho tài khoản quản trị. Xem hướng dẫn khôi phục trong README.',
      'No reset link for admin accounts. See the recovery steps in the README.');
  }
  if (!(await allow(env, `resetlink:${data.user.id}`, 30, 3600))) return tooMany();

  const token = randomToken();
  const role = `reset:${u.id}`;
  const t = now();
  await env.DB.batch([
    // Liên kết cũ của thành viên này hết hiệu lực, chỉ liên kết mới nhất dùng được.
    env.DB.prepare('UPDATE invites SET used_at = ? WHERE used_at IS NULL AND role = ?').bind(t, role),
    env.DB.prepare('INSERT INTO invites (token_hash, role, created_at) VALUES (?, ?, ?)').bind(await sha256Hex(token), role, t),
  ]);
  const link = `${new URL(request.url).origin}/dat-lai-mat-khau#${token}`;
  return json({ ok: true, link, expires_at: t + RESET_SECONDS });
}
