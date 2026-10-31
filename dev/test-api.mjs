// Kiểm thử phần máy chủ: chạy bằng  node dev/test-api.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createD1 } from './d1.mjs';
import { listen } from './server.mjs';
import { sha256Hex } from '../functions/_lib/auth.js';
import { renderMarkdown } from '../functions/_lib/md.js';
import { slugify, youtubeId } from '../functions/_lib/validate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = createD1();
db.exec(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
const INVITE = 'ma-moi-thu-nghiem-123';
await db.prepare('INSERT INTO invites (token_hash, role, created_at) VALUES (?, ?, ?)').bind(await sha256Hex(INVITE), 'admin', 0).run();
const { server, url } = await listen({ db });

let pass = 0; const failures = [];
function ok(cond, name, extra = '') { if (cond) pass++; else { failures.push(name + (extra ? ` -> ${extra}` : '')); console.log('  FAIL', name, extra); } }

class Client {
  jar = {};
  constructor(ip) { this.ip = ip; }
  async req(method, p, body, headers = {}) {
    const h = { origin: url, 'cf-connecting-ip': this.ip, ...headers };
    if (body !== undefined) h['content-type'] = 'application/json';
    const cookie = Object.entries(this.jar).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) h.cookie = cookie;
    const res = await fetch(url + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers, setCookie: res.headers.getSetCookie() };
  }
}
const anon = new Client('10.0.0.1'), admin = new Client('10.0.0.2'), member = new Client('10.0.0.3'), member2 = new Client('10.0.0.4');
const PW = 'mat-khau-dai-123';

console.log('1. Chưa đăng nhập');
let r = await anon.req('GET', '/api/auth/me'); ok(r.status === 200 && r.json.user === null, 'me trả về null');
r = await anon.req('POST', '/api/posts', { title: 'x' }); ok(r.status === 401, 'tạo bài khi chưa đăng nhập bị từ chối', r.status);
r = await anon.req('GET', '/api/admin/users'); ok(r.status === 401, 'danh sách thành viên cần đăng nhập');
r = await anon.req('GET', '/api/posts?all=1'); ok(r.status === 401, 'xem nháp cần quản trị');
r = await anon.req('POST', '/api/auth/login', { email: 'a@b.co', password: 'x' }, { origin: 'https://evil.example' }); ok(r.status === 403 && r.json.error === 'bad_origin', 'CSRF: sai nguồn bị chặn');
const noOrigin = await fetch(url + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); ok(noOrigin.status === 403, 'CSRF: thiếu Origin bị chặn');
r = await anon.req('POST', '/api/auth/login', undefined); ok(r.status === 400, 'thân yêu cầu không phải JSON bị từ chối');

console.log('2. Đăng ký thành viên');
r = await member.req('POST', '/api/auth/register', { email: 'khong-hop-le', name: 'An', password: PW }); ok(r.status === 400 && r.json.error === 'email', 'email sai');
r = await member.req('POST', '/api/auth/register', { email: 'an@example.com', name: 'An', password: 'ngan' }); ok(r.status === 400 && r.json.error === 'password', 'mật khẩu ngắn');
r = await member.req('POST', '/api/auth/register', { email: 'an@example.com', name: '<b>', password: PW }); ok(r.status === 400 || r.status === 200, 'tên có thẻ HTML xử lý được');
r = await member.req('POST', '/api/auth/register', { email: 'an@example.com', name: 'An Nguyễn', password: PW }); ok(r.status === 200 && r.json.status === 'pending', 'đăng ký chờ duyệt', JSON.stringify(r.json));
ok(!r.setCookie.length, 'thành viên chờ duyệt chưa có phiên đăng nhập');
r = await member2.req('POST', '/api/auth/register', { email: 'AN@example.com', name: 'Kẻ trùng', password: PW }); ok(r.status === 200 && r.json.status === 'pending', 'đăng ký trùng email trả lời giống hệt (không lộ email)');
const rows = db.raw.prepare('SELECT * FROM users').all(); ok(rows.length === 1, 'không tạo tài khoản trùng', rows.length);
ok(rows[0].password_hash.startsWith('pbkdf2-sha256$100000$') && !rows[0].password_hash.includes(PW), 'mật khẩu được băm, không lưu thật');
r = await member.req('POST', '/api/auth/login', { email: 'an@example.com', password: PW }); ok(r.status === 403 && r.json.error === 'pending', 'chưa duyệt thì chưa đăng nhập được');
r = await member.req('POST', '/api/auth/login', { email: 'an@example.com', password: 'sai-mat-khau-x' }); ok(r.status === 401, 'sai mật khẩu');
r = await member.req('POST', '/api/auth/login', { email: 'khong-ton-tai@example.com', password: PW }); ok(r.status === 401 && r.json.error === 'invalid', 'email không tồn tại trả lời giống sai mật khẩu');

