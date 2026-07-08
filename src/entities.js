/**
 * ============================================================
 *  Entities — Player (Robot Turtle), Bullet, Trash
 * ============================================================
 */

// ─────────────────────────────────────────────
//  Player (Robot Turtle)
//  - WASD / Arrow keys to move in 4 directions
//  - Turtle rotates to face the direction of movement
//  - Shoots ONE bullet forward (in facing direction)
// ─────────────────────────────────────────────
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 20;  // matches 56px image display size
    this.speed  = 2.8;
    this.frame  = 0;

    // Facing angle in radians (0 = right, -PI/2 = up, etc.)
    // Start facing right
    this.angle        = 0;
    this.targetAngle  = 0;
    this._lastMvX     = 0;
    this._lastMvY     = 0;

    // Shooting
    this.shootCooldown    = 0;
    this.shootRate        = 22; // frames between shots
    this.bulletSpeed      = 14;

    // Health
    this.hp           = 5;
    this.maxHp        = 5;

    // Invincibility after hit
    this.invincible       = 0;
    this.invincibleFrames = 90;

    this.alive = true;
  }

  update(input, canvasW, canvasH) {
    if (!this.alive) return;

    this.frame++;

    // ── Movement ──
    const mv = input.getMovement();
    this._lastMvX = mv.x;
    this._lastMvY = mv.y;
    this.x += mv.x * this.speed;
    this.y += mv.y * this.speed;

    // ── Rotate to face movement direction ──
    if (mv.x !== 0 || mv.y !== 0) {
      this.targetAngle = Math.atan2(mv.y, mv.x);
    }

    // Smooth rotation — snap to nearest direction
    // (use shortest-path angle interpolation)
    let diff = this.targetAngle - this.angle;
    // Wrap diff to [-PI, PI]
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += diff * 0.25; // lerp speed

    // Clamp to canvas (with margin)
    const m = this.radius + 4;
    this.x = Maki.Math.clamp(this.x, m, canvasW - m);
    this.y = Maki.Math.clamp(this.y, m, canvasH - 40);

    // Cooldowns
    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.invincible > 0)    this.invincible--;
  }

  /** Returns array with ONE bullet fired in the facing direction.
   *  Only fires while Space is held down. */
  shoot(input) {
    if (!input.isDown('Space')) return [];
    if (this.shootCooldown > 0) return [];
    this.shootCooldown = this.shootRate;

    // Bullet fires from cannon tip — turtle image is 64px, head is ~top third
    const tipDist = 32;
    const bx = this.x + Math.cos(this.angle) * tipDist;
    const by = this.y + Math.sin(this.angle) * tipDist;

    return [new Bullet(
      bx, by,
      Math.cos(this.angle) * this.bulletSpeed,
      Math.sin(this.angle) * this.bulletSpeed,
      this.angle
    )];
  }

  /** Check if player is hit by a trash object */
  isHitBy(trash) {
    if (this.invincible > 0) return false;
    return Maki.Math.circleOverlap(
      this.x, this.y, this.radius,
      trash.x, trash.y, trash.radius
    );
  }

  takeDamage() {
    this.hp--;
    this.invincible = this.invincibleFrames;
    if (this.hp <= 0) {
      this.hp    = 0;
      this.alive = false;
    }
  }

  draw(renderer) {
    if (!this.alive) return;

    // Invincibility flash — skip every other 5-frame block
    if (this.invincible > 0 && Math.floor(this.invincible / 5) % 2 === 0) return;

    // Determine if moving this frame
    const moving = (this._lastMvX !== 0 || this._lastMvY !== 0);

    // Draw sprite — passes angle for direction, frame for animation, moving for idle vs swim
    Assets.drawTurtle(this.x, this.y, this.angle, this.frame, moving);

    if (this.invincible > 0) {
      Assets.drawShield(this.x, this.y, this.frame);
    }
  }
}

// ─────────────────────────────────────────────
//  Bullet
// ─────────────────────────────────────────────
class Bullet {
  constructor(x, y, vx, vy, angle) {
    this.x     = x;
    this.y     = y;
    this.vx    = vx;
    this.vy    = vy;
    this.angle = angle;
    this.radius = 5;
    this.alive  = true;
    this.frame  = 0;
  }

