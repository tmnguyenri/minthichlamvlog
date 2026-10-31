import { requireAdmin, now } from '../../_lib/auth.js';
import { badRequest, fail, json, readJson } from '../../_lib/http.js';
import { cleanPost } from '../../_lib/validate.js';
import { notifyIndexNow } from '../../_lib/indexnow.js';

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 50);
  const all = url.searchParams.get('all') === '1';
  if (all && requireAdmin(data)) return requireAdmin(data);
  // image_id: một ảnh ngẫu nhiên trong các ảnh đã tải lên cho bài (NULL nếu chưa có).
  const cols = `id, slug, title, title_en, excerpt, excerpt_en, country, trip_date, days, cover, video, status, published_at, updated_at,
    (SELECT i.id FROM images i WHERE i.post_id = posts.id ORDER BY RANDOM() LIMIT 1) AS image_id`;
  const sql = all
    ? `SELECT ${cols} FROM posts ORDER BY updated_at DESC LIMIT ?`
    : `SELECT ${cols} FROM posts WHERE status = 'published' ORDER BY COALESCE(trip_date, '') DESC, published_at DESC LIMIT ?`;
  const { results } = await env.DB.prepare(sql).bind(limit).all();
  return json({ posts: results });
}

export async function onRequestPost({ request, env, data, waitUntil }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return badRequest();
  const { value: p, error } = cleanPost(body);
  if (error) return fail(400, error.code, error.vi, error.en);
  const t = now();
  try {
    const res = await env.DB.prepare(
      `INSERT INTO posts (slug, title, title_en, excerpt, excerpt_en, body, body_en, country, trip_date, days, cover, video, status, author_id, created_at, updated_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(p.slug, p.title, p.title_en, p.excerpt, p.excerpt_en, p.body, p.body_en, p.country, p.trip_date, p.days, p.cover, p.video,
      p.status, data.user.id, t, t, p.status === 'published' ? t : null).run();
    if (p.status === 'published') notifyIndexNow({ env, waitUntil }, [`/bai/${encodeURIComponent(p.slug)}`, '/']);
    return json({ ok: true, id: res.meta.last_row_id, slug: p.slug }, 201);
  } catch {
    return fail(409, 'slug_taken', 'Đường dẫn này đã có bài khác dùng.', 'Another post already uses this slug.');
  }
}
