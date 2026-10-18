'use strict';
const fs = require('node:fs');
const path = require('node:path');
const db = require('../lib/db');
const seed = require('../lib/seed');

// Ensure master super admins and default courses/settings exist
seed();

// Remove all users except the two Master Super Admins
const removedUsers = db.prepare(`
  DELETE FROM users
  WHERE lower(email) NOT IN ('abrar_a@live.com', 'craft@craftedmindss.com')
`).run().changes;

// Clear all dummy/test activity, enrollments, submissions, discussions, notifications, leads
db.prepare('DELETE FROM course_teachers').run();
db.prepare('DELETE FROM enrollments').run();
db.prepare('DELETE FROM module_progress').run();
db.prepare('DELETE FROM submissions').run();
db.prepare('DELETE FROM quiz_attempts').run();
db.prepare('DELETE FROM discussion_posts').run();
db.prepare('DELETE FROM announcements').run();
db.prepare('DELETE FROM notifications').run();
db.prepare('DELETE FROM activity_log').run();
db.prepare('DELETE FROM leads').run();
db.prepare('DELETE FROM sent_reminders').run();
db.prepare('DELETE FROM sessions').run();

// Clean up any test uploaded receipts in data/uploads
const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
if (fs.existsSync(uploadsDir)) {
  for (const f of fs.readdirSync(uploadsDir)) {
    if (f.startsWith('receipts_')) {
      try { fs.unlinkSync(path.join(uploadsDir, f)); } catch (_) {}
    }
  }
}

const users = db.prepare('SELECT id, name, email, role, status, email_verified FROM users ORDER BY id').all();
const courses = db.prepare('SELECT id, slug, name, status FROM courses ORDER BY id').all();

console.log(`Cleaned ${removedUsers} dummy/test user(s).`);
console.log('Remaining users:', JSON.stringify(users, null, 2));
console.log('Preserved courses:', JSON.stringify(courses, null, 2));
