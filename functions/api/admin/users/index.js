import { requireAdmin } from '../../../_lib/auth.js';
import { json } from '../../../_lib/http.js';

export async function onRequestGet({ env, data }) {
  const denied = requireAdmin(data);
  if (denied) return denied;
  const { results } = await env.DB.prepare(
    `SELECT id, email, display_name, role, status, created_at FROM users
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC`,
  ).all();
  return json({ users: results });
}
