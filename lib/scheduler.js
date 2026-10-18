'use strict';

const db = require('./db');
const mailer = require('./mailer');

/**
 * Checks assessments due within the next 48 hours and dispatches email + in-app
 * notifications to enrolled students who haven't submitted yet and haven't already
 * been reminded for that assessment.
 */
async function runDeadlineReminders() {
  const upcoming = db.prepare(`
    SELECT * FROM assessments
    WHERE due_date IS NOT NULL
      AND date(due_date) >= date('now')
      AND date(due_date) <= date('now', '+2 days')
  `).all();

  let remindersSent = 0;
  const errors = [];

  for (const a of upcoming) {
    const course = db.prepare(`
      SELECT c.id, c.name
      FROM modules m
      JOIN courses c ON c.id = m.course_id
      WHERE m.id = ?
    `).get(a.module_id);
    if (!course) continue;

    const enrolled = db.prepare(`
      SELECT u.id, u.email, u.name as student_name
      FROM enrollments e
      JOIN users u ON u.id = e.student_id
      WHERE e.course_id = ? AND e.status = 'Active'
    `).all(course.id);

    for (const student of enrolled) {
      const sub = db.prepare(`SELECT id FROM submissions WHERE assessment_id = ? AND student_id = ?`).get(a.id, student.id);
      if (sub) continue;

      const alreadySent = db.prepare(`SELECT id FROM sent_reminders WHERE student_id = ? AND assessment_id = ?`).get(student.id, a.id);
      if (alreadySent) continue;

      // Record in-app notification + deduplication entry
      db.prepare(`INSERT INTO notifications (user_id, text) VALUES (?, ?)`).run(
        student.id,
        `Reminder: ${a.title} (${course.name}) is due on ${a.due_date}.`
      );
      db.prepare(`INSERT OR IGNORE INTO sent_reminders (student_id, assessment_id) VALUES (?, ?)`).run(student.id, a.id);
      remindersSent++;

      try {
        await mailer.sendEmail({
          to: student.email,
          subject: `Action Required: Upcoming Deadline for ${course.name}`,
          html: `<p>Hello ${student.student_name},</p>
                 <p>This is a reminder that you have an upcoming ${a.type} (<b>${a.title}</b>) in <b>${course.name}</b> due on <b>${a.due_date}</b>.</p>
                 <p>Please log in to your PIMH Academy dashboard to complete it on time.</p>`
        });
      } catch (err) {
        errors.push({ email: student.email, error: err.message });
      }
    }
  }

  return {
    checkedAssessments: upcoming.length,
    remindersSent,
    errors,
  };
}

module.exports = {
  runDeadlineReminders,
};
