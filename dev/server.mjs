// Chạy thử trang trên máy: phục vụ thư mục site/ và các hàm trong functions/ giống Cloudflare Pages.
//   node dev/server.mjs [cổng]      (mặc định 8788, cơ sở dữ liệu nằm trong bộ nhớ)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createD1 } from './d1.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };

export async function loadRoutes(dir = path.join(root, 'functions')) {
  const routes = [];
  let middleware = null;
  async function walk(d, prefix) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith('_')) await walk(full, `${prefix}/${e.name}`); continue; }
      if (!e.name.endsWith('.js')) continue;
      const mod = await import(pathToFileURL(full).href);
      if (e.name === '_middleware.js' && prefix === '') { middleware = mod.onRequest; continue; }
      if (e.name.startsWith('_')) continue;
      const base = e.name === 'index.js' ? '' : `/${e.name.slice(0, -3)}`;
      const pattern = (prefix + base).replace(/\[(\w+)\]/g, ':$1') || '/';
      const names = [];
      const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; })}/?$`);
      routes.push({ re, names, mod });
    }
  }
  await walk(dir, '');
  return { routes, middleware };
}

// Đọc khối "/*" trong site/_headers, giống cách Cloudflare Pages gắn tiêu đề cho tệp tĩnh.
function staticHeaders(staticDir) {
  const out = {};
  const f = path.join(staticDir, '_headers');
  if (!fs.existsSync(f)) return out;
  let on = false;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (/^\S/.test(line)) { on = line.trim() === '/*'; continue; }
    const m = on && /^\s+([\w-]+):\s*(.+)$/.exec(line);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

export async function createApp({ db, staticDir = path.join(root, 'site') } = {}) {
  const { routes, middleware } = await loadRoutes();
  const env = { DB: db };
  return async function handle(request) {
    const url = new URL(request.url);
    for (const r of routes) {
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      const params = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      const h = r.mod[`onRequest${request.method[0]}${request.method.slice(1).toLowerCase()}`] || r.mod.onRequest;
      if (!h) return new Response('Method Not Allowed', { status: 405 });
      const context = { request, env, params, data: {}, waitUntil: () => {}, next: null };
      context.next = async () => h(context);
      return middleware ? middleware(context) : h(context);
    }
    // tệp tĩnh, có đường dẫn gọn như Cloudflare Pages (/about -> about.html)
    let rel = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/index';
    const candidates = [rel, `${rel}.html`, `${rel}/index.html`].map((c) => path.join(staticDir, c));
    for (const f of candidates) {
      if (f.startsWith(staticDir) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        return new Response(fs.readFileSync(f), { headers: { ...staticHeaders(staticDir), 'content-type': MIME[path.extname(f)] || 'application/octet-stream' } });
      }
    }
    return new Response(fs.readFileSync(path.join(staticDir, '404.html')), { status: 404, headers: { ...staticHeaders(staticDir), 'content-type': MIME['.html'] } });
  };
}

export async function listen({ db, port = 0 } = {}) {
  const handle = await createApp({ db });
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
    });
    let response;
    try { response = await handle(request); } catch (e) { console.error(e); response = new Response('Lỗi máy chủ', { status: 500 }); }
    const headers = {};
    for (const [k, v] of response.headers) if (k !== 'set-cookie') headers[k] = v;
    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length) headers['set-cookie'] = cookies;
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = createD1();
  db.exec(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
  const { url } = await listen({ db, port: Number(process.argv[2]) || 8788 });
  console.log(`Chạy thử tại ${url}`);
}
