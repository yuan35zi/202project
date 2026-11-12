/* ==========================================================================
   REST API 与快照构建
   ========================================================================== */
const crypto = require('crypto');
const { open, tx, resetDemo, hashPassword, info } = require('./db');
const rules = require('./rules');

const SESSION_MS = 12 * 3600e3;

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}

const arr = (v) => (Array.isArray(v) ? v : []);
const int = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : def;
};

/* ---------------- 快照 ---------------- */
function buildSnapshot(d, user) {
  const t = Date.now();
  const idx = rules.stageIndex(d, t);
  const stageRows = rules.stages(d);
  const cycleRow = d.prepare('SELECT * FROM cycle WHERE id = 1').get();

  const labs = d.prepare('SELECT * FROM labs ORDER BY id').all().map((l) => ({
    id: l.id,
    name: l.name,
    direction: l.direction,
    quota: l.quota,
    room: l.room,
    teacher: { id: l.teacher_id, name: l.teacher_name, title: l.teacher_title },
    intro: l.intro,
    tags: JSON.parse(l.tags || '[]'),
    requirements: JSON.parse(l.requirements || '[]'),
    stats: rules.labStats(d, l.id, user.role)
  }));

  const myLabs = d.prepare('SELECT id FROM labs WHERE teacher_id = ?').all(user.id).map((r) => r.id);
  const ph = (list) => list.map(() => '?').join(',');

  let students;
  let applications;
  let interviews;
  let nominations;
  let confirmations;
  let allocations;
  let objections;

  if (user.role === 'student') {
    students = d.prepare('SELECT id AS no, name, cls, phone, email FROM users WHERE id = ?').all(user.id);
    applications = d.prepare('SELECT * FROM applications WHERE student_id = ?').all(user.id);
    interviews = d.prepare('SELECT * FROM interviews WHERE student_id = ? ORDER BY at').all(user.id);
    nominations = d.prepare('SELECT * FROM nominations WHERE student_id = ?').all(user.id);
    confirmations = d.prepare('SELECT * FROM confirmations WHERE student_id = ?').all(user.id);
    allocations = d.prepare('SELECT * FROM allocations WHERE student_id = ?').all(user.id);
    objections = d.prepare('SELECT * FROM objections WHERE student_id = ? ORDER BY at DESC').all(user.id);
  } else if (user.role === 'teacher') {
    if (!myLabs.length) {
      students = [];
      applications = [];
      interviews = [];
      nominations = [];
      confirmations = [];
      allocations = [];
    } else {
      const inLabs = '(' + ph(myLabs) + ')';
      students = d.prepare("SELECT u.id AS no, u.name, u.cls, u.phone, u.email FROM users u WHERE u.role = 'student' AND u.id IN (SELECT DISTINCT student_id FROM application_labs WHERE lab_id IN " + inLabs + ')').all(...myLabs);
      applications = d.prepare('SELECT a.* FROM applications a WHERE a.student_id IN (SELECT DISTINCT student_id FROM application_labs WHERE lab_id IN ' + inLabs + ')').all(...myLabs);
      interviews = d.prepare('SELECT * FROM interviews WHERE lab_id IN ' + inLabs + ' ORDER BY at').all(...myLabs);
      nominations = d.prepare('SELECT * FROM nominations WHERE lab_id IN ' + inLabs + ' ORDER BY type, rank').all(...myLabs);
      confirmations = d.prepare('SELECT * FROM confirmations WHERE lab_id IN ' + inLabs).all(...myLabs);
      allocations = d.prepare('SELECT * FROM allocations WHERE lab_id IN ' + inLabs).all(...myLabs);
    }
    objections = [];
  } else {
    students = d.prepare("SELECT id AS no, name, cls, phone, email FROM users WHERE role = 'student'").all();
    applications = d.prepare('SELECT * FROM applications').all();
    interviews = d.prepare('SELECT * FROM interviews ORDER BY at').all();
    nominations = d.prepare('SELECT * FROM nominations ORDER BY type, rank').all();
    confirmations = d.prepare('SELECT * FROM confirmations').all();
    allocations = d.prepare('SELECT * FROM allocations ORDER BY at').all();
    objections = d.prepare('SELECT * FROM objections ORDER BY at DESC').all();
  }

  const appMap = {};
  const appIds = applications.map((a) => a.student_id);
  const labRows = appIds.length
    ? d.prepare('SELECT student_id, lab_id, position FROM application_labs WHERE student_id IN (' + ph(appIds) + ') ORDER BY position').all(...appIds)
    : [];
  applications.forEach((a) => {
    appMap[a.student_id] = {
      labs: labRows.filter((r) => r.student_id === a.student_id).map((r) => r.lab_id),
      internal: !!a.internal,
      cross: !!a.cross,
      intro: a.intro || '',
      submittedAt: a.submitted_at,
      version: a.version
    };
  });

  const ivList = interviews.map((iv) => ({
    id: iv.id,
    labId: iv.lab_id,
    no: iv.student_id,
    at: iv.at,
    room: iv.room,
    status: iv.status,
    total: iv.total,
    scores: iv.attitude == null ? null : { attitude: iv.attitude, logic: iv.logic, coding: iv.coding, comm: iv.comm },
    comment: iv.comment || '',
    scorer: iv.scored_by || '',
    locked: !!iv.locked
  }));

  const nomList = nominations.map((n) => ({
    id: n.id, labId: n.lab_id, no: n.student_id, type: n.type, rank: n.rank, round: n.round,
    status: n.status, deadline: n.deadline || null
  }));

  const confMap = {};
  confirmations.forEach((c) => { confMap[c.student_id] = { labId: c.lab_id, source: c.source, at: c.at }; });

  const allocList = allocations.map((a) => ({ no: a.student_id, labId: a.lab_id, priority: a.priority, reason: a.reason, at: a.at }));

  const publicityRow = d.prepare('SELECT * FROM publicity WHERE id = 1').get();
  const publicity = { publishedAt: publicityRow ? publicityRow.published_at : null, until: publicityRow ? publicityRow.until : null };

  const objectionsList = objections.map((o) => ({ no: o.student_id, name: o.name, text: o.text, at: o.at, status: o.status }));

  let publicRows = [];
  if (publicity.publishedAt) {
    publicRows = d.prepare(`SELECT c.student_id AS no, u.name AS name, c.lab_id AS labId, l.name AS labName,
        l.direction AS direction, c.source AS source, c.at AS at
      FROM confirmations c
      JOIN users u ON u.id = c.student_id
      JOIN labs l ON l.id = c.lab_id
      ORDER BY l.name ASC, u.name ASC`).all()
      .map((r) => ({ ...r, masked: '******' + String(r.no).slice(-4) }));
  }

  const allStats = labs.map((l) => l.stats);
  const quota = allStats.reduce((s, x) => s + x.quota, 0);
  const taken = allStats.reduce((s, x) => s + x.taken, 0);
  const global = {
    labs: labs.length,
    quota,
    taken,
    remaining: Math.max(0, quota - taken),
    fullLabs: allStats.filter((x) => x.remaining === 0).length,
    published: !!publicity.publishedAt
  };
  if (user.role === 'admin') {
    global.students = d.prepare("SELECT COUNT(*) c FROM users WHERE role = 'student'").get().c;
    global.applied = d.prepare('SELECT COUNT(*) c FROM applications').get().c;
    global.notApplied = global.students - global.applied;
    global.interviews = d.prepare('SELECT COUNT(*) c FROM interviews').get().c;
    global.ivDone = d.prepare("SELECT COUNT(*) c FROM interviews WHERE status = 'done'").get().c;
    global.ivPending = global.interviews - global.ivDone;
    global.confirmed = d.prepare('SELECT COUNT(*) c FROM confirmations').get().c;
  }

  let audit = [];
  if (user.role === 'admin') {
    audit = d.prepare('SELECT at, actor, role, action, detail FROM audit ORDER BY at DESC LIMIT 200').all();
  }

  const me = d.prepare('SELECT id, role, name, cls, title, phone, email FROM users WHERE id = ?').get(user.id);
  if (me && user.role === 'teacher') me.labs = myLabs;

  return {
    me,
    serverTime: t,
    cycle: {
      name: cycleRow.name,
      year: cycleRow.year,
      stages: stageRows.map((s) => ({ idx: s.idx, key: s.key, label: s.label, short: s.short, start: s.start, end: s.end }))
    },
    stageIndex: idx,
    labs,
    students,
    applications: appMap,
    interviews: ivList,
    nominations: nomList,
    confirmations: confMap,
    allocations: allocList,
    publicity,
    objections: objectionsList,
    publicRows,
    audit,
    global
  };
}

