// Mật khẩu, phiên đăng nhập và giới hạn số lần thử.
import { fail } from './http.js';

const enc = new TextEncoder();
const ITERATIONS = 100000; // mức tối đa mà WebCrypto của Cloudflare Workers cho phép
const SESSION_SECONDS = 30 * 24 * 3600;

export const now = () => Math.floor(Date.now() / 1000);

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64Url = (bytes) => toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

const DUMMY_SALT = new Uint8Array(16);

export async function verifyPassword(password, stored) {
  const [alg, iter, salt, hash] = String(stored || '').split('$');
  if (alg !== 'pbkdf2-sha256') return false;
  const n = Number(iter);
  if (!Number.isInteger(n) || n < 1000 || n > ITERATIONS) return false;
  const got = await derive(password, fromB64(salt), n);
  return sameBytes(got, fromB64(hash));
}

// Tốn thời gian như thật khi email không tồn tại, để không lộ email nào đã đăng ký.
export async function fakeVerify(password) { await derive(password, DUMMY_SALT, ITERATIONS); }

export function randomToken() { return toB64Url(crypto.getRandomValues(new Uint8Array(32))); }

// ---- cookie ----
function isSecure(request) { return new URL(request.url).protocol === 'https:'; }
const sidName = (request) => (isSecure(request) ? '__Host-sid' : 'sid');

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

export function sessionCookies(request, token) {
  const secure = isSecure(request) ? '; Secure' : '';
  const maxAge = token ? SESSION_SECONDS : 0;
  const value = token || '';
  return [
    `${sidName(request)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`,
    // cookie gợi ý (không bí mật) để trang tĩnh biết có nên hỏi máy chủ "tôi là ai" hay không
    `mtlv_in=${token ? '1' : ''}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`,
  ];
}

export function withCookies(response, cookies) {
  const r = new Response(response.body, response);
  for (const c of cookies) r.headers.append('set-cookie', c);
  return r;
}

export async function createSession(env, userId) {
  const token = randomToken();
  const t = now();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, t, t + SESSION_SECONDS).run();
  return token;
}

export async function getUser(request, env) {
  const token = readCookie(request, sidName(request));
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.role FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ? AND u.status = 'approved'`,
  ).bind(await sha256Hex(token), now()).first();
  return row || null;
}

export async function destroySession(request, env) {
  const token = readCookie(request, sidName(request));
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(token)).run();
}

// ---- giới hạn số lần thử ----
export async function clientKey(request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  return (await sha256Hex(`ip:${ip}`)).slice(0, 24); // không lưu IP thật
}

/** Trả về true nếu còn trong hạn mức. Mỗi lần gọi tính một lượt. */
export async function allow(env, key, max, windowSeconds) {
  const t = now();
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN reset_at <= ?3 THEN 1 ELSE count + 1 END,
       reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END
     RETURNING count`,
  ).bind(key, t + windowSeconds, t).first();
  return row.count <= max;
}

export async function cleanup(env) {
  const t = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(t),
    env.DB.prepare('DELETE FROM rate_limits WHERE reset_at <= ?').bind(t),
  ]);
}

export const tooMany = () => fail(429, 'rate_limited',
  'Bạn thao tác quá nhanh. Hãy thử lại sau ít phút.', 'Too many attempts. Please try again in a few minutes.');

export function requireAdmin(data) {
  if (!data.user) return fail(401, 'unauthorized', 'Bạn cần đăng nhập.', 'Please log in.');
  if (data.user.role !== 'admin') return fail(403, 'forbidden', 'Bạn không có quyền làm việc này.', 'You are not allowed to do this.');
  return null;
}

export function requireUser(data) {
  if (!data.user) return fail(401, 'unauthorized', 'Bạn cần đăng nhập.', 'Please log in.');
  return null;
}