console.log('3. Tài khoản quản trị bằng mã mời');
r = await admin.req('POST', '/api/auth/register', { email: 'chu@example.com', name: 'Mìn', password: PW, invite: 'ma-sai' }); ok(r.status === 400 && r.json.error === 'invite', 'mã mời sai');
ok(db.raw.prepare('SELECT COUNT(*) c FROM users').get().c === 1, 'mã sai không tạo tài khoản');
r = await admin.req('POST', '/api/auth/register', { email: 'chu@example.com', name: 'Mìn', password: PW, invite: INVITE }); ok(r.status === 200 && r.json.status === 'approved' && r.json.role === 'admin', 'mã đúng tạo quản trị', JSON.stringify(r.json));
const sc = r.setCookie.join('\n'); ok(/sid=/.test(sc) && /HttpOnly/.test(sc) && /SameSite=Lax/.test(sc), 'cookie phiên: HttpOnly + SameSite=Lax');
ok(!/mtlv_in=[^;]*;[^]*HttpOnly/.test(r.setCookie.find((c) => c.startsWith('mtlv_in')) || ''), 'cookie gợi ý không HttpOnly');
r = await anon.req('POST', '/api/auth/register', { email: 'khac@example.com', name: 'Khác', password: PW, invite: INVITE }); ok(r.status === 400 && r.json.error === 'invite', 'mã mời chỉ dùng một lần');
r = await admin.req('GET', '/api/auth/me'); ok(r.json.user?.role === 'admin' && r.json.user.name === 'Mìn', 'quản trị đã đăng nhập');
ok(!('password_hash' in (r.json.user || {})) && !('email' in (r.json.user || {})), 'me không lộ thông tin nhạy cảm');

console.log('4. Duyệt thành viên');
r = await admin.req('GET', '/api/admin/users'); ok(r.status === 200 && r.json.users[0].email === 'an@example.com' && r.json.users[0].status === 'pending', 'chờ duyệt đứng đầu danh sách');
ok(!JSON.stringify(r.json).includes('pbkdf2'), 'danh sách không lộ mật khẩu băm');
const anId = r.json.users.find((u) => u.email === 'an@example.com').id;
const adminId = r.json.users.find((u) => u.role === 'admin').id;
r = await admin.req('PATCH', `/api/admin/users/${adminId}`, { status: 'blocked' }); ok(r.status === 403, 'không chặn được tài khoản quản trị');
r = await admin.req('PATCH', `/api/admin/users/${anId}`, { status: 'bay-gio' }); ok(r.status === 400, 'trạng thái sai');
r = await admin.req('PATCH', `/api/admin/users/${anId}`, { status: 'approved' }); ok(r.status === 200, 'duyệt thành viên');
r = await member.req('POST', '/api/auth/login', { email: 'an@example.com', password: PW }); ok(r.status === 200, 'đăng nhập sau khi được duyệt', JSON.stringify(r.json));
r = await member.req('GET', '/api/auth/me'); ok(r.json.user?.role === 'member', 'thành viên đã đăng nhập');
r = await member.req('GET', '/api/admin/users'); ok(r.status === 403, 'thành viên không xem được danh sách quản trị');
r = await member.req('POST', '/api/posts', { title: 'Bài của thành viên' }); ok(r.status === 403, 'thành viên không đăng bài được');
r = await member.req('GET', '/api/posts?all=1'); ok(r.status === 403, 'thành viên không xem được nháp');