/* ---------------- 登录 ---------------- */
const attempts = new Map();
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60e3;

function login(body, res) {
  const d = open();
  const role = String(body.role || '');
  const id = String(body.id || '').trim();
  const password = String(body.password || '');
  if (!['student', 'teacher', 'admin'].includes(role)) fail(400, '身份不正确');
  if (!id) fail(400, '请输入账号');
  if (password.length < 6) fail(400, '密码至少 6 位');

  const key = role + ':' + id;
  const rec = attempts.get(key);
  const t = Date.now();
  if (rec && rec.until > t) {
    fail(429, '尝试次数过多，请 ' + Math.ceil((rec.until - t) / 60000) + ' 分钟后再试');
  }
  if (rec && rec.until && rec.until <= t) attempts.delete(key);

  const u = d.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(id, role);
  const ok = !!u && hashPassword(password, u.salt) === u.password_hash;
  if (!ok) {
    const cur = attempts.get(key) || { count: 0, until: 0 };
    cur.count += 1;
    if (cur.count >= MAX_FAILS) { cur.until = t + LOCK_MS; cur.count = 0; }
    attempts.set(key, cur);
    if (cur.until > t) fail(429, '尝试次数过多，请 10 分钟后再试');
    fail(u ? 401 : 404, u ? '密码不正确' : '账号不存在，请检查后重试');
  }
  attempts.delete(key);

  const token = crypto.randomBytes(24).toString('hex');
  d.prepare('INSERT INTO sessions (token, user_id, role, created_at, expires_at) VALUES (?,?,?,?,?)')
    .run(token, u.id, u.role, t, t + SESSION_MS);
  d.prepare('DELETE FROM sessions WHERE expires_at < ?').run(t);
  res.setHeader('Set-Cookie', 'sid=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (SESSION_MS / 1000));
  return { ok: true, snapshot: buildSnapshot(d, u) };
}

function logout(ctx) {
  const d = open();
  if (ctx.token) d.prepare('DELETE FROM sessions WHERE token = ?').run(ctx.token);
  ctx.res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return { ok: true };
}

/* ---------------- 业务动作 ---------------- */
function saveApplication(d, user, body) {
  if (user.role !== 'student') fail(403, '仅学生可填报意向');
  rules.requireStage(d, 2, '意向填报');
  const labs = arr(body.labs).map(String);
  if (!labs.length) fail(400, '至少选择 1 个意向');
  if (labs.length > 3) fail(400, '最多选择 3 个平行意向');
  if (new Set(labs).size !== labs.length) fail(400, '意向不能重复');
  const labsPh = labs.map(() => '?').join(',');
  const count = d.prepare('SELECT COUNT(*) c FROM labs WHERE id IN (' + labsPh + ')').get(...labs).c;
  if (count !== labs.length) fail(400, '存在无效的实训室');

  const old = d.prepare('SELECT * FROM applications WHERE student_id = ?').get(user.id);
  const intro = String(body.intro || '').slice(0, 200);
  const t = Date.now();
  if (old) {
    const oldLabs = d.prepare('SELECT lab_id FROM application_labs WHERE student_id = ? ORDER BY position').all(user.id).map((r) => r.lab_id);
    d.prepare('INSERT INTO application_versions (student_id, labs, internal, cross, at) VALUES (?,?,?,?,?)')
      .run(user.id, JSON.stringify(oldLabs), old.internal, old.cross, old.submitted_at);
    d.prepare('DELETE FROM application_labs WHERE student_id = ?').run(user.id);
    d.prepare('UPDATE applications SET internal = ?, cross = ?, intro = ?, submitted_at = ?, version = version + 1 WHERE student_id = ?')
      .run(body.internal ? 1 : 0, body.cross ? 1 : 0, intro, t, user.id);
  } else {
    d.prepare('INSERT INTO applications (student_id, round, internal, cross, intro, submitted_at, version) VALUES (?,?,?,?,?,?,1)')
      .run(user.id, 1, body.internal ? 1 : 0, body.cross ? 1 : 0, intro, t);
  }
  const ins = d.prepare('INSERT INTO application_labs (student_id, lab_id, position) VALUES (?,?,?)');
  labs.forEach((id, i) => ins.run(user.id, id, i));
  rules.audit(d, user.name, 'student', '提交意向',
    '提交 ' + labs.length + ' 个平行意向（内部调剂：' + (body.internal ? '服从' : '不服从') + '；跨室调剂：' + (body.cross ? '服从' : '不服从') + '）');
}

function scoreInterview(d, user, id, body) {
  const iv = d.prepare('SELECT * FROM interviews WHERE id = ?').get(id);
  if (!iv) fail(404, '面试记录不存在');
  const lab = d.prepare('SELECT * FROM labs WHERE id = ?').get(iv.lab_id);
  if (user.role === 'teacher' && lab.teacher_id !== user.id) fail(403, '只能为本实训室学生评分');
  if (iv.locked) fail(409, '评分已提交并锁定，如需修改请联系学院管理员');
  const keys = ['attitude', 'logic', 'coding', 'comm'];
  const scores = {};
  keys.forEach((k) => {
    const v = int(body[k], NaN);
    if (!Number.isFinite(v) || v < 0 || v > 100) fail(400, '各项分数需在 0–100 之间');
    scores[k] = v;
  });
  const total = Math.round(scores.attitude * 0.25 + scores.logic * 0.3 + scores.coding * 0.25 + scores.comm * 0.2);
  d.prepare("UPDATE interviews SET attitude = ?, logic = ?, coding = ?, comm = ?, total = ?, status = 'done', locked = 1, scored_by = ?, comment = ? WHERE id = ?")
    .run(scores.attitude, scores.logic, scores.coding, scores.comm, total, user.name, String(body.comment || '').slice(0, 500), id);
  const stu = d.prepare('SELECT name FROM users WHERE id = ?').get(iv.student_id);
  rules.audit(d, user.name, user.role, '提交评分', '「' + lab.name + '」为 ' + (stu ? stu.name : iv.student_id) + ' 打分 ' + total + ' 分');
  return total;
}

function arrangeInterviews(d, user, body) {
  const labId = body.labId || null;
  let labs;
  if (labId) {
    const lab = d.prepare('SELECT * FROM labs WHERE id = ?').get(labId);
    if (!lab) fail(404, '实训室不存在');
    if (user.role === 'teacher' && lab.teacher_id !== user.id) fail(403, '只能安排本实训室面试');
    labs = [lab];
  } else {
    if (user.role !== 'admin') fail(403, '仅学院管理员可全院排期');
    labs = d.prepare('SELECT * FROM labs').all();
  }
  const stage = rules.stageOf(d, 3);
  const start = stage.start + 3600e3;
  const targetSet = new Set(labs.map((l) => l.id));
  const others = d.prepare('SELECT * FROM interviews').all().filter((iv) => !targetSet.has(iv.lab_id));
  const used = new Set(others.map((iv) => iv.student_id + '|' + iv.at));
  let assigned = 0;
  let cursor = 0;
  labs.forEach((lab) => {
    const list = d.prepare('SELECT * FROM interviews WHERE lab_id = ? ORDER BY student_id').all(lab.id);
    list.forEach((iv) => {
      if (iv.status === 'done') return;
      let slot = start + cursor * 30 * 60e3;
      let guard = 0;
      while (used.has(iv.student_id + '|' + slot) && guard++ < 400) slot += 30 * 60e3;
      d.prepare('UPDATE interviews SET at = ?, room = ? WHERE id = ?').run(slot, lab.room, iv.id);
      used.add(iv.student_id + '|' + slot);
      cursor++;
      assigned++;
    });
  });
  rules.audit(d, user.name, user.role, '面试排期', '为 ' + assigned + ' 场面试分配时段');
  return assigned;
}

function addNomination(d, user, body) {
  const labId = body.labId;
  const studentId = body.studentId;
  const type = String(body.type || '');
  if (!['accept', 'wait', 'internal'].includes(type)) fail(400, '名单类型不正确');
  const lab = d.prepare('SELECT * FROM labs WHERE id = ?').get(labId);
  if (!lab) fail(404, '实训室不存在');
  if (user.role !== 'admin' && lab.teacher_id !== user.id) fail(403, '只能操作本实训室名单');
  const stu = d.prepare("SELECT * FROM users WHERE id = ? AND role = 'student'").get(studentId);
  if (!stu) fail(404, '学生不存在');
  const applied = d.prepare('SELECT 1 x FROM application_labs WHERE student_id = ? AND lab_id = ?').get(studentId, labId);
  if (!applied) fail(400, '该学生没有填报本实训室');
  const dup = d.prepare('SELECT 1 x FROM nominations WHERE lab_id = ? AND student_id = ? AND status IS NULL').get(labId, studentId);
  if (dup) fail(409, '该学生已在本室名单中');
  if (type === 'accept' && rules.remaining(d, labId) <= 0) {
    fail(409, '名额已满（' + rules.takenCount(d, labId) + '/' + lab.quota + '），无法再添加拟录取');
  }
  const max = d.prepare('SELECT MAX(rank) m FROM nominations WHERE lab_id = ? AND type = ? AND status IS NULL').get(labId, type).m || 0;
  d.prepare('INSERT INTO nominations (lab_id, student_id, type, rank, round, status, created_at) VALUES (?,?,?,?,?,NULL,?)')
    .run(labId, studentId, type, max + 1, 1, Date.now());
  rules.audit(d, user.name, user.role, '调整名单', stu.name + ' 加入「' + lab.name + '」' +
    (type === 'accept' ? '拟录取' : type === 'wait' ? '递补' : '内部调剂候选') + '名单');
}

function moveNomination(d, user, id, body) {
  const nom = d.prepare('SELECT * FROM nominations WHERE id = ?').get(Number(id));
  if (!nom) fail(404, '名单记录不存在');
  const lab = d.prepare('SELECT * FROM labs WHERE id = ?').get(nom.lab_id);
  if (user.role !== 'admin' && lab.teacher_id !== user.id) fail(403, '只能操作本实训室名单');
  const dir = Number(body.dir) < 0 ? -1 : 1;
  const list = d.prepare('SELECT * FROM nominations WHERE lab_id = ? AND type = ? AND status IS NULL ORDER BY rank ASC')
    .all(nom.lab_id, nom.type);
  const i = list.findIndex((x) => x.id === nom.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  d.prepare('UPDATE nominations SET rank = ? WHERE id = ?').run(list[j].rank, list[i].id);
  d.prepare('UPDATE nominations SET rank = ? WHERE id = ?').run(list[i].rank, list[j].id);
}

function removeNomination(d, user, id) {
  const nom = d.prepare('SELECT * FROM nominations WHERE id = ?').get(Number(id));
  if (!nom) fail(404, '名单记录不存在');
  const lab = d.prepare('SELECT * FROM labs WHERE id = ?').get(nom.lab_id);
  if (user.role !== 'admin' && lab.teacher_id !== user.id) fail(403, '只能操作本实训室名单');
  d.prepare('DELETE FROM nominations WHERE id = ?').run(nom.id);
  const rest = d.prepare('SELECT id FROM nominations WHERE lab_id = ? AND type = ? AND status IS NULL ORDER BY rank ASC')
    .all(nom.lab_id, nom.type);
  rest.forEach((r, i) => d.prepare('UPDATE nominations SET rank = ? WHERE id = ?').run(i + 1, r.id));
  const filled = nom.type === 'accept' ? rules.promote(d, nom.lab_id) : 0;
  const stu = d.prepare('SELECT name FROM users WHERE id = ?').get(nom.student_id);
  rules.audit(d, user.name, user.role, '调整名单', '从「' + lab.name + '」移除 ' + (stu ? stu.name : nom.student_id) +
    (filled ? '，递补 ' + filled + ' 人' : ''));
}

function updateQuota(d, user, labId, body) {
  if (user.role !== 'admin') fail(403, '仅学院管理员可调整名额');
  const lab = d.prepare('SELECT * FROM labs WHERE id = ?').get(labId);
  if (!lab) fail(404, '实训室不存在');
  const quota = int(body.quota, NaN);
  if (!Number.isFinite(quota) || quota < 0) fail(400, '名额不合法');
  const taken = rules.takenCount(d, labId);
  if (quota < taken) fail(409, '名额不能低于当前已占用人数 ' + taken);
  d.prepare('UPDATE labs SET quota = ? WHERE id = ?').run(quota, labId);
  const filled = rules.promote(d, labId);
  rules.audit(d, user.name, 'admin', '调整名额', '「' + lab.name + '」名额调整为 ' + quota);
}

function updateCycle(d, user, body) {
  if (user.role !== 'admin') fail(403, '仅学院管理员可修改日程');
  const stages = arr(body.stages);
  if (stages.length !== 8) fail(400, '需要提供 8 个环节的时间');
  const rows = stages.slice().sort((a, b) => a.idx - b.idx);
  rows.forEach((s, i) => {
    if (i > 0 && s.start < rows[i - 1].end) fail(400, '第 ' + (i + 1) + ' 个环节需在上一个环节结束后开始');
    if (!(s.end > s.start)) fail(400, '第 ' + (i + 1) + ' 个环节结束时间需晚于开始时间');
  });
  const upd = d.prepare('UPDATE stages SET start_at = ?, end_at = ? WHERE idx = ?');
  rows.forEach((s) => upd.run(Math.round(s.start), Math.round(s.end), s.idx));
  if (body.name) d.prepare('UPDATE cycle SET name = ? WHERE id = 1').run(String(body.name).slice(0, 80));
  if (body.year) d.prepare('UPDATE cycle SET year = ? WHERE id = 1').run(int(body.year, 2026));
  rules.audit(d, user.name, 'admin', '修改日程', '调整 8 个环节时间');
}

function jumpStage(d, user, body) {
  const demo = d.prepare("SELECT value FROM meta WHERE key = 'demo'").get();
  if (!demo || demo.value !== '1') fail(403, '仅演示环境支持切换阶段');
  const idx = int(body.stage, -1);
  if (idx < 0 || idx > 7) fail(400, '阶段序号不正确');
  rules.jumpToStage(d, idx);
  rules.settle(d);
}

function allocate(d, user, body) {
  if (user.role !== 'admin') fail(403, '仅学院管理员可调剂');
  const studentId = body.studentId;
  const labId = body.labId;
  const priority = String(body.priority || 'P3');
  if (!['P1', 'P2', 'P3'].includes(priority)) fail(400, '优先级不正确');
  const reason = String(body.reason || '').trim();
  if (reason.length < 4) fail(400, '请填写调剂理由（至少 4 个字）');
  const stu = d.prepare("SELECT * FROM users WHERE id = ? AND role = 'student'").get(studentId);
  if (!stu) fail(404, '学生不存在');
  if (d.prepare('SELECT 1 x FROM confirmations WHERE student_id = ?').get(studentId)) fail(409, '该学生已有去向');
  if (rules.activeAcceptsOfStudent(d, studentId).length) fail(409, '该学生仍有拟录取意向，请先处理');
  const lab = d.prepare('SELECT * FROM labs WHERE id = ?').get(labId);
  if (!lab) fail(404, '实训室不存在');
  if (rules.remaining(d, labId) <= 0) fail(409, '该实训室名额已满');
  d.prepare('INSERT INTO allocations (student_id, lab_id, priority, reason, at) VALUES (?,?,?,?,?)')
    .run(studentId, labId, priority, reason, Date.now());
  d.prepare('INSERT INTO confirmations (student_id, lab_id, source, at) VALUES (?,?,?,?)')
    .run(studentId, labId, 'alloc', Date.now());
  rules.audit(d, user.name, 'admin', '调剂落位', stu.name + ' 按 ' + priority + ' 调剂至「' + lab.name + '」，理由：' + reason);
}

function publish(d, user) {
  if (user.role !== 'admin') fail(403, '仅学院管理员可发布公示');
  rules.requireStage(d, 7, '结果公示');
  const count = d.prepare('SELECT COUNT(*) c FROM confirmations').get().c;
  if (!count) fail(409, '还没有任何录取结果，无法发布公示');
  const t = Date.now();
  d.prepare('UPDATE publicity SET published_at = ?, until = ? WHERE id = 1').run(t, t + 86400e3);
  rules.audit(d, user.name, 'admin', '发布公示', '汇总 ' + count + ' 人最终录取名单并公示 1 天');
}

function addObjection(d, user, body) {
  if (user.role !== 'student') fail(403, '请以学生身份提交异议');
  const text = String(body.text || '').trim();
  if (text.length < 5) fail(400, '异议内容太短');
  d.prepare('INSERT INTO objections (student_id, name, text, at) VALUES (?,?,?,?)')
    .run(user.id, user.name, text.slice(0, 500), Date.now());
  rules.audit(d, user.name, 'student', '提交异议', text.slice(0, 60));
}

/* ---------------- 路由 ---------------- */
function withSnapshot(fn) {
  return (ctx) => {
    const snapshot = tx((d) => {
      rules.settle(d);
      fn(d, ctx);
      return buildSnapshot(d, ctx.user);
    });
    return { ok: true, snapshot };
  };
}

const routes = [];
function route(method, pattern, handler, opts) {
  routes.push({ method, parts: pattern.split('/').filter(Boolean), handler, opts: opts || {} });
}

route('POST', '/api/login', (ctx) => login(ctx.body, ctx.res), { auth: false });
route('POST', '/api/logout', (ctx) => logout(ctx), { auth: false });
route('GET', '/api/health', () => {
  const snapshot = info();
  return {
    ok: snapshot.integrity === 'ok' && snapshot.foreignKeys === 0,
    time: Date.now(),
    schema: snapshot.schema,
    tables: snapshot.tables,
    integrity: snapshot.integrity,
    foreignKeyErrors: snapshot.foreignKeys
  };
}, { auth: false });
route('GET', '/api/bootstrap', (ctx) => {
  if (!ctx.user) return { ok: true, snapshot: null };
  const snapshot = tx((d) => {
    rules.settle(d);
    return buildSnapshot(d, ctx.user);
  });
  return { ok: true, snapshot };
}, { auth: false });
route('POST', '/api/applications', withSnapshot((d, ctx) => saveApplication(d, ctx.user, ctx.body)));
route('POST', '/api/confirmations', withSnapshot((d, ctx) => rules.confirmOffer(d, ctx.user, String(ctx.body.labId))));
route('POST', '/api/interviews/arrange', withSnapshot((d, ctx) => arrangeInterviews(d, ctx.user, ctx.body)));
route('POST', '/api/interviews/:id/score', withSnapshot((d, ctx) => scoreInterview(d, ctx.user, ctx.params.id, ctx.body)));
route('POST', '/api/nominations', withSnapshot((d, ctx) => addNomination(d, ctx.user, ctx.body)));
route('PATCH', '/api/nominations/:id/move', withSnapshot((d, ctx) => moveNomination(d, ctx.user, ctx.params.id, ctx.body)));
route('DELETE', '/api/nominations/:id', withSnapshot((d, ctx) => removeNomination(d, ctx.user, ctx.params.id)));
route('PATCH', '/api/labs/:id', withSnapshot((d, ctx) => updateQuota(d, ctx.user, ctx.params.id, ctx.body)));
route('PATCH', '/api/cycle', withSnapshot((d, ctx) => updateCycle(d, ctx.user, ctx.body)));
route('POST', '/api/cycle/jump', withSnapshot((d, ctx) => jumpStage(d, ctx.user, ctx.body)));
route('POST', '/api/cycle/settle', withSnapshot((d, ctx) => {
  if (ctx.user.role !== 'admin') fail(403, '仅学院管理员可结算');
  rules.audit(d, ctx.user.name, 'admin', '结算阶段', '手动执行一次阶段结算');
}));
route('POST', '/api/allocations', withSnapshot((d, ctx) => allocate(d, ctx.user, ctx.body)));
route('POST', '/api/publicity', withSnapshot((d, ctx) => publish(d, ctx.user)));
route('POST', '/api/objections', withSnapshot((d, ctx) => addObjection(d, ctx.user, ctx.body)));
route('POST', '/api/demo/reset', (ctx) => {
  if (ctx.user.role !== 'admin' && !ctx.demo) fail(403, '无权重置演示数据');
  resetDemo();
  return { ok: true };
});
route('POST', '/api/interviews/:id/unlock', withSnapshot((d, ctx) => unlockInterview(d, ctx.user, ctx.params.id)));
route('GET', '/api/export/:type', (ctx) => {
  const d = open();
  return exportCsv(d, ctx.user, String(ctx.params.type));
});

/* ---------------- 导出与解锁 ---------------- */
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const csvOf = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
const csvDate = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');

function exportCsv(d, user, type) {
  if (user.role !== 'admin') fail(403, '仅学院管理员可导出');
  let rows;
  if (type === 'labs') {
    rows = [['实训室', '方向', '导师', '名额', '报名', '占用', '剩余']].concat(
      d.prepare(`SELECT l.name, l.direction, l.teacher_name, l.quota, v.taken,
        (SELECT COUNT(DISTINCT student_id) FROM application_labs WHERE lab_id = l.id) AS applicants
        FROM labs l JOIN v_lab_capacity v ON v.lab_id = l.id ORDER BY l.id`).all()
        .map((r) => [r.name, r.direction, r.teacher_name, r.quota, r.applicants, r.taken, Math.max(0, r.quota - r.taken)])
    );
  } else if (type === 'students') {
    rows = [['学号', '姓名', '班级', '手机', '邮箱', '意向数', '面试数', '录取去向']].concat(
      d.prepare(`SELECT u.id, u.name, u.cls, u.phone, u.email,
        (SELECT COUNT(*) FROM application_labs WHERE student_id = u.id) AS apps,
        (SELECT COUNT(*) FROM interviews WHERE student_id = u.id AND status = 'done') AS ivs,
        (SELECT l.name FROM confirmations c JOIN labs l ON l.id = c.lab_id WHERE c.student_id = u.id) AS lab
        FROM users u WHERE u.role = 'student' ORDER BY u.id`).all()
        .map((r) => [r.id, r.name, r.cls, r.phone, r.email, r.apps, r.ivs, r.lab || '未录取'])
    );
  } else if (type === 'admissions') {
    rows = [['学号', '姓名', '班级', '实训室', '方向', '录取方式', '确认时间']].concat(
      d.prepare(`SELECT c.student_id, u.name, u.cls, l.name AS lab, l.direction, c.source, c.at
        FROM confirmations c JOIN users u ON u.id = c.student_id JOIN labs l ON l.id = c.lab_id
        ORDER BY l.name, u.name`).all()
        .map((r) => [r.student_id, r.name, r.cls, r.lab, r.direction, r.source, new Date(r.at).toLocaleString('zh-CN', { hour12: false })])
    );
  } else if (type === 'publicity') {
    rows = [['学号（脱敏）', '姓名', '实训室', '方向', '录取方式', '确认时间']].concat(
      d.prepare(`SELECT c.student_id, u.name, l.name AS lab, l.direction, c.source, c.at
        FROM confirmations c JOIN users u ON u.id = c.student_id JOIN labs l ON l.id = c.lab_id
        ORDER BY l.name, u.name`).all()
        .map((r) => ['******' + String(r.student_id).slice(-4), r.name, r.lab, r.direction, r.source, new Date(r.at).toLocaleString('zh-CN', { hour12: false })])
    );
  } else if (type === 'audit') {
    rows = [['时间', '操作人', '角色', '动作', '详情']].concat(
      d.prepare('SELECT * FROM audit ORDER BY at DESC').all()
        .map((r) => [new Date(r.at).toLocaleString('zh-CN', { hour12: false }), r.actor, r.role, r.action, r.detail || ''])
    );
  } else {
    fail(404, '不支持的导出类型');
  }
  return { csv: csvOf(rows), filename: type + '-' + csvDate() + '.csv' };
}

function unlockInterview(d, user, id) {
  if (user.role !== 'admin') fail(403, '仅学院管理员可解锁评分');
  const iv = d.prepare('SELECT * FROM interviews WHERE id = ?').get(id);
  if (!iv) fail(404, '面试记录不存在');
  if (!iv.locked) fail(400, '该评分未锁定，无需解锁');
  d.prepare('UPDATE interviews SET locked = 0 WHERE id = ?').run(iv.id);
  rules.audit(d, user.name, user.role, '解锁评分', '解锁 ' + iv.student_id + ' 在「' + iv.lab_id + '」的面试评分');
  return { ok: true };
}

function match(method, pathname) {
  const segs = pathname.split('/').filter(Boolean);
  for (const r of routes) {
    if (r.method !== method) continue;
    if (r.parts.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      const p = r.parts[i];
      if (p.charAt(0) === ':') params[p.slice(1)] = decodeURIComponent(segs[i]);
      else if (p !== segs[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

async function handle(ctx) {
  const found = match(ctx.method, ctx.pathname);
  if (!found) fail(404, '接口不存在');
  const r = found.route;
  if (r.opts.auth !== false && !ctx.user) fail(401, '登录已过期，请重新登录');
  ctx.params = found.params;
  return r.handler(ctx);
}

module.exports = { handle, buildSnapshot, fail, SESSION_MS };
