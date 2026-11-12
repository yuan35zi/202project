/* 界面冒烟测试：用无头 Chrome 打开关键页面，检查渲染与 JS 报错
   依赖本机 Chrome；未安装时自动跳过。运行：npm run test:ui
*/
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean);

const chrome = CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!chrome) {
  console.log('未找到 Chrome，跳过界面冒烟测试。');
  process.exit(0);
}

const PORT = 8232;
const BASE = 'http://127.0.0.1:' + PORT;
const DB = path.join(os.tmpdir(), 'lab-selection-ui-' + process.pid + '.db');
const SHOTS = path.join(os.tmpdir(), 'lab-selection-shots-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env, { PORT: String(PORT), DB_PATH: DB }),
    stdio: 'ignore'
  });

  let browser = null;
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(BASE + '/api/health')).ok) break; } catch (e) { /* wait */ }
      await sleep(200);
    }

    browser = spawn(chrome, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
      '--remote-debugging-port=9338',
      '--user-data-dir=' + path.join(os.tmpdir(), 'lab-selection-chrome-' + process.pid),
      'about:blank'
    ], { stdio: 'ignore' });

    let target = null;
    for (let i = 0; i < 80 && !target; i++) {
      try {
        const list = await (await fetch('http://127.0.0.1:9338/json/list')).json();
        target = list.find((t) => t.type === 'page');
      } catch (e) { /* wait */ }
      if (!target) await sleep(200);
    }
    if (!target) throw new Error('无法连接 Chrome 调试端口');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const pending = new Map();
    const errors = [];
    let seq = 0;
    const send = (method, params) => new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        errors.push((d.exception && d.exception.description) || d.text);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push(msg.params.args.map((a) => a.value || a.description || '').join(' '));
      }
    };
    await new Promise((r) => { ws.onopen = r; });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

    const pages = [
      { name: '学生首页', url: '/?as=student#/s/home', expect: '林小满' },
      { name: '意向填报', url: '/?as=student#/s/apply', expect: '意向填报' },
      { name: '导师拟定名单', url: '/?as=teacher#/t/nominations/L1', expect: '拟定录取名单' },
      { name: '学院录取看板', url: '/?as=admin#/a/board', expect: '录取看板' },
      { name: '学院调剂池', url: '/?as=admin#/a/allocate', expect: '统筹调剂池' }
    ];

    let pass = 0;
    let fail = 0;
    await send('Page.navigate', { url: BASE + '/' });
    await sleep(800);
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      // 演示深链 ?as= 只在未登录时生效：先退出并清掉本地缓存，再按角色进入
      await send('Runtime.evaluate', {
        expression: "fetch('/api/logout', { method: 'POST' }).then(function () { try { localStorage.clear(); } catch (e) {} })",
        awaitPromise: true
      });
      await sleep(150);
      await send('Page.navigate', { url: BASE + p.url });
      await sleep(1300);
      const r = await send('Runtime.evaluate', {
        expression: `(function(){ return {
          title: (document.querySelector('.page-head h1') || document.querySelector('h1') || {}).textContent || '',
          broken: document.body.innerText.indexOf('页面渲染出错') >= 0,
          cards: document.querySelectorAll('.card').length
        }; })()`,
        returnByValue: true
      });
      const v = r.result.value;
      const good = !v.broken && v.title.indexOf(p.expect.slice(0, 2)) >= 0;
      if (good) { pass++; console.log('  ✓ ' + p.name + '：' + v.title.trim() + '，卡片 ' + v.cards + ' 个'); }
      else { fail++; console.log('  ✗ ' + p.name + '：渲染异常 ' + JSON.stringify(v)); }

      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(SHOTS, i + '-' + p.name + '.png'), Buffer.from(shot.data, 'base64'));
    }

    const unique = [...new Set(errors)].filter(Boolean);
    if (unique.length) {
      fail++;
      console.log('  ✗ 控制台报错：' + unique.slice(0, 5).join(' | '));
    } else {
      pass++;
      console.log('  ✓ 全流程无 JS 报错');
    }

    console.log('截图目录：' + SHOTS);
    console.log('结果：' + pass + ' 通过，' + fail + ' 失败');
    process.exitCode = fail ? 1 : 0;
    ws.close();
  } catch (err) {
    console.error('  ✗ 界面测试失败：' + err.message);
    process.exitCode = 1;
  } finally {
    if (browser) browser.kill();
    server.kill();
    await sleep(300);
    ['', '-wal', '-shm'].forEach((s) => fs.rmSync(DB + s, { force: true }));
  }
})();
