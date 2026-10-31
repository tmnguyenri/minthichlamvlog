import { allow, cleanup, clientKey, createSession, fakeVerify, sessionCookies, tooMany, verifyPassword, withCookies } from '../../_lib/auth.js';
import { badRequest, fail, json, readJson } from '../../_lib/http.js';

export async function onRequestPost({ request, env, waitUntil }) {
  const body = await readJson(request);
  if (!body) return badRequest();
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 254);
  const password = String(body.password ?? '').slice(0, 128);
  if (!email || !password) return fail(400, 'missing', 'Hãy nhập email và mật khẩu.', 'Please enter your email and password.');

  const ip = await clientKey(request);
  if (!(await allow(env, `login:ip:${ip}`, 30, 900)) || !(await allow(env, `login:acct:${email}`, 10, 900))) return tooMany();

  const user = await env.DB.prepare('SELECT id, password_hash, role, status FROM users WHERE email = ?').bind(email).first();
  let good = false;
  if (user) good = await verifyPassword(password, user.password_hash); else await fakeVerify(password);
  if (!good) return fail(401, 'invalid', 'Email hoặc mật khẩu chưa đúng.', 'Wrong email or password.');

  if (user.status === 'pending') return fail(403, 'pending', 'Tài khoản của bạn đang chờ được duyệt. Mình sẽ duyệt sớm nhé!', 'Your account is waiting for approval. It will be approved soon.');
  if (user.status !== 'approved') return fail(403, 'blocked', 'Tài khoản này không thể đăng nhập.', 'This account cannot log in.');

  const token = await createSession(env, user.id);
  const work = cleanup(env).catch(() => {});
  if (waitUntil) waitUntil(work);
  return withCookies(json({ ok: true, role: user.role }), sessionCookies(request, token));
}
