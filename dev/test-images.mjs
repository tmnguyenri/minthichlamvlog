// Kiểm thử thư viện ảnh: chạy bằng  node --no-warnings dev/test-images.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createD1 } from './d1.mjs';
import { listen } from './server.mjs';
import { sha256Hex } from '../functions/_lib/auth.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = createD1();
db.exec(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
const { server, url } = await listen({ db });

let pass = 0; const failures = [];
function ok(cond, name, extra = '') { if (cond) pass++; else { failures.push(name); console.log('  FAIL', name, extra); } }

async function session(email, role) {
  const t = now();
  const info = db.raw.prepare('INSERT INTO users (email, display_name, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(email, 'Tên thử', 'x', role, 'approved', t);
  const token = `token-${email}-${Math.random().toString(36).slice(2)}`;
  db.raw.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(await sha256Hex(token), Number(info.lastInsertRowid), t, t + 3600);
  return `sid=${token}`;
}
function now() { return Math.floor(Date.now() / 1000); }

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3, 4, 5]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0]);

async function call(method, p, { cookie, body, type, origin = url, extra = {} } = {}) {
  const h = { ...extra };
  if (origin) h.origin = origin;
  if (cookie) h.cookie = cookie;
  if (type) h['content-type'] = type;
  const res = await fetch(url + p, { method, headers: h, body, redirect: 'manual' });
  const buf = new Uint8Array(await res.arrayBuffer());
  let json = null; try { json = JSON.parse(new TextDecoder().decode(buf)); } catch { /* không phải JSON */ }
  return { status: res.status, json, buf, text: new TextDecoder().decode(buf), type: res.headers.get('content-type'), nosniff: res.headers.get('x-content-type-options') };
}

const adminCookie = await session('chu@example.com', 'admin');
const memberCookie = await session('thanh-vien@example.com', 'member');

console.log('1. Quyền truy cập');
let r = await call('GET', '/api/images');
ok(r.status === 401, 'danh sách ảnh cần đăng nhập', r.status);
r = await call('POST', '/api/images', { body: JPEG, type: 'image/jpeg' });
ok(r.status === 401, 'tải ảnh khi chưa đăng nhập bị từ chối', r.status);
r = await call('POST', '/api/images', { cookie: memberCookie, body: JPEG, type: 'image/jpeg' });
ok(r.status === 403, 'thành viên thường không tải được ảnh', r.status);
r = await call('POST', '/api/images', { cookie: adminCookie, body: JPEG, type: 'image/jpeg', origin: 'https://evil.example' });
ok(r.status === 403, 'CSRF: sai Origin bị chặn', r.status);

console.log('2. Tải lên');
r = await call('POST', '/api/images?caption=' + encodeURIComponent('  Bình minh <script>x</script> ở Hạ Long  '), { cookie: adminCookie, body: JPEG, type: 'image/jpeg' });
ok(r.status === 201 && r.json && r.json.id, 'tải JPEG thành công', r.status);
const jpegId = r.json && r.json.id;
r = await call('POST', '/api/images', { cookie: adminCookie, body: PNG, type: 'image/jpeg' });
ok(r.status === 201, 'PNG vẫn nhận dù khai Content-Type là JPEG (nhận diện theo chữ ký tệp)', r.status);
const pngId = r.json && r.json.id;
r = await call('POST', '/api/images', { cookie: adminCookie, body: WEBP, type: 'image/webp' });
ok(r.status === 201, 'WebP được nhận', r.status);
r = await call('POST', '/api/images', { cookie: adminCookie, body: new TextEncoder().encode('<html>không phải ảnh</html>'), type: 'image/jpeg' });
ok(r.status === 415 && r.json.error === 'bad_type', 'tệp không phải ảnh bị từ chối', r.status);
r = await call('POST', '/api/images', { cookie: adminCookie, body: new Uint8Array(0), type: 'image/jpeg' });
ok(r.status === 400, 'tải lên rỗng bị từ chối', r.status);
const big = new Uint8Array(400 * 1024 + 10); big.set(JPEG, 0);
r = await call('POST', '/api/images', { cookie: adminCookie, body: big, type: 'image/jpeg' });
ok(r.status === 413 && r.json.error === 'too_large', 'ảnh trên 400 KB bị từ chối', r.status);

console.log('3. Xem và danh sách');
r = await call('GET', `/api/images/${jpegId}`);
ok(r.status === 200 && r.type === 'image/jpeg', 'xem ảnh công khai, đúng Content-Type', `${r.status} ${r.type}`);
ok(r.buf.length === JPEG.length && r.buf.every((b, i) => b === JPEG[i]), 'nội dung ảnh giống hệt bản đã tải lên');
ok(r.nosniff === 'nosniff', 'có tiêu đề nosniff');
r = await call('GET', '/api/images/999999');
ok(r.status === 404, 'ảnh không tồn tại trả về 404', r.status);
r = await call('GET', '/api/images', { cookie: adminCookie });
ok(r.status === 200 && r.json.images.length === 3, 'chủ trang thấy danh sách 3 ảnh', JSON.stringify(r.json));
ok(r.json && r.json.images.every((i) => !('data' in i)), 'danh sách không kèm dữ liệu ảnh');
const row = db.raw.prepare('SELECT caption FROM images WHERE id = ?').get(jpegId);
ok(row && !row.caption.includes('<') && row.caption.startsWith('Bình minh'), 'chú thích đã được làm sạch', row && row.caption);

