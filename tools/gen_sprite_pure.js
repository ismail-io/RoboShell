/**
 * Pure Node.js sprite generator — no external dependencies.
 * Uses zlib (built-in) to write a valid PNG file.
 *
 * Generates: ../assets/player/turtle_sprite.png
 * Sheet: 320×32px  (10 frames × 32×32)
 *
 * Run: node gen_sprite_pure.js
 */

'use strict';
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────
//  Tiny RGBA pixel buffer
// ─────────────────────────────────────────────
const W = 320, H = 32;
const buf = new Uint8Array(W * H * 4); // RGBA

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i]   = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
}

// Parse '#rrggbb' or '#rrggbbaa'
function hex(h) {
  if (!h) return null;
  const v = h.replace('#','');
  return [
    parseInt(v.slice(0,2),16),
    parseInt(v.slice(2,4),16),
    parseInt(v.slice(4,6),16),
    v.length >= 8 ? parseInt(v.slice(6,8),16) : 255
  ];
}

function px(ox, oy, x, y, color) {
  if (!color) return;
  const c = hex(color);
  if (!c) return;
  setPixel(ox + x, oy + y, c[0], c[1], c[2], c[3]);
}

function fillRect(ox, oy, x, y, w, h, color) {
  if (!color) return;
  const c = hex(color);
  if (!c) return;
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(ox+x+dx, oy+y+dy, c[0], c[1], c[2], c[3]);
}

// ─────────────────────────────────────────────
//  Palette
// ─────────────────────────────────────────────
const C = {
  outline:  '#111122', shell1:  '#1a6b8a', shell2:  '#2299bb', shell3:  '#44ccdd',
  glow:     '#00eeff', glow2:   '#88ffff', metal1:  '#334455', metal2:  '#556677',
  metal3:   '#8899aa', eye:     '#00ccff', eyeGlow: '#aaffff',
  flipper:  '#2a5566', flipper2:'#3a7788', belly:   '#1a3344', belly2:  '#2a4455',
  red:      '#ff4444', red2:    '#ff8888', white:   '#eeffff',
  shadow:   '#00001188',
};

// ─────────────────────────────────────────────
//  Draw base turtle facing UP at offset (ox, oy)
// ─────────────────────────────────────────────
function drawBase(ox, oy, legPhase, blinkOn) {
  const lp = legPhase ? 2 : 0;
  const F = (x,y,w,h,c) => fillRect(ox,oy,x,y,w,h,c);
  const P = (x,y,c)     => px(ox,oy,x,y,c);

  // Shadow
  for (let dy=0;dy<14;dy++) for (let dx=0;dx<14;dx++) {
    const i = ((oy+10+dy)*W+(ox+9+dx))*4;
    buf[i+3] = Math.min(255, buf[i+3] + 30);
  }

  // Back flippers
  F(7-lp,20,5,3,C.outline);  F(8-lp,21,3,2,C.flipper2); P(7-lp,21,C.flipper);
  F(20+lp,20,5,3,C.outline); F(21+lp,21,3,2,C.flipper2); P(24+lp,21,C.flipper);

  // Front flippers
  F(6+lp,11,5,3,C.outline);  F(7+lp,12,3,2,C.flipper2); P(6+lp,12,C.flipper);
  F(21-lp,11,5,3,C.outline); F(22-lp,12,3,2,C.flipper2); P(25-lp,12,C.flipper);

  // Body outline
  F(10,8,12,16,C.outline); F(9,9,14,14,C.outline);

  // Shell
  F(11,9,10,14,C.shell1); F(10,10,12,12,C.shell1);
  F(13,12,6,8,C.shell2);  F(12,13,8,6,C.shell2);
  F(13,10,6,3,C.shell3);  F(14,9,4,2,C.shell3);
  F(13,19,6,3,C.shell2);  F(10,13,3,6,C.shell2); F(19,13,3,6,C.shell2);
  F(14,10,3,2,C.glow2);   P(14,10,C.white);

  // Circuit lines
  F(12,15,8,1,C.glow); F(16,11,1,9,C.glow);
  P(13,12,C.glow); P(18,12,C.glow); P(13,19,C.glow); P(18,19,C.glow);
  P(12,13,C.glow); P(12,18,C.glow); P(19,13,C.glow); P(19,18,C.glow);

  // Head
  F(12,5,8,6,C.outline); F(13,4,6,7,C.outline);
  F(13,5,6,5,C.metal2);  F(14,5,4,5,C.metal3);
  F(14,5,2,2,C.white);   F(13,9,6,2,C.metal1);

  // Eyes
  F(13,6,3,3,C.outline); F(14,7,2,2,C.eye); P(14,7,C.eyeGlow);
  F(16,6,3,3,C.outline); F(17,7,2,2,C.eye); P(17,7,C.eyeGlow);

  // Antenna
  P(16,4,C.metal2);
  P(16,3, blinkOn ? C.red : '#550000');
  if (blinkOn) P(16,2,C.red2);

  // Tail
  F(14,23,4,3,C.outline); F(15,24,2,2,C.metal2);
}

