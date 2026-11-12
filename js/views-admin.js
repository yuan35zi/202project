/* ==========================================================================
   学院管理端页面
   ========================================================================== */
(function () {
  const App = window.App, U = App.U, S = App.Store;
  const V = (App.Views = App.Views || {});
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const labOf = (id) => S.labs().find((l) => l.id === id);

  function toInput(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ---------- 总览 ---------- */
  V.adminHome = function (host) {
    const d = S.dashboard();
    const st = S.get();
    const cs = S.confirmStats();
    const idx = S.stageIndex();
    const appliedPct = U.pct(d.applied, d.students);

    host.innerHTML =
      '<div class="page-head"><div><h1>选拔工作总览</h1><p>' + U.esc(st.cycle.name) + ' · 当前环节：' + U.esc(st.cycle.stages[Math.max(0, Math.min(7, idx))].label) + '</p></div>' +
      '<div class="spacer"></div><div class="page-actions">' +
        '<button class="btn btn-ghost btn-sm" id="settleBtn">结算当前阶段</button>' +
        '<a class="btn btn-primary btn-sm" href="#/a/board">录取看板</a></div></div>' +

      '<div class="hero">' +
        '<div class="hero-main"><div class="hero-eyebrow">2026 秋季 · 双向选择 / 分轮录取 / 统筹调剂</div>' +
          '<h2>' + U.esc(st.cycle.stages[Math.max(0, Math.min(7, idx))].label) + '</h2>' +
          '<p>' + d.applied + ' / ' + d.students + ' 名学生已填报，面试完成 ' + d.ivDone + ' / ' + d.interviews + ' 场，' +
          '名额占用 ' + d.taken + ' / ' + d.quota + '，已确认 ' + d.confirmed + ' 人。</p>' +
          '<div class="hero-actions"><a class="btn btn-sm" style="background:#fff;color:#3a2bb5" href="#/a/board">查看实时进度</a>' +
          '<a class="btn btn-sm" style="background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.24)" href="#/a/cycle">调整日程</a></div></div>' +
        '<div class="hero-timer"><span>距离本环节截止</span><b data-cd="clock">' + U.durClock(S.countdown().ms) + '</b>' +
        '<span>' + U.fmt(st.cycle.stages[Math.max(0, Math.min(7, idx))].end) + '</span></div>' +
      '</div>' +

      '<div class="grid grid-4 mt-16">' +
        '<div class="stat"><span class="k">意向填报</span><span class="v">' + d.applied + '<small>/ ' + d.students + '</small></span>' +
          '<div class="meter mt-8"><i style="width:' + appliedPct + '%"></i></div><span class="d">未填报 ' + d.notApplied + ' 人</span></div>' +
        '<div class="stat"><span class="k">面试完成率</span><span class="v">' + U.pct(d.ivDone, d.interviews) + '<small>%</small></span>' +
          '<div class="meter mt-8"><i style="width:' + U.pct(d.ivDone, d.interviews) + '%"></i></div><span class="d">待面试 ' + d.ivPending + ' 场</span></div>' +
        '<div class="stat"><span class="k">名额占用</span><span class="v">' + d.taken + '<small>/ ' + d.quota + '</small></span>' +
          '<div class="meter mt-8"><i style="width:' + U.pct(d.taken, d.quota) + '%"></i></div><span class="d">剩余 ' + d.remaining + ' 个名额</span></div>' +
        '<div class="stat accent"><span class="k">双选确认</span><span class="v">' + cs.confirmed + '<small>人</small></span><span class="d">待确认 ' + cs.pending + ' · 逾期 ' + cs.expired + '</span></div>' +
      '</div>' +

      '<div class="section">' + App.Comp.flow() + '</div>' +

      '<div class="grid grid-side mt-16">' +
        '<div class="card"><div class="card-head"><h3>名额与录取情况</h3><span class="spacer"></span><a class="btn btn-ghost btn-sm" href="#/a/labs">全部实训室</a></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>实训室</th><th>名额</th><th>报名</th><th>拟录取</th><th>已确认</th><th>占用</th></tr></thead><tbody>' +
          d.labs.slice(0, 6).map((x) => '<tr><td><div class="cell-main">' + U.esc(x.lab.name) + '</div><span class="cell-sub">' + U.esc(x.lab.teacher.name) + '</span></td>' +
            '<td class="num">' + x.quota + '</td><td class="num">' + x.applicants + '</td><td class="num">' + x.accepted + '</td>' +
            '<td class="num">' + x.confirmed + '</td>' +
            '<td><div class="meter-row mini-meter"><div class="meter ' + (x.remaining === 0 ? 'ok' : 'warn') + '"><i style="width:' + U.pct(x.taken, x.quota) + '%"></i></div>' +
            '<span class="val">' + x.taken + '/' + x.quota + '</span></div></td></tr>').join('') +
        '</tbody></table></div></div>' +
        '<div class="card"><div class="card-head"><h3>需要关注</h3></div><div class="card-body" style="display:grid;gap:10px">' +
          (d.notApplied ? '<div class="alert warn"><span class="ico">!</span><div><b>' + d.notApplied + ' 名学生未填报</b>，可在学生名单中查看并催办。</div></div>' : '') +
          (d.ivPending ? '<div class="alert info"><span class="ico">i</span><div><b>' + d.ivPending + ' 场面试未完成</b>，建议在面试窗口内完成全部评分。</div></div>' : '') +
          (cs.expired ? '<div class="alert danger"><span class="ico">!</span><div><b>' + cs.expired + ' 条意向逾期释放</b>，已按递补顺位自动补位。</div></div>' : '') +
          '<div class="alert brand"><span class="ico">✦</span><div>调剂优先级：<b>① 内部调剂 → ② 跨室调剂 → ③ 学院统筹</b>，前一级处理完才进入下一级。</div></div>' +
          (d.published ? '<div class="alert ok"><span class="ico">✓</span><div>公示已发布，截止 ' + U.fmt(st.publicity.until) + '。</div></div>' : '') +
        '</div><div class="card-foot"><a class="btn btn-ghost btn-sm btn-block" href="#/a/allocate">进入调剂池</a></div></div>' +
      '</div>';

    host.querySelector('#settleBtn').addEventListener('click', async () => {
      const r = await S.settle();
      if (r.error) { U.toast('结算失败', r.error, 'danger'); return; }
      U.toast('已结算', '自动确认、逾期释放与递补已按规则执行', 'ok');
      App.render();
    });
  };

  /* ---------- 日程配置 ---------- */
  V.adminCycle = function (host) {
    const st = S.get();
    host.innerHTML =
      '<div class="page-head"><div><h1>批次与日程</h1><p>共 8 个环节，时间到达时系统自动开关窗口。修改后立即生效（演示环境已内置时间跳转）。</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><button class="btn btn-primary btn-sm" id="saveBtn">保存日程</button></div></div>' +
      '<div class="card"><div class="card-pad"><div class="flex flex-wrap gap-12">' +
        '<div class="field" style="flex:1;min-width:260px"><label for="cname">批次名称</label>' +
          '<input class="input" id="cname" value="' + U.esc(st.cycle.name) + '" /></div>' +
        '<div class="field" style="width:150px"><label>学年</label><input class="input" id="cyear" value="' + st.cycle.year + '" /></div>' +
        '<div class="field" style="width:200px"><label>时区</label><input class="input" value="Asia/Shanghai" disabled /></div>' +
      '</div></div></div>' +
      '<div class="card mt-16"><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>环节</th><th>开始时间</th><th>结束时间</th><th>状态</th></tr></thead><tbody>' +
        st.cycle.stages.map((s, i) => {
          const status = S.stageStatus(i);
          return '<tr data-stage="' + i + '"><td><span class="badge plain no-dot" style="font-family:var(--mono)">' + (i + 1) + '</span></td>' +
            '<td><div class="cell-main">' + U.esc(s.label) + '</div><span class="cell-sub">' + U.esc(s.key) + '</span></td>' +
            '<td><input class="input sm" type="datetime-local" data-start value="' + toInput(s.start) + '" style="max-width:200px" /></td>' +
            '<td><input class="input sm" type="datetime-local" data-end value="' + toInput(s.end) + '" style="max-width:200px" /></td>' +
            '<td>' + (status === 'active' ? '<span class="badge ok">进行中</span>' : status === 'done' ? '<span class="badge plain">已结束</span>' : '<span class="badge info">未开始</span>') + '</td></tr>';
        }).join('') +
      '</tbody></table></div></div>' +
      '<div class="card mt-16"><div class="card-head"><h3>演示：跳到指定环节</h3><span class="tiny muted">切换后时间轴会围绕当前时刻重排，用于查看各环节界面</span></div>' +
      '<div class="card-body"><div class="flex flex-wrap gap-8">' +
        st.cycle.stages.map((s, i) => '<button class="btn btn-ghost btn-sm" data-jump="' + i + '">' + (i + 1) + '. ' + U.esc(s.short) + '</button>').join('') +
      '</div></div></div>' +
      '<div class="alert info mt-16"><span class="ico">i</span><div>正式环境建议按流程图固定日期；本演示批次为了便于查看，默认以「意向填报」开放状态启动，可在右上角随时切换。</div></div>';

    host.querySelector('#saveBtn').addEventListener('click', async () => {
      const name = host.querySelector('#cname').value.trim();
      const year = parseInt(host.querySelector('#cyear').value, 10) || st.cycle.year;
      const rows = Array.from(host.querySelectorAll('[data-stage]'));
      const next = st.cycle.stages.map((s, i) => {
        const row = rows[i];
        return {
          idx: s.idx,
          start: new Date(row.querySelector('[data-start]').value).getTime(),
          end: new Date(row.querySelector('[data-end]').value).getTime()
        };
      });
      for (let i = 0; i < next.length; i++) {
        if (!(next[i].end > next[i].start)) { U.toast('时间不合法', '第 ' + (i + 1) + ' 个环节结束时间需晚于开始时间', 'danger'); return; }
        if (i > 0 && next[i].start < next[i - 1].end) { U.toast('时间重叠', '第 ' + (i + 1) + ' 个环节需在上一个环节结束后开始', 'danger'); return; }
      }
      const r = await S.updateCycle({ name, year, stages: next });
      if (r.error) { U.toast('保存失败', r.error, 'danger'); return; }
      U.toast('已保存', '日程已更新', 'ok');
      App.render();
    });

    host.querySelectorAll('[data-jump]').forEach((b) => {
      b.addEventListener('click', async () => {
        const i = +b.getAttribute('data-jump');
        const r = await S.jumpToStage(i);
        if (r.error) { U.toast('切换失败', r.error, 'danger'); return; }
        U.toast('已切换', '当前为「' + S.get().cycle.stages[i].label + '」', 'ok');
        App.render();
      });
    });
  };

  /* ---------- 实训室与名额 ---------- */
  V.adminLabs = function (host) {
    const pager = { page: 1, size: 8 };
    let q = '';

    host.innerHTML =
      '<div class="page-head"><div><h1>实训室与名额</h1><p>共 ' + S.labs().length + ' 个实训室，合计 ' + S.dashboard().quota + ' 个名额。名额调整不得超过已占用人数。</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><button class="btn btn-ghost btn-sm" id="exportBtn">导出名额表</button></div></div>' +
      '<div class="card"><div class="card-pad"><div class="search" style="max-width:360px"><span class="ico">⌕</span><input class="input" id="q" placeholder="搜索实训室或导师" /></div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>实训室</th><th>导师</th><th>名额</th><th>报名</th><th>拟录取</th><th>已确认</th><th>占用情况</th><th class="right">操作</th></tr></thead><tbody id="rows"></tbody></table></div>' +
      '<div id="pagerBox"></div></div>';

    function list() {
      return S.labs().filter((l) => !q || (l.name + l.direction + l.teacher.name).indexOf(q) >= 0);
    }

    function paint() {
      const arr = list();
      host.querySelector('#rows').innerHTML = U.slice(arr, pager).map((l) => {
        const x = S.labStats(l.id);
        return '<tr><td><div class="cell-main">' + U.esc(l.name) + '</div><span class="cell-sub">' + U.esc(l.direction) + '</span></td>' +
          '<td>' + U.esc(l.teacher.name) + '</td>' +
          '<td class="num">' + l.quota + '</td><td class="num">' + x.applicants + '</td><td class="num">' + x.accepted + '</td><td class="num">' + x.confirmed + '</td>' +
          '<td><div class="meter-row mini-meter"><div class="meter ' + (x.remaining === 0 ? 'ok' : x.taken > x.quota * 0.8 ? 'warn' : '') + '"><i style="width:' + U.pct(x.taken, x.quota) + '%"></i></div>' +
          '<span class="val">' + x.taken + '/' + x.quota + '</span></div></td>' +
          '<td class="right"><button class="btn-link" data-quota="' + l.id + '">调整名额</button></td></tr>';
      }).join('') || '<tr><td colspan="8"><div class="empty" style="border:0"><b>没有匹配的实训室</b></div></td></tr>';
      host.querySelector('#pagerBox').innerHTML = arr.length ? U.pager('labs', pager, arr.length) : '';
    }

    U.usePager(host, 'labs', pager, paint);
    host.querySelector('#q').addEventListener('input', (e) => { q = e.target.value.trim(); pager.page = 1; paint(); });
    host.querySelector('#exportBtn').addEventListener('click', () => App.Api.download('/api/export/labs').catch((e) => U.toast('导出失败', e.message, 'danger')));

    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-quota]');
      if (!b) return;
      const lab = labOf(b.getAttribute('data-quota'));
      const x = S.labStats(lab.id);
      U.dialog({
        title: '调整名额 · ' + lab.name,
        desc: '当前已占用 ' + x.taken + ' 个，名额不得低于该数值',
        body: '<div class="field"><label for="q">招录名额</label><input class="input" id="q" type="number" min="' + x.taken + '" value="' + lab.quota + '" /></div>' +
          '<div class="alert info mt-12"><span class="ico">i</span><div>调整后立即影响拟录取上限、补录与调剂池的空位计算。</div></div>',
        confirmText: '保存',
        onConfirm: async (mask) => {
          const v = parseInt(mask.querySelector('#q').value, 10);
          if (!Number.isFinite(v) || v < x.taken) { U.toast('名额不合法', '不能低于当前已占用人数 ' + x.taken, 'danger'); return false; }
          const r = await S.updateLabQuota(lab.id, v);
          if (r.error) { U.toast('保存失败', r.error, 'danger'); return false; }
          U.toast('已保存', '新名额 ' + v + ' 个', 'ok');
          paint();
          return true;
        }
      });
    });

    paint();
  };

  /* ---------- 学生名单 ---------- */
  V.adminStudents = function (host) {
    const pager = { page: 1, size: 10 };
    let q = '', cls = 'all';
    const classes = Array.from(new Set(S.students().map((s) => s.cls)));

    host.innerHTML =
      '<div class="page-head"><div><h1>学生名单</h1><p>共 ' + S.students().length + ' 名学生，已填报 ' + S.dashboard().applied + ' 人。</p></div>' +
      '<div class="spacer"></div><div class="page-actions">' +
        '<button class="btn btn-ghost btn-sm" id="importBtn">从 Excel 导入</button>' +
        '<button class="btn btn-primary btn-sm" id="exportBtn">导出名单</button></div></div>' +
      '<div class="card"><div class="card-pad"><div class="flex flex-wrap gap-12">' +
        '<div class="search" style="flex:1;min-width:220px"><span class="ico">⌕</span><input class="input" id="q" placeholder="搜索姓名或学号" /></div>' +
        '<select class="select" id="cls" style="width:auto;min-width:160px"><option value="all">全部班级</option>' +
          classes.map((c) => '<option value="' + U.esc(c) + '">' + U.esc(c) + '</option>').join('') + '</select>' +
      '</div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>姓名</th><th>学号</th><th>班级</th><th>联系方式</th><th>意向数</th><th>当前状态</th><th class="right">操作</th></tr></thead><tbody id="rows"></tbody></table></div>' +
      '<div id="pagerBox"></div></div>';

    function statusOf(no) {
      const c = S.get().confirmations[no];
      if (c) return { t: '已录取', cls: 'ok' };
      const offers = S.nominations().filter((n) => n.no === no && n.type === 'accept' && !n.status);
      if (offers.length) return { t: '待确认 ' + offers.length + ' 个', cls: 'warn' };
      const app = S.get().applications[no];
      if (!app) return { t: '未填报', cls: 'plain' };
      const expired = S.nominations().some((n) => n.no === no && n.status === 'expired');
      if (expired) return { t: '逾期放弃', cls: 'danger' };
      return { t: '待面试/待定', cls: 'info' };
    }

    function list() {
      return S.students().filter((s) => {
        if (cls !== 'all' && s.cls !== cls) return false;
        if (q && (s.name + s.no).indexOf(q) < 0) return false;
        return true;
      });
    }

    function paint() {
      const arr = list();
      host.querySelector('#rows').innerHTML = U.slice(arr, pager).map((s) => {
        const app = S.get().applications[s.no];
        const st = statusOf(s.no);
        return '<tr><td><div class="cell-main">' + U.esc(s.name) + '</div></td>' +
          '<td class="num">' + U.esc(s.no) + '</td><td>' + U.esc(s.cls) + '</td>' +
          '<td class="tiny">' + U.esc(s.phone || '—') + '<span class="cell-sub">' + U.esc(s.email || '') + '</span></td>' +
          '<td class="num">' + (app ? app.labs.length : 0) + '</td>' +
          '<td><span class="badge ' + st.cls + '">' + st.t + '</span></td>' +
          '<td class="right"><button class="btn-link" data-detail="' + s.no + '">详情</button></td></tr>';
      }).join('') || '<tr><td colspan="7"><div class="empty" style="border:0"><b>没有匹配的学生</b></div></td></tr>';
      host.querySelector('#pagerBox').innerHTML = arr.length ? U.pager('stu', pager, arr.length) : '';
    }

    U.usePager(host, 'stu', pager, paint);
    host.querySelector('#q').addEventListener('input', (e) => { q = e.target.value.trim(); pager.page = 1; paint(); });
    host.querySelector('#cls').addEventListener('change', (e) => { cls = e.target.value; pager.page = 1; paint(); });

    host.querySelector('#importBtn').addEventListener('click', () => {
      U.dialog({
        title: '从 Excel 导入学生名单',
        desc: '模板列：学号*、姓名*、班级*、手机、邮箱',
        body: '<div class="empty" style="padding:28px"><span class="ico">↑</span><b>拖拽 .xlsx 文件到此处</b><p>演示环境不读取真实文件，点击下方按钮模拟导入 60 条记录。</p></div>',
        confirmText: '模拟导入',
        onConfirm: () => {
          U.toast('导入完成', '演示环境不读取真实文件，已模拟校验 60 条记录', 'ok');
          return true;
        }
      });
    });
    host.querySelector('#exportBtn').addEventListener('click', () => App.Api.download('/api/export/students').catch((e) => U.toast('导出失败', e.message, 'danger')));

    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-detail]');
      if (!b) return;
      const no = b.getAttribute('data-detail');
      const stu = S.studentByNo(no);
      const app = S.get().applications[no];
      const ivs = S.interviews().filter((iv) => iv.no === no);
      const noms = S.nominations().filter((n) => n.no === no);
      U.dialog({
        title: stu.name + ' · ' + stu.no,
        wide: true,
        body: '<dl class="kv"><dt>班级</dt><dd>' + U.esc(stu.cls) + '</dd><dt>联系方式</dt><dd>' + U.esc(stu.phone || '—') + ' / ' + U.esc(stu.email || '—') + '</dd>' +
          '<dt>意向</dt><dd>' + (app ? app.labs.map((id) => U.esc(labOf(id).name)).join('、') : '未填报') + '</dd>' +
          '<dt>调剂</dt><dd>' + (app ? (app.internal ? '服从内部' : '不服从内部') + ' / ' + (app.cross ? '服从跨室' : '不服从跨室') : '—') + '</dd></dl>' +
          '<div class="section-head mt-16"><h2>面试</h2></div>' +
          (ivs.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>实训室</th><th>时间</th><th>总分</th><th>状态</th></tr></thead><tbody>' +
            ivs.map((iv) => '<tr><td>' + U.esc(labOf(iv.labId).name) + '</td><td class="num">' + U.fmt(iv.at) + '</td>' +
              '<td class="num">' + (iv.status === 'done' ? iv.total : '—') + '</td><td>' + (iv.status === 'done' ? '已完成' : '待面试') + '</td></tr>').join('') +
            '</tbody></table></div>' : '<p class="muted small">暂无面试记录</p>') +
          '<div class="section-head mt-16"><h2>名单</h2></div>' +
          (noms.length ? '<div style="display:grid;gap:6px">' + noms.map((n) => '<div class="kitem"><span class="rk">' + (n.type === 'accept' ? '录' : n.type === 'wait' ? '替' : '调') + '</span>' +
            '<div class="kname">' + U.esc(labOf(n.labId).name) + '</div><span class="kscore">' + (n.status === 'expired' ? '已逾期' : n.status === 'released' ? '已释放' : '#' + n.rank) + '</span></div>').join('') + '</div>'
            : '<p class="muted small">暂无</p>'),
        confirmText: '关闭',
        hideCancel: true
      });
    });

    paint();
  };

  /* ---------- 面试统筹 ---------- */
  V.adminInterview = function (host) {
    const pager = { page: 1, size: 10 };
    let labId = 'all', onlyPending = false;

    host.innerHTML =
      '<div class="page-head"><div><h1>面试统筹</h1><p>全院 ' + S.interviews().length + ' 场面试，冲突检测已开启。同一学生多个意向不得排在同一时段。</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><button class="btn btn-ghost btn-sm" id="autoBtn">全院智能排期</button></div></div>' +
      '<div class="card"><div class="card-pad"><div class="flex flex-wrap gap-12">' +
        '<select class="select" id="lab" style="width:auto;min-width:200px"><option value="all">全部实训室</option>' +
          S.labs().map((l) => '<option value="' + l.id + '">' + U.esc(l.name) + '</option>').join('') + '</select>' +
        '<label class="switch"><input type="checkbox" id="pendingOnly" /><span class="track"></span><span class="small">只看未完成</span></label>' +
        '<span class="spacer" style="flex:1"></span>' +
        '<span class="badge warn">' + S.interviews().filter((iv) => iv.status !== 'done').length + ' 场待面试</span>' +
      '</div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>时间</th><th>实训室</th><th>学生</th><th>地点</th><th>评委</th><th>状态</th><th>总分</th></tr></thead><tbody id="rows"></tbody></table></div>' +
      '<div id="pagerBox"></div></div>';

    function conflicts() {
      const map = {};
      S.interviews().forEach((iv) => {
        const k = iv.no + '|' + iv.at;
        (map[k] = map[k] || []).push(iv);
      });
      const set = new Set();
      Object.keys(map).forEach((k) => { if (map[k].length > 1) map[k].forEach((iv) => set.add(iv.id)); });
      return set;
    }

    function list() {
      return S.interviews()
        .filter((iv) => (labId === 'all' || iv.labId === labId) && (!onlyPending || iv.status !== 'done'))
        .sort((a, b) => a.at - b.at);
    }

    function paint() {
      const arr = list();
      const bad = conflicts();
      host.querySelector('#rows').innerHTML = U.slice(arr, pager).map((iv) => {
        const stu = S.studentByNo(iv.no);
        return '<tr><td class="num">' + U.fmt(iv.at) + (bad.has(iv.id) ? ' <span class="badge danger">冲突</span>' : '') + '</td>' +
          '<td><div class="cell-main">' + U.esc(labOf(iv.labId).name) + '</div><span class="cell-sub">' + U.esc(labOf(iv.labId).direction) + '</span></td>' +
          '<td>' + U.esc(stu.name) + '<span class="cell-sub num">' + U.esc(stu.no) + '</span></td>' +
          '<td>' + U.esc(iv.room) + '</td><td>' + U.esc(labOf(iv.labId).teacher.name) + '</td>' +
          '<td>' + (iv.status === 'done' ? '<span class="badge ok">已完成</span>' : '<span class="badge warn">待面试</span>') + '</td>' +
          '<td class="num">' + (iv.status === 'done' ? iv.total : '—') + '</td></tr>';
      }).join('') || '<tr><td colspan="7"><div class="empty" style="border:0"><b>没有符合条件的面试</b></div></td></tr>';
      host.querySelector('#pagerBox').innerHTML = arr.length ? U.pager('ivs', pager, arr.length) : '';
    }

    U.usePager(host, 'ivs', pager, paint);
    host.querySelector('#lab').addEventListener('change', (e) => { labId = e.target.value; pager.page = 1; paint(); });
    host.querySelector('#pendingOnly').addEventListener('change', (e) => { onlyPending = e.target.checked; pager.page = 1; paint(); });

    host.querySelector('#autoBtn').addEventListener('click', async () => {
      const ok = await U.confirm({
        title: '全院智能排期',
        body: '<p>将按实训室分组，为 <b>' + S.interviews().filter((iv) => iv.status !== 'done').length + ' 场未完成面试</b> 分配 30 分钟时段，并自动避让同一学生在其他实训室的冲突。</p>',
        confirmText: '开始排期'
      });
      if (!ok) return;
      const pending = S.interviews().filter((iv) => iv.status !== 'done').length;
      const r = await S.arrangeInterviews();
      if (r.error) { U.toast('排期失败', r.error, 'danger'); return; }
      U.toast('排期完成', '已分配 ' + pending + ' 场', 'ok');
      paint();
    });

    paint();
  };

  /* ---------- 录取看板 ---------- */
  V.adminBoard = function (host) {
    const pager = { page: 1, size: 6 };
    const cs = S.confirmStats();
    const d = S.dashboard();

    host.innerHTML =
      '<div class="page-head"><div><h1>录取看板</h1><p>名额、确认与递补实时汇总。确认窗口 ' + U.fmtRange(S.get().cycle.stages[4].start, S.get().cycle.stages[4].end) + '。</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><button class="btn btn-ghost btn-sm" id="exportBtn">导出录取表</button>' +
      '<a class="btn btn-primary btn-sm" href="#/a/publicity">发布公示</a></div></div>' +
      '<div class="grid grid-4">' +
        '<div class="stat"><span class="k">已发意向人数</span><span class="v">' + cs.offerStudents + '</span><span class="d">其中需多选一 ' + cs.multi + ' 人</span></div>' +
        '<div class="stat"><span class="k">已确认</span><span class="v">' + cs.confirmed + '</span><span class="d">占已发意向 ' + U.pct(cs.confirmed, cs.offerStudents) + '%</span></div>' +
        '<div class="stat"><span class="k">待确认</span><span class="v">' + cs.pending + '</span><span class="d">截止后自动释放</span></div>' +
        '<div class="stat accent"><span class="k">剩余名额</span><span class="v">' + d.remaining + '</span><span class="d">满额实训室 ' + d.fullLabs + ' 个</span></div>' +
      '</div>' +
      '<div class="card mt-16"><div class="card-head"><h3>各实训室名额</h3><span class="spacer" style="flex:1"></span>' +
        '<span class="tiny muted">点击查看名单</span></div><div class="card-body"><div id="labCards" class="lab-grid"></div><div id="labPager"></div></div></div>';

    function paint() {
      const arr = S.labs().map((l) => S.labStats(l.id));
      host.querySelector('#labCards').innerHTML = U.slice(arr, pager).map((x) => {
        const pct = U.pct(x.taken, x.quota);
        return '<div class="lab-card" data-lab="' + x.lab.id + '">' +
          '<div class="lc-top"><span class="lc-idx">' + U.esc(x.lab.id) + '</span>' +
          '<div style="flex:1;min-width:0"><h3>' + U.esc(x.lab.name) + '</h3><p class="lc-sub">' + U.esc(x.lab.teacher.name) + ' · ' + U.esc(x.lab.direction) + '</p></div>' +
          '<span class="badge ' + (x.remaining === 0 ? 'ok' : 'warn') + '">' + (x.remaining === 0 ? '已满' : '余 ' + x.remaining) + '</span></div>' +
          '<div class="meter-row"><div class="meter ' + (x.remaining === 0 ? 'ok' : 'warn') + '"><i style="width:' + pct + '%"></i></div>' +
          '<span class="val">' + x.taken + '/' + x.quota + '</span></div>' +
          '<div class="flex" style="justify-content:space-between"><span class="tiny muted">报名 ' + x.applicants + ' · 拟录取 ' + x.accepted + '</span>' +
          '<span class="tiny muted">确认 ' + x.confirmed + ' · 递补 ' + x.wait + '</span></div></div>';
      }).join('');
      host.querySelector('#labPager').innerHTML = U.pager('board', pager, arr.length, [6, 12]);
    }

    U.usePager(host, 'board', pager, paint);
    paint();

    host.addEventListener('click', (e) => {
      const card = e.target.closest('[data-lab]');
      if (!card) return;
      const lab = labOf(card.getAttribute('data-lab'));
      const stats = S.labStats(lab.id);
      const rows = S.accepted(lab.id).map((n) => {
        const c = S.get().confirmations[n.no];
        return { n, c };
      });
      U.dialog({
        title: lab.name,
        desc: '拟录取 ' + stats.accepted + ' · 已确认 ' + stats.confirmed + ' · 名额 ' + stats.quota,
        wide: true,
        body: rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>姓名</th><th>班级</th><th>状态</th><th>方式</th></tr></thead><tbody>' +
          rows.map(({ n, c }) => '<tr><td class="num">' + n.rank + '</td><td>' + U.esc(S.studentByNo(n.no).name) + '</td>' +
            '<td>' + U.esc(S.studentByNo(n.no).cls) + '</td>' +
            '<td>' + (c ? '<span class="badge ok">已确认</span>' : '<span class="badge warn">待确认</span>') + '</td>' +
            '<td class="small">' + (c ? U.sourceLabel(c.source) : '—') + '</td></tr>').join('') + '</tbody></table></div>'
          : '<div class="empty" style="border:0"><b>尚未拟定名单</b></div>',
        confirmText: '关闭',
        hideCancel: true
      });
    });

    host.querySelector('#exportBtn').addEventListener('click', () => App.Api.download('/api/export/admissions').catch((e) => U.toast('导出失败', e.message, 'danger')));
  };

  /* ---------- 调剂池 ---------- */
  V.adminAllocate = function (host) {
    const pager = { page: 1, size: 10 };
    const prio = { P1: '① 内部调剂', P2: '② 跨室调剂', P3: '③ 学院统筹' };

    function unassigned() {
      const st = S.get();
      return st.students.filter((s) => {
        if (st.confirmations[s.no]) return false;
        const app = st.applications[s.no];
        if (!app) return false;
        const offers = st.nominations.filter((n) => n.no === s.no && n.type === 'accept' && !n.status);
        return offers.length === 0;
      });
    }

    function candidatesFor(no) {
      const st = S.get();
      const app = st.applications[no];
      const labs = st.labs.map((l) => ({ lab: l, s: S.labStats(l.id) })).filter((x) => x.s.remaining > 0);
      const inApps = labs.filter((x) => app.labs.includes(x.lab.id));
      return { app, all: labs, inApps };
    }

    function suggestion(no) {
      const { app, all, inApps } = candidatesFor(no);
      if (app.internal && inApps.length) return { level: 'P1', lab: inApps[0].lab, why: '该生服从内部调剂且填报过此室，该室仍有空位' };
      if (app.cross) {
        const target = inApps[0] || all[0];
        if (target) return { level: 'P2', lab: target.lab, why: '该生服从全院跨室调剂，按总分与空位匹配' };
        return { level: 'P2', lab: null, why: '服从跨室调剂，但全院已无名额' };
      }
      return { level: 'P3', lab: inApps[0] ? inApps[0].lab : (all[0] ? all[0].lab : null), why: '未服从任何调剂，需学院统筹安置' };
    }

    const pool = unassigned();

    host.innerHTML =
      '<div class="page-head"><div><h1>统筹调剂池</h1><p>三轮补录后仍未被录取的学生进入调剂池，严格按 ① 内部 → ② 跨室 → ③ 统筹 的顺序处理。</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><button class="btn btn-ghost btn-sm" id="hintBtn">查看规则</button></div></div>' +
      '<div class="grid grid-4">' +
        '<div class="stat"><span class="k">待调剂学生</span><span class="v">' + pool.length + '<small>人</small></span><span class="d">未录取且未确认</span></div>' +
        '<div class="stat"><span class="k">全院剩余名额</span><span class="v">' + S.dashboard().remaining + '<small>个</small></span><span class="d">' + S.dashboard().fullLabs + ' 个实训室已满</span></div>' +
        '<div class="stat"><span class="k">已调剂</span><span class="v">' + S.allocations().length + '<small>人</small></span><span class="d">含内部 / 跨室 / 统筹</span></div>' +
        '<div class="stat accent"><span class="k">当前优先级</span><span class="v" style="font-size:20px">' + (pool.some((s) => S.get().applications[s.no].internal) ? '① 内部调剂' : '② 跨室调剂') + '</span><span class="d">系统按序建议，人工确认</span></div>' +
      '</div>' +
      '<div class="card mt-16"><div class="card-head"><h3>待处理名单</h3><span class="badge warn">' + pool.length + ' 人</span>' +
        '<span class="spacer" style="flex:1"></span><span class="tiny muted">建议仅供参考，需管理员确认并填写理由</span></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>学生</th><th>原志愿</th><th>调剂意愿</th><th>最高面试分</th><th>建议</th><th class="right">操作</th></tr></thead><tbody id="rows"></tbody></table></div>' +
        '<div id="pagerBox"></div></div>' +
      '<div class="card mt-16"><div class="card-head"><h3>剩余名额</h3></div><div class="card-body"><div class="flex flex-wrap gap-8">' +
        S.labs().map((l) => S.labStats(l.id)).filter((x) => x.remaining > 0).map((x) =>
          '<span class="tag"><b>' + U.esc(x.lab.name) + '</b>　剩 ' + x.remaining + ' / ' + x.quota + '</span>').join('') ||
          '<span class="muted small">全院名额已满</span>' +
      '</div></div></div>';

    function paint() {
      host.querySelector('#rows').innerHTML = U.slice(pool, pager).map((s) => {
        const { app } = candidatesFor(s.no);
        const sug = suggestion(s.no);
        const ivs = S.interviews().filter((iv) => iv.no === s.no && iv.status === 'done');
        const best = ivs.length ? Math.max.apply(null, ivs.map((iv) => iv.total)) : 0;
        return '<tr><td><div class="cell-main">' + U.esc(s.name) + '</div><span class="cell-sub num">' + U.esc(s.no) + '</span></td>' +
          '<td class="small">' + app.labs.map((id) => U.esc(labOf(id).name)).join('、') + '</td>' +
          '<td class="small">' + (app.internal ? '<span class="badge info">内部</span> ' : '') + (app.cross ? '<span class="badge brand">跨室</span>' : '') + (!app.internal && !app.cross ? '<span class="badge plain">均不服从</span>' : '') + '</td>' +
          '<td class="num">' + (best || '—') + '</td>' +
          '<td><span class="badge ' + (sug.level === 'P1' ? 'ok' : sug.level === 'P2' ? 'brand' : 'warn') + '">' + prio[sug.level] + '</span>' +
          '<span class="cell-sub">' + U.esc(sug.lab ? sug.lab.name : '全院无名额') + '</span></td>' +
          '<td class="right"><button class="btn btn-sm btn-primary" data-alloc="' + s.no + '">分配</button></td></tr>';
      }).join('') || '<tr><td colspan="6"><div class="empty" style="border:0"><span class="ico">✓</span><b>没有待调剂学生</b><p>所有学生均已确定去向。</p></div></td></tr>';
      host.querySelector('#pagerBox').innerHTML = pool.length ? U.pager('pool', pager, pool.length) : '';
    }

    U.usePager(host, 'pool', pager, paint);

    host.querySelector('#hintBtn').addEventListener('click', () => {
      U.dialog({
        title: '调剂规则',
        body: '<ul class="rules">' +
          '<li><b>P1 实训室内部调剂</b>：学生勾选「服从内部调剂」，且本室仍有空位，按内部调剂候选顺位落位。</li>' +
          '<li><b>P2 全院跨室调剂</b>：P1 处理完后仍有空位，为勾选「服从全院调剂」的学生匹配，按面试总分降序、同分按学号升序。</li>' +
          '<li><b>P3 学院统筹</b>：未勾选任何调剂的学生，由管理员逐人指定去向并填写理由，系统不自动分配。</li>' +
          '<li>调剂同样受名额硬约束，落位后实时扣减，不允许超录。</li></ul>',
        confirmText: '知道了',
        hideCancel: true
      });
    });

    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-alloc]');
      if (!b) return;
      const no = b.getAttribute('data-alloc');
      const stu = S.studentByNo(no);
      const sug = suggestion(no);
      const avail = S.labs().map((l) => ({ l, s: S.labStats(l.id) })).filter((x) => x.s.remaining > 0);
      U.dialog({
        title: '调剂分配 · ' + stu.name,
        desc: '建议：' + prio[sug.level] + (sug.lab ? ' → ' + sug.lab.name : ''),
        wide: true,
        body: '<div class="grid grid-2" style="gap:12px">' +
          '<div class="field"><label for="alab">目标实训室</label><select class="select" id="alab">' +
            avail.map((x) => '<option value="' + x.l.id + '"' + (sug.lab && sug.lab.id === x.l.id ? ' selected' : '') + '>' + U.esc(x.l.name) + '（剩 ' + x.s.remaining + '）</option>').join('') +
          '</select></div>' +
          '<div class="field"><label for="aprio">优先级</label><select class="select" id="aprio">' +
            ['P1', 'P2', 'P3'].map((p) => '<option value="' + p + '"' + (sug.level === p ? ' selected' : '') + '>' + prio[p] + '</option>').join('') +
          '</select></div></div>' +
          '<div class="field mt-12"><label for="areason">理由（必填，写入审计日志）</label>' +
          '<textarea class="textarea" id="areason" placeholder="例如：该生两轮均未被录取，服从跨室调剂，按总分顺位落位至仍有空位的实训室。">' + U.esc(sug.why) + '</textarea></div>' +
          '<div class="alert warn mt-12"><span class="ico">!</span><div>落位后该名额立即被占用，学生将收到调剂通知，不可再次调剂。</div></div>',
        confirmText: '确认落位',
        onConfirm: async (mask) => {
          const labId = mask.querySelector('#alab').value;
          const p = mask.querySelector('#aprio').value;
          const reason = mask.querySelector('#areason').value.trim();
          if (reason.length < 4) { U.toast('请填写理由', '至少 4 个字', 'warn'); return false; }
          const r = await S.allocate(no, labId, p, reason);
          if (r.error) { U.toast('分配失败', r.error, 'danger'); return false; }
          U.toast('已完成调剂', stu.name + ' → ' + labOf(labId).name, 'ok');
          App.render();
          return true;
        }
      });
    });

    paint();
  };

  /* ---------- 公示管理 ---------- */
  V.adminPublicity = function (host) {
    const st = S.get();
    const pub = st.publicity;
    const pager = { page: 1, size: 10 };
    const rows = pub.publishedAt ? S.publicityRows() : [];
    const objs = st.objections || [];

    host.innerHTML =
      '<div class="page-head"><div><h1>公示与入组</h1><p>汇总最终录取名单，公示 1 天；公示无异议后学生正式加入实训室。</p></div>' +
      '<div class="spacer"></div><div class="page-actions">' +
        (pub.publishedAt
          ? '<button class="btn btn-ghost btn-sm" id="exportBtn">导出公示名单</button>'
          : '<button class="btn btn-primary btn-sm" id="publishBtn">发布公示</button>') +
      '</div></div>' +
      (pub.publishedAt
        ? '<div class="alert ok"><span class="ico">✓</span><div><b>公示进行中</b>：' + U.fmt(pub.publishedAt) + ' 发布，至 ' + U.fmt(pub.until) +
          ' 结束，公示 ' + rows.length + ' 人，收到异议 ' + objs.length + ' 条。剩余时间 <b data-cd="clock">' + U.durClock(pub.until - Date.now()) + '</b></div></div>'
        : '<div class="alert info"><span class="ico">i</span><div>尚未发布公示。发布后系统将锁定名单快照，学生端可见脱敏结果（姓名 + 学号后四位 + 去向）。</div></div>') +
      '<div class="grid grid-4 mt-16">' +
        '<div class="stat"><span class="k">最终录取</span><span class="v">' + Object.keys(st.confirmations).length + '<small>人</small></span><span class="d">含确认与调剂</span></div>' +
        '<div class="stat"><span class="k">空缺名额</span><span class="v">' + S.dashboard().remaining + '<small>个</small></span><span class="d">' + S.dashboard().fullLabs + ' 个实训室已满</span></div>' +
        '<div class="stat"><span class="k">公示状态</span><span class="v" style="font-size:20px">' + (pub.publishedAt ? '公示中' : '未发布') + '</span><span class="d">公示期 1 天</span></div>' +
        '<div class="stat accent"><span class="k">异议</span><span class="v">' + objs.length + '<small>条</small></span><span class="d">需线下核实后回填</span></div>' +
      '</div>' +
      '<div class="card mt-16"><div class="card-head"><h3>最终录取名册</h3><span class="spacer" style="flex:1"></span>' +
        '<span class="tiny muted">对外公示时学号脱敏</span></div>' +
      (rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>姓名</th><th>学号</th><th>录取实训室</th><th>录取方式</th><th>确认时间</th></tr></thead><tbody id="pubBody"></tbody></table></div><div id="pubPager"></div>'
        : '<div class="empty" style="border:0"><span class="ico">∅</span><b>还没有录取结果</b><p>需先完成双选确认与调剂落位。</p></div>') +
      '</div>' +
      '<div class="card mt-16"><div class="card-head"><h3>异议记录</h3><span class="badge plain">' + objs.length + '</span></div>' +
      (objs.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>提交人</th><th>内容</th><th>时间</th><th class="right">状态</th></tr></thead><tbody>' +
        objs.map((o) => '<tr><td>' + U.esc(o.name) + '</td><td class="small">' + U.esc(o.text) + '</td><td class="num">' + U.fmt(o.at) + '</td>' +
          '<td class="right"><span class="badge warn">待核实</span></td></tr>').join('') + '</tbody></table></div>'
        : '<div class="empty" style="border:0"><b>暂无异议</b></div>') +
      '</div>' +
      '<div class="card mt-16"><div class="card-head"><h3>入组安排</h3></div><div class="card-body">' +
        '<dl class="kv"><dt>公示开始</dt><dd>' + (pub.publishedAt ? U.fmt(pub.publishedAt) : '未发布') + '</dd>' +
        '<dt>公示结束</dt><dd>' + (pub.until ? U.fmt(pub.until) : '—') + '</dd>' +
        '<dt>正式入组</dt><dd>公示结束次日，学生进入实训室开展 AI+PB 项目实训</dd>' +
        '<dt>需同步</dt><dd>实训室分组表、入组须知、导师联系方式</dd></dl>' +
      '</div></div>';

    if (rows.length) {
      function paint() {
        host.querySelector('#pubBody').innerHTML = U.slice(rows, pager).map((r) => '<tr><td><div class="cell-main">' + U.esc(r.name) + '</div></td>' +
          '<td class="num">' + U.esc(r.masked) + '</td>' +
          '<td>' + U.esc(r.lab) + '<span class="cell-sub">' + U.esc(r.direction) + '</span></td>' +
          '<td><span class="badge ' + (r.source === 'auto' ? 'info' : r.source === 'choice' ? 'ok' : 'brand') + '">' + U.sourceLabel(r.source) + '</span></td>' +
          '<td class="num">' + U.fmt(r.at) + '</td></tr>').join('');
        host.querySelector('#pubPager').innerHTML = U.pager('pub', pager, rows.length);
      }
      U.usePager(host, 'pub', pager, paint);
      paint();
    }

    const pb = host.querySelector('#publishBtn');
    if (pb) {
      pb.addEventListener('click', async () => {
        const ok = await U.confirm({
          title: '发布录取公示？',
          body: '<p>将汇总 <b>' + Object.keys(st.confirmations).length + ' 名</b>学生的最终去向，公示 <b>1 天</b>。公示期间学生可提交异议。</p>' +
            '<p class="tiny muted mt-8">公示后名单锁定，再次修改需记录理由并重新发布。</p>',
          confirmText: '确认发布'
        });
        if (!ok) return;
        const r = await S.publish();
        if (r.error) { U.toast('发布失败', r.error, 'danger'); return; }
        U.toast('公示已发布', '学生端已可见脱敏名单', 'ok');
        App.render();
      });
    }
    const eb = host.querySelector('#exportBtn');
    if (eb) eb.addEventListener('click', () => App.Api.download('/api/export/publicity').catch((e) => U.toast('导出失败', e.message, 'danger')));
  };

  /* ---------- 审计日志 ---------- */
  V.adminAudit = function (host) {
    const pager = { page: 1, size: 12 };
    let q = '';
    const logs = S.audit().slice();

    host.innerHTML =
      '<div class="page-head"><div><h1>审计日志</h1><p>记录所有状态变更：操作者、时间、动作与详情，仅增不改。共 ' + logs.length + ' 条。</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><button class="btn btn-ghost btn-sm" id="exportBtn">导出日志</button></div></div>' +
      '<div class="card"><div class="card-pad"><div class="search" style="max-width:380px"><span class="ico">⌕</span><input class="input" id="q" placeholder="搜索操作人、动作或详情" /></div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>时间</th><th>操作人</th><th>角色</th><th>动作</th><th>详情</th></tr></thead><tbody id="rows"></tbody></table></div>' +
      '<div id="pagerBox"></div></div>';

    const roleLabel = { admin: '学院', teacher: '导师', student: '学生', system: '系统' };

    function list() {
      return logs.filter((l) => !q || (l.actor + l.action + l.detail).indexOf(q) >= 0);
    }

    function paint() {
      const arr = list();
      host.querySelector('#rows').innerHTML = U.slice(arr, pager).map((l) => '<tr>' +
        '<td class="num">' + U.fmt(l.at) + '</td>' +
        '<td>' + U.esc(l.actor) + '</td>' +
        '<td><span class="badge plain">' + (roleLabel[l.role] || l.role) + '</span></td>' +
        '<td><b class="small">' + U.esc(l.action) + '</b></td>' +
        '<td class="small muted">' + U.esc(l.detail) + '</td></tr>').join('') ||
        '<tr><td colspan="5"><div class="empty" style="border:0"><b>没有匹配的日志</b></div></td></tr>';
      host.querySelector('#pagerBox').innerHTML = arr.length ? U.pager('audit', pager, arr.length) : '';
    }

    U.usePager(host, 'audit', pager, paint);
    host.querySelector('#q').addEventListener('input', (e) => { q = e.target.value.trim(); pager.page = 1; paint(); });
    host.querySelector('#exportBtn').addEventListener('click', () => App.Api.download('/api/export/audit').catch((e) => U.toast('导出失败', e.message, 'danger')));
    paint();
  };
})();
