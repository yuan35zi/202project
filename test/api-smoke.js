/* 接口冒烟测试：自动拉起一个临时服务（端口 8231 + 临时库），跑完整业务链路
   运行：npm run test:api
*/
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 8231;
const BASE = 'http://127.0.0.1:' + PORT;
const DB = path.join(os.tmpdir(), 'lab-selection-api-' + process.pid + '.db');

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' —— ' + JSON.stringify(extra) : '')); }
}

async function call(method, p, body, cookie) {
  const res = await fetch(BASE + p, {
    method,
    headers: Object.assign({ 'content-type': 'application/json' }, cookie ? { cookie } : {}),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* ignore */ }
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const next = setCookie.length ? setCookie[0].split(';')[0] : cookie;
  return { status: res.status, json, cookie: next };
}

async function login(role, id, password) {
  const r = await call('POST', '/api/login', { role, id, password });
  return { status: r.status, cookie: r.cookie, body: r.json };
}

async function waitHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE + '/api/health');
      if (res.ok) return await res.json();
    } catch (e) { /* not ready */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('服务启动超时');
}

(async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, { PORT: String(PORT), DB_PATH: DB }),
    stdio: 'ignore'
  });

  try {
    const health = await waitHealth(15000);
    ok('健康检查：结构版本 v2、完整性 ok', health.ok && health.schema.version >= 2 && health.integrity === 'ok', health);

    ok('错误密码返回 401', (await login('student', '2023040101', 'wrongpass')).status === 401);

    const stu = await login('student', '2023040101', '123456');
    ok('学生登录成功并拿到会话', stu.status === 200 && !!stu.cookie);

    let snap = (await call('GET', '/api/bootstrap', undefined, stu.cookie)).json.snapshot;
    ok('学生快照只包含自己的填报', snap.applications['2023040101'].labs.length === 2, snap.applications);

    const save = await call('POST', '/api/applications',
      { labs: ['L2', 'L4', 'L5'], internal: true, cross: false, intro: '冒烟测试' }, stu.cookie);
    ok('提交 3 个平行意向成功', save.status === 200, save.json);

    snap = (await call('GET', '/api/bootstrap', undefined, stu.cookie)).json.snapshot;
    ok('意向已更新为 3 个', snap.applications['2023040101'].labs.length === 3, snap.applications['2023040101']);

    const bad = await call('POST', '/api/applications', { labs: ['L2', 'L4', 'L5', 'L6'] }, stu.cookie);
    ok('超过 3 个意向返回 400', bad.status === 400, bad.json);

    const tea = await login('teacher', 'T102', '123456');
    const tSnap = (await call('GET', '/api/bootstrap', undefined, tea.cookie)).json.snapshot;
    const ownLabs = new Set(['L1', 'L3']);
    const leakedApps = Object.keys(tSnap.applications).filter((no) => {
      const labs = tSnap.applications[no].labs || [];
      return !labs.some((id) => ownLabs.has(id));
    });
    ok('导师报名数据只含本室学生', leakedApps.length === 0, leakedApps.slice(0, 5));
    ok('导师面试数据只含本室场次', tSnap.interviews.every((iv) => ownLabs.has(iv.labId)), tSnap.interviews.map((iv) => iv.labId).slice(0, 5));

    const pending = tSnap.interviews.find((iv) => iv.status === 'pending');
    ok('导师名下存在待评分面试', !!pending);
    const score = await call('POST', '/api/interviews/' + pending.id + '/score',
      { attitude: 80, logic: 85, coding: 75, comm: 80, comment: '冒烟测试' }, tea.cookie);
    ok('提交评分成功', score.status === 200, score.json);
    const again = await call('POST', '/api/interviews/' + pending.id + '/score',
      { attitude: 90, logic: 90, coding: 90, comm: 90 }, tea.cookie);
    ok('重复评分返回 409（已锁定）', again.status === 409, again.json);

    const admin = await login('admin', 'admin', '123456');
    const jump4 = await call('POST', '/api/cycle/jump', { stage: 4 }, admin.cookie);
    ok('学院跳转到双选阶段', jump4.status === 200, jump4.json);

    snap = (await call('GET', '/api/bootstrap', undefined, stu.cookie)).json.snapshot;
    const offers = snap.nominations.filter((n) => n.type === 'accept');
    ok('学生持有多条拟录取意向', offers.length >= 2, offers);

    const confirm = await call('POST', '/api/confirmations', { labId: offers[0].labId }, stu.cookie);
    ok('确认去向成功', confirm.status === 200, confirm.json);
    const dup = await call('POST', '/api/confirmations', { labId: offers[1].labId }, stu.cookie);
    ok('重复确认返回 409', dup.status === 409, dup.json);

    const early = await call('POST', '/api/publicity', {}, admin.cookie);
    ok('未到公示环节发布被拒绝', early.status === 409, early.json);

    await call('POST', '/api/cycle/jump', { stage: 7 }, admin.cookie);
    const pub = await call('POST', '/api/publicity', {}, admin.cookie);
    ok('公示发布成功', pub.status === 200, pub.json);

    snap = (await call('GET', '/api/bootstrap', undefined, stu.cookie)).json.snapshot;
    ok('学生端可见脱敏公示', !!snap.publicity.publishedAt && snap.publicRows.length > 0, { publishedAt: snap.publicity.publishedAt, rows: snap.publicRows.length });

    const aSnap = (await call('GET', '/api/bootstrap', undefined, admin.cookie)).json.snapshot;
    const taken = new Set(aSnap.nominations.filter((n) => n.type === 'accept').map((n) => n.no));
    const cand = aSnap.students.find((s) => !taken.has(s.no) && !(aSnap.confirmations || {})[s.no]);
    const room = aSnap.labs.find((l) => l.stats.taken < l.quota);
    const short = await call('POST', '/api/allocations', { studentId: cand.no, labId: room.id, priority: 'P3', reason: '短' }, admin.cookie);
    ok('调剂理由过短返回 400', short.status === 400, short.json);
    const alloc = await call('POST', '/api/allocations', { studentId: cand.no, labId: room.id, priority: 'P3', reason: '冒烟测试：学院统筹调剂' }, admin.cookie);
    ok('统筹调剂成功', alloc.status === 200, alloc.json);

    const expRes = await fetch(BASE + '/api/export/labs', { headers: { cookie: admin.cookie } });
    const expText = await expRes.text();
    ok('学院可导出名额表 CSV', expRes.status === 200 && /text\/csv/.test(expRes.headers.get('content-type')) && expText.indexOf('实训室') >= 0, { status: expRes.status });
    const exp403 = await call('GET', '/api/export/labs', undefined, stu.cookie);
    ok('学生导出返回 403', exp403.status === 403, exp403.json);

    const unlock = await call('POST', '/api/interviews/' + pending.id + '/unlock', {}, admin.cookie);
    ok('学院可解锁已锁定评分', unlock.status === 200, unlock.json);
    const unlockAgain = await call('POST', '/api/interviews/' + pending.id + '/unlock', {}, admin.cookie);
    ok('未锁定重复解锁返回 400', unlockAgain.status === 400, unlockAgain.json);
    const rescore = await call('POST', '/api/interviews/' + pending.id + '/score',
      { attitude: 88, logic: 88, coding: 88, comm: 88 }, tea.cookie);
    ok('解锁后可重新评分', rescore.status === 200, rescore.json);

    let lastRate = null;
    for (let i = 0; i < 6; i++) {
      lastRate = await call('POST', '/api/login', { role: 'student', id: '2023040102', password: 'wrong-pass' });
    }
    ok('连续失败登录触发 429 限流', lastRate.status === 429, lastRate.json);

    const bSnap = (await call('GET', '/api/bootstrap', undefined, admin.cookie)).json.snapshot;
    const labWithWait = [...new Set(bSnap.nominations.filter((n) => n.type === 'wait' && !n.status).map((n) => n.labId))]
      .find((id) => bSnap.nominations.some((n) => n.type === 'accept' && n.labId === id && !n.status));
    let promoOk = false;
    if (labWithWait) {
      const accBefore = bSnap.nominations.filter((n) => n.type === 'accept' && n.labId === labWithWait && !n.status);
      const waitBefore = bSnap.nominations.filter((n) => n.type === 'wait' && n.labId === labWithWait && !n.status);
      const del = await call('DELETE', '/api/nominations/' + accBefore[0].id, undefined, admin.cookie);
      const cSnap = del.status === 200 ? (await call('GET', '/api/bootstrap', undefined, admin.cookie)).json.snapshot : bSnap;
      const promoted = (cSnap.nominations || []).filter((n) =>
        n.type === 'accept' && n.labId === labWithWait && !n.status && waitBefore.some((w) => w.no === n.no));
      promoOk = del.status === 200 && promoted.length > 0;
    }
    ok('移除拟录取后自动递补', promoOk, { labWithWait });

    const reset = await call('POST', '/api/demo/reset', {}, admin.cookie);
    ok('演示数据重置成功', reset.status === 200, reset.json);
    const admin2 = await login('admin', 'admin', '123456');
    const after = (await call('GET', '/api/bootstrap', undefined, admin2.cookie)).json.snapshot;
    ok('重置后会话失效，需重新登录', admin2.status === 200);
    ok('重置后回到初始状态', after.confirmations && Object.keys(after.confirmations).length === 0, after.global);
  } catch (err) {
    fail++;
    console.error('  ✗ 执行中断：' + err.message);
  } finally {
    child.kill();
    await new Promise((r) => setTimeout(r, 300));
    ['', '-wal', '-shm'].forEach((s) => fs.rmSync(DB + s, { force: true }));
  }

  console.log('结果：' + pass + ' 通过，' + fail + ' 失败');
  process.exitCode = fail ? 1 : 0;
})();
