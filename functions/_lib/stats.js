// Ghi số liệu để hiện ở tab Thống kê trong khu quản lý: lượt xem trang công khai (ẩn danh) và
// lần hoạt động gần nhất của từng thành viên (để biết ai "đang online").
import { now, randomToken } from './auth.js';

const VID_COOKIE = 'vid';
const VID_RE = /^[A-Za-z0-9_-]{20,64}$/;
const VID_MAX_AGE = 365 * 24 * 3600; // 1 năm

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
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

  let vid = readCookie(request, VID_COOKIE);
  let out = response;
  if (!VID_RE.test(vid)) {
    vid = randomToken();
    const secure = url.protocol === 'https:' ? '; Secure' : '';
    out = new Response(response.body, response);
    out.headers.append('set-cookie', `${VID_COOKIE}=${vid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VID_MAX_AGE}${secure}`);
  }
  if (env.DB) {
    const t = now();
    waitUntil(
      env.DB.prepare('INSERT INTO page_views (path, visitor_id, created_at) VALUES (?, ?, ?)')
        .bind(path.slice(0, 200), vid, t).run().catch(() => { /* bảng chưa kịp tạo lần đầu: bỏ qua, lần sau sẽ có */ }),
    );
  }
  return out;
}

// Mỗi yêu cầu có người đăng nhập: cập nhật lần hoạt động gần nhất để biết ai "đang online".
export function touchLastSeen(env, userId, waitUntil) {
  if (!env.DB) return;
  waitUntil(env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(now(), userId).run().catch(() => {}));
}
