/**
 * ============================================================
 *  MAKI — Minimal Arcade Kit Interface
 *  A lightweight 2D pixel game framework
 *  Built for Turtle Savior
 * ============================================================
 *
 *  Core modules:
 *    Maki.Engine   — game loop, scene management
 *    Maki.Renderer — pixel-art canvas drawing utilities
 *    Maki.Input    — keyboard input handler
 *    Maki.Audio    — simple procedural sound (Web Audio API)
 *    Maki.Math     — vector helpers
 *    Maki.Pool     — object pooling for performance
 */

const Maki = (() => {
  'use strict';

  // ─────────────────────────────────────────────
  //  Math helpers
  // ─────────────────────────────────────────────
  const MakiMath = {
    /** Clamp a value between min and max */
    clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },

    /** Linear interpolation */
    lerp(a, b, t) { return a + (b - a) * t; },

    /** Distance between two points */
    dist(x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1;
      return Math.sqrt(dx * dx + dy * dy);
    },

    /** Angle from point A to point B (radians) */
    angle(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); },

    /** Random integer in [min, max] */
    randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },

    /** Random float in [min, max) */
    randFloat(min, max) { return Math.random() * (max - min) + min; },

    /** Degrees to radians */
    deg2rad(d) { return d * Math.PI / 180; },

    /** Check AABB collision */
    rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    },

    /** Check circle collision */
    circleOverlap(ax, ay, ar, bx, by, br) {
      return this.dist(ax, ay, bx, by) < ar + br;
    }
  };

  // ─────────────────────────────────────────────
  //  Input handler  (keyboard + touch)
  // ─────────────────────────────────────────────
  const MakiInput = {
    _keys: {},
    _justPressed: {},
    _justReleased: {},

    // ── Touch state ──
    _touchMove:  { x: 0, y: 0 },   // normalised joystick vector (-1..1)
    _touchFire:  false,             // fire button held
    _joystickId: null,              // touch identifier for joystick
    _fireId:     null,              // touch identifier for fire button
    _joystickOrigin: { x: 0, y: 0 },

    init() {
      // ── Keyboard ──
      window.addEventListener('keydown', e => {
        if (!this._keys[e.code]) this._justPressed[e.code] = true;
        this._keys[e.code] = true;
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
          e.preventDefault();
        }
      });
      window.addEventListener('keyup', e => {
        this._keys[e.code] = false;
        this._justReleased[e.code] = true;
      });

      // ── Touch ──
      const canvas = document.getElementById('gameCanvas');
      if (canvas) {
        canvas.addEventListener('touchstart',  e => this._onTouchStart(e),  { passive: false });
        canvas.addEventListener('touchmove',   e => this._onTouchMove(e),   { passive: false });
        canvas.addEventListener('touchend',    e => this._onTouchEnd(e),    { passive: false });
        canvas.addEventListener('touchcancel', e => this._onTouchEnd(e),    { passive: false });
      }
    },

    // ── Touch helpers ──
    _isFireSide(x) {
      // Right half of screen = fire button
      return x > window.innerWidth / 2;
    },

    _onTouchStart(e) {
      e.preventDefault();
      // Only process joystick/fire touch when touch mode is active
      if (window._controlMode !== 'touch') return;
      for (const t of e.changedTouches) {
        if (!this._isFireSide(t.clientX) && this._joystickId === null) {
          // Left side → joystick
          this._joystickId = t.identifier;
          this._joystickOrigin = { x: t.clientX, y: t.clientY };
          this._touchMove = { x: 0, y: 0 };
        } else if (this._isFireSide(t.clientX) && this._fireId === null) {
          // Right side → fire
          this._fireId = t.identifier;
          this._touchFire = true;
          if (!this._keys['Space']) this._justPressed['Space'] = true;
          this._keys['Space'] = true;
        }
      }
    },

    _onTouchMove(e) {
      e.preventDefault();
      if (window._controlMode !== 'touch') return;
      for (const t of e.changedTouches) {
        if (t.identifier === this._joystickId) {
          const DEAD = 10;   // dead-zone px
          const MAX  = 60;   // full-tilt px
          let dx = t.clientX - this._joystickOrigin.x;
          let dy = t.clientY - this._joystickOrigin.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < DEAD) { this._touchMove = { x: 0, y: 0 }; continue; }
          const clamped = Math.min(dist, MAX);
          this._touchMove = {
            x: (dx / dist) * (clamped / MAX),
            y: (dy / dist) * (clamped / MAX)
          };
        }
      }
    },

    _onTouchEnd(e) {
      e.preventDefault();
      if (window._controlMode !== 'touch') return;
      for (const t of e.changedTouches) {
        if (t.identifier === this._joystickId) {
          this._joystickId = null;
          this._touchMove  = { x: 0, y: 0 };
        }
        if (t.identifier === this._fireId) {
          this._fireId    = null;
          this._touchFire = false;
          this._keys['Space'] = false;
          this._justReleased['Space'] = true;
        }
      }
    },

    /** Is key currently held */
    isDown(code) {
      if (code === 'Space' && this._touchFire) return true;
      return !!this._keys[code];
    },

    /** Was key pressed this frame */
    wasPressed(code) { return !!this._justPressed[code]; },

    /** Was key released this frame */
    wasReleased(code) { return !!this._justReleased[code]; },

    /** Call at end of each frame to clear just-pressed/released */
    flush() {
      this._justPressed  = {};
      this._justReleased = {};
    },

    /** Get movement vector from WASD / Arrow keys OR touch joystick */
    getMovement() {
      // Touch joystick takes priority when active
      if (this._joystickId !== null) {
        return { x: this._touchMove.x, y: this._touchMove.y };
      }
      let x = 0, y = 0;
      if (this.isDown('ArrowLeft')  || this.isDown('KeyA')) x -= 1;
      if (this.isDown('ArrowRight') || this.isDown('KeyD')) x += 1;
      if (this.isDown('ArrowUp')    || this.isDown('KeyW')) y -= 1;
      if (this.isDown('ArrowDown')  || this.isDown('KeyS')) y += 1;
      // Normalize diagonal
      if (x !== 0 && y !== 0) { x *= 0.707; y *= 0.707; }
      return { x, y };
    },

    /** Expose touch state for HUD rendering */
    getTouchState() {
      return {
        joystickActive: this._joystickId !== null,
        joystickOrigin: this._joystickOrigin,
        joystickVec:    this._touchMove,
        fireActive:     this._touchFire
      };
    }
  };

  // ─────────────────────────────────────────────
  //  Pixel-art Renderer
  // ─────────────────────────────────────────────
  const MakiRenderer = {
    canvas: null,
    ctx: null,

    init(canvasEl) {
      this.canvas = canvasEl;
      this.ctx = canvasEl.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
    },

    get width()  { return this.canvas.width; },
    get height() { return this.canvas.height; },

    clear(color = '#000') {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, this.width, this.height);
    },

    /** Draw a filled rectangle (pixel-art style) */
    fillRect(x, y, w, h, color) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
    },

    /** Draw a circle */
    fillCircle(x, y, r, color) {
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2);
      this.ctx.fill();
    },

    /** Draw a stroked circle */
    strokeCircle(x, y, r, color, lineWidth = 1) {
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = lineWidth;
      this.ctx.beginPath();
      this.ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2);
      this.ctx.stroke();
    },

    /** Draw a line */
    drawLine(x1, y1, x2, y2, color, lineWidth = 1) {
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(Math.round(x1), Math.round(y1));
      this.ctx.lineTo(Math.round(x2), Math.round(y2));
      this.ctx.stroke();
    },

    /** Draw pixel-art text */
    drawText(text, x, y, color = '#fff', size = 12, align = 'left') {
      this.ctx.fillStyle = color;
      this.ctx.font = `${size}px "Courier New", monospace`;
      this.ctx.textAlign = align;
      this.ctx.fillText(text, Math.round(x), Math.round(y));
    },

    /** Draw a polygon given array of {x,y} points */
    fillPolygon(points, color) {
      if (points.length < 2) return;
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.moveTo(Math.round(points[0].x), Math.round(points[0].y));
      for (let i = 1; i < points.length; i++) {
        this.ctx.lineTo(Math.round(points[i].x), Math.round(points[i].y));
      }
      this.ctx.closePath();
      this.ctx.fill();
    },

    /** Save/restore context state */
    save()    { this.ctx.save(); },
    restore() { this.ctx.restore(); },

    /** Translate + rotate context */
    transform(x, y, angle) {
      this.ctx.translate(Math.round(x), Math.round(y));
      this.ctx.rotate(angle);
    },

    /** Set global alpha */
    setAlpha(a) { this.ctx.globalAlpha = a; },

    /** Set composite operation */
    setBlend(op) { this.ctx.globalCompositeOperation = op; },

    /**
     * Draw on-screen touch controls (joystick + fire button).
     * Call once per frame from the game scene draw method.
     * Only renders when a touch device is detected or touch is active.
     */
    drawTouchControls(inputState) {
      const ctx = this.ctx;
      const W   = this.width;
      const H   = this.height;

      // ── Joystick (bottom-left) ──
      const jcx = 90;
      const jcy = H - 90;
      const outerR = 52;
      const innerR = 26;

      ctx.save();

      // Outer ring
      ctx.beginPath();
      ctx.arc(jcx, jcy, outerR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,255,204,0.35)';
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.fillStyle   = 'rgba(0,0,0,0.25)';
      ctx.fill();

      // Thumb nub — offset by joystick vector
      const nx = jcx + inputState.joystickVec.x * (outerR - innerR);
      const ny = jcy + inputState.joystickVec.y * (outerR - innerR);
      ctx.beginPath();
      ctx.arc(nx, ny, innerR, 0, Math.PI * 2);
      ctx.fillStyle = inputState.joystickActive
        ? 'rgba(0,255,204,0.55)'
        : 'rgba(0,255,204,0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,255,204,0.6)';
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Directional arrows hint
      ctx.fillStyle = 'rgba(0,255,204,0.3)';
      ctx.font      = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲', jcx,          jcy - outerR - 10);
      ctx.fillText('▼', jcx,          jcy + outerR + 10);
      ctx.fillText('◀', jcx - outerR - 10, jcy);
      ctx.fillText('▶', jcx + outerR + 10, jcy);

      // ── Fire button (bottom-right) ──
      const fcx = W - 90;
      const fcy = H - 90;
      const fireR = 44;

      ctx.beginPath();
      ctx.arc(fcx, fcy, fireR, 0, Math.PI * 2);
      ctx.fillStyle = inputState.fireActive
        ? 'rgba(255,80,80,0.65)'
        : 'rgba(255,80,80,0.25)';
      ctx.fill();
      ctx.strokeStyle = inputState.fireActive
        ? 'rgba(255,120,120,0.9)'
        : 'rgba(255,80,80,0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Fire icon
      ctx.fillStyle = inputState.fireActive ? '#fff' : 'rgba(255,200,200,0.7)';
      ctx.font      = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔥', fcx, fcy);

      ctx.restore();
    }
  };

  // ─────────────────────────────────────────────
  //  Procedural Audio (Web Audio API)
  // ─────────────────────────────────────────────
  const MakiAudio = {
    _ctx: null,
    _enabled: true,

    init() {
      try {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this._enabled = false;
      }
    },

    /** Resume context (needed after user gesture) */
    resume() {
      if (this._ctx && this._ctx.state === 'suspended') {
        this._ctx.resume();
      }
    },

    /**
     * Play a simple beep tone
     * @param {number} freq   - frequency in Hz
     * @param {number} dur    - duration in seconds
     * @param {string} type   - oscillator type: sine|square|sawtooth|triangle
     * @param {number} vol    - volume 0–1
     */
    beep(freq = 440, dur = 0.1, type = 'square', vol = 0.15) {
      if (!this._enabled || !this._ctx) return;
      // Respect SFX volume from settings panel (0–1), default 1
      const sfxScale = (typeof window._sfxVolume === 'number') ? window._sfxVolume : 1;
      const finalVol = vol * sfxScale;
      if (finalVol <= 0) return;
      try {
        const osc  = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.connect(gain);
        gain.connect(this._ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this._ctx.currentTime);
        gain.gain.setValueAtTime(finalVol, this._ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + dur);
        osc.start(this._ctx.currentTime);
        osc.stop(this._ctx.currentTime + dur);
      } catch (e) { /* ignore */ }
    },

    /** Shoot sound */
    shoot()   { this.beep(880, 0.06, 'square', 0.1); },

    /** Hit / destroy trash */
    hit()     { this.beep(220, 0.12, 'sawtooth', 0.15); },

    /** Player death */
    death()   {
      this.beep(200, 0.3, 'sawtooth', 0.2);
      setTimeout(() => this.beep(150, 0.4, 'sawtooth', 0.2), 150);
    },

    /** Wave start jingle */
    waveUp()  {
      this.beep(440, 0.1, 'square', 0.12);
      setTimeout(() => this.beep(550, 0.1, 'square', 0.12), 120);
      setTimeout(() => this.beep(660, 0.15, 'square', 0.12), 240);
    }
  };

  // ─────────────────────────────────────────────
  //  Object Pool
  // ─────────────────────────────────────────────
  class MakiPool {
    constructor(factory, reset, initialSize = 20) {
      this._factory = factory;
      this._reset   = reset;
      this._pool    = [];
      for (let i = 0; i < initialSize; i++) {
        this._pool.push(factory());
      }
    }

    /** Get an object from the pool (or create new) */
    get(...args) {
      const obj = this._pool.length > 0 ? this._pool.pop() : this._factory();
      this._reset(obj, ...args);
      return obj;
    }

    /** Return an object to the pool */
    release(obj) {
      this._pool.push(obj);
    }
  }

  // ─────────────────────────────────────────────
  //  Particle System
  // ─────────────────────────────────────────────
  class MakiParticles {
    constructor() {
      this._particles = [];
    }

    /** Emit a burst of particles */
    burst(x, y, count, options = {}) {
      const {
        colors   = ['#fff'],
        minSpeed = 1,
        maxSpeed = 3,
        minLife  = 20,
        maxLife  = 40,
        size     = 3
      } = options;

      for (let i = 0; i < count; i++) {
        const angle = MakiMath.randFloat(0, Math.PI * 2);
        const speed = MakiMath.randFloat(minSpeed, maxSpeed);
        this._particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: MakiMath.randInt(minLife, maxLife),
          maxLife: maxLife,
          color: colors[MakiMath.randInt(0, colors.length - 1)],
          size
        });
      }
    }

    update() {
      for (let i = this._particles.length - 1; i >= 0; i--) {
        const p = this._particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.life--;
        if (p.life <= 0) this._particles.splice(i, 1);
      }
    }

    draw(renderer) {
      for (const p of this._particles) {
        const alpha = p.life / p.maxLife;
        renderer.save();
        renderer.setAlpha(alpha);
        renderer.fillRect(
          p.x - p.size / 2,
          p.y - p.size / 2,
          p.size, p.size,
          p.color
        );
        renderer.restore();
      }
    }

    clear() { this._particles = []; }
  }

  // ─────────────────────────────────────────────
  //  Scene base class
  // ─────────────────────────────────────────────
  class MakiScene {
    constructor(engine) { this.engine = engine; }
    onEnter()  {}
    onExit()   {}
    update(dt) {}
    draw(renderer) {}
  }

  // ─────────────────────────────────────────────
  //  Engine — game loop + scene manager
  // ─────────────────────────────────────────────
  class MakiEngine {
    constructor(canvasEl) {
      this.renderer   = MakiRenderer;
      this.input      = MakiInput;
      this.audio      = MakiAudio;
      this.math       = MakiMath;

      this.renderer.init(canvasEl);
      this.input.init();
      window._makiInput = this.input;   // expose for settings panel to clear stuck touch state
      this.audio.init();

      this._scenes      = {};
      this._activeScene = null;
      this._running     = false;
      this._lastTime    = 0;
      this._fps         = 60;
      this._frameTime   = 1000 / this._fps;
    }

    /** Register a scene by name */
    addScene(name, scene) {
      this._scenes[name] = scene;
    }

    /** Switch to a named scene */
    switchScene(name) {
      if (this._activeScene) this._activeScene.onExit();
      this._activeScene = this._scenes[name];
      if (this._activeScene) this._activeScene.onEnter();
    }

    /** Start the game loop */
    start(initialScene) {
      this._running = true;
      this.switchScene(initialScene);
      requestAnimationFrame(ts => this._loop(ts));
    }

    _loop(timestamp) {
      if (!this._running) return;

      const dt = Math.min((timestamp - this._lastTime) / this._frameTime, 3);
      this._lastTime = timestamp;

      if (this._activeScene && !this.paused) {
        this._activeScene.update(dt);
        this._activeScene.draw(this.renderer);
      }

      this.input.flush();
      requestAnimationFrame(ts => this._loop(ts));
    }
  }

  // ─────────────────────────────────────────────
  //  Public API
  // ─────────────────────────────────────────────
  return {
    Engine:    MakiEngine,
    Scene:     MakiScene,
    Pool:      MakiPool,
    Particles: MakiParticles,
    Math:      MakiMath,
    Input:     MakiInput,
    Audio:     MakiAudio,
    Renderer:  MakiRenderer
  };
})();
