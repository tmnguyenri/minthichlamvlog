// Bộ định dạng Markdown rút gọn, an toàn: mọi chữ đều được escape trước, chỉ thêm vài thẻ do chính mình tạo.
import { esc } from './http.js';
import { URL_OK } from './validate.js';

// Địa chỉ đã escape nên không còn dấu " ' < >. Chỉ nhận https:// và đường dẫn bắt đầu bằng một dấu /.
const okUrl = (u) => URL_OK.test(u) || /^http:\/\/[^\s"'<>]+$/.test(u);

function inline(escaped) {
  let s = escaped.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) =>
    okUrl(url) ? `<a href="${url}" rel="noopener noreferrer" target="_blank">${label}</a>` : label);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s;
}

export function renderMarkdown(src) {
  const out = [];
  for (const raw of String(src ?? '').replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    const b = raw.trim();
    if (!b) continue;
    const lines = b.split('\n');
    let m;
    if (lines.length === 1 && (m = /^(#{2,3})\s+(.+)$/.exec(b))) {
      const n = m[1].length;
      out.push(`<h${n}>${inline(esc(m[2]))}</h${n}>`);
    } else if (lines.length === 1 && (m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(b)) && /^(?:https:\/\/|\/(?!\/))/.test(m[2]) && URL_OK.test(m[2])) {
      out.push(`<figure class="photo"><img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy"></figure>`);
    } else if (lines.every((l) => /^>\s?/.test(l))) {
      out.push(`<blockquote><p>${inline(esc(lines.map((l) => l.replace(/^>\s?/, '')).join('\n'))).replace(/\n/g, '<br>')}</p></blockquote>`);
    } else if (lines.every((l) => /^[-*]\s+/.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inline(esc(l.replace(/^[-*]\s+/, '')))}</li>`).join('')}</ul>`);
    } else {
      out.push(`<p>${inline(esc(b)).replace(/\n/g, '<br>')}</p>`);
    }
  }
  return out.join('\n');
}

// Bình luận chỉ là chữ thuần: escape, giữ xuống dòng.
export function renderPlain(src) {
  return esc(String(src ?? '').trim()).replace(/\n/g, '<br>');
}
