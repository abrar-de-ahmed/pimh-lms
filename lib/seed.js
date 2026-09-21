'use strict';
const db = require('./db');
const { hashPassword } = require('./auth');

function seed() {
  const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (count > 0) {
    console.log('Seed skipped — database already has data.');
    return;
  }

  const insUser = db.prepare(`INSERT INTO users (name,email,password_hash,role,phone,title,status)
    VALUES (?,?,?,?,?,?,'ACTIVE')`);

  const pw = hashPassword('Password123!');

  const superAdmin = insUser.run('Nadia Farooq', 'nadia.farooq@pimh.edu.pk', pw, 'SUPER_ADMIN', '+92 300 9998887', 'Super Admin — Platform Administration').lastInsertRowid;
  const admin = insUser.run('Imran Qureshi', 'imran.qureshi@pimh.edu.pk', pw, 'ADMIN', '+92 300 1119990', 'Admin — Program Operations').lastInsertRowid;
  const t1 = insUser.run('Dr. Usama Bin Zubair', 'usama.zubair@pimh.edu.pk', pw, 'FACULTY', '+92 300 1112223', 'Faculty — Counseling & Psychology').lastInsertRowid;
  const t2 = insUser.run('Dr. Sana Ibrahim', 'sana.ibrahim@pimh.edu.pk', pw, 'FACULTY', '+92 300 4445556', 'Faculty — Educational Psychology').lastInsertRowid;

  const studentDefs = [
    ['Ayesha Zaman', 'ayesha.zaman@student.pimh.edu.pk', '+92 300 1234567'],
    ['Hamza Khokhar', 'hamza.khokhar@student.pimh.edu.pk', '+92 300 2223344'],
    ['Sana Raza', 'sana.raza@student.pimh.edu.pk', '+92 300 3334455'],
    ['Bilal Ahmed', 'bilal.ahmed@student.pimh.edu.pk', '+92 300 4445566'],
    ['Mahnoor Iqbal', 'mahnoor.iqbal@student.pimh.edu.pk', '+92 300 5556677'],
    ['Fatima Sheikh', 'fatima.sheikh@student.pimh.edu.pk', '+92 300 6667788'],
  ];
  const studentIds = studentDefs.map(([name, email, phone]) =>
    insUser.run(name, email, pw, 'STUDENT', phone, null).lastInsertRowid
  );
  const [s1, s2, s3, s4, s5, s6] = studentIds;

  const insCourse = db.prepare(`INSERT INTO courses (slug,name,description,status) VALUES (?,?,?,'Active')`);
  const foundations = insCourse.run('foundations', 'Foundations of Counseling Theory', 'Core theories and history of counseling practice.').lastInsertRowid;
  const edpsych = insCourse.run('edpsych', 'Educational Psychology & Development', 'Cognitive and developmental psychology as applied to learners.').lastInsertRowid;
  const wellbeing = insCourse.run('wellbeing', 'Student Mental Health & Wellbeing', 'Stress, self-care, and supporting others in academic settings.').lastInsertRowid;

  const insTeach = db.prepare('INSERT INTO course_teachers (course_id,teacher_id) VALUES (?,?)');
  insTeach.run(foundations, t1);
  insTeach.run(edpsych, t1);
  insTeach.run(wellbeing, t1);

  const insMod = db.prepare('INSERT INTO modules (course_id,title,order_idx,unlock_threshold) VALUES (?,?,?,70)');
  const foundMods = [
    'Week One — Introduction to Counseling',
    'Week Two — Theoretical Approaches',
    'Week Three — Case Formulation',
    'Week Four — Ethics & Practice',
    'Week Five — Quiz',
  ].map((t, i) => insMod.run(foundations, t, i).lastInsertRowid);

  const edMods = [
    'Week One — Cognitive Development',
    'Week Two — Developmental Stages',
    'Week Three — Learning Difficulties',
  ].map((t, i) => insMod.run(edpsych, t, i).lastInsertRowid);

  const wellMods = [
    'Week One — Understanding Stress & Burnout',
    'Week Two — Self-Care Strategies',
    'Week Three — Supporting Others',
  ].map((t, i) => insMod.run(wellbeing, t, i).lastInsertRowid);

  const insEnroll = db.prepare('INSERT INTO enrollments (student_id,course_id,status) VALUES (?,?,\'Active\')');
  studentIds.forEach((sid) => {
    insEnroll.run(sid, foundations);
    insEnroll.run(sid, edpsych);
    insEnroll.run(sid, wellbeing);
  });

  const insProg = db.prepare(`INSERT INTO module_progress (student_id,module_id,pct,time_spent_min,status) VALUES (?,?,?,?,?)`);
  // Ayesha's progress across foundations
  insProg.run(s1, foundMods[0], 100, 170, 'done');
  insProg.run(s1, foundMods[1], 100, 185, 'done');
  insProg.run(s1, foundMods[2], 55, 100, 'in_progress');
  insProg.run(s1, foundMods[3], 0, 0, 'locked');
  insProg.run(s1, foundMods[4], 0, 0, 'locked');
  insProg.run(s1, edMods[0], 100, 135, 'done');
  insProg.run(s1, edMods[1], 40, 55, 'in_progress');
  insProg.run(s1, edMods[2], 0, 0, 'locked');
  insProg.run(s1, wellMods[0], 100, 130, 'done');
  insProg.run(s1, wellMods[1], 45, 80, 'in_progress');
  insProg.run(s1, wellMods[2], 0, 0, 'locked');
  // Others: light default progress on week one only
  [s2, s3, s4, s5, s6].forEach((sid) => {
    [...foundMods, ...edMods, ...wellMods].forEach((mid, idx) => {
      insProg.run(sid, mid, idx === 0 ? 100 : 0, idx === 0 ? 90 : 0, idx === 0 ? 'done' : 'locked');
    });
  });

  // Assessments
  const insAssess = db.prepare(`INSERT INTO assessments (module_id,title,type,due_date,time_limit_min,attempts_allowed) VALUES (?,?,?,?,?,?)`);
  const a1 = insAssess.run(foundMods[2], 'Assignment 03 — Case Formulation', 'assignment', '2026-09-20', null, null).lastInsertRowid;
  const q1 = insAssess.run(foundMods[1], 'Quiz 03 — Core Concepts', 'quiz', '2026-09-14', 20, 3).lastInsertRowid;
  const a2 = insAssess.run(edMods[0], 'Assignment 02 — Cognitive Development', 'assignment', '2026-09-16', null, null).lastInsertRowid;
  const q2 = insAssess.run(edMods[1], 'Quiz 05 — Developmental Stages', 'quiz', '2026-09-18', 15, 3).lastInsertRowid;
  const a3 = insAssess.run(wellMods[1], 'Assignment 02 — Reflective Journal', 'assignment', '2026-09-12', null, null).lastInsertRowid;
  const q3 = insAssess.run(foundMods[4], 'Week Five — Ethics & Practice Quiz', 'quiz', null, 20, 3).lastInsertRowid;
  const a4 = insAssess.run(foundMods[0], 'Assignment 01 — Reflective Essay', 'assignment', '2026-08-30', null, null).lastInsertRowid;

  const insQ = db.prepare('INSERT INTO questions (assessment_id, text, order_idx) VALUES (?,?,?)');
  const insOpt = db.prepare('INSERT INTO options (question_id, text, is_correct, order_idx) VALUES (?,?,?,?)');
  function addQuiz(assessId, questions) {
    questions.forEach((qq, qi) => {
      const qid = insQ.run(assessId, qq.text, qi).lastInsertRowid;
      qq.options.forEach((opt, oi) => insOpt.run(qid, opt, oi === qq.correct ? 1 : 0, oi));
    });
  }
  addQuiz(q2, [
    { text: 'Who proposed the theory of psychosocial development spanning the whole lifespan?', options: ['Jean Piaget', 'Erik Erikson', 'Lev Vygotsky', 'B.F. Skinner'], correct: 1 },
    { text: 'Which stage in Erikson\'s theory is most associated with adolescence?', options: ['Trust vs. Mistrust', 'Industry vs. Inferiority', 'Identity vs. Role Confusion', 'Generativity vs. Stagnation'], correct: 2 },
    { text: 'Vygotsky\'s "Zone of Proximal Development" describes:', options: ['Tasks a child can do alone', 'Tasks beyond a child\'s reach even with help', 'Tasks a child can do with guidance but not alone', 'A fixed stage of biological maturation'], correct: 2 },
  ]);
  addQuiz(q1, [
    { text: 'Which approach emphasizes unconditional positive regard?', options: ['Psychodynamic', 'Person-centered', 'Behavioral', 'Cognitive'], correct: 1 },
    { text: 'A genogram is primarily used in which counseling context?', options: ['Family systems', 'Group therapy', 'Crisis intervention', 'Career counseling'], correct: 0 },
  ]);
  addQuiz(q3, [
    { text: 'Confidentiality in school counseling can be broken when:', options: ['A student requests it', 'There is risk of harm to self or others', 'A parent asks', 'Never'], correct: 1 },
    { text: 'Informed consent primarily protects:', options: ['The institution only', 'The counselor\'s schedule', 'The client\'s autonomy and understanding', 'None of the above'], correct: 2 },
  ]);

  // Submissions
  const insSub = db.prepare(`INSERT INTO submissions (assessment_id,student_id,score,status,content_text,submitted_at) VALUES (?,?,?,?,?,datetime('now', ?))`);
  insSub.run(a1, s1, null, 'ungraded', 'Attached case formulation writeup.', '-1 day');
  insSub.run(a1, s2, null, 'ungraded', 'Case formulation submitted.', '-2 day');
  insSub.run(q1, s4, null, 'ungraded', 'Quiz attempt pending review.', '-3 day');
  insSub.run(a2, s1, null, 'ungraded', 'Cognitive development essay.', '-2 day');
  insSub.run(a3, s6, null, 'ungraded', 'Reflective journal entry.', '-3 day');
  insSub.run(a4, s3, 92, 'graded', 'Reflective essay.', '-14 day');
  insSub.run(a4, s5, 96, 'graded', 'Reflective essay.', '-14 day');

  // Materials
  const insMat = db.prepare('INSERT INTO materials (module_id,title,type,url) VALUES (?,?,?,?)');
  insMat.run(foundMods[0], 'Lecture slides — Introduction to Counseling.pdf', 'file', '#');
  insMat.run(foundMods[0], 'Course syllabus & reading list', 'link', 'https://example.com/syllabus');
  insMat.run(foundMods[1], 'Theoretical Approaches — slide deck.pptx', 'file', '#');
  insMat.run(foundMods[2], 'Case formulation template.pdf', 'file', '#');
  insMat.run(edMods[0], 'Piaget stages — summary handout.pdf', 'file', '#');
  insMat.run(wellMods[0], 'Burnout self-assessment.pdf', 'file', '#');

  // Schedule
  const insSched = db.prepare('INSERT INTO schedule_events (course_id,title,event_date,event_time,meeting_url) VALUES (?,?,?,?,?)');
  insSched.run(foundations, 'Live session — Case Formulation Q&A', '2026-09-19', '18:00', 'https://meet.example.com/foundations');
  insSched.run(edpsych, 'Live session — Developmental Stages Review', '2026-09-21', '17:00', 'https://meet.example.com/edpsych');
  insSched.run(wellbeing, 'Live session — Peer Support Workshop', '2026-09-23', '19:00', 'https://meet.example.com/wellbeing');

  // Discussion
  const insPost = db.prepare('INSERT INTO discussion_posts (module_id,author_id,text) VALUES (?,?,?)');
  insPost.run(foundMods[1], s2, 'Can someone explain the difference between person-centered and psychodynamic approaches in the context of this module?');
  insPost.run(foundMods[1], s3, "I think it comes down to how much weight you give the client's own insight vs. unconscious drivers — the reading in 2.3 covers this well.");
  insPost.run(foundMods[1], t1, "Good summary, Sana. I'll add a short clarifying video to this module for anyone still unsure.");

  // Announcements
  const insAnn = db.prepare('INSERT INTO announcements (scope,course_id,author_id,title,message) VALUES (?,?,?,?,?)');
  insAnn.run('course', foundations, t1, 'Assignment 04 deadline extended', 'The deadline for Assignment 04 has been moved to Friday to allow more time after the long weekend.');
  insAnn.run('academy', null, superAdmin, 'Fall 2026 Orientation Week', 'Orientation sessions run the first week of term for all cohorts — check your Schedule page for your class times.');

  // Activity log
  const insLog = db.prepare('INSERT INTO activity_log (actor_id, text) VALUES (?,?)');
  insLog.run(superAdmin, 'Created course: Foundations of Counseling Theory');
  insLog.run(superAdmin, 'Enrolled all 6 students in Foundations of Counseling Theory');
  insLog.run(superAdmin, 'Assigned Dr. Usama Bin Zubair to Educational Psychology & Development');
  insLog.run(superAdmin, 'Added teacher account: Dr. Sana Ibrahim');
  insLog.run(superAdmin, 'Created course: Student Mental Health & Wellbeing');

  // Settings
  const insSet = db.prepare('INSERT INTO settings (key, value) VALUES (?,?)');
  insSet.run('termName', 'Fall 2026 Cohort');
  insSet.run('termStart', '2026-09-01');
  insSet.run('termEnd', '2026-12-19');
  insSet.run('passMark', '70');
  insSet.run('quizTime', '30');
  insSet.run('quizAttempts', '3');

  // Notifications for Ayesha
  const insNotif = db.prepare('INSERT INTO notifications (user_id, text, is_read) VALUES (?,?,?)');
  insNotif.run(s1, 'Assignment 02 was graded — 82%', 0);
  insNotif.run(s1, 'New announcement in Educational Psychology', 0);
  insNotif.run(s1, 'Teacher replied to your discussion post', 1);

  console.log('Seed complete.');
  console.log('Login accounts (password: Password123!):');
  console.log('  Super Admin: nadia.farooq@pimh.edu.pk');
  console.log('  Admin:       imran.qureshi@pimh.edu.pk');
  console.log('  Faculty:     usama.zubair@pimh.edu.pk');
  console.log('  Faculty:     sana.ibrahim@pimh.edu.pk (no courses assigned yet)');
  console.log('  Student:     ayesha.zaman@student.pimh.edu.pk');
}

module.exports = seed;

if (require.main === module) {
  seed();
}
