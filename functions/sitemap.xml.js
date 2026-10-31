// Sơ đồ trang cho Google, Bing...: các trang chính cộng mọi bài đã đăng. Bài mẫu và trang tài khoản không có trong này.
import { esc } from './_lib/http.js';
import { isoDate, siteUrl } from './_lib/site.js';

export async function onRequestGet({ env }) {
  const base = siteUrl(env);
  const { results } = await env.DB.prepare(
    `SELECT slug, updated_at, published_at FROM posts WHERE status = 'published' ORDER BY COALESCE(published_at, updated_at) DESC LIMIT 2000`,
  ).all();
  const day = (sec) => isoDate(sec).slice(0, 10);
  const latest = results.reduce((m, p) => Math.max(m, p.updated_at || 0), 0);
  const entry = (loc, lastmod) => `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
  const lines = [
    entry(base + '/', day(latest)),
    entry(base + '/about', ''),
    entry(base + '/rieng-tu', ''),
    ...results.map((p) => entry(`${base}/bai/${encodeURIComponent(p.slug)}`, day(p.updated_at))),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}
