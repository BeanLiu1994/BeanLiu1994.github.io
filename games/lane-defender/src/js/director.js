/* =========================================================================
 * director.js — 编排式生成导演（替代纯随机生成）。
 *
 * 设计目标（解决三件事）：
 *  1) 前期不那么难：HP 前期几乎不涨、类型逐步解锁、每幕第一波是轻量“集结”。
 *  2) 后期不掉档：难度主引擎是“密度”（敌人数量随波次强增长），而不是只涨 HP；
 *     玩家武器靠奖励是乘性暴涨，纯 HP 线性增长会被反超，所以用“铺量”压住后期。
 *  3) 流程不单调：每 5 波为一“幕”，幕内有起伏弧线（集结→压制→高峰→Boss），
 *     每幕有章节横幅，高波次插入精英，Boss 随幕数越来越强。
 *
 * 接口：
 *   Director.plan(wave)        -> { wave, isBoss, hpScale, density, types, gentle }
 *   Director.bossScale(wave)   -> number
 *   Director.actName(wave)     -> string（章节名）
 *   Director.reset()
 *   Director.startWave(wave)   -> 构建整波事件流（含 announce）
 *   Director.update(dt)        -> 返回到点的事件数组
 * 事件: { t, kind:'enemy'|'reward'|'announce', type, lane, scale?, name? }
 * ========================================================================= */
