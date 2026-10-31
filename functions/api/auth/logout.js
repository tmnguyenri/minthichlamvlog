import { destroySession, sessionCookies, withCookies } from '../../_lib/auth.js';
import { json } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  await destroySession(request, env);
  return withCookies(json({ ok: true }), sessionCookies(request, ''));
}
