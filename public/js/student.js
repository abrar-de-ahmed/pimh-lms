(function () {
  var P = window.PIMH;
  var api = P.api, esc = P.esc, showToast = P.showToast, timeAgo = P.timeAgo, fmtDate = P.fmtDate;
  var content = document.getElementById('content');
  var boot = window.__BOOT__ || {};
  var me = boot.user;

  var titles = {
    dashboard: 'Dashboard', courses: 'My Courses', materials: 'Materials', schedule: 'Class Schedule',
    grades: 'Grades', discussion: 'Discussion', announcements: 'Announcements', notifications: 'Notifications',
    certificates: 'Certificates', profile: 'Profile',
  };

  var state = { courses: [], dash: null };

  function viewShell(name) {
    return '<section class="view" id="view-' + name + '"></section>';
  }
  content.innerHTML = Object.keys(titles).map(viewShell).join('');

  // ---------------- DASHBOARD ----------------
  function renderDashboard() {
    return api('/api/dashboard/student').then(function (d) {
      state.dash = d;
      var stats = d.stats || { activeCourses: d.courses.length, completedModules: 0, totalModules: 0, learningStreak: 5, avgScore: d.overallProgress };
      
      var html = '<div class="welcome"><h2>Welcome back, ' + esc(d.name.split(' ')[0]) + '</h2>' +
        '<p>You\'re ' + d.overallProgress + '% through this cohort. Here\'s your progress dashboard.</p></div>';

      // Stat Tiles Grid
      html += '<div class="stat-grid">' +
        '<div class="stat-tile sky"><div class="stat-tile-icon">📚</div><div class="stat-tile-body"><span class="num">' + stats.activeCourses + '</span><span class="label">Enrolled Courses</span></div></div>' +
        '<div class="stat-tile good"><div class="stat-tile-icon">✅</div><div class="stat-tile-body"><span class="num">' + stats.completedModules + ' / ' + stats.totalModules + '</span><span class="label">Modules Completed</span></div></div>' +
        '<div class="stat-tile fire"><div class="stat-tile-icon">🔥</div><div class="stat-tile-body"><span class="num">' + stats.learningStreak + ' Days</span><span class="label">Active Streak</span></div></div>' +
        '<div class="stat-tile gold"><div class="stat-tile-icon">🎯</div><div class="stat-tile-body"><span class="num">' + (stats.avgScore != null ? stats.avgScore + '%' : '—') + '</span><span class="label">Avg Score</span></div></div>' +
        '</div>';

      // Resume Learning Hero Banner (if available)
      if (d.resumeModule) {
        html += '<div class="resume-card">' +
          '<div class="resume-card-body"><h3>Resume: ' + esc(d.resumeModule.title) + '</h3>' +
          '<p>' + esc(d.resumeModule.courseName) + '</p>' +
          '<div class="resume-meta"><span>Current progress: ' + d.resumeModule.pct + '%</span> · <span>Status: ' + (d.resumeModule.status === 'in_progress' ? 'In progress' : 'Ready to start') + '</span></div></div>' +
          '<button type="button" class="resume-btn" data-view="courses">Continue Lesson &#8594;</button>' +
          '</div>';
      }

      html += '<div class="dash-grid"><div>';
      
      // Progress & Courses
      html += '<div class="card"><div class="progress-hero">' + ringSvg(d.overallProgress) +
        '<div class="figures"><span class="label" style="font-weight:600; color:var(--ink);">Overall diploma progress</span>' +
        '<div class="sub">' + d.courses.length + ' active course' + (d.courses.length === 1 ? '' : 's') + ' this term</div></div></div></div>';

      html += '<div class="card"><div class="card-head"><h3>My courses</h3><a href="#" data-view="courses">View all</a></div>';
      if (d.courses.length === 0) html += '<p class="section-sub" style="margin:0;">You are not enrolled in any course yet. Contact admissions once your seat is confirmed.</p>';
      d.courses.forEach(function (c) {
        html += '<div class="course-row"><div class="course-icon">' + courseIconSvg() + '</div>' +
          '<div class="course-info"><div class="name">' + esc(c.name) + '</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + c.progress + '%"></div></div></div>' +
          '<div class="course-pct">' + c.progress + '%</div></div>';
      });
      html += '</div>';

      // Recent Grades & Feedback Card
      if (d.recentGrades && d.recentGrades.length > 0) {
        html += '<div class="card"><div class="card-head"><h3>Recent Grades & Teacher Feedback</h3><a href="#" data-view="grades">View all grades</a></div>';
        d.recentGrades.forEach(function (g) {
          var pill = g.status === 'graded' ? '<span class="pill pill-done">Graded</span>' : '<span class="pill pill-open">Awaiting grade</span>';
          html += '<div class="recent-grade-row">' +
            '<div class="recent-grade-head"><span class="recent-grade-title">' + esc(g.title) + ' (' + esc(g.courseName) + ')</span>' +
            '<span class="recent-grade-score">' + (g.score != null ? g.score + '%' : pill) + '</span></div>';
          if (g.feedback) {
            html += '<div class="feedback-quote">“' + esc(g.feedback) + '” — Instructor</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      }

      html += '</div><div>';

      // Next Class
      html += '<div class="card"><div class="card-head"><h3>Next class</h3><a href="#" data-view="schedule">View schedule</a></div>';
      if (d.nextEvent) {
        html += '<div class="schedule-list">' + scheduleItemHtml(d.nextEvent, true) + '</div>';
      } else {
        html += '<p class="section-sub" style="margin:0;">No upcoming sessions scheduled.</p>';
      }
      html += '</div>';

      // Due Soon
      html += '<div class="card"><div class="card-head"><h3>Due soon</h3></div>';
      if (d.dueSoon.length === 0) html += '<p class="section-sub" style="margin:0;">Nothing due right now.</p>';
      d.dueSoon.forEach(function (t) {
        html += '<div class="task-row"><span class="task-chip chip-due">Due ' + fmtDate(t.dueDate) + '</span>' +
          '<div class="task-body"><div class="t-name">' + esc(t.title) + '</div><div class="t-meta">' + esc(t.courseName) + '</div></div>' +
          (t.type === 'quiz' ? '<button type="button" class="task-start-btn" data-quiz-open="' + t.assessmentId + '">Start Quiz</button>' : '<button type="button" class="task-start-btn" data-assignment-open="' + t.assessmentId + '" data-assignment-title="' + esc(t.title) + '">Submit</button>') +
          '</div>';
      });
      html += '</div>';

      // Quick Study Resources Widget
      if (d.recentMaterials && d.recentMaterials.length > 0) {
        html += '<div class="card"><div class="card-head"><h3>Quick Study Resources</h3><a href="#" data-view="materials">View all</a></div>';
        html += '<div class="quick-res-list">';
        d.recentMaterials.forEach(function (m) {
          var linkHtml = (!m.url || m.url === '#') ? '<span class="quick-res-name" style="color:var(--slate);">' + esc(m.title) + '</span>' : '<a class="quick-res-name" href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(m.title) + '</a>';
          html += '<div class="quick-res-item"><div class="quick-res-icon">' + (m.type === 'link' ? '🔗' : '📄') + '</div>' +
            '<div class="quick-res-info">' + linkHtml + '<div class="quick-res-sub">' + esc(m.courseName) + '</div></div></div>';
        });
        html += '</div></div>';
      }

      // Notifications
      html += '<div class="card"><div class="card-head"><h3>Notifications</h3><a href="#" data-view="notifications">View all</a></div>';
      if (d.notifications.length === 0) html += '<p class="section-sub" style="margin:0;">No notifications yet.</p>';
      d.notifications.forEach(function (n) {
        html += '<div class="notif-row' + (n.isRead ? '' : ' unread') + '"><span class="notif-dot"></span><div><div class="notif-text">' + esc(n.text) + '</div><div class="notif-time">' + timeAgo(n.createdAt) + '</div></div></div>';
      });
      html += '</div></div></div>';

      document.getElementById('view-dashboard').innerHTML = html;
    });
  }

  function ringSvg(pct) {
    var r = 46, c = 2 * Math.PI * r;
    var offset = c - (c * pct) / 100;
    return '<svg class="ring" viewBox="0 0 110 110"><circle cx="55" cy="55" r="' + r + '" fill="none" stroke="#E8E3D3" stroke-width="10"/>' +
      '<circle cx="55" cy="55" r="' + r + '" fill="none" stroke="#4F6F52" stroke-width="10" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" stroke-linecap="round" transform="rotate(-90 55 55)"/>' +
      '<text x="55" y="60" text-anchor="middle" font-family="Newsreader" font-size="20" fill="#16232A">' + pct + '%</text></svg>';
  }
  function courseIconSvg() {
    return '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4 h6 a2 2 0 0 1 2 2 v10 a2 2 0 0 0 -2 -2 H3 Z"/><path d="M17 4 h-6 a2 2 0 0 0 -2 2 v10 a2 2 0 0 1 2 -2 h6 Z"/></svg>';
  }
  function scheduleItemHtml(ev, upcoming) {
    var d = new Date((ev.date || ev.event_date) + 'T00:00:00');
    var day = d.toLocaleDateString(undefined, { weekday: 'short' });
    var num = d.getDate();
    var mon = d.toLocaleDateString(undefined, { month: 'short' });
    return '<div class="schedule-item"><div class="schedule-date"><div class="sd-day">' + day + '</div><div class="sd-num">' + num + '</div><div class="sd-mon">' + mon + '</div></div>' +
      '<div class="schedule-body"><div class="sc-title">' + esc(ev.title) + '</div><div class="sc-meta"><span>' + esc(ev.courseName || '') + '</span>' + (ev.time ? '<span>' + esc(ev.time) + '</span>' : '') + '</div></div>' +
      '<span class="sc-badge ' + (upcoming ? 'upcoming' : 'past') + '">' + (upcoming ? 'Upcoming' : 'Past') + '</span></div>';
  }

  // ---------------- MY COURSES ----------------
  function loadCourses() {
    return api('/api/courses').then(function (d) { state.courses = d.courses; return d.courses; });
  }

  function renderCourses() {
    return loadCourses().then(function (courses) {
      var html = '<h2 class="section-title">My Courses</h2>';
      if (courses.length === 0) html += '<p class="section-sub">You are not enrolled in any course yet.</p>';
      courses.forEach(function (c) {
        html += '<div class="course-detail"><div class="cd-head"><h3>' + esc(c.name) + '</h3><span class="cd-pct">' + c.avgProgress + '% complete</span></div>';
        html += '<div class="module-list" data-course-id="' + c.id + '">';
        c.modules.forEach(function (m, i) {
          html += moduleRowHtml(m, i, c);
        });
        html += '</div></div>';
      });
      document.getElementById('view-courses').innerHTML = html;
    });
  }

  function moduleRowHtml(m, idx, course) {
    var mid = 'mod-' + m.id;
    var cls = 'm-locked';
    var status = 'Locked';
    var sub = '';
    var pctLabel = '<span id="' + mid + '-pct" class="m-pct-label">…</span>';
    var barId = mid + '-bar';
    var actionHtml = '';
    return '<div class="module ' + cls + '" id="' + mid + '" data-module-id="' + m.id + '" data-course-id="' + course.id + '">' +
      '<div class="m-icon" id="' + mid + '-icon"></div>' +
      '<div class="m-info"><div class="m-name">' + esc(m.title) + '</div>' +
      '<div class="m-progress"><div class="bar-track"><div class="bar-fill" id="' + barId + '" style="width:0%"></div></div>' + pctLabel + '</div></div>' +
      '<div class="m-status-col"><div class="m-status" id="' + mid + '-status">' + status + '</div><div class="m-sub" id="' + mid + '-sub">' + sub + '</div></div>' +
      '<div id="' + mid + '-action"></div></div>';
  }

  function hydrateModules() {
    document.querySelectorAll('#view-courses .module').forEach(function (row) {
      var moduleId = row.getAttribute('data-module-id');
      api('/api/assessments/by-module-not-used').catch(function () {}); // no-op guard
    });
  }

  // Fetch module progress + any assessment for each module via a combined endpoint would be nicer;
  // reuse /api/courses response's modules and query per-module assessment lazily using discussion/materials endpoints is heavy.
  // Instead: fetch full course detail (progress+assessment) via dedicated calls.
  function loadModuleDetail(moduleId) {
    return api('/api/module-detail/' + moduleId);
  }

  // We didn't register /api/module-detail on the server; use existing endpoints instead by augmenting dashboard/courses payload.
  // Simpler approach: request course list already includes modules; fetch per-module progress from /api/courses again is wasteful.
  // So: extend rendering using data embedded via /api/courses (id/title only) + separate call for progress per student is done server-side already in dashboard.
  // To keep this simple and correct, we fetch a richer per-course endpoint:
  function loadCourseFull(courseId) {
    return api('/api/course-detail/' + courseId);
  }

  window.PIMH.studentInit = function () {
    P.initViewSwitching(titles, function (name) {
      if (name === 'dashboard') renderDashboard();
      if (name === 'courses') renderCoursesFull();
      if (name === 'materials') renderMaterials();
      if (name === 'schedule') renderSchedule();
      if (name === 'grades') renderGrades();
      if (name === 'discussion') renderDiscussion();
      if (name === 'announcements') renderAnnouncements();
      if (name === 'notifications') renderNotifications();
      if (name === 'certificates') renderCertificates();
      if (name === 'profile') renderProfile();
    });
  };

  // ---------------- MY COURSES (full, using /api/course-detail) ----------------
  function renderCoursesFull() {
    return api('/api/courses').then(function (d) {
      var courses = d.courses;
      state.courses = courses;
      return Promise.all(courses.map(function (c) { return api('/api/course-detail/' + c.id); }));
    }).then(function (details) {
      var html = '<h2 class="section-title">My Courses</h2>';
      if (details.length === 0) html += '<p class="section-sub">You are not enrolled in any course yet. Once admissions confirms your seat you\'ll see your modules here.</p>';
      details.forEach(function (c) {
        html += '<div class="course-detail"><div class="cd-head"><h3>' + esc(c.name) + '</h3><span class="cd-pct">' + c.avgProgress + '% complete</span></div><div class="module-list">';
        c.modules.forEach(function (m) {
          var cls = m.status === 'done' ? 'm-done' : m.status === 'in_progress' ? 'm-current' : 'm-locked';
          var icon = m.status === 'done' ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#fff" stroke-width="1.8"><path d="M3 7 l3 3 l5 -6"/></svg>'
            : m.status === 'in_progress' ? '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="#fff"/></svg>'
            : '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="5" width="7" height="5.5" rx="1"/><path d="M4 5 v-1.5 a2 2 0 0 1 4 0 V5"/></svg>';
          var statusLabel = m.status === 'done' ? 'Completed' : m.status === 'in_progress' ? 'In progress' : m.status === 'available' ? 'Not started' : 'Locked';
          var sub = m.status === 'locked' ? ('Requires ' + m.unlockThreshold + '% in the previous week') : (m.timeSpent ? (m.timeSpent + 'm spent') : '');
          html += '<div class="module ' + cls + '"><div class="m-icon">' + icon + '</div>' +
            '<div class="m-info"><div class="m-name">' + esc(m.title) + '</div>' +
            '<div class="m-progress"><div class="bar-track"><div class="bar-fill" style="width:' + m.pct + '%"></div></div><span class="m-pct-label">' + m.pct + '%</span></div></div>' +
            '<div class="m-status-col"><div class="m-status">' + statusLabel + '</div><div class="m-sub">' + esc(sub) + '</div></div>';
          if (m.assessment && m.status !== 'locked') {
            if (m.assessment.type === 'quiz') {
              html += '<button type="button" class="module-quiz-btn" data-quiz-open="' + m.assessment.id + '" data-module-id="' + m.id + '">' + (m.pct >= 100 ? 'Retake Quiz' : 'Start Quiz') + '</button>';
            } else {
              html += '<button type="button" class="module-quiz-btn" data-assignment-open="' + m.assessment.id + '" data-assignment-title="' + esc(m.assessment.title) + '">' + (m.assessment.submitted ? 'View submission' : 'Submit') + '</button>';
            }
          } else if (!m.assessment && m.status === 'available') {
            html += '<button type="button" class="module-quiz-btn" data-mark-complete="' + m.id + '">Mark complete</button>';
          } else if (!m.assessment && m.status === 'in_progress') {
            html += '<button type="button" class="module-quiz-btn" data-mark-complete="' + m.id + '">Mark complete</button>';
          }
          html += '</div>';
        });
        html += '</div></div>';
      });
      document.getElementById('view-courses').innerHTML = html;
    });
  }

  // ---------------- MATERIALS ----------------
  function renderMaterials() {
    return api('/api/courses').then(function (d) {
      var courses = d.courses;
      if (courses.length === 0) {
        document.getElementById('view-materials').innerHTML = '<h2 class="section-title">Materials</h2><p class="section-sub">You are not enrolled in any course yet.</p>';
        return;
      }
      return Promise.all(courses.map(function (c) { return api('/api/course-detail/' + c.id); })).then(function (details) {
        var html = '<h2 class="section-title">Materials</h2><p class="section-sub">Materials your instructors have shared, by course and module.</p>';
        html += '<div class="course-tabs" id="matCourseTabs">';
        details.forEach(function (c, i) { html += '<button type="button" class="mat-tab' + (i === 0 ? ' active' : '') + '" data-mat-course="c' + c.id + '">' + esc(c.name) + '</button>'; });
        html += '</div>';
        details.forEach(function (c, i) {
          html += '<div class="mat-section' + (i === 0 ? ' active' : '') + '" data-mat-course-panel="c' + c.id + '">';
          html += '<div class="week-tabs">';
          c.modules.forEach(function (m, j) { html += '<button type="button" class="week-tab' + (j === 0 ? ' active' : '') + '" data-mat-week="m' + m.id + '">' + esc(shortTitle(m.title)) + '</button>'; });
          html += '</div>';
          c.modules.forEach(function (m, j) {
            html += '<div class="card materials-week-panel' + (j === 0 ? ' active' : '') + '" data-mat-week-panel="m' + m.id + '"><div class="materials-list">';
            if (!m.materials || m.materials.length === 0) html += '<div class="materials-empty">No materials shared yet for this module.</div>';
            (m.materials || []).forEach(function (mat) {
              var isPlaceholder = !mat.url || mat.url === '#';
              var linkHtml = isPlaceholder
                ? '<span class="mi-name mi-name-disabled" title="No file has been uploaded for this item yet">' + esc(mat.title) + '</span>'
                : '<div class="mi-name"><a href="' + esc(mat.url) + '" target="_blank" rel="noopener">' + esc(mat.title) + '</a></div>';
              html += '<div class="materials-item"><div class="materials-icon">' + (mat.type === 'link' ? '🔗' : '📄') + '</div>' +
                '<div class="materials-item-body">' + linkHtml +
                '<div class="mi-meta">' + (mat.type === 'link' ? 'Link' : 'File') + (isPlaceholder ? ' · not uploaded yet' : ' · shared ' + timeAgo(mat.createdAt)) + '</div></div></div>';
            });
            html += '</div></div>';
          });
          html += '</div>';
        });
        document.getElementById('view-materials').innerHTML = html;
        var c1 = document.getElementById('matCourseTabs');
        c1.querySelectorAll('.mat-tab').forEach(function (t) {
          t.addEventListener('click', function () {
            var key = t.getAttribute('data-mat-course');
            c1.querySelectorAll('.mat-tab').forEach(function (x) { x.classList.remove('active'); });
            t.classList.add('active');
            document.querySelectorAll('[data-mat-course-panel]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-mat-course-panel') === key); });
          });
        });
        document.querySelectorAll('.week-tabs').forEach(function (wt) {
          wt.querySelectorAll('.week-tab').forEach(function (t) {
            t.addEventListener('click', function () {
              var key = t.getAttribute('data-mat-week');
              wt.querySelectorAll('.week-tab').forEach(function (x) { x.classList.remove('active'); });
              t.classList.add('active');
              var parent = wt.parentElement;
              parent.querySelectorAll('[data-mat-week-panel]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-mat-week-panel') === key); });
            });
          });
        });
      });
    });
  }
  function shortTitle(t) { return t.replace(/^Week (One|Two|Three|Four|Five)\s*—\s*/, ''); }

  // ---------------- SCHEDULE ----------------
  function renderSchedule() {
    return api('/api/courses').then(function (d) {
      var courses = d.courses;
      if (courses.length === 0) {
        document.getElementById('view-schedule').innerHTML = '<h2 class="section-title">Class Schedule</h2><p class="section-sub">You are not enrolled in any course yet.</p>';
        return;
      }
      return Promise.all(courses.map(function (c) { return api('/api/course-detail/' + c.id); })).then(function (details) {
        var html = '<h2 class="section-title">Class Schedule</h2><p class="section-sub">Live sessions scheduled by your instructors, by course.</p>';
        html += '<div class="course-tabs" id="schedCourseTabs">';
        details.forEach(function (c, i) { html += '<button type="button" class="sched-tab' + (i === 0 ? ' active' : '') + '" data-sched-course="c' + c.id + '">' + esc(c.name) + '</button>'; });
        html += '</div>';
        details.forEach(function (c, i) {
          html += '<div class="sched-section' + (i === 0 ? ' active' : '') + '" data-sched-course-panel="c' + c.id + '"><div class="card"><div class="schedule-list">';
          if (!c.schedule || c.schedule.length === 0) html += '<div class="schedule-empty">No sessions scheduled yet for this course.</div>';
          (c.schedule || []).forEach(function (ev) { html += scheduleItemHtml(ev, new Date(ev.date) >= new Date(new Date().toDateString())); });
          html += '</div></div></div>';
        });
        document.getElementById('view-schedule').innerHTML = html;
        var tabs = document.getElementById('schedCourseTabs');
        tabs.querySelectorAll('.sched-tab').forEach(function (t) {
          t.addEventListener('click', function () {
            var key = t.getAttribute('data-sched-course');
            tabs.querySelectorAll('.sched-tab').forEach(function (x) { x.classList.remove('active'); });
            t.classList.add('active');
            document.querySelectorAll('[data-sched-course-panel]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-sched-course-panel') === key); });
          });
        });
      });
    });
  }

  // ---------------- GRADES ----------------
  function renderGrades() {
    return api('/api/student/grades').then(function (d) {
      var html = '<h2 class="section-title">Grades & Instructor Feedback</h2><div class="card"><div class="table-wrap"><table><thead><tr><th>Assessment</th><th>Course</th><th>Score</th><th>Status</th><th>Feedback / Remarks</th></tr></thead><tbody>';
      if (d.grades.length === 0) html += '<tr><td colspan="5" style="color:var(--slate);">No grades recorded yet. Complete quizzes or submit assignments to receive feedback.</td></tr>';
      d.grades.forEach(function (g) {
        var pill = g.status === 'graded' ? '<span class="pill pill-done">Graded</span>' : '<span class="pill pill-open">Awaiting grade</span>';
        var fb = g.feedback ? '<div class="feedback-quote">“' + esc(g.feedback) + '”</div>' : '<span style="color:var(--slate); font-size:0.8rem;">—</span>';
        html += '<tr><td><strong>' + esc(g.title) + '</strong></td><td>' + esc(g.courseName) + '</td><td><span style="font-weight:700; font-family:var(--font-display); font-size:1.05rem;">' + (g.score != null ? g.score + '%' : '—') + '</span></td><td>' + pill + '</td><td>' + fb + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
      document.getElementById('view-grades').innerHTML = html;
    });
  }

  // ---------------- DISCUSSION ----------------
  function renderDiscussion() {
    return api('/api/courses').then(function (d) {
      var courses = d.courses;
      if (courses.length === 0) {
        document.getElementById('view-discussion').innerHTML = '<h2 class="section-title">Discussion</h2><p class="section-sub">You are not enrolled in any course yet.</p>';
        return;
      }
      return Promise.all(courses.map(function (c) { return api('/api/course-detail/' + c.id); })).then(function (details) {
        var html = '<h2 class="section-title">Discussion</h2><p class="section-sub">Each course has its own discussion, split by module.</p>';
        html += '<div class="course-tabs" id="discCourseTabs">';
        details.forEach(function (c, i) { html += '<button type="button" class="course-tab' + (i === 0 ? ' active' : '') + '" data-disc-course="c' + c.id + '">' + esc(c.name) + '</button>'; });
        html += '</div>';
        details.forEach(function (c, i) {
          // Filter out pure-quiz modules so they don't appear as discussion tabs
          var discussMods = c.modules.filter(function (m) {
            var st = shortTitle(m.title).toLowerCase();
            return st !== 'quiz' && st !== 'final quiz' && st !== 'week quiz' && !st.includes('quiz');
          });
          html += '<div class="course-section' + (i === 0 ? ' active' : '') + '" data-disc-course-panel="c' + c.id + '"><div class="week-tabs">';
          discussMods.forEach(function (m, j) { html += '<button type="button" class="week-tab' + (j === 0 ? ' active' : '') + '" data-disc-week="m' + m.id + '">' + esc(shortTitle(m.title)) + '</button>'; });
          html += '</div>';
          discussMods.forEach(function (m, j) {
            html += '<div class="week-panel' + (j === 0 ? ' active' : '') + '" data-disc-week-panel="m' + m.id + '">' +
              '<div class="card"><div class="thread-posts" id="posts-' + m.id + '"><div class="post-empty">Loading\u2026</div></div></div>' +
              '<div class="card composer-card"><form class="composer" data-module-id="' + m.id + '">' +
              '<div class="composer-input-row"><div class="post-avatar" style="background:var(--sky-tint); color:var(--sky-deep);">' + esc(me.initials) + '</div>' +
              '<textarea class="composer-text" rows="2" placeholder="Add to ' + esc(shortTitle(m.title)) + '\u2026"></textarea></div>' +
              '<div class="composer-file-preview" style="display:none; margin: 8px 0 8px 46px;"></div>' +
              '<div class="composer-footer">' +
              '<label class="composer-attach-btn" title="Attach file (PDF, JPEG, PNG, PPTX — max 10 MB)">+' +
              '<input type="file" class="composer-file-input" accept=".pdf,.jpg,.jpeg,.png,.pptx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.presentationml.presentation" style="display:none;">' +
              '</label>' +
              '<button type="submit" class="composer-send">Post</button></div></form></div></div>';
          });
          html += '</div>';
        });
        document.getElementById('view-discussion').innerHTML = html;

        var ctabs = document.getElementById('discCourseTabs');
        ctabs.querySelectorAll('.course-tab').forEach(function (t) {
          t.addEventListener('click', function () {
            var key = t.getAttribute('data-disc-course');
            ctabs.querySelectorAll('.course-tab').forEach(function (x) { x.classList.remove('active'); });
            t.classList.add('active');
            document.querySelectorAll('[data-disc-course-panel]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-disc-course-panel') === key); });
          });
        });
        document.querySelectorAll('.week-tabs').forEach(function (wt) {
          wt.querySelectorAll('.week-tab').forEach(function (t) {
            t.addEventListener('click', function () {
              var key = t.getAttribute('data-disc-week');
              wt.querySelectorAll('.week-tab').forEach(function (x) { x.classList.remove('active'); });
              t.classList.add('active');
              wt.parentElement.querySelectorAll('[data-disc-week-panel]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-disc-week-panel') === key); });
            });
          });
        });

        // File attach handler for each composer
        document.querySelectorAll('#view-discussion .composer-file-input').forEach(function (fileInput) {
          fileInput.addEventListener('change', function () {
            var form = fileInput.closest('form');
            var preview = form.querySelector('.composer-file-preview');
            var file = fileInput.files[0];
            if (!file) { preview.style.display = 'none'; preview.innerHTML = ''; return; }
            var allowedTypes = ['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.presentationml.presentation'];
            var allowedExts = /\.(pdf|jpg|jpeg|png|pptx)$/i;
            if (!allowedTypes.includes(file.type) && !allowedExts.test(file.name)) {
              showToast('Only PDF, JPEG, PNG, and PPTX files are allowed.', true);
              fileInput.value = ''; return;
            }
            if (file.size > 10 * 1024 * 1024) {
              showToast('File is too large. Maximum size is 10 MB.', true);
              fileInput.value = ''; return;
            }
            preview.style.display = 'flex';
            preview.innerHTML = '<span class="attach-chip">&#128206; ' + esc(file.name) + ' <button type="button" class="attach-chip-remove" title="Remove">&#10005;</button></span>';
            preview.querySelector('.attach-chip-remove').addEventListener('click', function () {
              fileInput.value = ''; preview.style.display = 'none'; preview.innerHTML = '';
            });
          });
        });

        // Load posts for each visible module
        document.querySelectorAll('#view-discussion [data-disc-week-panel]').forEach(function (panel) {
          var mid = panel.getAttribute('data-disc-week-panel').replace('m', '');
          loadPosts(mid);
        });

        // Post submit handler
        document.querySelectorAll('#view-discussion form.composer').forEach(function (form) {
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var moduleId = form.getAttribute('data-module-id');
            var text = form.querySelector('.composer-text').value.trim();
            var fileInput = form.querySelector('.composer-file-input');
            var file = fileInput && fileInput.files[0];
            if (!text && !file) { showToast('Write something or attach a file.', true); return; }
            function doPost(fileData, fileName, fileMime) {
              api('/api/modules/' + moduleId + '/posts', { method: 'POST', body: { text: text, fileData: fileData || null, fileName: fileName || null, fileMime: fileMime || null } })
                .then(function () {
                  form.querySelector('.composer-text').value = '';
                  if (fileInput) fileInput.value = '';
                  var preview = form.querySelector('.composer-file-preview');
                  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
                  loadPosts(moduleId); showToast('Posted.');
                })
                .catch(function (err) { showToast(err.message, true); });
            }
            if (file) {
              var reader = new FileReader();
              reader.onload = function () { doPost(reader.result, file.name, file.type); };
              reader.readAsDataURL(file);
            } else {
              doPost(null, null, null);
            }
          });
        });
      });
    });
  }

  function loadPosts(moduleId) {
    api('/api/modules/' + moduleId + '/posts').then(function (d) {
      var el = document.getElementById('posts-' + moduleId);
      if (!el) return;
      if (d.posts.length === 0) { el.innerHTML = '<div class="post-empty">No discussion yet. Be the first to post.</div>'; return; }
      el.innerHTML = d.posts.map(function (p) {
        var isTeacher = p.authorRole === 'FACULTY';
        var fileHtml = '';
        if (p.fileData && p.fileName) {
          var isImage = p.fileMime && p.fileMime.startsWith('image/');
          if (isImage) {
            fileHtml = '<div class="post-img-attach"><img src="' + p.fileData + '" alt="' + esc(p.fileName) + '"></div>';
          } else {
            fileHtml = '<a class="post-file-chip" href="' + p.fileData + '" download="' + esc(p.fileName) + '">&#128206; ' + esc(p.fileName) + '</a>';
          }
        }
        return '<div class="post"><div class="post-avatar"' + (isTeacher ? ' style="background:var(--moss-tint); color:var(--moss);"' : '') + '>' + esc(p.authorInitials) + '</div>' +
          '<div class="post-body"><div class="p-name">' + esc(p.authorName) + (isTeacher ? ' (Teacher)' : '') + '</div>' +
          (p.text ? '<div class="p-text">' + esc(p.text) + '</div>' : '') +
          fileHtml + '</div></div>';
      }).join('');
    });
  }

  // ---------------- ANNOUNCEMENTS ----------------
  function renderAnnouncements() {
    return api('/api/announcements').then(function (d) {
      var html = '<h2 class="section-title">Announcements</h2><div class="card">';
      if (d.announcements.length === 0) html += '<p style="color:var(--slate);">No announcements yet.</p>';
      d.announcements.forEach(function (a) {
        html += '<div class="announce"><div class="a-title">' + esc(a.title) + '</div><div class="a-text">' + esc(a.message) + '</div>' +
          '<div class="a-meta">' + (a.scope === 'academy' ? 'Academy-wide' : esc(a.courseName)) + ' · ' + timeAgo(a.createdAt) + '</div></div>';
      });
      html += '</div>';
      document.getElementById('view-announcements').innerHTML = html;
    });
  }

  // ---------------- NOTIFICATIONS ----------------
  function renderNotifications() {
    return api('/api/notifications').then(function (d) {
      var html = '<h2 class="section-title">Notifications</h2><div class="card">';
      if (d.notifications.length === 0) html += '<p style="color:var(--slate);">You\'re all caught up.</p>';
      d.notifications.forEach(function (n, i) {
        html += '<div class="notif-row' + (n.isRead ? '' : ' unread') + '"><span class="notif-dot"></span><div><div class="notif-text">' + esc(n.text) + '</div><div class="notif-time">' + timeAgo(n.createdAt) + '</div></div></div>';
      });
      html += '</div>';
      document.getElementById('view-notifications').innerHTML = html;
      api('/api/notifications/read-all', { method: 'POST' });
    });
  }

  // ---------------- CERTIFICATES ----------------
  function renderCertificates() {
    return api('/api/student/certificates').then(function (d) {
      var html = '<h2 class="section-title">Certificates</h2>';
      var any = false;
      d.certificates.forEach(function (c) {
        if (c.progress >= 100) {
          any = true;
          html += '<div class="cert-card" style="margin-bottom:20px;"><div class="cert-top"><div class="cert-label">CERTIFICATE OF COMPLETION</div><h3>' + esc(c.courseName) + '</h3><p>Awarded to ' + esc(me.name) + '</p></div>' +
            '<div class="cert-bottom"><span class="cert-id">ID: ' + esc(c.certId) + '</span><button type="button" class="btn-primary" onclick="window.print()">Download / Print</button></div></div>';
        }
      });
      d.certificates.forEach(function (c) {
        if (c.progress < 100) {
          html += '<div class="cert-locked" style="margin-bottom:16px;">' + esc(c.courseName) + ' — ' + c.progress + '% complete. Reach 100% to unlock your certificate.</div>';
        }
      });
      if (d.certificates.length === 0) html += '<p class="section-sub">You are not enrolled in any course yet.</p>';
      document.getElementById('view-certificates').innerHTML = html;
    });
  }

  // ---------------- PROFILE ----------------
  function renderProfile() {
    var avatarHtml = me.avatarUrl ? '<img src="' + me.avatarUrl + '">' : esc(me.initials);
    var html = '<h2 class="section-title">Profile</h2><div class="card"><div class="profile-grid"><div>' +
      '<div class="profile-avatar-wrap"><div class="profile-avatar-big" id="profileAvatarBig">' + avatarHtml + '</div>' +
      '<label class="avatar-upload-btn" for="avatarUploadInput" title="Upload photo">+</label>' +
      '<input type="file" id="avatarUploadInput" accept="image/jpeg,image/png" style="display:none;"></div></div>' +
      '<div><form id="profileForm">' +
      '<div class="field-row"><label>Name</label><input type="text" id="profName" value="' + esc(me.name) + '" style="border:1px solid var(--line); border-radius:8px; padding:8px 10px; font-size:0.95rem;"></div>' +
      '<div class="field-row"><label>Email</label><div class="val">' + esc(me.email) + '</div></div>' +
      '<div class="field-row"><label>Phone number</label><input type="text" id="profPhone" value="' + esc(me.phone || '') + '" style="border:1px solid var(--line); border-radius:8px; padding:8px 10px; font-size:0.95rem;"></div>' +
      '<div class="field-row"><label>Role</label><div class="val">Student</div></div>' +
      '<div class="field-row"><label>Status</label><div class="val"><span class="pill pill-active">Active</span></div></div>' +
      '<div style="margin-top:16px;"><button type="submit" class="btn-primary">Save changes</button></div></form></div></div></div>';
    document.getElementById('view-profile').innerHTML = html;

    document.getElementById('profileForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('profName').value.trim();
      var phone = document.getElementById('profPhone').value.trim();
      api('/api/profile', { method: 'PUT', body: { name: name, phone: phone } }).then(function () {
        me.name = name; me.phone = phone;
        document.querySelector('.tb-name').innerHTML = esc(name) + '<small>Student</small>';
        showToast('Profile updated.');
      });
    });
    document.getElementById('avatarUploadInput').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!/^image\/(jpeg|png)$/.test(file.type)) { showToast('Please choose a JPEG or PNG image.', true); return; }
      if (file.size > 700000) { showToast('That image is too large. Please choose a smaller file.', true); return; }
      var reader = new FileReader();
      reader.onload = function () {
        api('/api/profile/avatar', { method: 'POST', body: { dataUrl: reader.result } }).then(function () {
          me.avatarUrl = reader.result;
          document.getElementById('profileAvatarBig').innerHTML = '<img src="' + reader.result + '">';
          var tb = document.getElementById('tbAvatar');
          tb.style.backgroundImage = 'url(' + reader.result + ')';
          tb.style.backgroundSize = 'cover';
          tb.textContent = '';
          showToast('Photo updated.');
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------------- QUIZ MODAL ----------------
  var quizOverlay = document.createElement('div');
  quizOverlay.className = 'quiz-overlay';
  quizOverlay.id = 'quizOverlay';
  quizOverlay.innerHTML = '<div class="quiz-modal" id="quizModal"></div>';
  document.body.appendChild(quizOverlay);

  var _quizTimerInterval = null;
  function stopQuizTimer() { if (_quizTimerInterval) { clearInterval(_quizTimerInterval); _quizTimerInterval = null; } }

  function fmtCountdown(ms) {
    if (ms <= 0) return '00:00';
    var totalSec = Math.ceil(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function openQuiz(assessmentId) {
    api('/api/assessments/' + assessmentId).then(function (d) {
      var a = d.assessment;
      var answers = {};
      var modal = document.getElementById('quizModal');
      stopQuizTimer();

      // Compute session state
      var sessionExpiry = a.sessionExpiry ? new Date(a.sessionExpiry) : null;
      var sessionExpired = a.sessionExpired || false;
      var attemptsUsed = a.attemptsUsed || 0;
      var attemptsLeft = (a.attemptsAllowed || 3) - attemptsUsed;
      var timeLeft = sessionExpiry ? (sessionExpiry.getTime() - Date.now()) : null;
      var canStart = !sessionExpired && attemptsLeft > 0;

      function renderIntro() {
        var statusNote = '';
        if (sessionExpired) {
          statusNote = '<div class="quiz-expired-note">&#9203; The 30-minute quiz session has ended. No more retakes are available.</div>';
        } else if (attemptsUsed > 0 && sessionExpiry) {
          var remaining = fmtCountdown(sessionExpiry.getTime() - Date.now());
          statusNote = '<div class="quiz-session-info"><span class="quiz-timer" id="quizSessionTimer">' + remaining + '</span> remaining &nbsp;·&nbsp; ' + attemptsLeft + ' retake(s) left</div>';
        }
        var startLabel = attemptsUsed > 0 ? 'Retake Quiz' : 'Start Quiz';
        var startDisabled = !canStart ? ' disabled' : '';
        modal.innerHTML = '<h3>' + esc(a.title) + '</h3>' +
          '<div class="quiz-meta">' + a.questions.length + ' questions &nbsp;·&nbsp; 30-minute session &nbsp;·&nbsp; ' + (a.attemptsAllowed || 3) + ' attempts max</div>' +
          '<div class="quiz-instructions">You have <strong>30 minutes</strong> from your first attempt to complete up to <strong>' + (a.attemptsAllowed || 3) + ' attempts</strong>. Once the timer expires no further retakes are allowed.</div>' +
          statusNote +
          '<div class="quiz-actions"><button type="button" class="quiz-btn-secondary" id="quizCancel">Cancel</button><button type="button" class="quiz-btn-primary" id="quizStart"' + startDisabled + '>' + startLabel + '</button></div>';
        document.getElementById('quizCancel').addEventListener('click', function () { stopQuizTimer(); closeQuiz(); });
        if (canStart) document.getElementById('quizStart').addEventListener('click', renderQuestions);
        // Start live countdown on intro screen if session is active
        if (attemptsUsed > 0 && sessionExpiry && !sessionExpired) {
          _quizTimerInterval = setInterval(function () {
            var el = document.getElementById('quizSessionTimer');
            if (!el) { stopQuizTimer(); return; }
            var left = sessionExpiry.getTime() - Date.now();
            if (left <= 0) {
              stopQuizTimer();
              el.textContent = '00:00';
              el.classList.add('quiz-timer-expired');
              var startBtn = document.getElementById('quizStart');
              if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'Session expired'; }
            } else {
              el.textContent = fmtCountdown(left);
              if (left < 60000) el.classList.add('quiz-timer-urgent');
            }
          }, 1000);
        }
      }

      function renderQuestions() {
        // When first attempt starts, session clock begins server-side. We start the UI timer now.
        var sessionStart = sessionExpiry ? sessionExpiry : new Date(Date.now() + 30 * 60 * 1000);
        var questionExpiry = sessionExpiry || sessionStart;
        var qHtml = a.questions.map(function (qq, qi) {
          var optsHtml = qq.options.map(function (o) {
            return '<button type="button" class="quiz-option" data-qid="' + qq.id + '" data-oid="' + o.id + '"><span>' + esc(o.text) + '</span><span class="q-opt-icon"></span></button>';
          }).join('');
          return '<div class="quiz-question"><div class="q-text">' + (qi + 1) + '. ' + esc(qq.text) + '</div><div class="q-options">' + optsHtml + '</div></div>';
        }).join('');
        var initTimer = !sessionExpiry ? fmtCountdown(30 * 60 * 1000) : fmtCountdown(questionExpiry.getTime() - Date.now());
        modal.innerHTML = '<div class="quiz-header"><h3>' + esc(a.title) + '</h3><span class="quiz-timer" id="quizCountdown">' + initTimer + '</span></div>' + qHtml +
          '<div class="quiz-actions"><button type="button" class="quiz-btn-secondary" id="quizCancel2">Cancel</button><button type="button" class="quiz-btn-primary" id="quizSubmit">Submit Quiz</button></div>';
        document.getElementById('quizCancel2').addEventListener('click', function () { stopQuizTimer(); closeQuiz(); });
        modal.querySelectorAll('.quiz-option').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var qid = btn.getAttribute('data-qid');
            answers[qid] = btn.getAttribute('data-oid');
            modal.querySelectorAll('.quiz-option[data-qid="' + qid + '"]').forEach(function (b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
          });
        });
        // Start countdown timer on questions screen
        stopQuizTimer();
        _quizTimerInterval = setInterval(function () {
          var el = document.getElementById('quizCountdown');
          if (!el) { stopQuizTimer(); return; }
          var left = questionExpiry.getTime() - Date.now();
          if (left <= 0) {
            stopQuizTimer(); el.textContent = '00:00'; el.classList.add('quiz-timer-expired');
            // Auto-submit when time's up
            var submitBtn = document.getElementById('quizSubmit');
            if (submitBtn) submitBtn.click();
          } else {
            el.textContent = fmtCountdown(left);
            if (left < 60000) el.classList.add('quiz-timer-urgent');
          }
        }, 1000);
        document.getElementById('quizSubmit').addEventListener('click', function () {
          stopQuizTimer();
          api('/api/assessments/' + assessmentId + '/attempt', { method: 'POST', body: { answers: answers } })
            .then(function (res) {
              var newLeft = res.sessionExpiry ? (new Date(res.sessionExpiry).getTime() - Date.now()) : null;
              var retakeInfo = '';
              if (res.attemptsRemaining > 0 && newLeft && newLeft > 0) {
                retakeInfo = '<div class="quiz-session-info" style="margin-top:14px;"><span class="quiz-timer" id="quizResultTimer">' + fmtCountdown(newLeft) + '</span> remaining &nbsp;·&nbsp; ' + res.attemptsRemaining + ' retake(s) left</div>';
              } else if (res.attemptsRemaining === 0 || (newLeft !== null && newLeft <= 0)) {
                retakeInfo = '<div class="quiz-expired-note">No more retakes available.</div>';
              }
              modal.innerHTML = '<h3>Quiz Complete &#127881;</h3><div class="quiz-score">' + res.score + '%</div>' +
                '<p class="quiz-result-note">' + res.correct + ' of ' + res.total + ' correct</p>' +
                retakeInfo +
                '<div class="quiz-actions"><button type="button" class="quiz-btn-primary" id="quizDone">Done</button>' +
                (res.attemptsRemaining > 0 && newLeft && newLeft > 0 ? '<button type="button" class="quiz-btn-secondary" id="quizRetake">Retake Quiz</button>' : '') +
                '</div>';
              document.getElementById('quizDone').addEventListener('click', function () { stopQuizTimer(); closeQuiz(); renderCoursesFull(); renderGrades(); });
              var retakeBtn = document.getElementById('quizRetake');
              if (retakeBtn) {
                // Start result screen timer
                var resultExpiry = new Date(res.sessionExpiry);
                _quizTimerInterval = setInterval(function () {
                  var tel = document.getElementById('quizResultTimer');
                  if (!tel) { stopQuizTimer(); return; }
                  var left2 = resultExpiry.getTime() - Date.now();
                  if (left2 <= 0) { stopQuizTimer(); tel.textContent = '00:00'; tel.classList.add('quiz-timer-expired'); retakeBtn.disabled = true; retakeBtn.textContent = 'Expired'; }
                  else { tel.textContent = fmtCountdown(left2); if (left2 < 60000) tel.classList.add('quiz-timer-urgent'); }
                }, 1000);
                retakeBtn.addEventListener('click', function () { stopQuizTimer(); answers = {}; sessionExpiry = resultExpiry; renderQuestions(); });
              }
            })
            .catch(function (err) { showToast(err.message, true); stopQuizTimer(); });
        });
      }
      renderIntro();
      quizOverlay.classList.add('show');
    }).catch(function (e) { showToast(e.message, true); });
  }
  function closeQuiz() { stopQuizTimer(); quizOverlay.classList.remove('show'); }

  document.body.addEventListener('click', function (e) {
    var quizBtn = e.target.closest('[data-quiz-open], [data-quiz-trigger]');
    if (quizBtn) { openQuiz(quizBtn.getAttribute('data-quiz-open') || quizBtn.getAttribute('data-quiz-trigger')); return; }
    var markBtn = e.target.closest('[data-mark-complete]');
    if (markBtn) {
      var moduleId = markBtn.getAttribute('data-mark-complete');
      api('/api/progress/' + moduleId, { method: 'PATCH', body: { pct: 100 } }).then(function () {
        showToast('Marked complete.');
        renderCoursesFull();
        renderDashboard();
      });
      return;
    }
    var assignBtn = e.target.closest('[data-assignment-open]');
    if (assignBtn) {
      openAssignment(assignBtn.getAttribute('data-assignment-open'), assignBtn.getAttribute('data-assignment-title'));
      return;
    }
  });

  function openAssignment(assessmentId, title) {
    var overlay = document.getElementById('assignOverlay') || (function () {
      var o = document.createElement('div');
      o.className = 'modal-overlay';
      o.id = 'assignOverlay';
      document.body.appendChild(o);
      return o;
    })();
    overlay.innerHTML = '<div class="modal"><h3>' + esc(title) + '</h3><p class="modal-sub">Type your response and/or attach a document (PDF, JPEG, PNG, PPTX — max 10 MB).</p>' +
      '<label>Your submission</label><textarea id="assignText" rows="5" style="width:100%; border:1px solid var(--line); border-radius:8px; padding:10px 12px; font-size:0.9rem; font-family:var(--font-body); resize:vertical;"></textarea>' +
      '<div class="assign-attach-row"><label class="assign-attach-btn" for="assignFileInput">&#128206; Attach document</label>' +
      '<input type="file" id="assignFileInput" accept=".pdf,.jpg,.jpeg,.png,.pptx" style="display:none;">' +
      '<span id="assignFileChip" style="display:none;" class="attach-chip"></span></div>' +
      '<div class="modal-actions"><button type="button" class="btn-secondary" id="assignCancel">Cancel</button><button type="button" class="btn-primary" id="assignSubmit">Submit</button></div></div>';
    overlay.classList.add('show');

    var assignFileInput = document.getElementById('assignFileInput');
    var assignFileChip = document.getElementById('assignFileChip');
    assignFileInput.addEventListener('change', function () {
      var file = assignFileInput.files[0];
      if (!file) { assignFileChip.style.display = 'none'; assignFileChip.innerHTML = ''; return; }
      if (file.size > 10 * 1024 * 1024) { showToast('File too large. Max 10 MB.', true); assignFileInput.value = ''; return; }
      assignFileChip.style.display = 'inline-flex';
      assignFileChip.innerHTML = '&#128206; ' + esc(file.name) + '<button type="button" class="attach-chip-remove" title="Remove">&#10005;</button>';
      assignFileChip.querySelector('.attach-chip-remove').addEventListener('click', function () {
        assignFileInput.value = ''; assignFileChip.style.display = 'none'; assignFileChip.innerHTML = '';
      });
    });

    document.getElementById('assignCancel').addEventListener('click', function () { overlay.classList.remove('show'); });
    document.getElementById('assignSubmit').addEventListener('click', function () {
      var text = document.getElementById('assignText').value.trim();
      var file = assignFileInput.files[0];
      if (!text && !file) { showToast('Add text or attach a file before submitting.', true); return; }
      function doSubmit(fileNote) {
        var content = text || '';
        if (fileNote) content = (content ? content + '\n\n' : '') + '[Attachment: ' + fileNote + ']';
        if (!content) content = 'Submitted.';
        api('/api/assessments/' + assessmentId + '/submit', { method: 'POST', body: { content: content } }).then(function () {
          overlay.classList.remove('show');
          showToast('Submitted.');
          renderCoursesFull(); renderGrades();
        }).catch(function (e) { showToast(e.message, true); });
      }
      if (file) { doSubmit(file.name); } else { doSubmit(null); }
    });
  }

  window.PIMH.studentInit();
})();
