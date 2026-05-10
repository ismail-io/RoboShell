/**
 * ============================================================
 *  Game — Score-milestone Giant Trash Ball boss system
 *
 *  Normal play:  trash spawns continuously, +10 per kill
 *  Boss event:   triggered at score 50, 100, 150, 200 ...
 *                5 Giant Trash Balls chase the player
 *                Normal trash stops during boss event
 *                Defeat all 5 → normal play resumes
 *                Touch any boss → instant game over
 * ============================================================
 */

// Boss triggers every 50 score points: 50, 100, 150, 200...
// Boss count: milestone 1→3, 2→5, 3→7, 4→9 ... (1 + idx*2)
const BOSS_INTERVAL = 50;

class GameScene extends Maki.Scene {
  constructor(engine) {
    super(engine);
    this.particles = new Maki.Particles();
  }

  onEnter() {
    const W = this.engine.renderer.width;
    const H = this.engine.renderer.height;

    this.player  = new Player(W / 2, H / 2);
    this.bullets = [];
    this.trashes = [];
    this.bosses  = [];
    this.popups  = [];

    this.score = 0;
    this.frame = 0;
    this.highScore = parseInt(localStorage.getItem('roboShellHighScore') || '0');

    // Normal trash spawning
    this.spawnTimer    = 0;
    this.spawnInterval = 75;

    // Boss event state
    this.bossActive       = false;
    this.bossesDefeated   = 0;
    this.nextMilestoneIdx = 1;
    this.bossIntroTimer   = 0;
    this.bossVictoryTimer = 0;
    this._bossQueue       = [];
    this._totalBossCount  = 0;

    this.particles.clear();
    this._updateHUD();

    // Start background music
    const bgm = document.getElementById('bgm');
    if (bgm) { bgm.currentTime = 0; bgm.play().catch(() => {}); }
  }

  onExit() {
    // Clean up game state when leaving to menu
    this.bosses  = [];
    this.trashes = [];
    this.bullets = [];
    this.popups  = [];
    this.particles.clear();

    // Stop background music
    const bgm = document.getElementById('bgm');
    if (bgm) { bgm.pause(); bgm.currentTime = 0; }
  }

  // ─────────────────────────────────────────────
  //  Update
  // ─────────────────────────────────────────────
  update(dt) {
    const W     = this.engine.renderer.width;
    const H     = this.engine.renderer.height;
    const input = this.engine.input;
    const audio = this.engine.audio;

    this.frame++;
    audio.resume();

    if (!this.player.alive) return;

    // ── Player ──
    this.player.update(input, W, H);

    // ── Shooting ──
    const newBullets = this.player.shoot(input);
    if (newBullets.length > 0) {
      this.bullets.push(...newBullets);
      audio.shoot();
    }

    // ── Bullets ──
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      this.bullets[i].update(W, H);
      if (!this.bullets[i].alive) this.bullets.splice(i, 1);
    }

    // ── Boss intro / victory timers ──
    if (this.bossIntroTimer   > 0) this.bossIntroTimer--;
    if (this.bossVictoryTimer > 0) this.bossVictoryTimer--;

    if (this.bossActive) {
      this._updateBossEvent(W, H, audio);
    } else {
      this._updateNormalPlay(W, H, audio);
      this._checkMilestone(W, H, audio);
    }

