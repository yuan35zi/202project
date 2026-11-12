/* ==========================================================================
   导师端页面
   ========================================================================== */
(function () {
  const App = window.App, U = App.U, S = App.Store;
  const V = (App.Views = App.Views || {});

  const labOf = (id) => S.labs().find((l) => l.id === id);

  function tabs(labs, activeId, base) {
    return '<div class="tabs">' + labs.map((l) =>
      '<a class="tab ' + (l.id === activeId ? 'active' : '') + '" href="#' + base + '/' + l.id + '">' +
      U.esc(l.name) + '<span class="tiny muted"> ' + l.quota + ' 名额</span></a>').join('') + '</div>';
  }

  /* ---------- 工作台 ---------- */
  V.teacherHome = function (host) {
    const m = S.me();
    const labs = S.teacherLabs();
    const idx = S.stageIndex();
    const stats = labs.map((l) => S.labStats(l.id));
    const applicants = stats.reduce((s, x) => s + x.applicants, 0);
    const accepted = stats.reduce((s, x) => s + x.accepted, 0);
    const quota = stats.reduce((s, x) => s + x.quota, 0);
    const pendingScore = S.interviews().filter((iv) => labs.some((l) => l.id === iv.labId) && iv.status === 'pending').length;
    const confirmed = stats.reduce((s, x) => s + x.confirmed, 0);

    const todo = [];
    if (pendingScore) todo.push({ t: '还有 ' + pendingScore + ' 名学生未打分', d: '面试结束后请尽快完成评分，评分将决定拟录取排序', href: '#/t/scoring', btn: '去评分', type: 'warn' });
    if (idx === 3) todo.push({ t: '面试窗口进行中', d: '按 ' + U.fmtRange(S.get().cycle.stages[3].start, S.get().cycle.stages[3].end) + ' 完成全部报名学生的面试', href: '#/t/schedule', btn: '看排期', type: 'info' });
    if (idx >= 3 && accepted < quota) todo.push({ t: '名单尚未排满', d: '当前拟录取 ' + accepted + ' 人，名额 ' + quota + ' 人，可在名单页继续添加', href: '#/t/nominations/' + labs[0].id, btn: '去定名单', type: 'info' });
    if (idx === 4) todo.push({ t: '双选确认进行中', d: '学生确认后名额才会最终锁定，请关注确认进度与递补', href: '#/t/progress', btn: '看进度', type: 'ok' });

    host.innerHTML =
      '<div class="page-head"><div><h1>' + U.esc(m.name) + ' 的工作台</h1><p>' + U.esc(m.title) + ' · 负责 ' + labs.length + ' 个实训室 · ' + U.esc(S.get().cycle.name) + '</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><a class="btn btn-primary btn-sm" href="#/t/nominations/' + labs[0].id + '">拟定录取名单</a></div></div>' +

      '<div class="hero">' +
        '<div class="hero-main"><div class="hero-eyebrow">当前环节 · ' + U.esc(S.get().cycle.stages[Math.max(0, Math.min(7, idx))].label) + '</div>' +
          '<h2>' + (idx === 3 ? '面试考核进行中' : idx === 4 ? '双选确认进行中' : idx < 3 ? '报名与筹备阶段' : '补录与调剂阶段') + '</h2>' +
          '<p>共 ' + applicants + ' 名学生填报了你的实训室，已拟录取 ' + accepted + ' / ' + quota + ' 人，已确认 ' + confirmed + ' 人。</p>' +
          '<div class="hero-actions"><a class="btn btn-sm" style="background:#fff;color:#3a2bb5" href="#/t/applicants/' + labs[0].id + '">查看报名名单</a></div></div>' +
        '<div class="hero-timer"><span>距离本环节截止</span><b data-cd="clock">' + U.durClock(S.countdown().ms) + '</b><span>' + U.fmt(S.get().cycle.stages[Math.max(0, Math.min(7, idx))].end) + '</span></div>' +
      '</div>' +

      '<div class="grid grid-4 mt-16">' +
        '<div class="stat"><span class="k">报名学生</span><span class="v">' + applicants + '<small>人</small></span><span class="d">来自 ' + labs.length + ' 个实训室</span></div>' +
        '<div class="stat"><span class="k">待评分</span><span class="v">' + pendingScore + '<small>人</small></span><span class="d">' + (pendingScore ? '建议面试当天完成' : '全部已完成') + '</span></div>' +
        '<div class="stat"><span class="k">拟录取</span><span class="v">' + accepted + '<small>/ ' + quota + '</small></span><span class="d">名额占用 ' + U.pct(accepted, quota) + '%</span></div>' +
        '<div class="stat accent"><span class="k">已确认</span><span class="v">' + confirmed + '<small>人</small></span><span class="d">双选确认后锁定</span></div>' +
      '</div>' +

      '<div class="section">' + App.Comp.flow() + '</div>' +

      '<div class="grid grid-side mt-16">' +
        '<div class="card"><div class="card-head"><h3>待办</h3><span class="badge ' + (todo.length ? 'warn' : 'ok') + '">' + todo.length + ' 项</span></div>' +
          '<div class="card-body" style="display:grid;gap:10px">' +
            (todo.length ? todo.map((t) => '<div class="alert ' + t.type + '" style="align-items:center"><span class="ico">•</span>' +
              '<div style="flex:1"><b>' + U.esc(t.t) + '</b><div class="tiny">' + U.esc(t.d) + '</div></div>' +
              '<a class="btn btn-sm btn-ghost" href="' + t.href + '">' + t.btn + '</a></div>').join('')
              : '<div class="empty" style="border:0;background:#fff"><span class="ico">✓</span><b>暂无待办</b></div>') +
          '</div>' +
          '<div class="card-foot"><a class="btn btn-ghost btn-sm" href="#/t/applicants/' + labs[0].id + '">全部报名名单</a></div>' +
        '</div>' +
        '<div class="card"><div class="card-head"><h3>我的实训室</h3></div><div class="card-body" style="display:grid;gap:14px">' +
          labs.map((l) => {
            const st = S.labStats(l.id);
            return '<div><div class="flex" style="justify-content:space-between"><b class="small">' + U.esc(l.name) + '</b>' +
              '<span class="tiny muted">' + st.taken + '/' + st.quota + '</span></div>' +
              '<div class="meter-row mt-8"><div class="meter ' + (st.remaining === 0 ? 'ok' : 'warn') + '"><i style="width:' + U.pct(st.taken, st.quota) + '%"></i></div></div>' +
              '<div class="tiny muted mt-8">报名 ' + st.applicants + ' · 拟录取 ' + st.accepted + ' · 递补 ' + st.wait + ' · 剩余 ' + st.remaining + '</div></div>';
          }).join('') +
        '</div></div>' +
      '</div>';
  };

  /* ---------- 报名名单 ---------- */
  V.teacherApplicants = function (host, ctx) {
    const labs = S.teacherLabs();
    const labId = (ctx.params[0] && labs.some((l) => l.id === ctx.params[0])) ? ctx.params[0] : labs[0].id;
    const pager = { page: 1, size: 10 };
    let q = '', filter = 'all';

    host.innerHTML =
      '<div class="page-head"><div><h1>报名名单</h1><p>' + U.esc(labOf(labId).name) + ' · 共 ' + S.labStats(labId).applicants + ' 人报名</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><a class="btn btn-ghost btn-sm" href="#/t/schedule/' + labId + '">面试排期</a>' +
      '<a class="btn btn-primary btn-sm" href="#/t/nominations/' + labId + '">拟定名单</a></div></div>' +
      (labs.length > 1 ? tabs(labs, labId, '/t/applicants') : '') +
      '<div class="card mt-12"><div class="card-pad"><div class="flex flex-wrap gap-12">' +
        '<div class="search" style="flex:1;min-width:220px"><span class="ico">⌕</span><input class="input" id="q" placeholder="搜索姓名或学号" /></div>' +
        '<select class="select" id="filter" style="width:auto;min-width:150px">' +
          '<option value="all">全部状态</option><option value="pending">待面试</option><option value="scored">已评分</option>' +
          '<option value="accept">拟录取</option><option value="wait">递补</option><option value="none">未定</option>' +
        '</select>' +
      '</div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>学生</th><th>班级</th><th>面试安排</th><th>总分</th><th>名单状态</th><th class="right">操作</th></tr></thead>' +
        '<tbody id="rows"></tbody></table></div><div id="pagerBox"></div></div>';

    function list() {
      return S.labApplicants(labId).filter((a) => {
        if (q && (a.student.name + a.student.no).indexOf(q) < 0) return false;
        if (filter === 'all') return true;
        if (filter === 'pending') return !a.interview || a.interview.status !== 'done';
        if (filter === 'scored') return a.interview && a.interview.status === 'done';
        if (filter === 'none') return !a.nom;
        return a.nom && a.nom.type === filter;
      });
    }

    function paint() {
      const arr = list();
      host.querySelector('#rows').innerHTML = U.slice(arr, pager).map((a) => {
        const iv = a.interview;
        const ivText = !iv ? '<span class="badge plain">未安排</span>'
          : iv.status === 'done' ? '<span class="badge ok">已完成</span><span class="cell-sub">' + U.fmt(iv.at) + '</span>'
          : '<span class="badge warn">待面试</span><span class="cell-sub">' + U.fmt(iv.at) + ' · ' + U.esc(iv.room) + '</span>';
        return '<tr><td><div class="cell-main">' + U.esc(a.student.name) + '</div><span class="cell-sub num">' + U.esc(a.student.no) + '</span></td>' +
          '<td>' + U.esc(a.student.cls) + '</td>' +
          '<td>' + ivText + '</td>' +
          '<td class="num">' + (iv && iv.status === 'done' ? '<b>' + iv.total + '</b>' : '—') + '</td>' +
          '<td>' + U.labelForNom(a.nom) + '</td>' +
          '<td class="right"><div class="row-actions">' +
            '<a class="btn btn-sm btn-ghost" href="#/t/scoring/' + labId + '/' + a.student.no + '">' + (iv && iv.status === 'done' ? '查看评分' : '评分') + '</a>' +
          '</div></td></tr>';
      }).join('') || '<tr><td colspan="6"><div class="empty" style="border:0"><span class="ico">∅</span><b>没有符合条件的学生</b></div></td></tr>';
      host.querySelector('#pagerBox').innerHTML = arr.length ? U.pager('apps', pager, arr.length) : '';
    }

    U.usePager(host, 'apps', pager, paint);
    host.querySelector('#q').addEventListener('input', (e) => { q = e.target.value.trim(); pager.page = 1; paint(); });
    host.querySelector('#filter').addEventListener('change', (e) => { filter = e.target.value; pager.page = 1; paint(); });
    paint();
  };

  /* ---------- 面试排期 ---------- */
  V.teacherSchedule = function (host, ctx) {
    const labs = S.teacherLabs();
    const labId = (ctx.params[0] && labs.some((l) => l.id === ctx.params[0])) ? ctx.params[0] : labs[0].id;
    const pager = { page: 1, size: 10 };

    host.innerHTML =
      '<div class="page-head"><div><h1>面试排期</h1><p>面试窗口 ' + U.fmtRange(S.get().cycle.stages[3].start, S.get().cycle.stages[3].end) + '，每场 30 分钟，同一学生多个意向不得排在同一时段。</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><button class="btn btn-ghost btn-sm" id="autoBtn">智能排期</button>' +
      '<a class="btn btn-primary btn-sm" href="#/t/applicants/' + labId + '">报名名单</a></div></div>' +
      (labs.length > 1 ? tabs(labs, labId, '/t/schedule') : '') +
      '<div class="alert info mt-12"><span class="ico">i</span><div><b>全量面试：</b>即使报名人数少于名额，所有报名学生也必须参加面试，系统不会自动录取未面试的学生。</div></div>' +
      '<div class="card mt-16"><div class="card-head"><h3>' + U.esc(labOf(labId).name) + '</h3><span class="badge plain">' + U.esc(labOf(labId).room) + '</span></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>时间</th><th>学生</th><th>班级</th><th>地点</th><th>状态</th><th class="right">操作</th></tr></thead><tbody id="rows"></tbody></table></div><div id="pagerBox"></div></div>';

    function rows() {
      return S.interviews().filter((iv) => iv.labId === labId).sort((a, b) => a.at - b.at);
    }

    function conflictSet() {
      const map = {};
      S.interviews().forEach((iv) => {
        const k = iv.no + '|' + iv.at;
        (map[k] = map[k] || []).push(iv);
      });
      const set = new Set();
      Object.keys(map).forEach((k) => { if (map[k].length > 1) map[k].forEach((iv) => set.add(iv.id)); });
      return set;
    }

    function paint() {
      const all = rows();
      const conflicts = conflictSet();
      host.querySelector('#rows').innerHTML = U.slice(all, pager).map((iv) => {
        const stu = S.studentByNo(iv.no);
        const bad = conflicts.has(iv.id);
        return '<tr class="' + (bad ? 'is-muted' : '') + '"><td class="num">' + U.fmt(iv.at) + (bad ? ' <span class="badge danger">冲突</span>' : '') + '</td>' +
          '<td><div class="cell-main">' + U.esc(stu.name) + '</div><span class="cell-sub num">' + U.esc(stu.no) + '</span></td>' +
          '<td>' + U.esc(stu.cls) + '</td><td>' + U.esc(iv.room) + '</td>' +
          '<td>' + (iv.status === 'done' ? '<span class="badge ok">已完成</span>' : '<span class="badge warn">待面试</span>') + '</td>' +
          '<td class="right"><a class="btn btn-sm btn-ghost" href="#/t/scoring/' + labId + '/' + iv.no + '">查看</a></td></tr>';
      }).join('') || '<tr><td colspan="6"><div class="empty" style="border:0"><b>暂无面试安排</b></div></td></tr>';
      host.querySelector('#pagerBox').innerHTML = all.length ? U.pager('sch', pager, all.length) : '';
    }

    U.usePager(host, 'sch', pager, paint);

    host.querySelector('#autoBtn').addEventListener('click', async () => {
      const ok = await U.confirm({
        title: '智能排期',
        body: '<p>将把本室 ' + rows().length + ' 名学生的面试按 <b>30 分钟</b> 依次排入面试窗口，并自动避开同一学生在其他实训室的冲突时段。</p><p class="tiny muted mt-8">当前演示版会重置本室全部面试时间，如需保留请先取消。</p>',
        confirmText: '开始排期'
      });
      if (!ok) return;
      const before = rows().length;
      const r = await S.arrangeInterviews(labId);
      if (r.error) { U.toast('排期失败', r.error, 'danger'); return; }
      U.toast('排期完成', '已安排 ' + before + ' 场面试', 'ok');
      paint();
    });

    paint();
  };

  /* ---------- 评分 ---------- */
  V.teacherScoring = function (host, ctx) {
    const labId = ctx.params[0];
    const no = ctx.params[1];
    const lab = labOf(labId);
    const iv = S.interviews().find((x) => x.labId === labId && x.no === no);
    const stu = S.studentByNo(no);

    if (!lab || !iv) {
      host.innerHTML = '<div class="empty"><b>面试记录不存在</b><a class="btn btn-ghost btn-sm" href="#/t/applicants">返回名单</a></div>';
      return;
    }

    const items = [
      { k: 'attitude', n: '学习态度', w: 25, d: '投入意愿、出勤与主动性' },
      { k: 'logic', n: '逻辑思维', w: 30, d: '问题拆解、表达条理' },
      { k: 'coding', n: '编程基础', w: 25, d: '语法、调试、工程习惯' },
      { k: 'comm', n: '沟通表达', w: 20, d: '协作意愿、倾听与表达' }
    ];
    const locked = iv.locked;
    const s = iv.scores || { attitude: 80, logic: 80, coding: 80, comm: 80 };

    host.innerHTML =
      '<div class="page-head"><div><p class="tiny"><a href="#/t/applicants/' + labId + '">← 返回报名名单</a></p>' +
        '<h1>面试评分</h1><p>' + U.esc(stu.name) + ' · ' + U.esc(stu.no) + ' · ' + U.esc(stu.cls) + ' · ' + U.esc(lab.name) + '</p></div>' +
        '<div class="spacer"></div><div class="page-actions">' + (locked ? '<span class="badge ok">已提交并锁定</span>' : '<span class="badge warn">待提交</span>') + '</div></div>' +
      '<div class="grid grid-side">' +
        '<div class="card"><div class="card-head"><h3>四维评分（百分制）</h3><span class="tiny muted">权重合计 100%</span></div>' +
          '<div class="card-body" style="display:grid;gap:18px">' +
            items.map((it) => '<div class="score-row" data-key="' + it.k + '">' +
              '<div class="flex" style="justify-content:space-between"><div><b class="small">' + it.n + '</b> <span class="badge plain tiny">' + it.w + '%</span>' +
              '<div class="tiny muted">' + it.d + '</div></div>' +
              '<b class="mono" data-out style="font-size:18px">' + s[it.k] + '</b></div>' +
              '<input type="range" min="0" max="100" step="1" value="' + s[it.k] + '" ' + (locked ? 'disabled' : '') + ' data-range />' +
              '</div>').join('') +
            '<div class="field"><label for="comment">评语（选填）</label>' +
              '<textarea class="textarea" id="comment" ' + (locked ? 'disabled' : '') + ' placeholder="例如：基础扎实，项目经历完整，表达清晰；建议加强算法训练。">' + U.esc(iv.comment || '') + '</textarea></div>' +
          '</div>' +
          (locked
            ? '<div class="card-foot"><span class="small muted">评分人：' + U.esc(iv.scorer || '—') + ' · 提交后不可自行修改</span></div>'
            : '<div class="card-foot"><button class="btn btn-primary" id="submitScore">提交评分</button>' +
              '<button class="btn btn-ghost" id="resetScore">重置为 80</button></div>') +
        '</div>' +
        '<div style="position:sticky;top:88px">' +
          '<div class="card card-pad center"><span class="small muted">加权总分</span>' +
            '<div class="mono" id="total" style="font-size:44px;font-weight:700;line-height:1.2">' + (locked ? iv.total : Math.round(s.attitude * .25 + s.logic * .3 + s.coding * .25 + s.comm * .2)) + '</div>' +
            '<span class="tiny muted">面试成绩仅用于录取排序，不对外公布</span>' +
            '<div class="meter mt-16"><i id="totalBar" style="width:' + (iv.total || 80) + '%"></i></div>' +
          '</div>' +
          '<div class="alert warn mt-16"><span class="ico">!</span><div><b>评分口径：</b>所有报名学生均须面试。未面试学生不进入拟录取名单；评分提交后锁定，如需修改须联系学院管理员解锁。</div></div>' +
          '<div class="card mt-16"><div class="card-head"><h3>学生资料</h3></div><div class="card-body"><dl class="kv">' +
            '<dt>学号</dt><dd>' + U.esc(stu.no) + '</dd><dt>班级</dt><dd>' + U.esc(stu.cls) + '</dd>' +
            '<dt>面试时间</dt><dd>' + U.fmt(iv.at) + '</dd><dt>地点</dt><dd>' + U.esc(iv.room) + '</dd>' +
            '</dl></div></div>' +
        '</div>' +
      '</div>';

    function calc() {
      const vals = {};
      host.querySelectorAll('.score-row').forEach((row) => {
        vals[row.getAttribute('data-key')] = +row.querySelector('[data-range]').value;
      });
      const total = Math.round(vals.attitude * .25 + vals.logic * .3 + vals.coding * .25 + vals.comm * .2);
      host.querySelector('#total').textContent = total;
      host.querySelector('#totalBar').style.width = total + '%';
      return vals;
    }

    host.querySelectorAll('.score-row').forEach((row) => {
      const range = row.querySelector('[data-range]');
      const out = row.querySelector('[data-out]');
      range.addEventListener('input', () => { out.textContent = range.value; calc(); });
    });

    if (!locked) {
      host.querySelector('#resetScore').addEventListener('click', () => {
        host.querySelectorAll('.score-row').forEach((row) => {
          row.querySelector('[data-range]').value = 80;
          row.querySelector('[data-out]').textContent = 80;
        });
        calc();
      });
      host.querySelector('#submitScore').addEventListener('click', async () => {
        const vals = calc();
        const ok = await U.confirm({
          title: '提交评分',
          body: '<p>提交后评分将<b>锁定</b>，用于生成拟录取与递补顺序。</p>' +
            '<dl class="kv mt-8">' + items.map((it) => '<dt>' + it.n + '</dt><dd>' + vals[it.k] + ' 分</dd>').join('') +
            '<dt>加权总分</dt><dd><b>' + host.querySelector('#total').textContent + '</b></dd></dl>',
          confirmText: '确认提交'
        });
        if (!ok) return;
        const r = await S.setScores(iv.id, vals, host.querySelector('#comment').value.trim());
        if (r.error) { U.toast('提交失败', r.error, 'danger'); return; }
        U.toast('评分已提交', '总分 ' + r.total + ' 分', 'ok');
        App.go('/t/applicants/' + labId);
      });
    }
  };

  /* ---------- 拟定名单 ---------- */
  V.teacherNominations = function (host, ctx) {
    const labs = S.teacherLabs();
    const labId = (ctx.params[0] && labs.some((l) => l.id === ctx.params[0])) ? ctx.params[0] : labs[0].id;
    let pendingPick = null;

    host.innerHTML =
      '<div class="page-head"><div><h1>拟定录取名单</h1><p>按面试总分排序，分别维护<b>拟录取</b>、<b>递补</b>与<b>内部调剂候选</b>三张有序名单。</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><a class="btn btn-ghost btn-sm" href="#/t/progress/' + labId + '">确认进度</a></div></div>' +
      (labs.length > 1 ? tabs(labs, labId, '/t/nominations') : '') +
      '<div id="board"></div>';

    function paint() {
      const lab = labOf(labId);
      const stats = S.labStats(labId);
      const acc = S.accepted(labId);
      const waits = S.waitlist(labId);
      const ints = S.internalList(labId);
      const full = stats.taken >= stats.quota;
      const applicants = S.labApplicants(labId);

      const col = (title, type, list, badge, disabled) => {
        return '<div class="kcol"><div class="kcol-head"><h4>' + title + '</h4><span class="badge ' + badge + '">' + list.length + '</span>' +
          '<span class="cnt">' + (type === 'accept' ? (stats.quota - stats.taken) + ' 个空位' : '') + '</span></div>' +
          '<div class="kcol-body" data-col="' + type + '">' +
            (list.length ? list.map((n, i) => {
              const stu = S.studentByNo(n.no);
              const iv = S.interviews().find((x) => x.no === n.no && x.labId === labId);
              return '<div class="kitem"><span class="rk">' + (i + 1) + '</span>' +
                '<div style="min-width:0"><div class="kname">' + U.esc(stu.name) + '</div>' +
                '<div class="tiny muted">' + U.esc(stu.cls) + '</div></div>' +
                '<span class="kscore">' + (iv && iv.status === 'done' ? iv.total : '—') + '</span>' +
                '<div class="kops">' +
                  '<button data-move="' + n.id + ':-1" ' + (i === 0 ? 'disabled' : '') + ' aria-label="上移">↑</button>' +
                  '<button data-move="' + n.id + ':1" ' + (i === list.length - 1 ? 'disabled' : '') + ' aria-label="下移">↓</button>' +
                  '<button data-remove="' + n.id + '" aria-label="移除">✕</button>' +
                '</div></div>';
            }).join('') : '<p class="tiny muted center" style="padding:12px 0">暂无</p>') +
          '</div>' +
          '<div class="kcol-head" style="border-top:1px solid var(--line);border-bottom:0">' +
            '<button class="btn btn-sm btn-ghost btn-block" data-add="' + type + '" ' + (disabled ? 'disabled' : '') + '>＋ 添加学生</button>' +
          '</div></div>';
      };

      host.querySelector('#board').innerHTML =
        '<div class="card card-pad mt-12">' +
          '<div class="flex flex-wrap gap-16">' +
            '<div style="flex:1;min-width:220px"><div class="flex" style="justify-content:space-between"><b>' + U.esc(lab.name) + '</b>' +
              '<span class="small ' + (full ? '' : 'muted') + '">' + (full ? '名额已满' : '剩余 ' + (stats.quota - stats.taken) + ' 个名额') + '</span></div>' +
              '<div class="meter-row mt-8"><div class="meter ' + (full ? 'ok' : 'warn') + '"><i style="width:' + U.pct(stats.taken, stats.quota) + '%"></i></div>' +
              '<span class="val">' + stats.taken + '/' + stats.quota + '</span></div></div>' +
            '<div class="flex gap-12">' +
              '<div class="stat" style="padding:8px 14px"><span class="k">报名</span><span class="v" style="font-size:18px">' + stats.applicants + '</span></div>' +
              '<div class="stat" style="padding:8px 14px"><span class="k">待评分</span><span class="v" style="font-size:18px">' + applicants.filter((a) => !a.interview || a.interview.status !== 'done').length + '</span></div>' +
              '<div class="stat" style="padding:8px 14px"><span class="k">已确认</span><span class="v" style="font-size:18px">' + stats.confirmed + '</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="alert info mt-16"><span class="ico">i</span><div>拟录取名额受硬约束（含已确认人数），超出时无法继续添加；递补与内部调剂按顺序自动补位。可复用上一轮面试成绩，无需重复面试。</div></div>' +
        '<div class="kanban mt-16">' +
          col('拟录取', 'accept', acc, 'ok', full) +
          col('递补（按顺序补位）', 'wait', waits, 'warn', false) +
          col('内部调剂候选', 'internal', ints, 'info', false) +
        '</div>';

      host.querySelectorAll('[data-move]').forEach((b) => {
        b.addEventListener('click', async () => {
          const [id, dir] = b.getAttribute('data-move').split(':');
          const r = await S.moveNomination(id, +dir);
          if (r.error) { U.toast('操作失败', r.error, 'danger'); return; }
          paint();
        });
      });
      host.querySelectorAll('[data-remove]').forEach((b) => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-remove');
          const ok = await U.confirm({ title: '移出名单？', desc: '移出后名额将释放，可能被递补学生占用', confirmText: '移出', danger: true });
          if (!ok) return;
          const r = await S.removeNomination(id);
          if (r.error) { U.toast('操作失败', r.error, 'danger'); return; }
          U.toast('已移出', '', 'ok');
          paint();
        });
      });
      host.querySelectorAll('[data-add]').forEach((b) => {
        b.addEventListener('click', () => openPicker(b.getAttribute('data-add')));
      });
    }

    function openPicker(type) {
      const lab = labOf(labId);
      const all = S.labApplicants(labId).filter((a) => !a.nom);
      const pager = { page: 1, size: 6 };
      let q = '';
      let chosen = null;
      const title = type === 'accept' ? '添加拟录取' : type === 'wait' ? '添加递补' : '添加内部调剂候选';
      const mask = U.dialog({
        title,
        desc: lab.name + ' · 仅显示尚未进入任何名单的学生（共 ' + all.length + ' 人）',
        wide: true,
        body: '<div class="search" style="margin-bottom:12px"><span class="ico">⌕</span><input class="input" id="pq" placeholder="搜索姓名或学号" /></div>' +
          '<div id="plist"></div><div id="ppager"></div>',
        confirmText: '加入名单',
        onConfirm: async () => {
          if (!chosen) { U.toast('还未选择学生', '请先点击一名学生', 'warn'); return false; }
          const r = await S.addNomination(labId, chosen, type);
          if (r.error) { U.toast('添加失败', r.error, 'danger'); return false; }
          U.toast('已加入', '', 'ok');
          paint();
          return true;
        }
      });

      function list() {
        return all.filter((a) => !q || (a.student.name + a.student.no + a.student.cls).indexOf(q) >= 0);
      }
      function render() {
        const arr = list();
        mask.querySelector('#plist').innerHTML = U.slice(arr, pager).map((a) => {
          const iv = a.interview;
          return '<div class="pick-row" data-pick="' + a.student.no + '">' +
            '<div><b class="small">' + U.esc(a.student.name) + '</b> <span class="tiny muted">' + U.esc(a.student.no) + ' · ' + U.esc(a.student.cls) + '</span>' +
            '<div class="tiny muted">面试：' + (iv && iv.status === 'done' ? iv.total + ' 分（已评分）' : '未评分') + ' · 调剂：' + (a.app.internal ? '服从内部' : '不服从内部') + ' / ' + (a.app.cross ? '服从跨室' : '不服从跨室') + '</div></div>' +
            '<span class="badge plain">选择</span></div>';
        }).join('') || '<div class="empty" style="border:0"><b>没有可添加的学生</b><p>所有报名学生都已进入名单。</p></div>';
        mask.querySelector('#ppager').innerHTML = arr.length ? U.pager('pick', pager, arr.length, [6, 12]) : '';
        mask.querySelectorAll('[data-pick]').forEach((row) => {
          if (chosen === row.getAttribute('data-pick')) row.classList.add('selected');
          row.addEventListener('click', () => {
            chosen = row.getAttribute('data-pick');
            mask.querySelectorAll('[data-pick]').forEach((r) => r.classList.toggle('selected', r === row));
          });
        });
      }
      U.usePager(mask, 'pick', pager, render);
      mask.querySelector('#pq').addEventListener('input', (e) => { q = e.target.value.trim(); pager.page = 1; render(); });
      render();
    }

    paint();
  };

  /* ---------- 确认进度 ---------- */
  V.teacherProgress = function (host, ctx) {
    const labs = S.teacherLabs();
    const labId = (ctx.params[0] && labs.some((l) => l.id === ctx.params[0])) ? ctx.params[0] : labs[0].id;
    const pager = { page: 1, size: 10 };
    const stats = S.labStats(labId);
    const st = S.get();

    const rows = S.accepted(labId).map((n) => {
      const c = st.confirmations[n.no];
      return {
        no: n.no,
        name: S.studentByNo(n.no).name,
        cls: S.studentByNo(n.no).cls,
        rank: n.rank,
        status: c ? (c.labId === labId ? 'confirmed' : 'other') : 'pending',
        source: c ? c.source : '',
        at: c ? c.at : null
      };
    }).sort((a, b) => a.rank - b.rank);

    const confirmed = rows.filter((r) => r.status === 'confirmed').length;

    host.innerHTML =
      '<div class="page-head"><div><h1>双选确认进度</h1><p>' + U.esc(labOf(labId).name) + ' · 确认窗口 ' + U.fmtRange(S.get().cycle.stages[4].start, S.get().cycle.stages[4].end) + '</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><a class="btn btn-primary btn-sm" href="#/t/nominations/' + labId + '">调整名单</a></div></div>' +
      (labs.length > 1 ? tabs(labs, labId, '/t/progress') : '') +
      '<div class="grid grid-4 mt-12">' +
        '<div class="stat"><span class="k">已发意向</span><span class="v">' + stats.accepted + '</span></div>' +
        '<div class="stat"><span class="k">已确认</span><span class="v">' + confirmed + '</span></div>' +
        '<div class="stat"><span class="k">待确认</span><span class="v">' + (stats.accepted - confirmed) + '</span></div>' +
        '<div class="stat accent"><span class="k">剩余名额</span><span class="v">' + stats.remaining + '</span></div>' +
      '</div>' +
      '<div class="card mt-16"><div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>顺位</th><th>学生</th><th>班级</th><th>状态</th><th>确认方式</th><th>确认时间</th></tr></thead><tbody id="rows"></tbody></table></div><div id="pagerBox"></div></div>' +
      '<div class="alert warn mt-16"><span class="ico">!</span><div>逾期未确认者将视为放弃，系统自动按递补顺位补位并释放名额。补位学生的确认时限顺延至本轮确认窗口结束。</div></div>';

    function paint() {
      host.querySelector('#rows').innerHTML = U.slice(rows, pager).map((r) => {
        const badge = r.status === 'confirmed'
          ? '<span class="badge ok">已确认</span>'
          : r.status === 'other' ? '<span class="badge info">已确认其他实训室</span>' : '<span class="badge warn">待确认</span>';
        return '<tr><td class="num">#' + r.rank + '</td>' +
          '<td><div class="cell-main">' + U.esc(r.name) + '</div><span class="cell-sub num">' + U.esc(r.no) + '</span></td>' +
          '<td>' + U.esc(r.cls) + '</td><td>' + badge + '</td>' +
          '<td>' + (r.source ? U.sourceLabel(r.source) : '—') + '</td>' +
          '<td class="num">' + (r.at ? U.fmt(r.at) : '—') + '</td></tr>';
      }).join('') || '<tr><td colspan="6"><div class="empty" style="border:0"><b>本室暂无拟录取学生</b></div></td></tr>';
      host.querySelector('#pagerBox').innerHTML = rows.length ? U.pager('prog', pager, rows.length) : '';
    }
    U.usePager(host, 'prog', pager, paint);
    paint();
  };
})();
