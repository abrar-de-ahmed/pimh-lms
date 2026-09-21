'use strict';
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const errors = [];
const results = [];

function log(msg) { results.push(msg); console.log(msg); }

async function withPage(browser, fn, label) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1600 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.setDefaultNavigationTimeout(10000);
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(label + ': console error: ' + msg.text()); });
  page.on('pageerror', (err) => errors.push(label + ': page error: ' + err.message));
  page.on('response', (res) => {
    if (res.status() >= 500) errors.push(label + ': HTTP ' + res.status() + ' on ' + res.url());
  });
  try {
    await fn(page);
  } catch (e) {
    errors.push(label + ': EXCEPTION: ' + e.message);
  } finally {
    await ctx.close();
  }
}

async function login(page, email, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('button[type=submit]')]);
}

async function clickAllSidebarViews(page, label) {
  const links = await page.$$eval('.sb-link[data-view]', (els) => els.map((e) => e.getAttribute('data-view')));
  for (const view of links) {
    await page.click('.sb-link[data-view="' + view + '"]');
    await page.waitForTimeout(400);
    const activeVisible = await page.$('#view-' + view + '.active');
    if (!activeVisible) errors.push(label + ': view "' + view + '" did not become active');
    log(label + ': opened view "' + view + '"');
  }
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  // 1. Landing page
  await withPage(browser, async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    log('Landing loaded: ' + title);
    await page.click('[data-open-apply]');
    await page.waitForTimeout(200);
    await page.fill('#applyName', 'QA Tester');
    await page.fill('#applyEmail', 'qa.tester@example.com');
    await page.click('#applyForm button[type=submit]');
    await page.waitForTimeout(400);
    const noteVisible = await page.$('.apply-note.show');
    if (!noteVisible) errors.push('Landing: apply form did not show confirmation');
    log('Landing: apply form submitted');
    await page.click('#applyClose');
    await page.waitForTimeout(200);
    // FAQ toggle
    await page.click('.faq-q');
    await page.waitForTimeout(200);
    const faqOpen = await page.$('.faq-item.open');
    if (!faqOpen) errors.push('Landing: FAQ did not open');
    log('Landing: FAQ toggled');
    // WhatsApp popup
    await page.click('#waToggle');
    await page.waitForTimeout(200);
  }, 'Landing');

  // 2. Register flow
  await withPage(browser, async (page) => {
    await page.goto(BASE + '/register', { waitUntil: 'domcontentloaded' });
    const uniqueEmail = 'qa.student.' + Date.now() + '@example.com';
    await page.fill('#name', 'QA Student');
    await page.fill('#email', uniqueEmail);
    await page.fill('#password', 'TestPass123!');
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('#registerForm button[type=submit]')]);
    const url = page.url();
    if (!url.includes('/student')) errors.push('Register: did not redirect to /student, got ' + url);
    log('Register: new student account created and redirected to ' + url);
  }, 'Register');

  // 3. Student portal
  await withPage(browser, async (page) => {
    await login(page, 'ayesha.zaman@student.pimh.edu.pk', 'Password123!');
    log('Student: logged in, at ' + page.url());
    await clickAllSidebarViews(page, 'Student');

    // Take a quiz from My Courses
    await page.click('.sb-link[data-view="courses"]');
    await page.waitForTimeout(600);
    const quizCount = await page.locator('#view-courses [data-quiz-open]').count();
    if (quizCount > 0) {
      await page.locator('#view-courses [data-quiz-open]').first().click();
      await page.waitForTimeout(300);
      await page.click('#quizStart');
      await page.waitForTimeout(300);
      const optionCount = await page.locator('.quiz-option').count();
      const seenQ = new Set();
      for (let i = 0; i < optionCount; i++) {
        const opt = page.locator('.quiz-option').nth(i);
        const qid = await opt.getAttribute('data-qid');
        if (seenQ.has(qid)) continue;
        seenQ.add(qid);
        await opt.click();
      }
      await page.click('#quizSubmit');
      await page.waitForSelector('.quiz-score', { timeout: 4000 }).catch(()=>console.log('timeout waiting for quiz-score'));
      const scoreCount = await page.locator('.quiz-score').count();
      if (scoreCount === 0) errors.push('Student: quiz did not show a score after submit');
      else log('Student: quiz completed with score ' + (await page.locator('.quiz-score').textContent()));
      await page.locator('#quizDone').click({ timeout: 2000 }).catch(()=>{});
      await page.waitForTimeout(400);
    } else {
      log('Student: no quiz button found to test (may already be complete)');
    }

    // Mark a module complete if available
    await page.waitForTimeout(300);
    const markCount = await page.locator('#view-courses [data-mark-complete]').count();
    if (markCount > 0) { await page.locator('#view-courses [data-mark-complete]').first().click(); await page.waitForTimeout(400); log('Student: marked a module complete'); }

    // Post in discussion
    await page.click('.sb-link[data-view="discussion"]');
    await page.waitForTimeout(600);
    const textareaCount = await page.locator('#view-discussion .composer-text').count();
    if (textareaCount > 0) {
      await page.locator('#view-discussion .composer-text').first().fill('QA smoke test post.');
      await page.locator('#view-discussion .composer .composer-send').first().click();
      await page.waitForResponse(res => res.url().includes('/posts') && res.status() === 200).catch(()=>{});
      await page.waitForTimeout(400);
      log('Student: posted a discussion message');
    }

    // Profile update
    await page.click('.sb-link[data-view="profile"]');
    await page.waitForTimeout(400);
    await page.fill('#profPhone', '+92 300 0000000');
    await page.click('#profileForm button[type=submit]');
    await page.waitForResponse(res => res.url().includes('/profile') && res.status() === 200).catch(()=>{});
    await page.waitForTimeout(300);
    log('Student: profile saved');
  }, 'Student');

  // 4. Faculty portal
  await withPage(browser, async (page) => {
    await login(page, 'usama.zubair@pimh.edu.pk', 'Password123!');
    log('Faculty: logged in, at ' + page.url());
    await clickAllSidebarViews(page, 'Faculty');

    await page.click('.sb-link[data-view="grading"]');
    await page.waitForTimeout(500);
    const gradeBtnCount = await page.locator('#view-grading [data-grade-open]').count();
    if (gradeBtnCount > 0) {
      await page.locator('#view-grading [data-grade-open]').first().click();
      await page.waitForTimeout(200);
      await page.fill('#gradeScore', '88');
      await page.click('#gradeSave');
      await page.waitForResponse(res => res.url().includes('/grade') && res.status() === 200).catch(()=>{});
      await page.waitForTimeout(400);
      log('Faculty: graded a submission');
    } else {
      log('Faculty: no ungraded submission found to test');
    }

    await page.click('.sb-link[data-view="classes"]');
    await page.waitForTimeout(600);
    const addModuleCount = await page.locator('[data-add-module]').count();
    if (addModuleCount > 0) {
      const addModuleBtn = page.locator('[data-add-module]').first();
      const cid = await addModuleBtn.getAttribute('data-add-module');
      await page.fill('[data-new-module-input="' + cid + '"]', 'QA Test Module');
      await addModuleBtn.click();
      await page.waitForTimeout(400);
      log('Faculty: added a module');
    }

    await page.click('.sb-link[data-view="announcements"]');
    await page.waitForTimeout(400);
    await page.fill('#fAnnTitle', 'QA announcement');
    await page.fill('#fAnnMessage', 'This is a QA smoke test announcement.');
    await page.click('#fAnnounceForm button[type=submit]');
    await page.waitForResponse(res => res.url().includes('/announcements') && res.status() === 200).catch(()=>{});
    await page.waitForTimeout(400);
    log('Faculty: posted a course announcement');
  }, 'Faculty');

  // 5. Admin portal
  await withPage(browser, async (page) => {
    await login(page, 'imran.qureshi@pimh.edu.pk', 'Password123!');
    log('Admin: logged in, at ' + page.url());
    await clickAllSidebarViews(page, 'Admin');

    await page.click('.sb-link[data-view="courses"]');
    await page.waitForTimeout(500);
    await page.click('#addCourseBtn');
    await page.waitForTimeout(200);
    await page.fill('#cName', 'QA Test Course');
    await page.fill('#cDesc', 'Created by smoke test.');
    await page.click('#cSave');
    await page.waitForResponse(res => res.url().includes('/courses') && res.status() === 200).catch(()=>{});
    await page.waitForTimeout(400);
    log('Admin: created a course');

    await page.click('.sb-link[data-view="enrollment"]');
    await page.waitForTimeout(600);
    const cbCount = await page.locator('.tab-panel.active [data-enroll-toggle]').count();
    if (cbCount > 0) {
      // the checkbox itself is visually hidden (custom toggle switch styling) — click its visible track instead
      await page.locator('.tab-panel.active label.toggle:has([data-enroll-toggle])').first().locator('.toggle-track').click();
      await page.waitForTimeout(400);
      log('Admin: toggled an enrollment');
    }

    await page.click('.sb-link[data-view="users"]');
    await page.waitForTimeout(500);
    await page.click('[data-users-tab="students"]');
    await page.waitForTimeout(300);
    await page.click('#addStudentBtn');
    await page.waitForTimeout(200);
    await page.fill('#uName', 'QA New Student');
    await page.fill('#uEmail', 'qa.newstudent.' + Date.now() + '@example.com');
    await page.click('#uSave');
    await page.waitForResponse(res => res.url().includes('/users') && res.status() === 200).catch(()=>{});
    await page.waitForTimeout(400);
    log('Admin: created a student account');
  }, 'Admin');

  // 6. Super Admin portal
  await withPage(browser, async (page) => {
    await login(page, 'nadia.farooq@pimh.edu.pk', 'Password123!');
    log('SuperAdmin: logged in, at ' + page.url());
    await clickAllSidebarViews(page, 'SuperAdmin');

    await page.click('.sb-link[data-view="settings"]');
    await page.waitForTimeout(400);
    await page.fill('#setPassMark', '75');
    await page.click('#settingsForm button[type=submit]');
    await page.waitForResponse(res => res.url().includes('/settings') && res.status() === 200).catch(()=>{});
    await page.waitForTimeout(400);
    log('SuperAdmin: saved settings');

    await page.click('.sb-link[data-view="users"]');
    await page.waitForTimeout(500);
    await page.click('#addTeacherBtn');
    await page.waitForTimeout(200);
    await page.fill('#uName', 'QA New Teacher');
    await page.fill('#uEmail', 'qa.newteacher.' + Date.now() + '@example.com');
    await page.fill('#uTitle', 'Faculty — QA');
    await page.click('#uSave');
    await page.waitForResponse(res => res.url().includes('/users') && res.status() === 200).catch(()=>{});
    await page.waitForTimeout(400);
    log('SuperAdmin: created a teacher account');

    await page.click('.sb-link[data-view="faculty"]');
    await page.waitForTimeout(500);
    const reassignCount = await page.locator('[data-reassign]').count();
    if (reassignCount > 0) {
      await page.locator('[data-reassign]').first().click();
      await page.waitForTimeout(200);
      await page.click('#reassignSave');
      await page.waitForResponse(res => res.url().includes('/reassign') && res.status() === 200).catch(()=>{});
      await page.waitForTimeout(400);
      log('SuperAdmin: reassigned faculty');
    }
  }, 'SuperAdmin');

  await browser.close();

  console.log('\n\n=== RESULTS (' + results.length + ') ===');
  console.log('\n=== ERRORS (' + errors.length + ') ===');
  errors.forEach((e) => console.log('ERROR: ' + e));
  if (errors.length > 0) process.exitCode = 1;
})().catch((e) => { console.error('FATAL: ' + e.stack); process.exitCode = 2; });
