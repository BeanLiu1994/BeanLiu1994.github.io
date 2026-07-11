/* =========================================================================
 * main.js — 启动入口：画布缩放、主循环（固定步长）、绑定 UI/输入。
 * ========================================================================= */
(function () {
  const G = window.G;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');

  let scale = 1;

  function resize() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // 限制 DPR，避免高分屏过度绘制掉帧
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    scale = canvas.width / G.VW; // 虚拟坐标 → 像素
  }
  window.addEventListener('resize', resize);
  resize();

  // 初始化各模块
  window.Game.init();
  window.UI.init({
    onStart: () => window.Game.start(),
    onResume: () => window.Game.togglePause(),
    onRestart: () => window.Game.restart(),
  });
  window.Input.init(canvas, {
    onPause: () => window.Game.togglePause(),
  });

  // 右上角「自动移动」开关
  const autoBtn = document.getElementById('auto-toggle');
  autoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.Game.autoMode = !window.Game.autoMode;
    autoBtn.classList.toggle('on', window.Game.autoMode);
    autoBtn.textContent = window.Game.autoMode ? '自动：开' : '自动：关';
    window.Game.autoTimer = 0; // 立即重算目标
  });

  // 失焦自动暂停
  window.addEventListener('blur', () => {
    if (window.Game.mode === 'playing') window.Game.togglePause();
  });

  // 主循环：固定步长累加器，保证不同帧率下逻辑一致（1/60 步长足够，CPU 更省）
  const STEP = 1 / 60;
  let acc = 0;
  let last = performance.now();

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // 防止切后台回来一大跳

    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      window.Game.update(STEP);
      acc -= STEP;
      steps++;
    }

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    window.Game.render(ctx);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // PWA：仅在 http(s) 下注册 Service Worker（file:// 直接打开时跳过）
  if (location.protocol.indexOf('http') === 0 && navigator.serviceWorker) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
