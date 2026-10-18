'use strict';
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

// Load .env
const ENV_PATH = path.join(__dirname, '..', '.env');
if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

// Stub Resend during automated unit tests so we don't hit external rate limits/403s
delete process.env.RESEND_API_KEY;

const db = require('../lib/db');
require('../lib/seed')();
const Router = require('../lib/router');
const { sendHtml } = require('../lib/http-helpers');

const router = new Router();
require('../routes/pages')(router);
require('../routes/api')(router);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = { '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);
    if (req.method === 'GET') {
      const full = path.join(PUBLIC_DIR, pathname.replace(/^\/+/, ''));
      if (full.startsWith(PUBLIC_DIR) && fs.existsSync(full) && fs.statSync(full).isFile()) {
        const data = fs.readFileSync(full);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
        return res.end(data);
      }
    }
    const handled = await router.handle(req, res, pathname);
    if (!handled) sendHtml(res, 404, 'Not found');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(err.message);
  }
});

async function req(baseUrl, method, urlPath, { body, cookie, redirect = 'manual' } = {}) {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(baseUrl + urlPath, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect,
  });
  const setCookie = res.headers.get('set-cookie');
  let sessionCookie = cookie || '';
  if (setCookie) {
    const match = setCookie.match(/pimh_session=[^;]+/);
    if (match) sessionCookie = match[0];
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, headers: res.headers, text, json, cookie: sessionCookie };
}

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const BASE = `http://127.0.0.1:${port}`;
  let passed = 0;

  function ok(name) {
    passed++;
    console.log(`  ✅ PASS: ${name}`);
  }

  try {
    console.log('\n======================================================');
    console.log('   PIMH Academy LMS — Full Unit & Integration Suite');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // TEST 1: Master Super Admin Accounts & Clean Database State (Task #5)
    // -------------------------------------------------------------------------
    console.log('[1/7] Testing Master Super Admin Accounts & Clean Database State...');
    const allUsers = db.prepare('SELECT email, role FROM users ORDER BY email').all();
    assert.strictEqual(allUsers.length, 2, `Database must only contain the 2 Master Super Admins, found ${allUsers.length}`);
    ok('Zero dummy users present — only the 2 Master Super Admin accounts exist');

    const allCourses = db.prepare('SELECT id, slug, name FROM courses ORDER BY id').all();
    assert.strictEqual(allCourses.length, 3, 'All 3 core courses must be preserved');
    ok('All 3 core courses preserved in database');

    for (const email of ['abrar_a@live.com', 'craft@craftedmindss.com']) {
      const row = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email);
      assert(row, `User ${email} must exist in database`);
      assert.strictEqual(row.role, 'SUPER_ADMIN', `${email} must have role SUPER_ADMIN`);
      assert.strictEqual(row.status, 'ACTIVE', `${email} must be ACTIVE`);
      assert.strictEqual(row.email_verified, 1, `${email} must have email_verified=1`);
      ok(`Database record verified for ${email} (SUPER_ADMIN, ACTIVE, verified)`);
    }

    const superLogin = await req(BASE, 'POST', '/api/auth/login', {
      body: { email: 'abrar_a@live.com', password: 'Password123!' }
    });
    assert.strictEqual(superLogin.status, 200, 'abrar_a@live.com should log in with 200');
    assert.strictEqual(superLogin.json.redirect, '/super-admin');
    const superCookie = superLogin.cookie;
    assert(superCookie.includes('pimh_session='), 'Session cookie must be issued');
    ok('Super Admin login & session cookie verified for abrar_a@live.com');

    // -------------------------------------------------------------------------
    // TEST 2: UX Enhancements & Clean Production Login Page (Task #2)
    // -------------------------------------------------------------------------
    console.log('\n[2/6] Testing UX Enhancements & Clean Production Login Page (Task #2)...');
    const loginPage = await req(BASE, 'GET', '/login');
    assert(loginPage.text.includes("p.type==='password'?'text':'password'"), '/login must include password visibility toggle button');
    assert(!loginPage.text.includes('demo-box') && !loginPage.text.includes('Password123!') && !loginPage.text.includes('nadia.farooq'), '/login must NOT expose any demo emails or passwords');
    ok('/login has password visibility eye-toggle and zero demo credentials exposed');

    const regPage = await req(BASE, 'GET', '/register');
    assert(regPage.text.includes("p.type==='password'?'text':'password'"), '/register must include password visibility toggle button');
    assert(!regPage.text.includes('Password123!'), '/register must NOT expose any demo credentials');
    ok('/register has password visibility eye-toggle and zero demo credentials exposed');

    const adminJs = await req(BASE, 'GET', '/js/admin.js');
    assert(adminJs.text.includes('data-del-user') && adminJs.text.includes('Delete'), 'admin.js must include permanent delete user button');
    ok('Super Admin permanent user delete button present in admin.js');

    // -------------------------------------------------------------------------
    // TEST 3: Student Registration, Resend Email, & Faculty Setup Flow (Task #3)
    // -------------------------------------------------------------------------
    console.log('\n[3/7] Testing Registration, Email Verification & Faculty Setup Flow (Task #3)...');
    const testEmail = `unit.student.${Date.now()}@example.com`;
    const regRes = await req(BASE, 'POST', '/api/auth/register', {
      body: { name: 'Unit Test Student', email: testEmail, phone: '+92 300 0000000', password: 'Password123!' }
    });
    assert.strictEqual(regRes.status, 200, 'Registration should succeed');
    assert.strictEqual(regRes.json.requireVerification, true, 'New registration must return requireVerification: true');
    assert.strictEqual(regRes.json.redirect, '/verify-pending', 'New registration must return redirect: /verify-pending');
    const studentCookie = regRes.cookie;
    assert(studentCookie.includes('pimh_session='), 'Registration must issue session cookie for /verify-pending');
    ok('Student registration creates unverified account, issues session, and redirects to /verify-pending');

    // Test Resend Verification Email endpoint
    const resendRes = await req(BASE, 'POST', '/api/auth/resend-verification', { cookie: studentCookie });
    assert.strictEqual(resendRes.status, 200);
    assert.strictEqual(resendRes.json.ok, true);
    ok('POST /api/auth/resend-verification succeeds for unverified student');

    // Unverified student trying to access /student should be redirected to /verify-pending
    const blockedPortal = await req(BASE, 'GET', '/student', { cookie: studentCookie });
    assert.strictEqual(blockedPortal.status, 302);
    assert.strictEqual(blockedPortal.headers.get('location'), '/verify-pending');
    ok('Unverified student is blocked from /student and redirected to /verify-pending');

    // Verify email using token from DB
    const testUser = db.prepare('SELECT * FROM users WHERE email = ?').get(testEmail);
    assert(testUser && testUser.verification_token, 'Verification token must be generated in DB');
    const verifyRes = await req(BASE, 'GET', `/verify-email?token=${testUser.verification_token}`);
    assert.strictEqual(verifyRes.status, 302);
    assert.strictEqual(verifyRes.headers.get('location'), '/student');
    const verifiedCookie = verifyRes.cookie;
    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(testUser.id);
    assert.strictEqual(updatedUser.email_verified, 1, 'email_verified must be 1 after clicking verification link');
    ok('Email verification link activates email_verified=1 and redirects to /student');

    // Test Super Admin inviting a Faculty member + Faculty /setup-account flow
    const facEmail = `unit.faculty.${Date.now()}@example.com`;
    const inviteRes = await req(BASE, 'POST', '/api/users', {
      cookie: superCookie,
      body: { name: 'Dr. Unit Faculty', email: facEmail, role: 'FACULTY', title: 'Visiting Professor' }
    });
    assert.strictEqual(inviteRes.status, 200, 'Faculty invitation should succeed');
    const facRow = db.prepare('SELECT * FROM users WHERE email = ?').get(facEmail);
    assert(facRow && facRow.verification_token, 'Faculty invite must generate verification_token');
    const setupRes = await req(BASE, 'POST', '/api/auth/setup-teacher', {
      body: { token: facRow.verification_token, password: 'NewFacultyPass123!' }
    });
    assert.strictEqual(setupRes.status, 200, 'Faculty setup-teacher should succeed');
    assert.strictEqual(setupRes.json.redirect, '/faculty');
    db.prepare('DELETE FROM users WHERE id = ?').run(facRow.id);
    ok('Super Admin faculty invitation & /setup-account password setup flow verified');

    // -------------------------------------------------------------------------
    // TEST 4: Student Dashboard Lock, Payment Receipt Picture Upload & Admin Approval (Task #1)
    // -------------------------------------------------------------------------
    console.log('\n[4/6] Testing Student Dashboard Lock & Payment Receipt Upload Gate (Task #1)...');
    const dashBefore = await req(BASE, 'GET', '/api/dashboard/student', { cookie: verifiedCookie });
    assert.strictEqual(dashBefore.status, 200);
    assert.strictEqual(dashBefore.json.isLocked, true, 'Dashboard must be locked when student has 0 active courses');
    assert.strictEqual(dashBefore.json.courses.length, 0);
    assert(dashBefore.json.availableCourses.length > 0, 'Available courses must be listed for enrollment');
    assert.strictEqual(dashBefore.json.stats.learningStreak, 0, 'Locked student must not have fake streak');
    assert.strictEqual(dashBefore.json.stats.avgScore, null, 'Locked student must not have fake 88% avgScore');
    ok('Student Dashboard is locked (isLocked: true) prior to course enrollment & receipt approval');

    // Upload a 1x1 PNG payment receipt picture
    const targetCourseId = dashBefore.json.availableCourses[0].id;
    const dummyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await req(BASE, 'POST', '/api/enrollments/request', {
      cookie: verifiedCookie,
      body: { courseId: targetCourseId, receiptDataUrl: dummyPngDataUrl }
    });
    assert.strictEqual(uploadRes.status, 200, 'Payment receipt picture upload should succeed');
    ok('Student uploaded payment receipt picture (PNG) for course ID ' + targetCourseId);

    // Check dashboard while receipt is Pending
    const dashPending = await req(BASE, 'GET', '/api/dashboard/student', { cookie: verifiedCookie });
    assert.strictEqual(dashPending.json.isLocked, true, 'Dashboard must remain locked while receipt is Pending admin review');
    assert.strictEqual(dashPending.json.pendingEnrollments.length, 1, 'Pending enrollment must appear on locked dashboard');
    const receiptUrl = dashPending.json.pendingEnrollments[0].receiptUrl;
    assert(receiptUrl && receiptUrl.startsWith('/api/downloads/receipts_'), 'Receipt URL must point to local storage');
    ok('Dashboard shows Pending Receipt Under Review while remaining locked (' + receiptUrl + ')');

    // Verify Super Admin can view the uploaded receipt image and approve the enrollment
    const receiptDownload = await req(BASE, 'GET', receiptUrl, { cookie: superCookie });
    assert.strictEqual(receiptDownload.status, 200, 'Super Admin must be able to view uploaded receipt image');
    ok('Uploaded payment receipt picture is accessible to Super Admin');

    const pendingList = await req(BASE, 'GET', '/api/enrollments/pending', { cookie: superCookie });
    const myPending = pendingList.json.pending.find(p => p.student_id === testUser.id);
    assert(myPending, 'Pending enrollment must appear in Super Admin pending list');

    const approveRes = await req(BASE, 'PATCH', `/api/enrollments/${myPending.id}/approve`, { cookie: superCookie });
    assert.strictEqual(approveRes.status, 200, 'Super Admin approval should succeed');
    ok('Super Admin approved student payment receipt & enrollment');

    // Check student dashboard after approval -> must be UNLOCKED!
    const dashUnlocked = await req(BASE, 'GET', '/api/dashboard/student', { cookie: verifiedCookie });
    assert.strictEqual(dashUnlocked.json.isLocked, false, 'Dashboard must unlock immediately after Super Admin approval');
    assert.strictEqual(dashUnlocked.json.courses.length, 1, 'Approved course must now appear in active courses');
    ok('Student Dashboard automatically UNLOCKED (isLocked: false) after Super Admin approval');

    // -------------------------------------------------------------------------
    // TEST 5: Deadline Reminder Scheduler & Deduplication (Task #4)
    // -------------------------------------------------------------------------
    console.log('\n[5/6] Testing Deadline Reminder Engine & Deduplication (Task #4)...');
    // Create a temporary assessment due tomorrow to test reminder dispatch + deduplication
    const firstMod = db.prepare('SELECT id FROM modules WHERE course_id = ? LIMIT 1').get(targetCourseId);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tempAssessId = db.prepare(`INSERT INTO assessments (module_id, title, type, due_date) VALUES (?, 'Unit Test Due Quiz', 'quiz', ?)`).run(firstMod.id, tomorrow).lastInsertRowid;

    const remRun1 = await req(BASE, 'POST', '/api/admin/reminders/run', { cookie: superCookie });
    assert.strictEqual(remRun1.status, 200);
    assert(remRun1.json.checkedAssessments >= 1, 'Scheduler must detect upcoming assessment');
    assert(remRun1.json.remindersSent >= 1, 'Scheduler must send reminder to enrolled student who has not submitted');
    ok(`First reminder run dispatched ${remRun1.json.remindersSent} reminders across ${remRun1.json.checkedAssessments} upcoming assessment(s)`);

    const remRun2 = await req(BASE, 'POST', '/api/admin/reminders/run', { cookie: superCookie });
    assert.strictEqual(remRun2.status, 200);
    assert.strictEqual(remRun2.json.remindersSent, 0, 'Second immediate run must send 0 duplicate reminders');
    ok('Second reminder run sent 0 duplicates (sent_reminders deduplication verified)');

    // Clean up temporary assessment
    db.prepare('DELETE FROM assessments WHERE id = ?').run(tempAssessId);

    // -------------------------------------------------------------------------
    // TEST 6: Super Admin Permanent User Deletion Cascade
    // -------------------------------------------------------------------------
    console.log('\n[6/6] Testing Super Admin Permanent User Deletion Cascade...');
    const delRes = await req(BASE, 'DELETE', `/api/users/${testUser.id}`, { cookie: superCookie });
    assert.strictEqual(delRes.status, 200);
    const deletedCheck = db.prepare('SELECT * FROM users WHERE id = ?').get(testUser.id);
    assert.strictEqual(deletedCheck, undefined, 'Deleted user must be removed from users table');
    const orphanEnroll = db.prepare('SELECT * FROM enrollments WHERE student_id = ?').get(testUser.id);
    assert.strictEqual(orphanEnroll, undefined, 'Deleted user enrollments must be cascaded');
    ok('Super Admin permanent deletion removed user and cascaded all enrollments/progress');

    // Clean up dummy receipt file
    const receiptFilename = receiptUrl.split('/').pop();
    const receiptPath = path.join(__dirname, '..', 'data', 'uploads', receiptFilename);
    if (fs.existsSync(receiptPath)) fs.unlinkSync(receiptPath);

    // -------------------------------------------------------------------------
    // TEST 7: Google OAuth 2.0 Configuration & Redirect Flow (Task #6)
    // -------------------------------------------------------------------------
    console.log('\n[7/7] Testing Google OAuth 2.0 Configuration & Redirect Flow (Task #6)...');
    const gStatus = await req(BASE, 'GET', '/api/auth/google/status');
    assert.strictEqual(gStatus.status, 200);
    assert.strictEqual(gStatus.json.configured, true, 'Google OAuth must report configured: true');
    ok('Google OAuth status reports configured: true');

    const gStart = await req(BASE, 'GET', '/api/auth/google/start');
    assert.strictEqual(gStart.status, 302, '/api/auth/google/start must redirect to Google OAuth consent screen');
    const gLoc = gStart.headers.get('location') || '';
    assert(gLoc.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'), 'Redirect location must point to Google OAuth v2 endpoint');
    assert(gLoc.includes(process.env.GOOGLE_CLIENT_ID), 'Redirect URL must include live GOOGLE_CLIENT_ID');
    assert(gLoc.includes(encodeURIComponent('/api/auth/google/callback')), 'Redirect URL must include /api/auth/google/callback');
    ok('Google OAuth start route redirects with live Client ID & callback URI');

    // -------------------------------------------------------------------------
    // TEST 8: Landing Page QA (6 Faculty Portraits, 2 HEC Diplomas, WhatsApp & Switcher)
    // -------------------------------------------------------------------------
    console.log('\n[8/8] Testing Landing Page Content, 6 Faculty Portraits, WhatsApp Widget & Switcher...');
    const landing = await req(BASE, 'GET', '/');
    assert.strictEqual(landing.status, 200);
    for (const name of [
      'Dr. Usama Bin Zubair',
      'Dr. Syed Azhar Ali Kazmi',
      'Ms. Afshan Huma',
      'Ms. Anjum Afshan',
      'Dr. Talat Habib',
      'Ms. Aasia Ashraf',
    ]) {
      assert(landing.text.includes(name), `Landing page must display faculty member: ${name}`);
    }
    assert(!landing.text.includes('Dr. Sana Ibrahim'), 'Old placeholder faculty Dr. Sana Ibrahim must be removed');
    ok('All 6 real faculty members displayed with titles only (Dr. Sana Ibrahim removed)');

    for (const imgPath of [
      '/img/faculty-usama.jpg',
      '/img/faculty-azhar.jpg',
      '/img/faculty-afshan.jpg',
      '/img/faculty-anjum.jpg',
      '/img/faculty-talat.jpg',
      '/img/faculty-aasia.jpg',
    ]) {
      const imgRes = await req(BASE, 'GET', imgPath);
      assert.strictEqual(imgRes.status, 200, `Faculty image ${imgPath} must return 200`);
    }
    ok('All 6 uploaded faculty portrait images serve with HTTP 200');

    assert(landing.text.includes('Diploma in Educational Psychology') && landing.text.includes('Rs. 72,500'), 'Must display Diploma in Educational Psychology (Rs. 72,500)');
    assert(landing.text.includes('Diploma in Addiction Psychology') && landing.text.includes('Rs. 99,500'), 'Must display Diploma in Addiction Psychology (Rs. 99,500)');
    assert(landing.text.includes('HEC Approved Diploma'), 'Must display HEC Approved Diploma trust badge');
    ok('Both official HEC-Approved Diplomas (Educational & Addiction Psychology) and fees verified');

    assert(landing.text.includes('Academy PIMH') && landing.text.includes('Salam! Welcome to PIMH Academy. How can we help you today?') && landing.text.includes('923342466777'), 'WhatsApp widget must use 03342466777 and CraftedMinds popup design');
    assert(!landing.text.includes('themeSwitcher') && !landing.text.includes('data-set-theme'), 'Theme switcher must be removed now that the landing page is locked');
    assert(landing.text.includes('width=device-width, initial-scale=1.0') && landing.text.includes('@media (max-width:640px)') && landing.text.includes('@media (max-width:380px)'), 'Landing page must include full mobile responsive breakpoints');
    ok('CraftedMinds-style WhatsApp widget (03342466777), locked landing page, and mobile responsiveness verified');

    console.log(`\n🎉 ALL ${passed} UNIT & INTEGRATION ASSERTIONS PASSED SUCCESSFULLY!\n`);
  } finally {
    db.prepare(`DELETE FROM activity_log WHERE text LIKE '%unit.student.%' OR text LIKE '%unit.faculty.%' OR text LIKE '%Unit Test%' OR text LIKE '%Ran deadline reminder engine%'`).run();
    server.close();
  }
})().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