    // ── Popups ──
    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].update();
      if (!this.popups[i].alive) this.popups.splice(i, 1);
    }

    // ── Particles ──
    this.particles.update();
  }

  // ─────────────────────────────────────────────
  //  Normal play update
  // ─────────────────────────────────────────────
  _updateNormalPlay(W, H, audio) {
    // Spawn trash
    this.spawnTimer++;
    const interval = Math.max(25, this.spawnInterval - Math.floor(this.score / 100) * 5);
    if (this.spawnTimer >= interval) {
      this.spawnTimer = 0;
      this._spawnTrash(W, H);
    }

    // Update trash
    for (let i = this.trashes.length - 1; i >= 0; i--) {
      const t = this.trashes[i];
      t.update();

      if (t.isOutOfBounds(W, H)) { this.trashes.splice(i, 1); continue; }

      // Bullet vs trash
      let hit = false;
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];
        if (!b.alive) continue;
        if (Maki.Math.circleOverlap(b.x, b.y, b.radius, t.x, t.y, t.radius)) {
          b.alive = false;
          t.hit();
          audio.hit();
          this.particles.burst(t.x, t.y, 6, {
            colors: [t.type.color, '#ffffff', '#ffff88'],
            minSpeed: 1.5, maxSpeed: 3.5, minLife: 12, maxLife: 28, size: 3
          });
          if (!t.alive) {
            this.score += t.score;
            this.popups.push(new ScorePopup(t.x, t.y - 10, `+${t.score}`));
            this._updateHUD();
            this.trashes.splice(i, 1); // ← remove dead trash immediately
          }
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // Player vs trash
      if (this.player.isHitBy(t)) {
        this.player.takeDamage();
        t.alive = false;
        this.trashes.splice(i, 1);
        this.particles.burst(this.player.x, this.player.y, 12, {
          colors: ['#ff4444', '#ff8800', '#ffff00'],
          minSpeed: 2, maxSpeed: 5, minLife: 15, maxLife: 40, size: 4
        });
        BG.triggerShake(4);
        this._updateHUD();
        if (!this.player.alive) {
          this._triggerDeath(audio);
        } else {
          audio.hit();
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  //  Check score milestone → start boss event
  // ─────────────────────────────────────────────
  _checkMilestone(W, H, audio) {
    const nextBoss = this.nextMilestoneIdx * BOSS_INTERVAL;
    if (this.score >= nextBoss) {
      // Boss count: milestone 1→3, 2→5, 3→7 ... = 1 + idx*2
      this._pendingBossCount = 1 + this.nextMilestoneIdx * 2;
      this.nextMilestoneIdx++;
      this._startBossEvent(W, H, audio);
    }
  }

  // ─────────────────────────────────────────────
  //  Start boss event
  // ─────────────────────────────────────────────
  _startBossEvent(W, H, audio) {
    const count           = this._pendingBossCount || 3;
    this.bossActive       = true;
    this.bossesDefeated   = 0;
    this._totalBossCount  = count;
    this.bossIntroTimer   = 180;
    this.trashes          = [];
    this.bosses           = [];
    this._bossQueue       = [];

    // Queue all bosses — spawn one by one every 4 seconds (240 frames)
    for (let i = 0; i < count; i++) {
      this._bossQueue.push(this._makeBossSpawnData(W, H));
    }

    // Spawn first boss immediately; subsequent bosses spawn on a 4s timer
    const b1 = this._spawnNextBoss(W, H);
    if (b1) this.bosses.push(b1);

    // Timer counts down 240 frames (4s at 60fps) between each spawn
    this._bossSpawnTimer = 240;

    BG.triggerShake(6);
    audio.waveUp();
    this._updateHUD();
  }

  // ─────────────────────────────────────────────
  //  Boss event update
  // ─────────────────────────────────────────────
  _updateBossEvent(W, H, audio) {
    // Tick the continuous spawn timer — spawn next boss every 4s (240 frames)
    if (this._bossQueue.length > 0) {
      this._bossSpawnTimer--;
      if (this._bossSpawnTimer <= 0) {
        this._bossSpawnTimer = 240; // reset for next boss
        const next = this._spawnNextBoss(W, H);
        if (next) this.bosses.push(next);
      }
    }

    // Update each boss
    for (let i = this.bosses.length - 1; i >= 0; i--) {
      const boss = this.bosses[i];

      boss.update(this.player.x, this.player.y, this.bosses);

      // Bullet vs boss
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];
        if (!b.alive) continue;
        if (Maki.Math.circleOverlap(b.x, b.y, b.radius, boss.x, boss.y, boss.radius)) {
          b.alive = false;
          boss.hit();
          audio.hit();
          BG.triggerShake(3);

          // Hit particles
          this.particles.burst(boss.x, boss.y, 10, {
            colors: ['#00ff44', '#88ff88', '#ffffff', '#ffff00'],
            minSpeed: 2, maxSpeed: 5, minLife: 15, maxLife: 35, size: 5
          });

          if (!boss.alive) {
            // Explosion particles
            this.particles.burst(boss.x, boss.y, 40, {
              colors: ['#aaccff', '#ffff00', '#ff8800', '#ffffff', '#88ccff'],
              minSpeed: 2, maxSpeed: 8, minLife: 25, maxLife: 60, size: 6
            });
            this.particles.burst(boss.x, boss.y, 20, {
              colors: ['#ffffff', '#aaddff'],
              minSpeed: 4, maxSpeed: 10, minLife: 15, maxLife: 35, size: 3
            });
            BG.triggerShake(10);
            audio.death();

            this.bossesDefeated++;
            this.popups.push(new ScorePopup(boss.x, boss.y - 20, `BOSS DOWN! 💥`));
            this._updateHUD();
            this.bosses.splice(i, 1);
          }
          break;
        }
      }

      // Boss touches player → lose 1 HP (respects invincibility frames so each touch = 1 HP)
      if (this.player.alive && boss.alive && this.player.invincible === 0 && boss.touchesPlayer(this.player)) {
        this.player.takeDamage();
        BG.triggerShake(5);
        this._updateHUD();

        this.particles.burst(this.player.x, this.player.y, 14, {
          colors: ['#ff4444', '#ff8800', '#ffff00'],
          minSpeed: 2, maxSpeed: 5, minLife: 15, maxLife: 40, size: 4
        });

        if (!this.player.alive) {
          BG.triggerShake(12);
          audio.death();
          // Stop music on death
          const bgm = document.getElementById('bgm');
          if (bgm) { bgm.pause(); bgm.currentTime = 0; }
          setTimeout(() => this._gameOver(), 900);
          return;
        } else {
          audio.hit();
        }
      }
    }

    // All bosses spawned and defeated → end event
    if (this.bosses.length === 0 && this._bossQueue.length === 0
        && this.bossesDefeated >= this._totalBossCount) {
      this._endBossEvent(audio);
    }
  }

  // ─────────────────────────────────────────────
  //  Boss spawn helpers
  // ─────────────────────────────────────────────
  _makeBossSpawnData(W, H) {
    const edge = Maki.Math.randInt(0, 3);
    let bx, by;
    switch (edge) {
      case 0: bx = Maki.Math.randFloat(60, W-60); by = -50;    break;
      case 1: bx = W + 50;  by = Maki.Math.randFloat(60, H-60); break;
      case 2: bx = Maki.Math.randFloat(60, W-60); by = H + 50;  break;
      case 3: bx = -50;     by = Maki.Math.randFloat(60, H-60); break;
    }
    return { bx, by };
  }

  _spawnNextBoss(W, H) {
    if (this._bossQueue.length === 0) return null;
    const { bx, by } = this._bossQueue.shift();
    const boss = new GiantTrashBall(bx, by, W/2, H/2);
    return boss;
  }

  // ─────────────────────────────────────────────
  //  End boss event
  // ─────────────────────────────────────────────
  _endBossEvent(audio) {
    this.bossActive       = false;
    this.bossVictoryTimer = 180;
    this.trashes          = [];
    this.spawnTimer       = 0;
    audio.waveUp();
    BG.triggerShake(5);
    this._updateHUD();
  }

  // ─────────────────────────────────────────────
  //  Spawn normal trash
  // ─────────────────────────────────────────────
  _spawnTrash(W, H) {
    const M    = Maki.Math;
    const edge = M.randInt(0, 3);
    let x, y;
    switch (edge) {
      case 0: x = M.randFloat(0, W); y = -20;    break;
      case 1: x = W + 20;            y = M.randFloat(0, H); break;
      case 2: x = M.randFloat(0, W); y = H + 20; break;
      case 3: x = -20;               y = M.randFloat(0, H); break;
    }

    const cx    = W / 2 + M.randFloat(-80, 80);
    const cy    = H / 2 + M.randFloat(-60, 60);
    const angle = Math.atan2(cy - y, cx - x);
    const spd   = M.randFloat(1.0, 1.8 + Math.floor(this.score / 100) * 0.2);
    const types = ['plastic_bag', 'soda_can', 'boxer_shorts', 'bottle', 'tire', 'tshirt'];

    this.trashes.push(new Trash(
      x, y,
      Math.cos(angle) * spd,
      Math.sin(angle) * spd,
      types[M.randInt(0, types.length - 1)],
      M.randFloat(0.85, 1.05)
    ));
  }

  // ─────────────────────────────────────────────
  //  Death
  // ─────────────────────────────────────────────
  _triggerDeath(audio) {
    this.particles.burst(this.player.x, this.player.y, 30, {
      colors: ['#ff2222', '#ff8800', '#ffff00', '#ffffff'],
      minSpeed: 2, maxSpeed: 7, minLife: 25, maxLife: 60, size: 5
    });
    BG.triggerShake(8);
    audio.death();
    // Stop music on death
    const bgm = document.getElementById('bgm');
    if (bgm) { bgm.pause(); bgm.currentTime = 0; }
    setTimeout(() => this._gameOver(), 900);
  }

  // ─────────────────────────────────────────────
  //  Draw
  // ─────────────────────────────────────────────
  draw(renderer) {
    Assets.drawBackground(this.frame, this.score, this.bossActive);

    this.particles.draw(renderer);

    // Normal trash
    for (const t of this.trashes) t.draw(renderer);

    // Boss enemies
    for (const boss of this.bosses) {
      boss.draw(renderer);
    }

    // Bullets
    for (const b of this.bullets) b.draw(renderer);

    // Player
    this.player.draw(renderer);

    // Popups
    for (const p of this.popups) p.draw(renderer);

    // HUD
    this._drawHealthBar(renderer);

    // Boss intro banner
    if (this.bossIntroTimer > 0) this._drawBossBanner(renderer);

    // Victory banner
    if (this.bossVictoryTimer > 0) this._drawVictoryBanner(renderer);

    // Death overlay
    if (!this.player.alive) this._drawDeathOverlay(renderer);

    // Touch controls — always draw during gameplay so mobile players can see them
    renderer.drawTouchControls(this.engine.input.getTouchState());
  }

  // ─────────────────────────────────────────────
  //  Boss intro banner — animated "GIANT" text only
  // ─────────────────────────────────────────────
  _drawBossBanner(renderer) {
    const W   = renderer.width;
    const H   = renderer.height;
    const ctx = renderer.ctx;
    const t   = this.bossIntroTimer;      // 180 → 0
    const age = 180 - t;                  // 0 → 180

    // Fade in fast, fade out at end
    const alpha = Math.min(1, age / 10) * Math.min(1, t / 20);
    if (alpha <= 0) return;

    // ── Animation modes cycle every 18 frames ──
    const mode = Math.floor(age / 18) % 6;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';

    const cx = W / 2;
    const cy = H / 2;

    switch (mode) {
      case 0: {
        // Pulse scale
        const scale = 1 + Math.sin(age * 0.4) * 0.18;
        ctx.font = `bold ${Math.round(52 * scale)}px "Courier New", monospace`;
        ctx.fillStyle = '#ff2200';
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur  = 20;
        ctx.fillText('Giants Are Coming', cx, cy);
        break;
      }
      case 1: {
        // Shake
        const sx = Math.sin(age * 1.8) * 6;
        const sy = Math.cos(age * 2.1) * 4;
        ctx.font = 'bold 48px "Courier New", monospace';
        ctx.fillStyle = '#ff2200';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur  = 25;
        ctx.fillText('Giants Are Coming', cx + sx, cy + sy);
        break;
      }
      case 2: {
        // Letter wave — all red
        const letters = 'Giants Are Coming'.split('');
        ctx.font = 'bold 46px "Courier New", monospace';
        ctx.shadowBlur = 18;
        letters.forEach((l, i) => {
          const lx = cx - 200 + i * 24;
          const ly = cy + Math.sin(age * 0.25 + i * 1.2) * 12;
          ctx.shadowColor = '#ff0000';
          ctx.fillStyle   = '#ff2200';
          ctx.globalAlpha = alpha;
          ctx.fillText(l, lx, ly);
        });
        break;
      }
      case 3: {
        // Zoom in
        const sc = Math.min(1, (age % 18) / 10);
        ctx.font = `bold ${Math.round(24 + 30 * sc)}px "Courier New", monospace`;
        ctx.fillStyle = '#ff2200';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur  = 30;
        ctx.fillText('Giants Are Coming', cx, cy);
        break;
      }
      case 4: {
        // Glitch offset
        const gx = (age % 3 === 0) ? 4 : 0;
        ctx.font = 'bold 50px "Courier New", monospace';
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = '#ff6600';
        ctx.fillText('Giants Are Coming', cx + gx, cy);
        ctx.fillStyle = '#ff0000';
        ctx.fillText('Giants Are Coming', cx - gx, cy + 2);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ff2200';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur  = 15;
        ctx.fillText('Giants Are Coming', cx, cy);
        break;
      }
      case 5: {
        // Outline stroke
        ctx.font = 'bold 52px "Courier New", monospace';
        ctx.strokeStyle = '#aa0000';
        ctx.lineWidth   = 4;
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur  = 22;
        ctx.strokeText('Giants Are Coming', cx, cy);
        ctx.fillStyle = '#ff4422';
        ctx.fillText('Giants Are Coming', cx, cy);
        break;
      }
    }

    ctx.restore();

    // Boss count indicator below animated text
    if (alpha > 0.3) {
      const count = this._totalBossCount || 3;
      renderer.save();
      renderer.setAlpha(alpha * 0.9);
      renderer.drawText(
        `▼ ${count} GIANTS INCOMING ▼`,
        W / 2, H / 2 + 52, '#ff6644', 14, 'center'
      );
      renderer.restore();
    }
  }

  // ─────────────────────────────────────────────
  //  Victory banner — animated "keep cleaning" text
  // ─────────────────────────────────────────────
  _drawVictoryBanner(renderer) {
    const W   = renderer.width;
    const H   = renderer.height;
    const ctx = renderer.ctx;
    const t   = this.bossVictoryTimer;   // 180 → 0
    const age = 180 - t;

    const alpha = Math.min(1, age / 10) * Math.min(1, t / 20);
    if (alpha <= 0) return;

    const mode = Math.floor(age / 20) % 5;
    const cx   = W / 2;
    const cy   = H / 2;

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    switch (mode) {
      case 0: {
        // Wave — each letter bobs, all green
        const letters = 'KEEP CLEANING'.split('');
        ctx.font = 'bold 32px "Courier New", monospace';
        ctx.shadowBlur = 14;
        letters.forEach((l, i) => {
          const lx = cx - 195 + i * 30;
          const ly = cy + Math.sin(age * 0.2 + i * 0.5) * 10;
          ctx.fillStyle   = '#00ff44';
          ctx.shadowColor = '#00cc33';
          ctx.globalAlpha = alpha;
          ctx.fillText(l, lx, ly);
        });
        break;
      }
      case 1: {
        // Pulse green
        const sc = 1 + Math.sin(age * 0.35) * 0.12;
        ctx.font = `bold ${Math.round(34 * sc)}px "Courier New", monospace`;
        ctx.fillStyle   = '#00ff44';
        ctx.shadowColor = '#00ff44';
        ctx.shadowBlur  = 20;
        ctx.globalAlpha = alpha;
        ctx.fillText('KEEP CLEANING', cx, cy);
        break;
      }
      case 2: {
        // Glitch — green shades
        const gx = (age % 3 === 0) ? 3 : 0;
        ctx.font = 'bold 34px "Courier New", monospace';
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = '#006622';
        ctx.fillText('KEEP CLEANING', cx + gx, cy);
        ctx.fillStyle = '#44ff88';
        ctx.fillText('KEEP CLEANING', cx - gx, cy + 2);
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = '#00ff44';
        ctx.shadowColor = '#00ff44';
        ctx.shadowBlur  = 12;
        ctx.fillText('KEEP CLEANING', cx, cy);
        break;
      }
      case 3: {
        // Zoom green
        const sc2 = Math.min(1, (age % 20) / 12);
        ctx.font = `bold ${Math.round(18 + 18 * sc2)}px "Courier New", monospace`;
        ctx.fillStyle   = '#00ff44';
        ctx.shadowColor = '#00cc33';
        ctx.shadowBlur  = 18;
        ctx.globalAlpha = alpha;
        ctx.fillText('KEEP CLEANING', cx, cy);
        break;
      }
      case 4: {
        // Outline stroke green
        ctx.font = 'bold 36px "Courier New", monospace';
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#007722';
        ctx.lineWidth   = 3;
        ctx.shadowColor = '#00ff44';
        ctx.shadowBlur  = 16;
        ctx.strokeText('KEEP CLEANING', cx, cy);
        ctx.fillStyle = '#00ff44';
        ctx.fillText('KEEP CLEANING', cx, cy);
        break;
      }
    }

    ctx.restore();
  }

  // ─────────────────────────────────────────────
  //  Death overlay — removed (no red flash)
  // ─────────────────────────────────────────────
  _drawDeathOverlay(renderer) {
    // intentionally empty
  }

  // ─────────────────────────────────────────────
  //  High Score — top left
  // ─────────────────────────────────────────────
  _drawHighScore(renderer) {
    const hs = this.highScore || 0;
    renderer.save();
    renderer.setAlpha(0.85);
    renderer.drawText(`HI: ${hs}`, 14, 28, '#ffdd44', 14, 'left');
    renderer.restore();
  }

  // ─────────────────────────────────────────────
  //  Health Bar — top center hearts
  // ─────────────────────────────────────────────
  _drawHealthBar(renderer) {
    const W        = renderer.width;
    const hp       = this.player.hp;
    const maxHp    = this.player.maxHp;
    const heartSize = 18;
    const gap       = 6;
    const totalW    = maxHp * heartSize + (maxHp - 1) * gap;
    const startX    = (W - totalW) / 2;

    for (let i = 0; i < maxHp; i++) {
      this._drawHeart(renderer, startX + i * (heartSize + gap), 10, heartSize, i < hp);
    }
  }

  _drawHeart(renderer, x, y, size, filled) {
    const s  = size / 16;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const pts = [];
    for (let t = 0; t <= Math.PI * 2; t += 0.15) {
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t));
      pts.push({ x: cx + hx*s*0.45, y: cy + hy*s*0.45 });
    }
    if (filled) {
      renderer.fillPolygon(pts, '#dd1111');
      renderer.save(); renderer.setAlpha(0.5);
      renderer.fillCircle(cx - size*0.12, cy - size*0.15, size*0.12, '#ff8888');
      renderer.restore();
    } else {
      renderer.fillPolygon(pts, '#331111');
    }
  }

  // ─────────────────────────────────────────────
  //  Score bar — top left, next milestone indicator
  // ─────────────────────────────────────────────
  _drawScoreBar(renderer) {
    if (this.bossActive) {
      const remaining = this.bosses.length + (this._bossQueue ? this._bossQueue.length : 0);
      renderer.save();
      renderer.setAlpha(0.9);
      renderer.drawText(`👾 ${remaining} / ${this._totalBossCount} bosses`, 10, 22, '#ff4444', 11, 'left');
      renderer.restore();
      return;
    }
    // Progress bar toward next boss
    const prev = (this.nextMilestoneIdx - 1) * BOSS_INTERVAL;
    const next = this.nextMilestoneIdx * BOSS_INTERVAL;
    const prog = Math.min(1, (this.score - prev) / BOSS_INTERVAL);
    const barW = 100, barH = 6, bx = 10, by = 10;
    renderer.fillRect(bx, by, barW, barH, '#001100');
    renderer.fillRect(bx, by, barW * prog, barH, '#00ff44');
    renderer.save();
    renderer.setAlpha(0.7);
    renderer.drawText(`BOSS: ${next}`, bx, by + barH + 10, '#88ffaa', 10, 'left');
    renderer.restore();
  }

  // ─────────────────────────────────────────────
  //  HUD
  // ─────────────────────────────────────────────
  _updateHUD() {
    document.getElementById('score').textContent = this.score;
    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('roboShellHighScore', this.highScore);
    }
    document.getElementById('hiscore').textContent = this.highScore;
  }

  // ─────────────────────────────────────────────
  //  Game Over
  // ─────────────────────────────────────────────
  _gameOver() {
    // Save high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('roboShellHighScore', this.highScore);
    }
    const hs = parseInt(localStorage.getItem('roboShellHighScore') || '0');

    // Set stats text (hidden initially via CSS opacity:0)
    document.getElementById('final-score-text').textContent = `Score: ${this.score}`;
    document.getElementById('final-hi-text').textContent    =
      this.score >= hs ? `NEW HIGH SCORE: ${hs}!` : `Best: ${hs}`;
    document.getElementById('final-wave-text').textContent  =
      `Bosses Defeated: ${this.bossesDefeated}`;
    document.getElementById('eco-msg').textContent = `Keep fighting for the ocean!`;

    // Reset all to hidden
    const titleEl = document.getElementById('gameover-title');
    const scoreEl = document.getElementById('final-score-text');
    const hiEl    = document.getElementById('final-hi-text');
    const waveEl  = document.getElementById('final-wave-text');
    const ecoEl   = document.getElementById('eco-msg');
    [titleEl, scoreEl, hiEl, waveEl, ecoEl].forEach(el => el.classList.remove('reveal', 'done'));
    titleEl.textContent = '';

    // Show the screen
    document.getElementById('gameover-screen').classList.add('active');
    document.getElementById('pause-btn').classList.remove('visible');

    // ── Game over music — play, then replay after 2s gap each time it ends ──
    const goMusic = document.getElementById('bgm-gameover');
    if (goMusic) {
      this._stopGameOverMusic(); // clear any previous loop

      goMusic._onEnded = () => {
        goMusic._loopTimer = setTimeout(() => {
          goMusic.currentTime = 0;
          goMusic.play().catch(() => {});
        }, 2000);
      };

      goMusic.addEventListener('ended', goMusic._onEnded);
      goMusic.currentTime = 0;
      goMusic.play().catch(() => {});
    }

    // ── Typing animation for "GAME OVER" ──
    const fullText  = 'GAME OVER';
    let   charIndex = 0;
    const typeSpeed = 90; // ms per character

    const typeNext = () => {
      if (charIndex < fullText.length) {
        titleEl.textContent += fullText[charIndex++];
        setTimeout(typeNext, typeSpeed);
      } else {
        // Typing done — remove cursor blink
        titleEl.classList.add('done');

        // Staggered reveal of stats
        setTimeout(() => scoreEl.classList.add('reveal'), 200);
        setTimeout(() => hiEl.classList.add('reveal'),    500);
        setTimeout(() => waveEl.classList.add('reveal'),  800);

        // Slow fade-in of tagline
        setTimeout(() => ecoEl.classList.add('reveal'),  1400);
      }
    };

    setTimeout(typeNext, 200); // small delay before typing starts
  }

  /** Stop game over music (called when leaving game over screen) */
  _stopGameOverMusic() {
    const goMusic = document.getElementById('bgm-gameover');
    if (!goMusic) return;
    if (goMusic._loopTimer) { clearTimeout(goMusic._loopTimer); goMusic._loopTimer = null; }
    if (goMusic._onEnded)   { goMusic.removeEventListener('ended', goMusic._onEnded); goMusic._onEnded = null; }
    goMusic.pause();
    goMusic.currentTime = 0;
  }
}

