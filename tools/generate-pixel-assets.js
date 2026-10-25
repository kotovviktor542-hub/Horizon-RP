// Генератор детализированных пиксель-арт моделей и спрайт-листов с текстурами и контурами
// Каждая модель сохраняется как отдельный прозрачный PNG в www/assets/sprites/

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length, 0);
  const cb = Buffer.alloc(4);
  const comb = Buffer.concat([tb, data]);
  cb.writeUInt32BE(crc32(comb), 0);
  return Buffer.concat([lb, comb, cb]);
}

// Пиксельный мини-шрифт 4x5 для вывесок SHOP и ПОЛИЦИЯ
const PIXEL_FONT = {
  S: ['1111', '1000', '1111', '0001', '1111'],
  H: ['1001', '1001', '1111', '1001', '1001'],
  O: ['1111', '1001', '1001', '1001', '1111'],
  P: ['1111', '1001', '1111', '1000', '1000'],
  'П': ['1111', '1001', '1001', '1001', '1001'],
  'О': ['1111', '1001', '1001', '1001', '1111'],
  'Л': ['0111', '0101', '1101', '1001', '1001'],
  'И': ['1001', '1011', '1101', '1001', '1001'],
  'Ц': ['1010', '1010', '1010', '1111', '0001'],
  'Я': ['0111', '1001', '0111', '1001', '1001']
};

class PixelCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4, 0);
  }

  hex(col) {
    if (!col) return null;
    if (Array.isArray(col)) return col;
    const s = col.replace('#', '');
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255;
    return [r, g, b, a];
  }

  pset(x, y, col) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const rgba = this.hex(col);
    if (!rgba) return;
    const idx = (iy * this.w + ix) * 4;
    this.data[idx] = rgba[0];
    this.data[idx + 1] = rgba[1];
    this.data[idx + 2] = rgba[2];
    this.data[idx + 3] = rgba[3];
  }

  pgetAlpha(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  rect(x, y, w, h, col) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) this.pset(x + dx, y + dy, col);
    }
  }

  borderRect(x, y, w, h, fillCol, borderCol = '#12141d') {
    this.rect(x, y, w, h, fillCol);
    this.rect(x, y, w, 1, borderCol);
    this.rect(x, y + h - 1, w, 1, borderCol);
    this.rect(x, y, 1, h, borderCol);
    this.rect(x + w - 1, y, 1, h, borderCol);
  }

  // Текстура кирпичной/блочной кладки
  brickRect(x, y, w, h, baseCol, mortarCol, altCol) {
    this.rect(x, y, w, h, baseCol);
    for (let dy = 0; dy < h; dy++) {
      const row = Math.floor(dy / 4);
      if (dy % 4 === 0) {
        this.rect(x, y + dy, w, 1, mortarCol);
      } else {
        const shift = (row % 2) * 4;
        for (let dx = 0; dx < w; dx++) {
          if ((dx + shift) % 8 === 0) this.pset(x + dx, y + dy, mortarCol);
          else if (((dx + row * 3) % 11) === 0 && altCol) this.pset(x + dx, y + dy, altCol);
        }
      }
    }
  }

  // Детализированное пиксельное окно с рамой и бликом
  windowPane(x, y, w, h, glassCol = '#60a5fa', frameCol = '#1e293b') {
    this.borderRect(x, y, w, h, glassCol, frameCol);
    this.rect(x + Math.floor(w / 2), y, 1, h, frameCol);
    this.rect(x, y + Math.floor(h / 2), w, 1, frameCol);
    this.pset(x + 2, y + 2, '#e0f2fe');
    this.pset(x + 3, y + 2, '#e0f2fe');
    this.pset(x + 2, y + 3, '#bae6fd');
  }

  drawText(text, x, y, col = '#ffffff', scale = 1) {
    let cx = x;
    for (const ch of text) {
      const glyph = PIXEL_FONT[ch];
      if (glyph) {
        for (let gy = 0; gy < glyph.length; gy++) {
          for (let gx = 0; gx < glyph[gy].length; gx++) {
            if (glyph[gy][gx] === '1') {
              this.rect(cx + gx * scale, y + gy * scale, scale, scale, col);
            }
          }
        }
      }
      cx += 5 * scale;
    }
  }

  circle(cx, cy, r, col) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) this.pset(x, y, col);
      }
    }
  }

  // Текстурированный шар листвы с пиксельным дизерингом
  leafCluster(cx, cy, r, darkCol, midCol, hiCol) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        const d2 = dx * dx + dy * dy;
        const jag = ((x * 7 + y * 13) & 3) - 1.5;
        if (d2 <= r2 + jag * 3) {
          const hDist2 = (dx + r * 0.32) ** 2 + (dy + r * 0.32) ** 2;
          const sDist2 = (dx - r * 0.28) ** 2 + (dy - r * 0.32) ** 2;
          let c = midCol;
          if (hDist2 < (r * 0.52) ** 2) c = hiCol;
          else if (sDist2 < (r * 0.72) ** 2 || dy > r * 0.36) c = darkCol;
          else if (((x + y) & 1) === 0 && hDist2 < (r * 0.74) ** 2) c = hiCol;
          this.pset(x, y, c);
        }
      }
    }
  }

  ellipse(cx, cy, rx, ry, col) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.pset(x, y, col);
      }
    }
  }

  line(x0, y0, x1, y1, col, thick = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      if (thick <= 1) this.pset(x0, y0, col);
      else this.rect(x0 - Math.floor(thick / 2), y0 - Math.floor(thick / 2), thick, thick, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  outlineRegion(rx, ry, rw, rh, outlineCol = '#11131c') {
    const toDraw = [];
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        if (this.pgetAlpha(x, y) > 0) continue;
        const hasNeighbor =
          (x > rx && this.pgetAlpha(x - 1, y) > 128) ||
          (x < rx + rw - 1 && this.pgetAlpha(x + 1, y) > 128) ||
          (y > ry && this.pgetAlpha(x, y - 1) > 128) ||
          (y < ry + rh - 1 && this.pgetAlpha(x, y + 1) > 128);
        if (hasNeighbor) toDraw.push([x, y]);
      }
    }
    for (const [ox, oy] of toDraw) this.pset(ox, oy, outlineCol);
  }

  outlineAll(outlineCol = '#11131c') {
    this.outlineRegion(0, 0, this.w, this.h, outlineCol);
  }

  save(relPath) {
    const full = path.resolve('www/assets/sprites', relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    const raw = Buffer.alloc(this.h * (1 + this.w * 4));
    for (let y = 0; y < this.h; y++) {
      const rs = y * (1 + this.w * 4);
      raw[rs] = 0;
      this.data.copy(raw, rs + 1, y * this.w * 4, (y + 1) * this.w * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; ihdr[9] = 6;
    const png = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0))
    ]);
    fs.writeFileSync(full, png);
  }
}

const PAL = {
  outline: '#12141d',
  skin: '#f0b895',
  skinShadow: '#c98867',
  hair: '#5a3826',
  hairHi: '#82523a',
  jacket: '#252a38',
  jacketHi: '#3c455c',
  pants: '#1c2230',
  boots: '#12151f',
  zombieSkin: '#6e9957',
  zombieDark: '#4a6e38',
  blood: '#b92b2b',
  bloodHi: '#ef4444',
  bandana: '#c83232',
  vest: '#6e472b',
  tactical: '#2a303d',
  tacticalHi: '#465063',
  wood: '#8c5832',
  woodHi: '#b37646',
  woodDark: '#59351c',
  leafDark: '#234723',
  leafMid: '#3c7034',
  leafHi: '#67a34d',
  stoneDark: '#495061',
  stoneMid: '#6e788c',
  stoneHi: '#9aa4b8',
  steelDark: '#353d4f',
  steelMid: '#5a667d',
  steelHi: '#8e9eb8',
  gold: '#f2b632',
  goldDark: '#bd7e19',
  blueMagic: '#2998ff',
  blueHi: '#85d2ff',
  fireOrange: '#f57d20',
  fireYellow: '#ffe047'
};

// 1. ГЛАВНЫЙ ГЕРОЙ (hero_sheet.png: 4x6 кадров по 32x32)
function generateHeroSheet() {
  const fw = 32, fh = 32;
  const pc = new PixelCanvas(fw * 4, fh * 6);

  function drawHeroFrame(col, row, dir, step, mode = 'walk') {
    const ox = col * fw, oy = row * fh;
    const isHurt = mode === 'hurt';
    const isJump = mode === 'jump';
    const isRun = mode === 'run';
    const isAtk = mode === 'attack';

    const bob = isJump ? -4 : (step % 2 === 1 ? -1 : 0);
    const lean = isRun ? 2 : (isHurt ? -2 : 0);
    const cx = ox + 16 + lean;
    const baseY = oy + 28 + bob;

    pc.ellipse(ox + 16, oy + 29, isJump ? 4 : 6, 2, '#00000058');

    const legSwing = step === 1 ? -2 : step === 3 ? 2 : 0;
    if (isJump) {
      pc.rect(cx - 4, baseY - 6, 3, 4, PAL.pants);
      pc.rect(cx + 1, baseY - 5, 3, 4, PAL.pants);
      pc.rect(cx - 4, baseY - 2, 3, 2, PAL.boots);
      pc.rect(cx + 1, baseY - 1, 3, 2, PAL.boots);
    } else if (dir === 'left' || dir === 'right' || isRun) {
      pc.rect(cx - 2 + legSwing, baseY - 7, 3, 5, PAL.pants);
      pc.rect(cx - 1 - legSwing, baseY - 7, 3, 5, PAL.pants);
      pc.rect(cx - 2 + legSwing, baseY - 2, 4, 2, PAL.boots);
      pc.rect(cx - 1 - legSwing, baseY - 2, 4, 2, PAL.boots);
    } else {
      const lOff = step === 1 ? -1 : 0;
      const rOff = step === 3 ? -1 : 0;
      pc.rect(cx - 4, baseY - 7 + lOff, 3, 5, PAL.pants);
      pc.rect(cx + 1, baseY - 7 + rOff, 3, 5, PAL.pants);
      pc.rect(cx - 4, baseY - 2 + lOff, 3, 2, PAL.boots);
      pc.rect(cx + 1, baseY - 2 + rOff, 3, 2, PAL.boots);
    }

    // Куртка с воротником и бликами
    pc.rect(cx - 5, baseY - 15, 10, 8, PAL.jacket);
    pc.rect(cx - 4, baseY - 14, 3, 6, PAL.jacketHi);
    pc.rect(cx - 4, baseY - 15, 8, 1, '#475569');
    if (dir === 'down') pc.line(cx, baseY - 15, cx, baseY - 8, '#64748b', 1);

    const armSwing = step === 1 ? 1 : step === 3 ? -1 : 0;
    if (isAtk) {
      pc.rect(cx + 4, baseY - 14, 6, 3, PAL.jacketHi);
      pc.rect(cx + 9, baseY - 14, 2, 2, PAL.skin);
    } else if (isHurt) {
      pc.rect(cx - 7, baseY - 16, 3, 5, PAL.jacket);
      pc.rect(cx + 4, baseY - 16, 3, 5, PAL.jacket);
    } else {
      pc.rect(cx - 7, baseY - 14 + armSwing, 2, 6, PAL.jacket);
      pc.rect(cx + 5, baseY - 14 - armSwing, 2, 6, PAL.jacket);
      pc.pset(cx - 7, baseY - 8 + armSwing, PAL.skin);
      pc.pset(cx + 6, baseY - 8 - armSwing, PAL.skin);
    }

    const hy = baseY - 24;
    pc.rect(cx - 5, hy + 2, 10, 8, PAL.skin);
    pc.rect(cx - 5, hy + 8, 10, 2, PAL.skinShadow);

    // Пышная колючая причёска выжившего
    pc.rect(cx - 6, hy, 12, 4, PAL.hair);
    pc.rect(cx - 4, hy - 1, 8, 2, PAL.hairHi);
    pc.pset(cx - 7, hy + 2, PAL.hair);
    pc.pset(cx + 6, hy + 2, PAL.hair);
    pc.pset(cx - 4, hy + 4, PAL.hair);
    pc.pset(cx, hy + 4, PAL.hair);
    pc.pset(cx + 3, hy + 4, PAL.hair);

    if (dir === 'up') {
      pc.rect(cx - 5, hy + 2, 10, 7, PAL.hair);
    } else if (dir === 'left') {
      pc.rect(cx + 1, hy + 2, 4, 6, PAL.hair);
      pc.pset(cx - 4, hy + 5, '#ffffff');
      pc.rect(cx - 3, hy + 5, 2, 2, PAL.outline);
    } else if (dir === 'right' || isRun || isAtk) {
      pc.rect(cx - 5, hy + 2, 4, 6, PAL.hair);
      pc.pset(cx + 3, hy + 5, '#ffffff');
      pc.rect(cx + 1, hy + 5, 2, 2, PAL.outline);
    } else {
      pc.pset(cx - 4, hy + 5, '#ffffff');
      pc.rect(cx - 3, hy + 5, 2, 2, PAL.outline);
      pc.pset(cx + 1, hy + 5, '#ffffff');
      pc.rect(cx + 2, hy + 5, 2, 2, PAL.outline);
    }

    pc.outlineRegion(ox, oy, fw, fh, PAL.outline);

    if (isAtk) {
      for (let a = -1.15; a <= 1.15; a += 0.09) {
        const sx = cx + 7 + Math.cos(a) * 9;
        const sy = baseY - 12 + Math.sin(a) * 9;
        pc.pset(sx, sy, '#ffffff');
        pc.pset(sx - 1, sy, '#93c5fd');
      }
    }
    if (isHurt) {
      pc.circle(cx + 6, hy + 4, 2.3, PAL.bloodHi);
      pc.pset(cx + 9, hy + 2, PAL.bloodHi);
      pc.pset(cx + 8, hy + 7, PAL.blood);
    }
  }

  ['down', 'up', 'left', 'right'].forEach((d, r) => {
    for (let s = 0; s < 4; s++) drawHeroFrame(s, r, d, s, 'walk');
  });
  for (let s = 0; s < 4; s++) drawHeroFrame(s, 4, 'right', s, 'run');
  drawHeroFrame(0, 5, 'right', 1, 'jump');
  drawHeroFrame(1, 5, 'left', 1, 'jump');
  drawHeroFrame(2, 5, 'right', 2, 'attack');
  drawHeroFrame(3, 5, 'down', 0, 'hurt');
  pc.save('characters/hero_sheet.png');
}

