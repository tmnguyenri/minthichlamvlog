import { json } from '../../_lib/http.js';

export async function onRequestGet({ data }) {
  const u = data.user;
  return json({ user: u ? { id: u.id, name: u.display_name, role: u.role } : null });
}
