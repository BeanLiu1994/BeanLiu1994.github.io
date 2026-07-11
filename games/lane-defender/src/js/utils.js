/* =========================================================================
 * utils.js — 通用工具函数，挂在 window.U 上。
 * ========================================================================= */
(function () {
  const U = {
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    clamp: (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v),
    lerp: (a, b, t) => a + (b - a) * t,

    // 圆形碰撞：两圆心距离 < 半径之和
    circleHit: (ax, ay, ar, bx, by, br) => {
      const dx = ax - bx, dy = ay - by;
      const r = ar + br;
      return dx * dx + dy * dy <= r * r;
    },

    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),

    // 简易缓动（指数趋近，帧率无关）
    approach: (cur, target, rate, dt) =>
      cur + (target - cur) * (1 - Math.exp(-rate * dt)),

    // 唯一 id
    _id: 1,
    nextId: () => U._id++,

    // 格式化大数字
    fmt: (n) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : '' + n),

    // 圆角矩形路径（canvas 上下文）
    roundRect: (ctx, x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },

    // 发光精灵缓存：避免每帧重建径向渐变（FPS 关键优化）。
    // color 必须是 6 位 hex（如 #ff6b6b），按 color|radius 缓存离屏 canvas。
    _glowCache: {},
    getGlow(color, r) {
      const key = color + '|' + r;
      let s = U._glowCache[key];
      if (s) return s;
      const d = Math.max(2, Math.ceil(r * 2));
      const c = document.createElement('canvas');
      c.width = d; c.height = d;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(r, r, 1, r, r, r);
      grad.addColorStop(0, color + 'cc');
      grad.addColorStop(0.5, color + '55');
      grad.addColorStop(1, color + '00');
      g.fillStyle = grad;
      g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
      U._glowCache[key] = c;
      return c;
    },
    drawGlow(ctx, color, x, y, r) {
      const s = U.getGlow(color, r);
      ctx.drawImage(s, x - r, y - r);
    },
  };

  window.U = U;
})();