// 2. ВРАГИ И ДЕТАЛИЗИРОВАННЫЙ БОСС
function generateEnemySheets() {
  const fw = 32, fh = 32;

  // Зомби
  const zc = new PixelCanvas(fw * 6, fh);
  for (let f = 0; f < 6; f++) {
    const ox = f * fw, isAtk = f >= 4, step = f % 4;
    const bob = step % 2 === 1 ? -1 : 0;
    const cx = ox + 16, by = 28 + bob;
    zc.ellipse(ox + 16, 29, 6, 2, '#00000058');
    zc.rect(cx - 4, by - 7 + (step === 1 ? -1 : 0), 3, 6, '#4a3b2c');
    zc.rect(cx + 1, by - 7 + (step === 3 ? -1 : 0), 3, 6, '#4a3b2c');
    zc.rect(cx - 5, by - 15, 10, 8, '#8a857a');
    zc.rect(cx - 2, by - 14, 4, 5, PAL.blood);
    zc.rect(cx - 7, by - 14, 3, 5, PAL.zombieSkin);
    zc.rect(cx + 4, by - 15, isAtk ? 7 : 4, 3, PAL.zombieSkin);
    zc.rect(cx - 5, by - 24, 10, 9, PAL.zombieSkin);
    zc.rect(cx - 5, by - 17, 10, 2, PAL.zombieDark);
    zc.pset(cx - 2, by - 20, PAL.bloodHi);
    zc.pset(cx + 2, by - 20, PAL.bloodHi);
    zc.rect(cx - 2, by - 17, 4, 1, PAL.blood);
    zc.outlineRegion(ox, 0, fw, fh, PAL.outline);
  }
  zc.save('characters/zombie_sheet.png');

  // Бандит
  const bc = new PixelCanvas(fw * 6, fh);
  for (let f = 0; f < 6; f++) {
    const ox = f * fw, isAtk = f >= 4, step = f % 4;
    const bob = step % 2 === 1 ? -1 : 0;
    const cx = ox + 16, by = 28 + bob;
    bc.ellipse(ox + 16, 29, 6, 2, '#00000058');
    bc.rect(cx - 4, by - 7 + (step === 1 ? -1 : 0), 3, 6, '#2b303a');
    bc.rect(cx + 1, by - 7 + (step === 3 ? -1 : 0), 3, 6, '#2b303a');
    bc.rect(cx - 5, by - 15, 10, 8, PAL.vest);
    bc.rect(cx - 2, by - 15, 4, 6, PAL.skin);
    bc.rect(cx - 7, by - 14, 2, 6, PAL.skin);
    bc.rect(cx + 5, by - 14, isAtk ? 5 : 2, isAtk ? 3 : 6, PAL.skin);
    if (isAtk) bc.rect(cx + 9, by - 14, 4, 2, PAL.steelHi);
    bc.rect(cx - 5, by - 24, 10, 9, PAL.skin);
    bc.rect(cx - 5, by - 25, 10, 3, PAL.bandana);
    bc.pset(cx - 6, by - 23, PAL.bandana);
    bc.rect(cx - 4, by - 18, 8, 3, '#3b2618');
    bc.pset(cx - 2, by - 20, PAL.outline);
    bc.pset(cx + 2, by - 20, PAL.outline);
    bc.outlineRegion(ox, 0, fw, fh, PAL.outline);
  }
  bc.save('characters/bandit_sheet.png');

  // Солдат
  const sc = new PixelCanvas(fw * 6, fh);
  for (let f = 0; f < 6; f++) {
    const ox = f * fw, isAtk = f >= 4, step = f % 4;
    const bob = step % 2 === 1 ? -1 : 0;
    const cx = ox + 16, by = 28 + bob;
    sc.ellipse(ox + 16, 29, 6, 2, '#00000058');
    sc.rect(cx - 4, by - 7 + (step === 1 ? -1 : 0), 3, 6, '#232833');
    sc.rect(cx + 1, by - 7 + (step === 3 ? -1 : 0), 3, 6, '#232833');
    sc.rect(cx - 5, by - 15, 10, 8, PAL.tactical);
    sc.rect(cx - 4, by - 14, 8, 5, PAL.tacticalHi);
    sc.rect(cx - 5, by - 24, 10, 9, '#1f242e');
    sc.rect(cx - 3, by - 20, 6, 2, '#94a3b8');
    sc.rect(cx - 2, by - 12, 11, 3, '#181b22');
    if (isAtk) sc.circle(cx + 10, by - 11, 2, PAL.fireYellow);
    sc.outlineRegion(ox, 0, fw, fh, PAL.outline);
  }
  sc.save('characters/soldier_sheet.png');

  // Монстр
  const mw = 36, mh = 32;
  const mc = new PixelCanvas(mw * 6, mh);
  for (let f = 0; f < 6; f++) {
    const ox = f * mw, isAtk = f >= 4, step = f % 4;
    const stretch = step === 1 ? 2 : step === 3 ? -1 : 0;
    const by = 27 - (isAtk ? 2 : 0);
    mc.ellipse(ox + 18, 29, 10, 2.5, '#00000058');
    mc.rect(ox + 9 - stretch, by - 6, 3, 6, '#5c4b3e');
    mc.rect(ox + 14 + stretch, by - 6, 3, 6, '#47392f');
    mc.rect(ox + 22 - stretch, by - 6, 3, 6, '#5c4b3e');
    mc.rect(ox + 26 + stretch, by - 6, 3, 6, '#47392f');
    mc.ellipse(ox + 18, by - 10, 10, 5.5, '#6e5a4b');
    mc.ellipse(ox + 23, by - 12, 6, 5, '#524136');
    mc.line(ox + 13, by - 15, ox + 11, by - 19, '#cbd5e1', 2);
    mc.line(ox + 18, by - 16, ox + 17, by - 20, '#cbd5e1', 2);
    mc.rect(ox + 25, by - 15, 7, 6, '#6e5a4b');
    mc.pset(ox + 29, by - 13, PAL.fireYellow);
    mc.pset(ox + 30, by - 9, '#ffffff');
    mc.outlineRegion(ox, 0, mw, mh, PAL.outline);
  }
  mc.save('characters/monster_sheet.png');

  // БОСС-Джаггернаут с каменной бронёй, шипами и трещинами магмы (64x64 × 6)
  const bw = 64, bh = 64;
  const boss = new PixelCanvas(bw * 6, bh);
  for (let f = 0; f < 6; f++) {
    const ox = f * bw, isAtk = f >= 4, step = f % 4;
    const bob = step % 2 === 1 ? -2 : 0;
    const cx = ox + 32, by = 58 + bob;
    boss.ellipse(cx, 59, 19, 5, '#00000075');

    const lOff = step === 1 ? -3 : 0;
    const rOff = step === 3 ? -3 : 0;
    boss.brickRect(cx - 13, by - 16 + lOff, 10, 15, '#2b2f3d', '#1b1e28', '#3d4357');
    boss.brickRect(cx + 3, by - 16 + rOff, 10, 15, '#2b2f3d', '#1b1e28', '#3d4357');

    // Бронированный торс с наплечниками и магмовыми прожилками
    boss.ellipse(cx, by - 29, 17, 15, '#262936');
    boss.brickRect(cx - 12, by - 39, 24, 18, '#353a4d', '#1e2230', '#4a5168');
    // Наплечники с шипами
    boss.circle(cx - 17, by - 37, 7, '#2b2f3d');
    boss.circle(cx + 17, by - 37, 7, '#2b2f3d');
    boss.line(cx - 20, by - 42, cx - 24, by - 48, '#ef4444', 2);
    boss.line(cx + 20, by - 42, cx + 24, by - 48, '#ef4444', 2);

    // Магмовые трещины
    boss.line(cx - 9, by - 37, cx - 2, by - 27, '#ef4444', 2);
    boss.line(cx + 9, by - 37, cx + 2, by - 27, '#ef4444', 2);
    boss.line(cx, by - 28, cx, by - 20, '#fb923c', 2);
    boss.pset(cx, by - 28, '#fef08a');

    // Кулаки
    const slamY = isAtk ? (f === 4 ? -12 : 4) : 0;
    boss.brickRect(cx - 25, by - 35 + slamY, 9, 18, '#2b2f3d', '#191c26', '#464d63');
    boss.brickRect(cx + 16, by - 35 + slamY, 9, 18, '#2b2f3d', '#191c26', '#464d63');
    boss.rect(cx - 25, by - 20 + slamY, 10, 6, '#b91c1c');
    boss.rect(cx + 15, by - 20 + slamY, 10, 6, '#b91c1c');

    // Голова и челюсть
    boss.circle(cx, by - 45, 9.5, '#262936');
    boss.rect(cx - 6, by - 47, 4, 2, '#ff3b3b');
    boss.rect(cx + 2, by - 47, 4, 2, '#ff3b3b');
    boss.pset(cx - 5, by - 47, '#fef08a');
    boss.pset(cx + 3, by - 47, '#fef08a');
    boss.rect(cx - 4, by - 41, 8, 2, '#7f1d1d');

    boss.outlineRegion(ox, 0, bw, bh, PAL.outline);
  }
  boss.save('characters/boss_sheet.png');
}

