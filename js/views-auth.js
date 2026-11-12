/* ==========================================================================
   登录页
   ========================================================================== */
(function () {
  const App = window.App;
  const U = App.U;
  const S = App.Store;
  const V = (App.Views = App.Views || {});

  const ROLE_META = {
    student: { label: '学生', field: '学号', demo: '2023040101', name: '林小满', home: '/s/home' },
    teacher: { label: '导师', field: '工号', demo: 'T102', name: '陈明远', home: '/t/home' },
    admin: { label: '学院管理员', field: '账号', demo: 'admin', name: '学院管理员', home: '/a/home' }
  };

  let role = 'student';

  V.login = function (host) {
    function paint() {
      const meta = ROLE_META[role];
      host.innerHTML =
        '<div class="login">' +
          '<div class="login-left">' +
            '<div class="brand" style="padding:0">' +
              '<div class="brand-mark">进</div>' +
              '<div class="brand-text"><b>实训室进组选拔系统</b><span>双向选择 · 分轮录取 · 统筹调剂</span></div>' +
            '</div>' +
            '<h1>把八步线下流程<br>变成一次清晰的在线选择</h1>' +
            '<p class="lead">学生填报 3 个平行意向，导师按名额面议录取，系统自动完成双选确认、顺位递补、三轮补录与三级调剂，全程留痕可追溯。</p>' +
            '<div class="login-steps">' +
              ['集中宣讲', '意向填报', '面试考核', '双选确认', '分轮补录', '统筹调剂', '结果公示', '正式入组']
                .map((t, i) => '<div class="ls"><b>STEP ' + (i + 1) + '</b><span>' + t + '</span></div>').join('') +
            '</div>' +
            '<p class="tiny" style="color:#a9a3e0">演示环境 · 数据保存在本机浏览器，可随时重置</p>' +
          '</div>' +
          '<div class="login-right">' +
            '<div class="login-card">' +
              '<div class="login-brand">' +
                '<div class="brand-mark">进</div>' +
                '<div><b>实训室进组选拔系统</b><div class="tiny muted">双向选择 · 分轮录取 · 统筹调剂</div></div>' +
              '</div>' +
              '<h2>欢迎回来</h2>' +
              '<p class="sub">请选择身份并登录，开始今天的选拔工作。</p>' +
              '<div class="role-tabs mt-24">' +
                ['student', 'teacher', 'admin'].map((r) =>
                  '<button type="button" data-role="' + r + '" class="' + (r === role ? 'active' : '') + '">' + ROLE_META[r].label + '</button>').join('') +
              '</div>' +
              '<form id="loginForm" class="mt-16" novalidate>' +
                '<div class="field">' +
                  '<label for="acc">' + meta.field + '</label>' +
                  '<input class="input" id="acc" name="id" autocomplete="username" value="' + meta.demo + '" />' +
                '</div>' +
                '<div class="field mt-12">' +
                  '<label for="pwd">密码</label>' +
                  '<input class="input" id="pwd" type="password" name="pwd" autocomplete="current-password" value="123456" />' +
                '</div>' +
                '<div class="err tiny mt-8" id="loginErr" style="color:var(--danger);min-height:18px"></div>' +
                '<button class="btn btn-primary btn-block btn-lg" type="submit">登录系统</button>' +
              '</form>' +
              '<div class="demo-box mt-16">' +
                '<b>演示账号</b>：' + meta.label + ' <code>' + meta.demo + '</code>，密码 <code>123456</code>（' + meta.name + '）<br>' +
                '登录后可在右上角「演示阶段」切换到任意环节，查看完整流程。' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      host.querySelectorAll('[data-role]').forEach((b) => {
        b.addEventListener('click', () => {
          role = b.getAttribute('data-role');
          paint();
        });
      });
      host.querySelector('#loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = host.querySelector('#acc').value;
        const pwd = host.querySelector('#pwd').value;
        const errEl = host.querySelector('#loginErr');
        const btn = host.querySelector('#loginForm button[type=submit]');
        errEl.textContent = '';
        btn.disabled = true;
        btn.textContent = '登录中…';
        const r = await S.login(role, id, pwd);
        btn.disabled = false;
        btn.textContent = '登录系统';
        if (r.error) {
          errEl.textContent = r.error;
          return;
        }
        U.toast('登录成功', '欢迎，' + (S.me() ? S.me().name : ROLE_META[role].name), 'ok');
        App.go(ROLE_META[role].home);
      });
    }
    paint();
  };

  App.ROLE_META = ROLE_META;
})();
