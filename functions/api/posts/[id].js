import { requireAdmin, now } from '../../_lib/auth.js';
import { badRequest, fail, json, readJson } from '../../_lib/http.js';
import { cleanPost } from '../../_lib/validate.js';
import { notifyIndexNow } from '../../_lib/indexnow.js';
import { fillEnglish } from '../../_lib/translate.js';

const postPath = (slug) => `/bai/${encodeURIComponent(slug)}`;

const notFound = () => fail(404, 'not_found', 'Không tìm thấy bài viết.', 'Post not found.');
const idOf = (params) => (/^\d{1,12}$/.test(params.id) ? Number(params.id) : null);

export async function onRequestGet({ params, env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const id = idOf(params);
  const post = id && await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
  if (!post) return notFound();
  const { results: images } = await env.DB.prepare(
    'SELECT id, caption, size, created_at FROM images WHERE post_id = ? ORDER BY id ASC',
  ).bind(id).all();
  return json({ post, images });
}

export async function onRequestPut({ request, params, env, data, waitUntil }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const id = idOf(params);
  if (!id) return notFound();
  const body = await readJson(request);
  if (!body) return badRequest();
  const { value: p, error } = cleanPost(body);
  if (error) return fail(400, error.code, error.vi, error.en);
  const old = await env.DB.prepare(
    'SELECT slug, status, published_at, title, excerpt, body, title_en, excerpt_en, body_en FROM posts WHERE id = ?',
  ).bind(id).first();
  if (!old) return notFound();
  // Bản tiếng Anh: nếu chủ trang gửi kèm (viết tay) thì giữ đúng như đã gửi.
  // Nếu không gửi (biểu mẫu soạn bài không có ô này) thì giữ bản cũ khi tiếng Việt không đổi, dịch máy lại khi tiếng Việt đổi.
  for (const [vi, en] of [['title', 'title_en'], ['excerpt', 'excerpt_en'], ['body', 'body_en']]) {
    if (!p[en]) p[en] = p[vi] === old[vi] ? old[en] : '';
  }
  await fillEnglish(env, p);
  const t = now();
  const publishedAt = p.status === 'published' ? (old.published_at || t) : old.published_at;
  try {
    await env.DB.prepare(
      `UPDATE posts SET slug=?, title=?, title_en=?, excerpt=?, excerpt_en=?, body=?, body_en=?, country=?, trip_date=?, days=?,
              cover=?, video=?, status=?, updated_at=?, published_at=? WHERE id=?`,
    ).bind(p.slug, p.title, p.title_en, p.excerpt, p.excerpt_en, p.body, p.body_en, p.country, p.trip_date, p.days,
      p.cover, p.video, p.status, t, publishedAt, id).run();
    // Báo cho Bing, Yandex... khi bài đang công khai được đăng hoặc sửa, hoặc vừa bị gỡ / đổi đường dẫn
    const paths = [];
    if (p.status === 'published') paths.push(postPath(p.slug));
    if (old.status === 'published' && (p.status !== 'published' || old.slug !== p.slug)) paths.push(postPath(old.slug));
    if (paths.length) notifyIndexNow({ env, waitUntil }, [...paths, '/']);
    return json({ ok: true, id, slug: p.slug });
  } catch {
    return fail(409, 'slug_taken', 'Đường dẫn này đã có bài khác dùng.', 'Another post already uses this slug.');
  }
}

export async function onRequestDelete({ params, env, data, waitUntil }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const id = idOf(params);
  if (!id) return notFound();
  const old = await env.DB.prepare('SELECT slug, status FROM posts WHERE id = ?').bind(id).first();
  const res = await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  if (res.meta.changes && old?.status === 'published') notifyIndexNow({ env, waitUntil }, [postPath(old.slug), '/']);
  return res.meta.changes ? json({ ok: true }) : notFound();
}