console.log('5. Bài viết');
r = await admin.req('POST', '/api/posts', { title: '' }); ok(r.status === 400 && r.json.error === 'title', 'thiếu tiêu đề');
r = await admin.req('POST', '/api/posts', { title: 'X', slug: 'Sai Slug' }); ok(r.status === 400 && r.json.error === 'slug', 'slug sai');
r = await admin.req('POST', '/api/posts', { title: 'X', cover: 'javascript:alert(1)' }); ok(r.status === 400 && r.json.error === 'cover', 'ảnh bìa javascript: bị từ chối');
r = await admin.req('POST', '/api/posts', { title: 'X', video: 'https://evil.example/watch?v=dQw4w9WgXcQ' }); ok(r.status === 400 && r.json.error === 'video', 'video không phải YouTube bị từ chối');
r = await admin.req('POST', '/api/posts', { title: 'X', trip_date: '2026-13' }); ok(r.status === 400 && r.json.error === 'trip_date', 'tháng sai');
const evil = '<script>alert(1)</script> Đà Lạt "mộng mơ"';
r = await admin.req('POST', '/api/posts', {
  title: evil, title_en: 'Dalat <i>dreams</i>', excerpt: 'Tóm tắt <img src=x onerror=alert(1)>', country: 'Việt Nam', trip_date: '2026-10', days: 3,
  video: 'https://youtu.be/dQw4w9WgXcQ', status: 'draft',
  body: '## Ngày một\n\nSáng nay [liên kết tốt](https://example.com/a?x=1&y=2) và [xấu](javascript:alert(1)) và **đậm** và *nghiêng*.\n\n![ảnh](javascript:alert(2))\n\n![ảnh ok](/images/min.jpg)\n\n- một\n- hai\n\n> trích <b>dẫn</b>',
  body_en: 'Day one.',
});
ok(r.status === 201 && r.json.slug === 'script-alert-1-script-da-lat-mong-mo', 'tạo bài nháp, slug tự sinh không dấu', JSON.stringify(r.json));
const slug = r.json.slug, postId = r.json.id;
r = await anon.req('GET', '/api/posts'); ok(r.json.posts.length === 0, 'nháp không hiện trong danh sách công khai');
r = await anon.req('GET', `/bai/${slug}`); ok(r.status === 404, 'nháp không xem được khi chưa đăng nhập');
r = await member.req('GET', `/bai/${slug}`); ok(r.status === 404, 'nháp không xem được với thành viên');
r = await admin.req('GET', `/bai/${slug}`); ok(r.status === 200 && r.text.includes('Bản nháp'), 'quản trị xem được nháp');
r = await admin.req('PUT', `/api/posts/${postId}`, { ...(await admin.req('GET', `/api/posts/${postId}`)).json.post, status: 'published' }); ok(r.status === 200, 'xuất bản');
r = await admin.req('POST', '/api/posts', { title: 'Trùng', slug }); ok(r.status === 409, 'slug trùng bị từ chối');
r = await anon.req('GET', '/api/posts'); ok(r.json.posts.length === 1 && r.json.posts[0].slug === slug, 'bài đã xuất bản hiện công khai');
ok(!('body' in r.json.posts[0]), 'danh sách không kèm toàn bộ nội dung');
r = await anon.req('GET', `/bai/${slug}`); const page = r.text;
ok(r.status === 200, 'trang bài viết mở được');
ok(!page.includes('<script>alert(1)</script>') && page.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'XSS trong tiêu đề được escape');
ok(!/<img[^>]*onerror/i.test(page), 'XSS trong tóm tắt được escape');
ok(!/href="javascript:/i.test(page) && !/src="javascript:/i.test(page), 'liên kết/ảnh javascript: bị vô hiệu');
ok(page.includes('href="https://example.com/a?x=1&amp;y=2"') && page.includes('<strong>đậm</strong>') && page.includes('<em>nghiêng</em>') && page.includes('<h2>Ngày một</h2>') && page.includes('<li>một</li>'), 'Markdown cơ bản hoạt động');
ok(page.includes('src="/images/min.jpg"'), 'ảnh nội bộ được phép');
ok(page.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ'), 'video YouTube nhúng bằng nocookie');
ok(page.includes('data-only="en"') && page.includes('data-en="Dalat &lt;i&gt;dreams&lt;/i&gt;"'), 'bản tiếng Anh nằm trong thuộc tính đã escape');
ok(/content-security-policy/i.test([...r.headers.keys()].join(',')) && r.headers.get('x-frame-options') === 'DENY', 'trang có CSP và X-Frame-Options');
ok(page.includes('Tháng 10/2026') && page.includes('3 ngày'), 'thời gian và số ngày hiển thị');
ok(page.includes('/dang-nhap?next=%2Fbai%2F'), 'khách thấy lời mời đăng nhập để bình luận');
ok(!page.includes('id="comment-form"'), 'khách không thấy ô bình luận');
r = await anon.req('GET', '/bai/khong-co'); ok(r.status === 404, 'bài không tồn tại -> 404');
r = await anon.req('GET', '/bai/' + encodeURIComponent('../etc')); ok(r.status === 404, 'slug lạ -> 404');

console.log('6. Bình luận');
r = await anon.req('POST', '/api/comments', { post_id: postId, body: 'xin chào' }); ok(r.status === 401, 'khách không bình luận được');
r = await member.req('POST', '/api/comments', { post_id: postId, body: '' }); ok(r.status === 400, 'bình luận rỗng');
r = await member.req('POST', '/api/comments', { post_id: postId, body: 'x'.repeat(1001) }); ok(r.status === 400, 'bình luận quá dài');
r = await member.req('POST', '/api/comments', { post_id: 99999, body: 'ơ' }); ok(r.status === 404, 'bình luận vào bài không có');
r = await member.req('POST', '/api/comments', { post_id: postId, body: 'Hay quá! <script>alert(3)</script>\nDòng hai' }); ok(r.status === 201, 'thành viên bình luận');
r = await member.req('GET', `/bai/${slug}`); let pg = r.text;
ok(pg.includes('id="comment-form"') && pg.includes('Hay quá! &lt;script&gt;alert(3)&lt;/script&gt;<br>Dòng hai'), 'bình luận hiển thị, đã escape');
ok(pg.includes('data-del-comment'), 'chủ bình luận thấy nút xóa');
const cid = db.raw.prepare('SELECT id FROM comments').get().id;
// thành viên thứ hai
await db.prepare("INSERT INTO users (email, display_name, password_hash, role, status, created_at) VALUES ('b@example.com', 'Bình', ?, 'member', 'approved', 0)").bind((await import('../functions/_lib/auth.js')).hashPassword ? await (await import('../functions/_lib/auth.js')).hashPassword(PW) : '').run();
r = await member2.req('POST', '/api/auth/login', { email: 'b@example.com', password: PW }); ok(r.status === 200, 'thành viên thứ hai đăng nhập');
r = await member2.req('DELETE', `/api/comments/${cid}`); ok(r.status === 403, 'không xóa được bình luận của người khác');
r = await member2.req('GET', `/bai/${slug}`); ok(!r.text.includes('data-del-comment'), 'người khác không thấy nút xóa');
r = await admin.req('GET', `/bai/${slug}`); ok(r.text.includes('data-del-comment'), 'quản trị thấy nút xóa');
let limited = 0; for (let i = 0; i < 12; i++) { r = await member.req('POST', '/api/comments', { post_id: postId, body: `bình luận ${i}` }); if (r.status === 429) limited++; }
ok(limited >= 1, 'giới hạn số bình luận liên tiếp', `bị chặn ${limited} lần`);
r = await admin.req('DELETE', `/api/comments/${cid}`); ok(r.status === 200, 'quản trị xóa bình luận');
const mine = db.raw.prepare('SELECT id FROM comments WHERE user_id = (SELECT id FROM users WHERE email = ?) LIMIT 1').get('an@example.com');
r = await member.req('DELETE', `/api/comments/${mine.id}`); ok(r.status === 200, 'chủ bình luận tự xóa được');

console.log('7. Chặn, xóa thành viên, đăng xuất');
r = await admin.req('PATCH', `/api/admin/users/${anId}`, { status: 'blocked' }); ok(r.status === 200, 'chặn thành viên');
r = await member.req('GET', '/api/auth/me'); ok(r.json.user === null, 'phiên của thành viên bị chặn mất hiệu lực ngay');
r = await member.req('POST', '/api/auth/login', { email: 'an@example.com', password: PW }); ok(r.status === 403 && r.json.error === 'blocked', 'thành viên bị chặn không đăng nhập lại được');
const bId = db.raw.prepare("SELECT id FROM users WHERE email='b@example.com'").get().id;
r = await admin.req('DELETE', `/api/admin/users/${bId}`); ok(r.status === 200, 'xóa thành viên');
r = await member2.req('GET', '/api/auth/me'); ok(r.json.user === null, 'phiên của thành viên bị xóa mất hiệu lực');
r = await admin.req('POST', '/api/auth/logout'); ok(r.status === 200, 'đăng xuất');
r = await admin.req('GET', '/api/auth/me'); ok(r.json.user === null, 'sau đăng xuất không còn phiên');
r = await admin.req('POST', '/api/auth/login', { email: 'chu@example.com', password: PW }); ok(r.status === 200 && r.json.role === 'admin', 'quản trị đăng nhập lại');

console.log('8. Giới hạn đoán mật khẩu');
const brute = new Client('10.0.0.5'); let blocked = 0;
for (let i = 0; i < 12; i++) { r = await brute.req('POST', '/api/auth/login', { email: 'chu@example.com', password: `sai-${i}-sai-sai` }); if (r.status === 429) blocked++; }
ok(blocked >= 2, 'bị khóa tạm sau nhiều lần đoán sai', `chặn ${blocked}`);
r = await brute.req('POST', '/api/auth/login', { email: 'chu@example.com', password: PW }); ok(r.status === 429, 'khóa tạm áp dụng cả khi mật khẩu đúng');

console.log('8b. Giới hạn đăng ký hàng loạt');
const flood = new Client('10.0.0.6'); let floodBlocked = 0;
for (let i = 0; i < 8; i++) { r = await flood.req('POST', '/api/auth/register', { email: `rac${i}@example.com`, name: 'Rác', password: PW }); if (r.status === 429) floodBlocked++; }
ok(floodBlocked === 3, 'chỉ cho 5 lượt đăng ký mỗi giờ từ một địa chỉ', `chặn ${floodBlocked}`);

console.log('9. Xóa bài');
r = await admin.req('DELETE', `/api/posts/${postId}`); ok(r.status === 200, 'xóa bài');
r = await anon.req('GET', `/bai/${slug}`); ok(r.status === 404, 'bài đã xóa -> 404');
ok(db.raw.prepare('SELECT COUNT(*) c FROM comments WHERE post_id = ?').get(postId).c === 0, 'bình luận bị xóa theo bài');

console.log('9b. SEO: robots, sitemap, RSS, thẻ chia sẻ, IndexNow');
{
  const BASE = 'https://minthichlamvlog.pages.dev';
  r = await anon.req('GET', '/robots.txt');
  ok(r.status === 200 && /^User-agent: \*/m.test(r.text) && r.text.includes(`Sitemap: ${BASE}/sitemap.xml`), 'robots.txt có sitemap');
  ok(!/^Disallow:\s*\/\s*$/m.test(r.text), 'robots.txt không chặn cả trang');

  // một bài có ảnh bìa jpg, một bài chỉ có ảnh SVG, một bài nháp
  const mk = (title, extra) => admin.req('POST', '/api/posts', { title, status: 'published', country: 'Nhật Bản', trip_date: '2026-05', days: 4, body: 'Nội dung **bài** SEO.', ...extra });
  r = await mk('Kyoto & "lá đỏ" <đẹp>', { excerpt: 'Tóm tắt & thử <b>', cover: '/images/min.jpg', slug: 'seo-kyoto' }); ok(r.status === 201, 'tạo bài SEO 1', r.status);
  r = await mk('Bài ảnh SVG', { cover: '/images/scene-kyoto-wide.svg', slug: 'seo-svg' }); ok(r.status === 201, 'tạo bài SEO 2', r.status);
  r = await mk('Bài nháp SEO', { status: 'draft', slug: 'seo-nhap' }); ok(r.status === 201, 'tạo bài nháp SEO', r.status);

  r = await anon.req('GET', '/sitemap.xml');
  ok(r.status === 200 && /application\/xml/.test(r.headers.get('content-type')) && r.text.startsWith('<?xml'), 'sitemap.xml là XML');
  ok(r.text.includes(`<loc>${BASE}/</loc>`) && r.text.includes(`<loc>${BASE}/about</loc>`), 'sitemap có trang chủ và giới thiệu');
  ok(r.text.includes(`<loc>${BASE}/bai/seo-kyoto</loc>`) && r.text.includes(`<loc>${BASE}/bai/seo-svg</loc>`), 'sitemap có bài đã đăng');
  ok(!r.text.includes('seo-nhap'), 'sitemap không lộ bài nháp');
  ok(!/\/posts\//.test(r.text) && !r.text.includes('dang-nhap') && !r.text.includes('quan-ly'), 'sitemap không có bài mẫu và trang tài khoản');
  ok(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(r.text), 'sitemap có ngày cập nhật');

  r = await anon.req('GET', '/rss.xml');
  ok(r.status === 200 && /rss\+xml/.test(r.headers.get('content-type')) && r.text.includes('<rss version="2.0"'), 'rss.xml là RSS');
  ok(r.text.includes(`<link>${BASE}/bai/seo-kyoto</link>`) && !r.text.includes('seo-nhap'), 'RSS có bài đã đăng, không có nháp');
  ok(!/<title>[^<]*[<"][^<]*<\/title>/.test(r.text.replace(/&quot;/g, '')) && r.text.includes('Kyoto &amp; &quot;lá đỏ&quot; &lt;đẹp&gt;'), 'RSS escape ký tự đặc biệt trong tiêu đề');
  ok(!r.text.includes('<b>'), 'RSS không chứa HTML thô từ tóm tắt');
  ok(/<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4}/.test(r.text), 'RSS có ngày đăng đúng định dạng');

  // thẻ trong trang bài viết
  r = await anon.req('GET', '/bai/seo-kyoto'); const pg = r.text;
  ok(pg.includes(`<link rel="canonical" href="${BASE}/bai/seo-kyoto">`), 'bài có địa chỉ chuẩn');
  ok(pg.includes(`<meta property="og:image" content="${BASE}/images/min.jpg">`) && pg.includes('name="twitter:card" content="summary_large_image"'), 'ảnh bìa jpg dùng làm ảnh chia sẻ');
  ok(pg.includes('property="og:type" content="article"') && pg.includes('property="article:published_time"'), 'bài có og:type article và ngày đăng');
  ok(!/name="robots"/.test(pg), 'bài đã đăng được phép lập chỉ mục');
  const ldm = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(pg);
  let ld = null; try { ld = JSON.parse(ldm[1]); } catch { /* lỗi */ }
  ok(ld && ld['@type'] === 'BlogPosting' && ld.headline === 'Kyoto & "lá đỏ" <đẹp>' && ld.url === `${BASE}/bai/seo-kyoto` && ld.author?.name === 'Mìn', 'dữ liệu có cấu trúc BlogPosting hợp lệ');
  ok(ldm && !/<\/script/i.test(ldm[1]) && !ldm[1].includes('<'), 'JSON-LD không thể thoát khỏi thẻ script');
  ok(/rel="alternate" type="application\/rss\+xml"/.test(pg), 'trang có liên kết RSS');
  r = await anon.req('GET', '/bai/seo-svg');
  ok(r.text.includes(`<meta property="og:image" content="${BASE}/images/og-cover.jpg">`), 'ảnh bìa SVG thì dùng ảnh chia sẻ mặc định');
  r = await admin.req('GET', '/bai/seo-nhap');
  ok(r.status === 200 && /<meta name="robots" content="noindex">/.test(r.text), 'bản nháp (quản trị xem) có noindex');
  r = await anon.req('GET', '/bai/khong-co-bai-nay');
  ok(r.status === 404 && /<meta name="robots" content="noindex">/.test(r.text), 'trang không tìm thấy có noindex');

  // trang tĩnh
  r = await anon.req('GET', '/');
  ok(r.text.includes(`<link rel="canonical" href="${BASE}/">`) && r.text.includes('og:image') && r.text.includes('application/ld+json'), 'trang chủ có canonical, ảnh chia sẻ và JSON-LD');
  ok(r.text.includes('<meta name="google-site-verification" content="iODMJ7sGMcb6ShDM5dvcf4d9a3qHVRjzl-rpul9xyoo">'), 'trang chủ giữ thẻ xác minh Google Search Console (đừng xóa, Google kiểm tra định kỳ)');
  const gv = await anon.req('GET', '/google4baa21f8f1dd1cd7.html');
  ok(gv.status === 200 && gv.text.trim() === 'google-site-verification: google4baa21f8f1dd1cd7.html', 'tệp xác minh Google Search Console trả đúng nội dung (đừng xóa)');
  let home = null; try { home = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(r.text)[1]); } catch { /* lỗi */ }
  ok(home && home['@graph']?.some((n) => n['@type'] === 'Person' && n.sameAs?.length === 2), 'JSON-LD trang chủ có Person kèm YouTube và Instagram');
  for (const f of ['dang-nhap', 'dang-ky', 'quan-ly']) {
    r = await anon.req('GET', `/${f}`); ok(/name="robots" content="noindex/.test(r.text), `/${f} có noindex`);
  }
  for (const f of ['oaxaca', 'kyoto', 'lisbon', 'ha-giang']) {
    r = await anon.req('GET', `/posts/${f}`); ok(/name="robots" content="noindex/.test(r.text), `bài mẫu ${f} có noindex`);
  }
  const og = fs.statSync(path.join(root, 'site/images/og-cover.jpg')).size;
  ok(og > 5000 && og < 600000, 'ảnh chia sẻ có kích thước hợp lý', og);

  // IndexNow: tệp khóa khớp biến cấu hình, và gói tin gửi đi đúng
  const wr = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8');
  const key = /"INDEXNOW_KEY":\s*"([a-f0-9]{32})"/.exec(wr)?.[1];
  ok(!!key, 'wrangler.jsonc có khóa IndexNow');
  r = await anon.req('GET', `/${key}.txt`); ok(r.status === 200 && r.text.trim() === key, 'tệp khóa IndexNow trả đúng nội dung');
  const { notifyIndexNow } = await import('../functions/_lib/indexnow.js');
  const realFetch = globalThis.fetch; const sent = []; let waited = 0;
  globalThis.fetch = async (u, o) => { sent.push({ u, o }); return new Response('', { status: 200 }); };
  try {
    notifyIndexNow({ env: {}, waitUntil: () => { waited++; } }, ['/bai/a']);
    ok(sent.length === 0, 'không có khóa thì không gửi gì');
    notifyIndexNow({ env: { INDEXNOW_KEY: 'sai' }, waitUntil: () => { waited++; } }, ['/bai/a']);
    ok(sent.length === 0, 'khóa sai định dạng thì không gửi');
    notifyIndexNow({ env: { INDEXNOW_KEY: key }, waitUntil: () => { waited++; } }, ['/bai/a', '/']);
    ok(sent.length === 1 && sent[0].u === 'https://api.indexnow.org/indexnow' && waited === 1, 'có khóa thì gửi một yêu cầu và giao cho waitUntil');
    const body = JSON.parse(sent[0]?.o?.body || '{}');
    ok(body.host === 'minthichlamvlog.pages.dev' && body.key === key && body.keyLocation === `${BASE}/${key}.txt` && body.urlList?.join() === `${BASE}/bai/a,${BASE}/`, 'gói tin IndexNow đúng host, khóa, vị trí khóa và danh sách địa chỉ', JSON.stringify(body));
  } finally { globalThis.fetch = realFetch; }

  // dọn để không ảnh hưởng các mục sau
  for (const sl of ['seo-kyoto', 'seo-svg', 'seo-nhap']) {
    const row = db.raw.prepare('SELECT id FROM posts WHERE slug = ?').get(sl);
    if (row) await admin.req('DELETE', `/api/posts/${row.id}`);
  }
}

console.log('9c. Quên mật khẩu: liên kết do chủ trang tạo, mã khôi phục khẩn cấp');
{
  const NEWPW = 'mat-khau-moi-4567', NEWPW2 = 'mat-khau-moi-8901';
  const lost = new Client('10.0.9.1');
  await lost.req('POST', '/api/auth/register', { email: 'quen@example.com', name: 'Người quên', password: PW });
  const lostId = (await admin.req('GET', '/api/admin/users')).json.users.find((u) => u.email === 'quen@example.com').id;
  await admin.req('PATCH', `/api/admin/users/${lostId}`, { status: 'approved' });
  r = await lost.req('POST', '/api/auth/login', { email: 'quen@example.com', password: PW }); ok(r.status === 200, 'thành viên thử nghiệm đăng nhập được');
  const resetOf = async (id = lostId) => (await admin.req('POST', `/api/admin/users/${id}/reset`)).json?.link?.split('#')[1];
  const redeem = (body, c = anon) => c.req('POST', '/api/auth/reset', body);
  const unused = (tok) => db.raw.prepare('SELECT used_at FROM invites WHERE token_hash = ?').get(tok)?.used_at === null;

  // quyền tạo liên kết
  r = await anon.req('POST', `/api/admin/users/${lostId}/reset`); ok(r.status === 401, 'chưa đăng nhập không tạo được liên kết đặt lại');
  r = await lost.req('POST', `/api/admin/users/${lostId}/reset`); ok(r.status === 403, 'thành viên không tự tạo được liên kết đặt lại');
  r = await admin.req('POST', `/api/admin/users/${adminId}/reset`); ok(r.status === 403, 'không tạo liên kết cho tài khoản quản trị');
  r = await admin.req('POST', '/api/admin/users/999999/reset'); ok(r.status === 404, 'thành viên không tồn tại');
  r = await admin.req('POST', '/api/admin/users/abc/reset'); ok(r.status === 404, 'mã thành viên sai định dạng');

  // tạo liên kết: mã nằm sau dấu #, cơ sở dữ liệu chỉ lưu băm
  r = await admin.req('POST', `/api/admin/users/${lostId}/reset`);
  ok(r.status === 200 && r.json.link.startsWith(`${url}/dat-lai-mat-khau#`) && r.json.expires_at > Math.floor(Date.now() / 1000) + 23 * 3600, 'tạo được liên kết, hạn khoảng 24 giờ', JSON.stringify(r.json));
  const token = r.json.link.split('#')[1];
  ok(token.length >= 40, 'mã đủ dài');
  const stored = db.raw.prepare('SELECT token_hash, role FROM invites WHERE role = ?').all(`reset:${lostId}`);
  ok(stored.length === 1 && stored[0].token_hash === await sha256Hex(token) && !JSON.stringify(stored).includes(token), 'chỉ lưu băm của mã, không lưu mã gốc');
  r = await anon.req('GET', '/dat-lai-mat-khau'); ok(r.status === 200 && r.text.includes('id="reset-form"') && r.text.includes('noindex'), 'trang đặt mật khẩu mới mở được và không cho lập chỉ mục');
  r = await anon.req('GET', '/quen-mat-khau'); ok(r.status === 200 && r.text.includes('noindex'), 'trang quên mật khẩu mở được và không cho lập chỉ mục');
  r = await anon.req('GET', '/sitemap.xml'); ok(!/mat-khau/.test(r.text), 'sơ đồ trang không chứa trang đặt mật khẩu');
  r = await anon.req('GET', '/dang-nhap'); ok(r.text.includes('href="quen-mat-khau.html"'), 'trang đăng nhập có liên kết Quên mật khẩu');

  // dữ liệu sai
  r = await redeem({ token, password: 'ngan' }); ok(r.status === 400 && r.json.error === 'password', 'mật khẩu mới quá ngắn');
  r = await redeem({ password: NEWPW }); ok(r.status === 400 && r.json.error === 'token', 'thiếu mã');
  r = await redeem({ token: 'ma-khong-ton-tai-0123456789', password: NEWPW }); ok(r.status === 400 && r.json.error === 'invalid_token', 'mã không tồn tại');
  r = await redeem(undefined); ok(r.status === 400, 'thân yêu cầu không phải JSON');
  r = await new Client('10.0.9.2').req('POST', '/api/auth/register', { email: 'la@example.com', name: 'Kẻ lạ', password: PW, invite: token });
  ok(r.status === 400 && r.json.error === 'invite' && !db.raw.prepare("SELECT id FROM users WHERE email = 'la@example.com'").get() && unused(await sha256Hex(token)), 'mã đặt lại không dùng làm mã mời tạo tài khoản');
  r = await lost.req('GET', '/api/auth/me'); ok(r.json.user !== null, 'trước khi đặt lại, phiên cũ vẫn dùng được');

  // đặt lại thành công
  r = await redeem({ token, password: NEWPW }); ok(r.status === 200 && r.json.ok, 'đặt lại bằng liên kết');
  r = await lost.req('GET', '/api/auth/me'); ok(r.json.user === null, 'đặt lại xong thì đăng xuất mọi nơi');
  r = await lost.req('POST', '/api/auth/login', { email: 'quen@example.com', password: PW }); ok(r.status === 401, 'mật khẩu cũ không còn dùng được');
  r = await lost.req('POST', '/api/auth/login', { email: 'quen@example.com', password: NEWPW }); ok(r.status === 200, 'đăng nhập bằng mật khẩu mới');
  ok(!db.raw.prepare('SELECT password_hash FROM users WHERE id = ?').get(lostId).password_hash.includes(NEWPW), 'mật khẩu mới được băm');
  r = await redeem({ token, password: 'mat-khau-khac-9999' }); ok(r.status === 400 && r.json.error === 'invalid_token', 'liên kết chỉ dùng được một lần');
  r = await lost.req('POST', '/api/auth/login', { email: 'quen@example.com', password: NEWPW }); ok(r.status === 200, 'dùng lại liên kết không đổi mật khẩu');

  // liên kết mới làm liên kết cũ hết hiệu lực
  const l1 = await resetOf(), l2 = await resetOf();
  r = await redeem({ token: l1, password: NEWPW2 }); ok(r.status === 400, 'liên kết cũ hết hiệu lực khi có liên kết mới');
  r = await redeem({ token: l2, password: NEWPW2 }); ok(r.status === 200, 'liên kết mới nhất dùng được');
  // quá hạn
  const l3 = await resetOf();
  db.raw.prepare('UPDATE invites SET created_at = created_at - ? WHERE token_hash = ?').run(24 * 3600 + 5, await sha256Hex(l3));
  r = await redeem({ token: l3, password: NEWPW }); ok(r.status === 400 && r.json.error === 'invalid_token', 'liên kết quá 24 giờ bị từ chối');
  r = await lost.req('POST', '/api/auth/login', { email: 'quen@example.com', password: NEWPW2 }); ok(r.status === 200, 'liên kết quá hạn không đổi mật khẩu');
  // dọn: mã đã dùng hoặc quá hạn lâu ngày bị xóa, mã mời quản trị thì giữ nguyên
  const { cleanup } = await import('../functions/_lib/auth.js');
  db.raw.prepare('UPDATE invites SET created_at = 0 WHERE token_hash = ?').run(await sha256Hex(l3));
  await cleanup({ DB: db });
  ok(!db.raw.prepare('SELECT 1 FROM invites WHERE token_hash = ?').get(await sha256Hex(l3)), 'dọn mã đặt lại quá hạn');
  ok(!!db.raw.prepare('SELECT 1 FROM invites WHERE token_hash = ?').get(await sha256Hex(INVITE)), 'dọn không xóa mã mời tạo tài khoản');

  // mã khôi phục khẩn cấp do chủ trang tự thêm vào D1 (cần kèm email), dùng được cho cả tài khoản quản trị
  const CODE = 'ma-khoi-phuc-khan-cap-xyz-987654321', codeHash = await sha256Hex(CODE);
  db.raw.prepare("INSERT INTO invites (token_hash, role, created_at) VALUES (?, 'reset', ?)").run(codeHash, Math.floor(Date.now() / 1000));
  r = await redeem({ token: CODE, password: NEWPW }); ok(r.status === 400 && r.json.error === 'email' && unused(codeHash), 'mã khẩn cấp cần email, chưa bị dùng mất');
  r = await redeem({ token: CODE, email: 'khong-co@example.com', password: NEWPW }); ok(r.status === 400 && r.json.error === 'invalid_token' && unused(codeHash), 'email không có tài khoản thì không dùng mã');
  r = await redeem({ token: CODE, email: 'CHU@example.com', password: NEWPW }); ok(r.status === 200, 'chủ trang đặt lại được mật khẩu bằng mã khẩn cấp');
  r = await admin.req('GET', '/api/auth/me'); ok(r.json.user === null, 'phiên quản trị cũ bị đăng xuất');
  r = await admin.req('POST', '/api/auth/login', { email: 'chu@example.com', password: PW }); ok(r.status === 401, 'mật khẩu quản trị cũ không dùng được');
  r = await admin.req('POST', '/api/auth/login', { email: 'chu@example.com', password: NEWPW }); ok(r.status === 200 && r.json.role === 'admin', 'quản trị đăng nhập bằng mật khẩu mới');
  r = await redeem({ token: CODE, email: 'chu@example.com', password: NEWPW2 }); ok(r.status === 400, 'mã khẩn cấp chỉ dùng một lần');
  // mã khẩn cấp cũng hết hạn sau 24 giờ
  const OLD = 'ma-khan-cap-da-cu-1234567890', oldHash = await sha256Hex(OLD);
  db.raw.prepare("INSERT INTO invites (token_hash, role, created_at) VALUES (?, 'reset', ?)").run(oldHash, Math.floor(Date.now() / 1000) - 25 * 3600);
  r = await redeem({ token: OLD, email: 'chu@example.com', password: NEWPW2 }, new Client('10.0.9.5')); ok(r.status === 400 && r.json.error === 'invalid_token', 'mã khẩn cấp quá 24 giờ bị từ chối', r.status);

  // giới hạn số lần thử đoán mã
  const spam = new Client('10.0.9.9'); let last = 0;
  for (let i = 0; i < 12; i++) last = (await redeem({ token: `doan-ma-${i}-0123456789abcdef`, password: NEWPW }, spam)).status;
  ok(last === 429, 'đoán mã quá nhiều lần bị chặn tạm thời', last);

  // thành viên bị xóa thì liên kết của họ không còn tác dụng
  const gone = new Client('10.0.9.3');
  await gone.req('POST', '/api/auth/register', { email: 'xoa@example.com', name: 'Sắp xóa', password: PW });
  const goneId = (await admin.req('GET', '/api/admin/users')).json.users.find((u) => u.email === 'xoa@example.com').id;
  const gl = await resetOf(goneId);
  await admin.req('DELETE', `/api/admin/users/${goneId}`);
  r = await redeem({ token: gl, password: NEWPW }, new Client('10.0.9.4')); ok(r.status === 400, 'liên kết của thành viên đã bị xóa không dùng được');
  await admin.req('DELETE', `/api/admin/users/${lostId}`); // dọn
}

console.log('10. Hàm tiện ích');
ok(slugify('Đà Lạt mộng mơ!') === 'da-lat-mong-mo', 'slugify tiếng Việt');
ok(youtubeId('dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5') === 'dQw4w9WgXcQ' && youtubeId('https://youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ' && youtubeId('') === '' && youtubeId('nope') === null && youtubeId('https://evil.com/watch?v=dQw4w9WgXcQ') === null, 'youtubeId');
const vectors = ['<img src=x onerror=alert(1)>', '[a](javascript:alert(1))', '[a](//evil.com)', '[a](data:text/html,x)', '![a](//evil.com/x.png)', '[a](https://x.com/"onmouseover="alert(1))', '**<script>**', '&lt;script&gt;'];
const TAGS = new Set(['p', 'a', 'strong', 'em', 'h2', 'h3', 'ul', 'li', 'blockquote', 'figure', 'img', 'br']);
const ATTRS = new Set(['href', 'rel', 'target', 'src', 'alt', 'loading', 'class']);
function onlySafeMarkup(out) {
  let ok = true;
  const rest = out.replace(/<\/?([a-z0-9]+)((?:\s+[a-z-]+="[^"]*")*)\s*\/?>/g, (m, tag, attrs) => {
    if (!TAGS.has(tag)) ok = false;
    for (const a of attrs.matchAll(/\s+([a-z-]+)="([^"]*)"/g)) {
      if (!ATTRS.has(a[1])) ok = false;
      if ((a[1] === 'href' || a[1] === 'src') && !/^(https?:\/\/|\/(?!\/))/.test(a[2])) ok = false;
    }
    return '';
  });
  return ok && !rest.includes('<');
}
for (const v of vectors) { const out = renderMarkdown(v); ok(onlySafeMarkup(out), `Markdown an toàn: ${v}`, out); }
ok(onlySafeMarkup(renderMarkdown('## [x](https://a.b) **b** *i*\n\n> q\n\n- l1\n- l2\n\n![alt](/images/a.jpg)')), 'Markdown hợp lệ qua bộ kiểm tra thẻ');
ok(!onlySafeMarkup('<script>x</script>') && !onlySafeMarkup('<a onclick="x" href="/">a</a>') && !onlySafeMarkup('<a href="javascript:x">a</a>'), 'bộ kiểm tra thẻ tự nó bắt được thẻ xấu');

server.close();
console.log(`\n${pass} kiểm tra đạt, ${failures.length} lỗi.`);
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
