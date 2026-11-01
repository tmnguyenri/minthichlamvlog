// Gửi email đặt lại mật khẩu qua Resend (resend.com) khi chủ trang đã cấu hình RESEND_API_KEY + RESEND_FROM.
// Chưa cấu hình (môi trường chạy thử, hoặc chủ trang chưa bật) thì bỏ qua, không báo lỗi cho người dùng —
// giống cách functions/_lib/translate.js xử lý khi chưa có binding AI. Xem README.md, mục "Bảo mật"
// (phần tự gửi email quên mật khẩu) để biết cách bật.
const RESEND_URL = 'https://api.resend.com/emails';

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Trả về true nếu gửi thành công, false nếu chưa cấu hình hoặc gửi lỗi — không bao giờ throw,
// để một nhà cung cấp email bị lỗi/chưa cấu hình không làm hỏng luồng "quên mật khẩu".
export async function sendResetEmail(env, toEmail, link) {
  const apiKey = env && env.RESEND_API_KEY;
  const from = env && env.RESEND_FROM;
  if (!apiKey || !from) return false;

  const safeLink = escHtml(link);
  const html = `
    <p>Chào bạn,</p>
    <p>Có người (hy vọng là bạn) vừa yêu cầu đặt lại mật khẩu cho tài khoản Mìn Thích Làm Vlog. Bấm vào liên kết dưới đây để chọn mật khẩu mới. Liên kết dùng được một lần và hết hạn sau 24 giờ:</p>
    <p><a href="${safeLink}">${safeLink}</a></p>
    <p>Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu của bạn sẽ không đổi.</p>
    <hr>
    <p>Hi,</p>
    <p>Someone (hopefully you) asked to reset the password for your Mìn Thích Làm Vlog account. Open the link below to choose a new one. It works once and expires in 24 hours:</p>
    <p><a href="${safeLink}">${safeLink}</a></p>
    <p>If you didn't request this, you can ignore this email — your password will stay the same.</p>
  `.trim();
  const text = [
    'Chào bạn,',
    '',
    'Có người (hy vọng là bạn) vừa yêu cầu đặt lại mật khẩu cho tài khoản Mìn Thích Làm Vlog. Mở liên kết sau để chọn mật khẩu mới (dùng được một lần, hết hạn sau 24 giờ):',
    link,
    '',
    'Nếu không phải bạn yêu cầu, hãy bỏ qua email này.',
    '',
    '—',
    '',
    'Hi,',
    '',
    "Someone (hopefully you) asked to reset your Mìn Thích Làm Vlog password. Open this link to choose a new one (works once, expires in 24 hours):",
    link,
    '',
    "If you didn't request this, you can ignore this email.",
  ].join('\n');

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: toEmail,
        subject: 'Đặt lại mật khẩu / Reset your password – Mìn Thích Làm Vlog',
        html,
        text,
      }),
    });
    if (!res.ok) console.error('sendResetEmail: Resend trả lỗi', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (err) {
    console.error('sendResetEmail: gửi thất bại', err);
    return false;
  }
}
