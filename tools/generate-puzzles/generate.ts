// SLYDE — Procedural puzzle-image generator (Phase 5 "image packs").
// Writes deterministic 1024x1024 PNG placeholders into assets/puzzles/, one per
// art slot (01.png..50.png). The shipped pack is real hand-picked art, so by
// default this script only fills EMPTY slots — pass --force to overwrite.
// Run: npm run generate:puzzles
//      npm run generate:puzzles -- --force

import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SIZE = 1024;
/** Must match PUZZLE_IMAGE_COUNT in src/config.ts: indexes 0..49. */
const COUNT = 50;
/** Overwrite existing files (off by default so real art is never clobbered). */
const FORCE = process.argv.includes('--force');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Minimal truecolour PNG encoder (filter 0, zlib level 9). */
function png(rgb: Uint8Array, w = SIZE, h = SIZE): Buffer {
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  const src = Buffer.from(rgb.buffer, rgb.byteOffset, rgb.length);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    src.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

type RGB = [number, number, number];

/** Filename prefix for a pack index (0 -> "01"). */
function fileName(i: number): string {
  return `${String(i + 1).padStart(2, '0')}.png`;
}

// ---------------------------------------------------------------------------
// Art — distinct abstract patterns (5 colour directions × 10 variants = 50).
// A bright accent mark sits in a different corner per image, which makes tile
// placement readable while solving (important for the 5×6 "image only" track).
// ---------------------------------------------------------------------------

interface Palette { deep: RGB; mid: RGB; light: RGB; accent: RGB }

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

const PALETTES: Palette[] = [
  { deep: [24, 32, 46], mid: [58, 92, 130], light: [170, 210, 234], accent: [247, 200, 96] },
  { deep: [40, 23, 14], mid: [148, 84, 44], light: [238, 198, 134], accent: [110, 190, 130] },
  { deep: [16, 38, 28], mid: [46, 110, 78], light: [180, 226, 178], accent: [250, 226, 140] },
  { deep: [42, 20, 52], mid: [120, 62, 140], light: [226, 192, 236], accent: [255, 172, 112] },
  { deep: [48, 22, 26], mid: [166, 52, 62], light: [246, 188, 158], accent: [124, 202, 220] },
];

function draw(i: number): Uint8Array {
  const p = PALETTES[i % PALETTES.length];
  const motif = i % PALETTES.length;
  const variant = Math.floor(i / PALETTES.length); // 0..(COUNT/5 - 1)
  const out = new Uint8Array(SIZE * SIZE * 3);

  // Accent mark: filled disc + ring, walking around the corners.
  const ax = [0.22, 0.78, 0.78, 0.22][i % 4];
  const ay = [0.22, 0.22, 0.78, 0.78][i % 4];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      let t: number;

      switch (motif) {
        case 0: // radial glow
          t = 1 - clamp01(Math.hypot(u - 0.5, v - 0.5) / 0.72);
          break;
        case 1: // diagonal stripes
          t = 0.5 + 0.5 * Math.sin((u + v) * (6 + variant * 4) * Math.PI);
          break;
        case 2: // concentric rings
          t = 0.5 + 0.5 * Math.sin(Math.hypot(u - 0.5, v - 0.5) * (7 + variant * 5) * Math.PI);
          break;
        case 3: // diamond grid
          t = Math.abs((((u + v) * (4 + variant)) % 1) - 0.5) * 2;
          break;
        default: // wave bands
          t = 0.5 + 0.5 * Math.sin((v * (5 + variant * 2) + Math.sin(u * 4)) * Math.PI);
          break;
      }

      // Two-stage ramp deep -> mid -> light keeps contrast high for tiles.
      let c = t < 0.5 ? lerp3(p.deep, p.mid, t * 2) : lerp3(p.mid, p.light, (t - 0.5) * 2);

      // Accent disc with a soft halo.
      const da = Math.hypot(u - ax, v - ay);
      if (da < 0.105) c = p.accent;
      else if (da < 0.135) c = lerp3(c, p.accent, 1 - (da - 0.105) / 0.03);

      // Corner anchors: a pale square in the opposite corner adds orientation.
      const bx = 1 - ax;
      const by = 1 - ay;
      if (Math.abs(u - bx) < 0.06 && Math.abs(v - by) < 0.06) c = p.light;

      // Vignette so tiles read as one picture, not flat colour fields.
      const vig = 1 - 0.26 * clamp01((Math.hypot(u - 0.5, v - 0.5) - 0.3) / 0.55);
      const o = (y * SIZE + x) * 3;
      out[o] = Math.round(clamp01((c[0] * vig) / 255) * 255);
      out[o + 1] = Math.round(clamp01((c[1] * vig) / 255) * 255);
      out[o + 2] = Math.round(clamp01((c[2] * vig) / 255) * 255);
    }
  }
  return out;
}

const OUT = join(__dirname, '..', '..', 'assets', 'puzzles');
mkdirSync(OUT, { recursive: true });

let written = 0;
let kept = 0;
for (let i = 0; i < COUNT; i++) {
  const file = join(OUT, fileName(i));
  if (!FORCE && existsSync(file)) {
    kept++;
    continue;
  }
  writeFileSync(file, png(draw(i)));
  written++;
}
console.log(
  `Wrote ${written} of ${COUNT} puzzle images to assets/puzzles` +
    (kept > 0 ? ` (${kept} existing files kept — pass --force to overwrite)` : '')
);
