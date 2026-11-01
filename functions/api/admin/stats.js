// Số liệu cho tab Thống kê trong khu quản lý: chỉ chủ trang xem được.
import { requireAdmin, now } from '../../_lib/auth.js';
import { json } from '../../_lib/http.js';

const ONLINE_SECONDS = 5 * 60; // coi là "đang online" nếu có hoạt động trong 5 phút gần nhất
const DAY = 86400;

export async function onRequestGet({ env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;

  const t = now();
  const todayStart = t - (t % DAY);
  const onlineSince = t - ONLINE_SECONDS;

  const [members, online, topActive, posts, comments, images, visitsTotal, visitsToday, uniqueTotal, uniqueToday] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
              COALESCE(SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END), 0) AS blocked
         FROM users`,
    ).first(),
    env.DB.prepare(
      `SELECT id, display_name, role, last_seen_at FROM users
        WHERE status = 'approved' AND last_seen_at >= ?
        ORDER BY last_seen_at DESC LIMIT 50`,
    ).bind(onlineSince).all(),
    env.DB.prepare(
      `SELECT u.id, u.display_name,
              (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts,
              (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comments
         FROM users u WHERE u.status != 'blocked'
        ORDER BY (posts + comments) DESC, u.created_at ASC LIMIT 5`,
    ).all(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published,
              COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS draft
         FROM posts`,
    ).first(),
    env.DB.prepare('SELECT COUNT(*) AS total FROM comments').first(),
    env.DB.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(size), 0) AS bytes FROM images').first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM page_views').first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM page_views WHERE created_at >= ?').bind(todayStart).first(),
    env.DB.prepare('SELECT COUNT(DISTINCT visitor_id) AS n FROM page_views').first(),
    env.DB.prepare('SELECT COUNT(DISTINCT visitor_id) AS n FROM page_views WHERE created_at >= ?').bind(todayStart).first(),
  ]);

  return json({
    members: { total: members.total, approved: members.approved, pending: members.pending, blocked: members.blocked },
    online: { count: online.results.length, users: online.results },
    top_active: (topActive.results || []).filter((u) => u.posts + u.comments > 0),
    posts: { total: posts.total, published: posts.published, draft: posts.draft },
    comments: { total: comments.total },
    images: { total: images.total, bytes: images.bytes },
    visits: { total: visitsTotal.n, today: visitsToday.n, unique_total: uniqueTotal.n, unique_today: uniqueToday.n },
  });
}
