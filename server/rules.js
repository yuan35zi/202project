/* ==========================================================================
   业务规则层：时间窗口、名额约束、递补、结算、审计
   ========================================================================== */
const { open } = require('./db');
const seedData = require('../js/data.js');

const now = () => Date.now();

function stages(d) {
  d = d || open();
  return d.prepare('SELECT idx, key, label, short, start_at AS start, end_at AS end FROM stages ORDER BY idx').all();
}

function stageIndex(d, t) {
  d = d || open();
  const list = stages(d);
  const at = t == null ? now() : t;
  if (!list.length) return -1;
  if (at < list[0].start) return -1;
  for (const s of list) {
    if (at >= s.start && at <= s.end) return s.idx;
  }
  return list.length;
}

function stageOf(d, i) {
  return stages(d).find((s) => s.idx === i) || null;
}

function requireStage(d, i, name) {
  const idx = stageIndex(d);
  if (idx !== i) {
    const err = new Error('当前不在「' + name + '」窗口内');
    err.status = 409;
    throw err;
  }
}

function audit(d, actor, role, action, detail) {
  d.prepare('INSERT INTO audit (at, actor, role, action, detail) VALUES (?,?,?,?,?)')
    .run(now(), actor || '系统', role || 'system', action, detail || '');
}

function takenRows(d, labId) {
  return d.prepare(`
    SELECT student_id AS s FROM nominations WHERE lab_id = ? AND type = 'accept' AND status IS NULL
    UNION
    SELECT student_id AS s FROM confirmations WHERE lab_id = ?
    UNION
    SELECT student_id AS s FROM allocations WHERE lab_id = ?
  `).all(labId, labId, labId);
}

function takenCount(d, labId) {
  return takenRows(d, labId).length;
}

function remaining(d, labId) {
  const lab = d.prepare('SELECT quota FROM labs WHERE id = ?').get(labId);
  if (!lab) return 0;
  return Math.max(0, lab.quota - takenCount(d, labId));
}

function labStats(d, labId, role) {
  const lab = d.prepare('SELECT * FROM labs WHERE id = ?').get(labId);
  if (!lab) return null;
  const applicants = d.prepare('SELECT COUNT(DISTINCT student_id) c FROM application_labs WHERE lab_id = ?').get(labId).c;
  const accepted = d.prepare("SELECT COUNT(*) c FROM nominations WHERE lab_id = ? AND type = 'accept' AND status IS NULL").get(labId).c;
  const wait = d.prepare("SELECT COUNT(*) c FROM nominations WHERE lab_id = ? AND type = 'wait' AND status IS NULL").get(labId).c;
  const internal = d.prepare("SELECT COUNT(*) c FROM nominations WHERE lab_id = ? AND type = 'internal' AND status IS NULL").get(labId).c;
  const confirmed = d.prepare('SELECT COUNT(*) c FROM confirmations WHERE lab_id = ?').get(labId).c;
  const taken = takenCount(d, labId);
  return {
    quota: lab.quota,
    applicants: role === 'student' ? null : applicants,
    accepted, wait, internal, confirmed, taken,
    remaining: Math.max(0, lab.quota - taken)
  };
}

function waitlist(d, labId) {
  return d.prepare("SELECT * FROM nominations WHERE lab_id = ? AND type = 'wait' AND status IS NULL ORDER BY rank ASC").all(labId);
}

function activeAcceptsOfStudent(d, studentId) {
  return d.prepare("SELECT * FROM nominations WHERE student_id = ? AND type = 'accept' AND status IS NULL").all(studentId);
}

function promotionRank(d, labId) {
  const row = d.prepare("SELECT MAX(rank) m FROM nominations WHERE lab_id = ? AND type = 'accept' AND status IS NULL").get(labId);
  return (row.m || 0) + 1;
}

