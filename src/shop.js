/**
 * ============================================================
 *  ShopPanel — Character selection (skin picker)
 *  Canvas-drawn. 4 turtle skins in a 2×2 grid.
 *  Saved to localStorage as 'roboShellTurtle'.
 * ============================================================
 */
class ShopPanel {
  constructor(engine) {
    this._engine = engine;
    this._anim   = 0;
    this._open   = false;
    this._bubbles = Array.from({ length: 16 }, () => this._makeBubble(1));
    this._selected = ShopPanel.getSelected();
    this._btnClose = { x:0, y:0, w:0, h:0 };
    this._cards    = [];
    this._hoverClose = false;
    this._hoverCard  = -1;
    this._tFrame   = 0;
    // Offscreen canvas for tinting (one per panel)
    this._oc  = null;
    this._oc2 = null;
  }

  // ── Static API ───────────────────────────────
  static getSelected() {
    return localStorage.getItem('roboShellTurtle') || 'blue';
  }
  static _save(id) {
    localStorage.setItem('roboShellTurtle', id);
    // Invalidate global tint cache so in-game turtle updates immediately
    if (typeof Assets !== 'undefined' && Assets._invalidateTint) {
      Assets._invalidateTint();
    }
  }

  // Each skin: id, body tint [r,g,b 0-1 or null=default], flipper colors
  static get TURTLES() {
    return [
      {
        id: 'blue',
        tint: null,
        fc1: '#1a7a99', fc2: '#00ccee', fc3: '#004466',
        foot: '#1a6688', footStroke: '#00aacc'
      },
      {
        id: 'green',
        tint: [0.15, 0.85, 0.25],
        fc1: '#1a7a44', fc2: '#00ee88', fc3: '#004422',
        foot: '#1a6644', footStroke: '#00aa66'
      },
      {
        id: 'red',
        tint: [0.95, 0.18, 0.18],
        fc1: '#993322', fc2: '#ff4422', fc3: '#441100',
        foot: '#882211', footStroke: '#ff3311'
      },
      {
        id: 'yellow',
        tint: [1.0, 0.88, 0.08],
        fc1: '#998822', fc2: '#ffdd00', fc3: '#443300',
        foot: '#886600', footStroke: '#ffcc00'
      },
    ];
  }

  // ── Public API ───────────────────────────────
  open()   { this._open = true;  }
  close()  { this._open = false; }
  isOpen() { return this._anim > 0.01; }
  isHoveringAny() { return this._hoverClose || this._hoverCard >= 0; }

  // ── Update ───────────────────────────────────
  update(dt) {
    // Fast lerp: 0.22 = snappy open/close (~12 frames to fully open)
    const target = this._open ? 1 : 0;
    this._anim  += (target - this._anim) * 0.22;
    if (this._anim < 0.001) this._anim = 0;
    if (this._anim > 0.999) this._anim = 1;
    this._tFrame++;
    for (const b of this._bubbles) {
      b.y -= b.speed; b.x += Math.sin(b.phase) * 0.4; b.phase += 0.04; b.life--;
      if (b.life <= 0) Object.assign(b, this._makeBubble(0));
    }
  }

  // ── Draw ─────────────────────────────────────
  draw(ctx, W, H, frame) {
    if (this._anim < 0.005) return;
    const a = this._anim;

    // Backdrop dim
    ctx.save();
    ctx.globalAlpha = a * 0.75;
    ctx.fillStyle   = 'rgba(0,8,22,1)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Panel geometry — responsive
    const panelW = Math.round(Math.min(W * 0.94, 500));
    const panelH = Math.round(Math.min(H * 0.88, 580));
    const panelX = Math.round(W / 2 - panelW / 2);
    const panelY = Math.round(H / 2 - panelH / 2 + (1 - a) * 30);

    ctx.save();
    ctx.globalAlpha = a;

    // Bubbles
    this._drawBubbles(ctx, panelX, panelY, panelW, panelH, frame);

    // Panel bg
    ctx.shadowColor = 'rgba(0,180,255,0.18)';
    ctx.shadowBlur  = 36;
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 16);
    const bg = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    bg.addColorStop(0, 'rgba(0,18,38,0.97)');
    bg.addColorStop(1, 'rgba(0,8,22,0.97)');
    ctx.fillStyle = bg; ctx.fill();