// Standalone cloud drawing helper (pixel-art polluted cloud)
function _drawCloud(ctx, cx, cy, cw, ch) {
  // Multi-puff cloud shape using overlapping ellipses
  const puffs = [
    { ox: 0,        oy: ch*0.2,  rx: cw*0.28, ry: ch*0.55 },
    { ox: cw*0.22,  oy: 0,       rx: cw*0.22, ry: ch*0.65 },
    { ox: cw*0.45,  oy: ch*0.1,  rx: cw*0.26, ry: ch*0.6  },
    { ox: cw*0.68,  oy: ch*0.25, rx: cw*0.20, ry: ch*0.5  },
    { ox: cw*0.85,  oy: ch*0.3,  rx: cw*0.16, ry: ch*0.45 },
  ];

  // Shadow layer (darker, offset down)
  ctx.fillStyle = 'rgba(40,35,30,0.55)';
  for (const p of puffs) {
    ctx.beginPath();
    ctx.ellipse(cx + p.ox, cy + p.oy + ch*0.12, p.rx, p.ry*0.85, 0, 0, Math.PI*2);
    ctx.fill();
  }

  // Main cloud body — dirty grey-brown (polluted)
  const grad = ctx.createLinearGradient(cx, cy, cx, cy + ch);
  grad.addColorStop(0,   'rgba(110,100,90,0.88)');
  grad.addColorStop(0.5, 'rgba(80,75,68,0.82)');
  grad.addColorStop(1,   'rgba(55,50,45,0.7)');
  ctx.fillStyle = grad;
  for (const p of puffs) {
    ctx.beginPath();
    ctx.ellipse(cx + p.ox, cy + p.oy, p.rx, p.ry, 0, 0, Math.PI*2);
    ctx.fill();
  }

  // Highlight top edge (slight lighter rim)
  ctx.fillStyle = 'rgba(160,150,130,0.25)';
  for (const p of puffs) {
    ctx.beginPath();
    ctx.ellipse(cx + p.ox, cy + p.oy - p.ry*0.25, p.rx*0.7, p.ry*0.35, 0, 0, Math.PI*2);
    ctx.fill();
  }
}

