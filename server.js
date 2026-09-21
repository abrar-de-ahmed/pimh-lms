'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const Router = require('./lib/router');
const { sendHtml } = require('./lib/http-helpers');
require('./lib/seed')(); // no-op if already seeded

const router = new Router();
require('./routes/pages')(router);
require('./routes/api')(router);

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function tryServeStatic(req, res, pathname) {
  if (req.method !== 'GET') return false;
  const rel = pathname.replace(/^\/+/, '');
  const full = path.join(PUBLIC_DIR, rel);
  if (!full.startsWith(PUBLIC_DIR)) return false;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return false;
  const ext = path.extname(full);
  const type = MIME[ext] || 'application/octet-stream';
  const data = fs.readFileSync(full);
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length, 'Cache-Control': 'no-cache' });
  res.end(data);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    if (tryServeStatic(req, res, pathname)) return;

    const handled = await router.handle(req, res, pathname);
    if (!handled) {
      sendHtml(res, 404, '<!DOCTYPE html><html><body style="font-family:sans-serif; padding:60px; text-align:center;"><h1>404</h1><p>Page not found. <a href="/">Go home</a></p></body></html>');
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`PIMH Academy LMS running at http://localhost:${PORT}`);
});
