/* 数据库约束自测：名额触发器、外键、CHECK、部分唯一索引、迁移幂等
   使用临时库，不影响 data/app.db。运行：npm run test:db
*/
const fs = require('fs');
const path = require('path');
const os = require('os');

const tmp = path.join(os.tmpdir(), 'lab-selection-test-' + process.pid + '.db');
process.env.DB_PATH = tmp;

const db = require('../server/db');

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ✓ ' + name);
  } catch (err) {
    fail++;
    console.log('  ✗ ' + name + ' —— ' + err.message);
  }
}

function expectError(fn, keyword) {
  try {
    fn();
  } catch (err) {
    if (String(err.message).includes(keyword)) return;
    throw new Error('报错信息不符：' + err.message);
  }
  throw new Error('预期报错但执行成功');
}

console.log('数据库约束自测（临时库：' + tmp + '）');

db.resetHard();
const d = db.open();
const now = Date.now();

const fullLab = d.prepare('SELECT lab_id FROM v_lab_capacity WHERE taken >= quota LIMIT 1').get();
const freeStudent = d.prepare(`SELECT id FROM users u WHERE u.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM nominations n WHERE n.student_id = u.id AND n.lab_id = ? AND n.status IS NULL)
  AND NOT EXISTS (SELECT 1 FROM confirmations c WHERE c.student_id = u.id)
  LIMIT 1`).get(fullLab.lab_id);

check('名额触发器：满员实训室插入拟录取被拒绝', () => {
  expectError(() => {
    d.prepare('INSERT INTO nominations (lab_id, student_id, type, rank, round, status, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(fullLab.lab_id, freeStudent.id, 'accept', 99, 1, null, now);
  }, '名额已满');
});

check('外键：面试写入不存在的实训室被拒绝', () => {
  expectError(() => {
    d.prepare('INSERT INTO interviews (id, lab_id, student_id, at, room, status, locked) VALUES (?,?,?,?,?,?,?)')
      .run('T-FK', 'NOT_EXIST', freeStudent.id, now, 'A101', 'pending', 0);
  }, 'FOREIGN KEY');
});

const pair = d.prepare(`SELECT l.id AS labId, u.id AS no FROM labs l, users u
  WHERE u.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM interviews i WHERE i.lab_id = l.id AND i.student_id = u.id)
  LIMIT 1`).get();

check('CHECK：评分超出 0–100 被拒绝', () => {
  expectError(() => {
    d.prepare('INSERT INTO interviews (id, lab_id, student_id, at, room, status, attitude, locked) VALUES (?,?,?,?,?,?,?,?)')
      .run('T-CK', pair.labId, pair.no, now, 'A101', 'pending', 150, 0);
  }, 'CHECK');
});

check('CHECK：空的调剂理由被拒绝', () => {
  expectError(() => {
    d.prepare('INSERT INTO allocations (student_id, lab_id, priority, reason, at) VALUES (?,?,?,?,?)')
      .run(freeStudent.id, fullLab.lab_id, 'P3', '   ', now);
  }, 'CHECK');
});

check('部分唯一索引：同一实训室重复有效名单被拒绝', () => {
  const lab2 = d.prepare(`SELECT lab_id FROM v_lab_capacity WHERE taken < quota LIMIT 1`).get();
  const s2 = d.prepare(`SELECT id FROM users u WHERE u.role = 'student'
    AND NOT EXISTS (SELECT 1 FROM nominations n WHERE n.student_id = u.id AND n.lab_id = ? AND n.status IS NULL)
    LIMIT 1`).get(lab2.lab_id);
  d.prepare('INSERT INTO nominations (lab_id, student_id, type, rank, round, status, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(lab2.lab_id, s2.id, 'wait', 50, 1, null, now);
  expectError(() => {
    d.prepare('INSERT INTO nominations (lab_id, student_id, type, rank, round, status, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(lab2.lab_id, s2.id, 'wait', 51, 1, null, now);
  }, 'UNIQUE');
});

check('递补触发器：wait 升级为 accept 时仍受名额约束', () => {
  const lab = d.prepare('SELECT lab_id FROM v_lab_capacity WHERE taken >= quota LIMIT 1').get();
  const waitRow = d.prepare(`SELECT id FROM nominations WHERE lab_id = ? AND type = 'wait' AND status IS NULL LIMIT 1`).get(lab.lab_id);
  if (!waitRow) throw new Error('没有可用的递补记录');
  expectError(() => {
    d.prepare("UPDATE nominations SET type = 'accept', rank = 99 WHERE id = ?").run(waitRow.id);
  }, '名额已满');
});

check('迁移幂等：再次打开不重复建表', () => {
  const before = d.prepare('SELECT COUNT(*) c FROM schema_migrations').get().c;
  const d2 = require('../server/db');
  const after = d2.open().prepare('SELECT COUNT(*) c FROM schema_migrations').get().c;
  if (before !== after) throw new Error('迁移记录数量变化：' + before + ' -> ' + after);
});

check('完整性：integrity_check = ok 且无外键异常', () => {
  const info = db.info();
  if (info.integrity !== 'ok') throw new Error('integrity=' + info.integrity);
  if (info.foreignKeys !== 0) throw new Error('外键异常 ' + info.foreignKeys + ' 条');
});

db.close();
['', '-wal', '-shm'].forEach((s) => fs.rmSync(tmp + s, { force: true }));

console.log('结果：' + pass + ' 通过，' + fail + ' 失败');
process.exitCode = fail ? 1 : 0;