// ─────────────────────────────────────────────
//  Main Menu — drawn on canvas, no HTML box
// ─────────────────────────────────────────────
class MenuScene extends Maki.Scene {
  constructor(engine, onStart, onExit) {
    super(engine);
    this._onStart = onStart;
    this._onExit  = onExit;
    this._frame   = 0;

    // Button hit areas (set in draw)
    this._btnStart    = { x:0, y:0, w:0, h:0 };
    this._btnExit     = { x:0, y:0, w:0, h:0 };
    this._btnSettings = { x:0, y:0, w:0, h:0 };
    this._hoverStart    = false;
    this._hoverExit     = false;
    this._hoverSettings = false;

    // Settings panel
    this._settings = new SettingsPanel(engine);

    this._handleClick  = this._onClick.bind(this);
    this._handleMove   = this._onMove.bind(this);
    this._handleTouch  = this._onTouchClick.bind(this);
  }

  onEnter() {
    this._frame = 0;
    this._titleCycleStart = 0;
    // Hide score HUD on menu
    document.getElementById('ui-overlay').style.display = 'none';
    window.addEventListener('click',     this._handleClick);
    window.addEventListener('mousemove', this._handleMove);
    window.addEventListener('touchend',  this._handleTouch);

    this._resetTitleLetters();
  }

