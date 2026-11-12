/* ==========================================================================
   客户端数据仓库：服务端快照 + 同步读 / 异步写
   ========================================================================== */
(function () {
  const App = (window.App = window.App || {});
  const Api = App.Api;

  let state = null;
  let offset = 0;

  function now() { return Date.now() + offset; }

  function applySnapshot(snap) {
    state = snap;
    offset = (snap.serverTime || Date.now()) - Date.now();
  }

  function get() {
    if (!state) throw new Error('数据尚未加载');
    return state;
  }

  async function init() {
    const r = await Api.request('GET', '/api/bootstrap');
    if (r.snapshot) applySnapshot(r.snapshot);
  }

  async function login(role, id, password) {
    try {
      const r = await Api.request('POST', '/api/login', { role, id, password });
      applySnapshot(r.snapshot);
      return { ok: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  async function logout() {
    try { await Api.request('POST', '/api/logout', {}); } catch (e) { /* 忽略 */ }
    state = null;
  }

  async function call(method, path, body) {
    try {
      const r = await Api.request(method, path, body === undefined ? {} : body);
      if (r.snapshot) applySnapshot(r.snapshot);
      return r;
    } catch (e) {
      return { error: e.message, status: e.status };
    }
  }

  /* ---------- 时间与阶段 ---------- */
  function stages() { return get().cycle.stages; }

  function stageIndex() {
    const list = stages();
    const t = now();
    if (!list.length) return -1;
    if (t < list[0].start) return -1;
    for (const s of list) if (t >= s.start && t <= s.end) return s.idx;
    return list.length;
  }

  function stageStatus(i) {
    const s = stages().find((x) => x.idx === i) || stages()[i];
    const t = now();
    if (t > s.end) return 'done';
    if (t >= s.start && t <= s.end) return 'active';
    return 'todo';
  }

  function countdown() {
    const list = stages();
    const idx = stageIndex();
    const t = now();
    if (idx === -1) return { phase: 'before', ms: Math.max(0, list[0].start - t), stage: list[0], index: -1 };
    if (idx >= list.length) return { phase: 'after', ms: 0, stage: list[list.length - 1], index: idx };
    const s = list[idx];
    return { phase: 'active', ms: Math.max(0, s.end - t), stage: s, index: idx };
  }

  /* ---------- 读 ---------- */
  const me = () => (state ? state.me : null);
  const labs = () => get().labs;
  const students = () => get().students;
  const applications = () => get().applications;
  const interviews = () => get().interviews;
  const nominations = () => get().nominations;
  const confirmations = () => get().confirmations;
  const allocations = () => get().allocations;
  const publicity = () => get().publicity;
  const objections = () => get().objections;
  const audit = () => get().audit;

  function labStats(labId) {
    const st = get();
    const lab = st.labs.find((l) => l.id === labId);
    if (!lab) return null;
    const s = lab.stats || {};
    return {
      lab,
      quota: s.quota != null ? s.quota : lab.quota,
      applicants: s.applicants != null ? s.applicants : null,
      accepted: s.accepted || 0,
      wait: s.wait || 0,
      internal: s.internal || 0,
      confirmed: s.confirmed || 0,
      taken: s.taken || 0,
      remaining: s.remaining || 0
    };
  }

  const studentByNo = (no) => get().students.find((s) => s.no === no) || { no, name: no, cls: '—' };

  const activeAccept = (n) => n.type === 'accept' && !n.status;
  const accepted = (labId) => get().nominations.filter((n) => n.labId === labId && activeAccept(n));
  const waitlist = (labId) => get().nominations.filter((n) => n.labId === labId && n.type === 'wait' && !n.status).sort((a, b) => a.rank - b.rank);
  const internalList = (labId) => get().nominations.filter((n) => n.labId === labId && n.type === 'internal' && !n.status).sort((a, b) => a.rank - b.rank);

  function takenSet(labId) {
    const set = new Set();
    get().nominations.filter((n) => n.labId === labId && activeAccept(n)).forEach((n) => set.add(n.no));
    Object.keys(get().confirmations).forEach((no) => { if (get().confirmations[no].labId === labId) set.add(no); });
    get().allocations.forEach((a) => { if (a.labId === labId) set.add(a.no); });
    return set;
  }

  function myApp() {
    const m = me();
    if (!m || m.role !== 'student') return null;
    return get().applications[m.id] || null;
  }

  function myOffers() {
    const m = me();
    if (!m || m.role !== 'student') return [];
    return get().nominations
      .filter((n) => n.no === m.id && activeAccept(n))
      .map((n) => ({ nom: n, lab: get().labs.find((l) => l.id === n.labId) }))
      .filter((x) => x.lab);
  }

  function myConfirmation() {
    const m = me();
    if (!m) return null;
    const c = get().confirmations[m.id];
    if (!c) return null;
    return { ...c, lab: get().labs.find((l) => l.id === c.labId) };
  }

  const myInterviews = () => {
    const m = me();
    return m ? get().interviews.filter((iv) => iv.no === m.id) : [];
  };
  const myInterview = (labId) => {
    const m = me();
    return m ? get().interviews.find((iv) => iv.no === m.id && iv.labId === labId) || null : null;
  };

  function teacherLabs() {
    const m = me();
    if (!m || m.role !== 'teacher') return [];
    return get().labs.filter((l) => l.teacher.id === m.id);
  }

  function labApplicants(labId) {
    const st = get();
    return Object.keys(st.applications)
      .filter((no) => st.applications[no].labs.includes(labId))
      .map((no) => {
        const iv = st.interviews.find((x) => x.no === no && x.labId === labId) || null;
        const nom = st.nominations.find((n) => n.no === no && n.labId === labId && n.type === 'accept' && !n.status) ||
          st.nominations.find((n) => n.no === no && n.labId === labId && n.type === 'wait' && !n.status) ||
          st.nominations.find((n) => n.no === no && n.labId === labId && n.type === 'internal' && !n.status) || null;
        return { student: studentByNo(no), app: st.applications[no], interview: iv, nom };
      })
      .sort((a, b) => (b.interview ? b.interview.total : -1) - (a.interview ? a.interview.total : -1));
  }

  function confirmStats() {
    const st = get();
    const offers = {};
    st.nominations.filter(activeAccept).forEach((n) => { offers[n.no] = (offers[n.no] || 0) + 1; });
    const total = Object.keys(offers).length;
    const confirmed = Object.keys(st.confirmations).length;
    return {
      offerStudents: total,
      confirmed,
      pending: Math.max(0, total - confirmed),
      expired: st.nominations.filter((n) => n.status === 'expired').length,
      multi: Object.keys(offers).filter((no) => offers[no] >= 2).length
    };
  }

  function publicityRows() {
    const st = get();
    if (st.publicRows && st.publicRows.length) {
      return st.publicRows.map((r) => ({
        no: r.no, masked: r.masked, name: r.name, lab: r.labName, direction: r.direction, source: r.source, at: r.at
      }));
    }
    return Object.keys(st.confirmations).map((no) => {
      const c = st.confirmations[no];
      const lab = st.labs.find((l) => l.id === c.labId);
      const stu = studentByNo(no);
      return { no, masked: '******' + no.slice(-4), name: stu.name, lab: lab ? lab.name : '—', direction: lab ? lab.direction : '', source: c.source, at: c.at };
    }).sort((a, b) => a.lab.localeCompare(b.lab, 'zh'));
  }

  function dashboard() {
    const st = get();
    const g = st.global || {};
    return {
      ...g,
      labs: st.labs.map((l) => labStats(l.id)),
      students: g.students || 0,
      applied: g.applied || 0,
      notApplied: g.notApplied || 0,
      interviews: g.interviews || 0,
      ivDone: g.ivDone || 0,
      ivPending: g.ivPending || 0,
      quota: g.quota || 0,
      taken: g.taken || 0,
      remaining: g.remaining || 0,
      fullLabs: g.fullLabs || 0,
      confirmed: g.confirmed || 0,
      published: !!g.published
    };
  }

  /* ---------- 写 ---------- */
  const apply = (payload) => call('POST', '/api/applications', payload);
  const confirmOffer = (labId) => call('POST', '/api/confirmations', { labId });
  const setScores = (ivId, scores, comment) => call('POST', '/api/interviews/' + encodeURIComponent(ivId) + '/score', { ...scores, comment });
  const arrangeInterviews = (labId) => call('POST', '/api/interviews/arrange', labId ? { labId } : {});
  const addNomination = (labId, studentId, type) => call('POST', '/api/nominations', { labId, studentId, type });
  const moveNomination = (id, dir) => call('PATCH', '/api/nominations/' + id + '/move', { dir });
  const removeNomination = (id) => call('DELETE', '/api/nominations/' + id);
  const updateLabQuota = (labId, quota) => call('PATCH', '/api/labs/' + labId, { quota });
  const updateCycle = (payload) => call('PATCH', '/api/cycle', payload);
  const jumpToStage = (stage) => call('POST', '/api/cycle/jump', { stage });
  const settle = () => call('POST', '/api/cycle/settle', {});
  const allocate = (studentId, labId, priority, reason) => call('POST', '/api/allocations', { studentId, labId, priority, reason });
  const publish = () => call('POST', '/api/publicity', {});
  const objection = (text) => call('POST', '/api/objections', { text });

  async function reset() {
    try {
      await Api.request('POST', '/api/demo/reset', {});
    } catch (e) { /* 忽略 */ }
    state = null;
  }

  // 兼容旧调用：审计与本地保存由服务端接管
  const save = () => {};
  const pushAudit = () => {};
  const settleLocal = () => {};

  App.Store = {
    init, get, me, login, logout,
    now, stages, stageIndex, stageStatus, countdown, jumpToStage, settle,
    labs, students, applications, interviews, nominations, confirmations, allocations,
    publicity, objections, audit,
    labStats, studentByNo, takenSet, accepted, waitlist, internalList,
    myApp, myOffers, myConfirmation, myInterview, myInterviews,
    apply, confirmOffer,
    teacherLabs, labApplicants, setScores, addNomination, removeNomination, moveNomination,
    arrangeInterviews, updateLabQuota, updateCycle,
    confirmStats, allocate, publish, objection, publicityRows, dashboard,
    reset, save, pushAudit, settleLocal
  };
})();
