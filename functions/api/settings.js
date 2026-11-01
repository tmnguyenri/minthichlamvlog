// Thiết lập trang chủ và trang giới thiệu (xem _lib/settings.js: HERO_PHOTO_KEYS, ABOUT_KEYS). Khách
// xem được — các trang cần đọc giá trị này để biết hiện nội dung nào — chỉ chủ trang sửa được.
import { requireAdmin, now } from '../_lib/auth.js';
import { fail, json, readJson } from '../_lib/http.js';
import { isEmail, text, URL_OK } from '../_lib/validate.js';
import { renderMarkdown } from '../_lib/md.js';
import { translateMarkdown } from '../_lib/translate.js';
import { ABOUT_BODY_MAX, ALL_SETTINGS_KEYS, IMAGE_SETTING_KEYS, readSettings } from '../_lib/settings.js';

function withRendered(settings) {
  const out = { settings };
  if (settings.about_body) out.about_body_html = renderMarkdown(settings.about_body);
  if (settings.about_body_en) out.about_body_en_html = renderMarkdown(settings.about_body_en);
  return out;
}

export async function onRequestGet({ env }) {
  return json(withRendered(await readSettings(env, ALL_SETTINGS_KEYS)));
}

export async function onRequestPut({ request, env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return fail(400, 'bad_request', 'Yêu cầu không hợp lệ.', 'Invalid request.');

  const t = now();
  const stmts = [];
  const del = (key) => stmts.push(env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(key));
  const put = (key, value) => stmts.push(env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).bind(key, value, t));
  const badUrl = () => fail(400, 'bad_value', 'Liên kết phải là https:// hoặc đường dẫn bắt đầu bằng /.', 'The link must be an https link or a path starting with /.');

  // Ảnh (hero_photo_1..3, about_photo): đường dẫn https hoặc /đường-dẫn.
  for (const key of IMAGE_SETTING_KEYS) {
    if (!(key in body)) continue;
    const value = text(body[key], 500);
    if (!value) { del(key); continue; }
    if (!URL_OK.test(value)) return badUrl();
    put(key, value);
  }

  // Liên kết mạng xã hội: cũng chỉ nhận https hoặc /đường-dẫn.
  for (const key of ['about_youtube', 'about_instagram']) {
    if (!(key in body)) continue;
    const value = text(body[key], 500);
    if (!value) { del(key); continue; }
    if (!URL_OK.test(value)) return badUrl();
    put(key, value);
  }

  if ('about_email' in body) {
    const value = text(body.about_email, 254);
    if (!value) del('about_email');
    else if (!isEmail(value)) return fail(400, 'bad_value', 'Email không hợp lệ.', 'Invalid email address.');
    else put('about_email', value);
  }

  // Giới thiệu bản thân: Markdown rút gọn, tự dịch sang tiếng Anh khi tiếng Việt đổi — giống hệt
  // cách bài viết xử lý bản tiếng Anh (xem _lib/translate.js).
  if ('about_body' in body) {
    const vi = text(body.about_body, ABOUT_BODY_MAX);
    if (!vi) {
      del('about_body');
      del('about_body_en');
    } else {
      const old = await readSettings(env, ['about_body', 'about_body_en']);
      let en = 'about_body_en' in body ? text(body.about_body_en, ABOUT_BODY_MAX) : '';
      if (!en) en = vi === old.about_body ? (old.about_body_en || '') : await translateMarkdown(env, vi);
      put('about_body', vi);
      if (en) put('about_body_en', en); else del('about_body_en');
    }
  }

  if (stmts.length) await env.DB.batch(stmts);

  return json({ ok: true, ...withRendered(await readSettings(env, ALL_SETTINGS_KEYS)) });
}
