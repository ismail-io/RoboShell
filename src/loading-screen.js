/**
 * ============================================================
 *  LoadingScreen  &  StartSplash — Premium animated screens
 *
 *  Both screens use loading-bg.png as the base, enhanced with:
 *   • Animated glowing particles floating upward
 *   • Animated ocean shimmer across the water line
 *   • Subtle Ken-Burns slow zoom on the background
 *   • Bioluminescent bubble stream
 *   • Frosted-glass progress bar panel
 *   • Clean vignette + colour-grading overlay
 *
 *  Public API:
 *    LoadingScreen.init()
 *    LoadingScreen.setProgress(loaded, total, pct, label)
 *    LoadingScreen.complete(onDone)
 *    LoadingScreen.getBgImage()   ← used by start-splash canvas
 * ============================================================
 */
const LoadingScreen = (() => {
  'use strict';

  // ── DOM / Canvas ─────────────────────────────
  let _el, _canvas, _ctx;
  let _raf = null;

  // ── State ─────────────────────────────────────
  let _frame       = 0;
  let _progress    = 0;
  let _dispPct     = 0;
  let _label       = '';
  let _countLoaded = 0;
  let _countTotal  = 12;
  let _phase       = 'loading'; // 'loading' | 'done' | 'waiting' | 'fadeout' | 'finished'
  let _fadeAlpha   = 1;
  let _onComplete  = null;

  // ── Background image ──────────────────────────
  let _bgImg   = null;
  let _bgReady = false;

  // ── Ken-Burns zoom state ─────────────────────
  let _kbScale  = 1.0;   // current scale (slowly grows to 1.08)
  let _kbTarget = 1.08;

  // ── Particles ────────────────────────────────
  const _isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
                    || window.matchMedia('(pointer: coarse)').matches;
  const PARTICLE_COUNT = _isMobile ? 28 : 55;
  let _particles = [];

  // ── Bubbles ───────────────────────────────────
  const BUBBLE_COUNT = _isMobile ? 14 : 28;
  let _bubbles = [];

  // ── Wave shimmer offset ───────────────────────
  let _waveOffset = 0;

  // ── Layout ────────────────────────────────────
  let W, H;

  // ── Palette ───────────────────────────────────
  const C = {
    green:      '#00ff88',
    greenDim:   'rgba(0,220,120,0.65)',
    greenFaint: 'rgba(0,200,100,0.40)',
    greenGlow:  '#00dd66',
    teal:       '#00ffcc',
    bar0:       'rgba(0,30,50,0.70)',
    barFill0:   '#003322',
    barFill1:   '#00aa55',
    barFill2:   '#44ff88',
    barGlow:    '#00bb44',
    gold:       '#ffe84d',
    white:      '#ffffff',
    fallback0:  '#000d1a',
    fallback1:  '#001528',
  };

  // ═══════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════

  function init() {
    _el = document.getElementById('loading-screen');

    _canvas = document.getElementById('ls-canvas');
    if (!_canvas) {
      _canvas = document.createElement('canvas');
      _canvas.id = 'ls-canvas';
      _canvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;display:block;';
      _el.insertBefore(_canvas, _el.firstChild);
    }
    _ctx = _canvas.getContext('2d', { alpha: false });
    _resize();
    window.addEventListener('resize', _resize);

    // Load bg image immediately — before Loader runs
    _bgImg = new Image();
    _bgImg.onload  = () => { _bgReady = true; };
    _bgImg.onerror = () => { _bgReady = false; };
    _bgImg.src = 'assets/loading-bg/loading-bg.png';

    _initParticles();
    _initBubbles();
    _loop();
  }

  function setProgress(loaded, total, pct, label) {
    _countLoaded = loaded    || 0;
    _countTotal  = total     || 12;
    _progress    = Math.min(pct || 0, 100);
    if (label) _label = label;
  }

  function complete(onDone) {
    _onComplete = onDone;
    _progress   = 100;
    _phase      = 'done';
  }

  function getBgImage() { return _bgReady ? _bgImg : null; }

  // ═══════════════════════════════════════════════
  //  PARTICLES — bioluminescent sparks
  // ═══════════════════════════════════════════════
  function _initParticles() {
    _particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      _particles.push(_makeParticle(true));
    }
  }

  function _makeParticle(randomY) {
    const hue = 120 + Math.random() * 50; // green → teal range
    return {
      x:     Math.random() * (W || window.innerWidth),
      y:     randomY
            ? Math.random() * (H || window.innerHeight)
            : (H || window.innerHeight) + 10,
      vy:    -(0.25 + Math.random() * 0.7),
      vx:    (Math.random() - 0.5) * 0.35,
      r:     0.8 + Math.random() * 2.2,
      alpha: 0.0,
      maxA:  0.3 + Math.random() * 0.55,
      fadeIn: 40 + Math.random() * 40,
      life:   0,
      maxLife: 180 + Math.random() * 220,
      hue,
      pulse: Math.random() * Math.PI * 2,
    };
  }

  function _updateParticles() {
    for (let i = 0; i < _particles.length; i++) {
      const p = _particles[i];
      p.life++;
      p.x += p.vx + Math.sin(p.pulse + _frame * 0.02) * 0.18;
      p.y += p.vy;
      p.pulse += 0.04;

      // Fade in / out
      if (p.life < p.fadeIn) {
        p.alpha = (p.life / p.fadeIn) * p.maxA;
      } else if (p.life > p.maxLife - 40) {
        p.alpha = Math.max(0, p.alpha - p.maxA / 40);
      } else {
        p.alpha = p.maxA * (0.75 + Math.sin(p.pulse * 2) * 0.25);
      }

      if (p.life >= p.maxLife || p.y < -10) {
        _particles[i] = _makeParticle(false);
      }
    }
  }

  function _drawParticles(ctx) {
    for (const p of _particles) {
      if (p.alpha <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      // Cheap radial gradient glow — no shadowBlur (expensive on mobile)
      const r2 = p.r * 4;
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r2);
      grd.addColorStop(0,   `hsla(${p.hue},100%,88%,1)`);
      grd.addColorStop(0.4, `hsla(${p.hue},100%,70%,0.6)`);
      grd.addColorStop(1,   `hsla(${p.hue},100%,60%,0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════
  //  BUBBLES — rising ring bubbles
  // ═══════════════════════════════════════════════
  function _initBubbles() {
    _bubbles = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      _bubbles.push(_makeBubble(true));
    }
  }

  function _makeBubble(randomY) {
    const H_ = H || window.innerHeight;
    const W_ = W || window.innerWidth;
    return {
      x:    W_ * 0.1 + Math.random() * W_ * 0.8,
      y:    randomY ? Math.random() * H_ : H_ + 8,
      vy:   0.4 + Math.random() * 0.8,
      r:    1.5 + Math.random() * 4,
      alpha: 0,
      maxA: 0.12 + Math.random() * 0.22,
      life: 0,
      maxLife: 140 + Math.random() * 180,
      phase: Math.random() * Math.PI * 2,
    };
  }

  function _updateBubbles() {
    for (let i = 0; i < _bubbles.length; i++) {
      const b = _bubbles[i];
      b.life++;
      b.y   -= b.vy;
      b.x   += Math.sin(b.phase + _frame * 0.025) * 0.5;
      b.alpha = b.life < 30
        ? (b.life / 30) * b.maxA
        : b.life > b.maxLife - 30
          ? Math.max(0, (b.maxLife - b.life) / 30 * b.maxA)
          : b.maxA;
      if (b.life >= b.maxLife || b.y < -10) {
        _bubbles[i] = _makeBubble(false);
      }
    }
  }

  function _drawBubbles(ctx) {
    for (const b of _bubbles) {
      if (b.alpha <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = b.alpha;
      // Simple stroke ring — no shadowBlur
      ctx.strokeStyle = 'rgba(80,255,160,0.85)';
      ctx.lineWidth   = 0.8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = b.alpha * 0.35;
      ctx.fillStyle   = 'rgba(160,255,200,0.5)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.28, b.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════
  //  LAYOUT
  // ═══════════════════════════════════════════════
  function _resize() {
    W = _canvas.width  = window.innerWidth;
    H = _canvas.height = window.innerHeight;
  }

  // ═══════════════════════════════════════════════
  //  LOOP
  // ═══════════════════════════════════════════════
  function _loop() {
    _raf = requestAnimationFrame(_loop);
    _tick();
    _render();
  }

  function _tick() {
    _frame++;
    _waveOffset += 0.8;

    // Ken-Burns slow zoom
    if (_kbScale < _kbTarget) {
      _kbScale += (_kbTarget - _kbScale) * 0.0003;
    }

    // Smooth progress display
    _dispPct += (_progress - _dispPct) * 0.08;
    if (Math.abs(_dispPct - _progress) < 0.05) _dispPct = _progress;

    _updateParticles();
    _updateBubbles();

    // Phase transitions
    if (_phase === 'done') {
      _phase = 'waiting';
      _frame = 0;
    }
    if (_phase === 'waiting' && _frame > 70) {
      _phase     = 'fadeout';
      _fadeAlpha = 1;
    }
    if (_phase === 'fadeout') {
      _fadeAlpha -= 0.025;
      if (_fadeAlpha <= 0) {
        _fadeAlpha = 0;
        _phase     = 'finished';
        cancelAnimationFrame(_raf);
        _raf = null;
        if (_el) _el.classList.remove('active');
        if (_onComplete) setTimeout(_onComplete, 60);
      }
    }
  }

  // ═══════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════
  function _render() {
    const ctx = _ctx;
    ctx.save();
    if (_phase === 'fadeout') ctx.globalAlpha = Math.max(0, _fadeAlpha);

    _drawBg(ctx);
    _drawWaterShimmer(ctx);
    _drawBubbles(ctx);
    _drawParticles(ctx);
    _drawVignette(ctx);
    _drawProgressPanel(ctx);

    ctx.restore();
  }

  // ── 1. Background with Ken-Burns zoom ─────────
  function _drawBg(ctx) {
    if (_bgReady && _bgImg) {
      const iw = _bgImg.naturalWidth  || _bgImg.width  || W;
      const ih = _bgImg.naturalHeight || _bgImg.height || H;
      const s  = Math.max(W / iw, H / ih) * _kbScale;
      const dw = iw * s;
      const dh = ih * s;
      // Anchor zoom to bottom-centre (keeps turtle in frame)
      const dx = (W - dw) / 2;
      const dy = H - dh; // pin bottom
      ctx.drawImage(_bgImg, dx, dy, dw, dh);
    } else {
      _drawFallbackBg(ctx);
    }
  }

  function _drawFallbackBg(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0,   '#001020');
    g.addColorStop(0.5, '#001833');
    g.addColorStop(1,   '#000d1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ── 2. Colour-grading overlay ──────────────────
  // Removed — image shows through at full brightness.
  function _drawColorGrade(_ctx) { /* intentionally empty */ }

  // ── 3. Animated water shimmer at horizon ──────
  function _drawWaterShimmer(ctx) {
    const waterY = H * 0.52;  // approximate horizon / water-line in image
    const shimH  = H * 0.10;

    ctx.save();
    for (let i = 0; i < 6; i++) {
      const t      = (_waveOffset * (0.6 + i * 0.18) + i * 80) % (W + 120);
      const x      = t - 60;
      const y      = waterY + Math.sin(_frame * 0.025 + i * 1.1) * shimH * 0.4;
      const len    = 80 + Math.sin(_frame * 0.03 + i) * 40;
      const alpha  = 0.04 + Math.sin(_frame * 0.04 + i * 0.7) * 0.025;
      const grad   = ctx.createLinearGradient(x, 0, x + len, 0);
      grad.addColorStop(0,   'rgba(0,180,80,0)');
      grad.addColorStop(0.5, `rgba(0,180,80,${alpha})`);
      grad.addColorStop(1,   'rgba(0,180,80,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y - 2, len, 5);
    }

    // Subtle horizontal glow band at water line
    const lineGrad = ctx.createLinearGradient(0, waterY - 10, 0, waterY + 10);
    lineGrad.addColorStop(0,   'rgba(0,160,60,0)');
    lineGrad.addColorStop(0.5, `rgba(0,160,60,${0.06 + Math.sin(_frame * 0.03) * 0.02})`);
    lineGrad.addColorStop(1,   'rgba(0,160,60,0)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(0, waterY - 10, W, 20);
    ctx.restore();
  }

  // ── 4. Vignette — removed ─────────────────────
  function _drawVignette(_ctx) { /* removed per user request */ }

  // ── 5. Progress panel — bar + labels centred, no title ──────
  function _drawProgressPanel(ctx) {
    _drawBar(ctx);
    _drawLabels(ctx);
  }

  // ── Game title — cyber glitch animation ───────
  function _drawGameTitle(ctx) {
    const titleY  = H * 0.10;
    const fs      = Math.max(20, Math.round(W * 0.048));
    const txt     = 'ROBOSHELL SAVIOR';
    const cx      = W / 2;
    const font    = `900 ${fs}px 'Orbitron','Courier New',monospace`;

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = font;

    // ── Cyber glitch: every ~90 frames do a short glitch burst ──
    const glitchCycle = _frame % 90;
    const isGlitch    = glitchCycle < 8;  // 8-frame glitch window

    if (isGlitch) {
      const gPhase = glitchCycle;

      // Slice 1 — offset left, red channel tint
      const sliceH  = fs * 0.35;
      const sliceY  = titleY - fs * 0.2 + (gPhase % 3) * sliceH * 0.8;
      const offsetX = (gPhase % 2 === 0 ? 1 : -1) * (4 + gPhase * 1.5);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, sliceY - sliceH / 2, W, sliceH);
      ctx.clip();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle   = '#ff003c';  // red ghost
      ctx.fillText(txt, cx + offsetX, titleY);
      ctx.restore();

      // Slice 2 — offset right, green tint
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, titleY - fs * 0.6, W, fs * 0.5);
      ctx.clip();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle   = '#00ff88';  // green ghost
      ctx.fillText(txt, cx - offsetX * 0.6, titleY);
      ctx.restore();

      // Scanline bar across title
      if (gPhase % 2 === 0) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle   = '#00ff88';
        ctx.fillRect(0, titleY - fs * 0.7, W, 3);
        ctx.fillRect(0, titleY + fs * 0.2, W, 2);
        ctx.restore();
      }
    }

    // Main title — always drawn on top of glitch layers
    const pulse = 0.85 + Math.sin(_frame * 0.045) * 0.15;

    // Outer wide green glow
    ctx.shadowColor = '#00cc55';
    ctx.shadowBlur  = Math.round(36 * pulse);
    ctx.fillStyle   = '#00dd66';
    ctx.fillText(txt, cx, titleY);

    // Mid glow
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#00ff88';
    ctx.fillText(txt, cx, titleY);

    // Bright white core
    ctx.shadowBlur  = 3;
    ctx.fillStyle   = '#ccffdd';
    ctx.fillText(txt, cx, titleY);

    // ── Cyber scan-line sweep across the title ──
    const scanX = (((_frame * 4) % (W + 80))) - 40;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, titleY - fs * 0.7, W, fs * 1.4);
    ctx.clip();
    const scanGrad = ctx.createLinearGradient(scanX - 20, 0, scanX + 20, 0);
    scanGrad.addColorStop(0,   'rgba(0,255,120,0)');
    scanGrad.addColorStop(0.5, 'rgba(0,255,120,0.22)');
    scanGrad.addColorStop(1,   'rgba(0,255,120,0)');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(scanX - 20, titleY - fs * 0.7, 40, fs * 1.4);
    ctx.restore();

    // ── Character flicker — random letters briefly brighten ──
    if (_frame % 6 === 0) {
      const letters = txt.split('');
      ctx.font = font;
      // Measure each letter position
      let curX = cx - ctx.measureText(txt).width / 2;
      const flickerIdx = Math.floor(Math.random() * letters.length);
      for (let i = 0; i < letters.length; i++) {
        const lw = ctx.measureText(letters[i]).width;
        if (i === flickerIdx) {
          ctx.save();
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur  = 18;
          ctx.fillStyle   = '#ffffff';
          ctx.textAlign   = 'left';
          ctx.fillText(letters[i], curX, titleY);
          ctx.restore();
        }
        curX += lw;
      }
    }

    // ── Sub-tagline ──────────────────────────────
    const subFS = Math.max(10, Math.round(W * 0.016));
    ctx.font      = `600 ${subFS}px 'Orbitron','Courier New',monospace`;
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(0,200,100,${0.60 + Math.sin(_frame * 0.04) * 0.20})`;
    ctx.textAlign = 'center';
    ctx.fillText('PROTECT THE OCEAN  ·  DESTROY THE POLLUTION', cx, titleY + fs * 1.55);

    ctx.restore();
  }

  // ── Progress bar — centred vertically ────────
  function _drawBar(ctx) {
    const pct   = _dispPct;
    const bpad  = Math.round(Math.max(40, W * 0.10));
    const bw    = W - bpad * 2;
    const bh    = Math.max(12, Math.round(H * 0.022));
    const bx    = bpad;
    const by    = Math.round(H * 0.50);   // centred
    const r     = bh / 2;
    const fillW = Math.max(r * 2, bw * (pct / 100));

    // Track background
    ctx.save();
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, r);
    ctx.fillStyle   = 'rgba(0,0,0,0.22)';
    ctx.strokeStyle = 'rgba(0,150,60,0.25)';
    ctx.lineWidth   = 1;
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Tick marks
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = C.green;
    ctx.lineWidth   = 1;
    for (let t = 1; t < 10; t++) {
      const tx = bx + bw * t / 10;
      ctx.beginPath();
      ctx.moveTo(tx, by + 2); ctx.lineTo(tx, by + bh - 2);
      ctx.stroke();
    }
    ctx.restore();

    // Fill gradient — dark green → bright green
    ctx.save();
    ctx.beginPath(); ctx.roundRect(bx, by, fillW, bh, r);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0,    '#002211');
    g.addColorStop(0.35, '#006633');
    g.addColorStop(0.75, '#00bb55');
    g.addColorStop(1,    '#44ff88');
    ctx.fillStyle   = g;
    ctx.shadowColor = '#00aa44';
    ctx.shadowBlur  = 16;
    ctx.fill();

    // Animated shine sweep
    const sx    = bx + ((_frame * 2.5) % (fillW + 100)) - 50;
    const shine = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
    shine.addColorStop(0,   'rgba(255,255,255,0)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0.30)');
    shine.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle  = shine;
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.roundRect(bx, by, fillW, bh, r); ctx.fill();
    ctx.restore();

    // Leading glow dot — bright green, no shadowBlur
    ctx.save();
    ctx.beginPath(); ctx.arc(bx + fillW, by + r, r + 4, 0, Math.PI * 2);
    const dotGrd = ctx.createRadialGradient(bx + fillW, by + r, 0, bx + fillW, by + r, r + 8);
    dotGrd.addColorStop(0,   '#88ffaa');
    dotGrd.addColorStop(0.5, 'rgba(0,255,102,0.5)');
    dotGrd.addColorStop(1,   'rgba(0,255,102,0)');
    ctx.fillStyle = dotGrd;
    ctx.beginPath(); ctx.arc(bx + fillW, by + r, r + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Labels — centred ──────────────────────────
  function _drawLabels(ctx) {
    const pct    = Math.min(100, Math.round(_dispPct));
    const bpad   = Math.round(Math.max(40, W * 0.10));
    const bh     = Math.max(12, Math.round(H * 0.022));
    const barTop = Math.round(H * 0.50);          // same as _drawBar by
    const barBot = barTop + bh;
    const gap    = Math.round(H * 0.016);
    const font   = `'Courier New',monospace`;
    const oFont  = `'Orbitron','Courier New',monospace`;

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    // L O A D I N G — centred, above bar
    const labelFS = Math.max(10, Math.round(W * 0.014));
    const aboveY  = barTop - Math.round(H * 0.055);
    ctx.font      = `700 ${labelFS}px ${oFont}`;
    ctx.fillStyle = 'rgba(0,200,80,0.75)';
    ctx.shadowBlur  = 0;
    ctx.fillText('L O A D I N G', W / 2, aboveY);

    // Percentage — below bar, no shadowBlur
    const bigFS = Math.max(22, Math.round(W * 0.036));
    ctx.font      = `900 ${bigFS}px ${oFont}`;
    ctx.fillStyle = C.green;
    ctx.shadowBlur = 0;
    ctx.fillText(pct + '%', W / 2, barBot + gap);

    // Asset counter
    const countY = barBot + gap + bigFS + 6;
    ctx.font      = `${Math.max(11, Math.round(W * 0.016))}px ${font}`;
    ctx.fillStyle = C.greenDim;
    ctx.fillText(`${_countLoaded} / ${_countTotal}  assets`, W / 2, countY);

    // Asset name
    if (_label) {
      const lbl = _label.length > 44 ? '…' + _label.slice(-41) : _label;
      ctx.font      = `${Math.max(10, Math.round(W * 0.013))}px ${font}`;
      ctx.fillStyle = C.greenFaint;
      ctx.fillText(lbl, W / 2, countY + Math.round(H * 0.030));
    }

    ctx.restore();
  }

  // ═══════════════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════════════
  return { init, setProgress, complete, getBgImage };
})();
