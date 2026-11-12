/* ==========================================================================
   种子数据：演示批次（学生 60 / 实训室 8 / 面试 97 / 预置名单）
   与前端 js/data.js 共用同一份生成器，保证每次重置结果一致。
   ========================================================================== */
const crypto = require('crypto');
const seedData = require('../js/data.js');

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex');
}

function seed(d, now) {
  now = now || Date.now();
  const data = seedData.build(now, 2);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword('123456', salt);

  const insUser = d.prepare(`INSERT INTO users
    (id, role, name, cls, phone, email, title, salt, password_hash, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);

  data.students.forEach((s) => {
    insUser.run(s.no, 'student', s.name, s.cls || null, s.phone || null, s.email || null, null, salt, hash, now);
  });
  const teachers = new Map();
  data.labs.forEach((l) => { teachers.set(l.teacher.id, l.teacher); });
  teachers.forEach((t) => {
    insUser.run(t.id, 'teacher', t.name, null, null, t.id.toLowerCase() + '@demo.edu.cn', t.title || null, salt, hash, now);
  });
  insUser.run('admin', 'admin', '学院管理员', null, null, 'admin@demo.edu.cn', '教务办公室', salt, hash, now);

  d.prepare('INSERT INTO cycle (id, name, year) VALUES (1, ?, ?)').run(data.cycle.name, data.cycle.year);
  const insStage = d.prepare('INSERT INTO stages (idx, key, label, short, start_at, end_at) VALUES (?,?,?,?,?,?)');
  data.cycle.stages.forEach((s, i) => insStage.run(i, s.key, s.label, s.short, s.start, s.end));

  const insLab = d.prepare(`INSERT INTO labs
    (id, name, direction, quota, room, teacher_id, teacher_name, teacher_title, intro, tags, requirements)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  data.labs.forEach((l) => {
    insLab.run(l.id, l.name, l.direction, l.quota, l.room, l.teacher.id, l.teacher.name, l.teacher.title,
      l.intro, JSON.stringify(l.tags || []), JSON.stringify(l.requirements || []));
  });

  const insApp = d.prepare(`INSERT INTO applications
    (student_id, round, internal, cross, intro, submitted_at, version) VALUES (?,?,?,?,?,?,?)`);
  const insAppLab = d.prepare('INSERT INTO application_labs (student_id, lab_id, position) VALUES (?,?,?)');
  Object.keys(data.applications).forEach((no) => {
    const a = data.applications[no];
    insApp.run(no, 1, a.internal ? 1 : 0, a.cross ? 1 : 0, a.intro || '', a.submittedAt || now, 1);
    a.labs.forEach((labId, i) => insAppLab.run(no, labId, i));
  });

  const insIv = d.prepare(`INSERT INTO interviews
    (id, lab_id, student_id, at, room, status, total, attitude, logic, coding, comm, scored_by, comment, locked)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  data.interviews.forEach((iv) => {
    const sc = iv.scores || {};
    insIv.run(iv.id, iv.labId, iv.no, iv.at, iv.room, iv.status,
      iv.status === 'done' ? iv.total : null,
      sc.attitude == null ? null : sc.attitude, sc.logic == null ? null : sc.logic,
      sc.coding == null ? null : sc.coding, sc.comm == null ? null : sc.comm,
      iv.scorer || null, iv.comment || '', iv.locked ? 1 : 0);
  });

  const insNom = d.prepare(`INSERT INTO nominations
    (lab_id, student_id, type, rank, round, status, created_at) VALUES (?,?,?,?,?,?,?)`);
  // 同一实训室内，一名学生只保留一条有效名单（拟录取 > 递补 > 内部调剂候选）
  const priority = { accept: 3, wait: 2, internal: 1 };
  const picked = new Map();
  data.nominations.forEach((n) => {
    const key = n.labId + '|' + n.no;
    const prev = picked.get(key);
    if (!prev || priority[n.type] > priority[prev.type]) picked.set(key, n);
  });
  picked.forEach((n) => insNom.run(n.labId, n.no, n.type, n.rank, n.round || 1, n.status || null, now));

  const insAudit = d.prepare('INSERT INTO audit (at, actor, role, action, detail) VALUES (?,?,?,?,?)');
  (data.audit || []).forEach((a) => insAudit.run(a.at, a.actor, a.role, a.action, a.detail));

  d.prepare('INSERT INTO publicity (id, published_at, until) VALUES (1, NULL, NULL)').run();
  d.prepare("INSERT INTO meta (key, value) VALUES ('seeded', ?)").run(String(now));
  d.prepare("INSERT INTO meta (key, value) VALUES ('demo', '1')").run();

  return {
    students: data.students.length,
    labs: data.labs.length,
    interviews: data.interviews.length,
    nominations: data.nominations.length
  };
}

module.exports = { seed, hashPassword };
