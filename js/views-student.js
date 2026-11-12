/* ==========================================================================
   学生端页面
   ========================================================================== */
(function () {
  const App = window.App, U = App.U, S = App.Store;
  const V = (App.Views = App.Views || {});
  App.Comp = App.Comp || {};

  /* ---------- 共享组件 ---------- */
  App.Comp.flow = function () {
    const st = S.get();
    return '<div class="flow">' + st.cycle.stages.map((s, i) => {
      const state = S.stageStatus(i);
      return '<div class="flow-step" data-state="' + state + '">' +
        '<div class="top"><span class="n" style="background:var(--s' + (i + 1) + ')">' + (i + 1) + '</span>' +
        '<span class="nm">' + U.esc(s.short) + '</span></div>' +
        '<div class="tm">' + U.fmtRange(s.start, s.end) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  };

  function cdClock() {
    const cd = S.countdown();
    if (cd.phase === 'active') return '<span data-cd="clock">' + U.durClock(cd.ms) + '</span>';
    return cd.phase === 'before' ? '待开始' : '已结束';
  }

  function labCard(lab, idx, opts) {
    opts = opts || {};
    const stats = S.labStats(lab.id);
    const full = stats.remaining === 0;
    const pct = U.pct(stats.taken, stats.quota);
    return '<article class="lab-card ' + (opts.selected ? 'selected' : '') + '" data-lab="' + lab.id + '" tabindex="0">' +
      '<div class="lc-top">' +
        '<span class="lc-idx">' + (idx + 1) + '</span>' +
        '<div style="min-width:0;flex:1">' +
          '<h3>' + U.esc(lab.name) + '</h3>' +
          '<p class="lc-sub">' + U.esc(lab.direction) + '</p>' +
        '</div>' +
        (opts.pick ? '<span class="pick">✓</span>' : '') +
        (full && !opts.pick ? '<span class="full-ribbon">已满</span>' : '') +
      '</div>' +
      '<div class="lc-teacher"><span class="badge plain no-dot">导师</span>' + U.esc(lab.teacher.name) + ' · ' + U.esc(lab.teacher.title) + '</div>' +
      '<div class="lc-tags">' + lab.tags.map((t) => '<span class="tag">' + U.esc(t) + '</span>').join('') + '</div>' +
      '<div class="lc-foot">' +
        '<div class="meter-row" style="flex:1"><div class="meter ' + (full ? 'danger' : pct > 70 ? 'warn' : 'ok') + '"><i style="width:' + pct + '%"></i></div>' +
        '<span class="val">' + stats.taken + '/' + stats.quota + '</span></div>' +
        '<span class="small ' + (full ? '' : 'muted') + '">' + (full ? '名额已满' : '剩余 ' + stats.remaining) + '</span>' +
      '</div>' +
      '</article>';
  }

  /* ---------- 首页 ---------- */
  V.studentHome = function (host) {
    const m = S.me();
    const app = S.myApp();
    const offers = S.myOffers();
    const conf = S.myConfirmation();
    const idx = S.stageIndex();
    const cd = S.countdown();
    const stage = S.get().cycle.stages[Math.max(0, Math.min(7, idx))];
    const ivs = S.myInterviews();
    const ivDone = ivs.filter((x) => x.status === 'done').length;

    let statusText = '还没有提交意向';
    let cta = { text: '去看看实训室', href: '#/s/labs' };
    if (conf) {
      statusText = '你已确认加入「' + conf.lab.name + '」';
      cta = { text: '查看录取信息', href: '#/s/result' };
    } else if (idx >= 4 && offers.length >= 2) {
      statusText = '你收到 ' + offers.length + ' 个拟录取意向，等待选择';
      cta = { text: '去选择去向', href: '#/s/result' };
    } else if (idx >= 4 && offers.length === 1) {
      statusText = '你收到 1 个拟录取意向，系统已自动确认';
      cta = { text: '查看录取信息', href: '#/s/result' };
    } else if (app) {
      statusText = '已提交 ' + app.labs.length + ' 个平行意向';
      if (idx === 2) cta = { text: '修改我的意向', href: '#/s/apply' };
      else if (idx >= 4) cta = { text: '查看结果', href: '#/s/result' };
    } else if (idx === 2) {
      statusText = '填报窗口已开启，截止前可随时修改';
      cta = { text: '开始填报意向', href: '#/s/apply' };
    }

    const showOffers = idx >= 4 ? offers.length : 0;
    const steps = [
      { t: '意向填报', d: app ? '已提交 ' + app.labs.length + ' 个意向' : '最多 3 个平行意向，不排序', ok: !!app, active: idx === 2 },
      { t: '面试考核', d: ivs.length ? (ivDone + '/' + ivs.length + ' 场已完成') : '等待实训室安排', ok: ivs.length > 0 && ivDone === ivs.length, active: idx === 3 },
      { t: '拟录取结果', d: idx < 4 ? '结果将于 ' + U.fmt(S.get().cycle.stages[4].start) + ' 公布' : (offers.length ? '收到 ' + offers.length + ' 个意向' : '未获得拟录取意向'), ok: idx >= 4 && !!(offers.length || conf), active: idx === 4 && !conf },
      { t: '确认去向', d: conf ? '已确认至「' + conf.lab.name + '」' : '1 条自动确认，多条需自行选择', ok: !!conf, active: idx === 4 && !conf }
    ];

    host.innerHTML =
      '<div class="page-head">' +
        '<div><h1>你好，' + U.esc(m.name) + '</h1><p>' + U.esc(m.cls) + ' · ' + U.esc(m.id) + '　' + U.esc(S.get().cycle.name) + '</p></div>' +
        '<div class="spacer"></div>' +
        '<div class="page-actions"><a class="btn btn-ghost btn-sm" href="#/s/publicity">公示名单</a>' +
        '<a class="btn btn-primary btn-sm" href="' + cta.href + '">' + cta.text + '</a></div>' +
      '</div>' +

      '<div class="hero">' +
        '<div class="hero-main">' +
          '<div class="hero-eyebrow">当前环节 · 第 ' + (Math.max(1, idx + 1)) + ' 步 / 8</div>' +
          '<h2>' + U.esc(stage ? stage.label : '') + '</h2>' +
          '<p>' + U.esc(statusText) + '</p>' +
          '<div class="hero-actions"><a class="btn btn-sm" style="background:#fff;color:#3a2bb5" href="' + cta.href + '">' + cta.text + '</a>' +
          '<a class="btn btn-sm" style="background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.24)" href="#/s/result">我的结果</a></div>' +
        '</div>' +
        '<div class="hero-timer">' +
          '<span>' + (cd.phase === 'active' ? '距离本环节截止' : cd.phase === 'before' ? '距离开始' : '本环节已结束') + '</span>' +
          '<b data-cd="clock">' + (cd.phase === 'active' ? U.durClock(cd.ms) : '—') + '</b>' +
          '<span>' + U.fmt(stage ? stage.end : Date.now()) + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="grid grid-4 mt-16">' +
        '<div class="stat"><span class="k">我的意向</span><span class="v">' + (app ? app.labs.length : 0) + '<small>/ 3</small></span><span class="d">平行志愿，不分先后</span></div>' +
        '<div class="stat"><span class="k">面试场次</span><span class="v">' + ivs.length + '<small>场</small></span><span class="d">已完成 ' + ivDone + ' 场</span></div>' +
        '<div class="stat"><span class="k">拟录取意向</span><span class="v">' + showOffers + '<small>个</small></span><span class="d">' + (idx < 4 ? '结果公布后显示' : showOffers >= 2 ? '需自行二选一' : showOffers === 1 ? '系统自动确认' : '暂无') + '</span></div>' +
        '<div class="stat accent"><span class="k">全院剩余名额</span><span class="v">' + S.dashboard().remaining + '<small>个</small></span><span class="d">共 ' + S.labs().length + ' 个实训室</span></div>' +
      '</div>' +

      '<div class="section">' + App.Comp.flow() + '</div>' +

      '<div class="grid grid-side mt-16">' +
        '<div class="card">' +
          '<div class="card-head"><h3>我的进度</h3><span class="badge brand">' + (conf ? '已完成' : '进行中') + '</span></div>' +
          '<div class="card-body"><div class="timeline">' +
            steps.map((s) => '<div class="tl-item">' +
              '<span class="tl-dot ' + (s.ok ? 'done' : s.active ? 'active' : '') + '">' + (s.ok ? '✓' : '') + '</span>' +
              '<div class="tl-body"><b>' + s.t + (s.active && !s.ok ? ' <span class="badge info" style="margin-left:4px">进行中</span>' : '') + '</b>' +
              '<p>' + U.esc(s.d) + '</p></div></div>').join('') +
          '</div></div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-head"><h3>须知</h3></div>' +
          '<div class="card-body"><ul class="rules">' +
            '<li>最多填报 <b>3 个平行意向</b>，系统不区分先后，按各实训室面试结果双向选择。</li>' +
            '<li>「服从内部调剂」指同一实训室内更换导师或方向；「服从全院调剂」指可被其他实训室接收。</li>' +
            '<li>收到 1 个拟录取意向自动确认；收到 2 个及以上须在 <b>11月4日 08:00–12:00</b> 内选择唯一去向，逾期视为放弃。</li>' +
            '<li>确认后不可反悔，名额空出后由递补名单顺位补位。</li>' +
          '</ul></div>' +
          '<div class="card-foot"><a class="btn btn-ghost btn-sm btn-block" href="#/s/interview">查看面试安排</a></div>' +
        '</div>' +
      '</div>';
  };

  /* ---------- 实训室列表 ---------- */
  V.studentLabs = function (host) {
    const pager = { page: 1, size: 6 };
    let q = '', dir = 'all', onlyOpen = false;

    const directions = Array.from(new Set(S.labs().map((l) => l.direction.split(' / ')[0])));

    host.innerHTML =
      '<div class="page-head"><div><h1>实训室一览</h1><p>共 ' + S.labs().length + ' 个实训室，' + S.dashboard().quota + ' 个名额。点击卡片查看方向、培养安排与考核要求。</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><a class="btn btn-primary btn-sm" href="#/s/apply">去填报意向</a></div></div>' +
      '<div class="card card-pad">' +
        '<div class="flex flex-wrap gap-12">' +
          '<div class="search" style="flex:1;min-width:220px"><span class="ico">⌕</span><input class="input" id="q" placeholder="搜索实训室名称、方向或导师" /></div>' +
          '<select class="select" id="dir" style="width:auto;min-width:170px">' +
            '<option value="all">全部方向</option>' + directions.map((d) => '<option value="' + U.esc(d) + '">' + U.esc(d) + '</option>').join('') +
          '</select>' +
          '<label class="switch"><input type="checkbox" id="onlyOpen" /><span class="track"></span><span class="small">只看还有名额</span></label>' +
        '</div>' +
      '</div>' +
      '<div class="mt-16"><div id="labGrid" class="lab-grid"></div><div id="labPager"></div></div>';

    function list() {
      return S.labs().filter((l) => {
        const st = S.labStats(l.id);
        if (onlyOpen && st.remaining === 0) return false;
        if (dir !== 'all' && l.direction.indexOf(dir) !== 0) return false;
        if (!q) return true;
        const hay = (l.name + l.direction + l.teacher.name + l.tags.join(' ')).toLowerCase();
        return hay.indexOf(q.toLowerCase()) >= 0;
      });
    }

    function paint() {
      const arr = list();
      const pageItems = U.slice(arr, pager);
      const grid = host.querySelector('#labGrid');
      grid.innerHTML = pageItems.length
        ? pageItems.map((l, i) => labCard(l, (pager.page - 1) * pager.size + i)).join('')
        : '<div class="empty" style="grid-column:1/-1"><span class="ico">∅</span><b>没有符合条件的实训室</b><p>试试清空搜索词或关闭「只看还有名额」。</p></div>';
      host.querySelector('#labPager').innerHTML = arr.length ? U.pager('labs', pager, arr.length, [6, 12, 24]) : '';
    }

    U.usePager(host, 'labs', pager, paint);

    host.querySelector('#q').addEventListener('input', (e) => { q = e.target.value.trim(); pager.page = 1; paint(); });
    host.querySelector('#dir').addEventListener('change', (e) => { dir = e.target.value; pager.page = 1; paint(); });
    host.querySelector('#onlyOpen').addEventListener('change', (e) => { onlyOpen = e.target.checked; pager.page = 1; paint(); });

    host.addEventListener('click', (e) => {
      const card = e.target.closest('[data-lab]');
      if (card) App.go('/s/lab/' + card.getAttribute('data-lab'));
    });
    host.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const card = e.target.closest('[data-lab]');
        if (card) App.go('/s/lab/' + card.getAttribute('data-lab'));
      }
    });

    paint();
  };

  /* ---------- 实训室详情 ---------- */
  V.studentLab = function (host, ctx) {
    const lab = S.labs().find((l) => l.id === ctx.params[0]);
    if (!lab) {
      host.innerHTML = '<div class="empty"><span class="ico">?</span><b>实训室不存在</b><a class="btn btn-ghost btn-sm" href="#/s/labs">返回列表</a></div>';
      return;
    }
    const stats = S.labStats(lab.id);
    const app = S.myApp();
    const picked = !!(app && app.labs.includes(lab.id));
    const full = stats.remaining === 0;
    const pct = U.pct(stats.taken, stats.quota);

    host.innerHTML =
      '<div class="page-head"><div><p class="tiny"><a href="#/s/labs">← 返回实训室一览</a></p>' +
        '<h1>' + U.esc(lab.name) + '</h1><p>' + U.esc(lab.direction) + ' · ' + U.esc(lab.room) + '</p></div></div>' +
      '<div class="grid grid-side">' +
        '<div style="display:grid;gap:16px">' +
          '<div class="card card-pad">' +
            '<div class="flex" style="gap:12px;align-items:flex-start">' +
              '<div class="lc-idx" style="width:42px;height:42px;border-radius:12px;font-size:14px">' + U.esc(lab.id) + '</div>' +
              '<div style="flex:1"><div class="flex flex-wrap gap-8">' + lab.tags.map((t) => '<span class="tag">' + U.esc(t) + '</span>').join('') + '</div>' +
              '<p class="muted mt-8" style="font-size:13.5px;line-height:1.8">' + U.esc(lab.intro) + '</p></div>' +
            '</div>' +
          '</div>' +
          '<div class="card"><div class="card-head"><h3>导师团队</h3></div>' +
            '<div class="card-body"><div class="flex" style="gap:12px">' +
              '<div style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand);font-weight:700">' + U.esc(lab.teacher.name.slice(0, 1)) + '</div>' +
              '<div><b>' + U.esc(lab.teacher.name) + '</b> <span class="badge plain" style="margin-left:6px">' + U.esc(lab.teacher.title) + '</span>' +
              '<p class="small muted">实训室负责人 · 面试主评委</p></div>' +
            '</div></div></div>' +
          '<div class="card"><div class="card-head"><h3>考核与要求</h3></div>' +
            '<div class="card-body"><ul class="rules">' + lab.requirements.map((r) => '<li>' + U.esc(r) + '</li>').join('') + '</ul>' +
            '<div class="alert info mt-16"><span class="ico">i</span><div>面试考察四个维度：<b>学习态度、逻辑思维、编程基础、沟通表达</b>。所有报名学生均需参加面试，名额未满也不例外。</div></div>' +
            '</div></div>' +
        '</div>' +
        '<div style="display:grid;gap:16px;position:sticky;top:88px">' +
          '<div class="card card-pad">' +
            '<div class="flex" style="justify-content:space-between"><span class="small muted">招录名额</span><b style="font-size:22px">' + stats.quota + ' 人</b></div>' +
            '<div class="meter-row mt-12"><div class="meter ' + (full ? 'danger' : pct > 70 ? 'warn' : 'ok') + '"><i style="width:' + pct + '%"></i></div><span class="val">' + stats.taken + '/' + stats.quota + '</span></div>' +
            '<p class="small ' + (full ? '' : 'muted') + ' mt-8">' + (full ? '该实训室名额已满，可关注补录轮次。' : '当前剩余 ' + stats.remaining + ' 个名额') + '</p>' +
            '<dl class="kv mt-16">' +
              '<dt>报名人数</dt><dd>' + (stats.applicants == null ? '—' : stats.applicants + ' 人') + '</dd>' +
              '<dt>面试地点</dt><dd>' + U.esc(lab.room) + '</dd>' +
              '<dt>开放日</dt><dd>' + U.fmtRange(S.get().cycle.stages[1].start, S.get().cycle.stages[1].end) + '</dd>' +
            '</dl>' +
            '<div class="mt-16">' +
              (picked
                ? '<a class="btn btn-soft btn-block" href="#/s/apply">已加入我的意向 · 点击调整</a>'
                : full
                  ? '<button class="btn btn-block is-disabled" disabled>名额已满</button>'
                  : '<a class="btn btn-primary btn-block" href="#/s/apply?add=' + lab.id + '">加入意向</a>') +
            '</div>' +
          '</div>' +
          '<div class="alert brand"><span class="ico">✦</span><div>意向填报 <b>' + U.fmtRange(S.get().cycle.stages[2].start, S.get().cycle.stages[2].end) + '</b>，最多 3 个平行意向，提交后仍可修改。</div></div>' +
        '</div>' +
      '</div>';
  };

  /* ---------- 意向填报 ---------- */
  V.studentApply = function (host, ctx) {
    const idx = S.stageIndex();
    const app = S.myApp();

    if (idx !== 2) {
      host.innerHTML =
        '<div class="page-head"><div><h1>意向填报</h1><p>填报窗口：' + U.fmtRange(S.get().cycle.stages[2].start, S.get().cycle.stages[2].end) + '</p></div></div>' +
        '<div class="empty"><span class="ico">⏱</span><b>' + (idx < 2 ? '填报尚未开始' : '填报已截止') + '</b>' +
          '<p>' + (idx < 2 ? '开放后系统会自动提醒，你也可以先浏览实训室。' : '截止后意向已锁定。' + (app ? '已提交 ' + app.labs.length + ' 个意向。' : '')) + '</p>' +
          '<div class="flex gap-8"><a class="btn btn-ghost btn-sm" href="#/s/labs">浏览实训室</a><a class="btn btn-soft btn-sm" href="#/s/result">查看结果</a></div>' +
        '</div>';
      return;
    }

    const labs = S.labs();
    const addId = ctx.query && ctx.query.add;
    let picked = (app ? app.labs.slice() : []);
    if (addId && labs.some((l) => l.id === addId) && picked.indexOf(addId) < 0 && picked.length < 3) picked.push(addId);
    let internal = app ? !!app.internal : false;
    let cross = app ? !!app.cross : false;

    host.innerHTML =
      '<div class="page-head"><div><h1>意向填报</h1><p>最多选择 3 个平行意向，<b>系统不区分志愿先后</b>。截止 ' + U.fmt(S.get().cycle.stages[2].end) + '，在此之前可反复修改。</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><a class="btn btn-ghost btn-sm" href="#/s/labs">查看实训室详情</a></div></div>' +
      (app ? '<div class="alert ok"><span class="ico">✓</span><div>你已于 <b>' + U.fmt(app.submittedAt) + '</b> 提交过意向' +
        (app.history && app.history.length ? '，这是第 ' + (app.history.length + 1) + ' 次提交' : '') +
        '。截止前以最后一次提交为准。</div></div>' : '') +
      '<div class="grid grid-side mt-16">' +
        '<div>' +
          '<div class="card card-pad" style="position:sticky;top:76px;z-index:5">' +
            '<div class="flex flex-wrap gap-12">' +
              '<div class="search" style="flex:1;min-width:200px"><span class="ico">⌕</span><input class="input" id="q" placeholder="搜索实训室或导师" /></div>' +
              '<select class="select" id="dir" style="width:auto;min-width:150px"><option value="all">全部方向</option>' +
                Array.from(new Set(labs.map((l) => l.direction.split(' / ')[0]))).map((d) => '<option value="' + U.esc(d) + '">' + U.esc(d) + '</option>').join('') +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div id="pickGrid" class="lab-grid mt-16"></div>' +
          '<p class="tiny muted mt-12">点击卡片加入或移出意向；已满名额的实训室仍可选择，其录取结果取决于面试与递补情况。</p>' +
        '</div>' +
        '<div style="position:sticky;top:88px">' +
          '<div class="card">' +
            '<div class="card-head"><h3>已选意向</h3><span class="badge brand" id="pickedCount">' + picked.length + '/3</span></div>' +
            '<div class="card-body" id="pickedList"></div>' +
            '<div class="card-foot" style="display:block">' +
              '<button class="btn btn-primary btn-block" id="submitBtn">提交意向</button>' +
              '<p class="tiny muted center mt-8">提交后仍可修改，截止前以最后一次为准</p>' +
            '</div>' +
          '</div>' +
          '<div class="card mt-16">' +
            '<div class="card-head"><h3>调剂意愿</h3><span class="badge plain">必选</span></div>' +
            '<div class="card-body" style="display:grid;gap:14px">' +
              '<label class="switch" style="align-items:flex-start;gap:10px">' +
                '<input type="checkbox" id="swInternal" ' + (internal ? 'checked' : '') + ' /><span class="track" style="margin-top:2px"></span>' +
                '<span><b>服从实训室内部调剂</b><span class="tiny muted" style="display:block">未被本室录取时，可被同实训室其他导师/方向接收</span></span>' +
              '</label>' +
              '<label class="switch" style="align-items:flex-start;gap:10px">' +
                '<input type="checkbox" id="swCross" ' + (cross ? 'checked' : '') + ' /><span class="track" style="margin-top:2px"></span>' +
                '<span><b>服从全院跨实训室调剂</b><span class="tiny muted" style="display:block">第三轮补录后仍未被录取时，可被其他实训室接收</span></span>' +
              '</label>' +
              '<div class="alert warn" style="padding:10px 12px"><span class="ico">!</span><div>两个选项默认不勾选。不勾选 = 只接受本人志愿的录取结果，不进入调剂池。</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="field mt-16"><label for="intro">一句话自我介绍（选填）</label>' +
            '<textarea class="textarea" id="intro" maxlength="200" placeholder="例如：做过一个基于 YOLO 的缺陷检测小项目，希望继续深入视觉方向。">' + U.esc(app ? app.intro || '' : '') + '</textarea>' +
            '<span class="desc">最多 200 字，供导师面试前快速了解你。</span></div>' +
        '</div>' +
      '</div>' +
      '</div>';

    const grid = host.querySelector('#pickGrid');
    const pickedList = host.querySelector('#pickedList');
    const countEl = host.querySelector('#pickedCount');

    let dirFilter = 'all';
    function paintList() {
      const arr = labs.filter((l) => {
        if (dirFilter !== 'all' && l.direction.indexOf(dirFilter) !== 0) return false;
        if (!q) return true;
        return (l.name + l.direction + l.teacher.name).toLowerCase().indexOf(q.toLowerCase()) >= 0;
      });
      grid.innerHTML = arr.length ? arr.map((l, i) => labCard(l, i, { pick: true, selected: picked.indexOf(l.id) >= 0 })).join('')
        : '<div class="empty" style="grid-column:1/-1"><span class="ico">∅</span><b>没有匹配的实训室</b></div>';
    }

    function paintPicked() {
      countEl.textContent = picked.length + '/3';
      if (!picked.length) {
        pickedList.innerHTML = '<p class="small muted">还没有选择意向，从左侧点击卡片加入。</p>';
      } else {
        pickedList.innerHTML = picked.map((id, i) => {
          const l = labs.find((x) => x.id === id);
          if (!l) return '';
          return '<div class="kitem" style="margin-bottom:8px"><span class="rk">' + (i + 1) + '</span>' +
            '<div style="min-width:0"><div class="kname">' + U.esc(l.name) + '</div>' +
            '<div class="tiny muted">' + U.esc(l.direction) + '</div></div>' +
            '<button class="kops btn-link danger" style="margin-left:auto" data-remove="' + id + '">移除</button></div>';
        }).join('') +
        '<p class="tiny muted mt-8">三个意向地位相同，导师看不到你的选择顺序。</p>';
      }
      host.querySelector('#submitBtn').classList.toggle('is-disabled', picked.length === 0);
    }

    let q = '';
    host.querySelector('#q').addEventListener('input', (e) => { q = e.target.value.trim(); paintList(); });
    host.querySelector('#dir').addEventListener('change', (e) => {
      dirFilter = e.target.value;
      paintList();
    });
    host.querySelector('#swInternal').addEventListener('change', (e) => { internal = e.target.checked; });
    host.querySelector('#swCross').addEventListener('change', (e) => { cross = e.target.checked; });

    host.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove]');
      if (rm) {
        const id = rm.getAttribute('data-remove');
        picked = picked.filter((x) => x !== id);
        recolor();
        paintPicked();
        return;
      }
      const card = e.target.closest('[data-lab]');
      if (!card || !grid.contains(card)) return;
      const id = card.getAttribute('data-lab');
      const i = picked.indexOf(id);
      if (i >= 0) picked.splice(i, 1);
      else if (picked.length >= 3) {
        U.toast('最多 3 个意向', '请先移除一个再添加', 'warn');
        return;
      } else picked.push(id);
      recolor();
      paintPicked();
    });

    function recolor() {
      grid.querySelectorAll('[data-lab]').forEach((el) => {
        el.classList.toggle('selected', picked.indexOf(el.getAttribute('data-lab')) >= 0);
      });
    }

    host.querySelector('#submitBtn').addEventListener('click', () => {
      if (!picked.length) { U.toast('还没有选择意向', '至少选择 1 个实训室', 'warn'); return; }
      const chosen = picked.map((id) => labs.find((l) => l.id === id)).filter(Boolean);
      const body =
        '<div class="alert brand" style="margin-bottom:12px"><span class="ico">i</span><div>请确认以下内容。提交后仍可在截止前修改，系统以最后一次提交为准。</div></div>' +
        '<div style="display:grid;gap:8px">' +
          chosen.map((l, i) => '<div class="kitem"><span class="rk">' + (i + 1) + '</span><div><div class="kname">' + U.esc(l.name) + '</div>' +
            '<div class="tiny muted">' + U.esc(l.direction) + ' · ' + U.esc(l.teacher.name) + '</div></div></div>').join('') +
        '</div>' +
        '<dl class="kv mt-16">' +
          '<dt>内部调剂</dt><dd>' + (internal ? '服从' : '不服从') + '</dd>' +
          '<dt>跨室调剂</dt><dd>' + (cross ? '服从' : '不服从') + '</dd>' +
          '<dt>自我介绍</dt><dd>' + (host.querySelector('#intro').value.trim() ? '已填写' : '未填写') + '</dd>' +
        '</dl>' +
        '<p class="tiny muted mt-12">三个意向不排序，导师端看到的是一组平行意向。</p>';
      U.dialog({
        title: '确认提交意向',
        desc: '提交后可在截止前再次修改',
        body,
        confirmText: '确认提交',
        onConfirm: async () => {
          const r = await S.apply({
            labs: picked.slice(),
            internal, cross,
            intro: host.querySelector('#intro').value.trim()
          });
          if (r.error) { U.toast('提交失败', r.error, 'danger'); return false; }
          U.toast('提交成功', '已记录 ' + picked.length + ' 个平行意向', 'ok');
          App.go('/s/result');
          return true;
        }
      });
    });

    paintList();
    paintPicked();
  };

  /* ---------- 面试安排 ---------- */
  V.studentInterview = function (host) {
    const ivs = S.myInterviews().sort((a, b) => a.at - b.at);
    const done = ivs.filter((x) => x.status === 'done').length;
    const conflict = ivs.some((a, i) => ivs.some((b, j) => i !== j && a.at === b.at));

    host.innerHTML =
      '<div class="page-head"><div><h1>面试安排</h1><p>' + (ivs.length ? '共 ' + ivs.length + ' 场面试，已完成 ' + done + ' 场。请提前 10 分钟到达面试地点。' : '面试由实训室统一组织，安排完成后会出现在这里。') + '</p></div></div>' +
      (conflict ? '<div class="alert warn"><span class="ico">!</span><div><b>时间冲突提醒：</b>你有多个意向被安排在同一时段，请联系学院教务协调（系统已同步标记该冲突）。</div></div>' : '') +
      (ivs.length
        ? '<div class="card mt-16"><div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>实训室</th><th>面试时间</th><th>地点</th><th>状态</th><th class="right">查看</th></tr></thead><tbody>' +
          ivs.map((iv) => {
            const lab = S.labs().find((l) => l.id === iv.labId);
            const badge = iv.status === 'done' ? '<span class="badge ok">已完成</span>' : '<span class="badge warn">待面试</span>';
            return '<tr><td><div class="cell-main">' + U.esc(lab ? lab.name : iv.labId) + '</div>' +
              '<span class="cell-sub">' + U.esc(lab ? lab.direction : '') + '</span></td>' +
              '<td class="num">' + U.fmt(iv.at) + '</td>' +
              '<td>' + U.esc(iv.room) + '</td>' +
              '<td>' + badge + '</td>' +
              '<td class="right"><button class="btn-link" data-iv="' + iv.id + '">详情</button></td></tr>';
          }).join('') +
          '</tbody></table></div></div>' +
          '<div class="alert info mt-16"><span class="ico">i</span><div>面试成绩与排名<b>不对外公布</b>，仅用于实训室录取排序。缺席面试视为放弃本轮录取资格。</div></div>'
        : '<div class="empty mt-16"><span class="ico">◷</span><b>暂无面试安排</b><p>面试窗口 ' + U.fmtRange(S.get().cycle.stages[3].start, S.get().cycle.stages[3].end) + '，请留意通知。</p></div>');

    host.addEventListener('click', (e) => {
      const b = e.target.closest('[data-iv]');
      if (!b) return;
      const iv = S.interviews().find((x) => x.id === b.getAttribute('data-iv'));
      const lab = S.labs().find((l) => l.id === iv.labId);
      U.dialog({
        title: '面试详情',
        body: '<dl class="kv">' +
          '<dt>实训室</dt><dd>' + U.esc(lab.name) + '</dd>' +
          '<dt>时间</dt><dd>' + U.fmt(iv.at) + '</dd>' +
          '<dt>地点</dt><dd>' + U.esc(iv.room) + '</dd>' +
          '<dt>状态</dt><dd>' + (iv.status === 'done' ? '已完成' : '待面试') + '</dd>' +
          '<dt>考察维度</dt><dd>学习态度 · 逻辑思维 · 编程基础 · 沟通表达</dd>' +
          '</dl><p class="tiny muted mt-12">请携带学生证；如需调整时间，请提前联系实训室导师。</p>',
        confirmText: '知道了',
        hideCancel: true
      });
    });
  };

  /* ---------- 结果与确认 ---------- */
  V.studentResult = function (host) {
    const m = S.me();
    const idx = S.stageIndex();
    const offers = S.myOffers();
    const conf = S.myConfirmation();
    const stage4 = S.get().cycle.stages[4];
    const myAccepts = S.nominations().filter((n) => n.no === m.id && n.type === 'accept' && !n.status);
    offers.forEach((o) => {
      const n = myAccepts.find((x) => x.labId === o.lab.id);
      o.deadline = n ? n.deadline : null;
    });
    const offerDeadline = offers.reduce((min, o) => (o.deadline && (!min || o.deadline < min) ? o.deadline : min), null);
    const expired = S.nominations().filter((n) => n.no === m.id && n.status === 'expired').length;

    let inner = '';

    if (conf) {
      inner =
        '<div class="receipt">' +
          '<div class="r-head"><span class="ic">✓</span><div><b>已确认加入 ' + U.esc(conf.lab.name) + '</b>' +
          '<span>' + U.esc(conf.lab.direction) + ' · ' + U.esc(conf.lab.room) + '</span></div></div>' +
          '<div class="r-body">' +
            '<div class="r-row"><span>录取方式</span><b>' + U.sourceLabel(conf.source) + '</b></div>' +
            '<div class="r-row"><span>实训室导师</span><b>' + U.esc(conf.lab.teacher.name) + ' · ' + U.esc(conf.lab.teacher.title) + '</b></div>' +
            '<div class="r-row"><span>确认时间</span><b>' + U.fmt(conf.at) + '</b></div>' +
            '<div class="r-row"><span>入组方式</span><b>等待学院公示后正式入组（' + U.fmt(S.get().cycle.stages[7].start) + ' 起公示 1 天）</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="alert ok mt-16"><span class="ico">✓</span><div><b>下一步：</b>关注公示名单，公示无异议后正式加入实训室开展 AI+PB 项目实训。请留意实训室群通知。</div></div>' +
        '<div class="flex gap-8 mt-16"><a class="btn btn-ghost" href="#/s/home">返回首页</a><a class="btn btn-soft" href="#/s/publicity">查看公示</a></div>';
    } else if (idx < 4) {
      inner =
        '<div class="card card-pad center" style="padding:44px 24px">' +
          '<div style="font-size:34px;color:var(--muted-2)">◷</div>' +
          '<h3 class="mt-12" style="font-size:17px">结果尚未公布</h3>' +
          '<p class="muted mt-8">拟录取结果将于 <b>' + U.fmt(stage4.start) + '</b> 公布，并同时开启双选确认窗口（至 ' + U.fmt(stage4.end) + '）。</p>' +
          '<p class="tiny muted mt-8">当前环节：' + U.esc(S.get().cycle.stages[Math.max(0, idx)].label) + ' · 倒计时 <span data-cd="clock">' + U.durClock(S.countdown().ms) + '</span></p>' +
          '<div class="mt-16"><a class="btn btn-ghost btn-sm" href="#/s/interview">查看我的面试</a></div>' +
        '</div>';
    } else if (offers.length === 0) {
      inner =
        '<div class="empty" style="padding:44px 24px"><span class="ico">∅</span><b>' + (expired ? '意向已逾期释放' : '本轮未获得拟录取意向') + '</b>' +
          '<p>' + (expired
            ? '你在 ' + U.fmt(stage4.end) + ' 前未完成选择，系统已按规则释放名额并由递补学生补位。'
            : '可以参加后续补录轮次，补录时间 ' + U.fmtRange(S.get().cycle.stages[5].start, S.get().cycle.stages[5].end) + '。') + '</p>' +
          '<div class="flex gap-8"><a class="btn btn-soft btn-sm" href="#/s/supplement">查看补录名额</a><a class="btn btn-ghost btn-sm" href="#/s/home">返回首页</a></div></div>';
    } else if (offers.length === 1) {
      const o = offers[0];
      inner =
        '<div class="alert ok"><span class="ico">✓</span><div><b>你只收到 1 个拟录取意向</b>，系统已自动确认，无需任何操作。</div></div>' +
        '<div class="receipt mt-16"><div class="r-head"><span class="ic">✓</span><div><b>' + U.esc(o.lab.name) + '</b><span>自动确认</span></div></div>' +
        '<div class="r-body"><div class="r-row"><span>导师</span><b>' + U.esc(o.lab.teacher.name) + '</b></div>' +
        '<div class="r-row"><span>方向</span><b>' + U.esc(o.lab.direction) + '</b></div>' +
        '<div class="r-row"><span>确认时间</span><b>' + (conf ? U.fmt(conf.at) : '—') + '</b></div></div></div>';
    } else {
      inner =
        '<div class="alert brand"><span class="ico">✦</span><div><b>你收到 ' + offers.length + ' 个拟录取意向</b>，请在 <b>' + U.fmt(offerDeadline || stage4.end) + '</b> 前选择唯一去向。' +
        (offerDeadline ? '其中含补位意向：补位成功后须在 2 小时内确认。' : '') +
        '选择后其余意向将立即释放给递补学生，且不可撤销。倒计时：<b><span data-cd="clock">' + U.durClock(S.countdown().ms) + '</span></b></div></div>' +
        '<div class="grid grid-side mt-16"><div>' +
          '<div class="offer-list" id="offers">' +
            offers.map((o) => '<div class="offer" data-offer="' + o.lab.id + '" role="radio" tabindex="0" aria-checked="false">' +
              '<span class="radio"></span>' +
              '<div class="o-body"><h4>' + U.esc(o.lab.name) + '</h4>' +
              '<p class="o-sub">' + U.esc(o.lab.direction) + '</p>' +
              '<div class="o-meta"><span>导师 ' + U.esc(o.lab.teacher.name) + '</span><span>名额 ' + o.lab.quota + ' 人</span><span>' + U.esc(o.lab.room) + '</span></div>' +
              (o.deadline ? '<p class="tiny" style="color:var(--warn);margin-top:6px">补位确认截止 ' + U.fmt(o.deadline) + '</p>' : '') + '</div>' +
              '<span class="badge ok">拟录取</span></div>').join('') +
          '</div>' +
          '<p class="tiny muted mt-12">三个意向地位平等，系统不记录你的选择先后；同一实训室可能同时向多名学生发出意向。</p>' +
        '</div>' +
        '<div style="position:sticky;top:88px">' +
          '<div class="card"><div class="card-head"><h3>确认去向</h3></div>' +
            '<div class="card-body"><p class="small muted" id="pickHint">尚未选择</p>' +
            '<div class="mt-12" id="pickBox"></div></div>' +
            '<div class="card-foot" style="display:block"><button class="btn btn-primary btn-block" id="confirmBtn" disabled>确认并锁定</button>' +
            '<p class="tiny muted center mt-8">确认后不可撤销，请谨慎选择</p></div></div>' +
          '<div class="alert warn mt-16"><span class="ico">!</span><div>截止 ' + U.fmt(stage4.end) + ' 未确认，将视为<b>放弃全部拟录取意向</b>，名额释放给递补名单。</div></div>' +
        '</div></div>';
    }

    host.innerHTML =
      '<div class="page-head"><div><h1>录取结果与确认</h1><p>' +
        (idx < 4 ? '面试考核进行中' : '双选确认窗口 ' + U.fmtRange(stage4.start, stage4.end)) + '</p></div>' +
        '<div class="spacer"></div><div class="page-actions"><a class="btn btn-ghost btn-sm" href="#/s/labs">实训室一览</a></div></div>' + inner;

    if (offers.length >= 2 && !conf && idx === 4) {
      let selected = null;
      const rows = host.querySelectorAll('[data-offer]');
      const box = host.querySelector('#pickBox');
      const btn = host.querySelector('#confirmBtn');
      rows.forEach((row) => {
        const pick = () => {
          selected = row.getAttribute('data-offer');
          rows.forEach((r) => {
            r.classList.toggle('selected', r === row);
            r.setAttribute('aria-checked', r === row ? 'true' : 'false');
          });
          const lab = offers.find((o) => o.lab.id === selected).lab;
          host.querySelector('#pickHint').innerHTML = '已选择：<b>' + U.esc(lab.name) + '</b>';
          box.innerHTML = '<div class="kitem"><span class="rk">✓</span><div><div class="kname">' + U.esc(lab.name) + '</div>' +
            '<div class="tiny muted">' + U.esc(lab.direction) + '</div></div></div>';
          btn.disabled = false;
        };
        row.addEventListener('click', pick);
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      });
      btn.addEventListener('click', async () => {
        if (!selected) return;
        const lab = offers.find((o) => o.lab.id === selected).lab;
        const others = offers.filter((o) => o.lab.id !== selected).map((o) => o.lab.name);
        const ok = await U.confirm({
          title: '确认加入 ' + lab.name + '？',
          body: '<p>确认后：</p><ul class="rules mt-8">' +
            '<li>你与「' + U.esc(lab.name) + '」的录取关系立即锁定，<b>不可撤销</b>；</li>' +
            '<li>其余 ' + others.length + ' 个意向（' + U.esc(others.join('、')) + '）将被释放给递补学生；</li>' +
            '<li>请留意后续公示与入组通知。</li></ul>',
          confirmText: '确认并锁定',
          danger: false
        });
        if (!ok) return;
        const r = await S.confirmOffer(lab.id);
        if (r.error) { U.toast('确认失败', r.error, 'danger'); return; }
        U.toast('确认成功', '你已加入「' + lab.name + '」', 'ok');
        App.render();
      });
    }
  };

  /* ---------- 补录 ---------- */
  V.studentSupplement = function (host) {
    const idx = S.stageIndex();
    const st = S.get();
    const labs = S.labs().map((l) => S.labStats(l.id)).filter((x) => x.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
    const conf = S.myConfirmation();

    host.innerHTML =
      '<div class="page-head"><div><h1>分轮补录</h1><p>第二轮、第三轮共用窗口 ' + U.fmtRange(st.cycle.stages[5].start, st.cycle.stages[5].end) + '，补录学生由实训室重新面试后双向确认。</p></div></div>' +
      (conf
        ? '<div class="alert ok"><span class="ico">✓</span><div>你已确认加入「' + U.esc(conf.lab.name) + '」，无需参加补录。</div></div>'
        : idx < 5
          ? '<div class="alert info"><span class="ico">i</span><div>补录窗口尚未开启，开启后剩余名额将在此公布。当前状态：<b>' + U.esc(st.cycle.stages[Math.max(0, idx)].label) + '</b>。</div></div>'
          : '<div class="alert brand"><span class="ico">✦</span><div>补录按轮进行：第一轮释出的名额会先由<b>递补名单</b>顺位补位，补位后仍空出的名额进入下一轮公开填报。</div></div>') +
      '<div class="card mt-16"><div class="card-head"><h3>当前剩余名额</h3><span class="badge ' + (labs.length ? 'ok' : 'plain') + '">' + labs.length + ' 个实训室有名额</span></div>' +
      (labs.length
        ? '<div class="table-wrap"><table class="table"><thead><tr><th>实训室</th><th>方向</th><th>导师</th><th>名额</th><th>已占用</th><th>剩余</th><th class="right">状态</th></tr></thead><tbody>' +
          labs.map((x) => '<tr><td><div class="cell-main">' + U.esc(x.lab.name) + '</div><span class="cell-sub">' + U.esc(x.lab.room) + '</span></td>' +
            '<td>' + U.esc(x.lab.direction) + '</td><td>' + U.esc(x.lab.teacher.name) + '</td>' +
            '<td class="num">' + x.quota + '</td><td class="num">' + x.taken + '</td>' +
            '<td><span class="badge ok">' + x.remaining + '</span></td>' +
            '<td class="right">' + (idx >= 5 && idx <= 6 ? '<span class="badge info">可填报</span>' : '<span class="badge plain">未开放</span>') + '</td></tr>').join('') +
          '</tbody></table></div>'
        : '<div class="empty" style="border:0;background:#fff"><span class="ico">✓</span><b>名额已全部招满</b><p>所有实训室均已完成录取。</p></div>') +
      '</div>' +
      '<div class="grid grid-2 mt-16">' +
        '<div class="card card-pad"><h3 style="font-size:14px">补录规则</h3><ul class="rules mt-12">' +
          '<li>仅<b>本轮未录取</b>的学生可填报，已确认的学生不参与。</li>' +
          '<li>只能填报仍有剩余名额的实训室，仍为最多 3 个平行意向。</li>' +
          '<li>补录面试可复用上轮成绩，由导师决定是否重面。</li>' +
          '<li>第二轮结束仍有空缺，自动进入第三轮；三轮结束后进入统筹调剂。</li></ul></div>' +
        '<div class="card card-pad"><h3 style="font-size:14px">我的状态</h3>' +
          '<dl class="kv mt-12"><dt>当前环节</dt><dd>' + U.esc(st.cycle.stages[Math.max(0, idx)].label) + '</dd>' +
          '<dt>我的去向</dt><dd>' + (conf ? U.esc(conf.lab.name) : '尚未确定') + '</dd>' +
          '<dt>调剂意愿</dt><dd>' + (S.myApp() ? (S.myApp().internal ? '服从内部' : '不服从内部') + ' / ' + (S.myApp().cross ? '服从跨室' : '不服从跨室') : '未填报') + '</dd></dl>' +
          '<p class="tiny muted mt-12">演示版补录为名额与规则展示，正式版将开放填报与确认操作。</p></div>' +
      '</div>';
  };

  /* ---------- 公示 ---------- */
  V.studentPublicity = function (host) {
    const st = S.get();
    const pub = st.publicity;
    const pager = { page: 1, size: 10 };
    const rows = pub.publishedAt ? S.publicityRows() : [];

    if (!pub.publishedAt) {
      host.innerHTML =
        '<div class="page-head"><div><h1>结果公示</h1><p>公示期为 1 天，公示无异议后学生正式加入实训室。</p></div></div>' +
        '<div class="empty" style="padding:52px 24px"><span class="ico">◎</span><b>公示尚未发布</b>' +
          '<p>学院汇总最终录取名单后发布，计划于 ' + U.fmt(st.cycle.stages[7].start) + ' 开始公示，持续 1 天。</p>' +
          '<a class="btn btn-ghost btn-sm" href="#/s/home">返回首页</a></div>';
      return;
    }

    host.innerHTML =
      '<div class="page-head"><div><h1>录取结果公示</h1><p>' + U.fmt(pub.publishedAt) + ' 发布 · 公示至 ' + U.fmt(pub.until) + ' · 共 ' + rows.length + ' 人</p></div>' +
      '<div class="spacer"></div><div class="page-actions"><button class="btn btn-ghost btn-sm" id="objBtn">提交异议</button></div></div>' +
      '<div class="alert info"><span class="ico">i</span><div>公示仅展示姓名、学号后四位与录取去向，<b>不公布面试成绩与排名</b>。如对结果有异议，请在公示期内提交。</div></div>' +
      '<div class="card mt-16"><div class="table-wrap"><table class="table"><thead><tr><th>姓名</th><th>学号</th><th>录取实训室</th><th>录取方式</th><th>确认时间</th></tr></thead><tbody id="pubBody"></tbody></table></div><div id="pubPager"></div></div>';

    function paint() {
      host.querySelector('#pubBody').innerHTML = U.slice(rows, pager).map((r) => '<tr>' +
        '<td><div class="cell-main">' + U.esc(r.name) + '</div></td>' +
        '<td class="num">' + U.esc(r.masked) + '</td>' +
        '<td>' + U.esc(r.lab) + '<span class="cell-sub">' + U.esc(r.direction) + '</span></td>' +
        '<td><span class="badge ' + (r.source === 'auto' ? 'info' : r.source === 'choice' ? 'ok' : 'brand') + '">' + U.sourceLabel(r.source) + '</span></td>' +
        '<td class="num">' + U.fmt(r.at) + '</td></tr>').join('') ||
        '<tr><td colspan="5"><div class="empty" style="border:0">暂无记录</div></td></tr>';
      host.querySelector('#pubPager').innerHTML = U.pager('pub', pager, rows.length);
    }
    U.usePager(host, 'pub', pager, paint);
    paint();

    host.querySelector('#objBtn').addEventListener('click', () => {
      U.dialog({
        title: '提交异议',
        desc: '异议将转交学院选拔工作组线下核实',
        body: '<div class="field"><label for="objText">异议内容</label><textarea class="textarea" id="objText" placeholder="请说明具体问题，例如：名单中我的去向与实际确认不一致…"></textarea></div>',
        confirmText: '提交',
        onConfirm: async (mask) => {
          const text = mask.querySelector('#objText').value.trim();
          if (text.length < 5) { U.toast('内容太短', '至少填写 5 个字', 'warn'); return false; }
          const r = await S.objection(text);
          if (r.error) { U.toast('提交失败', r.error, 'danger'); return false; }
          U.toast('已提交', '学院会在公示期内联系你', 'ok');
          return true;
        }
      });
    });
  };
})();
