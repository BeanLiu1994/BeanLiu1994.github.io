/* =========================================================================
 * entities.js — 游戏实体：Player / Enemy / Bullet / EnemyBullet / Reward
 * 渲染坐标基于虚拟分辨率 G.VW x G.VH。
 * 视觉用矢量绘制 + 缓存发光精灵（U.drawGlow），无每帧渐变、无 shadowBlur。
 * ========================================================================= */
(function () {
  const G = window.G, U = window.U;

  function laneCenter(lane) {
    const lw = G.VW / G.LANES;
    return (lane + 0.5) * lw;
  }
  function laneWidth() { return G.VW / G.LANES; }

  // 画一对小眼睛（朝向下方，更有“凶”感）
  function eyes(ctx, dx, dy, r, look) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(dx - r, dy, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(dx + r, dy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1030';
    const lx = (look || 0) * r * 0.4;
    ctx.beginPath(); ctx.arc(dx - r + lx, dy + r * 0.2, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(dx + r + lx, dy + r * 0.2, r * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  /* ----------------------------- 玩家 ----------------------------- */
  class Player {
    constructor() {
      const p = G.player;
      this.x = G.VW / 2;
      this.targetX = G.VW / 2;
      this.y = p.y;
      this.size = p.size;
      this.multiplier = p.startMultiplier;
      this.fireCd = p.fireCooldown;
      this.fireTimer = 0;
      this.weapon = {
        damage: p.bulletDamage,
        bulletSpeed: p.bulletSpeed,
        penetration: p.penetration,
        multishot: p.multishot,
        spread: p.spread,
        fan: 0,
        fireCd: p.fireCooldown,
      };
      this.invuln = 0;
      this.flash = 0;
      this.t = 0;
    }

    hit(dmg) {
      if (this.invuln > 0) return false;
      this.multiplier -= dmg;
      this.invuln = 0.6;
      this.flash = 0.25;
      if (this.multiplier < 0) this.multiplier = 0;
      return true;
    }

    tryFire(dt) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = this.fireCd;
        return true;
      }
      return false;
    }

    update(dt, moveDir, dragX) {
      const speed = 320;
      if (dragX != null) {
        this.targetX = U.clamp(dragX, this.size, G.VW - this.size);
      } else if (moveDir !== 0) {
        this.targetX = U.clamp(this.targetX + moveDir * speed * dt, this.size, G.VW - this.size);
      }
      this.x = U.approach(this.x, this.targetX, 20, dt);
      if (this.invuln > 0) this.invuln -= dt;
      if (this.flash > 0) this.flash -= dt;
      this.t += dt;
    }

    draw(ctx) {
      const x = this.x, y = this.y, s = this.size;
      ctx.save();
      ctx.translate(x, y);
      if (this.flash > 0 && Math.floor(this.flash * 30) % 2 === 0) ctx.globalAlpha = 0.45;

      // 升级光环（穿透/多重越高越亮）
      const power = (this.weapon.penetration - 1) + (this.weapon.multishot - 1);
      if (power > 0) {
        ctx.strokeStyle = 'rgba(155,231,255,' + Math.min(0.8, 0.2 + power * 0.12) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, s * 1.25, 0, Math.PI * 2); ctx.stroke();
      }

      // 引擎尾焰（闪烁）
      const flame = s * (0.7 + 0.35 * Math.sin(this.t * 30));
      const fg = ctx.createLinearGradient(0, s * 0.5, 0, s * 0.5 + flame);
      fg.addColorStop(0, '#bff7ff');
      fg.addColorStop(1, 'rgba(79,209,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-s * 0.28, s * 0.5);
      ctx.lineTo(0, s * 0.5 + flame);
      ctx.lineTo(s * 0.28, s * 0.5);
      ctx.closePath(); ctx.fill();

      // 机翼
      ctx.fillStyle = '#2b7fb8';
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, -s * 0.1); ctx.lineTo(-s * 0.95, s * 0.55);
      ctx.lineTo(-s * 0.2, s * 0.35); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.35, -s * 0.1); ctx.lineTo(s * 0.95, s * 0.55);
      ctx.lineTo(s * 0.2, s * 0.35); ctx.closePath(); ctx.fill();

      // 机身
      const bg = ctx.createLinearGradient(0, -s, 0, s * 0.6);
      bg.addColorStop(0, '#aef1ff');
      bg.addColorStop(1, '#2aa7e6');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.55, s * 0.45);
      ctx.lineTo(0, s * 0.2);
      ctx.lineTo(-s * 0.55, s * 0.45);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e6fbff'; ctx.lineWidth = 1.5; ctx.stroke();

      // 座舱
      ctx.fillStyle = '#0b3a52';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.15, s * 0.22, s * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9be7ff';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.22, s * 0.1, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();

      ctx.restore();
    }
  }

  /* ----------------------------- 敌人 ----------------------------- */
  class Enemy {
    constructor(type, lane, hpScale) {
      const t = G.enemyTypes[type];
      this.id = U.nextId();
      this.type = type;
      this.x = laneCenter(lane);
      this.lane = lane;
      this.y = -t.size;
      this.size = t.size;
      this.maxHp = Math.max(1, Math.round(t.hp * hpScale));
      this.hp = this.maxHp;
      this.speed = t.speed;
      this.dmg = t.dmg;
      this.color = t.color;
      this.score = t.score;
      this.shooter = t.shooter;
      this.shootTimer = t.shootCd || 0;
      this.dead = false;
      this.wobble = Math.random() * Math.PI * 2;
      this.flash = 0;
      this.t = Math.random() * 10;
      this.isBoss = (type === 'boss');
    }

    hit(dmg) {
      this.hp -= dmg;
      this.flash = 0.12;
      if (this.hp <= 0) { this.dead = true; return true; }
      return false;
    }

    update(dt) {
      this.y += this.speed * dt;
      this.wobble += dt * 4;
      this.t += dt;
      if (this.flash > 0) this.flash -= dt;
    }

    draw(ctx) {
      const x = this.x, y = this.y, s = this.size;
      const f = this.flash > 0 && Math.floor(this.flash * 40) % 2 === 0;
      ctx.save();
      ctx.translate(x, y);

      // 发光底
      U.drawGlow(ctx, this.color, 0, 0, s * (this.isBoss ? 1.5 : 1.35));

      const body = f ? '#ffffff' : this.color;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';

      if (this.type === 'normal') {
        // 圆润小兵 + 触角 + 双眼
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, -s - s * 0.4); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -s - s * 0.45, s * 0.12, 0, Math.PI * 2); ctx.fill();
        eyes(ctx, 0, -s * 0.1, s * 0.22, 1);
      } else if (this.type === 'fast') {
        // 飞镖（朝下）+ 拖尾
        ctx.fillStyle = 'rgba(255,209,102,0.25)';
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(-s * 0.5, -s * (0.6 + i * 0.5));
          ctx.lineTo(s * 0.5, -s * (0.6 + i * 0.5));
          ctx.lineTo(0, -s * (0.1 + i * 0.5));
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(0, s); ctx.lineTo(s * 0.85, -s * 0.6); ctx.lineTo(0, -s * 0.2);
        ctx.lineTo(-s * 0.85, -s * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
        eyes(ctx, 0, -s * 0.15, s * 0.18, 1);
      } else if (this.type === 'tank') {
        // 重甲方块 + 铆钉 + 怒眼
        U.roundRect(ctx, -s, -s, s * 2, s * 2, 7);
        ctx.fillStyle = body; ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        const b = s * 0.78, o = s * 0.62;
        [[-b, -b], [b, -b], [-b, b], [b, b]].forEach(([bx, by]) => {
          ctx.beginPath(); ctx.arc(bx, by, o * 0.18, 0, Math.PI * 2); ctx.fill();
        });
        // 愤怒斜眉 + 眼
        ctx.strokeStyle = '#2b0a14'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.5); ctx.lineTo(-s * 0.1, -s * 0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.5, -s * 0.5); ctx.lineTo(s * 0.1, -s * 0.2); ctx.stroke();
        eyes(ctx, 0, 0, s * 0.2, 1);
      } else if (this.type === 'shooter') {
        // 炮台：圆顶 + 朝下炮管 + 充能眼
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(0, -s * 0.1, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#063b30';
        U.roundRect(ctx, -s * 0.28, s * 0.3, s * 0.56, s * 0.9, 4); ctx.fill();
        // 充能光
        const ch = 0.5 + 0.5 * Math.sin(this.t * 8);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.5 * ch) + ')';
        ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#04121f';
        ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.18, 0, Math.PI * 2); ctx.fill();
      } else if (this.isBoss) {
        // Boss：多角巨兽 + 多眼 + 血条
        ctx.fillStyle = body;
        ctx.beginPath();
        const spikes = 8;
        for (let i = 0; i < spikes * 2; i++) {
          const rr = (i % 2 === 0) ? s : s * 0.7;
          const a = (Math.PI / spikes) * i - Math.PI / 2;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // 三只眼
        eyes(ctx, -s * 0.4, -s * 0.1, s * 0.16, 1);
        eyes(ctx, s * 0.4, -s * 0.1, s * 0.16, 1);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, s * 0.25, s * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1b1030';
        ctx.beginPath(); ctx.arc(0, s * 0.25, s * 0.08, 0, Math.PI * 2); ctx.fill();
        // 血条
        const bw = s * 1.8, bh = 6;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        U.roundRect(ctx, -bw / 2, -s - 18, bw, bh, 3); ctx.fill();
        ctx.fillStyle = '#ff5d8f';
        U.roundRect(ctx, -bw / 2, -s - 18, bw * (this.hp / this.maxHp), bh, 3); ctx.fill();
      }

      // 数字（HP）
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.round(s * (this.isBoss ? 1.1 : 0.95)) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(this.hp, 0, this.isBoss ? s * 0.55 : 1);
      ctx.fillText(this.hp, 0, this.isBoss ? s * 0.55 : 1);
      ctx.restore();
    }
  }

  /* --------------------------- 玩家子弹 --------------------------- */
  class Bullet {
    constructor(x, y, dmg, speed, pen, angle) {
      this.id = U.nextId();
      this.x = x; this.y = y;
      const a = (angle == null) ? -Math.PI / 2 : angle; // 默认朝上
      this.vx = Math.cos(a) * speed;
      this.vy = Math.sin(a) * speed;
      this.dmg = dmg;
      this.pen = pen;
      this.hitIds = new Set();
      this.dead = false;
      this.r = 7;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y < -20 || this.x < -30 || this.x > G.VW + 30) this.dead = true;
    }
    draw(ctx) {
      U.drawGlow(ctx, G.colors.bullet, this.x, this.y, 12);
      ctx.save();
      ctx.fillStyle = '#eaffff';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 0.55, this.r * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* --------------------------- 敌人子弹 --------------------------- */
  class EnemyBullet {
    constructor(x, y, vy, dmg) {
      this.id = U.nextId();
      this.x = x; this.y = y;
      this.vy = vy; this.dmg = dmg;
      this.r = 7; this.dead = false;
    }
    update(dt) { this.y += this.vy * dt; if (this.y > G.VH + 20) this.dead = true; }
    draw(ctx) {
      U.drawGlow(ctx, G.colors.ebullet, this.x, this.y, 11);
      ctx.save();
      ctx.fillStyle = '#ffd0d0';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  /* ----------------------------- 奖励 ----------------------------- */
  const REWARD_ICON = {
    fire: '⚡', dmg: '⚔', pen: '➤', multi: '✺', mult: '×', fan: '✳', score: '★',
  };
  class Reward {
    constructor(type, lane) {
      const t = G.rewardTypes[type];
      this.id = U.nextId();
      this.type = type;
      this.x = laneCenter(lane);
      this.y = -30;
      this.size = 26;
      this.maxValue = t.value;
      this.value = t.value;
      this.color = t.color;
      this.label = t.label;
      this.icon = REWARD_ICON[type] || '?';
      this.speed = 46;
      this.dead = false;
      this.flash = 0;
      this.t = 0;
    }
    hit(dmg) {
      this.value -= dmg;
      this.flash = 0.12;
      if (this.value <= 0) { this.dead = true; return true; }
      return false;
    }
    update(dt) { this.y += this.speed * dt; this.t += dt; if (this.flash > 0) this.flash -= dt; }
    draw(ctx) {
      const x = this.x, y = this.y, s = this.size;
      const f = this.flash > 0 && Math.floor(this.flash * 40) % 2 === 0;
      const bob = Math.sin(this.t * 4) * 2;
      ctx.save();
      ctx.translate(x, y + bob);
      U.drawGlow(ctx, this.color, 0, 0, s * 1.5);
      ctx.fillStyle = f ? '#fff' : this.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      U.roundRect(ctx, -s, -s * 0.85, s * 2, s * 1.7, 9); ctx.fill(); ctx.stroke();
      // 图标
      ctx.fillStyle = '#04121f';
      ctx.font = 'bold ' + Math.round(s * 0.95) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.icon, 0, -s * 0.15);
      // 数字
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.round(s * 0.72) + 'px system-ui, sans-serif';
      ctx.fillText(this.value, 0, s * 0.6);
      ctx.restore();
    }
  }

  window.Player = Player;
  window.Enemy = Enemy;
  window.Bullet = Bullet;
  window.EnemyBullet = EnemyBullet;
  window.Reward = Reward;
  window.laneCenter = laneCenter;
  window.laneWidth = laneWidth;
})();
