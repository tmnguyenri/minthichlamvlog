// Chạy trước mọi hàm: kiểm tra nguồn gửi, nạp người dùng đang đăng nhập, thêm tiêu đề bảo mật.
import { getUser } from './_lib/auth.js';
import { CSP, SECURITY_HEADERS, fail } from './_lib/http.js';
import { ensureSchema } from './_lib/schema.js';

export async function onRequest(context) {
  const { request, env, data } = context;
  if (!env.DB) {
    return new Response('Chưa cấu hình cơ sở dữ liệu (binding DB).', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  await ensureSchema(env); // bảng cũ thiếu cột mới thì tự thêm, để cập nhật mã không cần chạy SQL tay
  // Chặn CSRF: mọi yêu cầu làm thay đổi dữ liệu phải đến từ chính trang này.
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return fail(403, 'bad_origin', 'Yêu cầu bị từ chối.', 'Request refused.');
    }
  }
  data.user = await getUser(request, env);
  const res = await context.next();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  if ((out.headers.get('content-type') || '').startsWith('text/html')) out.headers.set('content-security-policy', CSP);
  return out;
}
