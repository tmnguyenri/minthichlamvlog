// Tự nâng cấp cơ sở dữ liệu cũ: thêm cột còn thiếu vào bảng đã có.
// db/schema.sql chỉ tạo bảng mới (CREATE TABLE IF NOT EXISTS), không thêm cột vào bảng cũ, nên chủ trang
// không phải vào Console chạy ALTER TABLE mỗi lần có cột mới. Mỗi bản chạy của máy chủ kiểm tra một lần.

// Mỗi mục: bảng, cột, và câu lệnh thêm cột (khớp với db/schema.sql).
const COLUMNS = [
  { table: 'posts', column: 'city', ddl: "ALTER TABLE posts ADD COLUMN city TEXT NOT NULL DEFAULT ''" },
];

let ready = null;

export function resetSchemaCheck() { ready = null; } // dùng trong kiểm thử

export function ensureSchema(env) {
  if (!ready) {
    ready = (async () => {
      for (const { table, column, ddl } of COLUMNS) {
        const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
        if (!results.length) continue; // bảng chưa có: để db/schema.sql tạo
        if (results.some((c) => c.name === column)) continue;
        try { await env.DB.prepare(ddl).run(); } catch { /* một bản chạy khác vừa thêm xong */ }
      }
    })().catch(() => { ready = null; }); // lỗi tạm thời: lần yêu cầu sau thử lại, không làm hỏng trang
  }
  return ready;
}