  _resetTitleLetters() {
    const title   = 'RoboShell Savior';
    this._letters = title.split('').map((ch, i) => ({
      ch,
      sx: (Math.random() - 0.5) * 2.4,
      sy: (Math.random() - 0.5) * 2.0,
      px: (Math.random() - 0.5) * 2.4,
      py: (Math.random() - 0.5) * 2.0,
      delay: i * 4,
      wobble: Math.random() * Math.PI * 2,
      angle: (Math.random() - 0.5) * Math.PI * 3,
      alpha: 0
    }));
  }

  onExit() {
    // Restore score HUD when entering game
    document.getElementById('ui-overlay').style.display = 'flex';
    window.removeEventListener('click',     this._handleClick);
    window.removeEventListener('mousemove', this._handleMove);
    window.removeEventListener('touchend',  this._handleTouch);
    this._settings.close();
  }

  _onClick(e) {
    // Ignore clicks while intro screen is still showing
    const intro = document.getElementById('intro-screen');
    if (intro && !intro.classList.contains('hidden')) return;
    const mx = e.clientX, my = e.clientY;

    // Let settings panel handle its own clicks first
    if (this._settings.isOpen()) {
      this._settings.handleClick(mx, my);
      return;
    }

    if (this._inBtn(mx, my, this._btnSettings)) {
      this._settings.open();
      return;
    }
    if (this._inBtn(mx, my, this._btnStart)) this._onStart();
    if (this._inBtn(mx, my, this._btnExit))  this._onExit();
  }

