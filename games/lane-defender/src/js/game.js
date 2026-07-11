/* =========================================================================
 * game.js — 核心逻辑：状态机、生成、碰撞、升级、HUD、渲染。
 * 由 main.js 驱动：每帧调用 Game.update(dt) 与 Game.render(ctx)。
 * ========================================================================= */
(function () {
  const G = window.G, U = window.U;
  const { Player, Enemy, Bullet, EnemyBullet, Reward, laneCenter, laneWidth } = window;

  const Game = {
    mode: 'menu', // menu | playing | paused | over
    player: null,
    enemies: [], bullets: [], ebullets: [], rewards: [], floaters: [],
    score: 0,
    wave: 1,
    waveTimer: 0,
    spawnTimer: 0,
    spawnInterval: 0,
    hpScale: 1,
    shake: 0,
    bgScroll: 0,
    best: 0,
    elapsed: 0,
    autoMode: false,      // 自动移动开关
    autoTimer: 0,         // 自动重算目标的间隔
    autoTargetX: G.VW / 2,

    init() {
      this.best = +(localStorage.getItem('laneDefenderBest') || 0);
    },

    reset() {
      const P = G.player;
      this.player = new Player();
      this.enemies.length = 0;
      this.bullets.length = 0;
      this.ebullets.length = 0;
      this.rewards.length = 0;
      this.floaters.length = 0;
      this.score = 0;
      this.wave = 1;
      this.elapsed = 0;
      this.shake = 0;
      this.particles = [];
      this.director = window.Director;
      this.director.reset();
      this.hpScale = this.director.plan(1).hpScale;
      this.director.startWave(1); // 构建第一波事件流
      this.waveTimer = this.director.waveLength; // 动态波长，避免长空窗
    },

    start() {
      this.reset();
      this.mode = 'playing';
      window.UI.hideAll();
    },

    togglePause() {
      if (this.mode === 'playing') {
        this.mode = 'paused';
        window.UI.showPause();
      } else if (this.mode === 'paused') {
        this.mode = 'playing';
        window.UI.hidePause();
      }
    },

    restart() { this.start(); },

    gameOver() {
      this.mode = 'over';
      if (this.score > this.best) {
        this.best = this.score;
        localStorage.setItem('laneDefenderBest', String(this.best));
      }
      const s = this.score, w = this.wave, b = this.best;
      window.UI.showOver(
        `本局得分：<b>${s}</b><br>抵达波次：<b>第 ${w} 波</b><br>历史最高：<b>${b}</b>`
      );
    },

    /* --------------------------- 升级 --------------------------- */
    applyUpgrade(type) {
      const up = G.upgrade, w = this.player.weapon;
      switch (type) {
        case 'fire':
          w.fireCd = Math.max(up.minFireCd, w.fireCd * up.fireRateStep);
          this.player.fireCd = w.fireCd;
          this.addFloater(this.player.x, this.player.y - 40, '射速↑', '#4fd1ff');
          break;
        case 'dmg':
          w.damage += up.dmgStep;
          this.addFloater(this.player.x, this.player.y - 40, '伤害↑', '#ff5d8f');
          break;
        case 'pen':
          w.penetration = Math.min(up.maxPen, w.penetration + up.penStep);
          this.addFloater(this.player.x, this.player.y - 40, '穿透↑', '#ffa94d');
          break;
        case 'multi':
          w.multishot = Math.min(up.maxMulti, w.multishot + up.multiStep);
          this.addFloater(this.player.x, this.player.y - 40, '多重↑', '#cc5de8');
          break;
      case 'mult':
        this.player.multiplier += up.multiplierGain;
        this.addFloater(this.player.x, this.player.y - 40, '倍率+' + up.multiplierGain, '#51cf66');
        break;
      case 'fan':
        w.fan = Math.min(up.maxFan, w.fan + up.fanStep);
        this.addFloater(this.player.x, this.player.y - 40, '斜射↑', '#74c0fc');
        break;
        case 'score':
          this.score += up.scoreGain;
          this.addFloater(this.player.x, this.player.y - 40, '+' + up.scoreGain, '#ffe066');
          break;
      }
    },

    addFloater(x, y, text, color) {
      this.floaters.push({ x, y, text, color, life: 1.0 });
    },

    /* --------------------------- 生成（来自导演） --------------------------- */
    spawnEvent(ev) {
      if (ev.kind === 'reward') {
        this.rewards.push(new Reward(ev.type, ev.lane));
      } else {
        const scale = ev.scale != null ? ev.scale
          : ev.type === 'boss' ? this.director.bossScale(this.wave)
          : this.hpScale;
        this.enemies.push(new Enemy(ev.type, ev.lane, scale));
      }
    },

    /* --------------------------- 粒子（轻量、带上限） --------------------------- */
    spawnParticles(x, y, color, count, speed) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = speed * U.rand(0.3, 1);
        this.particles.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - speed * 0.2,
          life: U.rand(0.3, 0.6), max: 0.6,
          color, size: U.rand(2, 4),
        });
      }
      if (this.particles.length > 160) this.particles.splice(0, this.particles.length - 160);
    },

    /* --------------------------- 更新 --------------------------- */
    update(dt) {
      if (this.mode !== 'playing') return;
      this.elapsed += dt;
      this.bgScroll = (this.bgScroll + dt * 60) % 48;

      // 波次推进
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.wave++;
        const pl = this.director.plan(this.wave);
        this.hpScale = pl.hpScale;
        this.director.startWave(this.wave); // 构建整波事件流
        this.waveTimer = this.director.waveLength; // 动态波长，避免长空窗
        this.addFloater(G.VW / 2, G.VH * 0.4, '第 ' + this.wave + ' 波', '#4fd1ff');
        if (this.wave === 1 || this.wave % 5 === 0) {
          this.addFloater(G.VW / 2, G.VH * 0.3, this.director.actName(this.wave), '#ffd166');
        }
      }

      // 生成（由编排式导演驱动）
      const events = this.director.update(dt, this.wave);
      for (const ev of events) {
        if (ev.kind === 'announce') {
          this.addFloater(G.VW / 2, G.VH * 0.3, ev.name, '#4fd1ff');
        } else {
          this.spawnEvent(ev);
        }
      }

      // 玩家输入与开火（自动模式下由 AI 接管走位，手动输入优先覆盖）
      const inp = window.Input.getState();
      let moveDir = inp.moveDir, dragX = inp.dragX;
      const manual = (moveDir !== 0) || (dragX != null) || (inp.step !== 0);
      if (this.autoMode && !manual) {
        this.autoTimer -= dt;
        if (this.autoTimer <= 0) {
          this.autoTargetX = this.computeAutoTargetX();
          this.autoTimer = 0.12; // 每 0.12s 重算一次，反应更跟手
        }
        dragX = this.autoTargetX;
      }
      this.player.update(dt, moveDir, dragX);
      if (inp.step !== 0) {
        this.player.targetX = U.clamp(
          this.player.targetX + inp.step * laneWidth(), this.player.size, G.VW - this.player.size);
      }
      if (this.player.tryFire(dt)) this.fire();

      // 实体更新
      for (const e of this.enemies) {
        e.update(dt);
        if (e.shooter) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0 && e.y > 0 && e.y < this.player.y - 40) {
            e.shootTimer = G.enemyTypes.shooter.shootCd;
            this.ebullets.push(new EnemyBullet(
              e.x, e.y + e.size, G.enemyTypes.shooter.ebulletSpeed, e.dmg));
          }
        }
      }
      for (const b of this.bullets) b.update(dt);
      for (const b of this.ebullets) b.update(dt);
      for (const r of this.rewards) r.update(dt);

      this.collide();

      // 漏过的敌人循环回顶部（不扣血）；只保留未死亡的
      for (const e of this.enemies) {
        if (!e.dead && e.y > G.VH + e.size + 10) e.y = -e.size; // 同车道回到屏幕上方
      }
      // 安全上限：极端“完全不击杀”情况下防止实体无限堆积
      if (this.enemies.length > 90) {
        let over = this.enemies.length - 90;
        for (const e of this.enemies) {
          if (over <= 0) break;
          if (!e.dead && !e.isBoss && e.y > G.PLAYER_LINE) { e.dead = true; over--; }
        }
      }
      this.enemies = this.enemies.filter(e => !e.dead);
      this.bullets = this.bullets.filter(b => !b.dead);
      this.ebullets = this.ebullets.filter(b => !b.dead);
      this.rewards = this.rewards.filter(r => !r.dead && r.y < G.PLAYER_LINE + 40);

      // 飘字
      for (const f of this.floaters) { f.y -= 42 * dt; f.life -= dt * 0.9; }
      this.floaters = this.floaters.filter(f => f.life > 0);

      // 粒子
      for (const p of this.particles) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; p.life -= dt;
      }
      this.particles = this.particles.filter(p => p.life > 0);

      // 屏幕震动衰减
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);

      // 失败判定
      if (this.player.multiplier <= 0) this.gameOver();
    },

    fire() {
      const w = this.player.weapon, px = this.player.x, py = this.player.y - this.player.size;
      const UP = -Math.PI / 2; // 正上方
      // 直上多重
      const n = w.multishot;
      for (let i = 0; i < n; i++) {
        const off = n === 1 ? 0 : (i - (n - 1) / 2) * w.spread;
        this.bullets.push(new Bullet(px + off, py, w.damage, w.bulletSpeed, w.penetration, UP));
      }
      // 斜向子弹（每级左右各一发，角度递增）
      const aStep = 0.6; // ≈34°
      for (let k = 1; k <= w.fan; k++) {
        const ang = aStep * k;
        this.bullets.push(new Bullet(px, py, w.damage, w.bulletSpeed, w.penetration, UP - ang));
        this.bullets.push(new Bullet(px, py, w.damage, w.bulletSpeed, w.penetration, UP + ang));
      }
      this.spawnParticles(px, py, '#bff7ff', 3, 80); // 枪口火花
    },

    /* --------------------------- 自动模式走位 AI（预测式躲避） ---------------------------
     * 思路：对每个车道预测未来 HORIZON 秒内会不会被敌人/Boss/子弹命中。
     *  - 会命中的车道 = 危险，必须撤离；优先选“完全安全(无预测命中)”的车道。
     *  - 全都不安全时，选“最晚命中”的车道做风筝走位（争取时间）。
     *  - 都存在安全车道时，再用吸引力(奖励/可射击敌人)挑一个，并加滞回+就近偏置防抖。
     */
    computeAutoTargetX() {
      const lanes = G.LANES, lw = laneWidth();
      const PY = this.player.y;
      const curLane = U.clamp(Math.floor(this.player.x / lw), 0, lanes - 1);
      const HORIZON = G.auto.horizon; // 预测时域（秒）

      // 每个车道的最早命中时间（Infinity = 安全）
      const tHit = new Array(lanes).fill(Infinity);
      for (const e of this.enemies) {
        if (e.dead) continue;
        // 碰撞带：敌人进入 [玩家线 - (敌半径+玩家半径), 出屏] 区间，此刻进入该车道即会撞 → 即时威胁
        const bandTop = PY - (e.size + this.player.size);
        if (e.y >= bandTop && e.y < G.VH + e.size) {
          tHit[e.lane] = Math.min(tHit[e.lane], 0);
          continue;
        }
        const rel = PY - e.y;
        const t = rel / Math.max(e.speed, 1);
        if (t <= HORIZON) tHit[e.lane] = Math.min(tHit[e.lane], t * (e.isBoss ? 0.8 : 1));
      }
      for (const eb of this.ebullets) {
        if (eb.dead) continue;
        const l = U.clamp(Math.floor(eb.x / lw), 0, lanes - 1);
        const bandTop = PY - (eb.r + this.player.size);
        if (eb.y >= bandTop && eb.y < G.VH + eb.r) {
          tHit[l] = Math.min(tHit[l], 0); // 在碰撞带内（含越过基线未出屏）：进入即撞
          continue;
        }
        const rel = PY - eb.y;
        if (rel <= 0) continue;
        const t = rel / Math.max(eb.vy, 1);
        if (t <= HORIZON) tHit[l] = Math.min(tHit[l], t);
      }

      // 吸引力（仅在所有车道都安全时用于挑选；平时不影响躲避决策）
      const appeal = new Array(lanes).fill(0);
      for (const r of this.rewards) {
        if (r.dead) continue;
        appeal[U.clamp(Math.floor(r.x / lw), 0, lanes - 1)] += 2.5;
      }
      for (const e of this.enemies) {
        if (e.dead || e.y <= 0 || e.y >= PY) continue;
        appeal[e.lane] += 0.5 + (1 - e.hp / e.maxHp) * 0.5;
      }

      // 选车道（分级，避免为输出主动钻进危险车道）：
      //   空且安全          → emptyScore + 吸引力（最优，优先待这里）
      //   安全但有远处敌人  → engageScore + 吸引力（可去打，但低于空车道）
      //   危险（会命中）    → 用剩余时间 tHit（越大=越晚命中=越优，用于风筝）
      const A = G.auto, ENGAGE = A.engage;
      let best = curLane, bestScore = -1e9;
      for (let l = 0; l < lanes; l++) {
        let s;
        if (tHit[l] === Infinity) s = A.emptyScore + appeal[l];
        else if (tHit[l] > ENGAGE) s = A.engageScore + appeal[l];
        else s = tHit[l];
        s += (l === curLane ? 0.5 : 0);      // 滞回，减少抖动
        s -= Math.abs(l - curLane) * 0.15;   // 就近偏置
        if (s > bestScore) { bestScore = s; best = l; }
      }
      return laneCenter(best);
    },

    collide() {
      const p = this.player;

      // 玩家子弹 → 敌人 / 奖励
      for (const b of this.bullets) {
        if (b.dead) continue;
        for (const e of this.enemies) {
          if (e.dead || b.hitIds.has(e.id)) continue;
          if (U.circleHit(b.x, b.y, b.r, e.x, e.y, e.size)) {
            e.hit(b.dmg);
            b.hitIds.add(e.id);
            if (e.dead) {
              this.score += e.score;
              this.addFloater(e.x, e.y, '+' + e.score, '#ffd166');
              this.spawnParticles(e.x, e.y, e.color, 12, 170);
            } else {
              this.spawnParticles(b.x, b.y, '#ffffff', 3, 120);
            }
            b.pen--;
            if (b.pen <= 0) { b.dead = true; break; }
          }
        }
        if (b.dead) continue;
        for (const r of this.rewards) {
          if (r.dead || b.hitIds.has(r.id)) continue;
          if (U.circleHit(b.x, b.y, b.r, r.x, r.y, r.size)) {
            b.hitIds.add(r.id);
            if (r.hit(b.dmg)) {
              this.applyUpgrade(r.type);
              this.spawnParticles(r.x, r.y, r.color, 14, 170);
            }
          }
        }
      }

      // 敌人撞到玩家本体 → 扣倍率（只有碰到才扣；漏过的循环回顶部，不在此扣）
      for (const e of this.enemies) {
        if (!e.dead && U.circleHit(e.x, e.y, e.size, p.x, p.y, p.size)) {
          if (p.hit(e.dmg)) {
            this.shake = e.isBoss ? 14 : 10;
            this.addFloater(p.x, p.y - 20, '-' + e.dmg, '#ff6b6b');
            this.spawnParticles(p.x, p.y, '#ff6b6b', e.isBoss ? 16 : 10, 150);
          }
          if (!e.isBoss) e.dead = true; // Boss 撞上不销毁，继续下压并循环
        }
      }

      // 敌人子弹 → 玩家
      for (const eb of this.ebullets) {
        if (eb.dead) continue;
        if (U.circleHit(eb.x, eb.y, eb.r, p.x, p.y, p.size)) {
          if (p.hit(eb.dmg)) {
            this.shake = 8;
            this.spawnParticles(p.x, p.y, '#ff8787', 8, 140);
          }
          eb.dead = true;
        }
      }

      // 奖励错过
      for (const r of this.rewards) {
        if (!r.dead && r.y >= G.PLAYER_LINE) r.dead = true;
      }
    },

    /* --------------------------- 渲染 --------------------------- */
    render(ctx) {
      const W = G.VW, H = G.VH;
      ctx.clearRect(0, 0, W, H);

      ctx.save();
      if (this.shake > 0) {
        ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      }

      this.drawBackground(ctx, W, H);

      if (this.mode === 'menu') { ctx.restore(); return; }

      // 实体
      for (const r of this.rewards) r.draw(ctx);
      for (const e of this.enemies) e.draw(ctx);
      for (const b of this.bullets) b.draw(ctx);
      for (const eb of this.ebullets) eb.draw(ctx);
      if (this.player) this.player.draw(ctx);

      // 粒子
      for (const p of this.particles) {
        ctx.globalAlpha = U.clamp(p.life / p.max, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 飘字
      for (const f of this.floaters) {
        ctx.save();
        ctx.globalAlpha = U.clamp(f.life, 0, 1);
        ctx.fillStyle = f.color;
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
      }

      ctx.restore();

      this.drawHUD(ctx, W, H);
    },

    drawBackground(ctx, W, H) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, G.colors.bg1);
      g.addColorStop(1, G.colors.bg0);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // 滚动网格（向下流动的通道感）
      ctx.strokeStyle = G.colors.lane;
      ctx.lineWidth = 1;
      const step = 48;
      for (let y = -step + this.bgScroll; y < H; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // 车道分隔
      const lw = laneWidth();
      ctx.strokeStyle = G.colors.laneEdge;
      for (let i = 1; i < G.LANES; i++) {
        ctx.beginPath(); ctx.moveTo(i * lw, 0); ctx.lineTo(i * lw, H); ctx.stroke();
      }
      // 玩家基线（已非“危险线”：漏过的敌人会循环回顶部，只有被撞才扣血）
      ctx.strokeStyle = 'rgba(79,209,255,0.35)';
      ctx.setLineDash([4, 10]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, G.PLAYER_LINE); ctx.lineTo(W, G.PLAYER_LINE); ctx.stroke();
      ctx.setLineDash([]);
    },

    drawHUD(ctx, W, H) {
      if (!this.player) return;
      // 顶栏
      ctx.save();
      ctx.fillStyle = 'rgba(8,12,22,0.6)';
      ctx.fillRect(0, 0, W, 56);
      ctx.fillStyle = 'rgba(79,209,255,0.25)';
      ctx.fillRect(0, 56, W, 2);

      ctx.textBaseline = 'middle';
      // 倍率
      ctx.fillStyle = '#51cf66';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e8eefc';
      ctx.fillText('倍率 ' + this.player.multiplier, 12, 28);
      // 分数 / 波次（右侧给自动开关让出空间）
      const RX = W - 78;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('分数 ' + U.fmt(this.score), RX, 20);
      ctx.fillStyle = '#9be7ff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText('第 ' + this.wave + ' 波', RX, 40);
      // 自动模式指示
      if (this.autoMode) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(124,192,252,0.9)';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText('◎ 自动', 12, 46);
      }
      // 武器（中间）
      const w = this.player.weapon;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cdd6f4';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(
        `伤${w.damage} 穿${w.penetration} 重${w.multishot} 斜${w.fan} 频${w.fireCd.toFixed(2)}s`,
        W / 2, 28);
      ctx.restore();
    },
  };

  window.Game = Game;
})();
