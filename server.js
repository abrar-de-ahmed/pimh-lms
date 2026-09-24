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

// Daily Cron Job for Upcoming Task Due Notifications
setInterval(() => {
  try {
    const db = require('./lib/db');
    const mailer = require('./lib/mailer');
    const upcoming = db.prepare(`SELECT * FROM assessments WHERE due_date IS NOT NULL AND due_date >= datetime('now') AND due_date <= datetime('now', '+1 day')`).all();
    
    upcoming.forEach(a => {
      const course = db.prepare(`SELECT c.id, c.name FROM modules m JOIN courses c ON c.id = m.course_id WHERE m.id = ?`).get(a.module_id);
      if (!course) return;
      
      const enrolled = db.prepare(`SELECT u.id, u.email, u.name as student_name FROM enrollments e JOIN users u ON u.id = e.student_id WHERE e.course_id = ? AND e.status = 'Active'`).all(course.id);
      enrolled.forEach(student => {
        const sub = db.prepare(`SELECT id FROM submissions WHERE assessment_id = ? AND student_id = ?`).get(a.id, student.id);
        if (!sub) {
          console.log(`[CRON] Overdue notification queue: ${student.email} for ${a.title}`);
          mailer.sendEmail({
            to: student.email,
            subject: `Action Required: Upcoming Deadline for ${course.name}`,
            html: `<p>Hello ${student.student_name},</p><p>This is a reminder that you have an upcoming ${a.type} (<b>${a.title}</b>) due within the next 24 hours.</p><p>Please log in to the PIMH Academy dashboard to complete it!</p>`
          }).catch(console.error);
        }
      });
    });
  } catch (err) { console.error('[CRON ERROR]', err); }
}, 24 * 60 * 60 * 1000); // 24 hours

server.listen(PORT, () => {
  console.log(`PIMH Academy LMS running at http://localhost:${PORT}`);
});