// 3. NPC (Торговец, Квестовый, Лекарь, Фермер)
function generateNpcs() {
  const specs = [
    { file: 'npc_trader.png', coat: '#6e472b', hat: '#4f321d', shirt: '#d6c3a5', pants: '#2b2520', style: 'hat' },
    { file: 'npc_quest.png',  coat: '#272d3d', hat: '#1d222e', shirt: '#38bdf8', pants: '#191d26', style: 'hood' },
    { file: 'npc_medic.png',  coat: '#e2e8f0', hat: '#f8fafc', shirt: '#2563eb', pants: '#1e3a8a', style: 'medic' },
    { file: 'npc_farmer.png', coat: '#3f7036', hat: '#d9a441', shirt: '#c84b31', pants: '#2f5229', style: 'straw' }
  ];
  for (const sp of specs) {
    const pc = new PixelCanvas(64, 32);
    for (let f = 0; f < 2; f++) {
      const ox = f * 32, bob = f === 1 ? -1 : 0;
      const cx = ox + 16, by = 28 + bob;
      pc.ellipse(ox + 16, 29, 6, 2, '#00000058');
      pc.rect(cx - 4, by - 6, 3, 5, sp.pants);
      pc.rect(cx + 1, by - 6, 3, 5, sp.pants);
      pc.rect(cx - 5, by - 15, 10, 9, sp.coat);
      pc.rect(cx - 2, by - 14, 4, 7, sp.shirt);
      pc.rect(cx - 7, by - 14, 2, 6, sp.coat);
      pc.rect(cx + 5, by - 14, 2, 6, sp.coat);
      pc.rect(cx - 4, by - 23, 8, 8, sp.style === 'hood' ? '#12151f' : PAL.skin);
      if (sp.style === 'hat' || sp.style === 'straw') {
        pc.rect(cx - 7, by - 24, 14, 2, sp.hat);
        pc.rect(cx - 5, by - 27, 10, 3, sp.hat);
      } else if (sp.style === 'hood') {
        pc.rect(cx - 6, by - 25, 12, 9, sp.hat);
        pc.rect(cx - 3, by - 22, 6, 5, '#0f131c');
        pc.pset(cx - 2, by - 20, '#38bdf8');
        pc.pset(cx + 1, by - 20, '#38bdf8');
      } else if (sp.style === 'medic') {
        pc.rect(cx - 5, by - 25, 10, 4, sp.hat);
        pc.pset(cx, by - 24, PAL.bloodHi);
      }
      if (sp.style !== 'hood') {
        pc.pset(cx - 2, by - 20, PAL.outline);
        pc.pset(cx + 2, by - 20, PAL.outline);
      }
      pc.outlineRegion(ox, 0, 32, 32, PAL.outline);
    }
    pc.save(`characters/${sp.file}`);
  }
}

// 4. ОРУЖИЕ (8 моделей)
function generateWeapons() {
  const mk = (fn) => { const p = new PixelCanvas(32, 24); fn(p); p.outlineAll(PAL.outline); return p; };
  mk((p) => {
    p.rect(8, 8, 15, 5, PAL.steelMid); p.rect(9, 8, 13, 2, PAL.steelHi);
    p.rect(9, 13, 5, 6, '#363b47'); p.rect(14, 13, 3, 2, PAL.steelDark);
  }).save('weapons/pistol.png');
  mk((p) => {
    p.rect(3, 12, 8, 5, PAL.wood); p.rect(11, 10, 17, 3, PAL.steelMid);
    p.rect(12, 10, 15, 1, PAL.steelHi); p.rect(13, 13, 9, 2, PAL.woodHi);
  }).save('weapons/shotgun.png');
  mk((p) => {
    p.rect(3, 11, 6, 5, '#2b303c'); p.rect(9, 9, 14, 5, '#3b4252');
    p.rect(10, 9, 12, 2, PAL.steelMid); p.rect(23, 10, 6, 2, PAL.steelHi);
    p.rect(14, 14, 4, 6, '#232730'); p.rect(10, 14, 3, 5, '#232730');
  }).save('weapons/rifle.png');
  mk((p) => {
    p.rect(2, 12, 7, 4, '#2d3748'); p.rect(9, 10, 12, 4, '#4a5568');
    p.rect(21, 11, 9, 2, PAL.steelHi); p.rect(11, 6, 9, 3, '#1e293b'); p.pset(19, 7, '#38bdf8');
  }).save('weapons/sniper.png');
  mk((p) => {
    p.line(7, 17, 12, 12, PAL.woodDark, 3);
    p.line(12, 12, 23, 4, PAL.steelHi, 3);
    p.line(13, 11, 24, 4, '#ffffff', 1);
  }).save('weapons/knife.png');
  mk((p) => {
    p.line(5, 19, 10, 14, PAL.wood, 3);
    p.line(8, 12, 12, 16, PAL.gold, 2);
    p.line(11, 13, 26, 3, '#cbd5e1', 3);
    p.line(12, 12, 26, 3, '#ffffff', 1);
  }).save('weapons/sword.png');
  mk((p) => {
    for (let a = -1.2; a <= 1.2; a += 0.08) {
      p.pset(12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9, PAL.woodHi);
      p.pset(11 + Math.cos(a) * 9, 12 + Math.sin(a) * 9, PAL.wood);
    }
    p.line(12 + Math.cos(-1.2) * 9, 12 + Math.sin(-1.2) * 9, 12 + Math.cos(1.2) * 9, 12 + Math.sin(1.2) * 9, '#e2e8f0', 1);
  }).save('weapons/bow.png');
  mk((p) => {
    p.line(5, 19, 21, 7, PAL.wood, 3);
    p.circle(23, 6, 4.5, PAL.blueMagic);
    p.circle(22, 5, 2, PAL.blueHi);
  }).save('weapons/magic_staff.png');
}

// 5. ПРЕДМЕТЫ (8 моделей)
function generateItems() {
  const mk = (fn) => { const p = new PixelCanvas(24, 24); fn(p); p.outlineAll(PAL.outline); return p; };
  mk((p) => {
    p.rect(8, 4, 8, 3, '#475569'); p.rect(4, 7, 16, 12, '#dc2626');
    p.rect(5, 8, 14, 3, '#ef4444'); p.rect(11, 9, 2, 8, '#ffffff'); p.rect(8, 12, 8, 2, '#ffffff');
  }).save('items/medkit.png');
  mk((p) => {
    for (let i = 0; i < 4; i++) {
      const x = 5 + i * 4;
      p.rect(x, 9, 3, 10, PAL.gold); p.rect(x, 9, 1, 10, '#fef08a'); p.rect(x, 6, 3, 3, '#ef4444');
    }
  }).save('items/ammo.png');
  mk((p) => {
    p.ellipse(12, 13, 5.5, 6.5, '#3f6212');
    p.line(8, 11, 16, 11, '#1a2e05', 1); p.line(8, 15, 16, 15, '#1a2e05', 1);
    p.rect(10, 5, 4, 3, '#94a3b8'); p.circle(15, 6, 2, '#cbd5e1');
  }).save('items/grenade.png');
  mk((p) => {
    p.ellipse(12, 13, 7.5, 5.5, '#b91c1c');
    p.ellipse(12, 12, 6, 4, '#f87171');
    p.circle(14, 12, 2, '#fef2f2');
  }).save('items/food.png');
  mk((p) => {
    p.rect(10, 4, 4, 3, PAL.woodHi); p.rect(9, 7, 6, 2, '#cbd5e1');
    p.circle(12, 14, 6, PAL.blueMagic); p.circle(10, 12, 2.2, PAL.blueHi);
  }).save('items/potion.png');
  mk((p) => {
    p.circle(8, 9, 4.5, '#cbd5e1'); p.circle(8, 9, 1.8, '#00000000');
    p.line(11, 11, 19, 18, '#e2e8f0', 2);
    p.line(16, 16, 14, 19, '#cbd5e1', 2); p.line(18, 18, 16, 20, '#cbd5e1', 2);
  }).save('items/key.png');
  mk((p) => {
    p.circle(12, 12, 6.5, PAL.goldDark); p.circle(12, 12, 5, PAL.gold); p.rect(11, 9, 2, 6, '#fef08a');
  }).save('items/coin.png');
  mk((p) => {
    p.rect(6, 6, 12, 14, '#7c4d2b'); p.rect(7, 7, 10, 5, '#9c6639');
    p.rect(7, 13, 10, 5, '#633b1f'); p.rect(9, 10, 2, 4, PAL.gold); p.rect(13, 10, 2, 4, PAL.gold);
  }).save('items/backpack.png');
}

// 6. ТРАНСПОРТ (6 моделей)
function generateVehicles() {
  const car = new PixelCanvas(64, 40);
  car.ellipse(32, 34, 25, 4.5, '#00000060');
  car.borderRect(8, 18, 48, 12, '#475569', '#1e293b');
  car.rect(9, 19, 46, 3, '#64748b');
  car.borderRect(16, 10, 30, 9, '#64748b', '#1e293b');
  car.windowPane(19, 12, 11, 6, '#93c5fd');
  car.windowPane(32, 12, 11, 6, '#93c5fd');
  car.circle(18, 30, 5, '#1e293b'); car.circle(18, 30, 2.2, '#94a3b8');
  car.circle(46, 30, 5, '#1e293b'); car.circle(46, 30, 2.2, '#94a3b8');
  car.rect(53, 20, 3, 3, '#fde047'); car.rect(8, 20, 2, 3, '#ef4444');
  car.outlineAll(PAL.outline);
  car.save('vehicles/car.png');

  const moto = new PixelCanvas(48, 36);
  moto.ellipse(24, 30, 17, 4, '#00000060');
  moto.circle(12, 25, 5.5, '#1e293b'); moto.circle(12, 25, 2.5, '#94a3b8');
  moto.circle(36, 25, 5.5, '#1e293b'); moto.circle(36, 25, 2.5, '#94a3b8');
  moto.line(12, 25, 24, 16, '#94a3b8', 3);
  moto.rect(18, 14, 13, 5, '#b91c1c');
  moto.line(31, 12, 36, 25, '#cbd5e1', 2);
  moto.outlineAll(PAL.outline);
  moto.save('vehicles/moto.png');

  const jeep = new PixelCanvas(68, 44);
  jeep.ellipse(34, 37, 27, 5, '#00000060');
  jeep.borderRect(8, 18, 52, 14, '#4d5d3b', '#26301b');
  jeep.borderRect(12, 8, 36, 11, '#5f7348', '#26301b');
  jeep.windowPane(15, 10, 13, 7, '#bae6fd');
  jeep.windowPane(31, 10, 13, 7, '#bae6fd');
  jeep.circle(19, 33, 6, '#1e293b'); jeep.circle(19, 33, 2.5, '#94a3b8');
  jeep.circle(49, 33, 6, '#1e293b'); jeep.circle(49, 33, 2.5, '#94a3b8');
  jeep.outlineAll(PAL.outline);
  jeep.save('vehicles/jeep.png');

  const bus = new PixelCanvas(88, 48);
  bus.ellipse(44, 41, 38, 5, '#00000060');
  bus.borderRect(6, 10, 76, 26, '#cbd5e1', '#334155');
  bus.rect(7, 25, 74, 4, '#2563eb');
  for (let wx = 12; wx <= 68; wx += 14) bus.windowPane(wx, 13, 10, 9, '#60a5fa');
  bus.circle(22, 37, 5.5, '#1e293b'); bus.circle(22, 37, 2.2, '#94a3b8');
  bus.circle(66, 37, 5.5, '#1e293b'); bus.circle(66, 37, 2.2, '#94a3b8');
  bus.outlineAll(PAL.outline);
  bus.save('vehicles/bus.png');

  const heli = new PixelCanvas(96, 52);
  heli.ellipse(50, 45, 30, 5, '#00000050');
  heli.rect(12, 24, 32, 5, '#374151');
  heli.ellipse(54, 26, 20, 11, '#4b5563');
  heli.ellipse(63, 24, 9, 7, '#93c5fd');
  heli.rect(8, 8, 80, 2, '#9ca3af');
  heli.rect(52, 10, 4, 6, '#6b7280');
  heli.rect(38, 39, 34, 2, '#1f2937');
  heli.outlineAll(PAL.outline);
  heli.save('vehicles/heli.png');

  const boat = new PixelCanvas(64, 36);
  boat.line(8, 22, 56, 22, '#f8fafc', 6);
  boat.line(12, 27, 50, 27, '#2563eb', 5);
  boat.windowPane(24, 13, 16, 7, '#93c5fd');
  boat.outlineAll(PAL.outline);
  boat.save('vehicles/boat.png');
}

