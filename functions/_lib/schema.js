// Tự nâng cấp cơ sở dữ liệu cũ: thêm cột còn thiếu vào bảng đã có.
// db/schema.sql chỉ tạo bảng mới (CREATE TABLE IF NOT EXISTS), không thêm cột vào bảng cũ, nên chủ trang
// không phải vào Console chạy ALTER TABLE mỗi lần có cột mới. Mỗi bản chạy của máy chủ kiểm tra một lần.

// Mỗi mục: bảng, cột, và câu lệnh thêm cột (khớp với db/schema.sql).
const COLUMNS = [
  { table: 'posts', column: 'city', ddl: "ALTER TABLE posts ADD COLUMN city TEXT NOT NULL DEFAULT ''" },
  { table: 'users', column: 'last_seen_at', ddl: 'ALTER TABLE users ADD COLUMN last_seen_at INTEGER' },
];

// Bảng được thêm sau khi trang đã chạy thật (chưa có trong lần cài đầu của một số trang đang chạy):
// tạo bằng CREATE TABLE/INDEX IF NOT EXISTS nên chạy lại vô hại, và chủ trang không phải tự vào D1
// Console chạy tay (khớp với db/schema.sql, nơi bảng mới luôn có từ đầu).
const TABLES = [
  // Bảng cũ: mỗi lượt xem một dòng. Không ghi vào nữa (xem _lib/stats.js) nhưng vẫn tạo để bản cũ
  // còn chạy được và để cleanup() chuyển dữ liệu cũ sang stats_daily đúng một lần.
  `CREATE TABLE IF NOT EXISTS page_views (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    path       TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id)',
  // Lượt xem gộp theo ngày: mỗi ngày đúng một dòng, nhờ vậy bảng nhỏ mãi (400 ngày ≈ 400 dòng) dù
  // trang có hàng triệu lượt mỗi ngày. day = số nguyên, tính bằng Math.floor(giây / 86400).
  `CREATE TABLE IF NOT EXISTS stats_daily (
    day      INTEGER PRIMARY KEY,
    views    INTEGER NOT NULL DEFAULT 0,
    visitors INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
];

let ready = null;

export function resetSchemaCheck() { ready = null; } // dùng trong kiểm thử

export function ensureSchema(env) {
  if (!ready) {
    ready = (async () => {
      for (const ddl of TABLES) {
        try { await env.DB.prepare(ddl).run(); } catch { /* đã có, hoặc một bản chạy khác vừa tạo xong */ }
      }
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
