/* =========================================================================
 * ui.js — DOM 菜单/覆盖层控制（开始、暂停、结束）。
 * HUD（倍率/分数/波次/武器）由 game 直接绘制在 canvas 上。
 * ========================================================================= */
(function () {
  const UI = {
    el: {},
    cb: {},

    init(callbacks) {
      this.cb = callbacks || {};
      this.el = {
        start: document.getElementById('screen-start'),
        pause: document.getElementById('screen-pause'),
        over: document.getElementById('screen-over'),
        overStats: document.getElementById('over-stats'),
      };
      document.getElementById('btn-start').addEventListener('click', () => this.cb.onStart && this.cb.onStart());
      document.getElementById('btn-resume').addEventListener('click', () => this.cb.onResume && this.cb.onResume());
      document.getElementById('btn-restart-pause').addEventListener('click', () => this.cb.onRestart && this.cb.onRestart());
      document.getElementById('btn-restart').addEventListener('click', () => this.cb.onRestart && this.cb.onRestart());
    },

    hideAll() {
      this.el.start.classList.add('hidden');
      this.el.pause.classList.add('hidden');
      this.el.over.classList.add('hidden');
    },
    showStart() { this.hideAll(); this.el.start.classList.remove('hidden'); },
    showPause() { this.el.pause.classList.remove('hidden'); },
    hidePause() { this.el.pause.classList.add('hidden'); },

    showOver(stats) {
      this.hideAll();
      this.el.overStats.innerHTML = stats;
      this.el.over.classList.remove('hidden');
    },
  };

  window.UI = UI;
})();
