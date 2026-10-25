// Генератор PNG-иконок приложения Horizon RP без внешних библиотек (чистый Node + zlib)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([lenBuf, combined, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter None
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function renderEmblem(size, transparentBg = false, roundMask = false) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = (size - 1) * 0.5;
  const cy = (size - 1) * 0.5;
  const maxR = size * 0.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = (x - cx) / maxR; // -1..1
      const ny = (y - cy) / maxR;
      const r = Math.hypot(nx, ny);

      if (roundMask && r > 0.96) {
        buf[idx + 3] = 0;
        continue;
      }

      // Фон: тёмный обсидиан с фиолетово-синим свечением
      let red = 11, green = 15, blue = 28, alpha = transparentBg ? 0 : 255;
      if (!transparentBg) {
        const glow = Math.max(0, 1 - r * 1.05);
        red = Math.round(11 + glow * 28);
        green = Math.round(15 + glow * 26);
        blue = Math.round(28 + glow * 68);
      }

      // Кольцо Горизонта
      const ringDist = Math.abs(r - 0.62);
      if (ringDist < 0.075) {
        const t = 1 - ringDist / 0.075;
        red = Math.round(red * (1 - t) + 56 * t);
        green = Math.round(green * (1 - t) + 189 * t);
        blue = Math.round(blue * (1 - t) + 248 * t);
        alpha = Math.max(alpha, Math.round(255 * t));
      }

      // Диагональный золотой клинок Рубежа
      const diag = Math.abs(nx + ny * 0.55);
      if (diag < 0.10 && Math.abs(ny) < 0.56 && Math.abs(nx) < 0.56) {
        const bladeT = 1 - diag / 0.10;
        red = Math.round(red * (1 - bladeT) + 251 * bladeT);
        green = Math.round(green * (1 - bladeT) + 191 * bladeT);
        blue = Math.round(blue * (1 - bladeT) + 36 * bladeT);
        alpha = 255;
      }

      // Буква H в центре
      const inLeftBar = nx > -0.28 && nx < -0.15 && Math.abs(ny) < 0.34;
      const inRightBar = nx > 0.15 && nx < 0.28 && Math.abs(ny) < 0.34;
      const inBridge = Math.abs(nx) <= 0.28 && Math.abs(ny) < 0.065;
      if (inLeftBar || inRightBar || inBridge) {
        red = 248;
        green = 250;
        blue = 252;
        alpha = 255;
      }

      buf[idx] = red;
      buf[idx + 1] = green;
      buf[idx + 2] = blue;
      buf[idx + 3] = alpha;
    }
  }
  return encodePNG(size, size, buf);
}

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
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), renderEmblem(legacySize, false, false));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), renderEmblem(legacySize, true, true));
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), renderEmblem(fgSize, true, false));
}

fs.mkdirSync('www', { recursive: true });
fs.writeFileSync('www/icon.png', renderEmblem(192, false, false));
console.log('generate-icons: PNG иконки Horizon RP успешно созданы');
