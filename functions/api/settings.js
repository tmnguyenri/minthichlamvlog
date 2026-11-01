// Thiết lập trang chủ (hiện chỉ có ba ảnh ở đầu trang, xem _lib/settings.js). Khách xem được —
// trang chủ cần đọc giá trị này để biết hiện ảnh nào — chỉ chủ trang sửa được.
import { requireAdmin, now } from '../_lib/auth.js';
import { fail, json, readJson } from '../_lib/http.js';
import { URL_OK } from '../_lib/validate.js';
import { HERO_PHOTO_KEYS, readSettings } from '../_lib/settings.js';

export async function onRequestGet({ env }) {
  const settings = await readSettings(env, HERO_PHOTO_KEYS);
  return json({ settings });
}

export async function onRequestPut({ request, env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return fail(400, 'bad_request', 'Yêu cầu không hợp lệ.', 'Invalid request.');

  const t = now();
  const stmts = [];
  for (const key of HERO_PHOTO_KEYS) {
    if (!(key in body)) continue;
    const value = String(body[key] ?? '').trim().slice(0, 500);
    if (!value) {
      // Trống = quay lại ảnh mặc định có sẵn trong HTML.
      stmts.push(env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(key));
      continue;
    }
    if (!URL_OK.test(value)) {
      return fail(400, 'bad_value', 'Ảnh phải là liên kết https hoặc đường dẫn bắt đầu bằng /.', 'The image must be an https link or a path starting with /.');
    }
    stmts.push(env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(key, value, t));
  }
  if (stmts.length) await env.DB.batch(stmts);

  const settings = await readSettings(env, HERO_PHOTO_KEYS);
  return json({ ok: true, settings });
}
