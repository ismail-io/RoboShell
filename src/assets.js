/**
 * ============================================================
 *  Assets — Pixel-art drawing functions
 *  All sprites are drawn procedurally with canvas primitives
 *  (no external image files needed)
 * ============================================================
 */

const Assets = (() => {
  'use strict';

  const R = Maki.Renderer;
  const M = Maki.Math;

  // ─────────────────────────────────────────────
  //  Robot Turtle (player) — PNG body + animated flippers
  // ─────────────────────────────────────────────
  const TURTLE_SIZE = 56; // body image size (width & height)

  function drawTurtle(x, y, angle, frame = 0, moving = true) {
    const img  = Loader.get('turtle');
    const half = TURTLE_SIZE / 2;

    // Idle bob
    const bob = moving ? 0 : Math.sin(frame * 0.07) * 2;

    // Flipper swing
    const speed = moving ? 0.45 : 0.08;
    const swing = moving ? 18 : 4;
    const finW  = Math.sin(frame * speed) * swing;
    const footW = Math.sin(frame * speed + 1.2) * swing;

    R.save();
    R.ctx.translate(Math.round(x), Math.round(y + bob));
    R.ctx.rotate(angle + Math.PI / 2);

    // 1. Flippers behind body
    _drawFlippers(R.ctx, finW, footW, false);

    // 2. Body image
    if (img) {
      const prev = R.ctx.globalCompositeOperation;
      R.ctx.globalCompositeOperation = 'screen';
      R.ctx.drawImage(img, -half, -half, TURTLE_SIZE, TURTLE_SIZE);
      R.ctx.globalCompositeOperation = prev;
    } else {
      R.ctx.fillStyle = '#1a6b8a';
      R.ctx.beginPath();
      R.ctx.ellipse(0, 4, 16, 14, 0, 0, Math.PI * 2);
      R.ctx.fill();
    }

    // 3. Flipper tips on top
    _drawFlippers(R.ctx, finW, footW, true);

    R.restore();
  }

  function _drawFlippers(ctx, finW, footW, frontOnly) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const fc1 = '#1a7a99';
    const fc2 = '#00ccee';
    const fc3 = '#004466';

    if (!frontOnly) {
      // ── Left side fin — anchor x=-11 (was -15) ──
      ctx.save();
      ctx.translate(-11, 0);
      ctx.rotate((-12 + finW) * Math.PI / 180);
      ctx.fillStyle = fc3;
      ctx.beginPath();
      ctx.moveTo(0,0); ctx.lineTo(-7,-1); ctx.lineTo(-9,2);
      ctx.lineTo(-6,5); ctx.lineTo(0,3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = fc1;
      ctx.beginPath();
      ctx.moveTo(0,1); ctx.lineTo(-6,0); ctx.lineTo(-8,2);
      ctx.lineTo(-5,4); ctx.lineTo(0,2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = fc2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-1,1); ctx.lineTo(-6,2); ctx.stroke();
      ctx.restore();

      // ── Right side fin — anchor x=+11 ──
      ctx.save();
      ctx.translate(11, 0);
      ctx.rotate((12 - finW) * Math.PI / 180);
      ctx.fillStyle = fc3;
      ctx.beginPath();
      ctx.moveTo(0,0); ctx.lineTo(7,-1); ctx.lineTo(9,2);
      ctx.lineTo(6,5); ctx.lineTo(0,3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = fc1;
      ctx.beginPath();
      ctx.moveTo(0,1); ctx.lineTo(6,0); ctx.lineTo(8,2);
      ctx.lineTo(5,4); ctx.lineTo(0,2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = fc2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(1,1); ctx.lineTo(6,2); ctx.stroke();
      ctx.restore();

      // ── Back-left foot — anchor (-6, 13) (was -8, 17) ──
      ctx.save();
      ctx.translate(-6, 13);
      ctx.rotate((-7 + footW) * Math.PI / 180);
      ctx.fillStyle = '#1a6688';
      ctx.beginPath();
      ctx.moveTo(0,0); ctx.lineTo(-4,1); ctx.lineTo(-5,5);
      ctx.lineTo(-1,6); ctx.lineTo(0,3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#00aacc'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-1,1); ctx.lineTo(-3,4); ctx.stroke();
      ctx.restore();

      // ── Back-right foot — anchor (6, 13) ──
      ctx.save();
      ctx.translate(6, 13);
      ctx.rotate((7 - footW) * Math.PI / 180);
      ctx.fillStyle = '#1a6688';
      ctx.beginPath();
      ctx.moveTo(0,0); ctx.lineTo(4,1); ctx.lineTo(5,5);
      ctx.lineTo(1,6); ctx.lineTo(0,3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#00aacc'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(1,1); ctx.lineTo(3,4); ctx.stroke();
      ctx.restore();
    }

    if (frontOnly) {
      // Left fin tip
      ctx.save();
      ctx.translate(-11, 0);
      ctx.rotate((-12 + finW) * Math.PI / 180);
      ctx.fillStyle = fc2;
      ctx.beginPath();
      ctx.moveTo(-6,-1); ctx.lineTo(-9,2); ctx.lineTo(-6,4);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // Right fin tip
      ctx.save();
      ctx.translate(11, 0);
      ctx.rotate((12 - finW) * Math.PI / 180);
      ctx.fillStyle = fc2;
      ctx.beginPath();
      ctx.moveTo(6,-1); ctx.lineTo(9,2); ctx.lineTo(6,4);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  // ─────────────────────────────────────────────
  //  Bullet (robot turtle laser shell)
  // ─────────────────────────────────────────────
  function drawBullet(x, y, angle, frame = 0) {
    R.save();
    R.transform(x, y, angle);

    // Outer glow
    R.save();
    R.setAlpha(0.25);
    R.fillCircle(0, 0, 9, '#00ffcc');
    R.restore();

    // Shell-shaped projectile (elongated along travel direction)
    R.fillPolygon([
      { x:  8, y:  0 },
      { x:  4, y: -3 },
      { x: -5, y: -2 },
      { x: -5, y:  2 },
      { x:  4, y:  3 }
    ], '#00cc88');

    // Inner bright core
    R.fillRect(-3, -1, 8, 2, '#aaffee');
    R.fillCircle(2, 0, 2, '#ffffff');

    R.restore();
  }

  // ─────────────────────────────────────────────
  //  Sea Waste Obstacle Sprites — drawn from PNG
  //  Each function draws the image centred at (x,y)
  //  rotated by `angle`, scaled to `size` px wide.
  //  Falls back to a coloured circle if image missing.
  // ─────────────────────────────────────────────

  /**
   * Generic image-based obstacle renderer.
   * @param {string} key      - Loader key
   * @param {string} fallback - Fallback fill colour
   * @param {number} size     - Render size in pixels (width = height)
   */
  function _drawObstacleImage(key, fallback, x, y, angle, scale, size = 48) {
    const img = Loader.get(key);
    const s   = size * scale;

    R.save();
    R.transform(x, y, angle);

    if (img) {
      R.ctx.drawImage(img, -s / 2, -s / 2, s, s);
    } else {
      // Fallback: coloured circle with label
      R.fillCircle(0, 0, s / 2, fallback);
      R.save();
      R.setAlpha(0.7);
      R.fillCircle(0, 0, s / 2 - 4, '#000000');
      R.restore();
    }

    R.restore();
  }

  // ── The 6 obstacle types ──

  function drawPlasticBagImg(x, y, angle, scale = 1) {
    _drawObstacleImage('frame_1', '#88ccff', x, y, angle, scale, 76);
  }

  function drawSodaCan(x, y, angle, scale = 1) {
    _drawObstacleImage('frame_2', '#cc2222', x, y, angle, scale, 70);
  }

  function drawBoxerShorts(x, y, angle, scale = 1) {
    _drawObstacleImage('frame_3', '#ffcc00', x, y, angle, scale, 80);
  }

  function drawBottleImg(x, y, angle, scale = 1) {
    _drawObstacleImage('frame_4', '#44bb44', x, y, angle, scale, 110);
  }

  function drawTireImg(x, y, angle, scale = 1) {
    _drawObstacleImage('frame_5', '#555555', x, y, angle, scale, 82);
  }

  function drawTshirt(x, y, angle, scale = 1) {
    _drawObstacleImage('frame_6', '#5599cc', x, y, angle, scale, 50);
  }

  // ─────────────────────────────────────────────
  //  Ocean background — delegated to BG module
  //  (kept here so callers use Assets.drawBackground)
  // ─────────────────────────────────────────────
  function drawBackground(frame, score, bossActive) {
    // Convert score to a wave-like number for BG pollution level
    const wave = 1 + Math.floor(score / 50);
    BG.update(frame, wave, bossActive);
    BG.draw(frame, wave, bossActive);
  }

  // ─────────────────────────────────────────────
  //  Score popup text
  // ─────────────────────────────────────────────
  function drawScorePopup(x, y, text, alpha) {
    R.save();
    R.setAlpha(alpha);
    R.drawText(text, x, y, '#ffff44', 14, 'center');
    R.restore();
  }

  // ─────────────────────────────────────────────
  //  Shield / invincibility flash
  // ─────────────────────────────────────────────
  function drawShield(x, y, frame) {
    R.save();
    R.setAlpha(0.3 + Math.sin(frame * 0.3) * 0.2);
    R.strokeCircle(x, y, 24, '#00ffff', 2);
    R.restore();
  }

  // ─────────────────────────────────────────────
  //  Public API
  // ─────────────────────────────────────────────
  return {
    drawTurtle,
    drawBullet,
    drawPlasticBagImg,
    drawSodaCan,
    drawBoxerShorts,
    drawBottleImg,
    drawTireImg,
    drawTshirt,
    drawBackground,
    drawScorePopup,
    drawShield
  };
})();