  update(canvasW, canvasH) {
    this.x += this.vx;
    this.y += this.vy;
    this.frame++;

    // Out of bounds
    if (this.x < -20 || this.x > canvasW + 20 ||
        this.y < -20 || this.y > canvasH + 20) {
      this.alive = false;
    }
  }

  draw(renderer) {
    if (!this.alive) return;
    Assets.drawBullet(this.x, this.y, this.angle, this.frame);
  }
}

// ─────────────────────────────────────────────
//  Sea Waste obstacle types  (all hp = 1 → one shot kill)
// ─────────────────────────────────────────────
const TRASH_TYPES = [
  {
    id: 'plastic_bag',
    draw: (x, y, angle, scale) => Assets.drawPlasticBagImg(x, y, angle, scale),
    radius: 20,   // 76px draw, ~55% of half = 21 → 20
    hp: 1,
    score: 10,
    color: '#88ccff'
  },
  {
    id: 'soda_can',
    draw: (x, y, angle, scale) => Assets.drawSodaCan(x, y, angle, scale),
    radius: 18,   // 70px draw, ~55% of half = 19 → 18
    hp: 1,
    score: 10,
    color: '#cc2222'
  },
  {
    id: 'boxer_shorts',
    draw: (x, y, angle, scale) => Assets.drawBoxerShorts(x, y, angle, scale),
    radius: 20,   // 80px draw, ~55% of half = 22 → 20
    hp: 1,
    score: 10,
    color: '#ffcc00'
  },
  {
    id: 'bottle',
    draw: (x, y, angle, scale) => Assets.drawBottleImg(x, y, angle, scale),
    radius: 22,   // 110px draw, tall/thin shape → 22
    hp: 1,
    score: 10,
    color: '#44bb44'
  },
  {
    id: 'tire',
    draw: (x, y, angle, scale) => Assets.drawTireImg(x, y, angle, scale),
    radius: 22,   // 82px draw, ~55% of half = 22
    hp: 1,
    score: 10,
    color: '#888888'
  },
  {
    id: 'tshirt',
    draw: (x, y, angle, scale) => Assets.drawTshirt(x, y, angle, scale),
    radius: 14,   // 50px draw, flat shape → 14
    hp: 1,
    score: 10,
    color: '#5599cc'
  }
];

// ─────────────────────────────────────────────
//  Trash entity
// ─────────────────────────────────────────────
class Trash {
  constructor(x, y, vx, vy, typeId, scale = 1) {
    this.x     = x;
    this.y     = y;
    this.vx    = vx;
    this.vy    = vy;
    this.angle = Math.atan2(vy, vx);
    this.scale = scale;
    this.frame = 0;
    this.alive = true;

    // Slow rotation
    this.rotSpeed = Maki.Math.randFloat(-0.03, 0.03);
    this.rotation = Maki.Math.randFloat(0, Math.PI * 2);

    // Find type config
    this.type = TRASH_TYPES.find(t => t.id === typeId) || TRASH_TYPES[0];
    this.hp   = this.type.hp;
    this.radius = this.type.radius * scale;
    this.score  = this.type.score;

    // Hit flash
    this.hitFlash = 0;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotSpeed;
    this.frame++;
    if (this.hitFlash > 0) this.hitFlash--;
  }

  hit() {
    this.hp--;
    this.hitFlash = 6;
    if (this.hp <= 0) this.alive = false;
  }

  isOutOfBounds(w, h) {
    const m = 40;
    return this.x < -m || this.x > w + m || this.y < -m || this.y > h + m;
  }

  draw(renderer) {
    if (!this.alive) return;

    renderer.save();

    // Hit flash
    if (this.hitFlash > 0) {
      renderer.setAlpha(0.5 + Math.sin(this.hitFlash * 1.5) * 0.5);
    }

    this.type.draw(this.x, this.y, this.rotation, this.scale);

    renderer.restore();
  }
}

// ─────────────────────────────────────────────
//  Score popup
// ─────────────────────────────────────────────
class ScorePopup {
  constructor(x, y, text) {
    this.x     = x;
    this.y     = y;
    this.text  = text;
    this.life  = 45;
    this.maxLife = 45;
    this.alive = true;
  }

  update() {
    this.y -= 0.7;
    this.life--;
    if (this.life <= 0) this.alive = false;
  }

  draw(renderer) {
    if (!this.alive) return;
    const alpha = this.life / this.maxLife;
    Assets.drawScorePopup(this.x, this.y, this.text, alpha);
  }
}

