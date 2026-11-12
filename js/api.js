/* ==========================================================================
   与后端通信的最小封装
   ========================================================================== */
(function () {
  const App = (window.App = window.App || {});

  async function request(method, path, body) {
    let res;
    try {
      res = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (e) {
      throw new Error('无法连接服务器，请确认已运行 node server.js');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* 非 JSON 响应 */ }
    if (!data) throw new Error('服务器响应异常（' + res.status + '）');
    if (!res.ok) {
      const err = new Error(data.error || ('请求失败（' + res.status + '）'));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  App.Api = { request };
})();
