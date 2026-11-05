// Trang một bài viết bằng tiếng Anh: /en/bai/<tên>. Chỉ có khi bài đã có bản dịch (không thì chuyển về bản tiếng Việt).
import { renderPost } from '../../_lib/post-page.js';

export const onRequestGet = (context) => renderPost({ ...context, lang: 'en' });
