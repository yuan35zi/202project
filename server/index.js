/* ==========================================================================
   HTTP 服务：静态资源 + REST API + 会话校验
   ========================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const api = require('./api');
const { open, close: closeDb } = require('./db');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8123);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8'
};

const BLOCK = new Set(['server', 'data', 'node_modules', '.git']);

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) { reject(Object.assign(new Error('请求体过大'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(Object.assign(new Error('JSON 格式不正确'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function currentUser(d, token) {
  if (!token) return null;
  const s = d.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!s) return null;
  if (s.expires_at < Date.now()) {
    d.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return d.prepare('SELECT * FROM users WHERE id = ?').get(s.user_id) || null;
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const safe = path.normalize(rel).replace(/^([/\\])+/, '');
  if (safe.split(/[\\/]/).some((seg) => BLOCK.has(seg))) {
    res.writeHead(403); res.end('403'); return;
  }
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('403'); return; }
  fs.readFile(file, (err, data) => {
    if (err) {
      if (rel.indexOf('.') < 0) {
        fs.readFile(path.join(ROOT, 'index.html'), (e2, html) => {
          if (e2) { res.writeHead(404); res.end('404'); return; }
          res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
          res.end(html);
        });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 ' + rel);
      return;
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    return serveStatic(req, res, pathname);
  }

  try {
    const d = open();
    const cookies = parseCookies(req.headers.cookie);
    const user = currentUser(d, cookies.sid);
    const demoRow = d.prepare("SELECT value FROM meta WHERE key = 'demo'").get();
    const ctx = {
      req, res,
      method: req.method,
      pathname,
      token: cookies.sid,
      user,
      demo: !!(demoRow && demoRow.value === '1'),
      body: {},
      query: Object.fromEntries(url.searchParams.entries())
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') ctx.body = await readBody(req);
    const result = await api.handle(ctx);
    sendJson(res, 200, result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[api]', err);
    sendJson(res, status, { error: status >= 500 ? '服务器内部错误' : err.message });
  }
});

server.listen(PORT, HOST, () => {
  open();
  console.log('实训室进组选拔系统已启动');
  console.log('  本机访问：http://127.0.0.1:' + PORT);
  console.log('  数据文件：' + (process.env.DB_PATH || path.join(ROOT, 'data', 'app.db')));
  console.log('  演示账号：学生 2023040101 / 导师 T102 / 学院 admin，密码 123456');
});

function shutdown() {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => { closeDb(); process.exit(0); }, 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
