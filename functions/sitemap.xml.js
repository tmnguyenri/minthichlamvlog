// Sơ đồ trang cho Google, Bing...: các trang chính cộng mọi bài đã đăng. Bài mẫu và trang tài khoản không có trong này.
// Bài đã có bản dịch có hai địa chỉ (/bai/... và /en/bai/...), mỗi địa chỉ kèm liên kết ngôn ngữ hreflang tới cả hai.
import { esc } from './_lib/http.js';
import { isoDate, siteUrl } from './_lib/site.js';

export async function onRequestGet({ env }) {
  const base = siteUrl(env);
  const { results } = await env.DB.prepare(
    `SELECT slug, updated_at, published_at, LENGTH(TRIM(COALESCE(body_en, ''))) > 0 AS has_en FROM posts WHERE status = 'published' ORDER BY COALESCE(published_at, updated_at) DESC LIMIT 2000`,
  ).all();
  const day = (sec) => isoDate(sec).slice(0, 10);
  const latest = results.reduce((m, p) => Math.max(m, p.updated_at || 0), 0);
  const link = (hreflang, href) => `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${esc(href)}"/>`;
  const entry = (loc, lastmod, alternates = []) =>
    `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${alternates.join('')}</url>`;
  const postEntries = results.flatMap((p) => {
    const vi = `${base}/bai/${encodeURIComponent(p.slug)}`;
    if (!p.has_en) return [entry(vi, day(p.updated_at))];
    const en = `${base}/en/bai/${encodeURIComponent(p.slug)}`;
    const alternates = [link('vi', vi), link('en', en), link('x-default', vi)];
    return [entry(vi, day(p.updated_at), alternates), entry(en, day(p.updated_at), alternates)];
  });
  const lines = [
    entry(base + '/', day(latest)),
    entry(base + '/about', ''),
    entry(base + '/rieng-tu', ''),
    ...postEntries,
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${lines.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}
