/* =========================================================================
 * input.js — 键盘 + 触屏/鼠标输入。
 * 暴露 window.Input，game 每帧调用 getState() 读取：
 *   { moveDir: -1|0|1, dragX: number|null, step: -1|0|1 }
 * ========================================================================= */
(function () {
  const G = window.G;

  const Input = {
    leftHeld: false,
    rightHeld: false,
    dragX: null,
    _step: 0,
    _dragging: false,
    _startX: 0,
    _startT: 0,
    _moved: false,
    canvas: null,
    onPause: null,

    init(canvas, opts) {
      this.canvas = canvas;
      this.onPause = (opts && opts.onPause) || function () {};

      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        switch (e.key) {
          case 'ArrowLeft': case 'a': case 'A': this.leftHeld = true; e.preventDefault(); break;
          case 'ArrowRight': case 'd': case 'D': this.rightHeld = true; e.preventDefault(); break;
          case ' ': case 'Spacebar': this.onPause(); e.preventDefault(); break;
        }
      });
      window.addEventListener('keyup', (e) => {
        switch (e.key) {
          case 'ArrowLeft': case 'a': case 'A': this.leftHeld = false; break;
          case 'ArrowRight': case 'd': case 'D': this.rightHeld = false; break;
        }
      });

      // 指针（统一鼠标/触屏）
      const toVirtualX = (clientX) => {
        const r = canvas.getBoundingClientRect();
        return (clientX - r.left) * (G.VW / r.width);
      };

      canvas.addEventListener('pointerdown', (e) => {
        this._dragging = true;
        this._moved = false;
        this._startX = e.clientX;
        this._startT = performance.now();
        this.dragX = toVirtualX(e.clientX);
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!this._dragging) return;
        if (Math.abs(e.clientX - this._startX) > 8) this._moved = true;
        this.dragX = toVirtualX(e.clientX);
      });
      const end = (e) => {
        if (!this._dragging) return;
        this._dragging = false;
        const dt = performance.now() - this._startT;
        // 视为点击（几乎没移动、时间短）→ 按左右半区迈一步
        if (!this._moved && dt < 250) {
          const r = canvas.getBoundingClientRect();
          const vx = toVirtualX(e.clientX);
          const half = r.width / 2;
          const clientRel = (e.clientX - r.left);
          this._step = clientRel < half ? -1 : 1;
        }
        this.dragX = null;
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
    },

    getState() {
      const moveDir = (this.rightHeld ? 1 : 0) - (this.leftHeld ? 1 : 0);
      const step = this._step;
      this._step = 0;
      return { moveDir, dragX: this.dragX, step };
    },

    reset() {
      this.leftHeld = false; this.rightHeld = false;
      this.dragX = null; this._step = 0; this._dragging = false;
    },
  };

  window.Input = Input;
})();
