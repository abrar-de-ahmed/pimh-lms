'use strict';

function canManageSystemSettings(role) {
  return role === 'SUPER_ADMIN';
}
function canManageStaffAccounts(role) {
  // create/edit/deactivate ADMIN and FACULTY accounts
  return role === 'SUPER_ADMIN';
}
function canManageStudentAccounts(role) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}
function canManageCourses(role) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}
function isStaff(role) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}
function isFacultyOf(db, teacherId, courseId) {
  const row = db.prepare('SELECT 1 FROM course_teachers WHERE teacher_id = ? AND course_id = ?').get(teacherId, courseId);
  return !!row;
}

module.exports = {
  canManageSystemSettings,
  canManageStaffAccounts,
  canManageStudentAccounts,
  canManageCourses,
  isStaff,
  isFacultyOf,
};
