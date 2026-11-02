// Chạy trước mọi hàm: kiểm tra nguồn gửi, nạp người dùng đang đăng nhập, thêm tiêu đề bảo mật.
import { getUser } from './_lib/auth.js';
import { CSP, SECURITY_HEADERS, fail } from './_lib/http.js';
import { ensureSchema } from './_lib/schema.js';
import { siteUrl } from './_lib/site.js';
import { touchLastSeen, trackPageView } from './_lib/stats.js';

// Tên miền pages.dev do Cloudflare cấp sẵn (không phải tên miền riêng): chuyển hẳn khách sang
// tên miền chính, không phục vụ nội dung ở địa chỉ cũ nữa. Chỉ chặn đúng tên miền sản phẩm thật
// (minthichlamvlog.pages.dev) — bản xem trước theo nhánh (*.minthichlamvlog.pages.dev) vẫn hoạt
// động bình thường để còn kiểm tra trước khi gộp vào main.
const LEGACY_HOST = 'minthichlamvlog.pages.dev';

export async function onRequest(context) {
  const { request, env, data, waitUntil } = context;
  const url = new URL(request.url);
  if (url.hostname === LEGACY_HOST) {
    return Response.redirect(siteUrl(env) + url.pathname + url.search, 301);
  }
  if (!env.DB) {
    return new Response('Chưa cấu hình cơ sở dữ liệu (binding DB).', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  await ensureSchema(env); // bảng cũ thiếu cột/bảng mới thì tự thêm, để cập nhật mã không cần chạy SQL tay
  // Chặn CSRF: mọi yêu cầu làm thay đổi dữ liệu phải đến từ chính trang này.
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (request.headers.get('origin') !== url.origin) {
      return fail(403, 'bad_origin', 'Yêu cầu bị từ chối.', 'Request refused.');
    }
  }
  data.user = await getUser(request, env);
  if (data.user) touchLastSeen(env, data.user.id, waitUntil); // để tab Thống kê biết ai đang online
  const res = await context.next();
  let out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  if ((out.headers.get('content-type') || '').startsWith('text/html')) out.headers.set('content-security-policy', CSP);
  out = trackPageView(request, env, out, waitUntil);
  return out;
}
