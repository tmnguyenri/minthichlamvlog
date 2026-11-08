// Số liệu cho tab Thống kê trong khu quản lý: chỉ chủ trang xem được.
import { requireAdmin, now } from '../../_lib/auth.js';
import { json } from '../../_lib/http.js';
import { onlineMembers, topActiveMembers } from '../../_lib/stats.js';

const DAY = 86400;

export async function onRequestGet({ env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;

  const t = now();
  const today = Math.floor(t / DAY);   // khớp với cột day của stats_daily

  const [members, online, topActive, posts, comments, images, views] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
              COALESCE(SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END), 0) AS blocked
         FROM users`,
    ).first(),
    onlineMembers(env),
    topActiveMembers(env, 5),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published,
              COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS draft
         FROM posts`,
    ).first(),
    env.DB.prepare('SELECT COUNT(*) AS total FROM comments').first(),
    env.DB.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(size), 0) AS bytes FROM images').first(),
    // Một câu duy nhất trên bảng gộp theo ngày: tổng lượt xem, lượt xem hôm nay, khách hôm nay và
    // khách 30 ngày gần đây. Không quét bảng lớn nên gọi bao nhiêu lần cũng rẻ.
    env.DB.prepare(
      `SELECT COALESCE(SUM(views), 0) AS total,
              COALESCE(SUM(CASE WHEN day = ?1 THEN views ELSE 0 END), 0) AS today,
              COALESCE(SUM(CASE WHEN day = ?1 THEN visitors ELSE 0 END), 0) AS visitors_today,
              COALESCE(SUM(CASE WHEN day > ?2 THEN visitors ELSE 0 END), 0) AS visitors_30d
         FROM stats_daily`,
    ).bind(today, today - 30).first(),
  ]);

  return json({
    members: { total: members.total, approved: members.approved, pending: members.pending, blocked: members.blocked },
    online: { count: online.length, users: online },
    top_active: topActive,
    posts: { total: posts.total, published: posts.published, draft: posts.draft },
    comments: { total: comments.total },
    images: { total: images.total, bytes: images.bytes },
    // unique_total giờ là số khách trong 30 ngày (tổng khách theo từng ngày), không phải số người khác
    // nhau từ trước tới nay — không thể tính con số đó mà không quét bảng khổng lồ.
    visits: { total: views.total, today: views.today, unique_total: views.visitors_30d, unique_today: views.visitors_today },
  });
}
