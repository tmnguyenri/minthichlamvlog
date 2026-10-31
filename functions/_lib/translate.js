// Tự dịch bài viết tiếng Việt sang tiếng Anh bằng Workers AI (mô hình m2m100) khi phần tiếng Anh còn trống.
// Nếu chưa bật binding AI, hoặc dịch lỗi, bài vẫn được lưu bình thường và phần tiếng Anh để trống.

const MODEL = '@cf/meta/m2m100-1.2b';
const MAX_CALLS = 60;          // giới hạn số lần gọi mô hình cho mỗi lần lưu
const MAX_CHARS = 1500;        // độ dài tối đa của mỗi lần gửi đi

const IMAGE_LINE = /^!\[[^\]]*\]\([^)]*\)$/;
const PREFIX = /^(#{1,6}\s+|>\s?|[-*]\s+|\d+\.\s+)/;

async function translateOne(env, text) {
  const clean = String(text || '').trim();
  if (!clean) return '';
  const out = await env.AI.run(MODEL, { text: clean, source_lang: 'vi', target_lang: 'en' });
  return String((out && out.translated_text) || '').trim();
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