    // Border
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = `rgba(0,200,180,${0.45 + Math.sin(frame * 0.04) * 0.12})`;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 16); ctx.stroke();

    // Header text
    const headerY = panelY + 36;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(panelW * 0.068)}px "Courier New", monospace`;
    ctx.fillStyle = '#00eeff';
    ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 14 + Math.sin(frame * 0.05) * 4;
    ctx.fillText('SELECT TURTLE', panelX + panelW / 2, headerY);
    ctx.shadowBlur = 0;

    // Header underline
    ctx.strokeStyle = 'rgba(0,200,220,0.28)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelX + 24, headerY + 22); ctx.lineTo(panelX + panelW - 24, headerY + 22);
    ctx.stroke();

    // Close button
    const cs = 32;
    const cbx = panelX + panelW - cs - 12, cby = panelY + 10;
    this._btnClose = { x: cbx, y: cby, w: cs, h: cs };
    this._drawCloseBtn(ctx, cbx, cby, cs, this._hoverClose, frame);

    // 2×2 card grid
    const gPad = Math.round(panelW * 0.06);
    const gGap = Math.round(panelW * 0.04);
    const cardW = Math.round((panelW - gPad * 2 - gGap) / 2);
    const cardH = Math.round(Math.min(cardW * 1.2, (panelH - 120) / 2 - gGap / 2));
    const gridTop = panelY + 68;

    this._cards = [];
    const turtles = ShopPanel.TURTLES;
    for (let i = 0; i < 4; i++) {
      const col   = i % 2;
      const row   = Math.floor(i / 2);
      const cardX = panelX + gPad + col * (cardW + gGap);
      const cardY = gridTop + row * (cardH + gGap);
      this._cards.push({ x: cardX, y: cardY, w: cardW, h: cardH, id: turtles[i].id });
      this._drawCard(ctx, cardX, cardY, cardW, cardH,
        turtles[i], turtles[i].id === this._selected, this._hoverCard === i, frame);
    }

    ctx.restore();
  }

  // ── Single card ──────────────────────────────
  _drawCard(ctx, x, y, w, h, skin, selected, hover, frame) {
    ctx.save();

    // Subtle scale on hover
    if (hover && !selected) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(1.03, 1.03);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    // Background
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10);
    if (selected) {
      const sg = ctx.createLinearGradient(x, y, x, y + h);
      sg.addColorStop(0, 'rgba(0,55,45,0.95)');
      sg.addColorStop(1, 'rgba(0,35,28,0.95)');
      ctx.fillStyle = sg;
    } else {
      ctx.fillStyle = hover ? 'rgba(0,28,42,0.90)' : 'rgba(0,14,26,0.72)';
    }
    ctx.fill();

    // Border
    ctx.strokeStyle = selected ? '#00ffcc' : (hover ? 'rgba(0,200,160,0.7)' : 'rgba(0,100,90,0.3)');
    ctx.lineWidth   = selected ? 2.5 : 1.5;
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur  = selected ? 16 : (hover ? 6 : 0);
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke();
    ctx.shadowBlur  = 0;

    // Turtle preview — centred
    const sz  = Math.round(Math.min(w, h) * 0.54);
    const scx = x + w / 2;
    const scy = y + h * (selected ? 0.42 : 0.46);
    this._drawTurtlePreview(ctx, scx, scy, sz, skin);

    // SELECTED badge at bottom
    if (selected) {
      const bh = Math.round(h * 0.155);
      const bw = Math.round(w * 0.72);
      const bx = x + (w - bw) / 2;
      const by = y + h - bh - Math.round(h * 0.06);
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2);
      ctx.fillStyle = '#00ffcc'; ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 10; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `bold ${Math.round(bh * 0.62)}px "Courier New", monospace`;
      ctx.fillStyle = '#001a14'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✓  SELECTED', bx + bw / 2, by + bh / 2);
    }

    ctx.restore();
  }

  // ── Turtle preview with correct skin colors ──
  _drawTurtlePreview(ctx, cx, cy, size, skin) {
    const img  = (typeof Loader !== 'undefined') ? Loader.get('turtle') : null;
    const half = size / 2;
    const bob  = Math.sin(this._tFrame * 0.055) * 2.5;
    const finW = Math.sin(this._tFrame * 0.44) * 18;
    const ftW  = Math.sin(this._tFrame * 0.44 + 1.2) * 18;

    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy + bob));
    ctx.rotate(-Math.PI / 2);   // face right

    // Shadow
    ctx.save();
    ctx.rotate(Math.PI / 2);
    ctx.translate(0, half + 5);
    ctx.globalAlpha = 0.22;
    ctx.scale(1, 0.25);
    const sg = ctx.createRadialGradient(0,0,1,0,0,half);
    sg.addColorStop(0,'rgba(0,180,255,0.5)'); sg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0,0,half,0,6.28); ctx.fill();
    ctx.restore();

    // Flippers behind (skinned)
    this._drawSkinFlippers(ctx, finW, ftW, false, skin);

    // Body
    if (img) {
      if (!this._oc || this._oc.width !== size) {
        this._oc  = document.createElement('canvas');
        this._oc.width = this._oc.height = size;
        this._oc2 = this._oc.getContext('2d');
      }
      const oc2 = this._oc2;
      if (skin.tint) {
        const [r, g, b] = skin.tint;
        const rc = Math.round(r*255), gc = Math.round(g*255), bc = Math.round(b*255);
        oc2.clearRect(0, 0, size, size);
        oc2.globalCompositeOperation = 'source-over';
        oc2.globalAlpha = 1;
        oc2.drawImage(img, 0, 0, size, size);
        oc2.globalCompositeOperation = 'source-atop';
        oc2.fillStyle = `rgba(${rc},${gc},${bc},0.85)`;
        oc2.fillRect(0, 0, size, size);
        oc2.globalCompositeOperation = 'source-atop';
        oc2.globalAlpha = 0.40;
        oc2.drawImage(img, 0, 0, size, size);
        oc2.globalCompositeOperation = 'source-over';
        oc2.globalAlpha = 1;
        ctx.drawImage(this._oc, -half, -half, size, size);
      } else {
        ctx.drawImage(img, -half, -half, size, size);
      }
    } else {
      // Fallback shell
      const col = skin.tint
        ? `rgb(${Math.round(skin.tint[0]*60+40)},${Math.round(skin.tint[1]*80+30)},${Math.round(skin.tint[2]*60+40)})`
        : '#1a6b8a';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0,3,17,14,0,0,6.28); ctx.fill();
    }

    // Flippers in front (skinned)
    this._drawSkinFlippers(ctx, finW, ftW, true, skin);
    ctx.restore();
  }

  // Skinned flipper drawing
  _drawSkinFlippers(ctx, finW, ftW, front, skin) {
    const { fc1, fc2, fc3, foot, footStroke } = skin;
    ctx.save();
    if (!front) {
      ctx.save(); ctx.translate(-11,0); ctx.rotate((-12+finW)*Math.PI/180);
      ctx.fillStyle=fc3; ctx.beginPath(); ctx.moveTo(0,0);ctx.lineTo(-7,-1);ctx.lineTo(-9,2);ctx.lineTo(-6,5);ctx.lineTo(0,3);ctx.closePath();ctx.fill();
      ctx.fillStyle=fc1; ctx.beginPath(); ctx.moveTo(0,1);ctx.lineTo(-6,0);ctx.lineTo(-8,2);ctx.lineTo(-5,4);ctx.lineTo(0,2);ctx.closePath();ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(11,0); ctx.rotate((12-finW)*Math.PI/180);
      ctx.fillStyle=fc3; ctx.beginPath(); ctx.moveTo(0,0);ctx.lineTo(7,-1);ctx.lineTo(9,2);ctx.lineTo(6,5);ctx.lineTo(0,3);ctx.closePath();ctx.fill();
      ctx.fillStyle=fc1; ctx.beginPath(); ctx.moveTo(0,1);ctx.lineTo(6,0);ctx.lineTo(8,2);ctx.lineTo(5,4);ctx.lineTo(0,2);ctx.closePath();ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(-6,13); ctx.rotate((-7+ftW)*Math.PI/180);
      ctx.fillStyle=foot; ctx.beginPath(); ctx.moveTo(0,0);ctx.lineTo(-4,1);ctx.lineTo(-5,5);ctx.lineTo(-1,6);ctx.lineTo(0,3);ctx.closePath();ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(6,13); ctx.rotate((7-ftW)*Math.PI/180);
      ctx.fillStyle=foot; ctx.beginPath(); ctx.moveTo(0,0);ctx.lineTo(4,1);ctx.lineTo(5,5);ctx.lineTo(1,6);ctx.lineTo(0,3);ctx.closePath();ctx.fill(); ctx.restore();
    }
    if (front) {
      ctx.save(); ctx.translate(-11,0); ctx.rotate((-12+finW)*Math.PI/180);
      ctx.fillStyle=fc2; ctx.beginPath(); ctx.moveTo(-6,-1);ctx.lineTo(-9,2);ctx.lineTo(-6,4);ctx.closePath();ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(11,0); ctx.rotate((12-finW)*Math.PI/180);
      ctx.fillStyle=fc2; ctx.beginPath(); ctx.moveTo(6,-1);ctx.lineTo(9,2);ctx.lineTo(6,4);ctx.closePath();ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  // ── Close button ─────────────────────────────
  _drawCloseBtn(ctx, x, y, size, hover, frame) {
    const cx=x+size/2, cy=y+size/2, pulse=hover?1+Math.sin(frame*0.2)*0.08:1;
    ctx.save(); ctx.translate(cx,cy); ctx.scale(pulse,pulse);
    ctx.beginPath(); ctx.arc(0,0,size/2,0,Math.PI*2);
    ctx.fillStyle=hover?'rgba(40,5,5,0.95)':'rgba(20,5,5,0.8)';
    ctx.shadowColor='#ff4433'; ctx.shadowBlur=hover?16:4; ctx.fill();
    ctx.strokeStyle=hover?'#ff4433':'rgba(180,40,30,0.5)'; ctx.lineWidth=hover?2:1.5; ctx.stroke();
    const arm=size*0.22;
    ctx.strokeStyle=hover?'#fff':'#ff6655'; ctx.lineWidth=2.5; ctx.shadowBlur=hover?8:0; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-arm,-arm);ctx.lineTo(arm,arm); ctx.moveTo(arm,-arm);ctx.lineTo(-arm,arm); ctx.stroke();
    ctx.restore();
  }

  // ── Bubbles ──────────────────────────────────
  _makeBubble(p) {
    return { x:Math.random()*500, y:p===1?Math.random()*600:600,
      r:1+Math.random()*3, speed:0.3+Math.random()*0.5,
      phase:Math.random()*Math.PI*2, life:Math.round(60+Math.random()*120) };
  }
  _drawBubbles(ctx, px, py, pw, ph) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(px,py,pw,ph,16); ctx.clip();
    for (const b of this._bubbles) {
      ctx.globalAlpha=Math.min(1,b.life/30)*0.2;
      ctx.beginPath(); ctx.arc(px+(b.x/500)*pw, py+ph-(b.y/600)*ph, b.r, 0, Math.PI*2);
      ctx.strokeStyle='#00eeff'; ctx.lineWidth=1; ctx.stroke();
    }
    ctx.restore();
  }

  // ── Input ────────────────────────────────────
  handleClick(mx, my) {
    if (!this.isOpen()) return false;
    // Convert client coords → canvas coords
    const canvas = document.getElementById('gameCanvas');
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (mx - rect.left) * scaleX;
    const cy = (my - rect.top)  * scaleY;

    if (cx >= this._btnClose.x && cx <= this._btnClose.x + this._btnClose.w &&
        cy >= this._btnClose.y && cy <= this._btnClose.y + this._btnClose.h) {
      this.close(); return true;
    }
    for (const card of this._cards) {
      if (cx >= card.x && cx <= card.x + card.w &&
          cy >= card.y && cy <= card.y + card.h) {
        this._selected = card.id;
        ShopPanel._save(card.id);
        return true;
      }
    }
    return true; // swallow all clicks when open
  }

  handleMove(mx, my) {
    const canvas = document.getElementById('gameCanvas');
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (mx - rect.left) * scaleX;
    const cy = (my - rect.top)  * scaleY;
    this._hoverClose = (cx >= this._btnClose.x && cx <= this._btnClose.x + this._btnClose.w &&
                        cy >= this._btnClose.y && cy <= this._btnClose.y + this._btnClose.h);
    this._hoverCard  = -1;
    for (let i = 0; i < this._cards.length; i++) {
      const c = this._cards[i];
      if (cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h) {
        this._hoverCard = i; break;
      }
    }
  }
}
