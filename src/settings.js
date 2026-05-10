/**
 * ============================================================
 *  SettingsPanel — pixel-art underwater settings UI
 *  Drawn entirely on canvas, no HTML elements needed.
 *
 *  Sections:
 *    CONTROLS  — toggle WASD vs Touch Joystick
 *    SOUND     — music volume, SFX volume, mute toggle
 * ============================================================
 */
class SettingsPanel {
  constructor(engine) {
    this._engine = engine;

    // Open/close animation  (0 = closed, 1 = fully open)
    this._anim   = 0;
    this._open   = false;

    // Bubble particles for underwater feel
    this._bubbles = Array.from({ length: 18 }, () => this._makeBubble(1));

    // ── Persisted settings (localStorage) ──
    const saved = this._load();
    this.controlMode  = saved.controlMode  || 'keyboard';  // 'keyboard' | 'touch'
    this.musicVol     = saved.musicVol     ?? 0.7;
    this.sfxVol       = saved.sfxVol       ?? 0.8;
    this.muted        = saved.muted        ?? false;

    // Apply on load
    this._applyMusic();
    this._applySfx();

    // Interaction state
    this._hoverClose    = false;
    this._hoverKbd      = false;
    this._hoverTouch    = false;
    this._hoverMute     = false;
    this._dragMusic     = false;
    this._dragSfx       = false;

    // Slider hit areas (set each draw)
    this._sliderMusic = { x:0, y:0, w:0, h:0 };
    this._sliderSfx   = { x:0, y:0, w:0, h:0 };
    this._btnClose    = { x:0, y:0, w:0, h:0 };
    this._btnKbd      = { x:0, y:0, w:0, h:0 };
    this._btnTouch    = { x:0, y:0, w:0, h:0 };
    this._btnMute     = { x:0, y:0, w:0, h:0 };

    // Mouse drag tracking
    this._mouseDown = false;
    this._activeDrag = null;  // 'music' | 'sfx' | null
    this._panelX = 0;
    this._panelW = 0;

    window.addEventListener('mousedown',  e => this._onMouseDown(e));
    window.addEventListener('mousemove',  e => this._onMouseDrag(e));
    window.addEventListener('mouseup',    ()  => this._onMouseUp());
    window.addEventListener('touchstart', e => this._onTouchDragStart(e), { passive: false });
    window.addEventListener('touchmove',  e => this._onTouchDrag(e),      { passive: false });
    window.addEventListener('touchend',   ()  => this._onMouseUp());
  }

  // ── Public API ──────────────────────────────
  open()    { this._open = true; }
  close()   { this._open = false; }
  isOpen()  { return this._anim > 0.01; }

  isHoveringAny() {
    return this._hoverClose || this._hoverKbd || this._hoverTouch || this._hoverMute;
  }

  // ── Update ──────────────────────────────────
  update(dt) {
    // Animate panel open/close
    const target = this._open ? 1 : 0;
    this._anim += (target - this._anim) * 0.14;
    if (this._anim < 0.001) this._anim = 0;

    // Bubble particles
    for (const b of this._bubbles) {
      b.y -= b.speed;
      b.x += Math.sin(b.phase) * 0.4;
      b.phase += 0.04;
      b.life--;
      if (b.life <= 0) Object.assign(b, this._makeBubble(0));
    }
  }

