import { requireAdmin, now } from '../../_lib/auth.js';
import { badRequest, fail, json, readJson } from '../../_lib/http.js';
import { cleanPost } from '../../_lib/validate.js';

const notFound = () => fail(404, 'not_found', 'Không tìm thấy bài viết.', 'Post not found.');
const idOf = (params) => (/^\d{1,12}$/.test(params.id) ? Number(params.id) : null);

export async function onRequestGet({ params, env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const id = idOf(params);
  const post = id && await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
  return post ? json({ post }) : notFound();
}

export async function onRequestPut({ request, params, env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const id = idOf(params);
  if (!id) return notFound();
  const body = await readJson(request);
  if (!body) return badRequest();
  const { value: p, error } = cleanPost(body);
  if (error) return fail(400, error.code, error.vi, error.en);
  const old = await env.DB.prepare('SELECT status, published_at FROM posts WHERE id = ?').bind(id).first();
  if (!old) return notFound();
  const t = now();
  const publishedAt = p.status === 'published' ? (old.published_at || t) : old.published_at;
  try {
    await env.DB.prepare(
      `UPDATE posts SET slug=?, title=?, title_en=?, excerpt=?, excerpt_en=?, body=?, body_en=?, country=?, trip_date=?, days=?,
              cover=?, video=?, status=?, updated_at=?, published_at=? WHERE id=?`,
    ).bind(p.slug, p.title, p.title_en, p.excerpt, p.excerpt_en, p.body, p.body_en, p.country, p.trip_date, p.days,
      p.cover, p.video, p.status, t, publishedAt, id).run();
    return json({ ok: true, id, slug: p.slug });
  } catch {
    return fail(409, 'slug_taken', 'Đường dẫn này đã có bài khác dùng.', 'Another post already uses this slug.');
  }
}

export async function onRequestDelete({ params, env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const id = idOf(params);
  if (!id) return notFound();
  const res = await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  return res.meta.changes ? json({ ok: true }) : notFound();
}