/** 递补：有空位就按顺位补 */
function promote(d, labId) {
  let promoted = 0;
  let guard = 0;
  while (remaining(d, labId) > 0 && guard++ < 20) {
    const w = waitlist(d, labId)[0];
    if (!w) break;
    d.prepare("UPDATE nominations SET type = 'accept', rank = ? WHERE id = ?").run(promotionRank(d, labId), w.id);
    const stu = d.prepare('SELECT name FROM users WHERE id = ?').get(w.student_id);
    const lab = d.prepare('SELECT name FROM labs WHERE id = ?').get(labId);
    audit(d, '系统', 'system', '递补补位', '「' + lab.name + '」按顺位递补 ' + (stu ? stu.name : w.student_id));
    promoted++;
  }
  return promoted;
}

/** 阶段结算：单意向自动确认；确认窗口结束后逾期释放 */
function settle(d, t) {
  const idx = stageIndex(d, t);
  if (idx < 4) return 0;
  let changed = 0;

  const unconfirmed = d.prepare(`
    SELECT n.student_id, COUNT(*) AS cnt, MIN(n.lab_id) AS lab_id
    FROM nominations n
    LEFT JOIN confirmations c ON c.student_id = n.student_id
    WHERE n.type = 'accept' AND n.status IS NULL AND c.student_id IS NULL
    GROUP BY n.student_id
  `).all();

  unconfirmed.forEach((row) => {
    if (row.cnt === 1) {
      d.prepare('INSERT INTO confirmations (student_id, lab_id, source, at) VALUES (?,?,?,?)')
        .run(row.student_id, row.lab_id, 'auto', t || now());
      changed++;
    } else if (idx >= 5) {
      d.prepare("UPDATE nominations SET status = 'expired' WHERE student_id = ? AND type = 'accept' AND status IS NULL")
        .run(row.student_id);
      const stu = d.prepare('SELECT name FROM users WHERE id = ?').get(row.student_id);
      audit(d, '系统', 'system', '逾期放弃', (stu ? stu.name : row.student_id) + ' 未在双选确认窗口内选择，释放 ' + row.cnt + ' 个名额');
      changed++;
    }
  });
  return changed;
}

/** 确认去向：释放其他意向并触发递补 */
function confirmOffer(d, student, labId) {
  requireStage(d, 4, '拟录取与学生确认');
  const exists = d.prepare('SELECT * FROM confirmations WHERE student_id = ?').get(student.id);
  if (exists) { const e = new Error('你已经确认过去向，不可重复确认'); e.status = 409; throw e; }
  const offers = activeAcceptsOfStudent(d, student.id);
  const hit = offers.find((o) => o.lab_id === labId);
  if (!hit) { const e = new Error('该拟录取意向不存在或已失效'); e.status = 404; throw e; }

  d.prepare('INSERT INTO confirmations (student_id, lab_id, source, at) VALUES (?,?,?,?)')
    .run(student.id, labId, offers.length === 1 ? 'auto' : 'choice', now());
  offers.forEach((o) => {
    if (o.lab_id !== labId) d.prepare("UPDATE nominations SET status = 'released' WHERE id = ?").run(o.id);
  });
  const lab = d.prepare('SELECT name FROM labs WHERE id = ?').get(labId);
  offers.filter((o) => o.lab_id !== labId).forEach((o) => promote(d, o.lab_id));
  audit(d, student.name, 'student', '确认去向', '确认加入「' + lab.name + '」，释放 ' + (offers.length - 1) + ' 个意向');
  return true;
}

function jumpToStage(d, idx) {
  const times = seedData.makeTimes(now(), idx);
  const upd = d.prepare('UPDATE stages SET start_at = ?, end_at = ? WHERE idx = ?');
  times.forEach((s, i) => upd.run(s.start, s.end, i));
  audit(d, '学院管理员', 'admin', '演示切换阶段', '切换到「' + times[idx].label + '」并重排时间轴');
}

module.exports = {
  now, stages, stageOf, stageIndex, requireStage, audit,
  takenRows, takenCount, remaining, labStats, waitlist,
  activeAcceptsOfStudent, promote, settle, confirmOffer, jumpToStage
};
