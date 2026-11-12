/* ==========================================================================
   UI 工具：格式化、分页、弹窗、Toast
   ========================================================================== */
(function () {
  const App = (window.App = window.App || {});
  const U = {};

  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  };

  const pad = (n) => (n < 10 ? '0' + n : '' + n);

  U.fmt = function (ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  U.fmtTime = function (ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  U.fmtDate = function (ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  U.fmtRange = function (a, b) {
    if (!a || !b) return '—';
    const da = new Date(a), db = new Date(b);
    const sameDay = da.toDateString() === db.toDateString();
    return sameDay ? U.fmt(a) + ' – ' + pad(db.getHours()) + ':' + pad(db.getMinutes())
      : U.fmt(a) + ' – ' + U.fmt(b);
  };

  U.dur = function (ms) {
    ms = Math.max(0, ms || 0);
    const totalMin = Math.floor(ms / 60000);
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return d + ' 天 ' + h + ' 小时';
    if (h > 0) return h + ' 小时 ' + m + ' 分';
    return m + ' 分';
  };

  U.durClock = function (ms) {
    const total = Math.max(0, Math.floor((ms || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
    return pad(m) + ':' + pad(s);
  };

  U.pct = function (a, b) {
    if (!b) return 0;
    return Math.round((a / b) * 100);
  };

  U.sourceLabel = function (s) {
    return { auto: '自动确认', choice: '自主选择', alloc: '统筹调剂', wait: '递补', supplement: '补录' }[s] || '确认';
  };

  /* ---------- 分页 ---------- */
  function pageList(page, pages) {
    if (pages <= 7) {
      const arr = [];
      for (let i = 1; i <= pages; i++) arr.push(i);
      return arr;
    }
    const out = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(pages - 1, page + 1);
    if (start > 2) out.push('…');
    for (let i = start; i <= end; i++) out.push(i);
    if (end < pages - 1) out.push('…');
    out.push(pages);
    return out;
  }

  U.pager = function (name, st, total, sizes) {
    sizes = sizes || [10, 20, 50];
    const pages = Math.max(1, Math.ceil(total / st.size));
    const page = Math.min(Math.max(1, st.page), pages);
    st.page = page;
    const from = total === 0 ? 0 : (page - 1) * st.size + 1;
    const to = Math.min(total, page * st.size);
    const nums = pageList(page, pages);
    return '' +
      '<div class="pager" data-pager="' + name + '">' +
        '<span class="meta">共 <b>' + total + '</b> 条' + (total ? '，第 ' + from + '–' + to + ' 条' : '') + '</span>' +
        '<div class="size">每页 ' +
          '<select data-size aria-label="每页条数">' +
            sizes.map((n) => '<option value="' + n + '"' + (n === st.size ? ' selected' : '') + '>' + n + '</option>').join('') +
          '</select> 条</div>' +
        '<div class="pages">' +
          '<button data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + ' aria-label="上一页">‹</button>' +
          nums.map((n) => n === '…'
            ? '<span class="gap">…</span>'
            : '<button data-page="' + n + '"' + (n === page ? ' aria-current="page"' : '') + '>' + n + '</button>').join('') +
          '<button data-page="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + ' aria-label="下一页">›</button>' +
        '</div>' +
      '</div>';
  };

  U.usePager = function (host, name, st, onChange) {
    host.addEventListener('click', (e) => {
      const btn = e.target.closest('.pager[data-pager="' + name + '"] [data-page]');
      if (!btn || btn.disabled) return;
      st.page = parseInt(btn.getAttribute('data-page'), 10) || 1;
      onChange();
    });
    host.addEventListener('change', (e) => {
      const sel = e.target.closest('.pager[data-pager="' + name + '"] [data-size]');
      if (!sel) return;
      st.size = parseInt(sel.value, 10) || 10;
      st.page = 1;
      onChange();
    });
  };

  U.slice = function (list, st) {
    const start = (st.page - 1) * st.size;
    return list.slice(start, start + st.size);
  };

  /* ---------- Toast ---------- */
  U.toast = function (title, msg, type) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    const icon = { ok: '✓', warn: '!', danger: '✕' }[type] || 'i';
    el.innerHTML = '<span class="ico">' + icon + '</span><div class="tt"><b>' + U.esc(title) + '</b>' + (msg ? U.esc(msg) : '') + '</div>';
    root.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s ease, transform .25s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateX(12px)';
      setTimeout(() => el.remove(), 260);
    }, 3200);
  };

  /* ---------- 弹窗 ---------- */
  let openMask = null;

  U.dialog = function (opts) {
    opts = opts || {};
    U.closeDialog();
    const root = document.getElementById('modal-root');
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + U.esc(opts.title || '') + '">' +
        '<div class="modal-head">' +
          '<div><h3>' + U.esc(opts.title || '') + '</h3>' + (opts.desc ? '<p>' + U.esc(opts.desc) + '</p>' : '') + '</div>' +
          '<button class="icon-btn x" data-close aria-label="关闭">✕</button>' +
        '</div>' +
        (opts.body ? '<div class="modal-body">' + opts.body + '</div>' : '') +
        '<div class="modal-foot">' +
          (opts.extra || '') +
          (opts.hideCancel ? '' : '<button class="btn btn-ghost" data-close>' + U.esc(opts.cancelText || '取消') + '</button>') +
          '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + U.esc(opts.confirmText || '确定') + '</button>' +
        '</div>' +
      '</div>';
    root.appendChild(mask);
    openMask = mask;
    document.body.style.overflow = 'hidden';

    const close = () => {
      if (!openMask) return;
      openMask.remove();
      openMask = null;
      document.body.style.overflow = '';
      if (opts.onClose) opts.onClose();
    };
    let busy = false;
    mask.addEventListener('click', async (e) => {
      if (busy) return;
      if (e.target === mask) return close();
      if (e.target.closest('[data-close]')) return close();
      if (e.target.closest('[data-ok]')) {
        const btn = mask.querySelector('[data-ok]');
        busy = true;
        if (btn) btn.disabled = true;
        try {
          const r = opts.onConfirm ? await opts.onConfirm(mask) : true;
          busy = false;
          if (btn) btn.disabled = false;
          if (r === false) return;
          close();
        } catch (err) {
          busy = false;
          if (btn) btn.disabled = false;
          console.error(err);
          U.toast('操作失败', err.message || '请重试', 'danger');
        }
      }
    });
    const esc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
    const first = mask.querySelector('input, select, textarea, [data-ok]');
    if (first && first.focus) setTimeout(() => first.focus(), 40);
    return mask;
  };

  U.closeDialog = function () {
    if (!openMask) return;
    openMask.remove();
    openMask = null;
    document.body.style.overflow = '';
  };

  U.confirm = function (opts) {
    return new Promise((resolve) => {
      let done = false;
      U.dialog({
        title: opts.title,
        desc: opts.desc,
        body: opts.body || '',
        confirmText: opts.confirmText || '确定',
        cancelText: opts.cancelText || '取消',
        danger: opts.danger,
        onConfirm: () => { done = true; resolve(true); return true; },
        onClose: () => { if (!done) resolve(false); }
      });
    });
  };

  U.labelForNom = function (nom) {
    if (!nom) return '<span class="badge plain">未定</span>';
    if (nom.type === 'accept') return '<span class="badge ok">拟录取 #' + nom.rank + '</span>';
    if (nom.type === 'wait') return '<span class="badge warn">递补 #' + nom.rank + '</span>';
    return '<span class="badge info">内部调剂 #' + nom.rank + '</span>';
  };

  U.statusBadge = function (type, text) {
    return '<span class="badge ' + type + '">' + U.esc(text) + '</span>';
  };

  App.U = U;
})();
