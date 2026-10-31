// Giả lập cơ sở dữ liệu D1 của Cloudflare bằng SQLite thật của Node (chỉ để chạy thử trên máy).
import { DatabaseSync } from 'node:sqlite';

export function createD1(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  const statement = (sql, args = []) => ({
    bind: (...a) => statement(sql, a),
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args), success: true }; },
    async run() {
      const r = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  return {
    prepare: (sql) => statement(sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = []; for (const s of stmts) out.push(await s.run()); db.exec('COMMIT'); return out; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    exec: (sql) => db.exec(sql),
    raw: db,
  };
}
