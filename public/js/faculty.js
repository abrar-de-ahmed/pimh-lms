(function () {
  var P = window.PIMH;
  var api = P.api, esc = P.esc, showToast = P.showToast, timeAgo = P.timeAgo, fmtDate = P.fmtDate;
  var boot = window.__BOOT__ || {};
  var me = boot.user;

  var titles = {
    dashboard: 'Dashboard', classes: 'My Classes', grading: 'Grading', discussion: 'Discussion',
    announcements: 'Announcements', roster: 'Roster', profile: 'Profile',
  };
  document.getElementById('content').innerHTML = Object.keys(titles).map(function (k) { return '<section class="view" id="view-' + k + '"></section>'; }).join('');

  function shortTitle(t) { return t.replace(/^Week (One|Two|Three|Four|Five)\s*—\s*/, ''); }

  function renderDashboard() {
    return api('/api/dashboard/faculty').then(function (d) {
      var html = '<div class="welcome"><h2>Welcome back, ' + esc(d.name.split(' ')[0]) + '</h2>' +
        '<p>' + d.pendingGrading + ' submission' + (d.pendingGrading === 1 ? '' : 's') + ' are waiting on grades.</p></div>';

      html += '<div class="stat-grid">' +
        '<div class="stat-tile sky"><div class="stat-tile-icon">📚</div><div class="stat-tile-body"><span class="num">' + d.classesTaught + '</span><span class="label">Classes taught</span></div></div>' +
        '<div class="stat-tile good"><div class="stat-tile-icon">👥</div><div class="stat-tile-body"><span class="num">' + d.studentsEnrolled + '</span><span class="label">Students enrolled</span></div></div>' +
        '<div class="stat-tile fire"><div class="stat-tile-icon">⚠️</div><div class="stat-tile-body"><span class="num">' + d.pendingGrading + '</span><span class="label">Pending grading</span></div></div>' +
        '<div class="stat-tile gold"><div class="stat-tile-icon">🎓</div><div class="stat-tile-body"><span class="num">' + d.courses.length + '</span><span class="label">Active courses</span></div></div>' +
        '</div>';

      html += '<div class="dash-grid"><div>';
      
      html += '<div class="card"><div class="card-head"><h3>Needs grading</h3><a href="#" data-view="grading">Open Grading</a></div>';
      if (!d.recentSubmissions || d.recentSubmissions.length === 0) {
        html += '<p class="section-sub" style="margin:0;">All caught up.</p>';
      } else {
        d.recentSubmissions.forEach(function (s) {
          html += '<div class="task-row"><span class="task-chip chip-open">Ungraded</span>' +
            '<div class="task-body"><div class="t-name">' + esc(s.studentName) + ' — ' + esc(s.assessmentTitle) + '</div><div class="t-meta">' + esc(s.courseName) + ' · ' + timeAgo(s.submittedAt) + '</div></div>' +
            '<button type="button" class="task-start-btn" data-grade-open="' + s.submissionId + '" data-student="' + esc(s.studentName) + '" data-assessment="' + esc(s.assessmentTitle) + '">Grade</button></div>';
        });
      }
      html += '</div>';

      if (d.upcomingSessions && d.upcomingSessions.length > 0) {
        html += '<div class="card"><div class="card-head"><h3>Upcoming live sessions</h3></div><div class="schedule-list">';
        d.upcomingSessions.forEach(function (ev) {
          var dateObj = new Date(ev.date + 'T00:00:00');
          html += '<div class="schedule-item"><div class="schedule-date"><div class="sd-day">' + dateObj.toLocaleDateString(undefined, { weekday: 'short' }) + '</div><div class="sd-num">' + dateObj.getDate() + '</div><div class="sd-mon">' + dateObj.toLocaleDateString(undefined, { month: 'short' }) + '</div></div>' +
            '<div class="schedule-body"><div class="sc-title">' + esc(ev.title) + '</div><div class="sc-meta"><span>' + esc(ev.courseName) + '</span>' + (ev.time ? '<span>' + esc(ev.time) + '</span>' : '') + '</div></div>' +
            '<span class="sc-badge upcoming">Upcoming</span></div>';
        });
        html += '</div></div>';
      }

      html += '</div><div>';

      html += '<div class="card"><div class="card-head"><h3>Class snapshot</h3><a href="#" data-view="classes">My Classes</a></div>';
      if (d.courses.length === 0) html += '<p class="section-sub" style="margin:0;">No classes assigned yet.</p>';
      d.courses.forEach(function (c) {
        html += '<div class="course-row">' +
          '<div class="course-info"><div class="name">' + esc(c.name) + ' (' + c.enrolledCount + ' students)</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + c.avgProgress + '%"></div></div></div>' +
          '<div class="course-pct">' + c.avgProgress + '%</div></div>';
      });
      html += '</div>';

      if (d.recentDiscussions && d.recentDiscussions.length > 0) {
        html += '<div class="card"><div class="card-head"><h3>Recent discussions</h3><a href="#" data-view="discussion">View all</a></div>';
        d.recentDiscussions.forEach(function(p) {
          html += '<div class="thread-item"><span class="thread-dot" style="background:var(--sky-deep);"></span>' +
            '<div class="thread-item-body"><div class="th-text"><strong>' + esc(p.authorName) + '</strong> posted in ' + esc(p.moduleTitle) + '</div>' +
            '<div class="th-meta">' + esc(p.courseName) + ' · ' + timeAgo(p.createdAt) + '</div></div></div>';
        });
        html += '</div>';
      }
      
      if (d.recentAnnouncement) {
        html += '<div class="card"><div class="card-head"><h3>Recent announcement</h3><a href="#" data-view="announcements">View all</a></div>' +
          '<div class="announce"><div class="a-title">' + esc(d.recentAnnouncement.title) + '</div><div class="a-text">' + esc(d.recentAnnouncement.text) + '</div>' +
          '<div class="a-meta">' + esc(d.recentAnnouncement.courseName || 'Academy-wide') + '</div></div></div>';
      }

      html += '</div></div>';
      document.getElementById('view-dashboard').innerHTML = html;
    });
  }

  function loadCourses() { return api('/api/courses').then(function (d) { return d.courses; }); }

  function renderClasses() {
    return loadCourses().then(function (courses) {
      if (courses.length === 0) {
        document.getElementById('view-classes').innerHTML = '<h2 class="section-title">My Classes</h2><p class="section-sub">No classes assigned to you yet.</p>';
        return;
      }
      return Promise.all(courses.map(function (c) { return api('/api/course-detail/' + c.id); })).then(function (details) {
        var html = '<h2 class="section-title">My Classes</h2><p class="section-sub">You teach ' + details.length + ' class' + (details.length === 1 ? '' : 'es') + ' this cohort.</p>';
        details.forEach(function (c) {
          html += '<div class="course-detail" data-course-id="' + c.id + '"><div class="cd-head"><h3>' + esc(c.name) + '</h3><span class="cd-meta">' + c.enrolledCount + ' students enrolled · ' + c.avgProgress + '% average progress</span></div>';
          html += '<div class="class-tabs"><button type="button" class="week-tab active" data-classtab="modules-' + c.id + '">Modules</button><button type="button" class="week-tab" data-classtab="materials-' + c.id + '">Materials</button><button type="button" class="week-tab" data-classtab="schedule-' + c.id + '">Schedule</button></div>';

          html += '<div class="class-panel active" data-class-panel="modules-' + c.id + '"><div class="module-list">';
          if (c.modules.length === 0) html += '<p style="color:var(--slate); padding:14px 0;">No modules yet.</p>';
          c.modules.forEach(function (m) {
            html += '<div class="module"><div class="m-name">' + esc(m.title) + '</div><div class="m-stats" style="display:flex; align-items:center; gap:12px;"><span>Average progress: <b>' + (m.avgPct || 0) + '%</b></span><button type="button" class="btn-danger-text" data-del-module="' + m.id + '">Remove</button></div></div>';
          });
          html += '</div><div style="padding:0 26px 22px;"><div class="add-module-row"><input type="text" placeholder="New module title…" data-new-module-input="' + c.id + '"><button type="button" class="btn-secondary" data-add-module="' + c.id + '">+ Add module</button></div></div></div>';

          html += '<div class="class-panel" data-class-panel="materials-' + c.id + '"><div class="materials-wrap">';
          html += '<div class="week-tabs">' + c.modules.map(function (m, j) { return '<button type="button" class="week-tab' + (j === 0 ? ' active' : '') + '" data-mw="fm' + m.id + '">' + esc(shortTitle(m.title)) + '</button>'; }).join('') + '</div>';
          c.modules.forEach(function (m, j) {
            html += '<div class="materials-week-panel' + (j === 0 ? ' active' : '') + '" data-mwp="fm' + m.id + '"><div class="materials-list">';
            if (m.materials.length === 0) html += '<div class="materials-empty">No materials yet.</div>';
            m.materials.forEach(function (mat) {
              html += '<div class="materials-item"><div class="materials-icon">' + (mat.type === 'link' ? '🔗' : '📄') + '</div>' +
                '<div class="materials-item-body"><div class="mi-name">' + esc(mat.title) + '</div><div class="mi-meta">' + (mat.type === 'link' ? 'Link' : 'File') + ' · uploaded ' + timeAgo(mat.createdAt) + '</div></div>' +
                (mat.type === 'file' ? '<a href="/api/materials/' + mat.id + '/download" class="btn-secondary" style="font-size:0.75rem; padding:4px 8px; margin-right:8px;" download>Download</a>' : '') +
                '<button type="button" class="btn-danger-text" data-del-material="' + mat.id + '">Remove</button></div>';
            });
            html += '</div>' +
              '<form class="materials-upload" data-add-material="' + m.id + '" data-mat-type="link" style="display:flex; flex-direction:column; gap:10px;">' +
              '<div class="materials-upload-row"><input type="text" class="materials-url" placeholder="Title for link or file…" data-mat-title required style="max-width:220px;"><input type="url" class="materials-url" placeholder="Paste a URL" data-mat-url></div>' +
              '<div class="materials-upload-row" style="align-items:center;">' +
              '<button type="submit" class="composer-send materials-send">Add link</button>' +
              '<label class="composer-send" style="cursor:pointer; background:var(--sky-deep); margin-left:12px; display:inline-flex; align-items:center; color:#fff;" title="Attach File"> + <input type="file" style="display:none" accept=".pdf,.pptx,.doc,.docx" data-mat-file></label>' +
              '</div><div class="composer-hint">Attach (+): PDF, Word, PPTX (max 10MB). Fill the title before selecting a file to auto-upload.</div>' +
              '</form></div>';
          });
          html += '</div></div>';

          html += '<div class="class-panel" data-class-panel="schedule-' + c.id + '"><div class="schedule-wrap">' +
            '<div class="schedule-head"><p class="composer-hint">Live sessions for ' + esc(c.name) + '.</p><button type="button" class="btn-primary" data-add-schedule="' + c.id + '">+ Schedule a session</button></div>' +
            '<div class="schedule-list">';
          if (c.schedule.length === 0) html += '<div class="schedule-empty">No sessions scheduled yet.</div>';
          c.schedule.forEach(function (ev) {
            var d = new Date(ev.date + 'T00:00:00');
            html += '<div class="schedule-item"><div class="schedule-date"><div class="sd-day">' + d.toLocaleDateString(undefined, { weekday: 'short' }) + '</div><div class="sd-num">' + d.getDate() + '</div><div class="sd-mon">' + d.toLocaleDateString(undefined, { month: 'short' }) + '</div></div>' +
              '<div class="schedule-body"><div class="sc-title">' + esc(ev.title) + '</div><div class="sc-meta"><span>' + (ev.time || '') + '</span></div></div>' +
              '<button type="button" class="btn-danger-text" data-del-schedule="' + ev.id + '">Remove</button></div>';
          });
          html += '</div></div></div></div>';
        });
        document.getElementById('view-classes').innerHTML = html;
        wireClassTabs();
      });
    });
  }

  function wireClassTabs() {
    document.querySelectorAll('#view-classes .course-detail').forEach(function (courseEl) {
      courseEl.querySelectorAll('.class-tabs .week-tab').forEach(function (t) {
        t.addEventListener('click', function () {
          var key = t.getAttribute('data-classtab');
          courseEl.querySelectorAll('.class-tabs .week-tab').forEach(function (x) { x.classList.remove('active'); });
          t.classList.add('active');
          courseEl.querySelectorAll('[data-class-panel]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-class-panel') === key); });
        });
      });
      courseEl.querySelectorAll('.materials-wrap .week-tabs .week-tab').forEach(function (t) {
        t.addEventListener('click', function () {
          var key = t.getAttribute('data-mw');
          var wrap = t.closest('.materials-wrap');
          wrap.querySelectorAll('.week-tabs .week-tab').forEach(function (x) { x.classList.remove('active'); });
          t.classList.add('active');
          wrap.querySelectorAll('[data-mwp]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-mwp') === key); });
        });
      });
    });
  }

  function renderGrading() {
    return api('/api/faculty/grading').then(function (d) {
      var html = '<h2 class="section-title">Grading</h2><p class="section-sub">' + d.items.filter(function (i) { return i.status === 'ungraded'; }).length + ' submissions waiting on a grade.</p>';
      html += '<div class="card"><div class="table-wrap"><table><thead><tr><th>Student</th><th>Assessment</th><th>Course</th><th>Submitted</th><th>Score</th><th>Status</th></tr></thead><tbody>';
      if (d.items.length === 0) html += '<tr><td colspan="6" style="color:var(--slate);">No submissions yet.</td></tr>';
      d.items.forEach(function (it) {
        html += '<tr><td><div class="cell-student"><div class="cell-avatar">' + esc(it.studentInitials) + '</div>' + esc(it.studentName) + '</div></td>' +
          '<td>' + esc(it.assessmentTitle) + (it.type === 'quiz' ? ' <span class="cell-sub">(auto-graded)</span>' : '') + '</td>' +
          '<td>' + esc(it.courseName) + '</td><td>' + timeAgo(it.submittedAt) + '</td>' +
          '<td>' + (it.score != null ? it.score + '%' : '—') + '</td>' +
          '<td>' + (it.status === 'graded' ? '<span class="pill pill-done">Graded</span>' : (it.type === 'quiz' ? '<span class="pill pill-done">Auto-graded</span>' : '<button type="button" class="btn-primary" data-grade-open="' + it.submissionId + '" data-student="' + esc(it.studentName) + '" data-assessment="' + esc(it.assessmentTitle) + '">Grade</button>')) + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
      document.getElementById('view-grading').innerHTML = html;
    });
  }

  function renderDiscussion() {
    return loadCourses().then(function (courses) {
      if (courses.length === 0) { document.getElementById('view-discussion').innerHTML = '<h2 class="section-title">Discussion</h2><p class="section-sub">No classes assigned yet.</p>'; return; }
      return Promise.all(courses.map(function (c) { return api('/api/course-detail/' + c.id); })).then(function (details) {
        var html = '<h2 class="section-title">Discussion</h2>';
        html += '<div class="course-tabs" id="fdCourseTabs">' + details.map(function (c, i) { return '<button type="button" class="course-tab' + (i === 0 ? ' active' : '') + '" data-fd-course="c' + c.id + '">' + esc(c.name) + '</button>'; }).join('') + '</div>';
        details.forEach(function (c, i) {
          html += '<div class="course-section' + (i === 0 ? ' active' : '') + '" data-fd-course-panel="c' + c.id + '"><div class="week-tabs">' +
            c.modules.map(function (m, j) { return '<button type="button" class="week-tab' + (j === 0 ? ' active' : '') + '" data-fd-week="m' + m.id + '">' + esc(shortTitle(m.title)) + '</button>'; }).join('') + '</div>';
          c.modules.forEach(function (m, j) {
            html += '<div class="week-panel' + (j === 0 ? ' active' : '') + '" data-fd-week-panel="m' + m.id + '"><div class="card"><div class="thread-posts" id="fposts-' + m.id + '"><div class="post-empty">Loading…</div></div></div>' +
              '<div class="card composer-card"><form class="composer" data-module-id="' + m.id + '"><div class="composer-input-row"><div class="post-avatar" style="background:var(--moss-tint); color:var(--moss);">' + esc(me.initials) + '</div>' +
              '<div style="flex:1; display:flex; flex-direction:column; gap:8px;"><textarea class="composer-text" rows="2" placeholder="Reply as teacher…"></textarea>' +
              '</div></div><div class="composer-footer" style="align-items:center;">' +
              '<label style="cursor:pointer; font-size:1.4rem; color:var(--slate); margin-right:6px;" title="Attach File">📎<input type="file" class="composer-file" accept=".pdf,.pptx,.doc,.docx" style="display:none"></label>' +
              '<span class="file-name-display" style="margin-right:auto; font-size:0.8rem; color:var(--sky-deep);"></span>' +
              '<button type="submit" class="composer-send">Post</button></div></form></div></div>';
          });
          html += '</div>';
        });
        document.getElementById('view-discussion').innerHTML = html;
        var ctabs = document.getElementById('fdCourseTabs');
        ctabs.querySelectorAll('.course-tab').forEach(function (t) {
          t.addEventListener('click', function () {
            var key = t.getAttribute('data-fd-course');
            ctabs.querySelectorAll('.course-tab').forEach(function (x) { x.classList.remove('active'); });
            t.classList.add('active');
            document.querySelectorAll('[data-fd-course-panel]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-fd-course-panel') === key); });
          });
        });
        document.querySelectorAll('#view-discussion .week-tabs').forEach(function (wt) {
          wt.querySelectorAll('.week-tab').forEach(function (t) {
            t.addEventListener('click', function () {
              var key = t.getAttribute('data-fd-week');
              wt.querySelectorAll('.week-tab').forEach(function (x) { x.classList.remove('active'); });
              t.classList.add('active');
              wt.parentElement.querySelectorAll('[data-fd-week-panel]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-fd-week-panel') === key); });
            });
          });
        });
        details.forEach(function (c) { c.modules.forEach(function (m) { loadFPosts(m.id); }); });
        document.querySelectorAll('#view-discussion form.composer').forEach(function (form) {
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            var moduleId = form.getAttribute('data-module-id');
            var text = form.querySelector('.composer-text').value.trim();
            var fileInp = form.querySelector('.composer-file');
            var sendBtn = form.querySelector('.composer-send');

            if (!text && (!fileInp.files || !fileInp.files[0])) return;

            sendBtn.disabled = true;
            sendBtn.textContent = 'Posting...';

            var doSubmit = function(fileName, fileData) {
              api('/api/modules/' + moduleId + '/posts', { method: 'POST', body: { text: text, fileName: fileName, fileData: fileData } })
                .then(function () {
                  form.querySelector('.composer-text').value = '';
                  fileInp.value = '';
                  loadFPosts(moduleId);
                  showToast('Posted.');
                  sendBtn.disabled = false; sendBtn.textContent = 'Post';
                })
                .catch(function(err) {
                  showToast(err.message, true);
                  sendBtn.disabled = false; sendBtn.textContent = 'Post';
                });
            };

            if (fileInp.files && fileInp.files[0]) {
              var file = fileInp.files[0];
              if (file.size > 10 * 1024 * 1024) { showToast('File attached is too large. Max 10MB.', true); sendBtn.disabled = false; sendBtn.textContent = 'Post'; return; }
              var reader = new FileReader();
              reader.onload = function() { doSubmit(file.name, reader.result); };
              reader.readAsDataURL(file);
            } else {
              doSubmit(null, null);
            }
          });
        });
      });
    });
  }
  function loadFPosts(moduleId) {
    api('/api/modules/' + moduleId + '/posts').then(function (d) {
      var el = document.getElementById('fposts-' + moduleId);
      if (!el) return;
      if (d.posts.length === 0) { el.innerHTML = '<div class="post-empty">No discussion yet.</div>'; return; }
      el.innerHTML = d.posts.map(function (p) {
        var isTeacher = p.authorRole === 'FACULTY';
        var attachHtml = '';
        if (p.fileData) {
          attachHtml = '<div style="margin-top:8px;"><a href="/api/posts/' + p.id + '/download" class="btn-secondary" style="font-size:0.75rem; padding:4px 8px;" download>📎 ' + esc(p.fileName || 'Attachment') + '</a></div>';
        }
        return '<div class="post"><div class="post-avatar"' + (isTeacher ? ' style="background:var(--moss-tint); color:var(--moss);"' : '') + '>' + esc(p.authorInitials) + '</div>' +
          '<div class="post-body"><div class="p-name">' + esc(p.authorName) + (isTeacher ? ' (Teacher)' : '') + '</div><div class="p-text">' + esc(p.text) + '</div>' + attachHtml + '</div></div>';
      }).join('');
    });
  }

  function renderAnnouncements() {
    return Promise.all([api('/api/announcements'), loadCourses()]).then(function (r) {
      var d = r[0], courses = r[1];
      var html = '<h2 class="section-title">Announcements</h2>';
      html += '<div class="card"><div class="card-head"><h3>Post to a class</h3></div><form class="announce-form" id="fAnnounceForm">' +
        '<select id="fAnnCourse">' + courses.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select>' +
        '<input type="text" id="fAnnTitle" placeholder="Title" required>' +
        '<textarea id="fAnnMessage" placeholder="Message" required></textarea>' +
        '<div class="announce-form-footer"><button type="submit" class="btn-primary">Post</button></div></form></div>';
      html += '<div class="card"><div class="card-head"><h3>Recent</h3></div>';
      if (d.announcements.length === 0) html += '<p style="color:var(--slate);">No announcements yet.</p>';
      d.announcements.forEach(function (a) {
        html += '<div class="announce"><div class="a-title">' + esc(a.title) + '</div><div class="a-text">' + esc(a.message) + '</div><div class="a-meta">' + (a.scope === 'academy' ? 'Academy-wide' : esc(a.courseName)) + ' · ' + timeAgo(a.createdAt) + '</div></div>';
      });
      html += '</div>';
      document.getElementById('view-announcements').innerHTML = html;
      document.getElementById('fAnnounceForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var courseId = document.getElementById('fAnnCourse').value;
        var title = document.getElementById('fAnnTitle').value.trim();
        var message = document.getElementById('fAnnMessage').value.trim();
        api('/api/announcements', { method: 'POST', body: { scope: 'course', courseId: courseId, title: title, message: message } })
          .then(function () { showToast('Posted.'); renderAnnouncements(); })
          .catch(function (e) { showToast(e.message, true); });
      });
    });
  }

  function renderRoster() {
    return loadCourses().then(function (courses) {
      if (courses.length === 0) { document.getElementById('view-roster').innerHTML = '<h2 class="section-title">Roster</h2><p class="section-sub">No classes assigned yet.</p>'; return; }
      return Promise.all(courses.map(function (c) { return api('/api/courses/' + c.id + '/roster').then(function (r) { return { course: c, roster: r.roster }; }); })).then(function (results) {
        var html = '<h2 class="section-title">Roster</h2>';
        html += '<div class="course-tabs" id="rosterTabs">' + results.map(function (r, i) { return '<button type="button" class="course-tab' + (i === 0 ? ' active' : '') + '" data-roster-course="c' + r.course.id + '">' + esc(r.course.name) + '</button>'; }).join('') + '</div>';
        results.forEach(function (r, i) {
          html += '<div class="tab-panel' + (i === 0 ? ' active' : '') + '" data-roster-panel="c' + r.course.id + '"><div class="card"><div class="table-wrap"><table><thead><tr><th>Student</th><th>Contact</th><th>Progress</th></tr></thead><tbody>';
          r.roster.forEach(function (s) {
            var logData = encodeURIComponent(JSON.stringify(s.logs));
            html += '<tr><td style="vertical-align:middle;"><div class="cell-student"><div class="cell-avatar">' + esc(s.initials) + '</div>' + esc(s.name) + '</div></td><td style="vertical-align:middle;">' + esc(s.email) + '</td>' +
              '<td style="vertical-align:middle; display:flex; align-items:center; gap:10px;"><div class="roster-bar-track" style="width:110px;"><div class="roster-bar-fill" style="width:' + s.progress + '%"></div></div>' + s.progress + '%' +
              '<button class="btn-secondary btn-small" data-show-logs="' + esc(s.name) + '" data-logs-content="' + logData + '" style="margin-left:auto;">View Logs</button></td></tr>';
          });
          html += '</tbody></table></div></div></div>';
        });
        document.getElementById('view-roster').innerHTML = html;
        var tabs = document.getElementById('rosterTabs');
        tabs.querySelectorAll('.course-tab').forEach(function (t) {
          t.addEventListener('click', function () {
            var key = t.getAttribute('data-roster-course');
            tabs.querySelectorAll('.course-tab').forEach(function (x) { x.classList.remove('active'); });
            t.classList.add('active');
            document.querySelectorAll('[data-roster-panel]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-roster-panel') === key); });
          });
        });
      });
    });
  }

  function renderProfile() {
    var avatarHtml = me.avatarUrl ? '<img src="' + me.avatarUrl + '">' : esc(me.initials);
    var html = '<h2 class="section-title">Profile</h2><div class="card"><div class="profile-grid"><div>' +
      '<div class="profile-avatar-wrap"><div class="profile-avatar-big" id="profileAvatarBig">' + avatarHtml + '</div>' +
      '<label class="avatar-upload-btn" for="avatarUploadInput" title="Upload photo">+</label><input type="file" id="avatarUploadInput" accept="image/jpeg,image/png" style="display:none;"></div></div>' +
      '<div><form id="profileForm">' +
      '<div class="field-row"><label>Name</label><input type="text" id="profName" value="' + esc(me.name) + '" style="border:1px solid var(--line); border-radius:8px; padding:8px 10px;"></div>' +
      '<div class="field-row"><label>Email</label><div class="val">' + esc(me.email) + '</div></div>' +
      '<div class="field-row"><label>Phone number</label><input type="text" id="profPhone" value="' + esc(me.phone || '') + '" style="border:1px solid var(--line); border-radius:8px; padding:8px 10px;"></div>' +
      '<div class="field-row"><label>Title</label><div class="val">' + esc(me.title || '') + '</div></div>' +
      '<div style="margin-top:16px;"><button type="submit" class="btn-primary">Save changes</button></div></form></div></div></div>';
    document.getElementById('view-profile').innerHTML = html;
    document.getElementById('profileForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('profName').value.trim();
      var phone = document.getElementById('profPhone').value.trim();
      api('/api/profile', { method: 'PUT', body: { name: name, phone: phone } }).then(function () {
        me.name = name; me.phone = phone;
        document.querySelector('.tb-name').innerHTML = esc(name) + '<small>' + esc(me.title || 'Faculty') + '</small>';
        showToast('Profile updated.');
      });
    });
    document.getElementById('avatarUploadInput').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!/^image\/(jpeg|png)$/.test(file.type)) { showToast('Please choose a JPEG or PNG image.', true); return; }
      var reader = new FileReader();
      reader.onload = function () {
        api('/api/profile/avatar', { method: 'POST', body: { dataUrl: reader.result } }).then(function () {
          document.getElementById('profileAvatarBig').innerHTML = '<img src="' + reader.result + '">';
          var tb = document.getElementById('tbAvatar');
          tb.style.backgroundImage = 'url(' + reader.result + ')'; tb.style.backgroundSize = 'cover'; tb.textContent = '';
          showToast('Photo updated.');
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // -------- Modals (Logs, Grades) --------
  var logOverlay = document.createElement('div');
  logOverlay.className = 'modal-overlay';
  logOverlay.id = 'logOverlay';
  document.body.appendChild(logOverlay);

  var gradeOverlay = document.createElement('div');
  gradeOverlay.className = 'modal-overlay';
  gradeOverlay.id = 'gradeOverlay';
  document.body.appendChild(gradeOverlay);

  document.body.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-grade-open]');
    if (!btn) return;
    var id = btn.getAttribute('data-grade-open');
    gradeOverlay.innerHTML = '<div class="modal"><h3>Grade submission</h3><p class="modal-sub">' + esc(btn.getAttribute('data-student')) + ' — ' + esc(btn.getAttribute('data-assessment')) + '</p>' +
      '<label>Score (%)</label><input type="number" id="gradeScore" min="0" max="100">' +
      '<label>Feedback (optional)</label><textarea id="gradeFeedback"></textarea>' +
      '<div class="modal-actions"><button type="button" class="btn-secondary" id="gradeCancel">Cancel</button><button type="button" class="btn-primary" id="gradeSave">Save</button></div></div>';
    gradeOverlay.classList.add('show');
    document.getElementById('gradeCancel').addEventListener('click', function () { gradeOverlay.classList.remove('show'); });
    document.getElementById('gradeSave').addEventListener('click', function () {
      var score = document.getElementById('gradeScore').value;
      api('/api/submissions/' + id + '/grade', { method: 'PUT', body: { score: score, feedback: document.getElementById('gradeFeedback').value } })
        .then(function () { gradeOverlay.classList.remove('show'); showToast('Graded.'); renderGrading(); renderDashboard(); })
        .catch(function (e) { showToast(e.message, true); });
    });
  });

  document.body.addEventListener('click', function (e) {
    var logBtn = e.target.closest('[data-show-logs]');
    if (logBtn) {
      var studentName = logBtn.getAttribute('data-show-logs');
      var logsData = JSON.parse(decodeURIComponent(logBtn.getAttribute('data-logs-content') || '[]'));
      var listHtml = logsData.length ? logsData.map(function(lg) { return '<li style="margin-bottom:8px; border-bottom:1px solid var(--line); padding-bottom:8px;">' + esc(lg.text) + ' <br><small style="color:var(--slate);">' + timeAgo(lg.createdAt) + '</small></li>'; }).join('') : '<li>No recent activity to show.</li>';
      logOverlay.innerHTML = '<div class="modal"><h3>Activity Logs</h3><p class="modal-sub">Recent actions for ' + esc(studentName) + '</p>' +
        '<ul style="list-style:none; padding:0; margin:16px 0;">' + listHtml + '</ul>' +
        '<div class="modal-actions"><button type="button" class="btn-primary" id="logClose">Close</button></div></div>';
      logOverlay.classList.add('show');
      document.getElementById('logClose').addEventListener('click', function() { logOverlay.classList.remove('show'); });
      return;
    }
  });

  // -------- add module / material / schedule --------
  document.body.addEventListener('click', function (e) {
    var addModBtn = e.target.closest('[data-add-module]');
    if (addModBtn) {
      var cid = addModBtn.getAttribute('data-add-module');
      var input = document.querySelector('[data-new-module-input="' + cid + '"]');
      var title = input.value.trim();
      if (!title) return;
      api('/api/courses/' + cid + '/modules', { method: 'POST', body: { title: title } }).then(function () { showToast('Module added.'); renderClasses(); }).catch(function (e) { showToast(e.message, true); });
      return;
    }
    var delMod = e.target.closest('[data-del-module]');
    if (delMod) {
      if (confirm('Are you sure you want to remove this module safely?')) {
        api('/api/modules/' + delMod.getAttribute('data-del-module'), { method: 'DELETE' })
          .then(function () { renderClasses(); showToast('Module removed.'); })
          .catch(function (e) { showToast(e.message, true); });
      }
      return;
    }
    var delMat = e.target.closest('[data-del-material]');
    if (delMat) { api('/api/materials/' + delMat.getAttribute('data-del-material'), { method: 'DELETE' }).then(function () { renderClasses(); }); return; }
    var delSched = e.target.closest('[data-del-schedule]');
    if (delSched) { api('/api/schedule/' + delSched.getAttribute('data-del-schedule'), { method: 'DELETE' }).then(function () { renderClasses(); }); return; }
    var addSched = e.target.closest('[data-add-schedule]');
    if (addSched) {
      var courseId = addSched.getAttribute('data-add-schedule');
      var overlay = document.getElementById('schedOverlay') || (function () { var o = document.createElement('div'); o.className = 'modal-overlay'; o.id = 'schedOverlay'; document.body.appendChild(o); return o; })();
      overlay.innerHTML = '<div class="modal"><h3>Schedule a session</h3><label>Title</label><input type="text" id="schedTitle"><label>Date</label><input type="date" id="schedDate"><label>Time</label><input type="time" id="schedTime"><label>Meeting URL</label><input type="url" id="schedUrl">' +
        '<div class="modal-actions"><button type="button" class="btn-secondary" id="schedCancel">Cancel</button><button type="button" class="btn-primary" id="schedSave">Save</button></div></div>';
      overlay.classList.add('show');
      document.getElementById('schedCancel').addEventListener('click', function () { overlay.classList.remove('show'); });
      document.getElementById('schedSave').addEventListener('click', function () {
        api('/api/courses/' + courseId + '/schedule', { method: 'POST', body: { title: document.getElementById('schedTitle').value.trim(), date: document.getElementById('schedDate').value, time: document.getElementById('schedTime').value, meetingUrl: document.getElementById('schedUrl').value } })
          .then(function () { overlay.classList.remove('show'); showToast('Session scheduled.'); renderClasses(); })
          .catch(function (e) { showToast(e.message, true); });
      });
    }
  });
  document.body.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-add-material]');
    if (form) {
      e.preventDefault();
      var moduleId = form.getAttribute('data-add-material');
      var title = form.querySelector('[data-mat-title]').value.trim();
      var type = form.getAttribute('data-mat-type') || 'link';
      var sendBtn = form.querySelector('button[type="submit"]');

      sendBtn.disabled = true;
      sendBtn.textContent = 'Uploading...';

      if (type === 'file') {
        var fileInp = form.querySelector('[data-mat-file]');
        if (!fileInp.files[0]) { sendBtn.disabled = false; sendBtn.textContent = 'Upload File (+)'; return; }
        var file = fileInp.files[0];
        if (file.size > 10 * 1024 * 1024) { showToast('File too large. Max 10MB.', true); sendBtn.disabled = false; sendBtn.textContent = 'Upload File (+)'; return; }
        var reader = new FileReader();
        reader.onload = function() {
          api('/api/modules/' + moduleId + '/materials', { method: 'POST', body: { title: title, type: 'file', fileName: file.name, fileData: reader.result } })
            .then(function () { showToast('File attached.'); renderClasses(); })
            .catch(function (err) { showToast(err.message, true); sendBtn.disabled = false; sendBtn.textContent = 'Upload File (+)'; });
        };
        reader.readAsDataURL(file);
      } else {
        var url = form.querySelector('[data-mat-url]').value.trim();
        if (!title || !url) { sendBtn.disabled = false; sendBtn.textContent = 'Add link'; return; }
        api('/api/modules/' + moduleId + '/materials', { method: 'POST', body: { title: title, url: url, type: 'link' } })
          .then(function () { showToast('Link added.'); renderClasses(); })
          .catch(function (err) { showToast(err.message, true); sendBtn.disabled = false; sendBtn.textContent = 'Add link'; });
      }
    }
  });

  document.body.addEventListener('change', function(e) {
    if (e.target.classList.contains('composer-file')) {
      var form = e.target.closest('form');
      if (form && e.target.files[0]) {
        var display = form.querySelector('.file-name-display');
        if (display) display.textContent = e.target.files[0].name;
      }
    }
    if (e.target.hasAttribute('data-mat-file')) {
      var form = e.target.closest('form');
      if (form && e.target.files[0]) {
         var titleInp = form.querySelector('[data-mat-title]');
         var title = titleInp ? titleInp.value.trim() : '';
         if (!title) {
            titleInp.focus();
            showToast('Please enter a title before selecting a file to upload.', true);
            e.target.value = '';
            return;
         }
         var moduleId = form.getAttribute('data-add-material');
         var file = e.target.files[0];
         if (file.size > 10 * 1024 * 1024) { showToast('File too large. Max 10MB.', true); e.target.value = ''; return; }
         
         form.querySelector('.materials-send').disabled = true;
         form.querySelector('.materials-send').textContent = 'Uploading...';
         
         var reader = new FileReader();
         reader.onload = function() {
            api('/api/modules/' + moduleId + '/materials', { method: 'POST', body: { title: title, type: 'file', fileName: file.name, fileData: reader.result } })
              .then(function () { showToast('File attached.'); renderClasses(); })
              .catch(function (err) { showToast(err.message, true); form.querySelector('.materials-send').disabled = false; form.querySelector('.materials-send').textContent = 'Add link'; });
         };
         reader.readAsDataURL(file);
      }
    }
  });

  P.initViewSwitching(titles, function (name) {
    if (name === 'dashboard') renderDashboard();
    if (name === 'classes') renderClasses();
    if (name === 'grading') renderGrading();
    if (name === 'discussion') renderDiscussion();
    if (name === 'announcements') renderAnnouncements();
    if (name === 'roster') renderRoster();
    if (name === 'profile') renderProfile();
  });
})();
