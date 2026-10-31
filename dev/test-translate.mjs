// Kiểm thử tự dịch bài viết: chạy bằng  node --no-warnings dev/test-translate.mjs
// Dùng một AI giả lập để kiểm tra logic, không gọi Workers AI thật.
import { translateMarkdown, translateText, fillEnglish, chunkText } from '../functions/_lib/translate.js';

let pass = 0; const failures = [];
function ok(cond, name, extra = '') { if (cond) pass++; else { failures.push(name); console.log('  FAIL', name, extra); } }

const calls = [];
const fakeAI = { run: async (model, { text, source_lang, target_lang }) => {
  calls.push({ model, text, source_lang, target_lang });
  return { translated_text: `[EN ${text}]` };
} };
const noAI = {};

console.log('1. Không có AI');
ok((await translateText(noAI, 'Xin chào')) === '', 'không có binding AI thì trả về chuỗi rỗng');
const pNo = await fillEnglish(noAI, { title: 'Tiêu đề', body: 'Nội dung' });
ok(pNo.title_en === undefined && pNo.body_en === undefined, 'không có AI thì không điền gì');

console.log('2. Dịch tiêu đề và tóm tắt');
const p1 = await fillEnglish({ AI: fakeAI }, { title: 'Hà Giang', title_en: '', excerpt: 'Đèo Mã Pí Lèng', excerpt_en: '' , body: '', body_en: '' });
ok(p1.title_en === '[EN Hà Giang]', 'tiêu đề được dịch', p1.title_en);
ok(p1.excerpt_en === '[EN Đèo Mã Pí Lèng]', 'tóm tắt được dịch', p1.excerpt_en);
ok(calls.every((c) => c.model === '@cf/meta/m2m100-1.2b' && c.source_lang === 'vi' && c.target_lang === 'en'), 'dùng đúng mô hình và chiều vi -> en');

console.log('3. Không ghi đè bản tiếng Anh đã có');
calls.length = 0;
const p2 = await fillEnglish({ AI: fakeAI }, { title: 'Hà Giang', title_en: 'Ha Giang by hand', body: 'Đoạn một', body_en: 'Written by hand' });
ok(p2.title_en === 'Ha Giang by hand' && p2.body_en === 'Written by hand', 'bản tiếng Anh tự viết được giữ nguyên');
ok(calls.length === 0, 'không gọi AI khi đã có bản tiếng Anh');

console.log('4. Markdown: giữ ảnh, tiêu đề, trích dẫn và danh sách');
const md = [
  '## Buổi sáng',
  '',
  'Sương phủ kín đồi chè.',
  '',
  '![Đồi chè](/api/images/7)',
  '',
  '> Một câu trích dẫn',
  '',
  '- Món đầu tiên',
  '1. Bước một',
].join('\n');
const out = await translateMarkdown({ AI: fakeAI }, md);
const blocks = out.split('\n\n');
ok(blocks[0] === '## [EN Buổi sáng]', 'tiêu đề giữ dấu ##', blocks[0]);
ok(blocks[1] === '[EN Sương phủ kín đồi chè.]', 'đoạn văn được dịch', blocks[1]);
ok(blocks[2] === '![Đồi chè](/api/images/7)', 'dòng ảnh được giữ nguyên', blocks[2]);
ok(blocks[3] === '> [EN Một câu trích dẫn]', 'trích dẫn giữ dấu >', blocks[3]);
ok(blocks[4] === '- [EN Món đầu tiên]\n1. [EN Bước một]', 'danh sách giữ dấu - và số thứ tự', blocks[4]);
ok(!calls.some((c) => c.text.includes('/api/images')), 'không gửi đường dẫn ảnh đi dịch');

console.log('5. Đoạn dài và giới hạn số lần gọi');
const long = Array.from({ length: 40 }, (_, i) => `Câu số ${i} của một đoạn khá dài để kiểm tra việc tách.`).join(' ');
const pieces = chunkText(long);
ok(pieces.length > 1 && pieces.every((x) => x.length <= 1500), 'đoạn dài được tách dưới 1500 ký tự', String(pieces.length));
ok(pieces.join(' ').replace(/\s+/g, ' ').trim() === long.replace(/\s+/g, ' ').trim(), 'tách đoạn không làm mất chữ');
const manyLines = Array.from({ length: 200 }, (_, i) => `Dòng ${i}`).join('\n\n');
calls.length = 0;
await translateMarkdown({ AI: fakeAI }, manyLines);
ok(calls.length <= 60, 'không gọi mô hình quá 60 lần cho một bài', String(calls.length));

console.log('6. Lỗi từ AI không làm hỏng việc lưu');
const brokenAI = { run: async () => { throw new Error('quota'); } };
const p3 = await fillEnglish({ AI: brokenAI }, { title: 'Tiêu đề', body: 'Nội dung' });
ok(p3.title_en === '' && p3.body_en === '', 'lỗi AI thì để trống, không ném lỗi', JSON.stringify(p3));

console.log(`\n${pass} kiểm tra đạt, ${failures.length} lỗi.`);
process.exit(failures.length ? 1 : 0);