// ─────────────────────────────────────────────
//  GiantTrashBall — boss enemy
//  Uses boss.png image, chases player, one-hit kills player.
//  Takes 5 hits to destroy, explodes into small trash on death.
// ─────────────────────────────────────────────
class GiantTrashBall {
  constructor(x, y, playerX, playerY) {
    this.x      = x;
    this.y      = y;
    this.radius = 14;   // minimal collision — must nearly touch the boss center
    this.hp     = 3;
    this.maxHp  = 3;
    this.alive  = true;
    this.frame  = 0;
    this.score  = 100;

    // Rotation for spin effect
    this.rotation  = Maki.Math.randFloat(0, Math.PI * 2);
    this.rotSpeed  = Maki.Math.randFloat(0.02, 0.05) * (Math.random() < 0.5 ? 1 : -1);

    // Speed — chases player
    this.speed     = 1.4;
    this.vx        = 0;
    this.vy        = 0;

    // Hit flash
    this.hitFlash  = 0;

    // Size for drawing
    this.size      = 160;
  }

  update(playerX, playerY, allBosses) {
    this.frame++;
    this.rotation += this.rotSpeed;

    // Chase player
    const dx   = playerX - this.x;
    const dy   = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    let fx = (dx / dist) * this.speed;
    let fy = (dy / dist) * this.speed;

    // Separation — push away from other bosses that are too close
    const minDist = this.radius * 2 + 20; // desired minimum gap between bosses
    if (allBosses) {
      for (const other of allBosses) {
        if (other === this || !other.alive) continue;
        const ox  = this.x - other.x;
        const oy  = this.y - other.y;
        const od  = Math.sqrt(ox * ox + oy * oy) || 1;
        if (od < minDist) {
          // Push strength increases the closer they are
          const push = (minDist - od) / minDist * this.speed * 1.8;
          fx += (ox / od) * push;
          fy += (oy / od) * push;
        }
      }
    }

    this.vx = fx;
    this.vy = fy;
    this.x += this.vx;
    this.y += this.vy;

    if (this.hitFlash > 0) this.hitFlash--;
  }

  hit() {
    this.hp--;
    this.hitFlash = 10;
    // Speed up slightly each hit — gets more aggressive
    this.speed += 0.15;
    if (this.hp <= 0) this.alive = false;
  }

  /** Returns true if this ball visually touches the player */
  touchesPlayer(player) {
    return Maki.Math.circleOverlap(
      this.x, this.y, this.radius,
      player.x, player.y, player.radius
    );
  }

  /** Returns array of small Trash pieces spawned on death */
  explode() {
    const pieces = [];
    const types  = ['plastic_bag', 'soda_can', 'boxer_shorts', 'bottle', 'tire', 'tshirt'];
    const count  = 5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Maki.Math.randFloat(-0.3, 0.3);
      const speed = Maki.Math.randFloat(1.5, 3.0);
      const typeId = types[Maki.Math.randInt(0, types.length - 1)];
      pieces.push(new Trash(
        this.x, this.y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        typeId,
        0.8
      ));
    }
    return pieces;
  }

  draw(renderer) {
    if (!this.alive) return;

    const ctx  = renderer.ctx;
    const half = this.size / 2;

    renderer.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(this.rotation);

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.globalAlpha = 0.4 + Math.sin(this.hitFlash * 1.8) * 0.5;
    }

    const img = Loader.get('boss');
    if (img) {
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(img, -half, -half * 0.65, this.size, this.size * 0.65);
      ctx.globalCompositeOperation = prev;
    } else {
      // Fallback circle
      ctx.fillStyle = '#223344';
      ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalAlpha = 1;
    renderer.restore();

    // HP bar above boss
    this._drawHPBar(renderer);
  }

  _drawHPBar(renderer) {
    const barW = 60;
    const barH = 6;
    const bx   = this.x - barW / 2;
    const by   = this.y - this.radius - 14;

    // Background
    renderer.fillRect(bx - 1, by - 1, barW + 2, barH + 2, '#000000');
    renderer.fillRect(bx, by, barW, barH, '#330000');
    // Fill
    const fillW = barW * (this.hp / this.maxHp);
    const col   = this.hp === 3 ? '#00ff44' : this.hp === 2 ? '#ffaa00' : '#ff2222';
    renderer.fillRect(bx, by, fillW, barH, col);
  }
}
