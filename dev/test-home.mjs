// Trang chủ: khi đã có bài thật (kèm ảnh), dòng thời gian và bản đồ phải hiện bài thật thay cho bài mẫu.
//   node --no-warnings dev/test-home.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createD1 } from './d1.mjs';
import { listen } from './server.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) pass++; else { fail++; console.log('  ✗', m, extra ?? ''); } };

const db = createD1();
db.exec(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
const t = Math.floor(Date.now() / 1000);
db.raw.prepare("INSERT INTO users (email, display_name, password_hash, role, status, created_at) VALUES ('chu@example.com','Chủ','x','admin','approved',?)").run(t);
const uid = db.raw.prepare('SELECT id FROM users').get().id;
const addPost = (slug, title, country, city, tripDate) => db.raw.prepare(
  `INSERT INTO posts (slug, title, title_en, excerpt, excerpt_en, body, body_en, country, city, trip_date, days, cover, video, status, author_id, created_at, updated_at, published_at)
   VALUES (?, ?, '', 'Tóm tắt', '', 'x', '', ?, ?, ?, NULL, '', '', 'published', ?, ?, ?, ?)`,
).run(slug, title, country, city, tripDate, uid, t, t, t).lastInsertRowid;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const addPhoto = (postId) => db.raw.prepare('INSERT INTO images (post_id, caption, mime, data, size, author_id, created_at) VALUES (?,?,?,?,?,?,?)').run(postId, '', 'image/png', PNG, PNG.length, uid, t);

const { server, url } = await listen({ db, port: 0 });
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

console.log('1. Chưa có bài thật: giữ bài mẫu');
await page.goto(url + '/', { waitUntil: 'networkidle' });
ok(await page.locator('.tl-card').count() === 0, 'chưa có bài thật thì không có thẻ dòng thời gian');
ok(await page.locator('#nhat-ky .cards :text("Mẫu")').count() > 0, 'bài mẫu vẫn hiện');

console.log('2. Có bài thật kèm nhiều ảnh');
const p1 = addPost('che-le-duong', 'Chè lề đường', 'Việt Nam', 'Đà Nẵng', '2012-10');
addPhoto(p1); addPhoto(p1);
const p2 = addPost('pho-co', 'Phố cổ', 'Việt Nam', 'Hội An', '2013-03');
const p3 = addPost('kyoto', 'Kyoto', 'Nhật Bản', 'Kyoto', '2014-11');
addPhoto(p3);
await page.goto(url + '/', { waitUntil: 'networkidle' });
await page.waitForSelector('.tl-card');
ok(await page.locator('.tl-card').count() === 3, 'cả ba bài thật hiện trong dòng thời gian', await page.locator('.tl-card').count());
ok(await page.locator('#nhat-ky .cards :text("Mẫu")').count() === 0, 'bài mẫu được thay hết');
ok(await page.locator('.tl-card:has-text("Chè lề đường") .tl-card__photos img').count() === 2, 'bài có hai ảnh hiện hai ảnh thu nhỏ');
ok(await page.locator('.tl-card:has-text("Phố cổ") .tl-card__photos img').count() === 1, 'bài không có ảnh hiện ảnh mặc định');
ok(errs.length === 0, 'không có lỗi script', errs.join(' | '));

console.log('2b. Chữ trước, ảnh sau; ảnh vuông vức');
for (const [label, size] of [['máy tính', { width: 1280, height: 800 }], ['điện thoại', { width: 390, height: 844 }]]) {
  await page.setViewportSize(size);
  await page.goto(url + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.tl-card');
  const card = page.locator('.tl-card:has-text("Chè lề đường")');
  const kids = await card.evaluate((el) => [...el.children].map((c) => c.className));
  ok(kids[0] === 'tl-card__body' && kids[1] === 'tl-card__photos', `${label}: bài viết nằm trước, ảnh nằm sau`, kids.join(' > '));
  const boxes = await card.locator('.tl-card__photos img').evaluateAll((imgs) => imgs.map((i) => { const r = i.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  ok(boxes.length === 2 && boxes.every(([w, h]) => w > 0 && Math.abs(w - h) <= 1), `${label}: mọi ảnh hình vuông`, JSON.stringify(boxes));
  const tops = await card.evaluate((el) => [el.querySelector('.tl-card__body').getBoundingClientRect().bottom, el.querySelector('.tl-card__photos').getBoundingClientRect().top]);
  ok(tops[0] <= tops[1], `${label}: ảnh nằm dưới phần chữ`, JSON.stringify(tops));
  const widths = await page.locator('.tl-card__photos img').evaluateAll((imgs) => [...new Set(imgs.map((i) => Math.round(i.getBoundingClientRect().width)))]);
  ok(widths.length === 1, `${label}: các ảnh cùng kích thước`, JSON.stringify(widths));
}
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(url + '/', { waitUntil: 'networkidle' });
await page.waitForSelector('.tl-card');

console.log('3. Thành phố và quốc gia');
const card = page.locator('.tl-card:has-text("Chè lề đường") .meta__where');
ok((await card.textContent()).replace(/\s+/g, ' ').trim() === 'Đà Nẵng, Việt Nam', 'thẻ bài hiện "thành phố, quốc gia"', await card.textContent());
const vn = page.locator('#ban-do .atlas .country:has-text("Việt Nam")');
ok(await vn.count() === 1, 'mỗi quốc gia một ô trên bản đồ');
const vnText = (await vn.textContent()).replace(/\s+/g, ' ');
ok(vnText.includes('Đà Nẵng') && vnText.includes('Hội An') && vnText.includes('2 bài viết'), 'ô Việt Nam liệt kê các thành phố đã đi và số bài', vnText);
const jp = (await page.locator('#ban-do .atlas .country:has-text("Nhật Bản")').textContent()).replace(/\s+/g, ' ');
ok(jp.includes('Kyoto') && jp.includes('1 bài viết'), 'ô Nhật Bản liệt kê Kyoto', jp);

await browser.close(); server.close();
console.log(`\n${pass} đạt, ${fail} lỗi.`);
process.exit(fail ? 1 : 0);
