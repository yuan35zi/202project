/* ==========================================================================
   路由与外壳：侧边导航、顶部状态条、演示阶段切换、倒计时
   ========================================================================== */
(function () {
  const App = window.App, U = App.U, S = App.Store;
  const HOME = { student: '/s/home', teacher: '/t/home', admin: '/a/home' };

  const ROUTES = [
    { p: '/login', v: 'login', t: '登录', noShell: true },

    { p: '/s/home', v: 'studentHome', t: '我的首页', g: '我的选拔', role: 'student' },
    { p: '/s/labs', v: 'studentLabs', t: '实训室一览', g: '我的选拔', role: 'student' },
    { p: '/s/lab/:id', v: 'studentLab', t: '实训室详情', g: '我的选拔', role: 'student' },
    { p: '/s/apply', v: 'studentApply', t: '意向填报', g: '我的选拔', role: 'student' },
    { p: '/s/interview', v: 'studentInterview', t: '面试安排', g: '我的选拔', role: 'student' },
    { p: '/s/result', v: 'studentResult', t: '结果与确认', g: '录取与公示', role: 'student' },
    { p: '/s/supplement', v: 'studentSupplement', t: '分轮补录', g: '录取与公示', role: 'student' },
    { p: '/s/publicity', v: 'studentPublicity', t: '结果公示', g: '录取与公示', role: 'student' },

    { p: '/t/home', v: 'teacherHome', t: '工作台', g: '导师工作台', role: 'teacher' },
    { p: '/t/applicants', v: 'teacherApplicants', t: '报名名单', g: '选拔操作', role: 'teacher' },
    { p: '/t/applicants/:id', v: 'teacherApplicants', t: '报名名单', g: '选拔操作', role: 'teacher' },
    { p: '/t/schedule', v: 'teacherSchedule', t: '面试排期', g: '选拔操作', role: 'teacher' },
    { p: '/t/schedule/:id', v: 'teacherSchedule', t: '面试排期', g: '选拔操作', role: 'teacher' },
    { p: '/t/scoring/:id/:no', v: 'teacherScoring', t: '面试评分', g: '选拔操作', role: 'teacher' },
    { p: '/t/nominations', v: 'teacherNominations', t: '拟定名单', g: '录取管理', role: 'teacher' },
    { p: '/t/nominations/:id', v: 'teacherNominations', t: '拟定名单', g: '录取管理', role: 'teacher' },
    { p: '/t/progress', v: 'teacherProgress', t: '确认进度', g: '录取管理', role: 'teacher' },
    { p: '/t/progress/:id', v: 'teacherProgress', t: '确认进度', g: '录取管理', role: 'teacher' },

    { p: '/a/home', v: 'adminHome', t: '选拔总览', g: '学院管理', role: 'admin' },
    { p: '/a/cycle', v: 'adminCycle', t: '批次与日程', g: '配置', role: 'admin' },
    { p: '/a/labs', v: 'adminLabs', t: '实训室与名额', g: '配置', role: 'admin' },
    { p: '/a/students', v: 'adminStudents', t: '学生名单', g: '配置', role: 'admin' },
    { p: '/a/interview', v: 'adminInterview', t: '面试统筹', g: '执行监控', role: 'admin' },
    { p: '/a/board', v: 'adminBoard', t: '录取看板', g: '执行监控', role: 'admin' },
    { p: '/a/allocate', v: 'adminAllocate', t: '统筹调剂池', g: '执行监控', role: 'admin' },
    { p: '/a/publicity', v: 'adminPublicity', t: '公示与入组', g: '收尾', role: 'admin' },
    { p: '/a/audit', v: 'adminAudit', t: '审计日志', g: '收尾', role: 'admin' }
  ];

  const NAV = {
    student: [
      { g: '我的选拔', items: [['/s/home', '首页', '总'], ['/s/labs', '实训室', '室'], ['/s/apply', '意向填报', '填'], ['/s/interview', '面试安排', '面']] },
      { g: '录取与公示', items: [['/s/result', '结果确认', '果'], ['/s/supplement', '分轮补录', '补'], ['/s/publicity', '结果公示', '示']] }
    ],
    teacher: [
      { g: '导师工作台', items: [['/t/home', '工作台', '台']] },
      { g: '选拔操作', items: [['/t/applicants', '报名名单', '单'], ['/t/schedule', '面试排期', '期'], ['/t/nominations', '拟定名单', '录'], ['/t/progress', '确认进度', '度']] }
    ],
    admin: [
      { g: '学院管理', items: [['/a/home', '选拔总览', '览']] },
      { g: '配置', items: [['/a/cycle', '批次日程', '程'], ['/a/labs', '名额配置', '额'], ['/a/students', '学生名单', '生']] },
      { g: '执行监控', items: [['/a/interview', '面试统筹', '面'], ['/a/board', '录取看板', '板'], ['/a/allocate', '调剂池', '调']] },
      { g: '收尾', items: [['/a/publicity', '公示入组', '示'], ['/a/audit', '审计日志', '审']] }
    ]
  };

  const ROLE_LABEL = { student: '学生', teacher: '导师', admin: '学院管理员' };

  /* ---------- 路由解析 ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/login';
    const parts = raw.split('?');
    const path = parts[0] || '/login';
    const query = {};
    (parts[1] || '').split('&').filter(Boolean).forEach((kv) => {
      const i = kv.indexOf('=');
      const k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
      const v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
      query[k] = v;
    });
    const segs = path.split('/').filter(Boolean);
    for (const r of ROUTES) {
      const rs = r.p.split('/').filter(Boolean);
      if (rs.length !== segs.length) continue;
      let ok = true;
      const params = [];
      for (let i = 0; i < rs.length; i++) {
        if (rs[i].charAt(0) === ':') params.push(decodeURIComponent(segs[i]));
        else if (rs[i] !== segs[i]) { ok = false; break; }
      }
      if (ok) return { route: r, params, query, path };
    }
    return { route: null, params: [], query, path };
  }

  App.go = function (path) {
    if (location.hash === '#' + path) { render(); return; }
    location.hash = '#' + path;
  };

  /* ---------- 外壳 ---------- */
  function sidebarHtml(me, path) {
    const groups = NAV[me.role];
    return '' +
      '<div class="brand"><div class="brand-mark">进</div>' +
        '<div class="brand-text"><b>进组选拔</b><span>LAB SELECTION</span></div></div>' +
      '<div class="cycle-chip"><b>' + U.esc(S.get().cycle.name) + '</b>' +
        '<span>当前：' + U.esc(S.get().cycle.stages[Math.max(0, Math.min(7, S.stageIndex()))].short) + '</span>' +
        '<span class="dotline"><i></i> 系统运行中</span></div>' +
      '<nav class="nav">' + groups.map((g) =>
        '<div class="nav-group"><span>' + U.esc(g.g) + '</span>' +
        g.items.map(([href, label, ico]) => {
          const active = path === href || path.indexOf(href + '/') === 0;
          return '<a href="#' + href + '" class="' + (active ? 'active' : '') + '" data-nav>' +
            '<i class="ico">' + ico + '</i>' + label + '</a>';
        }).join('') + '</div>').join('') + '</nav>' +
      '<div class="sidebar-foot">' +
        '<div class="who"><span class="avatar">' + U.esc(me.name.slice(0, 1)) + '</span>' +
          '<div style="min-width:0"><b>' + U.esc(me.name) + '</b><span>' + ROLE_LABEL[me.role] + (me.cls ? ' · ' + U.esc(me.cls) : '') + '</span></div></div>' +
        '<button class="sidebar-link" id="resetBtn"><span>重置演示数据</span><span>↻</span></button>' +
        '<button class="sidebar-link" id="logoutBtn"><span>退出登录</span><span>⎋</span></button>' +
      '</div>';
  }

  function topbarHtml(me, route, params) {
    const idx = S.stageIndex();
    const stage = S.get().cycle.stages[Math.max(0, Math.min(7, idx))];
    const cd = S.countdown();
    const cdText = cd.phase === 'active' ? U.durClock(cd.ms) : (cd.phase === 'before' ? '待开始' : '已结束');
    const crumbGroup = route.g ? '<span class="group">' + U.esc(route.g) + '</span><span class="sep">/</span>' : '';
    return '' +
      '<button class="icon-btn hamburger" id="menuBtn" aria-label="打开菜单">≡</button>' +
      '<div class="crumb">' + crumbGroup + '<b>' + U.esc(route.t) + '</b></div>' +
      '<div class="topbar-right">' +
        '<div class="stage-pill ' + (cd.phase === 'active' ? '' : 'closed') + '">' +
          '<span class="num" style="background:var(--s' + (Math.max(0, idx) + 1) + ')">' + (Math.max(1, idx + 1)) + '</span>' +
          '<span class="label">' + U.esc(stage.short) + '</span>' +
          '<span class="cd">' + (cd.phase === 'active' ? '剩余 <b data-cd="clock">' + cdText + '</b>' : cdText) + '</span>' +
        '</div>' +
        (me.role === 'student' ? '' :
          '<select class="demo-select" id="stageSelect" aria-label="切换演示阶段">' +
          S.get().cycle.stages.map((s, i) => '<option value="' + i + '"' + (i === idx ? ' selected' : '') + '>' + (i + 1) + '. ' + U.esc(s.short) + '</option>').join('') +
          '</select>') +
        '<button class="icon-btn" id="refreshBtn" aria-label="刷新">⟳</button>' +
      '</div>';
  }

  /* ---------- 渲染 ---------- */
  function render() {
    const parsed = parseHash();
    const viewEl = document.getElementById('view');
    const sideEl = document.getElementById('sidebar');
    const topEl = document.getElementById('topbar');

    if (!parsed.route) {
      const me = S.me();
      location.hash = '#' + (me ? HOME[me.role] : '/login');
      return;
    }
    const route = parsed.route;

    if (route.noShell) {
      const me = S.me();
      if (me) { location.hash = '#' + HOME[me.role]; return; }
      document.getElementById('app').classList.add('is-login');
      sideEl.style.display = 'none';
      topEl.style.display = 'none';
      viewEl.style.padding = '0';
      viewEl.innerHTML = '';
      const host = document.createElement('div');
      viewEl.appendChild(host);
      App.Views[route.v](host, parsed);
      return;
    }

    const me = S.me();
    if (!me) { location.hash = '#/login'; return; }
    if (route.role && me.role !== route.role) { location.hash = '#' + HOME[me.role]; return; }

    document.getElementById('app').classList.remove('is-login');
    sideEl.style.display = '';
    topEl.style.display = '';
    viewEl.style.padding = '';

    document.title = route.t + ' · 实训室进组选拔系统';
    sideEl.innerHTML = sidebarHtml(me, parsed.path);
    topEl.innerHTML = topbarHtml(me, route, parsed.params);

    viewEl.innerHTML = '';
    const host = document.createElement('div');
    viewEl.appendChild(host);

    try {
      const fn = App.Views[route.v];
      if (!fn) throw new Error('页面未实现：' + route.v);
      fn(host, parsed);
    } catch (err) {
      console.error(err);
      host.innerHTML = '<div class="empty"><span class="ico">!</span><b>页面渲染出错</b><p>' + U.esc(err.message) + '</p>' +
        '<button class="btn btn-ghost btn-sm" onclick="location.reload()">刷新页面</button></div>';
    }
    window.scrollTo(0, 0);
    bindShell(me);
    lastStage = S.stageIndex();
  }

  App.render = render;

  /* ---------- 外壳交互 ---------- */
  function bindShell(me) {
    const side = document.getElementById('sidebar');
    const mask = document.getElementById('sidebarMask');
    const menu = document.getElementById('menuBtn');

    if (menu) menu.addEventListener('click', () => {
      side.classList.add('open');
      mask.hidden = false;
      mask.classList.add('show');
    });
    const closeMenu = () => {
      side.classList.remove('open');
      mask.classList.remove('show');
      mask.hidden = true;
    };
    if (mask) mask.addEventListener('click', closeMenu);
    side.querySelectorAll('[data-nav]').forEach((a) => a.addEventListener('click', closeMenu));

    const logout = side.querySelector('#logoutBtn');
    if (logout) logout.addEventListener('click', async () => {
      await S.logout();
      history.replaceState(null, '', location.pathname);
      if (location.hash === '#/login') render();
      else location.hash = '#/login';
    });

    const reset = side.querySelector('#resetBtn');
    if (reset) reset.addEventListener('click', async () => {
      const ok = await U.confirm({
        title: '重置演示数据？',
        desc: '将清空数据库中的填报、评分与确认记录，恢复到初始演示状态',
        confirmText: '确认重置',
        danger: true
      });
      if (!ok) return;
      await S.reset();
      history.replaceState(null, '', location.pathname);
      location.href = location.pathname + '#/login';
      location.reload();
    });

    const sel = document.getElementById('stageSelect');
    if (sel) sel.addEventListener('change', async () => {
      const i = parseInt(sel.value, 10);
      const r = await S.jumpToStage(i);
      if (r.error) { U.toast('切换失败', r.error, 'danger'); render(); return; }
      U.toast('已切换阶段', '当前为「' + S.get().cycle.stages[i].label + '」', 'ok');
      render();
    });

    const refresh = document.getElementById('refreshBtn');
    if (refresh) refresh.addEventListener('click', () => { render(); U.toast('已刷新', '', 'ok'); });
  }

  /* ---------- 倒计时 ---------- */
  let lastStage = null;
  function tick() {
    if (!S.me()) return;
    const cd = S.countdown();
    const text = cd.phase === 'active' ? U.durClock(cd.ms) : (cd.phase === 'before' ? '待开始' : '已结束');
    document.querySelectorAll('[data-cd="clock"]').forEach((el) => { el.textContent = text; });
    const pill = document.querySelector('.stage-pill .cd b');
    if (pill) pill.textContent = text;
    const idx = S.stageIndex();
    if (lastStage !== null && idx !== lastStage) {
      lastStage = idx;
      if (!S.me()) return;
      U.toast('环节已切换', '进入「' + S.get().cycle.stages[Math.max(0, Math.min(7, idx))].label + '」', 'info');
      render();
    }
  }

  function renderBackendError(err) {
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('topbar').style.display = 'none';
    const v = document.getElementById('view');
    v.style.padding = '0';
    v.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;padding:24px">' +
      '<div class="card card-pad" style="max-width:540px">' +
        '<h1 style="font-size:20px">无法连接后端服务</h1>' +
        '<p class="muted mt-8">' + U.esc(err && err.message ? err.message : '请求失败') + '</p>' +
        '<ol class="rules mt-16">' +
          '<li>在项目目录执行 <code>node server.js</code> 启动服务</li>' +
          '<li>浏览器访问 <code>http://127.0.0.1:8123</code>（不要直接双击 index.html）</li>' +
          '<li>若端口被占用，可执行 <code>PORT=8124 node server.js</code></li>' +
        '</ol>' +
        '<button class="btn btn-primary btn-sm mt-16" onclick="location.reload()">重新连接</button>' +
      '</div></div>';
  }

  let booted = false;
  async function boot() {
    if (booted) return;
    booted = true;
    try {
      await S.init();
    } catch (e) {
      renderBackendError(e);
      return;
    }
    try {
      const qs = new URLSearchParams(location.search);
      const as = qs.get('as');
      const ids = { student: '2023040101', teacher: 'T102', admin: 'admin' };
      if (ids[as] && !S.me()) {
        const r = await S.login(as, ids[as], '123456');
        if (r.error) U.toast('演示登录失败', r.error, 'danger');
      }
      const stage = qs.get('stage');
      if (stage !== null && S.me()) {
        const n = parseInt(stage, 10);
        if (n >= 0 && n < 8) await S.jumpToStage(n);
      }
    } catch (e) { /* 忽略深链错误 */ }
    render();
    setInterval(tick, 1000);
  }

  window.addEventListener('hashchange', render);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
