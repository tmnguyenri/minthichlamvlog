import { allow, clientKey, createSession, hashPassword, now, sessionCookies, sha256Hex, tooMany, withCookies } from '../../_lib/auth.js';
import { badRequest, fail, json, readJson } from '../../_lib/http.js';
import { cleanName, isEmail } from '../../_lib/validate.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return badRequest();
  if (!(await allow(env, `reg:ip:${await clientKey(request)}`, 5, 3600))) return tooMany();

  const email = String(body.email ?? '').trim().toLowerCase();
  const name = cleanName(body.name);
  const password = String(body.password ?? '');
  const invite = String(body.invite ?? '').trim();

  if (!isEmail(email)) return fail(400, 'email', 'Email chưa hợp lệ.', 'Please enter a valid email.');
  if (!name) return fail(400, 'name', 'Tên hiển thị cần từ 2 đến 40 ký tự.', 'Display name must be 2 to 40 characters.');
  if (password.length < 10 || password.length > 128) {
    return fail(400, 'password', 'Mật khẩu cần từ 10 đến 128 ký tự.', 'Password must be 10 to 128 characters.');
  }

  // Băm trước khi đụng tới mã mời: nếu bước tốn CPU này bị ngắt thì mã mời chưa bị dùng.
  const passwordHash = await hashPassword(password, env);

  let role = 'member';
  let status = 'pending';
  let inviteHash = '';
  if (invite) {
    inviteHash = await sha256Hex(invite);
    // Chỉ mã mời tạo tài khoản mới dùng được ở đây; mã đặt lại mật khẩu (role "reset...") thì không.
    const used = await env.DB.prepare(
      `UPDATE invites SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND role IN ('admin', 'member')`,
    ).bind(now(), inviteHash).run();
    if (!used.meta.changes) return fail(400, 'invite', 'Mã mời không đúng hoặc đã được dùng.', 'The invite code is wrong or already used.');
    role = (await env.DB.prepare('SELECT role FROM invites WHERE token_hash = ?').bind(inviteHash).first()).role;
    status = 'approved';
  }
  const releaseInvite = () => inviteHash
    ? env.DB.prepare('UPDATE invites SET used_at = NULL WHERE token_hash = ?').bind(inviteHash).run()
    : null;

  const taken = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (taken) {
    await releaseInvite();
    // Không tiết lộ email đã đăng ký hay chưa, trừ khi người gửi có mã mời hợp lệ.
    if (inviteHash) return fail(409, 'email_taken', 'Email này đã có tài khoản.', 'This email already has an account.');
    return json({ ok: true, status: 'pending' });
  }

  let userId;
  try {
    const res = await env.DB.prepare(
      'INSERT INTO users (email, display_name, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(email, name, passwordHash, role, status, now()).run();
    userId = res.meta.last_row_id;
  } catch {
    await releaseInvite();
    return json({ ok: true, status: 'pending' });
  }

  if (status === 'approved') {
    const token = await createSession(env, userId);
    return withCookies(json({ ok: true, status, role }), sessionCookies(request, token));
  }
  return json({ ok: true, status });
}
