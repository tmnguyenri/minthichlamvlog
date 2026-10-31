// Kiểm tra và làm sạch dữ liệu người dùng gửi lên.

export function slugify(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isEmail(s) {
  return typeof s === 'string' && s.length <= 254 && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(s);
}

export function cleanName(s) {
  const v = String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  // eslint-disable-next-line no-control-regex
  if (v.length < 2 || v.length > 40 || /[\u0000-\u001f<>]/.test(v)) return null;
  return v;
}

/** Nhận mã 11 ký tự hoặc liên kết YouTube, trả về mã video (hoặc '' nếu trống, null nếu sai). */
export function youtubeId(input) {
  const v = String(input ?? '').trim();
  if (!v) return '';
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  let u;
  try { u = new URL(v); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else { const m = /^\/(?:embed|shorts|live)\/([^/]+)/.exec(u.pathname); if (m) id = m[1]; }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export const URL_OK = /^(?:https:\/\/[^\s"'<>]+|\/(?!\/)[^\s"'<>]*)$/;

const text = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);

/** Trả về { value } hoặc { error: { code, vi, en } }. */
export function cleanPost(b) {
  const bad = (code, vi, en) => ({ error: { code, vi, en } });
  const title = text(b.title, 150);
  if (!title) return bad('title', 'Bài viết cần có tiêu đề.', 'The post needs a title.');
  const slug = text(b.slug, 80) || slugify(title);
  if (!SLUG_RE.test(slug)) return bad('slug', 'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang.', 'The slug may only contain lowercase letters, digits and hyphens.');
  const trip_date = text(b.trip_date, 7);
  if (trip_date && !/^\d{4}-(0[1-9]|1[0-2])$/.test(trip_date)) return bad('trip_date', 'Thời gian phải có dạng năm-tháng.', 'The date must be a year and month.');
  let days = null;
  if (b.days !== null && b.days !== undefined && b.days !== '') {
    days = Number(b.days);
    if (!Number.isInteger(days) || days < 1 || days > 3650) return bad('days', 'Số ngày không hợp lệ.', 'Invalid number of days.');
  }
  const cover = text(b.cover, 500);
  if (cover && !URL_OK.test(cover)) return bad('cover', 'Ảnh bìa phải là liên kết https hoặc đường dẫn bắt đầu bằng /.', 'The cover must be an https link or a path starting with /.');
  const video = youtubeId(b.video);
  if (video === null) return bad('video', 'Liên kết YouTube không hợp lệ.', 'Invalid YouTube link.');
  const status = b.status === 'published' ? 'published' : 'draft';
  return {
    value: {
      slug, title, title_en: text(b.title_en, 150), excerpt: text(b.excerpt, 400), excerpt_en: text(b.excerpt_en, 400),
      body: text(b.body, 60000), body_en: text(b.body_en, 60000),
      country: text(b.country, 60), trip_date, days, cover, video, status,
    },
  };
}