// ─────────────────────────────────────────────
//  Copy a 32×32 region from src offset to dst offset
//  with optional rotation (0, 90, 180, 270 degrees)
// ─────────────────────────────────────────────
function copyRegion(srcOx, srcOy, dstOx, dstOy, rot) {
  // Extract 32×32 from buf
  const tmp = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const si = ((srcOy+y)*W+(srcOx+x))*4;
      const ti = (y*32+x)*4;
      tmp[ti]=buf[si]; tmp[ti+1]=buf[si+1]; tmp[ti+2]=buf[si+2]; tmp[ti+3]=buf[si+3];
    }

  // Write to dst with rotation
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const ti = (y*32+x)*4;
      let dx, dy;
      if      (rot === 0)   { dx=x;    dy=y; }
      else if (rot === 90)  { dx=31-y; dy=x; }
      else if (rot === 180) { dx=31-x; dy=31-y; }
      else                  { dx=y;    dy=31-x; } // 270
      const di = ((dstOy+dy)*W+(dstOx+dx))*4;
      buf[di]=tmp[ti]; buf[di+1]=tmp[ti+1]; buf[di+2]=tmp[ti+2]; buf[di+3]=tmp[ti+3];
    }
}

// ─────────────────────────────────────────────
//  Draw all 10 frames
//  Frame layout: each frame is 32px wide, all on row y=0
//  0=IdleA 1=IdleB 2=UpA 3=UpB 4=DownA 5=DownB 6=LeftA 7=LeftB 8=RightA 9=RightB
// ─────────────────────────────────────────────

// We use a scratch area at y=0 for each frame, then rotate into place.
// Since all frames are on the same row, we draw each into a temp buffer.

// Helper: draw a frame into a 32×32 temp Uint8Array
function makeFrameBuf(drawFn) {
  const tmp = new Uint8Array(32 * 32 * 4);
  // Temporarily redirect setPixel to tmp
  const origBuf = buf.slice();
  // Clear the scratch area (use frame slot 0 as scratch, copy back after)
  for (let i = 0; i < 32*32*4; i++) buf[i] = 0;
  drawFn(0, 0);
  // Extract
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const si = (y*W+x)*4;
      const ti = (y*32+x)*4;
      tmp[ti]=buf[si]; tmp[ti+1]=buf[si+1]; tmp[ti+2]=buf[si+2]; tmp[ti+3]=buf[si+3];
    }
  // Restore
  for (let i = 0; i < W*H*4; i++) buf[i] = origBuf[i];
  return tmp;
}

// Write a 32×32 tmp buffer to sheet at frame index fi
function writeFrame(fi, tmp, rot) {
  const dstOx = fi * 32;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const ti = (y*32+x)*4;
      let dx, dy;
      if      (rot === 0)   { dx=x;    dy=y; }
      else if (rot === 90)  { dx=31-y; dy=x; }
      else if (rot === 180) { dx=31-x; dy=31-y; }
      else                  { dx=y;    dy=31-x; } // 270
      const di = (dy*W+(dstOx+dx))*4;
      buf[di]=tmp[ti]; buf[di+1]=tmp[ti+1]; buf[di+2]=tmp[ti+2]; buf[di+3]=tmp[ti+3];
    }
}

// Frame 0: Idle A (facing up, glow pulse low, blink on)
writeFrame(0, makeFrameBuf((ox,oy) => drawBase(ox,oy,false,true)), 0);

// Frame 1: Idle B (glow pulse high, blink off)
writeFrame(1, makeFrameBuf((ox,oy) => {
  drawBase(ox,oy,false,false);
  // Extra glow pulse — brighten circuit lines
  fillRect(ox,oy,12,15,8,1,C.glow2); fillRect(ox,oy,16,11,1,9,C.glow2);
}), 0);

// Frame 2: Up A
writeFrame(2, makeFrameBuf((ox,oy) => drawBase(ox,oy,false,true)), 0);

// Frame 3: Up B
writeFrame(3, makeFrameBuf((ox,oy) => drawBase(ox,oy,true,false)), 0);

// Frame 4: Down A (rotate 180)
writeFrame(4, makeFrameBuf((ox,oy) => drawBase(ox,oy,false,true)), 180);

// Frame 5: Down B (rotate 180)
writeFrame(5, makeFrameBuf((ox,oy) => drawBase(ox,oy,true,false)), 180);

// Frame 6: Left A (rotate 270 = turn left)
writeFrame(6, makeFrameBuf((ox,oy) => drawBase(ox,oy,false,true)), 270);

// Frame 7: Left B (rotate 270)
writeFrame(7, makeFrameBuf((ox,oy) => drawBase(ox,oy,true,false)), 270);

// Frame 8: Right A (rotate 90)
writeFrame(8, makeFrameBuf((ox,oy) => drawBase(ox,oy,false,true)), 90);

// Frame 9: Right B (rotate 90)
writeFrame(9, makeFrameBuf((ox,oy) => drawBase(ox,oy,true,false)), 90);

// ─────────────────────────────────────────────
//  Write PNG
// ─────────────────────────────────────────────
function writePNG(width, height, rgba) {
  function crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
    for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const crcData = Buffer.concat([typeBytes, data]);
    const crcBuf  = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([len, typeBytes, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw image data with filter bytes
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter = None
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (1 + width * 4) + 1 + x * 4;
      raw[di]   = rgba[si];
      raw[di+1] = rgba[si+1];
      raw[di+2] = rgba[si+2];
      raw[di+3] = rgba[si+3];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const outDir = path.join(__dirname, '..', 'assets', 'player');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'turtle_sprite.png');
fs.writeFileSync(outPath, writePNG(W, H, buf));
console.log(`✅ Saved: ${outPath}  (${W}×${H}px, 10 frames)`);