// 7. ОКРУЖЕНИЕ С КАЧЕСТВЕННОЙ ТЕКСТУРОЙ ЛИСТВЫ, КОРЫ И КАМНЯ
function generateProps() {
  const barrel = new PixelCanvas(28, 34);
  barrel.ellipse(14, 29, 9, 3.5, '#00000060');
  barrel.rect(6, 7, 16, 21, PAL.wood);
  barrel.rect(8, 7, 4, 21, PAL.woodHi);
  barrel.line(11, 7, 11, 27, PAL.woodDark, 1);
  barrel.line(16, 7, 16, 27, PAL.woodDark, 1);
  barrel.rect(5, 11, 18, 2, PAL.steelDark);
  barrel.rect(5, 22, 18, 2, PAL.steelDark);
  barrel.outlineAll(PAL.outline);
  barrel.save('props/barrel.png');

  const redBarrel = new PixelCanvas(28, 34);
  redBarrel.ellipse(14, 29, 9, 3.5, '#00000060');
  redBarrel.rect(6, 7, 16, 21, '#b91c1c');
  redBarrel.rect(8, 7, 4, 21, '#ef4444');
  redBarrel.rect(6, 15, 16, 4, '#fbbf24');
  redBarrel.rect(5, 10, 18, 2, '#450a0a');
  redBarrel.rect(5, 23, 18, 2, '#450a0a');
  redBarrel.outlineAll(PAL.outline);
  redBarrel.save('props/barrel_red.png');

  const crates = new PixelCanvas(36, 34);
  crates.ellipse(18, 29, 14, 4, '#00000060');
  crates.borderRect(4, 7, 18, 20, PAL.wood, PAL.woodDark);
  crates.rect(6, 9, 14, 16, PAL.woodHi);
  crates.line(6, 9, 19, 24, PAL.woodDark, 2);
  crates.borderRect(18, 13, 14, 15, PAL.wood, PAL.woodDark);
  crates.line(20, 15, 30, 26, PAL.woodDark, 2);
  crates.outlineAll(PAL.outline);
  crates.save('props/crates.png');

  const camp = new PixelCanvas(36 * 4, 36);
  for (let f = 0; f < 4; f++) {
    const ox = f * 36;
    camp.ellipse(ox + 18, 30, 12, 4, '#00000060');
    camp.line(ox + 9, 29, ox + 27, 24, PAL.woodDark, 3);
    camp.line(ox + 9, 24, ox + 27, 29, PAL.wood, 3);
    for (const sx of [9, 14, 21, 26]) camp.circle(ox + sx, 30, 2.3, PAL.stoneMid);
    const hShift = (f % 2) * 2;
    camp.ellipse(ox + 18, 19 - hShift * 0.5, 6, 8 + hShift, PAL.bloodHi);
    camp.ellipse(ox + 18 + (f === 1 ? -1 : 1), 20, 4.5, 6, PAL.fireOrange);
    camp.ellipse(ox + 18, 22, 2.8, 4, PAL.fireYellow);
    camp.outlineRegion(ox, 0, 36, 36, PAL.outline);
  }
  camp.save('props/campfire_sheet.png');

  // Пышное детализированное дерево с ветвями и дизерингом листвы
  const tree = new PixelCanvas(64, 76);
  tree.ellipse(32, 68, 18, 5.5, '#00000058');
  tree.rect(27, 42, 10, 26, PAL.woodDark);
  tree.rect(28, 42, 4, 26, PAL.wood);
  tree.line(30, 46, 30, 66, PAL.woodHi, 1);
  tree.line(27, 46, 21, 38, PAL.woodDark, 3);
  tree.line(36, 46, 42, 38, PAL.woodDark, 3);
  tree.leafCluster(21, 34, 12, PAL.leafDark, PAL.leafMid, PAL.leafHi);
  tree.leafCluster(43, 34, 12, PAL.leafDark, PAL.leafMid, PAL.leafHi);
  tree.leafCluster(32, 26, 17, PAL.leafDark, PAL.leafMid, PAL.leafHi);
  tree.leafCluster(29, 19, 11, PAL.leafMid, PAL.leafHi, '#86efac');
  tree.outlineAll(PAL.outline);
  tree.save('props/tree.png');

  const pine = new PixelCanvas(60, 76);
  pine.ellipse(30, 68, 16, 5.5, '#00000058');
  pine.rect(26, 50, 8, 18, PAL.woodDark);
  for (const [ty, rad] of [[48, 21], [35, 17], [21, 12]]) {
    for (let dy = 0; dy < 16; dy++) {
      const hw = Math.round((dy / 16) * rad);
      for (let dx = -hw; dx <= hw; dx++) {
        const col = dy < 4 ? '#f1f5f9' : (dx < 0 ? '#2f6142' : '#1e422b');
        pine.pset(30 + dx, ty - 12 + dy, col);
      }
    }
  }
  pine.outlineAll(PAL.outline);
  pine.save('props/pine_tree.png');

  // Гранёный камень
  const rock = new PixelCanvas(40, 36);
  rock.ellipse(20, 29, 15, 4.5, '#00000058');
  rock.ellipse(20, 21, 13, 9, PAL.stoneDark);
  rock.ellipse(18, 18, 10, 7, PAL.stoneMid);
  rock.line(12, 16, 22, 13, PAL.stoneHi, 3);
  rock.line(21, 18, 27, 24, '#333a48', 2);
  rock.outlineAll(PAL.outline);
  rock.save('props/rock.png');

  const bush = new PixelCanvas(36, 32);
  bush.ellipse(18, 26, 13, 4, '#00000050');
  bush.leafCluster(12, 19, 8, PAL.leafDark, PAL.leafMid, PAL.leafHi);
  bush.leafCluster(24, 19, 8, PAL.leafDark, PAL.leafMid, PAL.leafHi);
  bush.leafCluster(18, 15, 9, PAL.leafDark, PAL.leafMid, PAL.leafHi);
  bush.pset(13, 17, '#ef4444'); bush.pset(22, 18, '#ef4444'); bush.pset(18, 13, '#ef4444');
  bush.outlineAll(PAL.outline);
  bush.save('props/bush.png');

  const tent = new PixelCanvas(64, 52);
  tent.ellipse(32, 44, 26, 5.5, '#00000058');
  for (let y = 10; y <= 42; y++) {
    const hw = Math.round(((y - 10) / 32) * 24);
    tent.rect(32 - hw, y, hw, 1, y % 5 === 0 ? '#697a52' : '#586943');
    tent.rect(32, y, hw, 1, '#3f4d2e');
  }
  for (let y = 24; y <= 42; y++) {
    const hw = Math.round(((y - 24) / 18) * 9);
    tent.rect(32 - hw, y, hw * 2, 1, '#171c13');
  }
  tent.outlineAll(PAL.outline);
  tent.save('props/tent.png');

  const fence = new PixelCanvas(48, 32);
  fence.rect(4, 12, 40, 3, PAL.woodDark);
  fence.rect(4, 21, 40, 3, PAL.woodDark);
  for (let x = 6; x <= 38; x += 8) {
    fence.rect(x, 6, 5, 22, PAL.wood);
    fence.rect(x + 1, 6, 2, 22, PAL.woodHi);
  }
  fence.outlineAll(PAL.outline);
  fence.save('props/fence.png');
}

