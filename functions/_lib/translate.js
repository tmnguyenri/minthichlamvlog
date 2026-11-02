// Tự dịch bài viết tiếng Việt sang tiếng Anh bằng Workers AI khi phần tiếng Anh còn trống.
// Nếu chưa bật binding AI, hoặc dịch lỗi, bài vẫn được lưu bình thường và phần tiếng Anh để trống.
//
// Dùng một mô hình tạo sinh (GLM-4.7-Flash) thay cho mô hình dịch chuyên dụng m2m100 trước đây:
// m2m100 dịch đúng nghĩa nhưng khá cứng, dễ mất giọng văn cá nhân/hài hước của blog du lịch.
// Một mô hình tạo sinh được nhắc (prompt) đúng cách sẽ dịch tự nhiên hơn và giữ được giọng văn
// hơn, bù lại tốn chi phí/thời gian hơn một chút cho mỗi lần gọi.

export const MODEL = '@cf/zai-org/glm-4.7-flash';
const MAX_CALLS = 60;          // giới hạn số lần gọi mô hình cho mỗi lần lưu
export const MAX_CHARS = 4000; // mô hình tạo sinh xử lý đoạn dài tốt hơn m2m100 nên ít phải tách nhỏ hơn

const IMAGE_LINE = /^!\[[^\]]*\]\([^)]*\)$/;
const PREFIX = /^(#{1,6}\s+|>\s?|[-*]\s+|\d+\.\s+)/;

// Nhắc mô hình dịch như một người viết blog du lịch, không như một cái máy dịch từng từ.
const SYSTEM_PROMPT = [
  'You translate short passages from a personal Vietnamese travel blog into English.',
  'Translate naturally and fluently, the way a native English speaker would write it, keeping the',
  "writer's own voice: warm, personal, a little playful, written for friends and family following",
  'along on a trip — not a stiff, literal, word-for-word translation.',
  'Keep Vietnamese place, dish and proper names as they are commonly written in English (for example',
  'Hoi An, Da Nang, Hanoi); if there is no common English form, keep the Vietnamese spelling with its',
  'diacritics rather than inventing one.',
  'Preserve any Markdown syntax, links or inline code in the text exactly as given; translate only the',
  'surrounding prose.',
  'Reply with the English translation only — no notes, no quotation marks around it, no preamble.',
].join(' ');

async function translateOne(env, text) {
  const clean = String(text || '').trim();
  if (!clean) return '';
  const out = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: clean },
    ],
    max_tokens: 2048,   // đủ rộng để không bị cắt cụt bản dịch của một đoạn dài tới MAX_CHARS
    temperature: 0.3,   // dịch cần sát nghĩa, không cần sáng tạo nhiều như văn tự do
  });
  return String((out && out.response) || '').trim();
}

// Tách đoạn dài thành các câu ghép lại dưới MAX_CHARS, để không bị cắt giữa chừng.
export function chunkText(text, max = MAX_CHARS) {
  const clean = String(text).trim();
  if (clean.length <= max) return [clean];
  const sentences = clean.split(/(?<=[.!?…])\s+/);
  const out = [];
  let cur = '';
  for (const s of sentences) {
    if (s.length > max) {
      if (cur) { out.push(cur); cur = ''; }
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
      continue;
    }
    if ((cur + ' ' + s).trim().length > max) { out.push(cur); cur = s; } else { cur = (cur + ' ' + s).trim(); }
  }
  if (cur) out.push(cur);
  return out;
}

// Dịch một chuỗi (có thể dài); trả về '' nếu không có AI, hết hạn mức gọi, hoặc lỗi.
export async function translateText(env, text, budget = { calls: MAX_CALLS }) {
  if (!env || !env.AI || !text || !String(text).trim()) return '';
  const parts = [];
  for (const piece of chunkText(text)) {
    if (budget.calls <= 0) break;
    budget.calls -= 1;
    try {
      parts.push(await translateOne(env, piece));
    } catch {
      break;
    }
  }
  return parts.join(' ').trim();
}

// Dịch nội dung Markdown: giữ nguyên ảnh, xuống dòng và ký hiệu đầu dòng (##, >, -, 1.).
export async function translateMarkdown(env, md) {
  if (!env || !env.AI || !md || !String(md).trim()) return '';
  const budget = { calls: MAX_CALLS };
  const blocks = String(md).split(/\n{2,}/);
  const out = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const translated = [];
    for (const line of lines) {
      if (!line.trim() || IMAGE_LINE.test(line.trim())) { translated.push(line); continue; }
      const m = PREFIX.exec(line);
      const prefix = m ? m[0] : '';
      const rest = line.slice(prefix.length);
      translated.push(prefix + (await translateText(env, rest, budget)));
    }
    out.push(translated.join('\n'));
  }
  return out.join('\n\n');
}

// Điền các trường tiếng Anh còn trống của một bài (không ghi đè phần đã có).
export async function fillEnglish(env, p) {
  if (!env || !env.AI) return p;
  const budget = { calls: MAX_CALLS };
  if (!p.title_en && p.title) p.title_en = await translateText(env, p.title, budget);
  if (!p.excerpt_en && p.excerpt) p.excerpt_en = await translateText(env, p.excerpt, budget);
  if (!p.body_en && p.body) p.body_en = await translateMarkdown(env, p.body);
  return p;
}
