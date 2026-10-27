// Генератор иконок VEXMORA из официального арта «AGE OF THE FALLEN GODS»
// (resources/icon-art.png) без внешних библиотек: чистый Node + zlib.
// Собирает: www/icon.png (512), Android legacy/round/foreground по плотностям.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ── PNG: CRC + кодирование (RGBA) ──────────────────────────────────────
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
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}
function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// ── PNG: декодирование исходного арта (8 бит, RGB/RGBA, без interlace) ─
function decodePNG(buf) {
  let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || ![0, 2, 3, 4, 6].includes(colorType)) {
    throw new Error(`Неподдерживаемый PNG арта: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  let palette = null, trns = null;
  off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'PLTE') palette = buf.subarray(off + 8, off + 8 + len);
    if (type === 'tRNS') trns = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const rowOff = y * (stride + 1);
    const filter = raw[rowOff];
    const row = Buffer.from(raw.subarray(rowOff + 1, rowOff + 1 + stride));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      if (filter === 1) row[x] = (row[x] + a) & 0xff;
      else if (filter === 2) row[x] = (row[x] + b) & 0xff;
      else if (filter === 3) row[x] = (row[x] + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        row[x] = (row[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
    }
    prev = row;
    for (let x = 0; x < width; x++) {
      const si = x * channels, di = (y * width + x) * 4;
      if (colorType === 6) { rgba[di] = row[si]; rgba[di + 1] = row[si + 1]; rgba[di + 2] = row[si + 2]; rgba[di + 3] = row[si + 3]; }
      else if (colorType === 2) { rgba[di] = row[si]; rgba[di + 1] = row[si + 1]; rgba[di + 2] = row[si + 2]; rgba[di + 3] = 255; }
      else if (colorType === 0) { rgba[di] = rgba[di + 1] = rgba[di + 2] = row[si]; rgba[di + 3] = 255; }
      else if (colorType === 4) { rgba[di] = rgba[di + 1] = rgba[di + 2] = row[si]; rgba[di + 3] = row[si + 1]; }
      else if (colorType === 3 && palette) {
        const pi = row[si] * 3;
        rgba[di] = palette[pi]; rgba[di + 1] = palette[pi + 1]; rgba[di + 2] = palette[pi + 2];
        rgba[di + 3] = trns && row[si] < trns.length ? trns[row[si]] : 255;
      }
    }
  }
  return { width, height, rgba };
}

// ── Качественный даунскейл усреднением по площади ──────────────────────
function resizeArea(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const sx = sw / dw, sy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < sh; yy++) {
        for (let xx = x0; xx < x1 && xx < sw; xx++) {
          const i = (yy * sw + xx) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3]; n++;
        }
      }
      const o = (y * dw + x) * 4;
      out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n); out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

function applyRoundMask(rgba, size) {
  const out = Buffer.from(rgba);
  const c = (size - 1) * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((x - c) / (size * 0.5), (y - c) / (size * 0.5));
      if (r > 0.985) out[(y * size + x) * 4 + 3] = 0;
    }
  }
  return out;
}

// ── Сборка всех иконок из арта ──────────────────────────────────────────
const artPath = path.resolve('resources/icon-art.png');
if (!fs.existsSync(artPath)) throw new Error('Не найден исходный арт иконки: resources/icon-art.png');
const art = decodePNG(fs.readFileSync(artPath));
console.log(`generate-icons: арт ${art.width}x${art.height} загружен`);

const densities = [
  ['mipmap-mdpi', 48, 108],
  ['mipmap-hdpi', 72, 162],
  ['mipmap-xhdpi', 96, 216],
  ['mipmap-xxhdpi', 144, 324],
  ['mipmap-xxxhdpi', 192, 432]
];

const outRoot = path.resolve('resources/android');
for (const [folder, legacySize, fgSize] of densities) {
  const dir = path.join(outRoot, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), encodePNG(legacySize, legacySize, resizeArea(art.rgba, art.width, art.height, legacySize, legacySize)));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), encodePNG(legacySize, legacySize, applyRoundMask(resizeArea(art.rgba, art.width, art.height, legacySize, legacySize), legacySize)));
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), encodePNG(fgSize, fgSize, resizeArea(art.rgba, art.width, art.height, fgSize, fgSize)));
}

fs.mkdirSync('www', { recursive: true });
fs.writeFileSync('www/icon.png', encodePNG(512, 512, resizeArea(art.rgba, art.width, art.height, 512, 512)));
console.log('generate-icons: иконки VEXMORA из арта AGE OF THE FALLEN GODS успешно созданы');