// 8. ВСЕ 9 ЗДАНИЙ С КИРПИЧНОЙ ТЕКСТУРОЙ, РАМАМИ ОКОН И ПИКСЕЛЬНЫМИ ВЫВЕСКАМИ SHOP / ПОЛИЦИЯ
function generateBuildings() {
  // 1) Дом (112x96)
  const house = new PixelCanvas(112, 96);
  house.brickRect(14, 42, 84, 46, '#c2936b', '#9c6e49', '#d4a881');
  house.brickRect(14, 80, 84, 8, '#57534e', '#3a3733', '#78716c');
  house.rect(14, 42, 84, 3, '#78472a');
  house.rect(72, 10, 11, 20, '#7c2d12');
  for (let y = 12; y <= 43; y++) {
    const pad = Math.round(((43 - y) / 31) * 44);
    house.rect(8 + pad, y, 96 - pad * 2, 1, y % 3 === 0 ? '#69361e' : '#8c4a2b');
  }
  house.borderRect(47, 58, 18, 30, '#5c341d', '#291509');
  house.pset(61, 73, PAL.gold);
  house.windowPane(22, 53, 18, 16, '#7dd3fc');
  house.windowPane(72, 53, 18, 16, '#7dd3fc');
  house.outlineAll(PAL.outline);
  house.save('buildings/house.png');

  // 2) Магазин с чёткой вывеской SHOP и полосатым тентом (116x96)
  const shop = new PixelCanvas(116, 96);
  shop.brickRect(14, 28, 88, 60, '#a3704c', '#7c5134', '#ba8560');
  shop.borderRect(10, 22, 96, 8, '#475569', '#1e293b');
  // Вывеска SHOP
  shop.borderRect(33, 31, 50, 13, '#991b1b', '#450a0a');
  shop.drawText('SHOP', 49, 35, '#ffffff', 1);
  // Красно-белый маркиз-козырёк
  for (let x = 14; x < 102; x += 8) {
    shop.rect(x, 46, 4, 10, '#dc2626');
    shop.rect(x + 4, 46, 4, 10, '#f8fafc');
    shop.rect(x, 54, 4, 2, '#991b1b');
    shop.rect(x + 4, 54, 4, 2, '#cbd5e1');
  }
  shop.windowPane(20, 60, 24, 18, '#93c5fd');
  shop.windowPane(72, 60, 24, 18, '#93c5fd');
  shop.borderRect(49, 58, 18, 30, '#334155', '#0f172a');
  shop.pset(63, 73, PAL.gold);
  shop.outlineAll(PAL.outline);
  shop.save('buildings/shop.png');

  // 3) Склад (120x88)
  const wh = new PixelCanvas(120, 88);
  wh.brickRect(12, 26, 96, 54, '#64748b', '#475569', '#7b8ba1');
  wh.borderRect(10, 20, 100, 8, '#94a3b8', '#334155');
  wh.borderRect(32, 40, 56, 40, '#334155', '#0f172a');
  for (let y = 44; y < 78; y += 4) wh.rect(34, y, 52, 2, '#475569');
  wh.outlineAll(PAL.outline);
  wh.save('buildings/warehouse.png');

  // 4) Бункер (120x92)
  const bunker = new PixelCanvas(120, 92);
  bunker.brickRect(10, 30, 100, 54, '#57534e', '#3f3c38', '#78716c');
  bunker.brickRect(22, 18, 76, 14, '#78716c', '#57534e', '#8c857f');
  bunker.borderRect(40, 46, 40, 38, '#1e293b', '#090d16');
  bunker.circle(60, 65, 7, '#eab308');
  bunker.circle(60, 65, 3, '#713f12');
  for (let sy = 48; sy < 82; sy += 6) {
    bunker.rect(36, sy, 4, 3, '#facc15');
    bunker.rect(80, sy, 4, 3, '#facc15');
  }
  bunker.outlineAll(PAL.outline);
  bunker.save('buildings/bunker.png');

  // 5) Вышка (68x112)
  const tower = new PixelCanvas(68, 112);
  tower.line(18, 102, 24, 38, PAL.woodDark, 4);
  tower.line(50, 102, 44, 38, PAL.woodDark, 4);
  tower.line(20, 86, 48, 62, PAL.wood, 2);
  tower.line(48, 86, 20, 62, PAL.wood, 2);
  tower.borderRect(14, 24, 40, 16, PAL.wood, PAL.woodDark);
  for (let y = 10; y <= 18; y++) {
    const pad = Math.round(((18 - y) / 8) * 18);
    tower.rect(8 + pad, y, 52 - pad * 2, 1, PAL.woodDark);
  }
  tower.outlineAll(PAL.outline);
  tower.save('buildings/watchtower.png');

  // 6) Завод (148x112)
  const fac = new PixelCanvas(148, 112);
  fac.borderRect(26, 10, 15, 44, '#cbd5e1', '#475569');
  fac.rect(27, 15, 13, 7, '#dc2626');
  fac.borderRect(52, 16, 13, 38, '#cbd5e1', '#475569');
  fac.rect(53, 21, 11, 6, '#dc2626');
  fac.brickRect(12, 50, 124, 54, '#52525b', '#3f3f46', '#71717a');
  fac.borderRect(10, 44, 128, 7, '#71717a', '#27272a');
  for (let wx = 20; wx <= 116; wx += 22) fac.windowPane(wx, 60, 15, 13, '#fde047');
  fac.borderRect(62, 78, 24, 26, '#27272a', '#09090b');
  fac.outlineAll(PAL.outline);
  fac.save('buildings/factory.png');

  // 7) Больница с красным крестом (136x104)
  const hosp = new PixelCanvas(136, 104);
  hosp.brickRect(14, 30, 108, 66, '#e2e8f0', '#cbd5e1', '#f8fafc');
  hosp.borderRect(42, 14, 52, 18, '#f8fafc', '#64748b');
  hosp.rect(65, 17, 6, 12, '#dc2626');
  hosp.rect(62, 20, 12, 6, '#dc2626');
  for (let wx = 22; wx <= 102; wx += 20) {
    hosp.windowPane(wx, 40, 13, 11, '#60a5fa');
    hosp.windowPane(wx, 56, 13, 11, '#60a5fa');
  }
  hosp.borderRect(57, 72, 22, 24, '#2563eb', '#1e3a8a');
  hosp.outlineAll(PAL.outline);
  hosp.save('buildings/hospital.png');

  // 8) Полиция с читаемой вывеской ПОЛИЦИЯ (136x100)
  const pol = new PixelCanvas(136, 100);
  pol.brickRect(14, 34, 108, 58, '#cbd5e1', '#94a3b8', '#e2e8f0');
  pol.borderRect(10, 20, 116, 15, '#1d4ed8', '#1e3a8a');
  pol.borderRect(44, 23, 48, 9, '#eff6ff', '#1e3a8a');
  pol.drawText('ПОЛИЦИЯ', 51, 25, '#1e3a8a', 1);
  for (let wx = 20; wx <= 104; wx += 26) pol.windowPane(wx, 46, 15, 14, '#38bdf8');
  pol.borderRect(57, 66, 22, 26, '#1e3a8a', '#0f172a');
  pol.outlineAll(PAL.outline);
  pol.save('buildings/police.png');

  // 9) Военная База (156x108)
  const base = new PixelCanvas(156, 108);
  base.brickRect(12, 44, 132, 56, '#4b5563', '#374151', '#6b7280');
  base.brickRect(86, 22, 44, 24, '#6b7280', '#4b5563', '#9ca3af');
  base.line(108, 6, 108, 22, '#cbd5e1', 2);
  base.rect(110, 6, 12, 7, '#ef4444');
  for (let bx = 14; bx <= 134; bx += 16) base.borderRect(bx, 38, 10, 7, '#6b7280', '#1f2937');
  base.borderRect(56, 64, 38, 36, '#1f2937', '#090d16');
  base.outlineAll(PAL.outline);
  base.save('buildings/base.png');
}

// 9. АНИМИРОВАННЫЕ СПРАЙТ-ЛИСТЫ ЭФФЕКТОВ
function generateEffects() {
  const exp = new PixelCanvas(48 * 6, 48);
  for (let f = 0; f < 6; f++) {
    const ox = f * 48 + 24, oy = 24;
    const r = [6, 13, 18, 20, 17, 12][f];
    if (f >= 2) exp.circle(ox, oy, r + 2, '#374151');
    if (f < 5) exp.circle(ox, oy, r, '#dc2626');
    if (f < 4) exp.circle(ox, oy, r * 0.72, PAL.fireOrange);
    if (f < 3) exp.circle(ox, oy, r * 0.42, PAL.fireYellow);
    exp.outlineRegion(f * 48, 0, 48, 48, PAL.outline);
  }
  exp.save('effects/explosion_sheet.png');

  const muz = new PixelCanvas(32 * 4, 16);
  for (let f = 0; f < 4; f++) {
    const ox = f * 32;
    muz.circle(ox + 7, 8, 5 - f, PAL.fireOrange);
    muz.circle(ox + 7, 8, Math.max(1, 3 - f), '#ffffff');
    muz.line(ox + 8, 8, ox + 28 - f * 3, 8, PAL.fireYellow, 2);
  }
  muz.save('effects/muzzle_sheet.png');

  const mag = new PixelCanvas(36 * 5, 36);
  for (let f = 0; f < 5; f++) {
    const ox = f * 36 + 18, oy = 18;
    const r = 5 + f * 2.5;
    mag.circle(ox, oy, r, PAL.blueMagic);
    mag.circle(ox, oy, r * 0.58, PAL.blueHi);
    mag.circle(ox, oy, r * 0.28, '#ffffff');
  }
  mag.save('effects/magic_sheet.png');

  const hit = new PixelCanvas(32 * 5, 32);
  for (let f = 0; f < 5; f++) {
    const ox = f * 32 + 16, oy = 16;
    const dist = 2 + f * 2.5;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      hit.line(ox, oy, ox + Math.cos(a) * dist * 1.4, oy + Math.sin(a) * dist * 1.4, PAL.bloodHi, 2);
    }
  }
  hit.save('effects/hit_sheet.png');

  const smk = new PixelCanvas(32 * 5, 32);
  for (let f = 0; f < 5; f++) {
    const ox = f * 32 + 16, oy = 22 - f * 3;
    smk.circle(ox, oy, 4 + f * 1.4, f < 3 ? '#9ca3af' : '#6b7280');
  }
  smk.save('effects/smoke_sheet.png');

  const wat = new PixelCanvas(32 * 5, 32);
  for (let f = 0; f < 5; f++) {
    const ox = f * 32 + 16, oy = 24;
    wat.ellipse(ox, oy, 5 + f * 2, 2.5, '#38bdf8');
    wat.line(ox - f * 2, oy, ox - f * 3, oy - 8 + f, '#bae6fd', 2);
    wat.line(ox + f * 2, oy, ox + f * 3, oy - 9 + f, '#bae6fd', 2);
  }
  wat.save('effects/water_sheet.png');
}

// 10. ТАЙЛЫ ЛАНДШАФТА 32x32
function generateTiles() {
  const makeTile = (base, alt1, alt2, name) => {
    const t = new PixelCanvas(32, 32);
    t.rect(0, 0, 32, 32, base);
    for (let i = 0; i < 36; i++) {
      const x = (i * 19 + 5) % 30;
      const y = (i * 11 + 3) % 30;
      t.rect(x, y, 2, 1, i % 2 === 0 ? alt1 : alt2);
    }
    t.save(`tiles/${name}`);
  };
  makeTile('#3a6636', '#2e542b', '#4d8246', 'grass.png');
  makeTile('#333945', '#2a2f3a', '#434b59', 'asphalt.png');
  makeTile('#cfa26b', '#b88b54', '#dfcba4', 'sand.png');
  makeTile('#dce6f2', '#b8cae0', '#ffffff', 'snow.png');
  makeTile('#1d5f8a', '#164b6e', '#38bdf8', 'water.png');
}

