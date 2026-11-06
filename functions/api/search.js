// Tìm bài viết: gõ từ khoá, tìm trong tiêu đề, tóm tắt, địa điểm và toàn bộ nội dung của các bài đã đăng.
// Công khai nhưng chỉ trả bài đã xuất bản — bài nháp không bao giờ lọt vào danh sách tìm thấy.
import { json, memoize } from '../_lib/http.js';

const INDEX_SECONDS = 60;   // giữ bản rút gọn của các bài trong bộ nhớ isolate, khỏi đọc lại mỗi lần gõ
const MAX_RESULTS = 8;
const MAX_QUERY = 80;
const MAX_TERMS = 6;

// Bỏ dấu và đưa về chữ thường để gõ "da lat" vẫn khớp "Đà Lạt". Mỗi ký tự gốc đổi thành đúng một ký tự
// (NFD tách dấu rồi xoá dấu, đ→d, cuối cùng là toLowerCase), nên vị trí tìm thấy trong bản đã bỏ dấu
// dùng được luôn để cắt đoạn trích từ bản gốc mà không lệch chữ.
function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .toLowerCase();
}

// Nội dung bài là Markdown rút gọn: bỏ cú pháp, giữ lại chữ, để đoạn trích đọc như câu văn bình thường.
function plain(md) {
  return String(md ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)\s]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)\s]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*]\s+/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Một lượt đọc cho cả bộ bài đã đăng, kèm các bản đã bỏ dấu để so khớp không phân biệt hoa/thường, có dấu hay không.
async function loadIndex(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, slug, title, title_en, excerpt, excerpt_en, body, body_en, country, city, trip_date, cover, published_at,
       (SELECT i.id FROM images i WHERE i.post_id = posts.id ORDER BY i.id LIMIT 1) AS image_id
       FROM posts WHERE status = 'published'`,
  ).all();
  return (results || []).map((p) => {
    const bodyVi = plain(p.body);
    const bodyEn = plain(p.body_en);
    return {
      p,
      bodyVi,
      bodyEn,
      bodyViFolded: fold(bodyVi),
      bodyEnFolded: fold(bodyEn),
      title: fold(`${p.title} ${p.title_en || ''}`),
      place: fold(`${p.city || ''} ${p.country || ''}`),
      lead: fold(`${p.excerpt || ''} ${p.excerpt_en || ''}`),
      body: fold(`${bodyVi} ${bodyEn}`),
    };
  });
}

// Cắt một đoạn quanh chỗ khớp đầu tiên để người đọc thấy ngay vì sao bài này được tìm thấy.
function excerptAround(text, folded, term) {
  const at = term ? folded.indexOf(term) : -1;
  if (at < 0 || !text) return '';
  let start = Math.max(0, at - 70);
  let end = Math.min(text.length, at + term.length + 110);
  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space > -1 && space < at) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > at + term.length) end = space;
  }
  const cut = text.slice(start, end).trim();
  return (start > 0 ? '…' : '') + cut + (end < text.length ? '…' : '');
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY);
  const folded = fold(query);
  const headers = { 'cache-control': 'public, max-age=30' };
  // Một hai ký tự thì gần như bài nào cũng khớp; để giao diện tự báo cần gõ thêm.
  if (folded.length < 2) return json({ query, results: [] }, 200, headers);
  const terms = [...new Set(folded.split(' ').filter(Boolean))].slice(0, MAX_TERMS);

  const index = await memoize('search-index', INDEX_SECONDS, () => loadIndex(env));
  const hits = [];
  for (const row of index) {
    // Đủ mọi từ khoá mới tính là khớp (gõ "da lat mua" thì bài phải có cả ba).
    if (!terms.every((t) => `${row.title} ${row.place} ${row.lead} ${row.body}`.includes(t))) continue;
    let score = 0;
    for (const t of terms) {
      if (row.title.includes(t)) score += 6;
      else if (row.place.includes(t)) score += 3;
      else if (row.lead.includes(t)) score += 2;
      else score += 1;
    }
    const bodyHit = terms.find((t) => row.body.includes(t));
    let snippet = '';
    if (bodyHit) {
      const inVi = row.bodyViFolded.includes(bodyHit);
      const text = inVi ? row.bodyVi : row.bodyEn;
      snippet = excerptAround(text, fold(text), bodyHit);
    }
    if (!snippet) snippet = row.p.excerpt || row.p.excerpt_en || '';
    const p = row.p;
    hits.push({
      score,
      at: Number(p.published_at || 0),
      item: {
        slug: p.slug,
        title: p.title,
        title_en: p.title_en || '',
        excerpt: p.excerpt || '',
        excerpt_en: p.excerpt_en || '',
        snippet: snippet.slice(0, 240),
        country: p.country || '',
        city: p.city || '',
        trip_date: p.trip_date || '',
        image_id: p.image_id || null,
        cover: p.cover || '',
      },
    });
  }
  hits.sort((a, b) => b.score - a.score || b.at - a.at);
  return json({ query, results: hits.slice(0, MAX_RESULTS).map((h) => h.item) }, 200, headers);
}
