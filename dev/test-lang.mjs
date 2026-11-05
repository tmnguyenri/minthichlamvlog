// Thử bằng trình duyệt thật: hai địa chỉ ngôn ngữ của trang bài viết (/bai/... và /en/bai/...) và nút VI / EN.
//   node --no-warnings dev/test-lang.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createD1 } from './d1.mjs';
import { listen } from './server.mjs';
import { sha256Hex } from '../functions/_lib/auth.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const db = createD1();
db.exec(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
const INVITE = 'ma-moi-thu-nghiem-' + Math.random().toString(36).slice(2);
await db.prepare('INSERT INTO invites (token_hash, role, created_at) VALUES (?, ?, ?)').bind(await sha256Hex(INVITE), 'admin', 0).run();
const { server, url } = await listen({ db, port: 0 });

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) pass++; else { fail++; console.log('  ✗', m, extra ?? ''); } };

// Tạo tài khoản quản trị và hai bài đã đăng (một bài có bản dịch tiếng Anh, một bài chưa có) bằng API
async function api(method, p, body, cookie) {
  const res = await fetch(url + p, { method, redirect: 'manual', headers: { 'content-type': 'application/json', origin: url, 'cf-connecting-ip': '10.9.9.9', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { res, json: await res.json().catch(() => null) };
}
const reg = await api('POST', '/api/auth/register', { email: 'admin@example.com', name: 'Chủ trang', password: 'mat-khau-dai-123', invite: INVITE });
const cookie = (reg.res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
ok(reg.res.status === 200 && cookie.includes('='), 'tạo được tài khoản quản trị để thử', `${reg.res.status} ${JSON.stringify(reg.json)}`);
const mk = (b) => api('POST', '/api/posts', { status: 'published', country: 'Việt Nam', trip_date: '2026-03', ...b }, cookie);
let made = await mk({ slug: 'hoi-an', title: 'Hội An về đêm', title_en: 'Hội An At Night', body: 'Mình dạo phố cổ.', body_en: 'I wandered the old town.' });
ok(made.res.status === 201, 'tạo bài có bản dịch', JSON.stringify(made.json));
made = await mk({ slug: 'chi-viet', title: 'Chỉ có tiếng Việt', title_en: 'Only Vietnamese Here', body: 'Nội dung tiếng Việt.' });
ok(made.res.status === 201, 'tạo bài chưa có bản dịch', JSON.stringify(made.json));

const browser = await chromium.launch();
async function newPage() {
  const ctx = await browser.newContext({ locale: 'vi-VN' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors };
}
const stored = (page) => page.evaluate(() => localStorage.getItem('mtlv-lang'));
const h1 = (page) => page.locator('h1').first().innerText();

try {
  // 1. Khách mới mở bản tiếng Việt: giữ nguyên tiếng Việt, bấm EN thì sang địa chỉ tiếng Anh
  {
    const { ctx, page, errors } = await newPage();
    await page.goto(url + '/bai/hoi-an', { waitUntil: 'networkidle' });
    ok(new URL(page.url()).pathname === '/bai/hoi-an' && (await h1(page)) === 'Hội An về đêm', 'khách mới: bản tiếng Việt, không bị chuyển hướng');
    await page.click('[data-set-lang="en"]');
    await page.waitForURL('**/en/bai/hoi-an');
    ok((await h1(page)) === 'Hội An At Night' && (await page.locator('html').getAttribute('lang')) === 'en', 'bấm EN: sang /en/bai/..., tiêu đề và lang là tiếng Anh');
    ok((await page.locator('.prose').textContent()).includes('I wandered the old town.') && !(await page.content()).includes('Mình dạo phố cổ'), 'trang tiếng Anh chỉ có nội dung tiếng Anh');
    ok((await page.locator('[data-set-lang="en"]').getAttribute('aria-pressed')) === 'true' && (await page.locator('[data-set-lang="vi"]').getAttribute('aria-pressed')) === 'false', 'nút EN đang được chọn');
    ok((await page.locator('.nav a').first().innerText()) === 'Journal', 'menu của trang tiếng Anh là tiếng Anh');
    ok((await stored(page)) === 'en', 'lựa chọn EN được nhớ');
    // 2. Từ trang tiếng Anh bấm VI: về địa chỉ tiếng Việt
    await page.click('[data-set-lang="vi"]');
    await page.waitForURL('**/bai/hoi-an');
    ok(new URL(page.url()).pathname === '/bai/hoi-an' && (await h1(page)) === 'Hội An về đêm' && (await stored(page)) === 'vi', 'bấm VI: về /bai/..., tiếng Việt và nhớ lựa chọn');
    ok(errors.length === 0, 'không có lỗi JavaScript', errors.join('; '));
    await ctx.close();
  }

  // 3. Người đã chọn EN mở địa chỉ tiếng Việt: được đưa sang bản tiếng Anh
  {
    const { ctx, page } = await newPage();
    await page.addInitScript(() => { try { localStorage.setItem('mtlv-lang', 'en'); } catch (e) { /* bỏ qua */ } });
    await page.goto(url + '/bai/hoi-an', { waitUntil: 'networkidle' });
    ok(new URL(page.url()).pathname === '/en/bai/hoi-an' && (await h1(page)) === 'Hội An At Night', 'đang chọn EN mở /bai/...: sang /en/bai/...');
    await ctx.close();
  }

  // 4. Mở thẳng địa chỉ tiếng Anh khi đang nhớ tiếng Việt (ví dụ đến từ Google): vẫn ở bản tiếng Anh, và nhớ EN cho các trang sau
  {
    const { ctx, page } = await newPage();
    await page.addInitScript(() => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('mtlv-lang', 'vi'); sessionStorage.setItem('seeded', '1'); } } catch (e) { /* bỏ qua */ } });
    await page.goto(url + '/en/bai/hoi-an', { waitUntil: 'networkidle' });
    ok(new URL(page.url()).pathname === '/en/bai/hoi-an' && (await h1(page)) === 'Hội An At Night', 'mở thẳng /en/bai/... khi đang nhớ VI: vẫn ở bản tiếng Anh');
    ok((await stored(page)) === 'en', 'mở trang tiếng Anh thì nhớ EN');
    await page.goto(url + '/', { waitUntil: 'networkidle' });
    ok((await page.locator('html').getAttribute('data-lang')) === 'en', 'trang chủ mở tiếp theo cũng là tiếng Anh');
    await ctx.close();
  }

  // 5. Bài chưa có bản tiếng Anh: không chuyển hướng, không lặp vô hạn; chọn EN vẫn đổi tiêu đề tại chỗ như trước
  {
    const { ctx, page } = await newPage();
    await page.addInitScript(() => { try { localStorage.setItem('mtlv-lang', 'en'); } catch (e) { /* bỏ qua */ } });
    await page.goto(url + '/bai/chi-viet', { waitUntil: 'networkidle' });
    ok(new URL(page.url()).pathname === '/bai/chi-viet' && (await h1(page)) === 'Only Vietnamese Here', 'bài chưa có bản dịch: ở lại địa chỉ cũ, tiêu đề đổi tại chỗ');
    await page.goto(url + '/en/bai/chi-viet', { waitUntil: 'networkidle' });
    ok(new URL(page.url()).pathname === '/bai/chi-viet', 'địa chỉ tiếng Anh của bài chưa có bản dịch chuyển về bản tiếng Việt');
    await ctx.close();
  }

  // 6. Trang chủ vẫn đổi ngôn ngữ tại chỗ như cũ
  {
    const { ctx, page } = await newPage();
    await page.goto(url + '/', { waitUntil: 'networkidle' });
    await page.click('[data-set-lang="en"]');
    ok(new URL(page.url()).pathname === '/' && (await page.locator('html').getAttribute('data-lang')) === 'en', 'trang chủ: bấm EN đổi tại chỗ, không chuyển địa chỉ');
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${pass} đạt, ${fail} lỗi.`);
process.exit(fail ? 1 : 0);