// 11. РАСШИРЕНИЕ VEXMORA: 12 новых типов врагов, 10 уникальных боссов, 16 новых видов оружия, пленники, специалисты базы и клетки
function generateVexmoraExpansion() {
  // Вспомогательный генератор 6-кадрового гуманоидного/спец-врага (32x32 × 6)
  const makeHumanoidEnemy = (file, cfg) => {
    const fw = cfg.size || 32, fh = cfg.size || 32;
    const pc = new PixelCanvas(fw * 6, fh);
    const mid = Math.floor(fw / 2);
    for (let f = 0; f < 6; f++) {
      const ox = f * fw, step = f % 4, isAtk = f >= 4;
      const bob = step % 2 === 1 ? -1 : 0;
      const cx = ox + mid, by = fh - 4 + bob;
      pc.ellipse(ox + mid, fh - 3, cfg.size === 40 ? 9 : 6, 2, '#00000055');
      const lOff = step === 1 ? -2 : 0, rOff = step === 3 ? -2 : 0;
      pc.rect(cx - 5, by - 7 + lOff, 4, 6, cfg.pants);
      pc.rect(cx + 1, by - 7 + rOff, 4, 6, cfg.pants);
      pc.rect(cx - 6, by - 17, 12, 10, cfg.torso);
      if (cfg.vest) pc.rect(cx - 5, by - 16, 10, 7, cfg.vest);
      if (cfg.tank) pc.rect(cx - 8, by - 17, 3, 9, cfg.tank);
      // Руки / щит / оружие
      const armX = isAtk ? 4 : 1;
      pc.rect(cx - 8, by - 16, 3, 7, cfg.torso);
      pc.rect(cx + 5, by - 16, 3 + armX, 4, cfg.gun || cfg.torso);
      if (cfg.shield) {
        pc.rect(cx + 5, by - 20, 5, 16, '#334155');
        pc.rect(cx + 6, by - 18, 3, 4, '#38bdf8');
      }
      // Голова и шлем/визор
      pc.circle(cx, by - 21, 5, cfg.skin || '#eac096');
      if (cfg.helmet) pc.rect(cx - 6, by - 27, 12, 5, cfg.helmet);
      if (cfg.visor) pc.rect(cx - 4, by - 22, 8, 2, cfg.visor);
      else {
        pc.pset(cx - 2, by - 22, cfg.eye || '#ef4444');
        pc.pset(cx + 2, by - 22, cfg.eye || '#ef4444');
      }
      if (cfg.badge) pc.pset(cx, by - 13, cfg.badge);
      pc.outlineRegion(ox, 0, fw, fh, PAL.outline);
    }
    pc.save(`characters/${file}`);
  };

  makeHumanoidEnemy('runner_sheet.png',        { torso: '#7f1d1d', pants: '#312e81', skin: '#84a96b', eye: '#fef08a' });
  makeHumanoidEnemy('gunner_sheet.png',        { torso: '#475569', vest: '#991b1b', pants: '#1e293b', gun: '#111827', helmet: '#1f2937' });
  makeHumanoidEnemy('sniper_enemy_sheet.png',  { torso: '#365314', vest: '#4d7c0f', pants: '#1a2e05', helmet: '#3f6212', visor: '#4ade80', gun: '#1f2937' });
  makeHumanoidEnemy('heavy_armor_sheet.png',   { torso: '#334155', vest: '#64748b', pants: '#1e293b', helmet: '#475569', visor: '#f97316', shield: true });
  makeHumanoidEnemy('grenadier_sheet.png',     { torso: '#7c2d12', vest: '#ea580c', pants: '#292524', helmet: '#431407', badge: '#fde047', gun: '#f97316' });
  makeHumanoidEnemy('pyro_sheet.png',          { torso: '#eab308', vest: '#ca8a04', pants: '#422006', helmet: '#dc2626', visor: '#38bdf8', tank: '#ef4444', gun: '#ef4444' });
  makeHumanoidEnemy('stealth_hunter_sheet.png',{ torso: '#1e1b4b', vest: '#312e81', pants: '#0f172a', helmet: '#0f172a', visor: '#22d3ee', gun: '#38bdf8' });
  makeHumanoidEnemy('medic_enemy_sheet.png',   { torso: '#e2e8f0', vest: '#dc2626', pants: '#334155', helmet: '#f8fafc', visor: '#ef4444', badge: '#ffffff' });
  makeHumanoidEnemy('miniboss_warden_sheet.png',   { size: 40, torso: '#1e293b', vest: '#b45309', pants: '#0f172a', helmet: '#fbbf24', visor: '#ef4444', gun: '#38bdf8' });
  makeHumanoidEnemy('miniboss_punisher_sheet.png', { size: 40, torso: '#3b0764', vest: '#7e22ce', pants: '#1e1b4b', helmet: '#581c87', visor: '#f43f5e', gun: '#94a3b8' });

  // Кислотный Мутант (spitter_sheet.png)
  const sp = new PixelCanvas(36 * 6, 32);
  for (let f = 0; f < 6; f++) {
    const ox = f * 36, step = f % 4, isAtk = f >= 4;
    const by = 27 - (step % 2);
    sp.ellipse(ox + 18, 29, 9, 2.5, '#00000055');
    sp.ellipse(ox + 16, by - 9, 9, 6, '#3f6212');
    sp.circle(ox + 13, by - 13, 4.5, '#84cc16'); // кислотный мешок
    sp.circle(ox + 19, by - 14, 3.5, '#a3e635');
    sp.rect(ox + 22, by - 12, isAtk ? 8 : 5, 5, '#4d7c0f');
    sp.pset(ox + 25, by - 11, '#fef08a');
    sp.rect(ox + 10, by - 4, 3, 4, '#365314');
    sp.rect(ox + 20, by - 4, 3, 4, '#365314');
    sp.outlineRegion(ox, 0, 36, 32, PAL.outline);
  }
  sp.save('characters/spitter_sheet.png');

  // Боевой Дрон-Скаут (drone_sheet.png)
  const dr = new PixelCanvas(32 * 6, 32);
  for (let f = 0; f < 6; f++) {
    const ox = f * 32, hover = (f % 2 === 0) ? 0 : -2;
    const cx = ox + 16, cy = 15 + hover;
    dr.ellipse(ox + 16, 28, 6, 2, '#00000045');
    dr.line(cx - 10, cy - 4, cx + 10, cy - 4, '#64748b', 2);
    dr.rect(cx - 12 + (f % 2) * 2, cy - 6, 6, 2, '#38bdf8');
    dr.rect(cx + 6 - (f % 2) * 2, cy - 6, 6, 2, '#38bdf8');
    dr.ellipse(cx, cy, 6, 4.5, '#334155');
    dr.circle(cx, cy, 2.5, f >= 4 ? '#facc15' : '#ef4444');
    dr.outlineRegion(ox, 0, 32, 32, PAL.outline);
  }
  dr.save('characters/drone_sheet.png');

  // 10 УНИКАЛЬНЫХ БОССОВ VEXMORA (64x64 × 6 кадров каждый!)
  const bossSpecs = [
    { file: 'boss_destroyer.png',       body: '#b45309', plate: '#f59e0b', core: '#ef4444', eye: '#fef08a', style: 'mech_saw' },
    { file: 'boss_mutant_king.png',     body: '#365314', plate: '#65a30d', core: '#a3e635', eye: '#ef4444', style: 'crown_mutant' },
    { file: 'boss_commander.png',       body: '#7f1d1d', plate: '#dc2626', core: '#fbbf24', eye: '#fef08a', style: 'shield_cmd' },
    { file: 'boss_sniper.png',          body: '#1e293b', plate: '#3f6212', core: '#4ade80', eye: '#22c55e', style: 'stalker' },
    { file: 'boss_giant_beast.png',     body: '#5c3a21', plate: '#9a3412', core: '#fb923c', eye: '#fde047', style: 'quad_beast' },
    { file: 'boss_mad_scientist.png',   body: '#cbd5e1', plate: '#7e22ce', core: '#22c55e', eye: '#38bdf8', style: 'chemist' },
    { file: 'boss_shadow_assassin.png', body: '#0f172a', plate: '#4c1d95', core: '#c084fc', eye: '#e879f9', style: 'assassin' },
    { file: 'boss_war_robot.png',       body: '#1d4ed8', plate: '#60a5fa', core: '#38bdf8', eye: '#facc15', style: 'war_mech' },
    { file: 'boss_general.png',         body: '#18181b', plate: '#ca8a04', core: '#ef4444', eye: '#ff3b3b', style: 'general' },
    { file: 'boss_vexmora.png',         body: '#1e1b4b', plate: '#be123c', core: '#22d3ee', eye: '#ffffff', style: 'archon' }
  ];

  for (const bs of bossSpecs) {
    const bw = 64, bh = 64;
    const bc = new PixelCanvas(bw * 6, bh);
    for (let f = 0; f < 6; f++) {
      const ox = f * bw, step = f % 4, isAtk = f >= 4;
      const bob = step % 2 === 1 ? -2 : 0;
      const cx = ox + 32, by = 58 + bob;
      bc.ellipse(ox + 32, 59, 19, 5, '#00000072');

      if (bs.style === 'quad_beast') {
        // Четвероногий Гигантский Зверь с рогами и огненной гривой
        const st = step === 1 ? 3 : step === 3 ? -3 : 0;
        bc.rect(cx - 18 + st, by - 14, 7, 14, bs.body);
        bc.rect(cx - 7 - st, by - 14, 7, 14, bs.body);
        bc.rect(cx + 5 + st, by - 14, 7, 14, bs.body);
        bc.rect(cx + 14 - st, by - 14, 7, 14, bs.body);
        bc.ellipse(cx, by - 24, 21, 12, bs.body);
        bc.ellipse(cx + 12, by - 30, 12, 10, bs.plate);
        bc.line(cx + 16, by - 38, cx + 25, by - 49, '#fef3c7', 3);
        bc.line(cx + 8, by - 39, cx + 14, by - 50, '#fef3c7', 3);
        bc.circle(cx + 17, by - 31, 2.5, bs.eye);
        bc.rect(cx + 15, by - 22, 9, 3, '#ffffff');
      } else {
        // Ноги / гусеницы
        const lOff = step === 1 ? -3 : 0, rOff = step === 3 ? -3 : 0;
        if (bs.style === 'mech_saw') {
          bc.brickRect(cx - 18, by - 14, 14, 13, '#374151', '#111827', '#6b7280');
          bc.brickRect(cx + 4, by - 14, 14, 13, '#374151', '#111827', '#6b7280');
        } else {
          bc.brickRect(cx - 13, by - 16 + lOff, 10, 15, bs.body, '#111827', bs.plate);
          bc.brickRect(cx + 3, by - 16 + rOff, 10, 15, bs.body, '#111827', bs.plate);
        }

        // Крылья/ореол финального босса VEXMORA
        if (bs.style === 'archon') {
          bc.line(cx - 8, by - 36, cx - 27, by - 52 + (f % 2) * 3, bs.core, 4);
          bc.line(cx + 8, by - 36, cx + 27, by - 52 + (f % 2) * 3, bs.core, 4);
          bc.line(cx - 8, by - 28, cx - 25, by - 34, bs.plate, 3);
          bc.line(cx + 8, by - 28, cx + 25, by - 34, bs.plate, 3);
        }

        // Мощный бронированный корпус
        bc.ellipse(cx, by - 29, 16, 14, bs.body);
        bc.brickRect(cx - 12, by - 39, 24, 18, bs.plate, bs.body, '#ffffff44');
        bc.circle(cx, by - 30, 5, bs.core);
        bc.circle(cx, by - 30, 2, '#ffffff');

        // Наплечники и спецдетали каждого босса
        bc.circle(cx - 17, by - 37, 7, bs.body);
        bc.circle(cx + 17, by - 37, 7, bs.body);

        if (bs.style === 'crown_mutant') {
          bc.line(cx - 8, by - 53, cx - 10, by - 60, '#facc15', 2);
          bc.line(cx, by - 54, cx, by - 62, '#facc15', 2);
          bc.line(cx + 8, by - 53, cx + 10, by - 60, '#facc15', 2);
        } else if (bs.style === 'war_mech') {
          bc.rect(cx - 22, by - 50, 9, 10, '#334155');
          bc.rect(cx + 13, by - 50, 9, 10, '#334155');
          bc.circle(cx - 18, by - 46, 2, '#ef4444');
          bc.circle(cx + 17, by - 46, 2, '#ef4444');
        } else if (bs.style === 'chemist') {
          bc.rect(cx - 19, by - 49, 7, 12, '#22c55e');
          bc.rect(cx + 12, by - 49, 7, 12, '#a855f7');
        } else if (bs.style === 'general') {
          bc.rect(cx - 11, by - 56, 22, 5, '#18181b');
          bc.rect(cx - 8, by - 52, 16, 3, '#facc15');
        }

        // Руки и уникальное вооружение
        const slamY = isAtk ? -8 : 0;
        bc.rect(cx - 25, by - 35 + slamY, 8, 17, bs.body);
        bc.rect(cx + 17, by - 35 + slamY, 8, 17, bs.body);

        if (bs.style === 'mech_saw') {
          bc.circle(cx + 22, by - 18 + slamY, 7, '#cbd5e1');
          bc.circle(cx + 22, by - 18 + slamY, 3, '#ef4444');
        } else if (bs.style === 'shield_cmd') {
          bc.brickRect(cx - 28, by - 38, 11, 24, '#334155', '#0f172a', '#fbbf24');
        } else if (bs.style === 'stalker') {
          bc.rect(cx + 10, by - 28, 20, 4, '#111827');
          bc.pset(cx + 29, by - 27, '#ef4444');
        } else if (bs.style === 'assassin') {
          bc.line(cx - 24, by - 22, cx - 30, by - 42, '#c084fc', 3);
          bc.line(cx + 24, by - 22, cx + 30, by - 42, '#c084fc', 3);
        }

        // Голова и глаза
        bc.circle(cx, by - 45, 9, bs.body);
        bc.rect(cx - 6, by - 47, 4, 2, bs.eye);
        bc.rect(cx + 2, by - 47, 4, 2, bs.eye);
      }
      bc.outlineRegion(ox, 0, bw, bh, PAL.outline);
    }
    bc.save(`bosses/${bs.file}`);
  }

  // 16 НОВЫХ ВИДОВ ОРУЖИЯ (итого 24 уникальных пиксель-арт оружия!)
  const extraWeapons = [
    ['revolver.png',         '#cbd5e1', '#78350f', 'pistol'],
    ['autopistol.png',       '#38bdf8', '#1e293b', 'pistol'],
    ['smg_compact.png',      '#64748b', '#0f172a', 'smg'],
    ['smg_storm.png',        '#f59e0b', '#1e293b', 'smg'],
    ['smg_plasma.png',       '#c084fc', '#312e81', 'smg'],
    ['auto_shotgun.png',     '#dc2626', '#1f2937', 'shotgun'],
    ['burst_rifle.png',      '#4ade80', '#1e293b', 'rifle'],
    ['laser_rifle.png',      '#22d3ee', '#0f172a', 'rifle'],
    ['railgun.png',          '#38bdf8', '#fbbf24', 'sniper'],
    ['lmg.png',              '#475569', '#854d0e', 'heavy'],
    ['minigun.png',          '#94a3b8', '#dc2626', 'minigun'],
    ['katana.png',           '#e879f9', '#1e1b4b', 'blade'],
    ['crossbow.png',         '#a16207', '#cbd5e1', 'crossbow'],
    ['grenade_launcher.png', '#f97316', '#374151', 'launcher'],
    ['rocket_launcher.png',  '#65a30d', '#dc2626', 'launcher'],
    ['tesla_cannon.png',     '#38bdf8', '#facc15', 'launcher']
  ];

  for (const [file, colA, colB, type] of extraWeapons) {
    const wc = new PixelCanvas(32, 16);
    if (type === 'pistol') {
      wc.rect(6, 4, 15, 5, colA);
      wc.rect(7, 9, 5, 5, colB);
      wc.rect(12, 6, 5, 3, colB);
    } else if (type === 'smg') {
      wc.rect(4, 5, 19, 5, colA);
      wc.rect(8, 10, 4, 5, colB);
      wc.rect(15, 10, 3, 5, colA);
      wc.rect(23, 6, 4, 2, '#111827');
    } else if (type === 'shotgun' || type === 'rifle') {
      wc.rect(2, 7, 7, 5, colB);
      wc.rect(9, 5, 14, 5, colA);
      wc.rect(22, 6, 8, 2, colA);
      wc.rect(14, 10, 4, 5, colB);
      wc.rect(12, 3, 6, 2, colB);
    } else if (type === 'sniper') {
      wc.rect(1, 7, 7, 4, colB);
      wc.rect(8, 6, 13, 4, colA);
      wc.rect(21, 6, 10, 2, colA);
      wc.rect(10, 3, 9, 3, colB);
    } else if (type === 'heavy' || type === 'minigun') {
      wc.rect(2, 5, 9, 6, colB);
      wc.rect(11, 4, 18, 7, colA);
      wc.rect(13, 11, 6, 4, colB);
      if (type === 'minigun') {
        wc.line(18, 5, 29, 5, '#111827', 1);
        wc.line(18, 8, 29, 8, '#111827', 1);
      }
    } else if (type === 'blade') {
      wc.line(4, 13, 9, 9, colB, 3);
      wc.line(9, 9, 28, 2, colA, 2);
      wc.line(10, 8, 27, 2, '#ffffff', 1);
    } else if (type === 'crossbow') {
      wc.rect(4, 7, 20, 3, colA);
      wc.line(18, 2, 18, 14, colB, 2);
      wc.line(20, 8, 29, 8, '#fef08a', 2);
    } else {
      wc.rect(3, 4, 24, 7, colA);
      wc.rect(9, 11, 5, 4, colB);
      wc.rect(24, 3, 5, 9, colB);
    }
    wc.outlineRegion(0, 0, 32, 16, PAL.outline);
    wc.save(`weapons/${file}`);
  }

  // Новые NPC: Инженер, Механик, Спасённый Боец и Пленник (64x32, 2 кадра)
  const extraNpcs = [
    { file: 'npc_engineer.png', coat: '#1d4ed8', hat: '#facc15', shirt: '#38bdf8', pants: '#1e293b' },
    { file: 'npc_mechanic.png', coat: '#b45309', hat: '#dc2626', shirt: '#f97316', pants: '#292524' },
    { file: 'npc_fighter.png',  coat: '#3f6212', hat: '#15803d', shirt: '#84cc16', pants: '#1a2e05' },
    { file: 'npc_prisoner.png', coat: '#ea580c', hat: null,      shirt: '#fdba74', pants: '#7c2d12' }
  ];
  for (const spc of extraNpcs) {
    const nc = new PixelCanvas(64, 32);
    for (let f = 0; f < 2; f++) {
      const ox = f * 32, bob = f === 1 ? -1 : 0;
      const cx = ox + 16, by = 28 + bob;
      nc.ellipse(ox + 16, 29, 6, 2, '#00000055');
      nc.rect(cx - 4, by - 6, 3, 5, spc.pants);
      nc.rect(cx + 1, by - 6, 3, 5, spc.pants);
      nc.rect(cx - 5, by - 15, 10, 9, spc.coat);
      nc.rect(cx - 2, by - 14, 4, 7, spc.shirt);
      nc.circle(cx, by - 20, 4.5, PAL.skin);
      nc.pset(cx - 2, by - 20, PAL.outline);
      nc.pset(cx + 2, by - 20, PAL.outline);
      if (spc.hat) nc.rect(cx - 5, by - 25, 10, 3, spc.hat);
      nc.outlineRegion(ox, 0, 32, 32, PAL.outline);
    }
    nc.save(`characters/${spc.file}`);
  }

  // Клетка для пленников (закрытая и открытая) + Терминал сигнализации + Контейнер модификаций
  const cage = new PixelCanvas(44, 44);
  cage.rect(4, 36, 36, 5, '#475569');
  cage.rect(4, 6, 36, 4, '#64748b');
  for (let x = 6; x <= 36; x += 6) cage.rect(x, 8, 2, 29, '#94a3b8');
  cage.rect(19, 20, 6, 6, '#fbbf24');
  cage.outlineRegion(0, 0, 44, 44, PAL.outline);
  cage.save('props/cage.png');

  const cageOpen = new PixelCanvas(44, 44);
  cageOpen.rect(4, 36, 36, 5, '#475569');
  cageOpen.rect(4, 6, 36, 4, '#64748b');
  cageOpen.rect(6, 8, 2, 29, '#94a3b8');
  cageOpen.rect(36, 8, 2, 29, '#94a3b8');
  cageOpen.outlineRegion(0, 0, 44, 44, PAL.outline);
  cageOpen.save('props/cage_open.png');

  const alarm = new PixelCanvas(28, 36);
  alarm.brickRect(6, 10, 16, 22, '#334155', '#1e293b', '#64748b');
  alarm.rect(9, 14, 10, 6, '#22d3ee');
  alarm.circle(14, 6, 3.5, '#ef4444');
  alarm.outlineRegion(0, 0, 28, 36, PAL.outline);
  alarm.save('props/alarm_terminal.png');

  const modBox = new PixelCanvas(32, 28);
  modBox.brickRect(3, 6, 26, 18, '#312e81', '#1e1b4b', '#6366f1');
  modBox.rect(3, 13, 26, 3, '#22d3ee');
  modBox.rect(13, 11, 6, 7, '#fbbf24');
  modBox.outlineRegion(0, 0, 32, 28, PAL.outline);
  modBox.save('props/mod_crate.png');
}

