'use strict';
const db = require('./db');

function initials(name) {
  const parts = String(name || '').replace(/^Dr\.\s*/, '').split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone,
    title: u.title, avatarUrl: u.avatar_url, status: u.status, initials: initials(u.name),
    createdAt: u.created_at,
  };
}

function courseTeachers(courseId) {
  return db.prepare(`SELECT u.* FROM course_teachers ct JOIN users u ON u.id = ct.teacher_id WHERE ct.course_id = ?`).all(courseId).map(publicUser);
}

function teacherCourses(teacherId) {
  return db.prepare(`SELECT c.* FROM course_teachers ct JOIN courses c ON c.id = ct.course_id WHERE ct.teacher_id = ?`).all(teacherId);
}

function courseModules(courseId) {
  return db.prepare('SELECT * FROM modules WHERE course_id = ? ORDER BY order_idx').all(courseId);
}

function moduleAssessments(moduleId) {
  return db.prepare('SELECT * FROM assessments WHERE module_id = ?').all(moduleId);
}

function enrolledStudentIds(courseId) {
  return db.prepare(`SELECT student_id FROM enrollments WHERE course_id = ? AND status = 'Active'`).all(courseId).map((r) => r.student_id);
}

function studentModuleProgress(studentId, moduleId) {
  return db.prepare('SELECT * FROM module_progress WHERE student_id = ? AND module_id = ?').get(studentId, moduleId);
}

// Compute effective lock/progress state for a module for a given student.
function moduleStateForStudent(studentId, mod, prevPct) {
  const prog = studentModuleProgress(studentId, mod.id);
  const pct = prog ? prog.pct : 0;
  const timeSpent = prog ? prog.time_spent_min : 0;
  let status;
  if (pct >= 100) status = 'done';
  else if (pct > 0) status = 'in_progress';
  else if (prevPct === null || prevPct >= mod.unlock_threshold) status = 'available';
  else status = 'locked';
  return { pct, timeSpent, status };
}

function courseAvgProgress(courseId, studentId) {
  const mods = courseModules(courseId);
  if (mods.length === 0) return 0;
  let total = 0;
  mods.forEach((m) => {
    const prog = studentModuleProgress(studentId, m.id);
    total += prog ? prog.pct : 0;
  });
  return Math.round(total / mods.length);
}

function courseAvgProgressAll(courseId) {
  const students = enrolledStudentIds(courseId);
  if (students.length === 0) return 0;
  let total = 0;
  students.forEach((sid) => { total += courseAvgProgress(courseId, sid); });
  return Math.round(total / students.length);
}

function assessmentQuestions(assessmentId) {
  const questions = db.prepare('SELECT * FROM questions WHERE assessment_id = ? ORDER BY order_idx').all(assessmentId);
  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    options: db.prepare('SELECT * FROM options WHERE question_id = ? ORDER BY order_idx').all(q.id),
  }));
}

module.exports = {
  initials,
  publicUser,
  courseTeachers,
  teacherCourses,
  courseModules,
  moduleAssessments,
  enrolledStudentIds,
  studentModuleProgress,
  moduleStateForStudent,
  courseAvgProgress,
  courseAvgProgressAll,
  assessmentQuestions,
};
