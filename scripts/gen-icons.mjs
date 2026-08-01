// Generates the PWA icons as PNGs with no image dependencies: three teal dots
// tapering down-right on a dark background. Run: node scripts/gen-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(...bufs) {
  let c = ~0;
  for (const buf of bufs) {
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(t, data));
  return Buffer.concat([len, t, data, crc]);
}

function png(size, pixel) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * stride + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [11, 18, 32];
const FG = [52, 211, 153];
const DOTS = [
  { cx: 0.3, cy: 0.34, r: 0.16 },
  { cx: 0.55, cy: 0.56, r: 0.105 },
  { cx: 0.74, cy: 0.72, r: 0.062 },
];

function draw(size) {
  return png(size, (x, y) => {
    let alpha = 0;
    for (const d of DOTS) {
      const dist = Math.hypot(x + 0.5 - d.cx * size, y + 0.5 - d.cy * size);
      const a = Math.min(1, Math.max(0, d.r * size - dist + 0.5));
      alpha = Math.max(alpha, a);
    }
    return [
      Math.round(BG[0] + (FG[0] - BG[0]) * alpha),
      Math.round(BG[1] + (FG[1] - BG[1]) * alpha),
      Math.round(BG[2] + (FG[2] - BG[2]) * alpha),
      255,
    ];
  });
}

mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), draw(size));
  console.log(`public/${name} (${size}x${size})`);
}
