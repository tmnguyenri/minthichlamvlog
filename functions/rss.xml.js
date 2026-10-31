// Nguồn cấp RSS các bài mới nhất, cho trình đọc tin và các công cụ tự động đăng lên mạng xã hội.
import { esc } from './_lib/http.js';
import { SITE_DESC, SITE_NAME, isoDate, siteUrl, describe } from './_lib/site.js';

export async function onRequestGet({ env }) {
  const base = siteUrl(env);
  const { results } = await env.DB.prepare(
    `SELECT slug, title, excerpt, body, country, published_at, updated_at, created_at FROM posts
      WHERE status = 'published' ORDER BY COALESCE(published_at, created_at) DESC LIMIT 30`,
  ).all();
  const rfc = (sec) => (isoDate(sec) ? new Date(sec * 1000).toUTCString() : '');
  const items = results.map((p) => {
    const link = `${base}/bai/${encodeURIComponent(p.slug)}`;
    return `    <item>
      <title>${esc(p.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${rfc(p.published_at || p.created_at)}</pubDate>${p.country ? `\n      <category>${esc(p.country)}</category>` : ''}
      <description>${esc(describe(p))}</description>
    </item>`;
  });
  const newest = results.reduce((m, p) => Math.max(m, p.updated_at || 0), 0);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE_NAME)}</title>
    <link>${esc(base + '/')}</link>
    <description>${esc(SITE_DESC)}</description>
    <language>vi</language>${newest ? `\n    <lastBuildDate>${rfc(newest)}</lastBuildDate>` : ''}
    <atom:link href="${esc(base + '/rss.xml')}" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}
