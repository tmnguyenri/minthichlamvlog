// TẠM THỜI: đo xem PBKDF2 có vượt giới hạn CPU của gói miễn phí không. Sẽ xóa ngay sau khi đo.
export async function onRequestGet({ request }) {
  const iter = Math.min(100000, Math.max(10000, Number(new URL(request.url).searchParams.get('iter')) || 100000));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('thu-nghiem-cpu'), 'PBKDF2', false, ['deriveBits']);
  await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(16), iterations: iter }, key, 256);
  return new Response(JSON.stringify({ ok: true, iter }), { headers: { 'content-type': 'application/json' } });
}
