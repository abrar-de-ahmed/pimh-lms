'use strict';
const fs = require('node:fs');
const path = require('node:path');
const auth = require('../lib/auth');
const { sendHtml, redirect } = require('../lib/http-helpers');
const { page, shell, sidebarLink } = require('../views/layout');
const google = require('../lib/google');

function readFile(rel) {
  return fs.readFileSync(path.join(__dirname, '..', 'views', rel), 'utf8');
}

const STUDENT_LINKS = [
  sidebarLink('dashboard', 'Dashboard', 'dashboard'),
  sidebarLink('catalog', 'Course Catalog', 'catalog'),
  sidebarLink('courses', 'My Courses', 'courses'),
  sidebarLink('materials', 'Materials', 'materials'),
  sidebarLink('schedule', 'Schedule', 'schedule'),
  sidebarLink('grades', 'Grades', 'grades'),
  sidebarLink('discussion', 'Discussion', 'discussion'),
  sidebarLink('announcements', 'Announcements', 'announcements'),
  sidebarLink('notifications', 'Notifications', 'notifications'),
  sidebarLink('certificates', 'Certificates', 'certificates'),
  sidebarLink('profile', 'Profile', 'profile'),
].join('\n');

const FACULTY_LINKS = [
  sidebarLink('dashboard', 'Dashboard', 'dashboard'),
  sidebarLink('classes', 'My Classes', 'courses'),
  sidebarLink('grading', 'Grading', 'grades'),
  sidebarLink('discussion', 'Discussion', 'discussion'),
  sidebarLink('announcements', 'Announcements', 'announcements'),
  sidebarLink('roster', 'Roster', 'roster'),
  sidebarLink('profile', 'Profile', 'profile'),
].join('\n');

function adminLinks(isSuper) {
  const links = [
    sidebarLink('dashboard', 'Dashboard', 'dashboard'),
    sidebarLink('users', 'Users', 'users'),
    sidebarLink('courses', 'Courses', 'courses'),
    sidebarLink('enrollment', 'Enrollment', 'enrollment'),
    sidebarLink('faculty', 'Faculty', 'faculty'),
    sidebarLink('announcements', 'Announcements', 'announcements'),
    sidebarLink('activity', 'Activity Log', 'activity'),
  ];
  if (isSuper) links.push(sidebarLink('settings', 'Settings', 'settings'));
  links.push(sidebarLink('profile', 'Profile', 'profile'));
  return links.join('\n');
}

