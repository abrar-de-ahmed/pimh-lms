'use strict';
const db = require('../lib/db');
const auth = require('../lib/auth');
const google = require('../lib/google');
const perm = require('../lib/permissions');
const q = require('../lib/queries');
const { readJson, sendJson } = require('../lib/http-helpers');

function requireAuth(req, res) {
  const user = auth.currentUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Not authenticated' });
    return null;
  }
  return user;
}

function requireRole(req, res, roles) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!roles.includes(user.role)) {
    sendJson(res, 403, { error: 'Not authorized' });
    return null;
  }
  return user;
}

function logActivity(actorId, text) {
  db.prepare('INSERT INTO activity_log (actor_id, text) VALUES (?,?)').run(actorId, text);
}

function notify(userId, text) {
  db.prepare('INSERT INTO notifications (user_id, text) VALUES (?,?)').run(userId, text);
}

module.exports = function register(router) {
  // ---------------- AUTH ----------------
  router.post('/api/auth/register', async (req, res) => {
    const body = await readJson(req);
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    if (!name || !email || password.length < 8) {
      return sendJson(res, 400, { error: 'Name, a valid email, and a password of at least 8 characters are required.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return sendJson(res, 409, { error: 'An account with this email already exists.' });
    const hash = auth.hashPassword(password);
    const result = db.prepare(`INSERT INTO users (name,email,password_hash,role,status) VALUES (?,?,?,'STUDENT','ACTIVE')`).run(name, email, hash);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const session = auth.createSession(user.id);
    auth.setCookie(res, 'pimh_session', session.token, { maxAge: 30 * 24 * 60 * 60 });
    logActivity(user.id, `New student account registered: ${name}`);
    sendJson(res, 200, { user: q.publicUser(user), redirect: auth.ROLE_HOME[user.role] });
  });

  router.post('/api/auth/login', async (req, res) => {
    const body = await readJson(req);
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !user.password_hash || !auth.verifyPassword(password, user.password_hash)) {
      return sendJson(res, 401, { error: 'Incorrect email or password.' });
    }
    if (user.status !== 'ACTIVE') {
      return sendJson(res, 403, { error: 'This account is inactive. Contact an administrator.' });
    }
    const session = auth.createSession(user.id);
    auth.setCookie(res, 'pimh_session', session.token, { maxAge: 30 * 24 * 60 * 60 });
    sendJson(res, 200, { user: q.publicUser(user), redirect: auth.ROLE_HOME[user.role] });
  });

  router.post('/api/auth/logout', async (req, res) => {
    const cookies = auth.parseCookies(req);
    auth.destroySession(cookies.pimh_session);
    auth.setCookie(res, 'pimh_session', '', { expires: 0 });
    sendJson(res, 200, { ok: true });
  });

  router.get('/api/auth/google/status', async (req, res) => {
    sendJson(res, 200, { configured: google.isConfigured() });
  });

  // ---------------- ME / PROFILE ----------------
  router.get('/api/me', async (req, res) => {
    const user = auth.currentUser(req);
    if (!user) return sendJson(res, 200, { user: null });
    sendJson(res, 200, { user: q.publicUser(user) });
  });

  router.put('/api/profile', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const body = await readJson(req);
    const name = (body.name || user.name).trim();
    const phone = body.phone != null ? body.phone : user.phone;
    db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name, phone, user.id);
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/profile/avatar', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const body = await readJson(req);
    const dataUrl = body.dataUrl || '';
    if (!dataUrl.startsWith('data:image/')) return sendJson(res, 400, { error: 'Please choose a JPEG or PNG image.' });
    if (dataUrl.length > 900000) return sendJson(res, 400, { error: 'Image is too large. Please choose a smaller file.' });
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(dataUrl, user.id);
    sendJson(res, 200, { ok: true, avatarUrl: dataUrl });
  });

  // ---------------- LEADS (public landing form) ----------------
  router.post('/api/leads', async (req, res) => {
    const body = await readJson(req);
    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    if (!name || !email) return sendJson(res, 400, { error: 'Name and email are required.' });
    db.prepare('INSERT INTO leads (name,email,phone,message) VALUES (?,?,?,?)').run(name, email, body.phone || '', body.message || '');
    sendJson(res, 200, { ok: true });
  });

  // ---------------- USERS (staff/admin) ----------------
  router.get('/api/users', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const url = new URL(req.url, 'http://x');
    const role = url.searchParams.get('role');
    let rows;
    if (role) rows = db.prepare('SELECT * FROM users WHERE role = ? ORDER BY name').all(role);
    else rows = db.prepare('SELECT * FROM users ORDER BY name').all();
    const withExtra = rows.map((u) => {
      const pu = q.publicUser(u);
      if (u.role === 'FACULTY') pu.courses = q.teacherCourses(u.id).map((c) => c.name);
      if (u.role === 'STUDENT') {
        const enrolled = db.prepare(`SELECT c.name FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? AND e.status='Active'`).all(u.id);
        pu.enrolledCount = enrolled.length;
      }
      return pu;
    });
    sendJson(res, 200, { users: withExtra });
  });

  router.post('/api/users', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const body = await readJson(req);
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const role = body.role || 'STUDENT';
    if (!name || !email) return sendJson(res, 400, { error: 'Please fill in a name and email.' });
    if ((role === 'FACULTY' || role === 'ADMIN' || role === 'SUPER_ADMIN') && !perm.canManageStaffAccounts(user.role)) {
      return sendJson(res, 403, { error: 'Only a Super Admin can create staff accounts.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return sendJson(res, 409, { error: 'An account with this email already exists.' });
    const tempPassword = Math.random().toString(36).slice(2, 10);
    const hash = auth.hashPassword(tempPassword);
    const result = db.prepare(`INSERT INTO users (name,email,password_hash,role,phone,title,status) VALUES (?,?,?,?,?,?,'ACTIVE')`)
      .run(name, email, hash, role, body.phone || '', body.title || body.role || '');
    logActivity(user.id, `Added ${role.toLowerCase()} account: ${name}`);
    sendJson(res, 200, { user: q.publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid)), tempPassword });
  });

  router.put('/api/users/:id', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!target) return sendJson(res, 404, { error: 'Not found' });
    if ((target.role === 'FACULTY' || target.role === 'ADMIN' || target.role === 'SUPER_ADMIN') && !perm.canManageStaffAccounts(user.role)) {
      return sendJson(res, 403, { error: 'Only a Super Admin can edit staff accounts.' });
    }
    const body = await readJson(req);
    const name = (body.name || target.name).trim();
    const email = (body.email || target.email).trim().toLowerCase();
    db.prepare('UPDATE users SET name=?, email=?, phone=?, title=? WHERE id=?')
      .run(name, email, body.phone != null ? body.phone : target.phone, body.title != null ? body.title : target.title, target.id);
    logActivity(user.id, `Updated account: ${name}`);
    sendJson(res, 200, { ok: true });
  });

  router.patch('/api/users/:id/status', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!target) return sendJson(res, 404, { error: 'Not found' });
    if ((target.role === 'FACULTY' || target.role === 'ADMIN' || target.role === 'SUPER_ADMIN') && !perm.canManageStaffAccounts(user.role)) {
      return sendJson(res, 403, { error: 'Only a Super Admin can deactivate staff accounts.' });
    }
    const newStatus = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    db.prepare('UPDATE users SET status=? WHERE id=?').run(newStatus, target.id);
    logActivity(user.id, `${newStatus === 'ACTIVE' ? 'Reactivated' : 'Deactivated'} account: ${target.name}`);
    sendJson(res, 200, { ok: true, status: newStatus });
  });

  // ---------------- COURSES ----------------
  router.get('/api/courses', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    let rows;
    if (user.role === 'FACULTY') rows = q.teacherCourses(user.id);
    else if (user.role === 'STUDENT') {
      rows = db.prepare(`SELECT c.* FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? AND e.status='Active'`).all(user.id);
    } else rows = db.prepare('SELECT * FROM courses ORDER BY name').all();

    const out = rows.map((c) => {
      const modules = q.courseModules(c.id);
      const enrolledCount = q.enrolledStudentIds(c.id).length;
      const teachers = q.courseTeachers(c.id);
      const item = {
        id: c.id, slug: c.slug, name: c.name, description: c.description, status: c.status,
        modules: modules.map((m) => ({ id: m.id, title: m.title, unlockThreshold: m.unlock_threshold })),
        enrolledCount, teachers: teachers.map((t) => ({ id: t.id, name: t.name })),
      };
      if (user.role === 'STUDENT') item.avgProgress = q.courseAvgProgress(c.id, user.id);
      else item.avgProgress = q.courseAvgProgressAll(c.id);
      return item;
    });
    sendJson(res, 200, { courses: out });
  });

  router.post('/api/courses', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const body = await readJson(req);
    const name = (body.name || '').trim();
    if (!name) return sendJson(res, 400, { error: 'Please give the course a name.' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36).slice(-4);
    const status = body.status || 'Draft';
    const result = db.prepare('INSERT INTO courses (slug,name,description,status) VALUES (?,?,?,?)').run(slug, name, body.description || '', status);
    logActivity(user.id, `Created course: ${name}`);
    sendJson(res, 200, { course: { id: result.lastInsertRowid, slug, name, status } });
  });

  router.put('/api/courses/:id', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const c = db.prepare('SELECT * FROM courses WHERE id=?').get(req.params.id);
    if (!c) return sendJson(res, 404, { error: 'Not found' });
    const body = await readJson(req);
    db.prepare('UPDATE courses SET name=?, description=?, status=? WHERE id=?')
      .run(body.name || c.name, body.description != null ? body.description : c.description, body.status || c.status, c.id);
    logActivity(user.id, `Updated course: ${body.name || c.name}`);
    sendJson(res, 200, { ok: true });
  });

  router.delete('/api/courses/:id', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const c = db.prepare('SELECT * FROM courses WHERE id=?').get(req.params.id);
    if (!c) return sendJson(res, 404, { error: 'Not found' });
    db.prepare('DELETE FROM courses WHERE id=?').run(c.id);
    logActivity(user.id, `Archived/removed course: ${c.name}`);
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/courses/:id/modules', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN', 'FACULTY']); if (!user) return;
    const c = db.prepare('SELECT * FROM courses WHERE id=?').get(req.params.id);
    if (!c) return sendJson(res, 404, { error: 'Not found' });
    if (user.role === 'FACULTY' && !perm.isFacultyOf(db, user.id, c.id)) return sendJson(res, 403, { error: 'Not your course.' });
    const body = await readJson(req);
    const title = (body.title || '').trim();
    if (!title) return sendJson(res, 400, { error: 'Please name the module.' });
    const maxOrder = db.prepare('SELECT MAX(order_idx) m FROM modules WHERE course_id=?').get(c.id).m;
    const result = db.prepare('INSERT INTO modules (course_id,title,order_idx) VALUES (?,?,?)').run(c.id, title, (maxOrder == null ? -1 : maxOrder) + 1);
    logActivity(user.id, `Added module "${title}" to ${c.name}`);
    sendJson(res, 200, { module: { id: result.lastInsertRowid, title } });
  });

  router.delete('/api/modules/:id', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN', 'FACULTY']); if (!user) return;
    const m = db.prepare('SELECT * FROM modules WHERE id=?').get(req.params.id);
    if (!m) return sendJson(res, 404, { error: 'Not found' });
    const c = db.prepare('SELECT * FROM courses WHERE id=?').get(m.course_id);
    if (user.role === 'FACULTY' && !perm.isFacultyOf(db, user.id, c.id)) return sendJson(res, 403, { error: 'Not your course.' });
    db.prepare('DELETE FROM modules WHERE id=?').run(m.id);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- ENROLLMENT ----------------
  router.get('/api/courses/:id/roster', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const c = db.prepare('SELECT * FROM courses WHERE id=?').get(req.params.id);
    if (!c) return sendJson(res, 404, { error: 'Not found' });
    const students = db.prepare(`SELECT u.* FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.course_id=? AND e.status='Active' ORDER BY u.name`).all(c.id);
    const out = students.map((s) => {
      const logs = db.prepare(`SELECT text, created_at as createdAt FROM activity_log WHERE actor_id=? ORDER BY created_at DESC LIMIT 5`).all(s.id);
      return { ...q.publicUser(s), progress: q.courseAvgProgress(c.id, s.id), logs };
    });
    sendJson(res, 200, { roster: out });
  });

  router.post('/api/enrollments', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const body = await readJson(req);
    const studentId = Number(body.studentId);
    const courseId = Number(body.courseId);
    const student = db.prepare('SELECT * FROM users WHERE id=? AND role=\'STUDENT\'').get(studentId);
    const course = db.prepare('SELECT * FROM courses WHERE id=?').get(courseId);
    if (!student || !course) return sendJson(res, 400, { error: 'Invalid student or course.' });
    const existing = db.prepare('SELECT * FROM enrollments WHERE student_id=? AND course_id=?').get(studentId, courseId);
    if (existing) {
      db.prepare(`UPDATE enrollments SET status='Active' WHERE id=?`).run(existing.id);
    } else {
      db.prepare(`INSERT INTO enrollments (student_id, course_id, status) VALUES (?,?,'Active')`).run(studentId, courseId);
      // seed module_progress rows
      const mods = q.courseModules(courseId);
      mods.forEach((m) => {
        const has = db.prepare('SELECT 1 FROM module_progress WHERE student_id=? AND module_id=?').get(studentId, m.id);
        if (!has) db.prepare('INSERT INTO module_progress (student_id, module_id, pct, time_spent_min, status) VALUES (?,?,0,0,\'locked\')').run(studentId, m.id);
      });
    }
    logActivity(user.id, `Enrolled ${student.name} in ${course.name}`);
    notify(studentId, `You were enrolled in ${course.name}.`);
    sendJson(res, 200, { ok: true });
  });

  router.delete('/api/enrollments', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const url = new URL(req.url, 'http://x');
    const studentId = Number(url.searchParams.get('studentId'));
    const courseId = Number(url.searchParams.get('courseId'));
    const student = db.prepare('SELECT * FROM users WHERE id=?').get(studentId);
    const course = db.prepare('SELECT * FROM courses WHERE id=?').get(courseId);
    db.prepare(`UPDATE enrollments SET status='Inactive' WHERE student_id=? AND course_id=?`).run(studentId, courseId);
    if (student && course) logActivity(user.id, `Removed ${student.name} from ${course.name}`);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- FACULTY ASSIGNMENT ----------------
  router.post('/api/courses/:id/teacher', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const c = db.prepare('SELECT * FROM courses WHERE id=?').get(req.params.id);
    if (!c) return sendJson(res, 404, { error: 'Not found' });
    const body = await readJson(req);
    const teacherId = Number(body.teacherId);
    const teacher = db.prepare('SELECT * FROM users WHERE id=? AND role=\'FACULTY\'').get(teacherId);
    if (!teacher) return sendJson(res, 400, { error: 'Invalid teacher.' });
    db.prepare('DELETE FROM course_teachers WHERE course_id=?').run(c.id);
    db.prepare('INSERT INTO course_teachers (course_id, teacher_id) VALUES (?,?)').run(c.id, teacherId);
    logActivity(user.id, `Assigned ${teacher.name} to ${c.name}`);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- MATERIALS ----------------
  router.get('/api/materials/:id/download', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const m = db.prepare('SELECT * FROM materials WHERE id=?').get(req.params.id);
    if (!m || !m.file_data) return sendJson(res, 404, { error: 'File not found' });
    const c = db.prepare('SELECT course_id FROM modules WHERE id=?').get(m.module_id);
    if (user.role === 'STUDENT') {
      const e = db.prepare(`SELECT * FROM enrollments WHERE student_id=? AND course_id=? AND status='Active'`).get(user.id, c.course_id);
      if (!e) return sendJson(res, 403, { error: 'Not enrolled.' });
    }
    const parts = m.file_data.split(',');
    if (parts.length < 2) return sendJson(res, 500, { error: 'Invalid file data' });
    const mime = parts[0];
    const b64 = parts[1];
    const buffer = Buffer.from(b64, 'base64');
    let ct = 'application/octet-stream';
    const match = mime.match(/:(.*?);/);
    if (match) ct = match[1];
    res.writeHead(200, {
      'Content-Type': ct,
      'Content-Disposition': `attachment; filename="${m.file_name || 'download'}"`,
      'Content-Length': buffer.length
    });
    res.end(buffer);
  });

  router.post('/api/modules/:id/materials', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN', 'FACULTY']); if (!user) return;
    const m = db.prepare('SELECT * FROM modules WHERE id=?').get(req.params.id);
    if (!m) return sendJson(res, 404, { error: 'Not found' });
    const c = db.prepare('SELECT * FROM courses WHERE id=?').get(m.course_id);
    if (user.role === 'FACULTY' && !perm.isFacultyOf(db, user.id, c.id)) return sendJson(res, 403, { error: 'Not your course.' });
    const body = await readJson(req);
    const title = (body.title || '').trim();
    const type = body.type === 'file' ? 'file' : 'link';
    const url = type === 'link' ? (body.url || '').trim() : '';
    const fileData = type === 'file' ? body.fileData : null;
    const fileName = type === 'file' ? body.fileName : null;
    
    if (!title) return sendJson(res, 400, { error: 'Please provide a title.' });
    if (type === 'link' && !url) return sendJson(res, 400, { error: 'Please provide a URL.' });
    if (type === 'file' && !fileData) return sendJson(res, 400, { error: 'Please provide a file.' });
    if (fileData && fileData.length > 15000000) return sendJson(res, 400, { error: 'File is too large.' });
    
    const result = db.prepare('INSERT INTO materials (module_id,title,type,url,file_name,file_data) VALUES (?,?,?,?,?,?)').run(m.id, title, type, url, fileName, fileData);
    sendJson(res, 200, { material: { id: result.lastInsertRowid, title, type, url, fileName } });
  });

  router.delete('/api/materials/:id', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN', 'FACULTY']); if (!user) return;
    db.prepare('DELETE FROM materials WHERE id=?').run(req.params.id);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- SCHEDULE ----------------
  router.post('/api/courses/:id/schedule', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN', 'FACULTY']); if (!user) return;
    const c = db.prepare('SELECT * FROM courses WHERE id=?').get(req.params.id);
    if (!c) return sendJson(res, 404, { error: 'Not found' });
    if (user.role === 'FACULTY' && !perm.isFacultyOf(db, user.id, c.id)) return sendJson(res, 403, { error: 'Not your course.' });
    const body = await readJson(req);
    const title = (body.title || '').trim();
    const date = (body.date || '').trim();
    if (!title || !date) return sendJson(res, 400, { error: 'Please provide a title and date.' });
    const result = db.prepare('INSERT INTO schedule_events (course_id,title,event_date,event_time,meeting_url) VALUES (?,?,?,?,?)')
      .run(c.id, title, date, body.time || null, body.meetingUrl || null);
    const students = q.enrolledStudentIds(c.id);
    students.forEach((sid) => notify(sid, `New session scheduled for ${c.name}: ${title}`));
    sendJson(res, 200, { event: { id: result.lastInsertRowid, title, date } });
  });

  router.delete('/api/schedule/:id', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN', 'FACULTY']); if (!user) return;
    db.prepare('DELETE FROM schedule_events WHERE id=?').run(req.params.id);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- DISCUSSION ----------------
  router.get('/api/posts/:id/download', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const p = db.prepare('SELECT * FROM discussion_posts WHERE id=?').get(req.params.id);
    if (!p || !p.file_data) return sendJson(res, 404, { error: 'File not found' });
    const m = db.prepare('SELECT course_id FROM modules WHERE id=?').get(p.module_id);
    if (user.role === 'STUDENT') {
      const e = db.prepare(`SELECT * FROM enrollments WHERE student_id=? AND course_id=? AND status='Active'`).get(user.id, m.course_id);
      if (!e) return sendJson(res, 403, { error: 'Not enrolled.' });
    }
    const parts = p.file_data.split(',');
    if (parts.length < 2) return sendJson(res, 500, { error: 'Invalid file data' });
    const mime = parts[0];
    const b64 = parts[1];
    const buffer = Buffer.from(b64, 'base64');
    let ct = 'application/octet-stream';
    const match = mime.match(/:(.*?);/);
    if (match) ct = match[1];
    res.writeHead(200, {
      'Content-Type': ct,
      'Content-Disposition': `attachment; filename="${p.file_name || 'download'}"`,
      'Content-Length': buffer.length
    });
    res.end(buffer);
  });
  router.get('/api/modules/:id/posts', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const posts = db.prepare(`SELECT p.*, u.name as author_name, u.role as author_role FROM discussion_posts p JOIN users u ON u.id=p.author_id WHERE p.module_id=? ORDER BY p.created_at ASC`).all(req.params.id);
    sendJson(res, 200, { posts: posts.map((p) => ({ id: p.id, text: p.text, fileName: p.file_name, fileMime: p.file_mime, fileData: p.file_data || null, createdAt: p.created_at, authorName: p.author_name, authorRole: p.author_role, authorInitials: q.initials(p.author_name) })) });
  });

  router.post('/api/modules/:id/posts', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const m = db.prepare('SELECT * FROM modules WHERE id=?').get(req.params.id);
    if (!m) return sendJson(res, 404, { error: 'Not found' });
    const body = await readJson(req);
    const text = (body.text || '').trim();
    const fileName = body.fileName || null;
    const fileMime = body.fileMime || null;
    const fileData = body.fileData || null;
    if (!text && !fileName) return sendJson(res, 400, { error: 'Write something or attach a file before posting.' });
    if (fileData && fileData.length > 15000000) return sendJson(res, 400, { error: 'File is too large. Maximum size is 10 MB.' });
    const result = db.prepare('INSERT INTO discussion_posts (module_id, author_id, text, file_name, file_mime, file_data) VALUES (?,?,?,?,?,?)').run(m.id, user.id, text || '', fileName, fileMime, fileData);
    sendJson(res, 200, { post: { id: result.lastInsertRowid } });
  });

  // ---------------- ANNOUNCEMENTS ----------------
  router.get('/api/announcements', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    let rows;
    if (user.role === 'STUDENT') {
      rows = db.prepare(`
        SELECT a.*, u.name as author_name, c.name as course_name FROM announcements a
        JOIN users u ON u.id=a.author_id LEFT JOIN courses c ON c.id=a.course_id
        WHERE a.scope='academy' OR a.course_id IN (SELECT course_id FROM enrollments WHERE student_id=? AND status='Active')
        ORDER BY a.created_at DESC`).all(user.id);
    } else if (user.role === 'FACULTY') {
      rows = db.prepare(`
        SELECT a.*, u.name as author_name, c.name as course_name FROM announcements a
        JOIN users u ON u.id=a.author_id LEFT JOIN courses c ON c.id=a.course_id
        WHERE a.scope='academy' OR a.course_id IN (SELECT course_id FROM course_teachers WHERE teacher_id=?)
        ORDER BY a.created_at DESC`).all(user.id);
    } else {
      rows = db.prepare(`SELECT a.*, u.name as author_name, c.name as course_name FROM announcements a JOIN users u ON u.id=a.author_id LEFT JOIN courses c ON c.id=a.course_id ORDER BY a.created_at DESC`).all();
    }
    sendJson(res, 200, { announcements: rows.map((a) => ({ id: a.id, scope: a.scope, courseId: a.course_id, courseName: a.course_name, title: a.title, message: a.message, authorName: a.author_name, createdAt: a.created_at })) });
  });

  router.post('/api/announcements', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const body = await readJson(req);
    const title = (body.title || '').trim();
    const message = (body.message || '').trim();
    if (!title || !message) return sendJson(res, 400, { error: 'Please add a title and message.' });
    let scope = body.scope === 'academy' ? 'academy' : 'course';
    let courseId = body.courseId ? Number(body.courseId) : null;
    if (scope === 'academy' && !perm.isStaff(user.role)) return sendJson(res, 403, { error: 'Only staff can post academy-wide announcements.' });
    if (scope === 'course') {
      const c = db.prepare('SELECT * FROM courses WHERE id=?').get(courseId);
      if (!c) return sendJson(res, 400, { error: 'Invalid course.' });
      if (user.role === 'FACULTY' && !perm.isFacultyOf(db, user.id, courseId)) return sendJson(res, 403, { error: 'Not your course.' });
      if (user.role === 'STUDENT') return sendJson(res, 403, { error: 'Students cannot post announcements.' });
    }
    const result = db.prepare('INSERT INTO announcements (scope,course_id,author_id,title,message) VALUES (?,?,?,?,?)').run(scope, courseId, user.id, title, message);
    if (scope === 'academy') logActivity(user.id, `Posted academy-wide announcement: "${title}"`);
    sendJson(res, 200, { announcement: { id: result.lastInsertRowid } });
  });

  // ---------------- COURSE DETAIL (modules + per-student progress + materials + schedule) ----------------
  router.get('/api/course-detail/:id', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const c = db.prepare('SELECT * FROM courses WHERE id=?').get(req.params.id);
    if (!c) return sendJson(res, 404, { error: 'Not found' });

    const isStudent = user.role === 'STUDENT';
    const studentId = isStudent ? user.id : null;

    const mods = q.courseModules(c.id);
    let prevPct = null;
    const modules = mods.map((m) => {
      const materials = db.prepare('SELECT * FROM materials WHERE module_id=? ORDER BY created_at').all(m.id)
        .map((mat) => ({ id: mat.id, title: mat.title, type: mat.type, url: mat.url, createdAt: mat.created_at }));
      const assessRows = q.moduleAssessments(m.id);
      let assessment = null;
      if (assessRows.length) {
        const a = assessRows[0];
        assessment = { id: a.id, title: a.title, type: a.type, dueDate: a.due_date };
        if (isStudent) {
          const sub = db.prepare('SELECT * FROM submissions WHERE assessment_id=? AND student_id=?').get(a.id, studentId);
          assessment.submitted = !!sub;
          assessment.score = sub ? sub.score : null;
        }
      }
      const out = { id: m.id, title: m.title, unlockThreshold: m.unlock_threshold, materials, assessment };
      if (isStudent) {
        const st = q.moduleStateForStudent(studentId, m, prevPct);
        out.pct = st.pct; out.status = st.status; out.timeSpent = st.timeSpent;
        prevPct = st.pct;
      } else {
        out.avgPct = 0;
        const students = q.enrolledStudentIds(c.id);
        if (students.length) {
          let total = 0;
          students.forEach((sid) => { const p = q.studentModuleProgress(sid, m.id); total += p ? p.pct : 0; });
          out.avgPct = Math.round(total / students.length);
        }
      }
      return out;
    });

    const schedule = db.prepare('SELECT * FROM schedule_events WHERE course_id=? ORDER BY event_date, event_time').all(c.id)
      .map((s) => ({ id: s.id, title: s.title, date: s.event_date, time: s.event_time, meetingUrl: s.meeting_url }));

    sendJson(res, 200, {
      id: c.id, name: c.name, description: c.description, status: c.status,
      avgProgress: isStudent ? q.courseAvgProgress(c.id, studentId) : q.courseAvgProgressAll(c.id),
      modules, schedule,
      teachers: q.courseTeachers(c.id).map((t) => ({ id: t.id, name: t.name })),
      enrolledCount: q.enrolledStudentIds(c.id).length,
    });
  });

  // ---------------- ASSESSMENTS / GRADING ----------------
  router.get('/api/assessments/:id', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const a = db.prepare('SELECT * FROM assessments WHERE id=?').get(req.params.id);
    if (!a) return sendJson(res, 404, { error: 'Not found' });
    const out = { id: a.id, title: a.title, type: a.type, dueDate: a.due_date, timeLimitMin: a.time_limit_min, attemptsAllowed: a.attempts_allowed, moduleId: a.module_id };
    if (a.type === 'quiz') {
      out.questions = q.assessmentQuestions(a.id).map((qq) => ({ id: qq.id, text: qq.text, options: qq.options.map((o) => ({ id: o.id, text: o.text })) }));
      if (user.role === 'STUDENT') {
        const attemptsUsed = db.prepare('SELECT COUNT(*) c FROM quiz_attempts WHERE assessment_id=? AND student_id=?').get(a.id, user.id).c;
        const firstAttempt = db.prepare('SELECT session_start FROM quiz_attempts WHERE assessment_id=? AND student_id=? ORDER BY id ASC LIMIT 1').get(a.id, user.id);
        out.attemptsUsed = attemptsUsed;
        if (firstAttempt && firstAttempt.session_start) {
          out.sessionStart = firstAttempt.session_start;
          const sessionWindow = (a.time_limit_min || 30) * 60 * 1000;
          out.sessionExpiry = new Date(new Date(firstAttempt.session_start).getTime() + sessionWindow).toISOString();
          out.sessionExpired = Date.now() > new Date(out.sessionExpiry).getTime();
        }
      }
    }
    sendJson(res, 200, { assessment: out });
  });

  router.get('/api/faculty/grading', async (req, res) => {
    const user = requireRole(req, res, ['FACULTY']); if (!user) return;
    const courses = q.teacherCourses(user.id);
    const items = [];
    courses.forEach((c) => {
      q.courseModules(c.id).forEach((m) => {
        q.moduleAssessments(m.id).forEach((a) => {
          const subs = db.prepare(`SELECT s.*, u.name as student_name FROM submissions s JOIN users u ON u.id=s.student_id WHERE s.assessment_id=?`).all(a.id);
          subs.forEach((s) => {
            items.push({
              submissionId: s.id, assessmentId: a.id, assessmentTitle: a.title, type: a.type,
              courseId: c.id, courseName: c.name, studentId: s.student_id, studentName: s.student_name,
              studentInitials: q.initials(s.student_name), score: s.score, status: s.status,
              submittedAt: s.submitted_at, feedback: s.feedback,
            });
          });
        });
      });
    });
    items.sort((x, y) => (x.status === y.status ? 0 : x.status === 'ungraded' ? -1 : 1));
    sendJson(res, 200, { items });
  });

  router.put('/api/submissions/:id/grade', async (req, res) => {
    const user = requireRole(req, res, ['FACULTY']); if (!user) return;
    const sub = db.prepare('SELECT * FROM submissions WHERE id=?').get(req.params.id);
    if (!sub) return sendJson(res, 404, { error: 'Not found' });
    const body = await readJson(req);
    const score = Math.max(0, Math.min(100, Number(body.score)));
    if (Number.isNaN(score)) return sendJson(res, 400, { error: 'Please enter a valid score.' });
    db.prepare(`UPDATE submissions SET score=?, status='graded', graded_at=datetime('now'), feedback=? WHERE id=?`).run(score, body.feedback || null, sub.id);
    const assessment = db.prepare('SELECT * FROM assessments WHERE id=?').get(sub.assessment_id);
    notify(sub.student_id, `${assessment.title} was graded — ${score}%`);
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/assessments/:id/submit', async (req, res) => {
    const user = requireRole(req, res, ['STUDENT']); if (!user) return;
    const a = db.prepare('SELECT * FROM assessments WHERE id=?').get(req.params.id);
    if (!a || a.type !== 'assignment') return sendJson(res, 400, { error: 'Invalid assignment.' });
    const body = await readJson(req);
    const content = (body.content || 'Submitted.').trim();
    const existing = db.prepare('SELECT * FROM submissions WHERE assessment_id=? AND student_id=?').get(a.id, user.id);
    if (existing) {
      db.prepare(`UPDATE submissions SET content_text=?, status='ungraded', submitted_at=datetime('now') WHERE id=?`).run(content, existing.id);
    } else {
      db.prepare(`INSERT INTO submissions (assessment_id, student_id, content_text, status) VALUES (?,?,?,'ungraded')`).run(a.id, user.id, content);
    }
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/assessments/:id/attempt', async (req, res) => {
    const user = requireRole(req, res, ['STUDENT']); if (!user) return;
    const a = db.prepare('SELECT * FROM assessments WHERE id=?').get(req.params.id);
    if (!a || a.type !== 'quiz') return sendJson(res, 400, { error: 'Invalid quiz.' });

    const attemptsUsed = db.prepare('SELECT COUNT(*) c FROM quiz_attempts WHERE assessment_id=? AND student_id=?').get(a.id, user.id).c;
    if (a.attempts_allowed && attemptsUsed >= a.attempts_allowed) return sendJson(res, 403, { error: 'No attempts remaining for this quiz.' });

    // --- 30-minute session window enforcement ---
    const sessionWindow = (a.time_limit_min || 30) * 60 * 1000; // ms
    const firstAttempt = db.prepare('SELECT session_start FROM quiz_attempts WHERE assessment_id=? AND student_id=? ORDER BY id ASC LIMIT 1').get(a.id, user.id);
    if (firstAttempt && firstAttempt.session_start) {
      const elapsed = Date.now() - new Date(firstAttempt.session_start + 'Z').getTime();
      if (elapsed > sessionWindow) return sendJson(res, 403, { error: 'The 30-minute quiz session has expired. You can no longer retake this quiz.' });
    }
    const sessionStart = firstAttempt ? firstAttempt.session_start : new Date().toISOString().replace('T', ' ').split('.')[0];
    // -------------------------------------------

    const body = await readJson(req);
    const answers = body.answers || {};
    const questions = q.assessmentQuestions(a.id);
    let correct = 0;
    questions.forEach((qq) => {
      const chosen = answers[qq.id];
      const correctOpt = qq.options.find((o) => o.is_correct);
      if (correctOpt && Number(chosen) === correctOpt.id) correct += 1;
    });
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    db.prepare('INSERT INTO quiz_attempts (assessment_id, student_id, score, answers_json, session_start) VALUES (?,?,?,?,?)').run(a.id, user.id, score, JSON.stringify(answers), sessionStart);
    // reflect into submissions table
    const existing = db.prepare('SELECT * FROM submissions WHERE assessment_id=? AND student_id=?').get(a.id, user.id);
    if (existing) db.prepare(`UPDATE submissions SET score=?, status='graded', graded_at=datetime('now') WHERE id=?`).run(score, existing.id);
    else db.prepare(`INSERT INTO submissions (assessment_id, student_id, score, status) VALUES (?,?,?,'graded')`).run(a.id, user.id, score);
    // mark module progress complete
    db.prepare(`INSERT INTO module_progress (student_id, module_id, pct, time_spent_min, status) VALUES (?,?,100,30,'done')
      ON CONFLICT(student_id, module_id) DO UPDATE SET pct=100, status='done'`).run(user.id, a.module_id);

    const newAttemptsUsed = attemptsUsed + 1;
    const attemptsRemaining = a.attempts_allowed ? a.attempts_allowed - newAttemptsUsed : null;
    // Calculate session expiry info
    const sessionExpiry = new Date(new Date(sessionStart).getTime() + sessionWindow).toISOString();
    sendJson(res, 200, { score, correct, total: questions.length, attemptsRemaining, sessionStart, sessionExpiry });
  });

  // ---------------- MODULE PROGRESS ----------------
  router.patch('/api/progress/:moduleId', async (req, res) => {
    const user = requireRole(req, res, ['STUDENT']); if (!user) return;
    const mod = db.prepare('SELECT * FROM modules WHERE id=?').get(req.params.moduleId);
    if (!mod) return sendJson(res, 404, { error: 'Not found' });
    const body = await readJson(req);
    const pct = Math.max(0, Math.min(100, Number(body.pct) || 100));
    const status = pct >= 100 ? 'done' : pct > 0 ? 'in_progress' : 'locked';
    db.prepare(`INSERT INTO module_progress (student_id, module_id, pct, time_spent_min, status) VALUES (?,?,?,30,?)
      ON CONFLICT(student_id, module_id) DO UPDATE SET pct=excluded.pct, status=excluded.status, time_spent_min=time_spent_min+30`).run(user.id, mod.id, pct, status);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- STUDENT: GRADES ----------------
  router.get('/api/student/grades', async (req, res) => {
    const user = requireRole(req, res, ['STUDENT']); if (!user) return;
    const rows = db.prepare(`
      SELECT s.*, a.title as assessment_title, a.type, m.course_id, c.name as course_name
      FROM submissions s
      JOIN assessments a ON a.id = s.assessment_id
      JOIN modules m ON m.id = a.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE s.student_id = ?
      ORDER BY s.submitted_at DESC`).all(user.id);
    sendJson(res, 200, {
      grades: rows.map((r) => ({
        id: r.id,
        assessmentId: r.assessment_id,
        title: r.assessment_title,
        type: r.type,
        courseName: r.course_name,
        score: r.score,
        status: r.status,
        feedback: r.feedback,
        submittedAt: r.submitted_at,
      })),
    });
  });

  // ---------------- STUDENT: CERTIFICATES ----------------
  router.get('/api/student/certificates', async (req, res) => {
    const user = requireRole(req, res, ['STUDENT']); if (!user) return;
    const courses = db.prepare(`SELECT c.* FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? AND e.status='Active'`).all(user.id);
    const out = courses.map((c) => ({ courseId: c.id, courseName: c.name, progress: q.courseAvgProgress(c.id, user.id), certId: `PIMH-${c.id}-${user.id}-${new Date().getFullYear()}` }));
    sendJson(res, 200, { certificates: out });
  });

  // ---------------- NOTIFICATIONS ----------------
  router.get('/api/notifications', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    const rows = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(user.id);
    sendJson(res, 200, { notifications: rows.map((n) => ({ id: n.id, text: n.text, isRead: !!n.is_read, createdAt: n.created_at })) });
  });

  router.patch('/api/notifications/:id/read', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, user.id);
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/notifications/read-all', async (req, res) => {
    const user = requireAuth(req, res); if (!user) return;
    db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(user.id);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- ACTIVITY LOG ----------------
  router.get('/api/activity', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const rows = db.prepare(`SELECT a.*, u.name as actor_name FROM activity_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100`).all();
    sendJson(res, 200, { log: rows.map((r) => ({ text: r.text, actorName: r.actor_name, createdAt: r.created_at })) });
  });

  // ---------------- SETTINGS ----------------
  router.get('/api/settings', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const rows = db.prepare('SELECT * FROM settings').all();
    const out = {};
    rows.forEach((r) => { out[r.key] = r.value; });
    sendJson(res, 200, { settings: out });
  });

  router.put('/api/settings', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN']); if (!user) return;
    const body = await readJson(req);
    const upsert = db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    Object.keys(body).forEach((k) => upsert.run(k, String(body[k])));
    logActivity(user.id, 'Updated academy settings');
    sendJson(res, 200, { ok: true });
  });

  // ---------------- DASHBOARD AGGREGATES ----------------
  router.get('/api/dashboard/student', async (req, res) => {
    const user = requireRole(req, res, ['STUDENT']); if (!user) return;
    const courses = db.prepare(`SELECT c.* FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=? AND e.status='Active'`).all(user.id);
    const courseProgress = courses.map((c) => ({ id: c.id, name: c.name, progress: q.courseAvgProgress(c.id, user.id) }));
    const overall = courseProgress.length ? Math.round(courseProgress.reduce((s, c) => s + c.progress, 0) / courseProgress.length) : 0;
    
    // Module counts for stats
    let completedModules = 0;
    let totalModules = 0;
    let resumeModule = null;
    
    for (const c of courses) {
      const mods = q.courseModules(c.id);
      totalModules += mods.length;
      let prevPct = null;
      for (const m of mods) {
        const st = q.moduleStateForStudent(user.id, m, prevPct);
        if (st.status === 'done') completedModules++;
        if (!resumeModule && (st.status === 'in_progress' || st.status === 'available')) {
          resumeModule = {
            id: m.id,
            title: m.title,
            courseId: c.id,
            courseName: c.name,
            pct: st.pct,
            status: st.status,
          };
        }
        prevPct = st.pct;
      }
    }

    const submissions = db.prepare(`
      SELECT s.*, a.title as assessment_title, a.type, c.name as course_name
      FROM submissions s
      JOIN assessments a ON a.id = s.assessment_id
      JOIN modules m ON m.id = a.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE s.student_id = ?
      ORDER BY s.submitted_at DESC LIMIT 3`).all(user.id);

    const gradedScores = submissions.filter((s) => s.score != null).map((s) => s.score);
    const avgScore = gradedScores.length ? Math.round(gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length) : null;

    const materials = db.prepare(`
      SELECT mat.*, c.name as course_name, m.title as module_title
      FROM materials mat
      JOIN modules m ON m.id = mat.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE c.id IN (SELECT course_id FROM enrollments WHERE student_id=? AND status='Active')
      ORDER BY mat.created_at DESC LIMIT 4`).all(user.id);

    const nextEvent = db.prepare(`SELECT se.*, c.name as course_name FROM schedule_events se JOIN courses c ON c.id=se.course_id WHERE se.course_id IN (SELECT course_id FROM enrollments WHERE student_id=? AND status='Active') AND se.event_date >= date('now') ORDER BY se.event_date ASC LIMIT 1`).get(user.id);
    const dueSoon = db.prepare(`
      SELECT a.*, c.name as course_name FROM assessments a
      JOIN modules m ON m.id=a.module_id JOIN courses c ON c.id=m.course_id
      WHERE m.course_id IN (SELECT course_id FROM enrollments WHERE student_id=? AND status='Active')
        AND a.due_date IS NOT NULL AND a.due_date >= date('now')
      ORDER BY a.due_date ASC LIMIT 5`).all(user.id);
    const notifs = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 5').all(user.id);

    sendJson(res, 200, {
      name: user.name,
      overallProgress: overall,
      courses: courseProgress,
      stats: {
        activeCourses: courses.length,
        completedModules,
        totalModules,
        learningStreak: 5,
        avgScore: avgScore != null ? avgScore : (overall > 0 ? overall : 88),
      },
      resumeModule,
      recentGrades: submissions.map((s) => ({
        id: s.id,
        assessmentId: s.assessment_id,
        title: s.assessment_title,
        type: s.type,
        courseName: s.course_name,
        score: s.score,
        status: s.status,
        feedback: s.feedback,
        submittedAt: s.submitted_at,
      })),
      recentMaterials: materials.map((mat) => ({
        id: mat.id,
        title: mat.title,
        type: mat.type,
        url: mat.url,
        courseName: mat.course_name,
        moduleTitle: mat.module_title,
        createdAt: mat.created_at,
      })),
      nextEvent: nextEvent ? { title: nextEvent.title, courseName: nextEvent.course_name, date: nextEvent.event_date, time: nextEvent.event_time } : null,
      dueSoon: dueSoon.map((d) => ({ title: d.title, courseName: d.course_name, dueDate: d.due_date, type: d.type, assessmentId: d.id })),
      notifications: notifs.map((n) => ({ text: n.text, isRead: !!n.is_read, createdAt: n.created_at })),
    });
  });

  router.get('/api/dashboard/faculty', async (req, res) => {
    const user = requireRole(req, res, ['FACULTY']); if (!user) return;
    const courses = q.teacherCourses(user.id);
    let pendingGrading = 0;
    
    const recentSubmissions = [];
    const recentDiscussions = [];
    const upcomingSessions = [];

    courses.forEach((c) => {
      const sessions = db.prepare(`SELECT se.*, c.name as course_name FROM schedule_events se JOIN courses c ON c.id=se.course_id WHERE se.course_id=? AND se.event_date >= date('now') ORDER BY se.event_date ASC LIMIT 5`).all(c.id);
      upcomingSessions.push(...sessions);

      q.courseModules(c.id).forEach((m) => {
        const posts = db.prepare(`SELECT p.*, u.name as author_name, u.role as author_role, m.title as module_title, c.name as course_name FROM discussion_posts p JOIN users u ON u.id=p.author_id JOIN modules m ON m.id=p.module_id JOIN courses c ON c.id=m.course_id WHERE p.module_id=? ORDER BY p.created_at DESC LIMIT 5`).all(m.id);
        recentDiscussions.push(...posts);

        q.moduleAssessments(m.id).forEach((a) => {
          pendingGrading += db.prepare(`SELECT COUNT(*) c FROM submissions WHERE assessment_id=? AND status='ungraded'`).get(a.id).c;
          const subs = db.prepare(`SELECT s.*, u.name as student_name, a.title as assessment_title, c.name as course_name FROM submissions s JOIN users u ON u.id=s.student_id JOIN assessments a ON a.id=s.assessment_id JOIN modules m ON m.id=a.module_id JOIN courses c ON c.id=m.course_id WHERE s.assessment_id=? AND s.status='ungraded' ORDER BY s.submitted_at ASC LIMIT 5`).all(a.id);
          recentSubmissions.push(...subs);
        });
      });
    });

    recentSubmissions.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    const topSubmissions = recentSubmissions.slice(0, 5);

    upcomingSessions.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    const topSessions = upcomingSessions.slice(0, 3);

    recentDiscussions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const topDiscussions = recentDiscussions.slice(0, 4);

    const studentsTotal = new Set();
    courses.forEach((c) => q.enrolledStudentIds(c.id).forEach((s) => studentsTotal.add(s)));
    const recentAnnouncement = db.prepare(`SELECT a.*, c.name as course_name FROM announcements a LEFT JOIN courses c ON c.id=a.course_id WHERE a.author_id=? ORDER BY a.created_at DESC LIMIT 1`).get(user.id);
    
    sendJson(res, 200, {
      name: user.name,
      classesTaught: courses.length,
      studentsEnrolled: studentsTotal.size,
      pendingGrading,
      courses: courses.map((c) => ({ id: c.id, name: c.name, avgProgress: q.courseAvgProgressAll(c.id), enrolledCount: q.enrolledStudentIds(c.id).length })),
      recentAnnouncement: recentAnnouncement ? { title: recentAnnouncement.title, text: recentAnnouncement.message, courseName: recentAnnouncement.course_name } : null,
      recentSubmissions: topSubmissions.map(s => ({
        submissionId: s.id, assessmentTitle: s.assessment_title, courseName: s.course_name, studentName: s.student_name, submittedAt: s.submitted_at
      })),
      upcomingSessions: topSessions.map(s => ({
        id: s.id, title: s.title, date: s.event_date, time: s.event_time, courseName: s.course_name
      })),
      recentDiscussions: topDiscussions.map(p => ({
        id: p.id, text: p.text, authorName: p.author_name, authorRole: p.author_role, moduleTitle: p.module_title, courseName: p.course_name, createdAt: p.created_at
      }))
    });
  });

  router.get('/api/dashboard/admin', async (req, res) => {
    const user = requireRole(req, res, ['SUPER_ADMIN', 'ADMIN']); if (!user) return;
    const students = db.prepare(`SELECT COUNT(*) c FROM users WHERE role='STUDENT'`).get().c;
    const faculty = db.prepare(`SELECT COUNT(*) c FROM users WHERE role='FACULTY' AND status='ACTIVE'`).get().c;
    const courses = db.prepare(`SELECT COUNT(*) c FROM courses WHERE status='Active'`).get().c;
    let pendingGrading = 0;
    db.prepare('SELECT id FROM assessments').all().forEach((a) => {
      pendingGrading += db.prepare(`SELECT COUNT(*) c FROM submissions WHERE assessment_id=? AND status='ungraded'`).get(a.id).c;
    });
    const allCourses = db.prepare('SELECT * FROM courses').all();
    const courseSnapshot = allCourses.map((c) => ({ id: c.id, name: c.name, avgProgress: q.courseAvgProgressAll(c.id), enrolledCount: q.enrolledStudentIds(c.id).length }));
    const teachers = db.prepare(`SELECT * FROM users WHERE role='FACULTY'`).all();
    const facultyLoad = teachers.map((t) => ({ name: t.name, status: t.status, courseCount: q.teacherCourses(t.id).length }));
    const unassignedFaculty = teachers.filter((t) => q.teacherCourses(t.id).length === 0 && t.status === 'ACTIVE');
    const activity = db.prepare(`SELECT a.*, u.name as actor_name FROM activity_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 5`).all();
    sendJson(res, 200, {
      name: user.name,
      stats: { students, faculty, courses, pendingGrading },
      courseSnapshot, facultyLoad,
      unassignedFaculty: unassignedFaculty.map((f) => f.name),
      activity: activity.map((a) => ({ text: a.text, createdAt: a.created_at })),
      isSuperAdmin: user.role === 'SUPER_ADMIN',
    });
  });

  // ---------------- GOOGLE OAUTH ----------------
  router.get('/api/auth/google/start', async (req, res) => {
    if (!google.isConfigured()) return sendJson(res, 400, { error: 'Google sign-in is not configured on this server yet.' });
    const state = require('node:crypto').randomBytes(8).toString('hex');
    const host = req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${proto}://${host}/api/auth/google/callback`;
    auth.setCookie(res, 'g_state', state, { maxAge: 600 });
    const { redirect } = require('../lib/http-helpers');
    redirect(res, google.authUrl(state, redirectUri));
  });

  router.get('/api/auth/google/callback', async (req, res) => {
    const { redirect } = require('../lib/http-helpers');
    const url = new URL(req.url, 'http://x');
    const code = url.searchParams.get('code');
    if (!code || !google.isConfigured()) return redirect(res, '/login?error=google');
    try {
      const host = req.headers.host;
      const proto = req.headers['x-forwarded-proto'] || 'http';
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${proto}://${host}/api/auth/google/callback`;
      const profile = await google.exchangeCode(code, redirectUri);
      let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(profile.sub, profile.email);
      if (!user) {
        const result = db.prepare(`INSERT INTO users (name,email,google_id,role,status) VALUES (?,?,?,'STUDENT','ACTIVE')`)
          .run(profile.name || profile.email, profile.email, profile.sub);
        user = db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid);
      } else if (!user.google_id) {
        db.prepare('UPDATE users SET google_id=? WHERE id=?').run(profile.sub, user.id);
      }
      const session = auth.createSession(user.id);
      auth.setCookie(res, 'pimh_session', session.token, { maxAge: 30 * 24 * 60 * 60 });
      redirect(res, auth.ROLE_HOME[user.role] || '/student');
    } catch (e) {
      console.error(e);
      redirect(res, '/login?error=google');
    }
  });
};
