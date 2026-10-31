import { allow, now, requireUser } from '../../_lib/auth.js';
import { badRequest, fail, json, readJson } from '../../_lib/http.js';

export async function onRequestPost({ request, env, data }) {
  const denied = requireUser(data);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return badRequest();
  const postId = Number(body.post_id);
  const text = String(body.body ?? '').replace(/\r\n?/g, '\n').trim();
  if (!Number.isInteger(postId) || postId < 1) return badRequest();
  if (text.length < 1 || text.length > 1000) return fail(400, 'length', 'Bình luận cần từ 1 đến 1000 ký tự.', 'A comment must be 1 to 1000 characters.');
  if (!(await allow(env, `comment:user:${data.user.id}`, 10, 600))) {
    return fail(429, 'rate_limited', 'Bạn bình luận hơi nhanh, hãy thử lại sau ít phút.', 'You are commenting quickly. Please try again in a few minutes.');
  }
  const post = await env.DB.prepare("SELECT id FROM posts WHERE id = ? AND status = 'published'").bind(postId).first();
  if (!post) return fail(404, 'not_found', 'Không tìm thấy bài viết.', 'Post not found.');
  await env.DB.prepare('INSERT INTO comments (post_id, user_id, body, created_at) VALUES (?, ?, ?, ?)')
    .bind(postId, data.user.id, text, now()).run();
  return json({ ok: true }, 201);
}