  // ── Draw ────────────────────────────────────
  draw(ctx, W, H, frame) {
    if (this._anim < 0.005) return;

    const a = this._anim;

    // ── Backdrop dim ──
    ctx.save();
    ctx.globalAlpha = a * 0.72;
    ctx.fillStyle   = 'rgba(0,8,22,1)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ── Panel geometry ──
    const panelW = Math.round(Math.min(W * 0.88, 480));
    const panelH = Math.round(Math.min(H * 0.82, 560));
    const panelX = Math.round(W / 2 - panelW / 2);
    const panelY = Math.round(H / 2 - panelH / 2 + (1 - a) * 40);

    this._panelX = panelX;
    this._panelW = panelW;

    ctx.save();
    ctx.globalAlpha = a;

    // ── Bubbles (behind panel) ──
    this._drawBubbles(ctx, panelX, panelY, panelW, panelH, frame);

    // ── Panel shadow ──
    ctx.shadowColor = 'rgba(0,200,255,0.18)';
    ctx.shadowBlur  = 40;

    // ── Panel background ──
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 16);
    const bgGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    bgGrad.addColorStop(0,   'rgba(0,18,38,0.97)');
    bgGrad.addColorStop(0.5, 'rgba(0,12,30,0.97)');
    bgGrad.addColorStop(1,   'rgba(0,8,22,0.97)');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // ── Panel border — animated glow ──
    ctx.shadowBlur  = 0;
    const borderAlpha = 0.45 + Math.sin(frame * 0.04) * 0.15;
    ctx.strokeStyle = `rgba(0,200,180,${borderAlpha})`;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 16);
    ctx.stroke();

    // ── Inner pixel border (retro double-border) ──
    ctx.strokeStyle = 'rgba(0,100,120,0.3)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(panelX + 5, panelY + 5, panelW - 10, panelH - 10, 12);
    ctx.stroke();

    // ── Scanline overlay ──
    ctx.save();
    ctx.globalAlpha = 0.04;
    for (let sy = panelY; sy < panelY + panelH; sy += 4) {
      ctx.fillStyle = '#000';
      ctx.fillRect(panelX, sy, panelW, 2);
    }
    ctx.restore();

    // ── Header ──
    const headerY = panelY + 38;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `bold ${Math.round(panelW * 0.072)}px "Courier New", monospace`;
    ctx.fillStyle    = '#00eeff';
    ctx.shadowColor  = '#00ccff';
    ctx.shadowBlur   = 14 + Math.sin(frame * 0.05) * 4;
    ctx.fillText('⚙  SETTINGS', panelX + panelW / 2, headerY);

    // Header underline
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = 'rgba(0,200,220,0.35)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 24, headerY + 20);
    ctx.lineTo(panelX + panelW - 24, headerY + 20);
    ctx.stroke();

    // ── Close button (X) — top right ──
    const closeSize = 32;
    const closeX    = panelX + panelW - closeSize - 12;
    const closeY    = panelY + 12;
    this._btnClose  = { x: closeX, y: closeY, w: closeSize, h: closeSize };
    this._drawCloseBtn(ctx, closeX, closeY, closeSize, this._hoverClose, frame);

    // ── Section layout ──
    const sectionX  = panelX + 28;
    const sectionW  = panelW - 56;
    let   curY      = panelY + 72;

    // ── CONTROLS section ──
    curY = this._drawSectionHeader(ctx, sectionX, curY, sectionW, '🎮  CONTROLS', frame);
    curY += 10;

    const ctrlBtnW = Math.round(sectionW * 0.46);
    const ctrlBtnH = 42;
    const ctrlGap  = sectionW - ctrlBtnW * 2;

    const kbdX   = sectionX;
    const touchX = sectionX + ctrlBtnW + ctrlGap;
    const ctrlY  = curY;

    this._btnKbd   = { x: kbdX,   y: ctrlY, w: ctrlBtnW, h: ctrlBtnH };
    this._btnTouch = { x: touchX, y: ctrlY, w: ctrlBtnW, h: ctrlBtnH };

    this._drawCtrlBtn(ctx, kbdX,   ctrlY, ctrlBtnW, ctrlBtnH,
      '⌨  KEYBOARD', this.controlMode === 'keyboard', this._hoverKbd, frame);
    this._drawCtrlBtn(ctx, touchX, ctrlY, ctrlBtnW, ctrlBtnH,
      '👆  TOUCH',    this.controlMode === 'touch',    this._hoverTouch, frame);

    // Active mode label
    curY += ctrlBtnH + 10;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `${Math.round(panelW * 0.032)}px "Courier New", monospace`;
    ctx.fillStyle    = 'rgba(0,200,160,0.55)';
    ctx.shadowBlur   = 0;
    const modeLabel  = this.controlMode === 'keyboard'
      ? 'WASD / Arrow keys + SPACE to shoot'
      : 'On-screen joystick + fire button';
    ctx.fillText(modeLabel, panelX + panelW / 2, curY);
    curY += 22;

    // ── Divider ──
    curY = this._drawDivider(ctx, sectionX, curY, sectionW);

    // ── SOUND section ──
    curY = this._drawSectionHeader(ctx, sectionX, curY, sectionW, '🔊  SOUND', frame);
    curY += 14;

    // Music volume
    const sliderW = sectionW - 90;
    const sliderH = 8;
    const labelW  = 82;

    // Music label
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.font         = `${Math.round(panelW * 0.038)}px "Courier New", monospace`;
    ctx.fillStyle    = '#88ddff';
    ctx.shadowBlur   = 0;
    ctx.fillText('MUSIC', sectionX, curY + sliderH / 2);

    const msx = sectionX + labelW;
    this._sliderMusic = { x: msx, y: curY - 10, w: sliderW, h: sliderH + 20 };
    this._drawSlider(ctx, msx, curY, sliderW, sliderH, this.musicVol, '#00ccff', this._dragMusic, frame);
    curY += 36;

    // SFX label
    ctx.fillStyle = '#88ddff';
    ctx.fillText('SFX', sectionX, curY + sliderH / 2);

    const ssx = sectionX + labelW;
    this._sliderSfx = { x: ssx, y: curY - 10, w: sliderW, h: sliderH + 20 };
    this._drawSlider(ctx, ssx, curY, sliderW, sliderH, this.sfxVol, '#00ffaa', this._dragSfx, frame);
    curY += 44;

    // Mute button
    const muteW = Math.round(sectionW * 0.52);
    const muteH = 40;
    const muteX = sectionX + Math.round((sectionW - muteW) / 2);
    this._btnMute = { x: muteX, y: curY, w: muteW, h: muteH };
    this._drawMuteBtn(ctx, muteX, curY, muteW, muteH, this.muted, this._hoverMute, frame);

    ctx.restore();
  }

  // ── Section header ──────────────────────────
  _drawSectionHeader(ctx, x, y, w, label, frame) {
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.font         = `bold ${14}px "Courier New", monospace`;
    ctx.fillStyle    = 'rgba(0,200,180,0.7)';
    ctx.shadowColor  = '#00ccaa';
    ctx.shadowBlur   = 6;
    ctx.fillText(label, x, y + 8);
    ctx.shadowBlur   = 0;
    return y + 26;
  }

  _drawDivider(ctx, x, y, w) {
    ctx.strokeStyle = 'rgba(0,150,140,0.2)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x + w, y + 8);
    ctx.stroke();
    return y + 22;
  }

  // ── Control mode button ──────────────────────
  _drawCtrlBtn(ctx, x, y, w, h, label, active, hover, frame) {
    const pulse = (active || hover) ? 1 + Math.sin(frame * 0.15) * 0.025 : 1;
    const cx = x + w / 2, cy = y + h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    // Background
    if (active) {
      const g = ctx.createLinearGradient(-w/2, -h/2, -w/2, h/2);
      g.addColorStop(0, 'rgba(0,60,50,0.95)');
      g.addColorStop(1, 'rgba(0,40,35,0.95)');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = hover ? 'rgba(0,30,40,0.9)' : 'rgba(0,15,25,0.7)';
    }
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = active ? '#00ffcc' : (hover ? 'rgba(0,200,160,0.7)' : 'rgba(0,120,100,0.4)');
    ctx.lineWidth   = active ? 2.5 : 1.5;
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur  = active ? 14 : (hover ? 8 : 0);
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, 8);
    ctx.stroke();

    // Active indicator dot
    if (active) {
      ctx.beginPath();
      ctx.arc(-w/2 + 14, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle  = '#00ffcc';
      ctx.shadowBlur = 8;
      ctx.fill();
    }

    // Label
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `bold ${Math.round(h * 0.36)}px "Courier New", monospace`;
    ctx.fillStyle    = active ? '#ffffff' : (hover ? '#aaffee' : 'rgba(0,200,160,0.7)');
    ctx.shadowBlur   = active ? 8 : 0;
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }

  // ── Volume slider ────────────────────────────
  _drawSlider(ctx, x, y, w, h, value, color, dragging, frame) {
    const fillW = Math.round(w * value);
    const knobX = x + fillW;
    const knobR = h + 4;

    // Track background
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(0,30,50,0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,120,160,0.4)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Filled portion
    if (fillW > 0) {
      const grad = ctx.createLinearGradient(x, 0, x + fillW, 0);
      grad.addColorStop(0, color + '88');
      grad.addColorStop(1, color);
      ctx.beginPath();
      ctx.roundRect(x, y, fillW, h, h / 2);
      ctx.fillStyle = grad;
      ctx.shadowColor = color;
      ctx.shadowBlur  = dragging ? 12 : 4;
      ctx.fill();
      ctx.shadowBlur  = 0;
    }

    // Knob
    ctx.beginPath();
    ctx.arc(knobX, y + h / 2, knobR, 0, Math.PI * 2);
    ctx.fillStyle   = dragging ? '#ffffff' : color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = dragging ? 18 : 8;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Value label
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';
    ctx.font         = `${11}px "Courier New", monospace`;
    ctx.fillStyle    = 'rgba(150,220,255,0.6)';
    ctx.fillText(`${Math.round(value * 100)}%`, x + w + 36, y + h / 2);
  }

  // ── Mute button ──────────────────────────────
  _drawMuteBtn(ctx, x, y, w, h, muted, hover, frame) {
    const pulse = hover ? 1 + Math.sin(frame * 0.15) * 0.03 : 1;
    const cx = x + w / 2, cy = y + h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    const color = muted ? '#ff5544' : '#00ffcc';
    ctx.fillStyle   = muted ? 'rgba(30,5,5,0.9)' : (hover ? 'rgba(0,30,25,0.9)' : 'rgba(0,15,20,0.8)');
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, 8);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth   = hover ? 2.5 : 2;
    ctx.shadowColor = color;
    ctx.shadowBlur  = hover ? 16 : 6;
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, 8);
    ctx.stroke();

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = `bold ${Math.round(h * 0.4)}px "Courier New", monospace`;
    ctx.fillStyle    = hover ? '#ffffff' : color;
    ctx.shadowBlur   = hover ? 10 : 0;
    ctx.fillText(muted ? '🔇  UNMUTE' : '🔊  MUTE ALL', 0, 0);

    ctx.restore();
  }

  // ── Close button ─────────────────────────────
  _drawCloseBtn(ctx, x, y, size, hover, frame) {
    const cx = x + size / 2, cy = y + size / 2;
    const pulse = hover ? 1 + Math.sin(frame * 0.2) * 0.08 : 1;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);

    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fillStyle   = hover ? 'rgba(40,5,5,0.95)' : 'rgba(20,5,5,0.8)';
    ctx.shadowColor = '#ff4433';
    ctx.shadowBlur  = hover ? 16 : 4;
    ctx.fill();
    ctx.strokeStyle = hover ? '#ff4433' : 'rgba(180,40,30,0.5)';
    ctx.lineWidth   = hover ? 2 : 1.5;
    ctx.stroke();

    // X mark
    const arm = size * 0.22;
    ctx.strokeStyle = hover ? '#ffffff' : '#ff6655';
    ctx.lineWidth   = 2.5;
    ctx.shadowBlur  = hover ? 8 : 0;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(-arm, -arm); ctx.lineTo(arm, arm);
    ctx.moveTo( arm, -arm); ctx.lineTo(-arm, arm);
    ctx.stroke();

    ctx.restore();
  }

  // ── Bubble particles ─────────────────────────
  _makeBubble(progress) {
    return {
      x:     Math.random() * 500,
      y:     progress === 1 ? Math.random() * 600 : 600,
      r:     1 + Math.random() * 3,
      speed: 0.3 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      life:  Math.round(60 + Math.random() * 120),
      maxLife: 180
    };
  }

  _drawBubbles(ctx, px, py, pw, ph, frame) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 16);
    ctx.clip();

    for (const b of this._bubbles) {
      const alpha = Math.min(1, b.life / 30) * 0.25;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px + (b.x / 500) * pw, py + ph - (b.y / 600) * ph, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = '#00eeff';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Click handling ───────────────────────────
  handleClick(mx, my) {
    if (!this.isOpen()) return;

    if (this._inBtn(mx, my, this._btnClose)) {
      this.close();
      return;
    }
    if (this._inBtn(mx, my, this._btnKbd)) {
      this.controlMode = 'keyboard';
      this._save();
      return;
    }
    if (this._inBtn(mx, my, this._btnTouch)) {
      this.controlMode = 'touch';
      this._save();
      return;
    }
    if (this._inBtn(mx, my, this._btnMute)) {
      this.muted = !this.muted;
      this._applyMusic();
      this._applySfx();
      this._save();
      return;
    }
  }

  handleMove(mx, my) {
    this._hoverClose = this._inBtn(mx, my, this._btnClose);
    this._hoverKbd   = this._inBtn(mx, my, this._btnKbd);
    this._hoverTouch = this._inBtn(mx, my, this._btnTouch);
    this._hoverMute  = this._inBtn(mx, my, this._btnMute);
  }

  // ── Drag (sliders) ───────────────────────────
  _onMouseDown(e) {
    if (!this.isOpen()) return;
    const mx = e.clientX, my = e.clientY;
    if (this._inBtn(mx, my, this._sliderMusic)) { this._activeDrag = 'music'; this._dragMusic = true; this._updateSlider('music', mx); }
    if (this._inBtn(mx, my, this._sliderSfx))   { this._activeDrag = 'sfx';   this._dragSfx   = true; this._updateSlider('sfx',   mx); }
  }

  _onMouseDrag(e) {
    if (!this._activeDrag) return;
    this._updateSlider(this._activeDrag, e.clientX);
  }

  _onMouseUp() {
    this._activeDrag = null;
    this._dragMusic  = false;
    this._dragSfx    = false;
  }

  _onTouchDragStart(e) {
    if (!this.isOpen()) return;
    const t = e.touches[0];
    if (!t) return;
    const mx = t.clientX, my = t.clientY;
    if (this._inBtn(mx, my, this._sliderMusic)) { this._activeDrag = 'music'; this._dragMusic = true; this._updateSlider('music', mx); e.preventDefault(); }
    if (this._inBtn(mx, my, this._sliderSfx))   { this._activeDrag = 'sfx';   this._dragSfx   = true; this._updateSlider('sfx',   mx); e.preventDefault(); }
  }

  _onTouchDrag(e) {
    if (!this._activeDrag) return;
    e.preventDefault();
    const t = e.touches[0];
    if (t) this._updateSlider(this._activeDrag, t.clientX);
  }

  _updateSlider(which, clientX) {
    const slider = which === 'music' ? this._sliderMusic : this._sliderSfx;
    // Convert clientX to canvas space (canvas fills viewport)
    const canvas  = document.getElementById('gameCanvas');
    const rect    = canvas.getBoundingClientRect();
    const scaleX  = canvas.width / rect.width;
    const cx      = (clientX - rect.left) * scaleX;
    const val     = Math.max(0, Math.min(1, (cx - slider.x) / slider.w));
    if (which === 'music') { this.musicVol = val; this._applyMusic(); }
    else                   { this.sfxVol   = val; this._applySfx();   }
    this._save();
  }

  // ── Audio application ────────────────────────
  _applyMusic() {
    const bgm = document.getElementById('bgm');
    const gov = document.getElementById('bgm-gameover');
    const vol = this.muted ? 0 : this.musicVol;
    if (bgm) bgm.volume = vol;
    if (gov) gov.volume = vol;
  }

  _applySfx() {
    // SFX volume is read by MakiAudio.beep via global accessor
    window._sfxVolume = this.muted ? 0 : this.sfxVol;
  }

  // ── Persistence ──────────────────────────────
  _save() {
    localStorage.setItem('roboShellSettings', JSON.stringify({
      controlMode: this.controlMode,
      musicVol:    this.musicVol,
      sfxVol:      this.sfxVol,
      muted:       this.muted
    }));
  }

  _load() {
    try { return JSON.parse(localStorage.getItem('roboShellSettings') || '{}'); }
    catch { return {}; }
  }

  _inBtn(mx, my, btn) {
    // Convert mouse coords to canvas coords
    const canvas = document.getElementById('gameCanvas');
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (mx - rect.left) * scaleX;
    const cy = (my - rect.top)  * scaleY;
    return cx >= btn.x && cx <= btn.x + btn.w &&
           cy >= btn.y && cy <= btn.y + btn.h;
  }
}
