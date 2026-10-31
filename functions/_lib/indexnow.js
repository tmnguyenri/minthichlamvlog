// IndexNow: báo cho Bing, Yandex, Naver, Seznam, Yep... biết ngay khi có bài mới hoặc bài vừa sửa.
// Khóa là một chuỗi ngẫu nhiên công khai, đặt trong biến INDEXNOW_KEY (wrangler.jsonc) và có tệp site/<khóa>.txt
// chứa đúng chuỗi đó. Không có biến này thì không làm gì (ví dụ khi chạy thử trên máy).
import { siteUrl } from './site.js';

export function notifyIndexNow({ env, waitUntil }, paths) {
  const key = env?.INDEXNOW_KEY;
  if (!key || !/^[a-f0-9]{32}$/.test(key) || !paths.length) return;
  const base = siteUrl(env);
  const job = fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(base).host, key, keyLocation: `${base}/${key}.txt`, urlList: paths.map((p) => base + p) }),
  }).catch(() => {});
  if (typeof waitUntil === 'function') waitUntil(job);
}
