// Góc cộng đồng ở trang chủ: ai đang online, 5 thành viên hoạt động nhiều nhất, và tổng lượt xem trang.
// Khác với /api/admin/stats, đây là điểm công khai cho mọi khách — chỉ trả tên hiển thị
// (và số bài/bình luận cho danh sách hoạt động nhiều nhất) cùng một con số tổng lượt xem không gắn với
// ai cả, không email, không vai trò, không id.
import { json } from '../_lib/http.js';
import { onlineMembers, topActiveMembers } from '../_lib/stats.js';

export async function onRequestGet({ env }) {
  const [online, topActive, views] = await Promise.all([
    onlineMembers(env),
    topActiveMembers(env, 5),
    env.DB.prepare('SELECT COUNT(*) AS n FROM page_views').first(),
  ]);
  return json({
    online: online.map((u) => ({ display_name: u.display_name })),
    top_active: topActive.map((u) => ({ display_name: u.display_name, posts: u.posts, comments: u.comments })),
    views_total: views.n,
  });
}
