// Góc cộng đồng ở trang chủ: ai đang online, 5 thành viên hoạt động nhiều nhất, và tổng lượt xem trang.
// Khác với /api/admin/stats, đây là điểm công khai cho mọi khách — chỉ trả tên hiển thị
// (và số bài/bình luận cho danh sách hoạt động nhiều nhất) cùng một con số tổng lượt xem không gắn với
// ai cả, không email, không vai trò, không id.
import { json, memoize } from '../_lib/http.js';
import { onlineMembers, topActiveMembers } from '../_lib/stats.js';

// Ba truy vấn cho mỗi lần gọi là quá đắt cho một điểm công khai: giữ kết quả 60 giây, vừa trong bộ
// nhớ isolate vừa ở trình duyệt. Tổng lượt xem đọc từ stats_daily (mỗi ngày một dòng) nên luôn rẻ.
const CACHE_SECONDS = 60;

export async function onRequestGet({ env }) {
  const body = await memoize('community', CACHE_SECONDS, async () => {
    const [online, topActive, views] = await Promise.all([
      onlineMembers(env),
      topActiveMembers(env, 5),
      env.DB.prepare('SELECT COALESCE(SUM(views), 0) AS n FROM stats_daily').first(),
    ]);
    return {
      online: online.map((u) => ({ display_name: u.display_name })),
      top_active: topActive.map((u) => ({ display_name: u.display_name, posts: u.posts, comments: u.comments })),
      views_total: views.n,
    };
  });
  return json(body, 200, { 'cache-control': `public, max-age=${CACHE_SECONDS}` });
}
