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

/** 递补：有空位就按顺位补；补位成功后记录个人确认截止时间（补位 + 2h，且不晚于本轮结束） */
function promote(d, labId) {
  let promoted = 0;
  let guard = 0;
  const idx = stageIndex(d);
  const st4 = d.prepare('SELECT end_at AS end FROM stages WHERE idx = 4').get();
  while (remaining(d, labId) > 0 && guard++ < 20) {
    const w = waitlist(d, labId)[0];
    if (!w) break;
    const deadline = idx >= 4 && st4
      ? (idx >= 5 ? now() + 2 * 3600e3 : Math.min(st4.end, now() + 2 * 3600e3))
      : null;
    d.prepare("UPDATE nominations SET type = 'accept', rank = ?, deadline = ? WHERE id = ?")
      .run(promotionRank(d, labId), deadline, w.id);
    const stu = d.prepare('SELECT name FROM users WHERE id = ?').get(w.student_id);
    const lab = d.prepare('SELECT name FROM labs WHERE id = ?').get(labId);
    audit(d, '系统', 'system', '递补补位', '「' + lab.name + '」按顺位递补 ' + (stu ? stu.name : w.student_id) +
      (deadline ? '，须在 ' + new Date(deadline).toLocaleString('zh-CN', { hour12: false }) + ' 前确认' : ''));
    promoted++;
  }
  return promoted;
}

/** 释放某学生的全部拟录取意向，并按实训室逐个触发递补 */
function expireOffers(d, studentId, reason) {
  const labs = d.prepare("SELECT DISTINCT lab_id FROM nominations WHERE student_id = ? AND type = 'accept' AND status IS NULL")
    .all(studentId).map((r) => r.lab_id);
  if (!labs.length) return 0;
  d.prepare("UPDATE nominations SET status = 'expired' WHERE student_id = ? AND type = 'accept' AND status IS NULL").run(studentId);
  const stu = d.prepare('SELECT name FROM users WHERE id = ?').get(studentId);
  audit(d, '系统', 'system', reason, (stu ? stu.name : studentId) + ' 释放 ' + labs.length + ' 个拟录取意向，触发递补');
  labs.forEach((labId) => promote(d, labId));
  return labs.length;
}

/** 阶段结算：单意向自动确认；窗口结束或补位超时则释放并递补（幂等） */
function settle(d, t) {
  const at = t == null ? now() : t;
  const idx = stageIndex(d, at);
  if (idx < 4) return 0;
  let changed = 0;

  // 1) 只收到 1 条意向的，进入双选阶段即自动确认
  d.prepare(`
    SELECT student_id, MIN(lab_id) AS lab_id FROM nominations
    WHERE type = 'accept' AND status IS NULL
      AND student_id NOT IN (SELECT student_id FROM confirmations)
    GROUP BY student_id HAVING COUNT(*) = 1
  `).all().forEach((row) => {
    d.prepare('INSERT INTO confirmations (student_id, lab_id, source, at) VALUES (?,?,?,?)')
      .run(row.student_id, row.lab_id, 'auto', at);
    changed++;
  });

  // 2) 多意向学生：补位 2 小时到期；进入补录后仍未确认的老意向按窗口结束释放
  const rows = d.prepare(idx >= 5
    ? `
        SELECT student_id FROM nominations
        WHERE type = 'accept' AND status IS NULL
          AND student_id NOT IN (SELECT student_id FROM confirmations)
        GROUP BY student_id
        HAVING MIN(deadline) IS NULL OR MIN(deadline) < ?
      `
    : `
        SELECT student_id FROM nominations
        WHERE type = 'accept' AND status IS NULL
          AND student_id NOT IN (SELECT student_id FROM confirmations)
        GROUP BY student_id
        HAVING MIN(deadline) IS NOT NULL AND MIN(deadline) < ?
      `).all(at);

  rows.forEach((row) => {
    changed += expireOffers(d, row.student_id, idx >= 5 ? '逾期放弃' : '补位超时释放');
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