(function () {
  const U = window.U;
  const ev = (t, kind, type, lane, extra) =>
    Object.assign({ t, kind, type, lane }, extra || {});

  const LANES = () => window.G.LANES;

  // 章节名：每 5 波一个 Boss，也作为一个“幕”
  const ACTS = [
    '第一幕 · 滩头登陆',
    '第二幕 · 突破封锁',
    '第三幕 · 钢铁洪流',
    '第四幕 · 焦土围城',
    '第五幕 · 终焉将至',
    '终幕 · 无尽深渊',
  ];

  /* --------------------------- 难度模型 --------------------------- */
  function plan(wave) {
    const isBoss = wave % 5 === 0;
    // HP：前期（1~3 波）几乎不涨，第 4 波起陡升（避免后期变简单）
    let hpScale;
    if (wave <= 3) hpScale = 1 + (wave - 1) * 0.05;            // 1.00 ~ 1.10
    else hpScale = 1.10 + Math.pow(wave - 3, 1.25) * 0.06;     // 后期陡升
    // 密度：敌人数量随波次强增长 —— 这是后期不掉档的核心杠杆
    const density = Math.min(4.2, 1 + (wave - 1) * 0.14);
    // 类型解锁：越往后越凶
    const types = ['normal'];
    if (wave >= 2) types.push('fast');
    if (wave >= 5) types.push('tank');
    if (wave >= 6) types.push('shooter');
    return { wave, isBoss, hpScale, density, types, gentle: wave <= 4 };
  }

  // Boss 强度随幕数提升（幕数 = wave/5）
  function bossScale(wave) {
    const bn = wave / 5;
    return 1 + (bn - 1) * 0.55 + wave * 0.03;
  }

  function actName(wave) {
    const idx = Math.min(ACTS.length - 1, Math.floor((wave - 1) / 5));
    return ACTS[idx];
  }

  // 数量缩放：gentle 阶段整体减量，否则随密度放大
  function cnt(base, p) {
    const m = p.gentle ? 0.55 : (0.9 + (p.density - 1) * 0.5);
    return Math.max(1, Math.round(base * m));
  }

  // 从可用类型里挑（高波次才允许 fast/tank/shooter）
  function pickType(p, prefer) {
    if (prefer && p.types.includes(prefer)) return prefer;
    return U.pick(p.types);
  }

  /* --------------------------- 编队库 --------------------------- */
  // 每个编队：build(p) -> events（t 从 0 起），数量随 p.density 缩放
  const F = {
    // 轻量集结：每幕第一波（Boss 后的缓冲，但不空）
    rally(p) {
      const e = [];
      const n = cnt(3, p);
      for (let i = 0; i < n; i++) {
        e.push(ev(0.3 + i * 0.5, 'enemy', pickType(p, 'normal'), i % LANES()));
      }
      if (p.wave < 8) e.push(ev(1.2, 'reward', U.pick(['fire', 'dmg', 'mult', 'fan']), 2));
      return e;
    },

    // V 形浪潮：两翼对称推进
    vWave(p) {
      const e = [];
      const rings = cnt(2, p);
      for (let r = 0; r < rings; r++) {
        const t = 0.3 + r * 0.5;
        const span = Math.min(2, r);
        for (let i = 0; i <= span; i++) {
          e.push(ev(t, 'enemy', pickType(p, 'normal'), i));
          e.push(ev(t, 'enemy', pickType(p, 'normal'), 4 - i));
        }
      }
      if (p.wave >= 9) e.push(ev(2.2, 'enemy', pickType(p, 'fast'), 2));
      return e;
    },

    // 钳形夹击：左右两道同时压
    pincer(p) {
      const e = [];
      const n = cnt(5, p);
      const tf = p.types.includes('fast') ? 'fast' : 'normal';
      for (let i = 0; i < n; i++) {
        const t = 0.2 + i * 0.3;
        e.push(ev(t, 'enemy', tf, 0));
        e.push(ev(t, 'enemy', tf, 4));
      }
      return e;
    },

    // 通道压制：单通道持续灌怪，邻道放奖励做诱惑
    lanePress(p) {
      const e = [];
      const lane = p.wave % LANES();
      const n = cnt(6, p);
      for (let i = 0; i < n; i++) {
        e.push(ev(0.2 + i * 0.4, 'enemy', pickType(p, 'normal'), lane));
      }
      if (p.wave < 12) e.push(ev(1.0, 'reward', 'mult', (lane + 2) % LANES()));
      return e;
    },

    // 坦克护卫：重甲居中，轻兵两翼
    tankGuard(p) {
      const e = [];
      e.push(ev(0.2, 'enemy', pickType(p, 'tank'), 2));
      const side = cnt(2, p);
      for (let i = 0; i < side; i++) {
        e.push(ev(0.5 + i * 0.4, 'enemy', pickType(p, 'normal'), 1));
        e.push(ev(0.5 + i * 0.4, 'enemy', pickType(p, 'normal'), 3));
        e.push(ev(1.5 + i * 0.4, 'enemy', pickType(p, 'normal'), 0));
        e.push(ev(1.5 + i * 0.4, 'enemy', pickType(p, 'normal'), 4));
      }
      if (p.wave >= 6) e.push(ev(2.2, 'enemy', pickType(p, 'shooter'), 2));
      if (p.wave < 14) e.push(ev(2.6, 'reward', 'dmg', 2));
      return e;
    },

    // 射手阵：远处放冷枪
    shooterLine(p) {
      const e = [];
      [0, 2, 4].forEach((l, i) => {
        if (p.types.includes('shooter')) e.push(ev(0.3 + i * 0.25, 'enemy', 'shooter', l));
      });
      const fill = cnt(2, p);
      for (let i = 0; i < fill; i++) {
        e.push(ev(1.6 + i * 0.5, 'enemy', pickType(p, 'normal'), 1));
        e.push(ev(1.6 + i * 0.5, 'enemy', pickType(p, 'normal'), 3));
      }
      if (p.wave >= 10) e.push(ev(2.4, 'enemy', pickType(p, 'fast'), 2));
      return e;
    },

    // 交叉洪流：两路交错，密度高峰用
    crossFlux(p) {
      const e = [];
      const n = cnt(8, p);
      for (let i = 0; i < n; i++) {
        const lane = (i % 2 === 0) ? (i / 2) % 5 : 4 - ((i / 2) % 5);
        const t = pickType(p, i % 3 === 0 && p.types.includes('fast') ? 'fast' : 'normal');
        e.push(ev(0.2 + i * 0.28, 'enemy', t, lane));
      }
      return e;
    },

    // 蜂群：高密度压制（高峰幕用）
    swarm(p) {
      const e = [];
      const n = cnt(12, p);
      for (let i = 0; i < n; i++) {
        const lane = i % LANES();
        const t = pickType(p, i % 4 === 0 && p.types.includes('fast') ? 'fast' : 'normal');
        e.push(ev(0.15 + i * 0.22, 'enemy', t, lane));
      }
      if (p.wave >= 8) e.push(ev(2.0, 'enemy', pickType(p, 'tank'), 2));
      return e;
    },

    // Boss 战：本体 + 周期性护卫 + 补给
    boss(p) {
      const e = [];
      e.push(ev(0.3, 'enemy', 'boss', 2));
      // 入场护卫
      e.push(ev(0.9, 'enemy', 'normal', 0));
      e.push(ev(0.9, 'enemy', 'normal', 4));
      // 中期护卫波（密度越高越多）
      const adds = cnt(4, p);
      for (let i = 0; i < adds; i++) {
        e.push(ev(4 + i * 1.2, 'enemy', pickType(p, i % 2 ? 'fast' : 'normal'), i % 2));
        e.push(ev(4 + i * 1.2, 'enemy', pickType(p, i % 2 ? 'fast' : 'normal'), 4 - (i % 2)));
      }
      // 补给（Boss 战都给，保证能打）
      e.push(ev(3.0, 'reward', 'mult', 1));
      e.push(ev(3.0, 'reward', 'dmg', 3));
      if (p.wave >= 10) e.push(ev(7.0, 'reward', 'multi', 2));
      return e;
    },
  };

  // 每幕内“起伏弧线”：幕内第几波(cw 1..5)选哪两个编队连播
  // 注意：cw1 是 Boss 后的缓冲波。低波次只给轻量 rally（教学喘息）；
  // 高波次（>=11，即第二幕之后）在 rally 后再接一个 crossFlux，
  // 避免“刚打完 Boss 难度直接掉到地板”的断层感。
  const SLOTS = {
    1: [['rally'], ['rally', 'crossFlux']],            // 缓冲（高波次补一波压制）
    2: [['vWave', 'crossFlux'], ['pincer', 'lanePress']],
    3: [['lanePress', 'shooterLine'], ['crossFlux', 'vWave']],
    4: [['tankGuard', 'swarm'], ['shooterLine', 'pincer']], // 高峰（重）
  };

  // 高波次峰值幕插入精英（更硬的坦克）
  function maybeElite(p, events) {
    if (p.gentle) return;
    if (p.wave >= 9 && Math.random() < 0.6) {
      events.push(ev(2.8, 'enemy', 'tank', 2, { scale: p.hpScale * 2.4 }));
    }
  }

  /* --------------------------- 导演状态机 --------------------------- */
  const Director = {
    plan, bossScale, actName,
    schedule: [],
    t: 0,
    curName: '',

    reset() {
      this.schedule = [];
      this.t = 0;
      this.curName = '';
    },

    // 构建整波事件流（含 announce）。波次推进时由 game.js 调用。
    startWave(wave) {
      const p = plan(wave);
      const out = [];
      if (p.isBoss) {
        const evs = F.boss(p);
        this.curName = '⚠ BOSS 来袭';
        out.push({ kind: 'announce', name: this.curName, t: -1 }); // 先播报，再出怪
        out.push(...evs);
      } else {
        const cw = ((wave - 1) % 5) + 1;
        let pair;
        if (cw === 1) {
          // Boss 后缓冲波：低波次轻量，高波次(>=11)补一波压制，避免难度断层
          const opts = SLOTS[1];
          pair = (wave >= 11) ? opts[opts.length - 1] : opts[0];
        } else {
          const choices = SLOTS[cw] || SLOTS[4];
          pair = choices[wave % choices.length]; // 确定性变化
        }
        let cursor = 0;
        for (const name of pair) {
          const evs = F[name](p);
          for (const e of evs) e.t += cursor;
          cursor += lastT(evs) + 0.8; // 编队首尾相接
          out.push(...evs);
        }
        maybeElite(p, out);
        this.curName = pair.join(' + ');
        out.unshift({ kind: 'announce', name: this.curName, t: -1 }); // 波首播报
      }
      this.schedule = out;
      this.t = 0;
      this.waveLength = lastT(out) + 2.5; // 事件结束 + 短暂喘息；消除“长空窗”导致的难度骤降观感
      return out;
    },

    // 流式输出到点的事件
    update(dt) {
      const out = [];
      if (this.schedule.length === 0) return out;
      this.t += dt;
      while (this.schedule.length && this.schedule[0].t <= this.t) {
        out.push(this.schedule.shift());
      }
      return out;
    },
  };

  function lastT(evs) {
    let m = 0;
    for (const e of evs) if (e.t > m) m = e.t;
    return m;
  }

  window.Director = Director;
})();