  _onTouchClick(e) {
    const t = e.changedTouches[0];
    if (!t) return;
    const intro = document.getElementById('intro-screen');
    if (intro && !intro.classList.contains('hidden')) return;
    const mx = t.clientX, my = t.clientY;

    if (this._settings.isOpen()) {
      this._settings.handleClick(mx, my);
      return;
    }
    if (this._inBtn(mx, my, this._btnSettings)) {
      this._settings.open();
      return;
    }
    if (this._inBtn(mx, my, this._btnStart)) this._onStart();
    if (this._inBtn(mx, my, this._btnExit))  this._onExit();
  }

  _onMove(e) {
    const mx = e.clientX, my = e.clientY;
    if (this._settings.isOpen()) {
      this._settings.handleMove(mx, my);
      document.body.style.cursor = this._settings.isHoveringAny() ? 'pointer' : 'default';
      return;
    }
    this._hoverStart    = this._inBtn(mx, my, this._btnStart);
    this._hoverExit     = this._inBtn(mx, my, this._btnExit);
    this._hoverSettings = this._inBtn(mx, my, this._btnSettings);
    document.body.style.cursor =
      (this._hoverStart || this._hoverExit || this._hoverSettings) ? 'pointer' : 'default';
  }

  _inBtn(mx, my, btn) {
    return mx >= btn.x && mx <= btn.x + btn.w &&
           my >= btn.y && my <= btn.y + btn.h;
  }

  update(dt) {
    this._frame++;
    this._settings.update(dt);

    // Loop title animation every 15s (900 frames)
    if (this._frame - this._titleCycleStart >= 900) {
      this._resetTitleLetters();
      this._titleCycleStart = this._frame;
    }
  }

