/* =========================================================================
 * config.js — 全局配置（虚拟分辨率、车道、武器/敌人/奖励参数、波次曲线）
 * 经典脚本：挂在 window.G 上，供后续脚本读取。
 * ========================================================================= */
(function () {
  const G = {
    // 虚拟分辨率（所有逻辑坐标都基于此，渲染时整体缩放）
    VW: 450,
    VH: 800,

    // 通道（车道）数量
    LANES: 5,

    // 玩家基线 y（怪物越过此线不会扣血，会循环回顶部；只有与玩家本体碰撞才扣血）
    PLAYER_LINE: 720,

    // 玩家初始属性
    player: {
      startMultiplier: 20,  // 初始倍率（同时是生命/容错资源，归零即失败）
      y: 700,               // 玩家中心 y
      size: 34,             // 碰撞半径
      moveSpeed: 7.5,       // 每秒可跨越的车道数（平滑移动速度）
      fireCooldown: 0.32,   // 初始开火间隔（秒），越小射速越快
      bulletSpeed: 720,     // 子弹速度 px/s
      bulletDamage: 1,      // 单发伤害
      penetration: 1,       // 子弹可穿透的敌人数
      multishot: 1,         // 同时发射的子弹数（散射）
      spread: 26,           // 多重射击的横向间距
    },

    // 敌人类型定义
    enemyTypes: {
      normal: { hp: 3,  speed: 42,  size: 26, dmg: 1, color: '#ff6b6b', score: 10, shooter: false },
      fast:   { hp: 2,  speed: 78,  size: 20, dmg: 1, color: '#ffd166', score: 12, shooter: false },
      tank:   { hp: 9,  speed: 26,  size: 34, dmg: 3, color: '#9b5de5', score: 25, shooter: false },
      shooter:{ hp: 4,  speed: 34,  size: 26, dmg: 2, color: '#06d6a0', score: 20, shooter: true,
                shootCd: 1.8, ebulletSpeed: 230 },
      boss:   { hp: 70, speed: 16,  size: 64, dmg: 5, color: '#ff3b6b', score: 300, shooter: true,
                shootCd: 1.1, ebulletSpeed: 250 },
    },

    // 奖励类型
    rewardTypes: {
      fire:   { color: '#4fd1ff', label: '射速',  value: 3 },
      dmg:    { color: '#ff5d8f', label: '伤害',  value: 4 },
      pen:    { color: '#ffa94d', label: '穿透',  value: 5 },
      multi:  { color: '#cc5de8', label: '多重',  value: 6 },
      mult:   { color: '#51cf66', label: '倍率',  value: 3 },
      fan:    { color: '#74c0fc', label: '斜射',  value: 3 },
      score:  { color: '#ffe066', label: '分数',  value: 3 },
    },

    // 自动模式走位 AI 调参（computeAutoTargetX 使用）
    auto: {
      horizon: 2.6,        // 预测时域（秒）：在此时间内会命中的车道视为危险
      engage: 2.0,         // 敌人/子弹在此秒数之外视为“可去打”，留足撤离余量
      emptyScore: 1000,    // 空且安全车道的基础分
      engageScore: 700,    // 有远处敌人可打车道的基础分（低于 emptyScore → 优先待空车道，减少无谓移动）
    },

    // 波次节奏：每波时长不再写死，而是由 director.js 动态计算
    // （本波事件结束时刻 + 2.5s 喘息），避免“长空窗”造成难度骤降观感。
    // 难度爬升曲线由 director.js 的 plan() 控制。
    spawn: {},

    // 武器升级的增量
    upgrade: {
      fireRateStep: 0.85,   // 射速间隔 *= 此系数
      minFireCd: 0.09,
      dmgStep: 1,
      penStep: 1,
      multiStep: 1,
      maxPen: 6,
      maxMulti: 5,
      multiplierGain: 4,    // “倍率”奖励补充量（倍率同时是生命/容错资源）
      fanStep: 1,           // 斜向子弹每级增加的斜射对数
      maxFan: 3,
      scoreGain: 150,
    },

    colors: {
      bg0: '#0a0f1e',
      bg1: '#0e1730',
      lane: 'rgba(255,255,255,0.05)',
      laneEdge: 'rgba(79,209,255,0.18)',
      line: 'rgba(255,93,143,0.5)',
      bullet: '#9be7ff',
      ebullet: '#ff8787',
    },
  };

  window.G = G;
})();
