// Thử giao diện thật bằng trình duyệt: đăng ký, đăng nhập, viết bài, duyệt thành viên, bình luận.
//   node --no-warnings dev/test-ui.mjs        (ảnh chụp lưu ở /tmp/ui-shots)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createD1 } from './d1.mjs';
import { listen } from './server.mjs';
import { sha256Hex } from '../functions/_lib/auth.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = '/tmp/ui-shots';
fs.mkdirSync(SHOTS, { recursive: true });

const db = createD1();
db.exec(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
const INVITE = 'ma-moi-thu-nghiem-' + Math.random().toString(36).slice(2);
await db.prepare('INSERT INTO invites (token_hash, role, created_at) VALUES (?, ?, ?)').bind(await sha256Hex(INVITE), 'admin', 0).run();
const { server, url } = await listen({ db, port: 0 });

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) pass++; else { fail++; console.log('  ✗', m, extra ?? ''); } };

const browser = await chromium.launch();
const problems = [];
function watch(page, tag) {
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${tag} console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`${tag} pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) problems.push(`${tag} requestfailed: ${r.url()}`); });
}
async function newCtx(viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport, locale: 'vi-VN', extraHTTPHeaders: {} });
  // Google Fonts không truy cập được từ môi trường thử: bỏ qua để không báo lỗi giả
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route(/youtube-nocookie\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>video</p>' }));
  return ctx;
}
async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

try {
  // ---------- 1. Trang tĩnh: không lỗi, không tràn ngang, ở cả máy tính và điện thoại ----------
  for (const [name, vp] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await newCtx(vp);
    const page = await ctx.newPage(); watch(page, name);
    for (const p of ['/', '/about', '/dang-nhap', '/dang-ky', '/rieng-tu', '/quan-ly', '/khong-co-trang-nay']) {
      await page.goto(url + p, { waitUntil: 'networkidle' });
      ok((await overflow(page)) <= 0, `${name} ${p} không tràn ngang`, await overflow(page));
      if (p !== '/') await page.screenshot({ path: `${SHOTS}/${name}${p.replace(/\//g, '-') || '-home'}.png`, fullPage: true });
    }
    await ctx.close();
  }

  // ---------- 2. Chủ trang đăng ký bằng mã mời ----------
  const ownerCtx = await newCtx();
  const owner = await ownerCtx.newPage(); watch(owner, 'owner');
  await owner.goto(url + '/dang-ky', { waitUntil: 'networkidle' });
  ok(await owner.locator('#register-done').isHidden(), 'khung "đã nhận" ẩn lúc đầu');
  await owner.fill('#name', 'Mìn');
  await owner.fill('#email', 'min@example.com');
  await owner.fill('#password', 'Mat-khau-thu-nghiem-1');
  await owner.fill('#password2', 'Mat-khau-khong-giong');
  await owner.click('summary:has-text("mã mời")');
  await owner.fill('#invite', INVITE);
  await owner.click('button[type=submit]');
  await owner.waitForSelector('#form-msg:not([hidden])');
  ok(/chưa giống/.test(await owner.textContent('#form-msg')), 'báo hai mật khẩu chưa giống');
  await owner.fill('#password2', 'Mat-khau-thu-nghiem-1');
  await Promise.all([owner.waitForURL(/\/quan-ly/), owner.click('button[type=submit]')]);
  await owner.waitForSelector('#admin-root:not([hidden])');
  ok(true, 'chủ trang vào được khu quản lý sau khi đăng ký');
  ok((await owner.locator('.nav-logout').count()) === 1, 'menu có nút Đăng xuất');
  ok((await owner.locator('.nav-account').first().textContent()).trim() === 'Quản lý', 'liên kết đổi thành Quản lý');

  // ---------- 3. Viết bài (nháp -> đăng) ----------
  await owner.click('#new-post');
  await owner.waitForSelector('#post-editor:not([hidden])');
  await owner.fill('#f-title', 'Đà Lạt mùa mưa');
  await owner.fill('#f-excerpt', 'Một cuối tuần sương mù và cà phê nóng.');
  await owner.fill('#f-body', '## Sáng sớm\n\nMình dậy lúc 5 giờ, **trời lạnh** và *sương dày*.\n\n> Cà phê ngon nhất là ly uống trong mưa.\n\n- Bánh tráng nướng\n- Sữa đậu nành\n\n[Xem thêm](https://example.com) <script>alert(1)</script>');
  await owner.fill('#f-country', 'Việt Nam');
  await owner.fill('#f-date', '2026-10');
  await owner.fill('#f-days', '3');
  await owner.fill('#f-video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await owner.click('summary:has-text("Bản tiếng Anh")');
  await owner.fill('#f-title-en', 'Da Lat in the rainy season');
  await owner.fill('#f-body-en', 'I woke up at 5 am and it was cold.');
  await owner.selectOption('#f-status', 'draft');
  await owner.screenshot({ path: `${SHOTS}/editor.png`, fullPage: true });
  await owner.click('#post-form button[type=submit]');
  await owner.waitForSelector('#post-list .row');
  ok((await owner.textContent('#post-list')).includes('Đà Lạt mùa mưa'), 'bài nháp hiện trong danh sách');
  ok((await owner.textContent('#post-list')).includes('Nháp'), 'bài mang nhãn Nháp');

  const anon = await (await newCtx()).newPage(); watch(anon, 'anon');
  let r = await anon.goto(url + '/bai/da-lat-mua-mua');
  ok(r.status() === 404, 'người lạ không thấy bài nháp', r.status());
  await anon.goto(url + '/', { waitUntil: 'networkidle' });
  ok(!(await anon.content()).includes('Đà Lạt mùa mưa'), 'trang chủ không lộ bài nháp');

  // đăng công khai
  await owner.click('#post-list button:has-text("Sửa")');
  await owner.waitForSelector('#post-editor:not([hidden])');
  await owner.selectOption('#f-status', 'published');
  await owner.click('#post-form button[type=submit]');
  await owner.waitForFunction(() => document.querySelector('#post-list').textContent.includes('Đã đăng'));
  ok(true, 'đăng bài công khai');

  r = await anon.goto(url + '/bai/da-lat-mua-mua', { waitUntil: 'networkidle' });
  ok(r.status() === 200, 'người lạ đọc được bài đã đăng', r.status());
  const html = await anon.content();
  ok(!/<script>alert/.test(html) && html.includes('&lt;script&gt;'), 'script trong nội dung bị thoát');
  ok(await anon.locator('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]').count() === 1, 'video YouTube được nhúng');
  ok(await anon.locator('blockquote, .prose blockquote').count() >= 1, 'trích dẫn được hiển thị');
  ok((await overflow(anon)) <= 0, 'trang bài viết không tràn ngang');
  ok(await anon.locator('#comment-form').count() === 0, 'người lạ không có ô bình luận');
  ok(/đăng nhập/i.test(await anon.textContent('#binh-luan')), 'người lạ được mời đăng nhập');
  await anon.screenshot({ path: `${SHOTS}/post-anon.png`, fullPage: true });

  // tiếng Anh
  await anon.click('[data-set-lang=en]');
  await anon.waitForTimeout(200);
  ok(await anon.locator('[data-only=en]').first().isVisible() && await anon.locator('[data-only=vi]').first().isHidden(), 'bản EN hiện, bản VI ẩn');
  ok(/Log in/.test(await anon.textContent('#binh-luan')), 'phần bình luận dịch sang EN');
  await anon.screenshot({ path: `${SHOTS}/post-en.png`, fullPage: true });
  await anon.click('[data-set-lang=vi]');

  // trang chủ hiện bài thật
  await anon.goto(url + '/', { waitUntil: 'networkidle' });
  ok((await anon.content()).includes('Đà Lạt mùa mưa'), 'trang chủ hiện bài thật');
  await anon.screenshot({ path: `${SHOTS}/home-with-post.png`, fullPage: true });

  // ---------- 4. Thành viên đăng ký -> chờ duyệt ----------
  const memCtx = await newCtx({ width: 390, height: 844 });
  const mem = await memCtx.newPage(); watch(mem, 'member');
  await mem.goto(url + '/dang-ky', { waitUntil: 'networkidle' });
  await mem.fill('#name', 'Lan');
  await mem.fill('#email', 'lan@example.com');
  await mem.fill('#password', 'Mat-khau-cua-Lan-2');
  await mem.fill('#password2', 'Mat-khau-cua-Lan-2');
  await mem.click('button[type=submit]');
  await mem.waitForSelector('#register-done:not([hidden])');
  ok(await mem.locator('#register-form').isHidden(), 'form đăng ký ẩn sau khi gửi');
  await mem.screenshot({ path: `${SHOTS}/register-done-mobile.png`, fullPage: true });
  await mem.goto(url + '/dang-nhap', { waitUntil: 'networkidle' });
  await mem.fill('#email', 'lan@example.com');
  await mem.fill('#password', 'Mat-khau-cua-Lan-2');
  await mem.click('button[type=submit]');
  await mem.waitForSelector('#form-msg:not([hidden])');
  ok(/duyệt|chờ/i.test(await mem.textContent('#form-msg')), 'đăng nhập khi chưa duyệt bị từ chối', await mem.textContent('#form-msg'));

  // chủ trang duyệt
  await owner.reload({ waitUntil: 'networkidle' });
  await owner.waitForSelector('#admin-root:not([hidden])');
  ok(await owner.locator('#pending-count').isVisible(), 'số thành viên chờ duyệt hiện trên tab');
  await owner.click('[data-tab=users]');
  await owner.waitForSelector('#user-list .row');
  await owner.screenshot({ path: `${SHOTS}/admin-users.png`, fullPage: true });
  await owner.click('#user-list .row:has-text("lan@example.com") button:has-text("Duyệt")');
  await owner.waitForFunction(() => /Đã duyệt/.test([...document.querySelectorAll('#user-list .row')].find((r) => r.textContent.includes('lan@example.com')).textContent));
  ok(true, 'duyệt thành viên');

  // ---------- 5. Thành viên đăng nhập và bình luận ----------
  await mem.goto(url + '/dang-nhap?next=/bai/da-lat-mua-mua', { waitUntil: 'networkidle' });
  await mem.fill('#email', 'lan@example.com');
  await mem.fill('#password', 'Mat-khau-cua-Lan-2');
  await Promise.all([mem.waitForURL(/\/bai\/da-lat-mua-mua/), mem.click('button[type=submit]')]);
  await mem.waitForSelector('#comment-form');
  await mem.fill('#comment-body', 'Đẹp quá! <b>Mình cũng muốn đi</b>');
  await mem.click('#comment-form button[type=submit]');
  await mem.waitForSelector('.comment');
  const cm = await mem.textContent('.comment');
  ok(cm.includes('Lan') && cm.includes('<b>Mình cũng muốn đi</b>'), 'bình luận hiện, HTML bị thoát thành chữ', cm);
  ok((await overflow(mem)) <= 0, 'trang bài + bình luận không tràn ngang trên điện thoại');
  await mem.screenshot({ path: `${SHOTS}/post-member-mobile.png`, fullPage: true });
  ok(await mem.locator('.nav-account').count() === 0 || (await mem.locator('.nav-account').first().textContent()).trim() !== 'Quản lý', 'thành viên không thấy liên kết Quản lý');
  r = await mem.goto(url + '/quan-ly', { waitUntil: 'networkidle' });
  await mem.waitForTimeout(300);
  ok(await mem.locator('#admin-root').isHidden(), 'thành viên không vào được khu quản lý');

  // chủ trang xóa bình luận
  await owner.goto(url + '/bai/da-lat-mua-mua', { waitUntil: 'networkidle' });
  await owner.click('[data-del-comment]');
  await owner.click('[data-del-comment]'); // bấm hai lần để xác nhận
  await owner.waitForFunction(() => !document.querySelector('.comment'));
  ok(true, 'chủ trang xóa được bình luận');

  // đăng xuất
  await owner.click('.nav-logout');
  await owner.waitForLoadState('networkidle');
  ok((await owner.locator('.nav-account').first().textContent()).trim() === 'Đăng nhập', 'đăng xuất xong menu về Đăng nhập');

  // ---------- 6. CSP: không có vi phạm nào ----------
  const csp = problems.filter((p) => /Content Security Policy|Refused to/i.test(p));
  ok(csp.length === 0, 'không vi phạm CSP', csp.join('\n'));
  const other = problems.filter((p) => !/Content Security Policy|Refused to/i.test(p) && !/status of (403|404)/.test(p));
  ok(other.length === 0, 'không có lỗi console khác', other.join('\n'));
} catch (e) {
  fail++; console.log('  ✗ ngoại lệ:', e.message);
  console.log(problems.join('\n'));
} finally {
  await browser.close(); server.close();
  console.log(`\n${pass} đạt, ${fail} lỗi. Ảnh chụp: ${SHOTS}`);
  process.exit(fail ? 1 : 0);
}