module.exports = function register(router) {
  router.get('/', async (req, res) => {
    const user = auth.currentUser(req);
    if (user) return redirect(res, auth.ROLE_HOME[user.role]);
    sendHtml(res, 200, readFile('landing.html'));
  });

  router.get('/login', async (req, res) => {
    const user = auth.currentUser(req);
    if (user) return redirect(res, auth.ROLE_HOME[user.role]);
    sendHtml(res, 200, page({
      title: 'Log in — PIMH Academy',
      headExtra: '<link rel="stylesheet" href="/css/auth.css">',
      bodyHtml: readFile('auth-login.html'),
      bootJson: { googleConfigured: google.isConfigured() },
      clientScripts: ['/js/auth.js'],
    }));
  });

  router.get('/register', async (req, res) => {
    const user = auth.currentUser(req);
    if (user) return redirect(res, auth.ROLE_HOME[user.role]);
    sendHtml(res, 200, page({
      title: 'Create account — PIMH Academy',
      headExtra: '<link rel="stylesheet" href="/css/auth.css">',
      bodyHtml: readFile('auth-register.html'),
      bootJson: { googleConfigured: google.isConfigured() },
      clientScripts: ['/js/auth.js'],
    }));
  });

  function guard(req, res, roles) {
    const user = auth.currentUser(req);
    if (!user) { redirect(res, '/login'); return null; }
    
    // Email Verification Blocker 
    if (user.email_verified === 0 && user.role !== 'SUPER_ADMIN') {
      redirect(res, '/verify-pending');
      return null;
    }
    
    if (!roles.includes(user.role)) { redirect(res, auth.ROLE_HOME[user.role]); return null; }
    return user;
  }

  router.get('/verify-pending', async (req, res) => {
    const user = auth.currentUser(req);
    if (!user) return redirect(res, '/login');
    if (user.email_verified === 1) return redirect(res, auth.ROLE_HOME[user.role]);
    
    sendHtml(res, 200, page({
      title: 'Verify Your Email — PIMH Academy',
      headExtra: '<link rel="stylesheet" href="/css/auth.css">',
      bodyHtml: readFile('verify-pending.html'),
      bootJson: {},
    }));
  });

  router.get('/verify-email', async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const token = url.searchParams.get('token');
    if (!token) return redirect(res, '/login');
    
    const db = require('../lib/db');
    const user = db.prepare('SELECT * FROM users WHERE verification_token=?').get(token);
    if (!user) {
      return sendHtml(res, 200, page({
        title: 'Invalid Link',
        bodyHtml: '<div style="text-align:center; padding: 4rem;"><h2>Invalid or expired verification link.</h2><a href="/login" class="btn btn-dark">Log In</a></div>',
      }));
    }
    
    db.prepare('UPDATE users SET email_verified=1, verification_token=NULL WHERE id=?').run(user.id);
    logActivity(user.id, `Verified email address`);
    
    // Auto login
    const session = auth.createSession(user.id);
    auth.setCookie(res, 'pimh_session', session.token, { maxAge: 30 * 24 * 60 * 60 });
    
    redirect(res, auth.ROLE_HOME[user.role]);
  });

  router.get('/setup-account', async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const token = url.searchParams.get('token');
    if (!token) return redirect(res, '/login');
    
    sendHtml(res, 200, page({
      title: 'Setup Account — PIMH Academy',
      headExtra: '<link rel="stylesheet" href="/css/auth.css">',
      bodyHtml: readFile('setup-account.html'),
      bootJson: {},
    }));
  });

  router.get('/student', async (req, res) => {
    const user = guard(req, res, ['STUDENT']); if (!user) return;
    sendHtml(res, 200, page({
      title: 'Student Dashboard — PIMH Academy',
      headExtra: '<link rel="stylesheet" href="/css/app.css">',
      bodyHtml: shell({ user, brandRole: 'Student', links: STUDENT_LINKS, pageTitleDefault: 'Dashboard' }),
      bootJson: { user },
      clientScripts: ['/js/common.js', '/js/student.js'],
    }));
  });

  router.get('/faculty', async (req, res) => {
    const user = guard(req, res, ['FACULTY']); if (!user) return;
    sendHtml(res, 200, page({
      title: 'Faculty Portal — PIMH Academy',
      headExtra: '<link rel="stylesheet" href="/css/app.css">',
      bodyHtml: shell({ user, brandRole: 'Faculty Portal', links: FACULTY_LINKS, pageTitleDefault: 'Dashboard' }),
      bootJson: { user },
      clientScripts: ['/js/common.js', '/js/faculty.js'],
    }));
  });

  router.get('/admin', async (req, res) => {
    const user = guard(req, res, ['ADMIN']); if (!user) return;
    sendHtml(res, 200, page({
      title: 'Admin Portal — PIMH Academy',
      headExtra: '<link rel="stylesheet" href="/css/app.css">',
      bodyHtml: shell({ user, brandRole: 'Admin', links: adminLinks(false), pageTitleDefault: 'Dashboard' }),
      bootJson: { user, isSuperAdmin: false },
      clientScripts: ['/js/common.js', '/js/admin.js'],
    }));
  });

  router.get('/super-admin', async (req, res) => {
    const user = guard(req, res, ['SUPER_ADMIN']); if (!user) return;
    sendHtml(res, 200, page({
      title: 'Super Admin — PIMH Academy',
      headExtra: '<link rel="stylesheet" href="/css/app.css">',
      bodyHtml: shell({ user, brandRole: 'Super Admin', brandGold: true, links: adminLinks(true), pageTitleDefault: 'Dashboard' }),
      bootJson: { user, isSuperAdmin: true },
      clientScripts: ['/js/common.js', '/js/admin.js'],
    }));
  });
};
