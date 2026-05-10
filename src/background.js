/**
 * ============================================================
 *  Background — Animated underwater environment
 *
 *  Layers (bottom to top):
 *   1. Background PNG image (parallax offset)
 *   2. Dark blue underwater tint overlay
 *   3. Light rays from surface
 *   4. Small fish silhouettes
 *   5. Seaweed waving
 *   6. Floating trash drift particles
 *   7. Bubble particles
 *   8. Water dust particles
 *   9. Pollution overlay (darkens with wave)
 *  10. Toxic green glow (danger level)
 *  11. Vignette
 *  12. Water distortion (shake on boss/danger)
 *
 *  Call:  BG.draw(frame, wave, bossActive)
 *  Call:  BG.update(frame, wave, bossActive)
 * ============================================================
 */

const BG = (() => {
  'use strict';

  const R  = Maki.Renderer;
  const MM = Maki.Math;

  // ─────────────────────────────────────────────
  //  Canvas size helpers
  // ─────────────────────────────────────────────
  function _W() { return R.width; }
  function _H() { return R.height; }

  // ─────────────────────────────────────────────
  //  Particle arrays — lazy initialized on first update()
  // ─────────────────────────────────────────────
  const MAX_BUBBLES = 180;
  let _bubbles    = null;
  let _fish       = null;
  let _driftTrash = null;
  let _dust       = null;
  let _rays       = null;
  let _initialized = false;

  function _init() {
    if (_initialized) return;
    _initialized = true;

    _bubbles = Array.from({ length: MAX_BUBBLES }, () => ({
      x:          MM.randFloat(0, _W()),
      y:          MM.randFloat(0, _H()),
      r:          MM.randFloat(1.5, 4.5),
      speed:      MM.randFloat(0.3, 0.9),
      bob:        MM.randFloat(0, Math.PI * 2),
      wobbleSpeed:MM.randFloat(0.02, 0.06),
      alpha:      MM.randFloat(0.15, 0.4)
    }));

    _fish = Array.from({ length: 6 }, () => ({
      x:     MM.randFloat(-80, _W() + 80),
      y:     MM.randFloat(60, _H() - 80),
      speed: MM.randFloat(0.3, 0.7) * (Math.random() < 0.5 ? 1 : -1),
      size:  MM.randFloat(6, 14),
      alpha: MM.randFloat(0.08, 0.18),
      bob:   MM.randFloat(0, Math.PI * 2)
    }));

    _driftTrash = Array.from({ length: 10 }, () => ({
      x:       MM.randFloat(0, _W()),
      y:       MM.randFloat(40, _H() - 60),
      size:    MM.randFloat(3, 7),
      drift:   MM.randFloat(-0.3, 0.3),
      bob:     MM.randFloat(0, Math.PI * 2),
      bobSpeed:MM.randFloat(0.01, 0.03),
      alpha:   MM.randFloat(0.12, 0.25),
      color:   ['#88aacc','#aaccaa','#ccaa88','#aaaacc'][MM.randInt(0, 3)]
    }));

    _dust = Array.from({ length: 30 }, () => ({
      x:    MM.randFloat(0, _W()),
      y:    MM.randFloat(0, _H()),
      vx:   MM.randFloat(-0.15, 0.15),
      vy:   MM.randFloat(-0.1, 0.1),
      r:    MM.randFloat(0.5, 1.5),
      alpha:MM.randFloat(0.04, 0.12)
    }));

    _rays = Array.from({ length: 6 }, (_, i) => ({
      x:    (i / 6) * _W() + MM.randFloat(-20, 20),
      width:MM.randFloat(18, 40),
      speed:MM.randFloat(0.003, 0.008),
      phase:MM.randFloat(0, Math.PI * 2),
      alpha:MM.randFloat(0.025, 0.055)
    }));
  }

  // ─────────────────────────────────────────────
  //  Screen shake state
  // ─────────────────────────────────────────────
  let _shakeX = 0;
  let _shakeY = 0;
  let _shakeDecay = 0;

  function triggerShake(strength) {
    _shakeDecay = strength;
  }

  // ─────────────────────────────────────────────
  //  Parallax offset
  // ─────────────────────────────────────────────
  let _parallaxX = 0;
  let _parallaxY = 0;

  // ─────────────────────────────────────────────
  //  Update  (call once per frame before draw)
  // ─────────────────────────────────────────────
  function update(frame, wave, bossActive) {
    _init(); // lazy init particles on first frame
    const dangerLevel = Math.min(1, (wave - 1) / 8); // 0→1 over 8 waves
    const bubbleCount = bossActive ? MAX_BUBBLES
                      : Math.floor(80 + dangerLevel * 100);

    // ── Bubbles ──
    for (let i = 0; i < MAX_BUBBLES; i++) {
      const b = _bubbles[i];
      const active = i < bubbleCount;
      if (!active) continue;

      const speedMult = bossActive ? 2.5 : (1 + dangerLevel * 1.2);
      b.y -= b.speed * speedMult;
      b.bob = (b.bob || 0) + b.wobbleSpeed;
      b.x += Math.sin(b.bob) * 0.4;

      if (b.y < -10) {
        b.x = MM.randFloat(0, _W());
        b.y = _H() + 10;
      }
    }

    // ── Fish ──
    for (const f of _fish) {
      f.x += f.speed;
      f.bob += 0.04;
      if (f.x > _W() + 100) f.x = -100;
      if (f.x < -100)    f.x = _W() + 100;
    }

    // ── Drift trash ──
    const trashSpeed = bossActive ? 2.5 : (1 + dangerLevel * 1.5);
    for (const t of _driftTrash) {
      t.bob += t.bobSpeed;
      t.x   += t.drift * trashSpeed;
      t.y   += Math.sin(t.bob) * 0.3;
      if (t.x > _W() + 20) t.x = -20;
      if (t.x < -20)    t.x = _W() + 20;
    }

    // ── Dust ──
    for (const d of _dust) {
      d.x += d.vx;
      d.y += d.vy;
      if (d.x < 0) d.x = _W();
      if (d.x > _W()) d.x = 0;
      if (d.y < 0) d.y = _H();
      if (d.y > _H()) d.y = 0;
    }

    // ── Screen shake ──
    if (_shakeDecay > 0) {
      _shakeX = MM.randFloat(-_shakeDecay, _shakeDecay);
      _shakeY = MM.randFloat(-_shakeDecay, _shakeDecay);
      _shakeDecay *= 0.85;
      if (_shakeDecay < 0.3) _shakeDecay = 0;
    } else {
      _shakeX = 0; _shakeY = 0;
    }

    // Boss: continuous shake
    if (bossActive) {
      _shakeX = MM.randFloat(-3, 3);
      _shakeY = MM.randFloat(-2, 2);
    }

    // ── Parallax (gentle ocean current drift) ──
    _parallaxX = Math.sin(frame * 0.004) * 6;
    _parallaxY = Math.sin(frame * 0.003) * 3;
  }

  // ─────────────────────────────────────────────
  //  Draw
  // ─────────────────────────────────────────────
  function draw(frame, wave, bossActive) {
    if (!_initialized) return; // not ready yet
    const dangerLevel = Math.min(1, (wave - 1) / 8);
    const ctx = R.ctx;

    // Apply screen shake offset
    R.save();
    ctx.translate(_shakeX, _shakeY);

    // ── 1. Background image with parallax ──
    _drawBgImage(frame, dangerLevel);

    // ── 2. Dark underwater tint ──
    _drawUnderwaterTint(dangerLevel, bossActive);

    // ── 3. Light rays ──
    _drawLightRays(frame, dangerLevel, bossActive);

    // ── 4. Fish silhouettes ──
    _drawFish(frame);

    // ── 5. Seaweed ──
    _drawSeaweed(frame, dangerLevel);

    // ── 6. Floating trash drift ──
    _drawDriftTrash(dangerLevel, bossActive);

    // ── 7. Bubbles ──
    _drawBubbles(frame, wave, bossActive, dangerLevel);

    // ── 8. Water dust ──
    _drawDust(dangerLevel);

    // ── 9. Pollution overlay ──
    _drawPollutionOverlay(dangerLevel, bossActive, frame);

    // ── 10. Vignette ──
    _drawVignette(dangerLevel, bossActive, frame);

    R.restore();
  }

  // ─────────────────────────────────────────────
  //  Layer implementations
  // ─────────────────────────────────────────────

  function _drawBgImage(frame, dangerLevel) {
    const img = Loader.get('background');
    if (img) {
      // Parallax: slight offset based on ocean current
      const ox = _parallaxX;
      const oy = _parallaxY;
      // Draw slightly oversized so parallax doesn't show edges
      R.ctx.drawImage(img, ox - 4, oy - 4, _W() + 8, _H() + 8);
    } else {
      // Fallback gradient
      R.fillRect(0, 0, _W(), _H(), '#001133');
      R.fillRect(0, _H() * 0.4, _W(), _H() * 0.6, '#001a44');
    }
  }

  function _drawUnderwaterTint(dangerLevel, bossActive) {
    // Base dark blue tint — gets darker with pollution
    const baseAlpha = 0.18 + dangerLevel * 0.22;
    R.save();
    R.setAlpha(bossActive ? 0.55 : baseAlpha);
    R.fillRect(0, 0, _W(), _H(), '#000d22');
    R.restore();
  }

  function _drawLightRays(frame, dangerLevel, bossActive) {
    if (bossActive) return; // rays hidden during boss
    R.save();
    for (const ray of _rays) {
      const sway = Math.sin(frame * ray.speed + ray.phase) * 30;
      const alpha = ray.alpha * (1 - dangerLevel * 0.7);
      if (alpha <= 0) continue;
      R.setAlpha(alpha);
      R.fillPolygon([
        { x: ray.x + sway,              y: 0 },
        { x: ray.x + ray.width + sway,  y: 0 },
        { x: ray.x + ray.width * 2.5,   y: _H() },
        { x: ray.x + ray.width * 1.2,   y: _H() }
      ], '#88ccff');
    }
    R.restore();
  }

  function _drawFish(frame) {
    R.save();
    for (const f of _fish) {
      R.setAlpha(f.alpha);
      const bobY = Math.sin(f.bob) * 3;
      const flip = f.speed < 0 ? -1 : 1;

      R.ctx.save();
      R.ctx.translate(Math.round(f.x), Math.round(f.y + bobY));
      R.ctx.scale(flip, 1);

      // Body
      R.ctx.fillStyle = '#001a33';
      R.ctx.beginPath();
      R.ctx.ellipse(0, 0, f.size, f.size * 0.5, 0, 0, Math.PI * 2);
      R.ctx.fill();
      // Tail
      R.ctx.beginPath();
      R.ctx.moveTo(-f.size, 0);
      R.ctx.lineTo(-f.size - f.size * 0.7, -f.size * 0.5);
      R.ctx.lineTo(-f.size - f.size * 0.7,  f.size * 0.5);
      R.ctx.closePath();
      R.ctx.fill();
      // Eye
      R.ctx.fillStyle = '#003366';
      R.ctx.beginPath();
      R.ctx.arc(f.size * 0.5, -f.size * 0.1, f.size * 0.15, 0, Math.PI * 2);
      R.ctx.fill();

      R.ctx.restore();
    }
    R.restore();
  }

  function _drawSeaweed(frame, dangerLevel) {
    const positions = [30, 95, 175, 265, 355, 445, 530, 605];
    const heights   = [  5,  7,   6,   8,   5,   7,   6,   5];
    // Seaweed sways faster with pollution
    const swayMult = 1 + dangerLevel * 1.5;

    R.save();
    R.ctx.lineCap = 'round';
    for (let wi = 0; wi < positions.length; wi++) {
      const wx = positions[wi];
      const segs = heights[wi];
      const segH = 9;
      const baseY = _H() - 20;

      // Pick colour — greener normally, yellower/browner when polluted
      const g = Math.floor(140 - dangerLevel * 60);
      const r2 = Math.floor(20 + dangerLevel * 80);
      R.ctx.strokeStyle = `rgb(${r2},${g},30)`;
      R.ctx.lineWidth = 3;
      R.ctx.beginPath();
      R.ctx.moveTo(wx, baseY);
      for (let seg = 1; seg <= segs; seg++) {
        const sway = Math.sin(frame * 0.04 * swayMult + wx * 0.04 + seg * 0.6) * 5;
        R.ctx.lineTo(wx + sway, baseY - seg * segH);
      }
      R.ctx.stroke();
    }
    R.restore();
  }

  function _drawDriftTrash(dangerLevel, bossActive) {
    const alphaMult = bossActive ? 2.5 : (1 + dangerLevel * 1.5);
    R.save();
    for (const t of _driftTrash) {
      R.setAlpha(Math.min(0.5, t.alpha * alphaMult));
      // Small pixel trash blob
      R.fillRect(t.x - t.size / 2, t.y - t.size / 2, t.size, t.size, t.color);
      R.fillRect(t.x - t.size / 4, t.y - t.size,     t.size / 2, t.size / 2, t.color);
    }
    R.restore();
  }

  function _drawBubbles(frame, wave, bossActive, dangerLevel) {
    const bubbleCount = bossActive ? MAX_BUBBLES
                      : Math.floor(80 + dangerLevel * 100);
    R.save();
    for (let i = 0; i < bubbleCount; i++) {
      const b = _bubbles[i];
      R.setAlpha(b.alpha);
      R.strokeCircle(b.x, b.y, b.r, '#aaddff', 1);
      // Tiny highlight
      R.setAlpha(b.alpha * 0.5);
      R.fillCircle(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, '#ffffff');
    }
    R.restore();
  }

  function _drawDust(dangerLevel) {
    R.save();
    for (const d of _dust) {
      R.setAlpha(d.alpha * (1 + dangerLevel));
      R.fillCircle(d.x, d.y, d.r, '#88aacc');
    }
    R.restore();
  }

  function _drawPollutionOverlay(dangerLevel, bossActive, frame) {
    if (dangerLevel <= 0 && !bossActive) return;

    // Darkening overlay
    const darkAlpha = bossActive ? 0.45 : dangerLevel * 0.3;
    R.save();
    R.setAlpha(darkAlpha);
    R.fillRect(0, 0, _W(), _H(), '#000811');
    R.restore();

    // Murky brown/green tint
    if (dangerLevel > 0.2 || bossActive) {
      const murkyAlpha = bossActive ? 0.18 : dangerLevel * 0.12;
      R.save();
      R.setAlpha(murkyAlpha);
      R.fillRect(0, 0, _W(), _H(), '#1a2200');
      R.restore();
    }
  }

  function _drawToxicGlow(frame, dangerLevel, bossActive) {
    const ctx = R.ctx;

    // Boss: flashing toxic green
    if (bossActive) {
      const flash = 0.06 + Math.abs(Math.sin(frame * 0.15)) * 0.1;
      R.save();
      R.setAlpha(flash);
      R.fillRect(0, 0, _W(), _H(), '#00ff44');
      R.restore();

      // Pulse ring from center
      const pulseR = 80 + Math.sin(frame * 0.12) * 40;
      R.save();
      R.setAlpha(0.08 + Math.sin(frame * 0.12) * 0.05);
      ctx.save();
      const grad = ctx.createRadialGradient(_W()/2, _H()/2, 0, _W()/2, _H()/2, pulseR);
      grad.addColorStop(0, 'rgba(0,255,80,0.4)');
      grad.addColorStop(1, 'rgba(0,255,80,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, _W(), _H());
      ctx.restore();
      R.restore();
      return;
    }

    // Normal danger: subtle green edge glow
    const glowAlpha = (dangerLevel - 0.3) / 0.7 * 0.12;
    if (glowAlpha <= 0) return;
    R.save();
    ctx.save();
    const edgeGrad = ctx.createRadialGradient(_W()/2, _H()/2, _H() * 0.3, _W()/2, _H()/2, _H() * 0.8);
    edgeGrad.addColorStop(0, 'rgba(0,180,60,0)');
    edgeGrad.addColorStop(1, `rgba(0,180,60,${glowAlpha})`);
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, _W(), _H());
    ctx.restore();
    R.restore();
  }

  function _drawVignette(dangerLevel, bossActive, frame) {
    const ctx = R.ctx;
    // Vignette strength grows with danger
    const strength = 0.35 + dangerLevel * 0.35 + (bossActive ? 0.2 : 0);
    // Boss: pulsing vignette
    const pulse = bossActive ? Math.sin(frame * 0.1) * 0.08 : 0;

    ctx.save();
    const grad = ctx.createRadialGradient(_W()/2, _H()/2, _H() * 0.25, _W()/2, _H()/2, _H() * 0.85);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.88, strength + pulse)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, _W(), _H());
    ctx.restore();
  }

  // ─────────────────────────────────────────────
  //  Public API
  // ─────────────────────────────────────────────
  return { update, draw, triggerShake };
})();
