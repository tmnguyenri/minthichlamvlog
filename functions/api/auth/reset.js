// Đặt mật khẩu mới bằng liên kết do chủ trang tạo (role "reset:<id thành viên>")
// hoặc bằng mã khôi phục khẩn cấp do chủ trang tự thêm vào D1 (role "reset", cần kèm email).
// Cả hai nằm trong bảng invites, chỉ lưu SHA-256 của mã, dùng một lần, hết hạn sau RESET_SECONDS.
import { RESET_SECONDS, allow, clientKey, hashPassword, now, sha256Hex, tooMany } from '../../_lib/auth.js';
import { badRequest, fail, json, readJson } from '../../_lib/http.js';
import { isEmail } from '../../_lib/validate.js';

const invalid = () => fail(400, 'invalid_token',
  'Liên kết hoặc mã khôi phục không đúng, đã được dùng hoặc đã hết hạn.',
  'The link or recovery code is wrong, already used, or expired.');

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return badRequest();
  const token = String(body.token ?? '').trim().slice(0, 200);
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 254);
  const password = String(body.password ?? '');

  if (!token) return fail(400, 'token', 'Hãy nhập mã khôi phục.', 'Please enter the recovery code.');
  if (password.length < 10 || password.length > 128) {
    return fail(400, 'password', 'Mật khẩu cần từ 10 đến 128 ký tự.', 'Password must be 10 to 128 characters.');
  }
  if (!(await allow(env, `reset:ip:${await clientKey(request)}`, 10, 3600))) return tooMany();
  if (email && !(await allow(env, `reset:acct:${email}`, 10, 3600))) return tooMany();

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT role, created_at FROM invites
      WHERE token_hash = ? AND used_at IS NULL AND (role = 'reset' OR role LIKE 'reset:%')`,
  ).bind(tokenHash).first();
  if (!row || row.created_at + RESET_SECONDS < now()) return invalid();

  // Liên kết do chủ trang tạo đã gắn sẵn với một thành viên; mã khẩn cấp thì cần biết email nào.
  const bound = /^reset:(\d{1,12})$/.exec(row.role);
  let user;
  if (bound) {
    user = await env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(Number(bound[1])).first();
  } else {
    if (!isEmail(email)) return fail(400, 'email', 'Hãy nhập email của tài khoản cần đặt lại mật khẩu.', 'Please enter the email of the account to reset.');
    user = await env.DB.prepare('SELECT id, email FROM users WHERE email = ?').bind(email).first();
  }
  if (!user) return invalid();

  // Băm trước khi dùng mã: nếu bước tốn CPU này bị ngắt thì mã chưa bị dùng mất.
  const passwordHash = await hashPassword(password, env);
  const used = await env.DB.prepare('UPDATE invites SET used_at = ? WHERE token_hash = ? AND used_at IS NULL')
    .bind(now(), tokenHash).run();
  if (!used.meta.changes) return invalid();

  try {
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, user.id),
      // Đăng xuất mọi nơi đang dùng mật khẩu cũ.
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
      // Các liên kết khác còn treo của thành viên này không còn dùng được nữa.
      env.DB.prepare('UPDATE invites SET used_at = ? WHERE used_at IS NULL AND role = ?').bind(now(), `reset:${user.id}`),
      // Gỡ giới hạn đăng nhập sai để vào được ngay bằng mật khẩu mới.
      env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(`login:acct:${user.email}`),
    ]);
  } catch {
    await env.DB.prepare('UPDATE invites SET used_at = NULL WHERE token_hash = ?').bind(tokenHash).run();
    return fail(500, 'server', 'Chưa đặt lại được mật khẩu. Hãy thử lại.', 'Could not reset the password. Please try again.');
  }
  return json({ ok: true });
}