  draw(renderer) {
    const W   = renderer.width;
    const H   = renderer.height;
    const ctx = renderer.ctx;
    const f   = this._frame;

    // ── 1. Menu background image — stretched to fill screen ──
    const menuBg = Loader.get('menu_bg');
    if (menuBg) {
      ctx.drawImage(menuBg, 0, 0, W, H);
    } else {
      // Fallback: dark ocean gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0,   '#0a1520');
      grad.addColorStop(0.6, '#001833');
      grad.addColorStop(1,   '#000d1a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Sun rays from upper-left ──
    ctx.save();
    const sunX = W * 0.18;
    const sunY = H * 0.08;
    const rayCount = 8;
    for (let i = 0; i < rayCount; i++) {
      const baseAngle = -0.15 + (i / rayCount) * 0.55;
      const sway      = Math.sin(f * 0.012 + i * 0.7) * 0.018;
      const angle     = baseAngle + sway;
      const len       = W * 1.1;
      const rayW      = (0.04 + Math.sin(f * 0.02 + i) * 0.015) * W;
      const alpha     = 0.055 + Math.sin(f * 0.018 + i * 0.9) * 0.025;

      ctx.globalAlpha = alpha;
      ctx.fillStyle   = '#ffe8a0';

      ctx.save();
      ctx.translate(sunX, sunY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-rayW / 2, 0);
      ctx.lineTo( rayW / 2, 0);
      ctx.lineTo( rayW * 1.8, len);
      ctx.lineTo(-rayW * 1.8, len);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Sun glow disc
    ctx.globalAlpha = 0.18 + Math.sin(f * 0.03) * 0.05;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * 0.18);
    sunGrad.addColorStop(0,   'rgba(255,240,160,0.9)');
    sunGrad.addColorStop(0.3, 'rgba(255,200,80,0.3)');
    sunGrad.addColorStop(1,   'rgba(255,160,0,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ── 3. Animated clouds ──
    ctx.save();
    const clouds = [
      { xOff: 0.0,  y: 0.06, w: 0.22, h: 0.07, speed: 0.00018, alpha: 0.55 },
      { xOff: 0.25, y: 0.03, w: 0.18, h: 0.055, speed: 0.00012, alpha: 0.45 },
      { xOff: 0.5,  y: 0.08, w: 0.26, h: 0.08, speed: 0.00022, alpha: 0.5  },
      { xOff: 0.72, y: 0.02, w: 0.20, h: 0.06, speed: 0.00015, alpha: 0.4  },
      { xOff: 0.88, y: 0.07, w: 0.16, h: 0.05, speed: 0.00020, alpha: 0.48 },
    ];
    for (const c of clouds) {
      // Drift rightward, wrap around
      const cx = ((c.xOff + f * c.speed) % 1.25 - 0.12) * W;
      const cy = c.y * H;
      const cw = c.w * W;
      const ch = c.h * H;

      ctx.globalAlpha = c.alpha;
      // Dark polluted cloud — grey-brown tones
      _drawCloud(ctx, cx, cy, cw, ch);
    }
    ctx.restore();

    // ── 4. Pollution atmosphere overlays ──

    // Slow dark fog drifting across
    ctx.save();
    const fogX = (Math.sin(f * 0.003) * 0.5 + 0.5) * W * 0.3;
    const fogGrad = ctx.createRadialGradient(
      fogX, H * 0.4, 0,
      fogX, H * 0.4, W * 0.6
    );
    fogGrad.addColorStop(0,   'rgba(10,20,10,0.22)');
    fogGrad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Subtle dark vignette
    ctx.save();
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Slow toxic shimmer at water line (bottom third)
    ctx.save();
    ctx.globalAlpha = 0.06 + Math.sin(f * 0.04) * 0.03;
    const shimGrad = ctx.createLinearGradient(0, H*0.55, 0, H);
    shimGrad.addColorStop(0, 'rgba(0,80,40,0)');
    shimGrad.addColorStop(1, 'rgba(0,120,60,0.5)');
    ctx.fillStyle = shimGrad;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
    ctx.restore();

    // Floating dust particles
    ctx.save();
    for (let i = 0; i < 18; i++) {
      const px = ((i * 137 + f * 0.3) % W);
      const py = ((i * 97  + f * 0.15) % (H * 0.7)) + H * 0.05;
      const pa = 0.06 + Math.sin(f * 0.05 + i) * 0.03;
      ctx.globalAlpha = pa;
      ctx.fillStyle = '#aaccaa';
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── 3. Title — "RoboShell Savior" letter fly-in ──
    this._drawTitle(ctx, W, H, f);

    // ── 4. Buttons ──
    const btnW  = Math.round(Math.min(W * 0.22, 280));
    const btnH  = Math.round(Math.min(H * 0.08, 60));
    const gap   = Math.round(H * 0.028);

    // START — centred
    const btnX  = Math.round(W / 2 - btnW / 2);
    const btn1Y = Math.round(H * 0.52);

    // EXIT — smaller, bottom-right corner
    const exitW = Math.round(Math.min(W * 0.10, 120));
    const exitH = Math.round(Math.min(H * 0.055, 42));
    const exitMargin = 24;
    const exitX = Math.round(W - exitW - exitMargin);
    const exitY = Math.round(H - exitH - exitMargin);

    this._btnStart = { x: btnX,  y: btn1Y, w: btnW,  h: btnH  };
    this._btnExit  = { x: exitX, y: exitY, w: exitW, h: exitH };

    this._drawButton(ctx, this._btnStart, 'START', this._hoverStart, f, '#00ffcc', 'rgba(0,20,15,0.82)');
    this._drawButton(ctx, this._btnExit,  'EXIT',  this._hoverExit,  f, '#ff5544', 'rgba(20,0,0,0.82)', false);

    // ── Gear / Settings button — top-right corner ──
    const gearSize = Math.round(Math.min(W * 0.055, 48));
    const gearMargin = 18;
    const gearX = W - gearSize - gearMargin;
    const gearY = gearMargin;
    this._btnSettings = { x: gearX, y: gearY, w: gearSize, h: gearSize };
    this._drawGearButton(ctx, gearX, gearY, gearSize, this._hoverSettings, f);

    // ── 5. Controls hint ──
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `${Math.round(W * 0.014)}px "Courier New", monospace`;
    ctx.fillStyle    = 'rgba(140,200,170,0.45)';
    ctx.shadowBlur   = 0;
    ctx.fillText('WASD / Arrows — Move    SPACE — Shoot', W / 2, btn1Y + btnH + gap * 2.2);
    ctx.restore();

    // ── Settings panel (drawn on top of everything) ──
    this._settings.draw(ctx, W, H, f);
  }

  _drawGearButton(ctx, x, y, size, hover, frame) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r  = size / 2;
    const pulse = hover ? 1 + Math.sin(frame * 0.15) * 0.06 : 1;
    const rot   = frame * 0.012 + (hover ? frame * 0.03 : 0);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    // Background circle
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = hover ? 'rgba(0,30,40,0.92)' : 'rgba(0,15,25,0.78)';
    ctx.fill();
    ctx.strokeStyle = hover ? '#00ffcc' : 'rgba(0,200,160,0.55)';
    ctx.lineWidth   = hover ? 2.5 : 1.5;
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur  = hover ? 16 : 6;
    ctx.stroke();

    // Gear icon
    ctx.rotate(rot);
    const teeth = 8;
    const innerR = r * 0.28;
    const outerR = r * 0.52;
    const toothW = (Math.PI * 2 / teeth) * 0.42;
    ctx.fillStyle = hover ? '#00ffcc' : 'rgba(0,220,170,0.8)';
    ctx.shadowBlur = hover ? 10 : 4;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2 - toothW / 2;
      const a1 = a0 + toothW;
      const a2 = a1 + (Math.PI * 2 / teeth - toothW) * 0.5;
      const a3 = (i + 1) / teeth * Math.PI * 2 - toothW / 2;
      ctx.lineTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR);
      ctx.lineTo(Math.cos(a0) * outerR, Math.sin(a0) * outerR);
      ctx.lineTo(Math.cos(a1) * outerR, Math.sin(a1) * outerR);
      ctx.lineTo(Math.cos(a1) * innerR, Math.sin(a1) * innerR);
    }
    ctx.closePath();
    ctx.fill();

    // Center hole
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = hover ? 'rgba(0,30,40,0.95)' : 'rgba(0,15,25,0.9)';
    ctx.shadowBlur = 0;
    ctx.fill();

    ctx.restore();
  }

  _drawTitle(ctx, W, H, f) {
    if (!this._letters) return;

    const fontSize  = Math.round(Math.min(W * 0.082, 96));
    const titleY    = H * 0.18;
    const animDur   = 60;
    const settleDur = 80;

    const af = f - (this._titleCycleStart || 0);

    // Use Orbitron if loaded, fallback to Impact then monospace
    const fontStack = `"Orbitron", "Impact", "Courier New", monospace`;

    ctx.save();
    ctx.font         = `900 ${fontSize}px ${fontStack}`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';

    const title  = 'RoboShell Savior';
    const totalW = ctx.measureText(title).width;
    const startX = W / 2 - totalW / 2;

    let curX = startX;
    const targets = [];
    for (const l of this._letters) {
      targets.push(curX);
      curX += ctx.measureText(l.ch).width;
    }

    for (let i = 0; i < this._letters.length; i++) {
      const l    = this._letters[i];
      const age  = Math.max(0, af - l.delay);
      const t    = Math.min(1, age / animDur);
      const ease = 1 - Math.pow(1 - t, 3);

      const tx = targets[i];
      const ty = titleY;
      const lx = l.sx * W + (tx - l.sx * W) * ease;
      const ly = l.sy * H + (ty - l.sy * H) * ease;
      const angle = l.angle * (1 - ease);
      const alpha = Math.min(1, age / 20);

      if (alpha <= 0) continue;

      const settled   = Math.min(1, Math.max(0, (age - animDur) / 20));
      const glowPulse = settled * (24 + Math.sin(f * 0.06 + l.wobble) * 10);

      // "RoboShell" = electric blue-white, "Savior" = gold
      const isGold    = i >= 10;
      const mainColor = isGold ? '#ffd700' : '#00eeff';
      const coreColor = isGold ? '#fffbe0' : '#e0faff';
      const glowColor = isGold ? '#ffaa00' : '#00ccff';

      ctx.save();
      ctx.globalAlpha  = alpha;
      ctx.translate(Math.round(lx), Math.round(ly));
      ctx.rotate(angle);

      // Outer glow — wide soft halo
      if (glowPulse > 0) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur  = glowPulse * 2;
        ctx.fillStyle   = mainColor;
        ctx.fillText(l.ch, 0, 0);
      }

      // Mid glow
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = mainColor;
      ctx.fillText(l.ch, 0, 0);

      // Bright core
      ctx.shadowBlur  = 2;
      ctx.fillStyle   = coreColor;
      ctx.fillText(l.ch, 0, 0);

      ctx.restore();
    }

    // Subtitle
    const allSettled = Math.min(1, Math.max(0, (af - settleDur - this._letters.length * 4) / 30));
    if (allSettled > 0) {
      ctx.globalAlpha  = allSettled * 0.7;
      ctx.textAlign    = 'center';
      ctx.font         = `600 ${Math.round(W * 0.016)}px ${fontStack}`;
      ctx.fillStyle    = '#88ddff';
      ctx.shadowColor  = '#0066aa';
      ctx.shadowBlur   = 8;
      ctx.letterSpacing = '3px';
      ctx.fillText('PROTECT THE OCEAN  ·  DESTROY THE POLLUTION', W / 2, titleY + fontSize * 1.15);
    }

    ctx.restore();
  }