console.log('4. Xóa');
r = await call('DELETE', `/api/images/${pngId}`, { cookie: memberCookie });
ok(r.status === 403, 'thành viên không xóa được ảnh', r.status);
r = await call('DELETE', `/api/images/${pngId}`, { cookie: adminCookie });
ok(r.status === 204, 'chủ trang xóa được ảnh', r.status);
r = await call('GET', `/api/images/${pngId}`);
ok(r.status === 404, 'ảnh đã xóa không còn xem được', r.status);
r = await call('DELETE', `/api/images/${pngId}`, { cookie: adminCookie });
ok(r.status === 404, 'xóa lần hai trả về 404', r.status);

console.log('5. Ảnh theo từng bài');
const adminId = db.raw.prepare("SELECT id FROM users WHERE email = 'chu@example.com'").get().id;
const t0 = now();
const withPhotos = db.raw.prepare(`INSERT INTO posts (slug, title, title_en, excerpt, excerpt_en, body, body_en, country, trip_date, days, cover, video, status, author_id, created_at, updated_at, published_at)
  VALUES ('bai-co-anh', 'Bài có ảnh', '', '', '', '', '', '', '', NULL, '', '', 'published', ?, ?, ?, ?)`).run(adminId, t0, t0, t0).lastInsertRowid;
const noPhotos = db.raw.prepare(`INSERT INTO posts (slug, title, title_en, excerpt, excerpt_en, body, body_en, country, trip_date, days, cover, video, status, author_id, created_at, updated_at, published_at)
  VALUES ('bai-khong-anh', 'Bài không ảnh', '', '', '', '', '', '', '', NULL, '', '', 'published', ?, ?, ?, ?)`).run(adminId, t0, t0, t0).lastInsertRowid;
r = await call('POST', `/api/images?post_id=${withPhotos}&caption=anh-1`, { cookie: adminCookie, body: JPEG, type: 'image/jpeg' });
ok(r.status === 201, 'tải ảnh gắn vào bài', r.status);
const photoA = r.json.id;
r = await call('POST', `/api/images?post_id=${withPhotos}&caption=anh-2`, { cookie: adminCookie, body: PNG, type: 'image/png' });
ok(r.status === 201, 'bài có thể có nhiều ảnh', r.status);
const photoB = r.json.id;
r = await call('POST', '/api/images?post_id=99999', { cookie: adminCookie, body: JPEG, type: 'image/jpeg' });
ok(r.status === 404, 'gắn vào bài không tồn tại bị từ chối', r.status);
r = await call('POST', '/api/images?post_id=abc', { cookie: adminCookie, body: JPEG, type: 'image/jpeg' });
ok(r.status === 400, 'post_id sai định dạng bị từ chối', r.status);
r = await call('GET', `/api/posts/${withPhotos}`, { cookie: adminCookie });
ok(r.status === 200 && r.json.images.length === 2 && r.json.images.every((i) => !('data' in i)), 'trang sửa bài trả về danh sách ảnh của bài', JSON.stringify(r.json && r.json.images));
r = await call('GET', '/api/posts');
const listed = r.json && r.json.posts.find((p) => p.slug === 'bai-co-anh');
ok(listed && [photoA, photoB].includes(listed.image_id), 'danh sách bài trả về một ảnh ngẫu nhiên của bài', JSON.stringify(listed));
const listedEmpty = r.json && r.json.posts.find((p) => p.slug === 'bai-khong-anh');
ok(listedEmpty && listedEmpty.image_id === null, 'bài chưa có ảnh có image_id = null');
const seen = new Set();
for (let k = 0; k < 20; k++) {
  const rr = await call('GET', '/api/posts');
  seen.add(rr.json.posts.find((p) => p.slug === 'bai-co-anh').image_id);
}
ok(seen.size === 2, 'ảnh được chọn ngẫu nhiên giữa các lần tải', `chỉ thấy ${seen.size} ảnh`);
r = await call('GET', '/bai/bai-co-anh');
const heroMatch = /post-hero__img" src="\/api\/images\/(\d+)"/.exec(r.text);
ok(r.status === 200 && heroMatch && [photoA, photoB].includes(Number(heroMatch[1])), 'trang bài hiện một ảnh của chính bài đó', heroMatch && heroMatch[0]);
r = await call('GET', '/bai/bai-khong-anh');
ok(r.status === 200 && r.text.includes('/images/cover-default.svg'), 'bài không ảnh dùng ảnh mặc định');
r = await call('GET', '/api/images', { cookie: adminCookie });
const mine = r.json && r.json.images.find((i) => i.id === photoA);
ok(mine && mine.post_title === 'Bài có ảnh' && mine.post_id === withPhotos, 'danh sách ảnh cho biết ảnh thuộc bài nào', JSON.stringify(mine));
db.raw.prepare('DELETE FROM posts WHERE id = ?').run(withPhotos);
const orphan = db.raw.prepare('SELECT post_id FROM images WHERE id = ?').get(photoA);
ok(orphan && orphan.post_id === null, 'xóa bài thì ảnh vẫn còn trong thư viện (post_id thành NULL)');

server.close();
console.log(`\n${pass} kiểm tra đạt, ${failures.length} lỗi.`);
process.exit(failures.length ? 1 : 0);
