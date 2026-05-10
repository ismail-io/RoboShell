/**
 * Generates turtle_sprite.png (320×64) using node-canvas.
 * Run: node gen_sprite.js
 * Output: ../assets/player/turtle_sprite.png
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const FRAME_W = 32;
const FRAME_H = 32;
const FRAMES  = 10;

const sheet = createCanvas(FRAME_W * FRAMES, FRAME_H);
const sctx  = sheet.getContext('2d');
sctx.imageSmoothingEnabled = false;

// ── Palette ──
const C = {
  outline: '#111122', shell1: '#1a6b8a', shell2: '#2299bb', shell3: '#44ccdd',
  glow: '#00eeff', glow2: '#88ffff', metal1: '#334455', metal2: '#556677',
  metal3: '#8899aa', eye: '#00ccff', eyeGlow: '#aaffff',
  flipper: '#2a5566', flipper2: '#3a7788', belly: '#1a3344', belly2: '#2a4455',
  red: '#ff4444', red2: '#ff8888', white: '#eeffff',
};

function px(ctx, x, y, color) {
  if (!color) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}
function rect(ctx, x, y, w, h, color) {
  if (!color) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawBase(ctx, legPhase) {
  const lp = legPhase ? 2 : 0;

  // Shadow
  ctx.globalAlpha = 0.15;
  rect(ctx, 9, 10, 14, 14, '#000033');
  ctx.globalAlpha = 1;

  // Back flippers
  rect(ctx, 7-lp, 20, 5, 3, C.outline);
  rect(ctx, 8-lp, 21, 3, 2, C.flipper2);
  px(ctx, 7-lp, 21, C.flipper);
  rect(ctx, 20+lp, 20, 5, 3, C.outline);
  rect(ctx, 21+lp, 21, 3, 2, C.flipper2);
  px(ctx, 24+lp, 21, C.flipper);

  // Front flippers
  rect(ctx, 6+lp, 11, 5, 3, C.outline);
  rect(ctx, 7+lp, 12, 3, 2, C.flipper2);
  px(ctx, 6+lp, 12, C.flipper);
  rect(ctx, 21-lp, 11, 5, 3, C.outline);
  rect(ctx, 22-lp, 12, 3, 2, C.flipper2);
  px(ctx, 25-lp, 12, C.flipper);

  // Body outline
  rect(ctx, 10, 8, 12, 16, C.outline);
  rect(ctx, 9, 9, 14, 14, C.outline);

  // Shell base
  rect(ctx, 11, 9, 10, 14, C.shell1);
  rect(ctx, 10, 10, 12, 12, C.shell1);

  // Shell plates
  rect(ctx, 13, 12, 6, 8, C.shell2);
  rect(ctx, 12, 13, 8, 6, C.shell2);
  rect(ctx, 13, 10, 6, 3, C.shell3);
  rect(ctx, 14,  9, 4, 2, C.shell3);
  rect(ctx, 13, 19, 6, 3, C.shell2);
  rect(ctx, 10, 13, 3, 6, C.shell2);
  rect(ctx, 19, 13, 3, 6, C.shell2);

  // Shell highlight
  rect(ctx, 14, 10, 3, 2, C.glow2);
  px(ctx, 14, 10, C.white);

  // Circuit glow lines
  rect(ctx, 12, 15, 8, 1, C.glow);
  rect(ctx, 16, 11, 1, 9, C.glow);
  px(ctx, 13, 12, C.glow); px(ctx, 18, 12, C.glow);
  px(ctx, 13, 19, C.glow); px(ctx, 18, 19, C.glow);
  px(ctx, 12, 13, C.glow); px(ctx, 12, 18, C.glow);
  px(ctx, 19, 13, C.glow); px(ctx, 19, 18, C.glow);

  // Head
  rect(ctx, 12, 5, 8, 6, C.outline);
  rect(ctx, 13, 4, 6, 7, C.outline);
  rect(ctx, 13, 5, 6, 5, C.metal2);
  rect(ctx, 14, 5, 4, 5, C.metal3);
  rect(ctx, 14, 5, 2, 2, C.white);
  rect(ctx, 13, 9, 6, 2, C.metal1);

  // Eyes
  rect(ctx, 13, 6, 3, 3, C.outline);
  rect(ctx, 14, 7, 2, 2, C.eye);
  px(ctx, 14, 7, C.eyeGlow);
  rect(ctx, 16, 6, 3, 3, C.outline);
  rect(ctx, 17, 7, 2, 2, C.eye);
  px(ctx, 17, 7, C.eyeGlow);

  // Tail
  rect(ctx, 14, 23, 4, 3, C.outline);
  rect(ctx, 15, 24, 2, 2, C.metal2);
}

function makeFrame(drawFn) {
  const c = createCanvas(32, 32);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawFn(ctx);
  return c;
}

// Rotate a 32×32 canvas by angle (radians)
function rotated(src, angle) {
  const c = createCanvas(32, 32);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(16, 16);
  ctx.rotate(angle);
  ctx.drawImage(src, -16, -16);
  return c;
}

// ── Build frames ──
const frames = [];

// 0: Idle A
frames.push(makeFrame(ctx => {
  drawBase(ctx, false);
  ctx.globalAlpha = 0.5; rect(ctx, 12, 15, 8, 1, C.glow2); rect(ctx, 16, 11, 1, 9, C.glow2); ctx.globalAlpha = 1;
  px(ctx, 16, 3, C.red); px(ctx, 16, 2, C.red2);
}));

// 1: Idle B (glow pulse)
frames.push(makeFrame(ctx => {
  drawBase(ctx, false);
  ctx.globalAlpha = 0.9; rect(ctx, 12, 15, 8, 1, C.glow2); rect(ctx, 16, 11, 1, 9, C.glow2); ctx.globalAlpha = 1;
  px(ctx, 16, 3, '#550000');
}));

// 2: Up A
frames.push(makeFrame(ctx => {
  drawBase(ctx, false);
  px(ctx, 16, 3, C.red); px(ctx, 16, 2, C.red2);
}));

// 3: Up B
frames.push(makeFrame(ctx => {
  drawBase(ctx, true);
  px(ctx, 16, 3, '#550000');
}));

// 4: Down A  (flip vertical = rotate 180)
frames.push(makeFrame(ctx => {
  const tmp = makeFrame(c => { drawBase(c, false); px(c, 16, 3, C.red); });
  ctx.translate(32, 32); ctx.scale(-1, -1); ctx.drawImage(tmp, 0, 0);
}));

// 5: Down B
frames.push(makeFrame(ctx => {
  const tmp = makeFrame(c => { drawBase(c, true); px(c, 16, 3, '#550000'); });
  ctx.translate(32, 32); ctx.scale(-1, -1); ctx.drawImage(tmp, 0, 0);
}));

// 6: Left A  (rotate -90°)
frames.push(makeFrame(ctx => {
  const tmp = makeFrame(c => { drawBase(c, false); px(c, 16, 3, C.red); });
  ctx.translate(0, 32); ctx.rotate(-Math.PI / 2); ctx.drawImage(tmp, 0, 0);
}));

// 7: Left B
frames.push(makeFrame(ctx => {
  const tmp = makeFrame(c => { drawBase(c, true); px(c, 16, 3, '#550000'); });
  ctx.translate(0, 32); ctx.rotate(-Math.PI / 2); ctx.drawImage(tmp, 0, 0);
}));

// 8: Right A  (rotate +90°)
frames.push(makeFrame(ctx => {
  const tmp = makeFrame(c => { drawBase(c, false); px(c, 16, 3, C.red); });
  ctx.translate(32, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(tmp, 0, 0);
}));

// 9: Right B
frames.push(makeFrame(ctx => {
  const tmp = makeFrame(c => { drawBase(c, true); px(c, 16, 3, '#550000'); });
  ctx.translate(32, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(tmp, 0, 0);
}));

// ── Composite onto sheet ──
frames.forEach((f, i) => sctx.drawImage(f, i * 32, 0));

// ── Save ──
const outDir = path.join(__dirname, '..', 'assets', 'player');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'turtle_sprite.png');
const buf = sheet.toBuffer('image/png');
fs.writeFileSync(outPath, buf);
console.log(`✅ Saved: ${outPath}  (${FRAME_W * FRAMES}×${FRAME_H}px)`);
