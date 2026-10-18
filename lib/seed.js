'use strict';
const db = require('./db');
const { hashPassword } = require('./auth');

function ensureMasterSuperAdmins() {
  const pw = hashPassword('Password123!');
  const masters = [
    ['Abrar', 'abrar_a@live.com', 'Super Admin — Master Account'],
    ['Crafted Minds Admin', 'craft@craftedmindss.com', 'Super Admin — Crafted Minds'],
  ];
  for (const [name, email, title] of masters) {
    const existing = db.prepare('SELECT id, password_hash FROM users WHERE lower(email) = lower(?)').get(email);
    if (existing) {
      db.prepare(`UPDATE users SET role='SUPER_ADMIN', status='ACTIVE', email_verified=1, verification_token=NULL, password_hash=COALESCE(password_hash, ?) WHERE id=?`).run(pw, existing.id);
    } else {
      db.prepare(`INSERT INTO users (name,email,password_hash,role,title,status,email_verified) VALUES (?,?,?,'SUPER_ADMIN',?,'ACTIVE',1)`).run(name, email, pw, title);
    }
  }
}

function ensureDefaultSettings() {
  const insSet = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)');
  insSet.run('termName', 'Fall 2026 Cohort');
  insSet.run('termStart', '2026-09-01');
  insSet.run('termEnd', '2026-12-19');
  insSet.run('passMark', '70');
  insSet.run('quizTime', '30');
  insSet.run('quizAttempts', '3');
}

function seed() {
  ensureMasterSuperAdmins();
  ensureDefaultSettings();

  const courseCount = db.prepare('SELECT COUNT(*) c FROM courses').get().c;
  if (courseCount > 0) {
    console.log('Seed skipped — courses already initialized.');
    return;
  }

  const insCourse = db.prepare(`INSERT INTO courses (slug,name,description,status) VALUES (?,?,?,'Active')`);
  const foundations = insCourse.run('foundations', 'Foundations of Counseling Theory', 'Core theories and history of counseling practice.').lastInsertRowid;
  const edpsych = insCourse.run('edpsych', 'Educational Psychology & Development', 'Cognitive and developmental psychology as applied to learners.').lastInsertRowid;
  const wellbeing = insCourse.run('wellbeing', 'Student Mental Health & Wellbeing', 'Stress, self-care, and supporting others in academic settings.').lastInsertRowid;

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

  // Assessments
  const insAssess = db.prepare(`INSERT INTO assessments (module_id,title,type,due_date,time_limit_min,attempts_allowed) VALUES (?,?,?,?,?,?)`);
  insAssess.run(foundMods[2], 'Assignment 03 — Case Formulation', 'assignment', '2026-09-20', null, null);
  const q1 = insAssess.run(foundMods[1], 'Quiz 03 — Core Concepts', 'quiz', '2026-09-14', 20, 3).lastInsertRowid;
  insAssess.run(edMods[0], 'Assignment 02 — Cognitive Development', 'assignment', '2026-09-16', null, null);
  const q2 = insAssess.run(edMods[1], 'Quiz 05 — Developmental Stages', 'quiz', '2026-09-18', 15, 3).lastInsertRowid;
  insAssess.run(wellMods[1], 'Assignment 02 — Reflective Journal', 'assignment', '2026-09-12', null, null);
  const q3 = insAssess.run(foundMods[4], 'Week Five — Ethics & Practice Quiz', 'quiz', null, 20, 3).lastInsertRowid;
  insAssess.run(foundMods[0], 'Assignment 01 — Reflective Essay', 'assignment', '2026-08-30', null, null);

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

  console.log('Seed complete — Master Super Admins and 3 courses initialized.');
}

module.exports = seed;

if (require.main === module) {
  seed();
}
