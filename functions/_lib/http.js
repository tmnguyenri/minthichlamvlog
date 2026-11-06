// Tiện ích HTTP dùng chung cho các hàm phía máy chủ.

export const CSP = [
  "default-src 'self'",
  "img-src 'self' https: data:",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  // Beacon đo lường của Cloudflare được chèn vào HTML ở tầng biên, nên phải cho phép riêng.
  "script-src 'self' https://static.cloudflareinsights.com",
  "frame-src https://www.youtube-nocookie.com",
  "connect-src 'self' https://cloudflareinsights.com",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

export const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-frame-options': 'DENY',
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

// Lỗi có sẵn hai ngôn ngữ để giao diện hiện đúng theo VI/EN.
export function fail(status, code, vi, en, extra = {}) {
  return json({ ok: false, error: code, message: { vi, en } }, status, extra);
}

export function html(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', ...extra },
  });
}

export async function readJson(request, maxChars = 200000) {
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (!type.startsWith('application/json')) return null;
  let text;
  try { text = await request.text(); } catch { return null; }
  if (text.length > maxChars) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Đệm ngắn trong bộ nhớ của isolate, cho những điểm công khai bị gọi nhiều (mỗi lượt tải trang chủ,
// mỗi lượt bot quét) để không phải truy vấn D1 ở từng yêu cầu. Chỉ dùng cho dữ liệu giống nhau với
// mọi khách và chấp nhận cũ vài chục giây — không dùng cho dữ liệu riêng của từng người.
const memoStore = new Map();
export async function memoize(key, ttlSeconds, load) {
  const hit = memoStore.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await load();
  if (memoStore.size > 64) memoStore.clear();
  memoStore.set(key, { value, until: Date.now() + ttlSeconds * 1000 });
  return value;
}

export function badRequest() {
  return fail(400, 'bad_request', 'Yêu cầu không hợp lệ.', 'Invalid request.');
}