  _drawButton(ctx, btn, label, hover, frame, color, bgColor, glow = true) {
    const { x, y, w, h } = btn;
    const pulse = hover ? 1 + Math.sin(frame * 0.18) * 0.04 : 1;
    const cx = x + w / 2, cy = y + h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    // Background
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, h * 0.25);
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth   = hover ? 3 : 2;
    ctx.shadowColor = glow ? color : 'transparent';
    ctx.shadowBlur  = glow ? (hover ? 20 : 8) : 0;
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, h * 0.25);
    ctx.stroke();

    // Label
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `bold ${Math.round(h * 0.42)}px "Courier New", monospace`;
    ctx.fillStyle    = hover ? '#ffffff' : color;
    ctx.shadowBlur   = (glow && hover) ? 12 : 0;
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }
}

// ─────────────────────────────────────────────
//  Bootstrap
// ─────────────────────────────────────────────
(function init() {
  const canvas   = document.getElementById('gameCanvas');
  const engine   = new Maki.Engine(canvas);

  // ── Loading screen helpers ──
  const loadingScreen = document.getElementById('loading-screen');
  const loadingBar    = document.getElementById('loading-bar');
  const loadingLabel  = document.getElementById('loading-label');

  function showLoading(onDone) {
    loadingBar.style.width = '0%';
    loadingLabel.textContent = 'Preparing the ocean...';
    loadingScreen.classList.add('active');

    // Animate bar from 0 → 100% over ~600ms then call onDone
    let pct = 0;
    const messages = ['Loading assets...', 'Spawning enemies...', 'Filling the ocean...', 'Almost ready...'];
    const interval = setInterval(() => {
      pct += Math.random() * 18 + 8;
      if (pct >= 100) pct = 100;
      loadingBar.style.width = pct + '%';
      loadingLabel.textContent = messages[Math.min(Math.floor(pct / 26), messages.length - 1)];
      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          loadingScreen.classList.remove('active');
          onDone();
        }, 200);
      }
    }, 60);
  }

  // ── Scenes (declared first so handlers can reference them) ──
  const gameScene = new GameScene(engine);
  engine.addScene('game', gameScene);

  // ── Pause button (needed by menuScene callbacks) ──
  const pauseBtn     = document.getElementById('pause-btn');
  const pauseOverlay = document.getElementById('pause-overlay');

  const menuScene = new MenuScene(
    engine,
    () => {
      document.body.style.cursor = 'default';
      pauseBtn.classList.add('visible');
      introReplayBtn.classList.remove('visible'); // hide on game start
      showLoading(() => engine.switchScene('game'));
    },
    () => window.close()
  );
  engine.addScene('menu', menuScene);

  // ── Intro replay button (top-left, visible on main menu only) ──
  const introReplayBtn = document.getElementById('intro-replay-btn');
  // shown after intro finishes or is skipped (handled in dismissIntro)

  introReplayBtn.addEventListener('click', () => {
    const introScreen = document.getElementById('intro-screen');
    const introVideo  = document.getElementById('intro-video');
    introScreen.classList.remove('hidden', 'fade-out');
    introVideo.currentTime = 0;
    // User clicked — browser allows sound now
    introVideo.muted = false;
    introVideo.play().then(() => {
      if (window.renderIntroFrame) window.renderIntroFrame();
    }).catch(() => {
      introVideo.muted = true;
      introVideo.play().then(() => {
        if (window.renderIntroFrame) window.renderIntroFrame();
      }).catch(() => {
        introScreen.classList.add('fade-out');
        setTimeout(() => introScreen.classList.add('hidden'), 650);
      });
    });
  });

  function openPause() {
    engine.paused = true;
    pauseOverlay.classList.add('open');
    const bgm = document.getElementById('bgm');
    if (bgm) bgm.pause();
  }

  function closePause() {
    engine.paused = false;
    pauseOverlay.classList.remove('open');
    const bgm = document.getElementById('bgm');
    if (bgm) bgm.play().catch(() => {});
  }

  pauseBtn.addEventListener('click', () => {
    pauseOverlay.classList.contains('open') ? closePause() : openPause();
  });

  document.getElementById('pm-resume').addEventListener('click', () => {
    closePause();
  });

  document.getElementById('pm-newgame').addEventListener('click', () => {
    closePause();
    document.getElementById('gameover-screen').classList.remove('active');
    gameScene._stopGameOverMusic();
    showLoading(() => engine.switchScene('game'));
  });

  document.getElementById('pm-exit').addEventListener('click', () => {
    pauseOverlay.classList.remove('open');
    engine.paused = false;
    const bgm = document.getElementById('bgm');
    if (bgm) { bgm.pause(); bgm.currentTime = 0; }
    document.getElementById('gameover-screen').classList.remove('active');
    gameScene._stopGameOverMusic();
    pauseBtn.classList.remove('visible');
    showLoading(() => {
      introReplayBtn.classList.add('visible');
      engine.switchScene('menu');
    });
  });

  // Load images then show menu
  Loader.loadAll().then(() => {
    engine.start('menu');
  });

  // Restart button (game over screen)
  document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('gameover-screen').classList.remove('active');
    gameScene._stopGameOverMusic();
    pauseBtn.classList.remove('visible');
    showLoading(() => {
      introReplayBtn.classList.add('visible');
      engine.switchScene('menu');
    });
  });
})();
