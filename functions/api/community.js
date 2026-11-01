// Góc cộng đồng ở trang chủ: ai đang online, và 5 thành viên hoạt động nhiều nhất.
// Khác với /api/admin/stats, đây là điểm công khai cho mọi khách — chỉ trả tên hiển thị
// (và số bài/bình luận cho danh sách hoạt động nhiều nhất), không email, không vai trò, không id.
import { json } from '../_lib/http.js';
import { onlineMembers, topActiveMembers } from '../_lib/stats.js';

export async function onRequestGet({ env }) {
  const [online, topActive] = await Promise.all([onlineMembers(env), topActiveMembers(env, 5)]);
  return json({
    online: online.map((u) => ({ display_name: u.display_name })),
    top_active: topActive.map((u) => ({ display_name: u.display_name, posts: u.posts, comments: u.comments })),
  });
}
