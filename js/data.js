/* ==========================================================================
   演示数据生成器（固定种子，保证每次重置数据一致）
   ========================================================================== */
(function (root) {
  const App = (root.App = root.App || {});

  const STAGES = [
    { key: 'brief', label: '集中宣讲', short: '宣讲' },
    { key: 'openday', label: '实训室开放日', short: '开放日' },
    { key: 'apply', label: '意向填报', short: '填报' },
    { key: 'interview', label: '导师初选与面试', short: '面试' },
    { key: 'confirm', label: '拟录取与学生确认', short: '双选确认' },
    { key: 'supplement', label: '分轮补录', short: '补录' },
    { key: 'allocate', label: '统筹调剂录取', short: '调剂' },
    { key: 'publicity', label: '结果公示与正式入组', short: '公示' }
  ];

  const DUR = [
    3 * 3600e3,        // 宣讲
    1.5 * 86400e3,     // 开放日
    4 * 3600e3,        // 填报
    1.5 * 86400e3,     // 面试
    4 * 3600e3,        // 双选确认
    1.5 * 86400e3,     // 补录
    4 * 3600e3,        // 调剂
    1 * 86400e3        // 公示
  ];

  const LABS = [
    {
      id: 'L1', name: '人工智能视觉实训室', direction: '计算机视觉 / 目标检测',
      quota: 6, room: '实训楼 A305',
      teacher: { id: 'T102', name: '陈明远', title: '副教授' },
      tags: ['OpenCV', 'YOLO', '边缘部署'],
      intro: '面向真实工业质检场景，带学生从数据标注、模型训练到边缘设备部署完整走一遍。近三年指导学生在省级以上竞赛获奖 11 项。',
      requirements: ['掌握 Python 基础语法', '每周可投入 10 小时以上', '有 OpenCV / PyTorch 接触经验者优先']
    },
    {
      id: 'L2', name: '智能机器人实训室', direction: '机器人控制 / SLAM',
      quota: 8, room: '实训楼 B102',
      teacher: { id: 'T103', name: '周立群', title: '教授' },
      tags: ['ROS2', 'SLAM', '运动规划'],
      intro: '以移动机器人与机械臂为载体，做导航、抓取与多机协同。设备包含 6 台差速底盘与 2 台协作机械臂。',
      requirements: ['具备 C++ 或 Python 编程能力', '对机器人方向有持续兴趣', '能参加周末联调']
    },
    {
      id: 'L3', name: '数据智能与分析实训室', direction: '数据挖掘 / 可视化',
      quota: 10, room: '实训楼 A210',
      teacher: { id: 'T102', name: '陈明远', title: '副教授' },
      tags: ['SQL', 'Pandas', 'BI 看板'],
      intro: '承接校内部门真实数据需求，训练从取数、清洗、建模到看板讲述的完整链路，产出可直接写进简历的项目。',
      requirements: ['会写基础 SQL', '有 Excel 或 Python 数据处理经验', '愿意做数据清洗这类细致工作']
    },
    {
      id: 'L4', name: '嵌入式与物联网实训室', direction: 'STM32 / 传感器网络',
      quota: 8, room: '实训楼 B208',
      teacher: { id: 'T104', name: '王海涛', title: '高级工程师' },
      tags: ['STM32', 'FreeRTOS', 'MQTT'],
      intro: '从最小系统板到完整物联网节点，强调动手与调试能力，适合想打牢底层基础的同学。',
      requirements: ['完成过单片机课程设计', '能看懂电路原理图', '接受焊接与飞线调试']
    },
    {
      id: 'L5', name: '具身智能与多模态实训室', direction: '多模态大模型 / 具身操作',
      quota: 5, room: '实训楼 C401',
      teacher: { id: 'T105', name: '赵子晴', title: '讲师' },
      tags: ['VLM', '模仿学习', '仿真环境'],
      intro: '探索视觉语言模型驱动的机械臂操作，课题新、节奏快，适合自驱力强、愿意读论文的同学。',
      requirements: ['能读英文论文', '有深度学习框架使用经验', '每周投入 12 小时以上']
    },
    {
      id: 'L6', name: '工业软件与数字孪生实训室', direction: '仿真建模 / 数字孪生',
      quota: 6, room: '实训楼 C305',
      teacher: { id: 'T106', name: '孙建国', title: '副教授' },
      tags: ['Unity', '数字孪生', 'OPC UA'],
      intro: '与本地制造企业合作，把产线搬进数字空间，做可视化监控与仿真优化。',
      requirements: ['对三维建模或仿真有兴趣', '有 Unity / C# 基础优先', '能接受企业现场调研']
    },
    {
      id: 'L7', name: '智能网联汽车实训室', direction: '车路协同 / 感知融合',
      quota: 8, room: '实训楼 D101',
      teacher: { id: 'T107', name: '李昂', title: '工程师' },
      tags: ['激光雷达', '多传感器融合', 'V2X'],
      intro: '依托实车与小宇仿真平台，做感知融合与协同决策，适合想进智能驾驶行业的同学。',
      requirements: ['数学与编程基础扎实', '有驾照者优先（需跟车测试）', '能适应外场实验']
    },
    {
      id: 'L8', name: 'AI+PB 项目工作室', direction: '产教融合 / 真实项目交付',
      quota: 4, room: '实训楼 A108',
      teacher: { id: 'T108', name: '何静', title: '项目经理' },
      tags: ['需求分析', '全栈交付', '项目管理'],
      intro: '直接对接校外客户的小型交付项目，训练需求拆解、进度管理与验收沟通，是"能干活"的最好证明。',
      requirements: ['沟通表达清晰', '有一定前端或后端基础', '能保证每周固定工时']
    }
  ];

  const NAMES = [
    '林小满', '陈嘉禾', '王雨桐', '李泽宇', '张梓涵', '刘欣然', '赵一鸣', '孙博文',
    '周子墨', '吴思远', '郑浩然', '冯若曦', '陈奕辰', '褚清越', '卫岚', '蒋知微',
    '沈亦舟', '韩梅', '杨舒然', '朱星辰', '秦晓棠', '许言', '何砚', '吕青禾',
    '施远', '张牧', '孔令仪', '曹星野', '严嘉', '华婉', '金一诺', '魏子涵',
    '陶然', '姜屿', '戚然', '谢临', '邹雨', '喻可', '柏川', '水灵',
    '窦骁', '章启', '云舒', '苏晚', '潘序', '葛亮', '奚梦', '范舟',
    '彭湃', '郎月', '鲁直', '韦一笑', '昌平', '马原', '苗青', '凤仪',
    '花明', '方舟', '俞樾', '任远'
  ];

  const CLASSES = ['计科2301', '计科2302', '计科2303', '软工2301', '人工智能2301'];

  const LAB_WEIGHTS = { L1: 9, L2: 8, L3: 10, L4: 7, L5: 4, L6: 4, L7: 4, L8: 2 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeTimes(now, idx) {
    const start = new Array(STAGES.length);
    const end = new Array(STAGES.length);
    start[idx] = now - 45 * 60e3;
    end[idx] = start[idx] + DUR[idx];
    for (let j = idx - 1; j >= 0; j--) {
      end[j] = start[j + 1];
      start[j] = end[j] - DUR[j];
    }
    for (let j = idx + 1; j < STAGES.length; j++) {
      start[j] = end[j - 1];
      end[j] = start[j] + DUR[j];
    }
    return STAGES.map((s, i) => ({ ...s, start: start[i], end: end[i] }));
  }

  function build(now, stageIdx) {
    now = now || Date.now();
    stageIdx = stageIdx == null ? 2 : stageIdx;
    const rand = mulberry32(20261109);
    const rnd = (a, b) => a + Math.floor(rand() * (b - a + 1));
    const pickWeighted = (weights, exclude) => {
      const pool = Object.keys(weights).filter((k) => !exclude.includes(k));
      const total = pool.reduce((s, k) => s + weights[k], 0);
      let r = rand() * total;
      for (const k of pool) { r -= weights[k]; if (r <= 0) return k; }
      return pool[pool.length - 1];
    };

    const stages = makeTimes(now, stageIdx);
    const labs = LABS.map((l) => ({ ...l }));

    const students = NAMES.map((name, i) => ({
      no: String(2023040101 + i),
      name,
      cls: CLASSES[i % CLASSES.length],
      phone: '138' + String(10000000 + i * 137).slice(0, 8),
      email: String(2023040101 + i) + '@stu.edu.cn'
    }));

    const byNo = {};
    students.forEach((s) => { byNo[s.no] = s; });

    /* ---------- 意向 ---------- */
    const applications = {};
    students.forEach((stu, i) => {
      // 少量学生未填报，用于展示"未填报"统计
      if (i % 13 === 7) return;
      let ids;
      if (i === 0) {
        ids = ['L1', 'L3'];                    // 演示账号：两个平行意向
      } else {
        const n = rand() < 0.42 ? 1 : rand() < 0.75 ? 2 : 3;
        ids = [];
        for (let k = 0; k < n; k++) ids.push(pickWeighted(LAB_WEIGHTS, ids));
      }
      const applyStart = stages[2].start;
      const app = {
        labs: ids,
        internal: rand() < 0.58,
        cross: rand() < 0.42,
        intro: '',
        submittedAt: applyStart + Math.floor(rand() * Math.max(1, (stages[2].end - applyStart) * 0.8)),
        history: []
      };
      applications[stu.no] = app;
    });

    /* ---------- 面试 ---------- */
    const interviews = [];
    let ivSeq = 0;
    const scoreWeights = { attitude: 0.25, logic: 0.3, coding: 0.25, comm: 0.2 };
    Object.keys(applications).forEach((no) => {
      const app = applications[no];
      app.labs.forEach((labId) => {
        const ivStart = stages[3].start + 3600e3;
        const span = Math.max(3600e3, (stages[3].end - ivStart) * 0.8);
        const at = ivStart + Math.floor(rand() * span);
        // 每位学生同一个 30 分钟槽位内结束，避免视觉上过于随机
        const slot = Math.round(at / (30 * 60e3)) * 30 * 60e3;
        const pending = rand() < 0.16;
        let scores = null, total = 0;
        if (!pending) {
          scores = {
            attitude: rnd(58, 96), logic: rnd(50, 94),
            coding: rnd(42, 96), comm: rnd(55, 95)
          };
          total = Math.round(
            scores.attitude * scoreWeights.attitude + scores.logic * scoreWeights.logic +
            scores.coding * scoreWeights.coding + scores.comm * scoreWeights.comm
          );
        }
        interviews.push({
          id: 'IV' + (++ivSeq),
          labId, no, at: slot,
          room: LABS.find((l) => l.id === labId).room,
          status: pending ? 'pending' : 'done',
          scores, total, comment: '',
          scorer: pending ? '' : LABS.find((l) => l.id === labId).teacher.name,
          locked: !pending
        });
      });
    });

    /* ---------- 拟定名单（拟录取 / 递补 / 内部调剂） ---------- */
    const nominations = [];
    let nomSeq = 0;
    // 各实训室的预置满员比例：留出空位用于展示补录、调剂与导师添加名单
    const FILL = { L1: 0.7, L2: 1, L3: 0.6, L4: 0.7, L5: 0.6, L6: 0.6, L7: 0.4, L8: 0.3 };
    labs.forEach((lab) => {
      const ivs = interviews
        .filter((iv) => iv.labId === lab.id && iv.status === 'done')
        .sort((a, b) => b.total - a.total);
      const target = Math.min(lab.quota, ivs.length, Math.max(1, Math.round(lab.quota * (FILL[lab.id] || 0.6))));
      const acceptN = Math.max(0, target);
      const accepts = ivs.slice(0, acceptN);
      const waits = ivs.slice(acceptN, acceptN + 3);
      accepts.forEach((iv, i) => {
        nominations.push({ id: 'N' + (++nomSeq), labId: lab.id, no: iv.no, type: 'accept', rank: i + 1, round: 1 });
      });
      waits.forEach((iv, i) => {
        nominations.push({ id: 'N' + (++nomSeq), labId: lab.id, no: iv.no, type: 'wait', rank: i + 1, round: 1 });
      });
      const internals = Object.keys(applications)
        .filter((no) => applications[no].labs.includes(lab.id) && applications[no].internal)
        .map((no) => ({ no, total: (interviews.find((iv) => iv.no === no && iv.labId === lab.id) || {}).total || 0 }))
        .filter((x) => x.total > 0 && !accepts.some((a) => a.no === x.no) && !waits.some((w) => w.no === x.no))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);
      internals.forEach((x, i) => {
        nominations.push({ id: 'N' + (++nomSeq), labId: lab.id, no: x.no, type: 'internal', rank: i + 1, round: 1 });
      });
    });

    // 演示账号：确保同时收到 L1、L3 两条拟录取意向
    ['L1', 'L3'].forEach((labId) => {
      const has = nominations.some((n) => n.labId === labId && n.no === '2023040101' && n.type === 'accept');
      if (!has) {
        // 名额已由随机名单占满时，把末位拟录取降为递补，保证不超录
        const acc = nominations
          .filter((n) => n.labId === labId && n.type === 'accept')
          .sort((a, b) => a.rank - b.rank);
        const quota = LABS.find((l) => l.id === labId).quota;
        if (acc.length >= quota && acc.length) {
          const last = acc[acc.length - 1];
          last.type = 'wait';
          last.rank = nominations.filter((n) => n.labId === labId && n.type === 'wait').length + 1;
        }
        nominations.forEach((n) => { if (n.labId === labId && n.type === 'accept') n.rank += 1; });
        // 同一实训室内一名学生只能有一条有效名单：先清掉他可能存在的递补/内部调剂记录
        for (let i = nominations.length - 1; i >= 0; i--) {
          const n = nominations[i];
          if (n.labId === labId && n.no === '2023040101' && n.type !== 'accept') nominations.splice(i, 1);
        }
        nominations.unshift({ id: 'N' + (++nomSeq), labId, no: '2023040101', type: 'accept', rank: 1, round: 1 });
      }
    });

    /* ---------- 其他 ---------- */
    const audit = [
      { at: stages[0].start + 600e3, actor: '学院管理员', role: 'admin', action: '发布批次', detail: '创建「2026 秋季实训室进组选拔」批次并开放宣讲信息' },
      { at: stages[2].start, actor: '系统', role: 'system', action: '开放填报', detail: '意向填报窗口开启，学生最多填报 3 个平行意向' },
      { at: stages[2].start + 900e3, actor: '学院管理员', role: 'admin', action: '导出名单', detail: '导出当前批次学生基础名单（60 人）' }
    ];

    return {
      version: 2,
      cycle: { name: '2026 秋季实训室进组选拔', year: 2026, stages },
      labs,
      students,
      applications,
      interviews,
      nominations,
      confirmations: {},
      allocations: [],
      publicity: { publishedAt: null, until: null },
      objections: [],
      audit,
      meta: { seedAt: now, stageIdx, demo: true }
    };
  }

  App.Seed = { build, STAGES, DUR, LABS, makeTimes };

  // 同一份种子数据同时供浏览器（演示）与 Node 服务端（初始化数据库）使用
  if (typeof module !== 'undefined' && module.exports) module.exports = App.Seed;
})(typeof window !== 'undefined' ? window : globalThis);