// 12. RISE OF THE ABYSS: 10 новых врагов, 5 боссов Бездны, 6 видов оружия, сундуки, ловушки, кристаллы и тайлы локаций
function generateAbyssExpansion() {
  const humanoid = (file, cfg) => {
    const fw = cfg.size || 32, fh = cfg.size || 32;
    const pc = new PixelCanvas(fw * 6, fh);
    const mid = Math.floor(fw / 2);
    for (let f = 0; f < 6; f++) {
      const ox = f * fw, step = f % 4, isAtk = f >= 4;
      const bob = step % 2 === 1 ? -1 : 0;
      const cx = ox + mid, by = fh - 4 + bob;
      pc.ellipse(ox + mid, fh - 3, 7, 2, '#00000055');
      const lOff = step === 1 ? -2 : 0, rOff = step === 3 ? -2 : 0;
      pc.rect(cx - 5, by - 7 + lOff, 4, 6, cfg.pants);
      pc.rect(cx + 1, by - 7 + rOff, 4, 6, cfg.pants);
      pc.rect(cx - 6, by - 17, 12, 10, cfg.torso);
      if (cfg.vest) pc.rect(cx - 5, by - 16, 10, 7, cfg.vest);
      const armX = isAtk ? 4 : 1;
      pc.rect(cx - 8, by - 16, 3, 7, cfg.torso);
      pc.rect(cx + 5, by - 16, 3 + armX, 4, cfg.gun || cfg.torso);
      pc.circle(cx, by - 21, 5, cfg.skin || '#eac096');
      if (cfg.helmet) pc.rect(cx - 6, by - 27, 12, 5, cfg.helmet);
      if (cfg.visor) pc.rect(cx - 4, by - 22, 8, 2, cfg.visor);
      else { pc.pset(cx - 2, by - 22, cfg.eye || '#ef4444'); pc.pset(cx + 2, by - 22, cfg.eye || '#ef4444'); }
      pc.outlineRegion(ox, 0, fw, fh, PAL.outline);
    }
    pc.save(`characters/${file}`);
  };

  humanoid('skeleton_warrior_sheet.png', { torso: '#9aa5b1', vest: '#6b7280', pants: '#4b5563', skin: '#e5e7eb', eye: '#22d3ee', helmet: '#374151' });
  humanoid('dark_archer_sheet.png',      { torso: '#312e81', vest: '#1e1b4b', pants: '#111827', skin: '#c4b5fd', eye: '#a78bfa', helmet: '#1e1b4b', gun: '#a16207' });
  humanoid('abyss_mage_sheet.png',       { torso: '#4c1d95', vest: '#7c3aed', pants: '#1e1b4b', skin: '#ddd6fe', eye: '#22d3ee', helmet: '#581c87', gun: '#22d3ee' });
  humanoid('cursed_wraith_sheet.png',    { torso: '#14532d', vest: '#166534', pants: '#052e16', skin: '#bbf7d0', eye: '#4ade80', helmet: '#052e16', gun: '#22c55e' });
  humanoid('thorn_hunter_sheet.png',     { torso: '#713f12', vest: '#a16207', pants: '#422006', skin: '#fde68a', eye: '#f97316', helmet: '#713f12', gun: '#84cc16' });
  humanoid('plague_bearer_sheet.png',    { torso: '#3f3f06', vest: '#65a30d', pants: '#27272a', skin: '#a3e635', eye: '#fef08a', helmet: '#365314', gun: '#65a30d' });
  humanoid('frost_revenant_sheet.png',   { torso: '#0e7490', vest: '#155e75', pants: '#082f49', skin: '#e0f2fe', eye: '#38bdf8', helmet: '#164e63', gun: '#7dd3fc' });
  humanoid('void_cultist_sheet.png',     { torso: '#831843', vest: '#9d174d', pants: '#1f2937', skin: '#fbcfe8', eye: '#f43f5e', helmet: '#500724', gun: '#f43f5e' });

  // Каменный Голем (40x32)
  humanoid('stone_golem_sheet.png', { size: 40, torso: '#78716c', vest: '#57534e', pants: '#44403c', skin: '#a8a29e', eye: '#fbbf24', helmet: '#57534e' });

  // Костяная Гончая Бездны (36x32)
  const bh = new PixelCanvas(36 * 6, 32);
  for (let f = 0; f < 6; f++) {
    const ox = f * 36, step = f % 4, isAtk = f >= 4;
    const by = 27 - (step % 2);
    bh.ellipse(ox + 18, 29, 9, 2.5, '#00000055');
    bh.ellipse(ox + 16, by - 9, 9, 6, '#d6d3cd');
    bh.rect(ox + 10, by - 16, 14, 4, '#e7e5df'); // костяной хребет
    bh.rect(ox + 22, by - 12, isAtk ? 9 : 6, 5, '#e7e5df');
    bh.pset(ox + 25, by - 11, '#22d3ee');
    bh.rect(ox + 10, by - 4, 3, 4, '#a8a29e');
    bh.rect(ox + 20, by - 4, 3, 4, '#a8a29e');
    bh.outlineRegion(ox, 0, 36, 32, PAL.outline);
  }
  bh.save('characters/bone_hound_sheet.png');

  // 5 Боссов Бездны (64x64 x 6)
  const abyssBosses = [
    { file: 'boss_rune_golem.png',    body: '#78716c', plate: '#a8a29e', core: '#fbbf24', eye: '#fde047', style: 'golem' },
    { file: 'boss_necromancer.png',   body: '#1e1b4b', plate: '#4c1d95', core: '#4ade80', eye: '#4ade80', style: 'necro' },
    { file: 'boss_cursed_queen.png',  body: '#14532d', plate: '#16a34a', core: '#bbf7d0', eye: '#f43f5e', style: 'queen' },
    { file: 'boss_abyss_warlord.png', body: '#450a0a', plate: '#991b1b', core: '#fb923c', eye: '#fca5a5', style: 'warlord' },
    { file: 'boss_abyss_heart.png',   body: '#500724', plate: '#9d174d', core: '#22d3ee', eye: '#ffffff', style: 'heart' }
  ];
  for (const bs of abyssBosses) {
    const bw = 64, bh2 = 64;
    const bc = new PixelCanvas(bw * 6, bh2);
    for (let f = 0; f < 6; f++) {
      const ox = f * bw, step = f % 4, isAtk = f >= 4;
      const bob = step % 2 === 1 ? -2 : 0;
      const cx = ox + 32, by = 58 + bob;
      bc.ellipse(ox + 32, 59, 19, 5, '#00000072');
      const lOff = step === 1 ? -3 : 0, rOff = step === 3 ? -3 : 0;
      bc.brickRect(cx - 13, by - 16 + lOff, 10, 15, bs.body, '#111827', bs.plate);
      bc.brickRect(cx + 3, by - 16 + rOff, 10, 15, bs.body, '#111827', bs.plate);
      bc.ellipse(cx, by - 29, 16, 14, bs.body);
      bc.brickRect(cx - 12, by - 39, 24, 18, bs.plate, bs.body, '#ffffff44');
      // Ядро/сердце босса пульсирует по кадрам
      bc.circle(cx, by - 30, 4 + (f % 3), bs.core);
      bc.circle(cx, by - 30, 2, '#ffffff');
      bc.circle(cx - 17, by - 37, 7, bs.body);
      bc.circle(cx + 17, by - 37, 7, bs.body);
      if (bs.style === 'necro') {
        bc.line(cx - 7, by - 53, cx - 9, by - 61, '#4ade80', 2);
        bc.line(cx + 7, by - 53, cx + 9, by - 61, '#4ade80', 2);
        bc.rect(cx + 14, by - 52, 4, 20, '#7c3aed'); // посох некроманта
      } else if (bs.style === 'queen') {
        bc.line(cx - 10, by - 52, cx - 14, by - 60, '#4ade80', 2);
        bc.line(cx, by - 54, cx, by - 62, '#4ade80', 2);
        bc.line(cx + 10, by - 52, cx + 14, by - 60, '#4ade80', 2);
      } else if (bs.style === 'golem') {
        bc.rect(cx - 20, by - 55, 8, 10, '#a8a29e');
        bc.rect(cx + 12, by - 55, 8, 10, '#a8a29e');
        bc.pset(cx - 16, by - 51, bs.core); bc.pset(cx + 16, by - 51, bs.core);
      } else if (bs.style === 'heart') {
        bc.line(cx - 8, by - 38, cx - 26, by - 54 + (f % 2) * 3, bs.core, 3);
        bc.line(cx + 8, by - 38, cx + 26, by - 54 + (f % 2) * 3, bs.core, 3);
      } else if (bs.style === 'warlord') {
        bc.rect(cx + 16, by - 48, 5, 22, '#cbd5e1'); // огромный клинок
        bc.line(cx - 20, by - 44, cx - 26, by - 52, '#fb923c', 3);
      }
      const slamY = isAtk ? -8 : 0;
      bc.rect(cx - 25, by - 35 + slamY, 8, 17, bs.body);
      bc.rect(cx + 17, by - 35 + slamY, 8, 17, bs.body);
      bc.circle(cx, by - 45, 9, bs.body);
      bc.rect(cx - 6, by - 47, 4, 2, bs.eye);
      bc.rect(cx + 2, by - 47, 4, 2, bs.eye);
      bc.outlineRegion(ox, 0, bw, bh2, PAL.outline);
    }
    bc.save(`bosses/${bs.file}`);
  }

  // 6 новых видов оружия (мечи, кинжалы, топоры, посохи, дальнобойное, легендарное)
  const abyssWeapons = [
    ['shadow_dagger.png', '#c084fc', '#1e1b4b', 'blade'],
    ['war_axe.png',       '#f59e0b', '#78350f', 'axe'],
    ['abyss_staff.png',   '#22d3ee', '#4c1d95', 'staff'],
    ['thorn_bow.png',     '#4ade80', '#713f12', 'bow2'],
    ['vex_blade.png',     '#22d3ee', '#500724', 'blade'],
    ['phoenix_rifle.png', '#fb923c', '#7f1d1d', 'rifle2']
  ];
  for (const [file, colA, colB, type] of abyssWeapons) {
    const wc = new PixelCanvas(32, 16);
    if (type === 'blade') { wc.line(4, 13, 9, 9, colB, 3); wc.line(9, 9, 28, 2, colA, 2); wc.line(10, 8, 27, 2, '#ffffff', 1); }
    else if (type === 'axe') { wc.line(5, 14, 22, 4, colB, 3); wc.rect(19, 1, 9, 8, colA); wc.rect(23, 3, 5, 4, '#e5e7eb'); }
    else if (type === 'staff') { wc.line(6, 14, 22, 3, colB, 3); wc.circle(24, 4, 4, colA); wc.circle(24, 4, 2, '#ffffff'); }
    else if (type === 'bow2') { wc.line(8, 1, 8, 15, colA, 2); wc.line(8, 1, 20, 8, colB, 1); wc.line(8, 15, 20, 8, colB, 1); wc.line(8, 8, 27, 8, '#fef08a', 2); }
    else { wc.rect(2, 7, 7, 5, colB); wc.rect(9, 5, 14, 5, colA); wc.rect(22, 6, 8, 2, colA); wc.circle(24, 4, 2.5, colA); wc.rect(14, 10, 4, 5, colB); }
    wc.outlineRegion(0, 0, 32, 16, PAL.outline);
    wc.save(`weapons/${file}`);
  }

  // Тайлы трёх новых локаций
  const mkTile = (base, a1, a2, name) => {
    const t = new PixelCanvas(32, 32);
    t.rect(0, 0, 32, 32, base);
    for (let i = 0; i < 40; i++) { const x = (i * 17 + 4) % 30, y = (i * 13 + 3) % 30; t.rect(x, y, 2, 1, i % 2 ? a1 : a2); }
    t.save(`tiles/${name}`);
  };
  mkTile('#6d675e', '#574f45', '#8a8172', 'ruins.png');
  mkTile('#1d3a24', '#14291a', '#2c5233', 'cursed.png');
  mkTile('#241a2e', '#181021', '#37284a', 'abyss.png');

  // Сундуки, ловушки, кристалл, руинная колонна, кузнец
  const chest = new PixelCanvas(34, 30);
  chest.brickRect(3, 9, 28, 17, '#8a5a2b', '#5e3d1c', '#c99044');
  chest.rect(3, 9, 28, 5, '#a9743a'); chest.rect(15, 15, 5, 6, '#facc15');
  chest.outlineRegion(0, 0, 34, 30, PAL.outline); chest.save('props/chest.png');

  const cchest = new PixelCanvas(34, 30);
  cchest.brickRect(3, 9, 28, 17, '#3b0764', '#22063d', '#7e22ce');
  cchest.rect(3, 9, 28, 5, '#581c87'); cchest.rect(15, 15, 5, 6, '#e879f9'); cchest.circle(17, 6, 3, '#e879f9');
  cchest.outlineRegion(0, 0, 34, 30, PAL.outline); cchest.save('props/cursed_chest.png');

  const spikes = new PixelCanvas(32, 24);
  spikes.rect(2, 17, 28, 5, '#44403c');
  for (let x = 4; x < 30; x += 6) { spikes.line(x + 2, 17, x + 2, 5, '#cbd5e1', 2); }
  spikes.outlineRegion(0, 0, 32, 24, PAL.outline); spikes.save('props/trap_spikes.png');

  const tfire = new PixelCanvas(32, 24);
  tfire.rect(2, 17, 28, 5, '#450a0a');
  tfire.circle(10, 13, 5, '#dc2626'); tfire.circle(18, 11, 6, '#f97316'); tfire.circle(24, 13, 4, '#facc15');
  tfire.outlineRegion(0, 0, 32, 24, PAL.outline); tfire.save('props/trap_fire.png');

  const tpois = new PixelCanvas(32, 24);
  tpois.ellipse(16, 14, 13, 6, '#365314'); tpois.circle(11, 11, 3, '#65a30d'); tpois.circle(20, 9, 2.5, '#a3e635');
  tpois.outlineRegion(0, 0, 32, 24, PAL.outline); tpois.save('props/trap_poison.png');

  const crys = new PixelCanvas(32, 36);
  crys.line(16, 33, 9, 13, '#164e63', 5); crys.line(16, 33, 16, 6, '#0e7490', 6); crys.line(16, 33, 24, 12, '#155e75', 5);
  crys.line(16, 28, 16, 9, '#22d3ee', 2); crys.pset(16, 8, '#ffffff');
  crys.outlineRegion(0, 0, 32, 36, PAL.outline); crys.save('props/crystal_node.png');

  const pillar = new PixelCanvas(30, 46);
  pillar.brickRect(8, 8, 14, 34, '#8a8172', '#6d675e', '#a49a87');
  pillar.rect(5, 4, 20, 6, '#78716c'); pillar.rect(5, 40, 20, 5, '#78716c');
  pillar.outlineRegion(0, 0, 30, 46, PAL.outline); pillar.save('props/ruins_pillar.png');

  const smith = new PixelCanvas(64, 32);
  for (let f = 0; f < 2; f++) {
    const ox = f * 32, bob = f === 1 ? -1 : 0, cx = ox + 16, by = 28 + bob;
    smith.ellipse(ox + 16, 29, 6, 2, '#00000055');
    smith.rect(cx - 4, by - 6, 3, 5, '#292524'); smith.rect(cx + 1, by - 6, 3, 5, '#292524');
    smith.rect(cx - 5, by - 15, 10, 9, '#7c2d12'); smith.rect(cx - 2, by - 14, 4, 7, '#f97316');
    smith.rect(cx + 4, by - 13, 5, 3, '#94a3b8'); // молот кузнеца
    smith.circle(cx, by - 20, 4.5, PAL.skin);
    smith.pset(cx - 2, by - 20, PAL.outline); smith.pset(cx + 2, by - 20, PAL.outline);
    smith.rect(cx - 5, by - 25, 10, 3, '#44403c');
    smith.outlineRegion(ox, 0, 32, 32, PAL.outline);
  }
  smith.save('characters/npc_smith.png');
}

generateHeroSheet();
generateEnemySheets();
generateNpcs();
generateWeapons();
generateItems();
generateVehicles();
generateProps();
generateBuildings();
generateEffects();
generateTiles();
generateVexmoraExpansion();
generateAbyssExpansion();

console.log('generate-pixel-assets: обновлены текстурированные PNG-спрайты VEXMORA (RISE OF THE ABYSS)!');
