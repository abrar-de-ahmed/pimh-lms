(function () {
  var P = window.PIMH;
  var api = P.api, esc = P.esc, showToast = P.showToast, timeAgo = P.timeAgo;
  var boot = window.__BOOT__ || {};
  var me = boot.user;
  var isSuper = !!boot.isSuperAdmin;

  var titles = { dashboard: 'Dashboard', users: 'Users', courses: 'Courses', enrollment: 'Enrollment', faculty: 'Faculty Assignments', announcements: 'Announcements', activity: 'Activity Log', settings: 'Settings', profile: 'Profile' };
  document.getElementById('content').innerHTML = Object.keys(titles).map(function (k) { return '<section class="view" id="view-' + k + '"></section>'; }).join('');

  function renderDashboard() {
    return api('/api/dashboard/admin').then(function (d) {
      var html = '<div class="welcome"><h2>Welcome back, ' + esc(d.name.split(' ')[0]) + '</h2>' +
        '<p>' + d.stats.courses + ' active courses this term, across ' + d.stats.faculty + ' faculty and ' + d.stats.students + ' students.</p></div>';
      html += '<div class="stat-grid">' +
        '<div class="stat-tile good"><div class="stat-tile-icon">👥</div><div class="stat-tile-body"><span class="num">' + d.stats.students + '</span><span class="label">Students enrolled</span></div></div>' +
        '<div class="stat-tile sky"><div class="stat-tile-icon">👨‍🏫</div><div class="stat-tile-body"><span class="num">' + d.stats.faculty + '</span><span class="label">Faculty accounts</span></div></div>' +
        '<div class="stat-tile gold"><div class="stat-tile-icon">🎓</div><div class="stat-tile-body"><span class="num">' + d.stats.courses + '</span><span class="label">Active courses</span></div></div>' +
        '<div class="stat-tile fire"><div class="stat-tile-icon">⚠️</div><div class="stat-tile-body"><span class="num">' + d.stats.pendingGrading + '</span><span class="label">Pending grading, academy-wide</span></div></div></div>';
      html += '<div class="dash-grid"><div>';
      html += '<div class="card"><div class="card-head"><h3>Needs attention</h3></div>';
      var any = false;
      if (d.unassignedFaculty.length) {
        any = true;
        d.unassignedFaculty.forEach(function (name) {
          html += '<a href="#" class="thread-item" data-view="faculty"><span class="thread-dot" style="background:var(--fire);"></span><div class="thread-item-body"><div class="th-text"><strong>' + esc(name) + '</strong> has no courses assigned yet</div><div class="th-meta">Added as faculty, not yet teaching a class · see Faculty →</div></div></a>';
        });
      }
      if (!any) html += '<p class="section-sub" style="margin:0;">Nothing needs attention right now.</p>';
      html += '</div>';
      html += '<div class="card"><div class="card-head"><h3>Recent activity</h3><a href="#" data-view="activity">View log</a></div>';
      if (d.activity.length === 0) html += '<p class="section-sub" style="margin:0;">No activity yet.</p>';
      d.activity.forEach(function (a) { 
        html += '<div class="log-item"><span class="log-dot" style="background:var(--slate-tint); border:2px solid var(--slate);"></span>' +
          '<div class="log-body"><div class="lg-text">' + esc(a.text) + '</div><div class="lg-meta">' + timeAgo(a.createdAt) + '</div></div></div>'; 
      });
      html += '</div></div><div>';
      html += '<div class="card"><div class="card-head"><h3>Course completion snapshot</h3><a href="#" data-view="courses">Courses</a></div>';
      d.courseSnapshot.forEach(function (c, i) {
        html += '<div class="course-row">' +
          '<div class="course-info"><div class="name">' + esc(c.name) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + c.avgProgress + '%"></div></div></div>' +
          '<div class="course-pct">' + c.avgProgress + '% <span style="font-size:0.75rem; color:var(--slate); display:block;">Across ' + c.enrolledCount + ' students</span></div></div>';
      });
      html += '</div><div class="card"><div class="card-head"><h3>Faculty load</h3><a href="#" data-view="faculty">Faculty</a></div>';
      d.facultyLoad.forEach(function (t, i) {
        html += '<div class="thread-item"' + (i === 0 ? ' style="border-top:none;"' : '') + '><span class="thread-dot" style="background:var(--sky-deep);"></span><div class="thread-item-body"><div class="th-text">' + esc(t.name) + '</div><div class="th-meta">' + t.courseCount + ' course(s) assigned' + (t.status !== 'ACTIVE' ? ' · <span style="color:var(--fire);">Inactive</span>' : '') + '</div></div></div>';
      });
      html += '</div></div></div>';
      document.getElementById('view-dashboard').innerHTML = html;
    });
  }

  function initials(name) { return P.esc ? name : name; }

  function renderUsers() {
    var fetches = isSuper ? [api('/api/users?role=FACULTY'), api('/api/users?role=STUDENT'), api('/api/users?role=ADMIN'), api('/api/users?role=SUPER_ADMIN')] : [api('/api/users?role=FACULTY'), api('/api/users?role=STUDENT')];
    return Promise.all(fetches).then(function (r) {
      var teachers = r[0].users, students = r[1].users;
      var admins = isSuper ? r[2].users.concat(r[3].users) : [];
      var html = '<div class="section-title">Users</div><div class="section-sub">Manage accounts across the academy.</div>';
      html += '<div class="course-tabs" id="usersTabs"><button class="course-tab active" data-users-tab="teachers">Teachers</button><button class="course-tab" data-users-tab="students">Students</button>' + (isSuper ? '<button class="course-tab" data-users-tab="admins">Administrators</button>' : '') + '</div>';
      html += '<div class="tab-panel active" data-users-panel="teachers"><div class="card"><div class="card-head"><h3>Teacher accounts</h3>' + (isSuper ? '<button class="btn-primary" id="addTeacherBtn">+ Add teacher</button>' : '<span class="cell-sub">Only a Super Admin can add or edit teacher accounts.</span>') + '</div>';
      html += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Contact</th><th>Teaching</th><th>Status</th><th style="text-align:right;"></th></tr></thead><tbody>';
      teachers.forEach(function (t) {
        html += '<tr><td><div class="cell-student"><div class="cell-avatar">' + esc(t.initials) + '</div>' + esc(t.name) + '</div></td>' +
          '<td>' + esc(t.email) + '<div class="cell-sub">' + esc(t.phone || '') + '</div></td>' +
          '<td>' + (t.courses.length ? esc(t.courses.join(', ')) : '<span class="cell-sub">Unassigned</span>') + '</td>' +
          '<td><span class="pill ' + (t.status === 'ACTIVE' ? 'pill-active' : 'pill-inactive') + '">' + t.status + '</span></td>' +
          '<td style="white-space:nowrap; text-align:right;">' + (isSuper ? '<button class="btn-secondary btn-small" data-edit-user="' + t.id + '" data-role="FACULTY">Edit</button> <button class="btn-danger-text" data-toggle-user="' + t.id + '">' + (t.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate') + '</button>' : '') + '</td></tr>';
      });
      html += '</tbody></table></div></div></div>';

      html += '<div class="tab-panel" data-users-panel="students"><div class="card"><div class="card-head"><h3>Student accounts</h3><button class="btn-primary" id="addStudentBtn">+ Add student</button></div>';
      html += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Contact</th><th>Enrolled in</th><th>Status</th><th style="text-align:right;"></th></tr></thead><tbody>';
      students.forEach(function (s) {
        html += '<tr data-row-sid="' + s.id + '"><td><div class="cell-student"><div class="cell-avatar">' + esc(s.initials) + '</div>' + esc(s.name) + '</div></td>' +
          '<td>' + esc(s.email) + '<div class="cell-sub">' + esc(s.phone || '') + '</div></td>' +
          '<td>' + s.enrolledCount + ' course(s)</td>' +
          '<td><span class="pill ' + (s.status === 'ACTIVE' ? 'pill-active' : 'pill-inactive') + '">' + s.status + '</span></td>' +
          '<td style="white-space:nowrap; text-align:right;"><button class="btn-secondary btn-small" data-edit-user="' + s.id + '" data-role="STUDENT">Edit</button> <button class="btn-danger-text" data-toggle-user="' + s.id + '">' + (s.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate') + '</button></td></tr>';
      });
      html += '</tbody></table></div></div></div>';

      if (isSuper) {
        html += '<div class="tab-panel" data-users-panel="admins"><div class="card"><div class="card-head"><h3>Administrator accounts</h3><button class="btn-primary" id="addAdminBtn">+ Add admin</button></div>';
        html += '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Contact</th><th>Role</th><th>Status</th><th style="text-align:right;"></th></tr></thead><tbody>';
        admins.forEach(function (a) {
          html += '<tr><td><div class="cell-student"><div class="cell-avatar">' + esc(a.initials) + '</div>' + esc(a.name) + '</div></td>' +
            '<td>' + esc(a.email) + '<div class="cell-sub">' + esc(a.phone || '') + '</div></td>' +
            '<td>' + (a.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin') + '</td>' +
            '<td><span class="pill ' + (a.status === 'ACTIVE' ? 'pill-active' : 'pill-inactive') + '">' + a.status + '</span></td>' +
            '<td style="white-space:nowrap; text-align:right;"><button class="btn-secondary btn-small" data-edit-user="' + a.id + '" data-role="' + a.role + '">Edit</button> <button class="btn-danger-text" data-toggle-user="' + a.id + '">' + (a.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate') + '</button></td></tr>';
        });
        html += '</tbody></table></div></div></div>';
      }

      document.getElementById('view-users').innerHTML = html;

      var tabs = document.getElementById('usersTabs');
      tabs.querySelectorAll('.course-tab').forEach(function (t) {
        t.addEventListener('click', function () {
          var key = t.getAttribute('data-users-tab');
          tabs.querySelectorAll('.course-tab').forEach(function (x) { x.classList.remove('active'); });
          t.classList.add('active');
          document.querySelectorAll('[data-users-panel]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-users-panel') === key); });
        });
      });
      if (isSuper) document.getElementById('addTeacherBtn').addEventListener('click', function () { openUserModal('FACULTY'); });
      document.getElementById('addStudentBtn').addEventListener('click', function () { openUserModal('STUDENT'); });
      if (isSuper) document.getElementById('addAdminBtn').addEventListener('click', function () { openUserModal('ADMIN'); });
    });
  }

  var userOverlay = document.createElement('div'); userOverlay.className = 'modal-overlay'; userOverlay.id = 'userOverlay'; document.body.appendChild(userOverlay);
  function openUserModal(role, editing) {
    var roleLabel = role === 'FACULTY' ? 'teacher' : (role === 'STUDENT' ? 'student' : 'administrator');
    userOverlay.innerHTML = '<div class="modal wide"><h3>' + (editing ? 'Edit ' : 'Add ') + roleLabel + '</h3>' +
      '<p class="modal-sub">' + (editing ? 'Update their account details.' : 'They will receive an email to complete setup.') + '</p>' +
      '<div class="settings-grid">' +
      '<div class="field"><label>Name</label><input type="text" id="uName" value="' + esc(editing ? editing.name : '') + '"></div>' +
      '<div class="field"><label>Email address</label><input type="email" id="uEmail" value="' + esc(editing ? editing.email : '') + '"></div>' +
      '<div class="field"><label>Phone number</label><input type="text" id="uPhone" value="' + esc(editing ? editing.phone || '' : '') + '"></div>' +
      (role === 'FACULTY' ? '<div class="field"><label>Job title</label><input type="text" id="uTitle" value="' + esc(editing ? editing.title || '' : '') + '"></div>' : '') +
      ((role === 'ADMIN' || role === 'SUPER_ADMIN') ? '<div class="field"><label>Administrator Role</label><select id="uRole"><option value="ADMIN"' + (role === 'ADMIN' ? ' selected' : '') + '>Admin</option><option value="SUPER_ADMIN"' + (role === 'SUPER_ADMIN' ? ' selected' : '') + '>Super Admin</option></select></div>' : '') +
      '</div>' +
      '<div class="modal-error" id="uError">Please fill in a name and email.</div>' +
      '<div class="modal-actions" style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);"><button type="button" class="btn-secondary" id="uCancel">Cancel</button><button type="button" class="btn-primary" id="uSave">Save account</button></div></div>';
    userOverlay.classList.add('show');
    document.getElementById('uCancel').addEventListener('click', function () { userOverlay.classList.remove('show'); });
    document.getElementById('uSave').addEventListener('click', function () {
      var name = document.getElementById('uName').value.trim();
      var email = document.getElementById('uEmail').value.trim();
      if (!name || !email) { document.getElementById('uError').classList.add('show'); return; }
      var uRoleEl = document.getElementById('uRole');
      var finalRole = uRoleEl ? uRoleEl.value : role;
      var payload = { name: name, email: email, phone: document.getElementById('uPhone').value.trim(), role: finalRole };
      var titleEl = document.getElementById('uTitle');
      if (titleEl) payload.title = titleEl.value.trim();
      var req = editing ? api('/api/users/' + editing.id, { method: 'PUT', body: payload }) : api('/api/users', { method: 'POST', body: payload });
      req.then(function (res) {
        userOverlay.classList.remove('show');
        showToast(editing ? 'Updated.' : ('Account created' + (res.tempPassword ? ' — temp password: ' + res.tempPassword : '') + '.'));
        renderUsers();
      }).catch(function (e) { document.getElementById('uError').textContent = e.message; document.getElementById('uError').classList.add('show'); });
    });
  }

  document.body.addEventListener('click', function (e) {
    var editBtn = e.target.closest('[data-edit-user]');
    if (editBtn) {
      var id = editBtn.getAttribute('data-edit-user'); var role = editBtn.getAttribute('data-role');
      api('/api/users?role=' + role).then(function (r) { var u = r.users.find(function (x) { return String(x.id) === id; }); if (u) openUserModal(role, u); });
      return;
    }
    var toggleBtn = e.target.closest('[data-toggle-user]');
    if (toggleBtn) { api('/api/users/' + toggleBtn.getAttribute('data-toggle-user') + '/status', { method: 'PATCH' }).then(function () { showToast('Updated.'); renderUsers(); }).catch(function (e) { showToast(e.message, true); }); return; }
  });

  function renderCourses() {
    return api('/api/courses').then(function (d) {
      var html = '<div class="section-title">Courses</div><div class="section-sub">The academy\'s course catalog.</div>';
      html += '<div class="card-head" style="margin-bottom:18px;"><div></div><button class="btn-primary" id="addCourseBtn">+ Add course</button></div>';
      html += '<div class="course-cards">';
      d.courses.forEach(function (c) {
        html += '<div class="course-card"><div class="cc-head"><h3>' + esc(c.name) + '</h3><span class="pill pill-' + c.status.toLowerCase() + '">' + c.status + '</span></div>' +
          '<p class="cc-desc">' + esc(c.description || '') + '</p>' +
          '<div class="cc-meta"><span>' + c.enrolledCount + ' students · ' + c.modules.length + ' modules</span><span>' + (c.teachers.length ? c.teachers.map(function (t) { return t.name; }).join(', ') : 'No teacher assigned') + '</span></div>' +
          '<div class="cc-progress"><div class="cc-progress-label"><span>Average progress</span><span>' + c.avgProgress + '%</span></div><div class="bar-track"><div class="bar-fill" style="width:' + c.avgProgress + '%"></div></div></div>' +
          '<div class="cc-actions"><button class="btn-secondary btn-small" data-edit-course="' + c.id + '">Edit</button><button class="btn-secondary btn-small" data-toggle-modules="' + c.id + '">Modules</button><button class="btn-danger-text" data-del-course="' + c.id + '">Delete</button></div>' +
          '<div class="module-chips" id="modchips-' + c.id + '">' + c.modules.map(function (m) { return '<div class="module-chip"><span>' + esc(m.title) + '</span></div>'; }).join('') +
          '<div class="add-module-row"><input type="text" data-newmod="' + c.id + '" placeholder="New module title…"><button class="btn-secondary btn-small" data-addmod="' + c.id + '">Add</button></div></div>' +
          '</div>';
      });
      html += '</div>';
      document.getElementById('view-courses').innerHTML = html;
      document.getElementById('addCourseBtn').addEventListener('click', function () { openCourseModal(); });
    });
  }

  var courseOverlay = document.createElement('div'); courseOverlay.className = 'modal-overlay'; courseOverlay.id = 'courseOverlay'; document.body.appendChild(courseOverlay);
  function openCourseModal(editing) {
    courseOverlay.innerHTML = '<div class="modal"><h3>' + (editing ? 'Edit course' : 'Add course') + '</h3>' +
      '<p class="modal-sub">Set up the details for this cohort class.</p>' +
      '<div class="field"><label>Course name</label><input type="text" id="cName" value="' + esc(editing ? editing.name : '') + '"></div>' +
      '<div class="field" style="margin-top:14px;"><label>Description</label><textarea id="cDesc">' + esc(editing ? editing.description || '' : '') + '</textarea></div>' +
      '<div class="field" style="margin-top:14px;"><label>Status</label><select id="cStatus"><option value="Draft">Draft (Hidden)</option><option value="Active">Active & Open</option><option value="Archived">Archived</option></select></div>' +
      '<div class="modal-error" id="cError">Please give the course a name.</div>' +
      '<div class="modal-actions" style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);"><button type="button" class="btn-secondary" id="cCancel">Cancel</button><button type="button" class="btn-primary" id="cSave">Save details</button></div></div>';
    if (editing) document.getElementById('cStatus').value = editing.status;
    courseOverlay.classList.add('show');
    document.getElementById('cCancel').addEventListener('click', function () { courseOverlay.classList.remove('show'); });
    document.getElementById('cSave').addEventListener('click', function () {
      var name = document.getElementById('cName').value.trim();
      if (!name) { document.getElementById('cError').classList.add('show'); return; }
      var payload = { name: name, description: document.getElementById('cDesc').value.trim(), status: document.getElementById('cStatus').value };
      var req = editing ? api('/api/courses/' + editing.id, { method: 'PUT', body: payload }) : api('/api/courses', { method: 'POST', body: payload });
      req.then(function () { courseOverlay.classList.remove('show'); showToast('Saved.'); renderCourses(); }).catch(function (e) { showToast(e.message, true); });
    });
  }

  document.body.addEventListener('click', function (e) {
    var editC = e.target.closest('[data-edit-course]');
    if (editC) { api('/api/courses').then(function (d) { var c = d.courses.find(function (x) { return String(x.id) === editC.getAttribute('data-edit-course'); }); openCourseModal(c); }); return; }
    var delC = e.target.closest('[data-del-course]');
    if (delC) { if (confirm('Delete this course? This cannot be undone.')) api('/api/courses/' + delC.getAttribute('data-del-course'), { method: 'DELETE' }).then(function () { showToast('Deleted.'); renderCourses(); }); return; }
    var togMod = e.target.closest('[data-toggle-modules]');
    if (togMod) { document.getElementById('modchips-' + togMod.getAttribute('data-toggle-modules')).classList.toggle('show'); return; }
    var addMod = e.target.closest('[data-addmod]');
    if (addMod) {
      var cid = addMod.getAttribute('data-addmod');
      var input = document.querySelector('[data-newmod="' + cid + '"]');
      var title = input.value.trim();
      if (!title) return;
      api('/api/courses/' + cid + '/modules', { method: 'POST', body: { title: title } }).then(function () { showToast('Module added.'); renderCourses(); });
      return;
    }
  });

  function renderEnrollment() {
    return Promise.all([api('/api/courses'), api('/api/users?role=STUDENT'), api('/api/enrollments/pending')]).then(function (r) {
      var courses = r[0].courses, students = r[1].users, pending = r[2].pending;
      var html = '<div class="section-title">Enrollment</div><div class="section-sub">Manage which students are enrolled in each course.</div>';
      
      if (pending && pending.length > 0) {
        html += '<div class="card" style="border:1px solid var(--fire);"><div class="card-head" style="color:var(--fire); margin-bottom:12px;"><h3>Action Required: Pending Requests</h3></div>';
        html += '<div class="table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Payment Receipt</th><th style="text-align:right;">Actions</th></tr></thead><tbody>';
        pending.forEach(function (p) {
          var receiptHtml = p.payment_receipt_url ? '<a href="' + esc(p.payment_receipt_url) + '" target="_blank" rel="noopener">&#128206; View Receipt</a>' : '<span style="color:var(--slate);">None</span>';
          html += '<tr><td><strong>' + esc(p.student_name) + '</strong></td><td>' + esc(p.course_name) + '</td><td>' + receiptHtml + '</td>' +
            '<td style="text-align:right;"><button class="btn-primary btn-small" data-approve-enroll="' + p.id + '" style="margin-right:8px;">Approve</button>' +
            '<button class="btn-secondary btn-small" data-reject-enroll="' + p.id + '">Reject</button></td></tr>';
        });
        html += '</tbody></table></div></div><br>';
      }

      html += '<div class="course-tabs" id="enrollTabs">' + courses.map(function (c, i) { return '<button class="course-tab' + (i === 0 ? ' active' : '') + '" data-enroll-course="c' + c.id + '">' + esc(c.name) + '</button>'; }).join('') + '</div>';
      courses.forEach(function (c, i) {
        html += '<div class="tab-panel' + (i === 0 ? ' active' : '') + '" data-enroll-panel="c' + c.id + '"><div class="card"><div class="table-wrap"><table><thead><tr><th>Student</th><th>Email</th><th style="text-align:right;">Enrolled</th></tr></thead><tbody>';
        students.forEach(function (s) {
          html += '<tr><td><div class="cell-student"><div class="cell-avatar">' + esc(s.initials) + '</div>' + esc(s.name) + '</div></td><td>' + esc(s.email) + '</td>' +
            '<td style="text-align:right;"><label class="toggle"><input type="checkbox" data-enroll-toggle data-student="' + s.id + '" data-course="' + c.id + '"><span class="toggle-track"></span></label></td></tr>';
        });
        html += '</tbody></table></div></div></div>';
      });
      document.getElementById('view-enrollment').innerHTML = html;
      var tabs = document.getElementById('enrollTabs');
      if (tabs) {
        tabs.querySelectorAll('.course-tab').forEach(function (t) {
          t.addEventListener('click', function () {
            var key = t.getAttribute('data-enroll-course');
            tabs.querySelectorAll('.course-tab').forEach(function (x) { x.classList.remove('active'); });
            t.classList.add('active');
            document.querySelectorAll('[data-enroll-panel]').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-enroll-panel') === key); });
          });
        });
      }
      courses.forEach(function (c) {
        api('/api/courses/' + c.id + '/roster').then(function (r2) {
          var ids = r2.roster.map(function (s) { return String(s.id); });
          document.querySelectorAll('[data-enroll-toggle][data-course="' + c.id + '"]').forEach(function (cb) {
            cb.checked = ids.indexOf(cb.getAttribute('data-student')) !== -1;
          });
        });
      });
    });
  }
  document.body.addEventListener('change', function (e) {
    var cb = e.target.closest('[data-enroll-toggle]');
    if (!cb) return;
    var studentId = cb.getAttribute('data-student'), courseId = cb.getAttribute('data-course');
    if (cb.checked) api('/api/enrollments', { method: 'POST', body: { studentId: studentId, courseId: courseId } }).then(function () { showToast('Enrolled.'); });
    else api('/api/enrollments?studentId=' + studentId + '&courseId=' + courseId, { method: 'DELETE' }).then(function () { showToast('Removed.'); });
  });

  document.body.addEventListener('click', function(e) {
    var approveBtn = e.target.closest('[data-approve-enroll]');
    if (approveBtn) {
      api('/api/enrollments/' + approveBtn.getAttribute('data-approve-enroll') + '/approve', { method: 'PATCH' }).then(function() {
        showToast('Enrollment approved.'); renderEnrollment();
      });
      return;
    }
    var rejectBtn = e.target.closest('[data-reject-enroll]');
    if (rejectBtn) {
      if (confirm('Are you sure you want to reject this enrollment request?')) {
        api('/api/enrollments/' + rejectBtn.getAttribute('data-reject-enroll') + '/reject', { method: 'DELETE' }).then(function() {
          showToast('Request rejected.'); renderEnrollment();
        });
      }
      return;
    }
  });

  function renderFaculty() {
    return Promise.all([api('/api/courses'), api('/api/users?role=FACULTY')]).then(function (r) {
      var courses = r[0].courses, teachers = r[1].users;
      var html = '<div class="section-title">Faculty Assignments</div><div class="section-sub">Which teacher is assigned to each course.</div>';
      html += '<div class="card"><div class="table-wrap"><table><thead><tr><th>Course</th><th>Assigned teacher</th><th style="text-align:right;"></th></tr></thead><tbody>';
      courses.forEach(function (c) {
        html += '<tr><td>' + esc(c.name) + '</td><td>' + (c.teachers.length ? esc(c.teachers[0].name) : '<span class="cell-sub">Unassigned</span>') + '</td>' +
          '<td style="text-align:right;"><button class="btn-secondary btn-small" data-reassign="' + c.id + '">Reassign</button></td></tr>';
      });
      html += '</tbody></table></div></div>';
      document.getElementById('view-faculty').innerHTML = html;
      window.__teachers = teachers;
    });
  }
  var reassignOverlay = document.createElement('div'); reassignOverlay.className = 'modal-overlay'; reassignOverlay.id = 'reassignOverlay'; document.body.appendChild(reassignOverlay);
  document.body.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-reassign]');
    if (!btn) return;
    var courseId = btn.getAttribute('data-reassign');
    var opts = (window.__teachers || []).map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; }).join('');
    reassignOverlay.innerHTML = '<div class="modal"><h3>Reassign faculty</h3><p class="modal-sub">Assign a new primary instructor to this course.</p>' +
      '<div class="field"><label>Teacher</label><select id="reassignSelect">' + opts + '</select></div>' +
      '<div class="modal-actions" style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line);"><button type="button" class="btn-secondary" id="reassignCancel">Cancel</button><button type="button" class="btn-primary" id="reassignSave">Save</button></div></div>';
    reassignOverlay.classList.add('show');
    document.getElementById('reassignCancel').addEventListener('click', function () { reassignOverlay.classList.remove('show'); });
    document.getElementById('reassignSave').addEventListener('click', function () {
      api('/api/courses/' + courseId + '/teacher', { method: 'POST', body: { teacherId: document.getElementById('reassignSelect').value } })
        .then(function () { reassignOverlay.classList.remove('show'); showToast('Assigned.'); renderFaculty(); });
    });
  });

  function renderAnnouncements() {
    return Promise.all([api('/api/announcements'), api('/api/courses')]).then(function (r) {
      var d = r[0], courses = r[1].courses;
      var html = '<div class="section-title">Academy Announcements</div><div class="section-sub">Broadcasts sent to every student and teacher, or to a specific course.</div>';
      html += '<div class="card"><div class="card-head"><h3>Post an announcement</h3></div><form class="announce-form" id="acAnnounceForm">' +
        '<select id="acScope"><option value="academy">Academy-wide</option><option value="course">Specific course</option></select>' +
        '<select id="acCourse" style="display:none;">' + courses.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select>' +
        '<input type="text" id="acTitle" placeholder="Title" required><textarea id="acMessage" placeholder="Message" required></textarea>' +
        '<div class="announce-form-footer"><button type="submit" class="btn-primary">Post</button></div></form></div>';
      html += '<div class="card"><div class="card-head"><h3>Sent</h3></div>';
      if (d.announcements.length === 0) html += '<p style="color:var(--slate);">No announcements yet.</p>';
      d.announcements.forEach(function (a) { html += '<div class="announce"><div class="a-title">' + esc(a.title) + '</div><div class="a-text">' + esc(a.message) + '</div><div class="a-meta">' + (a.scope === 'academy' ? 'Academy-wide' : esc(a.courseName)) + ' · ' + timeAgo(a.createdAt) + '</div></div>'; });
      html += '</div>';
      document.getElementById('view-announcements').innerHTML = html;
      document.getElementById('acScope').addEventListener('change', function () { document.getElementById('acCourse').style.display = this.value === 'course' ? '' : 'none'; });
      document.getElementById('acAnnounceForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var scope = document.getElementById('acScope').value;
        api('/api/announcements', { method: 'POST', body: { scope: scope, courseId: document.getElementById('acCourse').value, title: document.getElementById('acTitle').value.trim(), message: document.getElementById('acMessage').value.trim() } })
          .then(function () { showToast('Posted.'); renderAnnouncements(); }).catch(function (e) { showToast(e.message, true); });
      });
    });
  }

  function renderActivity() {
    return api('/api/activity').then(function (d) {
      var html = '<div class="section-title">Activity Log</div><div class="section-sub">Admin-level actions across the academy.</div><div class="card">';
      if (d.log.length === 0) html += '<p style="color:var(--slate);">No activity yet.</p>';
      d.log.forEach(function (l) { html += '<div class="log-item"><span class="log-dot"></span><div class="log-body"><div class="lg-text">' + esc(l.text) + (l.actorName ? ' <span class="cell-sub">— ' + esc(l.actorName) + '</span>' : '') + '</div><div class="lg-meta">' + timeAgo(l.createdAt) + '</div></div></div>'; });
      html += '</div>';
      document.getElementById('view-activity').innerHTML = html;
    });
  }

  function renderSettings() {
    if (!isSuper) { document.getElementById('view-settings').innerHTML = '<div class="section-title">Settings</div><p class="section-sub">Only a Super Admin can change academy settings.</p>'; return Promise.resolve(); }
    return api('/api/settings').then(function (d) {
      var s = d.settings;
      var html = '<div class="section-title">Settings & Configuration</div><div class="section-sub">Manage global academy policies and operational parameters.</div><form id="settingsForm">' +
        '<div class="card"><div class="card-head"><h3>📅 Academic Calendar</h3></div><div class="settings-grid cols-3" style="border-top:1px solid var(--line); padding-top:18px;">' +
        '<div class="field"><label>Term / cohort name</label><input type="text" id="setTermName" value="' + esc(s.termName || '') + '"></div>' +
        '<div class="field"><label>Term start</label><input type="date" id="setTermStart" value="' + esc(s.termStart || '') + '"></div>' +
        '<div class="field"><label>Term end</label><input type="date" id="setTermEnd" value="' + esc(s.termEnd || '') + '"></div></div></div>' +
        '<div class="card"><div class="card-head"><h3>🎓 Learning & Progress Policy</h3></div><div class="settings-grid" style="border-top:1px solid var(--line); padding-top:18px;">' +
        '<div class="field"><label>Module unlock threshold (%)</label><input type="number" id="setPassMark" min="0" max="100" value="' + esc(s.passMark || 70) + '"><div class="composer-hint">Score required to unlock subsequent modules in a course.</div></div></div></div>' +
        '<div class="card"><div class="card-head"><h3>⏱️ Standard Quiz Rules</h3></div><div class="settings-grid cols-2" style="border-top:1px solid var(--line); padding-top:18px;">' +
        '<div class="field"><label>Default time limit (minutes)</label><input type="number" id="setQuizTime" min="1" value="' + esc(s.quizTime || 30) + '"></div>' +
        '<div class="field"><label>Attempts allowed per quiz</label><input type="number" id="setQuizAttempts" min="1" value="' + esc(s.quizAttempts || 3) + '"></div></div></div>' +
        '<div class="settings-actions"><button type="submit" class="btn-primary" style="padding:10px 24px; font-size:0.9rem;">Save all changes</button></div></form>';
      document.getElementById('view-settings').innerHTML = html;
      document.getElementById('settingsForm').addEventListener('submit', function (e) {
        e.preventDefault();
        api('/api/settings', { method: 'PUT', body: {
          termName: document.getElementById('setTermName').value, termStart: document.getElementById('setTermStart').value, termEnd: document.getElementById('setTermEnd').value,
          passMark: document.getElementById('setPassMark').value, quizTime: document.getElementById('setQuizTime').value, quizAttempts: document.getElementById('setQuizAttempts').value,
        } }).then(function () { showToast('Saved.'); });
      });
    });
  }

  function renderProfile() {
    var avatarHtml = me.avatarUrl ? '<img src="' + me.avatarUrl + '">' : esc(me.initials);
    var html = '<div class="section-title">Profile</div><div class="section-sub">Your ' + (isSuper ? 'Super Admin' : 'Admin') + ' account.</div><div class="card"><div class="profile-grid"><div>' +
      '<div class="profile-avatar-wrap"><div class="profile-avatar-big gold" id="profileAvatarBig">' + avatarHtml + '</div>' +
      '<label class="avatar-upload-btn" for="avatarUploadInput" title="Upload photo">+</label><input type="file" id="avatarUploadInput" accept="image/jpeg,image/png" style="display:none;"></div></div>' +
      '<div><form id="profileForm">' +
      '<div class="field-row"><label>Name</label><input type="text" id="profName" value="' + esc(me.name) + '" style="border:1px solid var(--line); border-radius:8px; padding:8px 10px;"></div>' +
      '<div class="field-row"><label>Email</label><div class="val">' + esc(me.email) + '</div></div>' +
      '<div class="field-row"><label>Phone number</label><input type="text" id="profPhone" value="' + esc(me.phone || '') + '" style="border:1px solid var(--line); border-radius:8px; padding:8px 10px;"></div>' +
      '<div class="field-row"><label>Role</label><div class="val">' + (isSuper ? 'Super Admin' : 'Admin') + '</div></div>' +
      '<div class="field-row"><label>Status</label><div class="val"><span class="pill pill-active">Active</span></div></div>' +
      '<div style="margin-top:16px;"><button type="submit" class="btn-primary">Save changes</button></div></form></div></div></div>';
    document.getElementById('view-profile').innerHTML = html;
    document.getElementById('profileForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('profName').value.trim();
      var phone = document.getElementById('profPhone').value.trim();
      api('/api/profile', { method: 'PUT', body: { name: name, phone: phone } }).then(function () {
        me.name = name; me.phone = phone;
        document.querySelector('.tb-name').innerHTML = esc(name) + '<small>' + (isSuper ? 'Super Admin' : 'Admin') + '</small>';
        showToast('Profile updated.');
      });
    });
    document.getElementById('avatarUploadInput').addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
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

  P.initViewSwitching(titles, function (name) {
    if (name === 'dashboard') renderDashboard();
    if (name === 'users') renderUsers();
    if (name === 'courses') renderCourses();
    if (name === 'enrollment') renderEnrollment();
    if (name === 'faculty') renderFaculty();
    if (name === 'announcements') renderAnnouncements();
    if (name === 'activity') renderActivity();
    if (name === 'settings') renderSettings();
    if (name === 'profile') renderProfile();
  });
})();
