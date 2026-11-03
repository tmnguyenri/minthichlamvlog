// Trang một bài viết bằng tiếng Việt: /bai/<tên>. Phần dựng trang dùng chung nằm trong _lib/post-page.js.
import { renderPost } from '../_lib/post-page.js';

export const onRequestGet = (context) => renderPost({ ...context, lang: 'vi' });
