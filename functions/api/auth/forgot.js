// Thành viên tự yêu cầu đặt lại mật khẩu: nhập email, hệ thống tự gửi liên kết qua email
// (xem functions/_lib/email.js — chưa cấu hình nhà cung cấp email thì coi như gửi lặng, không báo lỗi).
// Không bao giờ tiết lộ một email có tài khoản hay không: luôn trả lời giống nhau dù email có tồn tại,
// đã được duyệt, hay thuộc tài khoản quản trị hay chưa.
import { allow, clientKey, createResetToken, tooMany } from '../../_lib/auth.js';
import { sendResetEmail } from '../../_lib/email.js';
import { badRequest, json, readJson } from '../../_lib/http.js';
import { isEmail } from '../../_lib/validate.js';

export async function onRequestPost({ request, env, waitUntil }) {
  const body = await readJson(request);
  if (!body) return badRequest();
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 254);
  if (!isEmail(email)) return json({ ok: true }); // không tiết lộ gì thêm, kể cả khi email sai định dạng

  if (!(await allow(env, `forgot:ip:${await clientKey(request)}`, 5, 3600))) return tooMany();
  if (!(await allow(env, `forgot:acct:${email}`, 5, 3600))) return tooMany();

  // Không gửi cho tài khoản quản trị: giống liên kết do chủ trang tự tạo trong /quan-ly, quản trị chỉ
  // khôi phục được bằng mã khẩn cấp thêm thủ công vào D1 (xem README) — để một email quản trị bị chiếm
  // cũng không tự mở khóa trang quản trị được. Thành viên chưa được duyệt cũng chưa đăng nhập được nên
  // chưa cần liên kết.
  const user = await env.DB.prepare(
    `SELECT id FROM users WHERE email = ? AND status = 'approved' AND role != 'admin'`,
  ).bind(email).first();
  if (user) {
    const token = await createResetToken(env, user.id);
    const link = `${new URL(request.url).origin}/dat-lai-mat-khau#${token}`;
    waitUntil(sendResetEmail(env, email, link).catch(() => {}));
  }
  // Luôn trả lời giống nhau, bất kể email có tồn tại hay email có gửi được thật hay không.
  return json({ ok: true });
}
