// Ghi số liệu để hiện ở tab Thống kê trong khu quản lý: lượt xem trang công khai (ẩn danh) và
// lần hoạt động gần nhất của từng thành viên (để biết ai "đang online").
import { now, randomToken } from './auth.js';

const VID_COOKIE = 'vid';
const VID_RE = /^[A-Za-z0-9_-]{20,64}$/;
const VID_MAX_AGE = 365 * 24 * 3600; // 1 năm
// Cookie nhớ "hôm nay đã đếm khách này chưa" để sang ngày mới mới tính lại một lần.
const DAY_COOKIE = 'vd';
const DAY = 86400;

// Lượt xem được gom trong bộ nhớ của bản chạy (isolate) này rồi ghi xuống D1 theo từng đợt. Mỗi bản chạy
// phục vụ rất nhiều lượt trong 10 giây, nên thay vì một dòng cho mỗi lượt (bảng phình cả trăm MB mỗi
// ngày khi đông khách) thì mỗi ngày chỉ còn đúng một dòng, cộng dồn. Đổi lại, lượt xem của khoảng 10
// giây cuối trước khi bản chạy bị thu hồi có thể không kịp ghi — với số liệu tham khảo thì đánh đổi
// này hợp lý, và nó không ảnh hưởng nội dung trang.
const FLUSH_MS = 10 * 1000;
const pending = new Map(); // day (số nguyên) -> { views, visitors }
let lastFlush = 0;

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

// Ghi những gì đã gom được. Gọi ở cuối mỗi lượt (đủ 10 giây kể từ lần trước) và từ cleanup() để không
// bỏ sót số liệu khi bản chạy sắp hết việc.
export function flushStats(env, waitUntil) {
  if (!env || !env.DB || !pending.size) return;
  lastFlush = Date.now();
  const rows = [...pending.entries()];
  pending.clear();
  const sql = `INSERT INTO stats_daily (day, views, visitors) VALUES (?1, ?2, ?3)
    ON CONFLICT(day) DO UPDATE SET views = views + ?2, visitors = visitors + ?3`;
  const run = env.DB.batch(rows.map(([day, b]) => env.DB.prepare(sql).bind(day, b.views, b.visitors)))
    .catch(() => { /* bảng chưa kịp tạo hoặc D1 tạm lỗi: bỏ đợt này, lượt sau ghi lại */ });
  if (waitUntil) waitUntil(run); else run;
}

// Ghi một lượt xem (nếu đáng tính) và, khi chưa có khách ẩn danh nào, gắn thêm cookie mới vào kết quả.
// Chỉ tính các trang công khai (GET, trả về HTML, không phải /api/, không phải khu quản lý) để số liệu
// phản ánh đúng khách ghé trang, không lẫn các yêu cầu kỹ thuật hay chính chủ trang đang soạn bài.
export function trackPageView(request, env, response, waitUntil) {
  if (request.method !== 'GET') return response;
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith('/api/') || path === '/quan-ly' || path === '/quan-ly.html') return response;
  if (response.status !== 200) return response;
  if (!(response.headers.get('content-type') || '').startsWith('text/html')) return response;

  const day = Math.floor(now() / DAY);
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  const cookies = [];

  let vid = readCookie(request, VID_COOKIE);
  if (!VID_RE.test(vid)) {
    vid = randomToken();
    cookies.push(`${VID_COOKIE}=${vid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VID_MAX_AGE}${secure}`);
  }

  const countedToday = readCookie(request, DAY_COOKIE) === String(day);
  if (!countedToday) {
    cookies.push(`${DAY_COOKIE}=${day}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAY}${secure}`);
  }

  const bucket = pending.get(day) || { views: 0, visitors: 0 };
  bucket.views += 1;
  if (!countedToday) bucket.visitors += 1;
  pending.set(day, bucket);

  if (Date.now() - lastFlush >= FLUSH_MS) flushStats(env, waitUntil);

  if (!cookies.length) return response;
  const out = new Response(response.body, response);
  for (const cookie of cookies) out.headers.append('set-cookie', cookie);
  return out;
}

// Mỗi yêu cầu có người đăng nhập: cập nhật lần hoạt động gần nhất để biết ai "đang online".
export function touchLastSeen(env, userId, waitUntil) {
  if (!env.DB) return;
  waitUntil(env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(now(), userId).run().catch(() => {}));
}

// Coi là "đang online" nếu có hoạt động trong khoảng này (giây) trở lại đây.
export const ONLINE_SECONDS = 5 * 60;

// Thành viên đã duyệt, còn hoạt động gần đây — dùng chung cho tab Thống kê (khu quản lý, đầy đủ)
// và góc cộng đồng ở trang chủ (công khai, chỉ lấy display_name).
export async function onlineMembers(env, windowSeconds = ONLINE_SECONDS) {
  const { results } = await env.DB.prepare(
    `SELECT id, display_name, role, last_seen_at FROM users
      WHERE status = 'approved' AND last_seen_at >= ?
      ORDER BY last_seen_at DESC LIMIT 50`,
  ).bind(now() - windowSeconds).all();
  return results || [];
}

// Thành viên hoạt động nhiều nhất (tổng bài viết + bình luận), bỏ thành viên bị khóa và người chưa có hoạt động nào.
export async function topActiveMembers(env, limit = 5) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.display_name,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts,
            (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comments
       FROM users u WHERE u.status != 'blocked'
      ORDER BY (posts + comments) DESC, u.created_at ASC LIMIT ?`,
  ).bind(limit).all();
  return (results || []).filter((u) => u.posts + u.comments > 0);
}
